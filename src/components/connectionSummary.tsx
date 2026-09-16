// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useEffect, useRef, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  View,
  Pressable,
} from 'react-native';
import {Text} from './typography';
import {
  useConnectIoTCentralClient,
  useIoTCentralClient,
  useSimulation,
  useTheme,
} from 'hooks';
import Strings from 'strings';
import {connectionDiagnostics} from '../onboarding/diagnostics';
import {ProofActivity} from '../onboarding/proof';
import {palette} from '../theme/palette';

export default function ConnectionSummary({
  onManualConnection,
}: {
  onManualConnection(): void;
}) {
  const [connect, cancel, clear, {client, loading, error, stage}] =
    useConnectIoTCentralClient();
  const [, credentials] = useIoTCentralClient();
  const [simulated] = useSimulation();
  const {colors, dark} = useTheme();
  const appearance = palette(dark);
  const [connected, setConnected] = useState(false);
  const [details, setDetails] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const [forgetting, setForgetting] = useState(false);
  const mounted = useRef(true);
  const forgettingRef = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const update = () => setConnected(client?.isConnected() ?? false);
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [client]);
  const text = Strings.Connection.Summary;
  const operationId = error?.operationId ?? client?.identity?.operationId;
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: appearance.border,
        },
      ]}>
      <View style={styles.header}>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                !simulated && connected
                  ? appearance.positiveSurface
                  : appearance.inset,
            },
          ]}>
          <View
            accessible={false}
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  !simulated && connected
                    ? appearance.positive
                    : appearance.muted,
              },
            ]}
          />
          <Text
            testID="connection-status"
            style={[
              styles.statusText,
              {
                color:
                  !simulated && connected
                    ? appearance.positive
                    : appearance.muted,
              },
            ]}
            accessibilityRole="header"
            accessibilityLiveRegion="polite">
            {!simulated && connected ? text.Connected : text.Disconnected}
          </Text>
        </View>
        {!loading && (
          <Pressable
            testID="connection-details"
            accessibilityRole="button"
            accessibilityLabel={text.Details}
            onPress={() => setDetails(true)}
            style={styles.detailsAction}>
            <Text style={[styles.actionText, {color: appearance.primary}]}>
              {text.Details}
            </Text>
          </Pressable>
        )}
      </View>
      {simulated && (
        <Text style={[styles.supporting, {color: appearance.muted}]}>
          {text.Simulated}
        </Text>
      )}
      {client?.identity && !simulated && (
        <View style={styles.identity}>
          <Text style={[styles.label, {color: appearance.muted}]}>
            {text.Device}
          </Text>
          <Text
            selectable
            testID="assigned-device-id"
            style={styles.identityValue}>
            {client.identity.deviceId}
          </Text>
          <Text style={[styles.label, {color: appearance.muted}]}>
            {text.Hub}
          </Text>
          <Text selectable testID="assigned-hub" style={styles.identityValue}>
            {client.identity.assignedHub}
          </Text>
        </View>
      )}
      {loading && (
        <Text
          style={[styles.supporting, {color: appearance.muted}]}
          accessibilityLiveRegion="polite">
          {Strings.Connection.Stages[stage]}
        </Text>
      )}
      {error && (
        <Text
          style={{color: appearance.danger}}
          accessibilityLiveRegion="polite">
          {error.message}
        </Text>
      )}
      <View style={styles.actions}>
        {loading ? (
          <Pressable
            testID="connection-cancel"
            accessibilityRole="button"
            onPress={() => cancel()}
            style={styles.action}>
            <Text style={[styles.actionText, {color: appearance.primary}]}>
              {Strings.Core.Cancel}
            </Text>
          </Pressable>
        ) : (
          <>
            {client ? (
              <Pressable
                testID="connection-disconnect"
                accessibilityRole="button"
                onPress={clear}
                style={styles.action}>
                <Text style={[styles.actionText, {color: appearance.muted}]}>
                  {text.Disconnect}
                </Text>
              </Pressable>
            ) : null}
            {credentials && !connected ? (
              <Pressable
                testID="connection-reconnect"
                accessibilityRole="button"
                onPress={() => connect(credentials)}
                style={styles.action}>
                <Text style={[styles.actionText, {color: appearance.primary}]}>
                  {text.Reconnect}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              testID="connection-manual"
              accessibilityRole="button"
              onPress={onManualConnection}
              style={styles.action}>
              <Text style={[styles.actionText, {color: appearance.primary}]}>
                {text.Manual}
              </Text>
            </Pressable>
          </>
        )}
      </View>
      {details && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setDetails(false)}>
          <KeyboardAvoidingView
            testID="connection-details-sheet"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.sheet, {backgroundColor: appearance.background}]}>
            <View
              style={[styles.handle, {backgroundColor: appearance.border}]}
              accessible={false}
            />
            <View style={styles.sheetHeader}>
              <Text accessibilityRole="header" style={styles.sheetTitle}>
                {text.Details}
              </Text>
              <Pressable
                testID="connection-details-close"
                accessibilityRole="button"
                accessibilityLabel={Strings.Core.Close}
                onPress={() => setDetails(false)}
                style={[styles.close, {backgroundColor: appearance.surface}]}>
                <Text style={[styles.actionText, {color: appearance.primary}]}>
                  {Strings.Core.Close}
                </Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.scroll}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === 'ios' ? 'interactive' : 'on-drag'
              }
              contentContainerStyle={styles.details}>
              <View
                style={[
                  styles.metadata,
                  {backgroundColor: appearance.surface},
                ]}>
                {client?.identity && !simulated && (
                  <>
                    <DetailValue
                      label={text.Model}
                      value={client.identity.modelId}
                      valueTestID="model-id"
                    />
                    {client.identity.registrationId && (
                      <DetailValue
                        label={text.Registration}
                        value={client.identity.registrationId}
                        valueTestID="registration-id"
                      />
                    )}
                  </>
                )}
                {operationId && (
                  <DetailValue label={text.Operation} value={operationId} />
                )}
                <DetailValue
                  label={text.Stage}
                  value={Strings.Connection.Stages[stage]}
                />
                {error && (
                  <Text selectable style={{color: appearance.danger}}>
                    {error.code}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.registry,
                  {backgroundColor: appearance.surface},
                ]}>
                <Text style={[styles.label, {color: appearance.muted}]}>
                  {text.Registry}
                </Text>
                <Text
                  testID="registry-status"
                  style={[
                    styles.registryBadge,
                    {
                      backgroundColor: appearance.inset,
                      color: appearance.text,
                    },
                  ]}>
                  {text.NotChecked}
                </Text>
                <Text style={[styles.supporting, {color: appearance.muted}]}>
                  {text.RegistryExplanation}
                </Text>
              </View>
              <ProofActivity
                client={client}
                connected={connected}
                simulated={simulated}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text.Share}
                style={[
                  styles.secondaryAction,
                  {backgroundColor: appearance.surface},
                ]}
                onPress={async () => {
                  setShareFailed(false);
                  try {
                    await Share.share({
                      message: JSON.stringify(
                        connectionDiagnostics(
                          client?.identity ?? null,
                          stage,
                          connected,
                          simulated,
                          error,
                        ),
                        null,
                        2,
                      ),
                    });
                  } catch {
                    if (mounted.current) {
                      setShareFailed(true);
                    }
                  }
                }}>
                <Text style={[styles.actionText, {color: appearance.primary}]}>
                  {text.Share}
                </Text>
              </Pressable>
              {shareFailed && (
                <Text accessibilityLiveRegion="polite">{text.ShareFailed}</Text>
              )}
              {credentials && (
                <Pressable
                  testID="connection-forget"
                  accessibilityRole="button"
                  accessibilityLabel={text.Forget}
                  accessibilityState={{disabled: forgetting || loading}}
                  disabled={forgetting || loading}
                  style={[
                    styles.secondaryAction,
                    {backgroundColor: appearance.dangerSurface},
                  ]}
                  onPress={() =>
                    Alert.alert(text.ForgetTitle, text.ForgetMessage, [
                      {text: Strings.Core.Cancel, style: 'cancel'},
                      {
                        text: text.Forget,
                        style: 'destructive',
                        onPress: async () => {
                          if (forgettingRef.current || !mounted.current) {
                            return;
                          }
                          forgettingRef.current = true;
                          setForgetting(true);
                          try {
                            await cancel({clear: true});
                            if (mounted.current) {
                              setDetails(false);
                            }
                          } catch {
                            // The shared hook publishes a safe storage failure.
                          } finally {
                            forgettingRef.current = false;
                            if (mounted.current) {
                              setForgetting(false);
                            }
                          }
                        },
                      },
                    ])
                  }>
                  <Text style={[styles.actionText, {color: appearance.danger}]}>
                    {text.Forget}
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

function DetailValue({
  label,
  value,
  valueTestID,
}: {
  label: string;
  value: string;
  valueTestID?: string;
}) {
  const {dark} = useTheme();
  return (
    <View style={styles.detailValue}>
      <Text style={[styles.label, {color: palette(dark).muted}]}>{label}</Text>
      <Text selectable testID={valueTestID} style={styles.metadataValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingTop: 8,
    borderRadius: 24,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {width: 7, height: 7, borderRadius: 4},
  statusText: {fontSize: 13, lineHeight: 19, fontWeight: '600'},
  detailsAction: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  identity: {gap: 2, paddingTop: 4},
  label: {fontSize: 12, lineHeight: 18, fontWeight: '500'},
  identityValue: {fontSize: 13, lineHeight: 19, marginBottom: 5, flexShrink: 1},
  supporting: {fontSize: 13, lineHeight: 20},
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: 16},
  action: {minHeight: 48, justifyContent: 'center'},
  actionText: {fontSize: 14, fontWeight: '600'},
  sheet: {flex: 1},
  handle: {
    width: 40,
    height: 4,
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 12,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '600',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  close: {
    minHeight: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 24,
  },
  scroll: {flex: 1},
  details: {paddingHorizontal: 20, paddingBottom: 48, gap: 16},
  metadata: {padding: 20, borderRadius: 24, gap: 18},
  detailValue: {gap: 5},
  metadataValue: {fontSize: 15, lineHeight: 22, flexShrink: 1},
  registry: {padding: 20, borderRadius: 24, gap: 10},
  registryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryAction: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
  },
});
