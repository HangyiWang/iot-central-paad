module.exports = {
  preset: 'react-native',
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // These RN libraries (and uuid's browser entry) ship uncompiled ESM/Flow/TS.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(?:-[^/]+)?|@react-native(?:-community)?|@react-navigation|@rneui|uuid)/)',
  ],
  moduleNameMapper: {
    '\\.svg$': '<rootDir>/test-support/svgMock.js',
    // QR scanning has its own permissions version; both use the native test stub.
    '^react-native-permissions$':
      '<rootDir>/node_modules/react-native-permissions/mock.js',
  },
};
