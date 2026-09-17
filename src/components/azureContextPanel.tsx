import React, {useContext, useEffect, useRef, useState} from 'react';
import {
  Keyboard,
  Linking,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {StorageContext} from '../contexts/storage';
import {DeviceIdentity} from '../connection/types';
import {azurePortalUrl, matchesAzureContext} from '../onboarding/azureContext';
import {decodeAzureContextInput} from '../onboarding/azureContextInput';
import {useTheme} from 'hooks';
import Strings from 'strings';
import {palette} from '../theme/palette';
import {Text} from './typography';

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
  ) => (
    <Pressable
      key={label}
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled: busy,
        ...(selected === undefined ? {} : {expanded: selected}),
      }}
      disabled={busy}
      onPress={onPress}
      style={[
        styles.action,
        {borderColor: colors.border, opacity: busy ? 0.5 : 1},
      ]}>
      <Text style={{color: colors.primary, fontWeight: '600'}}>{label}</Text>
    </Pressable>
  );
  const value = (label: string, content: string, id?: string) => (
    <View key={label} style={styles.value}>
      <Text style={[styles.label, {color: colors.muted}]}>{label}</Text>
      <Text testID={id} selectable>
        {content}
      </Text>
    </View>
  );
  const resource = (
    label: string,
    name: string,
    resourceId: string,
    id?: string,
  ) => (
    <View key={label}>
      {value(label, name, id)}
      {showIds && (
        <Text selectable style={[styles.resourceId, {color: colors.muted}]}>
          {resourceId}
        </Text>
      )}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${label}: ${text.Portal}`}
        disabled={busy}
        onPress={() => {
          void open(resourceId);
        }}
        style={styles.portal}>
        <Text style={{color: colors.primary}}>{text.Portal}</Text>
      </Pressable>
    </View>
  );
  return (
    <View
      testID="azure-context-panel"
      style={[styles.card, {backgroundColor: colors.surface}]}>
      <Text accessibilityRole="header" style={styles.title}>
        {text.Title}
      </Text>
      {!identity ? (
        <Text style={{color: colors.muted}}>{text.Unavailable}</Text>
      ) : (
        <>
          {snapshot ? (
            <>
              <Text
                testID="azure-context-namespace"
                selectable
                style={[styles.namespace, {color: colors.primary}]}>
                {snapshot.namespace.name}
              </Text>
              <Text style={[styles.label, {color: colors.muted}]}>
                {text.Source}
              </Text>
              <Text
                testID="azure-context-captured"
                style={{color: colors.muted}}>
                {`${text.Captured}: ${new Date(
                  snapshot.capturedAt,
                ).toLocaleString()}`}
              </Text>
              <Text style={{color: colors.muted}}>{text.Explanation}</Text>
              {button(
                expanded ? text.Hide : text.View,
                () => setExpanded(!expanded),
                'azure-context-toggle',
                expanded,
              )}
              {expanded && (
                <>
                  {resource(
                    text.Namespace,
                    snapshot.namespace.name,
                    snapshot.namespace.resourceId,
                  )}
                  {resource(
                    text.Subscription,
                    snapshot.subscription.name,
                    `/subscriptions/${snapshot.subscription.id}`,
                    'azure-context-subscription',
                  )}
                  {value(text.SubscriptionId, snapshot.subscription.id)}
                  {resource(
                    text.ResourceGroup,
                    snapshot.resourceGroup.name,
                    `/subscriptions/${snapshot.subscription.id}/resourceGroups/${snapshot.resourceGroup.name}`,
                    'azure-context-resource-group',
                  )}
                  {value(
                    text.Region,
                    snapshot.namespace.location,
                    'azure-context-region',
                  )}
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
                    <Text style={{color: colors.muted}}>
                      {text.RegistryMissing}
                    </Text>
                  )}
                  {button(
                    showIds ? text.HideIds : text.ShowIds,
                    () => setShowIds(!showIds),
                    'azure-context-ids',
                    showIds,
                  )}
                  <Text accessibilityRole="header" style={styles.title}>
                    {text.Activities}
                  </Text>
                  <Text style={{color: colors.muted}}>
                    {text.ActivityExplanation}
                  </Text>
                  {button(
                    showActivities ? text.HideActivities : text.ShowActivities,
                    () => setShowActivities(!showActivities),
                    'azure-context-activities',
                    showActivities,
                  )}
                  {showActivities &&
                    (snapshot.activities.length ? (
                      snapshot.activities.map((activity, index) => (
                        <View
                          key={`${activity.timestamp}-${index}`}
                          style={[styles.event, {borderColor: colors.border}]}>
                          <Text style={[styles.label, {color: colors.muted}]}>
                            {new Date(activity.timestamp).toLocaleString()}
                          </Text>
                          <Text selectable>{activity.operation}</Text>
                          <Text
                            style={{
                              color:
                                activity.status === 'Failed'
                                  ? colors.danger
                                  : colors.text,
                            }}>
                            {activity.status}
                          </Text>
                          <Text selectable style={{color: colors.muted}}>
                            {activity.resourceId.split('/').at(-1)}
                          </Text>
                          {showIds && (
                            <Text selectable style={styles.resourceId}>
                              {activity.resourceId}
                            </Text>
                          )}
                        </View>
                      ))
                    ) : (
                      <Text style={{color: colors.muted}}>
                        {text.NoActivities}
                      </Text>
                    ))}
                </>
              )}
            </>
          ) : (
            <Text style={{color: colors.muted}}>
              {azureContext ? text.OtherDevice : text.Empty}
            </Text>
          )}
          {azureContextError && (
            <Text accessibilityRole="alert" style={{color: colors.danger}}>
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
          )}
          {importing && (
            <>
              <Text style={{color: colors.muted}}>{text.Hint}</Text>
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
                  {
                    color: colors.text,
                    backgroundColor: colors.inset,
                    borderColor: colors.controlBorder,
                  },
                ]}
              />
              {button(
                text.Import,
                () => {
                  void importSnapshot();
                },
                'azure-context-import',
              )}
              {button(Strings.Core.Cancel, () => {
                setImporting(false);
                setInput('');
                setError('');
              })}
            </>
          )}
          {(azureContext || azureContextError) &&
            button(
              text.Remove,
              () => {
                void remove();
              },
              'azure-context-remove',
            )}
        </>
      )}
      {!!error && (
        <Text
          testID="azure-context-error"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{color: colors.danger}}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {borderRadius: 20, padding: 18, gap: 12},
  title: {fontSize: 17, fontWeight: '600'},
  namespace: {fontSize: 18, lineHeight: 25, fontWeight: '600'},
  label: {fontSize: 12, lineHeight: 18},
  value: {gap: 4, paddingTop: 12},
  resourceId: {fontSize: 12, lineHeight: 18},
  action: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  portal: {minHeight: 48, justifyContent: 'center'},
  input: {
    minHeight: 144,
    maxHeight: 220,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
  },
  event: {gap: 6, paddingVertical: 14, borderTopWidth: 1},
});
