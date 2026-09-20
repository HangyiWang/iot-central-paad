import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {AccessibilityInfo, Animated, AppState, View} from 'react-native';
import {useGentleTransition, useMotionAllowed} from '../src/hooks/motion';

let view;
let resolvePreference;
let rejectPreference;
let preferenceChanged;
let applicationChanged;
let removePreference;
let removeApplication;
const originalState = AppState.currentState;

function Probe({visible = true}) {
  const allowed = useMotionAllowed(visible);
  return <View testID="motion" accessibilityState={{busy: allowed}} />;
}

function Transition({visible = true, revision = 0}) {
  useGentleTransition(revision, visible);
  return null;
}

beforeEach(() => {
  AppState.currentState = 'active';
  removePreference = jest.fn();
  removeApplication = jest.fn();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(
    () =>
      new Promise((resolve, reject) => {
        resolvePreference = resolve;
        rejectPreference = reject;
      }),
  );
  jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockImplementation((name, callback) => {
      expect(name).toBe('reduceMotionChanged');
      preferenceChanged = callback;
      return {remove: removePreference};
    });
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((name, callback) => {
      expect(name).toBe('change');
      applicationChanged = callback;
      return {remove: removeApplication};
    });
});

afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
  AppState.currentState = originalState;
  jest.restoreAllMocks();
});

const allowed = () =>
  view.root.findByProps({testID: 'motion'}).props.accessibilityState.busy;

test('motion defaults to still and shares one native preference/background subscription', async () => {
  act(() => {
    view = renderer.create(
      <>
        <Probe />
        <Probe />
      </>,
    );
  });
  expect(
    view.root
      .findAllByType(View)
      .map(node => node.props.accessibilityState.busy),
  ).toEqual([false, false]);
  expect(AccessibilityInfo.addEventListener).toHaveBeenCalledTimes(1);
  expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
  await act(async () => resolvePreference(false));
  expect(
    view.root
      .findAllByProps({testID: 'motion'})
      .every(node => node.props.accessibilityState.busy),
  ).toBe(true);
  act(() => view.unmount());
  view = undefined;
  expect(removePreference).toHaveBeenCalledTimes(1);
  expect(removeApplication).toHaveBeenCalledTimes(1);
});

test('Reduce Motion, backgrounding and hidden screens suppress decoration immediately', async () => {
  act(() => {
    view = renderer.create(<Probe />);
  });
  await act(async () => resolvePreference(false));
  expect(allowed()).toBe(true);
  act(() => applicationChanged('background'));
  expect(allowed()).toBe(false);
  act(() => applicationChanged('active'));
  expect(allowed()).toBe(true);
  act(() => preferenceChanged(true));
  expect(allowed()).toBe(false);
  act(() => preferenceChanged(false));
  expect(allowed()).toBe(true);
  act(() => view.update(<Probe visible={false} />));
  expect(allowed()).toBe(false);
});

test('a late preference read cannot override a newer native preference event', async () => {
  act(() => {
    view = renderer.create(<Probe />);
  });
  act(() => preferenceChanged(true));
  await act(async () => resolvePreference(false));
  expect(allowed()).toBe(false);
});

test('late callbacks from an unmounted subscription cannot enable a new subscriber', async () => {
  act(() => {
    view = renderer.create(<Probe />);
  });
  const oldResolve = resolvePreference;
  const oldEvent = preferenceChanged;
  act(() => view.unmount());
  act(() => {
    view = renderer.create(<Probe />);
  });
  await act(async () => {
    oldResolve(false);
    oldEvent(false);
  });
  expect(allowed()).toBe(false);
  await act(async () => resolvePreference(false));
  expect(allowed()).toBe(true);
});

test('an unavailable preference is explicit and leaves content static', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  act(() => {
    view = renderer.create(<Probe />);
  });
  await act(async () => rejectPreference(new Error('not available')));
  expect(allowed()).toBe(false);
  expect(warn).toHaveBeenCalledWith(
    'Motion preference unavailable; decorative motion disabled.',
  );
});

test('transitions are finite, non-interaction animations and stop on blur or reduced motion', async () => {
  const stop = jest.fn();
  const start = jest.fn();
  const timing = jest
    .spyOn(Animated, 'timing')
    .mockReturnValue({start, stop, reset: jest.fn()});
  act(() => {
    view = renderer.create(<Transition />);
  });
  expect(timing).not.toHaveBeenCalled();
  await act(async () => resolvePreference(false));
  expect(timing).toHaveBeenCalledTimes(1);
  expect(timing.mock.calls[0][1]).toMatchObject({
    toValue: 1,
    duration: 360,
    useNativeDriver: true,
    isInteraction: false,
  });
  act(() => view.update(<Transition />));
  expect(timing).toHaveBeenCalledTimes(1);
  act(() => view.update(<Transition revision={1} />));
  expect(stop).toHaveBeenCalledTimes(1);
  expect(timing).toHaveBeenCalledTimes(2);
  act(() => view.update(<Transition revision={1} visible={false} />));
  expect(stop).toHaveBeenCalledTimes(2);
  act(() => view.update(<Transition revision={1} />));
  expect(timing).toHaveBeenCalledTimes(3);
  act(() => preferenceChanged(true));
  expect(stop).toHaveBeenCalledTimes(3);
});
