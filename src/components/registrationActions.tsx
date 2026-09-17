// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {StyleSheet, View} from 'react-native';
import Button from './button';
import {useTheme} from '../hooks';
import {palette} from '../theme/palette';
import Strings from '../strings';

export default function RegistrationActions({
  onClose,
  onRegisterNew,
}: {
  onClose(): void;
  onRegisterNew(): void;
}) {
  const {dark} = useTheme();
  const colors = palette(dark);
  return (
    <View
      testID="registration-actions"
      style={[styles.footer, {borderTopColor: colors.border}]}>
      <Button
        testID="registration-close"
        title={Strings.Core.Close}
        type="solid"
        buttonStyle={[styles.button, {backgroundColor: colors.primary}]}
        titleStyle={styles.title}
        onPress={onClose}
      />
      <Button
        testID="registration-new"
        title={Strings.Registration.Manual.RegisterNew.Title}
        type="outline"
        buttonStyle={[
          styles.button,
          styles.outline,
          {
            borderColor: colors.controlBorder,
            backgroundColor: colors.tints[2],
          },
        ]}
        titleStyle={styles.title}
        onPress={onRegisterNew}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: 28,
    paddingTop: 20,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: {minHeight: 52, paddingVertical: 14},
  outline: {borderWidth: 1},
  title: {fontSize: 15, lineHeight: 20, fontWeight: '600'},
});
