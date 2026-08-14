# Phase 6 DX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace IslandKit's single silent failure signal (an empty activity id) with a contract that throws on developer error, reports a typed reason for environmental failure, detects the `presets` footgun at runtime, and makes activities that survive an app restart usable again.

**Architecture:** The native contract changes first (Swift returns a record and throws real exceptions; the config plugin publishes the included preset list to Info.plist), then the TS factory maps that contract onto the public API, then `getActiveInstances()` reconciles the JS map with ActivityKit's own list, then the docs are corrected.

**Tech Stack:** Expo SDK 57, RN 0.86.2, TypeScript strict, Swift 6.3.3 / ActivityKit, `@expo/config-plugins` (`withInfoPlist`), Jest (jest-expo).

Design spec: `docs/superpowers/specs/2026-08-14-phase-6-dx-polish-design.md` — read it before starting.

## Global Constraints

- **iOS only.** No Android code, config, or conditional branches.
- **Expo SDK 57**, RN 0.86.2. No SDK bump.
- **No paid-capability work:** no App Groups, no push, no `aps-environment`, no push-token code.
- **This is a deliberate breaking change to `start()`**, made because v0.1 is unpublished. Do not add back-compat shims for the old bare-string return.
- **Swift builds at `SWIFT_VERSION = 5.0`** for both the pod and the widget. Do not introduce Swift 6 language-mode-only constructs.
- **Never add a `Co-Authored-By: Claude`/Anthropic trailer** — CI job `commit-hygiene` fails on `^co-authored-by:.*(claude|anthropic)` over the PR range.
- **CI gate:** PR into `main`; required checks `quality` (lint at `--max-warnings 0` / typecheck / test) + `commit-hygiene`.
- **Build verdicts:** only the literal string `** BUILD SUCCEEDED **` counts. Piping `xcodebuild` through `tail`/`grep` makes the pipeline exit code meaningless — redirect to a log and grep the log.
- **After changing anything in `plugin/` or `ios/`,** re-run `npx expo prebuild -p ios --clean` in `apps/example` or you are testing stale native code.
- Simulator: iPhone 17 Pro **iOS 26.5**, id `1006EE41-F85F-46A6-9576-96E8F1ADFD20`.

---

### Task 1: Native contract — record return, real exceptions, Info.plist preset list

**Files:**
- Modify: `packages/expo-island-kit/ios/ExpoIslandKitModule.swift`
- Modify: `packages/expo-island-kit/ios/core/LiveActivityEngine.swift`
- Modify: `packages/expo-island-kit/ios/core/PresetRegistry.swift`
- Create: `packages/expo-island-kit/ios/core/IncludedPresets.swift`
- Modify: `packages/expo-island-kit/app.plugin.js`
- Modify: `packages/expo-island-kit/plugin/__tests__/generateTarget.test.js` (only if it asserts Info.plist contents)

**Interfaces produced** (Task 2 consumes these exactly):
- `startLiveActivity(preset, props, deepLinkUrl) -> [String: Any?]` returning `{ "id": String, "reason": String? }`; throws for misuse.
- `getActiveActivityIds(preset) -> [String]`
- `isLiveActivitySupported() -> Bool` (unchanged)
- Reason strings, exactly: `"unsupported-os"`, `"activities-disabled"`, `"system-refused"`.
- Thrown exception messages must contain the preset name and, for exclusion, the included list.

- [ ] **Step 1: Publish the included presets to Info.plist**

In `app.plugin.js`, the existing `withInfoPlist` call also writes the resolved preset keys. `generateTarget` already resolves them via `resolvePresetKeys(options.presets)` — export that (or recompute identically) so the plist and the generated widgets can never disagree.

```js
config = withInfoPlist(config, (c) => {
  c.modResults.NSSupportsLiveActivities = true;
  c.modResults.IslandKitIncludedPresets = presetKeys; // e.g. ['nowPlaying','timer']
  return c;
});
```

- [ ] **Step 2: Read it in Swift, lazily and back-compatibly**

Create `ios/core/IncludedPresets.swift`:

```swift
import Foundation

// Which presets the config plugin actually generated widgets for. Absent key means an
// app prebuilt by an older IslandKit — treat as "unknown", never as "excluded".
enum IncludedPresets {
  private static let cached: [String]? =
    Bundle.main.object(forInfoDictionaryKey: "IslandKitIncludedPresets") as? [String]

  static func excludes(_ preset: String) -> Bool {
    guard let list = cached else { return false }
    return !list.contains(preset)
  }

  static var listDescription: String {
    (cached ?? []).joined(separator: ", ")
  }
}
```

- [ ] **Step 3: Throw for misuse, return a record otherwise**

In `ExpoIslandKitModule.swift`, replace the bare-string `startLiveActivity`. Use Expo Modules' `Exception` so it surfaces to JS as a real error:

```swift
Function("startLiveActivity") { (preset: String, props: [String: Any], deepLinkUrl: String?) -> [String: Any?] in
  guard let handler = PresetRegistry.handler(preset) else {
    throw UnknownPresetException(preset)
  }
  if IncludedPresets.excludes(preset) {
    throw PresetExcludedException((preset, IncludedPresets.listDescription))
  }
  guard #available(iOS 16.2, *) else { return ["id": "", "reason": "unsupported-os"] }
  return handler.start(props: props, deepLinkUrl: deepLinkUrl)
}
```

Define the exceptions in the same file (Expo Modules' `GenericException` pattern):

```swift
internal final class UnknownPresetException: GenericException<String> {
  override var reason: String {
    "unknown preset \"\(param)\". Valid presets: nowPlaying, genericProgress, delivery, timer."
  }
}
internal final class PresetExcludedException: GenericException<(String, String)> {
  override var reason: String {
    "preset \"\(param.0)\" is not included in this build. Included: \(param.1). " +
    "Add it to the plugin's \"presets\" option and re-run: npx expo prebuild -p ios --clean"
  }
}
```

The protocol's `start` return type changes from `String` to `[String: Any?]`; update `LiveActivityPresetHandler` in `PresetRegistry.swift` and all four handlers in `ios/presets/` accordingly. Handlers just forward whatever `LiveActivityEngine.start` returns.

- [ ] **Step 4: Capture the real ActivityKit error**

In `LiveActivityEngine.swift`:

```swift
static func start<A: ActivityAttributes>(_ attributes: A, _ state: A.ContentState) -> [String: Any?] {
  guard ActivityAuthorizationInfo().areActivitiesEnabled else {
    return ["id": "", "reason": "activities-disabled"]
  }
  do {
    let activity = try Activity.request(
      attributes: attributes,
      content: ActivityContent(state: state, staleDate: nil)
    )
    return ["id": activity.id, "reason": nil]
  } catch {
    // Previously discarded entirely, which is why failure presented as silence.
    NSLog("[IslandKit] Activity.request failed: \(error.localizedDescription)")
    return ["id": "", "reason": "system-refused", "detail": error.localizedDescription]
  }
}
```

- [ ] **Step 5: Expose ActivityKit's own activity ids**

Add to the handler protocol and each handler:

```swift
@available(iOS 16.2, *) func activeIds() -> [String]
```
implemented as `Activity<XAttributes>.activities.map(\.id)`. Add a generic helper on `LiveActivityEngine`:

```swift
static func activeIds<A: ActivityAttributes>(_ type: A.Type) -> [String] {
  Activity<A>.activities.map { $0.id }
}
```
and the module function:

```swift
Function("getActiveActivityIds") { (preset: String) -> [String] in
  guard #available(iOS 16.2, *), let handler = PresetRegistry.handler(preset) else { return [] }
  return handler.activeIds()
}
```

- [ ] **Step 6: Verify the native build**

```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example && npx expo prebuild -p ios --clean
xcodebuild -workspace /Users/danemmanuel/Documents/islandkit/apps/example/ios/example.xcworkspace \
  -scheme example -configuration Debug \
  -destination "id=1006EE41-F85F-46A6-9576-96E8F1ADFD20" build > /tmp/ik-build.log 2>&1
grep -c '\*\* BUILD SUCCEEDED \*\*' /tmp/ik-build.log
```
Expected: `1`. Also confirm the plist key landed:
```bash
plutil -extract IslandKitIncludedPresets raw -o - apps/example/ios/example/Info.plist
```
(`-o -` is mandatory — `plutil -extract` without it **rewrites the file in place**.)

- [ ] **Step 7: Run the gate and commit**

```bash
cd /Users/danemmanuel/Documents/islandkit && pnpm lint && pnpm typecheck && pnpm test
git add packages/expo-island-kit/ios packages/expo-island-kit/app.plugin.js packages/expo-island-kit/plugin
git commit -m "feat(native): typed failure reasons, real exceptions and included-preset detection"
```

---

### Task 2: TS contract — IslandKitError, reason, validation, platform guard

**Files:**
- Modify: `packages/expo-island-kit/src/core/types.ts`
- Modify: `packages/expo-island-kit/src/core/createLiveActivityFactory.ts`
- Create: `packages/expo-island-kit/src/core/IslandKitError.ts`
- Modify: `packages/expo-island-kit/src/index.ts` (export the new types)
- Modify: `packages/expo-island-kit/src/__tests__/createLiveActivityFactory.test.ts`

**Interfaces consumed:** the native contract from Task 1 exactly — `startLiveActivity` returning `{ id, reason }` and throwing for misuse; `getActiveActivityIds(preset)`.

- [ ] **Step 1: Write the failing tests first**

Add to the existing test file (it already mocks `ExpoIslandKitModule` — follow that pattern):

```ts
it('returns an inert instance with a reason when activities are disabled', () => {
  mockStart.mockReturnValue({ id: '', reason: 'activities-disabled' });
  const inst = TestActivity.start({ title: 'x' } as never);
  expect(inst.id).toBe('');
  expect(inst.reason).toBe('activities-disabled');
});

it('rethrows a native misuse error as IslandKitError with the preset name', () => {
  mockStart.mockImplementation(() => { throw new Error('preset "delivery" is not included in this build. Included: nowPlaying'); });
  expect(() => TestActivity.start({} as never)).toThrow(IslandKitError);
});

it('clamps progress into 0..1', () => {
  mockStart.mockReturnValue({ id: 'a1', reason: null });
  TestActivity.start({ progress: 1.7 } as never);
  expect(mockStart.mock.calls[0][1].progress).toBe(1);
});

it('returns an inert not-ios instance without calling native off iOS', () => {
  Platform.OS = 'android';
  const inst = TestActivity.start({} as never);
  expect(inst.reason).toBe('not-ios');
  expect(mockStart).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run them and confirm they fail**

```bash
pnpm --filter expo-island-kit test
```
Expected: the four new tests fail (`reason` undefined, no throw, no clamping, native called).

- [ ] **Step 3: Implement**

`IslandKitError.ts`:

```ts
export type IslandKitFailureReason =
  | 'not-ios' | 'unsupported-os' | 'activities-disabled' | 'system-refused';

export class IslandKitError extends Error {
  readonly code: 'unknown-preset' | 'preset-excluded';
  readonly preset: string;
  constructor(code: IslandKitError['code'], preset: string, message: string) {
    super(message);
    this.name = 'IslandKitError';
    this.code = code;
    this.preset = preset;
  }
}
```

In the factory: add `reason` to the `Instance` class (constructor takes `id` and optional `reason`); guard `start()` on `Platform.OS !== 'ios'` returning `new Instance('', 'not-ios')`; wrap the native call in try/catch, translating a thrown native error into `IslandKitError` (`code: 'preset-excluded'` when the message contains `not included`, else `'unknown-preset'`); clamp `progress` and warn on a past `endDate` inside `serializeProps`; emit a `__DEV__`-guarded `console.warn` when `reason` is set.

Add `reason?: IslandKitFailureReason` to `LiveActivityInstance<T>` in `types.ts`. Export `IslandKitError` and `IslandKitFailureReason` from `index.ts`.

- [ ] **Step 4: Run tests until green**

```bash
pnpm --filter expo-island-kit test
```
Expected: all pass, including the pre-existing 22.

- [ ] **Step 5: Gate and commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add packages/expo-island-kit/src
git commit -m "feat: typed failure reasons, IslandKitError and prop validation"
```

---

### Task 3: `getActiveInstances()` across processes — HIGHEST TEST PRIORITY

**Files:**
- Modify: `packages/expo-island-kit/src/core/createLiveActivityFactory.ts`
- Modify: `packages/expo-island-kit/src/__tests__/createLiveActivityFactory.test.ts`

This is the only change reconciling two sources of truth. Read the spec's §6 before starting.

**Rules (from the spec):**
- native list is **authoritative on existence**; the JS map contributes only identity
- id in both → exactly one instance, no duplicate
- id in the JS map but not the native list → **dropped** (OS/user dismissed it); it must not be returned as a ghost
- id only in the native list → materialised as a **fully functional** instance
- native call throwing → degrade to the in-process map, never propagate

- [ ] **Step 1: Write the failing tests**

```ts
it('merges without duplicating an id present in both sources', () => { /* map has a1; native returns [a1] → length 1 */ });
it('materialises a native-only id as a working instance', async () => {
  // native returns ['prev-launch']; instance must be returned and end() must call endLiveActivity with that id
});
it('drops a JS-map id the native list no longer reports', () => { /* map has a1; native returns [] → length 0 */ });
it('falls back to the in-process map when the native call throws', () => { /* mock throws → returns map contents, no throw */ });
```

- [ ] **Step 2: Run and confirm failure**

```bash
pnpm --filter expo-island-kit test
```

- [ ] **Step 3: Implement the merge**

```ts
getActiveInstances(): LiveActivityInstance<T>[] {
  if (Platform.OS !== 'ios') return [];
  let nativeIds: string[];
  try {
    nativeIds = ExpoIslandKitModule.getActiveActivityIds(preset);
  } catch {
    return Array.from(active.values()); // degrade, never throw
  }
  return nativeIds.map((id) => active.get(id) ?? new Instance(id));
}
```
Note this satisfies all four rules at once: mapping over `nativeIds` makes the native list authoritative (drops stale JS ids), `active.get(id) ?? new Instance(id)` dedupes and materialises, and the catch degrades.

- [ ] **Step 4: Tests green**

```bash
pnpm --filter expo-island-kit test
```

- [ ] **Step 5: Simulator verification — the acceptance criterion**

Prove "an activity from a previous launch becomes endable". Build **Release** (embedded bundle — avoids Metro and the un-dismissable "Open in app?" dialog) and drive it with the `step.txt` harness recipe in the native-verification notes:

1. temp harness step A: `NowPlayingActivity.start(...)`, print the id
2. `xcrun simctl terminate` the app (do NOT uninstall — that would clear the activity)
3. temp harness step B: on launch call `getActiveInstances()`, print the count and ids, then `end('immediate')` the first
4. background the app to reveal the Island and screenshot: it must show the activity after relaunch, then be **gone** after the end

Record the screenshots. Revert the temp harness afterwards and confirm `git status` is clean.

- [ ] **Step 6: Gate and commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add packages/expo-island-kit/src
git commit -m "fix: getActiveInstances now returns activities started by a previous app process"
```

---

### Task 4: Documentation and PR

**Files:**
- Modify: `packages/expo-island-kit/README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rewrite the affected README sections**

- **Known limitations:** rewrite the `presets` footgun entry — it now **throws** with the included list and the fix, instead of failing silently. **Delete** the `getActiveInstances()` cross-process entry — the gap is fixed. **Replace** the "native errors are coarse" entry with the new contract.
- **API reference:** document `reason`, `IslandKitFailureReason`, `IslandKitError` (`code`, `preset`), and which conditions throw vs go inert. Include the table from the spec.
- **Quickstart:** show the recommended pattern once —
  ```ts
  const activity = NowPlayingActivity.start(props);
  if (!activity.id) {
    // reason: 'unsupported-os' | 'activities-disabled' | 'system-refused' | 'not-ios'
    console.log('Live Activity unavailable:', activity.reason);
  }
  ```
- Note that `progress` is clamped to 0–1 and that a past `Timer.endDate` warns in development.

- [ ] **Step 2: Update `CLAUDE.md`**

Phase 6 → done: config plugin, device pass, and DX polish all complete. Leave Phase 5 blocked.

- [ ] **Step 3: Full verification**

```bash
pnpm lint && pnpm typecheck && pnpm test
git log origin/main..HEAD --format='%b' | grep -icE '^co-authored-by:.*(claude|anthropic)'
```
Expected: gate exits 0; trailer count `0`.

- [ ] **Step 4: Commit, push, PR**

```bash
git add packages/expo-island-kit/README.md CLAUDE.md
git commit -m "docs: document the failure contract and the getActiveInstances fix"
git push -u origin phase-6-dx-polish
gh pr create --base main --title "feat: Phase 6 DX polish — failure contract, footgun detection, cross-process activities" --body "<summary>"
```

- [ ] **Step 5: Confirm the gate**

```bash
gh pr checks <n>
```
Expected: `quality` pass, `commit-hygiene` pass. **Do not merge** — that is the maintainer's call.

---

## Self-Review

**Spec coverage:** taxonomy (T1 S3 + T2 S3), transport record (T1 S3), Info.plist detection (T1 S1–S2), native error capture (T1 S4), prop validation (T2 S3), cross-process merge (T3), `start()` platform guard (T2 S3), docs (T4). All covered.

**Placeholders:** none — every code step carries real code. The PR body is written at execution time from actual results, which is intentional.

**Type consistency:** reason strings are identical in Swift and TS (`unsupported-os`, `activities-disabled`, `system-refused`, plus TS-only `not-ios`). `IslandKitError.code` values (`unknown-preset`, `preset-excluded`) are used identically in T2 and T4. `startLiveActivity` returns `{ id, reason }` in T1 and is consumed as such in T2.
