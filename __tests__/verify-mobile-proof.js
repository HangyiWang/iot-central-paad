const {
  inspectProof,
  checkBefore,
  validateTargets,
} = require('../scripts/ci/verify-mobile-proof');
const {validateLiveConfig, MODEL_ID} = require('../scripts/ci/live-config');

const config = validateLiveConfig({
  schemaVersion: 1,
  provisioningHost: 'global.azure-devices-provisioning.net',
  scopeId: '0ne01234567',
  expectedHub: 'fixture.device.azure-devices.net',
  cases: {android: {
    registrationId: 'fixture-registration',
    expectedDeviceId: 'different-assigned-id',
    nonce: 'android-unique-nonce-1234',
  }},
}, 'android');
const targets = validateTargets({
  subscription: '00000000-0000-0000-0000-000000000000',
  resourceGroup: 'fixture-rg',
  namespace: 'fixture-ns',
  dpsServiceHost: 'fixture.azure-devices-provisioning.net',
  hubServiceHost: 'fixture.service.azure-devices.net',
});
const assignment = {
  status: 'assigned',
  registrationId: 'fixture-registration',
  deviceId: 'different-assigned-id',
  assignedHub: config.expectedHub,
};
const twin = {
  deviceId: assignment.deviceId,
  modelId: MODEL_ID,
  proof: {nonce: config.cases.android.nonce, platform: 'android'},
};
const record = {
  id: '/fixture/registryDevices/different-assigned-id',
  name: 'different-assigned-id',
  externalDeviceId: 'different-assigned-id',
};
const reader = (...responses) => jest.fn(() => responses.shift());

test('before traffic checks both registration and assigned identities', () => {
  expect(checkBefore(config, 'android', targets, reader([]))).toMatchObject({
    registryRecordsAbsent: true,
    identifiers: ['fixture-registration', 'different-assigned-id'],
  });
  expect(() => checkBefore(config, 'android', targets, reader([record]))).toThrow(
    'REGISTRY_RECORD_ALREADY_EXISTS',
  );
});

test('requires independent exact assignment, model, nonce and registry identity', () => {
  const read = reader(assignment, twin, [record]);
  expect(inspectProof(config, 'android', targets, read)).toMatchObject({
    complete: true,
    assignedDeviceId: 'different-assigned-id',
    modelId: MODEL_ID,
    reportedProof: {nonce: config.cases.android.nonce},
    registryDevice: {externalDeviceId: 'different-assigned-id'},
    downstreamTelemetryReceipt: 'Not checked',
  });
  expect(read.mock.calls[0][0]).toContain('--auth-type');
  expect(read.mock.calls[1][0]).toContain('different-assigned-id');
  expect(read.mock.calls[1][0]).toContain(targets.hubServiceHost);
  expect(JSON.stringify(read.mock.calls)).not.toMatch(/show-keys|primaryKey|list-keys/);
});

test.each([
  ['deviceId', 'fixture-registration'],
  ['assignedHub', 'other.azure-devices.net'],
  ['registrationId', 'some-other-registration'],
  ['status', 'failed'],
])('does not substitute a guessed assignment (%s)', (field, value) => {
  expect(() => inspectProof(
    config, 'android', targets, reader({...assignment, [field]: value}),
  )).toThrow('ASSIGNMENT_MISMATCH');
});

test('never treats provisioning or local submission alone as confirmation', () => {
  expect(inspectProof(config, 'android', targets, reader(null)).complete).toBe(false);
  expect(inspectProof(config, 'android', targets, reader(assignment, null)).complete).toBe(false);
  expect(inspectProof(config, 'android', targets, reader(
    assignment, {...twin, proof: {nonce: 'old', platform: 'android'}},
  )).complete).toBe(false);
  expect(inspectProof(config, 'android', targets, reader(assignment, twin, [])).complete).toBe(false);
});

test('rejects wrong models and does not confirm ADR from registration ID', () => {
  expect(() => inspectProof(config, 'android', targets, reader(
    assignment, {...twin, modelId: 'dtmi:wrong:model;1'},
  ))).toThrow('TWIN_IDENTITY_OR_MODEL_MISMATCH');
  expect(inspectProof(config, 'android', targets, reader(
    assignment, twin, [{...record, externalDeviceId: 'fixture-registration'}],
  )).complete).toBe(false);
});

test('outputs only allowlisted proof metadata', () => {
  const proof = inspectProof(config, 'android', targets, reader(
    {...assignment, key: 'private-fixture'},
    {...twin, credentials: 'private-fixture', proof: {...twin.proof, key: 'private-fixture'}},
    [{...record, arbitraryPayload: 'private-fixture'}],
  ));
  expect(JSON.stringify(proof)).not.toContain('private-fixture');
});
