import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {Icon} from '@rneui/themed';
import {useTheme} from '../hooks';
import {palette} from '../theme/palette';
import {detailStyles} from '../theme/detailStyles';
import {Text} from './typography';

type Props = {
  label: string;
  onPress(): void | Promise<void>;
  id?: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  accessibilityLabel?: string;
  disabled?: boolean;
  busy?: boolean;
  expanded?: boolean;
  external?: boolean;
  onInset?: boolean;
  block?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function DetailsAction({
  label,
  onPress,
  id,
  icon,
  variant = 'secondary',
  accessibilityLabel = label,
  disabled = false,
  busy = false,
  expanded,
  external = false,
  onInset = false,
  block = false,
  style,
}: Props) {
  const {dark} = useTheme();
  const colors = palette(dark);
  const inactive = disabled || busy;
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  const color = inactive
    ? colors.muted
    : primary
    ? colors.onPrimary
    : danger
    ? colors.danger
    : colors.primary;
  const backgroundColor = inactive
    ? colors.inset
    : primary
    ? colors.primary
    : danger
    ? colors.dangerSurface
    : expanded
    ? colors.tints[0]
    : onInset
    ? colors.surface
    : colors.inset;
  const trailing = external
    ? 'open-in-new'
    : expanded === undefined
    ? undefined
    : expanded
    ? 'chevron-up'
    : 'chevron-down';
  const glyph = (name: string) => (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Icon name={name} type="material-community" size={18} color={color} />
    </View>
  );
  return (
    <Pressable
      testID={id}
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{
        disabled: inactive,
        busy,
        ...(expanded === undefined ? {} : {expanded}),
      }}
      disabled={inactive}
      onPress={onPress}
      style={({pressed}) => [
        detailStyles.action,
        styles.control,
        block && styles.block,
        {
          backgroundColor:
            pressed && !inactive && !primary ? colors.border : backgroundColor,
          borderColor: danger
            ? colors.danger
            : primary && !inactive
            ? colors.primary
            : colors.controlBorder,
        },
        pressed && !inactive && primary && styles.pressedPrimary,
        inactive && detailStyles.disabled,
        style,
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : icon ? (
        glyph(icon)
      ) : null}
      <Text style={[detailStyles.actionLabel, styles.label, {color}]}>
        {label}
      </Text>
      {trailing && glyph(trailing)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  block: {alignSelf: 'stretch'},
  label: {flexShrink: 1, textAlign: 'center'},
  pressedPrimary: {opacity: 0.82},
});
