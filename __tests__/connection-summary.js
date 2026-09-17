import React from 'react';
import renderer, {act} from 'react-test-renderer';
import ConnectionSummary from '../src/components/connectionSummary';
import * as hooks from '../src/hooks';
import {Alert, Share, Modal, Platform, StyleSheet} from 'react-native';
import {PHONE_MODEL_ID} from '../src/connection/types';
import {ConnectionError} from '../src/connection/errors';
import {palette} from '../src/theme/palette';
jest.mock('@rneui/themed', () => ({Icon: 'Icon'}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 60, bottom: 24, left: 14, right: 8}),
}));

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
const originalOS = Platform.OS;
const text = () => JSON.stringify(view.toJSON());
const press = label =>
  view.root
    .findAll(
      node =>
        node.props.accessibilityRole === 'button' &&
        (node.props.accessibilityLabel === label ||
          node
            .findAllByType('Text')
            .some(child => child.props.children === label)),
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
  expect(view.root.findByType(Modal).props.allowSwipeDismissal).toBe(
    Platform.OS === 'ios',
  );
  const value = id =>
    view.root.findAllByType('Text').find(node => node.props.testID === id)
      ?.props.children;
  expect(value('assigned-device-id')).toBe('Exact-Assigned-ID');
  expect(value('assigned-hub')).toBe('assigned.azure-devices.net');
  expect(value('model-id')).toBe(PHONE_MODEL_ID);
  expect(value('registration-id')).toBe('registration-id');
  expect(value('registry-status')).toBe('Not checked');
  const sheet = view.root.findAllByProps({testID: 'connection-details-sheet'});
  expect(sheet.length).toBeGreaterThan(0);
  expect(
    view.root.findAllByProps({testID: 'connection-details-close'}).length,
  ).toBeGreaterThan(0);
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
  Platform.OS = originalOS;
});
it.each(['android', 'ios'])(
  'protects Android modal controls from system insets without double-insetting the iOS page sheet (%s)',
  os => {
    Platform.OS = os;
    act(() => {
      view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
    });
    act(() => press('Connection details'));
    const sheet = view.root.findAllByProps({
      testID: 'connection-details-sheet',
    })[0];
    const style = StyleSheet.flatten(sheet.props.style);
    if (os === 'android') {
      expect(style).toMatchObject({
        paddingTop: 60,
        paddingBottom: 24,
        paddingLeft: 14,
        paddingRight: 8,
      });
    } else {
      expect(style.paddingTop).toBeUndefined();
    }
    act(() => press('Close'));
    expect(
      view.root.findAllByProps({testID: 'connection-details-sheet'}),
    ).toHaveLength(0);
  },
);
it('keeps the status row compact and preserves all actions and exact identity in details', async () => {
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  expect(text()).not.toContain('Exact-Assigned-ID');
  expect(text()).not.toContain('assigned.azure-devices.net');
  expect(text()).not.toContain('registration-id');
  expect(text()).toContain('Connected');
  expect(
    view.root
      .findAllByType('Text')
      .some(node => node.props.children === 'Cloud connection'),
  ).toBe(false);
  expect(
    view.root.findAllByProps({testID: 'connection-status'})[0].props
      .accessibilityHint,
  ).toBe('Cloud connection');
  expect(text()).not.toContain('connection-disconnect');
  const disclosure = view.root
    .findAllByProps({testID: 'connection-details'})
    .find(node => node.props.onPress);
  expect(disclosure.props.hitSlop).toBeDefined();
  expect(
    view.root
      .findAllByType('Icon')
      .some(icon => icon.props.name === 'chevron-right'),
  ).toBe(true);
  act(() => press('Connection details'));
  expect(text()).toContain('Exact-Assigned-ID');
  expect(text()).toContain('assigned.azure-devices.net');
  act(() => press('Disconnect'));
  expect(clear).toHaveBeenCalledTimes(1);
  connected = false;
  act(() => jest.advanceTimersByTime(1000));
  expect(text()).toContain('Disconnected');
  await act(async () => {
    await press('Reconnect');
  });
  expect(connect).toHaveBeenCalledWith({deviceId: 'registration-id'});
  expect(text()).not.toContain('connection-details-sheet');
  act(() => press('Connection details'));
  act(() => press('Connect manually'));
  expect(manual).toHaveBeenCalledTimes(1);
  expect(text()).not.toContain('connection-details-sheet');
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

it('replaces the plain error line with one actionable notice and keeps codes in details', async () => {
  connected = false;
  state = {
    ...state,
    error: new ConnectionError('CONNECT_FAILED', {
      status: 503,
      serviceCode: 404001,
      operationId: 'operation-9',
    }),
    stage: 'idle',
  };
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  const notices = view.root
    .findAllByProps({testID: 'connection-error'})
    .filter(node => typeof node.type === 'string');
  expect(notices).toHaveLength(1);
  expect(StyleSheet.flatten(notices[0].props.style).backgroundColor).toBe(
    palette(false).dangerSurface,
  );
  expect(text()).toContain('Could not connect');
  expect(text()).toContain('The device transport could not connect.');
  // Raw diagnostics stay in the details sheet, not in the compact row.
  expect(text()).not.toContain('CONNECT_FAILED');
  expect(text()).not.toContain('HTTP 503');
  expect(text()).not.toContain('404001');

  act(() => press('Connection details'));
  const value = id =>
    view.root.findAllByType('Text').filter(node => node.props.testID === id);
  expect(value('connection-error-code').map(n => n.props.children)).toEqual([
    'CONNECT_FAILED',
  ]);
  expect(value('connection-http-status').map(n => n.props.children)).toEqual([
    'HTTP 503',
  ]);
  expect(value('connection-service-code').map(n => n.props.children)).toEqual([
    '404001',
  ]);
  act(() => press('Close'));

  await act(async () => {
    await press('Reconnect');
  });
  expect(connect).toHaveBeenCalledWith({deviceId: 'registration-id'});
});

it('falls back to reviewing details when there is nothing saved to reconnect with', () => {
  connected = false;
  hooks.useIoTCentralClient.mockReturnValue([null, null]);
  state = {...state, error: new ConnectionError('CONNECTION_LOST')};
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  expect(text()).toContain('Connection interrupted');
  expect(
    view.root.findAllByProps({testID: 'connection-error-reconnect'}),
  ).toHaveLength(0);
  act(() => press('Review details'));
  expect(
    view.root.findAllByProps({testID: 'connection-details-sheet'}).length,
  ).toBeGreaterThan(0);
  expect(connect).not.toHaveBeenCalled();
});

it('hides the notice while a connection attempt is in flight', () => {
  state = {
    ...state,
    loading: true,
    stage: 'connecting',
    error: new ConnectionError('CONNECT_FAILED'),
  };
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  expect(view.root.findAllByProps({testID: 'connection-error'})).toHaveLength(
    0,
  );
  expect(text()).toContain('Connecting to the assigned IoT Hub');
});
