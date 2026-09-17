// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
//
// Native XCUITest harness for the CI iOS simulator lane.
//
// The harness never prints its input, never prints native error text and never
// attaches screenshots or element hierarchies. The only structured output is a
// single-line record prefixed with `PAAD_XCTEST_RESULT:` whose every field is a
// fixed enumeration, a boolean or an allowlisted test identifier.

import Foundation
import XCTest

// MARK: - Fixed vocabularies

/// Milestones. Emitted with every record so an interrupted run is diagnosable.
private enum Stage: String {
  case starting
  case welcome
  case manualNavigation = "manual-navigation"
  case registrationInput = "registration-input"
  case scopeInput = "scope-input"
  case hostInput = "host-input"
  case keyInput = "key-input"
  case connecting
  case details
  case identity
  case nonce
  case submitting
  case terminating
  case restoring
  case restoredIdentity = "restored-identity"
  case finished
}

/// Mirrors `XCUIApplication.State` without exposing raw integers.
private enum ApplicationState: String {
  case unknown
  case notRunning = "not-running"
  case runningBackgroundSuspended = "running-background-suspended"
  case runningBackground = "running-background"
  case runningForeground = "running-foreground"
}

private enum Outcome: String {
  case inProgress = "in-progress"
  case passed
  case failed
}

/// Every failure reported by this harness. Thrown values carry no free text.
/// `deadline-exceeded` is reserved for the caller and never emitted here.
private enum Failure: String, Error {
  case configuration
  case launchFailed = "launch-failed"
  case missingElement = "missing-element"
  case notHittable = "not-hittable"
  case valueMismatch = "value-mismatch"
  case secretNotMasked = "secret-not-masked"
  case keyboardUnavailable = "keyboard-unavailable"
  case connectionTimeout = "connection-timeout"
  case submissionTimeout = "submission-timeout"
  case registryChanged = "registry-changed"
  case terminationFailed = "termination-failed"
  case restoreTimeout = "restore-timeout"
  case unexpectedIssue = "unexpected-issue"
}

/// The complete allowlist of application test identifiers this harness may name.
private enum Target: String, CaseIterable {
  case registrationManual = "registration-manual"
  case registrationBack = "registration-back"
  case formRegistrationId = "connection-registrationId"
  case formScopeId = "connection-scopeId"
  case formProvisioningHost = "connection-provisioningHost"
  case formDeviceKey = "connection-deviceKey"
  case formSubmit = "connection-submit"
  case connectionStatus = "connection-status"
  case connectionDetails = "connection-details"
  case connectionDetailsSheet = "connection-details-sheet"
  case assignedDeviceId = "assigned-device-id"
  case assignedHub = "assigned-hub"
  case modelId = "model-id"
  case registrationId = "registration-id"
  case registryStatus = "registry-status"
  case proofNonce = "proof-nonce"
  case proofSend = "proof-send"
  case proofStatus = "proof-status"
}

/// Fixed English application status text the user sees. Only status values that
/// the contract requires verbatim are asserted; incidental screen copy is not,
/// so presentation changes cannot destabilise this lane.
private enum AppLabel {
  static let connected = "Connected"
  static let notChecked = "Not checked"
  static let submittedLocally = "Submitted locally"
}

// MARK: - Test case configuration

private struct CaseConfig {
  let mode: String
  let provisioningHost: String
  let scopeId: String
  let registrationId: String
  let expectedDeviceId: String
  let expectedHub: String
  let nonce: String
  let modelId: String
  let deviceKey: String
}

// MARK: - Harness

final class PaadLiveUITests: XCTestCase {
  private static let appBundleIdentifier = "com.microsoft.iotpnp.ci"
  private static let springBoardBundleIdentifier = "com.apple.springboard"
  private static let maskCharacter: Character = "\u{2022}"
  /// Only these permission dialog buttons are ever pressed.
  private static let permissionDenyLabels = [
    "Don\u{2019}t Allow",
    "Don't Allow",
    "Deny",
  ]

  private enum Timeout {
    static let short: TimeInterval = 15
    static let standard: TimeInterval = 30
    static let launch: TimeInterval = 60
    static let connect: TimeInterval = 180
    static let proof: TimeInterval = 30
    static let terminate: TimeInterval = 30
  }

  private enum Scroll {
    static let forward = 6
    static let backward = 10
  }

  private var app: XCUIApplication!
  private var interruption: NSObjectProtocol?

  private var mode: String?
  private var stage: Stage = .starting
  private var failureCategory: Failure?
  private var recordedFailure = false
  private var observed: [String] = []
  private var connected = false
  private var nonceSubmitted = false
  private var coldRestored = false
  /// Last state observed while the automation session was known healthy. Teardown
  /// reuses it instead of issuing a query that a wedged application could stall.
  private var applicationState: ApplicationState = .unknown
  /// Category applied to an XCTest-reported runtime failure raised by the
  /// interaction currently in flight.
  private var pendingCategory: Failure?

  override func setUp() {
    super.setUp()
    continueAfterFailure = false
    app = XCUIApplication(bundleIdentifier: Self.appBundleIdentifier)
    app.launchArguments = []
    app.launchEnvironment = [:]
    interruption = addUIInterruptionMonitor(withDescription: "paad-permission") { alert in
      for label in PaadLiveUITests.permissionDenyLabels {
        let button = alert.buttons[label]
        if button.exists && button.isHittable {
          button.tap()
          return true
        }
      }
      return false
    }
  }

  override func tearDown() {
    if let monitor = interruption {
      removeUIInterruptionMonitor(monitor)
      interruption = nil
    }
    // The authoritative record was already emitted by the test body; repeating
    // it here costs no automation query and survives an aborted flow.
    finalize()
    super.tearDown()
  }

  override func record(_ issue: XCTIssue) {
    recordedFailure = true
    if failureCategory == nil {
      if let failure = issue.associatedError as? Failure {
        failureCategory = failure
      } else {
        failureCategory = pendingCategory ?? .unexpectedIssue
      }
    }
    emit(outcome: .failed)
    super.record(issue)
  }

  // MARK: Entry point

  func testPaadFlow() throws {
    do {
      let config = try loadConfig()
      advance(to: .starting)
      if config.mode == "live" {
        try runLive(config)
      } else {
        try runSmoke(config)
      }
    } catch let failure as Failure {
      failureCategory = failure
      recordedFailure = true
      emit(outcome: .failed)
      throw failure
    }
  }

  // MARK: Flows

  private func runSmoke(_ config: CaseConfig) throws {
    try launchApp()
    try requireWelcome(timeout: Timeout.launch)

    try openManualForm()
    try requireExists(.formRegistrationId, timeout: Timeout.standard)

    try tap(.registrationBack)
    try requireWelcome(timeout: Timeout.standard)

    try openManualForm()
    try enterCredentials(config)

    // Deliberately invalid fixtures: the submit control is inspected, never pressed.
    try requireExists(.formSubmit, timeout: Timeout.standard)

    try tap(.registrationBack)
    try requireWelcome(timeout: Timeout.standard)

    try terminateApp()
    try relaunchApp()
    try requireWelcome(timeout: Timeout.launch)
    // `coldRestored` is reserved for the live proof; smoke reports stages only.
    advance(to: .restoring)

    try terminateApp()
    advance(to: .finished, queryingState: false)
    finalize()
  }

  private func runLive(_ config: CaseConfig) throws {
    try launchApp()
    try requireWelcome(timeout: Timeout.launch)

    try openManualForm()
    try requireExists(.formRegistrationId, timeout: Timeout.standard)
    try tap(.registrationBack)
    try requireWelcome(timeout: Timeout.standard)

    try openManualForm()
    try enterCredentials(config)

    try tap(.formSubmit)
    advance(to: .connecting)

    try waitForConnected(total: Timeout.connect)
    connected = true
    advance(to: .connecting)

    dismissKnownPermissionAlert()
    try openDetails()
    try requireIdentity(config)

    let nonceField = try enterExactText(.proofNonce, text: config.nonce)
    try requireExactValue(on: nonceField, text: config.nonce, failure: .valueMismatch)
    advance(to: .nonce)

    try tap(.proofSend)
    try requireExactText(
      .proofStatus, text: AppLabel.submittedLocally,
      timeout: Timeout.proof, failure: .submissionTimeout)
    nonceSubmitted = true
    advance(to: .submitting)

    try requireExactText(
      .registryStatus, text: AppLabel.notChecked,
      timeout: Timeout.short, failure: .registryChanged)
    advance(to: .submitting)

    try terminateApp()
    try relaunchApp()

    try waitForConnected(total: Timeout.connect)
    // Saved credentials must restore without returning to onboarding.
    try waitFor(
      NSPredicate(format: "exists == false"),
      on: element(.registrationManual),
      timeout: Timeout.standard,
      failure: .restoreTimeout)
    coldRestored = true
    advance(to: .restoring)

    dismissKnownPermissionAlert()
    try openDetails()
    try requireIdentity(config)
    advance(to: .restoredIdentity)

    try terminateApp()
    advance(to: .finished, queryingState: false)
    finalize()
  }

  // MARK: Flow steps

  private func launchApp() throws {
    // The runner's environment is never forwarded to the application: it must
    // reach every screen through ordinary UI, with no launch-time shortcut.
    app.launchArguments = []
    app.launchEnvironment = [:]
    pendingCategory = .launchFailed
    app.launch()
    pendingCategory = nil
    guard app.wait(for: .runningForeground, timeout: Timeout.launch) else {
      throw Failure.launchFailed
    }
    applicationState = .runningForeground
    advance(to: .starting, queryingState: false)
  }

  private func relaunchApp() throws {
    // Same empty launch context as the first launch; the cold restore must rely
    // solely on data the application itself saved.
    app.launchArguments = []
    app.launchEnvironment = [:]
    pendingCategory = .launchFailed
    app.launch()
    pendingCategory = nil
    guard app.wait(for: .runningForeground, timeout: Timeout.launch) else {
      throw Failure.launchFailed
    }
    applicationState = .runningForeground
    advance(to: .restoring, queryingState: false)
  }

  private func terminateApp() throws {
    app.terminate()
    guard app.wait(for: .notRunning, timeout: Timeout.terminate) else {
      throw Failure.terminationFailed
    }
    // The state is proven by the wait above, so no further query is needed and
    // the closing records cannot stall on a stopped application.
    applicationState = .notRunning
    advance(to: .terminating, queryingState: false)
  }

  private func requireWelcome(timeout: TimeInterval) throws {
    try requireExists(.registrationManual, timeout: timeout)
    advance(to: .welcome)
  }

  private func openManualForm() throws {
    try tap(.registrationManual)
    try requireExists(.formRegistrationId, timeout: Timeout.standard)
    advance(to: .manualNavigation)
  }

  private func enterCredentials(_ config: CaseConfig) throws {
    // Each field is verified through the element resolved by the entry helper,
    // so a screen costs one element lookup rather than two snapshots.
    let registration = try enterExactText(.formRegistrationId, text: config.registrationId)
    try requireExactValue(on: registration, text: config.registrationId, failure: .valueMismatch)
    advance(to: .registrationInput)

    let scope = try enterExactText(.formScopeId, text: config.scopeId)
    try requireExactValue(on: scope, text: config.scopeId, failure: .valueMismatch)
    advance(to: .scopeInput)

    let host = try enterExactText(.formProvisioningHost, text: config.provisioningHost)
    try requireExactValue(on: host, text: config.provisioningHost, failure: .valueMismatch)
    advance(to: .hostInput)

    try enterSecret(.formDeviceKey, secret: config.deviceKey)

    // The endpoint must survive focusing the secure field.
    try requireExactValue(on: host, text: config.provisioningHost, failure: .valueMismatch)
    advance(to: .keyInput)
  }

  private func openDetails() throws {
    try tap(.connectionDetails)
    try requireExists(.connectionDetailsSheet, timeout: Timeout.standard)
    advance(to: .details)
  }

  private func requireIdentity(_ config: CaseConfig) throws {
    try requireExactText(.assignedDeviceId, text: config.expectedDeviceId)
    try requireExactText(.assignedHub, text: config.expectedHub)
    try requireExactText(.modelId, text: config.modelId)
    try requireExactText(.registrationId, text: config.registrationId)
    try requireExactText(
      .registryStatus, text: AppLabel.notChecked,
      timeout: Timeout.short, failure: .registryChanged)
    advance(to: .identity)
  }

  private func waitForConnected(total: TimeInterval) throws {
    // The status row only mounts once the cloud session is established, so the
    // wait covers appearance and the exact label together.
    let status = element(.connectionStatus)
    let predicate = NSPredicate(
      format: "exists == true AND (label == %@ OR value == %@)",
      AppLabel.connected, AppLabel.connected)
    let firstSlice = total / 2
    let first = XCTNSPredicateExpectation(predicate: predicate, object: status)
    if XCTWaiter().wait(for: [first], timeout: firstSlice) != .completed {
      // A permission dialog is the only sanctioned reason the first slice lapses.
      dismissKnownPermissionAlert()
      let second = XCTNSPredicateExpectation(predicate: predicate, object: status)
      guard XCTWaiter().wait(for: [second], timeout: total - firstSlice) == .completed else {
        throw Failure.connectionTimeout
      }
    }
    observe(.connectionStatus)
  }

  // MARK: Element helpers

  private func element(_ target: Target) -> XCUIElement {
    // Application test identifiers land on several native classes, so match any.
    return app.descendants(matching: .any).matching(identifier: target.rawValue).firstMatch
  }

  private func observe(_ target: Target) {
    if !observed.contains(target.rawValue) {
      observed.append(target.rawValue)
    }
  }

  private func waitFor(
    _ predicate: NSPredicate, on object: Any, timeout: TimeInterval, failure: Failure
  ) throws {
    // A bare waiter reports the timeout to this harness instead of recording a
    // test failure that would echo the predicate.
    let expectation = XCTNSPredicateExpectation(predicate: predicate, object: object)
    guard XCTWaiter().wait(for: [expectation], timeout: timeout) == .completed else {
      throw failure
    }
  }

  @discardableResult
  private func find(_ target: Target, timeout: TimeInterval) throws -> XCUIElement {
    let candidate = element(target)
    if candidate.waitForExistence(timeout: timeout) {
      observe(target)
      return candidate
    }
    // Bounded scroll search; long screens place controls outside the viewport.
    for _ in 0..<Scroll.forward {
      app.swipeUp()
      if candidate.exists {
        observe(target)
        return candidate
      }
    }
    for _ in 0..<Scroll.backward {
      app.swipeDown()
      if candidate.exists {
        observe(target)
        return candidate
      }
    }
    throw Failure.missingElement
  }

  @discardableResult
  private func requireExists(_ target: Target, timeout: TimeInterval) throws -> XCUIElement {
    return try find(target, timeout: timeout)
  }

  private func hittable(_ candidate: XCUIElement) throws -> XCUIElement {
    if candidate.isHittable {
      return candidate
    }
    for _ in 0..<Scroll.forward {
      app.swipeUp()
      if candidate.isHittable {
        return candidate
      }
    }
    for _ in 0..<Scroll.backward {
      app.swipeDown()
      if candidate.isHittable {
        return candidate
      }
    }
    throw Failure.notHittable
  }

  private func tap(_ target: Target) throws {
    let found = try find(target, timeout: Timeout.standard)
    let control = try hittable(found)
    pendingCategory = .notHittable
    control.tap()
    pendingCategory = nil
  }

  /// Verifies an already-resolved element so callers avoid a second lookup.
  private func requireExactValue(
    on field: XCUIElement, text: String, failure: Failure
  ) throws {
    try waitFor(
      NSPredicate(format: "value == %@", text),
      on: field, timeout: Timeout.short, failure: failure)
  }

  private func requireExactText(
    _ target: Target, text: String, timeout: TimeInterval = Timeout.short,
    failure: Failure = .valueMismatch
  ) throws {
    let found = try hittable(find(target, timeout: timeout))
    try waitFor(
      NSPredicate(format: "label == %@ OR value == %@", text, text),
      on: found, timeout: timeout, failure: failure)
  }

  // MARK: Text entry

  private func focusField(_ target: Target) throws -> XCUIElement {
    let found = try find(target, timeout: Timeout.standard)
    let field = try hittable(found)
    pendingCategory = .notHittable
    field.tap()
    pendingCategory = nil
    // Focus is proven by a live keyboard plus, after typing, by the field's own
    // value. Both are public attributes and neither echoes the typed text.
    try waitFor(
      NSPredicate(format: "exists == true"),
      on: app.keyboards.firstMatch, timeout: Timeout.short, failure: .keyboardUnavailable)
    return field
  }

  private func clearField(_ field: XCUIElement) {
    guard let current = field.value as? String, !current.isEmpty else {
      return
    }
    // An empty native field reports its placeholder, which must not be deleted.
    if let placeholder = field.placeholderValue, placeholder == current {
      return
    }
    pendingCategory = .notHittable
    field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: current.count))
    pendingCategory = nil
  }

  private func commitField(_ field: XCUIElement) {
    pendingCategory = .notHittable
    field.typeText("\n")
    pendingCategory = nil
  }

  @discardableResult
  private func enterExactText(_ target: Target, text: String) throws -> XCUIElement {
    let field = try focusField(target)
    clearField(field)
    pendingCategory = .notHittable
    field.typeText(text)
    pendingCategory = nil
    commitField(field)
    return field
  }

  private func enterSecret(_ target: Target, secret: String) throws {
    let field = try focusField(target)
    clearField(field)
    pendingCategory = .notHittable
    field.typeText(secret)
    pendingCategory = nil
    commitField(field)
    try requireMaskedEntry(field, expectedLength: secret.count)
  }

  /// Confirms the secret is masked and that every keystroke reached this field.
  private func requireMaskedEntry(_ field: XCUIElement, expectedLength: Int) throws {
    guard let masked = field.value as? String else {
      throw Failure.keyboardUnavailable
    }
    if let placeholder = field.placeholderValue, placeholder == masked {
      throw Failure.keyboardUnavailable
    }
    guard !masked.isEmpty else {
      throw Failure.keyboardUnavailable
    }
    guard masked.allSatisfy({ $0 == Self.maskCharacter }) else {
      throw Failure.secretNotMasked
    }
    guard masked.count == expectedLength else {
      throw Failure.valueMismatch
    }
  }

  // MARK: Permission dialogs

  /// Presses a known permission denial button when one is on screen. Never
  /// dismisses unrelated dialogs.
  private func dismissKnownPermissionAlert() {
    let springBoard = XCUIApplication(bundleIdentifier: Self.springBoardBundleIdentifier)
    let alert = springBoard.alerts.firstMatch
    guard alert.exists else {
      return
    }
    for label in Self.permissionDenyLabels {
      let button = alert.buttons[label]
      if button.exists && button.isHittable {
        button.tap()
        return
      }
    }
  }

  // MARK: Configuration

  private func loadConfig() throws -> CaseConfig {
    guard let raw = ProcessInfo.processInfo.environment["PAAD_XCTEST_CASE"] else {
      throw Failure.configuration
    }
    guard
      let parsed = try? JSONSerialization.jsonObject(with: Data(raw.utf8)),
      let fields = parsed as? [String: Any]
    else {
      throw Failure.configuration
    }
    // Resolve the mode first so even a rejected configuration produces a record.
    if let candidate = fields["mode"] as? String, candidate == "smoke" || candidate == "live" {
      mode = candidate
    }
    guard let resolvedMode = mode else {
      throw Failure.configuration
    }
    guard let version = fields["schemaVersion"] as? Int, version == 1 else {
      throw Failure.configuration
    }
    func text(_ key: String) throws -> String {
      guard let value = fields[key] as? String, !value.isEmpty else {
        throw Failure.configuration
      }
      return value
    }
    return CaseConfig(
      mode: resolvedMode,
      provisioningHost: try text("provisioningHost"),
      scopeId: try text("scopeId"),
      registrationId: try text("registrationId"),
      expectedDeviceId: try text("expectedDeviceId"),
      expectedHub: try text("expectedHub"),
      nonce: try text("nonce"),
      modelId: try text("modelId"),
      deviceKey: try text("deviceKey"))
  }

  // MARK: Diagnostics

  private func advance(to stage: Stage, queryingState: Bool = true) {
    self.stage = stage
    if queryingState {
      refreshApplicationState()
    }
    emit(outcome: .inProgress)
  }

  /// Emits the authoritative record. Never upgrades a recorded failure to a pass
  /// and never queries the application, so teardown cannot stall.
  private func finalize() {
    let failed = recordedFailure || (testRun?.failureCount ?? 0) > 0
      || (testRun?.unexpectedExceptionCount ?? 0) > 0
    let complete = stage == .finished && applicationState == .notRunning
    emit(outcome: (failed || !complete) ? .failed : .passed)
  }

  private func refreshApplicationState() {
    guard let app = app else {
      applicationState = .unknown
      return
    }
    switch app.state {
    case .notRunning:
      applicationState = .notRunning
    case .runningBackgroundSuspended:
      applicationState = .runningBackgroundSuspended
    case .runningBackground:
      applicationState = .runningBackground
    case .runningForeground:
      applicationState = .runningForeground
    case .unknown:
      applicationState = .unknown
    @unknown default:
      applicationState = .unknown
    }
  }

  private func emit(outcome: Outcome) {
    guard let mode = mode else {
      // The mode is part of the fixed schema; an unreadable configuration
      // simply fails the process without an ambiguous record.
      return
    }
    var record: [String: Any] = [
      "schemaVersion": 1,
      "runner": "xcuitest",
      "mode": mode,
      "outcome": outcome.rawValue,
      "stage": stage.rawValue,
      "applicationState": applicationState.rawValue,
      "observedTargets": observed,
      "connected": connected,
      "nonceSubmitted": nonceSubmitted,
      "coldRestored": coldRestored,
    ]
    if let category = failureCategory {
      record["failureCategory"] = category.rawValue
    }
    guard
      let data = try? JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]),
      let json = String(data: data, encoding: .utf8)
    else {
      return
    }
    FileHandle.standardOutput.write(Data("PAAD_XCTEST_RESULT:\(json)\n".utf8))
  }
}
