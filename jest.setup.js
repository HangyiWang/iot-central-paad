const {NativeModules} = require('react-native');

// The chart imports WebView, whose TurboModule is absent in the JS runner.
NativeModules.RNCWebViewModule = {
  isFileUploadSupported: jest.fn(async () => false),
  shouldStartLoadWithLockIdentifier: jest.fn(),
};

// Keep the sensor observables real, but never start hardware in the JS runner.
for (const sensor of [
  'Accelerometer',
  'Gyroscope',
  'Magnetometer',
  'Barometer',
  'Orientation',
  'Gravity',
]) {
  NativeModules[`RNSensors${sensor}`] = {
    setUpdateInterval: jest.fn(),
    setLogLevel: jest.fn(),
    isAvailable: jest.fn(async () => true),
    startUpdates: jest.fn(),
    stopUpdates: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  };
}

// Use upstream mocks for native layout, device metadata, and gestures (in config).
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native-device-info', () =>
  require('react-native-device-info/jest/react-native-device-info-mock'),
);

// Only the camera surface is replaced; the QR scanner and screen stay real.
jest.mock('react-native-camera', () => {
  const React = require('react');
  const {View} = require('react-native');
  const RNCamera = React.forwardRef((props, ref) =>
    React.createElement(View, {...props, ref}),
  );
  RNCamera.Constants = {
    FlashMode: {torch: 'torch', on: 'on', off: 'off', auto: 'auto'},
    Type: {back: 'back', front: 'front'},
  };
  return {RNCamera};
});

// GPS is imported with the sensor registry but is not used during registration.
jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
}));

// A fresh install has no secure-storage entry. Never read the host's keychain.
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
}));

// App-store checks are the only expected startup network operation.
jest.mock('react-native-version-check', () => ({
  needUpdate: jest.fn(async () => ({isNeeded: false})),
}));

// Fail closed if startup ever tries HTTP or MQTT outside the update-check stub.
// Assertions also catch attempts swallowed by application error handling.
for (const transport of ['fetch', 'XMLHttpRequest', 'WebSocket']) {
  global[transport] = jest.fn(() => {
    throw new Error(`Unexpected ${transport} call in an offline startup test`);
  });
}
