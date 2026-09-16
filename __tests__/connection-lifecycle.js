import React, {useContext} from 'react';
import renderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import StorageProvider, {StorageContext} from '../src/contexts/storage';
import IoTCProvider, {IoTCContext} from '../src/contexts/iotc';
import {useConnectIoTCentralClient, useSimulation} from '../src/hooks/iotc';
import {createDeviceClient, ConnectionError} from '../src/connection';
import App from '../src/App';

jest.mock('../src/connection/client', () => ({
  createDeviceClient: jest.fn(),
}));

// Keep App/Navigation and their providers real; the leaf screen exposes controls.
let mockAppCapture;
jest.mock('../src/Registration', () => ({
  Registration: function RegistrationProbe() {
    const React = require('react');
    const {StorageContext} = require('../src/contexts/storage');
    const {useConnectIoTCentralClient} = require('../src/hooks/iotc');
    mockAppCapture({
      connection: useConnectIoTCentralClient(),
      storage: React.useContext(StorageContext),
    });
    return null;
  },
}));

const credentials = {
  scopeId: '0ne12345678',
  deviceId: 'connection-lifecycle',
  deviceKey: Buffer.alloc(32, 2).toString('base64'),
};
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return {promise, resolve, reject};
};
const candidate = gate => ({
  connect: jest.fn(() => gate?.promise ?? Promise.resolve()),
  disconnect: jest.fn(async () => {}),
  cancel: jest.fn(),
  isConnected: jest.fn(() => true),
});

describe('connection lifecycle through real providers', () => {
  let tree;
  let consumers;
  let appControls;
  const Probe = ({index}) => {
    consumers[index] = {
      connection: useConnectIoTCentralClient(),
      simulation: useSimulation(),
      storage: useContext(StorageContext),
      central: useContext(IoTCContext),
    };
    return null;
  };
  const mount = async () => {
    await act(async () => {
      tree = renderer.create(
        <StorageProvider>
          <IoTCProvider>
            <Probe index={0} />
            <Probe index={1} />
          </IoTCProvider>
        </StorageProvider>,
      );
    });
  };
  const status = (index = 0) => consumers[index].connection[3];
  const start = async (index = 0, input = credentials, options) => {
    let result;
    await act(async () => {
      result = consumers[index].connection[0](input, options);
    });
    return {result};
  };

  beforeEach(() => {
    tree = undefined;
    consumers = [];
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    createDeviceClient.mockReset();
    Keychain.getGenericPassword.mockReset().mockResolvedValue(false);
    Keychain.setGenericPassword.mockReset().mockResolvedValue(true);
    Keychain.resetGenericPassword.mockReset().mockResolvedValue(true);
    mockAppCapture = value => {
      appControls = value;
    };
  });

  afterEach(async () => {
    try {
      await act(async () => tree?.unmount());
      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });
      jest.runAllTicks();
      expect(jest.getTimerCount()).toBe(0);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(global.XMLHttpRequest).not.toHaveBeenCalled();
      expect(global.WebSocket).not.toHaveBeenCalled();
      expect(
        JSON.stringify(console.log.mock.calls).includes(credentials.deviceKey),
      ).toBe(false);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
      jest.restoreAllMocks();
    }
  });

  it('serializes requests across TWO consumers and connects before persisting or publishing', async () => {
    const connection = deferred();
    const write = deferred();
    const device = candidate(connection);
    createDeviceClient.mockReturnValue(device);
    Keychain.setGenericPassword.mockImplementationOnce(() => write.promise);
    await mount();
    const first = await start();
    expect(status().loading).toBe(true);
    expect(status(1).loading).toBe(true);
    expect(status().client).toBeNull();
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
    const second = await start(1);
    expect((await second.result).error.code).toBe('BUSY');
    expect(createDeviceClient).toHaveBeenCalledTimes(1);
    expect(device.connect).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
      cleanSession: true,
      timeoutMs: 90000,
    });
    await act(async () => connection.resolve());
    expect(Keychain.setGenericPassword).toHaveBeenCalledTimes(1);
    expect(Keychain.setGenericPassword.mock.calls[0][0]).toBe(
      'IOTC_PAD_CLIENT',
    );
    expect(status().client).toBeNull();
    expect(status().loading).toBe(true);
    await act(async () => {
      write.resolve(true);
      expect(await first.result).toEqual({ok: true});
    });
    expect(status().client === device).toBe(true);
    expect(status(1).client === device).toBe(true);
    expect(status()).toMatchObject({
      loading: false,
      stage: 'connected',
      error: null,
    });
    expect(consumers[0].storage.credentials.deviceId).toBe(
      credentials.deviceId,
    );
  });

  it('does not persist or publish a failed candidate and allows a manual retry', async () => {
    const gate = deferred();
    const failed = candidate(gate);
    const retry = candidate();
    createDeviceClient.mockReturnValueOnce(failed).mockReturnValueOnce(retry);
    const onFailure = jest.fn();
    await mount();
    const attempt = await start(0, credentials, {onFailure});
    await act(async () => {
      gate.reject(new ConnectionError('CONNECT_FAILED'));
      expect((await attempt.result).error.code).toBe('CONNECT_FAILED');
    });
    expect(failed.cancel).toHaveBeenCalled();
    expect(status()).toMatchObject({
      client: null,
      loading: false,
      stage: 'error',
    });
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
    expect(consumers[0].central.request.current).toBeNull();
    const next = await start(1);
    expect(await next.result).toEqual({ok: true});
    expect(status().client === retry).toBe(true);
    expect(status().error).toBeNull();
  });

  it.each(['resolve', 'reject'])(
    'cancellation aborts and tears down without late %s effects, then permits retry',
    async settlement => {
      const gate = deferred();
      const device = candidate(gate);
      const retry = candidate();
      createDeviceClient.mockReturnValueOnce(device).mockReturnValueOnce(retry);
      const onFailure = jest.fn();
      const onSuccess = jest.fn();
      await mount();
      const attempt = await start(0, credentials, {onFailure, onSuccess});
      const options = createDeviceClient.mock.calls[0][1];
      await act(async () => consumers[1].connection[1]());
      expect(device.connect.mock.calls[0][0].signal.aborted).toBe(true);
      expect(device.cancel).toHaveBeenCalled();
      expect(status()).toMatchObject({
        client: null,
        loading: false,
        stage: 'idle',
        error: null,
      });
      await act(async () => {
        options.onStage('error', new ConnectionError('CONNECT_FAILED'));
        gate[settlement](
          settlement === 'reject' ? new Error('Late failure') : undefined,
        );
        expect((await attempt.result).error.code).toBe('CANCELLED');
      });
      expect(status()).toMatchObject({
        client: null,
        loading: false,
        stage: 'idle',
        error: null,
      });
      expect(onFailure).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
      const next = await start(1);
      expect(await next.result).toEqual({ok: true});
      expect(status().client === retry).toBe(true);
    },
  );

  it.each(['disconnect', 'forget credentials', 'mode switch'])(
    'aborts a pending connection on explicit %s',
    async action => {
      const gate = deferred();
      const device = candidate(gate);
      createDeviceClient.mockReturnValue(device);
      await mount();
      const attempt = await start();
      await act(async () => {
        if (action === 'disconnect') {
          consumers[1].connection[2]();
        } else if (action === 'forget credentials') {
          await consumers[1].connection[1]({clear: true});
        } else {
          await consumers[1].simulation[1](true);
        }
      });
      expect(device.connect.mock.calls[0][0].signal.aborted).toBe(true);
      expect(device.cancel).toHaveBeenCalled();
      await act(async () => {
        gate.reject(new Error('Late transport failure'));
        expect((await attempt.result).error.code).toBe('CANCELLED');
      });
      expect(status()).toMatchObject({
        client: null,
        loading: false,
        stage: 'idle',
        error: null,
      });
      expect(consumers[0].storage.credentials).toBeNull();
      if (action !== 'disconnect') {
        expect(consumers[0].storage.simulated).toBe(action === 'mode switch');
        expect(
          JSON.parse(Keychain.setGenericPassword.mock.calls[0][1]).credentials,
        ).toBeNull();
      } else {
        expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
      }
    },
  );

  it('keeps the reconnect loader on through old-client disconnect and pending new connection', async () => {
    const disconnect = deferred();
    const connect = deferred();
    const oldDevice = candidate();
    oldDevice.disconnect.mockImplementation(() => disconnect.promise);
    const newDevice = candidate(connect);
    createDeviceClient
      .mockReturnValueOnce(oldDevice)
      .mockReturnValueOnce(newDevice);
    await mount();
    const initial = await start();
    expect(await initial.result).toEqual({ok: true});
    const reconnect = await start(1);
    expect(oldDevice.disconnect).toHaveBeenCalledTimes(1);
    expect(status().loading).toBe(true);
    expect(createDeviceClient).toHaveBeenCalledTimes(1);
    await act(async () => disconnect.resolve());
    expect(newDevice.connect).toHaveBeenCalledTimes(1);
    expect(status().client).toBeNull();
    expect(status().loading).toBe(true);
    expect(status(1).loading).toBe(true);
    await act(async () => {
      connect.resolve();
      expect(await reconnect.result).toEqual({ok: true});
    });
    expect(status().client === newDevice).toBe(true);
    expect(status().loading).toBe(false);
  });

  it('sanitizes secure-write failure as STORAGE_FAILED and cancels the connected candidate', async () => {
    const device = candidate();
    const retry = candidate();
    createDeviceClient.mockReturnValueOnce(device).mockReturnValueOnce(retry);
    const privateMessage = 'native-detail-not-for-display';
    const onFailure = jest.fn();
    const onSuccess = jest.fn();
    await mount();
    const previousCredentials = {...credentials, deviceId: 'previous-device'};
    await act(async () => {
      await consumers[0].storage.save({credentials: previousCredentials});
    });
    Keychain.setGenericPassword.mockRejectedValueOnce(
      new Error(privateMessage),
    );
    const attempt = await start(0, credentials, {onFailure, onSuccess});
    const result = await attempt.result;
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('STORAGE_FAILED');
    expect(result.error.message.includes(privateMessage)).toBe(false);
    expect(status().error.code).toBe('STORAGE_FAILED');
    expect(status().error.message.includes(privateMessage)).toBe(false);
    expect(status()).toMatchObject({
      client: null,
      loading: false,
      stage: 'error',
    });
    expect(consumers[0].storage.credentials === previousCredentials).toBe(true);
    expect(device.cancel).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith(result.error);
    expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
    const next = await start(1);
    expect(await next.result).toEqual({ok: true});
    expect(status().client === retry).toBe(true);
    expect(status().error).toBeNull();
    expect(consumers[0].storage.credentials.deviceId).toBe(
      credentials.deviceId,
    );
  });

  it.each([true, false])(
    'actual App restores once and never reconnects after new credentials or explicit disconnect (stored: %s)',
    async stored => {
      const device = candidate();
      createDeviceClient.mockReturnValue(device);
      if (stored) {
        Keychain.getGenericPassword.mockResolvedValueOnce({
          username: 'IOTC_PAD_CLIENT',
          password: JSON.stringify({credentials}),
        });
      }
      await act(async () => {
        tree = renderer.create(<App />);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(2000);
        await jest.runOnlyPendingTimersAsync();
      });
      expect(Keychain.getGenericPassword).toHaveBeenCalledTimes(1);
      expect(createDeviceClient).toHaveBeenCalledTimes(stored ? 1 : 0);
      if (stored) {
        expect(appControls.connection[3].client === device).toBe(true);
      }
      await act(async () => {
        await appControls.storage.save({
          credentials: {...credentials, deviceId: 'updated-lifecycle'},
        });
      });
      expect(createDeviceClient).toHaveBeenCalledTimes(stored ? 1 : 0);
      await act(async () => {
        appControls.connection[2]();
      });
      await act(async () => {
        await jest.runOnlyPendingTimersAsync();
      });
      expect(appControls.connection[3]).toMatchObject({
        client: null,
        loading: false,
        stage: 'idle',
        error: null,
      });
      expect(appControls.storage.credentials.deviceId).toBe(
        'updated-lifecycle',
      );
      expect(createDeviceClient).toHaveBeenCalledTimes(stored ? 1 : 0);
      expect(Keychain.getGenericPassword).toHaveBeenCalledTimes(1);
      expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
    },
  );
});
