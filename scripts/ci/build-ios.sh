#!/usr/bin/env bash
set -euo pipefail

# Keep the legacy compiler and simulator runtime matched; hosted defaults move.
test "$DEVELOPER_DIR" = /Applications/Xcode_16.4.app/Contents/Developer
xcodebuild -version | tee -a build/ci-artifacts/identity.txt
DEVELOPER_DIR="$IOS_SIMULATOR_DEVELOPER_DIR" xcrun simctl list runtimes
DEVELOPER_DIR="$IOS_SIMULATOR_DEVELOPER_DIR" xcrun simctl list devicetypes
device=$(DEVELOPER_DIR="$IOS_SIMULATOR_DEVELOPER_DIR" xcrun simctl create PAAD-Baseline-CI \
  com.apple.CoreSimulator.SimDeviceType.iPhone-16 \
  com.apple.CoreSimulator.SimRuntime.iOS-18-5)
printf 'IOS_SIMULATOR_UDID=%s\n' "$device" >> "$GITHUB_ENV"
printf 'iOS simulator: iPhone 16 / iOS 18.5 / %s\n' "$device" \
  | tee -a build/ci-artifacts/identity.txt
xcodebuild -workspace ios/IoT_PnP.xcworkspace -scheme IoT_PnP \
  -configuration Release -sdk iphonesimulator \
  -destination "generic/platform=iOS Simulator" -derivedDataPath build/ios-derived \
  ONLY_ACTIVE_ARCH=YES "ARCHS=$(uname -m)" \
  CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=YES CODE_SIGN_IDENTITY=- \
  CODE_SIGN_STYLE=Automatic AD_HOC_CODE_SIGNING_ALLOWED=YES DEVELOPMENT_TEAM= \
  PROVISIONING_PROFILE= PROVISIONING_PROFILE_SPECIFIER= \
  "CODE_SIGN_ENTITLEMENTS=$PWD/ios/IoT_PnP/IoT_PnPCI.entitlements" \
  PRODUCT_BUNDLE_IDENTIFIER=com.microsoft.iotpnp.ci \
  build 2>&1 | tee build/ci-artifacts/ios-build.log
app=build/ios-derived/Build/Products/Release-iphonesimulator/IoT_PnP.app
test -s "$app/main.jsbundle"
test "$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$app/Info.plist")" = com.microsoft.iotpnp.ci
# Simulator entitlements belong in Mach-O, not the host macOS code signature.
codesign --verify --strict --deep "$app"
xcrun segedit "$app/IoT_PnP" -extract __TEXT __entitlements \
  build/ci-artifacts/ios-entitlements.plist
codesign --display --entitlements - --xml "$app" \
  > build/ci-artifacts/ios-signature-entitlements.plist
test "$(/usr/libexec/PlistBuddy -c 'Print application-identifier' build/ci-artifacts/ios-entitlements.plist)" = com.microsoft.iotpnp.ci
test "$(/usr/libexec/PlistBuddy -c 'Print keychain-access-groups:0' build/ci-artifacts/ios-entitlements.plist)" = com.microsoft.iotpnp.ci
ditto -c -k --sequesterRsrc --keepParent "$app" build/ci-artifacts/baseline-simulator.app.zip
shasum -a 256 build/ci-artifacts/baseline-simulator.app.zip | tee -a build/ci-artifacts/identity.txt
printf 'iOS application ID: com.microsoft.iotpnp.ci; configuration: locally ad-hoc-signed Release simulator\n' \
  | tee -a build/ci-artifacts/identity.txt
