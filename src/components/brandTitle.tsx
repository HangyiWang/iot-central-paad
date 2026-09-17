import React from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {useTheme} from 'hooks';
import Strings from 'strings';
import {palette} from '../theme/palette';
import {Text} from './typography';

export default function BrandTitle() {
  const {dark} = useTheme();
  const colors = palette(dark);
  return (
    <View
      style={[
        styles.frame,
        {backgroundColor: colors.tints[0], borderColor: colors.border},
      ]}>
      <Text
        testID="app-header-title"
        accessibilityRole="header"
        accessibilityLabel={Strings.Header.Title}
        style={[styles.title, {color: colors.text}]}>
        <Text style={[styles.brand, {color: colors.primary}]}>
          {Strings.Header.Brand}
        </Text>
        {` ${Strings.Header.Descriptor}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 1,
  },
  title: {
    fontFamily: Platform.select({ios: 'System', android: 'sans-serif'}),
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 27,
    letterSpacing: -0.3,
  },
  brand: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 27,
    letterSpacing: -0.7,
  },
});
