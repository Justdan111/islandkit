# Phase 4 — Delivery + Timer Presets — Verification Evidence

Captured on the **iPhone 17 Pro simulator** (Dynamic Island capable), Expo SDK 55, 2026-07-27, against the compiled native build (app target + `island-kit-widget` extension with all four preset widgets, from `** BUILD SUCCEEDED **`).

## What these screenshots prove

The two new presets render through the *same* generalized pipeline (TS `createLiveActivityFactory` → preset-agnostic native bridge → `PresetRegistry` → `LiveActivityEngine` → per-preset widget), and the existing presets still work after the shared factory change.

| File | Shows |
|---|---|
| `phase4-00-app-supported.png` | Harness running; `NowPlayingActivity.isSupported()` → **"Supported: yes"** (`isLiveActivitySupported`); Delivery `start()` returned an id. |
| `phase4-01-delivery-DI.png` | **Delivery** in the Dynamic Island — the `onTheWay` status glyph (`bicycle`) tinted its accent `#22C55E` (green). |
| `phase4-02-timer-DI.png` | **Timer** in the Dynamic Island — the `timer` glyph tinted `#FF9F0A` (orange). |
| `phase4-03-nowplaying-regression-DI.png` | **Regression:** Now Playing still renders (pink `#FF375F` pause glyph) after the Task-2 factory `serializeProps` change (which touches every preset's `start`/`update`). |
| `phase4-04-ended-DI.png` | After `end()`: the Dynamic Island is empty. |

**Lifecycle verified on the simulator:** each preset `start()` → renders in the DI → `end()` → removed, driven via the AppState-stepper harness technique (foreground advances a step; foregrounding another app reveals the DI), since this CLI has no UI-automation tooling.

## Abstraction bar held (the point of the phase)

Adding two presets touched only: `PropCoercion.optDouble` (Delivery) + `PropCoercion.date` (Timer) — generic coercion primitives — the factory's generic Date→ISO serialization (Task 2), two `PresetRegistry.all` lines, and two `index.ts` re-exports. `LiveActivityEngine.swift`, the `LiveActivityPresetHandler` protocol, `createLiveActivityFactory`'s shape, and `core/types.ts` were **untouched** — verified in each task's review. Jest 11/11; all four `*Attributes.swift` are single-source (canonical + widget symlink).

> **Note (2026-08-04, added during Phase 6 review):** the line above describes the Phase 4 state as captured on 2026-07-27. Phase 6 (the config plugin) removed the widget-symlink mechanism entirely — the plugin now *copies* the canonical `*Attributes.swift`/`*LiveActivity.swift` files into the generated `targets/island-kit-widget/` directory at prebuild time instead of symlinking them. This historical record is left as originally written; it no longer reflects how the widget target sources the shared Swift files.

## Not an on-device visual sign-off

Per the Phase-4 DoD: green on the **simulator** validates the abstraction, wiring, and the start/render/end round-trip, but it is **NOT** a visual sign-off on real Dynamic Island hardware. Explicitly deferred to a later on-device visual pass:
- **Timer:** the live `Text(timerInterval:)` **ticking** countdown, and the **pause-holds-still / resume-continues-correctly** transition (a native-rendering behavior a single sim screenshot can't confirm).
- **Delivery:** the **map snapshot** rendering (the mock props omit `mapSnapshotUrl`, so no map was exercised) and its graceful-failure path.
- Compact-region icon placement for both (same nuance noted for Generic Progress in Phase 3).

Now Playing was device-verified in Phase 2; the shared pipeline is device-proven, and Delivery/Timer ride it identically.
