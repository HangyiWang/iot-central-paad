#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const {parseArgs} = require('node:util');
const {validateLiveConfig, MODEL_ID} = require('./live-config');

class ProofError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function validateTargets(input) {
  const patterns = {
    subscription: /^[a-f0-9-]{36}$/i,
    resourceGroup: /^[A-Za-z0-9._()-]{1,90}$/,
    namespace: /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/,
    dpsServiceHost: /^[a-z0-9-]+\.azure-devices-provisioning\.(net|cn|us)$/,
    hubServiceHost: /^[a-z0-9-]+(?:\.service)?\.azure-devices\.(net|cn|us)$/,
  };
  const result = {};
  for (const [key, pattern] of Object.entries(patterns)) {
    if (typeof input[key] !== 'string' || !pattern.test(input[key])) {
      throw new ProofError('INVALID_OPERATOR_TARGET');
    }
    result[key] = input[key];
  }
  return result;
}

function azureReader(targets, deadline) {
  return (command, query, allowMissing = false) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ProofError('VERIFICATION_TIMEOUT');
    const result = spawnSync('az', [
      ...command,
      '--subscription', targets.subscription,
      '--query', query,
      '--output', 'json',
      '--only-show-errors',
    ], {encoding: 'utf8', timeout: Math.min(30000, remaining), maxBuffer: 1048576});
    if (result.error || result.signal) throw new ProofError('AZURE_READER_UNAVAILABLE');
    if (result.status !== 0) {
      if (allowMissing && /\b404(?:[0-9]{3})?\b|DeviceNotFound|RegistrationNotFound/i.test(result.stderr)) {
        return null;
      }
      if (/AuthorizationFailed|Unauthorized|Forbidden|\b40[13](?:[0-9]{3})?\b/i.test(result.stderr)) {
        throw new ProofError('AZURE_READ_DENIED');
      }
      throw new ProofError('AZURE_READ_FAILED');
    }
    try {
      return JSON.parse(result.stdout);
    } catch {
      throw new ProofError('INVALID_AZURE_RESPONSE');
    }
  };
}

function registryDevices(targets, read) {
  const records = read([
    'iot', 'adr', 'ns', 'registry-device', 'list',
    '--namespace', targets.namespace,
    '--resource-group', targets.resourceGroup,
  ], '[].{id:id,name:name,externalDeviceId:properties.externalDeviceId}');
  if (!Array.isArray(records)) throw new ProofError('INVALID_REGISTRY_RESPONSE');
  return records;
}

function checkBefore(config, platform, targets, read) {
  const selected = platform === 'all' ? ['android', 'ios'] : [platform];
  const identifiers = selected.flatMap(name => [
    config.cases[name].registrationId,
    config.cases[name].expectedDeviceId,
  ]);
  const records = registryDevices(targets, read);
  if (records.some(record => identifiers.includes(record.externalDeviceId))) {
    throw new ProofError('REGISTRY_RECORD_ALREADY_EXISTS');
  }
  return {
    phase: 'before-mobile-traffic',
    namespace: targets.namespace,
    checkedAt: new Date().toISOString(),
    identifiers,
    registryRecordsAbsent: true,
  };
}

function inspectProof(config, platform, targets, read) {
  const item = config.cases[platform];
  const assignment = read([
    'iot', 'dps', 'enrollment', 'registration', 'show',
    '--dps-name', targets.dpsServiceHost,
    '--enrollment-id', item.registrationId,
    '--auth-type', 'login',
  ], '{registrationId:registrationId,deviceId:deviceId,assignedHub:assignedHub,status:status}', true);
  if (!assignment || assignment.status === 'assigning' || assignment.status === 'unassigned') {
    return {complete: false, waitingFor: 'DPS assignment'};
  }
  if (
    assignment.status !== 'assigned' ||
    assignment.registrationId !== item.registrationId ||
    assignment.deviceId !== item.expectedDeviceId ||
    assignment.assignedHub !== config.expectedHub
  ) {
    throw new ProofError('ASSIGNMENT_MISMATCH');
  }
  const twin = read([
    'iot', 'hub', 'device-twin', 'show',
    '--hub-name', targets.hubServiceHost,
    '--device-id', assignment.deviceId,
    '--auth-type', 'login',
  ], '{deviceId:deviceId,modelId:modelId,proof:properties.reported.paadProof}', true);
  if (!twin || !twin.modelId || !twin.proof) {
    return {complete: false, waitingFor: 'model-bearing Hub twin marker'};
  }
  if (twin.deviceId !== assignment.deviceId || twin.modelId !== MODEL_ID) {
    throw new ProofError('TWIN_IDENTITY_OR_MODEL_MISMATCH');
  }
  if (twin.proof.nonce !== item.nonce || twin.proof.platform !== platform) {
    return {complete: false, waitingFor: 'exact mobile nonce'};
  }
  const matches = registryDevices(targets, read).filter(
    record => record.externalDeviceId === assignment.deviceId,
  );
  if (!matches.length) return {complete: false, waitingFor: 'automatic ADR record'};
  if (matches.length !== 1 || typeof matches[0].id !== 'string' || typeof matches[0].name !== 'string') {
    throw new ProofError('AMBIGUOUS_REGISTRY_EVIDENCE');
  }
  return {
    complete: true,
    phase: 'independently-verified',
    observedAt: new Date().toISOString(),
    platform,
    namespace: targets.namespace,
    registrationId: item.registrationId,
    assignedDeviceId: assignment.deviceId,
    assignedHub: assignment.assignedHub,
    modelId: twin.modelId,
    reportedProof: {nonce: twin.proof.nonce, platform: twin.proof.platform},
    registryDevice: {
      id: matches[0].id,
      name: matches[0].name,
      externalDeviceId: matches[0].externalDeviceId,
    },
    downstreamTelemetryReceipt: 'Not checked',
  };
}

async function main() {
  const {values} = parseArgs({options: {
    config: {type: 'string'},
    platform: {type: 'string', default: 'all'},
    subscription: {type: 'string'},
    'resource-group': {type: 'string'},
    namespace: {type: 'string'},
    'dps-service-host': {type: 'string'},
    'hub-service-host': {type: 'string'},
    timeout: {type: 'string', default: '180'},
    before: {type: 'boolean', default: false},
    help: {type: 'boolean', default: false},
  }});
  if (values.help) {
    console.log(`Operator-only READS using the existing Azure CLI Entra session.
Never run in the mobile app or device-secret CI job. No keys are requested.
Required: --config <nonsecret-live-config.json> --subscription <id>
  --resource-group <rg> --namespace <name> --dps-service-host <configured DNS>
  --hub-service-host <configured service DNS>
Optional: --platform all|android|ios --timeout <1-600 seconds> --before
Use --before before mobile traffic and retain its JSON result.
Without --before, require exact DPS assignment, Hub model/nonce and ADR identity.
Configured service hosts must come from operator readback, not guessed endpoints.
Output is allowlisted JSON; no raw Azure CLI errors or device properties are printed.`);
    return;
  }
  if (!values.config) throw new ProofError('INVALID_OPERATOR_INPUT');
  const config = validateLiveConfig(fs.readFileSync(values.config, 'utf8'), values.platform);
  const targets = validateTargets({
    subscription: values.subscription,
    resourceGroup: values['resource-group'],
    namespace: values.namespace,
    dpsServiceHost: values['dps-service-host'],
    hubServiceHost: values['hub-service-host'],
  });
  if (
    targets.hubServiceHost.replace('.service.azure-devices.', '.azure-devices.') !==
    config.expectedHub.replace('.device.azure-devices.', '.azure-devices.')
  ) {
    throw new ProofError('HUB_SERVICE_TARGET_MISMATCH');
  }
  const timeout = Number(values.timeout);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 600) {
    throw new ProofError('INVALID_OPERATOR_TIMEOUT');
  }
  const deadline = Date.now() + timeout * 1000;
  const read = azureReader(targets, deadline);
  if (values.before) {
    console.log(JSON.stringify(checkBefore(config, values.platform, targets, read), null, 2));
    return;
  }
  const selected = values.platform === 'all' ? ['android', 'ios'] : [values.platform];
  const completed = {};
  while (Date.now() < deadline) {
    for (const platform of selected) {
      if (completed[platform]) continue;
      const result = inspectProof(config, platform, targets, read);
      if (result.complete) completed[platform] = result;
    }
    if (selected.every(platform => completed[platform])) {
      console.log(JSON.stringify({schemaVersion: 1, cases: completed}, null, 2));
      return;
    }
    const remaining = deadline - Date.now();
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, Math.min(5000, remaining)));
  }
  throw new ProofError('VERIFICATION_TIMEOUT');
}

module.exports = {ProofError, validateTargets, azureReader, checkBefore, inspectProof};
if (require.main === module) {
  main().catch(error => {
    const code = error instanceof ProofError ? error.code : 'INVALID_OPERATOR_INPUT';
    console.error(`Independent mobile proof failed: ${code}. No raw input or Azure response was logged.`);
    process.exitCode = 1;
  });
}
