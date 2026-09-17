'use strict';

const PREFIX = 'PAAD_XCTEST_RESULT:';
const MAX_LOG_BYTES = 1024 * 1024;
const STAGES = Object.freeze([
  'starting', 'welcome', 'manual-navigation', 'registration-input', 'scope-input',
  'host-input', 'key-input', 'connecting', 'details', 'identity', 'nonce',
  'submitting', 'terminating', 'restoring', 'restored-identity', 'finished',
]);
const APPLICATION_STATES = Object.freeze([
  'unknown', 'not-running', 'running-background-suspended', 'running-background', 'running-foreground',
]);
const FAILURE_CATEGORIES = Object.freeze([
  'configuration', 'missing-element', 'not-hittable', 'value-mismatch',
  'keyboard-unavailable', 'connection-timeout', 'submission-timeout',
  'termination-failed', 'restore-timeout', 'unexpected-issue', 'deadline-exceeded',
  'launch-failed', 'secret-not-masked', 'registry-changed',
]);
const EXECUTIONS = Object.freeze([
  'passed', 'nonzero-exit', 'deadline-exceeded', 'signal', 'spawn-failed', 'invalid-result',
]);
const TARGETS = Object.freeze([
  'registration-manual', 'registration-back', 'connection-registrationId',
  'connection-scopeId', 'connection-provisioningHost', 'connection-deviceKey',
  'connection-submit', 'connection-status', 'connection-details', 'connection-details-sheet',
  'connection-details-close', 'assigned-device-id', 'assigned-hub', 'model-id',
  'registration-id', 'registry-status', 'proof-nonce', 'proof-send', 'proof-status',
  'app-busy-overlay', 'navigation-content', 'connection-error',
]);
const INPUT_TARGETS = Object.freeze([
  'connection-registrationId', 'connection-scopeId', 'connection-provisioningHost',
]);
const INPUT_PHASES = Object.freeze(['focused', 'cleared', 'typed', 'committed', 'settled']);
const INPUT_ELEMENTS = Object.freeze(['missing', 'text-field', 'secure-text-field', 'text-view', 'other']);
const INPUT_VALUES = Object.freeze([
  'unavailable', 'non-string', 'empty', 'placeholder', 'exact',
  'newline-suffix', 'whitespace-difference', 'mismatch',
]);
const INPUT_FLAGS = Object.freeze(['hasNewline', 'uiFocused', 'hittable', 'enabled', 'keyboardVisible']);
const INTERACTION_TARGETS = Object.freeze(['connection-details', 'connection-details-sheet']);
const INTERACTION_PHASES = Object.freeze([
  'waiting-for-hittability', 'dismissing-permission', 'tapping', 'waiting-for-sheet', 'sheet-visible',
]);
const INTERACTION_ELEMENTS = Object.freeze(['missing', 'disabled', 'not-hittable', 'hittable']);
const PERMISSION_ALERTS = Object.freeze(['none', 'other', 'denial-present', 'denial-hittable']);
const INTERACTION_FLAGS = Object.freeze([
  'busyOverlay', 'keyboardVisible', 'permissionDismissed', 'permissionLimitReached',
]);

function sanitizeInputDiagnostics(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > INPUT_PHASES.length ||
      value.some((entry, index) => !entry || typeof entry !== 'object' || Array.isArray(entry) ||
        !INPUT_TARGETS.includes(entry.target) || entry.target !== value[0].target ||
        entry.phase !== INPUT_PHASES[index] || !INPUT_ELEMENTS.includes(entry.element) ||
        !INPUT_VALUES.includes(entry.value) ||
        INPUT_FLAGS.some(flag => typeof entry[flag] !== 'boolean'))) return undefined;
  return value.map(entry => ({
    target: entry.target, phase: entry.phase, element: entry.element, value: entry.value,
    ...Object.fromEntries(INPUT_FLAGS.map(flag => [flag, entry[flag]])),
  }));
}

function sanitizeInteractionDiagnostics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !INTERACTION_TARGETS.includes(value.target) || !INTERACTION_PHASES.includes(value.phase) ||
      !INTERACTION_ELEMENTS.includes(value.element) || !PERMISSION_ALERTS.includes(value.systemAlert) ||
      !PERMISSION_ALERTS.includes(value.applicationAlert) ||
      INTERACTION_FLAGS.some(flag => typeof value[flag] !== 'boolean')) return undefined;
  return {
    target: value.target, phase: value.phase, element: value.element,
    systemAlert: value.systemAlert, applicationAlert: value.applicationAlert,
    ...Object.fromEntries(INTERACTION_FLAGS.map(flag => [flag, value[flag]])),
  };
}

function sanitizeNativeResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      value.schemaVersion !== 1 || value.runner !== 'xcuitest' ||
      !['smoke', 'live'].includes(value.mode) ||
      !['in-progress', 'passed', 'failed'].includes(value.outcome) ||
      !STAGES.includes(value.stage) || !APPLICATION_STATES.includes(value.applicationState) ||
      !['connected', 'nonceSubmitted', 'coldRestored'].every(key => typeof value[key] === 'boolean') ||
      !Array.isArray(value.observedTargets) || value.observedTargets.length > TARGETS.length ||
      value.observedTargets.some(id => !TARGETS.includes(id)) ||
      (value.failureCategory !== undefined && !FAILURE_CATEGORIES.includes(value.failureCategory)) ||
      (value.execution !== undefined && !EXECUTIONS.includes(value.execution))) return undefined;
  const inputDiagnostics = value.inputDiagnostics === undefined ? undefined
    : sanitizeInputDiagnostics(value.inputDiagnostics);
  if (value.inputDiagnostics !== undefined && (value.mode !== 'smoke' || !inputDiagnostics)) return undefined;
  const interactionDiagnostics = value.interactionDiagnostics === undefined ? undefined
    : sanitizeInteractionDiagnostics(value.interactionDiagnostics);
  if (value.interactionDiagnostics !== undefined && !interactionDiagnostics) return undefined;
  return {
    schemaVersion: 1, runner: 'xcuitest', mode: value.mode, outcome: value.outcome,
    stage: value.stage, applicationState: value.applicationState,
    ...(value.failureCategory ? {failureCategory: value.failureCategory} : {}),
    observedTargets: [...new Set(value.observedTargets)].sort(),
    connected: value.connected, nonceSubmitted: value.nonceSubmitted, coldRestored: value.coldRestored,
    ...(value.execution ? {execution: value.execution} : {}),
    ...(inputDiagnostics ? {inputDiagnostics} : {}),
    ...(interactionDiagnostics ? {interactionDiagnostics} : {}),
  };
}

function parseNativeLog(text, mode) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_LOG_BYTES) return undefined;
  let result;
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    const index = line.indexOf(PREFIX);
    if (index === -1) continue;
    if (++count > 64 || Buffer.byteLength(line) > 4096) return undefined;
    try {
      const candidate = sanitizeNativeResult(JSON.parse(line.slice(index + PREFIX.length)));
      if (!candidate || candidate.mode !== mode) return undefined;
      result = candidate;
    } catch {
      return undefined;
    }
  }
  return result;
}

function nativeFlowPassed(result, mode) {
  return result?.mode === mode && result.outcome === 'passed' && result.stage === 'finished' &&
    result.applicationState === 'not-running' && !result.failureCategory &&
    ['connected', 'nonceSubmitted', 'coldRestored'].every(key => result[key] === (mode === 'live'));
}

module.exports = {
  PREFIX, MAX_LOG_BYTES, STAGES, APPLICATION_STATES, FAILURE_CATEGORIES, EXECUTIONS, TARGETS,
  INPUT_TARGETS, INPUT_PHASES, INPUT_ELEMENTS, INPUT_VALUES, INPUT_FLAGS,
  INTERACTION_TARGETS, INTERACTION_PHASES, INTERACTION_ELEMENTS, PERMISSION_ALERTS, INTERACTION_FLAGS,
  sanitizeNativeResult, parseNativeLog, nativeFlowPassed,
};
