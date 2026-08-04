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
| 3 — Generalize the pattern | ✅ **Done — verified green on the simulator** | Registry/protocol abstraction (`PresetRegistry`, `LiveActivityEngine`, `createLiveActivityFactory`) so new presets are cheap; validated with Generic Progress. Spec `docs/superpowers/specs/2026-07-26-phase-3-generalize-pattern-design.md`, plan `docs/superpowers/plans/2026-07-26-phase-3-generalize-pattern.md` (branch `phase-3-generalize-pattern`, merged to `main`). Simulator-verified: start/render/end round-trip for Now Playing (regression) + Generic Progress; on-device visual pass still outstanding. |
| 4 — Remaining presets | ✅ **Done — verified green on the simulator** | Delivery + Timer presets shipped on top of the Phase 3 abstraction, with zero diff to `core/`/`presets/`'s shared shape. Spec `docs/superpowers/specs/2026-07-26-phase-4-delivery-timer-presets-design.md`, plan `docs/superpowers/plans/2026-07-26-phase-4-delivery-timer-presets.md` (branch `phase-4-delivery-timer`, merged to `main`). Simulator-verified: both presets' compact glyphs render with correct accent colors and start/end correctly. **Outstanding (deferred to the on-device visual pass, same as Phase 3):** expanded/long-press layout, Lock Screen banner, Timer's ticking/pause-resume behavior, Delivery's map snapshot. |
| 5 — Remote push updates | ⛔ **Blocked** | Requires a paid Apple Developer Program account — do not implement or scaffold push-token/APNs code until told the account is active |
| 6 — DX polish | 🟡 **Config plugin done** | Config plugin ships (`app.plugin.js` generates the widget target; consumer writes zero Swift; 4 options). Spec `docs/superpowers/specs/2026-07-27-phase-6-config-plugin-design.md`, plan `docs/superpowers/plans/2026-07-27-phase-6-config-plugin.md` (branch `phase-6-config-plugin`). **Remaining:** native error messages, prop defaults, unsupported-path signalling. |
| 7 — Docs & example app | ⬜ Not started | |
| 8 — Testing matrix | ⬜ Not started | |
| 9 — Publish v0.1 | ⬜ Not started | |
| 10 — Iterate | ⬜ Not started | |

### Important account constraint

The developer is currently on a **free Apple ID / Personal Team**, not a paid Apple Developer Program membership. This means:

- **Do not add the App Groups capability/entitlement** anywhere (app target, widget extension target, `app.json`, entitlements files) unless explicitly asked. It is not required for Phase 2–6 — ActivityKit delivers content state to the widget extension directly through the framework; it does not require shared App Group storage for the core start/update/end flow, and the config plugin doesn't need it either.
- **Do not add the Push Notifications capability, `aps-environment` entitlement, or any ActivityKit push-token code.** This belongs to Phase 5 and requires a paid account. If you're implementing something and find yourself reaching for a push token, stop — that's a Phase 5 concern, not now.
- **`appleTeamId` in `app.json` is now set and stays** (`ios.appleTeamId: A66QV2FW3V`) — the `@bacons/apple-targets` widget extension needs it to sign the widget target for physical-device builds. Device signing still uses Xcode "Automatically manage signing" with the Personal Team; the Apple ID that owns this team must be logged into Xcode ▸ Settings ▸ Accounts. (This reverses the earlier "do not set appleTeamId" rule, per the developer's Phase-2 device pass.)
- The example app's bundle identifier must stay **globally unique** (it's prefixed with the developer's GitHub username or similar) — don't change it to something generic.
- Don't add code paths that assume TestFlight or App Store distribution exists yet.

---

## Repository layout

```
islandkit/                          (pnpm workspace root)
├── packages/
│   └── expo-island-kit/
│       ├── app.plugin.js        (config plugin — generates the consumer's widget target)
│       ├── plugin/
│       │   ├── generateTarget.js  (pure, unit-tested generator)
│       │   └── widget/            (the shipped widget SwiftUI template)
│       ├── src/
│       ├── ios/                   (shared/ holds the single-source *Attributes.swift)
│       └── expo-module.config.json
└── apps/
    └── example/                   (targets/ is now plugin-generated + git-ignored)
```

Note: the package now owns and ships the widget target definition (`plugin/`) — the config plugin generates `targets/island-kit-widget/` into a consumer's project at prebuild time. The example app consumes IslandKit like any other consumer: no widget Swift lives in its tracked source, and `npx expo prebuild -p ios --clean` regenerates the target from the package before every build.

---

## Architecture (how a call flows)

```
JS/TS (packages/expo-island-kit/src)
  → NowPlayingActivity.start(props, deepLinkUrl)
  → Expo Modules native call (JSI)
Swift native module (packages/expo-island-kit/ios)
  → decodes props into ActivityAttributes + ContentState
  → calls Activity<NowPlayingAttributes>.request(attributes:content:)
Widget extension (generated into <projectRoot>/targets/island-kit-widget by app.plugin.js)
  → SwiftUI views render compact/minimal/expanded Dynamic Island regions
  → SwiftUI view renders the Lock Screen banner
```

Match this shape for every preset — don't invent a different pattern per preset.

---

## What to build next

Phases 1–4 are done (Now Playing, the Phase 3 registry/protocol abstraction, and the Delivery + Timer presets all ship, verified on the simulator; Now Playing is also device-verified from Phase 2). Phase 6's config-plugin slice is also done — `app.plugin.js` generates the consumer's widget extension target at `expo prebuild`, so consumers write zero Swift. Phase 5 (remote push updates) stays **blocked** until the developer has a paid Apple Developer Program account — do not implement or scaffold push-token/APNs code before then.

What's left, in rough order:

- **Phase 6 DX polish (remaining):** clearer native error messages, sensible prop defaults, and clean signalling on unsupported paths (old OS, Live Activities disabled, excluded preset called anyway — see `docs/islandkit-full-documentation.md` §11's `presets` warning).
- **Outstanding on-device visual pass:** everything shipped so far has only been simulator-verified for its newest pieces. Still needed on real Dynamic Island hardware, built via `expo prebuild --clean` from the plugin (not the old manually-scaffolded target): expanded/long-press layout, the Lock Screen banner, Timer's live ticking countdown and pause/resume behavior, and Delivery's map snapshot rendering.
- **Phases 7–10** (docs & example app, testing matrix, publish v0.1, iterate) — not started.

Don't skip ahead into Phase 5 or start substantial new preset/architecture work without being asked; the sections below (Definition-of-Done conventions, coding conventions, account constraints) still apply to whatever comes next.

---

## Coding conventions

- **TypeScript**: strict mode, no `any` in public API surface, exported types match the spec exactly (don't rename fields casually — consumers will depend on this shape)
- **Swift**: standard Swift API design guidelines naming (lowerCamelCase functions/properties, UpperCamelCase types), prefer `struct` over `class` for `ActivityAttributes`/`ContentState` per Apple's requirements (`Codable, Hashable`)
- **No third-party Swift dependencies** for the widget extension unless there's a strong reason — keep the extension lightweight, since extension processes have tight memory limits
- **Commit style**: conventional commits (`feat:`, `fix:`, `chore:`) — matches the Phase 1 commit already made

## Non-goals right now (don't build these unless asked)

- Android support of any kind
- Push notifications / remote updates (Phase 5, blocked on paid account)
- Widget customization / eject story — the generated `targets/island-kit-widget/` is overwritten every prebuild by design; a supported override mechanism is a later phase
- TestFlight or App Store distribution setup
- Any UI polish beyond "correct and legible" — visual refinement is a later pass