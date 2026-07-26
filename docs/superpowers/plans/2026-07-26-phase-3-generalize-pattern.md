# Phase 3 — Generalize the Pattern Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Now Playing onto a reusable registry/protocol abstraction so a new preset costs one Attributes file + one handler/decoder + one Widget + one line of TS, and prove it by adding Generic Progress end to end.

**Architecture:** TypeScript `createLiveActivityFactory<T>(preset)` backs every preset over a preset-agnostic native surface (`startLiveActivity`/`updateLiveActivity`/`endLiveActivity`/`isLiveActivitySupported`). Swift dispatches those through a `PresetRegistry` of type-erased `LiveActivityPresetHandler`s onto a generic `LiveActivityEngine<A: ActivityAttributes>`. Each preset's `*Attributes.swift` is a single source of truth in the package, compiled into the app (pod) target by the podspec glob and into the widget target via a symlink.

**Tech Stack:** Expo SDK 55 (RN 0.83.6, React 19.2), TypeScript 5.9 strict, Swift 6.2 / ActivityKit / WidgetKit / SwiftUI, `@bacons/apple-targets@5`, Jest (jest-expo).

## Global Constraints

Copied from the spec + CLAUDE.md — every task implicitly includes these:

- **iOS only.** No Android code/config. Cross-platform JS must no-op on non-iOS (web stub + `Platform.OS` guards).
- **Pinned to Expo SDK 55** (RN 0.83.6). Do NOT bump the SDK (Xcode 26.0.1 can't build SDK 56+).
- **No App Groups** capability/entitlement anywhere. **No Push Notifications**, `aps-environment`, `appleTeamId`, or push-token code (Phase 5). Do NOT add `getPushToken`/`addPushTokenListener` to the API surface.
- **TypeScript:** strict, no `any` in public API surface. Field names verbatim from `docs/islandkit-full-documentation.md` §10.
- **Swift:** lowerCamelCase members, UpperCamelCase types; `struct` (not class) for `ActivityAttributes`/`ContentState` (`Codable, Hashable`); ActivityKit guarded `@available(iOS 16.2, *)` and no-op / return `""` when unsupported. No third-party Swift deps.
- **No breaking change** to `NowPlayingActivity`'s public TS shape.
- **`GenericProgressProps` = `{ title; subtitle?; progress; iconSystemName?; accentColor? }`** — verbatim from the canonical doc, no additions (no `progressLabel`).
- **Module `main` is the compiled `build/` dir** (git-ignored). After editing `src/`, run `pnpm --filter expo-island-kit build` before the example app consumes the new API.
- **Verification target:** iPhone 17 Pro simulator (id `A7D7BEB3-8F26-4FA6-9043-231ED673927D`). Green-on-simulator validates the abstraction but is NOT on-device visual sign-off.
- Bundle ids unchanged (`io.github.Justdan111.islandkitexample`, widget `….island-kit-widget`).

---

## File Structure

**Created:**
- `packages/expo-island-kit/ios/shared/NowPlayingAttributes.swift` — moved here (canonical), symlinked into the widget target.
- `packages/expo-island-kit/ios/shared/GenericProgressAttributes.swift` — canonical, symlinked into the widget target.
- `packages/expo-island-kit/ios/core/PropCoercion.swift` — shared prop-coercion + dismissal-policy parser.
- `packages/expo-island-kit/ios/core/LiveActivityEngine.swift` — generic ActivityKit ops.
- `packages/expo-island-kit/ios/core/PresetRegistry.swift` — protocol + registry.
- `packages/expo-island-kit/ios/presets/NowPlayingHandler.swift` — handler + decoder.
- `packages/expo-island-kit/ios/presets/GenericProgressHandler.swift` — handler + decoder.
- `packages/expo-island-kit/src/core/types.ts`, `src/core/createLiveActivityFactory.ts`
- `packages/expo-island-kit/src/presets/NowPlaying.ts`, `src/presets/GenericProgress.ts`
- `packages/expo-island-kit/src/__tests__/createLiveActivityFactory.test.ts`
- `apps/example/targets/island-kit-widget/WidgetSupport.swift` — shared render helpers.
- `apps/example/targets/island-kit-widget/GenericProgressLiveActivity.swift`
- Symlinks: `apps/example/targets/island-kit-widget/NowPlayingAttributes.swift`, `…/GenericProgressAttributes.swift`

**Modified:**
- `packages/expo-island-kit/ios/ExpoIslandKitModule.swift` — replace per-preset Functions with 4 generic ones.
- `packages/expo-island-kit/src/ExpoIslandKitModule.ts`, `.web.ts`, `src/index.ts`
- `apps/example/targets/island-kit-widget/NowPlayingLiveActivity.swift` — use shared helpers.
- `apps/example/targets/island-kit-widget/IslandKitWidgetBundle.swift` — register both widgets.
- `apps/example/App.tsx` — add Generic Progress controls.

**Deleted:**
- `packages/expo-island-kit/ios/NowPlayingAttributes.swift` (moved to `shared/`).
- `apps/example/targets/island-kit-widget/Support/Color+Hex.swift` (folded into `WidgetSupport.swift`).
- `packages/expo-island-kit/src/NowPlaying.ts` (old location; logic moves to `core/` + `presets/`).
- `packages/expo-island-kit/src/__tests__/NowPlaying.test.ts` (replaced by the factory test).

---

### Task 1: De-risk spike — single-source Attributes across both targets, surviving `prebuild --clean`

Proves the highest-risk mechanism before anything is built on it: one `*Attributes.swift` file, compiled into both the pod (app) target and the widget target, surviving `expo prebuild --clean`. Uses the existing `NowPlayingAttributes` (no logic change).

**Files:**
- Move: `packages/expo-island-kit/ios/NowPlayingAttributes.swift` → `packages/expo-island-kit/ios/shared/NowPlayingAttributes.swift`
- Delete + replace with symlink: `apps/example/targets/island-kit-widget/NowPlayingAttributes.swift`

**Interfaces:**
- Produces: canonical `packages/expo-island-kit/ios/shared/NowPlayingAttributes.swift` (same `NowPlayingAttributes` struct as before) reachable from both targets. Later tasks add sibling files under `shared/`, `core/`, `presets/`.

- [ ] **Step 1: Move the pod copy into `shared/` and replace the widget copy with a symlink**

```bash
cd /Users/danemmanuel/Documents/islandkit
mkdir -p packages/expo-island-kit/ios/shared
git mv packages/expo-island-kit/ios/NowPlayingAttributes.swift packages/expo-island-kit/ios/shared/NowPlayingAttributes.swift
git rm apps/example/targets/island-kit-widget/NowPlayingAttributes.swift
ln -s ../../../../packages/expo-island-kit/ios/shared/NowPlayingAttributes.swift \
      apps/example/targets/island-kit-widget/NowPlayingAttributes.swift
git add apps/example/targets/island-kit-widget/NowPlayingAttributes.swift
```

- [ ] **Step 2: Verify the symlink resolves and git stored it as a symlink**

```bash
cd /Users/danemmanuel/Documents/islandkit
test -f apps/example/targets/island-kit-widget/NowPlayingAttributes.swift && echo "symlink resolves"
git ls-files -s apps/example/targets/island-kit-widget/NowPlayingAttributes.swift | grep -q '^120000' && echo "stored as symlink (mode 120000)"
diff packages/expo-island-kit/ios/shared/NowPlayingAttributes.swift apps/example/targets/island-kit-widget/NowPlayingAttributes.swift && echo "identical content via symlink"
```
Expected: all three echo lines print.

- [ ] **Step 3: Regenerate native with `--clean` and build both targets**

```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
CI=1 npx expo prebuild -p ios --clean
SIM=A7D7BEB3-8F26-4FA6-9043-231ED673927D
xcodebuild -workspace ios/example.xcworkspace -scheme example -configuration Debug \
  -destination "id=$SIM" build 2>&1 | tee /tmp/ik-task1.log | tail -30
grep -q "\*\* BUILD SUCCEEDED \*\*" /tmp/ik-task1.log && echo "BUILD OK"
```
Expected: `** BUILD SUCCEEDED **`. This proves the symlinked shared file compiles into the app target (pod glob) AND the widget target, and survived `--clean`.

**If the widget target does NOT compile the symlink (fallback):** revert the symlink to a real copy and instead add an `apple-targets`/config-plugin prebuild copy-step that copies `shared/*Attributes.swift` into the widget target dir on every prebuild. Record which mechanism (symlink vs copy) was adopted in the commit message and proceed; every later "symlink" reference then means "the adopted de-dup mechanism."

- [ ] **Step 4: Verify the symlink survived `--clean`**

```bash
cd /Users/danemmanuel/Documents/islandkit
test -L apps/example/targets/island-kit-widget/NowPlayingAttributes.swift && echo "still a symlink after --clean"
```
Expected: prints (the symlink lives under `targets/`, not the regenerated `ios/`).

- [ ] **Step 5: Commit**

```bash
cd /Users/danemmanuel/Documents/islandkit
git add packages/expo-island-kit/ios apps/example/targets/island-kit-widget/NowPlayingAttributes.swift
git commit -m "refactor: single-source NowPlayingAttributes via shared/ + widget symlink"
```

---

### Task 2: TypeScript generalization — `createLiveActivityFactory` + both preset modules

Pure TS, native mocked in Jest. Ships the entire consumer-facing surface for both presets and the new preset-agnostic native declarations. The real native side lands in Tasks 3–4.

**Files:**
- Create: `src/core/types.ts`, `src/core/createLiveActivityFactory.ts`, `src/presets/NowPlaying.ts`, `src/presets/GenericProgress.ts`, `src/__tests__/createLiveActivityFactory.test.ts`
- Modify: `src/ExpoIslandKitModule.ts`, `src/ExpoIslandKitModule.web.ts`, `src/index.ts`
- Delete: `src/NowPlaying.ts`, `src/__tests__/NowPlaying.test.ts`

**Interfaces:**
- Consumes: the native module default export (mocked here). Expected native surface (implemented in Tasks 3–4):
  - `startLiveActivity(preset: string, props: Record<string, unknown>, deepLinkUrl: string | null): string` — sync.
  - `updateLiveActivity(preset: string, activityId: string, props: Record<string, unknown>): Promise<void>`
  - `endLiveActivity(preset: string, activityId: string, dismissalPolicy: string | null): Promise<void>`
  - `isLiveActivitySupported(): boolean` — sync. `areLiveActivitiesEnabled(): Promise<boolean>` — unchanged.
- Produces: `createLiveActivityFactory<T>(preset)`, `NowPlayingActivity`, `GenericProgressActivity`, and types `LiveActivityInstance<T>` / `LiveActivityFactory<T>` / `DismissalPolicy`, `NowPlayingProps`, `GenericProgressProps`.

- [ ] **Step 1: Update the native-module type declarations**

Replace `src/ExpoIslandKitModule.ts` with:
```ts
import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoIslandKitModule extends NativeModule<Record<string, never>> {
  areLiveActivitiesEnabled(): Promise<boolean>;
  isLiveActivitySupported(): boolean;
  startLiveActivity(preset: string, props: Record<string, unknown>, deepLinkUrl: string | null): string;
  updateLiveActivity(preset: string, activityId: string, props: Record<string, unknown>): Promise<void>;
  endLiveActivity(preset: string, activityId: string, dismissalPolicy: string | null): Promise<void>;
}

export default requireNativeModule<ExpoIslandKitModule>('ExpoIslandKit');
```

- [ ] **Step 2: Update the web/non-native stubs**

Replace `src/ExpoIslandKitModule.web.ts` with:
```ts
// Web/non-native stub: Live Activities are iOS-only, so everything no-ops.
export default {
  async areLiveActivitiesEnabled(): Promise<boolean> {
    return false;
  },
  isLiveActivitySupported(): boolean {
    return false;
  },
  startLiveActivity(_preset: string, _props: Record<string, unknown>, _deepLinkUrl: string | null): string {
    return '';
  },
  async updateLiveActivity(_preset: string, _activityId: string, _props: Record<string, unknown>): Promise<void> {},
  async endLiveActivity(_preset: string, _activityId: string, _dismissalPolicy: string | null): Promise<void> {},
};
```

- [ ] **Step 3: Write the shared types**

Create `src/core/types.ts`:
```ts
export type DismissalPolicy = 'default' | 'immediate' | { after: Date };

export interface LiveActivityInstance<T> {
  readonly id: string;
  update(props: Partial<T>): Promise<void>;
  end(dismissalPolicy?: DismissalPolicy, finalProps?: Partial<T>): Promise<void>;
}

export interface LiveActivityFactory<T> {
  start(props: T, deepLinkUrl?: string): LiveActivityInstance<T>;
  getActiveInstances(): LiveActivityInstance<T>[];
  isSupported(): boolean;
}
```

- [ ] **Step 4: Write the failing test**

Create `src/__tests__/createLiveActivityFactory.test.ts`:
```ts
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

jest.mock('../ExpoIslandKitModule', () => {
  const mockModule = {
    isLiveActivitySupported: jest.fn(() => true),
    startLiveActivity: jest.fn(
      (_preset: string, _props: Record<string, unknown>, _deepLink: string | null) => 'activity-1',
    ),
    updateLiveActivity: jest.fn(async () => {}),
    endLiveActivity: jest.fn(async () => {}),
    areLiveActivitiesEnabled: jest.fn(async () => true),
  };
  return { __esModule: true, default: mockModule };
});

import ExpoIslandKitModule from '../ExpoIslandKitModule';
import { GenericProgressActivity } from '../presets/GenericProgress';
import { NowPlayingActivity } from '../presets/NowPlaying';

const mockNative = ExpoIslandKitModule as unknown as {
  isLiveActivitySupported: jest.Mock;
  startLiveActivity: jest.Mock;
  updateLiveActivity: jest.Mock;
  endLiveActivity: jest.Mock;
  areLiveActivitiesEnabled: jest.Mock;
};

const npProps = { title: 'Song', artist: 'Artist', isPlaying: true, elapsedSeconds: 10, durationSeconds: 200 };

beforeEach(() => {
  jest.clearAllMocks();
  mockNative.isLiveActivitySupported.mockReturnValue(true);
  mockNative.startLiveActivity.mockReturnValue('activity-1');
  NowPlayingActivity.getActiveInstances().forEach((i) => i.end('immediate'));
  GenericProgressActivity.getActiveInstances().forEach((i) => i.end('immediate'));
  jest.clearAllMocks();
});

test('start passes (preset, props, deepLink) and returns an instance carrying the native id', () => {
  const instance = NowPlayingActivity.start(npProps, 'myapp://now-playing');
  expect(mockNative.startLiveActivity).toHaveBeenCalledWith('nowPlaying', npProps, 'myapp://now-playing');
  expect(instance.id).toBe('activity-1');
});

test('start with no deepLink passes null', () => {
  NowPlayingActivity.start(npProps);
  expect(mockNative.startLiveActivity).toHaveBeenCalledWith('nowPlaying', npProps, null);
});

test('update forwards (preset, id, partial props)', async () => {
  const instance = NowPlayingActivity.start(npProps);
  await instance.update({ isPlaying: false, elapsedSeconds: 42 });
  expect(mockNative.updateLiveActivity).toHaveBeenCalledWith('nowPlaying', 'activity-1', {
    isPlaying: false,
    elapsedSeconds: 42,
  });
});

test("end maps 'immediate' and removes the instance", async () => {
  const instance = NowPlayingActivity.start(npProps);
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(1);
  await instance.end('immediate');
  expect(mockNative.endLiveActivity).toHaveBeenCalledWith('nowPlaying', 'activity-1', 'immediate');
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(0);
});

test("end defaults to 'default' when none given", async () => {
  const instance = NowPlayingActivity.start(npProps);
  await instance.end();
  expect(mockNative.endLiveActivity).toHaveBeenCalledWith('nowPlaying', 'activity-1', 'default');
});

test('end serializes { after: Date } to ISO', async () => {
  const instance = NowPlayingActivity.start(npProps);
  await instance.end({ after: new Date('2030-01-01T00:00:00.000Z') });
  expect(mockNative.endLiveActivity).toHaveBeenCalledWith('nowPlaying', 'activity-1', '2030-01-01T00:00:00.000Z');
});

test('end applies finalProps via update before ending', async () => {
  const instance = NowPlayingActivity.start(npProps);
  await instance.end('default', { isPlaying: false });
  expect(mockNative.updateLiveActivity).toHaveBeenCalledWith('nowPlaying', 'activity-1', { isPlaying: false });
  expect(mockNative.endLiveActivity).toHaveBeenCalled();
});

test('unsupported start (empty id) returns an inert handle that is not tracked', () => {
  mockNative.startLiveActivity.mockReturnValue('');
  const instance = NowPlayingActivity.start(npProps);
  expect(instance.id).toBe('');
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(0);
});

test('isSupported reflects the native capability check', () => {
  mockNative.isLiveActivitySupported.mockReturnValue(false);
  expect(NowPlayingActivity.isSupported()).toBe(false);
  mockNative.isLiveActivitySupported.mockReturnValue(true);
  expect(NowPlayingActivity.isSupported()).toBe(true);
});

test('a second preset reuses the factory under its own name with separate tracking', () => {
  const gp = GenericProgressActivity.start({ title: 'Upload', progress: 0.3 }, 'myapp://x');
  expect(mockNative.startLiveActivity).toHaveBeenCalledWith('genericProgress', { title: 'Upload', progress: 0.3 }, 'myapp://x');
  expect(gp.id).toBe('activity-1');
  expect(GenericProgressActivity.getActiveInstances()).toHaveLength(1);
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(0);
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd /Users/danemmanuel/Documents/islandkit/packages/expo-island-kit && npx jest src/__tests__/createLiveActivityFactory.test.ts`
Expected: FAIL — `Cannot find module '../presets/NowPlaying'` (not created yet).

- [ ] **Step 6: Implement the generic factory**

Create `src/core/createLiveActivityFactory.ts`:
```ts
import { Platform } from 'react-native';

import ExpoIslandKitModule from '../ExpoIslandKitModule';
import type { DismissalPolicy, LiveActivityFactory, LiveActivityInstance } from './types';

function serializeDismissalPolicy(policy: DismissalPolicy): string {
  if (policy === 'default' || policy === 'immediate') {
    return policy;
  }
  return policy.after.toISOString();
}

export function createLiveActivityFactory<T extends object>(preset: string): LiveActivityFactory<T> {
  const active = new Map<string, LiveActivityInstance<T>>();

  class Instance implements LiveActivityInstance<T> {
    constructor(readonly id: string) {}

    async update(props: Partial<T>): Promise<void> {
      if (Platform.OS !== 'ios') return;
      await ExpoIslandKitModule.updateLiveActivity(preset, this.id, props as Record<string, unknown>);
    }

    async end(dismissalPolicy: DismissalPolicy = 'default', finalProps?: Partial<T>): Promise<void> {
      active.delete(this.id);
      if (Platform.OS !== 'ios') return;
      if (finalProps) {
        await ExpoIslandKitModule.updateLiveActivity(preset, this.id, finalProps as Record<string, unknown>);
      }
      await ExpoIslandKitModule.endLiveActivity(preset, this.id, serializeDismissalPolicy(dismissalPolicy));
    }
  }

  return {
    start(props: T, deepLinkUrl?: string): LiveActivityInstance<T> {
      const id = ExpoIslandKitModule.startLiveActivity(
        preset,
        props as unknown as Record<string, unknown>,
        deepLinkUrl ?? null,
      );
      const instance = new Instance(id);
      // Don't track a "" id (unsupported/disabled/failed) — the inert handle
      // still no-ops safely, but getActiveInstances() must not leak a ghost.
      if (id) {
        active.set(id, instance);
      }
      return instance;
    },

    getActiveInstances(): LiveActivityInstance<T>[] {
      return Array.from(active.values());
    },

    isSupported(): boolean {
      return Platform.OS === 'ios' && ExpoIslandKitModule.isLiveActivitySupported();
    },
  };
}
```

- [ ] **Step 7: Implement the two preset modules**

Create `src/presets/NowPlaying.ts`:
```ts
import { createLiveActivityFactory } from '../core/createLiveActivityFactory';

export interface NowPlayingProps {
  title: string;
  artist: string;
  artworkUrl?: string;
  artworkAsset?: string;
  isPlaying: boolean;
  elapsedSeconds: number;
  durationSeconds: number;
  accentColor?: string;
}

export const NowPlayingActivity = createLiveActivityFactory<NowPlayingProps>('nowPlaying');
```

Create `src/presets/GenericProgress.ts`:
```ts
import { createLiveActivityFactory } from '../core/createLiveActivityFactory';

export interface GenericProgressProps {
  title: string;
  subtitle?: string;
  progress: number; // 0–1
  iconSystemName?: string;
  accentColor?: string;
}

export const GenericProgressActivity = createLiveActivityFactory<GenericProgressProps>('genericProgress');
```

- [ ] **Step 8: Delete the old Now Playing files and re-export from index**

```bash
cd /Users/danemmanuel/Documents/islandkit/packages/expo-island-kit
git rm src/NowPlaying.ts src/__tests__/NowPlaying.test.ts
```

Replace `src/index.ts` with:
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

export { NowPlayingActivity, type NowPlayingProps } from './presets/NowPlaying';
export { GenericProgressActivity, type GenericProgressProps } from './presets/GenericProgress';
export type { DismissalPolicy, LiveActivityInstance, LiveActivityFactory } from './core/types';
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `cd /Users/danemmanuel/Documents/islandkit/packages/expo-island-kit && npx jest`
Expected: PASS — all tests in `createLiveActivityFactory.test.ts` green.

- [ ] **Step 10: Typecheck and rebuild the compiled output**

```bash
cd /Users/danemmanuel/Documents/islandkit
pnpm --filter expo-island-kit exec tsc --noEmit
pnpm --filter expo-island-kit build
```
Expected: both exit 0; `packages/expo-island-kit/build/core/createLiveActivityFactory.js` and `build/presets/NowPlaying.js` exist.

- [ ] **Step 11: Commit**

```bash
cd /Users/danemmanuel/Documents/islandkit
git add packages/expo-island-kit/src
git commit -m "feat: generic createLiveActivityFactory + NowPlaying/GenericProgress TS modules"
```

---

### Task 3: Swift core (engine + registry) + NowPlaying handler + rewire the module

Wires the new preset-agnostic Functions to a registry dispatching onto a generic engine, with NowPlaying as the first registered handler. Now Playing works end to end on the new surface.

**Files:**
- Create: `ios/core/PropCoercion.swift`, `ios/core/LiveActivityEngine.swift`, `ios/core/PresetRegistry.swift`, `ios/presets/NowPlayingHandler.swift`
- Modify: `ios/ExpoIslandKitModule.swift`

**Interfaces:**
- Consumes: the native surface names from Task 2 (`startLiveActivity`/`updateLiveActivity`/`endLiveActivity`/`isLiveActivitySupported`); `NowPlayingAttributes` from `ios/shared/` (Task 1).
- Produces: `protocol LiveActivityPresetHandler { var name; start(props,deepLinkUrl); update(id,props) async; end(id,dismissalPolicy) async }`; `enum LiveActivityEngine { start<A>/update<A>/end<A> }`; `enum PropCoercion`; `enum DismissalPolicyParser`; `enum PresetRegistry { handler(_ preset) }` (registers `NowPlayingHandler`); `struct NowPlayingHandler`. Task 4 registers a second handler.

- [ ] **Step 1: Shared prop coercion + dismissal-policy parser**

Create `ios/core/PropCoercion.swift`:
```swift
import ActivityKit
import Foundation

// Shared coercion helpers turning a JS [String: Any] props dict into typed values.
// `optString` distinguishes "key absent → keep previous value" from
// "key present but wrong type → nil".
enum PropCoercion {
  static func string(_ props: [String: Any], _ key: String, _ fallback: String) -> String {
    props[key] as? String ?? fallback
  }
  static func optString(_ props: [String: Any], _ key: String, _ fallback: String?) -> String? {
    props.keys.contains(key) ? props[key] as? String : fallback
  }
  static func bool(_ props: [String: Any], _ key: String, _ fallback: Bool) -> Bool {
    if let b = props[key] as? Bool { return b }
    if let n = props[key] as? NSNumber { return n.boolValue }
    return fallback
  }
  static func double(_ props: [String: Any], _ key: String, _ fallback: Double) -> Double {
    if let d = props[key] as? Double { return d }
    if let n = props[key] as? NSNumber { return n.doubleValue }
    return fallback
  }
}

// Parses the dismissal-policy string from JS: "immediate", "default", or an ISO-8601 date.
@available(iOS 16.2, *)
enum DismissalPolicyParser {
  static func parse(_ raw: String?) -> ActivityUIDismissalPolicy {
    switch raw {
    case "immediate":
      return .immediate
    case .some(let value) where value != "default":
      let formatter = ISO8601DateFormatter()
      formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
      if let date = formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value) {
        return .after(date)
      }
      return .default
    default:
      return .default
    }
  }
}
```

- [ ] **Step 2: Generic engine**

Create `ios/core/LiveActivityEngine.swift`:
```swift
import ActivityKit
import Foundation

// Generic ActivityKit operations, parameterized by the concrete ActivityAttributes
// type. All availability gating and error handling live here; handlers stay thin.
@available(iOS 16.2, *)
enum LiveActivityEngine {
  static func start<A: ActivityAttributes>(_ attributes: A, _ state: A.ContentState) -> String {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return "" }
    do {
      let activity = try Activity.request(
        attributes: attributes,
        content: ActivityContent(state: state, staleDate: nil)
      )
      return activity.id
    } catch {
      return ""
    }
  }

  static func update<A: ActivityAttributes>(
    _ type: A.Type,
    id: String,
    newState: (A.ContentState) -> A.ContentState
  ) async {
    guard let activity = Activity<A>.activities.first(where: { $0.id == id }) else { return }
    await activity.update(ActivityContent(state: newState(activity.content.state), staleDate: nil))
  }

  static func end<A: ActivityAttributes>(_ type: A.Type, id: String, dismissalPolicy raw: String?) async {
    guard let activity = Activity<A>.activities.first(where: { $0.id == id }) else { return }
    await activity.end(nil, dismissalPolicy: DismissalPolicyParser.parse(raw))
  }
}
```

- [ ] **Step 3: Protocol + registry**

Create `ios/core/PresetRegistry.swift`:
```swift
import Foundation

// A preset handler erases its concrete ActivityAttributes type so all presets share
// one registry. ActivityKit calls happen inside iOS 16.2 availability guards.
protocol LiveActivityPresetHandler {
  var name: String { get }
  @available(iOS 16.2, *) func start(props: [String: Any], deepLinkUrl: String?) -> String
  @available(iOS 16.2, *) func update(id: String, props: [String: Any]) async
  @available(iOS 16.2, *) func end(id: String, dismissalPolicy: String?) async
}

// Adding a preset = add its handler to `all`.
enum PresetRegistry {
  private static let all: [LiveActivityPresetHandler] = [
    NowPlayingHandler(),
  ]

  static func handler(_ preset: String) -> LiveActivityPresetHandler? {
    all.first { $0.name == preset }
  }
}
```

- [ ] **Step 4: NowPlaying handler + decoder**

Create `ios/presets/NowPlayingHandler.swift`:
```swift
import ActivityKit
import Foundation

struct NowPlayingHandler: LiveActivityPresetHandler {
  let name = "nowPlaying"

  @available(iOS 16.2, *)
  func start(props: [String: Any], deepLinkUrl: String?) -> String {
    LiveActivityEngine.start(
      NowPlayingAttributes(deepLinkUrl: deepLinkUrl),
      Self.contentState(from: props, base: nil)
    )
  }

  @available(iOS 16.2, *)
  func update(id: String, props: [String: Any]) async {
    await LiveActivityEngine.update(NowPlayingAttributes.self, id: id) { base in
      Self.contentState(from: props, base: base)
    }
  }

  @available(iOS 16.2, *)
  func end(id: String, dismissalPolicy: String?) async {
    await LiveActivityEngine.end(NowPlayingAttributes.self, id: id, dismissalPolicy: dismissalPolicy)
  }

  // JS props → ContentState. On update, keys absent from `props` keep their prior
  // value from `base`. `accentColor` maps to `accentColorHex` (the one rename).
  private static func contentState(
    from props: [String: Any],
    base: NowPlayingAttributes.ContentState?
  ) -> NowPlayingAttributes.ContentState {
    NowPlayingAttributes.ContentState(
      title: PropCoercion.string(props, "title", base?.title ?? ""),
      artist: PropCoercion.string(props, "artist", base?.artist ?? ""),
      artworkUrl: PropCoercion.optString(props, "artworkUrl", base?.artworkUrl),
      artworkAsset: PropCoercion.optString(props, "artworkAsset", base?.artworkAsset),
      isPlaying: PropCoercion.bool(props, "isPlaying", base?.isPlaying ?? false),
      elapsedSeconds: PropCoercion.double(props, "elapsedSeconds", base?.elapsedSeconds ?? 0),
      durationSeconds: PropCoercion.double(props, "durationSeconds", base?.durationSeconds ?? 0),
      accentColorHex: PropCoercion.optString(props, "accentColor", base?.accentColorHex)
    )
  }
}
```

- [ ] **Step 5: Replace the module Functions with the generic surface**

Replace `ios/ExpoIslandKitModule.swift` with:
```swift
import ExpoModulesCore
import ActivityKit
import Foundation

public class ExpoIslandKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoIslandKit")

    // Whether the user currently allows Live Activities. False on iOS < 16.1.
    AsyncFunction("areLiveActivitiesEnabled") { () -> Bool in
      if #available(iOS 16.1, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    // Synchronous "can I show a Live Activity right now?" — shared by every preset's
    // isSupported(). areActivitiesEnabled is Apple's documented gate (false on
    // incapable devices and when the user disabled Live Activities).
    Function("isLiveActivitySupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    // Starts a preset's activity, returning its id ("" when unsupported/unknown/failed).
    Function("startLiveActivity") { (preset: String, props: [String: Any], deepLinkUrl: String?) -> String in
      guard #available(iOS 16.2, *), let handler = PresetRegistry.handler(preset) else { return "" }
      return handler.start(props: props, deepLinkUrl: deepLinkUrl)
    }

    AsyncFunction("updateLiveActivity") { (preset: String, activityId: String, props: [String: Any]) -> Void in
      guard #available(iOS 16.2, *), let handler = PresetRegistry.handler(preset) else { return }
      await handler.update(id: activityId, props: props)
    }

    // dismissalPolicy: "default", "immediate", or an ISO-8601 date string.
    AsyncFunction("endLiveActivity") { (preset: String, activityId: String, dismissalPolicy: String?) -> Void in
      guard #available(iOS 16.2, *), let handler = PresetRegistry.handler(preset) else { return }
      await handler.end(id: activityId, dismissalPolicy: dismissalPolicy)
    }
  }
}
```

- [ ] **Step 6: Reinstall pods and build**

```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
(cd ios && pod install)
SIM=A7D7BEB3-8F26-4FA6-9043-231ED673927D
xcodebuild -workspace ios/example.xcworkspace -scheme example -configuration Debug \
  -destination "id=$SIM" build 2>&1 | tee /tmp/ik-task3.log | tail -30
grep -q "\*\* BUILD SUCCEEDED \*\*" /tmp/ik-task3.log && echo "BUILD OK"
```
Expected: `** BUILD SUCCEEDED **`. If the new `core/`/`presets/` files aren't compiled, run `CI=1 npx expo prebuild -p ios --clean` then rebuild (pod glob picks them up after a regen).

- [ ] **Step 7: Commit**

```bash
cd /Users/danemmanuel/Documents/islandkit
git add packages/expo-island-kit/ios
git commit -m "feat: registry + generic engine + NowPlaying handler; preset-agnostic bridge"
```

---

### Task 4: Generic Progress end to end (Attributes, handler, widget, example screen)

Adds the second preset across all layers, extracting the shared widget helpers it reuses. Proves a new preset = 1 Attributes + 1 handler + 1 registration line + 1 Widget + (already-done) 1 TS line.

**Files:**
- Create: `ios/shared/GenericProgressAttributes.swift` (+ widget symlink), `ios/presets/GenericProgressHandler.swift`, `apps/example/targets/island-kit-widget/WidgetSupport.swift`, `apps/example/targets/island-kit-widget/GenericProgressLiveActivity.swift`
- Modify: `ios/core/PresetRegistry.swift`, `apps/example/targets/island-kit-widget/NowPlayingLiveActivity.swift`, `apps/example/targets/island-kit-widget/IslandKitWidgetBundle.swift`, `apps/example/App.tsx`
- Delete: `apps/example/targets/island-kit-widget/Support/Color+Hex.swift`

**Interfaces:**
- Consumes: `LiveActivityPresetHandler`, `LiveActivityEngine`, `PropCoercion` (Task 3); `GenericProgressProps` shape (Task 2); shared render helpers below.
- Produces: `GenericProgressAttributes`; `struct GenericProgressHandler`; free funcs `accentColor(_:)`, `progressFraction(_:)`, `progressFraction(elapsed:duration:)`, `timeString(_:)` and `Color(hex:)` in `WidgetSupport.swift`; `struct GenericProgressLiveActivity: Widget`.

- [ ] **Step 1: Generic Progress Attributes (canonical) + widget symlink**

Create `packages/expo-island-kit/ios/shared/GenericProgressAttributes.swift`:
```swift
import ActivityKit
import Foundation

// Compiled into BOTH the app (pod) target and the widget target — the same
// ActivityAttributes type must exist in both. The widget target references this
// exact file via a symlink under apps/example/targets/island-kit-widget/.
public struct GenericProgressAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var title: String
    public var subtitle: String?
    public var progress: Double
    public var iconSystemName: String?
    public var accentColorHex: String?

    public init(
      title: String,
      subtitle: String? = nil,
      progress: Double,
      iconSystemName: String? = nil,
      accentColorHex: String? = nil
    ) {
      self.title = title
      self.subtitle = subtitle
      self.progress = progress
      self.iconSystemName = iconSystemName
      self.accentColorHex = accentColorHex
    }
  }

  public var deepLinkUrl: String?

  public init(deepLinkUrl: String? = nil) {
    self.deepLinkUrl = deepLinkUrl
  }
}
```

Symlink it into the widget target (mirror Task 1's mechanism; if Task 1 adopted the copy-step fallback, add this file to that copy-step instead):
```bash
cd /Users/danemmanuel/Documents/islandkit
ln -s ../../../../packages/expo-island-kit/ios/shared/GenericProgressAttributes.swift \
      apps/example/targets/island-kit-widget/GenericProgressAttributes.swift
git add apps/example/targets/island-kit-widget/GenericProgressAttributes.swift
```

- [ ] **Step 2: Generic Progress handler + decoder, register it**

Create `ios/presets/GenericProgressHandler.swift`:
```swift
import ActivityKit
import Foundation

struct GenericProgressHandler: LiveActivityPresetHandler {
  let name = "genericProgress"

  @available(iOS 16.2, *)
  func start(props: [String: Any], deepLinkUrl: String?) -> String {
    LiveActivityEngine.start(
      GenericProgressAttributes(deepLinkUrl: deepLinkUrl),
      Self.contentState(from: props, base: nil)
    )
  }

  @available(iOS 16.2, *)
  func update(id: String, props: [String: Any]) async {
    await LiveActivityEngine.update(GenericProgressAttributes.self, id: id) { base in
      Self.contentState(from: props, base: base)
    }
  }

  @available(iOS 16.2, *)
  func end(id: String, dismissalPolicy: String?) async {
    await LiveActivityEngine.end(GenericProgressAttributes.self, id: id, dismissalPolicy: dismissalPolicy)
  }

  private static func contentState(
    from props: [String: Any],
    base: GenericProgressAttributes.ContentState?
  ) -> GenericProgressAttributes.ContentState {
    GenericProgressAttributes.ContentState(
      title: PropCoercion.string(props, "title", base?.title ?? ""),
      subtitle: PropCoercion.optString(props, "subtitle", base?.subtitle),
      progress: PropCoercion.double(props, "progress", base?.progress ?? 0),
      iconSystemName: PropCoercion.optString(props, "iconSystemName", base?.iconSystemName),
      accentColorHex: PropCoercion.optString(props, "accentColor", base?.accentColorHex)
    )
  }
}
```

Edit `ios/core/PresetRegistry.swift` — add the handler to `all`:
```swift
  private static let all: [LiveActivityPresetHandler] = [
    NowPlayingHandler(),
    GenericProgressHandler(),
  ]
```

- [ ] **Step 3: Extract shared widget helpers into `WidgetSupport.swift`, delete the old Color helper**

Create `apps/example/targets/island-kit-widget/WidgetSupport.swift`:
```swift
import SwiftUI

// Shared render helpers used by every preset widget. Take primitives so they're
// preset-agnostic.

extension Color {
  // Parses "#RRGGBB" / "RRGGBB" / "#RRGGBBAA". Returns nil on malformed input.
  init?(hex: String?) {
    guard let hex else { return nil }
    var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") { s.removeFirst() }
    guard s.count == 6 || s.count == 8, let value = UInt64(s, radix: 16) else { return nil }
    let r, g, b, a: Double
    if s.count == 6 {
      r = Double((value & 0xFF0000) >> 16) / 255
      g = Double((value & 0x00FF00) >> 8) / 255
      b = Double(value & 0x0000FF) / 255
      a = 1
    } else {
      r = Double((value & 0xFF000000) >> 24) / 255
      g = Double((value & 0x00FF0000) >> 16) / 255
      b = Double((value & 0x0000FF00) >> 8) / 255
      a = Double(value & 0x000000FF) / 255
    }
    self = Color(.sRGB, red: r, green: g, blue: b, opacity: a)
  }
}

// Accent from a hex string, falling back to the system accent.
func accentColor(_ hex: String?) -> Color {
  Color(hex: hex) ?? .accentColor
}

// Clamp a raw fraction into [0, 1].
func progressFraction(_ value: Double) -> Double {
  min(max(value, 0), 1)
}

// Fraction from elapsed/duration, guarding divide-by-zero.
func progressFraction(elapsed: Double, duration: Double) -> Double {
  guard duration > 0 else { return 0 }
  return progressFraction(elapsed / duration)
}

// mm:ss formatting.
func timeString(_ seconds: Double) -> String {
  let total = Int(seconds.rounded())
  return String(format: "%d:%02d", total / 60, total % 60)
}
```

Delete the old helper:
```bash
cd /Users/danemmanuel/Documents/islandkit
git rm apps/example/targets/island-kit-widget/Support/Color+Hex.swift
```

- [ ] **Step 4: Refactor the Now Playing widget to use the shared helpers**

Replace `apps/example/targets/island-kit-widget/NowPlayingLiveActivity.swift` with:
```swift
import ActivityKit
import WidgetKit
import SwiftUI

// Square artwork: remote image when a URL is present, else an SF Symbol placeholder.
private struct Artwork: View {
  let state: NowPlayingAttributes.ContentState

  var body: some View {
    if let urlString = state.artworkUrl, let url = URL(string: urlString) {
      AsyncImage(url: url) { image in
        image.resizable().aspectRatio(contentMode: .fill)
      } placeholder: {
        placeholder
      }
    } else {
      placeholder
    }
  }

  private var placeholder: some View {
    ZStack {
      Rectangle().fill(.quaternary)
      Image(systemName: "music.note").foregroundStyle(.secondary)
    }
  }
}

private struct NowPlayingLockScreenView: View {
  let context: ActivityViewContext<NowPlayingAttributes>

  var body: some View {
    HStack(spacing: 12) {
      Artwork(state: context.state)
        .frame(width: 56, height: 56)
        .clipShape(RoundedRectangle(cornerRadius: 8))
      VStack(alignment: .leading, spacing: 4) {
        Text(context.state.title).font(.headline).lineLimit(1)
        Text(context.state.artist).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
        ProgressView(value: progressFraction(elapsed: context.state.elapsedSeconds, duration: context.state.durationSeconds))
          .tint(accentColor(context.state.accentColorHex))
        HStack {
          Text(timeString(context.state.elapsedSeconds))
          Spacer()
          Text(timeString(context.state.durationSeconds))
        }
        .font(.caption2)
        .foregroundStyle(.secondary)
      }
      Image(systemName: context.state.isPlaying ? "pause.fill" : "play.fill")
        .font(.title2)
        .foregroundStyle(accentColor(context.state.accentColorHex))
    }
    .padding()
  }
}

struct NowPlayingLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: NowPlayingAttributes.self) { context in
      NowPlayingLockScreenView(context: context)
        .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Artwork(state: context.state)
            .frame(width: 44, height: 44)
            .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(timeString(context.state.durationSeconds))
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 6) {
            Text(context.state.title).font(.headline).lineLimit(1)
            Text(context.state.artist).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
            ProgressView(value: progressFraction(elapsed: context.state.elapsedSeconds, duration: context.state.durationSeconds))
              .tint(accentColor(context.state.accentColorHex))
          }
        }
      } compactLeading: {
        Artwork(state: context.state)
          .frame(width: 20, height: 20)
          .clipShape(RoundedRectangle(cornerRadius: 4))
      } compactTrailing: {
        Image(systemName: context.state.isPlaying ? "pause.fill" : "play.fill")
          .foregroundStyle(accentColor(context.state.accentColorHex))
      } minimal: {
        Image(systemName: context.state.isPlaying ? "pause.fill" : "play.fill")
          .foregroundStyle(accentColor(context.state.accentColorHex))
      }
      .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
      .keylineTint(accentColor(context.state.accentColorHex))
    }
  }
}
```

- [ ] **Step 5: Generic Progress widget**

Create `apps/example/targets/island-kit-widget/GenericProgressLiveActivity.swift`:
```swift
import ActivityKit
import WidgetKit
import SwiftUI

private struct GPIcon: View {
  let systemName: String?
  var body: some View { Image(systemName: systemName ?? "circle.dashed") }
}

private struct GenericProgressLockScreenView: View {
  let context: ActivityViewContext<GenericProgressAttributes>

  var body: some View {
    HStack(spacing: 12) {
      GPIcon(systemName: context.state.iconSystemName)
        .font(.title2)
        .foregroundStyle(accentColor(context.state.accentColorHex))
        .frame(width: 40)
      VStack(alignment: .leading, spacing: 4) {
        Text(context.state.title).font(.headline).lineLimit(1)
        if let subtitle = context.state.subtitle {
          Text(subtitle).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
        }
        ProgressView(value: progressFraction(context.state.progress))
          .tint(accentColor(context.state.accentColorHex))
      }
    }
    .padding()
  }
}

struct GenericProgressLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: GenericProgressAttributes.self) { context in
      GenericProgressLockScreenView(context: context)
        .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          GPIcon(systemName: context.state.iconSystemName)
            .font(.title3)
            .foregroundStyle(accentColor(context.state.accentColorHex))
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 6) {
            Text(context.state.title).font(.headline).lineLimit(1)
            if let subtitle = context.state.subtitle {
              Text(subtitle).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
            }
            ProgressView(value: progressFraction(context.state.progress))
              .tint(accentColor(context.state.accentColorHex))
          }
        }
      } compactLeading: {
        GPIcon(systemName: context.state.iconSystemName)
          .foregroundStyle(accentColor(context.state.accentColorHex))
      } compactTrailing: {
        Text("\(Int(progressFraction(context.state.progress) * 100))%")
          .font(.caption2)
          .foregroundStyle(.secondary)
      } minimal: {
        GPIcon(systemName: context.state.iconSystemName)
          .foregroundStyle(accentColor(context.state.accentColorHex))
      }
      .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
      .keylineTint(accentColor(context.state.accentColorHex))
    }
  }
}
```

- [ ] **Step 6: Register both widgets in the bundle**

Replace `apps/example/targets/island-kit-widget/IslandKitWidgetBundle.swift` with:
```swift
import SwiftUI
import WidgetKit

@main
struct IslandKitWidgetBundle: WidgetBundle {
  var body: some Widget {
    NowPlayingLiveActivity()
    GenericProgressLiveActivity()
  }
}
```

- [ ] **Step 7: Add Generic Progress controls to the example screen**

Replace `apps/example/App.tsx` with:
```tsx
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  GenericProgressActivity,
  NowPlayingActivity,
  type GenericProgressProps,
  type LiveActivityInstance,
  type NowPlayingProps,
} from 'expo-island-kit';

const DURATION = 231;

const nowPlayingProps: NowPlayingProps = {
  title: 'Midnight City',
  artist: 'M83',
  artworkUrl: 'https://picsum.photos/seed/islandkit/300',
  isPlaying: true,
  elapsedSeconds: 12,
  durationSeconds: DURATION,
  accentColor: '#FF375F',
};

const genericProgressProps: GenericProgressProps = {
  title: 'Uploading backup',
  subtitle: '128 of 400 photos',
  progress: 0.32,
  iconSystemName: 'icloud.and.arrow.up',
  accentColor: '#0A84FF',
};

export default function App() {
  const supported = NowPlayingActivity.isSupported();

  const npRef = useRef<LiveActivityInstance<NowPlayingProps> | null>(null);
  const [npStatus, setNpStatus] = useState('Idle');
  const [elapsed, setElapsed] = useState(nowPlayingProps.elapsedSeconds);
  const [playing, setPlaying] = useState(nowPlayingProps.isPlaying);

  const gpRef = useRef<LiveActivityInstance<GenericProgressProps> | null>(null);
  const [gpStatus, setGpStatus] = useState('Idle');
  const [progress, setProgress] = useState(genericProgressProps.progress);

  function startNp() {
    const i = NowPlayingActivity.start(nowPlayingProps, 'islandkitexample://now-playing');
    npRef.current = i;
    setNpStatus(i.id ? `Started (${i.id.slice(0, 8)}…)` : 'Start returned no id');
  }
  async function bumpNp() {
    const i = npRef.current;
    if (!i) return setNpStatus('No active activity — press Start');
    const nextElapsed = Math.min(elapsed + 30, DURATION);
    const nextPlaying = !playing;
    setElapsed(nextElapsed);
    setPlaying(nextPlaying);
    await i.update({ elapsedSeconds: nextElapsed, isPlaying: nextPlaying });
    setNpStatus(`Updated → ${nextElapsed}s, ${nextPlaying ? 'playing' : 'paused'}`);
  }
  async function stopNp() {
    const i = npRef.current;
    if (!i) return setNpStatus('No active activity — press Start');
    await i.end('immediate');
    npRef.current = null;
    setNpStatus('Ended');
  }

  function startGp() {
    const i = GenericProgressActivity.start(genericProgressProps, 'islandkitexample://backup');
    gpRef.current = i;
    setGpStatus(i.id ? `Started (${i.id.slice(0, 8)}…)` : 'Start returned no id');
  }
  async function bumpGp() {
    const i = gpRef.current;
    if (!i) return setGpStatus('No active activity — press Start');
    const next = Math.min(progress + 0.2, 1);
    setProgress(next);
    await i.update({ progress: next, subtitle: `${Math.round(next * 400)} of 400 photos` });
    setGpStatus(`Updated → ${Math.round(next * 100)}%`);
  }
  async function stopGp() {
    const i = gpRef.current;
    if (!i) return setGpStatus('No active activity — press Start');
    await i.end('immediate');
    gpRef.current = null;
    setGpStatus('Ended');
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>IslandKit</Text>
      <Text style={styles.line}>Supported: {supported ? 'yes' : 'no'}</Text>

      <Text style={styles.section}>Now Playing</Text>
      <Text style={styles.status}>{npStatus}</Text>
      <Button label="Start" onPress={startNp} />
      <Button label="Update (+30s, toggle play)" onPress={bumpNp} />
      <Button label="End" onPress={stopNp} tone="#FF375F" />

      <Text style={styles.section}>Generic Progress</Text>
      <Text style={styles.status}>{gpStatus}</Text>
      <Button label="Start" onPress={startGp} />
      <Button label="Update (+20%)" onPress={bumpGp} />
      <Button label="End" onPress={stopGp} tone="#FF375F" />

      <StatusBar style="auto" />
    </ScrollView>
  );
}

function Button({ label, onPress, tone = '#0A84FF' }: { label: string; onPress: () => void; tone?: string }) {
  return (
    <Pressable style={[styles.button, { backgroundColor: tone }]} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', gap: 10, padding: 24, paddingTop: 72 },
  title: { fontSize: 24, fontWeight: '700' },
  line: { fontSize: 15, color: '#333' },
  section: { fontSize: 18, fontWeight: '700', marginTop: 20 },
  status: { fontSize: 14, color: '#666', textAlign: 'center' },
  button: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, minWidth: 260, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 8: Typecheck the example app**

Run: `cd /Users/danemmanuel/Documents/islandkit && pnpm --filter example exec tsc --noEmit`
Expected: exit 0 (`GenericProgressActivity`, `GenericProgressProps` resolve from the package `build/`; if not, run `pnpm --filter expo-island-kit build` first).

- [ ] **Step 9: Regenerate native (widget target picks up the new files) and build**

```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
CI=1 npx expo prebuild -p ios --clean
SIM=A7D7BEB3-8F26-4FA6-9043-231ED673927D
xcodebuild -workspace ios/example.xcworkspace -scheme example -configuration Debug \
  -destination "id=$SIM" build 2>&1 | tee /tmp/ik-task4.log | tail -30
grep -q "\*\* BUILD SUCCEEDED \*\*" /tmp/ik-task4.log && echo "BUILD OK"
test -L apps/example/targets/island-kit-widget/GenericProgressAttributes.swift && echo "GP symlink survived --clean"
```
Expected: `** BUILD SUCCEEDED **` (app + widget with both preset widgets); GP symlink still a symlink.

- [ ] **Step 10: Commit**

```bash
cd /Users/danemmanuel/Documents/islandkit
git add packages/expo-island-kit/ios apps/example
git commit -m "feat: add Generic Progress preset end to end + shared widget helpers"
```

---

### Task 5: End-to-end simulator verification + DoD sign-off

No code — runs both presets on the iPhone 17 Pro simulator and records DoD status + evidence. Uses the Phase-2 simulator techniques (see the `islandkit-build-state` memory: foreground the app via `simctl launch <bundleid>`; reveal the DI by foregrounding `com.apple.mobilesafari`; broken watchman means restart Metro to pick up JS edits).

**Files:** none (verification + ledger/memory + evidence).

- [ ] **Step 1: Boot, build, install, launch**

```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
SIM=A7D7BEB3-8F26-4FA6-9043-231ED673927D
xcrun simctl boot "$SIM" 2>/dev/null; open -a Simulator
CI=1 npx expo run:ios --device "$SIM"
```
Expected: app launches showing "IslandKit / Supported: yes" with Now Playing and Generic Progress sections.

- [ ] **Step 2: Verify Now Playing start/update/end**

Drive Start → Update → End for the Now Playing group (via the app buttons; if automating, use the Phase-2 technique: foreground the app with `simctl launch io.github.Justdan111.islandkitexample`, reveal the DI by launching Safari). Screenshot the DI after Start to `docs/superpowers/evidence/phase3-01-nowplaying.png`. Confirm the pill appears, updates, and disappears on End.

- [ ] **Step 3: Verify Generic Progress start/update/end**

Same for the Generic Progress group. After Start, the DI shows the `icloud.and.arrow.up` glyph (compactLeading) + a percentage (compactTrailing). Update advances the percentage; End removes it. Screenshot to `docs/superpowers/evidence/phase3-02-genericprogress.png`.

- [ ] **Step 4: Confirm no forbidden entitlements + single-source Attributes**

```bash
cd /Users/danemmanuel/Documents/islandkit
grep -rInE "application-groups|aps-environment|Push Notifications|appleTeamId|getPushToken" \
  apps/example/app.json apps/example/targets packages/expo-island-kit \
  | grep -viE "//|/\*|note:|forbid|do not|phase 5" || echo "CLEAN: no App Group / Push / appleTeamId"
find packages/expo-island-kit/ios/shared apps/example/targets/island-kit-widget -name "*Attributes.swift" -type l -o -name "*Attributes.swift" -type f | sort
```
Expected: `CLEAN`; each `*Attributes.swift` appears once as a real file under `ios/shared/` and once as a symlink under the widget target.

- [ ] **Step 5: Update ledger + memory, write evidence README, commit**

Append a "Phase 3 complete" section to `.superpowers/sdd/progress.md` (adopted de-dup mechanism: symlink or copy-step; both presets verified on sim; DoD status). Update the `islandkit-build-state` memory. Write `docs/superpowers/evidence/phase3-README.md` noting: both presets validated on the simulator; **this is not on-device visual sign-off** (per the DoD caveat). Commit:
```bash
cd /Users/danemmanuel/Documents/islandkit
git add docs/superpowers/evidence
git commit -m "chore: phase 3 generalize-pattern verified on simulator + evidence"
```

**Definition of done (from the spec) — check each:**
- [ ] Shared-Attributes de-dup proven: each `*Attributes.swift` single-source, compiles into both targets, survives `prebuild --clean` (Task 1; re-confirmed Task 4 Step 9).
- [ ] `NowPlayingActivity` migrated onto the abstraction; public TS API unchanged; Jest green (Task 2).
- [ ] `GenericProgressActivity` added end to end, canonical prop shape (Tasks 2, 4).
- [ ] App + `island-kit-widget` build succeeds; both widgets registered (Task 4).
- [ ] Both presets Start/Update/End verified on the iPhone 17 Pro simulator (Steps 2–3).
- [ ] No App Group / Push / `appleTeamId`; no SDK bump; no push-token API surface (Step 4).
- [ ] **Not** a visual sign-off on device — recorded as simulator-only (Step 5).

---

## Self-Review

**Spec coverage (§1–7):**
- §2.1 TS generic factory + preset-agnostic native surface → Task 2. ✓
- §2.2 Swift registry + type-erased handlers + generic engine → Task 3. ✓
- §2.3 bespoke widgets + shared `WidgetSupport` + bundle → Task 4. ✓
- §2.4 shared-Attributes de-dup + spike-first + copy fallback → Task 1 (+ Task 4 Step 1 mirrors it). ✓
- §3 Generic Progress canonical props + widget layout → Tasks 2 (TS), 4 (Swift+widget). ✓
- §4 back-compat (NowPlaying public API unchanged) → Task 2 keeps `NowPlayingProps`/factory shape; Jest asserts. ✓
- §5 testing → Task 2 Jest; Tasks 3–4 native builds; Task 5 sim. ✓
- §6 DoD incl. visual-caveat → Task 5. ✓

**Placeholder scan:** every code step shows complete code; no TBD/TODO; the fallback (Task 1 Step 3) is a concrete described mechanism, not a placeholder. ✓

**Type consistency:** native surface identical across Task 2 TS decl, Task 2 mock, Task 2 web stub, and Task 3 Swift Functions (`startLiveActivity(preset,props,deepLink)→String` sync; `updateLiveActivity(preset,id,props)`/`endLiveActivity(preset,id,policy)` async; `isLiveActivitySupported()→Bool` sync). `LiveActivityPresetHandler` signatures match between the protocol (Task 3 Step 3), `NowPlayingHandler` (Task 3 Step 4), and `GenericProgressHandler` (Task 4 Step 2). `accentColor→accentColorHex` rename consistent in both decoders. Widget helper names (`accentColor`, `progressFraction`, `timeString`, `Color(hex:)`) defined in Task 4 Step 3 and used in Steps 4–5. ✓

**Known risk flagged for execution:** whether apple-targets compiles a symlinked source and re-wires it after `prebuild --clean` is unproven — Task 1 is the gate, with the copy-step fallback. The `@available` on protocol requirements (Task 3 Step 3) may need adjustment in Swift 6.2; fallback is to gate inside handlers / register only on iOS 16.2+.
