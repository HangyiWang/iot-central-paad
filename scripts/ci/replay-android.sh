#!/usr/bin/env bash
set -euo pipefail
umask 077

mode="${1:-replay}"
if [[ "$#" -gt 1 || ( "$mode" != replay && "$mode" != download ) ]]; then
  echo 'Unsupported Android replay invocation.' >&2
  exit 1
fi
if [[ "${MAESTRO_DEVICE_KEY+x}" || "${PAAD_LIVE_CONFIG+x}" ]]; then
  echo 'Android replay refuses device credentials or live configuration, even when empty.' >&2
  exit 1
fi
if [[ "${GITHUB_EVENT_NAME:-}" != workflow_dispatch ||
      "${GITHUB_REF:-}" != refs/heads/feature/adr-onboarding ||
      "${GITHUB_REPOSITORY:-}" != HangyiWang/iot-central-paad ||
      "${GITHUB_REPOSITORY_OWNER:-}" != HangyiWang ||
      "${GITHUB_ACTOR:-}" != "$GITHUB_REPOSITORY_OWNER" ||
      "${GITHUB_TRIGGERING_ACTOR:-}" != "$GITHUB_REPOSITORY_OWNER" ||
      ! "${GITHUB_SHA:-}" =~ ^[a-f0-9]{40}$ ||
      ! "${SOURCE_RUN:-}" =~ ^[0-9]+$ ||
      ! "${SOURCE_SHA:-}" =~ ^[a-f0-9]{40}$ ||
      "${PAAD_VARIANT:-}" != ci ]]; then
  echo 'Android replay authorization or source binding rejected.' >&2
  exit 1
fi
if [[ "$mode" = replay && ( "${GH_TOKEN+x}" || "${GITHUB_TOKEN+x}" ) ]]; then
  echo 'Artifact access tokens must not enter Android replay.' >&2
  exit 1
fi

verify_binary() {
  node - <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
try {
  for (const directory of ['build', 'build/ci-artifacts']) {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error();
  }
  for (const file of ['identity.txt', 'foundation-ci.apk']) {
    const stat = fs.lstatSync(`build/ci-artifacts/${file}`);
    if (!stat.isFile() || stat.isSymbolicLink() || !stat.size) throw new Error();
  }
  const lines = fs.readFileSync('build/ci-artifacts/identity.txt', 'utf8').split(/\r?\n/);
  const expected = {
    'Built commit: ': process.env.SOURCE_SHA,
    'Event SHA: ': process.env.SOURCE_SHA,
    'Run: ': `${process.env.SOURCE_RUN} attempt 1`,
    'Native variant: ': 'ci',
  };
  for (const [prefix, value] of Object.entries(expected)) {
    const matches = lines.filter(line => line.startsWith(prefix));
    if (matches.length !== 1 || matches[0] !== prefix + value) throw new Error();
  }
  const entries = lines.filter(line => line.endsWith('build/ci-artifacts/foundation-ci.apk'));
  if (entries.length !== 1 || !/^[a-f0-9]{64}  build\/ci-artifacts\/foundation-ci\.apk$/.test(entries[0])) {
    throw new Error();
  }
  const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const apkSha256 = digest('build/ci-artifacts/foundation-ci.apk');
  if (apkSha256 !== entries[0].slice(0, 64)) throw new Error();
  console.log(JSON.stringify({
    sourceRepository: process.env.GITHUB_REPOSITORY,
    sourceWorkflowId: 359345717,
    sourceRun: process.env.SOURCE_RUN,
    sourceAttempt: 1,
    sourceSha: process.env.SOURCE_SHA,
    sourceArtifact: `live-build-android-${process.env.SOURCE_SHA}-1`,
    apkSha256,
    replayHarnessSha: process.env.GITHUB_SHA,
    replayScriptSha256: digest('scripts/ci/replay-android.sh'),
    startupFlowSha256: digest('.maestro/startup.yaml'),
    launcherRecoveryFlowSha256: digest('.maestro/dismiss-quickstep-anr.yaml'),
    evidenceScope: 'Credential-free synthetic startup only; no Connect or cloud proof',
  }, null, 2));
} catch {
  console.error('Android replay binary identity or checksum rejected.');
  process.exit(1);
}
NODE
}

if [[ "$mode" = download ]]; then
  node - <<'NODE'
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
try {
  const repository = process.env.GITHUB_REPOSITORY;
  const owner = process.env.GITHUB_REPOSITORY_OWNER;
  const sourceRun = process.env.SOURCE_RUN;
  const sourceSha = process.env.SOURCE_SHA;
  const gh = args => execFileSync('gh', args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const endpoint = `repos/${repository}/actions/runs/${sourceRun}`;
  const run = JSON.parse(gh(['api', endpoint]));
  if (String(run.id) !== sourceRun || run.repository?.full_name !== repository ||
      run.head_repository?.full_name !== repository || run.head_sha !== sourceSha ||
      run.head_branch !== 'feature/adr-onboarding' || run.workflow_id !== 359345717 ||
      run.event !== 'workflow_dispatch' || run.actor?.login !== owner ||
      run.triggering_actor?.login !== owner || run.run_attempt !== 1 ||
      run.status !== 'completed') throw new Error();
  const name = `live-build-android-${sourceSha}-1`;
  const pages = JSON.parse(gh(['api', '--paginate', '--slurp', `${endpoint}/artifacts?per_page=100`]));
  const artifacts = pages.flatMap(page => page.artifacts).filter(artifact => artifact.name === name);
  if (artifacts.length !== 1) throw new Error();
  const artifact = artifacts[0];
  if (artifact.expired !== false || !Number.isSafeInteger(artifact.id) || artifact.id <= 0 ||
      artifact.workflow_run?.id !== run.id || artifact.workflow_run?.head_sha !== sourceSha ||
      artifact.workflow_run?.head_branch !== run.head_branch ||
      artifact.workflow_run?.head_repository_id !== run.head_repository.id ||
      artifact.workflow_run?.repository_id !== run.repository.id) throw new Error();
  // The completed, first-attempt run and unique exact name bind the download.
  if (!fs.existsSync('build')) fs.mkdirSync('build');
  const build = fs.lstatSync('build');
  if (!build.isDirectory() || build.isSymbolicLink()) throw new Error();
  fs.mkdirSync('build/ci-artifacts');
  gh(['run', 'download', sourceRun, '--repo', repository, '--name', name, '--dir', 'build/ci-artifacts']);
  if (fs.readdirSync('build/ci-artifacts').sort().join('\n') !== 'foundation-ci.apk\nidentity.txt') {
    throw new Error();
  }
} catch {
  console.error('Android replay source run or artifact verification failed.');
  process.exit(1);
}
NODE
  verify_binary > /dev/null
  exit 0
fi

# Recheck the immutable source identity before any adb access, even in local invocations.
binary_identity=$(verify_binary)
maestro="$PWD/build/ci-tools/maestro/bin/maestro"
test -x "$maestro"
state="$PWD/build/replay-android-state"
diagnostics="$PWD/build/ci-artifacts/replay-android"
# Never adopt or delete existing directories. HOME and Java caches are not uploaded.
mkdir "$state"
mkdir "$diagnostics"
mkdir "$state/home" "$state/scratch" "$diagnostics/logs" "$diagnostics/debug" "$diagnostics/results"
printf '%s\n' "$binary_identity" > "$diagnostics/replay-identity.json"

device=''
flow_attempted=0
collect_evidence() {
  original_result=$?
  trap - EXIT INT TERM
  capture_failed=0
  capture() {
    local output="$1"
    shift
    if ! timeout --signal=KILL 15s adb -s "$device" "$@" \
      > "$diagnostics/$output" 2>> "$diagnostics/logs/capture-errors.log"; then
      capture_failed=1
      printf 'Android replay diagnostic capture failed: %s\n' "$output" >&2
    fi
  }
  if [[ -n "$device" ]]; then
    capture logs/android-runtime.log logcat -b main -b crash -d -v threadtime \
      AndroidRuntime:V ReactNativeJS:V ReactNative:V '*:S'
    capture logs/android-system.log logcat -b main -b system -b crash -d -v threadtime
    capture logs/foreground.log shell dumpsys activity activities
    capture logs/window.log shell dumpsys window windows
    capture final-screen.png exec-out screencap -p
    if [[ ! -s "$diagnostics/final-screen.png" ]]; then
      capture_failed=1
      echo 'Android replay final screenshot is missing or empty.' >&2
    fi
  fi
  if ! node - "$original_result" "$capture_failed" "$flow_attempted" "$device" <<'NODE' \
    > "$diagnostics/status.json"
console.log(JSON.stringify({
  commandExitCode: Number(process.argv[2]),
  captureFailed: process.argv[3] === '1',
  flowAttempted: process.argv[4] === '1',
  emulator: process.argv[5] || null,
}, null, 2));
NODE
  then
    capture_failed=1
    echo 'Android replay could not record its final result.' >&2
  fi
  # A diagnostic error fails a successful command but never replaces its original failure.
  if [[ "$original_result" = 0 && "$capture_failed" = 1 ]]; then original_result=1; fi
  exit "$original_result"
}
trap collect_evidence EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

timeout --signal=KILL 15s adb devices > "$diagnostics/logs/devices.log" 2> "$diagnostics/logs/devices-errors.log"
device=$(node - "$diagnostics/logs/devices.log" <<'NODE'
const fs = require('node:fs');
const lines = fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/)
  .map(line => line.trim()).filter(line => line && line !== 'List of devices attached');
if (lines.length !== 1 || !/^emulator-[0-9]+\s+device$/.test(lines[0])) {
  console.error('Android replay requires exactly one online emulator and no other targets.');
  process.exit(1);
}
console.log(lines[0].split(/\s+/)[0]);
NODE
)
timeout --signal=KILL 60s adb -s "$device" install -r build/ci-artifacts/foundation-ci.apk \
  > "$diagnostics/logs/install.log" 2>&1
timeout --signal=KILL 15s adb -s "$device" logcat -c > "$diagnostics/logs/clear.log" 2>&1

flow_attempted=1
# Match the live cold launcher: explicit binary, HOME and both Java properties, no version probe.
HOME="$state/home" TMPDIR="$state/scratch" \
JAVA_TOOL_OPTIONS="-Duser.home=$state/home -Djava.io.tmpdir=$state/scratch" \
node - "$maestro" "$device" "$diagnostics" <<'NODE' \
  > "$diagnostics/logs/maestro-stdout.log" 2> "$diagnostics/logs/maestro-stderr.log"
const {spawnSync} = require('node:child_process');
const [maestro, device, diagnostics] = process.argv.slice(2);
const result = spawnSync(maestro, [
  '--device', device, 'test', '--no-ansi',
  '--format', 'junit', '--output', `${diagnostics}/results/result.xml`,
  '--debug-output', `${diagnostics}/debug`, '--test-output-dir', `${diagnostics}/results`,
  '-e', 'APP_ID=com.iot_pnp.ci', '.maestro/startup.yaml',
], {stdio: 'inherit', timeout: 360000, killSignal: 'SIGKILL'});
if (result.error || result.signal) console.error('Android replay Maestro did not exit normally.');
process.exit(result.error || result.signal ? 1 : (result.status ?? 1));
NODE
