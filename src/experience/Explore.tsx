import React from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {Icon} from '@rneui/themed';
import {Text} from '../components/typography';
import {useTheme} from '../hooks';
import {palette} from '../theme/palette';
import {detailStyles} from '../theme/detailStyles';
import ToolStrings from './toolStrings';

export type ExploreTool =
  | 'Telemetry'
  | 'Properties'
  | 'Image Upload'
  | 'Bluetooth';

const text = ToolStrings.Explore;
const tools: {
  route: ExploreTool;
  id: string;
  title: string;
  detail: string;
  icon: string;
}[] = [
  {
    route: 'Telemetry',
    id: 'telemetry',
    title: text.Telemetry,
    detail: text.TelemetryDetail,
    icon: 'chart-line',
  },
  {
    route: 'Properties',
    id: 'properties',
    title: text.Properties,
    detail: text.PropertiesDetail,
    icon: 'tune-variant',
  },
  {
    route: 'Image Upload',
    id: 'image',
    title: text.Image,
    detail: text.ImageDetail,
    icon: 'image-outline',
  },
  {
    route: 'Bluetooth',
    id: 'bluetooth',
    title: text.Bluetooth,
    detail: text.BluetoothDetail,
    icon: 'bluetooth',
  },
];

export default function Explore({onOpen}: {onOpen(tool: ExploreTool): void}) {
  const {dark} = useTheme();
  const colors = palette(dark);
  return (
    <ScrollView
      testID="explore-directory"
      style={{backgroundColor: colors.background}}
      contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Text
          accessibilityRole="header"
          style={[detailStyles.sheetTitle, {color: colors.text}]}>
          {text.Title}
        </Text>
        <Text style={[detailStyles.supporting, {color: colors.muted}]}>
          {text.Description}
        </Text>
      </View>
      {tools.map((tool, index) => (
        <Pressable
          key={tool.route}
          testID={`explore-tool-${tool.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${tool.title}. ${tool.detail}`}
          onPress={() => onOpen(tool.route)}
          style={({pressed}) => [
            detailStyles.card,
            styles.tool,
            {
              backgroundColor: pressed ? colors.inset : colors.surface,
              borderColor: colors.border,
            },
          ]}>
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.icon,
              {
                backgroundColor: colors.tints[index],
                borderColor: colors.controlBorder,
              },
            ]}>
            <Icon
              name={tool.icon}
              type="material-community"
              color={colors.text}
              size={23}
            />
          </View>
          <View style={styles.body}>
            <Text style={[detailStyles.sectionTitle, {color: colors.text}]}>
              {tool.title}
            </Text>
            <Text style={[detailStyles.supporting, {color: colors.muted}]}>
              {tool.detail}
            </Text>
          </View>
          <Icon
            name="chevron-right"
            type="material-community"
            color={colors.muted}
            size={20}
            accessible={false}
          />
        </Pressable>
      ))}
      <Text style={[detailStyles.supporting, {color: colors.muted}]}>
        {text.Availability}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {padding: 20, gap: 12},
  heading: {gap: 6, marginBottom: 4},
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 88,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {flex: 1, minWidth: 0, gap: 4},
});
