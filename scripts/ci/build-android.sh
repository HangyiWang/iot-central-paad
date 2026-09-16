#!/usr/bin/env bash
set -euo pipefail

mkdir -p build/ci-artifacts
(
  cd android
  ./gradlew :app:assembleCi --no-daemon --console=plain \
    -Dorg.gradle.internal.http.connectionTimeout=30000 \
    -Dorg.gradle.internal.http.socketTimeout=30000 \
    -PreactNativeArchitectures=x86_64
) 2>&1 | tee build/ci-artifacts/android-build.log
apk=android/app/build/outputs/apk/ci/app-ci.apk
test -s "$apk"
badging=$("$ANDROID_HOME/build-tools/34.0.0/aapt" dump badging "$apk")
grep -q "^package: name='com.iot_pnp.ci'" <<< "$badging"
grep -q "^native-code: 'x86_64'" <<< "$badging"
if grep -q '^application-debuggable' <<< "$badging"; then
  echo 'CI APK must be non-debuggable and bundled' >&2
  exit 1
fi
unzip -p "$apk" assets/index.android.bundle > build/ci-artifacts/android-bundle-check
test -s build/ci-artifacts/android-bundle-check
rm build/ci-artifacts/android-bundle-check
cp "$apk" build/ci-artifacts/baseline-ci.apk
shasum -a 256 build/ci-artifacts/baseline-ci.apk | tee -a build/ci-artifacts/identity.txt
printf 'Android application ID: com.iot_pnp.ci; variant: ci; ABI: x86_64\n' \
  | tee -a build/ci-artifacts/identity.txt
