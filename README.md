# IslandKit

Drop-in iOS **Live Activities** and **Dynamic Island** presets for Expo — Now Playing,
Delivery, Timer and Generic Progress — with a TypeScript-only API. Consumers never write
Swift; all SwiftUI layout and ActivityKit plumbing ships inside the package.

> **Status:** pre-release, in active development. Not yet published to npm.

## Repository layout

This is a pnpm workspace.

| Path | What it is |
|---|---|
| `packages/expo-island-kit/` | The npm package — this is what ships |
| `apps/example/` | Expo app used for local testing and dogfooding, not published |
| `docs/islandkit-full-documentation.md` | Full product spec and API reference |
| `docs/superpowers/` | Per-phase design specs, implementation plans, and evidence |
| `CLAUDE.md` | Build guide and current phase status |

## Platform scope

**iOS only.** There is no Android implementation and none is planned. Functions that must
exist cross-platform for the JS API to typecheck no-op safely off iOS.

## Development

```bash
pnpm install          # also activates the commit-msg hook via core.hooksPath
pnpm lint
pnpm typecheck
pnpm test
```

Building the example app requires macOS with Xcode. See `docs/phase-1-device-signing.md`
for the one-time device-signing setup.

### Toolchain constraints

- **Expo SDK 55** — pinned. SDK 56+ requires Xcode 26.4+ (`weak let`, Swift 6.3); the
  development machine runs Xcode 26.0.1.
- **Node 22** — see `.nvmrc`.
- **pnpm 10.17** — pinned via `packageManager`.

## Branching and CI

`main` is the trunk. Work happens on a branch cut from `main` and merges back through a
pull request; the CI gate (lint, typecheck, tests, commit hygiene) must pass before a
merge is allowed. Direct pushes to `main` are blocked.

Deferred CI work is tracked in `docs/ci-deferred.md`.

## License

MIT — see [LICENSE](packages/expo-island-kit/LICENSE).
