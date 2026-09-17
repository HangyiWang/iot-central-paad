// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as ImagePicker from 'expo-image-picker';
import {View} from 'react-native-animatable';
import {Icon, ListItem} from '@rneui/themed';
import {Headline, Link, Text} from './components';
import {
  useIoTCentralClient,
  useSimulation,
  ISetBooleanFunctions,
  useBoolean,
  useTheme,
} from 'hooks';
import {
  Alert,
  Platform,
  Linking,
  ViewStyle,
  TextStyle,
  Pressable,
  ScrollView,
} from 'react-native';
import {LogsContext} from './contexts/logs';
import Strings from 'strings';
import BottomPopup from 'components/bottomPopup';
import {CircleSnail} from 'react-native-progress';
import {Literal, StyleDefinition} from 'types';
import {acquireCamera} from './tools/Torch';
import {palette} from './theme/palette';

export default function FileUpload() {
  const {colors, dark} = useTheme();
  const appearance = palette(dark);
  const [client] = useIoTCentralClient();
  const [simulated] = useSimulation();
  const {append} = useContext(LogsContext);
  const [uploading, setUploading] = useBoolean(false);
  const [showSelector, setShowSelector] = useBoolean(false);
  const [uploadStatus, setuploadStatus] = useState<boolean | undefined>(
    undefined,
  );

  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const styles = useMemo<Literal<ViewStyle | TextStyle>>(
    () => ({
      flex1: {flex: 1, backgroundColor: appearance.background},
      content: {flexGrow: 1, justifyContent: 'center', padding: 20, gap: 20},
      container: {
        maxWidth: 560,
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: 4,
      },
      simulatedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 30,
      },
      centerText: {
        textAlign: 'center',
      },
      listItem: {
        backgroundColor: colors.card,
      },
      listItemText: {
        color: colors.text,
      },
      closeItemText: {
        color: 'gray',
      },
      card: {
        minHeight: 260,
        width: '100%',
        maxWidth: 560,
        alignSelf: 'center',
        padding: 28,
        borderRadius: 24,
        backgroundColor: appearance.tints[0],
      },
    }),
    [colors, appearance],
  );

  const startUpload = useCallback(
    async (source: 'camera' | 'library') => {
      if (busy.current) {
        return;
      }
      busy.current = true;
      setShowSelector.False();
      let release: (() => void) | undefined;
      try {
        if (!client || simulated) {
          Alert.alert(Strings.FileUpload.NotAvailable);
          return;
        }
        if (source === 'camera') {
          release = acquireCamera('photo');
          let permission = await ImagePicker.getCameraPermissionsAsync();
          if (!permission.granted && permission.canAskAgain) {
            permission = await ImagePicker.requestCameraPermissionsAsync();
          }
          if (!permission.granted) {
            Alert.alert(
              Strings.FileUpload.NotAvailable,
              'Allow camera access in Settings to take a photo.',
            );
            return;
          }
        }
        if (!mounted.current) {
          return;
        }
        // The system photo picker grants access only to the selected image;
        // no broad photo-library permission is necessary.
        const response = await (source === 'camera'
          ? ImagePicker.launchCameraAsync
          : ImagePicker.launchImageLibraryAsync)({
          mediaTypes: ['images'],
          base64: true,
          quality: 0.9,
        });
        release?.();
        release = undefined;
        if (response.canceled || !mounted.current) {
          return;
        }
        const asset = response.assets[0];
        if (!asset?.base64) {
          throw new Error('Selected image has no data');
        }
        // Expo's base64 representation is JPEG even when the original asset
        // was HEIC/PNG. Match both the MIME type and upload filename to it.
        const name =
          (asset.fileName || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
        setFileName(name);
        setFileSize(formatBytes(Math.floor((asset.base64.length * 3) / 4)));
        setuploadStatus(undefined);
        setUploading.True();
        append({eventName: 'FILE UPLOAD', eventData: 'Starting image upload'});
        const result = await client.uploadFile(
          name,
          'image/jpeg',
          asset.base64,
          'base64',
        );
        const succeeded =
          !!result && result.status >= 200 && result.status < 300;
        append({
          eventName: 'FILE UPLOAD',
          eventData: succeeded
            ? 'Image upload completed'
            : 'Image upload failed',
        });
        if (mounted.current) {
          setuploadStatus(succeeded);
        }
      } catch {
        append({
          eventName: 'FILE UPLOAD',
          eventData: 'Image selection or upload failed',
        });
        if (mounted.current) {
          setuploadStatus(false);
          Alert.alert(
            Strings.FileUpload.NotAvailable,
            'Unable to select or upload the image. Please retry.',
          );
        }
      } finally {
        release?.();
        busy.current = false;
      }
    },
    [setShowSelector, setUploading, append, client, simulated],
  );

  if (simulated) {
    return (
      <View style={styles.simulatedContainer}>
        <Headline style={styles.centerText}>
          {Strings.Simulation.Enabled}
        </Headline>
        <Text style={styles.centerText}>
          {' '}
          {Strings.FileUpload.NotAvailable} {Strings.Simulation.Disable}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.flex1}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          testID="image-upload-card"
          accessibilityRole="button"
          accessibilityLabel={Strings.FileUpload.Start}
          accessibilityState={{disabled: uploading, busy: uploading}}
          disabled={uploading}
          style={styles.card}
          onPress={setShowSelector.True}>
          {uploading ? (
            <UploadProgress
              fileSize={fileSize}
              filename={fileName}
              uploadStatus={uploadStatus}
              setUploading={setUploading}
            />
          ) : (
            <UploadIcon />
          )}
        </Pressable>

        <View style={styles.container}>
          <Text>
            {Strings.FileUpload.Footer}
            <Link
              onPress={() => Linking.openURL(Strings.FileUpload.LearnMore.Url)}>
              {Strings.FileUpload.LearnMore.Title}
            </Link>
          </Text>
        </View>
      </ScrollView>
      <BottomPopup
        isVisible={showSelector}
        onDismiss={() => setShowSelector.False()}>
        <ListItem
          onPress={() => {
            void startUpload('library');
          }}
          containerStyle={styles.listItem}>
          <ListItem.Content>
            <ListItem.Title style={styles.listItemText}>
              {Strings.FileUpload.Modes.Library}
            </ListItem.Title>
          </ListItem.Content>
        </ListItem>
        <ListItem
          onPress={() => {
            void startUpload('camera');
          }}
          containerStyle={styles.listItem}>
          <ListItem.Content>
            <ListItem.Title style={styles.listItemText}>
              {Strings.FileUpload.Modes.Camera}
            </ListItem.Title>
          </ListItem.Content>
        </ListItem>
      </BottomPopup>
    </View>
  );
}

function UploadIcon() {
  const {dark} = useTheme();
  const appearance = palette(dark);

  const styles: Literal<ViewStyle | TextStyle> = {
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
    },
    wrapper: {
      padding: 18,
      borderRadius: 24,
      backgroundColor: appearance.surface,
    },
    startContainer: {alignItems: 'center', gap: 8},
    title: {fontSize: 22, lineHeight: 29, textAlign: 'center'},
    start: {
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      color: appearance.muted,
    },
  };
  return (
    <View style={styles.container}>
      <View style={styles.wrapper}>
        <Icon
          size={48}
          name="cloud-upload-outline"
          type={Platform.select({
            ios: 'ionicon',
            android: 'material-community',
          })}
          color={appearance.primary}
        />
      </View>
      <View style={styles.startContainer}>
        <Headline style={styles.title}>{Strings.FileUpload.Title}</Headline>
        <Text style={styles.start}>{Strings.FileUpload.Description}</Text>
      </View>
    </View>
  );
}

function UploadProgress(props: {
  filename: string;
  fileSize: string;
  uploadStatus: boolean | undefined;
  setUploading: ISetBooleanFunctions;
}) {
  const {dark} = useTheme();
  const appearance = palette(dark);
  const {uploadStatus, filename, fileSize, setUploading} = props;
  const [showResult, setShowResult] = useState(false);

  const style = useMemo<StyleDefinition>(
    () => ({
      spinner: {
        justifyContent: 'center',
      },
      details: {
        alignItems: 'center',
        gap: 8,
      },
      cancel: {
        color: 'red',
      },
      spinnerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24,
      },
      container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
      },
    }),
    [],
  );

  useEffect(() => {
    if (uploadStatus !== undefined) {
      setShowResult(true);
      // wait before go back to standard screen
      const timeout = setTimeout(() => {
        setUploading.False();
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [uploadStatus, setUploading]);

  if (uploadStatus !== undefined && showResult) {
    return (
      <View style={style.container}>
        <Icon
          size={72}
          color={uploadStatus ? appearance.positive : appearance.danger}
          name={
            Platform.select({
              ios: uploadStatus
                ? 'checkmark-circle-outline'
                : 'close-circle-outline',
              android: uploadStatus
                ? 'check-circle-outline'
                : 'close-circle-outline',
            }) as string
          }
          type={Platform.select({
            ios: 'ionicon',
            android: 'material-community',
          })}
        />
        <Text>
          {uploadStatus
            ? `Successfully uploaded ${filename}`
            : `Failed to upload ${filename}`}
        </Text>
      </View>
    );
  }

  return (
    <View style={style.spinnerContainer}>
      <View style={style.spinner}>
        <CircleSnail
          size={72}
          indeterminate={true}
          thickness={3}
          color={appearance.primary}
          spinDuration={1000}
          duration={1000}
        />
      </View>
      <View style={style.details}>
        <Text selectable style={{textAlign: 'center'}}>
          {filename}
        </Text>
        <Text style={{color: appearance.muted}}>{fileSize}</Text>
      </View>
    </View>
  );
}

function formatBytes(a: number, b = 2) {
  if (a === 0) {
    return '0 Bytes';
  }
  const c = b < 0 ? 0 : b;
  const d = Math.floor(Math.log(a) / Math.log(1024));
  return (
    parseFloat((a / Math.pow(1024, d)).toFixed(c)) +
    ' ' +
    ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'][d]
  );
}
