import React from 'react';
import renderer, {act} from 'react-test-renderer';
import * as Keychain from 'react-native-keychain';
import WorkflowHome from '../src/experience/WorkflowHome';
import {projectSetup} from '../src/experience/setupProjection';
import {ExperienceStrings} from '../src/experience/strings';
import {IoTCContext} from '../src/contexts/iotc';
import {StorageContext} from '../src/contexts/storage';
import {ConnectionError} from '../src/connection/errors';
import {PHONE_MODEL_ID} from '../src/connection/types';
import {parseAzureContext} from '../src/onboarding/azureContext';
import {useTheme} from '../src/hooks';
import {palette} from '../src/theme/palette';

const Native = require('react-native');

jest.mock('../src/hooks', () => ({
  useTheme: jest.fn(() => ({dark: false})),
  useSensors: jest.fn(() => {
    throw new Error('Home must not own sensors');
  }),
  useProperties: jest.fn(() => {
    throw new Error('Home must not own properties');
  }),
  useConnectIoTCentralClient: jest.fn(() => {
    throw new Error('Home must not own the connection');
  }),
}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));
jest.mock('@rneui/themed', () => ({Icon: 'Icon'}));
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Path: 'Path',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 24, bottom: 16, left: 0, right: 0}),
}));

jest.mock('@react-navigation/native', () => ({useIsFocused: () => true}));

const text = ExperienceStrings.Home;
const key = Buffer.alloc(32, 7).toString('base64');
const groupKey = Buffer.alloc(32, 9).toString('base64');
const identity = {
  deviceId: 'Assigned-Phone-42',
  registrationId: 'registration-phone',
  assignedHub: 'assigned-hub.device.azure-devices.net',
  modelId: PHONE_MODEL_ID,
};
const credentials = {
  registrationId: identity.registrationId,
  scopeId: '0ne12345678',
  deviceKey: key,
  provisioningHost: 'global-canary.azure-devices-provisioning.net',
  keyType: 'device',
};
const snapshot = () => {
  const subscription = '11111111-2222-4333-8444-555555555555';
  const scope = `/subscriptions/${subscription}/resourceGroups/home-rg`;
  const namespace = `${scope}/providers/Microsoft.DeviceRegistry/namespaces/home-namespace`;
  return parseAzureContext(
    JSON.stringify({
      schema: 'paad.azure-context',
      version: 1,
      capturedAt: '2026-09-17T19:00:00.000Z',
      binding: {
        assignedHub: identity.assignedHub,
        deviceId: identity.deviceId,
        registrationId: identity.registrationId,
      },
      subscription: {id: subscription, name: 'Home fixture'},
      resourceGroup: {name: 'home-rg'},
      namespace: {
        name: 'home-namespace',
        resourceId: namespace,
        location: 'testregion',
      },
      hub: {
        name: 'assigned-hub',
        resourceId: `${scope}/providers/Microsoft.Devices/IotHubs/assigned-hub`,
      },
      registryDevice: {
        name: 'historical-phone',
        resourceId: `${namespace}/registryDevices/historical-phone`,
        externalDeviceId: identity.deviceId,
      },
      activities: [],
    }),
  );
};
const sensor = overrides => ({
  id: 'accelerometer',
  name: 'Accelerometer',
  enabled: true,
  simulated: false,
  availability: 'available',
  enable: jest.fn(),
  sendInterval: jest.fn(),
  ...overrides,
});
let tree;
let storage;
let connection;
let props;
let dimensions;
let focusSpy;
const originalOS = Native.Platform.OS;
const content = () => JSON.stringify(tree.toJSON());
const control = id => tree.root.findAllByProps({testID: id})[0];
const press = id => act(() => control(id).props.onPress());
const render = () => {
  const element = (
    <StorageContext.Provider value={storage}>
      <IoTCContext.Provider value={connection}>
        <WorkflowHome {...props} />
      </IoTCContext.Provider>
    </StorageContext.Provider>
  );
  act(() => {
    if (tree) tree.update(element);
    else
      tree = renderer.create(element, {
        createNodeMock: elementNode => ({
          nativeID: elementNode.props.testID,
        }),
      });
  });
};
const dismiss = () => {
  press('home-panel-close');
  act(() => {
    tree.root.findByType(Native.Modal).props.onDismiss();
    jest.runOnlyPendingTimers();
  });
};

test.each([1, 1.8])(
  'centers every map label without truncating at font scale %s',
  fontScale => {
    dimensions = {...dimensions, fontScale};
    render();
    for (const name of ['adr', 'dps', 'hub', 'phone']) {
      const button = control(`home-node-${name}`);
      expect(
        Native.StyleSheet.flatten(button.props.style({pressed: false})),
      ).toMatchObject({
        minHeight: 60,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      });
      for (const label of button.findAllByType('Text')) {
        expect(Native.StyleSheet.flatten(label.props.style).textAlign).toBe(
          'center',
        );
        expect(label.props.numberOfLines).toBeUndefined();
        expect(label.props.allowFontScaling).not.toBe(false);
      }
    }
    expect(content()).toContain('Latest observations');
  },
);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  Native.Platform.OS = 'ios';
  dimensions = {width: 390, height: 844, scale: 1, fontScale: 1};
  jest
    .spyOn(Native, 'useWindowDimensions')
    .mockImplementation(() => dimensions);
  jest.spyOn(Native, 'findNodeHandle').mockImplementation(target => {
    const id = target.nativeID ?? target.props?.testID;
    if (id === 'home-panel-close') return 101;
    if (id?.startsWith('home-node-')) return 102;
    throw new Error('Unexpected native focus target');
  });
  focusSpy = jest
    .spyOn(Native.AccessibilityInfo, 'setAccessibilityFocus')
    .mockImplementation(() => {});
  useTheme.mockReturnValue({dark: false});
  storage = {
    credentials,
    simulated: false,
    azureContext: null,
    azureContextError: false,
    initialized: true,
    save: jest.fn(),
    read: jest.fn(),
    clear: jest.fn(),
  };
  connection = {
    client: {
      identity,
      isConnected: jest.fn(() => true),
      connect: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn(),
      fetchTwin: jest.fn(),
    },
    error: null,
    connecting: false,
    stage: 'connected',
  };
  props = {
    sensors: [],
    onDetails: jest.fn(),
    onTelemetry: jest.fn(),
    onActivity: jest.fn(),
  };
});
afterEach(() => {
  if (tree) act(() => tree.unmount());
  tree = undefined;
  expect(storage.save).not.toHaveBeenCalled();
  expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
  expect(global.XMLHttpRequest).not.toHaveBeenCalled();
  expect(global.WebSocket).not.toHaveBeenCalled();
  jest.restoreAllMocks();
  Native.Platform.OS = originalOS;
  jest.useRealTimers();
});

test('renders the approved native topology and opens each of the four scrollable panels', () => {
  render();
  expect(tree.root.findByType(Native.Modal).props.allowSwipeDismissal).toBe(
    true,
  );
  expect(control('home-map')).toBeDefined();
  expect(control('home-map-compact')).toBeDefined();
  expect(control('home-map-phone-dps-path')).toBeDefined();
  expect(control('home-map-phone-hub-path')).toBeDefined();
  const paths = tree.root.findAllByType('Path');
  expect(paths.some(path => path.props.strokeDasharray)).toBe(true);
  for (const node of ['adr', 'dps', 'hub', 'phone']) {
    press(`home-node-${node}`);
    expect(control(`home-panel-${node}`).props.accessibilityViewIsModal).toBe(
      true,
    );
    expect(control('home-panel-close').props.accessibilityRole).toBe('button');
    expect(
      control('workflow-home-content').props.importantForAccessibility,
    ).toBe('no-hide-descendants');
    expect(
      control('workflow-home-content').props.accessibilityElementsHidden,
    ).toBe(true);
    expect(
      tree.root.findAllByType(Native.ScrollView).length,
    ).toBeGreaterThanOrEqual(2);
    dismiss();
  }
  expect(control('workflow-home-content').props.importantForAccessibility).toBe(
    'auto',
  );
  expect(connection.client.connect).not.toHaveBeenCalled();
  expect(connection.client.on).not.toHaveBeenCalled();
  expect(connection.client.fetchTwin).not.toHaveBeenCalled();
});

test('labels a DPS assignment from the actual setup mode even when optional registration metadata is absent', () => {
  const assigned = {...identity, registrationId: undefined};
  expect(projectSetup(credentials, assigned, false).assignment.source).toBe(
    'dps',
  );
});

test.each([320, 360, 440])(
  'aligns namespace and phone paths with native service centers at map width %i',
  measuredWidth => {
    dimensions.width = measuredWidth + 62;
    render();
    act(() => {
      control('home-map-compact').props.onLayout({
        nativeEvent: {layout: {width: measuredWidth}},
      });
    });
    const azure = Native.StyleSheet.flatten(
      control('home-map-azure').props.style,
    );
    const services = Native.StyleSheet.flatten(
      control('home-map-services').props.style,
    );
    const phone = Native.StyleSheet.flatten(
      control('home-map-phone').props.style,
    );
    const inset = azure.padding + azure.borderWidth;
    const serviceWidth = measuredWidth - 2 * inset;
    const serviceNodeWidth = (serviceWidth - services.gap) / 2;
    const phoneWidth = (measuredWidth * parseFloat(phone.width)) / 100;
    const coordinates = id =>
      control(id)
        .props.d.match(/-?\d+(?:\.\d+)?/g)
        .map(Number);
    const namespace = coordinates('home-map-namespace-path');
    const dps = coordinates('home-map-phone-dps-path');
    const hub = coordinates('home-map-phone-hub-path');
    expect(control('home-map-namespace-lines').props.viewBox).toBe(
      `0 0 ${serviceWidth} 24`,
    );
    expect(control('home-map-phone-lines').props.viewBox).toBe(
      `0 0 ${measuredWidth} 28`,
    );
    expect(namespace[0]).toBeCloseTo(serviceWidth / 2);
    expect(namespace[3]).toBeCloseTo(serviceNodeWidth / 2);
    expect(namespace[6]).toBeCloseTo(serviceWidth - serviceNodeWidth / 2);
    expect(namespace[3] + inset).toBeCloseTo(dps[0]);
    expect(namespace[6] + inset).toBeCloseTo(hub[0]);
    expect(dps[3]).toBeCloseTo(measuredWidth / 2 - phoneWidth / 4);
    expect(hub[3]).toBeCloseTo(measuredWidth / 2 + phoneWidth / 4);
    expect(dps[0]).toBeLessThan(dps[3]);
    expect(hub[0]).toBeGreaterThan(hub[3]);
  },
);

test('uses actual map width for the direct-Hub compact threshold and rotation', () => {
  storage.credentials = {
    connectionString: `HostName=direct.azure-devices.net;DeviceId=phone;SharedAccessKey=${key}`,
  };
  dimensions.width = 768;
  render();
  act(() => {
    control('home-map-compact').props.onLayout({
      nativeEvent: {layout: {width: 319}},
    });
  });
  expect(control('home-map-stacked')).toBeDefined();
  act(() => {
    control('home-map-stacked').props.onLayout({
      nativeEvent: {layout: {width: 320}},
    });
  });
  expect(control('home-map-compact')).toBeDefined();
  expect(
    tree.root.findAllByProps({testID: 'home-map-phone-dps-path'}),
  ).toHaveLength(0);
  expect(content()).toContain(text.DpsNotUsed);
  dimensions.width = 360;
  render();
  act(() => {
    control('home-map-compact').props.onLayout({
      nativeEvent: {layout: {width: 298}},
    });
  });
  expect(control('home-map-stacked')).toBeDefined();
});

test.each([false, true])(
  'uses a non-destructive warm attention treatment in dark mode %s',
  dark => {
    useTheme.mockReturnValue({dark});
    props.sensors = [sensor({availability: 'unavailable'})];
    connection.error = new ConnectionError('CONNECTION_LOST');
    render();
    for (const id of ['home-attention-connection', 'home-attention-sensors']) {
      const row = control(id);
      const style = Native.StyleSheet.flatten(
        typeof row.props.style === 'function'
          ? row.props.style({pressed: false})
          : row.props.style,
      );
      expect(style.backgroundColor).toBe(palette(dark).tints[2]);
      expect(style.backgroundColor).not.toBe(palette(dark).dangerSurface);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(row.props.accessibilityRole).toBe('button');
      expect(
        row
          .findAllByType('Icon')
          .some(icon => icon.props.name === 'alert-outline'),
      ).toBe(true);
      press(id);
    }
    expect(props.onDetails).toHaveBeenCalledTimes(1);
    expect(props.onTelemetry).toHaveBeenCalledTimes(1);
  },
);

test.each([
  {width: 390, fontScale: 1, direction: 'row'},
  {width: 390, fontScale: 2, direction: 'column'},
  {width: 320, fontScale: 1, direction: 'column'},
])(
  'pins the panel heading, simulation and Close outside its scroll body (%#)',
  layout => {
    dimensions = {
      ...dimensions,
      width: layout.width,
      fontScale: layout.fontScale,
    };
    storage.simulated = true;
    render();
    for (const node of ['phone', 'dps', 'hub', 'adr']) {
      press(`home-node-${node}`);
      const header = control('home-panel-header');
      const body = control('home-panel-body');
      expect(Native.StyleSheet.flatten(header.props.style).flexDirection).toBe(
        layout.direction,
      );
      expect(
        header.findAllByProps({testID: 'home-panel-title'}).length,
      ).toBeGreaterThan(0);
      expect(
        header.findAllByProps({testID: 'home-panel-close'}).length,
      ).toBeGreaterThan(0);
      expect(
        header.findAllByProps({testID: 'home-panel-simulation'}).length,
      ).toBeGreaterThan(0);
      expect(control('home-panel-title').props.children).toBe(
        text.Nodes[node].Panel,
      );
      expect(body.findAllByProps({testID: 'home-panel-title'})).toHaveLength(0);
      expect(body.findAllByProps({testID: 'home-panel-close'})).toHaveLength(0);
      expect(control('home-panel-title').props.numberOfLines).toBeUndefined();
      dismiss();
    }
  },
);

test('shows exact provisioning host, distinct registration and assignment, preview Hub and declared model', () => {
  render();
  press('home-node-dps');
  expect(content()).toContain(credentials.provisioningHost);
  expect(content()).toContain(identity.registrationId);
  expect(content()).toContain(identity.deviceId);
  expect(content()).toContain(identity.assignedHub);
  expect(content()).toContain(text.Sources.Dps);
  expect(content()).toContain(text.Fields.IndividualKey);
  expect(content()).not.toContain(key);
  expect(content()).not.toContain(text.Fields.GroupKey);
  dismiss();
  press('home-node-phone');
  expect(content()).toContain(PHONE_MODEL_ID);
  expect(content()).toContain(text.ModelNote);
  expect(content()).toContain(text.Hidden);
  const endpoint = tree.root
    .findAllByType('Text')
    .find(node => node.props.children === credentials.provisioningHost);
  expect(endpoint.props.selectable).toBe(true);
});

test('labels legacy group credentials explicitly without exposing key material', () => {
  storage.credentials = {...credentials, keyType: 'group', authKey: groupKey};
  render();
  for (const node of ['phone', 'dps']) {
    press(`home-node-${node}`);
    expect(content()).toContain(text.Fields.GroupKey);
    expect(content()).toContain(text.GroupNote);
    expect(content()).not.toContain(groupKey);
    expect(content()).not.toContain(key);
    if (node === 'dps') expect(content()).toContain(text.GroupAuthentication);
    dismiss();
  }
});

test('projects only allowlisted direct-Hub identifiers and bypasses the DPS path', () => {
  const connectionString = `HostName=direct-hub.device.azure-devices.cn;DeviceId=Direct-Phone;SharedAccessKey=${key}`;
  storage.credentials = {connectionString};
  connection.client.identity = null;
  const projected = projectSetup(storage.credentials, null, false);
  expect(projected).toMatchObject({
    mode: 'hub',
    configuredHub: 'direct-hub.device.azure-devices.cn',
    configuredDeviceId: 'Direct-Phone',
    credentialKind: 'connectionString',
    credentialPresent: true,
  });
  expect(JSON.stringify(projected)).not.toContain(key);
  expect(JSON.stringify(projected)).not.toContain(connectionString);
  render();
  expect(
    tree.root.findAllByProps({testID: 'home-map-phone-dps-path'}),
  ).toHaveLength(0);
  for (const node of ['phone', 'hub']) {
    press(`home-node-${node}`);
    expect(content()).toContain('direct-hub.device.azure-devices.cn');
    expect(content()).toContain('Direct-Phone');
    expect(content()).toContain(text.Sources.Setup);
    expect(content()).not.toContain(key);
    expect(content()).not.toContain(connectionString);
    dismiss();
  }
  press('home-node-dps');
  expect(content()).toContain(text.DirectRole);
  expect(content()).not.toContain(text.Fields.AssignedHub);
});

test.each([
  `HostName=direct.azure-devices.net;DeviceId=phone;SharedAccessKey=${key};SharedAccessKeyName=owner`,
  'HostName=direct.azure-devices.net;DeviceId=phone;SharedAccessSignature=SECRET_CANARY',
  `HostName=direct.azure-devices.net;DeviceId=SECRET_CANARY?sig=hidden;SharedAccessKey=${key}`,
  `HostName=https://SECRET_CANARY/?sig=hidden;DeviceId=phone;SharedAccessKey=${key}`,
])(
  'surfaces unsafe direct setup without leaking raw credentials (%#)',
  connectionString => {
    storage.credentials = {connectionString};
    connection.client.identity = null;
    const projection = projectSetup(storage.credentials, null, false);
    expect(projection.invalidSetup).toBe(true);
    expect(projection.configuredHub).toBeUndefined();
    expect(projection.configuredDeviceId).toBeUndefined();
    render();
    press('home-node-phone');
    expect(content()).toContain(text.InvalidSetup);
    expect(content()).not.toContain(key);
    expect(content()).not.toContain('SECRET_CANARY');
  },
);

test('shows matching snapshot only as historical context, never as current Azure health', () => {
  storage.azureContext = snapshot();
  render();
  press('home-node-adr');
  expect(content()).toContain('home-namespace');
  expect(content()).toContain('historical-phone');
  expect(content()).toContain('2026-09-17T19:00:00.000Z');
  expect(content()).toContain(text.Sources.Snapshot);
  expect(content()).toContain(text.SnapshotNote);
  expect(content()).toContain(text.NotChecked);
  expect(content()).toContain(text.RegistryNote);
  expect(tree.root.findAllByProps({testID: 'home-attention'})).toHaveLength(0);
  connection.client.identity = {...identity, deviceId: 'different-phone'};
  render();
  expect(content()).not.toContain('home-namespace');
  expect(content()).not.toContain('historical-phone');
  expect(content()).toContain(text.SnapshotOtherDevice);
});

test('absent or unreadable ADR context is neutral, with no attention or invented state', () => {
  render();
  press('home-node-adr');
  expect(content()).toContain(text.NoSnapshot);
  expect(content()).toContain(text.NotChecked);
  storage.azureContextError = true;
  render();
  expect(content()).toContain(text.SnapshotUnavailable);
  expect(tree.root.findAllByProps({testID: 'home-attention'})).toHaveLength(0);
});

test('uses only explicit connection errors and enabled-unavailable sensors for attention', () => {
  props.sensors = [
    sensor({availability: 'checking'}),
    sensor({enabled: false, availability: 'unavailable'}),
    sensor({availability: 'available', value: undefined}),
  ];
  connection.client.isConnected.mockReturnValue(false);
  connection.stage = 'error';
  render();
  expect(tree.root.findAllByProps({testID: 'home-attention'})).toHaveLength(0);
  connection.error = new ConnectionError('CONNECTION_LOST');
  props.sensors.push(sensor({availability: 'unavailable'}));
  render();
  const attention = control('home-attention');
  const actions = attention.findAll(
    node =>
      typeof node.type === 'string' &&
      node.props.accessibilityRole === 'button',
  );
  expect(actions[0].props.testID).toBe('home-attention-connection');
  press('home-attention-connection');
  press('home-attention-sensors');
  expect(props.onDetails).toHaveBeenCalledTimes(1);
  expect(props.onTelemetry).toHaveBeenCalledTimes(1);
  connection.connecting = true;
  render();
  expect(
    tree.root.findAllByProps({testID: 'home-attention-connection'}),
  ).toHaveLength(0);
  expect(control('home-attention-sensors')).toBeDefined();
});

test('labels simulation and suppresses live assignment, historical context and stale connection error', () => {
  storage.simulated = true;
  storage.azureContext = snapshot();
  connection.error = new ConnectionError('CONNECTION_LOST');
  render();
  expect(control('home-simulation').props.children).toBe(text.Simulation);
  expect(tree.root.findAllByProps({testID: 'home-attention'})).toHaveLength(0);
  press('home-node-dps');
  expect(content()).not.toContain(identity.assignedHub);
  expect(content()).not.toContain(identity.deviceId);
  expect(content()).toContain(text.SimulationIdentity);
  dismiss();
  press('home-node-adr');
  expect(content()).not.toContain('home-namespace');
});

test('does not invent missing setup, assignment or communication observations', () => {
  storage.credentials = null;
  connection.client = null;
  render();
  expect(content()).toContain(text.CommunicationEmpty);
  press('home-activity');
  expect(props.onActivity).toHaveBeenCalledTimes(1);
  press('home-node-phone');
  expect(content()).toContain(text.NoSetup);
  expect(content()).not.toContain('global.azure-devices-provisioning.net');
  dismiss();
  props.communication = (
    <Native.Text testID="actual-communication">
      A typed observation supplied by the runtime
    </Native.Text>
  );
  render();
  expect(control('actual-communication')).toBeDefined();
  expect(content()).not.toContain(text.CommunicationEmpty);
  expect(
    tree.root.findAll(
      node =>
        typeof node.type === 'string' &&
        node.props.testID === 'home-communication',
    ),
  ).toHaveLength(1);
  expect(
    tree.root
      .findAllByType('Text')
      .filter(node => node.props.children === text.Communication),
  ).toHaveLength(1);
  expect(
    tree.root.findAll(
      node =>
        typeof node.type === 'string' && node.props.testID === 'home-activity',
    ),
  ).toHaveLength(1);
});

test.each([
  {width: 320, height: 640, scale: 1, fontScale: 1},
  {width: 390, height: 844, scale: 1, fontScale: 2},
])(
  'stacks the same relationships for narrow width and large text (%#)',
  nextDimensions => {
    dimensions = nextDimensions;
    useTheme.mockReturnValue({dark: true});
    render();
    expect(control('home-map-stacked')).toBeDefined();
    expect(content()).toContain(text.NamespaceLinks);
    expect(content()).toContain(text.PhoneDpsPath);
    expect(content()).toContain(text.PhoneHubPath);
    for (const node of ['phone', 'dps', 'hub', 'adr']) {
      press(`home-node-${node}`);
      expect(control('home-panel-close')).toBeDefined();
      dismiss();
    }
    expect(
      tree.root.findAll(node => node.props.maxFontSizeMultiplier !== undefined),
    ).toHaveLength(0);
  },
);

test.each(['ios', 'android'])(
  'moves focus into the panel and returns it after dismissal on %s',
  platform => {
    Native.Platform.OS = platform;
    render();
    act(() => jest.runOnlyPendingTimers());
    press('home-node-hub');
    act(() => tree.root.findByType(Native.Modal).props.onShow());
    expect(focusSpy).toHaveBeenLastCalledWith(101);
    act(() => tree.root.findByType(Native.Modal).props.onRequestClose());
    act(() => {
      if (platform === 'ios')
        tree.root.findByType(Native.Modal).props.onDismiss();
      else jest.runOnlyPendingTimers();
    });
    expect(focusSpy).toHaveBeenLastCalledWith(102);
    expect(tree.root.findByType(Native.Modal).props.visible).toBe(false);
  },
);

test.each(['ios', 'android'])(
  'dismisses its panel before opening the sole authoritative Details on %s',
  platform => {
    Native.Platform.OS = platform;
    render();
    act(() => jest.runOnlyPendingTimers());
    press('home-node-hub');
    press('home-panel-details');
    expect(tree.root.findByType(Native.Modal).props.visible).toBe(false);
    if (platform === 'ios') expect(props.onDetails).not.toHaveBeenCalled();
    act(() => {
      if (platform === 'ios')
        tree.root.findByType(Native.Modal).props.onDismiss();
      else jest.runOnlyPendingTimers();
    });
    expect(props.onDetails).toHaveBeenCalledTimes(1);
    expect(connection.client.connect).not.toHaveBeenCalled();
  },
);
