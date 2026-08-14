# Phase 7 — Docs, Example Showcase & Public-Launch Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn IslandKit from an internally-documented project into something a stranger can adopt: a consumer-facing README, an example app that demonstrates each preset properly, and the repository hygiene bundle a public repo needs — without flipping the repo public.

**Architecture:** Three independent deliverables that share one branch. The package README becomes the canonical consumer doc (the root README stays the contributor/monorepo view). The example app migrates from a single `App.tsx` test harness to an Expo Router app with one route per preset. The launch bundle is repo-level metadata files. No `src/` or `ios/` behaviour changes — Phase 7 ships no new library features.

**Tech Stack:** Expo SDK 57, React Native 0.86.2, TypeScript strict, expo-router ~7, Markdown, GitHub issue/PR templates (YAML forms).

## Global Constraints

- **iOS only.** No Android code, config, or conditional branches.
- **Expo SDK 57** (RN 0.86.2, react 19.2.3). No SDK bump in this phase.
- **No paid-capability work:** no App Groups, no Push Notifications, no `aps-environment`, no push-token code.
- **Do NOT flip the repo public and do NOT add the macOS CI job.** Phase 7 prepares the bundle; going public is a separate deliberate step.
- **Package name is `expo-island-kit`** (confirmed free on npm 2026-08-13, no punctuation-similarity collisions). **Repo stays `github.com/Justdan111/islandkit`** — the mismatch is intentional; use the repo URL for clone/contributing and the package name for install.
- **Minimum versions to state in docs:** Expo SDK 57, iOS **16.2+** (the plugin's `DEFAULT_DEPLOYMENT_TARGET`), Xcode 26.4+ (Swift 6.3 — SDK 56+ requires it), Dynamic Island hardware = iPhone 14 Pro or newer (Live Activities themselves work on any iOS 16.2+ device via the Lock Screen).
- **Honesty rule:** document only behaviour that is verified. Verified on device (iPhone 14 Pro, 2026-08-13): compact/minimal presentations, long-press expanded layout, Lock Screen banner, Timer pause/resume, Delivery map snapshot, Timer live countdown. Do not document push updates, theming, or animations as working.
- **Commit style:** conventional commits (`feat:`, `fix:`, `docs:`, `chore:`). **Never add a `Co-Authored-By: Claude` trailer** — CI job `commit-hygiene` fails the build on `^co-authored-by:.*(claude|anthropic)` over the PR range.
- **CI gate:** PR into `main`; required checks `quality` (lint / typecheck / test) + `commit-hygiene`. Lint runs at `--max-warnings 0`.

---

## Reference: the exact public API (use verbatim in docs)

Exports from `expo-island-kit` (`packages/expo-island-kit/src/index.ts`):

```ts
areLiveActivitiesEnabled(): Promise<boolean>
NowPlayingActivity, GenericProgressActivity, DeliveryActivity, TimerActivity
type NowPlayingProps, GenericProgressProps, DeliveryProps, TimerProps
type DismissalPolicy, LiveActivityInstance, LiveActivityFactory
```

Factory + instance shape (`src/core/types.ts`):

```ts
interface LiveActivityFactory<T> {
  start(props: T, deepLinkUrl?: string): LiveActivityInstance<T>;
  getActiveInstances(): LiveActivityInstance<T>[];
  isSupported(): boolean;
}
interface LiveActivityInstance<T> {
  readonly id: string;
  update(props: Partial<T>): Promise<void>;
  end(dismissalPolicy?: DismissalPolicy, finalProps?: Partial<T>): Promise<void>;
}
type DismissalPolicy = 'default' | 'immediate' | { after: Date };
```

Preset props (copy these tables into the README exactly):

| `NowPlayingProps` | type | required |
|---|---|---|
| `title` | `string` | yes |
| `artist` | `string` | yes |
| `artworkUrl` | `string` | no |
| `artworkAsset` | `string` | no |
| `isPlaying` | `boolean` | yes |
| `elapsedSeconds` | `number` | yes |
| `durationSeconds` | `number` | yes |
| `accentColor` | `string` (hex) | no |

| `GenericProgressProps` | type | required |
|---|---|---|
| `title` | `string` | yes |
| `subtitle` | `string` | no |
| `progress` | `number` (0–1) | yes |
| `iconSystemName` | `string` (SF Symbol) | no |
| `accentColor` | `string` (hex) | no |

| `DeliveryProps` | type | required |
|---|---|---|
| `status` | `'confirmed' \| 'preparing' \| 'onTheWay' \| 'delivered'` | yes |
| `etaMinutes` | `number` | no |
| `courierName` | `string` | no |
| `orderNumber` | `string` | yes (immutable — set at `start`, ignored by `update`) |
| `mapSnapshotUrl` | `string` | no |
| `accentColor` | `string` (hex) | no |

| `TimerProps` | type | required |
|---|---|---|
| `label` | `string` | yes |
| `endDate` | `Date` | yes |
| `isPaused` | `boolean` | no |
| `accentColor` | `string` (hex) | no |

Config plugin options (`app.plugin.js`, `KNOWN_OPTIONS`):

| option | default | notes |
|---|---|---|
| `presets` | all four | array; empty array or unknown key throws with the valid list |
| `deploymentTarget` | `'16.2'` | widget target's iOS deployment target |
| `bundleIdentifier` | `<appId>.widget` | omitted by default so apple-targets' derived id is preserved |
| `defaultAccentColor` | `nil` | fallback accent when a preset omits `accentColor` |

Options that warn (not error): `appleTeamId` (set `ios.appleTeamId` instead), `groupIdentifier` (App Groups unsupported), `enablePushNotifications` (push unsupported). Listing `@bacons/apple-targets` in your own `plugins` array also warns — IslandKit applies it for you.

---

### Task 1: Consumer-facing package README

**Files:**
- Modify: `packages/expo-island-kit/README.md` (currently 57 lines, internal in tone — replace wholesale)

**Interfaces:**
- Consumes: the API reference tables above, verbatim.
- Produces: the canonical consumer doc. Task 3 links to it from CONTRIBUTING; Task 2's example README points at it.

- [ ] **Step 1: Write the README with these sections, in order**

1. **Title + one-line pitch** — "Drop-in iOS Live Activities and Dynamic Island presets for Expo. Four pre-built presets, zero Swift."
2. **Media slots** — one clearly-marked placeholder per preset, exactly this form so the maintainer can drop footage in:
   ```markdown
   <!-- MEDIA SLOT: now-playing.gif — device capture, iPhone 14 Pro, compact + expanded -->
   _Now Playing — recording coming soon._
   ```
   Repeat for `generic-progress.gif`, `delivery.gif`, `timer.gif`.
3. **Requirements** — Expo SDK 57, iOS 16.2+, Xcode 26.4+, Dynamic Island needs iPhone 14 Pro or newer; Live Activities on older iOS 16.2+ devices still render on the Lock Screen. **iOS only** — the package no-ops safely on other platforms.
4. **Install** —
   ```bash
   npx expo install expo-island-kit
   ```
   then add the plugin to `app.json`:
   ```json
   { "expo": { "plugins": ["expo-island-kit"] } }
   ```
   then:
   ```bash
   npx expo prebuild -p ios --clean
   ```
   State plainly that `--clean` is required (plain `prebuild` over an existing widget target fails with `withIosXcodeProjectBeta2BaseMod: Cannot read properties of undefined`).
5. **Quickstart per preset** — four runnable snippets. Use the exact prop names from the tables. Example for Now Playing:
   ```ts
   import { NowPlayingActivity } from 'expo-island-kit';

   const activity = NowPlayingActivity.start({
     title: 'Midnight City',
     artist: 'M83',
     isPlaying: true,
     elapsedSeconds: 12,
     durationSeconds: 231,
     accentColor: '#FF375F',
   }, 'myapp://now-playing');

   await activity.update({ elapsedSeconds: 42 });
   await activity.end('immediate');
   ```
6. **API reference** — the four props tables, plus `LiveActivityFactory` / `LiveActivityInstance` / `DismissalPolicy`, plus `areLiveActivitiesEnabled()`.
7. **Config plugin options** — the options table, the warning-only options, and the double-application warning.
8. **Known limitations** (do not soften these):
   - **The `presets` footgun.** Narrowing `presets` omits that preset's widget from the generated target. The TypeScript factory still exists and `start()` still returns an instance, so **calling an excluded preset renders nothing, silently**. If a preset doesn't appear, check your `presets` array first.
   - **`getActiveInstances()` only sees activities started by the current app process.** Live Activities survive app termination, but instances from a previous launch are not returned, so they cannot be updated or ended through it. Workaround: track your own activity ids, or end activities before the app exits.
   - **No push updates.** Updates come from the app process only (Phase 5, requires a paid Apple Developer account).
   - **No App Groups.**
   - **Native errors are currently coarse** — failures degrade to a no-op with an empty activity id rather than a descriptive error.
9. **Upgrading** — after upgrading the package, re-run `npx expo prebuild -p ios --clean`; the widget target is generated from the package and is overwritten every prebuild by design. Do not hand-edit `targets/island-kit-widget/`.
10. **Roadmap** — v2: theming and animations. Also planned: push-driven updates (needs paid account). Mark clearly as **not yet available**.
11. **License** — MIT, link `LICENSE`.

- [ ] **Step 2: Verify every code snippet type-checks against the real exports**

Cross-check each snippet's props against the tables above. Required props present, no invented props, `endDate` is a `Date`, `progress` is 0–1, `orderNumber` documented as immutable.

- [ ] **Step 3: Run the gate**

```bash
pnpm lint && pnpm typecheck && pnpm test
```
Expected: all exit 0. (Markdown alone can't break these, but the README is the only change in this commit, so a green run confirms nothing else drifted.)

- [ ] **Step 4: Commit**

```bash
git add packages/expo-island-kit/README.md
git commit -m "docs: consumer-facing README with quickstarts, API reference and known limitations"
```

---

### Task 2: Example app as a showcase (Expo Router)

**Files:**
- Modify: `apps/example/package.json` (add `expo-router`, `react-native-safe-area-context`, `react-native-screens`; change `main`)
- Modify: `apps/example/app.json` (add `expo-router` plugin, confirm `scheme`)
- Delete: `apps/example/App.tsx`, `apps/example/index.ts`
- Create: `apps/example/app/_layout.tsx`, `apps/example/app/index.tsx`
- Create: `apps/example/app/now-playing.tsx`, `app/generic-progress.tsx`, `app/delivery.tsx`, `app/timer.tsx`
- Create: `apps/example/components/DemoScreen.tsx` (shared shell: title, description, status line, action buttons)
- Create: `apps/example/README.md` (how to run the example)

**Interfaces:**
- Consumes: the public API exactly as Task 1 documents it.
- Produces: a route per preset. Each screen owns its own `LiveActivityInstance` in a `useRef` and exposes Start / Update / End (plus Pause / Resume on Timer only).

- [ ] **Step 1: Install the router dependencies**

```bash
cd apps/example && npx expo install expo-router react-native-safe-area-context react-native-screens
```

- [ ] **Step 2: Switch the entry point**

In `apps/example/package.json` set `"main": "expo-router/entry"` and delete `index.ts`. In `app.json`, add `"expo-router"` to `plugins` (keep `expo-status-bar` and `expo-island-kit`) and ensure `"scheme": "islandkitexample"` is set — deep links in the presets rely on it.

- [ ] **Step 3: Create the shared demo shell**

`components/DemoScreen.tsx` exports `DemoScreen({ title, description, status, children })` rendering a scrollable dark screen, and `ActionButton({ label, onPress, tone })`. Keep it dependency-free (View/Text/Pressable/ScrollView only).

- [ ] **Step 4: Create `app/_layout.tsx` and `app/index.tsx`**

`_layout.tsx` is a `Stack` with a dark header. `index.tsx` lists the four presets as links (`expo-router`'s `Link`), each with a one-line description, plus a line showing `areLiveActivitiesEnabled()` so a user immediately sees whether the OS permits activities.

- [ ] **Step 5: Port each preset to its own route**

Move the existing per-preset logic out of the old `App.tsx` (read it from git history: `git show HEAD:apps/example/App.tsx`) into four screens, preserving the demo props and the Start/Update/End handlers already proven on device. Timer keeps Pause/Resume and its own `endDate` ref (the consumer tracks its own `endDate`; there is no `currentEndDate` convenience). Delivery keeps the four-stage status advance.

Each screen shows the returned activity id (or "start returned no id") so failures are visible rather than silent.

- [ ] **Step 6: Write `apps/example/README.md`**

How to run: `pnpm install`, `npx expo prebuild -p ios --clean`, `npx expo run:ios` (or `--device <udid>`), and a note that a free Personal Team requires trusting the developer certificate on the device (Settings ▸ General ▸ VPN & Device Management) and that those certs expire after 7 days.

- [ ] **Step 7: Verify it builds and runs**

```bash
cd apps/example && npx expo prebuild -p ios --clean
xcodebuild -workspace /Users/danemmanuel/Documents/islandkit/apps/example/ios/example.xcworkspace \
  -scheme example -configuration Debug \
  -destination "id=1006EE41-F85F-46A6-9576-96E8F1ADFD20" build
```
Expected: literal `** BUILD SUCCEEDED **`. **Do not trust the exit code** — piping xcodebuild through `tail` masks it; grep for the string.

- [ ] **Step 8: Run the gate and commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add apps/example
git commit -m "feat(example): expo-router showcase with a screen per preset"
```

---

### Task 3: Public-launch bundle

**Files:**
- Create: `LICENSE` (repo root, MIT — the package and example already have one; the root does not)
- Create: `CONTRIBUTING.md`
- Create: `.github/pull_request_template.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`, `.github/ISSUE_TEMPLATE/feature_request.yml`, `.github/ISSUE_TEMPLATE/config.yml`
- Modify: `packages/expo-island-kit/package.json` (keywords only — name, description, license, repository are already correct)

**Interfaces:**
- Consumes: nothing from Tasks 1–2 beyond linking to the README.
- Produces: repo hygiene. No code depends on it.

- [ ] **Step 1: Root `LICENSE`**

MIT, copyright holder `Justdan111`, year 2026. Match the text already in `packages/expo-island-kit/LICENSE`.

- [ ] **Step 2: `CONTRIBUTING.md`**

Cover, concretely: repo layout (pnpm workspace, `packages/expo-island-kit` + `apps/example`); setup (`pnpm install`, Node 22 per `.nvmrc`, pnpm 10.17); running checks (`pnpm lint`, `pnpm typecheck`, `pnpm test`); **the re-prebuild gotcha** — after changing anything under `packages/expo-island-kit/plugin/` or `ios/`, run `npx expo prebuild -p ios --clean` in `apps/example` or you are testing stale native code; the `build/` staleness trap (`tsc` does not delete orphaned outputs — `rm -rf packages/expo-island-kit/build && pnpm --filter expo-island-kit build`); what CI enforces (`quality` and `commit-hygiene`, both required, lint at `--max-warnings 0`); and that **AI co-author trailers are rejected** — `.githooks/commit-msg` strips them and is activated by `pnpm install` setting `core.hooksPath`.

- [ ] **Step 3: PR template**

Self-verify checklist: `pnpm lint` / `pnpm typecheck` / `pnpm test` pass; docs updated if the public API changed; which preset(s) are affected (checkboxes: Now Playing / Generic Progress / Delivery / Timer / none); whether a native rebuild was verified (`prebuild --clean` + `BUILD SUCCEEDED`); confirmation the change is iOS-only.

- [ ] **Step 4: Issue templates**

`bug_report.yml` fields: package version, Expo SDK, iOS version, device (and whether it has a Dynamic Island), preset affected (dropdown), what happened vs expected, repro steps, whether `expo prebuild -p ios --clean` was re-run, and whether the preset is included in the plugin's `presets` option (this is the footgun — asking up front saves a round trip).
`feature_request.yml`: problem, proposed API, which preset(s), willingness to PR.
`config.yml`: `blank_issues_enabled: false`.

- [ ] **Step 5: Package keywords**

Extend `keywords` to: `react-native`, `expo`, `expo-island-kit`, `ExpoIslandKit`, `live-activities`, `dynamic-island`, `activitykit`, `widgetkit`, `ios`, `expo-plugin`. Leave `name`, `version`, `description`, `license`, `repository` untouched — already correct.

- [ ] **Step 6: Run the gate and commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add LICENSE CONTRIBUTING.md .github packages/expo-island-kit/package.json
git commit -m "chore: add contributor docs, issue/PR templates and publish metadata"
```

---

### Task 4: Status update, verification and PR

**Files:**
- Modify: `CLAUDE.md` (status table: Phase 6 device pass, Phase 7 row)
- Modify: `README.md` (root — add links to the consumer README and CONTRIBUTING)

- [ ] **Step 1: Update `CLAUDE.md`**

Mark the Phase 6 on-device visual pass **done — verified on iPhone 14 Pro, 2026-08-13** (expanded layout, Lock Screen banner, Timer pause/resume, Delivery map snapshot). Set Phase 7 to done with a one-line summary. Leave Phase 5 blocked. Note the remaining Phase 6 DX items (native error messages, prop defaults, `getActiveInstances()` cross-process gap) as still open.

- [ ] **Step 2: Point the root README at the new docs**

Add a short "Using the package" line linking `packages/expo-island-kit/README.md`, and a "Contributing" line linking `CONTRIBUTING.md`. Keep the root README's contributor/monorepo framing.

- [ ] **Step 3: Full verification**

```bash
pnpm lint && pnpm typecheck && pnpm test
```
Expected: exit 0, 22/22 tests (or more if tests were added).

- [ ] **Step 4: Confirm no AI trailers**

```bash
git log origin/main..HEAD --format='%b' | grep -icE '^co-authored-by:.*(claude|anthropic)'
```
Expected: `0`.

- [ ] **Step 5: Commit and open the PR**

```bash
git add CLAUDE.md README.md
git commit -m "docs: record Phase 6 device pass and Phase 7 completion"
git push -u origin phase-7-docs-showcase
gh pr create --base main --title "feat: Phase 7 — consumer docs, example showcase and public-launch prep" --body "<summary>"
```

- [ ] **Step 6: Confirm the gate is green**

```bash
gh pr checks <n>
```
Expected: `quality` pass, `commit-hygiene` pass. **Do not merge** — merging is the maintainer's call.

---

## Self-Review

**Spec coverage:** consumer README (T1), install + one-plugin setup (T1 §4), quickstart per preset (T1 §5), props reference (T1 §6), presets footgun + iOS-only + re-prebuild + min versions (T1 §3/§8/§9), GIF slots (T1 §2), example showcase with router (T2), CONTRIBUTING + PR template + issue templates (T3), LICENSE + npm metadata (T3), Phase 6 punch-list documented as limitations (T1 §8), v2 roadmap (T1 §10), no public flip / no macOS CI (Global Constraints), CI gate PR (T4). All covered.

**Placeholders:** the only intentional placeholders are the four MEDIA SLOT markers, which the user explicitly requested and which are marked with an exact, greppable comment form.

**Type consistency:** all snippets use `start`/`update`/`end`/`getActiveInstances`/`isSupported` and the prop names taken verbatim from `src/presets/*.ts`. `DismissalPolicy` values are `'default' | 'immediate' | { after: Date }`.
