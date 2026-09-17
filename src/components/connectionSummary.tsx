// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useEffect, useState} from 'react';
import {StyleSheet, View, Pressable, useWindowDimensions} from 'react-native';
import {Icon} from '@rneui/themed';
import {Text} from './typography';
import {
  useConnectIoTCentralClient,
  useIoTCentralClient,
  useSimulation,
  useTheme,
} from 'hooks';
import Strings from 'strings';
import {palette} from '../theme/palette';
import ConnectionNotice from './connectionNotice';

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
  const appearance = palette(dark);
  const {fontScale} = useWindowDimensions();
  const stacked = fontScale > 1.45;
  const [connected, setConnected] = useState(false);
  const [details, setDetails] = useState(false);
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
  const noticeAction =
    credentials && !connected && !simulated
      ? {
          label: text.Reconnect,
          onPress: () => connect(credentials),
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
      style={[styles.container, {backgroundColor: appearance.background}]}>
      <View
        testID="connection-status-capsule"
        style={[
          styles.header,
          stacked && styles.stackedHeader,
          dark ? styles.darkShadow : styles.lightShadow,
          {
            backgroundColor: appearance.surface,
            borderColor: appearance.border,
            shadowColor: appearance.text,
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
            <View
              testID="connection-status-ring"
              style={[styles.emblemRing, {borderColor: emblemColor}]}
            />
            <View
              testID="connection-status-bead"
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
                {color: online ? appearance.positive : appearance.muted},
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
        {loading ? (
          <SummaryAction
            id="connection-cancel"
            label={Strings.Core.Cancel}
            stacked={stacked}
            onPress={() => cancel()}
          />
        ) : (
          <SummaryAction
            id="connection-details"
            label={text.OpenDetails}
            stacked={stacked}
            expanded={details}
            onPress={() => setDetails(value => !value)}
          />
        )}
      </View>
      {error && !loading && (
        <View style={styles.notice}>
          <ConnectionNotice error={error} action={noticeAction} diagnostics />
        </View>
      )}
      {details && (
        <View
          testID="connection-details-content"
          style={[styles.details, {backgroundColor: appearance.surface}]}>
          {client?.identity && !simulated && (
            <>
              <Text selectable>
                {text.Device}: {client.identity.deviceId}
              </Text>
              <Text selectable>
                {text.Hub}: {client.identity.assignedHub}
              </Text>
            </>
          )}
          {!loading && (
            <View style={styles.actions}>
              {client ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={clear}
                  style={styles.action}>
                  <Text style={{color: appearance.primary}}>
                    {text.Disconnect}
                  </Text>
                </Pressable>
              ) : null}
              {credentials && !connected ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => connect(credentials)}
                  style={styles.action}>
                  <Text style={{color: appearance.primary}}>
                    {text.Reconnect}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={onManualConnection}
                style={styles.action}>
                <Text style={{color: appearance.primary}}>{text.Manual}</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function SummaryAction({
  id,
  label,
  stacked,
  expanded,
  onPress,
}: {
  id: 'connection-details' | 'connection-cancel';
  label: string;
  stacked: boolean;
  expanded?: boolean;
  onPress(): void;
}) {
  const {dark} = useTheme();
  const appearance = palette(dark);
  return (
    <Pressable
      testID={id}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={expanded === undefined ? undefined : {expanded}}
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
            {label}
          </Text>
          {expanded !== undefined && (
            <View
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              <Icon
                name={expanded ? 'chevron-up' : 'chevron-down'}
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
  lightShadow: {shadowOpacity: 0.06, elevation: 1},
  darkShadow: {shadowOpacity: 0, elevation: 0},
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
  supporting: {fontSize: 12, lineHeight: 17},
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
  rowAction: {fontSize: 13, lineHeight: 19, fontWeight: '600', flexShrink: 1},
  notice: {paddingTop: 8},
  details: {marginTop: 8, padding: 16, borderRadius: 20, gap: 8},
  actions: {flexDirection: 'row', flexWrap: 'wrap'},
  action: {
    minHeight: 48,
    minWidth: 48,
    maxWidth: '100%',
    justifyContent: 'center',
    paddingRight: 20,
  },
});
