import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Platform, StyleSheet} from 'react-native';
import RegistrationActions from '../src/components/registrationActions';
import {useTheme} from '../src/hooks';
import {palette} from '../src/theme/palette';
import Strings from '../src/strings';

jest.mock('../src/components/button', () => 'Button');
jest.mock('../src/hooks', () => ({useTheme: jest.fn()}));

const originalOS = Platform.OS;
let view;
afterEach(() => {
  act(() => view?.unmount());
  Platform.OS = originalOS;
});

test.each([
  ['ios', false],
  ['ios', true],
  ['android', false],
  ['android', true],
])(
  'separates safe primary and new-device actions on %s (dark=%s)',
  (os, dark) => {
    Platform.OS = os;
    useTheme.mockReturnValue({dark});
    const onClose = jest.fn();
    const onRegisterNew = jest.fn();
    act(() => {
      view = renderer.create(
        <RegistrationActions onClose={onClose} onRegisterNew={onRegisterNew} />,
      );
    });
    const footer = view.root.findAllByProps({
      testID: 'registration-actions',
    })[0];
    const buttons = view.root.findAllByType('Button');
    const colors = palette(dark);
    expect(StyleSheet.flatten(footer.props.style)).toMatchObject({
      gap: 12,
      marginTop: 28,
      paddingTop: 20,
      borderTopColor: colors.border,
    });
    expect(buttons.map(button => button.props.title)).toEqual([
      Strings.Core.Close,
      Strings.Registration.Manual.RegisterNew.Title,
    ]);
    expect(buttons.map(button => button.props.type)).toEqual([
      'solid',
      'outline',
    ]);
    expect(StyleSheet.flatten(buttons[0].props.buttonStyle)).toMatchObject({
      backgroundColor: colors.primary,
      minHeight: 52,
    });
    expect(StyleSheet.flatten(buttons[1].props.buttonStyle)).toMatchObject({
      backgroundColor: colors.tints[2],
      borderColor: colors.controlBorder,
      minHeight: 52,
    });
    for (const button of buttons) {
      expect(StyleSheet.flatten(button.props.titleStyle)).toMatchObject({
        fontSize: 15,
        lineHeight: 20,
        fontWeight: '600',
      });
      expect(button.props.numberOfLines).toBeUndefined();
    }
    expect(onClose).not.toHaveBeenCalled();
    expect(onRegisterNew).not.toHaveBeenCalled();
    act(() => buttons[0].props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRegisterNew).not.toHaveBeenCalled();
    act(() => buttons[1].props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onRegisterNew).toHaveBeenCalledTimes(1);
  },
);
