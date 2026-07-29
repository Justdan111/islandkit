Kickoff: Establish main + CI/CD Gate, then execute Phase 6
Context

The repo currently has phase branches (phase1, phase2, …) pushed but no canonical trunk. Before Phase 6 lands, set up a real main branch with an enforced CI merge gate, so Phase 6 becomes the first branch to merge through it. Repo is private for now, going public later — set everything up so the public switch is a clean, later, one-step decision with nothing to rebuild.

Execute in two stages: Stage A (main + CI gate) fully complete and verified before Stage B (Phase 6 execution) merges.

Stage A — main + CI/CD gate
A1. Establish main as trunk
Identify the furthest-along, correct phase branch (confirm with me which one represents current good state before proceeding — don't guess).
Create main from it and push. From here on, phase branches merge into main; stop stacking phase-on-phase.
Do not delete the existing phase* branches yet — leave them as history until main is confirmed good.
A2. CI workflow — Linux-only to start

Create .github/workflows/ci.yml that runs on pull requests into main. Linux runner only for now. Jobs:

Install deps (pnpm, matching the workspace setup)
TypeScript typecheck
ESLint
Jest (the full suite, including the Phase 3/4 abstraction + Date-serialization tests)

Do NOT add a macOS job in this stage. Reason: private repo, and macOS CI minutes bill at 10× the Linux rate against a metered monthly allowance. The macOS unsigned-simulator build is a deliberate second step (see A5), added later and tuned to run sparingly. Note it as a tracked follow-up, don't implement it now.

A3. Branch protection on main

Walk me through configuring these in GitHub's settings (these are repo settings, not a file — you'll need to give me the exact clicks or gh commands):

Require a pull request before merging
Require the CI status check to pass before merging
Block direct pushes to main
(Leave "require review" optional since I'm solo for now — flag it as available if I want it later)
A4. gh auth login walkthrough

I haven't authenticated the GitHub CLI. Give me the exact gh auth login steps (browser flow, correct scopes) before any gh-dependent commands. Surface this early — don't hit a wall mid-task because auth isn't set up.

A5. Log the deferred CI items (don't build)

Record as tracked follow-ups, explicitly not done in this stage:

macOS unsigned-simulator build job — add later, configured to run only on PRs into main (not every push) to conserve private-repo minutes. Confirms Swift compiles; no signing needed.
Signed/device builds — blocked on the paid Apple Developer account (same line as Phase 5). Not attempted.
Stage A definition of done
 main exists, pushed, represents current good state (confirmed with me)
 ci.yml runs typecheck + lint + Jest on PRs into main, green on a test PR
 Branch protection enforced: no direct push to main, CI must pass to merge
 gh authenticated
 Deferred CI items logged
 Public-repo switch confirmed as a clean later step (nothing set up here blocks or complicates it)

Stop after Stage A and confirm with me before starting Stage B execution.

Stage B — Phase 6 execution (config plugin)

Only begin once Stage A's gate is live. Phase 6 runs on a branch off main and merges back through the CI gate — making it the first gated PR.

Execution approach

Subagent-driven — fresh subagent per task, two-stage review between tasks, final whole-branch review. Same as Phases 2–4. Follow the committed plan: docs/superpowers/plans/2026-07-27-phase-6-config-plugin.md, 7 tasks.

Task 1 is the gate — de-risk spike first

Prove the real mechanism before building on it: throwaway plugin in function-form config (the real shape, not a toy), confirm the config plugin can generate the widget target + copy the Swift + it builds, in the example-as-consumer. Log whether _internal.projectRoot exists (Task 4 branches on it). Do not proceed to Task 2 until the spike proves out — report the result to me first.

Confirmed design decisions (locked — carry into execution)
Copy-on-prebuild, not symlink — the plugin copies .swift from the package into the consumer's generated target. Must be idempotent (overwrite on every prebuild, never skip-if-present or duplicate) so upgrades don't leave stale copies.
Wrap apple-targets (one plugin) — consumer lists only expo-island-kit. Pin @bacons/apple-targets as an internal dependency at a known-good version; treat bumps as deliberate tested changes. Fail loudly with a readable IslandKit-attributed error if the wrapped step doesn't produce the target.
Full config-plugin automation is the scope — package ships widget SwiftUI, app.plugin.js auto-generates the target, example converted to consume the plugin. Native error messages / prop defaults / unsupported-path signalling are the deferred smaller pass — explicitly NOT claimed done.
The three judgement calls (approved — make the doc corrections land)
deploymentTarget defaults to 16.2, not 16.1 — the ActivityKit code is @available(iOS 16.2, *); the doc saying 16.1 is wrong. Correct the doc.
bundleIdentifier omitted unless set — preserves apple-targets' default; adopting the doc's .IslandKitExtension suffix would change the example widget's bundle id and force re-provisioning on the free Personal Team. Correct the doc to match.
Honest partial status — the status row states what shipped and what didn't; don't mark the phase "done" on the deferred DX items.
Critical test — Task 6, consumer resolution

npm pack + install into a scratch app outside the monorepo. This is the layer that proves a stranger can actually install it — resolution behaves differently outside the workspace. Don't skip or shortcut it; a package that works in-monorepo but breaks on external install is the classic trap.

Final gate — Task 7

Zero-diff assertion on the Phase-3 abstraction directories (engine, protocol, registry). Phase 6 must not have touched them — prove it, same abstraction-bar discipline as Phase 4.

Global constraints (unchanged)
iOS only; no Android.
No App Groups, no Push, no push-token code, no aps-environment (all Phase 5, blocked on paid account).
appleTeamId in config stays; no paid-only capabilities added.
Example bundle id stays io.github.Justdan111.islandkitexample.
Simulator acceptable for DoD, but note in evidence: simulator ≠ on-device visual sign-off.
Carried-forward logged items (from earlier phases — keep tracked, don't silently drop)
Progress-bar clip (Now Playing expanded view, bottom region needs padding; check trailing time inset) — deferred to the visual polish pass, but must survive Phase 6's widget-source relocation, not get lost in it.
Parked feature: progressLabel? on GenericProgressProps — future nicety, excluded to keep code matching the doc contract.
currentEndDate getter — deferred; ensure the Timer doc example demonstrates the shipped pattern (pass your own endDate on update), not the getter.
Stage B definition of done
 Task 1 spike proven before any build-on-top
 Config plugin auto-generates the target + copies Swift (idempotent) + builds, in the example-as-first-consumer
 All four presets run on the simulator (regression: NowPlaying + Generic Progress still work)
 Task 6 external-scratch-app install passes — a stranger can install it
 Jest green including abstraction + Date-serialization tests
 Zero-diff on Phase-3 abstraction dirs
 Doc corrections landed (16.2, bundle id) — no doc/code drift
 No forbidden entitlements
 Honest partial status recorded (deferred DX items not claimed)
 Phase 6 branch merges into main through the CI gate — the first gated PR
The public-repo switch (deferred, deliberate — not part of this kickoff's execution)

When I decide to go public — ideally once the expo-island-kit name is confirmed available on npm and GitHub — that's its own small step: flip the repo visibility, and then add the deferred macOS CI job (A5) since macOS minutes are free on public repos. Don't do this now; just make sure nothing in Stage A or B blocks it.

What to do first, right now

Start Stage A, task A4 (gh auth login) so auth is ready, then A1 — but before creating main, confirm with me which phase branch represents current good state. Report back after Stage A is green and gated; hold Stage B until I confirm.