# ADR onboarding and simulator use

The phone is a device client, not an Azure administration console. It provisions
through DPS, uses the returned Hub/device identity, and sends activity. Namespace
links, enrollments and operator authorization are configured outside the app.

Implementation and acceptance are distinct: inspect the actual run result and
independent operator report before treating a mobile-to-cloud case as proven.
The foundation's credential-free native gate is recorded in
[MODERNIZATION.md](plans/MODERNIZATION.md).

## Windows emulator with a WSL checkout

Keep source and development tools in WSL. Run Android Studio on Windows and
create/start an API 36 x86_64 emulator. Neither Expo Go nor a local Metro server
is needed for the bundled CI APK.

Download the exact reviewed commit's Android artifact from GitHub Actions and
extract `foundation-ci.apk`. The ordinary foundation workflow publishes it after
a credential-free build. A manually authorized live workflow also publishes
`live-build-android-<sha>-<attempt>` **before** the device-input step receives a key.
The accompanying `identity.txt` records source/toolchain identity and the APK hash.

Drag the APK onto the running emulator, or use Windows PowerShell:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices
& $adb -e install -r "$env:USERPROFILE\Downloads\foundation-ci.apk"
& $adb -e shell monkey -p com.iot_pnp.ci -c android.intent.category.LAUNCHER 1
```

`-e` requires one running emulator. With multiple emulators, select the intended
serial from `adb devices` using `-s <serial>` instead. The isolated package is
`com.iot_pnp.ci`, not the production application. `install -r` preserves its data;
use the app's explicit Forget Credentials action when a fresh local connection
is intended.

Artifacts expire after three days. Download a completed run's artifact, not an
arbitrary latest build. Windows cannot run Apple's iOS Simulator; the equivalent
`foundation-simulator.app.zip` requires a Mac and compatible Xcode/runtime.

## Connect using an individual device key

Have an operator supply an enabled individual enrollment and these bootstrap
values. Do not put administrator, DPS service-policy or Hub service-policy keys
in the phone.

| Input | Meaning |
| --- | --- |
| Registration ID | The individual DPS enrollment's registration identifier. |
| ID scope | The configured DPS instance's scope. |
| Device key | This enrollment's individual symmetric key. |
| Provisioning host | The configured device endpoint, without a scheme/path/port. |

Choose **Connect manually**. Individual-key DPS is the default. For a
namespace-linked DPS, the operator configures those links; the phone does not
need subscription or namespace management fields. Preview environments may use
a different provisioning endpoint: obtain it from operator readback instead of
assuming the public default.

The phone model remains `dtmi:azureiot:PhoneAsADevice;2`. After connecting, compare
the displayed assigned device and Hub with the actual DPS result. The assigned
device ID is not assumed to equal the registration ID.

**Change connection method** exposes direct-Hub device connection strings and
the explicitly labelled legacy enrollment-group path. Group keys are retained
for compatibility, not recommended for new individual onboarding.

Keys are masked until deliberately revealed. Do not put keys, QR images or
credential screenshots in issues, logs or reports. Avoid clipboard history/sync
when transferring a key, and clear the clipboard after pasting it.

Disconnect stops the session without erasing saved credentials. Forget
Credentials is a separate confirmed action and does not delete an Azure device.
Ordinary cold restart restores the saved connection once; failures offer an
explicit retry rather than an infinite reconnect loop.

## Versioned QR input

New QR payloads use a strict envelope. The scanner accepts JSON, base64 JSON and
the existing encrypted decoding path. For individual DPS:

```json
{
  "schema": "paad.connection",
  "version": 1,
  "mode": "dps",
  "credentials": {
    "registrationId": "<individual-registration-id>",
    "scopeId": "<DPS-scope>",
    "deviceKey": "<individual-device-key>",
    "provisioningHost": "global.azure-devices-provisioning.net"
  }
}
```

For direct Hub, use `"mode": "hub"` and
`"credentials": {"connectionString": "<device-connection-string>"}`.
These are placeholder examples, not usable credentials. Unknown versions,
administrator/certificate fields and new group-key envelopes are rejected.
Legacy supported QR formats remain compatible. Generate any real QR offline:
the QR itself contains a device credential.

## Local activity versus independent Azure confirmation

Open connection details and submit a unique proof nonce. The app sends telemetry
and a reported property:

```json
{"paadProof": {"nonce": "<unique-nonce>", "platform": "android"}}
```

**Submitted locally** means both MQTT operations were submitted to the local
transport. It is not a broker ACK or downstream telemetry receipt. Offline
simulation cannot produce a cloud-proof success.

Registry status deliberately stays **Not checked** in the app. A device key does
not authorize ARM inventory reads. The operator confirms the actual namespace
record separately; no registry device is manually created for this proof.

The operator uses an existing authorized Azure CLI login and a nonsecret config:

```json
{
  "schemaVersion": 1,
  "provisioningHost": "<configured-DPS-device-host>",
  "scopeId": "<DPS-scope>",
  "expectedHub": "<configured-Hub-device-host>",
  "cases": {
    "android": {
      "registrationId": "<unique-registration-id>",
      "expectedDeviceId": "<expected-assigned-device-id>",
      "nonce": "android-unique-proof-marker"
    }
  }
}
```

Use a fresh enrollment/device identity for a new automatic-record-creation case
and a fresh nonce for each traffic attempt. Do not place any key in this config.

```bash
node scripts/ci/verify-mobile-proof.js --before \
  --config /path/to/nonsecret-config.json --platform android \
  --subscription <subscription-id> --resource-group <resource-group> \
  --namespace <namespace-name> \
  --dps-service-host <configured-DPS-service-host> \
  --hub-service-host <configured-Hub-service-host>
```

Retain this pre-traffic absence report. After the app sends the same nonce, run
the same command **without `--before`**. It performs bounded, read-only checks
for the exact DPS assignment, Hub twin model/nonce, and ADR external-device
identity. It requests no keys and performs no cloud writes. Service hostnames
may differ from device hostnames; supply the actual configured values.

## Authorized automated live runs

The separate `live-device.yml` workflow requires the repository owner,
`feature/adr-onboarding`, an exact reviewed SHA, explicit confirmation and
validated nonsecret case JSON. Its push-only registration job only makes the
manual entrypoint discoverable and does not perform a live run.

Dedicated secrets are `PAAD_LIVE_ANDROID_DEVICE_KEY` and
`PAAD_LIVE_IOS_DEVICE_KEY`. Only the post-build device-input step receives them;
no Azure operator credentials are supplied to CI. The operator must remove these
temporary secrets after the run, including unsuccessful attempts.
Confirm the names were absent before creating them, and arrange operator-side
cleanup monitoring before waiting for interactive input. Native jobs remain
bounded to 45 minutes; the device step allows 20 minutes for simulator startup,
a 15-minute maximum Maestro process, and private-state cleanup.

The flow exercises manual navigation, actual provisioning/connection, assigned
identity, nonce submission and cold restoration. Credential-free binaries are
published before secret injection. Afterward, only allowlisted summaries and
safe failure codes are uploaded, never raw Maestro logs, hierarchies or images.
Maestro 2.10.0 creates private failure artifacts and has no supported automatic
failure-image opt-out; inputs remain masked, and those artifacts are deleted
without publication. Do not enable reveal or recording in live automation.

A UI success report still says independent Azure verification is pending.
Pair it with the operator verifier's result. Downstream telemetry consumption,
physical camera/BLE/sensor accuracy, production signing, secure-storage upgrade
acceptance, certificates and in-app inventory authorization remain separate.
Android map preview needs a restricted key configured at native build time;
without one, coordinates remain available. Image upload also requires Hub-side
storage configuration; this workflow does not create that infrastructure.
