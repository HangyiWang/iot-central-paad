import React from 'react';
import renderer, {act} from 'react-test-renderer';
import ConnectionSummary from '../src/components/connectionSummary';
import * as hooks from '../src/hooks';
import {Alert, Share} from 'react-native';
import {PHONE_MODEL_ID} from '../src/connection/types';

jest.mock('../src/hooks', () => ({
  useConnectIoTCentralClient: jest.fn(),
  useIoTCentralClient: jest.fn(),
  useSimulation: jest.fn(),
  useTheme: () => ({colors: {card: '#fff'}}),
}));
jest.mock('../src/components/typography', () => ({Text: 'Text', Name: 'Text'}));

let view;
let connected;
let state;
const connect = jest.fn(async () => ({ok: true}));
const cancel = jest.fn(async () => {});
const clear = jest.fn();
const manual = jest.fn();
const text = () => JSON.stringify(view.toJSON());
const press = label =>
  view.root
    .findAll(
      node =>
        node.props.accessibilityRole === 'button' &&
        node
          .findAllByType('Text')
          .some(child => child.props.children === label),
    )[0]
    .props.onPress();
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  connected = true;
  state = {
    client: {
      id: 'registration-id',
      identity: {
        deviceId: 'Exact-Assigned-ID',
        assignedHub: 'assigned.azure-devices.net',
        registrationId: 'registration-id',
        modelId: PHONE_MODEL_ID,
      },
      isConnected: () => connected,
    },
    loading: false,
    error: null,
    stage: 'connected',
  };
  hooks.useConnectIoTCentralClient.mockImplementation(() => [
    connect,
    cancel,
    clear,
    state,
  ]);
  hooks.useIoTCentralClient.mockReturnValue([
    null,
    {deviceId: 'registration-id'},
  ]);
  hooks.useSimulation.mockReturnValue([false]);
});
it('opens scrollable details with value-only IDs and local-only destructive forgetting', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const share = jest.spyOn(Share, 'share').mockResolvedValue({});
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  act(() => press('Connection details'));
  const value = id => view.root.findAllByProps({testID: id})[0].props.children;
  expect(value('assigned-device-id')).toBe('Exact-Assigned-ID');
  expect(value('assigned-hub')).toBe('assigned.azure-devices.net');
  expect(value('model-id')).toBe(PHONE_MODEL_ID);
  expect(value('registration-id')).toBe('registration-id');
  expect(value('registry-status')).toBe('Not checked');
  await act(async () => {
    await press('Share nonsecret diagnostics');
  });
  expect(JSON.parse(share.mock.calls[0][0].message)).toMatchObject({
    registryStatus: 'Not checked',
  });
  act(() => press('Forget credentials'));
  expect(cancel).not.toHaveBeenCalled();
  expect(alert.mock.calls[0][1]).toContain('No Azure device');
  await act(async () => {
    await alert.mock.calls[0][2]
      .find(button => button.style === 'destructive')
      .onPress();
  });
  expect(cancel).toHaveBeenCalledWith({clear: true});
  alert.mockRestore();
  share.mockRestore();
});
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
  jest.runAllTicks();
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});
it('shows exact assigned identity and detects disconnect without starting a transport', async () => {
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  expect(text()).toContain('Exact-Assigned-ID');
  expect(text()).toContain('assigned.azure-devices.net');
  expect(text()).not.toContain('registration-id');
  expect(text()).toContain('Connected');
  act(() => press('Disconnect'));
  expect(clear).toHaveBeenCalledTimes(1);
  connected = false;
  act(() => jest.advanceTimersByTime(1000));
  expect(text()).toContain('Disconnected');
  await act(async () => {
    await press('Reconnect');
  });
  expect(connect).toHaveBeenCalledWith({deviceId: 'registration-id'});
  act(() => press('Connect manually'));
  expect(manual).toHaveBeenCalledTimes(1);
});
it('labels simulation as offline and exposes cancellation for the shared active request', async () => {
  hooks.useSimulation.mockReturnValue([true]);
  state = {...state, loading: true, stage: 'connecting'};
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  expect(text()).toContain('Offline simulation');
  expect(text()).toContain('Disconnected');
  expect(text()).not.toContain('Assigned device');
  await act(async () => {
    await press('Cancel');
  });
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(connect).not.toHaveBeenCalled();
});
