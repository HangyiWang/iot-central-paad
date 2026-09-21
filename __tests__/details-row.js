import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Dimensions, StyleSheet} from 'react-native';
import DetailsRow from '../src/components/detailsRow';
import {surfaceStops} from '../src/components/surface';
import {useTheme} from '../src/hooks';
import {palette} from '../src/theme/palette';

jest.mock('../src/hooks', () => ({useTheme: jest.fn()}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));
jest.mock('@rneui/themed', () => ({Icon: 'Icon'}));

let view;
let window;
const row = () => view.root.findAllByProps({testID: 'row'})[0];
const style = () => StyleSheet.flatten(row().props.style);
const fills = () =>
  view.root
    .findAllByProps({radius: 14})
    .filter(node => typeof node.type !== 'string' && node.props.tone);
const render = props =>
  act(() => {
    const element = (
      <DetailsRow
        id="row"
        label="Reconnect"
        supporting="Uses the saved registration"
        icon="refresh"
        onPress={() => {}}
        {...props}
      />
    );
    if (view) view.update(element);
    else view = renderer.create(element);
  });

beforeEach(() => {
  // The shipped device metrics; useWindowDimensions reads through Dimensions.
  window = {width: 411.43, height: 914.29, scale: 2.625, fontScale: 1};
  jest.spyOn(Dimensions, 'get').mockImplementation(() => window);
});
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
  jest.restoreAllMocks();
});

test.each([false, true])(
  'paints rows with the shared lifted gradient and a hairline edge (dark %s)',
  dark => {
    useTheme.mockReturnValue({dark});
    const colors = palette(dark);
    render();
    expect(style()).toMatchObject({
      minHeight: 48,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.tints[0],
    });
    expect(style().height).toBeUndefined();
    expect(row().props.hitSlop).toBe(2);
    expect(fills()[0].props.from).toBe(colors.tints[0]);
    // On a recessed panel the row lifts instead of borrowing the tint.
    render({onInset: true});
    expect(style().backgroundColor).toBe(
      surfaceStops(dark, {tone: 'raised'})[0],
    );
    expect(fills()[0].props.tone).toBe('raised');
    render({onInset: true, expanded: true});
    expect(style().backgroundColor).toBe(colors.tints[0]);
    expect(row().props.accessibilityState.expanded).toBe(true);
  },
);

test('destructive rows stay flat and honest while a press seats them deeper', () => {
  useTheme.mockReturnValue({dark: false});
  const colors = palette(false);
  render({destructive: true});
  expect(style()).toMatchObject({
    backgroundColor: colors.dangerSurface,
    borderColor: colors.danger,
  });
  expect(fills()).toEqual([]);
  render();
  const resting = style().backgroundColor;
  act(() => row().props.onPressIn());
  expect(style().backgroundColor).not.toBe(resting);
  expect(style().opacity).toBeUndefined();
  expect(fills()[0].props.pressed).toBe(true);
  act(() => row().props.onPressOut());
  expect(style().backgroundColor).toBe(resting);
});

test('a busy row stops being painted, keeps its label and refuses presses', () => {
  useTheme.mockReturnValue({dark: false});
  const onPress = jest.fn();
  render({busy: true, onPress});
  expect(fills()).toEqual([]);
  expect(style()).toMatchObject({
    backgroundColor: palette(false).inset,
    opacity: 0.5,
  });
  expect(row().props.disabled).toBe(true);
  expect(row().props.accessibilityState).toMatchObject({
    disabled: true,
    busy: true,
  });
  expect(row().props.accessibilityHint).toBe('Uses the saved registration');
  act(() => row().props.onPressIn());
  expect(style().backgroundColor).toBe(palette(false).inset);
  expect(onPress).not.toHaveBeenCalled();
});

test('large text lets the row grow from the top instead of squeezing the label', () => {
  useTheme.mockReturnValue({dark: false});
  render();
  expect(style().alignItems).toBe('center');
  act(() => view.unmount());
  view = undefined;
  window = {...window, fontScale: 1.8};
  render();
  expect(style().alignItems).toBe('flex-start');
  expect(style().minHeight).toBe(48);
  expect(style().height).toBeUndefined();
  expect(row().props.hitSlop).toBe(2);
  const labels = view.root.findAllByType('Text');
  expect(labels.every(label => label.props.numberOfLines === undefined)).toBe(
    true,
  );
});
