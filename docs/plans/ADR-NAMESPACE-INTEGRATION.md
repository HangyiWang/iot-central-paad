# PAAD ADR namespace integration plan

Status: planning only; no application or cloud changes made by this plan.
Date: 2026-09-15. Branch: `feature/adr-onboarding`.
Parent: `modernize/paad-foundation`.

## Goal and dependency

Let a phone provision through a namespace-linked DPS, connect to its assigned
IoT Hub, and send activity while Azure creates a matching ADR registry record.
Keep direct Hub and classic DPS onboarding working. The phone is a device,
not an Azure administration console.

Follow the [modernization plan](MODERNIZATION.md), including its mandatory Apple
HIG design contract and Windows/iPhone setup. Begin device implementation only
after M1 establishes a working modern build and the shared connection interface.
Cloud contract investigation and wireframes can proceed sooner. Merge the
foundation into `master` first; then merge this branch.

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

## Windows-first validation and milestones

Use the [foundation Windows-first instructions](MODERNIZATION.md#windows-first-build-and-test).
After M1, run the Android app locally on Windows and use a signed development
client on the iPhone with Metro in WSL. Switch to `feature/adr-onboarding` in the
relevant checkout. Reuse a dev binary only if its native dependency/configuration
set matches this branch. No new cloud build is required for compatible JS edits.

| Milestone | Acceptance |
| --- | --- |
| A0: setup contract | Operator can reproduce/read back a known-good owned namespace/Hub/DPS setup, role scopes and enrollment. No unrelated resources are modified. |
| A1: first phone proof | Physical iPhone registers with a device key, uses returned assignment, sends a unique marker, and has a matching actual ADR record. Android emulator reproduces cloud networking. |
| A2: real PAAD behavior | Model-bearing registration, sensors, twin/method contracts, cancellation, retry, secure restore and classic Hub/DPS compatibility work. HIG onboarding/error states are reviewed. |
| A3: release gate | Standalone builds work without Metro; network loss, restart, permissions and credential reset covered; physical Android hardware coverage completed before two-platform sign-off. |

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
Automated tests use mocked services; live-cloud cases require an explicit opt-in.

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
