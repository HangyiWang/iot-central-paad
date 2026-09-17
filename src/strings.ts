// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const Strings = {
  Title: 'IoT Plug and Play',
  Core: {
    Back: 'Back',
    Retry: 'Retry',
    Close: 'Close',
    Cancel: 'Cancel',
    Loading: 'Loading...',
    DisableSensor: 'Disable sensor',
    EnableSensor: 'Enable sensor',
    HideCredential: 'Hide credential',
    ShowCredential: 'Show credential',
  },
  Startup: {
    Failed:
      'Could not initialize the app. Your saved data has not been reset. Please retry.',
    ErrorCode: 'Error code: {{0}}',
  },
  Map: {
    CurrentLocation: 'Current location',
    NotConfigured:
      'Map preview is not configured in this Android build. Location coordinates remain available.',
  },
  Connection: {
    Summary: {
      Title: 'Cloud connection',
      OpenDetails: 'Details',
      Connected: 'Connected',
      Disconnected: 'Disconnected',
      Simulated: 'Offline simulation — no cloud connection',
      Device: 'Assigned device',
      Hub: 'Assigned Hub',
      Disconnect: 'Disconnect',
      Reconnect: 'Reconnect',
      Manual: 'Connect manually',
      Details: 'Connection details',
      Forget: 'Forget credentials',
      ForgetTitle: 'Forget saved device credentials?',
      ForgetMessage:
        'Disconnect and remove credentials from this phone only. No Azure device, enrollment or registry record will be deleted.',
      Model: 'Model',
      Registration: 'Registration ID',
      Operation: 'Operation ID',
      Stage: 'Connection stage',
      Registry: 'Registry status',
      NotChecked: 'Not checked',
      RegistryExplanation:
        'An authorized operator must independently check Azure Device Registry and the matching device activity. DPS assignment and Hub connection do not confirm a registry record. Namespace links are configured server-side.',
      Share: 'Share nonsecret diagnostics',
      ShareFailed:
        'Diagnostics could not be shared. You can select the values instead.',
      ProofTitle: 'Device activity proof',
      ProofNonce: 'Proof nonce',
      ProofSend: 'Submit proof activity',
      ProofSending: 'Submitting…',
      ProofSubmitted: 'Submitted locally',
      ProofInvalid: 'Use 16–128 letters, numbers, underscores or hyphens.',
      ProofUnavailable:
        'Connect a real device to submit proof. Offline simulation cannot provide cloud proof.',
      ProofFailed:
        'Proof was not fully submitted. Retry with a new nonce if needed.',
      ProofExplanation:
        'Sends telemetry and a reported property through the connected client. Local submission is not a broker acknowledgement, downstream receipt or registry confirmation.',
    },
    Stages: {
      idle: 'Not connected',
      validating: 'Checking connection details...',
      provisioning: 'Requesting a device assignment...',
      connecting: 'Connecting to the assigned IoT Hub...',
      connected: 'Connected',
      error: 'Connection needs attention',
    },
  },
  Settings: {
    Title: 'Settings',
    Theme: {
      Title: 'Theme',
      Dark: {
        Name: 'Dark',
        Detail: 'Always use dark theme',
      },
      Light: {
        Name: 'Light',
        Detail: 'Always use light theme',
      },
      Device: {
        Name: 'Your device',
        Detail: "Use system's setting",
      },
    },
    DeliveryInterval: {
      Title: 'Delivery interval',
      2: '2 seconds',
      5: '5 seconds (default)',
      10: '10 seconds',
      30: '30 seconds',
      45: '45 seconds',
    },
    Clear: {
      Title: 'Clear Data',
      Alert: {
        Title: 'Do you really want to clear all data?',
        Text: 'Proceeding will clear all stored device credentials and user preferences like theme mode and telemetry delivery interval.',
      },
      Success: {
        Title: 'Success',
        Text: 'Saved credentials and local settings were cleared. Azure devices were not deleted.',
      },
    },
  },
  Registration: {
    Header: {
      Welcome: 'Welcome! ',
      Text: 'Connect your phone to the Azure IoT cloud and experience the simplicity of IoT Plug and Play in just a few steps.',
    },
    Footer: 'Need help getting started? ',
    StartHere: {
      Title: 'Start here',
      Url: 'https://aka.ms/iot-paad-getstarted',
    },
    QRCode: {
      Manually: 'Connect manually',
      Scan: 'Scan QR code',
    },
    Manual: {
      Title: 'Manually connect',
      Header: 'Use the individual device key supplied by your operator.',
      ChangeMethod: 'Change connection method',
      DeviceId: {
        Label: 'Registration ID',
        PlaceHolder: 'Enter your enrollment registration ID',
      },
      ScopeId: {
        Label: 'ID scope',
        PlaceHolder: 'Enter your DPS ID scope',
      },
      SASKey: {
        Label: 'Device key',
        PlaceHolder: 'Enter or paste your individual device key',
      },
      ProvisioningHost: 'Provisioning hostname',
      LegacyWarning:
        'Legacy compatibility only. A group key can derive credentials for other devices. Prefer an individual device key.',
      ConnectionStringPlaceholder: 'Enter or paste device connection string',
      Registered: 'Registered using:',
      RegisterNew: {
        Title: 'Register as a new device',
        Alert: {
          Title: 'Register as new device?',
          Text: "Once you register as a new device, your old connection will be disconnected and you'll be able to connect as a new device. Current device credentials will not be cleared until the new device actually connects. Data previously sent will remain in the cloud until you delete it.",
        },
      },
      Clear: {
        Title: 'Clear registration',
        Alert: {
          Title: 'Clear device registration info?',
          Text: 'Are you sure to clear registration info? If proceed, device will disconnect and credentials will be wiped out. This means you need to register as a new device next time.',
        },
      },
      Footer: {
        Connect: 'Connect',
      },
      StartHere: {
        Title: 'Start here',
        Url: 'https://aka.ms/iot-paad-connect',
      },
      Body: {
        ConnectionType: {
          Title: 'How would you like to connect?',
          Dps: 'DPS individual enrollment',
          CString: 'IoT Hub device connection string',
        },
        ConnectionInfo: 'Connection info',
      },
      KeyTypes: {
        Label: 'Authentication',
        Group: 'LEGACY group key',
        Device: 'Device key',
      },
    },
    Connection: {
      Loading: 'Connecting to Azure IoT...',
      Cancel: 'Cancel',
    },
  },
  Client: {
    Properties: {
      Send: 'Send',
      Delivery: {
        Simulated:
          'Property "{{0}}" was simulated locally. Nothing was sent to the cloud.',
        Success:
          'Property "{{0}}" was submitted to the device transport. Cloud receipt has not been independently checked.',
        Failure: 'Failed to send property "{{0}}" to Azure IoT.',
      },
      Loading: 'Waiting for properties...',
    },
    Commands: {
      Alert: {
        Title: 'Command received',
        Message:
          'The device received command "{{0}}" from Azure IoT. Starting execution now.',
      },
    },
  },
  FileUpload: {
    Title: 'Upload a photo',
    Description: 'Choose an image from your library or take a photo.',
    Start: 'Select an image to upload to Azure Storage',
    Footer:
      "You'll need to configure file upload in your IoT solution before using this feature. ",
    LearnMore: {
      Title: 'Learn more',
      Url: 'https://aka.ms/iot-paad-fileupload',
    },
    NotAvailable: 'File upload is not available.',
    Modes: {
      Library: 'Take from image gallery',
      Camera: 'Capture photo with camera',
    },
  },
  LogScreen: {
    Title: 'Activity log',
    Header: 'Connection, uploads and device events, in one place.',
    All: 'All events',
    Issues: 'Warnings & errors',
    Count: '{{0}} events',
    Latest: 'Jump to latest',
    Empty: 'No activity yet',
    EmptyDetail: 'Events will appear here as you use your device.',
    NoIssues: 'No warning or error events',
    NoIssuesDetail: 'Choose All events to see the rest of this session.',
    Details: 'View details',
    HideDetails: 'Hide details',
    Levels: {info: 'Info', warning: 'Warning', error: 'Error'},
  },
  Bluetooth: {
    Title: 'Nearby devices',
    Description: 'Discover Bluetooth devices around your phone.',
    Refresh: 'Scan again',
    Scanning: 'Looking for devices',
    ScanningDetail: 'Keep a supported Bluetooth device nearby and powered on.',
    Unavailable: 'Bluetooth unavailable',
    UnavailableDetail:
      'Enable Bluetooth and allow Nearby Devices access in Settings.',
    SignalUnavailable: 'Signal unavailable',
  },
  Simulation: {
    Enabled: 'Simulation mode is enabled.',
    Disable:
      'Disable simulation mode and connect to Azure IoT to work with file uploads.',
  },
  Sensors: {
    Unavailable: 'Unavailable — check hardware and permissions',
    Checking: 'Waiting for sensor',
    Simulated: 'Simulated data',
    Disabled: 'Disabled',
    Retry: 'Retry sensor',
  },
  Update: {
    Mandatory: {
      Title: 'Update Required',
      Text: 'An update to {{0}} is required to continue',
      Confirm: 'Update',
    },
    Optional: {
      Title: 'Update Available',
      Text: 'An update to {{0}} is available. Would you like to update?',
      Confirm: 'Update',
      Cancel: 'Not now',
      Skip: 'Skip this version',
    },
  },
};

export function resolveString(data: string, ...values: string[]) {
  values.forEach(val => (data = data.replace(/\{\{[\S]\}\}/, val)));
  return data;
}

export default Strings;
