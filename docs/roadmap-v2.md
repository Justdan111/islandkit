# v2 roadmap

Captured, not scheduled. **Nothing here is being built now** — v1 ships first. This
file exists so the intent survives, not as a work queue.

Each item is written so a future implementer knows what it means and why it is not
already done.

---

## Interactive controls on the island — likely the headline v2 feature

Pause / play / skip directly from the Dynamic Island, via **App Intents** (iOS 17+).

This is the largest item, and it is not a widget-layout change. Widget extensions
cannot execute a JS consumer's callback: the tap runs inside the extension process, not
the app. Delivering it needs app↔extension intent routing, so that a tap on the island
resolves to an `AppIntent` the extension can run and the app's JS layer can observe and
respond to. Expect the design work to be in that routing layer, not in SwiftUI.

Constraints inherited from v1: iOS 17+ only, so it must degrade cleanly on 16.2–16.x,
which is IslandKit's current floor.

## Richer theming and appearance customization

Per-preset appearance props beyond the single `accentColor` knob v1 exposes — colours,
typography, and layout variants.

Today layouts are fixed and `accentColor` is the only visual control, which is the most
common thing adopters will want to change.

## Native SwiftUI animations baked into the presets

Transition and content-change animations written into the preset views, **on by default**
with per-preset opt-out toggles. The default should look right without configuration;
the toggle exists for consumers who need motion-reduced or static presentation.

## Richer per-preset icon and image customization

More image/icon slots per preset, and possibly **bundled-asset support**.

Related known defect to fix as part of this, not separately: `NowPlayingProps
.artworkAsset` already exists in the public API and is carried all the way into the
widget's content state, but no widget reads it — only `artworkUrl` is drawn. It is
documented under README known limitations. v2 should either implement it or remove it
from the public types; leaving an accepted-but-inert prop in a published API is the
worst of the three options.

## Deferred visual polish

Folded in here rather than tracked separately, since both are preset-view work:

- **Now Playing expanded progress-bar clip** — the bottom progress bar clips in the
  expanded presentation; needs padding on `.expanded(.bottom)`. Logged since Phase 2 and
  carried through the Phase 3 refactor, which preserved the structure that makes it
  fixable there.
- **Now Playing trailing-time inset** — trailing elapsed/remaining time sits too close
  to the edge in the expanded layout.
