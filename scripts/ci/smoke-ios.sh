#!/usr/bin/env bash
set -euo pipefail

export DEVELOPER_DIR="$IOS_SIMULATOR_DEVELOPER_DIR"
xcrun simctl boot "$IOS_SIMULATOR_UDID"
xcrun simctl bootstatus "$IOS_SIMULATOR_UDID" -b
xcrun simctl install "$IOS_SIMULATOR_UDID" \
  build/ios-derived/Build/Products/Release-iphonesimulator/IoT_PnP.app
maestro --version
maestro --device "$IOS_SIMULATOR_UDID" test --no-ansi --format junit \
  --output build/ci-artifacts/maestro-ios.xml \
  --debug-output build/ci-artifacts/maestro-ios \
  -e APP_ID=com.microsoft.iotpnp.ci .maestro/startup.yaml
