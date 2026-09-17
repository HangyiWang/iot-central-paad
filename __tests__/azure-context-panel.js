import React, {useContext} from 'react';
import renderer, {act} from 'react-test-renderer';
import {Linking, Platform, StyleSheet} from 'react-native';
import * as Keychain from 'react-native-keychain';
import AzureContextPanel from '../src/components/azureContextPanel';
import StorageProvider, {
  StorageContext,
  restoreStoredState,
} from '../src/contexts/storage';
import {decodeAzureContextInput} from '../src/onboarding/azureContextInput';
import Strings from '../src/strings';
import {useTheme} from '../src/hooks';
import {palette} from '../src/theme/palette';

jest.mock('../src/hooks', () => ({useTheme: jest.fn(() => ({dark: false}))}));
jest.mock('../src/components/typography', () => ({Text: 'Text'}));

const subscription = '11111111-2222-4333-8444-555555555555';
const scope = `/subscriptions/${subscription}/resourceGroups/context-rg`;
const namespace = `${scope}/providers/Microsoft.DeviceRegistry/namespaces/context-ns`;
const identity = {
  deviceId: 'context-device',
  assignedHub: 'context-hub.device.azure-devices.net',
  registrationId: 'context-registration',
  modelId: 'dtmi:azureiot:PhoneAsADevice;2',
};
const credentials = {
  scopeId: '0ne12345678',
  registrationId: identity.registrationId,
  deviceKey: Buffer.alloc(32, 1).toString('base64'),
};
const fixture = () => ({
  schema: 'paad.azure-context',
  version: 1,
  capturedAt: '2026-09-17T19:00:00.000Z',
  binding: {
    deviceId: identity.deviceId,
    assignedHub: identity.assignedHub,
    registrationId: identity.registrationId,
  },
  subscription: {id: subscription, name: 'Context Subscription'},
  resourceGroup: {name: 'context-rg'},
  namespace: {
    name: 'context-ns',
    resourceId: namespace,
    location: 'testregion',
  },
  hub: {
    name: 'context-hub',
    resourceId: `${scope}/providers/Microsoft.Devices/IotHubs/context-hub`,
  },
  activities: [
    {
      timestamp: '2026-09-17T18:00:00.000Z',
      operation: 'Microsoft.DeviceRegistry/namespaces/registryDevices/write',
      status: 'Succeeded',
      resourceId: `${namespace}/registryDevices/another-device`,
    },
  ],
});
let tree;
let storage;
let selectedIdentity;
const Harness = () => {
  storage = useContext(StorageContext);
  return <AzureContextPanel identity={selectedIdentity} />;
};
const content = () => JSON.stringify(tree.toJSON());
const control = id => tree.root.findAllByProps({testID: id})[0];
const press = async id => {
  await act(async () => {
    await control(id).props.onPress();
  });
};
beforeEach(async () => {
  jest.clearAllMocks();
  useTheme.mockReturnValue({dark: false});
  Keychain.setGenericPassword.mockReset().mockResolvedValue(true);
  Keychain.getGenericPassword.mockReset().mockResolvedValue(false);
  Keychain.resetGenericPassword.mockReset().mockResolvedValue(true);
  selectedIdentity = identity;
  await act(async () => {
    tree = renderer.create(
      <StorageProvider>
        <Harness />
      </StorageProvider>,
    );
  });
  await act(async () => {
    await storage.save({credentials});
  });
});
afterEach(async () => {
  await act(async () => {
    tree.unmount();
  });
  expect(global.fetch).not.toHaveBeenCalled();
  expect(global.XMLHttpRequest).not.toHaveBeenCalled();
  expect(global.WebSocket).not.toHaveBeenCalled();
});

async function enter(snapshot = fixture()) {
  await press('azure-context-import-toggle');
  await act(async () => {
    control('azure-context-input').props.onChangeText(JSON.stringify(snapshot));
  });
}

test('imports a matching snapshot, persists it and distinguishes namespace activity from telemetry', async () => {
  await enter();
  await press('azure-context-import');
  expect(storage.azureContext.namespace.name).toBe('context-ns');
  expect(control('azure-context-namespace').props.children).toBe('context-ns');
  expect(content()).toContain(Strings.AzureContext.Source);
  expect(content()).toContain(Strings.AzureContext.Explanation);
  expect(control('azure-context-subscription').props.children).toBe(
    'Context Subscription',
  );
  await press('azure-context-activities');
  expect(content()).toContain('another-device');
  expect(content()).toContain('This is not telemetry history.');
  const saved = JSON.parse(Keychain.setGenericPassword.mock.calls.at(-1)[1]);
  expect(restoreStoredState(saved).azureContext).toEqual(storage.azureContext);
  expect(restoreStoredState(saved).azureContextError).toBe(false);
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  await act(async () => {
    await tree.root
      .findAllByProps({
        accessibilityLabel: `${Strings.AzureContext.Namespace}: ${Strings.AzureContext.Portal}`,
      })[0]
      .props.onPress();
  });
  expect(open).toHaveBeenCalledWith(
    `https://portal.azure.com/#resource${namespace}/overview`,
  );
  open.mockRestore();
});

test('rejects a different device or malformed input without altering saved credentials', async () => {
  const wrong = fixture();
  wrong.binding.deviceId = 'wrong-device';
  await enter(wrong);
  await press('azure-context-import');
  expect(content()).toContain(Strings.AzureContext.WrongDevice);
  expect(storage.azureContext).toBeNull();
  await act(async () => {
    control('azure-context-input').props.onChangeText('SECRET_CANARY');
  });
  await press('azure-context-import');
  expect(control('azure-context-error').props.children).toBe(
    Strings.AzureContext.Invalid,
  );
  expect(storage.credentials).toEqual(credentials);
});

test('hides a stored snapshot when the assigned identity changes or is simulated/unavailable', async () => {
  await act(async () => {
    await storage.save({azureContext: fixture()});
  });
  selectedIdentity = {...identity, deviceId: 'other-device'};
  await act(async () => {
    tree.update(
      <StorageProvider>
        <Harness />
      </StorageProvider>,
    );
  });
  expect(content()).not.toContain('Context Subscription');
  expect(content()).not.toContain('context-ns');
  expect(content()).toContain(Strings.AzureContext.OtherDevice);
  selectedIdentity = null;
  await act(async () => {
    tree.update(
      <StorageProvider>
        <Harness />
      </StorageProvider>,
    );
  });
  expect(content()).toContain(Strings.AzureContext.Unavailable);
  expect(
    tree.root.findAllByProps({testID: 'azure-context-input'}),
  ).toHaveLength(0);
});

test('surfaces a storage failure and keeps the previous snapshot', async () => {
  await act(async () => {
    await storage.save({azureContext: fixture()});
  });
  await enter({
    ...fixture(),
    subscription: {id: subscription, name: 'Replacement'},
  });
  Keychain.setGenericPassword.mockResolvedValueOnce(false);
  await press('azure-context-import');
  expect(content()).toContain(Strings.AzureContext.SaveFailed);
  expect(storage.azureContext.subscription.name).toBe('Context Subscription');
  await press('azure-context-remove');
  expect(storage.azureContext).toBeNull();
  expect(storage.credentials).toEqual(credentials);
});

test('corrupt optional context surfaces an error without preventing credentials from restoring', async () => {
  const restored = restoreStoredState({
    credentials,
    azureContext: {unexpected: 'CANARY'},
  });
  expect(restored.azureContext).toBeNull();
  expect(restored.azureContextError).toBe(true);
  expect(restored.credentials.registrationId).toBe(identity.registrationId);
  Keychain.getGenericPassword.mockResolvedValueOnce({
    password: JSON.stringify({
      credentials,
      azureContext: {unexpected: 'CANARY'},
    }),
  });
  await act(async () => {
    await storage.read();
  });
  expect(content()).toContain(Strings.AzureContext.StoredInvalid);
  expect(content()).not.toContain('CANARY');
});

test('forgetting credentials clears context and rejects a queued import after forgetting', async () => {
  await act(async () => {
    await storage.save({azureContext: fixture()});
  });
  let importResult;
  await act(async () => {
    const forgot = storage.save({credentials: null});
    importResult = storage.save({azureContext: fixture()}).then(
      () => true,
      () => false,
    );
    await forgot;
    expect(await importResult).toBe(false);
  });
  expect(storage.azureContext).toBeNull();
  expect(storage.credentials).toBeNull();
});

test('supports canonical Base64 without accepting corrupted UTF-8 or credential envelopes', () => {
  const data = JSON.stringify(fixture());
  expect(decodeAzureContextInput(Buffer.from(data).toString('base64'))).toEqual(
    fixture(),
  );
  expect(() =>
    decodeAzureContextInput(Buffer.from([0xff]).toString('base64')),
  ).toThrow();
  expect(() => decodeAzureContextInput('x'.repeat(87385))).toThrow();
  expect(() =>
    decodeAzureContextInput(JSON.stringify({deviceKey: 'not-a-snapshot'})),
  ).toThrow();
});

test.each([false, true])(
  'keeps the snapshot recessed, names neutral and disclosed IDs selectable (dark %s)',
  async dark => {
    useTheme.mockReturnValue({dark});
    const snapshot = fixture();
    snapshot.namespace.name = `namespace-${'long-name-'.repeat(5)}end`;
    snapshot.namespace.resourceId = `${scope}/providers/Microsoft.DeviceRegistry/namespaces/${snapshot.namespace.name}`;
    snapshot.activities[0].resourceId = `${snapshot.namespace.resourceId}/registryDevices/another-device`;
    snapshot.activities.push({...snapshot.activities[0], status: 'Failed'});
    await act(async () => {
      await storage.save({azureContext: snapshot});
    });
    const colors = palette(dark);
    const style = node => StyleSheet.flatten(node.props.style);
    const textNode = content =>
      tree.root
        .findAllByType('Text')
        .find(node => node.props.children === content);
    expect(style(control('azure-context-panel'))).toMatchObject({
      backgroundColor: colors.inset,
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 12,
    });
    expect(style(control('azure-context-panel')).borderWidth).toBeUndefined();
    const name = control('azure-context-namespace');
    expect(name.props.children).toBe(snapshot.namespace.name);
    expect(name.props.selectable).toBe(true);
    expect(style(name)).toEqual(style(textNode(Strings.AzureContext.Title)));
    expect(style(name)).toMatchObject({
      fontSize: 17,
      lineHeight: 24,
      fontWeight: '600',
      letterSpacing: -0.2,
      color: colors.text,
    });
    await press('azure-context-toggle');
    const resourceName = control('azure-context-subscription');
    expect(style(resourceName)).toMatchObject({
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400',
      color: colors.text,
    });
    expect(style(resourceName).fontFamily).toBeUndefined();
    expect(style(resourceName.parent).paddingTop).toBeUndefined();
    let row = resourceName.parent;
    while (row && style(row)?.borderTopWidth === undefined) {
      row = row.parent;
    }
    expect(style(row)).toMatchObject({
      paddingVertical: 14,
      gap: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
    });
    await press('azure-context-ids');
    await press('azure-context-activities');
    for (const resourceId of [
      snapshot.namespace.resourceId,
      snapshot.activities[0].resourceId,
    ]) {
      const node = textNode(resourceId);
      expect(node.props.selectable).toBe(true);
      expect(style(node)).toMatchObject({
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 14,
        lineHeight: 22,
      });
    }
    expect(style(textNode('Succeeded')).color).toBe(colors.text);
    expect(style(textNode('Failed')).color).toBe(colors.danger);
    expect(style(textNode(Strings.AzureContext.Activities))).toEqual(
      style(name),
    );
    expect(content()).toContain(Strings.AzureContext.Source);
    expect(content()).toContain(Strings.AzureContext.ActivityExplanation);
    for (const id of [
      'azure-context-toggle',
      'azure-context-ids',
      'azure-context-activities',
    ]) {
      expect(style(control(id)).minHeight).toBe(48);
      expect(style(control(id)).backgroundColor).toBeUndefined();
    }
    expect(style(control('azure-context-import-toggle'))).toMatchObject({
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: colors.surface,
    });
    for (const node of tree.root.findAllByType('Text')) {
      expect(node.props.numberOfLines).toBeUndefined();
      expect(node.props.maxFontSizeMultiplier).toBeUndefined();
      expect(node.props.allowFontScaling).not.toBe(false);
    }
  },
);

test('keeps importing controls visibly disabled while saving and reports failure in danger', async () => {
  await act(async () => {
    await storage.save({azureContext: fixture()});
  });
  await press('azure-context-toggle');
  await enter();
  let finish;
  Keychain.setGenericPassword.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  let pending;
  await act(async () => {
    pending = control('azure-context-import').props.onPress();
  });
  const input = control('azure-context-input');
  expect(input.props.editable).toBe(false);
  expect(StyleSheet.flatten(input.props.style)).toMatchObject({
    borderRadius: 14,
    borderColor: palette(false).controlBorder,
    backgroundColor: palette(false).inset,
    opacity: 0.5,
    fontSize: 15,
    lineHeight: 22,
  });
  for (const node of tree.root.findAll(
    node =>
      node.props.onPress &&
      ['button', 'link'].includes(node.props.accessibilityRole),
  )) {
    expect(node.props.disabled).toBe(true);
    expect(node.props.accessibilityState.disabled).toBe(true);
    expect(StyleSheet.flatten(node.props.style).opacity).toBe(0.5);
  }
  await act(async () => {
    finish(false);
    await pending;
  });
  expect(control('azure-context-error').props.children).toBe(
    Strings.AzureContext.SaveFailed,
  );
  expect(
    StyleSheet.flatten(control('azure-context-error').props.style),
  ).toMatchObject({
    color: palette(false).danger,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  });
  expect(control('azure-context-input').props.editable).toBe(true);
});
