import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {LinearGradient, Rect} from 'react-native-svg';
import Surface, {
  SurfaceFill,
  surfaceElevation,
  surfaceStops,
} from '../src/components/surface';

let mockDark = false;
jest.mock('../src/hooks', () => ({useTheme: () => ({dark: mockDark})}));

test.each([false, true])(
  'paint is opaque, decorative and independent per surface (%s)',
  dark => {
    mockDark = dark;
    let tree;
    const layout = jest.fn();
    act(() => {
      tree = renderer.create(
        <>
          <Surface testID="first" radius={24} level="raised" onLayout={layout}>
            <Text>Real content</Text>
          </Surface>
          <Surface tone="primary">
            <Text>Connect</Text>
          </Surface>
        </>,
      );
    });
    const host = tree.root
      .findAllByProps({testID: 'first'})
      .find(node => typeof node.type === 'string');
    expect(StyleSheet.flatten(host.props.style)).toMatchObject({
      borderRadius: 24,
      elevation: 2,
      shadowOffset: {width: 0, height: 3},
    });
    expect(host.props.onLayout).toBe(layout);
    const ids = tree.root
      .findAllByType(LinearGradient)
      .map(node => node.props.id);
    expect(new Set(ids).size).toBe(2);
    for (const drawing of tree.root.findAllByType(Svg)) {
      expect(drawing.props).toMatchObject({
        pointerEvents: 'none',
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants',
      });
    }
    expect(tree.root.findAllByType(Rect)[0].props.rx).toBe(24);
    expect(JSON.stringify(tree.toJSON())).toContain('Real content');
    act(() => tree.unmount());
  },
);

test('ground controls never acquire a raised shadow', () => {
  expect(surfaceElevation(false, 'ground')).toEqual({});
  expect(surfaceElevation(true, 'ground')).toEqual({});
});

test('padded controls give percentage paint a separate full-size native viewport', () => {
  let tree;
  act(() => {
    tree = renderer.create(
      <View
        style={{
          width: 320,
          minHeight: 52,
          paddingHorizontal: 16,
          paddingVertical: 11,
        }}>
        <SurfaceFill tone="primary" />
        <Text>Scan QR code</Text>
      </View>,
    );
  });
  const viewport = tree.root.findAll(
    node => typeof node.type === 'string' && node.props.collapsable === false,
  );
  expect(viewport).toHaveLength(1);
  expect(StyleSheet.flatten(viewport[0].props.style)).toEqual({
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  });
  expect(viewport[0].props).toMatchObject({
    pointerEvents: 'none',
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  });
  expect(viewport[0].findAllByType(Svg)).toHaveLength(1);
  expect(viewport[0].findAllByType(Text)).toHaveLength(0);
  act(() => tree.unmount());
});

test.each([{from: '#fff'}, {to: 'red'}, {accent: ''}])(
  'invalid paint fails explicitly (%j)',
  paint => {
    expect(() => surfaceStops(false, paint)).toThrow('six-digit hex');
  },
);
