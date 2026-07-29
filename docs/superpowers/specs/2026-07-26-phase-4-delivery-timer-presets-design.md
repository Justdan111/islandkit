# Phase 4 — Delivery + Timer Presets — Design Spec

**Status:** approved design (brainstormed 2026-07-26)
**Goal:** Add the **Delivery** and **Timer** presets end to end using the Phase-3 registry/protocol abstraction, extending the shared abstraction exactly once (generic Date-prop serialization) for Timer's `endDate`.

Canonical product spec: `docs/islandkit-full-documentation.md` §8.2 (Delivery), §8.3 (Timer), §10 (types).
Builds on: `docs/superpowers/specs/2026-07-26-phase-3-generalize-pattern-design.md` (the abstraction).

---

## 1. Scope

**In scope**
- **Delivery** preset end to end (TS module, Swift handler + Attributes, widget, registry line, example screen). Pure pattern application — no shared-code change. Proves a 3rd preset is cheap.
- **Timer** preset end to end, plus the **one** shared-abstraction extension it needs: generic Date-prop serialization in `createLiveActivityFactory` (+ `PropCoercion.date` in Swift).
- Both presets verified start/update/end on the iPhone 17 Pro simulator, with a **regression check that NowPlaying + Generic Progress still work** (the factory change touches every preset).
- Correct the canonical doc's Timer example so it doesn't reference the deferred `currentEndDate` (avoid doc/code drift).

**Out of scope**
- `currentEndDate` (and any `current*` instance getters) — deferred; logged as a future convenience. Do not grow the `LiveActivityInstance<T>` contract.
- Delivery/Timer beyond the canonical prop shapes; push / push-token (Phase 5); config-plugin automation (Phase 6); the deferred Phase-3 visual items (NowPlaying expanded-bottom clip, GP compact placement).
- No breaking change to `NowPlaying`/`GenericProgress` public TS shapes.

**Global constraints (inherited, unchanged):** iOS only; Expo SDK 55 (no bump); no App Groups / Push / `aps-environment` / push-token code; `ios.appleTeamId: A66QV2FW3V` stays; TS strict, no `any` in public API; Swift naming + `struct` ActivityAttributes (`Codable, Hashable`); ActivityKit `@available(iOS 16.2, *)`, graceful no-op/"" when unsupported; commit style conventional; `build/` regenerated after src edits.

---

## 2. Delivery preset

Canonical props (§8.2 / §10, verbatim):
```ts
export interface DeliveryProps {
  status: 'confirmed' | 'preparing' | 'onTheWay' | 'delivered';
  etaMinutes?: number;
  courierName?: string;
  orderNumber: string;      // immutable — set once as an attribute
  mapSnapshotUrl?: string;
  accentColor?: string;
}
export const DeliveryActivity: LiveActivityFactory<DeliveryProps>;
```

- **Attributes (immutable):** `orderNumber: String` + `deepLinkUrl: String?`. The `DeliveryHandler` reads `orderNumber` from the props dict at `start` and places it on the Attributes, **not** ContentState. On `update`, `orderNumber` is ignored (attributes can't change) — matches the doc ("set once as an attribute").
- **ContentState:** `status: String`, `etaMinutes: Double?`, `courierName: String?`, `mapSnapshotUrl: String?`, `accentColorHex: String?`. `status` decodes as a plain string via `PropCoercion.string`; the TS union type enforces valid values at the API boundary.
- **Widget** (`DeliveryLiveActivity`): a widget-internal `status → (SF Symbol, label)` map — e.g. `confirmed → ("checkmark.circle", "Confirmed")`, `preparing → ("timer", "Preparing")`, `onTheWay → ("shippingbox.fill", "On the way")`, `delivered → ("house.fill", "Delivered")` (final symbols chosen for HIG fit during implementation). Regions per §8.2: compact = status icon(leading) + ETA(trailing); minimal = icon; expanded = icon+label(leading), ETA(trailing), courier+orderNumber(bottom) + optional map; Lock Screen = full card. Accent from `accentColorHex` with `.accentColor` fallback (shared `presetAccentColor`).
- **Map snapshot — render DEFENSIVELY (per review note):** widget extensions have tight memory limits. `mapSnapshotUrl` renders via `AsyncImage` with a **bounded frame** (fixed max height, `.clipped()`), a graceful placeholder on load failure/nil (an `error`/`empty` phase → a neutral map-placeholder view, never a crash or unbounded image), and no full-resolution decode. Absent `mapSnapshotUrl` simply omits the map region.
- No shared-code change: Delivery slots in via Attributes+symlink, `DeliveryHandler` (+ decoder), one `PresetRegistry.all` line, `DeliveryLiveActivity` widget, `presets/Delivery.ts`, and an example-screen section.

---

## 3. Timer preset (+ the one abstraction extension)

Canonical props (§8.3 / §10, verbatim):
```ts
export interface TimerProps {
  label: string;
  endDate: Date;
  isPaused?: boolean;
  accentColor?: string;
}
export const TimerActivity: LiveActivityFactory<TimerProps>;
```

### 3.1 Shared abstraction extension — generic Date-prop serialization
The generic factory can't pass a JS `Date` across the Expo bridge cleanly. `createLiveActivityFactory` (shared) gains a small step: before every native `start`/`update` call, it shallow-walks the props object and converts any value that is a `Date` to `value.toISOString()`. This is a **generalization**, not preset-specific leakage — any preset with a Date prop benefits, and it mirrors the existing dismissal-policy Date→ISO handling. Covered by a new Jest test. Swift gains `PropCoercion.date(_:_:_:) -> Date?` that parses an ISO-8601 string (reusing `ISO8601DateFormatter`, same options as `DismissalPolicyParser`) with a `base` fallback for partial updates.

### 3.2 Timer preset proper (via seams)
- **Attributes:** `deepLinkUrl: String?`.
- **ContentState:** `label: String`, `endDate: Date`, `isPaused: Bool`, `accentColorHex: String?`. (`Date` is `Codable`+`Hashable`, so ContentState conformance is fine.) `TimerHandler` decodes `endDate` via `PropCoercion.date` (from the ISO string the factory produced), partial-update fallback to `base?.endDate`.
- **Widget** (`TimerLiveActivity`):
  - **Running (`!isPaused`):** native `Text(timerInterval: Date.now...endDate, countsDown: true)` — self-ticks with zero JS and near-zero battery, keeps accurate while backgrounded (§8.3). If `endDate` is already past, the interval shows `0:00`.
  - **Paused (`isPaused`):** a **static** formatted remaining time (`endDate − now` at render, `mm:ss`/`h:mm:ss`) instead of the live interval — the displayed time holds still.
  - Regions per §8.3: compact = label glyph(leading) + countdown(trailing); minimal = compact countdown/glyph; expanded = label + large countdown (+ a pause/resume affordance, display-only for Phase 4); Lock Screen = label + large countdown. Accent via `presetAccentColor`.
- **On-device check (per review note):** "pause holds still / resume continues correctly" must be an explicit item in the on-device visual pass — the simulator confirms the wiring, but the paused-freeze ↔ live-resume transition of `Text(timerInterval:)` is exactly the kind of native-rendering behavior to eyeball on hardware. Recorded in the DoD as device-deferred, not a Phase-4 sim blocker.

---

## 4. The abstraction bar (the heart of the phase)

The **only** shared-code changes permitted:
1. `packages/expo-island-kit/src/core/createLiveActivityFactory.ts` — the generic Date→ISO serialization step (+ its Jest test).
2. `packages/expo-island-kit/ios/core/PropCoercion.swift` — add `date(...)`.
3. `packages/expo-island-kit/ios/core/PresetRegistry.swift` — append **two** handler lines (`DeliveryHandler()`, `TimerHandler()`).
4. `packages/expo-island-kit/src/index.ts` — re-export the two new factories + prop types.

`LiveActivityEngine.swift`, the `LiveActivityPresetHandler` protocol definition, `core/types.ts`, and the `LiveActivityInstance`/`LiveActivityFactory` contracts must be **untouched**. Any need to change them to make Delivery or Timer work is a signal the abstraction is incomplete — flag it in review, don't silently patch. (Delivery must need zero shared change at all; Timer needs only #1–#2, which are generic capabilities.)

---

## 5. Doc correction (avoid drift)

`docs/islandkit-full-documentation.md` §8.3's example (currently `activity.update({ label: 'Pasta', endDate: activity.currentEndDate, isPaused: true })`) references `currentEndDate`, which Phase 4 deliberately does **not** implement. Correct the example so it passes a consumer-tracked `endDate` (matching the doc's own surrounding note that consumers track remaining time in their own app state), and add a one-line "`currentEndDate` is a planned future convenience" aside. This keeps the published contract matching the shipped API.

---

## 6. Definition of done

- [ ] `DeliveryActivity` + `TimerActivity` added end to end; canonical prop shapes exact.
- [ ] Delivery required **no** shared-code change; Timer required only the generic Date-serialization (factory + `PropCoercion.date`) + its two registry lines (abstraction bar held — verified in review).
- [ ] Generic Date-prop serialization covered by a Jest test; full Jest suite green.
- [ ] **Regression:** NowPlaying + Generic Progress still start/update/end (the factory change is exercised by their tests + a sim check).
- [ ] App + `island-kit-widget` build succeeds; all four preset widgets registered in the bundle.
- [ ] Delivery + Timer start/update/end verified on the iPhone 17 Pro simulator; map snapshot degrades gracefully; Timer countdown ticks.
- [ ] Doc §8.3 `currentEndDate` example corrected.
- [ ] No App Group / Push / push-token; `NowPlaying`/`GenericProgress` public shapes unchanged.

**Caveat:** simulator validates wiring + the abstraction; it is **not** an on-device visual sign-off. Timer's pause-holds/resume-continues and the map-snapshot rendering are explicitly flagged for a later on-device visual pass (Now Playing is already device-verified; the shared pipeline is device-proven).

---

## 7. Plan shape (for writing-plans) — Delivery first

1. **Task 1 — Delivery end to end** (no shared change; proves the pattern for a 3rd preset).
2. **Task 2 — Generic Date-prop serialization** (TS factory step + Jest; `PropCoercion.date` in Swift) — the isolated shared extension, its own review gate.
3. **Task 3 — Timer end to end** (consumes Task 2; adds the countdown widget + `isPaused` freeze) + **the doc §8.3 correction**.
4. **Task 4 — Simulator verification + DoD** (both new presets + NowPlaying/GenericProgress regression; evidence noting sim ≠ device + the device-deferred pause/resume + map checks).

---

## 8. Parked / future (log, not build)
- `currentEndDate` (and `current*` getters) — needs generic last-props tracking on the instance; revisit if consumers ask.
- `progressLabel?` on GenericProgressProps (from Phase 3).
- Phase-3 visual polish: NowPlaying expanded-bottom progress-bar clip; Generic Progress compact icon placement.
- Build-script hardening: a `clean` step before `build` to drop orphaned compiled files after a restructure.

## 9. Self-review
- Delivery + Timer props verbatim from §10; `orderNumber` correctly modeled as an immutable Attribute. ✓
- Exactly one shared generalization (Date serialization), justified as cross-preset; abstraction bar explicit. ✓
- Timer live countdown via native `Text(timerInterval:)`; paused = static; on-device pause/resume flagged. ✓
- Map snapshot defensive rendering (memory + failure) per review note. ✓
- Doc drift addressed (§8.3 currentEndDate correction). ✓
- Regression of existing presets in the DoD (factory change touches all). ✓
- No push/entitlement scope creep; no breaking public-API change. ✓
