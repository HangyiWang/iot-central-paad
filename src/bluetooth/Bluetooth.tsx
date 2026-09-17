import {createStackNavigator, StackScreenProps} from '@react-navigation/stack';
import {Icon} from '@rneui/themed';
import * as React from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Platform,
  Pressable,
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
import {cardTint, palette} from '../theme/palette';

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
          <StatusCard
            icon={unavailable ? 'bluetooth-off' : 'bluetooth'}
            title={
              unavailable
                ? Strings.Bluetooth.Unavailable
                : Strings.Bluetooth.Scanning
            }
            description={
              unavailable
                ? Strings.Bluetooth.UnavailableDetail
                : Strings.Bluetooth.ScanningDetail
            }
          />
        }
        renderItem={({item}) => (
          <BluetoothDeviceListItem item={item} navigation={navigation} />
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

function StatusCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  const {dark} = useTheme();
  const appearance = palette(dark);
  return (
    <View style={[styles.empty, {backgroundColor: appearance.tints[1]}]}>
      <View
        accessible={false}
        style={[styles.emptyIcon, {backgroundColor: appearance.surface}]}>
        <Icon
          name={icon}
          type="material-community"
          size={30}
          color={appearance.text}
        />
      </View>
      <Text accessibilityRole="header" style={styles.emptyTitle}>
        {title}
      </Text>
      <Text style={[styles.emptyDescription, {color: appearance.muted}]}>
        {description}
      </Text>
    </View>
  );
}

interface BluetoothDeviceListItemProps {
  item: Device;
  navigation: BluetoothListProps['navigation'];
}

function BluetoothDeviceListItem({
  item,
  navigation,
}: BluetoothDeviceListItemProps) {
  const {dark} = useTheme();
  const appearance = palette(dark);
  const signal =
    item.rssi == null
      ? Strings.Bluetooth.SignalUnavailable
      : `${item.rssi} dBm`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name ?? ''}, ${signal}`}
      onPress={() => {
        navigation.navigate(Pages.BLUETOOTH_DETAIL, {
          deviceId: item.id,
          deviceName: item.name ?? '',
        });
      }}
      style={[styles.deviceCard, {backgroundColor: appearance.surface}]}>
      <View
        accessible={false}
        style={[styles.deviceIcon, {backgroundColor: cardTint(item.id, dark)}]}>
        <Icon
          name="bluetooth"
          type="material-community"
          size={20}
          color={appearance.text}
        />
      </View>
      <View style={styles.deviceBody}>
        <Text style={styles.itemTitle}>{item.name}</Text>
        <Text style={[styles.rssiText, {color: appearance.muted}]}>
          {signal}
        </Text>
      </View>
      <View accessible={false}>
        <Icon
          name="chevron-right"
          type="material-community"
          size={20}
          color={appearance.muted}
        />
      </View>
    </Pressable>
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
      <View style={styles.detailStatus}>
        <StatusCard
          icon="bluetooth-off"
          title={Strings.Bluetooth.Unavailable}
          description={Strings.Bluetooth.UnavailableDetail}
        />
      </View>
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
  const {dark} = useTheme();
  const appearance = palette(dark);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={Strings.Bluetooth.Refresh}
      onPress={() => {
        IotcBleManager.getInstance().resetDeviceList();
      }}
      style={[styles.reload, {backgroundColor: appearance.surface}]}>
      <View accessible={false}>
        <Icon
          name="reload"
          type={Platform.select({
            ios: 'ionicon',
            android: 'material-community',
          })}
          size={22}
          color={appearance.text}
        />
      </View>
    </Pressable>
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
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {paddingHorizontal: 20, paddingBottom: 24},
  deviceCard: {
    borderRadius: 20,
    marginBottom: 12,
    padding: 16,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceBody: {flex: 1, minWidth: 0, gap: 2},
  detailStatus: {padding: 20},
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
    lineHeight: 23,
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
    fontSize: 13,
    lineHeight: 19,
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
