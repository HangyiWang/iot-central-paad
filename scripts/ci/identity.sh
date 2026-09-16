#!/usr/bin/env bash
set -euo pipefail

mkdir -p build/ci-artifacts
{
  printf 'Baseline: React Native %s\n' "$(node -p "require('react-native/package.json').version")"
  printf 'Built commit: %s\n' "$(git rev-parse HEAD)"
  printf 'Event SHA: %s\n' "${GITHUB_SHA:-local}"
  printf 'PR head SHA: %s\n' "${PR_HEAD_SHA:-not-a-pr}"
  printf 'Run: %s attempt %s\n' "${GITHUB_RUN_ID:-local}" "${GITHUB_RUN_ATTEMPT:-1}"
  printf 'Runner: %s %s\n' "${RUNNER_OS:-local}" "${RUNNER_ARCH:-unknown}"
  printf 'Image: %s %s\n' "${ImageOS:-unknown}" "${ImageVersion:-unknown}"
  printf 'Node: %s\n' "$(node --version)"
  printf 'Maestro: cli-2.10.0\n'
} | tee build/ci-artifacts/identity.txt
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat build/ci-artifacts/identity.txt >> "$GITHUB_STEP_SUMMARY"
fi
