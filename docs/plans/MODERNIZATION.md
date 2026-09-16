# PAAD modernization plan

Status: implementation authorized; repairing the baseline and establishing CI.
Date: 2026-09-15. Branch: `modernize/paad-foundation`.
Base: fork `master` at `2549196`.

## Current decisions (supersede the original local-first plan)

The foundation uses **CI first**: Android emulators on standard GitHub Linux
runners and iOS Simulators on standard GitHub macOS runners. Windows Android
Studio, a local Mac, EAS and paid physical-iPhone signing are not prerequisites
for prototype progress. Physical-device acceptance remains an independent gate.

The owner approved Expo SDK 57 development builds, minimum iOS 16.4 and Android
7/API 24, and incremental foundation commits/pushes with credential-free Actions
runs. Each job is bounded to 45 minutes and nonsecret build/log/screenshot
artifacts to three days. No larger runners, Azure access, production signing,
automatic merges, or billable-resource/role changes are included.

The baseline lane is `.github/workflows/baseline.yml`: lint and genuine app-startup
Jest coverage, followed by independent bundled Android/iOS builds and Maestro
navigation/cold-restart scenarios. Builds use isolated `.ci` application IDs,
not production signing or credentials. Results must identify the exact built
commit and toolchain; a written workflow is not evidence of a successful run.

Reference artwork remains local and untracked. Use `image2.png` for information
structure and `image1.png` for calm visual tone, with selective accents from the
other two images. Produce an original design, not copied artwork.

## Goal and branch order

Create a supported native foundation, migrate useful PAAD code, and preserve
existing device behavior. Do not rewrite the whole app or embed Azure CLI.

```text
master
  modernize/paad-foundation
    feature/adr-onboarding
```

Both planning branches start now. ADR implementation starts after milestone M1,
not against the old app. Merge modernization into `master` first, then ADR.
During parallel work, merge foundation changes into the ADR branch; assign one
owner to dependencies, navigation, secure storage, and the connection interface.
Do not mix ADR feature changes into the modernization PR.

## Scope and starting evidence

The inspected app has 58 TypeScript/TSX files, about 7,372 source lines, and 35
runtime dependencies. It already uses hooks, contexts, and TypeScript. The main
cost is native compatibility, not converting React programming styles.

Preserve Hub connection strings, DPS device/group-key input, existing QR formats,
phone-model telemetry, properties, direct methods, six phone telemetry sources,
BLE advertisement scanning, image upload, settings, simulation, and local logs.
Health integrations are commented out; BLE GATT is not an existing feature.

Defer health restoration, GATT, guaranteed background operation, multiple active
devices, a full Azure resource browser, and certificate provisioning. Do not
promise unlimited offline delivery or assume sensor data should be uploaded
after a long suspension.

## Foundation decision

Approved foundation for the compatibility spike: **Expo SDK 57 development
builds**, using Expo 57.0.23 with its matched React Native 0.86.3 / React 19.2.3
dependency set. Published bare-minimum template: 57.0.25. These package versions
were rechecked against npm and the official templates on 2026-09-15. It is not
Expo Go; GitHub Actions builds locally on its runners without EAS.

Confirm versions against the supported template at implementation time and pin
the result. Do not independently upgrade every package to its latest release.
The candidate requires the New Architecture and raises the minimum supported OS;
SDK 57 specifies iOS 16.4 and Android API 24; these floors are owner-approved.
Pin Node 24.19.0 for the modern shell, JDK 17, Android compile/target SDK 36,
Build Tools 36.0.0 and NDK 27.1.12297006. Use the template's Gradle wrapper.
The modern iOS lane needs Xcode 26.4 or newer; the assessed runner is
`macos-26` with Xcode 26.6. The legacy baseline uses its own older toolchain.

If a required native integration or the iOS floor rules this out, evaluate a
fresh bare React Native shell with selective Expo modules and development-client
support. The assessed alternative is RN 0.87.1 / React 19.2.3, with iOS 15.1 as
its runtime floor. Record the choice at M1; do not maintain two implementations.

| Area | Planned treatment |
| --- | --- |
| Camera and QR | Replace archived camera/scanner packages together; start with Expo Camera. Keep gallery selection separate. Confirm camera ownership does not break the existing flashlight command. |
| Sensors | Evaluate Expo Sensors behind existing sensor interfaces. Preserve units, timestamps, availability and sampling semantics; current iOS acceleration is converted from g to m/s2. |
| BLE | Upgrade BLE-PLX to a framework-compatible version; preserve advertisement decoding and update Android runtime permissions. |
| Credentials | Upgrade Keychain deliberately. Check old Android cipher migration requirements before dropping older versions; do not replace storage without a migration. |
| Navigation and UI | Keep React Navigation, prefer native stack/system controls, and upgrade RNEUI where compatible. A UI library does not establish HIG compliance. |
| Charts | Replace internet-loaded `tsiclient@latest` with bundled, bounded-history charts. Consider simple SVG sparklines; remove native charts-wrapper after removing its type-only dependency. |
| IoT | Isolate the old Paho-backed client behind an app-owned interface; prove compatibility or maintain/replace its implementation deliberately. |
| State and tooling | Keep Context/useReducer, npm, TypeScript, ESLint and Prettier. No Redux, monorepo, or extra styling framework by default. |

Use Expo's dependency resolver only after Expo is configured. Preserve production
app IDs (`com.iot_pnp`, `com.microsoft.iotpnp`), signing ownership, universal links,
and the existing Keychain credential format. Use a separate development app ID
for experiments; separately exercise an in-place upgrade with the real app ID.
Never copy signing files or credentials into Git.

## Design contract: Apple Human Interface Guidelines

Apple's [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
are a required design and acceptance reference, not merely visual inspiration.
Apply the shared principles on Android while preserving Android back behavior,
system permissions, typography and accessibility conventions. Do not ship Apple
platform-only fonts or symbols as Android assets.

| HIG topic | PAAD requirement |
| --- | --- |
| [Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Respect safe areas, keyboard, rotation and compact screens. Use content-driven layouts, not fixed heights that clip enlarged text. |
| [Typography](https://developer.apple.com/design/human-interface-guidelines/typography) | Use system fonts and semantic text styles. Support Dynamic Type and Bold Text; never disable scaling globally to make a layout fit. |
| [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) | Label controls and expose values/states to VoiceOver and TalkBack. Provide textual equivalents for charts. Support large text, increased contrast, and logical focus order. |
| [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) | Minimum 44 x 44 pt hit regions on iOS; use 48 dp on Android. Provide pressed/disabled states and one clear primary action per task. |
| [Color](https://developer.apple.com/design/human-interface-guidelines/color) | Use semantic, adaptive colors; check light, dark and increased-contrast appearances. Pair status color with text and an icon. |
| [Motion](https://developer.apple.com/design/human-interface-guidelines/motion) | Keep motion purposeful and subtle. Honor Reduce Motion; avoid decorative looping or flashing indicators. Respect reduced transparency for materials. |
| [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | Tabs represent stable destinations, never Connect/Scan actions. Use labels; do not hide or disable tabs when disconnected. Explain unavailable content. |
| [Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding) and [Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy) | Keep setup short; retain manual entry and simulation. Request camera/BLE/location only when needed, explain why, and provide a useful denial path. No blanket launch-time permission prompts. |
| [Progress](https://developer.apple.com/design/human-interface-guidelines/progress-indicators) and [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts) | Show real stages, cancellation and recovery. No invented percentage or success. Prefer inline status; reserve alerts for necessary decisions and irreversible credential reset. |

Start by polishing existing screens rather than redesigning the information
architecture. Present a connection summary above sensor cards. Put values,
units, availability, and live/simulated labels ahead of decoration. Group
secondary tasks logically; review any tab consolidation separately so no
existing feature disappears. Prefer standard native navigation/materials over
a hand-built glass or blur system.

Each UI PR must map changed screens to the applicable HIG rows and include
light/dark, enlarged-text, keyboard and error-state evidence. An Android emulator
cannot establish iOS HIG conformance. Require physical-iPhone VoiceOver, large
text and Reduce Motion review before calling the design complete.

## Responsibilities and milestones

Keep screens separate from hardware services and IoT transport. The connection
interface must cover connect/cancel/disconnect, provisioned Hub/device identity,
telemetry, twin updates, methods, file upload, and explicit lifecycle events.
Do not expose a third-party client object throughout the UI. Distinguish send
attempts from protocol acknowledgements and independently observed cloud state.
Redact keys, tokens, connection strings and sensitive payloads at the log boundary.

| Priority | Work | Exit criterion |
| --- | --- | --- |
| M0: baseline | Record behavior and message/model contracts; repair the existing automated baseline in a small implementation commit. Preserve a known baseline build if available. | Reproducible install, clear supported toolchain, and useful baseline checks. |
| M1: compatibility gate | Fresh shell, New Architecture, dev client, secure storage, sensor/QR/BLE adapters and shared connection interface. Establish bundled build and smoke automation before feature migration. | Android emulator and unsigned iOS Simulator builds launch and pass real UI assertions. Authorized live-cloud follow-up proves model-bearing Hub/DPS WSS traffic independently on both platforms. Physical sensors, QR/camera, BLE, secure hardware and phone suspension remain not exercised until device acceptance. Target 3-5 engineer-days, not a guarantee. |
| M2: parity migration | Port remaining sensors, BLE advertisements, properties/methods, image upload, registration, settings, logs and charts. Add dependency replacements in small batches. | Existing active features and telemetry units preserved; no unbounded subscriptions/history or duplicate connection attempts. |
| M3: design and resilience | Apply the HIG contract, permission recovery, clear errors, reconnect/resume, credential reset and minimal redacted diagnostics. | Usable offline/error states, accessible controls, no false delivery claims or secret logging. |
| M4: release readiness | Align CI and release toolchains; standalone Android/iPhone builds, upgrade migration, documentation and hardware coverage. | Acceptance matrix below passes; platform gaps explicitly block parity sign-off. |

Run existing logic checks on every PR; add focused Jest + React Native Testing
Library coverage as needed. Establish Maestro launch/navigation assertions with
the build pipeline, then expand them with each migrated feature. Native signing
must not be exposed to untrusted fork PRs.
Keep cloud device credentials in restricted test jobs, not ordinary UI jobs.

## CI-first build and test

1. Repair baseline install/type/Jest issues separately from migration regressions.
2. Build the legacy baseline with bundled JS and isolated IDs. Record native
   incompatibilities honestly rather than weakening tests or faking modules.
3. Create the approved fresh native shell, then run equivalent Android and iOS
   Simulator flows. Do not port every screen before this gate succeeds.
4. Exercise manual onboarding, navigation, denied permissions, restart and
   explicitly labelled simulation without cloud credentials. Use actual UI
   assertions and bounded waits, not screenshots alone.
5. Keep live-cloud jobs separate and opt-in on trusted code, after additional
   scoped-access authorization. The running app must report a unique nonce;
   independent Hub twin and ADR inventory reads must match the assigned identity.
6. Preserve exact-commit evidence and report passed, failed and not-exercised
   coverage. Virtual-device results never satisfy physical hardware acceptance.

The first baseline install succeeded with `npm ci`; the IoT dependency includes
its Paho fork in the published package. This does not establish maintained
transport ownership or native/runtime compatibility on the new foundation.
The baseline animation typing, test import, missing native Jest setup and
ESLint plugin resolution are repaired deliberately, without relaxing type rules.

## Optional Windows and physical-device development

The following local workflows are alternatives for developers and later hardware
acceptance, not prerequisites for the CI-first milestone.

### A. Run the current checkout, before modernization

These steps apply to the existing RN 0.75.4 app, not to the proposed Expo app.
The plans alone do not fix native build compatibility.

1. Install Android Studio **on Windows**, its emulator/platform tools, and JDK 17.
   Enable hardware virtualization. Install the repository's SDK Platform 34,
   Build-Tools 34.0.0 and NDK 26.1.10909125; let its Gradle wrapper select Gradle.
   Create and start a Google APIs virtual phone in Device Manager.
2. Use a Windows-native checkout, Windows Node 20 for this baseline, and PowerShell.
   Set `JAVA_HOME` to JDK 17 and `ANDROID_HOME` to Android Studio's SDK location;
   add SDK `platform-tools` to PATH. Accept SDK licenses. Check `adb devices`.
3. Synchronize the desired branch into that checkout. The branches created with
   this plan are local until explicitly pushed. After reviewing them, they can
   be published from the WSL checkout:

```bash
git push -u origin modernize/paad-foundation
git push -u origin feature/adr-onboarding
```

In the separate Windows checkout:

```powershell
git fetch origin
git switch modernize/paad-foundation
npm ci
adb devices
npm run lint
npm test -- --runInBand --watchman=false
npm start
```

In another PowerShell terminal in the same checkout:

```powershell
npm run android -- --no-packager
```

The inspected baseline has a TypeScript animation error in `src/Welcome.tsx`
and its sole Jest file imports nonexistent `../App`. M0 fixes these; do not
silently treat their current failures as migration regressions. `npm run build`
currently formats and lints; it is **not** an APK or iOS build.

Use simulation for UI work, then real test credentials for cloud behavior.
The emulator can exercise layouts and networking but does not prove BLE or
physical sensor behavior. Do not enter production keys.

### B. Daily workflow after M1 configures Expo development builds

For the selected modern template, pin a compatible Node release (candidate:
Node 24 LTS, at least 24.3), JDK and SDK/NDK in the plan implementation.
Use its Android versions rather than carrying Platform 34 forward.

| Environment | Role |
| --- | --- |
| Windows-native checkout | Android Studio/emulator, local Android builds and Metro for the simplest Android workflow. |
| WSL checkout | Primary editing, automated checks, Azure scripts, EAS CLI and Metro for the iPhone workflow. |
| Approved EAS or team macOS builder | Native iOS compilation/signing; not local iOS compilation in WSL. |
| Physical iPhone | Real iOS hardware, permissions, accessibility and connectivity. |

Keep `node_modules`, SDKs, Gradle output and caches separate between Windows and
WSL. Synchronize committed source through Git, not copied dependencies. Do not
let two Metro processes compete for port 8081.

After Expo, `expo-dev-client`, signing and build profiles are implemented:

```powershell
# Windows checkout: build/install on the running Android emulator.
npx expo run:android
```

```bash
# WSL: authenticated EAS CLI, approved cloud service and signing access required.
eas device:create
eas build --platform ios --profile development
# After installing the signed build and enabling iPhone Developer Mode:
npx expo start --dev-client
```

This optional hardware profile must target a **physical device**. The primary
GitHub Actions profile instead targets an unsigned **iOS Simulator**.
Use Apple Developer team access if available. EAS is a separate build service;
its free build quota does not remove Apple's device-signing requirement.
Prefer an existing approved macOS pipeline if code/signing cannot go to EAS.
No local iOS Simulator runs on Windows/WSL.

Use trusted same-Wi-Fi LAN access. For WSL, configure mirrored networking where
supported or narrow port forwarding/firewall rules; the iPhone cannot use the
laptop's `localhost`. Do not disable firewalls. An Expo tunnel is an optional
external/public endpoint and requires organizational approval.

Reuse the development binary for compatible JavaScript changes. Rebuild after
native dependency/configuration changes and track the native dependency set
and commit used by each build. A JS update cannot add native modules.
At milestones, create a signed internal preview that embeds the JS bundle and
runs without Metro. Test cold launch and release behavior, not only Fast Refresh.

## Acceptance and effort

| Layer | Required coverage |
| --- | --- |
| Automated | Credential/QR validation, key derivation, sensor units, cancellation, retry/state transitions, no secret logging, critical UI behavior. |
| Android emulator and iOS Simulator in CI | Bundled cold launch, navigation, forms, layouts, errors, denied-permission UI and labelled simulation. Live cloud networking requires separate authorized runs on both platforms. |
| Physical iPhone | QR/camera, available sensors, Keychain restore/reset, BLE with a peripheral, flashlight, image upload, connectivity and HIG review. |
| Physical Android before parity sign-off | BLE/sensors, platform permissions, secure-storage upgrade, file/image behavior and reconnect. Borrow a device if necessary; emulator-only status remains incomplete. |
| Cloud | Direct Hub and classic DPS still work; reported-property nonce independently matches. Do not equate MQTT acknowledgement with downstream telemetry consumption. |
| Release | Signed standalone builds, offline launch, network loss/resume, old-to-new app upgrade, current store toolchains/target requirements and Android native page-size compatibility. |

Budget **5-8 engineer-weeks** for parity, including the compatibility spike:
approximately **60-90 affected paths** (30-40 existing app files, 15-25 native
paths, 5-10 tooling/docs paths, 10-15 new adapter/coverage files). These are
estimates, not an implemented diff; generated dependencies/assets are excluded.
Major new UX, diagnostic export, profiles and certificate work need separate
scope. Signing access, hardware gaps or native incompatibilities can extend it.

## Implementation references

- [Expo SDK 57](https://expo.dev/changelog/sdk-57)
- [React Native support](https://reactnative.dev/releases/overview)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android Studio/emulator setup](https://docs.expo.dev/workflow/android-studio-emulator/)
- [Using development builds](https://docs.expo.dev/develop/development-builds/use-development-builds/)
- [WSL networking](https://learn.microsoft.com/en-us/windows/wsl/networking)
- [Apple developer account and signing](https://developer.apple.com/help/account/basics/about-your-developer-account)
