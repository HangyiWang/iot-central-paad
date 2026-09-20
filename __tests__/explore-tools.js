import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {ScrollView, StyleSheet} from 'react-native';
import Explore from '../src/experience/Explore';
import {palette} from '../src/theme/palette';

let mockDark = false;
jest.mock('../src/hooks', () => ({useTheme: () => ({dark: mockDark})}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));
jest.mock('@rneui/themed', () => ({Icon: 'Icon'}));

let view;
afterEach(() => {
  act(() => view?.unmount());
  jest.restoreAllMocks();
});

test.each([false, true])(
  'directory immediately exposes all real tools in dark=%s',
  dark => {
    mockDark = dark;
    const onOpen = jest.fn();
    act(() => {
      view = renderer.create(<Explore onOpen={onOpen} />);
    });
    expect(view.root.findByType(ScrollView).props.testID).toBe(
      'explore-directory',
    );
    expect(
      view.root.findAll(
        node =>
          typeof node.type === 'string' &&
          node.props.testID?.startsWith('explore-tool-'),
      ),
    ).toHaveLength(4);
    for (const [id, route, index] of [
      ['telemetry', 'Telemetry', 0],
      ['properties', 'Properties', 1],
      ['image', 'Image Upload', 2],
      ['bluetooth', 'Bluetooth', 3],
    ]) {
      const tool = view.root.findByProps({testID: `explore-tool-${id}`});
      expect(tool.props.accessibilityRole).toBe('button');
      expect(tool.props.disabled).not.toBe(true);
      const style = StyleSheet.flatten(
        typeof tool.props.style === 'function'
          ? tool.props.style({pressed: false})
          : tool.props.style,
      );
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(style.height).toBeUndefined();
      expect(style.backgroundColor).toBe(palette(dark).toolSurfaces[index]);
      const badge = tool.findAllByProps({
        importantForAccessibility: 'no-hide-descendants',
      })[0];
      expect(StyleSheet.flatten(badge.props.style)).toMatchObject({
        backgroundColor: palette(dark).toolAccents[index],
        width: 44,
        height: 44,
      });
      act(() => tool.props.onPress());
      expect(onOpen).toHaveBeenLastCalledWith(route);
    }
    expect(onOpen).toHaveBeenCalledTimes(4);
    const text = JSON.stringify(view.toJSON());
    expect(text).toContain('Select an image to start uploading it to storage');
    expect(text).toContain('Bluetooth advertisements with supported decoders');
    expect(text).toContain('Open any tool to inspect its state');
    expect(text).not.toContain('Commands');
  },
);

test.each([
  [390, 1, 'row'],
  [320, 1, 'column'],
  [390, 1.5, 'column'],
])(
  'tools keep a readable grid/fallback at %s / %s',
  (width, fontScale, direction) => {
    const dimensions = jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({
        width,
        fontScale,
        height: 844,
        scale: 2,
      });
    act(() => {
      view = renderer.create(<Explore onOpen={jest.fn()} />);
    });
    const grid = view.root.findByProps({testID: 'explore-tools-grid'});
    expect(dimensions).toHaveBeenCalled();
    expect(StyleSheet.flatten(grid.props.style).flexDirection).toBe(direction);
  },
);
