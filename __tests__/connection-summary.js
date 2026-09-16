import React from 'react';
import renderer, {act} from 'react-test-renderer';
import ConnectionSummary from '../src/components/connectionSummary';
import * as hooks from '../src/hooks';

jest.mock('../src/hooks', () => ({
  useConnectIoTCentralClient: jest.fn(),
  useIoTCentralClient: jest.fn(),
  useSimulation: jest.fn(),
  useTheme: () => ({colors: {card: '#fff'}}),
}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));

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
