# PAAD ADR namespace integration plan

Status: SAS-first application integrated; Android end-to-end and cold restore confirmed;
iOS nonce/cold-restore acceptance remains pending.
Date: 2026-09-16. Branch: `feature/adr-onboarding`.
Parent: `modernize/paad-foundation`.

## CI-first update (2026-09-16)

This section supersedes the original Windows-first and early physical-iPhone
prerequisites. The approved direction is automated Android emulator runs on
standard GitHub Linux runners and iOS Simulator runs on standard macOS runners.
No local Mac, EAS account or paid Apple signing identity is needed for this
prototype gate. Local ad-hoc simulator signing may supply isolated Keychain
entitlements; it is not production signing or physical-phone acceptance.

The approved foundation is Expo SDK 57 development builds, with minimum iOS
16.4 and Android 7/API 24. Foundation implementation and its shared connection
interface must precede ADR application changes. The foundation passed both
native startup gates in run `35057354712` and was merged into this branch.
The owner authorized local integration and publication of both topic branches;
no merge into `master` or automatic PR merge is authorized.

Keep credential-free build/UI jobs separate from explicitly authorized live
Azure jobs. The foundation automation uses pinned tools, 45-minute job bounds,
and three-day nonsecret artifacts. Subsequent authorization permits scoped reuse
of the retained lab, uniquely named individual enrollments, actual device traffic,
independent inventory reads and temporary dedicated device-input Actions secrets.
No new billable resources, IAM changes, old-experiment changes, cloud cleanup or
physical-device distribution is authorized.

Use the local `image2.png` reference for information structure and `image1.png`
for restrained visual treatment, following the foundation's Apple HIG contract.
Do not publish the reference artwork. Virtual-device evidence never establishes
real BLE reception, camera/flashlight quality, sensor accuracy or secure hardware.

## Goal and dependency

Let a phone provision through a namespace-linked DPS, connect to its assigned
IoT Hub, and send activity while Azure creates a matching ADR registry record.
Keep direct Hub and classic DPS onboarding working. The phone is a device,
not an Azure administration console.

Follow the [modernization plan](MODERNIZATION.md), including its mandatory Apple
HIG design contract and the CI-first update above. Begin device implementation only
after M1 establishes a working modern build and the shared connection interface.
Cloud contract investigation and wireframes can proceed sooner. Future PR order
is foundation then ADR, but merging either into `master` requires separate approval.

## Implemented prototype

Individual-key DPS is the default, with configurable endpoint, registration ID,
scope and the phone model. Direct Hub and explicit legacy group input remain
available. Manual and versioned QR inputs share the foundation's decoder.
Details show actual assigned identity, safe diagnostics and local proof
submission; registry status deliberately remains **Not checked** in-app.

The separate `live-device.yml` workflow gates device inputs by owner, topic,
explicit consent and exact reviewed SHA. Its push-only registration job does
not use device secrets or send traffic. Manual jobs publish credential-free
binaries before receiving device keys and upload only allowlisted proof summaries
afterward. Raw live diagnostics/images are never published.

The operator-only `scripts/ci/verify-mobile-proof.js` reads DPS assignment,
the Hub model/nonce and the actual ADR record using an existing Entra CLI session.
It requests no keys and performs no cloud writes. See the
[simulator guide](../ADR-SIMULATOR.md) for manual use and evidence boundaries.

### Follow-up: automatic Azure details

The intended follow-up experience populates Azure details automatically, without
requiring app users to export or import a snapshot. The current optional snapshot
is a prototype bridge, not a required step in device onboarding.

Choose the authorized delivery mechanism separately: static resource context can
accompany onboarding configuration, while fresh inventory and management activity
need an appropriately authorized Azure user session or backend. Device credentials
must not gain Azure management permissions. This future direction does not
authorize a new backend, Azure sign-in implementation, resources or IAM changes in
the current simulator acceptance work.

### Recorded mobile evidence (2026-09-16)

Credential-free Android replay `35149722810` and iOS replay `35149723154`
passed bundled startup, manual-input, Back and cold-start assertions.
The iOS replay also confirmed deletion of its freshly owned simulator.

Real-device-input run `35150711575`, app source
`d8cd8abea76b67a6658bd5b493c8524535726ffd`, reached actual DPS assignment and
Hub connection on both virtual platforms. Independent operator reads confirmed
the phone model in both Hub twins and one matching automatic ADR record per
assigned device. That CI run still failed its details-screen UI assertions;
these partial cloud results do not make the run or milestone A1 pass.

The same run's credential-free Android APK was subsequently exercised manually
on the Windows Android Studio emulator. The operator independently matched the
exact submitted nonce/platform, assigned identity, Hub model and automatically
created ADR record. A scoped force-stop and relaunch produced a new app process
that returned to Connected with the same identity without re-entering credentials.
APK SHA256:
`e03817b61d15a7e678c1c26ed1a8cef2ea12838df5685b3535089ca1e04ba3ba`.
Lab-specific proof reports remain private and are not committed.

The refreshed Android UI from run `35164148425`, source
`41be7a028c9e4fc2aee7ed8b09d8d3049a73449e`, was installed over that CI app with
`adb -e install -r`. Private native UI inspection confirmed Connected and the
same assigned device/Hub without credential re-entry. No app data was cleared.

The follow-up design keeps a compact connection status row on every tab and
moves full identity plus secondary connection actions into the details sheet.
The live UI flow checks the same exact assigned values inside that sheet;
registry status and local-submission semantics are unchanged.

Android's manual cloud/cold-restore case is complete. iOS still needs the exact
nonce and connected cold-restoration evidence; XCTest screenshot and simulator
startup reliability remain under investigation. None of this establishes physical-device parity or downstream
telemetry receipt.

The follow-up iOS run `35185542106` on source
`64ea3610ee6dc578021412bddb051e4195943c4f` again reached independently matching
DPS assignment, Hub model and one automatic ADR record. Its details-screen
model-field assertion failed before nonce submission; connected cold restoration
was not reached. The owned temporary device input was removed afterward.

Run `35193531988` on source `af399da31f93cede305936808a1f712dfcc762d6`
used the in-tree connection loading overlay. The iOS Connected assertion failed,
although independent reads again confirmed exact DPS assignment and the phone
model in the Hub twin. The expected nonce was absent; cold restoration remains
unproven. Its safe report did not contain UI target presence, which alone does
not distinguish missing capture from missing controls. Temporary device inputs
were removed. The modal-handoff change is not established as a fix for these
automation failures.

The final Android UI from run `35227323436`, source
`d9e8b63034ab6f5b25e2ad70d4a2018af30cc212`, was installed over the retained CI
app without clearing credentials. Native interaction confirmed the compact row,
expandable/filterable logs, utility-page layout and exact identity/model.
The details Close button now works at its center outside the system bar, and
the log disclosure measured 126 pixels at 420 dpi (48 dp).
APK SHA256:
`9351ddfdfef90540887c5e7188cab2048e41cbb4a6d5e8094c2261c7a285cafd`.
A fresh app-submitted nonce independently matched the Hub twin and existing
automatic ADR record. A scoped process stop/relaunch restored Connected and the
same identity without re-entry. This reuses the previously established Android
registry-creation case rather than claiming a new record was created by the update.

The subsequent iOS live run `35228256697` on source
`63932ec1ea2a8d3cb1b3782cd0b15a62fbeb6568` again matched assignment, model and
one automatic ADR record, but failed the initial Connected assertion before
nonce submission. Its allowlisted category was an assertion failure; a captured
hierarchy contained none of the fixed target names. That does not identify the
cause or establish a driver disconnect. Temporary inputs were removed, and the
iOS nonce/cold-restoration gate remains open.

An isolated Foundation API probe (`35240491338`) compared 15-second and
180-second request timeouts on iOS Simulator with 30 seconds of loopback
WebSocket silence. Both received the subsequent frame. This did not reproduce
the proposed 15-second idle-disconnect explanation, so the production transport
was not changed on that hypothesis. The probe is not PAAD/TLS/Azure acceptance.

Run `35242626049` on source
`b3902cbe550f9d9d8e68dac916a6d965b98ed8b4` passed the Connected assertion but
failed the following Details tap. Independent reads matched assignment, phone
model and one automatic ADR record; the nonce was still absent. The safe UI
capture exposed only the fixed app-root label, which does not establish a crash
or a transport cause. Its temporary input was removed.

The owner subsequently approved a focused native XCUITest lane for iOS. It is
opt-in (`ios_driver=xcuitest`) within the existing owner/exact-SHA live workflow.
The runner is built and exercised with synthetic input before the dedicated
device-key step; synthetic smoke never presses Connect. The native live path
retains exact identity/model/nonce and actual terminate/relaunch assertions.
Ordinary Maestro smoke remains in place. For credentialed runs, only fixed-category native milestones
and the existing nonsecret proof summary may leave private test state; raw
Xcode test output, result bundles and device inputs are deleted. Implementation
of this lane does not itself close the remaining iOS acceptance gate.
Set `ios_smoke_only=true` with `platform=ios` and `ios_driver=xcuitest` to
exercise the new runner without ever requesting a device secret or sending
device traffic. This credential-free-only mode additionally retains the final
1 MiB of synthetic runner output for three days so actual Xcode/driver startup
failures can be diagnosed. It never receives a device key; this exception does
not apply to a credentialed run or its preflight. The ordinary exact-source/owner
authorization still applies.

The property/connection-notice UI candidate `2ae9a1f2901e287002d6420be1ab514786b33d31`
passed JavaScript and both credential-free native lanes in run `35252178223`.
The corresponding foundation adaptation
`31467af09a22ce83062b6f75a02e9c8853c1975d` passed all three lanes in run
`35252459704`. These are native startup/input-flow results, not the outstanding
iOS live nonce and connected cold-restoration proof.

The `2ae9a1f` Android APK was installed over the retained CI app without clearing
credentials. It restored the same assigned device and Hub, and a fresh
app-submitted nonce independently matched the Hub twin, phone model and existing
automatic ADR record. The private interaction helper also exercised log
expansion/filtering, utility pages and Details. An initial helper failure was
an offscreen target with zero bounds; requiring visible bounds and scrolling
resolved the helper failure without an app or transport change.
APK SHA256:
`e539f4223b4a1faeea0726992fde4ec5b128fee1ebf973a41b542217f56bbea0`.
This is retained-identity upgrade/restoration evidence, not a new registry
creation case or a separate process-force-stop assertion for this binary.

The quieter header and 48 dp editable input candidate
`aed9186c8c327442b27dc5c475c5335d809fa103` passed JavaScript and both native
lanes in run `35257757198`. Its Android APK was installed in place, preserving
the saved device identity and restoring Connected. The native helper observed
the new header, no redundant visible connection caption, a 48 dp Settings
target, the empty property input and its actual focus/48 dp height, disabled
unchanged submission, cloud empty state, and working Details/log/utility controls.
It left the app on Telemetry. This update did not submit a new proof nonce.
APK SHA256:
`ca7e57b47ec3dc2143d063a87e3f4420ddadf934a868ad96efd84548dab3163b`.
The completed foundation ancestry was merged in `6d613a6` without changing the
ADR feature tree; `master` remains untouched.

## What the experiment proved, and what it did not

The 2026-09-13 isolated cloud experiment used `azure-iot-device` Python SDK
**2.14.0**, fresh resources in **centraluseuap**, a shared user-assigned managed
identity (UAMI), and a namespace-linked Hub/DPS.

| Path | Observed result |
| --- | --- |
| Direct Hub device key | SDK connection, acknowledged telemetry, independently matching reported-property nonce, and an automatic ADR record. |
| DPS device key | SDK registration assigned a Hub; device connected, sent activity and had a matching automatic ADR record. |
| DPS CSR/certificate | Preview REST issued a three-certificate chain; SDK connected with X.509 and produced matching activity/ADR evidence. |

No ADR record was manually created. The namespace was empty before the run.
Telemetry was acknowledged but not independently consumed downstream; activity
was independently established by reading the Hub twin. ADR inventory is not a
telemetry store or a ready-made activity dashboard.

The experiment was not a React Native or physical-phone run. It omitted the
phone model payload. The old stack's `403000` did not recur, but the precise cause
and minimum necessary RBAC set remain unisolated. Preview availability outside
the tested region/subscription must be confirmed, not assumed.

## Priorities and exclusions

1. **P0: device-key/SAS onboarding.** Use a pre-created individual enrollment;
   support configurable provisioning endpoint, scope, registration ID and key.
   Use the assigned Hub and assigned device ID returned by DPS.
2. **P0: honest activity and registry evidence.** Show device connection/activity
   locally; prove the real namespace record through a separately authorized
   operator lookup. Never infer registry confirmation from the registration ID.
3. **P1: polished namespace-aware setup.** Validated manual/QR input, meaningful
   progress, copyable nonsecret diagnostics, retry/cancel and safe restoration.
4. **P2: certificates and in-app registry lookup.** Separate decision gates for
   native TLS/key lifecycle and for an authorized user/backend read path.

Do not embed CLI, subscription administrator credentials, enrollment-creation
permissions, or service shared keys in the phone. No full namespace management
surface, bulk operations, jobs, CA administration or new Azure backend in P0.
Do not expand group-key use for new onboarding: deliver an individual device
key to each phone. Preserve existing group-key input only for backward compatibility.

## Cloud preparation: operator or setup automation, never the phone

For new experiments, create uniquely named/tagged owned resources. Do not use
unrelated resources in the subscription/RG. Reuse a retained test stack only
with explicit authorization; confirm preview access and billing before creation.
Record ownership and retention/cleanup decisions; do not delete automatically.

The following captures the successful configuration, not a least-privilege
production recommendation. CLI names identify equivalent operations, not
commands to invoke from mobile code.

| Step | Configuration | Operation / CLI equivalent |
| --- | --- | --- |
| 1 | Shared UAMI | `az identity create`; retain its resource and principal IDs in operator setup state. |
| 2 | Fresh namespace; select UAMI for outbound calls | `az iot adr ns create --outbound-user-assigned-mi <identity-id>`; ADR ARM API `2026-11-02-preview`. |
| 3 | Fresh DPS; attach same UAMI, set `disableLocalAuth=true` | ARM `PUT` on the DPS resource with API `2026-06-01-preview`; the experiment used `az rest` because the installed DPS create command lacked the flag. |
| 4 | Fresh S1 Hub; attach UAMI, service local auth off, device SAS on | `az iot hub create --user-assigned-mi <identity-id> --disable-local-auth true --disable-device-sas false`; Hub ARM API `2026-10-01-preview`. |
| 5 | Resource-scoped roles below | `az role assignment create`; operator needs resource creation and role-assignment authority. Temporary PIM activation is an operator prerequisite, not a device operation. |
| 6 | Link DPS first, then Hub, using shared UAMI as inbound caller | `az iot adr ns link dps add` and `az iot adr ns link hub add`, both with `--user-assigned-mi`; Hub also uses `--availability Available --allocation-weight 1`. |
| 7 | Wait for resources/links to be ready and allow bounded RBAC propagation | Read back namespace endpoints and provisioning state. The namespace controls eligible Hubs; do not edit classic `iot dps linked-hub` links for this flow. |
| 8 | Create enabled individual symmetric-key enrollment | `az iot dps enrollment create --attestation-type symmetricKey --auth-type login`; service API `2026-11-02-preview`. Securely deliver only this device's bootstrap inputs. |

Namespace link commands coordinate endpoint configuration and role/identity
checks; they are not necessarily a single REST request. In the experiment, ARM
operations used the regional endpoint `https://centraluseuap.management.azure.com`
with the ARM token audience `https://management.azure.com/`.
The device endpoint was `global-canary.azure-devices-provisioning.net`; discover
and carry the configured endpoint rather than deriving it from the namespace name.

### Role assignments present in the successful run

| Principal | Scope | Roles |
| --- | --- | --- |
| Shared UAMI | Namespace | Contributor; Azure Device Registry Contributor; Azure Device Registry Onboarding |
| Shared UAMI | DPS | Contributor; Device Provisioning Service Data Contributor |
| Shared UAMI | Hub | Contributor; IoT Hub Data Contributor |
| Azure IoT Hub first-party service principal | Each owned UAMI, namespace, DPS and Hub resource | Contributor |
| Operator | Test Hub / DPS | IoT Hub Data Contributor / Device Provisioning Service Data Contributor |

There was no RG-wide Contributor grant. Verify tenant service identity and scopes;
do not copy another tenant's principal ID. Reproduce the known-good matrix first,
then isolate and reduce permissions in an authorized experiment. A `403000`
message alone does not identify the denied principal, action or scope.

The proof also had a root CA, intermediate CA and 30-day policy for the separate
certificate enrollment. The SAS enrollment was not policy-bound. A SAS-only stack
without those CA resources is a reasonable scope reduction to verify, not an
independently proven configuration from that run.

## Mobile flow and transport boundary

Use the foundation's connection interface rather than exposing a vendor SDK to
screens. Reuse the existing Hub/DPS code where reliable; own endpoint selection,
timeouts, cancellation, credential handling and typed results.

| Step | Phone responsibility | Reference behavior |
| --- | --- | --- |
| 1 | Read manual/QR input, validate it and show destination/device identity | Preserve existing QR/connection-string inputs. Version any new QR schema and redact secrets. |
| 2 | Register with scope, registration ID and device key | Python proof: `ProvisioningDeviceClient.create_from_symmetric_key(..., websockets=True)` then `register()`; SDK DPS protocol API `2019-03-31`. Implement equivalent mobile behavior, not Python inside the app. |
| 3 | Wait for assignment with bounded polling/retries | Honor retry guidance; handle failure and cancellation. Never assume assigned `deviceId` equals registration ID. |
| 4 | Connect to the returned Hub/device identity | Proof: `IoTHubDeviceClient.create_from_symmetric_key(...)`; MQTT over secure WebSockets. Validate the expected service destination and keep TLS verification enabled. |
| 5 | Send sensor telemetry and reported properties; handle methods/desired properties | Proof SDK calls: `connect()`, `send_message()`, `patch_twin_reported_properties()`, `shutdown()`; Hub protocol API `2019-10-01`. Preserve PAAD's PnP payload contract independently of SDK version. |
| 6 | Save the minimum device credentials in secure storage and restore safely | Avoid duplicated sessions/listeners; regenerate expiring SAS credentials and reconnect without infinite tight loops. |
| 7 | Show local connection/activity; keep registry status separate | Operator verifies the record. There is no automatic app-side ARM access from possessing a DPS key. |

The current app sends model `dtmi:azureiot:PhoneAsADevice;2` and PnP component
payloads. Test that actual model-bearing request on the working namespace path.
Do not silently remove the model to make onboarding pass. Keep a minimal-payload
diagnostic case to distinguish model/transport issues from service configuration.
The Python proof's protocol versions are evidence, not a requirement to downgrade
every mobile API to those versions.

Keep provisioning and connection state separate from optional registry evidence:

```text
Not connected -> Validating -> Provisioning -> Connecting -> Connected
                         failure/cancel/retry states are explicit

Registry: Not checked | Checking | Confirmed at <time> | Check failed
```

For direct-Hub registration, skip Provisioning. "Valid input" is not proof that
Azure accepted credentials. For P0, registry status stays "Not checked" in-app;
operator evidence satisfies acceptance. An inaccessible registry does not turn a
working Hub connection into a failed connection.

## HIG application to onboarding and device activity

Apply the complete [foundation HIG contract](MODERNIZATION.md#design-contract-apple-human-interface-guidelines).
These requirements are specific to this branch:

| Screen / state | Required behavior |
| --- | --- |
| Connection method | Keep "IoT Hub" and "DPS"; explain that namespace support depends on the operator's links, not a separate phone transport. Do not require unused subscription fields. |
| Credentials | Clear field labels, no autocorrection of IDs/keys, secure key input with deliberate reveal, manual fallback to QR. Inline validation preserves entered data. |
| QR camera | Ask for camera access at Scan, include accessible Close and Enter Manually actions, prevent duplicate submissions, release camera on exit. |
| Provisioning | Show the actual stage with an activity indicator, not invented percentages. Allow Cancel and explain actionable failure/retry choices. |
| Connected device | Prioritize device ID, assigned Hub and connection state. Label local sends versus acknowledgements; do not claim downstream receipt or namespace confirmation without evidence. |
| Permissions / errors | No startup permission barrage or routine modal alerts. Explain denial in context; offer Settings where appropriate without repeated prompts. |
| Diagnostics | Put technical codes and operation IDs behind Details. User-initiated export/copy excludes keys, SAS tokens and sensitive payloads. |
| Accessibility | Announce major connection-state changes, not every sensor sample. Use text plus status icons, Dynamic Type, VoiceOver/TalkBack, adequate hit regions and Reduce Motion. |
| Reset / disconnect | Disconnect ends the session; Forget Credentials is a separate, clearly explained action. Do not delete Azure devices when clearing local data. |

No custom Azure-portal dashboard or decorative glass system. Follow Apple's
[onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding),
[privacy](https://developer.apple.com/design/human-interface-guidelines/privacy),
[progress](https://developer.apple.com/design/human-interface-guidelines/progress-indicators)
and [alert](https://developer.apple.com/design/human-interface-guidelines/alerts)
guidance. Keep Android's native interaction conventions.

## In-app namespace visibility: separate authorization decision

A device key authorizes device operations, not subscription inventory reads.
P0 therefore documents an external operator lookup; it does not add Azure login.
If in-app confirmation becomes required, first choose either an authorized-user
read flow or an approved backend with narrowly scoped, caller-authorized access.
Design authorization, consent, caching, revocation and failure behavior before
implementing it. Do not ship a shared administrative token or infer confirmation
from `registryDeviceExternalId` returned by a client helper.

## Certificate milestone: not part of SAS acceptance

The reference experiment used:

1. `az iot adr ns ca create` for ECC root/intermediate CAs, then
   `az iot adr ns ca policy create` for a 30-day policy.
2. A symmetric-key enrollment with `--adr-namespace`, `--adr-ca-name` and
   `--adr-cert-policy-name` references.
3. A device-generated P-256 key and CSR; device REST `PUT
   /{scope}/registrations/{id}/register?api-version=2026-11-02-preview` with
   `registrationId` and a base64-DER `csr`, authenticated by bootstrap SAS.
4. `GET /{scope}/registrations/{id}/operations/{operationId}` with the same API
   version until assigned. CLI equivalent: `az iot device registration create`
   with CSR input, followed by `operation-status`.
5. Decoding the returned base64-PEM certificate chain, matching the leaf public
   key, and connecting through SDK `create_from_x509_certificate(...)`.
   The successful response used the `classic` connection profile.

Mobile adoption needs a separate iPhone/Android proof for secure key generation,
CSR signing, chain validation, native TLS client authentication, expiry/renewal,
rotation and recovery. Ordinary JS WebSocket options do not supply this support.
Reject unsupported connection profiles explicitly. Keep private keys on-device;
do not introduce exportable production keys merely to copy the Python harness.

## CI-first validation and milestones

After M1, run the real app with bundled JavaScript on both an Android emulator
and an iOS Simulator in GitHub Actions. Drive onboarding, cancellation, recovery
and restart with assertions and bounded waits. Retain nonsecret screenshots,
logs, platform/toolchain details and the exact built commit. Compilation,
screenshots or a mocked registration alone do not satisfy mobile-to-cloud proof.

Windows/WSL development and signed physical-iPhone builds are optional developer
workflows and later hardware acceptance routes, not prerequisites for simulator
progress. Reuse a dev binary only when its native dependency/configuration set
matches this branch. No new native build is required for compatible JS edits in
a development client; milestone acceptance still uses bundled builds without Metro.

| Milestone | Acceptance |
| --- | --- |
| A0: setup contract | Operator can reproduce/read back a known-good owned namespace/Hub/DPS setup, role scopes and enrollment. No unrelated resources are modified. |
| A1: first mobile proof | The actual app on Android emulator and iOS Simulator registers with a device key and the phone model, uses the returned Hub/device assignment, and reports a unique marker. Separate authorized Hub twin and ADR inventory reads match it on each platform. This is not physical-device acceptance. |
| A2: real PAAD behavior | Model-bearing registration, sensors, twin/method contracts, cancellation, retry, secure restore and classic Hub/DPS compatibility work. HIG onboarding/error states are reviewed. |
| A3: release gate | Standalone builds work without Metro; network loss, restart, permissions and credential reset are covered. Physical iPhone and Android sensor/BLE/camera, secure-storage upgrade and accessibility acceptance remain required before two-platform parity sign-off. |

For each cloud case, use an independent device/enrollment ID and record a
nonsecret run nonce, assigned device/Hub, operation ID and timestamps:

1. Read initial ADR inventory and establish that the test device record is absent.
2. Provision/connect from the app. Do not manually create an ADR registry record.
3. Send telemetry and report the nonce in the twin.
4. Independently run `az iot hub device-twin show --auth-type login`; match the
   exact nonce and assigned identity.
5. Run `az iot adr ns registry-device list`; require a matching `externalDeviceId`
   in the intended namespace. Allow bounded eventual-consistency polling.
6. If downstream telemetry reception is claimed, additionally consume the payload
   at the configured destination. A twin match or PUBACK alone is not that proof.

Run malformed/duplicate QR, wrong key/scope, unavailable endpoint, timeout/cancel,
network loss/resume, unassigned registration and permission-denial cases. Preserve
actual service codes; do not diagnose every error as missing RBAC or silently
fall back to a different Hub. Test credential reset without cloud deletion.
Ordinary automated logic/UI jobs use mocked services or remain disconnected;
separate live-cloud jobs exercise the actual mobile transport on trusted code
with explicit opt-in and scoped access. Python SDK evidence is a reference,
not a replacement for the app's model-bearing requests.

Keep new reports secret-free and out of ordinary logs; never commit raw enrollment
responses, keys or signing material. Obtain permission before retention changes,
new billable resources, role expansion or external diagnostic uploads.

## Planning estimate and boundaries

After the foundation, initially allow **1-2 engineer-weeks for a narrow SAS
phone proof/onboarding slice**, then reassess using A1 results. Rough affected
scope: **8-15 existing/new app, test and documentation paths** around registration,
connection adapter, storage metadata, status/details and acceptance coverage;
these overlap the modernization file estimate and must not simply be added.
Preview service issues, transport replacement or a new backend can increase it.

Do not include mobile certificate support, in-app Azure authorization/registry
reads or full namespace management in that estimate. A cloud SDK success alone
does not resolve those mobile product and native-platform decisions.
