#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {sanitizeNativeResult} = require('./ios-xcuitest-result');

// cli-2.10.0 TestOutputWriter / TreeNode schema. Never copy source objects.
const COMMAND_KINDS = Object.freeze([
  'launchAppCommand', 'stopAppCommand', 'tapOnElement',
  'eraseTextCommand', 'inputTextCommand', 'hideKeyboardCommand', 'pressKeyCommand',
  'scrollUntilVisible', 'assertCommand', 'assertConditionCommand',
  'applyConfigurationCommand', 'defineVariablesCommand',
  'runFlowCommand', 'repeatCommand', 'evalScriptCommand',
]);
const TARGET_IDS = Object.freeze([
  'registration-manual', 'registration-back', 'connection-registrationId', 'connection-scopeId',
  'connection-provisioningHost', 'connection-deviceKey', 'connection-submit',
  'connection-status', 'assigned-device-id', 'assigned-hub', 'connection-details',
  'connection-details-sheet', 'connection-details-close',
  'model-id', 'registration-id', 'registry-status', 'proof-nonce', 'proof-send',
  'proof-status', 'connection-error-code', 'connection-service-code', 'connection-http-status',
]);
const ERROR_CODES = Object.freeze([
  'INVALID_CREDENTIALS', 'UNSAFE_ENDPOINT', 'CANCELLED', 'TIMEOUT',
  'AUTHENTICATION_FAILED', 'PROVISIONING_FAILED', 'INVALID_RESPONSE',
  'NETWORK_ERROR', 'CONNECT_FAILED', 'SECURE_TRANSPORT_REQUIRED',
  'CONNECTION_LOST',
  'NOT_CONNECTED', 'OPERATION_FAILED', 'STORAGE_FAILED', 'BUSY',
]);
const PROOF_STATUSES = Object.freeze(['Submitted locally']);
const UI_PRESENCE_IDS = Object.freeze([
  'app-header-title',
  'connection-status', 'assigned-device-id', 'assigned-hub', 'connection-details',
  'connection-details-sheet', 'connection-details-close', 'model-id',
  'app-busy-overlay', 'navigation-content', 'registration-manual',
  'registration-close', 'connection-registrationId', 'connection-scopeId',
  'connection-provisioningHost', 'connection-submit', 'connection-error',
]);
const UI_LABELS = new Map([
  ['IoT PnP', 'app-root'], ['IoT Plug and Play', 'app-heading'],
  ['Phone as a device', 'app-heading'],
  ['Home Screen', 'launcher'], ['SpringBoard', 'launcher'],
  ['Manually connect', 'manual-heading'], ['Connect manually', 'manual-entry'],
  ['Checking connection details...', 'validating'],
  ['Requesting a device assignment...', 'provisioning'],
  ['Connecting to the assigned IoT Hub...', 'connecting'],
  ['Connected', 'connected'], ['Disconnected', 'disconnected'],
  ['Cancel', 'cancel'], ['Allow', 'allow'], ["Don't Allow", 'deny'], ['OK', 'ok'],
]);
const UI_LABEL_CODES = [...UI_LABELS.values()];
const FAILURE_PREFIXES = Object.freeze([
  ['Assertion is false: ', 'assertion-failed'],
  ['Device became unreachable during ', 'device-unreachable'],
  ['iOS driver not ready in time,', 'ios-driver-startup-timeout'],
  ['Failed to get screenshot: Timed out while requesting screenshot.', 'screenshot-timeout'],
]);
const FAILURE_CATEGORIES = FAILURE_PREFIXES.map(([, category]) => category);
const SYSTEM_DIALOGS = new Map([
  ["Quickstep isn't responding", 'quickstep-anr'],
  ["System UI isn't responding", 'system-ui-anr'],
  ["IoT Plug and Play isn't responding", 'paad-anr'],
  ["IoT PnP isn't responding", 'paad-anr'],
]);
const SYSTEM_DIALOG_CODES = [...new Set(SYSTEM_DIALOGS.values())];
const ID_TEXT_MATCHES = Object.freeze(['match', 'mismatch', 'missing', 'unavailable', 'ambiguous']);
const LIMITS = Object.freeze({
  entries: 256, files: 32, fileBytes: 1024 * 1024, totalBytes: 4 * 1024 * 1024,
  directoryDepth: 6, nodes: 4096, hierarchyDepth: 64, commands: 512,
});
const UNAVAILABLE_REASONS = Object.freeze([
  'no-supported-data', 'invalid-metadata', 'entry-limit', 'depth-limit',
  'file-limit', 'byte-limit', 'command-limit', 'hierarchy-limit', 'unsafe-path', 'read-failed',
]);
const unavailable = reason => ({
  availability: 'unavailable',
  ...(UNAVAILABLE_REASONS.includes(reason) ? {reason} : {}),
});
class DiagnosticUnavailable extends Error {
  constructor(reason) {
    super('Unavailable');
    this.reason = reason;
  }
}
const integer = value => Number.isSafeInteger(value) && value >= 0;
const object = value => value && typeof value === 'object' && !Array.isArray(value);

function parseCommands(value) {
  if (!Array.isArray(value)) throw new DiagnosticUnavailable('invalid-metadata');
  if (value.length > LIMITS.commands) throw new DiagnosticUnavailable('command-limit');
  const failedCommands = [];
  for (const entry of value) {
    if (!object(entry) || !object(entry.metadata) || entry.metadata.status !== 'FAILED') continue;
    const sequenceNumber = entry.metadata.sequenceNumber;
    if (!integer(sequenceNumber) || !object(entry.command)) continue;
    const kinds = COMMAND_KINDS.filter(kind => object(entry.command[kind]));
    if (kinds.length !== 1) continue;
    const commandKind = kinds[0];
    const command = entry.command[commandKind];
    const result = {sequenceNumber, commandKind};
    const message = object(entry.metadata.error) ? entry.metadata.error.message : undefined;
    if (typeof message === 'string') {
      const failure = FAILURE_PREFIXES.find(([prefix]) => message.startsWith(prefix));
      if (failure) result.failureCategory = failure[1];
    }
    for (const selector of [command.selector, command.visible, command.notVisible,
      command.condition?.visible, command.condition?.notVisible]) {
      if (object(selector) && TARGET_IDS.includes(selector.idRegex)) {
        result.targetId = selector.idRegex;
        break;
      }
    }
    failedCommands.push(result);
  }
  return failedCommands;
}

// Android-only comparison takes a trusted literal, not source textRegex/environment.
// The optional androidDetails snapshot is emitted publicly only when bound to its failed command.
// cli-2.10.0 ArtifactsGenerator.captureStepHierarchy serializes viewHierarchy().root:
// a TreeNode, not a ViewHierarchy wrapper. AndroidDriver.mapHierarchy(document) keeps
// document/window nodes under children; TestOutputWriter omits empty attributes/children.
function parseHierarchy(value, {platform, expectedDeviceId} = {}) {
  if (!object(value)) throw new DiagnosticUnavailable('invalid-metadata');
  const android = platform === 'android';
  const identityNodes = [];
  const ui = {};
  const observedTargets = new Set();
  const observedLabels = new Set();
  let count = 0;
  function visit(node, depth) {
    if (++count > LIMITS.nodes || depth > LIMITS.hierarchyDepth) {
      throw new DiagnosticUnavailable('hierarchy-limit');
    }
    if (!object(node)) {
      if (android) throw new DiagnosticUnavailable('invalid-metadata');
      return;
    }
    const attributes = node.attributes;
    if (android && ((attributes !== undefined && !object(attributes)) ||
        (node.children !== undefined && !Array.isArray(node.children)))) {
      throw new DiagnosticUnavailable('invalid-metadata');
    }
    if (object(attributes)) {
      // Android resource-id and iOS accessibility identifier share this attribute.
      const id = attributes['resource-id'];
      if (UI_PRESENCE_IDS.includes(id)) observedTargets.add(id);
      if (android && id === 'assigned-device-id') identityNodes.push(attributes.text);
      for (const text of [attributes.text, attributes.accessibilityText]) {
        if (!id && UI_LABELS.has(text)) observedLabels.add(UI_LABELS.get(text));
        if (id === 'connection-status' && ['Connected', 'Disconnected'].includes(text)) {
          ui.connectionState = text;
        }
        if (id === 'connection-error-code' && ERROR_CODES.includes(text)) ui.connectionErrorCode = text;
        if (id === 'connection-http-status' && typeof text === 'string' &&
            text.length === 8 && /^HTTP [1-5][0-9]{2}$/.test(text)) {
          ui.connectionHttpStatus = Number(text.slice(5));
        }
        if (id === 'connection-service-code' && typeof text === 'string' &&
            text.length <= 15 && /^[0-9]+$/.test(text) && integer(Number(text))) {
          ui.connectionServiceCode = Number(text);
        }
        if (id === 'proof-status' && PROOF_STATUSES.includes(text)) ui.proofStatus = text;
        if (id === 'android:id/alertTitle' && SYSTEM_DIALOGS.has(text)) {
          ui.systemDialog = SYSTEM_DIALOGS.get(text);
        }
      }
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) visit(child, depth + 1);
    }
  }
  visit(value, 0);
  if (observedTargets.size) ui.observedTargets = [...observedTargets].sort();
  if (observedLabels.size) ui.observedLabels = [...observedLabels].sort();
  if (android && (object(value.attributes) || Array.isArray(value.children))) {
    const expectedValid = typeof expectedDeviceId === 'string' && expectedDeviceId.length <= 128 &&
      !/[\s\x00-\x1f\x7f]/.test(expectedDeviceId) &&
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(expectedDeviceId);
    const actual = identityNodes[0];
    // Android omits invisible children; presence is not visibility or app state.
    // Compare only the tagged value's text, never hints, descendants or labels.
    ui.androidDetails = {
      sheetPresent: observedTargets.has('connection-details-sheet'),
      assignedDeviceIdPresent: identityNodes.length > 0,
      assignedDeviceIdTextMatch: identityNodes.length === 0 ? 'missing'
        : identityNodes.length > 1 ? 'ambiguous'
          : !expectedValid || typeof actual !== 'string' || !actual.length || actual.length > 128
            ? 'unavailable' : actual === expectedDeviceId ? 'match' : 'mismatch',
    };
  }
  return ui;
}

function sanitizeAndroidDetails(value) {
  if (!object(value)) return undefined;
  const safe = {};
  if (typeof value.detailsTapCompleted === 'boolean') safe.detailsTapCompleted = value.detailsTapCompleted;
  if (typeof value.sheetPresent === 'boolean' && typeof value.assignedDeviceIdPresent === 'boolean' &&
      ID_TEXT_MATCHES.includes(value.assignedDeviceIdTextMatch) &&
      (value.assignedDeviceIdPresent === (value.assignedDeviceIdTextMatch !== 'missing'))) {
    safe.sheetPresent = value.sheetPresent;
    safe.assignedDeviceIdPresent = value.assignedDeviceIdPresent;
    safe.assignedDeviceIdTextMatch = value.assignedDeviceIdTextMatch;
  }
  return Object.keys(safe).length ? safe : undefined;
}

function sanitizeDiagnostics(value) {
  try {
    if (!object(value)) return unavailable();
    if (value.availability !== 'available') {
      return unavailable(value.availability === 'unavailable' ? value.reason : undefined);
    }
    const failedCommands = [];
    if (Array.isArray(value.failedCommands) && value.failedCommands.length <= LIMITS.commands) {
      for (const entry of value.failedCommands) {
        if (!object(entry) || !integer(entry.sequenceNumber) || !COMMAND_KINDS.includes(entry.commandKind)) continue;
        const command = {sequenceNumber: entry.sequenceNumber, commandKind: entry.commandKind};
        if (TARGET_IDS.includes(entry.targetId)) command.targetId = entry.targetId;
        if (FAILURE_CATEGORIES.includes(entry.failureCategory)) command.failureCategory = entry.failureCategory;
        const androidDetails = entry.targetId === 'assigned-device-id'
          ? sanitizeAndroidDetails(entry.androidDetails) : undefined;
        if (androidDetails) command.androidDetails = androidDetails;
        failedCommands.push(command);
      }
    }
    const ui = {};
    if (object(value.ui)) {
      if (Array.isArray(value.ui.observedLabels) &&
          value.ui.observedLabels.length <= UI_LABEL_CODES.length) {
        const labels = [...new Set(value.ui.observedLabels.filter(label => UI_LABEL_CODES.includes(label)))].sort();
        if (labels.length) ui.observedLabels = labels;
      }
      if (['Connected', 'Disconnected'].includes(value.ui.connectionState)) {
        ui.connectionState = value.ui.connectionState;
      }
      if (Array.isArray(value.ui.observedTargets) &&
          value.ui.observedTargets.length <= UI_PRESENCE_IDS.length) {
        const targets = [...new Set(value.ui.observedTargets.filter(id => UI_PRESENCE_IDS.includes(id)))].sort();
        if (targets.length) ui.observedTargets = targets;
      }
      if (ERROR_CODES.includes(value.ui.connectionErrorCode)) ui.connectionErrorCode = value.ui.connectionErrorCode;
      if (integer(value.ui.connectionHttpStatus) && value.ui.connectionHttpStatus >= 100 &&
          value.ui.connectionHttpStatus <= 599) ui.connectionHttpStatus = value.ui.connectionHttpStatus;
      if (integer(value.ui.connectionServiceCode)) ui.connectionServiceCode = value.ui.connectionServiceCode;
      if (PROOF_STATUSES.includes(value.ui.proofStatus)) ui.proofStatus = value.ui.proofStatus;
      if (SYSTEM_DIALOG_CODES.includes(value.ui.systemDialog)) ui.systemDialog = value.ui.systemDialog;
    }
    const nativeUi = sanitizeNativeResult(value.nativeUi);
    return failedCommands.length || Object.keys(ui).length || nativeUi
      ? {
        availability: 'available', failedCommands, ui,
        ...(nativeUi ? {nativeUi} : {}),
        ...(typeof value.hierarchyCaptured === 'boolean' ? {hierarchyCaptured: value.hierarchyCaptured} : {}),
      } : unavailable();
  } catch {
    return unavailable();
  }
}

function collectLiveDiagnostics(options = {}) {
  try {
    const root = path.resolve('build/live-device-private');
    const requireDirectory = directory => {
      const stat = fs.lstatSync(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new DiagnosticUnavailable('unsafe-path');
    };
    requireDirectory(path.resolve('build'));
    requireDirectory(root);
    let entries = 0;
    let files = 0;
    let bytes = 0;
    const failedCommands = [];
    const androidCommands = [];
    const androidHierarchies = new Map();
    const ui = {};
    const observedTargets = new Set();
    const observedLabels = new Set();
    let hierarchyCaptured = false;
    function walk(directory, depth) {
      requireDirectory(directory);
      if (depth > LIMITS.directoryDepth) throw new DiagnosticUnavailable('depth-limit');
      const dir = fs.opendirSync(directory);
      try {
        let entry;
        while ((entry = dir.readSync())) {
          if (++entries > LIMITS.entries) throw new DiagnosticUnavailable('entry-limit');
          const filename = path.join(directory, entry.name);
          const stat = fs.lstatSync(filename);
          if (stat.isSymbolicLink()) continue;
          if (stat.isDirectory()) {
            // Never inspect image, log, recording or arbitrary artifact payload folders.
            if (!['logs', 'screenshots', 'takeScreenshot', 'startRecording', 'ai-analysis'].includes(entry.name)) {
              walk(filename, depth + 1);
            }
            continue;
          }
          const commands = entry.name === 'commands.json';
          const hierarchy = path.basename(directory) === 'screen-hierarchy' && entry.name.endsWith('.json');
          const postFailure = entry.name === 'post-failure-ui.json';
          if (!stat.isFile() || (!commands && !hierarchy && !postFailure)) continue;
          if (++files > LIMITS.files) throw new DiagnosticUnavailable('file-limit');
          if (stat.size > LIMITS.fileBytes || (bytes += stat.size) > LIMITS.totalBytes) {
            throw new DiagnosticUnavailable('byte-limit');
          }
          const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
          let value;
          try {
            const current = fs.fstatSync(fd);
            if (!current.isFile() || current.size !== stat.size || current.ino !== stat.ino ||
                current.dev !== stat.dev) throw new DiagnosticUnavailable('unsafe-path');
            const buffer = Buffer.alloc(stat.size + 1);
            const size = fs.readSync(fd, buffer, 0, buffer.length, 0);
            if (size !== stat.size) throw new DiagnosticUnavailable('read-failed');
            value = JSON.parse(buffer.subarray(0, size).toString('utf8'));
          } finally {
            fs.closeSync(fd);
          }
          if (commands) {
            const parsed = parseCommands(value);
            failedCommands.push(...parsed);
            if (options.platform === 'android') {
              for (const command of parsed) {
                if (command.targetId !== 'assigned-device-id') continue;
                if (value.filter(entry => entry?.metadata?.sequenceNumber === command.sequenceNumber).length !== 1) continue;
                const previous = value.filter(entry => object(entry?.metadata) &&
                  entry.metadata.sequenceNumber === command.sequenceNumber - 1);
                if (previous.length === 1 &&
                    COMMAND_KINDS.filter(kind => object(previous[0].command?.[kind])).length === 1 &&
                    previous[0].command?.tapOnElement?.selector?.idRegex === 'connection-details' &&
                    ['COMPLETED', 'FAILED', 'SKIPPED'].includes(previous[0].metadata.status)) {
                  // A completed driver tap is a request, not proof that app onPress ran.
                  command.androidDetails = {detailsTapCompleted: previous[0].metadata.status === 'COMPLETED'};
                }
                androidCommands.push({filename, command});
              }
            }
          }
          else if (postFailure) {
            if (!object(value) || value.source !== 'post-failure-ios-hierarchy' || !object(value.ui)) {
              throw new DiagnosticUnavailable('invalid-metadata');
            }
            const safe = sanitizeDiagnostics({availability: 'available', ui: value.ui});
            hierarchyCaptured = true;
            for (const target of safe.ui?.observedTargets ?? []) observedTargets.add(target);
            for (const label of safe.ui?.observedLabels ?? []) observedLabels.add(label);
            Object.assign(ui, safe.ui);
          }
          else {
            const hierarchy = parseHierarchy(value, options);
            if (hierarchy.androidDetails) {
              // cli-2.10.0 StepArtifactNaming uses sequenceNumber + 1, padded to 3 digits.
              // Bind only within this commands.json bundle; never union failure snapshots.
              const step = /^step-([0-9]{3,16})(?:-.{1,40})?\.json$/.exec(entry.name);
              if (step && integer(Number(step[1]) - 1)) {
                const key = `${path.join(path.dirname(directory), 'commands.json')}:${Number(step[1]) - 1}`;
                androidHierarchies.set(key, androidHierarchies.has(key) ? null : hierarchy.androidDetails);
              }
              delete hierarchy.androidDetails;
            }
            hierarchyCaptured = true;
            for (const target of hierarchy.observedTargets ?? []) observedTargets.add(target);
            for (const label of hierarchy.observedLabels ?? []) observedLabels.add(label);
            Object.assign(ui, hierarchy);
          }
        }
      } finally {
        dir.closeSync();
      }
    }
    for (const name of ['results', 'debug']) {
      const directory = path.join(root, name);
      try {
        fs.lstatSync(directory);
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      walk(directory, 0);
    }
    // Presence across captured failure hierarchies is not current visibility.
    if (observedTargets.size) ui.observedTargets = [...observedTargets].sort();
    if (observedLabels.size) ui.observedLabels = [...observedLabels].sort();
    for (const {filename, command} of androidCommands) {
      const hierarchy = androidHierarchies.get(`${filename}:${command.sequenceNumber}`);
      if (hierarchy) command.androidDetails = {...command.androidDetails, ...hierarchy};
    }
    const result = sanitizeDiagnostics({availability: 'available', failedCommands, ui, hierarchyCaptured});
    return result.availability === 'available' ? result : unavailable('no-supported-data');
  } catch (error) {
    return unavailable(error instanceof DiagnosticUnavailable ? error.reason
      : error instanceof SyntaxError ? 'invalid-metadata' : 'read-failed');
  }
}

module.exports = {
  collectLiveDiagnostics, sanitizeDiagnostics, parseCommands, parseHierarchy,
  COMMAND_KINDS, TARGET_IDS, ERROR_CODES, LIMITS, UNAVAILABLE_REASONS, UI_PRESENCE_IDS,
};
if (require.main === module) {
  const platform = process.argv[2];
  let expectedDeviceId;
  if (platform === 'android') {
    // The validator throws a fixed, input-free error if the trusted case is unavailable.
    const {validateLiveConfig} = require('./live-config');
    expectedDeviceId = validateLiveConfig(process.env.PAAD_LIVE_CONFIG, platform).cases.android.expectedDeviceId;
  }
  process.stdout.write(`${JSON.stringify(collectLiveDiagnostics({platform, expectedDeviceId}))}\n`);
}
