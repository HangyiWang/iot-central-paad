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
import ConnectionNotice from './connectionNotice';
import {Icon} from '@rneui/themed';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

export default function ConnectionSummary({
  onManualConnection,
}: {
  onManualConnection(): void;
}) {
  const [connect, cancel, clear, {client, loading, error, stage}] =
    useConnectIoTCentralClient();
  const [, credentials] = useIoTCentralClient();
  const [simulated] = useSimulation();
  const {dark} = useTheme();
  const insets = useSafeAreaInsets();
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
  const identity =
    client?.identity && !simulated
      ? [
          {
            label: text.Device,
            value: client.identity.deviceId,
            valueTestID: 'assigned-device-id',
          },
          {
            label: text.Hub,
            value: client.identity.assignedHub,
            valueTestID: 'assigned-hub',
          },
          {
            label: text.Model,
            value: client.identity.modelId,
            valueTestID: 'model-id',
          },
          ...(client.identity.registrationId
            ? [
                {
                  label: text.Registration,
                  value: client.identity.registrationId,
                  valueTestID: 'registration-id',
                },
              ]
            : []),
        ]
      : [];
  const session = [
    ...(operationId ? [{label: text.Operation, value: operationId}] : []),
    {label: text.Stage, value: Strings.Connection.Stages[stage]},
    ...(error
      ? [
          {
            label: text.ErrorCode,
            value: error.code,
            valueTestID: 'connection-error-code',
            tone: appearance.danger,
          },
          ...(error.status !== undefined &&
          error.status >= 100 &&
          error.status <= 599
            ? [
                {
                  label: text.HttpStatus,
                  value: `HTTP ${error.status}`,
                  valueTestID: 'connection-http-status',
                  tone: appearance.danger,
                },
              ]
            : []),
          ...(error.serviceCode !== undefined
            ? [
                {
                  label: text.ServiceCode,
                  value: `${error.serviceCode}`,
                  valueTestID: 'connection-service-code',
                  tone: appearance.danger,
                },
              ]
            : []),
        ]
      : []),
  ];
  const noticeAction =
    credentials && !connected && !simulated
      ? {
          label: text.Reconnect,
          onPress: () => void connect(credentials),
          testID: 'connection-error-reconnect',
        }
      : {
          label: Strings.Connection.Notice.Review,
          onPress: () => setDetails(true),
          testID: 'connection-error-details',
        };
  return (
    <View
      testID="connection-summary"
      style={[
        styles.container,
        {
          backgroundColor: appearance.background,
          borderColor: appearance.border,
        },
      ]}>
      <View style={styles.header}>
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.connectionIcon,
            {
              backgroundColor:
                !simulated && connected
                  ? appearance.positiveSurface
                  : appearance.inset,
            },
          ]}>
          <Icon
            name={
              !simulated && connected ? 'cloud-check-outline' : 'cloud-outline'
            }
            type="material-community"
            size={20}
            color={
              !simulated && connected ? appearance.positive : appearance.muted
            }
          />
        </View>
        <View style={styles.statusContent}>
          <View style={styles.statusBadge}>
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
              accessibilityHint={text.Title}
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
        </View>
        {!loading && (
          <Pressable
            testID="connection-details"
            accessibilityRole="button"
            accessibilityLabel={text.Details}
            onPress={() => setDetails(true)}
            hitSlop={8}
            style={styles.detailsAction}>
            <Text style={[styles.rowAction, {color: appearance.primary}]}>
              {text.OpenDetails}
            </Text>
            <View accessible={false}>
              <Icon
                name="chevron-right"
                type="material-community"
                color={appearance.primary}
                size={18}
              />
            </View>
          </Pressable>
        )}
        {loading && (
          <Pressable
            testID="connection-cancel"
            accessibilityRole="button"
            onPress={() => cancel()}
            hitSlop={8}
            style={styles.detailsAction}>
            <Text style={[styles.rowAction, {color: appearance.primary}]}>
              {Strings.Core.Cancel}
            </Text>
          </Pressable>
        )}
      </View>
      {simulated && (
        <Text style={[styles.supporting, {color: appearance.muted}]}>
          {text.Simulated}
        </Text>
      )}
      {loading && (
        <Text
          style={[styles.supporting, {color: appearance.muted}]}
          accessibilityLiveRegion="polite">
          {Strings.Connection.Stages[stage]}
        </Text>
      )}
      {error && !loading && (
        <View style={styles.notice}>
          <ConnectionNotice error={error} action={noticeAction} />
        </View>
      )}
      {details && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          allowSwipeDismissal={Platform.OS === 'ios'}
          onRequestClose={() => setDetails(false)}>
          <KeyboardAvoidingView
            testID="connection-details-sheet"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[
              styles.sheet,
              {backgroundColor: appearance.background},
              Platform.OS === 'android' && {
                paddingTop: insets.top,
                paddingBottom: insets.bottom,
                paddingLeft: insets.left,
                paddingRight: insets.right,
              },
            ]}>
            {Platform.OS === 'ios' && (
              <View
                style={[styles.handle, {backgroundColor: appearance.border}]}
                accessible={false}
              />
            )}
            <View
              style={[
                styles.sheetHeader,
                {borderBottomColor: appearance.border},
              ]}>
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
                {identity.map((detail, index) => (
                  <DetailValue
                    key={detail.label}
                    {...detail}
                    mono
                    divided={index > 0}
                  />
                ))}
                {session.map((detail, index) => (
                  <DetailValue
                    key={detail.label}
                    {...detail}
                    divided={index > 0 || identity.length > 0}
                  />
                ))}
              </View>
              <View
                style={[
                  styles.metadata,
                  {backgroundColor: appearance.surface},
                ]}>
                {client && (
                  <Pressable
                    testID="connection-disconnect"
                    accessibilityRole="button"
                    onPress={clear}
                    style={styles.action}>
                    <Text style={[styles.actionText, {color: appearance.text}]}>
                      {text.Disconnect}
                    </Text>
                  </Pressable>
                )}
                {credentials && !connected && (
                  <Pressable
                    testID="connection-reconnect"
                    accessibilityRole="button"
                    onPress={() => {
                      setDetails(false);
                      void connect(credentials);
                    }}
                    style={[
                      styles.action,
                      client ? styles.divided : null,
                      {borderTopColor: appearance.border},
                    ]}>
                    <Text
                      style={[styles.actionText, {color: appearance.primary}]}>
                      {text.Reconnect}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  testID="connection-manual"
                  accessibilityRole="button"
                  onPress={() => {
                    setDetails(false);
                    onManualConnection();
                  }}
                  style={[
                    styles.action,
                    client || credentials ? styles.divided : null,
                    {borderTopColor: appearance.border},
                  ]}>
                  <Text
                    style={[styles.actionText, {color: appearance.primary}]}>
                    {text.Manual}
                  </Text>
                </Pressable>
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
  mono,
  tone,
  divided,
}: {
  label: string;
  value: string;
  valueTestID?: string;
  mono?: boolean;
  tone?: string;
  divided?: boolean;
}) {
  const {dark} = useTheme();
  const appearance = palette(dark);
  return (
    <View
      style={[
        styles.detailValue,
        divided ? styles.divided : null,
        {borderTopColor: appearance.border},
      ]}>
      <Text style={[styles.label, {color: appearance.muted}]}>{label}</Text>
      <Text
        selectable
        testID={valueTestID}
        style={[
          styles.metadataValue,
          mono ? styles.monospace : null,
          tone ? {color: tone} : null,
        ]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  connectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusContent: {flex: 1, minWidth: 0, gap: 2},
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusDot: {width: 7, height: 7, borderRadius: 4},
  statusText: {fontSize: 14, lineHeight: 20, fontWeight: '600', flexShrink: 1},
  detailsAction: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 4,
  },
  label: {fontSize: 12, lineHeight: 18, fontWeight: '500'},
  supporting: {fontSize: 13, lineHeight: 20},
  notice: {paddingTop: 4},
  action: {minHeight: 52, justifyContent: 'center'},
  divided: {borderTopWidth: StyleSheet.hairlineWidth},
  actionText: {fontSize: 15, fontWeight: '600'},
  rowAction: {fontSize: 13, lineHeight: 19, fontWeight: '600'},
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
    paddingTop: Platform.select({ios: 14, default: 20}),
    paddingBottom: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  metadata: {paddingHorizontal: 20, paddingVertical: 4, borderRadius: 24},
  detailValue: {gap: 5, paddingVertical: 12},
  metadataValue: {fontSize: 15, lineHeight: 22, flexShrink: 1},
  monospace: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    lineHeight: 21,
  },
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
