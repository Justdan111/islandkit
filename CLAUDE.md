# CLAUDE.md — IslandKit build guide

This file is context for Claude Code working in this repository. Read this before making changes. It reflects the current state of the project and what should be built next.

---

## What this project is

**IslandKit** (npm: `expo-island-kit`) is an Expo module that provides drop-in, pre-built iOS Live Activities and Dynamic Island presets — Now Playing, Delivery, Timer, Generic Progress — with a TypeScript-only API. Consumers of the package never write Swift; all SwiftUI layout and ActivityKit plumbing ships inside the package.

Full product spec and API reference: see `docs/islandkit-full-documentation.md` in this repo (or ask for it if not present — it covers every preset's props, the shared instance API, config plugin options, and the push-notification payload format in detail). This CLAUDE.md is the condensed, build-oriented version of that spec.

**Platform scope: iOS only.** Do not add Android code, Android config, or Android-conditional branches unless explicitly asked. If a function needs to exist cross-platform for the JS API surface to type-check, it should no-op safely on non-iOS rather than attempt any implementation.

---

## Current status & active phase

Development is phased. **Do not skip ahead or start work belonging to a later phase without being asked.**

| Phase | Status | Summary |
|---|---|---|
| 0 — Spec | ✅ Done | This document + full docs are the spec |
| 1 — Environment setup | ✅ Done on simulator — device run pending developer signing | Monorepo scaffolded, iOS-only module + example app linked; builds/boots on iPhone 17 Pro simulator with a verified native call (`areLiveActivitiesEnabled → true`). Physical-device run per `docs/phase-1-device-signing.md`. Pinned to **Expo SDK 55** (Xcode 26.0.1 can't build SDK 56+; see `docs/phase-1-device-signing.md`). |
| 2 — Now Playing preset (end to end) | ✅ **Done — verified green on real Dynamic Island hardware (iPhone 14 Pro)** | TS API, Swift ActivityKit bridge, `island-kit-widget` SwiftUI extension, example harness (branch `phase-2-now-playing-preset`). All 5 DoD checks passed on device: Start (pill appears + persists after leaving app), long-press expand (title/artist/artwork/progress), Update (live content change), lock (Lock Screen banner), End (clean removal). Known polish item logged (expanded bottom progress-bar clip — deferred to a later visual pass). |
| **3 — Generalize the pattern** | 🔵 **Active** | Registry/protocol abstraction so new presets are cheap; validate with Generic Progress. Spec `docs/superpowers/specs/2026-07-26-phase-3-generalize-pattern-design.md`, plan `docs/superpowers/plans/2026-07-26-phase-3-generalize-pattern.md` (branch `phase-3-generalize-pattern`). |
| 4 — Remaining presets | ⬜ Not started | Delivery, Timer, Generic Progress |
| 5 — Remote push updates | ⛔ **Blocked** | Requires a paid Apple Developer Program account — do not implement or scaffold push-token/APNs code until told the account is active |
| 6 — DX polish | ⬜ Not started | Config plugin polish, error messages, defaults |
| 7 — Docs & example app | ⬜ Not started | |
| 8 — Testing matrix | ⬜ Not started | |
| 9 — Publish v0.1 | ⬜ Not started | |
| 10 — Iterate | ⬜ Not started | |

### Important account constraint

The developer is currently on a **free Apple ID / Personal Team**, not a paid Apple Developer Program membership. This means:

- **Do not add the App Groups capability/entitlement** anywhere (app target, widget extension target, `app.json`, entitlements files) unless explicitly asked. It is not required for Phase 2–4 — ActivityKit delivers content state to the widget extension directly through the framework; it does not require shared App Group storage for the core start/update/end flow.
- **Do not add the Push Notifications capability, `aps-environment` entitlement, or any ActivityKit push-token code.** This belongs to Phase 5 and requires a paid account. If you're implementing something and find yourself reaching for a push token, stop — that's a Phase 5 concern, not now.
- **`appleTeamId` in `app.json` is now set and stays** (`ios.appleTeamId: A66QV2FW3V`) — the `@bacons/apple-targets` widget extension needs it to sign the widget target for physical-device builds. Device signing still uses Xcode "Automatically manage signing" with the Personal Team; the Apple ID that owns this team must be logged into Xcode ▸ Settings ▸ Accounts. (This reverses the earlier "do not set appleTeamId" rule, per the developer's Phase-2 device pass.)
- The example app's bundle identifier must stay **globally unique** (it's prefixed with the developer's GitHub username or similar) — don't change it to something generic.
- Don't add code paths that assume TestFlight or App Store distribution exists yet.

---

## Repository layout

```
islandkit/                          (pnpm workspace root)
├── packages/
│   └── expo-island-kit/            (the actual npm package — this is what ships)
│       ├── src/                    (TypeScript API — what consumers import)
│       ├── ios/                    (Expo Modules native bridge, Swift)
│       └── expo-module.config.json
├── apps/
│   └── example/                    (Expo app used for local testing/dev, not published)
│       ├── app.json
│       ├── targets/
│       │   └── island-kit-widget/  (@bacons/apple-targets widget extension — Now Playing SwiftUI lives here for now)
│       │       └── expo-target.config.js
│       └── App.tsx
└── pnpm-workspace.yaml
```

Note: during early development, the widget extension SwiftUI views live inside `apps/example/targets/island-kit-widget/` (scaffolded by `@bacons/apple-targets`). As the package matures (Phase 3+), the goal is for the package itself to own and ship this target definition so consumers don't have to run `create-target` manually — but don't attempt that restructuring during Phase 2. Get one preset working end to end in the example app first.

---

## Architecture (how a call flows)

```
JS/TS (packages/expo-island-kit/src)
  → NowPlayingActivity.start(props, deepLinkUrl)
  → Expo Modules native call (JSI)
Swift native module (packages/expo-island-kit/ios)
  → decodes props into ActivityAttributes + ContentState
  → calls Activity<NowPlayingAttributes>.request(attributes:content:)
Widget extension (apps/example/targets/island-kit-widget)
  → SwiftUI views render compact/minimal/expanded Dynamic Island regions
  → SwiftUI view renders the Lock Screen banner
```

Match this shape for every preset — don't invent a different pattern per preset.

---

## Phase 2 — what to build right now

Build the **Now Playing** preset completely, end to end, so it can be tested on a physical device.

### 1. Swift: Activity Attributes + Content State

In the widget extension target, define:

```swift
struct NowPlayingAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var title: String
        var artist: String
        var artworkUrl: String?
        var isPlaying: Bool
        var elapsedSeconds: Double
        var durationSeconds: Double
    }
    // Static/fixed-for-life fields (if any) go outside ContentState.
    // For Now Playing, everything is expected to change over the life of the
    // activity, so ContentState should carry essentially all of the props.
}
```

### 2. Swift: SwiftUI views for every Dynamic Island region

Implement, inside a `NowPlayingLiveActivity: Widget` conforming to `ActivityConfiguration`:

- `DynamicIsland` with:
  - `.compactLeading` — small artwork thumbnail
  - `.compactTrailing` — play/pause glyph (or simple waveform if time allows; glyph is an acceptable first pass)
  - `.minimal` — artwork thumbnail only
  - `.expanded` regions:
    - `.leading` — artwork
    - `.trailing` — duration text
    - `.bottom` — title, artist, a progress bar (a simple `ProgressView` is fine for v1 — a scrubber with drag is a nice-to-have, not required for Phase 2 done)
- The Lock Screen banner view — same information, laid out full-width

Accent color: read from a prop, default to system accent if not provided. Don't hardcode a brand color.

Keep the SwiftUI simple and correct over polished for this phase — visual refinement is a later pass, not a Phase 2 blocker.

### 3. Swift: Expo Modules native bridge

In `packages/expo-island-kit/ios`, add functions on the module class (match whatever class name `create-expo-module` generated — don't rename it):

- `startNowPlaying(props: [String: Any], deepLinkUrl: String?) -> String` — returns the activity's `id`
- `updateNowPlaying(activityId: String, props: [String: Any]) -> Void`
- `endNowPlaying(activityId: String, dismissalPolicy: String?) -> Void`

Handle the "unsupported" case gracefully — if `ActivityAuthorizationInfo().areActivitiesEnabled` is `false`, or the OS version is below 16.1, these functions should no-op / return a clear signal rather than throw an unhandled native error.

### 4. TypeScript: public API

In `packages/expo-island-kit/src`, expose exactly this shape (from the full spec):

```ts
export interface NowPlayingProps {
  title: string;
  artist: string;
  artworkUrl?: string;
  artworkAsset?: string;
  isPlaying: boolean;
  elapsedSeconds: number;
  durationSeconds: number;
  accentColor?: string;
}

export interface LiveActivityInstance<T> {
  readonly id: string;
  update(props: Partial<T>): Promise<void>;
  end(dismissalPolicy?: 'default' | 'immediate' | { after: Date }, finalProps?: Partial<T>): Promise<void>;
}

export interface LiveActivityFactory<T> {
  start(props: T, deepLinkUrl?: string): LiveActivityInstance<T>;
  getActiveInstances(): LiveActivityInstance<T>[];
  isSupported(): boolean;
}

export const NowPlayingActivity: LiveActivityFactory<NowPlayingProps>;
```

`getPushToken` and `addPushTokenListener` are in the full spec's shared API but belong to Phase 5 — you can leave stubs that throw a clear "not yet implemented" error, or omit them from the type entirely for now. Prefer omitting — don't ship dead/misleading API surface.

### 5. Example app screen

In `apps/example`, add a screen that:
- Calls `NowPlayingActivity.start(...)` with mock data and a button
- Has a button to call `.update(...)` with changed `elapsedSeconds`/`isPlaying`
- Has a button to call `.end()`

This is the manual test harness for this phase — it doesn't need real audio playback wired up.

### Definition of done for Phase 2

- [ ] `NowPlayingActivity.start()` from the example app produces a visible Dynamic Island pill on a physical device with Dynamic Island hardware
- [ ] Long-press expands to the full layout with title/artist/progress visible
- [ ] `.update()` visibly changes the displayed content
- [ ] `.end()` removes the activity
- [ ] Locking the device shows the Lock Screen banner with the same content
- [ ] No App Group or Push Notification entitlements were added anywhere in the process
- [ ] Works via `npx expo run:ios --device` without manual Xcode intervention beyond the one-time signing setup from Phase 1

Do not start Phase 3 (generalizing the architecture across presets) until Phase 2's checklist is fully green on a real device.

---

## Coding conventions

- **TypeScript**: strict mode, no `any` in public API surface, exported types match the spec exactly (don't rename fields casually — consumers will depend on this shape)
- **Swift**: standard Swift API design guidelines naming (lowerCamelCase functions/properties, UpperCamelCase types), prefer `struct` over `class` for `ActivityAttributes`/`ContentState` per Apple's requirements (`Codable, Hashable`)
- **No third-party Swift dependencies** for the widget extension unless there's a strong reason — keep the extension lightweight, since extension processes have tight memory limits
- **Commit style**: conventional commits (`feat:`, `fix:`, `chore:`) — matches the Phase 1 commit already made

## Non-goals right now (don't build these unless asked)

- Android support of any kind
- Push notifications / remote updates (Phase 5, blocked on paid account)
- The Delivery, Timer, and Generic Progress presets (Phase 4 — after Phase 3 generalizes the pattern)
- Config plugin automation that generates the widget target automatically (Phase 6 — for now, the target is scaffolded manually via `@bacons/apple-targets` CLI in the example app)
- TestFlight or App Store distribution setup
- Any UI polish beyond "correct and legible" — visual refinement is a later pass