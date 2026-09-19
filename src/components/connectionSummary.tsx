// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useEffect, useRef, useState} from 'react';
import {
  AccessibilityState,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  View,
  Pressable,
  useWindowDimensions,
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
import {detailStyles} from '../theme/detailStyles';
import ConnectionNotice from './connectionNotice';
import {Icon} from '@rneui/themed';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import AzureContextPanel from './azureContextPanel';
import DetailsAction from './detailsAction';
import DetailsRow from './detailsRow';

export default function ConnectionSummary({
  onManualConnection,
  detailsRequest = 0,
}: {
  onManualConnection(): void;
  detailsRequest?: number;
}) {
  const [connect, cancel, clear, {client, loading, error, stage}] =
    useConnectIoTCentralClient();
  const [, credentials] = useIoTCentralClient();
  const [simulated] = useSimulation();
  const {dark} = useTheme();
  const insets = useSafeAreaInsets();
  const appearance = palette(dark);
  const {fontScale} = useWindowDimensions();
  const stacked = fontScale > 1.45;
  const [connected, setConnected] = useState(false);
  const [detailsPhase, setDetailsPhase] = useState<
    'closed' | 'opening' | 'open'
  >('closed');
  const details = detailsPhase !== 'closed';
  const openDetails = () =>
    setDetailsPhase(phase => (phase === 'closed' ? 'opening' : phase));
  const closeDetails = () => setDetailsPhase('closed');
  useEffect(() => {
    if (detailsRequest > 0) {
      setDetailsPhase(phase => (phase === 'closed' ? 'opening' : phase));
    }
  }, [detailsRequest]);
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
  const online = !simulated && connected;
  const emblemColor = online
    ? appearance.positive
    : error && !loading && !simulated
    ? appearance.danger
    : appearance.muted;
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
          onPress: openDetails,
          testID: 'connection-error-details',
        };
  return (
    <View
      testID="connection-summary"
      style={[styles.container, {backgroundColor: appearance.background}]}>
      <View
        testID="connection-status-capsule"
        style={[
          styles.header,
          stacked && styles.stackedHeader,
          {
            backgroundColor: appearance.surface,
            borderColor: appearance.border,
            shadowColor: appearance.text,
            shadowOpacity: dark ? 0 : 0.06,
            elevation: dark ? 0 : 1,
          },
        ]}>
        <View
          testID="connection-status-group"
          style={[styles.statusGroup, stacked && styles.stackedGroup]}>
          <View
            testID="connection-status-emblem"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.connectionIcon,
              {
                backgroundColor: online
                  ? appearance.positiveSurface
                  : appearance.inset,
              },
            ]}>
            <Icon
              name={online ? 'cloud-check-outline' : 'cloud-outline'}
              type="material-community"
              size={19}
              color={emblemColor}
            />
            <View style={[styles.emblemRing, {borderColor: emblemColor}]} />
            <View
              style={[
                styles.emblemBead,
                {
                  backgroundColor: emblemColor,
                  borderColor: appearance.surface,
                },
              ]}
            />
          </View>
          <View style={styles.statusContent}>
            <Text
              testID="connection-status"
              accessibilityHint={text.Title}
              style={[
                styles.statusText,
                {
                  color: online ? appearance.positive : appearance.muted,
                },
              ]}
              accessibilityRole="header"
              accessibilityLiveRegion="polite">
              {online ? text.Connected : text.Disconnected}
            </Text>
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
          </View>
        </View>
        {!loading && (
          <SummaryAction
            id="connection-details"
            label={text.Details}
            title={text.OpenDetails}
            stacked={stacked}
            disclosure
            accessibilityState={{
              busy: detailsPhase === 'opening',
              expanded: detailsPhase === 'open',
            }}
            onPress={openDetails}
          />
        )}
        {loading && (
          <SummaryAction
            id="connection-cancel"
            label={Strings.Core.Cancel}
            title={Strings.Core.Cancel}
            stacked={stacked}
            onPress={() => cancel()}
          />
        )}
      </View>
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
          onShow={() =>
            setDetailsPhase(phase => (phase === 'opening' ? 'open' : phase))
          }
          onRequestClose={closeDetails}>
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
              <Text
                accessibilityRole="header"
                style={[styles.sheetTitle, {color: appearance.text}]}>
                {text.Details}
              </Text>
              <DetailsAction
                id="connection-details-close"
                label={Strings.Core.Close}
                icon="close"
                onPress={closeDetails}
              />
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
                  detailStyles.card,
                  detailStyles.bordered,
                  {
                    backgroundColor: appearance.surface,
                    borderColor: appearance.border,
                  },
                ]}>
                <View>
                  {identity.map((detail, index) => (
                    <DetailValue
                      key={detail.label}
                      {...detail}
                      mono={
                        detail.valueTestID === 'assigned-device-id' ||
                        detail.valueTestID === 'registration-id'
                      }
                      divided={index > 0}
                    />
                  ))}
                  {session.map((detail, index) => (
                    <DetailValue
                      key={detail.label}
                      {...detail}
                      mono={detail.label === text.Operation}
                      divided={index > 0 || identity.length > 0}
                    />
                  ))}
                </View>
              </View>
              <View
                style={[
                  detailStyles.card,
                  detailStyles.bordered,
                  {
                    backgroundColor: appearance.surface,
                    borderColor: appearance.border,
                  },
                ]}>
                <Text
                  accessibilityRole="header"
                  style={[detailStyles.sectionTitle, {color: appearance.text}]}>
                  {text.Manage}
                </Text>
                {credentials && !connected && (
                  <DetailsRow
                    id="connection-reconnect"
                    label={text.Reconnect}
                    supporting={text.ReconnectDetail}
                    icon="refresh"
                    onPress={() => {
                      closeDetails();
                      void connect(credentials);
                    }}
                  />
                )}
                <DetailsRow
                  id="connection-manual"
                  label={text.Manual}
                  supporting={text.ManualDetail}
                  icon="lan-connect"
                  onPress={() => {
                    closeDetails();
                    onManualConnection();
                  }}
                />
                {client && (
                  <DetailsRow
                    id="connection-disconnect"
                    label={text.Disconnect}
                    supporting={text.DisconnectDetail}
                    icon="link-variant-off"
                    destructive
                    onPress={clear}
                  />
                )}
              </View>
              <View
                style={[
                  detailStyles.card,
                  detailStyles.bordered,
                  {
                    backgroundColor: appearance.surface,
                    borderColor: appearance.border,
                  },
                ]}>
                <Text
                  accessibilityRole="header"
                  style={[detailStyles.sectionTitle, {color: appearance.text}]}>
                  {text.Registry}
                </Text>
                <Text
                  testID="registry-status"
                  style={[
                    styles.registryBadge,
                    {
                      backgroundColor: appearance.inset,
                      borderColor: appearance.border,
                      color: appearance.muted,
                    },
                  ]}>
                  {text.NotChecked}
                </Text>
                <Text
                  style={[detailStyles.supporting, {color: appearance.muted}]}>
                  {text.RegistryExplanation}
                </Text>
              </View>
              <ProofActivity
                client={client}
                connected={connected}
                simulated={simulated}
              />
              <AzureContextPanel
                identity={simulated ? null : client?.identity ?? null}
              />
              <View
                style={[
                  detailStyles.card,
                  detailStyles.bordered,
                  {
                    backgroundColor: appearance.surface,
                    borderColor: appearance.border,
                  },
                ]}>
                <Text
                  accessibilityRole="header"
                  style={[detailStyles.sectionTitle, {color: appearance.text}]}>
                  {text.Utilities}
                </Text>
                <DetailsRow
                  id="connection-share"
                  label={text.Share}
                  supporting={text.ShareDetail}
                  icon="share-variant"
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
                  }}
                />
                {shareFailed && (
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[detailStyles.status, {color: appearance.danger}]}>
                    {text.ShareFailed}
                  </Text>
                )}
                {credentials && (
                  <DetailsRow
                    id="connection-forget"
                    label={text.Forget}
                    supporting={text.ForgetDetail}
                    icon="delete-outline"
                    destructive
                    disabled={forgetting || loading}
                    busy={forgetting}
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
                                closeDetails();
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
                    }
                  />
                )}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

function SummaryAction({
  id,
  label,
  title,
  stacked,
  disclosure = false,
  accessibilityState,
  onPress,
}: {
  id: 'connection-details' | 'connection-cancel';
  label: string;
  title: string;
  stacked: boolean;
  disclosure?: boolean;
  accessibilityState?: AccessibilityState;
  onPress(): void;
}) {
  const {dark} = useTheme();
  const appearance = palette(dark);
  return (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={accessibilityState}
      onPress={onPress}
      hitSlop={8}
      style={[styles.detailsAction, stacked && styles.stackedAction]}>
      {({pressed}) => (
        <View
          style={[
            styles.actionPill,
            stacked && styles.stackedAction,
            {backgroundColor: pressed ? appearance.border : appearance.inset},
            pressed && styles.pressedPill,
          ]}>
          <Text style={[styles.rowAction, {color: appearance.primary}]}>
            {title}
          </Text>
          {disclosure && (
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <Icon
                name="chevron-right"
                type="material-community"
                color={appearance.primary}
                size={16}
              />
            </View>
          )}
        </View>
      )}
    </Pressable>
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
          detailStyles.value,
          mono ? detailStyles.monospace : null,
          {color: tone ?? appearance.text},
        ]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
  },
  stackedHeader: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
    paddingRight: 12,
  },
  statusGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stackedGroup: {flex: 0},
  connectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 18,
    borderWidth: 1.5,
    opacity: 0.35,
  },
  emblemBead: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  statusContent: {flex: 1, minWidth: 0, gap: 3},
  statusText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  detailsAction: {
    minHeight: 48,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPill: {
    minHeight: 40,
    minWidth: 92,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 2,
  },
  stackedAction: {alignSelf: 'stretch'},
  pressedPill: {transform: [{scale: 0.97}]},
  label: detailStyles.label,
  supporting: {fontSize: 12, lineHeight: 17},
  notice: {paddingTop: 8},
  divided: detailStyles.divided,
  rowAction: {fontSize: 13, lineHeight: 19, fontWeight: '600', flexShrink: 1},
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
    ...detailStyles.sheetTitle,
    flexShrink: 1,
  },
  scroll: {flex: 1},
  details: {paddingHorizontal: 20, paddingBottom: 48, gap: 16},
  detailValue: detailStyles.row,
  registryBadge: {
    ...detailStyles.status,
    ...detailStyles.bordered,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
});
