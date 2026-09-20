import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Text} from 'react-native';
import Svg, {LinearGradient} from 'react-native-svg';
import AppBackground from '../src/components/appBackground';
import {palette} from '../src/theme/palette';

let mockDark = false;
jest.mock('../src/hooks', () => ({useTheme: () => ({dark: mockDark})}));

it.each([false, true])(
  'uses a decorative, non-interactive ground gradient (%s)',
  dark => {
    mockDark = dark;
    let tree;
    act(() => {
      tree = renderer.create(
        <>
          <AppBackground>
            <Text>Real content</Text>
          </AppBackground>
          <AppBackground>
            <Text>Another screen</Text>
          </AppBackground>
        </>,
      );
    });
    const gradients = tree.root.findAllByType(LinearGradient);
    const ids = [...new Set(gradients.map(node => node.props.id))];
    expect(ids).toHaveLength(2);
    const drawings = tree.root.findAllByType(Svg);
    expect(drawings).toHaveLength(2);
    drawings.forEach(drawing => {
      expect(drawing.props).toMatchObject({
        pointerEvents: 'none',
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      });
    });
    expect(
      tree.root.findAllByProps({stopColor: palette(dark).gradientStart}).length,
    ).toBeGreaterThan(0);
    expect(
      tree.root.findAllByProps({stopColor: palette(dark).gradientEnd}).length,
    ).toBeGreaterThan(0);
    expect(JSON.stringify(tree.toJSON())).toContain('Real content');
    act(() => tree.unmount());
  },
);
