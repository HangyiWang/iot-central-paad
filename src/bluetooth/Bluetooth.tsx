/* eslint-disable react/no-unstable-nested-components */
import {createStackNavigator, StackScreenProps} from '@react-navigation/stack';
import {Icon, ListItem} from '@rneui/themed';
import * as React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Platform,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import {Device, UUID} from 'react-native-ble-plx';
import {useIsFocused} from '@react-navigation/native';
import {IotcBleManager} from './BleManager';
import {ItemProps, Pages} from 'types';
import {Loader, Text} from '../components';
import {useIoTCentralClient, useTheme} from '../hooks';
import CardView from 'CardView';
import Strings from 'strings';
import {palette} from '../theme/palette';

type BluetoothStackParamList = {
  [Pages.BLUETOOTH_LIST]: undefined;
  [Pages.BLUETOOTH_DETAIL]: {
    deviceId: UUID;
    deviceName: string;
  };
};

const BluetoothStack = createStackNavigator<BluetoothStackParamList>();

export function BluetoothPage() {
  return (
    <BluetoothStack.Navigator
      initialRouteName={Pages.BLUETOOTH_LIST}
      screenOptions={({route}) => {
        const isListPage: boolean = route.name === Pages.BLUETOOTH_LIST;

        return {
          headerShown: !isListPage,
          headerTitle: route.params?.deviceName ?? Strings.Bluetooth.Title,
          headerTitleAlign: 'left',
          headerBackButtonDisplayMode: 'minimal',
        };
      }}>
      <BluetoothStack.Screen
        name={Pages.BLUETOOTH_LIST}
        component={BluetoothList}
      />
      <BluetoothStack.Screen
        name={Pages.BLUETOOTH_DETAIL}
        component={BluetoothDetail}
      />
    </BluetoothStack.Navigator>
  );
}

type BluetoothListProps = StackScreenProps<
  BluetoothStackParamList,
  typeof Pages.BLUETOOTH_LIST
>;

function BluetoothList({navigation}: BluetoothListProps) {
  const {colors, dark} = useTheme();
  const appearance = palette(dark);
  const [isVisible, setIsVisible] = React.useState(true);
  const {devices, unavailable} = useBluetoothDevicesList(isVisible);

  React.useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsVisible(true);
    });
    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsVisible(false);
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, setIsVisible]);

  return (
    <View style={[styles.container, {backgroundColor: appearance.background}]}>
      <View style={styles.heading}>
        <View style={styles.headingText}>
          <Text accessibilityRole="header" style={styles.title}>
            {Strings.Bluetooth.Title}
          </Text>
          <Text style={[styles.description, {color: appearance.muted}]}>
            {Strings.Bluetooth.Description}
          </Text>
        </View>
        <ReloadButton />
      </View>
      <FlatList<Device>
        data={devices}
        keyExtractor={device => device.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          unavailable && devices.length > 0 ? (
            <Text style={[styles.notice, {color: appearance.danger}]}>
              {Strings.Bluetooth.UnavailableDetail}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={[styles.empty, {backgroundColor: appearance.tints[1]}]}>
            <View
              accessible={false}
              style={[styles.emptyIcon, {backgroundColor: appearance.surface}]}>
              <Icon
                name="bluetooth"
                type="material-community"
                size={30}
                color={appearance.text}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {unavailable
                ? Strings.Bluetooth.Unavailable
                : Strings.Bluetooth.Scanning}
            </Text>
            <Text style={[styles.emptyDescription, {color: appearance.muted}]}>
              {unavailable
                ? Strings.Bluetooth.UnavailableDetail
                : Strings.Bluetooth.ScanningDetail}
            </Text>
          </View>
        }
        renderItem={({item}) => (
          <BluetoothDeviceListItem
            item={item}
            colors={colors}
            navigation={navigation}
          />
        )}
        onRefresh={() => IotcBleManager.getInstance().resetDeviceList()}
        refreshing={!unavailable && devices.length === 0}
        refreshControl={
          <RefreshControl
            refreshing={!unavailable && devices.length === 0}
            onRefresh={() => IotcBleManager.getInstance().resetDeviceList()}
            colors={[colors.text]}
          />
        }
      />
    </View>
  );
}

interface BluetoothDeviceListItemProps {
  item: Device;
  colors: ReturnType<typeof useTheme>['colors'];
  navigation: BluetoothListProps['navigation'];
}

function BluetoothDeviceListItem({
  item,
  colors,
  navigation,
}: BluetoothDeviceListItemProps) {
  return (
    <TouchableOpacity
      onPress={_e => {
        navigation.navigate(Pages.BLUETOOTH_DETAIL, {
          deviceId: item.id,
          deviceName: item.name ?? '',
        });
      }}>
      <ListItem
        containerStyle={[styles.deviceCard, {backgroundColor: colors.card}]}>
        <ListItem.Content
          style={{
            ...styles.item,
            backgroundColor: colors.card,
          }}>
          <ListItem.Title style={{...styles.itemTitle, color: colors.text}}>
            {item.name}
          </ListItem.Title>

          <ListItem.Subtitle
            style={{...styles.subtitleContainer, color: colors.text}}>
            <View style={styles.subtitleContent}>
              <Icon
                name="signal"
                type="material-community"
                color={colors.text}
              />
              <Text style={styles.rssiText}>
                {item.rssi == null
                  ? Strings.Bluetooth.SignalUnavailable
                  : `${item.rssi} dBm`}
              </Text>
            </View>
          </ListItem.Subtitle>
        </ListItem.Content>
      </ListItem>
    </TouchableOpacity>
  );
}

function useBluetoothDevicesList(shouldScan: boolean) {
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [unavailable, setUnavailable] = React.useState(false);
  const [revision, refresh] = React.useReducer(value => value + 1, 0);
  const deviceMap = React.useRef<Map<UUID, Device> | null>(null);

  if (deviceMap.current === null) {
    deviceMap.current = new Map();
  }

  const bleManager = IotcBleManager.getInstance();

  React.useEffect(() => {
    if (!shouldScan) {
      return;
    }
    setUnavailable(false);
    bleManager.setResetDeviceListCallback(() => {
      deviceMap.current?.clear();
      setDevices([]);
      refresh();
    });
    const subscription = bleManager.observeAdvertisements(
      device => {
        if (!device.name) {
          return;
        }
        setUnavailable(false);
        deviceMap.current?.set(device.id, device);
        setDevices(Array.from(deviceMap.current?.values() ?? []));
      },
      () => setUnavailable(true),
    );
    return () => {
      subscription.remove();
      bleManager.setResetDeviceListCallback(() => {});
    };
  }, [bleManager, shouldScan, revision]);

  return {devices, unavailable};
}

type BluetoothDetailProps = StackScreenProps<
  BluetoothStackParamList,
  typeof Pages.BLUETOOTH_DETAIL
>;

function BluetoothDetail({
  route: {
    params: {deviceId, deviceName},
  },
}: BluetoothDetailProps) {
  const [items, setData] = React.useState<ItemProps[] | null>(() => null);
  const [iotcentralClient] = useIoTCentralClient();
  const focused = useIsFocused();
  const [unavailable, setUnavailable] = React.useState(false);

  React.useEffect(() => {
    if (!focused) {
      return;
    }
    const bleManager = IotcBleManager.getInstance();
    const subscription = bleManager.observeAdvertisements(
      device => {
        if (device.id !== deviceId) {
          return;
        }

        const model = bleManager.getModelForDevice(device);

        const deviceData = model.onScan(device);
        if (!deviceData) {
          return;
        }

        const itemProps = model.getItemProps(deviceData);

        setUnavailable(false);
        void Promise.resolve(iotcentralClient?.sendTelemetry(deviceData)).catch(
          () => {},
        );
        void Promise.resolve(
          iotcentralClient?.sendProperty({bleDeviceName: device.name}),
        ).catch(() => {});

        setData(
          itemProps.map(item => ({
            ...item,
            sendInterval(_value) {},
            enable(_value) {},
          })),
        );
      },
      () => setUnavailable(true),
    );
    return () => subscription.remove();
  }, [deviceId, iotcentralClient, focused]);

  if (unavailable) {
    return (
      <Text>
        Bluetooth unavailable. Enable Bluetooth and allow Nearby Devices access
        in Settings.
      </Text>
    );
  }

  if (!(deviceName && items)) {
    return (
      <View style={styles.listLoaderContainer}>
        <Loader visible message="Scanning for device" style={styles.loader} />
      </View>
    );
  }

  return (
    <>
      <CardView items={items} />
    </>
  );
}

function ReloadButton() {
  const {colors} = useTheme();
  return (
    <View style={styles.reload}>
      <Icon
        accessibilityRole="button"
        accessibilityLabel={Strings.Bluetooth.Refresh}
        name="reload"
        type={Platform.select({ios: 'ionicon', android: 'material-community'})}
        color={colors.text}
        onPress={() => {
          IotcBleManager.getInstance().resetDeviceList();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heading: {padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12},
  headingText: {flex: 1, gap: 5},
  title: {fontSize: 24, lineHeight: 31, fontWeight: '600'},
  description: {fontSize: 13, lineHeight: 20},
  reload: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {paddingHorizontal: 20, paddingBottom: 24},
  deviceCard: {borderRadius: 20, marginBottom: 12, padding: 18},
  notice: {marginBottom: 16, fontSize: 14, lineHeight: 21},
  empty: {borderRadius: 24, padding: 28, alignItems: 'center', gap: 14},
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyDescription: {fontSize: 14, lineHeight: 21, textAlign: 'center'},
  item: {
    gap: 6,
  },
  itemTitle: {
    fontWeight: '600',
    fontSize: 16,
  },
  marginEnd10: {
    marginEnd: 10,
  },
  deviceName: {
    fontSize: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  subtitleContainer: {
    marginTop: 10,
  },
  subtitleContent: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 0,
  },
  rssiText: {
    marginStart: 5,
  },
  listLoaderContainer: {
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    width: '75%',
  },
});
