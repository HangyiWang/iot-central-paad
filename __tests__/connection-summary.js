import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import ConnectionSummary from '../src/components/connectionSummary';
import {ConnectionError} from '../src/connection/errors';
import {palette} from '../src/theme/palette';
import Strings from '../src/strings';
import * as hooks from '../src/hooks';

jest.mock('@rneui/themed', () => ({Icon: 'Icon'}));
jest.mock('../src/hooks', () => ({
  useConnectIoTCentralClient: jest.fn(),
  useIoTCentralClient: jest.fn(),
  useSimulation: jest.fn(),
  useTheme: jest.fn(),
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
const byId = id => view.root.findByProps({testID: id});
const summaryAction = id =>
  view.root
    .findAllByProps({testID: id})
    .find(node => typeof node.props.children === 'function');
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
  hooks.useTheme.mockReturnValue({dark: false, colors: {card: '#fff'}});
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
    width: 390,
    height: 800,
    scale: 2,
    fontScale: 1,
  });
});
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
  jest.runAllTicks();
  expect(jest.getTimerCount()).toBe(0);
  jest.restoreAllMocks();
  jest.useRealTimers();
});
it('discloses exact assigned identity and legacy actions without starting a transport', async () => {
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  expect(text()).not.toContain('Exact-Assigned-ID');
  expect(text()).not.toContain('Connect manually');
  expect(summaryAction('connection-details').props.accessibilityState).toEqual({
    expanded: false,
  });
  expect(connect).not.toHaveBeenCalled();
  act(() => press('Details'));
  expect(summaryAction('connection-details').props.accessibilityState).toEqual({
    expanded: true,
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
  act(() => press('Details'));
  expect(summaryAction('connection-details').props.accessibilityState).toEqual({
    expanded: false,
  });
  expect(
    view.root.findAllByProps({testID: 'connection-details-content'}),
  ).toHaveLength(0);
});
it('keeps simulation and its real loading stage visible with a full-sized Cancel target', async () => {
  hooks.useSimulation.mockReturnValue([true]);
  state = {...state, loading: true, stage: 'connecting'};
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  expect(text()).toContain('Offline simulation');
  expect(text()).toContain('Disconnected');
  expect(text()).not.toContain('Assigned device');
  expect(
    byId('connection-status-group')
      .findAllByType('Text')
      .map(node => node.props.children),
  ).toEqual([
    Strings.Connection.Summary.Disconnected,
    Strings.Connection.Summary.Simulated,
    Strings.Connection.Stages.connecting,
  ]);
  expect(
    byId('connection-status-emblem').findByType('Icon').props,
  ).toMatchObject({
    name: 'cloud-outline',
    size: 19,
    color: palette(false).muted,
  });
  const action = summaryAction('connection-cancel');
  expect(StyleSheet.flatten(action.props.style)).toMatchObject({
    minHeight: 48,
    minWidth: 92,
  });
  expect(
    StyleSheet.flatten(action.props.children({pressed: false}).props.style),
  ).toMatchObject({
    minHeight: 40,
    minWidth: 92,
    borderRadius: 14,
    backgroundColor: palette(false).inset,
  });
  expect(
    StyleSheet.flatten(action.props.children({pressed: true}).props.style),
  ).toMatchObject({
    backgroundColor: palette(false).border,
    transform: [{scale: 0.97}],
  });
  expect(action.props.accessibilityState).toBeUndefined();
  expect(view.root.findAllByProps({testID: 'connection-details'})).toHaveLength(
    0,
  );
  await act(async () => {
    await press('Cancel');
  });
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(connect).not.toHaveBeenCalled();
  expect(clear).not.toHaveBeenCalled();
});

it.each([false, true])(
  'uses the capsule field, ringed state emblem and tactile Details pill (dark: %s)',
  dark => {
    hooks.useTheme.mockReturnValue({dark, colors: {card: '#fff'}});
    act(() => {
      view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
    });
    const appearance = palette(dark);
    expect(
      StyleSheet.flatten(byId('connection-summary').props.style),
    ).toMatchObject({
      backgroundColor: appearance.background,
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 10,
    });
    expect(
      StyleSheet.flatten(byId('connection-status-capsule').props.style),
    ).toMatchObject({
      backgroundColor: appearance.surface,
      borderColor: appearance.border,
      borderRadius: 20,
      minHeight: 60,
      shadowOpacity: dark ? 0 : 0.06,
      elevation: dark ? 0 : 1,
    });
    const group = byId('connection-status-group');
    expect(StyleSheet.flatten(group.props.style).gap).toBe(14);
    // The state bead belongs to the emblem, not a second inline status dot.
    expect(group.props.children).toHaveLength(2);
    const emblem = byId('connection-status-emblem');
    expect(emblem.props).toMatchObject({
      accessible: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
    expect(StyleSheet.flatten(emblem.props.style)).toMatchObject({
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: appearance.positiveSurface,
    });
    expect(emblem.findByType('Icon').props).toMatchObject({
      name: 'cloud-check-outline',
      size: 19,
      color: appearance.positive,
    });
    expect(
      StyleSheet.flatten(byId('connection-status-ring').props.style),
    ).toMatchObject({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: appearance.positive,
    });
    expect(
      StyleSheet.flatten(byId('connection-status-bead').props.style),
    ).toMatchObject({
      position: 'absolute',
      right: -1,
      bottom: -1,
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: appearance.surface,
      backgroundColor: appearance.positive,
    });
    expect(
      StyleSheet.flatten(byId('connection-status').props.style),
    ).toMatchObject({
      fontSize: 15,
      lineHeight: 21,
      color: appearance.positive,
    });
    const action = summaryAction('connection-details');
    expect(StyleSheet.flatten(action.props.style)).toMatchObject({
      minHeight: 48,
      minWidth: 92,
    });
    expect(
      StyleSheet.flatten(action.props.children({pressed: false}).props.style),
    ).toMatchObject({
      backgroundColor: appearance.inset,
      minHeight: 40,
      minWidth: 92,
      borderRadius: 14,
    });
    expect(
      StyleSheet.flatten(action.props.children({pressed: true}).props.style),
    ).toMatchObject({
      backgroundColor: appearance.border,
      transform: [{scale: 0.97}],
    });
  },
);

it.each([
  [320, 1, false, 'row'],
  [320, 1.45, false, 'row'],
  [320, 1.8, false, 'column'],
  [390, 2.5, false, 'column'],
  [320, 1, true, 'row'],
  [320, 1.45, true, 'row'],
  [320, 1.8, true, 'column'],
  [390, 2.5, true, 'column'],
])(
  'reflows without capping text at width %s, scale %s, loading %s',
  (width, fontScale, loading, direction) => {
    require('react-native').useWindowDimensions.mockReturnValue({
      width,
      fontScale,
      height: 800,
      scale: 2,
    });
    connected = false;
    hooks.useSimulation.mockReturnValue([true]);
    state = {...state, loading, stage: loading ? 'provisioning' : 'idle'};
    act(() => {
      view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
    });
    const capsuleStyle = StyleSheet.flatten(
      byId('connection-status-capsule').props.style,
    );
    expect(capsuleStyle.flexDirection).toBe(direction);
    expect(capsuleStyle.height).toBeUndefined();
    expect(capsuleStyle.maxHeight).toBeUndefined();
    expect(byId('connection-status').props.children).toBe('Disconnected');
    for (const node of byId('connection-status-group').findAllByType('Text')) {
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.maxFontSizeMultiplier).toBeUndefined();
      expect(node.props.allowFontScaling).not.toBe(false);
      expect(node.props.adjustsFontSizeToFit).not.toBe(true);
    }
    const action = summaryAction(
      loading ? 'connection-cancel' : 'connection-details',
    );
    expect(
      StyleSheet.flatten(action.props.style).minHeight,
    ).toBeGreaterThanOrEqual(48);
    if (direction === 'column') {
      expect(StyleSheet.flatten(action.props.style).alignSelf).toBe('stretch');
      expect(
        StyleSheet.flatten(action.props.children({pressed: false}).props.style)
          .alignSelf,
      ).toBe('stretch');
    }
    if (!loading) {
      act(() => press('Details'));
      const controls = view.root.findAll(
        node =>
          typeof node.type === 'string' &&
          node.props.accessibilityRole === 'button',
      );
      for (const control of controls) {
        expect(
          StyleSheet.flatten(control.props.style).minHeight,
        ).toBeGreaterThanOrEqual(48);
        expect(
          StyleSheet.flatten(control.props.style).minWidth,
        ).toBeGreaterThanOrEqual(48);
      }
      expect(text()).not.toContain('Exact-Assigned-ID');
      expect(text()).not.toContain('assigned.azure-devices.net');
    }
  },
);

it('offers only the existing manual action when no identity or saved credentials exist', () => {
  connected = false;
  state = {...state, client: null, stage: 'idle'};
  hooks.useIoTCentralClient.mockReturnValue([null, null]);
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  act(() => press('Details'));
  expect(text()).not.toContain('Assigned device');
  expect(text()).not.toContain('Reconnect');
  expect(text()).not.toContain('"Disconnect"');
  act(() => press('Connect manually'));
  expect(manual).toHaveBeenCalledTimes(1);
  expect(connect).not.toHaveBeenCalled();
});

it('hides legacy actions during an active request even when details were already expanded', async () => {
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  act(() => press('Details'));
  state = {...state, loading: true, stage: 'validating'};
  act(() => {
    view.update(<ConnectionSummary onManualConnection={manual} />);
  });
  expect(text()).toContain(Strings.Connection.Stages.validating);
  expect(text()).not.toContain('Connect manually');
  expect(text()).not.toContain('"Disconnect"');
  expect(text()).not.toContain('Reconnect');
  await act(async () => press('Cancel'));
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(clear).not.toHaveBeenCalled();
  expect(connect).not.toHaveBeenCalled();
});

it.each([false, true])(
  'keeps a disconnected error and its recovery action outside collapsed details (dark: %s)',
  async dark => {
    hooks.useTheme.mockReturnValue({dark, colors: {card: '#fff'}});
    connected = false;
    state = {
      ...state,
      stage: 'error',
      error: new ConnectionError('CONNECTION_LOST', {status: 503}),
    };
    act(() => {
      view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
    });
    expect(
      summaryAction('connection-details').props.accessibilityState.expanded,
    ).toBe(false);
    expect(text()).toContain('Connection interrupted');
    expect(text()).toContain('Reconnect to resume sending data.');
    expect(text()).toContain('CONNECTION_LOST');
    expect(text()).toContain('HTTP 503');
    expect(byId('connection-status').props.children).toBe('Disconnected');
    expect(
      byId('connection-status-emblem').findByType('Icon').props,
    ).toMatchObject({
      name: 'cloud-outline',
      color: palette(dark).danger,
    });
    expect(
      StyleSheet.flatten(byId('connection-status').props.style).color,
    ).toBe(palette(dark).muted);
    await act(async () => press('Reconnect'));
    expect(connect).toHaveBeenCalledWith({deviceId: 'registration-id'});
    expect(
      summaryAction('connection-details').props.accessibilityState.expanded,
    ).toBe(false);
  },
);

it('opens existing details for error review rather than connecting during offline simulation', () => {
  connected = false;
  hooks.useSimulation.mockReturnValue([true]);
  state = {
    ...state,
    error: new ConnectionError('CONNECT_FAILED'),
    stage: 'error',
  };
  act(() => {
    view = renderer.create(<ConnectionSummary onManualConnection={manual} />);
  });
  expect(text()).toContain('Could not connect');
  expect(text()).toContain('Offline simulation');
  expect(byId('connection-status-emblem').findByType('Icon').props.color).toBe(
    palette(false).muted,
  );
  act(() => press('Review details'));
  expect(
    summaryAction('connection-details').props.accessibilityState.expanded,
  ).toBe(true);
  expect(text()).toContain('Connect manually');
  expect(text()).not.toContain('Exact-Assigned-ID');
  expect(connect).not.toHaveBeenCalled();
});
