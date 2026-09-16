const fs = require('node:fs');
const path = require('node:path');
const {
  collectLiveDiagnostics, sanitizeDiagnostics, parseCommands, parseHierarchy,
  COMMAND_KINDS, ERROR_CODES, LIMITS,
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

test.each(ERROR_CODES)('accepts exact connection enum %s on iOS accessibility text', code => {
  const input = node('connection-error-code', CANARY);
  input.attributes.accessibilityText = code;
  expect(parseHierarchy(input)).toEqual({connectionErrorCode: code});
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
  expect(opened.mock.calls.map(call => path.relative(root, call[0]))).toEqual([
    'results/session/flow/commands.json', 'results/session/flow/screen-hierarchy/step-042.json',
  ]);
  expect(JSON.stringify(result)).not.toContain(CANARY);
});

test.each(['{SECRET_CANARY', '{}', '[]'])('malformed or missing useful commands return unavailable (%#)', raw => {
  mockArtifacts({'results/commands.json': raw});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable'});
});

test('missing diagnostics and symlinked scan roots are unavailable', () => {
  mockArtifacts({}, ['results']);
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable'});
});

test('never follows a replaced private root or build parent', () => {
  mockArtifacts({'results/commands.json': [command()]});
  fs.lstatSync.mockReturnValue({isDirectory: () => true, isSymbolicLink: () => true});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable'});
  expect(fs.opendirSync).not.toHaveBeenCalled();
});

test('caps bytes before reading oversized files', () => {
  const {opened} = mockArtifacts({'results/commands.json': CANARY.repeat(LIMITS.fileBytes)});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable'});
  expect(opened).not.toHaveBeenCalled();
});

test('caps directory entries and depth without exposing paths', () => {
  const contents = {};
  for (let i = 0; i <= LIMITS.entries; i++) contents[`results/${i}.log`] = CANARY;
  mockArtifacts(contents);
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable'});
  jest.restoreAllMocks();
  mockArtifacts({[`results/${'nested/'.repeat(LIMITS.directoryDepth + 1)}commands.json`]: [command()]});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable'});
});

test('caps JSON file count and cumulative bytes', () => {
  const contents = {};
  for (let i = 0; i <= LIMITS.files; i++) contents[`results/screen-hierarchy/${i}.json`] = {};
  mockArtifacts(contents);
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable'});
  expect(fs.openSync).toHaveBeenCalledTimes(LIMITS.files);
  jest.restoreAllMocks();
  const large = JSON.stringify({ignored: CANARY.repeat(90000)});
  mockArtifacts(Object.fromEntries(Array.from({length: 6}, (_, i) => [
    `debug/screen-hierarchy/${i}.json`, large,
  ])));
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable'});
  expect(fs.openSync.mock.calls.length).toBeLessThan(6);
});

test('rejects a file replaced after lstat', () => {
  mockArtifacts({'results/commands.json': [command()]});
  fs.fstatSync.mockReturnValue({
    isFile: () => true, size: 1, dev: 4, ino: 9,
  });
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable'});
  expect(fs.readSync).not.toHaveBeenCalled();
  expect(fs.closeSync).toHaveBeenCalled();
});

test('fails closed on read races and parser errors without printing raw errors', () => {
  mockArtifacts({'results/commands.json': [command()]});
  fs.readSync.mockImplementation(() => { throw new Error(CANARY); });
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  expect(collectLiveDiagnostics()).toEqual({availability: 'unavailable'});
  expect(log).not.toHaveBeenCalled();
  expect(fs.closeSync).toHaveBeenCalled();
});
