# Phase 6 — Config Plugin — Verification Evidence

Captured on the **iPhone 17 Pro simulator** (Dynamic Island capable), Expo SDK 55, 2026-07-29, against a build produced entirely from the plugin-generated widget target (no hand-scaffolded `targets/` present).

## What Task 5 proves: the plugin-generated widget builds and renders

The example app was converted to consume `expo-island-kit` purely through the config plugin: `apps/example/targets/island-kit-widget/` was deleted outright, and `npx expo prebuild -p ios --clean` regenerated all 13 target files from `packages/expo-island-kit/plugin/` with zero symlinks in the output, `ios/shared/*Attributes.swift` left unmutated, `NSSupportsLiveActivities` set via `withInfoPlist`, and `** BUILD SUCCEEDED **` with `island-kit-widget.appex` linked (arm64-apple-ios16.2-simulator).

| File | Shows |
|---|---|
| `phase6-01-app-supported.png` | Harness running against the plugin-generated build; "Supported: yes", a real activity id. |
| `phase6-02-di-nowplaying.png` | **Now Playing** compact-trailing glyph, pink `#FF375F` pause icon. |
| `phase6-03-di-genericprogress.png` | **Generic Progress** compact-trailing glyph, blue `#0A84FF` icloud icon. |
| `phase6-04-di-delivery.png` | **Delivery** compact-trailing glyph, green `#22C55E` bicycle icon. |
| `phase6-05-di-timer.png` | **Timer** compact-trailing glyph, orange `#FF9F0A` dial icon. |

**What is proven by this evidence:** the plugin-generated widget target builds; each preset's Dynamic Island **compact-trailing** glyph renders with the correct SF Symbol and accent colour; the Island swaps between presets consistent with `end()` firing (the stepper harness ends each activity before starting the next, and each replaced the previous in the Island).

**What is NOT proven by this evidence** — do not read the above as "all four presets start/render/end" on the simulator; that overreaches. Explicitly open, deferred to the on-device visual pass:
- **Expanded (long-press) layout for any preset** — this is where most layout code lives: Delivery's map snapshot, progress bars, and the leading/trailing/bottom regions for all four presets.
- **The Lock Screen banner for any preset.**
- **Timer's tick and paused-vs-running branches** (`Countdown`'s `isPaused` state vs. the live `Text(timerInterval:)`).
- **`.update()` on a running activity.**

These four gaps are **inherited from Phases 2–4, not newly introduced by Phase 6** — the widget Swift is byte-identical to what shipped before; only its delivery mechanism (plugin-generated vs. hand-scaffolded) changed. They must not be silently marked covered.

## Which mechanism shipped

The `withTargetsDir` wrap — `app.plugin.js` writes the generated target via `generateTarget()` and then wraps `@bacons/apple-targets`'s `withTargetsDir`, relying on the proven eval-time write-before-glob ordering. The spec's fallback ("require both `expo-island-kit` and `@bacons/apple-targets` as separate plugins") was proven **dead** during the Task 1 spike: `@bacons/apple-targets@5.0.0` cannot resolve two targets of the same `type` (its `targets.find(...) ?? targets[0]` fallback grabs an unrelated same-type target and crashes `removeFromProject`), which the require-both approach would trigger. It was never used.

## Known limitation carried into the docs (§5.2, README)

`@bacons/apple-targets@5.0.0` — the newest published version, no upgrade escape — cannot handle two targets of the same `type`. A consumer's own `share` or `notification-content` extension is unaffected (targets are filtered by type before the crash path), but a second **widget** extension collides with IslandKit's generated one. Workaround documented: put a consumer's own Widget inside a single extension rather than maintaining a second widget target. The withdrawn claim "your own `targets/*` are still picked up" (true only for non-widget target types) was NOT written into the shipped docs as an unqualified statement.

## Task 6 — real external consumer verdict

Run against a scratch Expo app **outside the monorepo** (`/tmp/ik-consumer/consumer`, created with `npm`, not `pnpm`, to avoid the hoisted workspace layout):

- `npm pack` tarball (61 entries) carries `app.plugin.js`, `plugin/generateTarget.js`, `plugin/widget/*` (6 files), `ios/**` including the podspec and the shared `*Attributes.swift`, and `expo-module.config.json`. `plugin/__tests__` is correctly **excluded** (the `"!plugin/__tests__"` negation in `package.json`'s `files`), confirmed both in the tarball listing and in the installed `node_modules` tree.
- The tarball installed cleanly via npm; `require.resolve('expo-island-kit/app.plugin.js')` resolved from real `node_modules`, not a workspace symlink — the one path the monorepo example cannot exercise.
- `npx expo prebuild -p ios --clean` generated the target. `presets: ['timer', 'nowPlaying']` narrowing was **observed live**: exactly 9 files (NowPlaying + Timer widget/Attributes only), Delivery and GenericProgress **absent**, and `IslandKitWidgetBundle` listing only the two selected widgets.
- `defaultAccentColor: '#FA2D48'` reached the generated `IslandKitDefaults.swift` as `let islandKitDefaultAccentHex: String? = "#FA2D48"`.
- `xcodebuild` → `** BUILD SUCCEEDED **`, `island-kit-widget.appex` linked.
- The double-listing warning **fired**, with the corrected text (no "your own `targets/*` are still picked up" claim), verified via `expo config --type prebuild`.
- Worth recording: `create-expo-app` scaffolds **SDK 57** by default and had to be pinned to **SDK 55** (Xcode 26.0.1 cannot build SDK 56+). The scratch app set **no `ios.appleTeamId`** and still built for the simulator — the plugin does not require a team.

The scratch app and tarball were cleaned up after the run; Task 6 produced a verdict, not a commit.

## Sim ≠ on-device visual sign-off

Green on the simulator validates the plugin's generation pipeline, the build, and the compact-trailing glyph/accent-colour rendering for all four presets — it is **not** a visual sign-off on real Dynamic Island hardware, and it does not cover the four gaps listed above. The deferred device visual pass (Now Playing's expanded bottom progress-bar clip, Timer's ticking/pause-resume, Delivery's map snapshot, compact-region icon placement) must now be run **against a build produced by `expo prebuild --clean` from the plugin**, not against a hand-scaffolded target — the delivery mechanism changed even though the widget Swift did not.
