import React, {useEffect, useRef, useState} from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {DeviceClient} from '../connection';
import {Text, Name} from '../components/typography';
import {useTheme} from '../hooks';
import Strings from '../strings';

export const validProofNonce = (nonce: string): boolean =>
  /^[A-Za-z0-9_-]{16,128}$/.test(nonce);
let counter = 0;
export const newProofNonce = (): string =>
  `paad_${Date.now().toString(36)}_${(++counter).toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 12)}`;

export async function submitProof(
  client: DeviceClient,
  nonce: string,
  platform: string,
  active: () => boolean,
): Promise<boolean> {
  if (!validProofNonce(nonce) || !active() || !client.isConnected()) {
    return false;
  }
  const telemetry = await client.sendTelemetry({
    paadProofNonce: nonce,
    paadProofPlatform: platform,
  });
  if (
    telemetry.delivery !== 'submitted' ||
    !active() ||
    !client.isConnected()
  ) {
    return false;
  }
  const property = await client.sendProperty({paadProof: {nonce, platform}});
  return property.delivery === 'submitted' && active() && client.isConnected();
}

export function ProofActivity({
  client,
  connected,
  simulated,
}: {
  client: DeviceClient | null;
  connected: boolean;
  simulated: boolean;
}) {
  const text = Strings.Connection.Summary;
  const {colors} = useTheme();
  const [nonce, setNonce] = useState(newProofNonce);
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const latest = useRef({client, connected, simulated});
  latest.current = {client, connected, simulated};
  useEffect(() => {
    generation.current++;
    setStatus('');
  }, [client, connected, simulated]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const unavailable = !client || !connected || simulated;
  return (
    <View style={styles.container}>
      <Name>{text.ProofTitle}</Name>
      <Text>{text.ProofExplanation}</Text>
      {unavailable && <Text>{text.ProofUnavailable}</Text>}
      <TextInput
        testID="proof-nonce"
        accessibilityLabel={text.ProofNonce}
        value={nonce}
        editable={!pending}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        selectTextOnFocus
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={Keyboard.dismiss}
        style={[styles.input, {borderColor: colors.border, color: colors.text}]}
        onChangeText={value => {
          setNonce(value);
          setStatus('');
        }}
      />
      <Pressable
        testID="proof-send"
        accessibilityRole="button"
        accessibilityLabel={text.ProofSend}
        accessibilityState={{disabled: unavailable || pending}}
        disabled={unavailable || pending}
        style={styles.button}
        onPress={async () => {
          if (lock.current || unavailable || !client) {
            return;
          }
          if (!validProofNonce(nonce)) {
            setStatus(text.ProofInvalid);
            return;
          }
          lock.current = true;
          setPending(true);
          setStatus(text.ProofSending);
          const attempt = generation.current;
          const active = () =>
            mounted.current &&
            generation.current === attempt &&
            latest.current.client === client &&
            latest.current.connected &&
            !latest.current.simulated;
          try {
            const submitted = await submitProof(
              client,
              nonce,
              Platform.OS,
              active,
            );
            if (active()) {
              setStatus(submitted ? text.ProofSubmitted : text.ProofFailed);
            }
          } catch {
            if (active()) {
              setStatus(text.ProofFailed);
            }
          } finally {
            lock.current = false;
            if (mounted.current) {
              setPending(false);
            }
          }
        }}>
        <Text>{text.ProofSend}</Text>
      </Pressable>
      <Text testID="proof-status" accessibilityLiveRegion="polite">
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {marginTop: 20},
  input: {
    minHeight: 48,
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginTop: 12,
  },
  button: {minHeight: 48, justifyContent: 'center', paddingVertical: 12},
});
