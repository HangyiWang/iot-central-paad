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
afterEach(() => act(() => view?.unmount()));

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
    for (const [id, route] of [
      ['telemetry', 'Telemetry'],
      ['properties', 'Properties'],
      ['image', 'Image Upload'],
      ['bluetooth', 'Bluetooth'],
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
      expect(style.backgroundColor).toBe(palette(dark).surface);
      const badge = tool.findAllByProps({
        importantForAccessibility: 'no-hide-descendants',
      })[0];
      expect(StyleSheet.flatten(badge.props.style)).toMatchObject({
        borderWidth: 1,
        borderColor: palette(dark).controlBorder,
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
