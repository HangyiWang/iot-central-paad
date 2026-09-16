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
  return (
    <View style={[styles.container, {backgroundColor: colors.card}]}>
      <Text
        testID="connection-status"
        accessibilityRole="header"
        accessibilityLiveRegion="polite">
        {!simulated && connected ? text.Connected : text.Disconnected}
      </Text>
      {simulated && <Text>{text.Simulated}</Text>}
      {client?.identity && !simulated && (
        <>
          <Text>{text.Device}</Text>
          <Text selectable testID="assigned-device-id">
            {client.identity.deviceId}
          </Text>
          <Text>{text.Hub}</Text>
          <Text selectable testID="assigned-hub">
            {client.identity.assignedHub}
          </Text>
        </>
      )}
      {loading && (
        <Text accessibilityLiveRegion="polite">
          {Strings.Connection.Stages[stage]}
        </Text>
      )}
      {error && <Text accessibilityLiveRegion="polite">{error.message}</Text>}
      <View style={styles.actions}>
        {loading ? (
          <Pressable
            testID="connection-cancel"
            accessibilityRole="button"
            onPress={() => cancel()}
            style={styles.action}>
            <Text>{Strings.Core.Cancel}</Text>
          </Pressable>
        ) : (
          <>
            {client ? (
              <Pressable
                testID="connection-disconnect"
                accessibilityRole="button"
                onPress={clear}
                style={styles.action}>
                <Text>{text.Disconnect}</Text>
              </Pressable>
            ) : null}
            {credentials && !connected ? (
              <Pressable
                testID="connection-reconnect"
                accessibilityRole="button"
                onPress={() => connect(credentials)}
                style={styles.action}>
                <Text>{text.Reconnect}</Text>
              </Pressable>
            ) : null}
            <Pressable
              testID="connection-manual"
              accessibilityRole="button"
              onPress={onManualConnection}
              style={styles.action}>
              <Text>{text.Manual}</Text>
            </Pressable>
            <Pressable
              testID="connection-details"
              accessibilityRole="button"
              accessibilityLabel={text.Details}
              onPress={() => setDetails(true)}
              style={styles.action}>
              <Text>{text.Details}</Text>
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
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.sheet, {backgroundColor: colors.card}]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === 'ios' ? 'interactive' : 'on-drag'
              }
              contentContainerStyle={styles.details}>
              <Text accessibilityRole="header">{text.Details}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={Strings.Core.Close}
                onPress={() => setDetails(false)}
                style={styles.action}>
                <Text>{Strings.Core.Close}</Text>
              </Pressable>
              {client?.identity && !simulated && (
                <>
                  <Text>{text.Model}</Text>
                  <Text selectable testID="model-id">
                    {client.identity.modelId}
                  </Text>
                  {client.identity.registrationId && (
                    <>
                      <Text>{text.Registration}</Text>
                      <Text selectable testID="registration-id">
                        {client.identity.registrationId}
                      </Text>
                    </>
                  )}
                </>
              )}
              {(client?.identity?.operationId || error?.operationId) && (
                <>
                  <Text>{text.Operation}</Text>
                  <Text selectable>
                    {error?.operationId || client?.identity?.operationId}
                  </Text>
                </>
              )}
              <Text>{text.Stage}</Text>
              <Text selectable>{Strings.Connection.Stages[stage]}</Text>
              {error && <Text selectable>{error.code}</Text>}
              <Text>{text.Registry}</Text>
              <Text testID="registry-status">{text.NotChecked}</Text>
              <Text>{text.RegistryExplanation}</Text>
              <ProofActivity
                client={client}
                connected={connected}
                simulated={simulated}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text.Share}
                style={styles.action}
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
                <Text>{text.Share}</Text>
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
                  style={styles.action}
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
                  <Text style={styles.destructive}>{text.Forget}</Text>
                </Pressable>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {paddingHorizontal: 16, paddingTop: 8},
  actions: {flexDirection: 'row', flexWrap: 'wrap'},
  action: {minHeight: 44, justifyContent: 'center', paddingRight: 20},
  sheet: {flex: 1},
  details: {padding: 24, paddingBottom: 48},
  destructive: {color: '#b34432'},
});
