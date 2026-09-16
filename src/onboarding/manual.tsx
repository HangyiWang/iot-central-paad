import React, {useRef, useState} from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {DeviceCredentials, PHONE_MODEL_ID} from '../connection';
import {useTheme} from '../hooks';
import {Text, Name} from '../components/typography';
import Strings from '../strings';
import {palette} from '../theme/palette';

export type ManualMode = 'individual' | 'hub' | 'legacy';
export type ManualValues = {
  registrationId: string;
  scopeId: string;
  deviceKey: string;
  provisioningHost: string;
  connectionString: string;
};

export function manualCredentials(
  mode: ManualMode,
  values: ManualValues,
): DeviceCredentials {
  if (mode === 'hub') {
    return {
      connectionString: values.connectionString.trim(),
      modelId: PHONE_MODEL_ID,
    };
  }
  return {
    registrationId: values.registrationId.trim(),
    scopeId: values.scopeId.trim(),
    provisioningHost: values.provisioningHost.trim(),
    ...(mode === 'legacy'
      ? {authKey: values.deviceKey.trim(), keyType: 'group' as const}
      : {deviceKey: values.deviceKey.trim(), keyType: 'device' as const}),
    modelId: PHONE_MODEL_ID,
  };
}

export function CredentialForm({
  credentials,
  readonly,
  loading,
  submit,
}: {
  credentials: DeviceCredentials | null;
  readonly: boolean;
  loading: boolean;
  submit(values: DeviceCredentials): Promise<void>;
}) {
  const {colors, dark} = useTheme();
  const appearance = palette(dark);
  const [mode, setMode] = useState<ManualMode>(
    credentials?.connectionString
      ? 'hub'
      : credentials?.keyType === 'group'
      ? 'legacy'
      : 'individual',
  );
  const [values, setValues] = useState<ManualValues>(() => ({
    registrationId: credentials?.registrationId ?? credentials?.deviceId ?? '',
    scopeId: credentials?.scopeId ?? '',
    deviceKey: credentials?.authKey ?? credentials?.deviceKey ?? '',
    provisioningHost:
      credentials?.provisioningHost ?? 'global.azure-devices-provisioning.net',
    connectionString: credentials?.connectionString ?? '',
  }));
  const [revealed, setRevealed] = useState(false);
  const [showMethods, setShowMethods] = useState(false);
  const busy = useRef(false);
  const manual = Strings.Registration.Manual;
  const fields: {key: keyof ManualValues; label: string; secure?: boolean}[] =
    mode === 'hub'
      ? [
          {
            key: 'connectionString',
            label: manual.Body.ConnectionType.CString,
            secure: true,
          },
        ]
      : [
          {key: 'registrationId', label: manual.DeviceId.Label},
          {key: 'scopeId', label: manual.ScopeId.Label},
          {
            key: 'deviceKey',
            label:
              mode === 'legacy' ? manual.KeyTypes.Group : manual.SASKey.Label,
            secure: true,
          },
          {key: 'provisioningHost', label: manual.ProvisioningHost},
        ];
  const choices: {mode: ManualMode; label: string}[] = [
    {mode: 'individual', label: manual.Body.ConnectionType.Dps},
    {mode: 'hub', label: manual.Body.ConnectionType.CString},
    {mode: 'legacy', label: manual.KeyTypes.Group},
  ];
  return (
    <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
      <View style={styles.form}>
        <Name>{choices.find(choice => choice.mode === mode)?.label}</Name>
        {!readonly && (
          <Pressable
            testID="connection-methods"
            accessibilityRole="button"
            accessibilityLabel={manual.ChangeMethod}
            accessibilityState={{expanded: showMethods, disabled: loading}}
            disabled={loading}
            style={styles.changeMethod}
            onPress={() => setShowMethods(value => !value)}>
            <Text style={[styles.link, {color: colors.primary}]}>
              {manual.ChangeMethod}
            </Text>
          </Pressable>
        )}
        {showMethods &&
          choices.map(choice => (
            <Pressable
              key={choice.mode}
              testID={`connection-mode-${choice.mode}`}
              accessibilityRole="radio"
              accessibilityLabel={choice.label}
              accessibilityState={{
                selected: mode === choice.mode,
                disabled: readonly || loading,
              }}
              disabled={readonly || loading}
              style={[
                styles.choice,
                {
                  borderColor:
                    mode === choice.mode
                      ? colors.primary
                      : appearance.controlBorder,
                  backgroundColor:
                    mode === choice.mode
                      ? appearance.inset
                      : appearance.surface,
                },
              ]}
              onPress={() => {
                setMode(choice.mode);
                setRevealed(false);
                setShowMethods(false);
              }}>
              <Text>{choice.label}</Text>
            </Pressable>
          ))}
        {mode === 'legacy' && (
          <Text style={{color: appearance.danger}}>{manual.LegacyWarning}</Text>
        )}
        <Name style={styles.sectionTitle}>{manual.Body.ConnectionInfo}</Name>
        {fields.map(field => (
          <View key={field.key} style={styles.field}>
            <Text style={[styles.label, {color: appearance.muted}]}>
              {field.label}
            </Text>
            <TextInput
              testID={`connection-${field.key}`}
              accessibilityLabel={field.label}
              value={values[field.key]}
              onChangeText={value =>
                setValues(current => ({...current, [field.key]: value}))
              }
              editable={!readonly && !loading}
              secureTextEntry={!!field.secure && !revealed}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              selectTextOnFocus={field.key === 'provisioningHost'}
              returnKeyType="done"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={Keyboard.dismiss}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: appearance.controlBorder,
                  backgroundColor: appearance.inset,
                },
              ]}
            />
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            revealed ? Strings.Core.HideCredential : Strings.Core.ShowCredential
          }
          onPress={() => setRevealed(value => !value)}
          style={styles.changeMethod}>
          <Text style={[styles.link, {color: colors.primary}]}>
            {revealed
              ? Strings.Core.HideCredential
              : Strings.Core.ShowCredential}
          </Text>
        </Pressable>
        {!readonly && (
          <Pressable
            testID="connection-submit"
            accessibilityRole="button"
            accessibilityLabel={manual.Footer.Connect}
            accessibilityState={{disabled: loading}}
            disabled={loading}
            style={[styles.submit, {backgroundColor: colors.primary}]}
            onPress={async () => {
              if (busy.current) {
                return;
              }
              busy.current = true;
              Keyboard.dismiss();
              try {
                await submit(manualCredentials(mode, values));
              } finally {
                busy.current = false;
              }
            }}>
            <Text
              style={[
                styles.submitText,
                dark ? styles.darkSubmitText : styles.lightSubmitText,
              ]}>
              {manual.Footer.Connect}
            </Text>
          </Pressable>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  form: {paddingTop: 8},
  sectionTitle: {marginTop: 16, marginBottom: 18},
  field: {marginBottom: 12},
  label: {fontSize: 13, lineHeight: 19, fontWeight: '500'},
  link: {fontSize: 14, fontWeight: '600'},
  changeMethod: {minHeight: 48, justifyContent: 'center'},
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    marginTop: 7,
  },
  choice: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginVertical: 5,
  },
  submit: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  submitText: {fontWeight: '600'},
  darkSubmitText: {color: '#17252A'},
  lightSubmitText: {color: '#fff'},
});
