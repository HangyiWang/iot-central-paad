#!/usr/bin/env bash
set -euo pipefail

# Keep the legacy compiler and simulator runtime matched; hosted defaults move.
test "$DEVELOPER_DIR" = /Applications/Xcode_16.2.app/Contents/Developer
xcodebuild -version | tee -a build/ci-artifacts/identity.txt
DEVELOPER_DIR="$IOS_SIMULATOR_DEVELOPER_DIR" xcrun simctl list runtimes
DEVELOPER_DIR="$IOS_SIMULATOR_DEVELOPER_DIR" xcrun simctl list devicetypes
device=$(DEVELOPER_DIR="$IOS_SIMULATOR_DEVELOPER_DIR" xcrun simctl create PAAD-Baseline-CI \
  com.apple.CoreSimulator.SimDeviceType.iPhone-16 \
  com.apple.CoreSimulator.SimRuntime.iOS-18-2)
printf 'IOS_SIMULATOR_UDID=%s\n' "$device" >> "$GITHUB_ENV"
printf 'iOS simulator: iPhone 16 / iOS 18.2 / %s\n' "$device" \
  | tee -a build/ci-artifacts/identity.txt
xcodebuild -workspace ios/IoT_PnP.xcworkspace -scheme IoT_PnP \
  -configuration Release -sdk iphonesimulator \
  -destination "generic/platform=iOS Simulator" -derivedDataPath build/ios-derived \
  ONLY_ACTIVE_ARCH=YES "ARCHS=$(uname -m)" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY= \
  CODE_SIGN_ENTITLEMENTS= DEVELOPMENT_TEAM= \
  PRODUCT_BUNDLE_IDENTIFIER=com.microsoft.iotpnp.ci \
  build 2>&1 | tee build/ci-artifacts/ios-build.log
app=build/ios-derived/Build/Products/Release-iphonesimulator/IoT_PnP.app
test -s "$app/main.jsbundle"
test "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$app/Info.plist")" = com.microsoft.iotpnp.ci
ditto -c -k --sequesterRsrc --keepParent "$app" build/ci-artifacts/baseline-simulator.app.zip
shasum -a 256 build/ci-artifacts/baseline-simulator.app.zip | tee -a build/ci-artifacts/identity.txt
printf 'iOS application ID: com.microsoft.iotpnp.ci; configuration: unsigned Release simulator\n' \
  | tee -a build/ci-artifacts/identity.txt
