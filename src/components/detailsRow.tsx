// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {Icon} from '@rneui/themed';
import {useTheme} from '../hooks';
import {palette} from '../theme/palette';
import {detailStyles} from '../theme/detailStyles';
import {Text} from './typography';

type Props = {
  id: string;
  label: string;
  supporting: string;
  icon: string;
  destructive?: boolean;
  disabled?: boolean;
  busy?: boolean;
  expanded?: boolean;
  onInset?: boolean;
  onPress(): void | Promise<void>;
};

export default function DetailsRow({
  id,
  label,
  supporting,
  icon,
  destructive = false,
  disabled = false,
  busy = false,
  expanded,
  onInset = false,
  onPress,
}: Props) {
  const {dark} = useTheme();
  const appearance = palette(dark);
  const {fontScale} = useWindowDimensions();
  const stacked = fontScale > 1.45;
  const inactive = disabled || busy;
  const accent = destructive ? appearance.danger : appearance.primary;
  const background = destructive
    ? appearance.dangerSurface
    : expanded || !onInset
    ? appearance.tints[0]
    : appearance.surface;
  // The glyph badge stays one step apart from the row it sits on, so rows keep
  // the same depth on a raised card and on the recessed Azure panel.
  const glyphBackground =
    background === appearance.surface ? appearance.inset : appearance.surface;
  return (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={supporting}
      accessibilityState={{
        disabled: inactive,
        busy,
        ...(expanded === undefined ? {} : {expanded}),
      }}
      disabled={inactive}
      onPress={onPress}
      style={({pressed}) => [
        styles.row,
        stacked && styles.stacked,
        {
          backgroundColor: background,
          borderColor: destructive ? appearance.danger : appearance.border,
        },
        pressed && !inactive && {backgroundColor: appearance.border},
        inactive && detailStyles.disabled,
      ]}>
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.glyph,
          {backgroundColor: glyphBackground, borderColor: accent},
        ]}>
        {busy ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Icon
            name={icon}
            type="material-community"
            size={19}
            color={accent}
          />
        )}
      </View>
      <View style={styles.content}>
        <Text
          style={[
            detailStyles.actionLabel,
            {color: destructive ? appearance.danger : appearance.text},
          ]}>
          {label}
        </Text>
        <Text style={[detailStyles.supporting, {color: appearance.muted}]}>
          {supporting}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  stacked: {alignItems: 'flex-start'},
  glyph: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {flex: 1, minWidth: 0, gap: 3},
});
