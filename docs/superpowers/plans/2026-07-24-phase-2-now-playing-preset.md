# Phase 2 — Now Playing Preset (End to End) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a complete, working **Now Playing** Live Activity / Dynamic Island preset — TypeScript API → Expo native bridge → ActivityKit → SwiftUI widget extension — verifiable end to end in the example app.

**Architecture:** JS calls `NowPlayingActivity.start(props, deepLinkUrl)` → Expo Modules `Function`/`AsyncFunction` bridge in `packages/expo-island-kit/ios` → `Activity<NowPlayingAttributes>.request/update/end` (ActivityKit) → SwiftUI in the `@bacons/apple-targets` widget extension renders the Dynamic Island regions + Lock Screen banner. `NowPlayingAttributes` is defined identically in both the module pod (app target) and the widget target — the standard no-App-Group ActivityKit sharing pattern.

**Tech Stack:** Expo SDK 55 (RN 0.83.6, React 19.2), TypeScript 5.9 strict, Swift 6.2 / ActivityKit / WidgetKit / SwiftUI, `@bacons/apple-targets@^5.0.0`, Jest (jest-expo) for the TS layer.

## Global Constraints

Copied verbatim from CLAUDE.md — every task's requirements implicitly include these:

- **iOS only.** No Android code, config, or Android-conditional branches. Cross-platform JS must no-op safely on non-iOS (web stub).
- **Pinned to Expo SDK 55** (RN 0.83.6). Do NOT bump the SDK — Xcode 26.0.1 cannot build SDK 56+ (`weak let` / Swift 6.3).
- **No App Groups** capability/entitlement anywhere (app target, widget target, `app.json`, entitlements). ActivityKit delivers ContentState to the widget through the framework directly.
- **No Push Notifications** capability, `aps-environment`, or ActivityKit push-token code. That is Phase 5, blocked on a paid account. If you reach for a push token, stop.
- **Do NOT set `appleTeamId`** in `app.json` or code. Signing is manual per-machine (Personal Team, free Apple ID).
- App bundle id stays `io.github.Justdan111.islandkitexample`; widget extension bundle id is `io.github.Justdan111.islandkitexample.widget`. Keep globally unique.
- **TypeScript:** strict mode, **no `any` in public API surface**, exported types match the spec's field names exactly.
- **Swift:** lowerCamelCase functions/properties, UpperCamelCase types; `struct` (not `class`) for `ActivityAttributes`/`ContentState` (`Codable, Hashable`). No third-party Swift deps in the widget extension.
- **Commit style:** conventional commits (`feat:`, `fix:`, `chore:`).
- **Module `main` is the compiled `build/` dir.** After editing `packages/expo-island-kit/src`, regenerate `build/` (`pnpm --filter expo-island-kit build`) before the example app can consume the new API.
- Verification target for this phase is the **iPhone 17 Pro simulator** (id discoverable via `xcrun simctl list devices | grep "iPhone 17 Pro"`) — it renders Dynamic Island + Live Activities. The physical-device checkbox in the DoD remains the developer's one-time manual signing step (`docs/phase-1-device-signing.md`).

---

## File Structure

**Created:**
- `packages/expo-island-kit/src/NowPlaying.ts` — the `NowPlayingActivity` factory, `NowPlayingProps`, and the shared `LiveActivityInstance`/`LiveActivityFactory` types.
- `packages/expo-island-kit/src/__tests__/NowPlaying.test.ts` — Jest tests for the factory (native module mocked).
- `packages/expo-island-kit/ios/NowPlayingAttributes.swift` — `ActivityAttributes` + `ContentState` (app-target copy, compiled into the pod).
- `apps/example/targets/island-kit-widget/expo-target.config.js` — apple-targets widget target declaration.
- `apps/example/targets/island-kit-widget/NowPlayingAttributes.swift` — identical copy for the widget target.
- `apps/example/targets/island-kit-widget/NowPlayingLiveActivity.swift` — the `Widget` (Dynamic Island + Lock Screen SwiftUI).
- `apps/example/targets/island-kit-widget/IslandKitWidgetBundle.swift` — `@main` `WidgetBundle`.
- `apps/example/targets/island-kit-widget/Support/Color+Hex.swift` — `Color(hex:)` helper (widget-local).

**Modified:**
- `packages/expo-island-kit/src/ExpoIslandKitModule.ts` — add native method declarations.
- `packages/expo-island-kit/src/ExpoIslandKitModule.web.ts` — add no-op stubs.
- `packages/expo-island-kit/src/index.ts` — re-export the Now Playing API.
- `packages/expo-island-kit/ios/ExpoIslandKitModule.swift` — add `startNowPlaying` / `updateNowPlaying` / `endNowPlaying` / `isNowPlayingSupported`.
- `apps/example/app.json` — add `plugins: ["@bacons/apple-targets"]` and `ios.infoPlist.NSSupportsLiveActivities: true`.
- `apps/example/package.json` — add `@bacons/apple-targets` dev dependency.
- `apps/example/App.tsx` — Now Playing manual test harness (Start / Update / End buttons).

---

### Task 1: TypeScript public API (`NowPlayingActivity` factory)

TDD-able in isolation with Jest by mocking the native module. This task ships the entire consumer-facing surface; the native calls are mocked here and wired for real in Task 2.

**Files:**
- Create: `packages/expo-island-kit/src/NowPlaying.ts`
- Create: `packages/expo-island-kit/src/__tests__/NowPlaying.test.ts`
- Modify: `packages/expo-island-kit/src/ExpoIslandKitModule.ts`
- Modify: `packages/expo-island-kit/src/ExpoIslandKitModule.web.ts`
- Modify: `packages/expo-island-kit/src/index.ts`

**Interfaces:**
- Consumes: the native module default export (mocked in tests; implemented in Task 2). Expected native surface:
  - `startNowPlaying(props: Record<string, unknown>, deepLinkUrl: string | null): string` — **synchronous**, returns the ActivityKit id.
  - `updateNowPlaying(activityId: string, props: Record<string, unknown>): Promise<void>`
  - `endNowPlaying(activityId: string, dismissalPolicy: string | null): Promise<void>`
  - `isNowPlayingSupported(): boolean` — **synchronous**.
  - `areLiveActivitiesEnabled(): Promise<boolean>` — already exists, unchanged.
- Produces (consumed by Task 4 + package consumers):
  - `interface NowPlayingProps { title: string; artist: string; artworkUrl?: string; artworkAsset?: string; isPlaying: boolean; elapsedSeconds: number; durationSeconds: number; accentColor?: string; }`
  - `interface LiveActivityInstance<T> { readonly id: string; update(props: Partial<T>): Promise<void>; end(dismissalPolicy?: 'default' | 'immediate' | { after: Date }, finalProps?: Partial<T>): Promise<void>; }`
  - `interface LiveActivityFactory<T> { start(props: T, deepLinkUrl?: string): LiveActivityInstance<T>; getActiveInstances(): LiveActivityInstance<T>[]; isSupported(): boolean; }`
  - `const NowPlayingActivity: LiveActivityFactory<NowPlayingProps>`
  - Dismissal-policy serialization: `'default' → "default"`, `'immediate' → "immediate"`, `{ after: Date } → date.toISOString()`.

- [ ] **Step 1: Add native method declarations to the TS native-module type**

Modify `packages/expo-island-kit/src/ExpoIslandKitModule.ts` to:

```ts
import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoIslandKitModule extends NativeModule<Record<string, never>> {
  areLiveActivitiesEnabled(): Promise<boolean>;
  isNowPlayingSupported(): boolean;
  startNowPlaying(props: Record<string, unknown>, deepLinkUrl: string | null): string;
  updateNowPlaying(activityId: string, props: Record<string, unknown>): Promise<void>;
  endNowPlaying(activityId: string, dismissalPolicy: string | null): Promise<void>;
}

export default requireNativeModule<ExpoIslandKitModule>('ExpoIslandKit');
```

- [ ] **Step 2: Add web/non-native no-op stubs**

Modify `packages/expo-island-kit/src/ExpoIslandKitModule.web.ts` to:

```ts
// Web/non-native stub: Live Activities are iOS-only, so everything no-ops.
export default {
  async areLiveActivitiesEnabled(): Promise<boolean> {
    return false;
  },
  isNowPlayingSupported(): boolean {
    return false;
  },
  startNowPlaying(_props: Record<string, unknown>, _deepLinkUrl: string | null): string {
    return '';
  },
  async updateNowPlaying(_activityId: string, _props: Record<string, unknown>): Promise<void> {},
  async endNowPlaying(_activityId: string, _dismissalPolicy: string | null): Promise<void> {},
};
```

- [ ] **Step 3: Write the failing test**

Create `packages/expo-island-kit/src/__tests__/NowPlaying.test.ts`:

```ts
const native = {
  isNowPlayingSupported: jest.fn(() => true),
  startNowPlaying: jest.fn((_props: Record<string, unknown>, _deepLink: string | null) => 'activity-1'),
  updateNowPlaying: jest.fn(async () => {}),
  endNowPlaying: jest.fn(async () => {}),
  areLiveActivitiesEnabled: jest.fn(async () => true),
};

jest.mock('../ExpoIslandKitModule', () => ({ __esModule: true, default: native }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { NowPlayingActivity, NowPlayingProps } from '../NowPlaying';

const baseProps: NowPlayingProps = {
  title: 'Song',
  artist: 'Artist',
  isPlaying: true,
  elapsedSeconds: 10,
  durationSeconds: 200,
};

beforeEach(() => {
  jest.clearAllMocks();
  native.isNowPlayingSupported.mockReturnValue(true);
  native.startNowPlaying.mockReturnValue('activity-1');
  // End any leftover instances from a previous test.
  NowPlayingActivity.getActiveInstances().forEach((i) => i.end('immediate'));
  jest.clearAllMocks();
});

test('start passes props + deepLink to native and returns an instance carrying the native id', () => {
  const instance = NowPlayingActivity.start(baseProps, 'myapp://now-playing');
  expect(native.startNowPlaying).toHaveBeenCalledWith(baseProps, 'myapp://now-playing');
  expect(instance.id).toBe('activity-1');
});

test('start with no deepLink passes null', () => {
  NowPlayingActivity.start(baseProps);
  expect(native.startNowPlaying).toHaveBeenCalledWith(baseProps, null);
});

test('update forwards the partial props under the instance id', async () => {
  const instance = NowPlayingActivity.start(baseProps);
  await instance.update({ isPlaying: false, elapsedSeconds: 42 });
  expect(native.updateNowPlaying).toHaveBeenCalledWith('activity-1', { isPlaying: false, elapsedSeconds: 42 });
});

test("end maps 'immediate' policy and removes the instance from getActiveInstances", async () => {
  const instance = NowPlayingActivity.start(baseProps);
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(1);
  await instance.end('immediate');
  expect(native.endNowPlaying).toHaveBeenCalledWith('activity-1', 'immediate');
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(0);
});

test("end defaults to 'default' policy when none given", async () => {
  const instance = NowPlayingActivity.start(baseProps);
  await instance.end();
  expect(native.endNowPlaying).toHaveBeenCalledWith('activity-1', 'default');
});

test('end serializes { after: Date } to an ISO string', async () => {
  const instance = NowPlayingActivity.start(baseProps);
  const after = new Date('2030-01-01T00:00:00.000Z');
  await instance.end({ after });
  expect(native.endNowPlaying).toHaveBeenCalledWith('activity-1', '2030-01-01T00:00:00.000Z');
});

test('end applies finalProps via update before ending', async () => {
  const instance = NowPlayingActivity.start(baseProps);
  await instance.end('default', { isPlaying: false });
  expect(native.updateNowPlaying).toHaveBeenCalledWith('activity-1', { isPlaying: false });
  expect(native.endNowPlaying).toHaveBeenCalled();
});

test('isSupported reflects the native capability check', () => {
  native.isNowPlayingSupported.mockReturnValue(false);
  expect(NowPlayingActivity.isSupported()).toBe(false);
  native.isNowPlayingSupported.mockReturnValue(true);
  expect(NowPlayingActivity.isSupported()).toBe(true);
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd /Users/danemmanuel/Documents/islandkit/packages/expo-island-kit && npx jest src/__tests__/NowPlaying.test.ts`
Expected: FAIL — `Cannot find module '../NowPlaying'` (file not created yet).

- [ ] **Step 5: Implement the factory**

Create `packages/expo-island-kit/src/NowPlaying.ts`:

```ts
import { Platform } from 'react-native';

import ExpoIslandKitModule from './ExpoIslandKitModule';

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

function serializeDismissalPolicy(policy: DismissalPolicy): string {
  if (policy === 'default' || policy === 'immediate') {
    return policy;
  }
  return policy.after.toISOString();
}

const active = new Map<string, LiveActivityInstance<NowPlayingProps>>();

class NowPlayingInstance implements LiveActivityInstance<NowPlayingProps> {
  constructor(readonly id: string) {}

  async update(props: Partial<NowPlayingProps>): Promise<void> {
    if (Platform.OS !== 'ios') return;
    await ExpoIslandKitModule.updateNowPlaying(this.id, props as Record<string, unknown>);
  }

  async end(dismissalPolicy: DismissalPolicy = 'default', finalProps?: Partial<NowPlayingProps>): Promise<void> {
    active.delete(this.id);
    if (Platform.OS !== 'ios') return;
    if (finalProps) {
      await ExpoIslandKitModule.updateNowPlaying(this.id, finalProps as Record<string, unknown>);
    }
    await ExpoIslandKitModule.endNowPlaying(this.id, serializeDismissalPolicy(dismissalPolicy));
  }
}

export const NowPlayingActivity: LiveActivityFactory<NowPlayingProps> = {
  start(props: NowPlayingProps, deepLinkUrl?: string): LiveActivityInstance<NowPlayingProps> {
    const id = ExpoIslandKitModule.startNowPlaying(props as unknown as Record<string, unknown>, deepLinkUrl ?? null);
    const instance = new NowPlayingInstance(id);
    active.set(id, instance);
    return instance;
  },

  getActiveInstances(): LiveActivityInstance<NowPlayingProps>[] {
    return Array.from(active.values());
  },

  isSupported(): boolean {
    return Platform.OS === 'ios' && ExpoIslandKitModule.isNowPlayingSupported();
  },
};
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd /Users/danemmanuel/Documents/islandkit/packages/expo-island-kit && npx jest src/__tests__/NowPlaying.test.ts`
Expected: PASS — all 8 tests green.

- [ ] **Step 7: Re-export the public API from the package entry point**

Modify `packages/expo-island-kit/src/index.ts` — append after the existing `areLiveActivitiesEnabled` export:

```ts
export {
  NowPlayingActivity,
  type NowPlayingProps,
  type DismissalPolicy,
  type LiveActivityInstance,
  type LiveActivityFactory,
} from './NowPlaying';
```

- [ ] **Step 8: Typecheck the whole workspace**

Run: `cd /Users/danemmanuel/Documents/islandkit && pnpm --filter expo-island-kit exec tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 9: Rebuild the compiled package output (example app consumes `build/`)**

Run: `cd /Users/danemmanuel/Documents/islandkit && pnpm --filter expo-island-kit build`
Expected: exit 0; `packages/expo-island-kit/build/NowPlaying.js` + `.d.ts` exist.

- [ ] **Step 10: Commit**

```bash
cd /Users/danemmanuel/Documents/islandkit
git add packages/expo-island-kit/src packages/expo-island-kit/build
git commit -m "feat: add NowPlayingActivity TypeScript API and factory"
```

---

### Task 2: Swift native bridge + `NowPlayingAttributes` (app-target copy)

Wires the real ActivityKit calls into the Expo module. `NowPlayingAttributes` here is compiled into the app target via the module pod, so `Activity<NowPlayingAttributes>` is available to the bridge. An identical copy lands in the widget target in Task 3.

**Files:**
- Create: `packages/expo-island-kit/ios/NowPlayingAttributes.swift`
- Modify: `packages/expo-island-kit/ios/ExpoIslandKitModule.swift`

**Interfaces:**
- Consumes: the props dict shape produced by Task 1 (`NowPlayingProps` field names: `title`, `artist`, `artworkUrl`, `artworkAsset`, `isPlaying`, `elapsedSeconds`, `durationSeconds`, `accentColor`) and the dismissal-policy strings (`"default"`, `"immediate"`, ISO-8601 date string).
- Produces (consumed by Task 3's widget, which must define an **identical** `NowPlayingAttributes`):
  - `struct NowPlayingAttributes: ActivityAttributes` with `var deepLinkUrl: String?` and nested `ContentState` fields: `title: String`, `artist: String`, `artworkUrl: String?`, `artworkAsset: String?`, `isPlaying: Bool`, `elapsedSeconds: Double`, `durationSeconds: Double`, `accentColorHex: String?`.

- [ ] **Step 1: Create the shared attributes struct (app-target copy)**

Create `packages/expo-island-kit/ios/NowPlayingAttributes.swift`:

```swift
import ActivityKit
import Foundation

// NOTE: This struct is duplicated verbatim in the widget target
// (apps/example/targets/island-kit-widget/NowPlayingAttributes.swift).
// ActivityKit requires the same ActivityAttributes type in both the app and
// the widget extension. Keep the two files byte-for-byte identical.
// Phase 3 will extract this into a shared location to remove the duplication.
public struct NowPlayingAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var title: String
    public var artist: String
    public var artworkUrl: String?
    public var artworkAsset: String?
    public var isPlaying: Bool
    public var elapsedSeconds: Double
    public var durationSeconds: Double
    public var accentColorHex: String?

    public init(
      title: String,
      artist: String,
      artworkUrl: String? = nil,
      artworkAsset: String? = nil,
      isPlaying: Bool,
      elapsedSeconds: Double,
      durationSeconds: Double,
      accentColorHex: String? = nil
    ) {
      self.title = title
      self.artist = artist
      self.artworkUrl = artworkUrl
      self.artworkAsset = artworkAsset
      self.isPlaying = isPlaying
      self.elapsedSeconds = elapsedSeconds
      self.durationSeconds = durationSeconds
      self.accentColorHex = accentColorHex
    }
  }

  public var deepLinkUrl: String?

  public init(deepLinkUrl: String? = nil) {
    self.deepLinkUrl = deepLinkUrl
  }
}
```

- [ ] **Step 2: Add the bridge functions to the module**

Replace `packages/expo-island-kit/ios/ExpoIslandKitModule.swift` with:

```swift
import ExpoModulesCore
import ActivityKit
import Foundation

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

    // Synchronous capability check used by NowPlayingActivity.isSupported().
    Function("isNowPlayingSupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    // Starts a Now Playing Live Activity and returns its id synchronously.
    // Returns "" when unsupported / disabled (JS treats "" as a no-op handle).
    Function("startNowPlaying") { (props: [String: Any], deepLinkUrl: String?) -> String in
      guard #available(iOS 16.2, *), ActivityAuthorizationInfo().areActivitiesEnabled else {
        return ""
      }
      let state = Self.contentState(from: props, base: nil)
      let attributes = NowPlayingAttributes(deepLinkUrl: deepLinkUrl)
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

    // Applies a partial update to an existing activity.
    AsyncFunction("updateNowPlaying") { (activityId: String, props: [String: Any]) -> Void in
      guard #available(iOS 16.2, *) else { return }
      guard let activity = Activity<NowPlayingAttributes>.activities.first(where: { $0.id == activityId }) else {
        return
      }
      let newState = Self.contentState(from: props, base: activity.content.state)
      await activity.update(ActivityContent(state: newState, staleDate: nil))
    }

    // Ends an activity with the given dismissal policy.
    // policy: "default", "immediate", or an ISO-8601 date string ({ after: Date }).
    AsyncFunction("endNowPlaying") { (activityId: String, dismissalPolicy: String?) -> Void in
      guard #available(iOS 16.2, *) else { return }
      guard let activity = Activity<NowPlayingAttributes>.activities.first(where: { $0.id == activityId }) else {
        return
      }
      await activity.end(nil, dismissalPolicy: Self.dismissalPolicy(from: dismissalPolicy))
    }
  }

  // MARK: - Helpers

  @available(iOS 16.2, *)
  private static func dismissalPolicy(from raw: String?) -> ActivityUIDismissalPolicy {
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

  // Builds a ContentState from a JS props dict. When `base` is provided
  // (updates), only the keys present in `props` override it (partial update).
  private static func contentState(
    from props: [String: Any],
    base: NowPlayingAttributes.ContentState?
  ) -> NowPlayingAttributes.ContentState {
    func string(_ key: String, _ fallback: String) -> String { props[key] as? String ?? fallback }
    func optString(_ key: String, _ fallback: String?) -> String? {
      props.keys.contains(key) ? props[key] as? String : fallback
    }
    func bool(_ key: String, _ fallback: Bool) -> Bool {
      if let b = props[key] as? Bool { return b }
      if let n = props[key] as? NSNumber { return n.boolValue }
      return fallback
    }
    func double(_ key: String, _ fallback: Double) -> Double {
      if let d = props[key] as? Double { return d }
      if let n = props[key] as? NSNumber { return n.doubleValue }
      return fallback
    }

    return NowPlayingAttributes.ContentState(
      title: string("title", base?.title ?? ""),
      artist: string("artist", base?.artist ?? ""),
      artworkUrl: optString("artworkUrl", base?.artworkUrl),
      artworkAsset: optString("artworkAsset", base?.artworkAsset),
      isPlaying: bool("isPlaying", base?.isPlaying ?? false),
      elapsedSeconds: double("elapsedSeconds", base?.elapsedSeconds ?? 0),
      durationSeconds: double("durationSeconds", base?.durationSeconds ?? 0),
      accentColorHex: optString("accentColor", base?.accentColorHex)
    )
  }
}
```

- [ ] **Step 3: Reinstall pods so the new Swift file + functions are picked up**

Run:
```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
npx expo prebuild -p ios
cd ios && pod install && cd ..
```
Expected: `pod install` completes; `ExpoIslandKit` appears in `ios/Podfile.lock` and `NowPlayingAttributes.swift` is in the ExpoIslandKit pod sources.

- [ ] **Step 4: Compile the app target to verify the Swift builds**

Run:
```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
SIM=$(xcrun simctl list devices available | grep "iPhone 17 Pro " | head -1 | grep -oE '[0-9A-F-]{36}')
xcodebuild -workspace ios/example.xcworkspace -scheme example -configuration Debug \
  -destination "id=$SIM" -derivedDataPath ios/build build 2>&1 | tail -30
```
Expected: `** BUILD SUCCEEDED **`. If it fails on ActivityKit API availability, confirm the `@available(iOS 16.2, *)` guards are intact (module deployment target is 15.1).

- [ ] **Step 5: Commit**

```bash
cd /Users/danemmanuel/Documents/islandkit
git add packages/expo-island-kit/ios
git commit -m "feat: add ActivityKit start/update/end bridge for Now Playing"
```

---

### Task 3: Widget extension (apple-targets) + Now Playing SwiftUI

Scaffolds the WidgetKit extension via `@bacons/apple-targets`, adds the identical `NowPlayingAttributes`, and implements every Dynamic Island region + the Lock Screen banner.

**Files:**
- Modify: `apps/example/package.json`
- Modify: `apps/example/app.json`
- Create: `apps/example/targets/island-kit-widget/expo-target.config.js`
- Create: `apps/example/targets/island-kit-widget/NowPlayingAttributes.swift`
- Create: `apps/example/targets/island-kit-widget/Support/Color+Hex.swift`
- Create: `apps/example/targets/island-kit-widget/NowPlayingLiveActivity.swift`
- Create: `apps/example/targets/island-kit-widget/IslandKitWidgetBundle.swift`

**Interfaces:**
- Consumes: `NowPlayingAttributes` (must match Task 2's struct byte-for-byte) and its `ContentState` fields for rendering.
- Produces: a `NowPlayingLiveActivity: Widget` registered in a `@main WidgetBundle`, rendering `.compactLeading` / `.compactTrailing` / `.minimal` / `.expanded(.leading/.trailing/.bottom)` and a Lock Screen view.

- [ ] **Step 1: Add the apple-targets dev dependency to the example app**

Run:
```bash
cd /Users/danemmanuel/Documents/islandkit
pnpm --filter example add -D @bacons/apple-targets@^5.0.0
```
Expected: `@bacons/apple-targets` in `apps/example/package.json` devDependencies; install succeeds.

- [ ] **Step 2: Register the config plugin and enable Live Activities in `app.json`**

Modify `apps/example/app.json` so the `expo` object includes `plugins` and `ios.infoPlist` (keep the existing `bundleIdentifier` and `supportsTablet`):

```json
{
  "expo": {
    "name": "example",
    "slug": "example",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "ios": {
      "bundleIdentifier": "io.github.Justdan111.islandkitexample",
      "supportsTablet": false,
      "infoPlist": {
        "NSSupportsLiveActivities": true
      }
    },
    "plugins": ["@bacons/apple-targets"],
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

- [ ] **Step 3: Declare the widget target**

Create `apps/example/targets/island-kit-widget/expo-target.config.js`:

```js
/** @type {(config: { name: string }) => import('@bacons/apple-targets').Config} */
module.exports = (config) => ({
  type: 'widget',
  name: 'island-kit-widget',
  deploymentTarget: '16.2',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
});
```

- [ ] **Step 4: Add the identical attributes struct to the widget target**

Create `apps/example/targets/island-kit-widget/NowPlayingAttributes.swift` — **byte-for-byte identical** to `packages/expo-island-kit/ios/NowPlayingAttributes.swift` (copy that file's exact contents, including the duplication note comment).

```bash
cp /Users/danemmanuel/Documents/islandkit/packages/expo-island-kit/ios/NowPlayingAttributes.swift \
   /Users/danemmanuel/Documents/islandkit/apps/example/targets/island-kit-widget/NowPlayingAttributes.swift
```

- [ ] **Step 5: Add the hex-color helper**

Create `apps/example/targets/island-kit-widget/Support/Color+Hex.swift`:

```swift
import SwiftUI

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
```

- [ ] **Step 6: Implement the Live Activity SwiftUI**

Create `apps/example/targets/island-kit-widget/NowPlayingLiveActivity.swift`:

```swift
import ActivityKit
import WidgetKit
import SwiftUI

// Accent color from state, falling back to the system accent.
private func accent(_ state: NowPlayingAttributes.ContentState) -> Color {
  Color(hex: state.accentColorHex) ?? .accentColor
}

private func progress(_ state: NowPlayingAttributes.ContentState) -> Double {
  guard state.durationSeconds > 0 else { return 0 }
  return min(max(state.elapsedSeconds / state.durationSeconds, 0), 1)
}

private func timeString(_ seconds: Double) -> String {
  let total = Int(seconds.rounded())
  return String(format: "%d:%02d", total / 60, total % 60)
}

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
        ProgressView(value: progress(context.state)).tint(accent(context.state))
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
        .foregroundStyle(accent(context.state))
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
            ProgressView(value: progress(context.state)).tint(accent(context.state))
          }
        }
      } compactLeading: {
        Artwork(state: context.state)
          .frame(width: 20, height: 20)
          .clipShape(RoundedRectangle(cornerRadius: 4))
      } compactTrailing: {
        Image(systemName: context.state.isPlaying ? "pause.fill" : "play.fill")
          .foregroundStyle(accent(context.state))
      } minimal: {
        Image(systemName: context.state.isPlaying ? "pause.fill" : "play.fill")
          .foregroundStyle(accent(context.state))
      }
      .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
      .keylineTint(accent(context.state))
    }
  }
}
```

- [ ] **Step 7: Add the `@main` widget bundle**

Create `apps/example/targets/island-kit-widget/IslandKitWidgetBundle.swift`:

```swift
import SwiftUI
import WidgetKit

@main
struct IslandKitWidgetBundle: WidgetBundle {
  var body: some Widget {
    NowPlayingLiveActivity()
  }
}
```

- [ ] **Step 8: Prebuild + pod install so the target is generated and linked**

Run:
```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
npx expo prebuild -p ios
cd ios && pod install && cd ..
```
Expected: prebuild reports the apple-targets plugin adding the `island-kit-widget` target; `ios/example.xcodeproj` contains the widget extension target; `pod install` succeeds. Confirm `NSSupportsLiveActivities` landed in `ios/example/Info.plist`.

- [ ] **Step 9: Build the app + widget extension for the simulator**

Run:
```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
SIM=$(xcrun simctl list devices available | grep "iPhone 17 Pro " | head -1 | grep -oE '[0-9A-F-]{36}')
xcodebuild -workspace ios/example.xcworkspace -scheme example -configuration Debug \
  -destination "id=$SIM" -derivedDataPath ios/build build 2>&1 | tail -40
```
Expected: `** BUILD SUCCEEDED **` (both the app and the `island-kit-widget` extension compile and link). If the widget scheme is separate, also build it; the app scheme should embed the extension.

- [ ] **Step 10: Commit**

```bash
cd /Users/danemmanuel/Documents/islandkit
git add apps/example/package.json apps/example/app.json apps/example/targets pnpm-lock.yaml
git commit -m "feat: add island-kit-widget target with Now Playing Live Activity UI"
```

---

### Task 4: Example app Now Playing test harness

Adds the manual test screen with Start / Update / End buttons wired to the real API.

**Files:**
- Modify: `apps/example/App.tsx`

**Interfaces:**
- Consumes: `NowPlayingActivity`, `NowPlayingProps`, `LiveActivityInstance` from `expo-island-kit` (Task 1).

- [ ] **Step 1: Replace `App.tsx` with the Now Playing harness**

Replace `apps/example/App.tsx` with:

```tsx
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  NowPlayingActivity,
  type LiveActivityInstance,
  type NowPlayingProps,
} from 'expo-island-kit';

const DURATION = 231;

const initialProps: NowPlayingProps = {
  title: 'Midnight City',
  artist: 'M83',
  artworkUrl: 'https://picsum.photos/seed/islandkit/300',
  isPlaying: true,
  elapsedSeconds: 12,
  durationSeconds: DURATION,
  accentColor: '#FF375F',
};

export default function App() {
  const instanceRef = useRef<LiveActivityInstance<NowPlayingProps> | null>(null);
  const [status, setStatus] = useState('Idle');
  const [elapsed, setElapsed] = useState(initialProps.elapsedSeconds);
  const [playing, setPlaying] = useState(initialProps.isPlaying);

  const supported = NowPlayingActivity.isSupported();

  function start() {
    const instance = NowPlayingActivity.start(initialProps, 'islandkitexample://now-playing');
    instanceRef.current = instance;
    setStatus(instance.id ? `Started (${instance.id.slice(0, 8)}…)` : 'Start returned no id (unsupported?)');
  }

  async function bump() {
    const instance = instanceRef.current;
    if (!instance) return setStatus('No active activity — press Start');
    const nextElapsed = Math.min(elapsed + 30, DURATION);
    const nextPlaying = !playing;
    setElapsed(nextElapsed);
    setPlaying(nextPlaying);
    await instance.update({ elapsedSeconds: nextElapsed, isPlaying: nextPlaying });
    setStatus(`Updated → ${nextElapsed}s, ${nextPlaying ? 'playing' : 'paused'}`);
  }

  async function stop() {
    const instance = instanceRef.current;
    if (!instance) return setStatus('No active activity — press Start');
    await instance.end('immediate');
    instanceRef.current = null;
    setElapsed(initialProps.elapsedSeconds);
    setPlaying(initialProps.isPlaying);
    setStatus('Ended');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>IslandKit — Now Playing</Text>
      <Text style={styles.line}>Supported: {supported ? 'yes' : 'no'}</Text>
      <Text style={styles.status}>{status}</Text>

      <Button label="Start" onPress={start} />
      <Button label="Update (+30s, toggle play)" onPress={bump} />
      <Button label="End" onPress={stop} tone="#FF375F" />

      <StatusBar style="auto" />
    </View>
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
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', gap: 12, padding: 24 },
  title: { fontSize: 24, fontWeight: '700' },
  line: { fontSize: 15, color: '#333' },
  status: { fontSize: 14, color: '#666', marginBottom: 8, textAlign: 'center' },
  button: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, minWidth: 260, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 2: Typecheck the example app**

Run: `cd /Users/danemmanuel/Documents/islandkit && pnpm --filter example exec tsc --noEmit`
Expected: exit 0, no errors (`NowPlayingActivity`, `NowPlayingProps`, `LiveActivityInstance` resolve from the package's `build/` types).

- [ ] **Step 3: Commit**

```bash
cd /Users/danemmanuel/Documents/islandkit
git add apps/example/App.tsx
git commit -m "feat: add Now Playing manual test screen to example app"
```

---

### Task 5: End-to-end simulator verification + DoD sign-off

No code — this task runs the app on the iPhone 17 Pro simulator and verifies the Phase 2 Definition of Done, capturing evidence.

**Files:** none (verification + progress ledger update).

- [ ] **Step 1: Boot the simulator and install/run the app**

Run:
```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
SIM=$(xcrun simctl list devices available | grep "iPhone 17 Pro " | head -1 | grep -oE '[0-9A-F-]{36}')
xcrun simctl boot "$SIM" 2>/dev/null; open -a Simulator
npx expo run:ios --device "$SIM"
```
Expected: app builds, installs, and launches showing "IslandKit — Now Playing" with `Supported: yes`.

- [ ] **Step 2: Verify Start → Dynamic Island pill appears**

Tap **Start** in the app. Then capture the Dynamic Island:
```bash
xcrun simctl io "$SIM" screenshot /Users/danemmanuel/Documents/islandkit/docs/superpowers/evidence/phase2-01-start.png
```
Expected: a Dynamic Island pill is visible with artwork (compact leading) and a play/pause glyph (compact trailing). Confirm by viewing the screenshot.

- [ ] **Step 3: Verify long-press expands to the full layout**

Long-press the Dynamic Island (click-and-hold in the simulator). Screenshot to `phase2-02-expanded.png`.
Expected: expanded region shows artwork (leading), duration (trailing), and title/artist/progress bar (bottom).

- [ ] **Step 4: Verify Update visibly changes content**

Tap **Update (+30s, toggle play)**. Screenshot to `phase2-03-updated.png`.
Expected: progress bar advances and the compact-trailing glyph flips play↔pause.

- [ ] **Step 5: Verify Lock Screen banner**

Lock the simulator (Device ▸ Lock, or `xcrun simctl` UI), screenshot to `phase2-04-lockscreen.png`.
Expected: full-width banner with artwork, title, artist, progress, timestamps.

- [ ] **Step 6: Verify End removes the activity**

Unlock, tap **End**. Screenshot to `phase2-05-ended.png`.
Expected: the Dynamic Island pill / activity is gone; app shows "Ended".

- [ ] **Step 7: Confirm no forbidden entitlements were added**

Run:
```bash
cd /Users/danemmanuel/Documents/islandkit
grep -rInE "App Group|com\.apple\.security\.application-groups|aps-environment|Push Notifications|appleTeamId" \
  apps/example/app.json apps/example/ios apps/example/targets packages/expo-island-kit || echo "CLEAN: no App Group / Push / appleTeamId references"
```
Expected: `CLEAN: no App Group / Push / appleTeamId references` (ignore any hit that is purely a comment forbidding them).

- [ ] **Step 8: Update the progress ledger and memory**

Append a "Phase 2 complete" section to `.superpowers/sdd/progress.md` recording commits and DoD status, and update the `islandkit-build-state` memory. Commit:
```bash
cd /Users/danemmanuel/Documents/islandkit
git add .superpowers docs/superpowers/evidence
git commit -m "chore: phase 2 now-playing verified on simulator + evidence"
```

**Phase 2 Definition of Done (from CLAUDE.md) — check each:**
- [ ] `NowPlayingActivity.start()` produces a visible Dynamic Island pill (Step 2).
- [ ] Long-press expands to title/artist/progress (Step 3).
- [ ] `.update()` visibly changes content (Step 4).
- [ ] `.end()` removes the activity (Step 6).
- [ ] Lock Screen banner shows the same content (Step 5).
- [ ] No App Group or Push Notification entitlements added (Step 7).
- [ ] Runs via `npx expo run:ios` without manual Xcode intervention (Step 1).
- [ ] Physical-device pill (Dynamic Island hardware) — **deferred** to the developer's manual signing run (`docs/phase-1-device-signing.md`); simulator covers functional DoD.

---

## Self-Review

**Spec coverage (CLAUDE.md Phase 2 §1–5 + DoD):**
- §1 Attributes/ContentState → Task 2 Step 1 (all fields present; everything mutable in ContentState, `deepLinkUrl` fixed). ✓
- §2 SwiftUI all regions + Lock Screen + accent color from prop w/ system fallback → Task 3 Step 6. ✓ (compactLeading artwork, compactTrailing glyph, minimal glyph, expanded leading/trailing/bottom, lock screen banner, `accent()` falls back to `.accentColor`).
- §3 Bridge `startNowPlaying`/`updateNowPlaying`/`endNowPlaying` + unsupported no-op → Task 2 Step 2 (returns "" / no-ops when `areActivitiesEnabled` false or iOS < 16.2). ✓
- §4 TS API exact shape (`NowPlayingProps`, `LiveActivityInstance<T>`, `LiveActivityFactory<T>`, `NowPlayingActivity`) → Task 1 Step 5, field names verbatim; push-token API omitted per spec. ✓
- §5 Example screen with Start/Update/End → Task 4. ✓
- DoD → Task 5 checklist. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases". Every code step shows complete code. The one `cp` step (Task 3 Step 4) references the exact source file created in Task 2 Step 1. ✓

**Type consistency:** Native surface declared identically in Task 1 (`ExpoIslandKitModule.ts`), Task 1 mock, and Task 2 Swift — `startNowPlaying(props, deepLinkUrl)→String` sync, `updateNowPlaying(id, props)→Promise`, `endNowPlaying(id, policy)→Promise`, `isNowPlayingSupported()→Bool`. ContentState field names match between Task 2 Swift, Task 3 widget, and the JS `NowPlayingProps` (`accentColor` in JS maps to `accentColorHex` in Swift via `contentState(from:)` — the one intentional rename, handled in the decoder). ✓

**Known risk flagged for execution:** `@bacons/apple-targets@5` `expo-target.config.js` exact schema (Task 3 Step 3) and whether prebuild wires `NSSupportsLiveActivities` + the widget target cleanly on Expo SDK 55 could not be verified against live docs (network was down during planning). If prebuild rejects the config shape, run `npx expo prebuild` output to see the expected keys and adjust — this is the single most likely place to need an empirical fix.
