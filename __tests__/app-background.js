import fs from 'fs';
import path from 'path';
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

it('keeps the gradient on the page and leaves every face a solid colour', () => {
  const root = path.join(__dirname, '..', 'src');
  const sources = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) sources.push(full);
    }
  };
  walk(root);
  const painted = sources.filter(file =>
    /\bLinearGradient\b/.test(fs.readFileSync(file, 'utf8')),
  );
  // Only the page ground and the map's travelling light are gradients;
  // controls, cards, panels and messages are one flat colour apiece, so their
  // outlines and edges stay readable.
  expect(painted.map(file => path.relative(root, file)).sort()).toEqual(
    [
      path.join('components', 'appBackground.tsx'),
      path.join('experience', 'ChannelFlow.tsx'),
    ].sort(),
  );
});

it('keeps the page a clear step away from the faces that sit on it', () => {
  for (const dark of [false, true]) {
    const colors = palette(dark);
    const step = (first, second) =>
      [1, 3, 5].reduce(
        (total, offset) =>
          total +
          Math.abs(
            parseInt(first.slice(offset, offset + 2), 16) -
              parseInt(second.slice(offset, offset + 2), 16),
          ),
        0,
      );
    for (const page of [colors.gradientStart, colors.gradientEnd])
      for (const face of [colors.surface, colors.surfaceRaised])
        expect(step(page, face)).toBeGreaterThanOrEqual(24);
    // The ground is a soft fall, not a second material.
    expect(step(colors.gradientStart, colors.gradientEnd)).toBeLessThan(60);
  }
});
