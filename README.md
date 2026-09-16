# Azure IoT Central PaaD
A Phone-as-a-Device solution to easily connect with Azure IoT Central by using a smartphone or tablet as an IoT device.

**Android**

develop: [![Build status](https://build.appcenter.ms/v0.1/apps/82ba91a2-c68c-4b4b-949e-2b0c581eb0af/branches/develop/badge)](https://appcenter.ms)


## What is this?
An useful tool to start playing with Azure IoT Central without using a real IoT device. The smartphone or tablet can send telemetry data from its embedded sensors (accelerometer, gyroscope...) and Bluetooth-LowEnergy (BLE) devices. It can also receive properties and commands to demonstrate basic functionalities.

## Features

The main features of the app are:

- Telemetry data from real embedded sensors and health platform records.
- Sample properties (readonly and writeable).
- Commands handling to enable/disable telemetry items and set their sending interval.
- Commands logs to trace data in app.
- Bluetooth Gateway (see [Bluetooth.md](./docs/Bluetooth.md) for documentation/implementation details)

You can read more about all features with instructions [here](./docs/Features.md).

## Build and Run

### CI-first modernization

The [modernization plan](docs/plans/MODERNIZATION.md) describes the staged move
to an Expo development-build foundation. The current baseline is still React
Native 0.75.4; adding automation does not mean the framework migration is complete.

The `BASELINE - RN 0.75 bundled startup` GitHub Actions workflow runs on foundation
branch pushes and relevant pull requests. It performs Linux lint/startup checks,
then independently builds an Android APK and an iOS Simulator app and
drives credential-free navigation with Maestro. Neither app depends on Metro.
No local Mac, EAS account, Apple Developer signing identity, or Azure credentials
are needed. The simulator app is locally ad-hoc signed with CI-only Keychain
entitlements; an unsigned app cannot exercise this secure-storage path.
The internal Azure pipeline dispatcher is manual-only.

CI application IDs are `com.iot_pnp.ci` and `com.microsoft.iotpnp.ci`; production
IDs and signing settings remain separate. Jobs are capped at 45 minutes, with
nonsecret build/log/screenshot artifacts retained for three days. Inspect the
exact run outcome and commit before treating a platform as supported. A build
or screenshot alone does not prove onboarding, cloud delivery, or hardware parity.
Live Azure scenarios need separate authorization. Camera, BLE, real sensors,
secure hardware and physical-phone suspension still require device acceptance.

### Optional local development

The application is available for both Android and iOS.
It can be run on simulator as well (Android Studio or Xcode required). In this case, sensor data is randomly generated.

### Setup

For the legacy baseline use Node 20.19.4 and, on Android, JDK 17 with the SDK/NDK
versions in `android/build.gradle`. On macOS, install Ruby 3.3.8 and Bundler 2.5.23
and run `bundle install` before `npm ci`; the macOS postinstall invokes CocoaPods
through Bundler and propagates failures.

```shell
git clone https://github.com/Azure/iot-central-paad
cd iot-central-paad
npm ci
```

#### iOS
Install pods
```shell
npm run podinstall
```

CI sets `PAAD_SKIP_POD_INSTALL=1` during `npm ci`, installs the Ruby dependencies,
then explicitly runs `bundle exec pod install --deployment` in `ios/`. The skip
flag defers installation; it does not turn failed CocoaPods setup into success.

If dependency changes require a new CocoaPods lock, explicitly dispatch the
baseline workflow with `platform=ios` and `refresh_pod_lock=true`. Review the
generated `Podfile.lock` artifact and commit it before accepting ordinary
deployment-mode runs. CI never silently retries a frozen-lock failure with
unlocked dependency resolution.

### Build source code
Source code can be validated and formatted to ensure js bundle gets correctly generated. However this does not guarantee the application can run as expected on each platform due to the various native modules. Always run the application on simulators to check functionalities.

#### Format, Lint and Typescript compile:
```shell
npm run build
```

#### Run Android
```shell
# runs on default simulator (as configured in Android Studio)
npm run android

```

#### Run iOS
```shell
# runs on default simulator (as configured in XCode)
npm run ios

# runs on specific device
npm run ios --device <device-id>
```