import React from 'react';
import renderer, {act} from 'react-test-renderer';
import * as Native from 'react-native';
import SelectionControl from '../src/components/selectionControl';
import {useMotionAllowed} from '../src/hooks/motion';
import {useTheme} from '../src/hooks';
import {palette} from '../src/theme/palette';

jest.mock('../src/hooks', () => ({useTheme: jest.fn()}));
jest.mock('../src/hooks/motion', () => ({useMotionAllowed: jest.fn()}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));

const options = [
  {id: 'all', label: 'All'},
  {id: 'issues', label: 'Issues'},
];
let view;
let dimensions;
const originalRtl = Native.I18nManager.isRTL;
const props = {options, selected: 0, onSelect: jest.fn(), label: 'Choose view'};
const control = id => view.root.findAllByProps({testID: id})[0];
const root = () =>
  view.root.findAllByProps({accessibilityLabel: props.label})[0];
const style = node =>
  Native.StyleSheet.flatten(
    typeof node.props.style === 'function'
      ? node.props.style({pressed: false})
      : node.props.style,
  );
const render = extra =>
  act(() => {
    const element = <SelectionControl {...props} {...extra} />;
    if (view) view.update(element);
    else view = renderer.create(element);
  });

beforeEach(() => {
  dimensions = {width: 390, height: 844, fontScale: 1, scale: 1};
  jest
    .spyOn(Native, 'useWindowDimensions')
    .mockImplementation(() => dimensions);
  useTheme.mockReturnValue({dark: false});
  useMotionAllowed.mockReturnValue(false);
  props.onSelect.mockClear();
});
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
  Native.I18nManager.isRTL = originalRtl;
  jest.restoreAllMocks();
});

test.each(['segmented', 'filter'])(
  '%s visuals retain separate 48pt button frames and selected state',
  variant => {
    for (const dark of [false, true]) {
      useTheme.mockReturnValue({dark});
      render({variant});
      for (const id of ['all', 'issues']) {
        expect(style(control(id))).toMatchObject({minWidth: 48, minHeight: 48});
        expect(control(id).props.accessibilityRole).toBe('button');
        expect(control(id).props.hitSlop).toBeUndefined();
      }
      expect(control('all').props.accessibilityState.selected).toBe(true);
      expect(control('issues').props.accessibilityState.selected).toBe(false);
      const labels = view.root.findAllByType('Text');
      expect(
        labels.every(label => label.props.numberOfLines === undefined),
      ).toBe(true);
      expect(style(labels[0])).toMatchObject({
        fontSize: 13,
        lineHeight: 18,
        color:
          variant === 'filter' ? palette(dark).primary : palette(dark).text,
      });
      act(() => control('issues').props.onPress());
      expect(props.onSelect).toHaveBeenLastCalledWith(1);
      render({variant, selected: 1});
      expect(control('issues').props.accessibilityState.selected).toBe(true);
    }
  },
);

test.each([
  {width: 350, fontScale: 1},
  {width: 390, fontScale: 1.8},
])(
  'segments stack without truncation on narrow/large-text layouts (%j)',
  changed => {
    dimensions = {...dimensions, ...changed};
    render();
    expect(style(root()).flexDirection).toBe('column');
    expect(style(control('all')).flex).toBeUndefined();
    expect(style(control('all')).minHeight).toBe(48);
  },
);

test.each([false, true])(
  'selection thumb moves only on a real selection change (RTL %s)',
  rtl => {
    Native.I18nManager.isRTL = rtl;
    useMotionAllowed.mockReturnValue(true);
    const stop = jest.fn();
    const timing = jest
      .spyOn(Native.Animated, 'timing')
      .mockReturnValue({start: jest.fn(), stop});
    render();
    act(() => root().props.onLayout({nativeEvent: {layout: {width: 320}}}));
    expect(timing).not.toHaveBeenCalled();
    render({selected: 1});
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][1]).toMatchObject({
      toValue: rtl ? -156 : 156,
      duration: 220,
      useNativeDriver: true,
      isInteraction: false,
    });
    act(() => root().props.onLayout({nativeEvent: {layout: {width: 300}}}));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(timing).toHaveBeenCalledTimes(1);
    useMotionAllowed.mockReturnValue(false);
    render({selected: 0, focused: false});
    expect(timing).toHaveBeenCalledTimes(1);
    expect(useMotionAllowed).toHaveBeenLastCalledWith(false);
  },
);
