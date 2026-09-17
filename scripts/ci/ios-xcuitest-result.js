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
  return {
    schemaVersion: 1, runner: 'xcuitest', mode: value.mode, outcome: value.outcome,
    stage: value.stage, applicationState: value.applicationState,
    ...(value.failureCategory ? {failureCategory: value.failureCategory} : {}),
    observedTargets: [...new Set(value.observedTargets)].sort(),
    connected: value.connected, nonceSubmitted: value.nonceSubmitted, coldRestored: value.coldRestored,
    ...(value.execution ? {execution: value.execution} : {}),
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
  sanitizeNativeResult, parseNativeLog, nativeFlowPassed,
};
