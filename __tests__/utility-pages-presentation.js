import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {FlatList, ScrollView, StyleSheet} from 'react-native';
import FileUpload from '../src/FileUpload';
import {BluetoothPage} from '../src/bluetooth/Bluetooth';
import {LogsContext} from '../src/contexts/logs';
import {Pages} from '../src/types';
import * as picker from 'expo-image-picker';
import {IotcBleManager} from '../src/bluetooth/BleManager';
import * as hooks from '../src/hooks';

jest.mock('react-native-animatable', () => ({
  View: require('react-native').View,
}));
jest.mock('expo-image-picker', () => ({launchImageLibraryAsync: jest.fn()}));
jest.mock('../src/tools/Torch', () => ({acquireCamera: jest.fn()}));
jest.mock('../src/components/bottomPopup', () => 'BottomPopup');
jest.mock('../src/CardView', () => 'CardView');
jest.mock('../src/components', () => ({
  ...require('../src/components/typography'),
  Loader: 'Loader',
}));
jest.mock('react-native-progress', () => ({CircleSnail: 'CircleSnail'}));
jest.mock('../src/bluetooth/BleManager', () => ({
  IotcBleManager: {getInstance: jest.fn()},
}));
jest.mock('@react-navigation/native', () => ({useIsFocused: () => true}));
jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({
    Navigator: 'BluetoothNavigator',
    Screen: 'BluetoothScreen',
  }),
}));
jest.mock('../src/hooks', () => {
  const React = require('react');
  return {
    useIoTCentralClient: jest.fn(),
    useSimulation: () => [false],
    useTheme: () => ({
      dark: false,
      colors: {
        text: '#17252A',
        card: '#fff',
        background: '#F5F4F0',
        primary: '#166B72',
      },
    }),
    useBoolean: initial => {
      const [value, setValue] = React.useState(initial);
      const controls = React.useMemo(
        () => ({
          True: () => setValue(true),
          False: () => setValue(false),
          Toggle: () => setValue(current => !current),
        }),
        [],
      );
      return [value, controls];
    },
  };
});
jest.mock('@rneui/themed', () => {
  const React = require('react');
  const ListItem = props =>
    React.createElement('ListItem', props, props.children);
  ListItem.Content = 'ListItemContent';
  ListItem.Title = 'ListItemTitle';
  ListItem.Subtitle = 'ListItemSubtitle';
  return {Icon: 'Icon', Text: 'Text', ListItem};
});

let view;
const visibleText = () =>
  view.root
    .findAllByType('Text')
    .flatMap(node =>
      React.Children.toArray(node.props.children).filter(
        child => typeof child === 'string',
      ),
    )
    .join('\n');
const append = jest.fn();
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => {
  act(() => view?.unmount());
  view = undefined;
  jest.runAllTicks();
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});

test('upload content scrolls instead of sizing against the entire screen and preserves submission behavior', async () => {
  let finish;
  const uploadFile = jest.fn(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  hooks.useIoTCentralClient.mockReturnValue([
    {isConnected: () => true, uploadFile},
  ]);
  picker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{base64: 'AQID', fileName: 'photo.png'}],
  });
  act(() => {
    view = renderer.create(
      <LogsContext.Provider value={{append}}>
        <FileUpload />
      </LogsContext.Provider>,
    );
  });
  const card = () =>
    view.root
      .findAllByProps({testID: 'image-upload-card'})
      .find(node => node.props.onPress);
  expect(StyleSheet.flatten(card().props.style)).toMatchObject({
    width: '100%',
    minHeight: 260,
  });
  expect(StyleSheet.flatten(card().props.style).height).toBeUndefined();
  expect(view.root.findAllByType(ScrollView).length).toBeGreaterThan(0);
  act(() => card().props.onPress());
  await act(async () => {
    view.root.findAllByType('ListItem')[0].props.onPress();
  });
  expect(uploadFile).toHaveBeenCalledWith(
    'photo.jpg',
    'image/jpeg',
    'AQID',
    'base64',
  );
  expect(card().props.disabled).toBe(true);
  await act(async () => {
    finish({status: 201});
  });
  expect(visibleText()).toContain('Successfully uploaded photo.jpg');
  expect(append).toHaveBeenLastCalledWith({
    eventName: 'FILE UPLOAD',
    eventData: 'Image upload completed',
  });
});

test('Bluetooth does not duplicate the app header and keeps scanning failures explicit', () => {
  const remove = jest.fn();
  const manager = {
    observeAdvertisements: jest.fn(() => ({remove})),
    setResetDeviceListCallback: jest.fn(),
    resetDeviceList: jest.fn(),
  };
  IotcBleManager.getInstance.mockReturnValue(manager);
  act(() => {
    view = renderer.create(<BluetoothPage />);
  });
  const options =
    view.root.findByType('BluetoothNavigator').props.screenOptions;
  expect(options({route: {name: Pages.BLUETOOTH_LIST}}).headerShown).toBe(
    false,
  );
  expect(
    options({
      route: {
        name: Pages.BLUETOOTH_DETAIL,
        params: {deviceName: 'Test device'},
      },
    }),
  ).toMatchObject({headerShown: true, headerTitle: 'Test device'});
  const Component =
    view.root.findAllByType('BluetoothScreen')[0].props.component;
  const unsubscribe = jest.fn();
  const navigation = {
    addListener: jest.fn(() => unsubscribe),
    navigate: jest.fn(),
  };
  act(() => {
    view.update(<Component navigation={navigation} />);
  });
  expect(visibleText()).toContain('Looking for devices');
  act(() => manager.observeAdvertisements.mock.calls[0][1]());
  expect(visibleText()).toContain('Bluetooth unavailable');
  expect(view.root.findByType(FlatList).props.refreshing).toBe(false);
  act(() => view.unmount());
  view = undefined;
  expect(remove).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledTimes(2);
});

test('Bluetooth scanning control meets the minimum touch target and the detail screen explains unavailability', () => {
  const remove = jest.fn();
  const manager = {
    observeAdvertisements: jest.fn(() => ({remove})),
    setResetDeviceListCallback: jest.fn(),
    resetDeviceList: jest.fn(),
  };
  IotcBleManager.getInstance.mockReturnValue(manager);
  hooks.useIoTCentralClient.mockReturnValue([null]);
  act(() => {
    view = renderer.create(<BluetoothPage />);
  });
  const screens = view.root.findAllByType('BluetoothScreen');
  const List = screens[0].props.component;
  const Detail = screens[1].props.component;
  act(() => {
    view.update(<List navigation={{addListener: jest.fn(() => jest.fn())}} />);
  });
  const scan = view.root
    .findAll(
      node =>
        node.props.accessibilityRole === 'button' &&
        node.props.accessibilityLabel === 'Scan again',
    )
    .find(node => node.props.onPress);
  const target = StyleSheet.flatten(scan.props.style);
  expect(target.width).toBeGreaterThanOrEqual(44);
  expect(target.height).toBeGreaterThanOrEqual(44);
  act(() => scan.props.onPress());
  expect(manager.resetDeviceList).toHaveBeenCalledTimes(1);

  act(() => {
    view.update(
      <Detail route={{params: {deviceId: 'abc', deviceName: 'Test device'}}} />,
    );
  });
  act(() => manager.observeAdvertisements.mock.calls.slice(-1)[0][1]());
  expect(visibleText()).toContain('Bluetooth unavailable');
  expect(visibleText()).toContain(
    'Enable Bluetooth and allow Nearby Devices access in Settings.',
  );
});
