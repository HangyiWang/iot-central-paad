import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import {Registration} from '../src/Registration';
import {RegistrationScreens} from '../src/types';
import {palette} from '../src/theme/palette';
import Strings from '../src/strings';

jest.mock('@react-navigation/stack', () => {
  // Screens render nothing here; the test drives each screen component directly.
  const Screen = () => null;
  const Navigator = ({children}) => children;
  return {createStackNavigator: () => ({Navigator, Screen}), Screen};
});
const {Screen: StackScreen} = require('@react-navigation/stack');
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => ({
  CommonActions: {reset: jest.fn(config => config)},
  useIsFocused: () => true,
  useNavigation: () => ({navigate: mockNavigate, replace: mockReplace}),
}));
jest.mock('../src/components', () => {
  const typography = require('../src/components/typography');
  return {
    ...typography,
    Button: 'Button',
    Link: 'Link',
    Name: 'Name',
    ConnectionNotice: 'ConnectionNotice',
    QRCodeScanner: 'QRCodeScanner',
  };
});
jest.mock('../src/onboarding/manual', () => ({
  CredentialForm: 'CredentialForm',
}));
jest.mock('../src/components/registrationActions', () => 'RegistrationActions');
jest.mock('@rneui/themed', () => ({Icon: 'Icon', Text: 'Text'}));
const cancel = jest.fn(async () => {});
const connect = jest.fn(async () => ({ok: true}));
jest.mock('../src/hooks', () => ({
  useConnectIoTCentralClient: jest.fn(),
  useScreenDimensions: () => ({
    screen: {width: 393, height: 852},
    orientation: 'portrait',
  }),
  useTheme: () => ({dark: false, colors: {text: '#17252A'}}),
}));
const hooks = require('../src/hooks');

const colors = palette(false);
let view;
const screen = name =>
  view.root.findAllByType(StackScreen).find(node => node.props.name === name);
const control = id =>
  view.root.findAllByProps({testID: id}).find(node => node.props.onPress);
const flatten = node =>
  StyleSheet.flatten(
    typeof node.props.style === 'function'
      ? node.props.style({pressed: false})
      : node.props.style,
  );

beforeEach(() => {
  jest.clearAllMocks();
  hooks.useConnectIoTCentralClient.mockReturnValue([
    connect,
    cancel,
    jest.fn(),
    {client: null, loading: false, error: null, stage: 'idle'},
  ]);
});
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
});

const renderEmptyScreen = () => {
  act(() => {
    view = renderer.create(<Registration />);
  });
  const Empty = screen(RegistrationScreens.EMPTY).props.component;
  act(() => {
    view.update(<Empty />);
  });
};

test('the welcome screen groups one restrained scan action with a quiet manual entry', () => {
  renderEmptyScreen();
  const group = view.root.findAllByProps({testID: 'registration-choices'})[0];
  expect(flatten(group)).toMatchObject({
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface,
  });

  const scan = control('registration-scan');
  const scanStyle = flatten(scan);
  expect(scan.props.accessibilityRole).toBe('button');
  expect(scan.props.accessibilityLabel).toBe(Strings.Registration.QRCode.Scan);
  expect(scanStyle.backgroundColor).toBe(colors.primary);
  // Restrained: the standard action height, not an oversized hero button.
  expect(scanStyle.minHeight).toBe(48);
  expect(scanStyle.alignSelf).toBe('stretch');

  const manual = control('registration-manual');
  const manualStyle = flatten(manual);
  expect(manual.props.accessibilityRole).toBe('button');
  expect(manual.props.accessibilityLabel).toBe(
    Strings.Registration.QRCode.Manually,
  );
  // Quiet: unpainted and borderless, but still a full 48pt target.
  expect(manualStyle.backgroundColor).toBe('transparent');
  expect(manualStyle.borderWidth).toBe(0);
  expect(manualStyle.minHeight).toBeGreaterThanOrEqual(48);
  expect(manualStyle.minWidth).toBeGreaterThanOrEqual(48);
});

test('both welcome choices keep their real navigation behavior', () => {
  renderEmptyScreen();
  act(() => control('registration-scan').props.onPress());
  expect(mockNavigate).toHaveBeenLastCalledWith(RegistrationScreens.QR);
  act(() => control('registration-manual').props.onPress());
  expect(mockNavigate).toHaveBeenLastCalledWith(RegistrationScreens.MANUAL);
  expect(mockReplace).not.toHaveBeenCalled();
});

test('the scanner footer keeps a legible manual action that cancels before replacing', async () => {
  act(() => {
    view = renderer.create(<Registration />);
  });
  const QR = screen(RegistrationScreens.QR).props.children;
  act(() => {
    view.update(<>{QR({})}</>);
  });
  const footer = view.root.findByType('QRCodeScanner').props.bottomContent;
  let scanner;
  act(() => {
    scanner = renderer.create(footer);
  });
  const manual = scanner.root
    .findAllByProps({testID: 'registration-manual'})
    .find(node => node.props.onPress);
  // Over the camera the manual action stays painted so it remains readable.
  const style = StyleSheet.flatten(
    typeof manual.props.style === 'function'
      ? manual.props.style({pressed: false})
      : manual.props.style,
  );
  expect(style.backgroundColor).toBe(colors.inset);
  expect(style.minHeight).toBe(48);
  expect(manual.props.accessibilityLabel).toBe(
    Strings.Registration.QRCode.Manually,
  );
  await act(async () => {
    await manual.props.onPress();
  });
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith(RegistrationScreens.MANUAL);
  act(() => scanner.unmount());
});
