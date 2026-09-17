// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useState, useEffect, useMemo} from 'react';
import {CardProps, IconProps, Icon, Input} from '@rneui/themed';
import {
  View,
  TouchableOpacity,
  TouchableOpacityProps,
  StyleSheet,
} from 'react-native';
import {Button} from 'components';
import {Text, Headline, bytesToSize} from './typography';
import {DataType, ItemProps, StyleDefinition} from 'types';
import {useTheme} from 'hooks';
import Strings from 'strings';
import {cardTint, palette} from '../theme/palette';

type EditCallback = (value: any) => void | Promise<void>;

export function Card(
  props: CardProps &
    TouchableOpacityProps & {
      title?: string;
      onToggle?: () => void;
      enabled: boolean;
      value?: any | React.FC;
      dataType?: DataType;
      unit?: string;
      icon?: IconProps;
      editable?: boolean;
      onEdit?: EditCallback;
      availability?: ItemProps['availability'];
      simulated?: boolean;
      accentKey?: string;
      presentation?: ItemProps['presentation'];
    },
) {
  const {
    containerStyle,
    enabled,
    editable,
    onEdit,
    value,
    unit,
    icon,
    onPress,
    onLongPress,
    dataType,
    availability,
    simulated,
    accentKey,
    presentation,
    ...otherProps
  } = props;
  const {dark} = useTheme();
  const colors = palette(dark);
  const textColor = enabled ? colors.text : colors.muted;
  const tint = cardTint(accentKey ?? props.title ?? '', dark);
  const styles = useMemo<StyleDefinition>(
    () => ({
      container: {
        backgroundColor: enabled ? tint : colors.surface,
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
        minHeight: 140,
        padding: 20,
        marginBottom: 12,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: enabled ? tint : colors.border,
      },
      content: {flexDirection: 'row', alignItems: 'flex-start', gap: 16},
      icon: {
        width: 42,
        height: 42,
        borderRadius: 16,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
      },
      cardBody: {flex: 1, minWidth: 0, gap: 8},
      cardValues: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: 6,
      },
      unit: {color: colors.muted, fontSize: 13, fontWeight: '400'},
      status: {fontSize: 13, color: colors.muted},
      label: {fontSize: 14, fontWeight: '600', color: colors.muted},
      description: {fontSize: 13, lineHeight: 19, color: colors.muted},
      simulated: {fontSize: 12, fontWeight: '600', color: colors.primary},
    }),
    [colors, enabled, tint],
  );

  return (
    <TouchableOpacity
      style={[styles.container, containerStyle]}
      {...otherProps}
      disabled={!onPress && !onLongPress}
      onPress={onPress}
      onLongPress={onLongPress}>
      <View style={styles.content}>
        {icon && (
          <View
            style={styles.icon}
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <Icon
              name={icon.name}
              type={icon.type}
              size={22}
              color={textColor}
            />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text
            testID="card-label"
            accessibilityRole="header"
            style={styles.label}>
            {otherProps.title}
          </Text>
          {simulated && (
            <Text style={styles.simulated}>{Strings.Sensors.Simulated}</Text>
          )}
          {!enabled ? (
            <Text style={styles.status}>{Strings.Sensors.Disabled}</Text>
          ) : availability === 'unavailable' ? (
            <Text style={styles.status}>{Strings.Sensors.Unavailable}</Text>
          ) : availability === 'checking' ? (
            <Text style={styles.status}>{Strings.Sensors.Checking}</Text>
          ) : typeof value === 'function' ? (
            value()
          ) : (
            <View style={styles.cardValues}>
              <Value
                value={value}
                enabled
                type={dataType}
                editable={editable}
                onEdit={onEdit}
                textColor={textColor}
                presentation={presentation}
                label={otherProps.title}
                id={accentKey}
              />
              {unit && enabled && <Text style={styles.unit}>{unit}</Text>}
            </View>
          )}
          {presentation?.description && (
            <Text style={styles.description}>{presentation.description}</Text>
          )}
        </View>
        {onPress && (
          <Icon
            name="chevron-forward"
            type="ionicon"
            size={18}
            color={colors.muted}
            accessible={false}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

const Value = React.memo<{
  value: any;
  enabled: boolean;
  editable: boolean | undefined;
  onEdit: EditCallback | undefined;
  textColor: string;
  type?: DataType;
  presentation?: ItemProps['presentation'];
  label?: string;
  id?: string;
}>(
  ({
    value,
    enabled,
    editable,
    onEdit,
    textColor,
    type,
    presentation,
    label,
    id,
  }) => {
    const [edited, setEdited] = useState(value);
    const {dark} = useTheme();
    const colors = palette(dark);
    const styles: StyleDefinition = {
      container: {flex: 1, minWidth: 0},
      editInput: {paddingHorizontal: 0, marginBottom: 4},
      inputFrame: {
        backgroundColor: colors.surface,
        borderColor: colors.controlBorder,
        borderWidth: 1,
        borderRadius: 12,
        minHeight: 52,
        paddingHorizontal: 12,
      },
      stringVal: {
        fontSize: 23,
        fontWeight: '600',
        color: textColor,
        fontVariant: ['tabular-nums'],
      },
    };

    useEffect(() => {
      setEdited(value);
    }, [value]);

    if (!enabled) {
      return null;
    }
    if (editable && onEdit) {
      const draft = edited == null ? '' : String(edited);
      return (
        <View style={styles.container}>
          <Input
            testID={id ? `property-input-${id}` : undefined}
            accessibilityLabel={label}
            placeholder={presentation?.placeholder}
            placeholderTextColor={colors.muted}
            shake={() => null}
            value={draft}
            onChangeText={setEdited}
            inputStyle={{color: textColor, fontSize: 17, minHeight: 48}}
            inputContainerStyle={styles.inputFrame}
            containerStyle={styles.editInput}
            renderErrorMessage={false}
            keyboardType={
              type === 'number' || typeof value === 'number'
                ? 'numeric'
                : 'default'
            }
          />
          <Button
            testID={id ? `property-submit-${id}` : undefined}
            title={presentation?.actionLabel ?? Strings.Client.Properties.Send}
            disabled={draft === String(value ?? '')}
            onPress={() => onEdit(edited)}
            buttonStyle={{minHeight: 48, borderRadius: 12}}
            type="clear"
          />
        </View>
      );
    }
    if (value === null || value === undefined || value === '') {
      return (
        <Text testID="card-empty" style={{fontSize: 16, color: colors.muted}}>
          {presentation?.emptyLabel ?? Strings.Sensors.Unavailable}
        </Text>
      );
    }

    if (type === 'object') {
      return (
        <View style={valueStyles.measurements}>
          {Object.keys(value).map(v => {
            let strVal: string = value[v] == null ? 'N/A' : String(value[v]);
            if (typeof value[v] === 'number') {
              strVal = (value[v] as number).toLocaleString(undefined, {
                maximumFractionDigits: 3,
              });
            }
            return (
              <View key={v} style={valueStyles.measurement}>
                <Text
                  style={[valueStyles.measurementLabel, {color: textColor}]}>
                  {v}
                </Text>
                <Text
                  style={[valueStyles.measurementValue, {color: textColor}]}>
                  {strVal}
                </Text>
              </View>
            );
          })}
        </View>
      );
    } else {
      let strVal = value.toString();
      switch (type) {
        case 'bytes':
          strVal = bytesToSize(value as number);
          break;
        case 'number':
          strVal = (value as number).toLocaleString(undefined, {
            maximumFractionDigits: 3,
          });
          break;
      }

      return (
        <Headline testID="card-value" style={styles.stringVal}>
          {strVal}
        </Headline>
      );
    }
  },
);

const valueStyles = StyleSheet.create({
  measurements: {flexDirection: 'row', flexWrap: 'wrap', gap: 14},
  measurement: {minWidth: 54, maxWidth: '100%', gap: 2},
  measurementLabel: {fontSize: 12, lineHeight: 17},
  measurementValue: {
    fontSize: 17,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
