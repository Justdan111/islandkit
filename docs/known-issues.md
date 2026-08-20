# Known issues

Logged, not fixed. Each entry records what is actually broken, what is *not* broken, and
how big the fix looks — so nobody re-diagnoses it from scratch.

For limitations that are working-as-designed and consumer-facing, see the
[package README's known limitations](../packages/expo-island-kit/README.md#known-limitations).

---

## Deep-link tap-through lands on "route not found" in the example app

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
