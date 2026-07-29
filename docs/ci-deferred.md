# CI — deferred items

Tracked follow-ups, deliberately **not** implemented in the Stage A gate. Recorded so
they stay visible rather than being rediscovered later.

## 1. macOS unsigned-simulator build job

**Status:** deferred, not started.

**What:** a `macos-latest` job running `expo prebuild -p ios` + `xcodebuild` against a
simulator destination, with no code signing. Confirms the Swift actually compiles —
the one class of regression the Linux gate cannot catch, since `apps/*/ios/` is
gitignored prebuild output and no Swift is compiled on Linux at all.

**Why deferred:** the repository is private, and macOS runner minutes bill at **10x**
the Linux rate against a metered monthly allowance. A prebuild + xcodebuild run costs
roughly 15–25 minutes of wall clock, so at 10x it consumes a meaningful fraction of the
monthly budget per run.

**When to add:** either when the repository goes public (macOS minutes are free on
public repos — this is the natural trigger), or sooner if a Swift regression slips
through. Configure it to run **only on pull requests into `main`**, never on every push,
and consider `paths:` filters so it skips PRs that touch no Swift.

**Constraint to respect when adding it:** the runner's Xcode version must be able to
build Expo SDK 55. Xcode 26.0.1 is the local pin; SDK 56+ requires Xcode 26.4+. A
GitHub-hosted macOS runner may ship a different Xcode than the local machine, so pin it
explicitly with `maxim-lobanov/setup-xcode` rather than accepting the default.

## 2. Signed / device builds

**Status:** blocked, not attempted.

Blocked on the same paid Apple Developer Program account that blocks Phase 5 (remote
push updates). The developer is on a free Apple ID / Personal Team, which cannot produce
distributable signed builds in CI. Device verification stays a manual step documented in
`docs/phase-1-device-signing.md`.

Do not scaffold signing secrets, certificates, or provisioning profiles in CI until that
account exists.

## 3. Other things intentionally not in the gate

Reasonable later, none required for "tests must pass to merge":

- Dependabot / CodeQL
- Coverage thresholds
- PR templates, CODEOWNERS
- npm publish automation (Phase 9)
