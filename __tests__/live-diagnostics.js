const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const liveConfig = require('../scripts/ci/live-config');
const {
  collectLiveDiagnostics, sanitizeDiagnostics, parseCommands, parseHierarchy,
  COMMAND_KINDS, ERROR_CODES, LIMITS, UNAVAILABLE_REASONS, UI_PRESENCE_IDS,
} = require('../scripts/ci/live-diagnostics');

const CANARY = 'SECRET_CANARY';
const command = (kind = 'assertConditionCommand') => ({
  command: {
    [kind]: {
      condition: {visible: {idRegex: 'connection-status', textRegex: CANARY}},
      text: CANARY, inputText: CANARY, env: {key: CANARY}, label: CANARY,
      selector: {idRegex: CANARY, textRegex: CANARY, below: {idRegex: CANARY}},
      payload: CANARY, originalDescription: CANARY,
    },
    unknownCommand: CANARY,
  },
  metadata: {
    status: 'FAILED', sequenceNumber: 42, timestamp: CANARY, duration: CANARY, depth: CANARY,
    error: {message: CANARY, debugMessage: CANARY, stack: CANARY},
    evaluatedCommand: {inputTextCommand: {text: CANARY}},
    artifacts: [{type: CANARY, path: CANARY}],
    env: {key: CANARY},
  },
  inputText: CANARY, environment: {key: CANARY}, payload: CANARY,
});
const node = (id, text, children = []) => ({
  attributes: {
    'resource-id': id, text, accessibilityText: CANARY, hintText: CANARY,
    value: CANARY, title: CANARY, bounds: CANARY, payload: CANARY,
  },
  children, error: {message: CANARY, debugMessage: CANARY}, payload: CANARY,
});
const hierarchy = () => node(CANARY, CANARY, [
  node('connection-deviceKey', CANARY),
  node('connection-error-code', 'AUTHENTICATION_FAILED'),
  node('connection-service-code', '401002'),
  node('proof-status', 'Submitted locally'),
]);

afterEach(() => jest.restoreAllMocks());

test.each(COMMAND_KINDS)('allows only safe command metadata for %s', kind => {
  const result = parseCommands([command(kind)]);
  expect(result).toEqual([{sequenceNumber: 42, commandKind: kind, targetId: 'connection-status'}]);
  expect(JSON.stringify(result)).not.toContain(CANARY);
});

test.each(['tapOnElement', 'scrollUntilVisible'])('reads pinned selector shape for %s', kind => {
  const input = command(kind);
  input.command[kind].selector.idRegex = 'proof-send';
  expect(parseCommands([input])[0].targetId).toBe('proof-send');
});

test.each([
  ['Assertion is false: ', 'assertion-failed'],
  ['Device became unreachable during ', 'device-unreachable'],
  ['iOS driver not ready in time,', 'ios-driver-startup-timeout'],
  ['Failed to get screenshot: Timed out while requesting screenshot.', 'screenshot-timeout'],
])('classifies fixed framework error prefixes without exporting their details (%#)', (prefix, category) => {
  const input = command();
  input.metadata.error.message = prefix + CANARY;
  const commands = parseCommands([input]);
  expect(commands[0].failureCategory).toBe(category);
  const result = sanitizeDiagnostics({availability: 'available', failedCommands: commands});
  expect(result.failedCommands[0].failureCategory).toBe(category);
  expect(JSON.stringify(result)).not.toContain(CANARY);
});

test('rejects arbitrary failure categories and untyped hierarchy availability', () => {
  const result = sanitizeDiagnostics({
    availability: 'available', hierarchyCaptured: CANARY,
    failedCommands: [{sequenceNumber: 1, commandKind: 'assertCommand', failureCategory: CANARY}],
  });
  expect(result).toEqual({
    availability: 'available', failedCommands: [{sequenceNumber: 1, commandKind: 'assertCommand'}], ui: {},
  });
});

test('ignores unknown kinds, nonfailed commands and invalid sequence numbers', () => {
  for (const value of [CANARY, -1, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const input = command();
    input.metadata.sequenceNumber = value;
    expect(parseCommands([input])).toEqual([]);
  }
  const input = command(CANARY);
  expect(parseCommands([input])).toEqual([]);
  const completed = command();
  completed.metadata.status = 'COMPLETED';
  expect(parseCommands([completed])).toEqual([]);
  expect(() => parseCommands({error: CANARY})).toThrow('Unavailable');
  expect(() => parseCommands(Array(LIMITS.commands + 1).fill(null))).toThrow('Unavailable');
});

test('never exports selector textRegex even for a known UI target', () => {
  const input = command('tapOnElement');
  input.command.tapOnElement.selector = {idRegex: 'connection-deviceKey', textRegex: CANARY};
  expect(parseCommands([input])).toEqual([{
    sequenceNumber: 42, commandKind: 'tapOnElement', targetId: 'connection-deviceKey',
  }]);
});

test('reads only safe status IDs and literals from private hierarchy', () => {
  expect(parseHierarchy(hierarchy())).toEqual({
    connectionErrorCode: 'AUTHENTICATION_FAILED', connectionServiceCode: 401002,
    proofStatus: 'Submitted locally',
  });
  expect(JSON.stringify(parseHierarchy(hierarchy()))).not.toContain(CANARY);
});

test.each(UI_PRESENCE_IDS)('records only fixed target presence, never the value of %s', id => {
  const ui = parseHierarchy(node(id, CANARY));
  expect(ui).toEqual({observedTargets: [id]});
  expect(sanitizeDiagnostics({availability: 'available', ui}).ui).toEqual(ui);
  expect(JSON.stringify(ui)).not.toContain(CANARY);
});

test('classifies only fixed untagged UI labels and exact connection-state values', () => {
  const input = node(undefined, 'IoT PnP', [
    node(undefined, 'Connecting to the assigned IoT Hub...'),
    node('connection-deviceKey', 'Cancel'),
    node('connection-status', 'Connected'),
    node(undefined, CANARY),
  ]);
  const ui = parseHierarchy(input);
  expect(ui).toEqual({
    observedTargets: ['connection-status'],
    observedLabels: ['app-root', 'connecting'],
    connectionState: 'Connected',
  });
  expect(sanitizeDiagnostics({availability: 'available', ui}).ui).toEqual(ui);
  expect(JSON.stringify(ui)).not.toContain(CANARY);
});

test('rejects arbitrary labels and connection-state data at the report boundary', () => {
  const ui = sanitizeDiagnostics({
    availability: 'available',
    failedCommands: [{sequenceNumber: 1, commandKind: 'assertCommand'}],
    ui: {observedLabels: ['app-root', CANARY], connectionState: CANARY, text: CANARY},
  }).ui;
  expect(ui).toEqual({observedLabels: ['app-root']});
  expect(JSON.stringify(ui)).not.toContain(CANARY);
});

test('presence metadata rejects arbitrary values, duplicates and excessive collections', () => {
  expect(sanitizeDiagnostics({availability: 'available', ui: {
    observedTargets: ['model-id', CANARY, 'model-id'],
  }}).ui).toEqual({observedTargets: ['model-id']});
  for (const targets of [CANARY, [CANARY], [true], [{id: 'model-id'}],
    Array(UI_PRESENCE_IDS.length + 1).fill('model-id')]) {
    expect(sanitizeDiagnostics({availability: 'available', ui: {observedTargets: targets}}))
      .toEqual({availability: 'unavailable'});
  }
  expect(parseHierarchy(node(CANARY, 'model-id'))).toEqual({});
});

test.each(ERROR_CODES)('accepts exact connection enum %s on iOS accessibility text', code => {
  const input = node('connection-error-code', CANARY);
  input.attributes.accessibilityText = code;
  expect(parseHierarchy(input)).toEqual({connectionErrorCode: code});
});

test.each([
  ["Quickstep isn't responding", 'quickstep-anr'],
  ["System UI isn't responding", 'system-ui-anr'],
  ["IoT Plug and Play isn't responding", 'paad-anr'],
])('exports only a known system-dialog category (%#)', (text, code) => {
  const ui = parseHierarchy(node('android:id/alertTitle', text));
  expect(ui).toEqual({systemDialog: code});
  expect(sanitizeDiagnostics({availability: 'available', ui}).ui).toEqual({systemDialog: code});
});

test('never exports arbitrary dialog titles or unknown categories', () => {
  expect(parseHierarchy(node('android:id/alertTitle', CANARY))).toEqual({});
  expect(sanitizeDiagnostics({availability: 'available', ui: {systemDialog: CANARY}}))
    .toEqual({availability: 'unavailable'});
});

test.each([100, 200, 400, 401, 429, 503, 599])('exposes only the numeric HTTP status %s', status => {
  const result = parseHierarchy(node('connection-http-status', `HTTP ${status}`));
  expect(result).toEqual({connectionHttpStatus: status});
  expect(sanitizeDiagnostics({availability: 'available', ui: result})).toEqual({
    availability: 'available', failedCommands: [], ui: {connectionHttpStatus: status},
  });
});

test.each([CANARY, 'HTTP 099', 'HTTP 600', 'HTTP 400\n', 'HTTP 400 SECRET', '400', 400])(
  'rejects unexpected HTTP status text (%#)', text => {
    expect(parseHierarchy(node('connection-http-status', text))).toEqual({});
  },
);

test.each([99, 600, Infinity, NaN, 400.5, '400'])(
  'rejects invalid report HTTP status (%#)', status => {
    expect(sanitizeDiagnostics({availability: 'available', ui: {connectionHttpStatus: status}}))
      .toEqual({availability: 'unavailable'});
  },
);

test.each([CANARY, 'AUTHENTICATION_FAILED\n', 'CLOUD_CONFIRMED', 'Connected'])(
  'rejects unapproved error and proof values (%#)', value => {
    expect(parseHierarchy(node('connection-error-code', value))).toEqual({});
    expect(parseHierarchy(node('proof-status', value))).toEqual({});
  },
);

test.each([CANARY, '401\n', '-1', '1.1', 'Infinity', '9007199254740992', 401])(
  'rejects unsafe service codes (%#)', value => {
    expect(parseHierarchy(node('connection-service-code', value))).toEqual({});
  },
);

test('caps hierarchy nodes and depth', () => {
  expect(() => parseHierarchy(node(CANARY, CANARY, Array(LIMITS.nodes).fill({}))))
    .toThrow('Unavailable');
  let tree = {};
  for (let i = 0; i <= LIMITS.hierarchyDepth; i++) tree = {children: [tree]};
  expect(() => parseHierarchy(tree)).toThrow('Unavailable');
});

test('sanitizes final report fields independently of the parser', () => {
  const result = sanitizeDiagnostics({
    availability: 'available',
    failedCommands: [{sequenceNumber: 2, commandKind: 'inputTextCommand', targetId: CANARY,
      inputText: CANARY, error: {message: CANARY}}],
    ui: {connectionErrorCode: CANARY, connectionServiceCode: CANARY, proofStatus: CANARY},
    env: {key: CANARY}, message: CANARY, debugMessage: CANARY, payload: CANARY,
  });
  expect(result).toEqual({
    availability: 'available', failedCommands: [{sequenceNumber: 2, commandKind: 'inputTextCommand'}], ui: {},
  });
  expect(sanitizeDiagnostics({availability: CANARY})).toEqual({availability: 'unavailable'});
});

// Model only task-owned paths, never credentials or real process environment.
function mockArtifacts(contents = {}, links = []) {
  const root = path.resolve('build/live-device-private');
  const entries = new Map([
    [path.dirname(root), {kind: 'directory'}],
    [root, {kind: 'directory'}],
    [path.join(root, 'results'), {kind: 'directory'}],
    [path.join(root, 'debug'), {kind: 'directory'}],
  ]);
  for (const [relative, value] of Object.entries(contents)) {
    const filename = path.join(root, relative);
    let parent = path.dirname(filename);
    while (parent.startsWith(root) && !entries.has(parent)) {
      entries.set(parent, {kind: 'directory'});
      parent = path.dirname(parent);
    }
    entries.set(filename, {kind: 'file', data: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))});
  }
  for (const relative of links) entries.set(path.join(root, relative), {kind: 'link'});
  const lookup = filename => {
    if (!entries.has(filename)) throw Object.assign(new Error(CANARY), {code: 'ENOENT'});
    return entries.get(filename);
  };
  const stat = entry => ({
    isDirectory: () => entry.kind === 'directory', isFile: () => entry.kind === 'file',
    isSymbolicLink: () => entry.kind === 'link', size: entry.data?.length || 0, dev: 1, ino: 2,
  });
  jest.spyOn(fs, 'lstatSync').mockImplementation(filename => stat(lookup(filename)));
  jest.spyOn(fs, 'opendirSync').mockImplementation(directory => {
    const children = [...entries.keys()].filter(filename => filename !== directory && path.dirname(filename) === directory);
    return {readSync: () => children.length ? {name: path.basename(children.shift())} : null, closeSync: jest.fn()};
  });
  const opened = jest.spyOn(fs, 'openSync').mockImplementation((filename, flags) => {
    expect(flags & fs.constants.O_NOFOLLOW).toBe(fs.constants.O_NOFOLLOW);
    lookup(filename);
    return filename;
  });
  jest.spyOn(fs, 'fstatSync').mockImplementation(fd => stat(lookup(fd)));
  jest.spyOn(fs, 'readSync').mockImplementation((fd, buffer) => lookup(fd).data.copy(buffer));
  jest.spyOn(fs, 'closeSync').mockImplementation(() => {});
  return {root, opened};
}

test('unions fixed target presence across failure captures without claiming visibility', () => {
  mockArtifacts({
    'results/session/flow/screen-hierarchy/step-041.json': node('connection-details', CANARY),
    'results/session/flow/screen-hierarchy/step-042.json': node('connection-details-close', CANARY, [
      node('model-id', CANARY),
    ]),
  });
  expect(collectLiveDiagnostics()).toEqual({
    availability: 'available', failedCommands: [], hierarchyCaptured: true,
    ui: {observedTargets: ['connection-details', 'connection-details-close', 'model-id']},
  });
});

test('traverses only fixed private results/debug and never follows links or opens raw output', () => {
  const {root, opened} = mockArtifacts({
    'results/session/flow/commands.json': [command()],
    'results/session/flow/screen-hierarchy/step-042.json': hierarchy(),
    'results/session/flow/screenshots/SECRET_CANARY.png': CANARY,
    'results/session/flow/logs/commands.json': CANARY,
    'debug/maestro.log': CANARY,
    'home/commands.json': CANARY,
    'scratch/commands.json': CANARY,
    'commands.json': CANARY,
  }, ['results/link', 'debug/commands.json']);
  const result = collectLiveDiagnostics();
  expect(result.availability).toBe('available');
  expect(result.failedCommands[0].sequenceNumber).toBe(42);
  expect(result.ui.connectionErrorCode).toBe('AUTHENTICATION_FAILED');
  expect(result.hierarchyCaptured).toBe(true);
  expect(opened.mock.calls.map(call => path.relative(root, call[0]))).toEqual([
    'results/session/flow/commands.json', 'results/session/flow/screen-hierarchy/step-042.json',
  ]);
  expect(JSON.stringify(result)).not.toContain(CANARY);
});

test('distinguishes missing hierarchy from a captured tree without allowlisted targets', () => {
  mockArtifacts({'results/commands.json': [command()]});
  expect(collectLiveDiagnostics().hierarchyCaptured).toBe(false);
  jest.restoreAllMocks();
  mockArtifacts({
    'results/commands.json': [command()],
    'results/screen-hierarchy/step.json': node(CANARY, CANARY),
  });

  expect(collectLiveDiagnostics().hierarchyCaptured).toBe(true);
  expect(collectLiveDiagnostics().ui).toEqual({});
});

test('independently sanitizes the bounded post-failure capture without opening raw logs', () => {
  mockArtifacts({
    'results/commands.json': [command()],
    'results/post-failure-ui.json': {
      source: 'post-failure-ios-hierarchy',
      ui: {observedTargets: ['app-busy-overlay', CANARY], message: CANARY},
      rawHierarchy: CANARY,
    },
  });
  const result = collectLiveDiagnostics();
  expect(result.hierarchyCaptured).toBe(true);
  expect(result.ui).toEqual({observedTargets: ['app-busy-overlay']});
  expect(JSON.stringify(result)).not.toContain(CANARY);
});

test.each([
  ['{SECRET_CANARY', 'invalid-metadata'],
  ['{}', 'invalid-metadata'],
  ['[]', 'no-supported-data'],
])('malformed or missing useful commands return unavailable (%#)', (raw, reason) => {
  mockArtifacts({'results/commands.json': raw});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason});
});

test('missing diagnostics and symlinked scan roots are unavailable', () => {
  mockArtifacts();
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'no-supported-data'});
  jest.restoreAllMocks();
  mockArtifacts({}, ['results']);
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'unsafe-path'});
});

test('never follows a replaced private root or build parent', () => {
  mockArtifacts({'results/commands.json': [command()]});
  fs.lstatSync.mockReturnValue({isDirectory: () => true, isSymbolicLink: () => true});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'unsafe-path'});
  expect(fs.opendirSync).not.toHaveBeenCalled();
});

test('caps bytes before reading oversized files', () => {
  const {opened} = mockArtifacts({'results/commands.json': CANARY.repeat(LIMITS.fileBytes)});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'byte-limit'});
  expect(opened).not.toHaveBeenCalled();
});

test('caps directory entries and depth without exposing paths', () => {
  const contents = {};
  for (let i = 0; i <= LIMITS.entries; i++) contents[`results/${i}.log`] = CANARY;
  mockArtifacts(contents);
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'entry-limit'});
  jest.restoreAllMocks();
  mockArtifacts({[`results/${'nested/'.repeat(LIMITS.directoryDepth + 1)}commands.json`]: [command()]});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'depth-limit'});
});

test('caps JSON file count and cumulative bytes', () => {
  const contents = {};
  for (let i = 0; i <= LIMITS.files; i++) contents[`results/screen-hierarchy/${i}.json`] = {};
  mockArtifacts(contents);
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'file-limit'});
  expect(fs.openSync).toHaveBeenCalledTimes(LIMITS.files);
  jest.restoreAllMocks();
  const large = JSON.stringify({ignored: CANARY.repeat(90000)});
  mockArtifacts(Object.fromEntries(Array.from({length: 6}, (_, i) => [
    `debug/screen-hierarchy/${i}.json`, large,
  ])));
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'byte-limit'});
  expect(fs.openSync.mock.calls.length).toBeLessThan(6);
});

test('rejects a file replaced after lstat', () => {
  mockArtifacts({'results/commands.json': [command()]});
  fs.fstatSync.mockReturnValue({
    isFile: () => true, size: 1, dev: 4, ino: 9,
  });
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'unsafe-path'});
  expect(fs.readSync).not.toHaveBeenCalled();
  expect(fs.closeSync).toHaveBeenCalled();
});

test('fails closed on read races and parser errors without printing raw errors', () => {
  mockArtifacts({'results/commands.json': [command()]});
  fs.readSync.mockImplementation(() => { throw new Error(CANARY); });
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'read-failed'});
  expect(log).not.toHaveBeenCalled();
  expect(fs.closeSync).toHaveBeenCalled();
});

test.each(UNAVAILABLE_REASONS)('retains only a fixed unavailable reason (%s)', reason => {
  expect(sanitizeDiagnostics({availability: 'unavailable', reason, error: CANARY}))
    .toEqual({availability: 'unavailable', reason});
});

test('rejects unknown diagnostic reasons and never exports raw errors', () => {
  expect(sanitizeDiagnostics({availability: 'unavailable', reason: CANARY, error: CANARY}))
    .toEqual({availability: 'unavailable'});
});

test('reports the command limit without inspecting or exposing extra commands', () => {
  mockArtifacts({'results/commands.json': Array(LIMITS.commands + 1).fill(CANARY)});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable', reason: 'command-limit'});
});

const androidOptions = {platform: 'android', expectedDeviceId: 'Synthetic-Assigned.ID'};
const androidTree = (text = androidOptions.expectedDeviceId) => node('connection-details-sheet', CANARY, [
  node('assigned-device-id', text),
]);
const androidCommands = (tapStatus = 'COMPLETED') => {
  const tap = {
    command: {tapOnElement: {selector: {idRegex: 'connection-details', textRegex: CANARY}}},
    metadata: {sequenceNumber: 43, status: tapStatus},
  };
  const failure = command();
  failure.metadata.sequenceNumber = 44;
  failure.command.assertConditionCommand.condition.visible.idRegex = 'assigned-device-id';
  return [tap, failure];
};

test('reads the pinned Android document TreeNode root with omitted empty attributes and children', () => {
  // AndroidDriver.mapHierarchy(document), serialized directly by captureStepHierarchy's
  // NON_EMPTY bundleWriter. Document and XML hierarchy nodes are children, not envelopes.
  const documentTree = {
    children: [{
      attributes: {ignoreBoundsFiltering: 'false'},
      children: [{
        attributes: {
          'resource-id': 'connection-details-sheet', 'class': 'android.view.ViewGroup',
          ignoreBoundsFiltering: 'false',
        },
        children: [{
          attributes: {
            'resource-id': 'assigned-device-id', text: androidOptions.expectedDeviceId,
            'class': 'android.widget.TextView', 'important-for-accessibility': 'true',
            accessibilityText: CANARY,
          },
          enabled: true, clickable: false,
        }],
      }],
    }],
  };
  const parsed = parseHierarchy(documentTree, androidOptions);
  expect(parsed.androidDetails).toEqual({
    sheetPresent: true, assignedDeviceIdPresent: true, assignedDeviceIdTextMatch: 'match',
  });
  mockArtifacts({
    'results/flow/commands.json': androidCommands(),
    'results/flow/screen-hierarchy/step-045-assertCondition.json': documentTree,
  });
  const result = collectLiveDiagnostics(androidOptions);
  expect(result.failedCommands[0].androidDetails).toEqual({
    detailsTapCompleted: true, ...parsed.androidDetails,
  });
  expect(result.ui.observedTargets).toEqual(['assigned-device-id', 'connection-details-sheet']);
  expect(JSON.stringify(result)).not.toMatch(/SECRET_CANARY|Synthetic|android\.widget/);
});

test('unknown hierarchy envelopes are not guessed or misreported as missing Android IDs', () => {
  for (const envelope of [{root: androidTree()}, {roots: [androidTree()]}, {window: androidTree()}]) {
    expect(parseHierarchy(envelope, androidOptions).androidDetails).toBeUndefined();
  }
});

test.each([
  ['Synthetic-Assigned.ID', 'match'],
  ['synthetic-assigned.id', 'mismatch'],
  ['Synthetic-AssignedXID', 'mismatch'],
  [CANARY, 'mismatch'],
  ['', 'unavailable'],
  [undefined, 'unavailable'],
  [{payload: CANARY}, 'unavailable'],
  [CANARY.repeat(129), 'unavailable'],
])('Android compares only bounded tagged text without exporting values (%#)', (text, expected) => {
  const tree = androidTree();
  tree.children[0].attributes.text = text;
  tree.children[0].attributes.accessibilityText = androidOptions.expectedDeviceId;
  tree.children[0].attributes.hintText = androidOptions.expectedDeviceId;
  const result = parseHierarchy(tree, androidOptions).androidDetails;
  expect(result).toEqual({
    sheetPresent: true, assignedDeviceIdPresent: true, assignedDeviceIdTextMatch: expected,
  });
  expect(JSON.stringify(result)).not.toMatch(/SECRET_CANARY|Synthetic/);
});

test.each([undefined, '', '.*', '^Synthetic-Assigned.ID$', 'Synthetic-Assigned.ID\n',
  CANARY.repeat(129), true, {text: CANARY}])(
  'Android does not compare against untrusted or missing expected identity (%#)', expectedDeviceId => {
    expect(parseHierarchy(androidTree(), {platform: 'android', expectedDeviceId}).androidDetails)
      .toEqual({sheetPresent: true, assignedDeviceIdPresent: true, assignedDeviceIdTextMatch: 'unavailable'});
  },
);

test('Android missing includes omitted/hidden targets, not a claim they are unmounted', () => {
  // The Android driver omits invisible children; unrelated labels are not target evidence.
  const tree = node('connection-details', 'assigned-device-id', [
    node(undefined, androidOptions.expectedDeviceId),
  ]);
  expect(parseHierarchy(tree, androidOptions).androidDetails).toEqual({
    sheetPresent: false, assignedDeviceIdPresent: false, assignedDeviceIdTextMatch: 'missing',
  });
  tree.children.push(node('connection-details-sheet', CANARY));
  expect(parseHierarchy(tree, androidOptions).androidDetails).toEqual({
    sheetPresent: true, assignedDeviceIdPresent: false, assignedDeviceIdTextMatch: 'missing',
  });
});

test('Android presence never substitutes for visibility and duplicate IDs remain ambiguous', () => {
  const tree = androidTree();
  tree.children[0].enabled = false;
  tree.children[0].attributes['important-for-accessibility'] = 'false';
  expect(parseHierarchy(tree, androidOptions).androidDetails.assignedDeviceIdPresent).toBe(true);
  tree.children.push(node('assigned-device-id', CANARY));
  expect(parseHierarchy(tree, androidOptions).androidDetails.assignedDeviceIdTextMatch).toBe('ambiguous');
  expect(parseHierarchy({payload: tree}, androidOptions).androidDetails).toBeUndefined();
  expect(parseHierarchy(androidTree(), {platform: 'ios'}).androidDetails).toBeUndefined();
});

test('Android rejects malformed hierarchy children and preserves existing parser limits', () => {
  for (const tree of [{children: CANARY}, {attributes: CANARY}, {children: [null]}]) {
    expect(() => parseHierarchy(tree, androidOptions)).toThrow('Unavailable');
  }
  expect(() => parseHierarchy(node(CANARY, CANARY, Array(LIMITS.nodes).fill({})), androidOptions))
    .toThrow('Unavailable');
  let tree = androidTree();
  for (let i = 0; i <= LIMITS.hierarchyDepth; i++) tree = {children: [tree]};
  expect(() => parseHierarchy(tree, androidOptions)).toThrow('Unavailable');
});

test('binds Android booleans and text comparison to the same failure, not accumulated targets', () => {
  mockArtifacts({
    'results/session/flow/commands.json': androidCommands(),
    'results/session/flow/screen-hierarchy/step-043-assertCondition.json': androidTree(),
    'results/session/flow/screen-hierarchy/step-045-assertCondition.json': node('connection-details', CANARY),
    'results/other/screen-hierarchy/step-045-assertCondition.json': androidTree(),
  });
  const result = collectLiveDiagnostics(androidOptions);
  expect(result.failedCommands[0].androidDetails).toEqual({
    detailsTapCompleted: true, sheetPresent: false,
    assignedDeviceIdPresent: false, assignedDeviceIdTextMatch: 'missing',
  });
  expect(result.ui.observedTargets).toContain('assigned-device-id');
  expect(result.ui.androidDetails).toBeUndefined();
  expect(JSON.stringify(result)).not.toMatch(/SECRET_CANARY|Synthetic|step-045|session/);
  expect(sanitizeDiagnostics(result)).toEqual(result);
});

test.each(['COMPLETED', 'FAILED', 'SKIPPED'])(
  'reports the exact preceding Details tap outcome without claiming app state (%s)', status => {
    mockArtifacts({
      'results/commands.json': androidCommands(status),
      'results/screen-hierarchy/step-045.json': androidTree(CANARY),
    });
    expect(collectLiveDiagnostics(androidOptions).failedCommands.find(item => item.targetId === 'assigned-device-id').androidDetails).toEqual({
      detailsTapCompleted: status === 'COMPLETED', sheetPresent: true,
      assignedDeviceIdPresent: true, assignedDeviceIdTextMatch: 'mismatch',
    });
  },
);

test('does not manufacture a request from stale, missing, ambiguous or unrelated commands', () => {
  for (const update of [
    commands => { commands[0].metadata.sequenceNumber = 3; },
    commands => { commands.shift(); },
    commands => { commands.unshift(commands[0]); },
    commands => { commands[0].command.tapOnElement.selector.idRegex = CANARY; },
    commands => { commands[0].command.inputTextCommand = {text: CANARY}; },
    commands => { commands[0].metadata.status = CANARY; },
  ]) {
    const commands = androidCommands();
    update(commands);
    mockArtifacts({
      'results/commands.json': commands,
      'results/screen-hierarchy/step-045.json': androidTree(),
    });
    const details = collectLiveDiagnostics(androidOptions).failedCommands[0].androidDetails;
    expect(details.detailsTapCompleted).toBeUndefined();
    expect(details.assignedDeviceIdTextMatch).toBe('match');
    jest.restoreAllMocks();
  }
});

test('missing and duplicate failure snapshots are not replaced with another observed tree', () => {
  mockArtifacts({'results/commands.json': androidCommands()});
  expect(collectLiveDiagnostics(androidOptions).failedCommands[0].androidDetails)
    .toEqual({detailsTapCompleted: true});
  jest.restoreAllMocks();
  mockArtifacts({
    'results/commands.json': androidCommands(),
    'results/screen-hierarchy/step-045-first.json': androidTree(),
    'results/screen-hierarchy/step-045-second.json': androidTree(CANARY),
  });
  expect(collectLiveDiagnostics(androidOptions).failedCommands[0].androidDetails)
    .toEqual({detailsTapCompleted: true});
  jest.restoreAllMocks();
  const commands = androidCommands();
  commands.push(commands[1]);
  mockArtifacts({
    'results/commands.json': commands,
    'results/screen-hierarchy/step-045.json': androidTree(),
  });
  expect(collectLiveDiagnostics(androidOptions).failedCommands.every(item => !item.androidDetails)).toBe(true);
});

test('Android keeps oversize files unavailable before opening or comparing any text', () => {
  const {opened} = mockArtifacts({
    'results/screen-hierarchy/step-045.json': CANARY.repeat(LIMITS.fileBytes),
  });
  expect(collectLiveDiagnostics(androidOptions)).toEqual({availability: 'unavailable', reason: 'byte-limit'});
  expect(opened).not.toHaveBeenCalled();
});

test('Android failure report independently strips arbitrary names, payloads and malformed metadata', () => {
  const failure = {
    sequenceNumber: 44, commandKind: 'assertConditionCommand', targetId: 'assigned-device-id',
    androidDetails: {
      detailsTapCompleted: true, sheetPresent: false, assignedDeviceIdPresent: false,
      assignedDeviceIdTextMatch: 'missing', actual: CANARY, expected: CANARY,
      attributes: {payload: CANARY}, arbitraryName: CANARY,
    },
  };
  const result = sanitizeDiagnostics({availability: 'available', failedCommands: [failure]});
  expect(result.failedCommands[0].androidDetails).toEqual({
    detailsTapCompleted: true, sheetPresent: false, assignedDeviceIdPresent: false,
    assignedDeviceIdTextMatch: 'missing',
  });
  expect(JSON.stringify(result)).not.toContain(CANARY);
  for (const bad of [
    {detailsTapCompleted: CANARY},
    {sheetPresent: true, assignedDeviceIdPresent: true, assignedDeviceIdTextMatch: CANARY},
    {sheetPresent: true, assignedDeviceIdPresent: false, assignedDeviceIdTextMatch: 'match'},
    {sheetPresent: CANARY, assignedDeviceIdPresent: false, assignedDeviceIdTextMatch: 'missing'},
    Array(LIMITS.nodes).fill(CANARY),
  ]) {
    failure.androidDetails = bad;
    expect(sanitizeDiagnostics({availability: 'available', failedCommands: [failure]}).failedCommands[0])
      .not.toHaveProperty('androidDetails');
  }
});

test('smoke passes platform only; trusted expected identity stays inside existing sanitize boundary', () => {
  const smoke = fs.readFileSync('scripts/ci/smoke-live-device.sh', 'utf8');
  expect(smoke).toContain('diagnostics=$(node scripts/ci/live-diagnostics.js "$platform")');
  expect(smoke).not.toMatch(/live-diagnostics\.js.*(?:DEVICE_KEY|EXPECTED_DEVICE_ID)/);
});

test.each(['valid', 'invalid', 'ios'])('CLI sanitizes existing synthetic artifacts with %s configuration', mode => {
  const source = fs.readFileSync('scripts/ci/live-diagnostics.js', 'utf8');
  const config = {
    schemaVersion: 1, provisioningHost: 'global.azure-devices-provisioning.net',
    scopeId: '0neAABBCCDD', expectedHub: 'synthetic.azure-devices.net',
    cases: {android: {
      registrationId: 'synthetic-registration', expectedDeviceId: androidOptions.expectedDeviceId,
      nonce: 'synthetic_nonce_1234',
    }},
  };
  mockArtifacts({
    'results/commands.json': androidCommands(),
    'results/screen-hierarchy/step-045.json': androidTree(),
  });
  const entryModule = {exports: {}};
  const entryRequire = name => name === './live-config' ? liveConfig
    : require(name.startsWith('./') ? `../scripts/ci/${name.slice(2)}` : name);
  entryRequire.main = entryModule;
  const write = jest.fn();
  const invoke = () => vm.runInNewContext(source, {
    module: entryModule, require: entryRequire, Buffer,
    process: {
      argv: ['node', 'live-diagnostics.js', mode === 'ios' ? 'ios' : 'android'],
      env: {PAAD_LIVE_CONFIG: mode === 'invalid' ? CANARY : JSON.stringify(config), MAESTRO_DEVICE_KEY: CANARY},
      stdout: {write},
    },
  });
  if (mode === 'invalid') {
    expect(invoke).toThrow('Invalid live configuration or invocation');
    expect(write).not.toHaveBeenCalled();
    return;
  }
  invoke();
  expect(write).toHaveBeenCalledTimes(1);
  const output = write.mock.calls[0][0];
  const details = JSON.parse(output).failedCommands[0].androidDetails;
  if (mode === 'ios') expect(details).toBeUndefined();
  else expect(details.assignedDeviceIdTextMatch).toBe('match');
  expect(output).not.toMatch(/SECRET_CANARY|Synthetic|synthetic-registration/);
});
