import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import BrandTitle from '../src/components/brandTitle';
import {palette} from '../src/theme/palette';
import Strings from '../src/strings';
import {useTheme} from '../src/hooks';

jest.mock('../src/hooks', () => ({useTheme: jest.fn()}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));

it.each([false, true])(
  'uses a theme-aware wordmark without losing its accessible title (%s)',
  dark => {
    useTheme.mockReturnValue({dark});
    let tree;
    act(() => {
      tree = renderer.create(<BrandTitle />);
    });
    const title = tree.root.findByProps({testID: 'app-header-title'});
    expect(title.props.accessibilityLabel).toBe('Phone as a device');
    expect(title.props.accessibilityRole).toBe('header');
    expect(`${Strings.Header.Brand} ${Strings.Header.Descriptor}`).toBe(
      Strings.Header.Title,
    );
    const brand = title
      .findAllByType('Text')
      .find(node => node.props.children === Strings.Header.Brand);
    expect(StyleSheet.flatten(brand.props.style)).toMatchObject({
      color: palette(dark).primary,
      fontWeight: '700',
      fontSize: 22,
    });
    expect(StyleSheet.flatten(title.props.style).color).toBe(
      palette(dark).text,
    );
    expect(JSON.stringify(tree.toJSON())).not.toContain('Cloud connection');
    act(() => tree.unmount());
  },
);
