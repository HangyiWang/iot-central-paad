import React, {useContext, useEffect, useRef, useState} from 'react';
import {Keyboard, Linking, StyleSheet, TextInput, View} from 'react-native';
import {StorageContext} from '../contexts/storage';
import {DeviceIdentity} from '../connection/types';
import {azurePortalUrl, matchesAzureContext} from '../onboarding/azureContext';
import {decodeAzureContextInput} from '../onboarding/azureContextInput';
import {useTheme} from 'hooks';
import Strings from 'strings';
import {palette} from '../theme/palette';
import {detailStyles} from '../theme/detailStyles';
import {Text} from './typography';
import DetailsAction from './detailsAction';

export default function AzureContextPanel({
  identity,
}: {
  identity: DeviceIdentity | null;
}) {
  const {azureContext, azureContextError, save} = useContext(StorageContext);
  const {dark} = useTheme();
  const colors = palette(dark);
  const text = Strings.AzureContext;
  const snapshot =
    identity && azureContext && matchesAzureContext(azureContext, identity)
      ? azureContext
      : null;
  const [expanded, setExpanded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [input, setInput] = useState('');
  const [showIds, setShowIds] = useState(false);
  const [showActivities, setShowActivities] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setImporting(false);
    setInput('');
    setError('');
    setExpanded(false);
    setShowActivities(false);
  }, [identity?.deviceId, identity?.assignedHub]);

  const importSnapshot = async () => {
    setError('');
    let next;
    try {
      next = decodeAzureContextInput(input);
    } catch {
      setError(text.Invalid);
      return;
    }
    if (!identity || !matchesAzureContext(next, identity)) {
      setError(text.WrongDevice);
      return;
    }
    setBusy(true);
    try {
      await save({azureContext: next});
      if (mounted.current) {
        setInput('');
        setImporting(false);
        setExpanded(true);
        Keyboard.dismiss();
      }
    } catch {
      if (mounted.current) setError(text.SaveFailed);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const remove = async () => {
    setError('');
    setBusy(true);
    try {
      await save({azureContext: null});
      if (mounted.current) setExpanded(false);
    } catch {
      if (mounted.current) setError(text.RemoveFailed);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const open = async (resourceId: string) => {
    setError('');
    try {
      await Linking.openURL(azurePortalUrl(resourceId, identity?.assignedHub));
    } catch {
      if (mounted.current) setError(text.OpenFailed);
    }
  };
  const button = (
    label: string,
    onPress: () => void,
    id?: string,
    selected?: boolean,
    variant: 'primary' | 'secondary' | 'danger' = 'secondary',
    icon?: string,
  ) => (
    <DetailsAction
      key={label}
      id={id}
      label={label}
      icon={icon}
      variant={variant}
      expanded={selected}
      onInset
      disabled={busy}
      onPress={onPress}
    />
  );
  const value = (label: string, content: string, id?: string) => (
    <View key={label} style={styles.value}>
      <Text style={[detailStyles.label, {color: colors.muted}]}>{label}</Text>
      <Text
        testID={id}
        selectable
        style={[detailStyles.value, {color: colors.text}]}>
        {content}
      </Text>
    </View>
  );
  const resource = (
    label: string,
    name: string,
    resourceId: string,
    id?: string,
    divided = true,
  ) => (
    <View
      key={label}
      style={[
        detailStyles.row,
        divided && detailStyles.divided,
        {borderTopColor: colors.border},
      ]}>
      {value(label, name, id)}
      {showIds && (
        <Text
          selectable
          style={[detailStyles.monospace, {color: colors.muted}]}>
          {resourceId}
        </Text>
      )}
      <DetailsAction
        label={text.Portal}
        accessibilityLabel={`${label}: ${text.Portal}`}
        external
        onInset
        disabled={busy}
        onPress={() => {
          void open(resourceId);
        }}
      />
    </View>
  );
  return (
    <View
      testID="azure-context-panel"
      style={[detailStyles.card, {backgroundColor: colors.inset}]}>
      <Text
        accessibilityRole="header"
        style={[detailStyles.sectionTitle, {color: colors.text}]}>
        {text.Title}
      </Text>
      {!identity ? (
        <Text style={[detailStyles.supporting, {color: colors.muted}]}>
          {text.Unavailable}
        </Text>
      ) : (
        <>
          {snapshot ? (
            <>
              <Text
                testID="azure-context-namespace"
                selectable
                style={[detailStyles.sectionTitle, {color: colors.text}]}>
                {snapshot.namespace.name}
              </Text>
              <Text style={[detailStyles.label, {color: colors.muted}]}>
                {text.Source}
              </Text>
              <Text
                testID="azure-context-captured"
                style={[detailStyles.supporting, {color: colors.muted}]}>
                {`${text.Captured}: ${new Date(
                  snapshot.capturedAt,
                ).toLocaleString()}`}
              </Text>
              <Text style={[detailStyles.supporting, {color: colors.muted}]}>
                {text.Explanation}
              </Text>
              {button(
                expanded ? text.Hide : text.View,
                () => setExpanded(!expanded),
                'azure-context-toggle',
                expanded,
              )}
              {expanded && (
                <>
                  <View>
                    {resource(
                      text.Namespace,
                      snapshot.namespace.name,
                      snapshot.namespace.resourceId,
                      undefined,
                      false,
                    )}
                    {resource(
                      text.Subscription,
                      snapshot.subscription.name,
                      `/subscriptions/${snapshot.subscription.id}`,
                      'azure-context-subscription',
                    )}
                    <View
                      style={[
                        detailStyles.row,
                        detailStyles.divided,
                        {borderTopColor: colors.border},
                      ]}>
                      {value(text.SubscriptionId, snapshot.subscription.id)}
                    </View>
                    {resource(
                      text.ResourceGroup,
                      snapshot.resourceGroup.name,
                      `/subscriptions/${snapshot.subscription.id}/resourceGroups/${snapshot.resourceGroup.name}`,
                      'azure-context-resource-group',
                    )}
                    <View
                      style={[
                        detailStyles.row,
                        detailStyles.divided,
                        {borderTopColor: colors.border},
                      ]}>
                      {value(
                        text.Region,
                        snapshot.namespace.location,
                        'azure-context-region',
                      )}
                    </View>
                    {resource(
                      text.Hub,
                      snapshot.hub.name,
                      snapshot.hub.resourceId,
                    )}
                    {snapshot.dps &&
                      resource(
                        text.Dps,
                        snapshot.dps.name,
                        snapshot.dps.resourceId,
                      )}
                    {snapshot.registryDevice ? (
                      resource(
                        text.Registry,
                        snapshot.registryDevice.name,
                        snapshot.registryDevice.resourceId,
                      )
                    ) : (
                      <Text
                        style={[
                          detailStyles.row,
                          detailStyles.divided,
                          detailStyles.supporting,
                          {
                            color: colors.muted,
                            borderTopColor: colors.border,
                          },
                        ]}>
                        {text.RegistryMissing}
                      </Text>
                    )}
                  </View>
                  {button(
                    showIds ? text.HideIds : text.ShowIds,
                    () => setShowIds(!showIds),
                    'azure-context-ids',
                    showIds,
                    'secondary',
                    showIds ? 'eye-off-outline' : 'eye-outline',
                  )}
                  <Text
                    accessibilityRole="header"
                    style={[detailStyles.sectionTitle, {color: colors.text}]}>
                    {text.Activities}
                  </Text>
                  <Text
                    style={[detailStyles.supporting, {color: colors.muted}]}>
                    {text.ActivityExplanation}
                  </Text>
                  {button(
                    showActivities ? text.HideActivities : text.ShowActivities,
                    () => setShowActivities(!showActivities),
                    'azure-context-activities',
                    showActivities,
                    'secondary',
                    'pulse',
                  )}
                  {showActivities &&
                    (snapshot.activities.length ? (
                      <View>
                        {snapshot.activities.map((activity, index) => (
                          <View
                            key={`${activity.timestamp}-${index}`}
                            style={[
                              detailStyles.row,
                              index > 0 && detailStyles.divided,
                              {borderTopColor: colors.border},
                            ]}>
                            <Text
                              style={[
                                detailStyles.label,
                                {color: colors.muted},
                              ]}>
                              {new Date(activity.timestamp).toLocaleString()}
                            </Text>
                            <Text
                              selectable
                              style={[
                                detailStyles.value,
                                {color: colors.text},
                              ]}>
                              {activity.operation}
                            </Text>
                            <Text
                              style={[
                                detailStyles.status,
                                {
                                  color:
                                    activity.status === 'Failed'
                                      ? colors.danger
                                      : colors.text,
                                },
                              ]}>
                              {activity.status}
                            </Text>
                            <Text
                              selectable
                              style={[
                                detailStyles.supporting,
                                {color: colors.muted},
                              ]}>
                              {activity.resourceId.split('/').at(-1)}
                            </Text>
                            {showIds && (
                              <Text
                                selectable
                                style={[
                                  detailStyles.monospace,
                                  {color: colors.muted},
                                ]}>
                                {activity.resourceId}
                              </Text>
                            )}
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text
                        style={[
                          detailStyles.supporting,
                          {color: colors.muted},
                        ]}>
                        {text.NoActivities}
                      </Text>
                    ))}
                </>
              )}
            </>
          ) : (
            <Text style={[detailStyles.supporting, {color: colors.muted}]}>
              {azureContext ? text.OtherDevice : text.Empty}
            </Text>
          )}
          {azureContextError && (
            <Text
              accessibilityRole="alert"
              style={[detailStyles.status, {color: colors.danger}]}>
              {text.StoredInvalid}
            </Text>
          )}
          {button(
            snapshot ? text.Replace : text.Import,
            () => {
              setImporting(!importing);
              setInput('');
              setError('');
            },
            'azure-context-import-toggle',
            importing,
            'secondary',
            snapshot ? 'pencil-outline' : 'tray-arrow-down',
          )}
          {importing && (
            <>
              <Text style={[detailStyles.supporting, {color: colors.muted}]}>
                {text.Hint}
              </Text>
              <TextInput
                testID="azure-context-input"
                accessibilityLabel={text.Input}
                placeholder={text.Placeholder}
                placeholderTextColor={colors.muted}
                value={input}
                onChangeText={setInput}
                editable={!busy}
                multiline
                maxLength={87384}
                autoCapitalize="none"
                autoCorrect={false}
                textAlignVertical="top"
                style={[
                  styles.input,
                  detailStyles.value,
                  {
                    color: colors.text,
                    backgroundColor: colors.inset,
                    borderColor: colors.controlBorder,
                  },
                  busy && detailStyles.disabled,
                ]}
              />
              {button(
                text.Import,
                () => {
                  void importSnapshot();
                },
                'azure-context-import',
                undefined,
                'primary',
                'tray-arrow-down',
              )}
              {button(
                Strings.Core.Cancel,
                () => {
                  setImporting(false);
                  setInput('');
                  setError('');
                },
                'azure-context-import-cancel',
                undefined,
                'secondary',
                'close',
              )}
            </>
          )}
          {(azureContext || azureContextError) &&
            button(
              text.Remove,
              () => {
                void remove();
              },
              'azure-context-remove',
              undefined,
              'danger',
              'delete-outline',
            )}
        </>
      )}
      {!!error && (
        <Text
          testID="azure-context-error"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[detailStyles.status, {color: colors.danger}]}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  value: {gap: 4},
  input: {
    ...detailStyles.input,
    minHeight: 144,
    maxHeight: 220,
  },
});
