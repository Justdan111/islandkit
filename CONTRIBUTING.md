# Contributing to IslandKit

Thanks for helping out. This document covers everything you need to get a change from a
clone to a green pull request.

> **iOS only.** IslandKit is an iOS Live Activities / Dynamic Island package. Please do
> not add Android code, Android config, or Android-conditional branches. Functions that
> must exist cross-platform for the JS API to typecheck should no-op safely off iOS.

## Repository layout

This is a [pnpm](https://pnpm.io) workspace with two packages:

| Path | What it is |
|---|---|
| `packages/expo-island-kit/` | The npm package — this is what ships. TypeScript API (`src/`), Swift native module (`ios/`), config plugin (`app.plugin.js` + `plugin/`) |
| `apps/example/` | Expo Router showcase app used for local testing and on-device verification. Private, never published |
| `docs/` | Product spec, per-phase design specs and implementation plans |
| `CLAUDE.md` | Build guide and current phase status |

The consumer-facing documentation lives in
[`packages/expo-island-kit/README.md`](packages/expo-island-kit/README.md) — update it
whenever you change the public API.

## Setup

```bash
git clone https://github.com/Justdan111/islandkit.git
cd islandkit
pnpm install
```

- **Node 22** — the version is pinned in `.nvmrc`; `nvm use` picks it up.
- **pnpm 10.17** — pinned via `packageManager` in the root `package.json`. Corepack (or
  a recent pnpm) will honour it automatically; don't install with npm or yarn.
- **Xcode 26.4+** is required for anything native (Expo SDK 57 needs Swift 6.3). You need
  macOS to build the example app; the TypeScript checks run anywhere.

`pnpm install` also runs the root `prepare` script, which sets `core.hooksPath` to
`.githooks`. That activates the commit-msg hook — see [Commit messages](#commit-messages).

## Running the checks

From the repo root (each script fans out across the workspace with `pnpm -r`):

```bash
pnpm lint        # eslint, runs at --max-warnings 0 — a warning is a failure
pnpm typecheck   # tsc --noEmit
pnpm test        # jest
```

Run all three before pushing. They are exactly what CI runs.

## Gotchas that will waste your time

### 1. Re-prebuild after touching native or plugin code

The example app's `targets/island-kit-widget/` is **generated** by the config plugin at
prebuild time and is git-ignored. After changing anything under
`packages/expo-island-kit/plugin/` or `packages/expo-island-kit/ios/`, you must
regenerate it or you are testing stale native code:

```bash
cd apps/example
npx expo prebuild -p ios --clean
```

`--clean` is not optional. A plain `npx expo prebuild -p ios` over an existing widget
target fails with `withIosXcodeProjectBeta2BaseMod: Cannot read properties of undefined`.

Then build and grep for the literal success string — do not trust the exit code, since
piping `xcodebuild` through `tail` masks it:

```bash
npx expo run:ios          # or: xcodebuild ... | grep '\*\* BUILD SUCCEEDED \*\*'
```

### 2. The `build/` staleness trap

`tsc` compiles `src/` into `packages/expo-island-kit/build/` but never deletes outputs
whose source file has gone away. After renaming, moving or deleting anything in `src/`,
orphaned `.js`/`.d.ts` files stay behind and can be imported by the example app, giving
you a build that "works" against code that no longer exists. Wipe it:

```bash
rm -rf packages/expo-island-kit/build
pnpm --filter expo-island-kit build
```

### 3. Never hand-edit the generated widget target

`apps/example/targets/island-kit-widget/` is overwritten on every prebuild by design. Make
the change in `packages/expo-island-kit/plugin/widget/` instead, then re-prebuild.

## Commit messages

We use [conventional commits](https://www.conventionalcommits.org/): `feat:`, `fix:`,
`docs:`, `chore:`, `ci:`, `refactor:`, `test:`.

**AI co-author trailers are rejected.** Any commit whose body matches
`^Co-Authored-By:.*(claude|anthropic)` fails the CI `commit-hygiene` job. Two layers guard
this:

1. `.githooks/commit-msg` strips such trailers locally before the commit is written. It is
   activated by `pnpm install` (which sets `core.hooksPath`), so if you committed with a
   fresh clone that hadn't been installed — or with `--no-verify` — the hook did not run.
2. The CI job is the backstop and scans only the commits the PR adds.

If CI flags a commit, rewrite the message (`git commit --amend` or an interactive rebase)
and force-push the branch.

## Pull requests

`main` is the trunk and is protected: **direct pushes to `main` are rejected.** Cut a
branch from `main`, push it, and open a PR back into `main`.

Two required status checks must pass before a merge is allowed:

| Job | What it does |
|---|---|
| `quality` | `pnpm install --frozen-lockfile`, then lint (`--max-warnings 0`), typecheck and test |
| `commit-hygiene` | Scans the commits the PR adds for AI co-author trailers |

CI runs on Linux only — it verifies the JS/TS side. Native changes must be verified
locally on macOS, and the PR template asks you to say so.

Fill out the PR template honestly: the preset(s) affected, whether you re-ran
`prebuild --clean`, and whether you saw `** BUILD SUCCEEDED **`.

## Reporting bugs and requesting features

Use the [issue templates](.github/ISSUE_TEMPLATE). Two questions in the bug form pre-empt
the most common false reports, so please answer them carefully:

- **Did you re-run `npx expo prebuild -p ios --clean`?** Most "the widget didn't change"
  reports are stale generated native code.
- **Is the preset listed in the plugin's `presets` option?** Narrowing `presets` omits
  that preset's widget from the generated target, but the TypeScript factory still exists
  and `start()` still returns an instance — so an excluded preset renders **nothing,
  silently**.

## License

By contributing you agree that your contributions are licensed under the MIT License —
see [LICENSE](LICENSE).
