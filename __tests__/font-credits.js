import React from 'react';
import renderer, {act} from 'react-test-renderer';
import Constants from 'expo-constants';
import FontCredits from '../src/components/fontCredits';
import Strings from '../src/strings';
import {StyleSheet} from 'react-native';

jest.mock('../src/hooks', () => ({useTheme: () => ({dark: false})}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {expoConfig: {extra: {}}},
}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));

let tree;
afterEach(() => act(() => tree?.unmount()));

it('exposes the complete distributed license in an optional selectable disclosure', () => {
  const license = require('fs').readFileSync(
    require.resolve('@expo-google-fonts/quicksand/LICENSE_FONT'),
    'utf8',
  );
  Constants.expoConfig.extra.headerFontLicense = license;
  act(() => {
    tree = renderer.create(<FontCredits />);
  });
  expect(tree.root.findAllByProps({testID: 'font-license'})).toHaveLength(0);
  const toggle = tree.root.findByProps({testID: 'font-credits-toggle'});
  expect(
    StyleSheet.flatten(toggle.props.style).minHeight,
  ).toBeGreaterThanOrEqual(48);
  act(() => toggle.props.onPress());
  const text = tree.root.findByProps({testID: 'font-license'});
  expect(text.props.children).toBe(license);
  expect(text.props.selectable).toBe(true);
  expect(toggle.props.accessibilityState.expanded).toBe(true);
  act(() => toggle.props.onPress());
  expect(tree.root.findAllByProps({testID: 'font-license'})).toHaveLength(0);
});

it.each([undefined, '', 42])(
  'reports unavailable bundled metadata explicitly (%s)',
  license => {
    Constants.expoConfig.extra.headerFontLicense = license;
    act(() => {
      tree = renderer.create(<FontCredits />);
    });
    act(() =>
      tree.root.findByProps({testID: 'font-credits-toggle'}).props.onPress(),
    );
    expect(tree.root.findByProps({testID: 'font-license'}).props.children).toBe(
      Strings.Settings.Font.Unavailable,
    );
  },
);
