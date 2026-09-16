/* eslint-disable react-native/no-inline-styles */
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {RouteProp} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import CardView from 'CardView';
import {Loader} from 'components';
import ConnectionSummary from './components/connectionSummary';
import FileUpload from 'FileUpload';
import {
  useLogger,
  useSensors,
  useProperties,
  IIcon,
  useDeliveryInterval,
  useIoTCentralClient,
} from 'hooks';
import Logs from 'Logs';
import React, {useCallback, useEffect, useRef} from 'react';
import {Platform, Alert} from 'react-native';
import {
  IIoTCCommand,
  IIoTCCommandResponse,
  IIoTCProperty,
  IOTC_EVENTS,
  IIoTCClient,
  ConnectionError,
} from './connection';

import Strings, {resolveString} from 'strings';
import {
  NavigationParams,
  PagesNavigator,
  PROPERTY,
  ScreenNames,
  Screens,
  LIGHT_TOGGLE_COMMAND,
  ENABLE_DISABLE_COMMAND,
  SET_FREQUENCY_COMMAND,
  TELEMETRY,
  DATA_AVAILABLE_EVENT,
  NavigationScreens,
  ItemProps,
  Pages,
  ChartType,
} from 'types';
import {AVAILABLE_SENSORS} from './sensors';
import {Icon} from '@rneui/themed';
import {playTorch} from 'tools/Torch';
import {BluetoothPage} from 'bluetooth/Bluetooth';

const Tab = createBottomTabNavigator<NavigationScreens>();

export async function executeCommand(
  command: IIoTCCommand,
  sensors: ItemProps[],
  append: (item: {eventName: string; eventData: string}) => void,
) {
  let status = IIoTCCommandResponse.ERROR;
  let response: Record<string, unknown> = {
    error: 'Invalid or unavailable command',
  };
  try {
    if (
      typeof command.requestPayload !== 'string' ||
      command.requestPayload.length > 4096
    ) {
      throw new Error('Invalid command');
    }
    const data: unknown = JSON.parse(command.requestPayload);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid command');
    }
    const input = data as Record<string, unknown>;
    if (command.name === LIGHT_TOGGLE_COMMAND) {
      const {pulses, duration, delay = 1} = input;
      if (
        typeof pulses !== 'number' ||
        !Number.isInteger(pulses) ||
        pulses < 1 ||
        pulses > 100 ||
        typeof duration !== 'number' ||
        !Number.isFinite(duration) ||
        duration <= 0 ||
        duration > 60 ||
        typeof delay !== 'number' ||
        !Number.isFinite(delay) ||
        delay < 0 ||
        delay > 60
      ) {
        throw new Error('Invalid command');
      }
      await playTorch(pulses, duration, delay);
      response = {execution: 'completed'};
    } else {
      const sensor = sensors.find(item => item.id === input.sensor);
      if (!sensor) {
        throw new Error('Invalid command');
      }
      if (
        command.name === ENABLE_DISABLE_COMMAND &&
        typeof input.enable === 'boolean'
      ) {
        if (input.enable && sensor.availability === 'unavailable') {
          throw new Error('Unavailable sensor');
        }
        await sensor.enable(input.enable);
        response = {enabled: input.enable, execution: 'requested'};
      } else if (
        command.name === SET_FREQUENCY_COMMAND &&
        typeof input.interval === 'number' &&
        Number.isFinite(input.interval) &&
        input.interval >= 1 &&
        input.interval <= 3600 &&
        sensor.availability !== 'unavailable'
      ) {
        sensor.sendInterval(input.interval * 1000);
        response = {interval: input.interval};
      } else {
        throw new Error('Invalid command');
      }
    }
    status = IIoTCCommandResponse.SUCCESS;
  } catch {
    append({
      eventName: 'ERROR',
      eventData: 'Command rejected or execution failed.',
    });
  }
  try {
    await command.reply(status, JSON.stringify(response));
  } catch {
    append({
      eventName: 'ERROR',
      eventData: 'Command response could not be submitted.',
    });
  }
}

const icons: {
  [x in ScreenNames]: (props: {
    focused: boolean;
    color: string;
    size: number;
  }) => React.ReactNode;
} = {
  [Screens.TELEMETRY_SCREEN]: ({color, size}) => (
    <TabBarIcon
      size={size}
      color={color}
      icon={
        Platform.select({
          ios: {
            name: 'stats-chart-outline',
            type: 'ionicon',
          },
          android: {
            name: 'chart-bar',
            type: 'material-community',
          },
        }) as IIcon
      }
    />
  ),
  [Screens.PROPERTIES_SCREEN]: ({color, size}) => (
    <TabBarIcon
      size={size}
      color={color}
      icon={
        Platform.select({
          ios: {
            name: 'create-outline',
            type: 'ionicon',
          },
          android: {
            name: 'playlist-edit',
            type: 'material-community',
          },
        }) as IIcon
      }
    />
  ),
  [Screens.HEALTH_SCREEN]: ({color, size}) => (
    <TabBarIcon
      size={size}
      color={color}
      icon={
        {
          name: 'heartbeat',
          type: 'font-awesome',
        } as IIcon
      }
    />
  ),
  [Screens.FILE_UPLOAD_SCREEN]: ({color, size}) => (
    <TabBarIcon
      size={size}
      color={color}
      icon={
        Platform.select({
          ios: {
            name: 'cloud-upload-outline',
            type: 'ionicon',
          },
          android: {
            name: 'cloud-upload-outline',
            type: 'material-community',
          },
        }) as IIcon
      }
    />
  ),
  [Screens.LOGS_SCREEN]: ({color, size}) => (
    <TabBarIcon
      size={size}
      color={color}
      icon={
        Platform.select({
          ios: {
            name: 'console',
            type: 'material-community',
          },
          android: {
            name: 'console',
            type: 'material-community',
          },
        }) as IIcon
      }
    />
  ),
  [Screens.BLUETOOTH_STACK]: ({color, size}) => (
    <TabBarIcon
      size={size}
      color={color}
      icon={
        {
          name: 'bluetooth',
          type: 'material-community',
        } as IIcon
      }
    />
  ),
};

const Root = React.memo<{
  route: RouteProp<
    Record<string, NavigationParams & {previousScreen?: string}>,
    'Root'
  >;
  navigation: PagesNavigator;
}>(({navigation}) => {
  const [, append] = useLogger();
  const [sensors, addSensorListener, removeSensorListener] = useSensors();
  const [deliveryInterval] = useDeliveryInterval();
  // const [healths, addHealthListener, removeHealthListener] = useHealth();
  const {
    loading: propertiesLoading,
    properties,
    updateProperty,
  } = useProperties();
  const propertyRef = useRef(properties);
  propertyRef.current = properties;

  const onConnectionRefresh = useCallback(async (client: IIoTCClient) => {
    await client.fetchTwin();
    await client.sendProperty({
      [PROPERTY]: {
        __t: 'c',
        ...propertyRef.current
          .filter(property => property.value !== undefined)
          .reduce((obj, p) => ({...obj, [p.id]: p.value}), {}),
      },
    });
  }, []);
  const [iotcentralClient] = useIoTCentralClient(onConnectionRefresh);

  const sensorRef = useRef(sensors);
  sensorRef.current = sensors;
  // const healthRef = useRef(healths);

  const sendToCentralHandler = useCallback(
    async (componentName: string, id: string, value: any) => {
      if (iotcentralClient && iotcentralClient.isConnected()) {
        try {
          await iotcentralClient.sendTelemetry(
            {[id]: value},
            {'$.sub': componentName},
          );
        } catch {
          append({
            eventName: 'ERROR',
            eventData: 'Telemetry could not be submitted.',
          });
        }
      }
    },
    [iotcentralClient, append],
  );

  const onCommandUpdate = useCallback(
    (command: IIoTCCommand) =>
      executeCommand(command, sensorRef.current, append),
    [append],
  );

  const onPropUpdate = useCallback(
    async (prop: IIoTCProperty) => {
      const {name, value} = prop;
      if (
        name !== PROPERTY &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        value.__t === 'c'
      ) {
        return;
      }
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        value.__t === 'c'
      ) {
        for (const [field, entry] of Object.entries(value)) {
          if (field !== '__t') {
            updateProperty(field, entry);
          }
        }
      } else {
        updateProperty(name, value);
      }
      try {
        await prop.ack();
      } catch {
        append({
          eventName: 'ERROR',
          eventData: 'Property response could not be submitted.',
        });
      }
    },
    [updateProperty, append],
  );

  const sendTelemetryHandler = useCallback(
    (id: string, value: any) => sendToCentralHandler(TELEMETRY, id, value),
    [sendToCentralHandler],
  );
  // const sendHealthHandler = useCallback(
  //   (id: string, value: any) => sendToCentralHandler(HEALTH, id, value),
  //   [sendToCentralHandler],
  // );

  useEffect(() => {
    const currentSensorRef = sensorRef.current;
    let unsubscribeCommands: (() => void) | undefined;
    let unsubscribeProperties: (() => void) | undefined;
    // const currentHealthRef = healthRef.current;
    if (iotcentralClient) {
      currentSensorRef.forEach(s =>
        addSensorListener(s.id, DATA_AVAILABLE_EVENT, sendTelemetryHandler),
      );
      append({
        eventName: 'INFO',
        eventData: 'Sensor initialized.',
      });

      // currentHealthRef.forEach(h =>
      //   addHealthListener(h.id, DATA_AVAILABLE_EVENT, sendHealthHandler),
      // );
      // append({
      //   eventName: 'INFO',
      //   eventData: 'Health initialized.',
      // });

      append({
        eventName: 'INFO',
        eventData: 'Properties initialized.',
      });

      unsubscribeCommands = iotcentralClient.on(
        IOTC_EVENTS.Commands,
        onCommandUpdate,
      );
      unsubscribeProperties = iotcentralClient.on(
        IOTC_EVENTS.Properties,
        onPropUpdate,
      );
      iotcentralClient.fetchTwin().catch(() => {
        append({
          eventName: 'ERROR',
          eventData: 'Device twin could not be requested.',
        });
      });
    }

    return () => {
      unsubscribeCommands?.();
      unsubscribeProperties?.();
      currentSensorRef.forEach(s =>
        removeSensorListener(s.id, DATA_AVAILABLE_EVENT, sendTelemetryHandler),
      );
      // currentHealthRef.forEach(h =>
      //   removeHealthListener(h.id, DATA_AVAILABLE_EVENT, sendHealthHandler),
      // );
    };
  }, [
    iotcentralClient,
    // addHealthListener,
    addSensorListener,
    append,
    onCommandUpdate,
    onPropUpdate,
    // removeHealthListener,
    removeSensorListener,
    // sendHealthHandler,
    sendTelemetryHandler,
    navigation,
  ]);

  // react to sendinterval change
  useEffect(() => {
    if (
      Number.isFinite(deliveryInterval) &&
      deliveryInterval >= 1 &&
      deliveryInterval <= 3600
    ) {
      sensorRef.current.forEach(sensor =>
        sensor.sendInterval(deliveryInterval * 1000),
      );
    }
  }, [deliveryInterval]);

  return (
    <>
      <ConnectionSummary
        onManualConnection={() =>
          navigation.navigate(Pages.REGISTRATION, {screen: 'MANUAL'})
        }
      />
      <Tab.Navigator
        key="tab"
        screenOptions={{
          headerShown: false,
        }}>
        <Tab.Screen
          name={Screens.TELEMETRY_SCREEN}
          options={{
            tabBarIcon: icons.Telemetry,
          }}>
          {getCardView(sensors, 'Telemetry', navigation)}
        </Tab.Screen>
        {/* <Tab.Screen
          name={Screens.HEALTH_SCREEN}
          options={{
            tabBarIcon: ({color, size}) => (
              <TabBarIcon icon={icons.Health} color={color} size={size} />
            ),
          }}>
          {getCardView(healths, 'Health', true)}
        </Tab.Screen> */}
        <Tab.Screen
          name={Screens.PROPERTIES_SCREEN}
          options={{
            tabBarIcon: icons.Properties,
          }}>
          {propertiesLoading
            ? () => (
                <Loader
                  message={Strings.Client.Properties.Loading}
                  visible={true}
                  style={{flex: 1, justifyContent: 'center'}}
                />
              )
            : () => (
                <CardView
                  items={properties}
                  componentName="Property"
                  onEdit={async (item, value) => {
                    try {
                      if (!iotcentralClient?.isConnected()) {
                        throw new ConnectionError('NOT_CONNECTED');
                      }
                      const submission = await iotcentralClient.sendProperty({
                        [PROPERTY]: {__t: 'c', [item.id]: value},
                      });
                      Alert.alert(
                        'Property',
                        resolveString(
                          submission.delivery === 'simulated'
                            ? Strings.Client.Properties.Delivery.Simulated
                            : Strings.Client.Properties.Delivery.Success,
                          item.name,
                        ),
                        [{text: 'OK'}],
                      );
                    } catch {
                      Alert.alert(
                        'Property',
                        resolveString(
                          Strings.Client.Properties.Delivery.Failure,
                          item.name,
                        ),
                        [{text: 'OK'}],
                      );
                    }
                  }}
                />
              )}
        </Tab.Screen>

        <Tab.Screen
          name={Screens.BLUETOOTH_STACK}
          component={BluetoothPage}
          options={{
            tabBarIcon: icons.Bluetooth,
          }}
        />

        <Tab.Screen
          name={Screens.FILE_UPLOAD_SCREEN}
          component={FileUpload}
          options={{
            tabBarIcon: icons['Image Upload'],
          }}
        />
        <Tab.Screen
          name={Screens.LOGS_SCREEN}
          component={Logs}
          options={{
            tabBarIcon: icons.Logs,
          }}
        />
      </Tab.Navigator>
    </>
  );
});

const getCardView =
  (items: ItemProps[], name: string, navigation: PagesNavigator) => () =>
    (
      <CardView
        items={items}
        componentName={name}
        onItemLongPress={item => {
          item.enable(!item.enabled);
        }}
        onItemPress={item =>
          navigation.navigate(Pages.INSIGHT, {
            chartType:
              item.id === AVAILABLE_SENSORS.GEOLOCATION
                ? ChartType.MAP
                : ChartType.DEFAULT,
            currentValue: item.value,
            telemetryId: item.id,
            title: item.name,
            backTitle: 'Telemetry',
            unit: item.unit,
            simulated: item.simulated,
          })
        }
      />
    );

const TabBarIcon = React.memo<{icon: IIcon; color: string; size: number}>(
  ({icon, color, size}) => {
    return (
      <Icon
        name={icon ? icon.name : 'home'}
        type={icon ? icon.type : 'ionicon'}
        size={size}
        color={color}
      />
    );
  },
);

export default Root;
