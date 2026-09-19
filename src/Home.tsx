// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useState} from 'react';
import {NavigatorScreenParams, useNavigation} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator, StackScreenProps} from '@react-navigation/stack';
import {HeaderBackButton} from '@react-navigation/elements';
import {Icon} from '@rneui/themed';
import CardView from 'CardView';
import {Loader} from 'components';
import ConnectionSummary from './components/connectionSummary';
import FileUpload from 'FileUpload';
import {BluetoothPage} from 'bluetooth/Bluetooth';
import {DeviceRuntimeProvider, useDeviceRuntime} from './runtime/DeviceRuntime';
import {ChartType, Pages, PagesNavigator} from 'types';
import Strings from 'strings';
import {AVAILABLE_SENSORS} from './sensors';
import WorkflowHome from './experience/WorkflowHome';
import Explore from './experience/Explore';
import Activity, {CommunicationSummary} from './experience/Activity';
import {useTheme} from 'hooks';
import {palette} from './theme/palette';

export {executeCommand} from './runtime/DeviceRuntime';

export type ExploreRoutes = {
  'Explore tools': undefined;
  Telemetry: undefined;
  Properties: undefined;
  'Image Upload': undefined;
  Bluetooth: undefined;
};
export type ExperienceRoutes = {
  Home: undefined;
  Explore: NavigatorScreenParams<ExploreRoutes> | undefined;
  Activity: undefined;
};
const Tab = createBottomTabNavigator<ExperienceRoutes>();
const Tools = createStackNavigator<ExploreRoutes>();

function TelemetryTool() {
  const {sensors} = useDeviceRuntime();
  const navigation = useNavigation<PagesNavigator>();
  return (
    <CardView
      items={sensors}
      componentName="Telemetry"
      onItemLongPress={item => item.enable(!item.enabled)}
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
}

function PropertiesTool() {
  const {properties, propertiesLoading, submitProperty} = useDeviceRuntime();
  return propertiesLoading ? (
    <Loader message={Strings.Client.Properties.Loading} visible />
  ) : (
    <CardView
      items={properties}
      componentName="Property"
      onEdit={submitProperty}
    />
  );
}

function ToolDirectory({
  navigation,
}: StackScreenProps<ExploreRoutes, 'Explore tools'>) {
  return <Explore onOpen={tool => navigation.navigate(tool)} />;
}

function ExploreStack() {
  const {dark} = useTheme();
  const appearance = palette(dark);
  return (
    <Tools.Navigator
      screenOptions={({navigation}) => ({
        headerStyle: {backgroundColor: appearance.background},
        headerTintColor: appearance.text,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        animation: 'none',
        headerLeft: props => (
          <HeaderBackButton
            {...props}
            testID="explore-back"
            accessibilityLabel={Strings.Core.Back}
            onPress={() => navigation.goBack()}
          />
        ),
      })}>
      <Tools.Screen
        name="Explore tools"
        component={ToolDirectory}
        options={{headerShown: false}}
      />
      <Tools.Screen name="Telemetry" component={TelemetryTool} />
      <Tools.Screen name="Properties" component={PropertiesTool} />
      <Tools.Screen name="Image Upload" component={FileUpload} />
      <Tools.Screen name="Bluetooth" component={BluetoothPage} />
    </Tools.Navigator>
  );
}

function Experience({navigation}: {navigation: PagesNavigator}) {
  const {sensors} = useDeviceRuntime();
  const [detailsRequest, requestDetails] = useState(0);
  const {dark} = useTheme();
  const appearance = palette(dark);
  return (
    <>
      <ConnectionSummary
        detailsRequest={detailsRequest}
        onManualConnection={() =>
          navigation.navigate(Pages.REGISTRATION, {screen: 'MANUAL'})
        }
      />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'none',
          tabBarActiveTintColor: appearance.primary,
          tabBarInactiveTintColor: appearance.muted,
          tabBarStyle: {
            backgroundColor: appearance.surface,
            borderTopColor: appearance.border,
          },
          tabBarItemStyle: {minHeight: 48},
        }}>
        <Tab.Screen
          name="Home"
          options={{
            tabBarButtonTestID: 'tab-home',
            tabBarIcon: ({color, size}) => (
              <Icon
                name="home-outline"
                type="material-community"
                color={color}
                size={size}
              />
            ),
          }}>
          {({navigation: tabs}) => (
            <WorkflowHome
              sensors={sensors}
              onDetails={() => requestDetails(value => value + 1)}
              onTelemetry={() =>
                tabs.navigate('Explore', {screen: 'Telemetry', initial: false})
              }
              onActivity={() => tabs.navigate('Activity')}
              communication={<CommunicationSummary />}
            />
          )}
        </Tab.Screen>
        <Tab.Screen
          name="Explore"
          component={ExploreStack}
          options={{
            tabBarButtonTestID: 'tab-explore',
            tabBarIcon: ({color, size}) => (
              <Icon
                name="compass-outline"
                type="material-community"
                color={color}
                size={size}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Activity"
          component={Activity}
          options={{
            tabBarButtonTestID: 'tab-activity',
            tabBarIcon: ({color, size}) => (
              <Icon
                name="pulse"
                type="material-community"
                color={color}
                size={size}
              />
            ),
          }}
        />
      </Tab.Navigator>
    </>
  );
}

export default function Home({navigation}: {navigation: PagesNavigator}) {
  return (
    <DeviceRuntimeProvider>
      <Experience navigation={navigation} />
    </DeviceRuntimeProvider>
  );
}
