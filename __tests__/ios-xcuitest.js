const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const {
  createXCTestCase,
  configureXCTestRun,
} = require('../scripts/ci/ios-xcuitest-config');
const {
  PREFIX,
  MAX_LOG_BYTES,
  sanitizeNativeResult,
  parseNativeLog,
  nativeFlowPassed,
  STAGES, APPLICATION_STATES, FAILURE_CATEGORIES, TARGETS,
  INPUT_TARGETS, INPUT_PHASES, INPUT_ELEMENTS, INPUT_VALUES, INPUT_FLAGS,
  INTERACTION_TARGETS, INTERACTION_PHASES, INTERACTION_ELEMENTS, PERMISSION_ALERTS, INTERACTION_FLAGS,
} = require('../scripts/ci/ios-xcuitest-result');
const {sanitizeDiagnostics} = require('../scripts/ci/live-diagnostics');
const {validateEnvironment} = require('../scripts/ci/run-ios-xcuitest');

const liveConfig = {
  schemaVersion: 1,
  provisioningHost: 'global.azure-devices-provisioning.net',
  scopeId: '0ne00AABBCC',
  expectedHub: 'test-hub.azure-devices.net',
  cases: {
    ios: {
      registrationId: 'native-ios-test',
      expectedDeviceId: 'different-assigned-identity',
      nonce: 'ios_nonce_1234567890',
    },
  },
};
const key = Buffer.alloc(32, 2).toString('base64');
const nativeTarget = () => ({
  IsUITestBundle: true,
  UseUITargetAppProvidedByTests: true,
  TestBundlePath: '__TESTHOST__/PlugIns/PaadLiveUITests.xctest',
  TestHostPath:
    '__TESTROOT__/Release-iphonesimulator/PaadLiveUITests-Runner.app',
  TestingEnvironmentVariables: {
    DYLD_FRAMEWORK_PATH: '__TESTROOT__/Release-iphonesimulator',
  },
});
const manifest = () => ({
  __xctestrun_metadata__: {FormatVersion: 2},
  TestConfigurations: [{TestTargets: [nativeTarget()]}],
});
const nativeResult = (mode = 'live') => ({
  schemaVersion: 1,
  runner: 'xcuitest',
  mode,
  outcome: 'passed',
  stage: 'finished',
  applicationState: 'not-running',
  observedTargets: ['connection-status'],
  connected: mode === 'live',
  nonceSubmitted: mode === 'live',
  coldRestored: mode === 'live',
});
const inputDiagnostic = (phase = 'focused') => ({
  target: 'connection-registrationId',
  phase,
  element: 'text-field',
  value: 'empty',
  hasNewline: false,
  uiFocused: true,
  hittable: true,
  enabled: true,
  keyboardVisible: true,
});
const interactionDiagnostic = () => ({
  target: 'connection-details',
  phase: 'waiting-for-hittability',
  element: 'not-hittable',
  systemAlert: 'denial-hittable',
  applicationAlert: 'none',
  busyOverlay: false,
  keyboardVisible: false,
  permissionDismissed: false,
  permissionLimitReached: false,
});
const environment = mode => ({
  PAAD_VARIANT: 'ci',
  DEVELOPER_DIR: '/Applications/Xcode_26.6.app/Contents/Developer',
  IOS_SIMULATOR_DEVELOPER_DIR:
    '/Applications/Xcode_26.6.app/Contents/Developer',
  IOS_SIMULATOR_UDID: '12345678-1234-1234-1234-123456789ABC',
  ...(mode === 'live'
    ? {
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        PAAD_LIVE_CONFIRM: 'true',
        GITHUB_REF: 'refs/heads/feature/adr-onboarding',
        GITHUB_REPOSITORY_OWNER: 'owner',
        GITHUB_ACTOR: 'owner',
        GITHUB_SHA: 'a'.repeat(40),
        PAAD_LIVE_EXPECTED_SHA: 'a'.repeat(40),
        PAAD_IOS_UI_DRIVER: 'xcuitest',
        PAAD_LIVE_CONFIG: JSON.stringify(liveConfig),
        MAESTRO_DEVICE_KEY: key,
      }
    : {}),
});

test('native smoke uses fixed synthetic input and refuses even empty live inputs', () => {
  const result = createXCTestCase('smoke');
  expect(result.mode).toBe('smoke');
  expect(result.deviceKey).toBe(Buffer.alloc(64, 1).toString('base64'));
  expect(result.registrationId).toBe('paad-native-ui-fixture');
  for (const [input, secret] of [
    [liveConfig, undefined],
    ['', undefined],
    [undefined, ''],
    [undefined, key],
  ]) {
    expect(() => createXCTestCase('smoke', input, secret)).toThrow(
      'Live input rejected',
    );
  }
});

test('native live input preserves returned identity and real phone model without an app launch bypass', () => {
  expect(createXCTestCase('live', JSON.stringify(liveConfig), key)).toEqual({
    schemaVersion: 1,
    mode: 'live',
    modelId: 'dtmi:azureiot:PhoneAsADevice;2',
    provisioningHost: liveConfig.provisioningHost,
    scopeId: liveConfig.scopeId,
    expectedHub: liveConfig.expectedHub,
    ...liveConfig.cases.ios,
    deviceKey: key,
  });
  expect(() => createXCTestCase('other', liveConfig, key)).toThrow();
  expect(() =>
    createXCTestCase('live', {...liveConfig, deviceKey: key}, key),
  ).toThrow();
});

test.each([
  undefined,
  '',
  'KEY_CANARY',
  `${key}\n`,
  Buffer.alloc(15).toString('base64'),
  'A'.repeat(516),
])(
  'native runner rejects malformed key material without echoing it (%#)',
  value =>
    expect(() => createXCTestCase('live', liveConfig, value)).toThrow(
      'Invalid native UI device input',
    ),
);

test('private xctestrun relocates build paths and injects input only into the test runner', () => {
  const input = manifest();
  const products = path.resolve('build/ios-uitest-derived/Build/Products');
  const config = createXCTestCase('live', liveConfig, key);
  const result = configureXCTestRun(input, products, config);
  const target = result.TestConfigurations[0].TestTargets[0];
  expect(target.TestHostPath).toBe(
    `${products}/Release-iphonesimulator/PaadLiveUITests-Runner.app`,
  );
  expect(target.TestBundlePath).toBe(
    '__TESTHOST__/PlugIns/PaadLiveUITests.xctest',
  );
  expect(target.TestingEnvironmentVariables.DYLD_FRAMEWORK_PATH).toBe(
    `${products}/Release-iphonesimulator`,
  );
  expect(JSON.parse(target.EnvironmentVariables.PAAD_XCTEST_CASE)).toEqual(
    config,
  );
  expect(target.UITargetAppEnvironmentVariables).toEqual({});
  expect(target.UseUITargetAppProvidedByTests).toBe(true);
  expect(target.UITargetAppBundleIdentifier).toBeUndefined();
  expect(target.UITargetAppPath).toBeUndefined();
  expect(JSON.stringify(input)).not.toContain(key);
  expect(input).toEqual(manifest());
});

test('native manifest supports a single legacy target but fails closed on unexpected targets', () => {
  const products = '/owned/Products';
  expect(
    configureXCTestRun(
      {PaadLiveUITests: nativeTarget()},
      products,
      createXCTestCase('smoke'),
    ).PaadLiveUITests.EnvironmentVariables.PAAD_XCTEST_CASE,
  ).toBeDefined();
  for (const value of [
    {},
    {TestConfigurations: []},
    {TestConfigurations: [{TestTargets: [nativeTarget(), nativeTarget()]}]},
    {Other: {...nativeTarget(), IsUITestBundle: false}},
    {Other: {...nativeTarget(), TestBundlePath: '/unrelated.xctest'}},
    {Other: {...nativeTarget(), UseUITargetAppProvidedByTests: false}},
    {Other: {...nativeTarget(), UITargetAppPath: '/owned/IoTPnP.app'}},
    {Other: {...nativeTarget(), UITargetAppBundleIdentifier: 'com.microsoft.iotpnp.ci'}},
  ])
    expect(() => configureXCTestRun(value, products, {})).toThrow();
  expect(() => configureXCTestRun(manifest(), 'relative', {})).toThrow();
});

test('native lane is opt-in, precedes device input with synthetic smoke and retains Maestro default', () => {
  const workflow = yaml.load(
    fs.readFileSync('.github/workflows/live-device.yml', 'utf8'),
  );
  expect(workflow.on.workflow_dispatch.inputs.ios_driver).toMatchObject({
    type: 'choice',
    options: ['maestro', 'xcuitest'],
    default: 'maestro',
  });
  const steps = workflow.jobs.ios.steps;
  const build = steps.findIndex(
    step => step.run === 'bash scripts/ci/build-ios-uitests.sh',
  );
  const smoke = steps.findIndex(
    step => step.run === 'node scripts/ci/run-ios-xcuitest.js smoke',
  );
  const live = steps.findIndex(step => step.env?.MAESTRO_DEVICE_KEY);
  expect(build).toBeGreaterThan(0);
  expect(smoke).toBeGreaterThan(build);
  expect(live).toBeGreaterThan(smoke);
  expect(JSON.stringify(steps.slice(0, live))).not.toMatch(
    /secrets\.|MAESTRO_DEVICE_KEY/,
  );
  expect(steps[build].if).toBe("inputs.ios_driver == 'xcuitest'");
  expect(steps[smoke].if).toBe("inputs.ios_driver == 'xcuitest'");
  expect(steps[live].env.PAAD_IOS_UI_DRIVER).toBe('${{ inputs.ios_driver }}');
  expect(steps[live].if).toBe('${{ !inputs.ios_smoke_only }}');
  expect(workflow.on.workflow_dispatch.inputs.ios_smoke_only).toMatchObject({
    type: 'boolean', default: false,
  });
  expect(
    steps.find(step => step.run === 'bash scripts/ci/install-maestro.sh').if,
  ).toBe("inputs.ios_driver != 'xcuitest'");
});

test('native fixed-result parser strips extra fields and reports the last milestone only', () => {
  const value = {
    ...nativeResult(),
    extra: 'RAW_CANARY',
    error: {text: 'RAW_CANARY'},
  };
  const parsed = parseNativeLog(
    `RAW_CANARY\n${PREFIX}${JSON.stringify(value)}\n`,
    'live',
  );
  expect(parsed).toEqual(nativeResult());
  expect(nativeFlowPassed(parsed, 'live')).toBe(true);
  const later = {
    ...nativeResult(),
    outcome: 'failed',
    failureCategory: 'unexpected-issue',
  };
  expect(
    parseNativeLog(
      `${PREFIX}${JSON.stringify(value)}\n${PREFIX}${JSON.stringify(later)}`,
      'live',
    ),
  ).toEqual(later);
  expect(
    JSON.stringify(
      sanitizeDiagnostics({availability: 'available', nativeUi: value}),
    ),
  ).not.toContain('RAW_CANARY');
});

test('synthetic input checkpoints preserve before/after Return evidence without raw values', () => {
  const inputDiagnostics = INPUT_PHASES.map(phase => ({
    ...inputDiagnostic(phase),
    ...(phase === 'typed' ? {value: 'exact'} : {}),
    ...(['committed', 'settled'].includes(phase)
      ? {value: 'newline-suffix', hasNewline: true, keyboardVisible: false} : {}),
  }));
  const result = {
    ...nativeResult('smoke'), outcome: 'failed', stage: 'manual-navigation',
    failureCategory: 'value-mismatch', applicationState: 'running-foreground',
    inputDiagnostics,
  };
  const dirty = {
    ...result,
    inputDiagnostics: inputDiagnostics.map(entry => ({
      ...entry, rawValue: 'RAW_CANARY', placeholder: 'RAW_CANARY', expected: 'RAW_CANARY',
    })),
  };
  expect(parseNativeLog(`${PREFIX}${JSON.stringify(dirty)}`, 'smoke')).toEqual(result);
  expect(sanitizeDiagnostics({availability: 'available', nativeUi: dirty}).nativeUi).toEqual(result);
  expect(nativeFlowPassed(result, 'smoke')).toBe(false);
  expect(Buffer.byteLength(`${PREFIX}${JSON.stringify(result)}`)).toBeLessThan(4096);
});

test.each([
  null,
  {},
  [],
  Array(6).fill(inputDiagnostic()),
  [null],
  [{...inputDiagnostic(), target: 'RAW_CANARY'}],
  [{...inputDiagnostic(), target: 'connection-deviceKey'}],
  [{...inputDiagnostic(), phase: 'RAW_CANARY'}],
  [{...inputDiagnostic(), phase: 'typed'}],
  [{...inputDiagnostic(), element: 'RAW_CANARY'}],
  [{...inputDiagnostic(), value: 'RAW_CANARY'}],
  [inputDiagnostic(), {...inputDiagnostic('cleared'), target: 'connection-scopeId'}],
  ...INPUT_FLAGS.map(flag => [{...inputDiagnostic(), [flag]: 'true'}]),
])('native input diagnostics reject invalid, unbounded or mixed-target evidence (%#)', inputDiagnostics => {
  expect(sanitizeNativeResult({...nativeResult('smoke'), inputDiagnostics})).toBeUndefined();
});

test('native input diagnostics are smoke-only and remain optional for existing results', () => {
  expect(sanitizeNativeResult({
    ...nativeResult(), inputDiagnostics: [inputDiagnostic()],
  })).toBeUndefined();
  for (const mode of ['smoke', 'live']) {
    expect(sanitizeNativeResult(nativeResult(mode))).toEqual(nativeResult(mode));
  }
});

test.each(['smoke', 'live'])('Details interaction state is safe to publish in %s without raw UI data', mode => {
  const interactionDiagnostics = interactionDiagnostic();
  const result = {
    ...nativeResult(mode), outcome: 'failed', stage: 'connecting',
    applicationState: 'running-foreground', failureCategory: 'not-hittable',
    nonceSubmitted: false, coldRestored: false, interactionDiagnostics,
  };
  const dirty = {...result, interactionDiagnostics: {
    ...interactionDiagnostics, label: 'RAW_CANARY', value: 'RAW_CANARY',
    alert: {title: 'RAW_CANARY'}, deviceKey: 'RAW_CANARY',
  }};
  expect(parseNativeLog(`${PREFIX}${JSON.stringify(dirty)}`, mode)).toEqual(result);
  expect(sanitizeDiagnostics({availability: 'available', nativeUi: dirty}).nativeUi).toEqual(result);
  expect(nativeFlowPassed(result, mode)).toBe(false);
});

test.each([
  null,
  [],
  Array(50).fill(interactionDiagnostic()),
  {},
  {...interactionDiagnostic(), target: 'connection-deviceKey'},
  {...interactionDiagnostic(), target: 'RAW_CANARY'},
  {...interactionDiagnostic(), phase: 'RAW_CANARY'},
  {...interactionDiagnostic(), element: 'RAW_CANARY'},
  {...interactionDiagnostic(), systemAlert: 'RAW_CANARY'},
  {...interactionDiagnostic(), applicationAlert: 'RAW_CANARY'},
  ...INTERACTION_FLAGS.map(flag => ({...interactionDiagnostic(), [flag]: 'true'})),
])('native interaction state rejects non-allowlisted or unbounded evidence (%#)', interactionDiagnostics => {
  expect(sanitizeNativeResult({...nativeResult(), interactionDiagnostics})).toBeUndefined();
});

test.each(INTERACTION_PHASES)('native parser distinguishes the Details interaction phase %s', phase => {
  const result = {...nativeResult(), interactionDiagnostics: {...interactionDiagnostic(), phase}};
  expect(sanitizeNativeResult(result)).toEqual(result);
});

test('combined bounded diagnostics still fit the existing record limit', () => {
  const result = {
    ...nativeResult('smoke'), observedTargets: TARGETS,
    inputDiagnostics: INPUT_PHASES.map(phase => inputDiagnostic(phase)),
    interactionDiagnostics: interactionDiagnostic(),
  };
  const line = `${PREFIX}${JSON.stringify(result)}`;
  expect(Buffer.byteLength(line)).toBeLessThan(4096);
  expect(parseNativeLog(line, 'smoke')).toEqual(sanitizeNativeResult(result));
});

test.each([
  {stage: 'RAW_CANARY'},
  {applicationState: 'RAW_CANARY'},
  {observedTargets: ['RAW_CANARY']},
  {failureCategory: 'RAW_CANARY'},
  {execution: 'RAW_CANARY'},
  {nonceSubmitted: 'true'},
  {observedTargets: Array(100).fill('connection-status')},
])(
  'native diagnostics reject arbitrary source strings or wrong schema (%#)',
  fields => {
    expect(
      sanitizeNativeResult({...nativeResult(), ...fields}),
    ).toBeUndefined();
  },
);

test('native diagnostics bound log bytes, record size/count and malformed/mixed-mode output', () => {
  const line = `${PREFIX}${JSON.stringify(nativeResult())}`;
  expect(parseNativeLog('x'.repeat(MAX_LOG_BYTES + 1), 'live')).toBeUndefined();
  expect(
    parseNativeLog(`${PREFIX}${'x'.repeat(4096)}`, 'live'),
  ).toBeUndefined();
  expect(
    parseNativeLog(Array(65).fill(line).join('\n'), 'live'),
  ).toBeUndefined();
  expect(parseNativeLog(`${line}\n${PREFIX}{bad}`, 'live')).toBeUndefined();
  expect(parseNativeLog(line, 'smoke')).toBeUndefined();
  expect(parseNativeLog('no native completion record', 'live')).toBeUndefined();
});

test.each([
  {outcome: 'in-progress'},
  {stage: 'restoring'},
  {applicationState: 'running-foreground'},
  {nonceSubmitted: false},
  {coldRestored: false},
  {connected: false},
  {failureCategory: 'missing-element'},
])('a partial or contradictory native flow is not accepted (%#)', fields => {
  expect(nativeFlowPassed({...nativeResult(), ...fields}, 'live')).toBe(false);
});

test('smoke proof flags cannot stand in for live proof and vice versa', () => {
  expect(nativeFlowPassed(nativeResult('smoke'), 'smoke')).toBe(true);
  expect(nativeFlowPassed(nativeResult('smoke'), 'live')).toBe(false);
  expect(nativeFlowPassed(nativeResult(), 'smoke')).toBe(false);
});

test('native environment guards reject credentials in smoke and unauthorized live invocation', () => {
  expect(() =>
    validateEnvironment('smoke', environment('smoke')),
  ).not.toThrow();
  expect(() => validateEnvironment('live', environment('live'))).not.toThrow();
  for (const name of [
    'MAESTRO_DEVICE_KEY',
    'PAAD_LIVE_CONFIG',
    'GH_TOKEN',
    'GITHUB_TOKEN',
    'PAAD_XCTEST_CASE',
    'TEST_RUNNER_PAAD_XCTEST_CASE',
  ]) {
    expect(() =>
      validateEnvironment('smoke', {...environment('smoke'), [name]: ''}),
    ).toThrow();
  }
  for (const [name, value] of [
    ['PAAD_LIVE_CONFIRM', 'false'],
    ['GITHUB_EVENT_NAME', 'push'],
    ['GITHUB_REF', 'refs/heads/master'],
    ['GITHUB_ACTOR', 'not-owner'],
    ['PAAD_LIVE_EXPECTED_SHA', 'b'.repeat(40)],
    ['PAAD_IOS_UI_DRIVER', 'maestro'],
    ['IOS_SIMULATOR_UDID', 'booted'],
    ['PAAD_VARIANT', 'production'],
    ['PAAD_NATIVE_SMOKE_DIAGNOSTICS', 'true'],
  ])
    expect(() =>
      validateEnvironment('live', {...environment('live'), [name]: value}),
    ).toThrow();
  expect(() => validateEnvironment('smoke', {
    ...environment('smoke'), PAAD_NATIVE_SMOKE_DIAGNOSTICS: 'unexpected',
  })).toThrow();
});

function withRunner(mode, body, overrides = {}) {
  const original = process.cwd();
  const directory = fs.mkdtempSync(
    path.join(original, '.native-ui-unit-'),
  );
  const spawn = jest.spyOn(require('node:child_process'), 'spawnSync');
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    process.chdir(directory);
    for (const child of [
      'build/ios-uitest-derived/Build/Products',
      'build/ios-derived/Build/Products/Release-iphonesimulator/IoTPnP.app',
      ...(mode === 'live' ? ['build/live-device-private/results'] : []),
    ])
      fs.mkdirSync(child, {recursive: true});
    fs.writeFileSync(
      'build/ios-uitest-derived/Build/Products/PaadLiveUITests.xctestrun',
      'fixture',
    );
    spawn.mockImplementation((binary, args, options) => {
      if (binary === 'plutil' && args.includes('json'))
        return {status: 0, stdout: JSON.stringify(manifest())};
      if (binary === 'plutil') {
        expect(args).not.toContain(key);
        fs.writeFileSync(args[args.indexOf('-o') + 1], options.input);
        return {status: 0};
      }
      if (binary === 'xcodebuild') {
        expect(options.env.MAESTRO_DEVICE_KEY).toBeUndefined();
        expect(options.env.PAAD_LIVE_CONFIG).toBeUndefined();
        expect(args.join(' ')).not.toContain(key);
        expect(options.timeout).toBe(mode === 'live' ? 900000 : 420000);
        expect(args).toContain('test-without-building');
        expect(args).toContain('NO');
        const privateInput = JSON.parse(
          fs.readFileSync(args[args.indexOf('-xctestrun') + 1], 'utf8'),
        );
        const target = privateInput.TestConfigurations[0].TestTargets[0];
        expect(target.UITargetAppEnvironmentVariables).toEqual({});
        expect(target.UITargetAppPath).toBeUndefined();
        expect(target.UITargetAppBundleIdentifier).toBeUndefined();
        expect(
          JSON.parse(target.EnvironmentVariables.PAAD_XCTEST_CASE).mode,
        ).toBe(mode);
        fs.writeSync(
          options.stdio[1],
          `${overrides.logPrefix || 'RAW_CANARY'}\n${PREFIX}${JSON.stringify(
            overrides.result || nativeResult(mode),
          )}\n`,
        );
        return overrides.process || {status: 0};
      }
      if (binary === 'xcrun' && args[1] === 'spawn') {
        expect(mode).toBe('smoke');
        return overrides.runtime || {status: 0};
      }
      if (binary === 'xcrun' && args[1] === 'bootstatus') {
        expect(mode).toBe('smoke');
        expect(options.timeout).toBe(300000);
        expect(options.killSignal).toBe('SIGKILL');
        expect(args).toEqual(['simctl', 'bootstatus', environment(mode).IOS_SIMULATOR_UDID, '-b']);
        return {status: 0};
      }
      if (binary === 'xcrun' || binary === 'bash') return {status: 0};
      throw new Error('Unexpected fixture command');
    });
    jest.isolateModules(() => {
      const runner = require('../scripts/ci/run-ios-xcuitest');
      body(runner.executeNative(mode, {...environment(mode), ...overrides.env}), runner);
    });
    expect(error.mock.calls.flat().join(' ')).not.toContain('RAW_CANARY');
  } finally {
    process.chdir(original);
    spawn.mockRestore();
    error.mockRestore();
    fs.rmSync(directory, {recursive: true});
  }
}

test('native live orchestration keeps the key and raw logs private, publishing only fixed results', () => {
  withRunner('live', (passed, runner) => {
    expect(passed).toBe(true);
    expect(runner.readDiagnostics()).toEqual({
      availability: 'available',
      nativeUi: {...nativeResult(), execution: 'passed'},
    });
    expect(
      fs.readFileSync(
        'build/live-device-private/results/native-ui.json',
        'utf8',
      ),
    ).not.toMatch(/RAW_CANARY|deviceKey/);
  });
});

test.each(['waiting-for-hittability', 'dismissing-permission', 'tapping', 'waiting-for-sheet'])(
  'native live failure publishes only fixed %s state without changing proof or log retention',
  phase => {
    const interactionDiagnostics = {...interactionDiagnostic(), phase};
    withRunner('live', (passed, runner) => {
      expect(passed).toBe(false);
      expect(runner.readDiagnostics()).toMatchObject({
        availability: 'available',
        nativeUi: {
          connected: true, nonceSubmitted: false, coldRestored: false,
          failureCategory: 'not-hittable', interactionDiagnostics,
        },
      });
      const text = fs.readFileSync('build/live-device-private/results/native-ui.json', 'utf8');
      expect(text).not.toMatch(/RAW_CANARY|deviceKey|alertTitle/);
      expect(fs.existsSync('build/ios-ui-smoke.log')).toBe(false);
    }, {
      process: {status: 1},
      result: {
        ...nativeResult(), outcome: 'failed', stage: 'connecting',
        applicationState: 'running-foreground', failureCategory: 'not-hittable',
        nonceSubmitted: false, coldRestored: false,
        interactionDiagnostics: {
          ...interactionDiagnostics, alertTitle: 'RAW_CANARY', deviceKey: 'RAW_CANARY',
        },
      },
    });
  },
);

test.each([
  {status: 1},
  {status: 0, signal: 'SIGTERM'},
  {status: null, error: {code: 'ETIMEDOUT'}},
])(
  'a printed native pass never overrides a failed or timed-out process (%#)',
  processResult => {
    withRunner('live', passed => expect(passed).toBe(false), {
      process: processResult,
    });
  },
);

test('native zero exit without complete app proof remains a failure', () => {
  withRunner('live', passed => expect(passed).toBe(false), {
    result: {...nativeResult(), nonceSubmitted: false},
  });
});

test('native smoke deletes owned private state and writes only the fixed synthetic result', () => {
  withRunner('smoke', passed => {
    expect(passed).toBe(true);
    expect(fs.existsSync('build/ios-ui-smoke-private')).toBe(false);
    const text = fs.readFileSync('build/ios-ui-smoke-summary.json', 'utf8');
    expect(text).not.toMatch(/RAW_CANARY|deviceKey/);
    expect(JSON.parse(text)).toMatchObject({uiResult: 'passed'});
    expect(fs.existsSync('build/ios-ui-smoke.log')).toBe(false);
  });
});

test('native smoke summary carries bounded input diagnosis without upgrading failed exact proof', () => {
  const inputDiagnostics = INPUT_PHASES.map(phase => ({
    ...inputDiagnostic(phase), value: 'mismatch', rawValue: 'RAW_CANARY',
  }));
  withRunner('smoke', passed => {
    expect(passed).toBe(false);
    const text = fs.readFileSync('build/ios-ui-smoke-summary.json', 'utf8');
    expect(text).not.toContain('RAW_CANARY');
    expect(JSON.parse(text)).toMatchObject({
      uiResult: 'failed',
      diagnostics: {nativeUi: {
        stage: 'manual-navigation', failureCategory: 'value-mismatch',
        inputDiagnostics: INPUT_PHASES.map(phase => ({
          ...inputDiagnostic(phase), value: 'mismatch',
        })),
      }},
    });
    expect(fs.existsSync('build/ios-ui-smoke.log')).toBe(false);
    expect(fs.existsSync('build/ios-ui-smoke-private')).toBe(false);
  }, {
    process: {status: 1},
    result: {
      ...nativeResult('smoke'), outcome: 'failed', stage: 'manual-navigation',
      applicationState: 'running-foreground', failureCategory: 'value-mismatch',
      inputDiagnostics,
    },
  });
});

test('explicit credential-free smoke retains a bounded log but still removes private test state', () => {
  withRunner('smoke', passed => {
    expect(passed).toBe(true);
    expect(fs.readFileSync('build/ios-ui-smoke.log', 'utf8')).toContain('RAW_CANARY');
    expect(fs.existsSync('build/ios-ui-smoke-private')).toBe(false);
  }, {env: {PAAD_NATIVE_SMOKE_DIAGNOSTICS: 'true'}});
});

test('an unavailable optional no-secret runtime log does not replace UI proof or prevent cleanup', () => {
  withRunner('smoke', passed => {
    expect(passed).toBe(true);
    expect(fs.existsSync('build/ios-ui-smoke-private')).toBe(false);
    expect(fs.readFileSync('build/ios-ui-smoke.log', 'utf8')).toContain('runtime diagnostics (incomplete)');
  }, {
    env: {PAAD_NATIVE_SMOKE_DIAGNOSTICS: 'true'},
    runtime: {status: 1, stderr: 'SYNTHETIC_RUNTIME_ONLY'},
  });
});

test('oversized native output fails proof while credential-free diagnostics retain at most one MiB', () => {
  withRunner('smoke', passed => {
    expect(passed).toBe(false);
    expect(fs.statSync('build/ios-ui-smoke.log').size).toBe(MAX_LOG_BYTES);
    expect(fs.existsSync('build/ios-ui-smoke-private')).toBe(false);
  }, {
    env: {PAAD_NATIVE_SMOKE_DIAGNOSTICS: 'true'},
    logPrefix: 'x'.repeat(MAX_LOG_BYTES + 1),
  });
});

test('Swift diagnostics use only the parser vocabularies and stable public controls', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const values = name => {
    const body = swift.match(new RegExp(`private enum ${name}[^\\{]*\\{([\\s\\S]*?)\\n\\}`))[1];
    return [...body.matchAll(/^  case (\w+)(?: = "([^"]+)")?$/gm)].map(match => match[2] || match[1]);
  };
  expect(values('Stage').sort()).toEqual([...STAGES].sort());
  expect(values('ApplicationState').sort()).toEqual([...APPLICATION_STATES].sort());
  expect(values('InputPhase').sort()).toEqual([...INPUT_PHASES].sort());
  expect(values('InputElement').sort()).toEqual([...INPUT_ELEMENTS].sort());
  expect(values('InputValue').sort()).toEqual([...INPUT_VALUES].sort());
  expect(values('InteractionPhase').sort()).toEqual([...INTERACTION_PHASES].sort());
  expect(values('InteractionElement').sort()).toEqual([...INTERACTION_ELEMENTS].sort());
  expect(values('PermissionAlert').sort()).toEqual([...PERMISSION_ALERTS].sort());
  for (const value of values('Failure')) expect(FAILURE_CATEGORIES).toContain(value);
  for (const value of values('Target')) expect(TARGETS).toContain(value);
  expect(swift).toContain('FileHandle.standardOutput.write(Data("PAAD_XCTEST_RESULT:');
  expect(swift).not.toMatch(/screenshot\(\)|debugDescription|XCTAttachment\(/);
  expect(swift).not.toContain('"IoT Plug and Play"');
});

test('Details waits for real header hittability and sheet appearance without swipes or coordinate taps', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const open = swift.split('private func openDetails()')[1].split('private func waitForDetailsTarget(')[0];
  const events = [
    '.connectionDetails, phase: .waitingForHittability, failure: .notHittable',
    'pendingCategory = .notHittable',
    'InteractionPhase.tapping.rawValue',
    'emit(outcome: .inProgress)',
    'control.tap()',
    '.connectionDetailsSheet, phase: .waitingForSheet, failure: .missingElement',
    'InteractionPhase.sheetVisible.rawValue',
    'advance(to: .details)',
  ].map(text => open.indexOf(text));
  expect(events.every(index => index >= 0)).toBe(true);
  expect(events).toEqual([...events].sort((a, b) => a - b));
  const wait = swift.split('private func waitForDetailsTarget(')[1].split('private func requireIdentity(')[0];
  expect(wait).toContain('NSPredicate { [self] _, _ in');
  expect(wait).toContain('dismissKnownPermissionAlert()');
  expect(wait).toContain('ProcessInfo.processInfo.systemUptime + Timeout.standard');
  expect(wait).toContain('while ProcessInfo.processInfo.systemUptime < deadline');
  expect(wait).toContain('XCTNSPredicateExpectation(predicate: predicate, object: NSNull())');
  expect(wait).toContain('timeout: min(Timeout.interactionPoll, remaining)');
  expect(wait).toContain('throw failure');
  expect(wait.indexOf('XCTWaiter().wait(')).toBeLessThan(wait.indexOf('observe(target)'));
  expect(wait.split('let predicate =')[1].split('while ProcessInfo')[0]).not.toContain('dismissKnownPermissionAlert');
  expect(open + wait).not.toMatch(/swipe|coordinate|tap\(\.connectionDetails\)|try find\(|try hittable\(/i);
  const state = swift.split('private func updateInteraction(')[1].split('private func diagnoseInput(')[0];
  expect(state).toContain('target == .connectionDetailsSheet ? exists : state == .hittable');
  expect(state).toContain('targetReady && !busyOverlay && systemAlert == .none && applicationAlert == .none');
  expect(state).not.toMatch(/\.label\b|\.value\b|placeholderValue|debugDescription|screenshot/);
  expect(state).toContain('element(.appBusyOverlay).exists');
  expect(INTERACTION_TARGETS).toEqual(['connection-details', 'connection-details-sheet']);
  const record = swift.split('override func record(')[1].split('// MARK: Entry point')[0];
  expect(record).not.toMatch(/updateInteraction|app\.|permissionAlertState/);
});

test('explicit and interruption permission handling share a bounded allowlisted denial action', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const setup = swift.split('override func setUp()')[1].split('override func tearDown()')[0];
  expect(setup).toContain('self?.denyPermissionAlert(alert) ?? false');
  const dismissal = swift.split('private func dismissKnownPermissionAlert()')[1]
    .split('// MARK: Configuration')[0];
  expect(dismissal).toContain('[springBoard.alerts.firstMatch, app.alerts.firstMatch]');
  expect(dismissal).toContain('permissionAttempts < Permission.maximumAttempts, alert.exists');
  expect(dismissal).toContain('for label in Self.permissionDenyLabels');
  expect(dismissal).toContain('button.exists && button.isHittable');
  const events = [
    'permissionAttempts += 1',
    'InteractionPhase.dismissingPermission.rawValue', 'emit(outcome: .inProgress)',
    'button.tap()', 'permissionDismissed = true',
    'pendingCategory = previousCategory',
  ].map(text => dismissal.indexOf(text));
  expect(events.every(index => index >= 0)).toBe(true);
  expect(events).toEqual([...events].sort((a, b) => a - b));
  expect(swift).toContain('static let maximumAttempts = 4');
  expect(dismissal).not.toMatch(/buttons\.firstMatch|coordinate|\.label\b|\.value\b|while /);
  const classify = swift.split('private func permissionAlertState(')[1]
    .split('private func updateInteraction(')[0];
  expect(classify).toContain('var state: PermissionAlert = .other');
  expect(classify).toContain('return .denialHittable');
  expect(classify).not.toMatch(/\.tap\(|\.label\b|\.value\b/);
});

test('input diagnosis brackets real keystrokes, leaves exact proof strict, and excludes live/secure input', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const entry = swift.split('private func enterExactText(')[1].split('private func enterSecret(')[0];
  const events = [
    'inputDiagnostics = []', 'focusField(target)', 'phase: .focused',
    'clearField(field)', 'phase: .cleared', 'typeCharacters(text, into: field)', 'phase: .typed',
    'commitField(field)', 'phase: .committed', 'requireExactValue(on: field',
    'phase: .settled', 'throw failure',
  ].map(text => entry.indexOf(text));
  expect(events.every(index => index >= 0)).toBe(true);
  expect(events).toEqual([...events].sort((a, b) => a - b));
  const exact = swift.split('private func requireExactValue(')[1].split('private func requireExactText(')[0];
  expect(exact).toContain('(field.value as? String) == text');
  expect(exact).toContain('on: NSNull(), timeout: Timeout.short, failure: failure');
  expect(exact).not.toMatch(/trimmingCharacters|placeholderValue|NSPredicate\(format:/);
  const commit = swift.split('private func commitField(')[1].split('private func enterExactText(')[0];
  expect(commit).toContain('field.typeText("\\n")');
  const diagnostic = swift.split('private func diagnoseInput(')[1].split('private func advance(')[0];
  expect(diagnostic).toContain('guard mode == "smoke"');
  expect(diagnostic).toContain('[.formRegistrationId, .formScopeId, .formProvisioningHost].contains(target)');
  expect(INPUT_TARGETS).toEqual([
    'connection-registrationId', 'connection-scopeId', 'connection-provisioningHost',
  ]);
  expect(diagnostic).toContain('kind != .secureTextField ? field.value : nil');
  expect(diagnostic).toContain('"value": value.rawValue');
  expect(diagnostic).not.toMatch(/print\(|debugDescription|value\(forKey:|String\(describing:/);
  const secret = swift.split('private func enterSecret(')[1].split('private func requireMaskedEntry(')[0];
  expect(secret).toContain('inputDiagnostics = []');
  expect(secret).not.toContain('diagnoseInput(');
  expect(secret).toContain('typeCharacters(secret, into: field)');
  expect(secret).toContain('requireMaskedEntry(field, expectedLength: secret.count)');
  const typing = swift.split('private func typeCharacters(')[1].split('@discardableResult')[0];
  expect(typing).toContain('for character in text');
  expect(typing).toContain('field.typeText(String(character))');
  expect(typing).not.toMatch(/setValue|paste|UIPasteboard|sleep|usleep/);
});

test('native smoke never submits credentials and live cold restoration uses an actual process stop', () => {
  const swift = fs.readFileSync('scripts/ci/PaadLiveUITests.swift', 'utf8');
  const smoke = swift.split('private func runSmoke(')[1].split('private func runLive(')[0];
  expect(smoke).not.toMatch(/tap\(\.formSubmit\)|tap\(\.proofSend\)/);
  expect(smoke).toContain('requireExists(.formSubmit');
  expect(swift).toContain('app.terminate()');
  expect(swift).toContain('app.wait(for: .notRunning');
  expect(swift).toContain('guard app.state == .notRunning else');
  expect(swift.match(/app\.activate\(\)/g)).toHaveLength(2);
  expect(swift).not.toContain('app.launch()');
  expect(swift.match(/app.launchEnvironment = \[:\]/g)).toHaveLength(3);
  expect(swift).not.toMatch(/app\.launchEnvironment\s*=\s*(?:ProcessInfo|config)/);
  expect(swift).not.toContain('func finalize(');
  const finalized = swift.split('private func emitFinalResult()')[1].split('private func refreshApplicationState')[0];
  expect(finalized).not.toContain('app.state');
  expect(finalized).toContain('failureCount');
  expect(finalized).toContain('stage == .finished && applicationState == .notRunning');
});

test('native project and build preserve existing app signing and reject reused or arbitrary deletion roots', () => {
  const ruby = fs.readFileSync('scripts/ci/create-ios-uitest-project.rb', 'utf8');
  const build = fs.readFileSync('scripts/ci/build-ios-uitests.sh', 'utf8');
  expect(ruby).not.toMatch(/rm_rf|rm_r\b/);
  expect(ruby).toContain("project_dir == File.join(build, 'ios-uitest')");
  expect(ruby).toContain('!File.exist?(project_dir)');
  expect(ruby).toContain("new_target(:ui_test_bundle, NAME");
  expect(build).not.toMatch(/rm -rf|\|\| :/);
  expect(build).toContain('MAESTRO_DEVICE_KEY+x');
  expect(build).toContain('TEST_RUNNER_PAAD_XCTEST_CASE+x');
  expect(build).toContain('test ! -e build/ios-uitest-derived');
  expect(build).toContain('UseUITargetAppProvidedByTests');
  expect(build).toContain('codesign --verify --strict --deep "$app"');
  expect(build).toContain('= "$app_identity"');
});
