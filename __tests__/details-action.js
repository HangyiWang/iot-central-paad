import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import DetailsAction from '../src/components/detailsAction';
import {useTheme} from '../src/hooks';
import {palette} from '../src/theme/palette';

jest.mock('../src/hooks', () => ({useTheme: jest.fn()}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));
jest.mock('@rneui/themed', () => ({Icon: 'Icon'}));

let tree;
const control = () => tree.root.findAllByProps({testID: 'action'})[0];
const style = (pressed = false) =>
  StyleSheet.flatten(control().props.style({pressed}));
afterEach(() => act(() => tree?.unmount()));

test.each([false, true])(
  'gives every action an edge, label and scalable touch region (dark %s)',
  dark => {
    useTheme.mockReturnValue({dark});
    const colors = palette(dark);
    const onPress = jest.fn();
    for (const variant of ['primary', 'secondary', 'danger']) {
      act(() => {
        tree?.unmount();
        tree = renderer.create(
          <DetailsAction
            id="action"
            label="A long action label that may wrap"
            icon="send"
            variant={variant}
            onPress={onPress}
          />,
        );
      });
      expect(style()).toMatchObject({
        minHeight: 48,
        borderWidth: 1,
        borderRadius: 14,
        maxWidth: '100%',
        alignSelf: 'flex-start',
        flexDirection: 'row',
        gap: 8,
        backgroundColor:
          variant === 'primary'
            ? colors.primary
            : variant === 'danger'
            ? colors.dangerSurface
            : colors.inset,
        borderColor:
          variant === 'primary'
            ? colors.primary
            : variant === 'danger'
            ? colors.danger
            : colors.controlBorder,
      });
      expect(style().height).toBeUndefined();
      expect(style(true)).not.toEqual(style());
      const label = tree.root.findByType('Text');
      expect(label.props.numberOfLines).toBeUndefined();
      expect(label.props.allowFontScaling).not.toBe(false);
      expect(StyleSheet.flatten(label.props.style)).toMatchObject({
        fontSize: 15,
        lineHeight: 20,
        fontWeight: '600',
        flexShrink: 1,
      });
      expect(
        tree.root.findByType('Icon').parent.props.accessibilityElementsHidden,
      ).toBe(true);
      act(() => control().props.onPress());
    }
    expect(onPress).toHaveBeenCalledTimes(3);
  },
);

test('distinguishes external links, expanded toggles and disabled busy actions', () => {
  useTheme.mockReturnValue({dark: false});
  const onPress = jest.fn();
  act(() => {
    tree = renderer.create(
      <DetailsAction
        id="action"
        label="Azure portal"
        external
        onInset
        onPress={onPress}
      />,
    );
  });
  expect(control().props.accessibilityRole).toBe('link');
  expect(style().backgroundColor).toBe(palette(false).surface);
  expect(tree.root.findByType('Icon').props.name).toBe('open-in-new');
  act(() => {
    tree.update(
      <DetailsAction
        id="action"
        label="Hide details"
        expanded
        block
        onPress={onPress}
      />,
    );
  });
  expect(control().props.accessibilityState.expanded).toBe(true);
  expect(style()).toMatchObject({
    backgroundColor: palette(false).tints[0],
    alignSelf: 'stretch',
  });
  expect(tree.root.findByType('Icon').props.name).toBe('chevron-up');
  act(() => {
    tree.update(
      <DetailsAction
        id="action"
        label="Send"
        variant="primary"
        busy
        onPress={onPress}
      />,
    );
  });
  expect(control().props.disabled).toBe(true);
  expect(control().props.accessibilityState).toMatchObject({
    disabled: true,
    busy: true,
  });
  expect(style()).toMatchObject({
    borderWidth: 1,
    borderColor: palette(false).controlBorder,
    opacity: 0.5,
  });
  expect(style(true)).toEqual(style());
  expect(onPress).not.toHaveBeenCalled();
});
