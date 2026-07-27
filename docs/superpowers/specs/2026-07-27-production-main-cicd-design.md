# Production `main` + CI/CD Gate — Design & Execution Plan

**Date:** 2026-07-27
**Status:** Design approved, not yet executed
**Scope:** Repository/process infrastructure only. No IslandKit product code changes beyond tooling scripts and a one-time formatting pass.

---

## 1. Goal

Three outcomes:

1. A **production default branch `main`**, created fresh as an orphan branch, carrying none of the existing development history.
2. A **CI pipeline** that runs lint, typecheck, and tests on every pull request, and which **blocks merging into `main` unless it passes**.
3. **Zero `Co-Authored-By: Claude` trailers** anywhere in `main`'s history, with automated prevention so none can be reintroduced.

---

## 2. Current state (measured, 2026-07-27)

| Fact | Value |
|---|---|
| Remote | `https://github.com/Justdan111/islandkit.git` |
| Repo visibility | **Private** (unauthenticated API returns 404) |
| Branches on origin | `phase-1-environment-setup`, `phase-2-now-playing-preset`, `phase-3-generalize-pattern` |
| `main` on origin | **Does not exist** |
| `main` locally | Exists, 2 doc commits (`215ee6a`, `541e900`) |
| Is local `main` an ancestor of `phase-4`? | **Yes** — verified with `git merge-base --is-ancestor`. Deleting it loses nothing. |
| Active branch | `phase-4-delivery-timer`, 33 commits ahead of `main` |
| Uncommitted work | 5 untracked evidence PNGs in `docs/superpowers/evidence/` |
| Total commits (all branches) | 34 |
| Commits with `Co-Authored-By` | **15** |
| Test suite | jest, 1 file, **11 tests, all passing** (~0.5s) |
| `tsc --noEmit` | **Passes** |
| `eslint src/` | **0 errors, 27 warnings** (all `prettier/prettier`) |
| `typecheck` script | **Does not exist** — root `pnpm -r --if-present typecheck` is a silent no-op |
| `apps/example` scripts | No `lint`, `test`, or `typecheck` |
| Root `README.md` / `LICENSE` | **Neither exists** (they exist only inside `packages/expo-island-kit/`) |
| `gh` CLI | **Not installed** |
| Local toolchain | Node v25.8.1, pnpm 10.17.0 (pinned via `packageManager`) |

### Decisions taken

| Question | Decision |
|---|---|
| Enforcement mechanism | **Make the repo public.** GitHub Free cannot enforce branch protection or required status checks on private repos. Public also gives unlimited free Actions minutes, and this is an npm package headed for publication anyway. |
| What `main` contains at creation | **CI scaffolding only.** Orphan branch with workflows, README, LICENSE, .gitignore. All product code arrives via PR #1. |
| Fate of `phase-1/2/3/4` | **Keep local, delete from origin** once `main` is default and PR #1 is merged. |
| Lint gate strictness | **Run `prettier --write` first, then gate at `--max-warnings 0`.** Pay the 27-warning debt up front so the gate is green from day one. |
| CI scope | **Lint + typecheck + test on `ubuntu-latest`.** No macOS Swift build. |

### Why no macOS Swift build

Rejected deliberately, not overlooked. A `macos` runner doing `expo prebuild` + `xcodebuild` would cost ~15–25 min per run at 10× the minute rate, and is brittle against the Xcode 26.0.1 / Expo SDK 55 pin documented in `docs/phase-1-device-signing.md`. `apps/*/ios/` is gitignored prebuild output, so every run would regenerate the project from scratch. Swift correctness is already covered by the manual on-device evidence process `CLAUDE.md` defines — and that process catches things a simulator build cannot (does the pill actually appear in the Dynamic Island). Revisit in Phase 8 (Testing matrix) if Swift regressions start slipping through.

---

## 3. Architecture

### 3.1 Branch topology

```
BEFORE                                AFTER

origin                                origin
├── phase-1-environment-setup         └── main  ◄── default, protected
├── phase-2-now-playing-preset             │
└── phase-3-generalize-pattern              ├─ chore: initialize production main
    (no main)                               └─ feat: IslandKit core (PR #1)

local                                 local
├── main (2 doc commits)              ├── main  ◄── orphan, tracks origin/main
├── phase-1-environment-setup          ├── phase-1-environment-setup  ┐
├── phase-2-now-playing-preset         ├── phase-2-now-playing-preset ├ archived,
├── phase-3-generalize-pattern         ├── phase-3-generalize-pattern │ local only
└── phase-4-delivery-timer  ◄ current  └── phase-4-delivery-timer     ┘
```

### 3.2 The unrelated-histories constraint

This is the single most important mechanical detail in the plan.

An orphan `main` shares **no commit** with `phase-4-delivery-timer`. A pull request between two branches with no merge base cannot be merged by GitHub — the UI reports the branches as unmergeable, and `git merge` would require `--allow-unrelated-histories` with a tree-wide conflict.

Therefore PR #1's branch **must be cut from `main`**, and the product code brought in as *tree content* rather than as a merge:

```
git checkout -b feat/islandkit-core main       # descendant of main — has a merge base
git checkout phase-4-delivery-timer -- .       # copy the tree, NOT the history
git commit                                     # a normal commit on top of main
```

`git checkout <ref> -- .` writes the paths present in `<ref>` into the working tree and index. It **adds and overwrites, but never deletes** — so `.github/workflows/` (which exists on `main` but not on `phase-4`) survives the operation intact. `.gitignore` gets overwritten by `phase-4`'s copy, which is why step 3.3 seeds `main` with that exact file: the overwrite then becomes a no-op instead of a spurious diff.

The phase-by-phase development record is not destroyed — it stays on the local archive branches, which is what "keep local, delete from origin" means.

### 3.3 What the initial `main` commit contains

| Path | Source | Notes |
|---|---|---|
| `.github/workflows/ci.yml` | New | The gate |
| `.githooks/commit-msg` | New | Strips AI co-author trailers locally |
| `.gitignore` | Copied **verbatim** from `phase-4` | Must be byte-identical — see the note below |
| `README.md` | New | Root README — none exists today |
| `LICENSE` | Copied from `packages/expo-island-kit/LICENSE` | MIT, needed at root before going public |

The `.gitignore` on `main` must match `phase-4`'s copy exactly, because step 4.2's `git checkout phase-4 -- .` overwrites it. Any edit made only on `main` would be silently reverted by PR #1. The needed `.claude/settings.local.json` entry is therefore added on `phase-4` in **Stage 1.6**, before `main` is created — so the overwrite becomes a genuine no-op rather than a lost change. The same reasoning applies to any file that exists on both branches.

Nothing else. One commit, conventional-commit style, no trailer.

### 3.4 Co-author removal — defence in depth

Three independent layers, because the trailer originates from an AI assistant's instructions rather than from git config, so `git config` alone cannot stop it:

| Layer | Mechanism | Catches |
|---|---|---|
| **1. Structural** | Orphan `main` inherits zero history | All 15 existing commits — they simply never reach `main` |
| **2. Local** | `.githooks/commit-msg` deletes matching trailer lines before the commit is written | Trailers at authoring time, silently |
| **3. Remote** | `commit-hygiene` CI job fails the PR if any commit in the range carries the trailer | Anything that bypasses the hook (`--no-verify`, a fresh clone that hasn't run install) |

The hook is committed to the repo under `.githooks/` and activated by `git config core.hooksPath .githooks`. Because that config is local and not cloned, the root `package.json` gains a `prepare` script that sets it automatically on `pnpm install`.

A fourth, documentation-level layer: `CLAUDE.md` gains an explicit commit-hygiene rule so future AI sessions in this repo don't add the trailer in the first place.

### 3.5 CI pipeline shape

Two jobs, both required checks. Split so a formatting failure and a trailer failure report as distinct signals.

```
                    pull_request → main
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
        ┌───────────┐            ┌──────────────────┐
        │  quality  │            │ commit-hygiene   │
        │           │            │                  │
        │ install   │            │ checkout depth 0 │
        │ lint      │            │ scan PR commits  │
        │ typecheck │            │ for AI trailers  │
        │ test      │            │                  │
        └───────────┘            └──────────────────┘
              │                           │
              └─────────────┬─────────────┘
                            ▼
                 both green → merge allowed
```

**`quality`** — `ubuntu-latest`, ~2 min:
`actions/checkout` → `pnpm/action-setup` (reads `packageManager` from root `package.json`) → `actions/setup-node` with `node-version: 22` and `cache: pnpm` → `pnpm install --frozen-lockfile` → `pnpm -r --if-present lint` → `pnpm -r --if-present typecheck` → `pnpm -r --if-present test`.

Ordering note: `pnpm/action-setup` must run **before** `setup-node`, or `cache: pnpm` has no pnpm to find.

`CI=true` is set by Actions automatically, which matters because `internal/module_scripts/test.js` and `build.js` both append `--watch` when `process.stdout.isTTY && !process.env.CI`. Under Actions they run once and exit. No extra flags needed.

Also note: the package's `prepare` script runs a full `tsc` build during `pnpm install`. This is existing behaviour and is left alone — it means a type error surfaces during the install step rather than the typecheck step. Acceptable; the explicit `typecheck` step still guards the test files, which `tsconfig.json` excludes from the build.

**`commit-hygiene`** — `ubuntu-latest`, ~15s: checks out with `fetch-depth: 0` and greps the PR's commit range for `^Co-Authored-By:.*(claude|anthropic)`, case-insensitive. Fails with an annotation if found.

### 3.6 Tooling gaps this plan closes

| Gap | Fix |
|---|---|
| No `typecheck` script → root recursive command is a silent no-op | Add `"typecheck": "tsc --noEmit -p tsconfig.check.json"` to the package and `"typecheck": "tsc --noEmit"` to `apps/example` |
| `tsconfig.json` excludes `__tests__`, so test files are never typechecked | New `tsconfig.check.json` extends the base and drops the exclude — build output stays unpolluted, but CI still typechecks tests |
| `lint` script tolerates warnings | Change to `eslint src/ --max-warnings 0` |
| 27 existing prettier warnings would fail that gate immediately | One-time `prettier --write src/` in Stage 1, before `main` exists |
| No root `README.md` / `LICENSE` before going public | Created in the initial `main` commit |
| Node version drift (local v25.8.1 vs CI) | Add `.nvmrc` pinned to `22` |
| `.claude/settings.local.json` untracked but not ignored — risk on a public repo | Add to `.gitignore` |

---

## 4. Execution plan

Six stages. Stages 1–2 are local and reversible. Stage 3 is the point of no return for repo visibility. Estimated total: **60–90 minutes**, most of it waiting on CI and clicking through GitHub settings.

### Stage 0 — Prerequisites

| # | Action | Verify |
|---|---|---|
| 0.1 | Install the GitHub CLI: `brew install gh` | `gh --version` |
| 0.2 | Authenticate: `gh auth login` | `gh auth status` shows the `Justdan111` account |
| 0.3 | Confirm working tree state | `git status` |

`gh` is optional — every GitHub-side step has a web-UI equivalent — but it makes branch protection scriptable and reviewable, which is worth the two minutes.

### Stage 1 — Preserve and clean up on `phase-4-delivery-timer`

Done on the current branch, before `main` exists, so PR #1 starts from an already-clean tree.

| # | Action | Verify |
|---|---|---|
| 1.1 | Commit the 5 untracked evidence PNGs | `git status` clean |
| 1.2 | `pnpm exec prettier --write "src/**/*.ts"` in the package | `git diff --stat` shows formatting-only changes |
| 1.3 | Update package `lint` script to `eslint src/ --max-warnings 0` | — |
| 1.4 | Add `tsconfig.check.json` and the `typecheck` scripts (package + example) | — |
| 1.5 | Add `.nvmrc` containing `22` | — |
| 1.6 | Add `.claude/settings.local.json` to the root `.gitignore` (**here, not on `main`** — see §3.3) | — |
| 1.7 | Run the full gate locally: `pnpm -r --if-present lint && pnpm -r --if-present typecheck && CI=1 pnpm -r --if-present test` | **All three exit 0** |
| 1.8 | Commit as `chore: tighten lint/typecheck gates and format sources` | — |

**Stage 1 does not proceed until 1.7 is green.** If the local gate fails, CI will fail identically and PR #1 becomes a debugging session instead of a smoke test.

### Stage 2 — Create the orphan `main`

| # | Action | Verify |
|---|---|---|
| 2.1 | Delete the stale local `main` (already verified as an ancestor of `phase-4` — nothing is lost) | `git branch -D main` succeeds |
| 2.2 | `git checkout --orphan main` | `git status` reports "No commits yet" |
| 2.3 | `git rm -rf .` — clears index and working tree of all tracked files | `git ls-files` returns empty |
| 2.4 | Write the five scaffolding files from §3.3 | — |
| 2.5 | Commit: `chore: initialize production main with CI pipeline` | `git log main` shows **exactly one commit, no trailer** |
| 2.6 | `git push -u origin main` | Branch appears on origin |

Two mechanical notes. `git checkout --orphan` carries the *current* branch's index and working tree across, so 2.3 is what actually makes the branch empty — skipping it commits the entire codebase into what was supposed to be scaffolding. And 2.3 deletes `packages/expo-island-kit/LICENSE` from the working tree, so recover the root `LICENSE` from git rather than from disk:
`git show phase-4-delivery-timer:packages/expo-island-kit/LICENSE > LICENSE`. Same for `.gitignore`:
`git show phase-4-delivery-timer:.gitignore > .gitignore`.

Verification for 2.5: `git log main --format='%B' | grep -ci co-authored` must return `0`, and `git ls-files` must list exactly the five scaffolding paths.

### Stage 3 — Make the repo public and set the default branch

| # | Action | Verify |
|---|---|---|
| 3.1 | **Pre-flight secret scan** before flipping visibility — see §5 | No credentials found |
| 3.2 | Make public: `gh repo edit --visibility public --accept-visibility-change-consequences` | `gh repo view --json visibility` |
| 3.3 | Set default branch: `gh repo edit --default-branch main` | `gh repo view --json defaultBranchRef` |
| 3.4 | Enable squash-merge only, auto-delete head branches | Settings ▸ General ▸ Pull Requests |

Squash-only keeps `main` linear and pairs with the `required_linear_history` protection setting in Stage 5. One caveat worth knowing: GitHub's squash-merge **auto-generates co-author trailers** from the squashed commits' authors. Harmless here — the source commits carry no trailers — but it is the one path by which a trailer could reappear on `main`, which is exactly why the `commit-hygiene` job runs on `push` to `main` as well as on PRs.

### Stage 4 — PR #1: land the codebase

| # | Action | Verify |
|---|---|---|
| 4.1 | `git checkout -b feat/islandkit-core main` | Branch descends from `main` |
| 4.2 | `git checkout phase-4-delivery-timer -- .` | Full tree present; `.github/` still intact |
| 4.3 | Confirm `git status` shows the expected additions and no deletions of scaffolding | — |
| 4.4 | Commit as `feat: IslandKit — Expo module with Now Playing, Delivery, Timer and Generic Progress presets` | Message has **no trailer** |
| 4.5 | Push and open the PR against `main` | PR shows a normal diff, **not** "unrelated histories" |
| 4.6 | Wait for both CI jobs to complete | `quality` and `commit-hygiene` both green |

If 4.5 reports the branches as unmergeable, step 4.1 was done wrong — the branch was cut from a phase branch instead of from `main`. Recreate it from `main` and redo 4.2.

**Do not merge yet.** Stage 5 depends on this run having happened.

### Stage 5 — Enable branch protection

Deliberately after the first CI run: **GitHub does not list a status check in the protection picker until it has reported at least once on the repository.** Configuring protection before Stage 4 would mean typing check names blind, and a typo produces a rule that can never be satisfied.

Apply to `main`:

| Setting | Value | Reason |
|---|---|---|
| Require a pull request before merging | ✅ | No direct pushes to `main` |
| Required approving reviews | **0** | Solo maintainer — GitHub forbids self-approval, so any non-zero count would permanently block every merge |
| Require status checks to pass | ✅ `quality`, `commit-hygiene` | **This is the core requirement** |
| Require branches to be up to date | ✅ | Prevents semantic conflicts from stale branches |
| Require linear history | ✅ | Pairs with squash-only merging |
| Block force pushes | ✅ | `main` history becomes immutable |
| Block deletions | ✅ | — |
| Include administrators | ❌ | Leave the owner an escape hatch; documented, not silent |

Scriptable via `gh api -X PUT repos/Justdan111/islandkit/branches/main/protection` with a JSON body setting `required_status_checks.contexts` to the two job names, `required_status_checks.strict: true`, `enforce_admins: false`, `required_pull_request_reviews.required_approving_review_count: 0`, `restrictions: null`, `allow_force_pushes: false`, `allow_deletions: false`, `required_linear_history: true`.

**Verification that the gate is real** — the acceptance test for this whole project:

1. `git push origin main` directly → must be **rejected** by the remote.
2. Push a commit to a branch that deliberately breaks a test, open a PR → merge button must be **disabled**.
3. Push a commit carrying a `Co-Authored-By: Claude` trailer → `commit-hygiene` must **fail**.
4. Revert both, confirm green, merge succeeds.

A gate that has never been observed failing is not a verified gate.

### Stage 6 — Merge and tidy up

| # | Action | Verify |
|---|---|---|
| 6.1 | Squash-merge PR #1 | `main` has 2 commits |
| 6.2 | Confirm `main` is trailer-free: `git log origin/main --format='%B' \| grep -ci co-authored` | Returns `0` |
| 6.3 | Delete the phase branches **from origin only** | `git ls-remote --heads origin` shows only `main` |
| 6.4 | Keep the phase branches locally as an archive | `git branch` still lists all four |
| 6.5 | Update `CLAUDE.md`: branching model, commit-hygiene rule, CI gate | — |
| 6.6 | Run `pnpm install` on a fresh clone to confirm the `prepare` hook wiring works | `git config core.hooksPath` returns `.githooks` |

---

## 5. Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Going public exposes something sensitive** | High | Mandatory pre-flight scan (Stage 3.1) across all tracked files *and* full history. Known items, all assessed benign: `appleTeamId: A66QV2FW3V` in `apps/example/app.json` (an Apple Team ID is not a credential and appears in every shipped app's provisioning); author email in `package.json` (already deliberately published). `.claude/settings.local.json` is untracked and gets gitignored. **No push tokens, APNs keys, or `.p8` files exist in this repo** — Phase 5 is blocked precisely because that account doesn't exist yet, which is convenient here. |
| PR #1 rejected as unrelated histories | High | §3.2 — branch from `main`, copy tree content. Explicit check at step 4.5 with a stated recovery. |
| Required checks not selectable in the UI | Medium | Stage ordering: first CI run happens before protection is configured. |
| Squash-merge auto-injects co-author trailers | Medium | `commit-hygiene` runs on `push` to `main`, not just on PRs, so a trailer that lands via squash is reported. |
| `--max-warnings 0` fails PR #1 | Medium | Stage 1.2 pays the 27-warning debt before `main` exists; step 1.6 is a hard gate on the local run. |
| `commit-msg` hook not active in fresh clones | Low | Root `prepare` script sets `core.hooksPath` on `pnpm install`; the CI job is the backstop for anyone who skips install. |
| Node 22 in CI vs 25.8.1 locally | Low | `.nvmrc` pins the intent. Both satisfy Expo SDK 55's Node ≥20 requirement. If CI reveals a divergence, pin CI to 25 rather than downgrading locally. |
| Losing the phase-by-phase history | Low | Archive branches kept locally and never force-deleted. `docs/superpowers/` specs, plans, and evidence PNGs all travel to `main` inside PR #1. |
| Solo dev locked out by their own rules | Low | 0 required approvals; `enforce_admins: false`. |

---

## 6. Explicit non-goals

Kept out to hold this to one reviewable change:

- **npm publish automation** — a release workflow for `expo-island-kit` belongs to Phase 9, not here.
- **macOS / Swift CI** — §2, rationale above. Revisit in Phase 8.
- **Rewriting history on the phase branches** — the orphan `main` makes it unnecessary. Those branches keep their trailers and stay local.
- **Dependabot, CodeQL, coverage thresholds, PR templates, CODEOWNERS** — all reasonable later; none is required for "tests must pass to merge."
- **Any change to IslandKit product behaviour.** The only source edits are `prettier --write` (formatting only) and added npm scripts.

---

## 7. Definition of done

- [ ] `main` exists on origin, is the default branch, and its history contains **zero** `Co-Authored-By` trailers
- [ ] The repository is public with a root `README.md` and `LICENSE`
- [ ] `git push origin main` is rejected by the remote
- [ ] A PR with a failing test **cannot** be merged — observed, not assumed
- [ ] A PR with an AI co-author trailer **cannot** be merged — observed, not assumed
- [ ] `quality` and `commit-hygiene` are configured as required status checks
- [ ] The full IslandKit codebase (Phases 1–4) is on `main` via a merged PR
- [ ] `phase-1/2/3` are gone from origin and still present locally
- [ ] `pnpm -r --if-present lint && pnpm -r --if-present typecheck && pnpm -r --if-present test` passes on a clean clone of `main`
- [ ] `CLAUDE.md` documents the branching model and the commit-hygiene rule

---

## 8. Relationship to the phase roadmap

This is infrastructure work that sits outside the Phase 0–10 sequence in `CLAUDE.md`; it does not advance or skip a phase. Phase 4 (Delivery, Timer) stays where it is — its code is what PR #1 carries onto `main`.

One follow-on: once this lands, the phase workflow changes shape. Phases have so far been long-lived branches stacked on one another (`phase-2` → `phase-3` → `phase-4`). Going forward each phase becomes a branch cut from `main` and merged back through a gated PR. That is a genuine improvement — the phase branches currently diverge far enough that `main` had never seen a single line of product code — but it should be written into `CLAUDE.md` at step 6.5 rather than left implicit.
