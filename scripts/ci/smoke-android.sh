#!/usr/bin/env bash
set -euo pipefail

test -s build/ci-artifacts/baseline-ci.apk
adb install -r build/ci-artifacts/baseline-ci.apk
maestro --version
maestro test --no-ansi --format junit \
  --output build/ci-artifacts/maestro-android.xml \
  --debug-output build/ci-artifacts/maestro-android \
  -e APP_ID=com.iot_pnp.ci .maestro/startup.yaml
