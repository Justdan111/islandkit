# Phase 1 — Environment Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the near-empty repo into a working pnpm monorepo where the `expo-island-kit` iOS-only Expo module is linked into an example dev-client app, prebuilds, and boots on a simulator with a live native-module call returning to JS.

**Architecture:** A pnpm workspace with two members: `packages/expo-island-kit` (the publishable Expo module, generated via `create-expo-module` restricted to the Apple platform) and `apps/example` (an Expo dev-client app that consumes it via `workspace:*`). The module's only Phase-1 surface is one real shared-API function — `areLiveActivitiesEnabled()` — which proves the JS↔Swift bridge without any preset code. Metro is configured for the monorepo; pnpm uses a hoisted node-linker so Expo autolinking and CocoaPods resolve correctly.

**Tech Stack:** Expo SDK (latest via create-expo-app), Expo Modules API (Swift + `ExpoModulesCore`), ActivityKit (capability check only), pnpm workspaces, TypeScript, Metro.

## Global Constraints

- **iOS only.** No Android code/config/branches. Non-iOS paths must no-op safely, not throw. (`CLAUDE.md`)
- **No App Groups** capability/entitlement anywhere. (`CLAUDE.md`)
- **No Push Notifications** capability, `aps-environment` entitlement, or any push-token / APNs code. (`CLAUDE.md`)
- **No `appleTeamId`** in `app.json`; no team ID referenced in code. Signing is manual, per-machine. (`CLAUDE.md`)
- **No preset logic** (Now Playing/Delivery/Timer/Generic Progress), no `@bacons/apple-targets` widget target. Those are Phase 2+. (`CLAUDE.md`)
- App bundle identifier must stay globally unique: `io.github.Justdan111.islandkitexample`. (design decision)
- Do not rename the native module class that `create-expo-module` generates. (`CLAUDE.md`)
- Commit style: conventional commits (`feat:`, `chore:`, `docs:`). (`CLAUDE.md`)

---

### Task 1: Workspace baseline (root config + pnpm linker)

**Files:**
- Modify: `package.json` (repo root)
- Create: `.npmrc` (repo root)
- Keep as-is: `pnpm-workspace.yaml`

**Interfaces:**
- Consumes: nothing.
- Produces: a private workspace root named `islandkit-monorepo`; a hoisted pnpm node-linker so later native tooling resolves dependencies. No exported code symbols.

- [ ] **Step 1: Replace the root `package.json`**

```json
{
  "name": "islandkit-monorepo",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@10.17.0",
  "scripts": {
    "typecheck": "pnpm -r --if-present typecheck"
  }
}
```

- [ ] **Step 2: Create `.npmrc` at the repo root**

React Native / Expo native builds and autolinking do not fully support pnpm's default symlinked `node_modules`. Force a hoisted layout:

```
node-linker=hoisted
shamefully-hoist=true
```

- [ ] **Step 3: Verify pnpm reads the workspace**

Run: `pnpm ls -r --depth -1`
Expected: lists the workspace root (`islandkit-monorepo`) with no error about workspace config. (No members yet — that's fine.)

- [ ] **Step 4: Commit**

```bash
git add package.json .npmrc
git commit -m "chore: configure pnpm workspace root and hoisted node-linker"
```

---

### Task 2: Generate the iOS-only Expo module

**Files:**
- Create (generated): `packages/expo-island-kit/` — `package.json`, `expo-module.config.json`, `tsconfig.json`, `src/`, `ios/` (`ExpoIslandKitModule.swift`, `ExpoIslandKit.podspec`)

**Interfaces:**
- Consumes: the workspace root from Task 1.
- Produces: a workspace package named `expo-island-kit` registering a native module under the ActivityKit name `ExpoIslandKit`. Exact generated file/function names are adapted in Task 3.

- [ ] **Step 1: Generate the module directly into `packages/expo-island-kit`**

Run (from repo root):

```bash
npx create-expo-module@latest packages/expo-island-kit \
  --no-example --no-install \
  -p apple \
  --features AsyncFunction \
  --name ExpoIslandKit \
  --description "Drop-in iOS Live Activities and Dynamic Island presets for Expo" \
  --package expo.modules.islandkit \
  --author-name "Justdan111" \
  --author-url "https://github.com/Justdan111" \
  --repo "https://github.com/Justdan111/islandkit" \
  --license MIT \
  --module-version 0.1.0
```

Expected: creates `packages/expo-island-kit/` with `src/`, `ios/`, `expo-module.config.json`, `package.json`. `-p apple` means **no `android/` directory** is generated.

- [ ] **Step 2: Confirm the generated structure is iOS-only and package name is correct**

Run:

```bash
ls packages/expo-island-kit && echo "---" && ls packages/expo-island-kit/ios && echo "---" && grep '"name"' packages/expo-island-kit/package.json
```

Expected: an `ios/` directory exists; **no `android/` directory**; package name is `"expo-island-kit"`. If an `android/` dir exists, delete it: `rm -rf packages/expo-island-kit/android`.

- [ ] **Step 3: Confirm `expo-module.config.json` declares apple only**

Run: `cat packages/expo-island-kit/expo-module.config.json`
Expected: `platforms` contains `"apple"` and NOT `"android"`. If Android is listed, edit the file so `platforms` is exactly `["apple"]` and remove any `android` key.

- [ ] **Step 4: Install so the package's dev deps (expo-module-scripts, expo-modules-core) link**

Run (from repo root): `pnpm install`
Expected: completes; `packages/expo-island-kit` recognized as a workspace project.

- [ ] **Step 5: Commit**

```bash
git add packages/expo-island-kit pnpm-lock.yaml
git commit -m "feat: scaffold iOS-only expo-island-kit module"
```

---

### Task 3: Reduce module surface to `areLiveActivitiesEnabled()`

Replace the generated demo function with one real, iOS-guarded capability check. This is genuine shared-API surface (docs §9/§10), not throwaway code, and it proves the bridge round-trips both an async call and a value.

**Files:**
- Modify: `packages/expo-island-kit/ios/ExpoIslandKitModule.swift` (full replacement of the `definition()` body)
- Modify: `packages/expo-island-kit/src/ExpoIslandKitModule.ts` (native module declaration)
- Modify: `packages/expo-island-kit/src/index.ts` (public export)
- Create: `packages/expo-island-kit/src/ExpoIslandKitModule.web.ts` (non-iOS stub)
- Delete (if generated): any `src/ExpoIslandKitView.tsx`, `src/*.types.ts` event types, `ios/ExpoIslandKitView.swift`

**Interfaces:**
- Consumes: the generated module from Task 2.
- Produces: `export async function areLiveActivitiesEnabled(): Promise<boolean>` from `expo-island-kit`. Native `AsyncFunction("areLiveActivitiesEnabled")` returning `Bool`.

- [ ] **Step 1: Remove any generated View / event-type files**

Run:

```bash
cd packages/expo-island-kit
rm -f ios/ExpoIslandKitView.swift src/ExpoIslandKitView.tsx src/ExpoIslandKit.types.ts src/ExpoIslandKitModule.web.tsx
cd -
```

(If a file wasn't generated, `rm -f` is a no-op — fine.)

- [ ] **Step 2: Replace `ios/ExpoIslandKitModule.swift` with the minimal module**

```swift
import ExpoModulesCore
import ActivityKit

public class ExpoIslandKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoIslandKit")

    // Whether the user currently allows Live Activities for this app.
    // Resolves false on iOS < 16.1; the JS layer already guards non-iOS.
    AsyncFunction("areLiveActivitiesEnabled") { () -> Bool in
      if #available(iOS 16.1, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }
  }
}
```

- [ ] **Step 3: Replace `src/ExpoIslandKitModule.ts`**

```ts
import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoIslandKitModule extends NativeModule<Record<string, never>> {
  areLiveActivitiesEnabled(): Promise<boolean>;
}

export default requireNativeModule<ExpoIslandKitModule>('ExpoIslandKit');
```

- [ ] **Step 4: Create `src/ExpoIslandKitModule.web.ts` (non-iOS stub)**

```ts
// Web/non-native stub: Live Activities are iOS-only, so this always resolves false.
export default {
  async areLiveActivitiesEnabled(): Promise<boolean> {
    return false;
  },
};
```

- [ ] **Step 5: Replace `src/index.ts` with the public API**

```ts
import { Platform } from 'react-native';

import ExpoIslandKitModule from './ExpoIslandKitModule';

/**
 * Whether the user currently allows Live Activities for this app right now.
 * Returns false on non-iOS platforms and on iOS versions below 16.1.
 */
export async function areLiveActivitiesEnabled(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }
  return ExpoIslandKitModule.areLiveActivitiesEnabled();
}
```

- [ ] **Step 6: Typecheck the package**

Run: `cd packages/expo-island-kit && pnpm exec tsc --noEmit; cd -`
Expected: no type errors. (If `tsc` complains about a missing `react-native` type, it resolves via the hoisted root — confirm `pnpm install` from Task 2 ran. `react-native` is a dev/peer dep of the module template.)

- [ ] **Step 7: Commit**

```bash
git add packages/expo-island-kit
git commit -m "feat: expose areLiveActivitiesEnabled capability check"
```

---

### Task 4: Create the example app and wire the workspace

**Files:**
- Create (generated): `apps/example/` — `package.json`, `app.json`, `App.tsx`, `tsconfig.json`
- Modify: `apps/example/package.json` (add workspace dep)
- Modify: `apps/example/app.json` (bundle identifier, plugins)
- Create: `apps/example/metro.config.js` (monorepo resolution)

**Interfaces:**
- Consumes: `expo-island-kit` from Task 3.
- Produces: an Expo dev-client app resolving `expo-island-kit` via `workspace:*`, bundle id `io.github.Justdan111.islandkitexample`.

- [ ] **Step 1: Generate the example app**

Run (from repo root):

```bash
pnpm create expo-app apps/example --template blank-typescript --no-install --no-agents-md
```

Expected: creates `apps/example/` with `App.tsx`, `app.json`, `package.json`. (If `blank-typescript` is unavailable, use `--template blank`.) `--no-agents-md` prevents it writing its own CLAUDE.md/AGENTS.md over ours.

- [ ] **Step 2: Add the workspace dependency and dev client**

Edit `apps/example/package.json` — add to `dependencies`:

```json
"expo-island-kit": "workspace:*",
"expo-dev-client": "*"
```

(Leave the generated `expo`, `react`, `react-native` versions as-is; `expo-dev-client` will be pinned to the matching version on install.)

- [ ] **Step 3: Set the bundle identifier in `apps/example/app.json`**

Under `expo`, add/ensure an `ios` block with the unique bundle id. Do NOT add `appleTeamId`, entitlements, or App Group config:

```json
"ios": {
  "bundleIdentifier": "io.github.Justdan111.islandkitexample",
  "supportsTablet": false
}
```

- [ ] **Step 4: Create `apps/example/metro.config.js` for monorepo resolution**

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so the workspace package is picked up.
config.watchFolders = [workspaceRoot];
// Resolve modules from the app first, then the hoisted workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
```

- [ ] **Step 5: Install and pin the dev-client version**

Run (from repo root): `pnpm install`
Then, to align `expo-dev-client` to the app's Expo SDK: `cd apps/example && npx expo install expo-dev-client; cd -`
Expected: install completes; `node_modules/expo-island-kit` exists (symlink to the workspace package) resolvable from `apps/example`.

- [ ] **Step 6: Verify the app resolves and type-checks against the package**

Run: `cd apps/example && npx tsc --noEmit; cd -`
Expected: no errors. (The generated `tsconfig.json` extends `expo/tsconfig.base`.) If `expo-island-kit` is reported as unresolved, re-run `pnpm install` from the root and confirm `.npmrc` hoisting from Task 1 is present.

- [ ] **Step 7: Commit**

```bash
git add apps/example pnpm-lock.yaml
git commit -m "feat: add example dev-client app wired to expo-island-kit"
```

---

### Task 5: Prebuild, run on simulator, verify the bridge

**Files:**
- Modify: `apps/example/App.tsx` (call the native function and display the result)

**Interfaces:**
- Consumes: `areLiveActivitiesEnabled` from Task 3, the app from Task 4.
- Produces: a running app on an iPhone 16 Pro simulator showing the boolean returned from Swift.

- [ ] **Step 1: Replace `apps/example/App.tsx` to exercise the native call**

```tsx
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { areLiveActivitiesEnabled } from 'expo-island-kit';

export default function App() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    areLiveActivitiesEnabled()
      .then(setEnabled)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>IslandKit</Text>
      <Text style={styles.line}>
        Native bridge:{' '}
        {error ? `error — ${error}` : enabled === null ? 'calling…' : 'OK'}
      </Text>
      <Text style={styles.line}>
        Live Activities enabled:{' '}
        {enabled === null ? '…' : enabled ? 'true' : 'false'}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 8,
  },
  title: { fontSize: 28, fontWeight: '700' },
  line: { fontSize: 16 },
});
```

- [ ] **Step 2: Prebuild the iOS project**

Run: `cd apps/example && npx expo prebuild -p ios; cd -`
Expected: generates `apps/example/ios/` (gitignored). It should complete without asking for a team ID and without adding App Group / push entitlements.

- [ ] **Step 3: Confirm the native module was autolinked**

Run: `grep -R "ExpoIslandKit" apps/example/ios/Podfile.lock apps/example/ios/*.xcworkspace 2>/dev/null; grep -Rl "ExpoIslandKit" apps/example/ios/Pods 2>/dev/null | head`
Expected: `ExpoIslandKit` appears in the generated Pods project (proves Expo autolinking found the workspace module). If absent, re-run `pnpm install` then `npx expo prebuild -p ios --clean`.

- [ ] **Step 4: Confirm NO forbidden entitlements were added**

Run: `grep -RiE "aps-environment|com.apple.security.application-groups|appleTeamId" apps/example/ios apps/example/app.json 2>/dev/null || echo "CLEAN"`
Expected: prints `CLEAN`. If anything matches, stop and remove it — this violates a Phase-1 guardrail.

- [ ] **Step 5: Build and boot on an iPhone 16 Pro simulator**

Run: `cd apps/example && npx expo run:ios --scheme example; cd -`
(If it doesn't auto-pick a Dynamic Island simulator, first `xcrun simctl boot "iPhone 16 Pro"` then re-run.)
Expected: the app compiles, installs, and launches showing **"Native bridge: OK"** and **"Live Activities enabled: true"** (simulators on iOS 16.1+ report enabled). Seeing a real boolean — not "error" — confirms the JS↔Swift round trip.

- [ ] **Step 6: Commit**

```bash
git add apps/example/App.tsx
git commit -m "feat: verify native bridge from example app on simulator"
```

---

### Task 6: Physical-device hand-off doc + correct the status table

**Files:**
- Create: `docs/phase-1-device-signing.md`
- Modify: `CLAUDE.md` (Phase 1 status row → reflect reality)

**Interfaces:**
- Consumes: the working simulator build from Task 5.
- Produces: a one-time signing checklist; an accurate status table.

- [ ] **Step 1: Write `docs/phase-1-device-signing.md`**

```markdown
# Phase 1 — Run on a physical device (one-time signing)

The simulator build is verified. To complete the Phase-1 DoD on real
Dynamic Island hardware (iPhone 14 Pro or newer), do this once:

1. From `apps/example`, open the workspace in Xcode:
   `xed ios/example.xcworkspace`
2. Select the **example** app target → **Signing & Capabilities**.
3. Check **Automatically manage signing**.
4. Set **Team** to your Personal Team (your free Apple ID).
5. Confirm the bundle identifier is `io.github.Justdan111.islandkitexample`
   (globally unique — do not change to a generic value).
6. Do NOT add any capabilities (no App Groups, no Push Notifications).
7. Plug in the device, trust the Mac, then from `apps/example` run:
   `npx expo run:ios --device`
8. On first launch, on the device go to Settings → General → VPN & Device
   Management and trust your developer certificate.
9. The app should launch and show "Native bridge: OK" and a real
   "Live Activities enabled" value.

If the build fails on signing, it is almost always the bundle identifier
already being taken or the Team not selected — fix in step 3–5 and retry.
```

- [ ] **Step 2: Correct the Phase 1 row in `CLAUDE.md`**

Change the Phase 1 status cell from claiming the monorepo is already scaffolded to reflecting the true state. Replace the Phase 1 table row with:

```markdown
| 1 — Environment setup | ✅ Done (simulator) — device run pending developer signing | Monorepo scaffolded, iOS-only module + example app linked, prebuilds and boots on simulator with a live native call; physical-device run per `docs/phase-1-device-signing.md` |
```

- [ ] **Step 3: Commit**

```bash
git add docs/phase-1-device-signing.md CLAUDE.md
git commit -m "docs: phase 1 device-signing handoff and status correction"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-07-21-phase-1-environment-setup-design.md`):
- Root config + gitignore → Task 1 (gitignore already committed with the spec).
- Generate module, reshape → Task 2.
- Trim to minimal buildable surface → Task 3.
- Example app + workspace dep + dev-client + bundle id → Task 4.
- Install & typecheck → Tasks 2, 3, 4.
- Prebuild + simulator run + native call → Task 5.
- Physical-device hand-off doc → Task 6.
- All guardrails (no Android, no App Group, no push, no appleTeamId, no presets, don't rename generated class) → Global Constraints + verified in Task 5 Step 4.
- DoD checklist items all map to Task 2–6 verification steps.

**Placeholder scan:** No TBD/TODO; every code and file step has concrete content; commands have expected output.

**Type consistency:** `areLiveActivitiesEnabled(): Promise<boolean>` is identical across the Swift `AsyncFunction`, `ExpoIslandKitModule.ts`, the web stub, `index.ts`, and its use in `App.tsx`. Native registration name `"ExpoIslandKit"` matches `requireNativeModule('ExpoIslandKit')`.
