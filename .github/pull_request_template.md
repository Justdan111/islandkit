<!--
Thanks for the PR. See CONTRIBUTING.md for setup, the checks and the known gotchas.
Conventional-commit titles please (feat:, fix:, docs:, chore:, ci:, refactor:, test:).
-->

## What this changes

<!-- One or two sentences. Link the issue it closes, if any. -->

## Why

<!-- The problem this solves, or the behaviour it unblocks. -->

## Preset(s) affected

- [ ] Now Playing
- [ ] Generic Progress
- [ ] Delivery
- [ ] Timer
- [ ] None (docs, tooling, CI, config plugin plumbing, …)

## Self-verification

- [ ] `pnpm lint` passes (runs at `--max-warnings 0`)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] Consumer docs (`packages/expo-island-kit/README.md`) updated, or the public API did not change
- [ ] This change is **iOS only** — no Android code, config or conditional branches were added
- [ ] No `Co-Authored-By:` AI trailers in any commit (the `commit-hygiene` job rejects them)

## Native rebuild

Required if anything under `packages/expo-island-kit/plugin/` or
`packages/expo-island-kit/ios/` changed. CI runs on Linux and cannot check this for you.

- [ ] Ran `npx expo prebuild -p ios --clean` in `apps/example`
- [ ] Build printed the literal `** BUILD SUCCEEDED **`
- [ ] Not applicable — this PR touches no native or plugin code

**Verified on:** <!-- e.g. iPhone 14 Pro (device, iOS 18.5) / iPhone 17 Pro simulator / n/a -->

## Screenshots or capture

<!-- For anything that changes what renders in the Dynamic Island or Lock Screen banner. -->

## Notes for the reviewer

<!-- Anything intentionally left out, follow-ups, or areas you'd like a closer look at. -->
