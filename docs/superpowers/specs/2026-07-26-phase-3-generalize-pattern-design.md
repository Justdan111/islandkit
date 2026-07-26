# Phase 3 — Generalize the Pattern — Design Spec

**Status:** approved design (brainstormed 2026-07-26)
**Goal:** Refactor the Now Playing preset onto a reusable abstraction so that adding a
new preset costs one Attributes file + one decoder/registration + one Widget + one line
of TypeScript — and prove the abstraction by adding **Generic Progress** end to end.

Canonical product spec: `docs/islandkit-full-documentation.md` (§8.4 Generic Progress, §9–10 shared API).

---

## 1. Scope

**In scope**
- A generalized architecture across three layers (TypeScript factory, Swift registry/engine, widget helpers).
- De-duplicate the shared `*Attributes.swift` so each ActivityAttributes type exists in exactly **one** source, compiled into both the app (pod) target and the widget extension target.
- Migrate **Now Playing** onto the abstraction with **no change to its public TypeScript API**.
- Add **Generic Progress** end to end (TS + Swift handler + widget) as the second data point.
- Both presets start/update/end verified on the iPhone 17 Pro simulator.

**Out of scope (unchanged from prior phases)**
- Delivery and Timer presets → Phase 4.
- Config-plugin automation / the package physically *shipping* the widget target so consumers don't scaffold it → Phase 6. (In Phase 3 the widget target still lives in `apps/example`.)
- Push / remote updates, push tokens, push-to-start, user-interaction listeners → Phase 5 (blocked on paid account). Do **not** add `getPushToken`/`addPushTokenListener` to the API surface.
- No App Groups, no Push Notifications capability, no `aps-environment`, no `appleTeamId`.
- No SDK bump (pinned to Expo SDK 55 / RN 0.83.6; Xcode 26.0.1).

---

## 2. Layer designs

### 2.1 TypeScript — one generic factory, thin preset modules

```
src/core/types.ts                     LiveActivityInstance / LiveActivityFactory / DismissalPolicy
src/core/createLiveActivityFactory.ts the generic engine (all logic; parameterized only by preset name)
src/presets/NowPlaying.ts             NowPlayingProps + createLiveActivityFactory<NowPlayingProps>('nowPlaying')
src/presets/GenericProgress.ts        GenericProgressProps + createLiveActivityFactory<GenericProgressProps>('genericProgress')
src/ExpoIslandKitModule.ts            native method declarations (preset-agnostic surface, below)
src/ExpoIslandKitModule.web.ts        no-op stubs for the same surface
src/index.ts                          re-exports both factories + shared types + areLiveActivitiesEnabled
```

`createLiveActivityFactory<T>(preset: string): LiveActivityFactory<T>` holds everything that is generic today in `NowPlaying.ts`: a per-factory `active` Map, dismissal-policy serialization (`'default'`/`'immediate'`/`{after}`→ISO), `Platform.OS !== 'ios'` no-op guards, the ghost-empty-id guard (don't track a `""` id), and the instance class whose `update`/`end` forward to the native layer under this factory's `preset` name.

Each preset module is ~10 lines: declare the props interface (field names verbatim from the canonical doc) and `export const XActivity = createLiveActivityFactory<XProps>('x')`.

**Preset-agnostic native surface** (replaces the per-preset `startNowPlaying`/etc.):
- `startLiveActivity(preset: string, props: Record<string, unknown>, deepLinkUrl: string | null): string` — sync, returns activity id or `""`.
- `updateLiveActivity(preset: string, activityId: string, props: Record<string, unknown>): Promise<void>`
- `endLiveActivity(preset: string, activityId: string, dismissalPolicy: string | null): Promise<void>`
- `isLiveActivitySupported(): boolean` — sync; one capability check shared by every preset's `isSupported()`.
- `areLiveActivitiesEnabled(): Promise<boolean>` — unchanged.

`end` and `update` carry the `preset` so the native registry can dispatch to the handler that knows the concrete `Activity<Attributes>` type (an activity id alone can't be resolved without its concrete type).

### 2.2 Swift — registry + type-erased handlers + generic engine

```
ios/core/LiveActivityEngine.swift    generic ActivityKit ops, parameterized by the concrete Attributes type
ios/core/PresetRegistry.swift        [String: any LiveActivityPresetHandler]; the Functions dispatch here
ios/core/PropCoercion.swift          string/optString/bool/double helpers + dismissal-policy parser (shared)
ios/presets/NowPlayingHandler.swift      handler + props→ContentState decoder (pod-only)
ios/presets/GenericProgressHandler.swift handler + decoder (pod-only)
ios/shared/NowPlayingAttributes.swift      ActivityAttributes struct (shared: pod + widget)  ← canonical
ios/shared/GenericProgressAttributes.swift ActivityAttributes struct (shared: pod + widget)  ← canonical
ExpoIslandKitModule.swift            4 thin Functions → PresetRegistry
```

**`LiveActivityPresetHandler`** is a type-erased protocol (no `associatedtype`) so heterogeneous handlers share one registry:
```swift
protocol LiveActivityPresetHandler {
  var name: String { get }
  @available(iOS 16.2, *) func start(props: [String: Any], deepLinkUrl: String?) -> String
  @available(iOS 16.2, *) func update(id: String, props: [String: Any]) async
  @available(iOS 16.2, *) func end(id: String, dismissalPolicy: String?) async
}
```
Each concrete handler hides its `Attributes` type internally and calls the generic engine:
```swift
enum LiveActivityEngine {
  @available(iOS 16.2, *) static func start<A: ActivityAttributes>(_ attributes: A, _ state: A.ContentState) -> String
  @available(iOS 16.2, *) static func update<A: ActivityAttributes>(_ type: A.Type, id: String, newState: (A.ContentState) -> A.ContentState) async
  @available(iOS 16.2, *) static func end<A: ActivityAttributes>(_ type: A.Type, id: String, dismissalPolicy: String?) async
}
```
The engine owns the `areActivitiesEnabled` gate, `Activity.request`/`.update`/`.end`, the `Activity<A>.activities.first(where: id)` lookup, and the `do/catch → ""` on start. The registry is consulted only inside the Functions' `#available(iOS 16.2, *)` guards; below that the Functions no-op / return `""`.

Adding a preset = one Attributes struct (shared file) + one handler+decoder file + one `PresetRegistry` registration line.

### 2.3 Widget — bespoke Widgets, shared helpers, shared Attributes

- Each preset keeps its **own** `Widget` (SwiftUI layout is inherently per-preset): `NowPlayingLiveActivity`, `GenericProgressLiveActivity`.
- `IslandKitWidgetBundle` registers all preset widgets.
- `WidgetSupport.swift` holds the shared render helpers, refactored to take **primitives** (not a specific ContentState) so both presets reuse them: `Color(hex:)`, `progressFraction(elapsed:duration:)` / clamp, `timeString(_:)`, `accentColor(hex:)`.
- The `*Attributes.swift` structs are the canonical shared files (§2.4).

### 2.4 De-dup of shared Attributes (the highest-risk mechanism)

Each `*Attributes.swift` lives **once**, canonically, in the package at `packages/expo-island-kit/ios/shared/`. It reaches both targets as follows:
- **App (pod) target:** the podspec `source_files` glob (`**/*.{swift,...}`) already compiles everything under `packages/expo-island-kit/ios/`, so the `shared/` files land in the app target automatically.
- **Widget extension target:** a **symlink** under `apps/example/targets/island-kit-widget/` points at each canonical file. `targets/` is source (not the generated `ios/`), so it is **not** wiped by `expo prebuild --clean`; apple-targets compiles the symlinked source into the widget target.

**Hard requirement — proven first, before anything is built on top:** the plan's **Task 1 is a de-risking spike** that creates one symlinked shared Attributes file, runs `expo prebuild --clean`, and confirms `** BUILD SUCCEEDED **` with the type resolving in **both** targets. Acceptance: the symlink survives `--clean` and both targets compile.

**Fallback if symlinks don't survive `--clean` or apple-targets won't compile them:** a lightweight prebuild copy-step (a tiny config-plugin/`withDangerousMod` that copies the canonical files into the widget target dir on every prebuild). This is still far lighter than the Phase-6 config-plugin automation and keeps a single source of truth at rest. The spike decides symlink vs copy before the rest of the phase proceeds.

---

## 3. Generic Progress preset (the validator)

Chosen because its fields are deliberately **unlike** Now Playing (no artwork, no `isPlaying`, an SF Symbol instead), so it proves the abstraction isn't Now-Playing-shaped.

**Props — verbatim from the canonical doc §8.4 / §10 (no additions):**
```ts
export interface GenericProgressProps {
  title: string;
  subtitle?: string;
  progress: number; // 0–1
  iconSystemName?: string;
  accentColor?: string;
}
export const GenericProgressActivity: LiveActivityFactory<GenericProgressProps>;
```

**ContentState (Swift):** `title: String`, `subtitle: String?`, `progress: Double`, `iconSystemName: String?`, `accentColorHex: String?`. Attributes carry `deepLinkUrl: String?` (same shared shape as Now Playing). Decoder maps `accentColor → accentColorHex` (the one rename, mirroring Now Playing); all other fields 1:1.

**Widget layout (canonical doc §8.4):**
- compactLeading: SF Symbol (`iconSystemName`, default fallback e.g. `"circle.dashed"`).
- compactTrailing: percentage text `"\(Int(progress*100))%"`.
- minimal: SF Symbol only.
- expanded: leading = symbol, bottom = title/subtitle + `ProgressView(value: progress)`.
- Lock Screen: symbol + title/subtitle + `ProgressView`, full-width.
- Accent from `accentColorHex` with `.accentColor` fallback (shared helper).

**Example screen:** the example app's harness gains a second control group (or a toggle) to Start/Update/End a Generic Progress activity alongside Now Playing.

---

## 4. Migration & back-compat

- `NowPlayingActivity`'s exported TypeScript shape (`NowPlayingProps`, `LiveActivityInstance`, `LiveActivityFactory`, dismissal policy) is **unchanged** — only its internals move to `createLiveActivityFactory`.
- The old per-preset native methods (`startNowPlaying`, …) are replaced by the preset-agnostic surface; TS and Swift change in lockstep, so no consumer-visible break.
- `NowPlayingAttributes` moves from `packages/expo-island-kit/ios/` and `apps/example/targets/island-kit-widget/` (two byte-identical copies today) to the single canonical `ios/shared/` file + widget symlink.

---

## 5. Testing strategy

- **TS (Jest):** unit-test `createLiveActivityFactory` generically (mock native): start passes `(preset, props, deepLink|null)`, update/end forward under the preset + id, dismissal serialization, ghost-id guard, `isSupported`. Keep the existing Now Playing assertions (now exercising the generic path) and add a Generic Progress test proving a second preset reuses the same factory.
- **Native:** app + widget build (`** BUILD SUCCEEDED **`) after the shared-Attributes de-dup; both presets compile.
- **Simulator:** Start/Update/End for **both** presets on the iPhone 17 Pro sim, using the environment techniques from Phase 2 (foreground the app via `simctl launch <bundleid>`; reveal the DI by foregrounding another app; see the build-state memory for the full gotcha list).

---

## 6. Definition of done

- [ ] Shared-Attributes de-dup proven: each `*Attributes.swift` exists in exactly one source, compiles into **both** targets, and **survives `expo prebuild --clean`** (Task 1 spike green, or the copy-step fallback adopted).
- [ ] `NowPlayingActivity` migrated onto the abstraction; its public TS API unchanged; Jest green.
- [ ] `GenericProgressActivity` added end to end (TS + Swift handler + registration + Widget), canonical prop shape.
- [ ] App + `island-kit-widget` build succeeds; both preset widgets registered in the bundle.
- [ ] Both presets Start/Update/End verified on the iPhone 17 Pro simulator.
- [ ] No App Group / Push / `aps-environment` / `appleTeamId`; no SDK bump; no push-token API surface.

**Caveat (per reviewer flag):** green on the **simulator** validates the abstraction and the start/update/end round-trip, but it is **not** a visual sign-off on real Dynamic Island hardware. That is not a Phase 3 blocker — Phase 3's job is the abstraction — but "green on simulator" must not be recorded as on-device visual confirmation. (Phase 2's own on-device visual pass remains the developer's separate task.)

---

## 7. Risks & open questions

- **Symlink vs `prebuild --clean` (highest):** mitigated by the Task 1 spike + copy-step fallback (§2.4). Everything else depends on this, so it goes first.
- **`@available` on protocol requirements:** calling availability-gated protocol methods requires the call site to be inside an availability context; the Functions already guard with `#available(iOS 16.2, *)`. If protocol-level availability proves awkward in Swift 6.2, the fallback is to gate inside each handler and register handlers only on iOS 16.2+. Implementation detail for the plan.
- **apple-targets re-prebuild quirk:** plain `expo prebuild` over an existing widget target can fail (`removeFromProject` undefined); use `--clean`. (Recorded in build-state memory.)

---

## 8. Self-review notes

- No push/token API anywhere (Phase 5). ✓
- Generic Progress props match the canonical doc §10 exactly — no `progressLabel`, `iconSystemName` (not `symbolName`). ✓
- Now Playing public API unchanged (back-compat). ✓
- Single source of truth for each Attributes type; the risky mechanism is proven before it's built upon. ✓
- Scope excludes Phase 4 presets, Phase 5 push, Phase 6 config-plugin/packaging. ✓
- DoD explicitly separates "abstraction validated on simulator" from "visual sign-off on device." ✓
