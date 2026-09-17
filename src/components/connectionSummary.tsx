// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {useEffect, useState} from 'react';
import {StyleSheet, View, Pressable} from 'react-native';
import {Text} from './typography';
import {
  useConnectIoTCentralClient,
  useIoTCentralClient,
  useSimulation,
  useTheme,
} from 'hooks';
import Strings from 'strings';
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
  const {colors} = useTheme();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const update = () => setConnected(client?.isConnected() ?? false);
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [client]);
  const text = Strings.Connection.Summary;
  return (
    <View style={[styles.container, {backgroundColor: colors.card}]}>
      <Text accessibilityRole="header" accessibilityLiveRegion="polite">
        {!simulated && connected ? text.Connected : text.Disconnected}
      </Text>
      {simulated && <Text>{text.Simulated}</Text>}
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
      {loading && (
        <Text accessibilityLiveRegion="polite">
          {Strings.Connection.Stages[stage]}
        </Text>
      )}
      {error && !loading && <ConnectionNotice error={error} diagnostics />}
      <View style={styles.actions}>
        {loading ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => cancel()}
            style={styles.action}>
            <Text>{Strings.Core.Cancel}</Text>
          </Pressable>
        ) : (
          <>
            {client ? (
              <Pressable
                accessibilityRole="button"
                onPress={clear}
                style={styles.action}>
                <Text>{text.Disconnect}</Text>
              </Pressable>
            ) : null}
            {credentials && !connected ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => connect(credentials)}
                style={styles.action}>
                <Text>{text.Reconnect}</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={onManualConnection}
              style={styles.action}>
              <Text>{text.Manual}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {paddingHorizontal: 16, paddingTop: 8},
  actions: {flexDirection: 'row', flexWrap: 'wrap'},
  action: {minHeight: 44, justifyContent: 'center', paddingRight: 20},
});
