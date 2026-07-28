# Phase 6 — Config Plugin (Zero-Swift Consumer Setup) — Design Spec

**Status:** approved design (brainstormed 2026-07-27; **revised 2026-07-29** after a gap audit against the repo and the published product doc)
**Goal:** Ship the widget SwiftUI *in* the `expo-island-kit` package and add a config plugin (`app.plugin.js`) that generates the consumer's widget extension target on `expo prebuild`, so a consumer sets up IslandKit with **one plugin line and zero Swift** — delivering IslandKit's core "TypeScript only" promise.

Builds on Phases 1–4 (Phase 5 is blocked on a paid Apple account and is **not** a dependency).
Canonical product spec: `docs/islandkit-full-documentation.md` — §5.2 (install), §7 (the SwiftUI layer is built on `@bacons/apple-targets`), **§11 (the plugin's documented option surface — the contract this phase must honour)**.

---

## 0. What changed in the 2026-07-29 revision

The original draft was mechanically sound but incomplete against the published contract and the repo. Eleven gaps were found and are now folded in:

| # | Gap | Resolution |
|---|---|---|
| 1 | **Doc §5.2/§11 document a 7-option plugin; the draft shipped zero options** and never acknowledged the conflict | §5 — implement the 4 unblocked options; amend the doc for the 3 blocked/incorrect ones |
| 2 | `presets` selection is not a bolt-on — `IslandKitWidgetBundle.swift` references all four widgets, so it must be **generated**, not copied | §4.2 — three files are generated, the rest copied |
| 3 | **`fs.copyFileSync` writes *through* symlinks** — the example's `targets/*Attributes.swift` are symlinks into `ios/shared/`, so a copy would overwrite the canonical single source | §4.3 — wipe the destination dir before writing; unit-tested |
| 4 | Nothing verified the package actually *ships* the plugin (`files` array unchecked) | §6 — `npm pack` content assertion |
| 5 | The real-consumer path was never tested — every check went through the monorepo workspace symlink | §6 — tarball → scratch app outside the monorepo |
| 6 | Double-application of `withTargetsDir` if the consumer also lists `@bacons/apple-targets` (a crash already recorded in this project) | §4.4 — detect and warn; documented |
| 7 | The spike wrote a plain-object `expo-target.config.js`; the real one is a **function export** | Plan Task 1 — spike matches the real shape |
| 8 | No task updated `CLAUDE.md` (status table, non-goals, repo layout, architecture) or the full doc | §7 — a dedicated docs task |
| 9 | No branch named, no progress-ledger section (every prior phase had both) | §8 — branch `phase-6-config-plugin`; ledger section |
| 10 | Zero automated tests for the first substantial JS in the package | §4.3 — `generateTarget` is a pure module with Jest tests, written first |
| 11 | "Builds on Phases 1–5" — Phase 5 is blocked and unstarted | Corrected above |

---

## 1. Scope

**In scope**
- Move the widget-side Swift out of the example app and **into the package** so it ships with `expo-island-kit`.
- A config plugin `app.plugin.js` that, on prebuild, generates `<projectRoot>/targets/island-kit-widget/`, sets `NSSupportsLiveActivities`, and applies `@bacons/apple-targets` — consumer lists **only** `expo-island-kit`.
- **The four unblocked options from doc §11**: `presets`, `bundleIdentifier`, `deploymentTarget`, `defaultAccentColor` (§5).
- `package.json` wiring so the plugin + sources publish, **verified with `npm pack`**.
- **Convert the example app to consume the plugin** (delete its hand-scaffolded `targets/`), dogfooding the exact consumer path. All four presets still work on the simulator.
- **A real-consumer smoke test**: pack a tarball, install it into a scratch Expo app outside the monorepo, prebuild, build.
- Reconcile `docs/islandkit-full-documentation.md` §5.2/§11 and `CLAUDE.md` with what actually ships.

**Out of scope**
- The remaining Phase-6 "DX polish" items — native error messages, prop defaults beyond `defaultAccentColor`, unsupported-path signalling. A separate later pass; explicitly *not* claimed as done.
- `groupIdentifier` / `enablePushNotifications` plugin options — both require App Groups or Push entitlements, forbidden until Phase 5 + a paid account.
- Push / push-token of any kind. No App Groups. No new capabilities.
- The deferred Phase-3/4 visual items (Now Playing expanded clip, Timer device pass, Delivery map, compact placement).
- Any change to the presets, the Phase-3 abstraction, or the public TS API.
- `npm publish` itself (Phase 9).

**Global constraints (inherited):** iOS only; Expo SDK 55 (no bump — Xcode 26.0.1 caps it); no App Groups / Push / `aps-environment` / push-token; `ios.appleTeamId` stays the consumer's responsibility (the plugin never invents a team); TS strict; Swift naming; conventional commits; `build/` git-ignored and regenerated after `src` edits.

---

## 2. How `@bacons/apple-targets@5` works (grounding)

Its config plugin is `withTargetsDir(config, { root = './targets', match = '*' })` (also the default export of `@bacons/apple-targets/app.plugin`). At **plugin-eval time** it `globSync`s `${root}/${match}/expo-target.config.@(json|js)` and turns each match into a real Xcode target.

Two consequences that shape this design:
1. **The target's `expo-target.config.js` + Swift sources must exist on disk before `withTargetsDir` runs.** IslandKit's plugin therefore writes them *synchronously, before* applying it.
2. **`withTargetsDir` globs `targets/*` — all of them, once.** A consumer with their own extra target still gets it built by our single application. This is why listing `@bacons/apple-targets` *as well* is wrong, not merely redundant (§4.4).

The shipped config today is a **function export**, and stays one:
```js
/** @type {(config: { name: string }) => import('@bacons/apple-targets').Config} */
module.exports = (config) => ({ type: 'widget', name: 'island-kit-widget', deploymentTarget: '16.2', frameworks: [...] });
```

---

## 3. Package restructure

- **New:** `packages/expo-island-kit/plugin/widget/` — the shipped widget template: the four `*LiveActivity.swift`, `WidgetSupport.swift`, `Info.plist`. (Moved verbatim from `apps/example/targets/island-kit-widget/`.)
  Note `IslandKitWidgetBundle.swift` and `expo-target.config.js` are **not** in the template — they are generated (§4.2).
- **New:** `packages/expo-island-kit/plugin/generateTarget.js` — the pure file-generation module (no Expo imports, unit-tested).
- **New:** `packages/expo-island-kit/app.plugin.js` — the config plugin proper (Expo-facing; auto-detected by Expo at the package root).
- **Unchanged:** `packages/expo-island-kit/ios/shared/*Attributes.swift` remain the **single source** of the ActivityAttributes types. The podspec glob (`ios/**/*.swift`) compiles them into the app target; the plugin **copies** them into the widget target. No symlinks in a consumer app.
- **Unchanged:** the pod side (`ios/core`, `ios/presets`), all of `src/`, the podspec.
- **`package.json`:** add `@bacons/apple-targets` to `dependencies`; add a `files` array; extend `jest.roots` to cover `plugin`.

`plugin/` sits **outside** `ios/`, so the podspec glob never sees the widget Swift — the widget sources are compiled only into the widget extension target, as they must be.

---

## 4. `app.plugin.js` design

### 4.1 Shape

```js
module.exports = createRunOncePlugin(withIslandKit, pkg.name, pkg.version);
```

`withIslandKit(config, options)`:
1. **Resolve paths** — package dir via `__dirname`; consumer project root via `config._internal.projectRoot`, falling back to `process.cwd()`.
2. **Generate the target** (synchronously, before step 4) into `<projectRoot>/targets/island-kit-widget/`.
3. **`withInfoPlist`** → `NSSupportsLiveActivities = true` on the host app.
4. **`withTargetsDir(config, { root: './targets' })`**.

### 4.2 What is copied vs generated

| File | Origin | Why |
|---|---|---|
| `WidgetSupport.swift` | copied from `plugin/widget/` | preset-agnostic helpers |
| `Info.plist` | copied from `plugin/widget/` | extension boilerplate |
| `<Preset>LiveActivity.swift` | copied — **only for selected presets** | `presets` option |
| `<Preset>Attributes.swift` | copied from `ios/shared/` — **only for selected presets** | single source of truth |
| `expo-target.config.js` | **generated** | carries `deploymentTarget`, optional `bundleIdentifier` |
| `IslandKitWidgetBundle.swift` | **generated** | `@main WidgetBundle` must list exactly the selected widgets |
| `IslandKitDefaults.swift` | **generated** | carries `defaultAccentColor` into Swift |

A preset is one row in a single table in `generateTarget.js` — `{ key, widgetFile, attributesFile, widgetType }`. Adding a fifth preset later stays a one-line change, consistent with the Phase-3 abstraction bar.

### 4.3 Destination hygiene — the symlink hazard

The generator **wipes the destination directory before writing**:

```js
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
```

This is not tidiness, it is correctness, and it fixes two distinct bugs:

- **Symlink write-through.** `apps/example/targets/island-kit-widget/*Attributes.swift` are currently **symlinks** into `packages/expo-island-kit/ios/shared/`. `fs.copyFileSync(src, dest)` where `dest` is a symlink follows the link and writes the *canonical* file. Copying `ios/shared/X.swift` onto a symlink pointing back at `ios/shared/X.swift` would, on any future drift, silently corrupt the single source of truth. Unlinking first makes the operation always a plain file write.
- **Stale files.** Narrowing `presets` from four to two must actually *remove* the two unselected `*LiveActivity.swift` — otherwise they keep compiling and the option does nothing. `prebuild --clean` does not touch `targets/`.

`generateTarget.js` is a pure Node module (`{ packageRoot, projectRoot, options }` in, files out) precisely so this is unit-testable without running a prebuild. Tests are written **before** the implementation.

### 4.4 Double-application of `@bacons/apple-targets`

If a consumer lists both `expo-island-kit` and `@bacons/apple-targets`, `withTargetsDir` is applied twice. This project has already hit the resulting failure (`withIosXcodeProjectBeta2BaseMod: Cannot read properties of undefined (reading 'removeFromProject')` — "target already exists"). `createRunOncePlugin` guards *our* plugin, not theirs.

Mitigation: at plugin-eval, inspect `config.plugins` for a `@bacons/apple-targets` entry and emit a clear `console.warn` naming the fix ("remove `@bacons/apple-targets` from `plugins` — expo-island-kit applies it for you; your own `targets/*` are still picked up"). Documented in the README and full doc §5.2. A warning rather than a throw: a consumer on an unusual setup keeps their escape hatch.

---

## 5. Plugin options — reconciling with doc §11

Doc §11 publishes seven options. Shipping none of them, as the original draft did, makes the published contract false on day one. Resolution:

| Option | Decision | Rationale |
|---|---|---|
| `presets` | **Implement.** `('nowPlaying'\|'delivery'\|'timer'\|'genericProgress')[]`, default all four | Its documented purpose — smaller extension binary — is real, and it drives §4.2 |
| `deploymentTarget` | **Implement.** Default **`'16.2'`** | Matches the shipped target config. Doc says `16.1`; that is **wrong** — the ActivityKit code is `@available(iOS 16.2, *)`. Doc corrected |
| `bundleIdentifier` | **Implement, but omit from the generated config when unset** | Preserves `@bacons/apple-targets`' existing default exactly, so the example's widget bundle id does not change. Changing it would force re-provisioning on the free Personal Team — a known friction point in this project. Doc's stated default (`<app bundle id>.IslandKitExtension`) is corrected to the real one |
| `defaultAccentColor` | **Implement** via a generated `IslandKitDefaults.swift` | Cheap (~15 lines) and it is in the published contract |
| `appleTeamId` | **Do not implement — amend the doc** to `ios.appleTeamId` | `@bacons/apple-targets` signs the target from the app's `ios.appleTeamId`. A duplicate plugin option would be a second source of truth that can silently disagree |
| `groupIdentifier` | **Do not implement — amend the doc** | App Groups are forbidden (free Apple ID). Mark as Phase 5 / not yet available |
| `enablePushNotifications` | **Do not implement — amend the doc** | `aps-environment` is forbidden. Mark as Phase 5 / not yet available |

`defaultAccentColor` requires the one permitted widget-layer change: `presetAccentColor(_:)` in `WidgetSupport.swift` gains a middle fallback —

```swift
func presetAccentColor(_ hex: String?) -> Color {
  Color(hex: hex) ?? Color(hex: islandKitDefaultAccentHex) ?? .accentColor
}
```

— where `islandKitDefaultAccentHex: String?` lives in the generated `IslandKitDefaults.swift` (`nil` when the option is unset, so behaviour is byte-identical to today by default). This is the **widget layer**, not the Phase-3 abstraction: `LiveActivityEngine`, the handler protocol, `PropCoercion`, `core/types.ts` and the factory contract stay untouched.

Options are validated at plugin-eval: an unknown preset key throws with the valid list. Failing loudly at config time beats a mystifying Swift compile error.

---

## 6. Verification strategy

Three layers, because each proves something the others cannot:

1. **Unit (Jest, in-package).** `generateTarget` against a temp dir: correct file set for the default options; `presets: ['timer']` emits exactly one `*LiveActivity.swift` + one `*Attributes.swift` and a bundle listing only `TimerLiveActivity()`; **a pre-existing symlink at the destination is replaced, not written through** (the §4.3 regression test); re-running is idempotent; a stale file from a previous wider selection is removed; an unknown preset key throws.
2. **Dogfood (the example app).** Delete the hand-scaffolded `targets/`, switch to `plugins: ['expo-island-kit']`, `prebuild --clean`, build app + widget, run all four presets on the iPhone 17 Pro simulator. Proves the plugin regenerates what was previously hand-built.
3. **Consumer smoke test (new).** `npm pack` the package, assert the tarball contains `app.plugin.js`, `plugin/widget/*`, `plugin/generateTarget.js`, `ios/**` and **no** `plugin/__tests__`; then install that tarball into a scratch Expo app **outside the monorepo**, `prebuild -p ios`, and build. This is the only layer that exercises a real `node_modules` resolution instead of the workspace symlink — and the phase's entire deliverable is consumer setup.

Layer 3 is the one the original draft was missing, and it is the one that matches the DoD's actual claim.

---

## 7. Documentation reconciliation

Shipping this without doc updates leaves four documents actively wrong:

- **`docs/islandkit-full-documentation.md`** — §5.2 install snippet (options that do not exist), §11 configuration table (per §5 above: correct defaults for `deploymentTarget`/`bundleIdentifier`, move `appleTeamId` to `ios.appleTeamId`, mark `groupIdentifier`/`enablePushNotifications` as not yet available), §5.3 (drop the "App Group wired up automatically" claim), and the §18 example-app walkthrough.
- **`CLAUDE.md`** — the phase status table (Phase 6 row); the **Non-goals** bullet that currently *forbids* exactly this work ("Config plugin automation that generates the widget target automatically (Phase 6 — for now, the target is scaffolded manually)"); the repository-layout block (widget SwiftUI moves into the package); the architecture flow diagram (widget extension is now generated).
- **`packages/expo-island-kit/README.md`** — the install + setup section, including the "do not also list `@bacons/apple-targets`" note.
- **`.superpowers/sdd/progress.md`** — a Phase 6 ledger section, matching every prior phase.

---

## 8. Definition of done

- [ ] Widget SwiftUI ships in the package (`plugin/widget/`); `ios/shared/*Attributes.swift` remain the single Attributes source (pod glob + plugin copy).
- [ ] `plugin/generateTarget.js` is a pure module with Jest coverage written first, **including the symlink-replacement regression test**; full suite green.
- [ ] `app.plugin.js` generates the target, sets `NSSupportsLiveActivities`, wraps `withTargetsDir`, is `createRunOncePlugin`-guarded, warns on double-listed `@bacons/apple-targets`, and validates options.
- [ ] The four unblocked options work: `presets` (narrowing actually removes widgets), `deploymentTarget`, `bundleIdentifier`, `defaultAccentColor`.
- [ ] Example converted: `plugins: ['expo-island-kit']` only, no manual `NSSupportsLiveActivities`; hand-scaffolded `targets/` deleted from git and git-ignored; **zero widget Swift in the example's tracked source**.
- [ ] `prebuild --clean` regenerates the widget target; app + `island-kit-widget` build succeeds.
- [ ] All four presets start/render/end on the iPhone 17 Pro simulator with the plugin-generated widget.
- [ ] `npm pack` tarball contains the plugin + sources and excludes tests.
- [ ] The tarball installs into a **scratch Expo app outside the monorepo**, prebuilds, and builds.
- [ ] Full doc §5.2/§11/§5.3/§18, `CLAUDE.md` (status, non-goals, layout, architecture) and the package README updated to match what ships.
- [ ] Progress ledger + `islandkit-build-state` memory updated.
- [ ] No App Group / Push / `aps-environment` / new capability. Public TS API and the Phase-3 abstraction unchanged (`LiveActivityEngine`, handler protocol, `PropCoercion`, `core/types.ts`, factory contract — zero diff).

**Caveat:** the simulator validates that the plugin generates a buildable, working target. On-device visual sign-off remains the separate later pass, unchanged from prior phases. Since the widget target is now *generated*, that later device pass must run **after** a `prebuild --clean` from the plugin, not against a hand-scaffolded target.

---

## 9. Plan shape (for writing-plans)

Branch **`phase-6-config-plugin`**, cut from the current `phase-4-delivery-timer` HEAD. Subagent-driven.

1. **Task 1 — De-risk spike (gate).** A throwaway plugin writing a **function-form** `expo-target.config.js` + a minimal widget, proving eval-time write → `withTargetsDir` glob → `BUILD SUCCEEDED`. Reverted. Fallback if it fails: "require both plugins" (§10).
2. **Task 2 — Relocate widget sources into the package** + `package.json` (`files`, dependency, jest roots).
3. **Task 3 — `plugin/generateTarget.js`, tests first.** Pure module; the whole options/copy/generate/wipe design; no Expo imports.
4. **Task 4 — `app.plugin.js`** (options validation, `withInfoPlist`, `withTargetsDir`, run-once, double-listing warning) + the `WidgetSupport.swift` default-accent fallback.
5. **Task 5 — Convert the example + simulator verification** of all four presets.
6. **Task 6 — Packaging + consumer smoke test** (`npm pack` assertion, scratch app outside the monorepo).
7. **Task 7 — Docs, CLAUDE.md, README, ledger, memory, evidence, DoD.**

Task 1 gates Tasks 3–6. Task 3 gates Task 4.

---

## 10. Risks & parked

| Risk | Severity | Mitigation |
|---|---|---|
| Eval-time file-write must precede `withTargetsDir`'s glob | **Highest** | Task-1 spike; both plugin versions call the generator before applying it |
| `config._internal.projectRoot` unavailable / unstable at eval | Medium | Spike verifies; documented fallback to `process.cwd()`, then `@expo/config`'s `getProjectRoot` |
| Wrapping `withTargetsDir` proves infeasible | Medium | **Fallback:** "require both plugins" — the consumer lists `['@bacons/apple-targets', 'expo-island-kit']` and our plugin only writes sources. Still zero Swift, one extra line. Adopt **only after flagging to the human**; record which mechanism shipped |
| Consumer edits the generated widget and loses it on the next prebuild | Medium | **Stated decision:** `targets/island-kit-widget/` is *generated output* — overwritten every prebuild, git-ignored. Documented in the README so it is a contract, not a surprise. A supported customization story (eject / partial override) is parked for a later phase |
| `presets` narrowing leaves stale widgets compiled in | Medium | Destination wipe (§4.3) + a unit test asserting removal |
| Symlink write-through corrupting `ios/shared/` | Medium | Destination wipe + a dedicated regression test |
| Monorepo path resolution differs from a real install | Medium | Task 6's tarball → scratch-app test |
| Widget bundle id changing forces re-provisioning on the free Personal Team | Low | `bundleIdentifier` omitted from the generated config unless explicitly set (§5) |

**Parked (log, do not build):** the rest of "DX polish" — native error messages, prop defaults beyond `defaultAccentColor`, unsupported-path signalling; a supported widget-customization/eject story; `npm publish` automation (Phase 9); the Phase-3/4 visual items.

---

## 11. Self-review

- Delivers the "zero Swift" promise: one plugin line, no `targets/` Swift in tracked source. ✓
- **Honours the published §11 contract** — four options implemented, three reconciled in the doc rather than silently ignored. ✓
- Single Attributes source preserved (`ios/shared/`), copied into the widget target; podspec glob unaffected because `plugin/` sits outside `ios/`. ✓
- The symlink write-through hazard is identified, fixed by design, and pinned by a regression test rather than left to reviewer vigilance. ✓
- Riskiest mechanism (eval-time write + wrap) isolated as a gating spike with a defined, human-flagged fallback. ✓
- Verification is three-layered, and the layer that actually proves the *consumer* claim (tarball → scratch app) exists. ✓
- Preset selection stays a one-row-per-preset table — the Phase-3 abstraction bar holds into the plugin layer. ✓
- The one widget-layer change (`presetAccentColor` fallback) is explicitly scoped and defaults to byte-identical behaviour. ✓
- No push/entitlement/API scope creep; the Phase-3 abstraction files are a stated zero-diff. ✓
- Doc/CLAUDE.md drift closed in the same phase that creates it, including the non-goals bullet that currently forbids this work. ✓
- DoD separates "plugin generates a buildable working target on sim" from "on-device visual sign-off", and notes the device pass must now follow a plugin prebuild. ✓
