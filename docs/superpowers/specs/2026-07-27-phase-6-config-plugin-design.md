# Phase 6 — Config Plugin (Zero-Swift Consumer Setup) — Design Spec

**Status:** approved design (brainstormed 2026-07-27)
**Goal:** Ship the widget SwiftUI *in* the `expo-island-kit` package and add a config plugin (`app.plugin.js`) that auto-generates the consumer's widget extension target on `expo prebuild`, so a consumer sets up IslandKit with **one plugin line and zero Swift** — delivering IslandKit's core "TypeScript only" promise.

Builds on Phases 1–5's presets/abstraction. Canonical product spec: `docs/islandkit-full-documentation.md` (§7 mentions the SwiftUI layer is built on `@bacons/apple-targets`).

---

## 1. Scope

**In scope**
- Move the widget-side Swift (the 4 `*LiveActivity.swift`, `WidgetSupport.swift`, `IslandKitWidgetBundle.swift`, `Info.plist`, `expo-target.config.js`) **from the example app into the package** so it ships with `expo-island-kit`.
- A config plugin `app.plugin.js` at the package root that, on prebuild: copies the shipped widget sources + the shared `*Attributes.swift` into `<projectRoot>/targets/island-kit-widget/`, sets `NSSupportsLiveActivities`, and applies `@bacons/apple-targets` (`withTargetsDir`) so the consumer lists **only** `expo-island-kit` in `plugins`.
- `package.json` wiring so the plugin + sources publish (`files`, `@bacons/apple-targets` as a dependency).
- **Convert the example app to consume the plugin** (drop its hand-scaffolded `targets/`), dogfooding the plugin and proving it generates what we previously hand-built. All four presets still work on the simulator.

**Out of scope**
- The other Phase-6 "DX polish" items (native error messages, prop defaults, unsupported-path signalling) — a separate later pass.
- Push / push-token (Phase 5, blocked). No App Groups / new capabilities.
- The deferred Phase-3/4 visual items (Now Playing expanded clip, Timer device pass, etc.).
- No change to the presets, the abstraction, or any public TS API.

**Global constraints (inherited):** iOS only; Expo SDK 55 (no bump); no App Groups / Push / `aps-environment` / push-token; `ios.appleTeamId` stays a consumer responsibility; TS strict; Swift naming; conventional commits; `build/` regenerated after src edits.

---

## 2. How `@bacons/apple-targets` works (grounding)

Its config plugin is `withTargetsDir(config, { root = './targets', match = '*' })` (also the default export). At **plugin-eval time** it `globSync`s `${root}/${match}/expo-target.config.@(json|js)` in the project and turns each match into a real Xcode target. Key consequence: **the target's `expo-target.config.js` + Swift sources must exist on disk before `withTargetsDir` runs.** IslandKit's plugin therefore writes the files *synchronously, before* applying `withTargetsDir`.

---

## 3. Package restructure

- **New:** `packages/expo-island-kit/plugin/widget/` — the shipped widget "template": `NowPlayingLiveActivity.swift`, `GenericProgressLiveActivity.swift`, `DeliveryLiveActivity.swift`, `TimerLiveActivity.swift`, `WidgetSupport.swift`, `IslandKitWidgetBundle.swift`, `Info.plist`, `expo-target.config.js`. (Moved verbatim from `apps/example/targets/island-kit-widget/`.)
- **Unchanged:** `packages/expo-island-kit/ios/shared/*Attributes.swift` remain the single source of the ActivityAttributes types — the podspec glob compiles them into the app target, and the plugin **copies** them into the widget target (no symlinks in a consumer app). The pod side (`ios/core`, `ios/presets`, `ios/shared`) is untouched.
- **`package.json`:** add `"@bacons/apple-targets": "^5.0.0"` to `dependencies`; add a `"files"` array including `build`, `ios`, `plugin`, `app.plugin.js`, `expo-module.config.json` so they publish. (`app.plugin.js` at the package root is auto-detected by Expo as the config plugin.)

---

## 4. `app.plugin.js` design

A single default-exported config plugin `withIslandKit(config)` that, in order:
1. **Resolve paths:** the package dir via `__dirname`; the consumer project root via `config._internal.projectRoot` (available at plugin-eval).
2. **Copy sources (idempotent):** `fs`-copy `plugin/widget/*` and `ios/shared/*Attributes.swift` into `<projectRoot>/targets/island-kit-widget/`, creating the dir. Overwrite each prebuild so package upgrades propagate. (Copies, not symlinks — robust across package managers / CI / `prebuild --clean`.)
3. **Enable Live Activities:** `withInfoPlist` → set `NSSupportsLiveActivities = true` on the host app (so the consumer never sets it manually).
4. **Wrap apple-targets:** apply `withTargetsDir(config, { root: './targets' })` so it globs the just-written `island-kit-widget/expo-target.config.js` and builds the Xcode target.
5. Wrap the whole thing in `createRunOncePlugin(withIslandKit, 'expo-island-kit', version)` so it applies once even if referenced twice.

The consumer's `app.json`: `"plugins": ["expo-island-kit"]` — nothing else. `ios.appleTeamId` remains the consumer's to set (needed for device widget signing; the plugin does not invent a team).

---

## 5. Spike-first + fallback (risk management)

Config-plugin + apple-targets automation is the fiddliest work in the project (eval-time file I/O, plugin ordering, apple-targets quirks already seen). So the plan's **Task 1 is a de-risk spike**: a minimal `app.plugin.js` that copies **one** widget file + `NSSupportsLiveActivities` + wraps `withTargetsDir`, applied to the example (temporarily), proving `expo prebuild --clean` generates the `island-kit-widget` target and `** BUILD SUCCEEDED **`. Nothing else is built until this passes.

**Fallback if wrapping `withTargetsDir` at eval-time proves infeasible** (e.g. ordering/timing can't be made reliable): the documented **"require both plugins"** approach — the consumer lists `["@bacons/apple-targets", "expo-island-kit"]`, and IslandKit's plugin only writes the target sources (still zero Swift, one extra plugin line). Adopt only after flagging to the human; record which mechanism shipped.

---

## 6. Convert the example (dogfood + proof)

Once the plugin works:
- `apps/example/app.json`: `"plugins": ["expo-island-kit"]` (remove the explicit `"@bacons/apple-targets"` and the manual `ios.infoPlist.NSSupportsLiveActivities` — the plugin now supplies both). Keep `ios.appleTeamId`.
- **Delete** the hand-scaffolded `apps/example/targets/island-kit-widget/` from git — it becomes plugin-generated output. Add `apps/example/targets/` (or `apps/example/targets/island-kit-widget/`) to `apps/example/.gitignore`.
- `expo prebuild --clean` regenerates `targets/island-kit-widget/` from the package, then the app + widget build.

This proves the exact thing a real consumer gets: no widget Swift in their tracked source.

---

## 7. Definition of done

- [ ] Widget SwiftUI lives in the package (`plugin/widget/`); `ios/shared/*Attributes.swift` remain the single Attributes source (pod glob + plugin copy).
- [ ] `app.plugin.js` copies sources + Attributes, sets `NSSupportsLiveActivities`, and wraps `withTargetsDir`; `createRunOncePlugin`-guarded. (Or the require-both fallback, if flagged/adopted.)
- [ ] `package.json` publishes the plugin + sources (`files`) and depends on `@bacons/apple-targets`.
- [ ] Example converted: `plugins: ['expo-island-kit']` only; hand-scaffolded `targets/` deleted + git-ignored.
- [ ] `expo prebuild --clean` on the example generates the widget target from the package; app + `island-kit-widget` build succeeds.
- [ ] All four presets still start/render/end on the iPhone 17 Pro simulator (the widget is now plugin-generated).
- [ ] No widget Swift remains in the example's *tracked* source; no App Group / Push / new capability.
- [ ] Public TS API and the presets/abstraction unchanged.

**Caveat:** simulator validates the plugin generates a buildable, working target; on-device visual sign-off remains the separate later pass (unchanged from prior phases).

---

## 8. Plan shape (for writing-plans)

1. **Task 1 — De-risk spike:** minimal plugin (one widget file + `NSSupportsLiveActivities` + `withTargetsDir`) → `prebuild --clean` generates the target + `BUILD SUCCEEDED`. Gate; require-both fallback if it fails.
2. **Task 2 — Relocate widget Swift into the package** (`plugin/widget/`) + `package.json` (`files`, `@bacons/apple-targets` dependency). (Example temporarily still has its own `targets/`; not yet converted.)
3. **Task 3 — Full `app.plugin.js`:** copy all widget sources + all `*Attributes.swift` + `NSSupportsLiveActivities` + wrap `withTargetsDir`, run-once guarded.
4. **Task 4 — Convert the example + verify:** `app.json` → plugin-only, delete + gitignore `targets/`, `prebuild --clean`, build, all four presets on the sim; evidence (sim ≠ device).

---

## 9. Risks & parked

- **Highest — eval-time file-write before `withTargetsDir` globs:** mitigated by the Task-1 spike + require-both fallback (§5).
- **`config._internal.projectRoot` availability / API stability** at plugin-eval — verify in the spike; fall back to the standard `getProjectRoot` from `@expo/config` if needed.
- **Monorepo path resolution:** the example resolves `expo-island-kit` via the workspace symlink; the plugin uses `__dirname` (package dir) for sources and `projectRoot` for the destination — consistent for a real consumer's `node_modules` install.
- **Parked (later):** native error messages / prop defaults / unsupported-path signalling (the rest of "DX polish"); publishing (`npm publish`) is a separate later phase.

## 10. Self-review

- Delivers the "zero Swift" promise: consumer writes one plugin line, no `targets/` Swift. ✓
- Single Attributes source preserved (`ios/shared/`), copied to both targets — no drift. ✓
- Riskiest mechanism (eval-time write + wrap) isolated as a spike with a defined fallback. ✓
- Example dogfoods the exact consumer path (delete hand-scaffolded `targets/`). ✓
- No push/entitlement/API scope creep; presets + abstraction untouched. ✓
- DoD separates "plugin generates a buildable working target on sim" from "on-device visual sign-off." ✓
