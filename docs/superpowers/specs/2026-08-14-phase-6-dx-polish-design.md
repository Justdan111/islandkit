# Phase 6 DX Polish — Design

**Status:** approved 2026-08-14. Branch `phase-6-dx-polish`, cut from `main` @ `48f80aa`.

## Problem

Every failure path in IslandKit collapses to the same signal: an empty activity id.

```swift
// ExpoIslandKitModule.swift
guard #available(iOS 16.2, *), let handler = PresetRegistry.handler(preset) else { return "" }

// LiveActivityEngine.swift
guard ActivityAuthorizationInfo().areActivitiesEnabled else { return "" }
do { ... } catch { return "" }   // the real ActivityKit error is discarded entirely
```

So iOS < 16.2, a user-disabled toggle, an unknown preset, and ActivityKit refusing outright are indistinguishable to the caller — and the most informative thing a developer gets is silence.

The `presets` footgun is worse, because it doesn't even produce an empty id. Narrowing the plugin's `presets` array omits that preset's Widget from the generated target, but `PresetRegistry` still registers all four handlers natively. `start()` therefore succeeds and returns a **valid** id; there is simply no Widget compiled to render that `ActivityAttributes` type, so nothing appears. Nothing in the system can currently detect this.

Separately, `getActiveInstances()` returns only an in-process `Map`, so activities that survive an app restart — which all of them do — cannot be updated or ended through the public API.

## Decisions

### 1. Failure taxonomy: throw on misuse, stay inert on environment

Developer mistakes are loud; user- and OS-controlled conditions are not. An app must not crash because someone turned Live Activities off in Settings.

| Condition | Behaviour |
|---|---|
| `unknown-preset` — name not in the registry | **throws** `IslandKitError` |
| `preset-excluded` — valid preset, absent from the plugin's `presets` | **throws** `IslandKitError` |
| `not-ios` | inert instance, `reason: 'not-ios'` |
| `unsupported-os` — iOS < 16.2 | inert instance, `reason: 'unsupported-os'` |
| `activities-disabled` — user toggle off | inert instance, `reason: 'activities-disabled'` |
| `system-refused` — ActivityKit threw | inert instance, `reason: 'system-refused'` |

```ts
export type IslandKitFailureReason =
  | 'not-ios' | 'unsupported-os' | 'activities-disabled' | 'system-refused';

export class IslandKitError extends Error {
  readonly code: 'unknown-preset' | 'preset-excluded';
  readonly preset: string;
}

interface LiveActivityInstance<T> {
  readonly id: string;
  readonly reason?: IslandKitFailureReason;   // set only when id === ''
  // update / end unchanged
}
```

An inert result also emits `console.warn` **guarded by `__DEV__`**, so the reason is visible in Metro without polluting production logs.

This is a breaking change to the `start()` contract. It is being made now precisely because **v0.1 is not yet published** — the change is free today and expensive after adopters exist.

### 2. Transport: a record, plus real Swift exceptions

`startLiveActivity` returns a bare `String` today. It becomes a record:

```swift
Function("startLiveActivity") { (preset: String, props: [String: Any], deepLinkUrl: String?)
  -> [String: Any?] in   // { "id": String, "reason": String? }
```

Misuse throws an Expo Modules `Exception` from Swift, which surfaces in JS and is rewrapped by the factory as `IslandKitError`. Environmental failures return `{ id: "", reason: "..." }`.

### 3. Detecting the footgun: `IslandKitIncludedPresets` in Info.plist

`app.plugin.js` already calls `withInfoPlist` (it sets `NSSupportsLiveActivities`). It additionally writes the resolved preset keys:

```xml
<key>IslandKitIncludedPresets</key>
<array><string>nowPlaying</string><string>timer</string></array>
```

The Swift module reads this once, lazily, from `Bundle.main`. If the requested preset is absent, it throws with the included list and the exact fix:

> `preset "delivery" is not included in this build. Included: nowPlaying, timer. Add it to the plugin's "presets" option and re-run: npx expo prebuild -p ios --clean`

**Back-compat:** if the key is missing entirely (an app prebuilt with an older IslandKit), the check is skipped rather than throwing — absence means "unknown", not "excluded". Only an explicitly present array can trigger `preset-excluded`.

### 4. Native error messages

`LiveActivityEngine.start`'s `catch` captures `error.localizedDescription`, returns `reason: 'system-refused'` with the detail attached, and `NSLog`s it. Today that error is discarded, which is why the failure presents as silence.

### 5. Prop defaults and validation

The dangerous cases are value-shaped, not absence-shaped:

- **`progress`** is clamped into `0...1`. Out-of-range values silently render a broken bar.
- **`Timer.endDate` in the past** warns in `__DEV__` — **deliberately a warning, not a throw**. A past `endDate` does not belong in the "developer error" bucket: it legitimately occurs at runtime when a timer expires between computing the date and the call landing, and throwing would crash apps for a valid state. `Text(timerInterval:)` requires a future range, but the widget already guards the crash; the real cost is silent degradation to a static display, which the warning names.
- **`accentColor`** continues to fall back to the plugin's `defaultAccentColor`, then the built-in. No change; documented.

**Scope of this item, decided explicitly:** targeted validation of the value-shaped hazards above, **not** exhaustive defaulting of every optional prop. TypeScript already separates required from optional, and `PropCoercion`'s "absent key keeps the previous value" semantics on `update` depend on absence staying distinguishable from an injected default — filling in defaults would break partial updates.

Clamping happens in the TS factory so it applies uniformly and is unit-testable.

### 6. `getActiveInstances()` across processes

New native function:

```swift
Function("getActiveActivityIds") { (preset: String) -> [String] in
  // Activity<A>.activities.map(\.id) via the preset handler
}
```

`getActiveInstances()` merges those ids with the in-process map, materialising instances for ids it did not itself start. Activities surviving an app restart become updatable and endable, closing the limitation Phase 7 documented.

**This is the highest-risk item in the phase and carries the highest test priority.** It is the only change reconciling two sources of truth — the JS map and ActivityKit's own list — and its failure modes are quiet rather than loud:

- an id present in both sources must yield exactly **one** instance, not a duplicate
- an id in the JS map that ActivityKit no longer lists (the OS or the user dismissed it) must be **dropped**, not returned as a ghost that silently no-ops on `end()`
- an id only ActivityKit knows (started by a previous process) must come back as a **fully functional** instance
- the native list is authoritative on existence; the JS map contributes nothing beyond identity

Required coverage, both layers:
- **Jest:** merge with overlap (no duplicates), native-only id materialises and is endable, JS-only stale id is dropped, empty native list, and native call failing (must degrade to the in-process map rather than throw).
- **Simulator, explicitly:** start an activity → terminate the app → relaunch → `getActiveInstances()` returns it → `end()` it → confirm the Dynamic Island clears. "An activity from a previous launch becomes endable" is the acceptance criterion; anything less does not verify this item. Use the Release-build + `step.txt` harness recipe, since activities survive termination and reinstall is what clears them.

### 7. Bug fix: `start()` platform guard

`update()` and `end()` guard on `Platform.OS !== 'ios'`; `start()` does not, and calls straight into the native module on any platform. It gains the guard and returns an inert instance with `reason: 'not-ios'`.

## Testing

- **Jest, mocked native module:** reason mapping for all four environmental cases; `IslandKitError` thrown with correct `code`/`preset` for both misuse cases; `progress` clamping; past-`endDate` warning; `getActiveInstances()` merge including a native-only id; `__DEV__` warning suppressed in production.
- **Native:** simulator build must reach literal `** BUILD SUCCEEDED **`. Plus a deliberate excluded-preset prebuild (`presets: ['nowPlaying']`) to confirm the thrown error names the missing preset, then restored.

## Documentation impact

`packages/expo-island-kit/README.md` known-limitations must be rewritten:
- the `presets` footgun entry — now throws loudly rather than failing silently
- the `getActiveInstances()` cross-process entry — **removed**, the gap is fixed
- the "native errors are coarse" entry — replaced by the reason/throw contract
- API reference gains `reason`, `IslandKitError`, `IslandKitFailureReason`

## Out of scope

Push updates, App Groups, theming, animations (v2), and anything requiring a paid Apple Developer account. iOS only. No SDK bump.
