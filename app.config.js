const isCI =
  process.env.PAAD_VARIANT === 'ci' ||
  ['true', '1'].includes(process.env.CI) ||
  process.env.GITHUB_ACTIONS === 'true';
const locationPermission =
  'Your location will be sent to your Azure IoT application, to be shown on a map. Microsoft does not collect or have access to your location.';
const cameraPermission =
  '"IoT Plug and Play" needs access to your camera for scanning QR codes and connecting devices.';

module.exports = ({config}) => ({
  ...config,
  scheme: isCI ? 'iot-pnp-ci' : 'iot-pnp',
  ios: {
    ...config.ios,
    bundleIdentifier: isCI ? 'com.microsoft.iotpnp.ci' : 'com.microsoft.iotpnp',
    associatedDomains: isCI ? [] : ['applinks:apps.azureiotcentral.com'],
    entitlements: isCI
      ? {
          'application-identifier': 'com.microsoft.iotpnp.ci',
          'keychain-access-groups': ['com.microsoft.iotpnp.ci'],
        }
      : {},
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription: locationPermission,
    },
  },
  android: {
    ...config.android,
    package: isCI ? 'com.iot_pnp.ci' : 'com.iot_pnp',
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_MEDIA_AUDIO',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    intentFilters: isCI
      ? []
      : [
          {
            action: 'VIEW',
            autoVerify: true,
            category: ['BROWSABLE', 'DEFAULT'],
            data: {
              scheme: 'https',
              host: 'apps.azureiotcentral.com',
              path: '/phone-as-device-app-store',
            },
          },
        ],
  },
  plugins: [
    ['expo-dev-client', {launchMode: 'most-recent'}],
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 24,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          buildToolsVersion: '36.0.0',
        },
        ios: {deploymentTarget: '16.4'},
      },
    ],
    [
      'expo-camera',
      {cameraPermission, microphonePermission: false, recordAudioAndroid: false},
    ],
    [
      'expo-image-picker',
      {
        cameraPermission,
        photosPermission:
          '"IoT Plug and Play" wants to access your gallery to upload pictures to Azure IoT.',
        microphonePermission: false,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: locationPermission,
        locationAlwaysPermission: false,
        locationAlwaysAndWhenInUsePermission: false,
      },
    ],
    [
      'expo-sensors',
      {
        motionPermission:
          'Gyroscope and accelerometer data can be sent to your Azure IoT application.',
      },
    ],
    [
      'react-native-ble-plx',
      {
        isBackgroundEnabled: false,
        neverForLocation: true,
        bluetoothAlwaysPermission:
          '"IoT Plug and Play" wants to access Bluetooth to collect data from external sensors.',
      },
    ],
    [
      'react-native-permissions',
      {iosPermissions: ['Bluetooth', 'Camera', 'LocationWhenInUse', 'PhotoLibrary']},
    ],
    [
      'expo-font',
      {
        fonts: [
          './node_modules/react-native-vector-icons/Fonts/FontAwesome.ttf',
          './node_modules/react-native-vector-icons/Fonts/Ionicons.ttf',
          './node_modules/react-native-vector-icons/Fonts/MaterialIcons.ttf',
          './node_modules/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf',
        ],
      },
    ],
    ['./app.plugin.js', {isCI}],
  ],
});
