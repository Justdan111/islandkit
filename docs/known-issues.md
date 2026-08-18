# Known issues

Logged, not fixed. Each entry records what is actually broken, what is *not* broken, and
how big the fix looks — so nobody re-diagnoses it from scratch.

For limitations that are working-as-designed and consumer-facing, see the
[package README's known limitations](../packages/expo-island-kit/README.md#known-limitations).

---

## `NowPlayingProps.artworkAsset` is accepted but inert — needs resolving before v1 is widely adopted

**Scope: the package's public API.** This is the one genuine API wart currently shipped.

**What happens.** `artworkAsset` is declared on `NowPlayingProps`, accepted by `start()`,
serialized across the bridge, coerced by `NowPlayingHandler`, and stored on
`NowPlayingAttributes.ContentState` — a complete path from public type to widget state.
No widget then reads it. `NowPlayingLiveActivity` draws `artworkUrl` only, falling back
to a placeholder when it is absent.

**Why it matters.** The prop is in the published types, so it surfaces in autocomplete
and reads as supported. A consumer who sets it gets no artwork, no warning and no error
— the failure is indistinguishable from having passed nothing. It is currently recorded
under the README's known limitations so adopters are not misled, but documentation is a
mitigation, not a resolution.

**Resolution — pick one, do not leave it as-is:**

1. **Wire it up.** Render a bundled asset by name in the widget. This is the larger
   option and is the natural companion to the bundled-image support already on the
   [v2 roadmap](./roadmap-v2.md) — doing both together is cheaper than doing either
   twice, and it is the outcome consumers expect from the prop's name.
2. **Remove it** from `NowPlayingProps`, the handler and the Attributes struct. Cheap,
   honest, and a breaking change — so it is far cheaper before v1 is widely adopted than
   after.

Shipping an accepted-but-inert prop in a published API is worse than either.

**Scope: the example app only. Not a package defect.** Should be fixed before the repo
goes public, since the example is the first thing a visitor runs.

**What works.** Tapping the Dynamic Island or the Lock Screen banner *does* open the
example app. The URL scheme is registered and iOS routing delivers the deep link — both
verified. The scheme was missing entirely until Phase 7 added `"scheme":
"islandkitexample"` to `apps/example/app.json`, so this path could not have worked
before then; this is the first time it has been exercised.

**What's broken.** The deep-link targets the presets pass to `start()` — for example
`islandkitexample://player` — have no matching route in the example app's Expo Router
setup, so the app opens and immediately errors with a route-not-found.

**The fix.** Define or rename routes under `apps/example/app/` so each preset's
`deepLinkUrl` resolves to that preset's screen. Nothing in `packages/expo-island-kit`
needs to change: the scheme, the plugin, and iOS routing are all already correct. It is
a small, example-app-only change — reconciling the URLs the demo screens pass with the
routes that actually exist.

**Why it matters more than its size suggests.** Deep-linking from the island is a
headline reason to adopt a Live Activities library, and the example is what people copy.
An example that errors on tap reads as the library being broken.
