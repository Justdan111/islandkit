# Phase 6 — Config Plugin (Zero-Swift Consumer Setup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the widget SwiftUI inside `expo-island-kit` and add an `app.plugin.js` that generates the consumer's widget extension target on `expo prebuild`, so a consumer needs only `plugins: ['expo-island-kit']` and zero Swift — with the four unblocked options from the published doc §11 actually working.

**Architecture:** The package ships a widget template (`plugin/widget/`) plus a pure, unit-tested generator (`plugin/generateTarget.js`). `app.plugin.js` (default-exported, run-once-guarded) validates options, calls the generator to write `<projectRoot>/targets/island-kit-widget/` at plugin-eval time, sets `NSSupportsLiveActivities`, then applies `@bacons/apple-targets` (`withTargetsDir`), which globs `./targets/*/expo-target.config.js` and builds the Xcode target. Three files are *generated* rather than copied (`expo-target.config.js`, `IslandKitWidgetBundle.swift`, `IslandKitDefaults.swift`) because they encode the options. The example app is converted to consume the plugin, and a packed tarball is installed into a scratch app outside the monorepo to prove the real consumer path.

**Tech Stack:** Expo SDK 55, `@expo/config-plugins` (`withInfoPlist` / `createRunOncePlugin`), `@bacons/apple-targets@5` (`withTargetsDir`), Swift / WidgetKit / ActivityKit, Node `fs`, Jest.

**Spec:** `docs/superpowers/specs/2026-07-27-phase-6-config-plugin-design.md`
**Branch:** `phase-6-config-plugin`, cut from the current `phase-4-delivery-timer` HEAD.

## Global Constraints

- **iOS only.** No Android code, config, or conditional branches.
- **Expo SDK 55 — no bump.** Xcode 26.0.1 cannot build SDK 56+ (`weak let` needs Swift 6.3 / Xcode 26.4+).
- **No App Groups, no Push, no `aps-environment`, no push-token code, no new capabilities.** The developer is on a free Apple ID / Personal Team. If you find yourself reaching for a push token or an App Group, stop — that is Phase 5, blocked.
- **`ios.appleTeamId: "A66QV2FW3V"` stays in `apps/example/app.json`** and remains the consumer's responsibility. The plugin never invents or sets a team.
- **The example app's bundle identifier stays `io.github.Justdan111.islandkitexample`** — globally unique, do not genericize.
- **Zero diff to the Phase-3 abstraction:** `packages/expo-island-kit/ios/core/LiveActivityEngine.swift`, `ios/core/PropCoercion.swift`, `ios/core/PresetRegistry.swift`, the `LiveActivityPresetHandler` protocol, `src/core/types.ts`, and `src/core/createLiveActivityFactory.ts` must all be untouched. Any need to change them is a signal to stop and flag, not to patch.
- **No change to any public TS API** or to the four presets' prop shapes.
- **One permitted widget-layer change:** `presetAccentColor(_:)` in `WidgetSupport.swift` gains a `defaultAccentColor` fallback (Task 4 Step 6). Nothing else in the widget Swift changes.
- **Conventional commits** (`feat:`, `fix:`, `chore:`, `docs:`).
- **`build/` is git-ignored.** Never commit it. Rebuild after any `src/` edit.
- **Verification target:** iPhone 17 Pro simulator, id `A7D7BEB3-8F26-4FA6-9043-231ED673927D`. Simulator ≠ on-device visual sign-off.

## Build-tooling notes (apply to every native build step)

- A single Bash call caps at 10 minutes (`timeout: 600000`). Run prebuild/xcodebuild in the **foreground** with that timeout. If one hits the cap, **re-run it** — incremental continuation is fast. **A Bash timeout is not a build failure.** Only `** BUILD SUCCEEDED **` or real compiler errors are verdicts. Do not background a build and yield.
- Because the widget target is now plugin-generated, always regenerate with `CI=1 npx expo prebuild -p ios --clean` (a full regen), then run `xcodebuild` separately. Plain `expo prebuild` (no `--clean`) over an existing widget target fails with `withIosXcodeProjectBeta2BaseMod: Cannot read properties of undefined (reading 'removeFromProject')`.
- **`plutil -extract KEY FMT FILE` REWRITES THE FILE IN PLACE and is destructive.** To *read* a plist value you MUST use `plutil -extract KEY raw -o - FILE` — the `-o -` forces stdout. A clobbered generated plist is recovered with `expo prebuild -p ios --clean`.
- SourceKit / IDE diagnostics on the iOS-only files are **expected false positives** (ActivityAttributes unavailable on macOS, no ExpoModulesCore outside the pod context). Only the `xcodebuild` result counts.
- `watchman` is broken on this machine. After any `src/` restructure, `rm -rf packages/expo-island-kit/build && pnpm --filter expo-island-kit build`, then restart Metro with `-c`. `tsc` emits new files but does **not** delete orphaned ones, and a stale bundle presents as a runtime "X is not a function".
- To see a Live Activity in the Dynamic Island on the simulator, the owning app must be **backgrounded**: `xcrun simctl launch <bundleid>` to run/resume JS, then launch another app (e.g. `com.apple.mobilesafari`) to reveal the Dynamic Island.

---

## File Structure

**Created:**
| Path | Responsibility |
|---|---|
| `packages/expo-island-kit/plugin/widget/{NowPlaying,GenericProgress,Delivery,Timer}LiveActivity.swift` | The four shipped preset widgets (moved verbatim from the example) |
| `packages/expo-island-kit/plugin/widget/WidgetSupport.swift` | Shared widget helpers (moved; gains the default-accent fallback in Task 4) |
| `packages/expo-island-kit/plugin/widget/Info.plist` | Widget extension boilerplate (moved verbatim) |
| `packages/expo-island-kit/plugin/generateTarget.js` | **Pure** file-generation module — options in, files out. No Expo imports. The unit-tested core |
| `packages/expo-island-kit/plugin/__tests__/generateTarget.test.js` | Jest coverage for the above, written first |
| `packages/expo-island-kit/app.plugin.js` | The Expo config plugin — options validation, `withInfoPlist`, `withTargetsDir`, run-once guard |

**Modified:**
| Path | Change |
|---|---|
| `packages/expo-island-kit/package.json` | `dependencies` += `@bacons/apple-targets`; new `files` array; `jest.roots` += `plugin` |
| `packages/expo-island-kit/README.md` | Install + setup section rewritten for the plugin |
| `apps/example/app.json` | `plugins: ['expo-island-kit']`; drop manual `NSSupportsLiveActivities` |
| `apps/example/.gitignore` | Ignore the generated `targets/` |
| `docs/islandkit-full-documentation.md` | §5.2, §5.3, §11, §18 reconciled with what ships |
| `CLAUDE.md` | Status table, non-goals, repo layout, architecture diagram |
| `.superpowers/sdd/progress.md` | Phase 6 ledger section |

**Deleted from git:** `apps/example/targets/island-kit-widget/` (all 8 files + 4 symlinks) — now plugin-generated output.

**Note on `IslandKitWidgetBundle.swift` and `expo-target.config.js`:** these two files exist in the example today but are **not** copied into `plugin/widget/`. They are *generated* by `generateTarget.js` because they encode the `presets`, `deploymentTarget` and `bundleIdentifier` options.

---

### Task 1: De-risk spike — a config plugin generates and builds a widget target

Proves the riskiest mechanism (eval-time file write → `withTargetsDir` globs it → it builds) with a minimal, isolated, **throwaway** widget, before investing in the real plugin. Reverted at the end. **This task gates Tasks 3–6.**

**Files (all throwaway, reverted in Step 7):**
- Create: `apps/example/islandkit-spike.plugin.js`
- Modify (temporarily): `apps/example/app.json`

**Interfaces:**
- Produces: a recorded verdict — either "wrapping `withTargetsDir` works, and `config._internal.projectRoot` is/isn't available" (→ Task 4 Step 2 uses the confirmed path resolution) or "adopt the require-both fallback" (→ Task 4 Step 5's documented branch).

- [ ] **Step 0: Create the branch**

```bash
cd /Users/danemmanuel/Documents/islandkit
git checkout -b phase-6-config-plugin
git status --short   # expect only the untracked plan/spec docs, if any
```

- [ ] **Step 1: Write the throwaway spike plugin**

Note the config is a **function export**, matching the real `expo-target.config.js` shape — a spike that writes a plain object would prove the wrong thing.

Create `apps/example/islandkit-spike.plugin.js`:
```js
// THROWAWAY spike (Phase 6 Task 1) — proves a config plugin can write a widget target at
// eval-time and have @bacons/apple-targets build it. Reverted after the spike passes.
const { withInfoPlist } = require('@expo/config-plugins');
const withTargetsDir = require('@bacons/apple-targets/app.plugin');
const fs = require('fs');
const path = require('path');

const CONFIG = `/** @type {(config: { name: string }) => import('@bacons/apple-targets').Config} */
module.exports = (config) => ({
  type: 'widget',
  name: 'island-kit-spike',
  deploymentTarget: '16.2',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
});
`;

const SWIFT = `import ActivityKit
import WidgetKit
import SwiftUI

struct IKSpikeAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable { public var value: Int }
}

struct IKSpikeWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: IKSpikeAttributes.self) { context in
      Text("spike \\(context.state.value)")
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.center) { Text("\\(context.state.value)") }
      } compactLeading: { Text("s") } compactTrailing: { Text("\\(context.state.value)") } minimal: { Text("s") }
    }
  }
}

@main
struct IKSpikeBundle: WidgetBundle {
  var body: some Widget { IKSpikeWidget() }
}
`;

module.exports = function withSpike(config) {
  const projectRoot = (config._internal && config._internal.projectRoot) || process.cwd();
  console.log('[ik-spike] projectRoot resolved from _internal:', Boolean(config._internal && config._internal.projectRoot));
  console.log('[ik-spike] projectRoot =', projectRoot);
  const dir = path.join(projectRoot, 'targets', 'island-kit-spike');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'expo-target.config.js'), CONFIG);
  fs.writeFileSync(path.join(dir, 'IKSpike.swift'), SWIFT);
  config = withInfoPlist(config, (c) => {
    c.modResults.NSSupportsLiveActivities = true;
    return c;
  });
  return withTargetsDir(config, { root: './targets' });
};
```

- [ ] **Step 2: Point the example at the spike plugin (temporarily)**

In `apps/example/app.json`, change `"plugins": ["@bacons/apple-targets"]` to:
```json
    "plugins": ["./islandkit-spike.plugin.js"],
```

The existing `targets/island-kit-widget/` stays. `withTargetsDir` — applied once, by the spike plugin — globs **both** it and the generated `island-kit-spike`. That is itself part of what the spike proves.

- [ ] **Step 3: Regenerate and confirm the spike target was generated**

```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
CI=1 npx expo prebuild -p ios --clean 2>&1 | tail -30
echo "=== spike target generated? ==="
ls targets/island-kit-spike/ 2>/dev/null && echo "GENERATED"
echo "=== both targets in the pbxproj? ==="
grep -c "island-kit-spike" ios/example.xcodeproj/project.pbxproj
grep -c "island-kit-widget" ios/example.xcodeproj/project.pbxproj
```

Expected: `targets/island-kit-spike/` exists (written by the plugin at eval time), prebuild succeeds, and **both** target names appear in the pbxproj with a non-zero count.

Record from the `[ik-spike]` log lines whether `config._internal.projectRoot` was available. If it was **not** (the log prints `false`), note it — Task 4 Step 2 then uses `require('@expo/config').getProjectRoot(config)` instead.

- [ ] **Step 4: Build (app + both widget targets)**

```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
xcodebuild -workspace ios/example.xcworkspace -scheme example -configuration Debug \
  -destination "id=A7D7BEB3-8F26-4FA6-9043-231ED673927D" build 2>&1 | tee /tmp/ik-p6t1.log | tail -30
grep -q "\*\* BUILD SUCCEEDED \*\*" /tmp/ik-p6t1.log && echo "BUILD OK"
```

Expected: `** BUILD SUCCEEDED **`, proving the plugin-generated `island-kit-spike` widget extension compiles and links alongside the hand-scaffolded one.

- [ ] **Step 5: Confirm no forbidden entitlements were introduced**

```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
echo "=== entitlements files ==="; find ios -name "*.entitlements" -exec echo "--- {} ---" \; -exec cat {} \;
echo "=== forbidden key scan ==="
grep -rn "com.apple.security.application-groups\|aps-environment" ios --include="*.entitlements" --include="*.plist" && echo "FORBIDDEN FOUND" || echo "CLEAN"
```

Expected: `CLEAN`. The app entitlements should be empty (`{}`) or absent.

- [ ] **Step 6: Record the verdict**

If Steps 3–5 pass: the wrap-apple-targets mechanism is **proven** — proceed to Task 2, and Task 4 keeps its `withTargetsDir` wrap.

If the plugin cannot reliably write-before-glob, or `withTargetsDir` refuses to build a plugin-written target: **STOP and report to the controller.** Adopt the spec's §10 **"require both plugins"** fallback (consumer lists `['@bacons/apple-targets', 'expo-island-kit']`; our plugin only writes sources and does not wrap) before continuing. Record which mechanism shipped in the progress ledger.

- [ ] **Step 7: Revert the throwaway spike**

```bash
cd /Users/danemmanuel/Documents/islandkit
git checkout -- apps/example/app.json
rm -f apps/example/islandkit-spike.plugin.js
rm -rf apps/example/targets/island-kit-spike
git status --short   # expect clean — the spike left nothing tracked
```

No commit. Task 1's deliverable is the proven mechanism recorded in the report. (`apps/example/ios` is git-ignored prebuild output.)

---

### Task 2: Relocate the widget sources into the package + wire `package.json`

Moves the widget template into the package so it ships. The example keeps its own `targets/` for now and still builds via `@bacons/apple-targets`; it is converted in Task 5.

**Files:**
- Create: `packages/expo-island-kit/plugin/widget/` (6 files copied from the example)
- Modify: `packages/expo-island-kit/package.json`

**Interfaces:**
- Produces: the shipped widget template at `packages/expo-island-kit/plugin/widget/` containing exactly `NowPlayingLiveActivity.swift`, `GenericProgressLiveActivity.swift`, `DeliveryLiveActivity.swift`, `TimerLiveActivity.swift`, `WidgetSupport.swift`, `Info.plist`. Consumed by `generateTarget.js` (Task 3) via `path.join(packageRoot, 'plugin', 'widget')`.
- Produces: `package.json` with `@bacons/apple-targets` in `dependencies` and `jest.roots` covering `<rootDir>/plugin`, so Task 3's tests can run.

- [ ] **Step 1: Copy the widget template into the package**

`IslandKitWidgetBundle.swift` and `expo-target.config.js` are deliberately **excluded** — Task 3 generates them.

```bash
cd /Users/danemmanuel/Documents/islandkit
mkdir -p packages/expo-island-kit/plugin/widget
cp apps/example/targets/island-kit-widget/NowPlayingLiveActivity.swift \
   apps/example/targets/island-kit-widget/GenericProgressLiveActivity.swift \
   apps/example/targets/island-kit-widget/DeliveryLiveActivity.swift \
   apps/example/targets/island-kit-widget/TimerLiveActivity.swift \
   apps/example/targets/island-kit-widget/WidgetSupport.swift \
   apps/example/targets/island-kit-widget/Info.plist \
   packages/expo-island-kit/plugin/widget/
ls -1 packages/expo-island-kit/plugin/widget/
```

Expected: exactly 6 files listed — the four `*LiveActivity.swift`, `WidgetSupport.swift`, `Info.plist`.

- [ ] **Step 2: Verify the copies are byte-identical and contain no symlinks**

```bash
cd /Users/danemmanuel/Documents/islandkit
for f in NowPlayingLiveActivity.swift GenericProgressLiveActivity.swift DeliveryLiveActivity.swift TimerLiveActivity.swift WidgetSupport.swift Info.plist; do
  diff -q "apps/example/targets/island-kit-widget/$f" "packages/expo-island-kit/plugin/widget/$f" && echo "IDENTICAL: $f"
done
find packages/expo-island-kit/plugin -type l | grep . && echo "UNEXPECTED SYMLINK" || echo "no symlinks (correct)"
```

Expected: six `IDENTICAL:` lines and `no symlinks (correct)`.

- [ ] **Step 3: Confirm the podspec glob does not pick up the widget Swift**

The podspec lives at `packages/expo-island-kit/ios/ExpoIslandKit.podspec` with `s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"`, resolved relative to `ios/`. `plugin/` is a sibling of `ios/`, so it is outside the glob — the widget Swift must never compile into the app target.

```bash
cd /Users/danemmanuel/Documents/islandkit/packages/expo-island-kit
echo "=== podspec source_files ==="; grep -n "source_files" ios/ExpoIslandKit.podspec
echo "=== plugin/ is a sibling of ios/, not inside it: ==="; ls -d ios plugin
```

Expected: the glob is rooted at `ios/`, and `plugin` is a sibling directory. If a future podspec ever globs from the package root, the widget Swift would double-compile — flag it, do not proceed.

- [ ] **Step 4: Wire `package.json` — dependency, `files`, jest roots**

In `packages/expo-island-kit/package.json`:

1. Change `"dependencies": {}` to:
```json
  "dependencies": {
    "@bacons/apple-targets": "^5.0.0"
  },
```

2. Add a top-level `"files"` array (place it after `"types"`). The `!plugin/__tests__` negation keeps Task 3's tests out of the published tarball:
```json
  "files": [
    "app.plugin.js",
    "build",
    "ios",
    "plugin",
    "!plugin/__tests__",
    "expo-module.config.json"
  ],
```

3. Change the `"jest"` block's `roots` so Task 3's tests are discovered:
```json
  "jest": {
    "preset": "jest-expo",
    "roots": [
      "<rootDir>/src",
      "<rootDir>/plugin"
    ]
  },
```

- [ ] **Step 5: Install so the new dependency resolves**

```bash
cd /Users/danemmanuel/Documents/islandkit
pnpm install 2>&1 | tail -5
node -e "
const path = require('path');
require.resolve('@bacons/apple-targets/app.plugin', { paths: [path.join(process.cwd(), 'packages/expo-island-kit')] });
console.log('apple-targets resolvable from the package');
"
```

Expected: install succeeds and the require resolves.

- [ ] **Step 6: Confirm the existing test suite is still green**

`jest.roots` changed, so re-run the suite to prove nothing regressed. There are no `plugin/` tests yet — Jest finding zero there is fine as long as the 11 existing tests still run.

```bash
cd /Users/danemmanuel/Documents/islandkit
CI=1 pnpm --filter expo-island-kit test 2>&1 | tail -15
```

Expected: `Tests: 11 passed, 11 total`.

- [ ] **Step 7: Commit**

```bash
cd /Users/danemmanuel/Documents/islandkit
git add packages/expo-island-kit/plugin packages/expo-island-kit/package.json pnpm-lock.yaml
git commit -m "feat: ship widget SwiftUI in the package (plugin/widget) + apple-targets dependency"
```

---

### Task 3: `plugin/generateTarget.js` — the pure generator, tests first

The heart of the phase. A pure Node module with no Expo imports, so the whole options/copy/generate/wipe design is unit-testable without running a prebuild. **Tests are written before the implementation.**

**Files:**
- Test: `packages/expo-island-kit/plugin/__tests__/generateTarget.test.js`
- Create: `packages/expo-island-kit/plugin/generateTarget.js`

**Interfaces:**
- Consumes: `plugin/widget/*` (Task 2) and `ios/shared/*Attributes.swift` (unchanged).
- Produces:
  - `generateTarget({ packageRoot, projectRoot, options })` → `{ dest: string, files: string[] }`. `files` is the sorted list of basenames written. Throws `Error` on an unknown preset key.
  - `TARGET_NAME` — the string `'island-kit-widget'`.
  - `PRESETS` — the preset table, exported for tests.
  - Both consumed by `app.plugin.js` (Task 4) via `require('./plugin/generateTarget')`.

- [ ] **Step 1: Write the failing tests**

Create `packages/expo-island-kit/plugin/__tests__/generateTarget.test.js`:

```js
const fs = require('fs');
const os = require('os');
const path = require('path');

const { generateTarget, TARGET_NAME, PRESETS } = require('../generateTarget');

const PACKAGE_ROOT = path.join(__dirname, '..', '..');

function tmpProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ik-plugin-'));
}

function destOf(projectRoot) {
  return path.join(projectRoot, 'targets', TARGET_NAME);
}

describe('generateTarget', () => {
  let projectRoot;

  beforeEach(() => {
    projectRoot = tmpProject();
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it('writes every preset by default', () => {
    const { dest, files } = generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: {} });

    expect(dest).toBe(destOf(projectRoot));
    expect(files).toEqual(
      [
        'DeliveryAttributes.swift',
        'DeliveryLiveActivity.swift',
        'GenericProgressAttributes.swift',
        'GenericProgressLiveActivity.swift',
        'Info.plist',
        'IslandKitDefaults.swift',
        'IslandKitWidgetBundle.swift',
        'NowPlayingAttributes.swift',
        'NowPlayingLiveActivity.swift',
        'TimerAttributes.swift',
        'TimerLiveActivity.swift',
        'WidgetSupport.swift',
        'expo-target.config.js',
      ].sort()
    );
  });

  it('generates a widget bundle listing every selected widget', () => {
    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: {} });
    const bundle = fs.readFileSync(path.join(destOf(projectRoot), 'IslandKitWidgetBundle.swift'), 'utf8');

    expect(bundle).toContain('@main');
    expect(bundle).toContain('struct IslandKitWidgetBundle: WidgetBundle');
    for (const preset of Object.values(PRESETS)) {
      expect(bundle).toContain(`${preset.widgetType}()`);
    }
  });

  it('narrows the file set and the bundle when presets are selected', () => {
    const { files } = generateTarget({
      packageRoot: PACKAGE_ROOT,
      projectRoot,
      options: { presets: ['timer'] },
    });

    expect(files).toContain('TimerLiveActivity.swift');
    expect(files).toContain('TimerAttributes.swift');
    expect(files).not.toContain('NowPlayingLiveActivity.swift');
    expect(files).not.toContain('NowPlayingAttributes.swift');
    expect(files).not.toContain('DeliveryLiveActivity.swift');
    expect(files).not.toContain('GenericProgressLiveActivity.swift');

    const bundle = fs.readFileSync(path.join(destOf(projectRoot), 'IslandKitWidgetBundle.swift'), 'utf8');
    expect(bundle).toContain('TimerLiveActivity()');
    expect(bundle).not.toContain('NowPlayingLiveActivity()');
  });

  it('removes files left over from a previous wider selection', () => {
    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: {} });
    expect(fs.existsSync(path.join(destOf(projectRoot), 'NowPlayingLiveActivity.swift'))).toBe(true);

    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: { presets: ['timer'] } });
    expect(fs.existsSync(path.join(destOf(projectRoot), 'NowPlayingLiveActivity.swift'))).toBe(false);
  });

  // REGRESSION: fs.copyFileSync follows a symlink at the destination and writes THROUGH it.
  // The example app's targets/*Attributes.swift are symlinks into ios/shared/, so copying
  // onto them would overwrite the canonical single source of truth.
  it('replaces a symlink at the destination instead of writing through it', () => {
    const dest = destOf(projectRoot);
    fs.mkdirSync(dest, { recursive: true });

    const canonical = path.join(packageSharedDir(), 'TimerAttributes.swift');
    const canonicalBefore = fs.readFileSync(canonical, 'utf8');

    const decoy = path.join(projectRoot, 'decoy.swift');
    fs.writeFileSync(decoy, '// decoy — must not be overwritten\n');
    fs.symlinkSync(decoy, path.join(dest, 'TimerAttributes.swift'));

    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: { presets: ['timer'] } });

    const written = path.join(dest, 'TimerAttributes.swift');
    expect(fs.lstatSync(written).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(written, 'utf8')).toBe(canonicalBefore);
    expect(fs.readFileSync(decoy, 'utf8')).toBe('// decoy — must not be overwritten\n');
    expect(fs.readFileSync(canonical, 'utf8')).toBe(canonicalBefore);
  });

  it('is idempotent', () => {
    const first = generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: {} });
    const second = generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: {} });
    expect(second.files).toEqual(first.files);
  });

  it('writes the deployment target into the generated config, defaulting to 16.2', () => {
    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: {} });
    expect(fs.readFileSync(path.join(destOf(projectRoot), 'expo-target.config.js'), 'utf8')).toContain(
      "deploymentTarget: '16.2'"
    );

    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: { deploymentTarget: '17.0' } });
    expect(fs.readFileSync(path.join(destOf(projectRoot), 'expo-target.config.js'), 'utf8')).toContain(
      "deploymentTarget: '17.0'"
    );
  });

  it('omits bundleIdentifier unless it is set, preserving the apple-targets default', () => {
    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: {} });
    expect(fs.readFileSync(path.join(destOf(projectRoot), 'expo-target.config.js'), 'utf8')).not.toContain(
      'bundleIdentifier'
    );

    generateTarget({
      packageRoot: PACKAGE_ROOT,
      projectRoot,
      options: { bundleIdentifier: 'com.example.app.IslandKitExtension' },
    });
    expect(fs.readFileSync(path.join(destOf(projectRoot), 'expo-target.config.js'), 'utf8')).toContain(
      "bundleIdentifier: 'com.example.app.IslandKitExtension'"
    );
  });

  it('carries defaultAccentColor into the generated defaults, nil when unset', () => {
    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: {} });
    expect(fs.readFileSync(path.join(destOf(projectRoot), 'IslandKitDefaults.swift'), 'utf8')).toContain(
      'let islandKitDefaultAccentHex: String? = nil'
    );

    generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: { defaultAccentColor: '#FA2D48' } });
    expect(fs.readFileSync(path.join(destOf(projectRoot), 'IslandKitDefaults.swift'), 'utf8')).toContain(
      'let islandKitDefaultAccentHex: String? = "#FA2D48"'
    );
  });

  it('throws on an unknown preset key, naming the valid ones', () => {
    expect(() =>
      generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: { presets: ['nowPlaying', 'nope'] } })
    ).toThrow(/nope/);
    expect(() =>
      generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: { presets: ['nope'] } })
    ).toThrow(/nowPlaying/);
  });

  it('throws on an empty preset list', () => {
    expect(() => generateTarget({ packageRoot: PACKAGE_ROOT, projectRoot, options: { presets: [] } })).toThrow(
      /at least one/i
    );
  });
});

function packageSharedDir() {
  return path.join(PACKAGE_ROOT, 'ios', 'shared');
}
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/danemmanuel/Documents/islandkit
CI=1 pnpm --filter expo-island-kit test 2>&1 | tail -25
```

Expected: FAIL — `Cannot find module '../generateTarget'`. The 11 pre-existing tests still pass.

- [ ] **Step 3: Write the generator**

Create `packages/expo-island-kit/plugin/generateTarget.js`:

```js
// Pure file generation for the IslandKit widget extension target.
//
// No Expo imports — this module is `{ packageRoot, projectRoot, options }` in, files out,
// so the whole copy/generate/wipe design is unit-testable without running a prebuild.
// app.plugin.js is the thin Expo-facing wrapper around it.
const fs = require('fs');
const path = require('path');

const TARGET_NAME = 'island-kit-widget';
const DEFAULT_DEPLOYMENT_TARGET = '16.2';

// One row per preset. Adding a fifth preset is a one-line change here — the same
// abstraction bar the Phase-3 registry holds on the native side.
const PRESETS = {
  nowPlaying: {
    widgetFile: 'NowPlayingLiveActivity.swift',
    attributesFile: 'NowPlayingAttributes.swift',
    widgetType: 'NowPlayingLiveActivity',
  },
  genericProgress: {
    widgetFile: 'GenericProgressLiveActivity.swift',
    attributesFile: 'GenericProgressAttributes.swift',
    widgetType: 'GenericProgressLiveActivity',
  },
  delivery: {
    widgetFile: 'DeliveryLiveActivity.swift',
    attributesFile: 'DeliveryAttributes.swift',
    widgetType: 'DeliveryLiveActivity',
  },
  timer: {
    widgetFile: 'TimerLiveActivity.swift',
    attributesFile: 'TimerAttributes.swift',
    widgetType: 'TimerLiveActivity',
  },
};

// Files copied verbatim for every configuration, regardless of preset selection.
const ALWAYS_COPIED = ['WidgetSupport.swift', 'Info.plist'];

function resolvePresetKeys(presets) {
  if (presets === undefined) return Object.keys(PRESETS);
  if (!Array.isArray(presets)) {
    throw new Error(`expo-island-kit: "presets" must be an array, received ${typeof presets}.`);
  }
  if (presets.length === 0) {
    throw new Error('expo-island-kit: "presets" must include at least one preset.');
  }
  const valid = Object.keys(PRESETS);
  const unknown = presets.filter((key) => !valid.includes(key));
  if (unknown.length > 0) {
    throw new Error(
      `expo-island-kit: unknown preset(s) ${unknown.map((k) => `"${k}"`).join(', ')}. ` +
        `Valid presets are: ${valid.join(', ')}.`
    );
  }
  // Preserve the declaration order in PRESETS so generated output is deterministic
  // regardless of the order the consumer listed them in.
  return valid.filter((key) => presets.includes(key));
}

function renderTargetConfig({ deploymentTarget, bundleIdentifier }) {
  // bundleIdentifier is omitted when unset so @bacons/apple-targets keeps its own default —
  // changing it would force re-provisioning of the widget extension.
  const bundleLine = bundleIdentifier ? `\n  bundleIdentifier: '${bundleIdentifier}',` : '';
  return `// GENERATED by expo-island-kit's config plugin. Do not edit — this file is
// overwritten on every \`expo prebuild\`.
/** @type {(config: { name: string }) => import('@bacons/apple-targets').Config} */
module.exports = (config) => ({
  type: 'widget',
  name: '${TARGET_NAME}',${bundleLine}
  deploymentTarget: '${deploymentTarget}',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
});
`;
}

function renderWidgetBundle(presetKeys) {
  const widgets = presetKeys.map((key) => `    ${PRESETS[key].widgetType}()`).join('\n');
  return `// GENERATED by expo-island-kit's config plugin. Do not edit — this file is
// overwritten on every \`expo prebuild\`. Which widgets appear here is controlled by
// the plugin's \`presets\` option.
import SwiftUI
import WidgetKit

@main
struct IslandKitWidgetBundle: WidgetBundle {
  var body: some Widget {
${widgets}
  }
}
`;
}

function renderDefaults(defaultAccentColor) {
  const value = defaultAccentColor ? `"${defaultAccentColor}"` : 'nil';
  return `// GENERATED by expo-island-kit's config plugin. Do not edit — this file is
// overwritten on every \`expo prebuild\`.
//
// Fallback accent used by presetAccentColor(_:) when a preset's accentColor prop is
// omitted. nil means "no default" — the system accent colour is used, which is the
// behaviour when the plugin's defaultAccentColor option is unset.
import Foundation

let islandKitDefaultAccentHex: String? = ${value}
`;
}

// Copy a single file, unlinking the destination first.
//
// This matters: fs.copyFileSync FOLLOWS a symlink at the destination and writes THROUGH
// it. The example app's targets/*Attributes.swift were symlinks into ios/shared/, so a
// plain copy could overwrite the canonical single source of truth. Always write a fresh
// regular file.
function copyFile(src, dest) {
  fs.rmSync(dest, { force: true });
  fs.copyFileSync(src, dest);
}

/**
 * Generate the widget extension target into <projectRoot>/targets/island-kit-widget/.
 *
 * @param {object} params
 * @param {string} params.packageRoot  Root of the expo-island-kit package.
 * @param {string} params.projectRoot  Root of the consumer's Expo project.
 * @param {object} [params.options]    Plugin options (presets, deploymentTarget,
 *                                     bundleIdentifier, defaultAccentColor).
 * @returns {{ dest: string, files: string[] }} Destination dir and sorted basenames written.
 */
function generateTarget({ packageRoot, projectRoot, options = {} }) {
  const presetKeys = resolvePresetKeys(options.presets);

  const widgetSrc = path.join(packageRoot, 'plugin', 'widget');
  const attributesSrc = path.join(packageRoot, 'ios', 'shared');
  const dest = path.join(projectRoot, 'targets', TARGET_NAME);

  // Wipe before writing. Two reasons, both correctness rather than tidiness:
  //  1. Any stale symlink at the destination is removed rather than written through.
  //  2. Narrowing `presets` must actually remove the widgets that are no longer selected,
  //     otherwise they keep compiling and the option silently does nothing.
  //     `expo prebuild --clean` does not touch targets/.
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  const files = [];

  for (const file of ALWAYS_COPIED) {
    copyFile(path.join(widgetSrc, file), path.join(dest, file));
    files.push(file);
  }

  for (const key of presetKeys) {
    const { widgetFile, attributesFile } = PRESETS[key];
    copyFile(path.join(widgetSrc, widgetFile), path.join(dest, widgetFile));
    copyFile(path.join(attributesSrc, attributesFile), path.join(dest, attributesFile));
    files.push(widgetFile, attributesFile);
  }

  const generated = {
    'expo-target.config.js': renderTargetConfig({
      deploymentTarget: options.deploymentTarget || DEFAULT_DEPLOYMENT_TARGET,
      bundleIdentifier: options.bundleIdentifier,
    }),
    'IslandKitWidgetBundle.swift': renderWidgetBundle(presetKeys),
    'IslandKitDefaults.swift': renderDefaults(options.defaultAccentColor),
  };

  for (const [file, contents] of Object.entries(generated)) {
    fs.writeFileSync(path.join(dest, file), contents);
    files.push(file);
  }

  return { dest, files: files.sort() };
}

module.exports = { generateTarget, TARGET_NAME, PRESETS, DEFAULT_DEPLOYMENT_TARGET };
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd /Users/danemmanuel/Documents/islandkit
CI=1 pnpm --filter expo-island-kit test 2>&1 | tail -25
```

Expected: all tests pass — the 11 pre-existing plus the 11 new generator tests, `Tests: 22 passed, 22 total`.

If the symlink regression test fails, the `copyFile` unlink is missing or the destination wipe was skipped. Do not "fix" the test — it is the point of the task.

- [ ] **Step 5: Lint the new file**

```bash
cd /Users/danemmanuel/Documents/islandkit
pnpm --filter expo-island-kit lint 2>&1 | tail -20
```

Expected: no errors. The package's `lint` script scopes to `src/`, so this confirms nothing in `src/` regressed; the new JS lives outside that scope by design.

- [ ] **Step 6: Commit**

```bash
cd /Users/danemmanuel/Documents/islandkit
git add packages/expo-island-kit/plugin/generateTarget.js packages/expo-island-kit/plugin/__tests__
git commit -m "feat: add the pure widget-target generator with symlink-safe copying"
```

---

### Task 4: `app.plugin.js` + the default-accent fallback

The thin Expo-facing wrapper: validate options, generate, set `NSSupportsLiveActivities`, apply `withTargetsDir`.

**Files:**
- Create: `packages/expo-island-kit/app.plugin.js`
- Modify: `packages/expo-island-kit/plugin/widget/WidgetSupport.swift`

**Interfaces:**
- Consumes: `generateTarget({ packageRoot, projectRoot, options })` and `TARGET_NAME` from `./plugin/generateTarget` (Task 3).
- Produces: the package's default-exported config plugin, resolved by Expo from `app.plugin.js` at the package root when a consumer writes `plugins: ['expo-island-kit']`. Consumed by Task 5's example conversion and Task 6's scratch app.

- [ ] **Step 1: Write the plugin**

Create `packages/expo-island-kit/app.plugin.js`:

```js
// IslandKit config plugin.
//
// Generates the widget extension target from the sources shipped in this package, so
// consumers write zero Swift. Applied once via createRunOncePlugin.
//
// Ordering is load-bearing: @bacons/apple-targets' withTargetsDir globs targets/ at
// plugin-EVAL time, so the target must already be on disk before we apply it.
const { withInfoPlist, createRunOncePlugin } = require('@expo/config-plugins');
const withTargetsDir = require('@bacons/apple-targets/app.plugin');

const pkg = require('./package.json');
const { generateTarget } = require('./plugin/generateTarget');

const KNOWN_OPTIONS = ['presets', 'deploymentTarget', 'bundleIdentifier', 'defaultAccentColor'];

// Options documented in the product docs that this version does not implement, with the
// reason. Surfaced as warnings rather than errors so a consumer copying an older snippet
// gets a build, not a wall.
const UNSUPPORTED_OPTIONS = {
  appleTeamId: 'set `ios.appleTeamId` in your app config instead — the widget target signs from it',
  groupIdentifier: 'App Groups are not supported yet (requires a paid Apple Developer account)',
  enablePushNotifications: 'push updates are not supported yet (requires a paid Apple Developer account)',
};

function warnUnsupportedOptions(options) {
  for (const key of Object.keys(options)) {
    if (KNOWN_OPTIONS.includes(key)) continue;
    const reason = UNSUPPORTED_OPTIONS[key];
    if (reason) {
      console.warn(`expo-island-kit: the "${key}" option is not supported — ${reason}.`);
    } else {
      console.warn(
        `expo-island-kit: unknown option "${key}" ignored. Supported options: ${KNOWN_OPTIONS.join(', ')}.`
      );
    }
  }
}

// withTargetsDir is applied by THIS plugin. A consumer who also lists @bacons/apple-targets
// gets it applied twice, which fails with "target ... already exists"
// (withIosXcodeProjectBeta2BaseMod: Cannot read properties of undefined). Warn clearly —
// but don't throw, so an unusual setup keeps its escape hatch.
function warnOnDoubleApplication(config) {
  const plugins = config.plugins || [];
  const listed = plugins.some((entry) => {
    const name = Array.isArray(entry) ? entry[0] : entry;
    return typeof name === 'string' && name.includes('@bacons/apple-targets');
  });
  if (listed) {
    console.warn(
      'expo-island-kit: remove "@bacons/apple-targets" from your plugins array — expo-island-kit ' +
        'applies it for you, and listing both builds every target twice. Your own targets/* are ' +
        'still picked up.'
    );
  }
}

const withIslandKit = (config, options = {}) => {
  warnUnsupportedOptions(options);
  warnOnDoubleApplication(config);

  // projectRoot is available on _internal at plugin-eval during prebuild; fall back
  // defensively for other config-resolution paths (e.g. `expo config`).
  const projectRoot = (config._internal && config._internal.projectRoot) || process.cwd();

  // MUST run before withTargetsDir globs targets/. Option validation happens inside
  // generateTarget and throws with the valid preset list.
  generateTarget({ packageRoot: __dirname, projectRoot, options });

  config = withInfoPlist(config, (c) => {
    c.modResults.NSSupportsLiveActivities = true;
    return c;
  });

  return withTargetsDir(config, { root: './targets' });
};

module.exports = createRunOncePlugin(withIslandKit, pkg.name, pkg.version);
```

**Conditional branch — apply only if Task 1 found it necessary:**
- If the Task-1 spike logged `projectRoot resolved from _internal: false`, replace the `projectRoot` line with:
  ```js
  const { getProjectRoot } = require('@expo/config');
  const projectRoot = (config._internal && config._internal.projectRoot) || getProjectRoot(config) || process.cwd();
  ```
- If Task 1 adopted the **require-both fallback**, delete the `withTargetsDir` require and the final `return withTargetsDir(...)`, returning `config` after `withInfoPlist` instead; delete `warnOnDoubleApplication` and its call; and note in the commit message that consumers must also list `@bacons/apple-targets`.

- [ ] **Step 2: Sanity-check the plugin loads and the sources resolve**

```bash
cd /Users/danemmanuel/Documents/islandkit
node -e "
const p = require('./packages/expo-island-kit/app.plugin.js');
console.log(typeof p === 'function' ? 'plugin exports a function' : 'BAD: not a function');
"
node -e "
const fs = require('fs');
const w = 'packages/expo-island-kit/plugin/widget';
console.log('widget template files:', fs.readdirSync(w).sort().join(', '));
const a = fs.readdirSync('packages/expo-island-kit/ios/shared').filter((f) => f.endsWith('Attributes.swift'));
console.log('attributes:', a.sort().join(', '));
"
```

Expected: `plugin exports a function`; 6 widget template files; 4 Attributes files.

- [ ] **Step 3: Prove the plugin generates a target into a throwaway project root**

This exercises the real plugin end to end without a prebuild — the generator through the plugin's own path resolution.

```bash
cd /Users/danemmanuel/Documents/islandkit
node -e "
const os = require('os'), fs = require('fs'), path = require('path');
const { generateTarget } = require('./packages/expo-island-kit/plugin/generateTarget');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ik-smoke-'));
const { dest, files } = generateTarget({
  packageRoot: path.resolve('packages/expo-island-kit'),
  projectRoot: root,
  options: { defaultAccentColor: '#FA2D48' },
});
console.log('generated', files.length, 'files into', dest);
console.log(files.join('\n'));
console.log('--- IslandKitDefaults.swift ---');
console.log(fs.readFileSync(path.join(dest, 'IslandKitDefaults.swift'), 'utf8'));
fs.rmSync(root, { recursive: true, force: true });
"
```

Expected: 13 files, and `let islandKitDefaultAccentHex: String? = "#FA2D48"` in the printed defaults.

- [ ] **Step 4: Verify option validation fails loudly**

```bash
cd /Users/danemmanuel/Documents/islandkit
node -e "
const os = require('os'), fs = require('fs'), path = require('path');
const { generateTarget } = require('./packages/expo-island-kit/plugin/generateTarget');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ik-bad-'));
try {
  generateTarget({ packageRoot: path.resolve('packages/expo-island-kit'), projectRoot: root, options: { presets: ['nope'] } });
  console.log('BAD: no throw');
} catch (e) {
  console.log('threw as expected:', e.message);
}
fs.rmSync(root, { recursive: true, force: true });
"
```

Expected: a message naming `"nope"` and listing `nowPlaying, genericProgress, delivery, timer`.

- [ ] **Step 5: Commit the plugin**

```bash
cd /Users/danemmanuel/Documents/islandkit
git add packages/expo-island-kit/app.plugin.js
git commit -m "feat: add app.plugin.js generating the island-kit-widget target"
```

- [ ] **Step 6: Wire `defaultAccentColor` into the widget layer**

In `packages/expo-island-kit/plugin/widget/WidgetSupport.swift`, replace the body of `presetAccentColor(_:)`. Find:

```swift
func presetAccentColor(_ hex: String?) -> Color {
  Color(hex: hex) ?? .accentColor
}
```

Replace with:

```swift
// Falls back through: the preset's own accentColor prop -> the plugin's
// defaultAccentColor option (generated into IslandKitDefaults.swift, nil when unset)
// -> the system accent.
func presetAccentColor(_ hex: String?) -> Color {
  Color(hex: hex) ?? Color(hex: islandKitDefaultAccentHex) ?? .accentColor
}
```

Leave the surrounding explanatory comment about the SwiftUI `View.accentColor` name collision exactly as it is — that hazard has not gone away.

- [ ] **Step 7: Confirm the change is behaviour-preserving by default**

`islandKitDefaultAccentHex` is `nil` unless `defaultAccentColor` is set, and `Color(hex: nil)` already returns `nil` (the initializer's first `guard let hex else { return nil }`). So the default path is byte-identical to today.

```bash
cd /Users/danemmanuel/Documents/islandkit
grep -n "init?(hex: String?)" -A 2 packages/expo-island-kit/plugin/widget/WidgetSupport.swift
grep -n "presetAccentColor" -A 3 packages/expo-island-kit/plugin/widget/WidgetSupport.swift
```

Expected: `Color(hex:)` still guards `nil` and returns `nil`; `presetAccentColor` shows the three-step fallback. Compilation is verified in Task 5's build.

- [ ] **Step 8: Commit the widget change**

```bash
cd /Users/danemmanuel/Documents/islandkit
git add packages/expo-island-kit/plugin/widget/WidgetSupport.swift
git commit -m "feat: honour the plugin's defaultAccentColor in presetAccentColor"
```

---

### Task 5: Convert the example to the plugin + verify all four presets

Dogfoods the plugin: the example deletes its hand-scaffolded widget and relies entirely on `expo-island-kit`, exactly like a real consumer.

**Files:**
- Modify: `apps/example/app.json`, `apps/example/.gitignore`
- Delete from git: `apps/example/targets/island-kit-widget/`

**Interfaces:**
- Consumes: the published plugin from Task 4 (via the workspace symlink `apps/example/node_modules/expo-island-kit`).
- Produces: evidence at `docs/superpowers/evidence/phase6-*` consumed by Task 7's DoD write-up.

- [ ] **Step 1: Switch the example to the plugin**

In `apps/example/app.json`: set `"plugins": ["expo-island-kit"]`, and remove the manual `infoPlist.NSSupportsLiveActivities` — the plugin sets it now. The `ios` block becomes exactly:

```json
    "ios": {
      "bundleIdentifier": "io.github.Justdan111.islandkitexample",
      "appleTeamId": "A66QV2FW3V",
      "supportsTablet": false
    },
```

Keep `appleTeamId` — the widget target signs from it, and dropping it breaks device builds.

- [ ] **Step 2: Delete the hand-scaffolded widget and git-ignore generated targets**

```bash
cd /Users/danemmanuel/Documents/islandkit
git rm -r apps/example/targets/island-kit-widget
printf '\n# IslandKit generates the widget target from the config plugin\n/targets/\n' >> apps/example/.gitignore
git add apps/example/.gitignore apps/example/app.json
git status --short
```

Expected: the 12 widget files (8 regular + 4 symlinks) staged as deletions.

- [ ] **Step 3: Rebuild the package and regenerate from the plugin**

```bash
cd /Users/danemmanuel/Documents/islandkit
rm -rf packages/expo-island-kit/build
pnpm --filter expo-island-kit build 2>&1 | tail -5
cd apps/example
rm -rf targets
CI=1 npx expo prebuild -p ios --clean 2>&1 | tail -30
echo "=== plugin generated the widget target? ==="
ls -1 targets/island-kit-widget/ | sort
```

`rm -rf targets` first, so this proves generation from nothing — exactly what a fresh clone gets.

Expected: `targets/island-kit-widget/` contains 13 files — 4 `*LiveActivity.swift`, 4 `*Attributes.swift`, `WidgetSupport.swift`, `Info.plist`, `IslandKitWidgetBundle.swift`, `IslandKitDefaults.swift`, `expo-target.config.js`.

- [ ] **Step 4: Confirm the generated files are real files, and the plist key is set**

```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
echo "=== no symlinks in the generated target ==="
find targets/island-kit-widget -type l | grep . && echo "UNEXPECTED SYMLINK" || echo "all regular files (correct)"
echo "=== canonical Attributes untouched ==="
cd /Users/danemmanuel/Documents/islandkit
git status --short packages/expo-island-kit/ios/shared/   # expect EMPTY
echo "=== NSSupportsLiveActivities set by the plugin ==="
plutil -extract NSSupportsLiveActivities raw -o - apps/example/ios/example/Info.plist
echo "=== widget target in the pbxproj ==="
grep -c "island-kit-widget" apps/example/ios/example.xcodeproj/project.pbxproj
```

Expected: `all regular files (correct)`; **empty** git status for `ios/shared/` (the symlink write-through bug would show as modified files here); `true`; a non-zero pbxproj count.

Remember: `plutil -extract` without `-o -` **rewrites the file in place**. The `-o -` above is mandatory.

- [ ] **Step 5: Build (app + plugin-generated widget)**

```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
xcodebuild -workspace ios/example.xcworkspace -scheme example -configuration Debug \
  -destination "id=A7D7BEB3-8F26-4FA6-9043-231ED673927D" build 2>&1 | tee /tmp/ik-p6t5.log | tail -30
grep -q "\*\* BUILD SUCCEEDED \*\*" /tmp/ik-p6t5.log && echo "BUILD OK"
```

Expected: `** BUILD SUCCEEDED **` — the plugin-generated target compiles all four preset widgets plus the generated bundle and defaults.

- [ ] **Step 6: Verify no widget Swift remains in the example's tracked source**

```bash
cd /Users/danemmanuel/Documents/islandkit
test -z "$(git ls-files apps/example/targets/)" && echo "CLEAN: no tracked widget Swift in the example" || git ls-files apps/example/targets/
git check-ignore apps/example/targets/island-kit-widget >/dev/null && echo "targets/ git-ignored ✓"
echo "=== forbidden entitlements scan ==="
grep -rn "com.apple.security.application-groups\|aps-environment" apps/example/ios --include="*.entitlements" --include="*.plist" && echo "FORBIDDEN FOUND" || echo "CLEAN"
```

Expected: `CLEAN: no tracked widget Swift in the example`, `targets/ git-ignored ✓`, `CLEAN`.

- [ ] **Step 7: Runtime — all four presets on the simulator**

```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
xcrun simctl boot A7D7BEB3-8F26-4FA6-9043-231ED673927D 2>/dev/null; open -a Simulator
CI=1 npx expo run:ios --device A7D7BEB3-8F26-4FA6-9043-231ED673927D 2>&1 | tail -20
```

Then drive each preset's Start via the committed four-section harness in `apps/example/App.tsx`. Remember the Dynamic Island only shows a Live Activity when the owning app is **backgrounded**:

```bash
xcrun simctl launch A7D7BEB3-8F26-4FA6-9043-231ED673927D io.github.Justdan111.islandkitexample
# tap Start for a preset, then reveal the Dynamic Island:
xcrun simctl launch A7D7BEB3-8F26-4FA6-9043-231ED673927D com.apple.mobilesafari
xcrun simctl io A7D7BEB3-8F26-4FA6-9043-231ED673927D screenshot \
  /Users/danemmanuel/Documents/islandkit/docs/superpowers/evidence/phase6-01-plugin-generated.png
```

Capture at least: `Supported: yes` in the app, and one preset rendering in the Dynamic Island from the **plugin-generated** widget. Screenshot each preset you can to `docs/superpowers/evidence/phase6-0N-<preset>.png`.

If a temporary self-driving harness was used, restore the committed `App.tsx` with `git checkout -- apps/example/App.tsx` before committing.

- [ ] **Step 8: Commit**

```bash
cd /Users/danemmanuel/Documents/islandkit
git status --short   # confirm App.tsx is NOT modified
git add apps/example/app.json apps/example/.gitignore docs/superpowers/evidence
git commit -m "feat: example consumes the config plugin (zero widget Swift)"
```

---

### Task 6: Packaging + real-consumer smoke test

The only layer that exercises a real `node_modules` resolution instead of the monorepo workspace symlink — and the phase's whole deliverable is consumer setup.

**Files:** none committed except the evidence note in Task 7. This task produces a verdict.

**Interfaces:**
- Consumes: the `files` array from Task 2 and the plugin from Task 4.
- Produces: a recorded pass/fail for "a packed tarball sets up a fresh Expo app", written into the Task 7 evidence README.

- [ ] **Step 1: Pack the package and assert the tarball contents**

```bash
cd /Users/danemmanuel/Documents/islandkit/packages/expo-island-kit
rm -rf build && pnpm build 2>&1 | tail -3
TARBALL=$(npm pack --silent --pack-destination /tmp)
echo "packed: /tmp/$TARBALL"
tar -tzf "/tmp/$TARBALL" | sort > /tmp/ik-tarball.txt
echo "=== must be present ==="
for want in package/app.plugin.js package/plugin/generateTarget.js package/plugin/widget/NowPlayingLiveActivity.swift package/plugin/widget/WidgetSupport.swift package/plugin/widget/Info.plist package/ios/shared/TimerAttributes.swift package/ios/ExpoIslandKit.podspec package/build/index.js package/expo-module.config.json; do
  grep -qx "$want" /tmp/ik-tarball.txt && echo "  ok  $want" || echo "  MISSING  $want"
done
echo "=== must be absent ==="
grep -q "package/plugin/__tests__" /tmp/ik-tarball.txt && echo "  LEAKED tests" || echo "  ok  no tests"
grep -q "package/src/" /tmp/ik-tarball.txt && echo "  note: src/ included (acceptable, not required)" || echo "  ok  no src"
```

Expected: every `must be present` line reads `ok`, and `no tests`.

If `plugin/__tests__` leaked, the `!plugin/__tests__` negation in `files` is not taking effect — move the tests to a path outside `plugin/` rather than shipping them.

- [ ] **Step 2: Create a scratch Expo app outside the monorepo**

Outside the monorepo, so nothing resolves through the workspace. `npm` rather than `pnpm`, to prove the plugin does not depend on the hoisted layout.

```bash
rm -rf /tmp/ik-consumer && mkdir -p /tmp/ik-consumer
cd /tmp/ik-consumer
CI=1 npx create-expo-app@latest consumer --template blank --no-install 2>&1 | tail -10
cd consumer
npm install 2>&1 | tail -5
```

Expected: a scratch app at `/tmp/ik-consumer/consumer`.

If `create-expo-app` scaffolds a newer SDK than 55, pin it before installing: set `"expo": "~55.0.28"` plus the SDK-55 `react-native`/`react` versions in its `package.json` (mirror `apps/example/package.json`), then re-run `npm install`. **Xcode 26.0.1 cannot build SDK 56+.**

- [ ] **Step 3: Install the tarball and configure the plugin**

```bash
cd /tmp/ik-consumer/consumer
TARBALL=$(ls /tmp/expo-island-kit-*.tgz | tail -1)
npm install "$TARBALL" 2>&1 | tail -5
node -e "console.log('resolved:', require.resolve('expo-island-kit/app.plugin.js'))"
```

Then edit `/tmp/ik-consumer/consumer/app.json` so the `expo` block contains a unique bundle id and the plugin, exercising two options at once:

```json
    "ios": {
      "bundleIdentifier": "io.github.Justdan111.ikconsumerscratch",
      "supportsTablet": false
    },
    "plugins": [
      [
        "expo-island-kit",
        { "presets": ["timer", "nowPlaying"], "defaultAccentColor": "#FA2D48" }
      ]
    ]
```

- [ ] **Step 4: Prebuild and confirm the plugin generated a narrowed target**

```bash
cd /tmp/ik-consumer/consumer
CI=1 npx expo prebuild -p ios --clean 2>&1 | tail -30
echo "=== generated target ==="; ls -1 targets/island-kit-widget/ | sort
echo "=== bundle lists only the two selected widgets ==="; cat targets/island-kit-widget/IslandKitWidgetBundle.swift
echo "=== defaults carry the accent ==="; grep islandKitDefaultAccentHex targets/island-kit-widget/IslandKitDefaults.swift
```

Expected: 9 files (2 `*LiveActivity.swift`, 2 `*Attributes.swift`, `WidgetSupport.swift`, `Info.plist`, `IslandKitWidgetBundle.swift`, `IslandKitDefaults.swift`, `expo-target.config.js`); the bundle lists `NowPlayingLiveActivity()` and `TimerLiveActivity()` **only**; the accent is `"#FA2D48"`.

This is also the live proof that `presets` narrowing works — Delivery and GenericProgress must be absent.

- [ ] **Step 5: Build the scratch app**

```bash
cd /tmp/ik-consumer/consumer
xcodebuild -workspace ios/consumer.xcworkspace -scheme consumer -configuration Debug \
  -destination "id=A7D7BEB3-8F26-4FA6-9043-231ED673927D" build 2>&1 | tee /tmp/ik-p6t6.log | tail -30
grep -q "\*\* BUILD SUCCEEDED \*\*" /tmp/ik-p6t6.log && echo "CONSUMER BUILD OK"
```

Expected: `** BUILD SUCCEEDED **`. The workspace/scheme name follows the app slug — adjust `consumer` if `create-expo-app` chose differently (check `ls ios/*.xcworkspace`).

Device signing is **not** required: a simulator build does not need a provisioning profile, and the scratch app deliberately sets no `appleTeamId`. That is also a useful negative check — the plugin must not require a team.

- [ ] **Step 6: Verify the double-listing warning fires**

```bash
cd /tmp/ik-consumer/consumer
node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('app.json', 'utf8'));
cfg.expo.plugins = ['@bacons/apple-targets', ...cfg.expo.plugins];
fs.writeFileSync('app.json', JSON.stringify(cfg, null, 2));
"
CI=1 npx expo config --type prebuild 2>&1 | grep -i "remove \"@bacons/apple-targets\"" && echo "WARNING FIRES"
node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('app.json', 'utf8'));
cfg.expo.plugins = cfg.expo.plugins.filter((p) => p !== '@bacons/apple-targets');
fs.writeFileSync('app.json', JSON.stringify(cfg, null, 2));
"
```

Expected: `WARNING FIRES`. (If Task 1 adopted the require-both fallback, this step does not apply — record that instead.)

- [ ] **Step 7: Record the verdict and clean up**

```bash
rm -rf /tmp/ik-consumer /tmp/expo-island-kit-*.tgz
```

Record in the Task 7 evidence README: whether the tarball contained everything, whether the scratch app prebuilt and built, whether `presets` narrowing was observed live, and whether the double-listing warning fired. **No commit** — this task's deliverable is the verdict.

If the scratch app fails to resolve `expo-island-kit/app.plugin.js`, the `files` array is wrong — return to Task 2 Step 4 rather than patching the scratch app.

---

### Task 7: Docs, CLAUDE.md, README, ledger, memory, evidence

Shipping without this leaves four documents actively wrong, including a `CLAUDE.md` bullet that forbids the work just completed.

**Files:**
- Modify: `docs/islandkit-full-documentation.md`, `CLAUDE.md`, `packages/expo-island-kit/README.md`, `.superpowers/sdd/progress.md`
- Create: `docs/superpowers/evidence/phase6-README.md`
- Modify: the `islandkit-build-state` memory file

- [ ] **Step 1: Reconcile full-documentation §5.2 (install snippet)**

Replace the §5.2 `app.json` snippet with what actually ships:

```json
// app.json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp",
      "appleTeamId": "YOUR_APPLE_TEAM_ID"
    },
    "plugins": ["expo-island-kit"]
  }
}
```

Add below it:

> That is the whole setup — IslandKit generates the widget extension target for you. **Do not also list `@bacons/apple-targets`**: IslandKit applies it internally, and listing both builds every target twice. Your own `targets/*` are still picked up.
>
> To customise, pass options: `["expo-island-kit", { "presets": ["nowPlaying", "timer"] }]`. See [Section 11](#11-configuration-reference-appjson).

- [ ] **Step 2: Reconcile full-documentation §5.3 and §11**

In §5.3, the sentence "This generates your `ios/` folder, including the widget extension target, with entitlements and App Group wired up automatically" claims something that does not exist. Replace with:

> This generates your `ios/` folder, including the widget extension target, with `NSSupportsLiveActivities` set on your app automatically.

Replace the §11 snippet and table with the shipped surface:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-island-kit",
        {
          "presets": ["nowPlaying", "delivery", "timer", "genericProgress"],
          "deploymentTarget": "16.2",
          "bundleIdentifier": "com.yourcompany.yourapp.island-kit-widget",
          "defaultAccentColor": "#FA2D48"
        }
      ]
    ]
  }
}
```

| Option | Default | Description |
|---|---|---|
| `presets` | all four | Which presets to include. Excluding unused presets reduces extension binary size and build time |
| `deploymentTarget` | `16.2` | Minimum iOS version for the extension target. IslandKit's ActivityKit code requires 16.2 |
| `bundleIdentifier` | `<app bundle id>.island-kit-widget` | Bundle ID for the generated widget extension target. Leave unset unless you have a reason — changing it requires re-provisioning |
| `defaultAccentColor` | system accent | Fallback tint used when a preset's `accentColor` prop is omitted |

Then add, immediately after the table:

> **Not yet available.** `groupIdentifier` and `enablePushNotifications` are planned for the remote-push release and are ignored (with a warning) today — both need a paid Apple Developer account. Set your team via `ios.appleTeamId` rather than a plugin option; the widget target signs from it.
>
> The generated `targets/island-kit-widget/` directory is **build output**: it is overwritten on every `expo prebuild` and should be git-ignored. Do not edit it by hand.

After changing any of these, re-run `npx expo prebuild --clean`.

- [ ] **Step 3: Reconcile full-documentation §18 (example app walkthrough)**

Update the walkthrough so it no longer implies a hand-scaffolded target: note that the example app consumes the published plugin exactly as a consumer does, with no widget Swift in its tracked source, and that `npx expo prebuild -p ios --clean` regenerates `targets/island-kit-widget/` from the package.

- [ ] **Step 4: Update `CLAUDE.md`**

Four edits:

1. **Status table** — change the Phase 6 row from `⬜ Not started` to:
   `| 6 — DX polish | 🟡 **Config plugin done** | Config plugin ships (`app.plugin.js` generates the widget target; consumer writes zero Swift; 4 options). Spec `docs/superpowers/specs/2026-07-27-phase-6-config-plugin-design.md`, plan `docs/superpowers/plans/2026-07-27-phase-6-config-plugin.md` (branch `phase-6-config-plugin`). **Remaining:** native error messages, prop defaults, unsupported-path signalling. |`

2. **Non-goals** — delete the bullet that now forbids completed work:
   `- Config plugin automation that generates the widget target automatically (Phase 6 — for now, the target is scaffolded manually via `@bacons/apple-targets` CLI in the example app)`
   Replace with:
   `- Widget customization / eject story — the generated `targets/island-kit-widget/` is overwritten every prebuild by design; a supported override mechanism is a later phase`

3. **Repository layout** — the widget SwiftUI now ships in the package. Replace the `apps/example/targets/` sub-tree and the note beneath it with:
   ```
   ├── packages/
   │   └── expo-island-kit/
   │       ├── app.plugin.js        (config plugin — generates the consumer's widget target)
   │       ├── plugin/
   │       │   ├── generateTarget.js  (pure, unit-tested generator)
   │       │   └── widget/            (the shipped widget SwiftUI template)
   │       ├── src/
   │       ├── ios/                   (shared/ holds the single-source *Attributes.swift)
   │       └── expo-module.config.json
   └── apps/
       └── example/                   (targets/ is now plugin-generated + git-ignored)
   ```
   and replace the "during early development, the widget extension SwiftUI views live inside `apps/example/targets/`…" paragraph with a note that the package now owns and ships the target definition, and the example consumes it like any other consumer.

4. **Architecture flow** — in the "how a call flows" block, change the widget-extension line from `(apps/example/targets/island-kit-widget)` to `(generated into <projectRoot>/targets/island-kit-widget by app.plugin.js)`.

- [ ] **Step 5: Update the package README**

In `packages/expo-island-kit/README.md`, replace the installation/setup section with the §5.2 content from Step 1 (install, one plugin line, the do-not-double-list warning, a pointer to the options), plus the "generated output, git-ignore it, do not hand-edit" note. Add `targets/` to the suggested consumer `.gitignore`.

- [ ] **Step 6: Write the evidence README**

Create `docs/superpowers/evidence/phase6-README.md` covering:
- The example now consumes the plugin with **zero widget Swift in tracked source**; `prebuild --clean` from nothing regenerates a buildable target (Task 5 Steps 3–6).
- All four presets render on the iPhone 17 Pro simulator from the plugin-generated widget, with the screenshot filenames.
- The Task 6 consumer verdict: tarball contents, scratch-app prebuild + build, `presets` narrowing observed live, double-listing warning.
- Which mechanism shipped — the `withTargetsDir` wrap, or the require-both fallback.
- **Sim ≠ on-device visual sign-off**, and the new wrinkle: the deferred device visual pass (Now Playing expanded clip, Timer ticking/pause-resume, Delivery map, compact placement) must now run **after** a plugin `prebuild --clean`, not against a hand-scaffolded target.

- [ ] **Step 7: Add the Phase 6 progress-ledger section**

Append a `# Phase 6 — Config Plugin — Progress Ledger` section to `.superpowers/sdd/progress.md` matching the Phase 3/4 format: plan + spec paths, branch, base commit, per-task status with commit SHAs and review verdicts, deviations, and deferred/minor findings.

- [ ] **Step 8: Update the memory file**

Update `/Users/danemmanuel/.claude/projects/-Users-danemmanuel-Documents-islandkit/memory/islandkit-build-state.md` with a Phase 6 section: branch, commits, what shipped (plugin, generator, four options, the three reconciled doc options), the symlink write-through hazard and its fix, the tarball/scratch-app result, and that the branch is not merged.

- [ ] **Step 9: Final verification sweep**

```bash
cd /Users/danemmanuel/Documents/islandkit
echo "=== full test suite ==="; CI=1 pnpm --filter expo-island-kit test 2>&1 | tail -8
echo "=== typecheck ==="; pnpm --filter expo-island-kit exec tsc --noEmit && echo "package tsc OK"
cd apps/example && npx tsc --noEmit && echo "example tsc OK"; cd ..
echo "=== abstraction zero-diff check (must be EMPTY) ==="
git diff --stat phase-4-delivery-timer..HEAD -- \
  packages/expo-island-kit/ios/core/ \
  packages/expo-island-kit/src/core/ \
  packages/expo-island-kit/ios/presets/ \
  packages/expo-island-kit/src/presets/
echo "=== no tracked widget Swift in the example ==="
test -z "$(git ls-files apps/example/targets/)" && echo "CLEAN"
echo "=== forbidden entitlements across the repo ==="
grep -rn "application-groups\|aps-environment" --include="*.entitlements" --include="*.plist" --include="*.json" apps packages && echo "FORBIDDEN FOUND" || echo "CLEAN"
```

Expected: 22 tests pass; both typechecks OK; **an empty diff** for the abstraction directories; `CLEAN` twice.

An empty diff for `ios/core/`, `src/core/`, `ios/presets/`, `src/presets/` is the abstraction bar. A non-empty diff means the plugin leaked into the abstraction — stop and flag it.

- [ ] **Step 10: Commit**

```bash
cd /Users/danemmanuel/Documents/islandkit
git add docs CLAUDE.md packages/expo-island-kit/README.md .superpowers/sdd/progress.md
git commit -m "docs: reconcile plugin docs, CLAUDE.md and README with what ships + phase 6 evidence"
```

**Definition of done — verify each against the spec §8:**
- [ ] Widget SwiftUI ships in `plugin/widget/`; `ios/shared/*Attributes.swift` still the single source (Task 2).
- [ ] `generateTarget.js` is pure, tested-first, and includes the symlink-replacement regression test; suite green (Task 3).
- [ ] `app.plugin.js` generates, sets `NSSupportsLiveActivities`, wraps `withTargetsDir`, is run-once guarded, warns on double-listing, validates options (Task 4).
- [ ] `presets`, `deploymentTarget`, `bundleIdentifier`, `defaultAccentColor` all work (Tasks 3, 4, 6).
- [ ] Example converted; zero widget Swift in tracked source (Task 5).
- [ ] `prebuild --clean` generates the target; app + widget build (Task 5).
- [ ] All four presets start/render/end on the simulator (Task 5 Step 7).
- [ ] `npm pack` tarball contains the plugin + sources, excludes tests (Task 6 Step 1).
- [ ] The tarball installs into a scratch app outside the monorepo, prebuilds, and builds (Task 6 Steps 2–5).
- [ ] Full doc §5.2/§5.3/§11/§18, `CLAUDE.md`, README updated (Task 7).
- [ ] Ledger + memory updated (Task 7).
- [ ] No App Group / Push / new capability; public TS API and the Phase-3 abstraction unchanged — zero diff (Task 7 Step 9).

---

## Self-Review

**Spec coverage (§0–11):**
- §0 revision gaps 1–11 → gap 1/2 (options) Tasks 3–4 + 7; gap 3 (symlink) Task 3 Steps 1/3; gap 4 (`npm pack`) Task 6 Step 1; gap 5 (scratch app) Task 6 Steps 2–5; gap 6 (double-listing) Task 4 Step 1 + Task 6 Step 6; gap 7 (spike fidelity) Task 1 Step 1; gap 8 (docs) Task 7; gap 9 (branch + ledger) Task 1 Step 0 + Task 7 Step 7; gap 10 (tests) Task 3; gap 11 (Phase 5) fixed in the spec header. ✓
- §3 package restructure → Task 2. §4.1 shape → Task 4 Step 1. §4.2 copy-vs-generate → Task 3 Step 3 (`ALWAYS_COPIED` + `generated`). §4.3 destination hygiene → Task 3 Step 3 (`copyFile` + wipe) with tests in Step 1. §4.4 double-application → Task 4 Step 1 + Task 6 Step 6. ✓
- §5 options → `presets`/`deploymentTarget`/`bundleIdentifier`/`defaultAccentColor` in Task 3; the three reconciled ones warn in Task 4 Step 1 and are documented in Task 7 Step 2. The `presetAccentColor` change is Task 4 Steps 6–7. ✓
- §6 three verification layers → unit (Task 3), dogfood (Task 5), consumer (Task 6). ✓
- §7 doc reconciliation → Task 7 Steps 1–5, 7. §8 DoD → Task 7's checklist. §9 plan shape → the seven tasks, in order. §10 fallback → Task 1 Step 6 + Task 4 Step 1's conditional branch. ✓

**Placeholder scan:** every step carries the actual command, file content, or exact edit. The two conditional branches in Task 4 Step 1 are concrete instructions keyed to a specific Task-1 finding, not TBDs. The one judgement-based step is Task 7 Step 3 (§18 walkthrough prose), which states exactly what must be true of the result. ✓

**Type/name consistency:** `TARGET_NAME = 'island-kit-widget'` is used identically in `generateTarget.js`, the generated `expo-target.config.js` (`name:`), the destination path, `apps/example/.gitignore`, and every verification `ls`. `generateTarget({ packageRoot, projectRoot, options })` has the same signature in the tests (Task 3 Step 1), the implementation (Step 3), the smoke checks (Task 4 Steps 3–4), and `app.plugin.js` (Task 4 Step 1). `PRESETS` keys (`nowPlaying`, `genericProgress`, `delivery`, `timer`) match the doc §11 table in Task 7 Step 2 and the scratch app's option in Task 6 Step 3. `islandKitDefaultAccentHex` is declared in `renderDefaults` and consumed in `WidgetSupport.swift` (Task 4 Step 6) with matching type `String?`. `widgetType` values match the real Swift struct names in `IslandKitWidgetBundle.swift` as it exists today. ✓

**Known risks flagged for execution:** (1) the eval-time write must precede `withTargetsDir`'s `globSync` — Task 1 proves it, and both plugin variants call `generateTarget` first. (2) `config._internal.projectRoot` availability — Task 1 Step 3 logs it; Task 4 Step 1 carries the exact fallback. (3) `prebuild --clean` is mandatory, never plain `prebuild`. (4) The `build/`-staleness + Metro `-c` trap applies to Task 5 Step 7. (5) `plutil -extract` without `-o -` destroys the file — called out in the tooling notes and at its one use site. (6) `create-expo-app` may scaffold an SDK newer than 55, which Xcode 26.0.1 cannot build — Task 6 Step 2 carries the pin instruction.
