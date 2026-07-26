# Phase 3 — Generalize the Pattern — Verification Evidence

Captured on the **iPhone 17 Pro simulator** (Dynamic Island capable), Expo SDK 55, 2026-07-26, against the module's compiled native build (app target + `island-kit-widget` extension, both from `** BUILD SUCCEEDED **`).

## What these screenshots prove

The registry/protocol abstraction produces two **visually distinct, correctly-rendered** presets through the *same* generalized pipeline (TS `createLiveActivityFactory` → preset-agnostic native bridge → `PresetRegistry` → `LiveActivityEngine` → per-preset widget):

| File | Shows |
|---|---|
| `phase3-00-app-supported.png` | Example harness running; `NowPlayingActivity.isSupported()` → **"Supported: yes"** (the new `isLiveActivitySupported()` native call works), and `NowPlayingActivity.start()` returned an activity id. |
| `phase3-01-nowplaying-DI.png` | After NowPlaying `start()`: the Now Playing Live Activity in the Dynamic Island — accent-tinted (`#FF375F` pink) play/pause glyph. |
| `phase3-02-genericprogress-DI.png` | After Generic Progress `start()`: the **new** preset in the Dynamic Island — the `icloud.and.arrow.up` SF Symbol tinted with its own accent (`#0A84FF` blue). Distinct from Now Playing, rendered by the same engine. |
| `phase3-03-ended-DI.png` | After `end()`: the Dynamic Island is empty — the activity was removed. |

**Lifecycle verified on the simulator for both presets:** `start()` → renders in the DI → `end()` → removed. Driven via the AppState-stepper harness technique (foreground the app to advance a step; foreground another app to reveal the DI), since this CLI has no UI-automation tooling.

## Not a visual sign-off on device

Per the Phase-3 DoD: **green on the simulator validates the abstraction and the start/render/end round-trip, but it is NOT a visual sign-off on real Dynamic Island hardware.** The compact-region layout nuances (e.g. exact compactLeading vs compactTrailing placement, the Generic Progress percentage text, the deferred Now Playing expanded-bottom progress-bar clip) should be confirmed on a physical device in a later visual pass. Now Playing itself was already device-verified in Phase 2; Generic Progress uses the identical pipeline but has not been visually signed off on device.

## Abstraction validated

The decisive Phase-3 result is structural, not just visual: **adding Generic Progress required no changes to the shared engine** — `LiveActivityEngine.swift` and `createLiveActivityFactory.ts` had empty diffs, and `PresetRegistry.swift` changed only by appending one `GenericProgressHandler()` line. A new preset = 1 Attributes file (+ symlink) + 1 handler + 1 registry line + 1 Widget + 1 TS line.
