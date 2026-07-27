# Phase 4 — Delivery + Timer Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Delivery and Timer presets end to end on the Phase-3 registry/protocol abstraction, extending shared code only with generic coercion primitives (`PropCoercion.optDouble`, `PropCoercion.date`) and a generic Date→ISO step in the factory.

**Architecture:** Each preset = 1 `*Attributes.swift` (canonical in `ios/shared/`, symlinked into the widget target) + 1 `*Handler.swift` (decoder → generic `LiveActivityEngine`) + 1 line in `PresetRegistry.all` + 1 `*LiveActivity.swift` widget + 1 `presets/*.ts` TS module + 1 `index.ts` export. Timer's `endDate: Date` is serialized to ISO by the shared factory and parsed back by `PropCoercion.date`; its countdown renders via native `Text(timerInterval:)`.

**Tech Stack:** Expo SDK 55 (RN 0.83.6, React 19.2), TypeScript 5.9 strict, Swift 6.2 / ActivityKit / WidgetKit / SwiftUI, `@bacons/apple-targets@5`, Jest (jest-expo).

## Global Constraints

- **iOS only.** No Android. Pinned Expo SDK 55 — no bump.
- **No App Groups / Push / `aps-environment` / push-token code.** `ios.appleTeamId: A66QV2FW3V` stays. No new paid-only capabilities.
- **TS:** strict, no `any` in public API; prop field names verbatim from `docs/islandkit-full-documentation.md` §10.
- **Swift:** lowerCamelCase members, UpperCamelCase types; `struct` ActivityAttributes/ContentState (`Codable, Hashable`); ActivityKit guarded `@available(iOS 16.2, *)`, graceful no-op/"".
- **Abstraction bar (the heart of the phase):** the ONLY shared-code changes permitted are `PropCoercion.optDouble` + `PropCoercion.date`, the factory Date→ISO serialization, two `PresetRegistry.all` lines, and `index.ts` re-exports. `LiveActivityEngine.swift`, the `LiveActivityPresetHandler` protocol, `core/types.ts`, and the `LiveActivityInstance`/`LiveActivityFactory` contracts stay UNTOUCHED. If a preset needs any other shared change, STOP and flag it.
- **No breaking change** to `NowPlaying`/`GenericProgress` public TS shapes.
- **`build/` is git-ignored**; after editing `src/`, run `pnpm --filter expo-island-kit build` before the example consumes it. After a src *restructure*, clean-rebuild (`rm -rf build && build`) — `tsc` doesn't delete orphans.
- **Verification target:** iPhone 17 Pro simulator (id `A7D7BEB3-8F26-4FA6-9043-231ED673927D`). Sim ≠ on-device visual sign-off.
- Bundle ids unchanged. Widget-target de-dup files reach the widget via symlinks under `apps/example/targets/island-kit-widget/` (proven in Phase 3; survives `expo prebuild --clean`).

## Build-tooling notes (apply to every native build step)

- A single Bash call caps at 10 min (600000ms). Set `timeout: 600000` on prebuild/xcodebuild and run them in the FOREGROUND; if one hits the cap, RE-RUN it (incremental continuation is fast). A Bash timeout is NOT a build failure — only `** BUILD SUCCEEDED **` or real compiler errors are verdicts. Do NOT background a build and yield.
- Adding a new widget Swift file + a new symlink requires the widget target regenerated: use `CI=1 npx expo prebuild -p ios --clean` (plain prebuild hits an apple-targets `removeFromProject` quirk), then a separate `xcodebuild`. Adding only pod files can use `cd ios && pod install` then `xcodebuild`.
- Build cmd: `xcodebuild -workspace ios/example.xcworkspace -scheme example -configuration Debug -destination "id=A7D7BEB3-8F26-4FA6-9043-231ED673927D" build`.
- SourceKit/IDE diagnostics ("unavailable in macOS", "Cannot find X in scope", "No such module ExpoModulesCore", result-builder availability) on the iOS-only files are EXPECTED false positives — only the `xcodebuild` result counts.

---

## File Structure

**Created:** `src/presets/Delivery.ts`, `src/presets/Timer.ts`; `ios/shared/DeliveryAttributes.swift`, `ios/shared/TimerAttributes.swift` (+ widget symlinks); `ios/presets/DeliveryHandler.swift`, `ios/presets/TimerHandler.swift`; `apps/example/targets/island-kit-widget/DeliveryLiveActivity.swift`, `.../TimerLiveActivity.swift`.
**Modified:** `ios/core/PropCoercion.swift` (+`optDouble`, +`date`); `ios/core/PresetRegistry.swift` (+2 lines); `src/core/createLiveActivityFactory.ts` (Date→ISO) + its test; `src/index.ts` (+2 exports); `apps/example/targets/island-kit-widget/IslandKitWidgetBundle.swift` (+2 widgets); `apps/example/App.tsx` (+2 sections); `docs/islandkit-full-documentation.md` (§8.3 `currentEndDate` correction).

---

### Task 1: Delivery preset end to end

Pure pattern application except one generic coercion primitive (`PropCoercion.optDouble` for optional `etaMinutes`). Proves a 3rd preset is cheap.

**Files:**
- Create: `packages/expo-island-kit/src/presets/Delivery.ts`
- Modify: `packages/expo-island-kit/src/index.ts`
- Modify: `packages/expo-island-kit/ios/core/PropCoercion.swift`
- Create: `packages/expo-island-kit/ios/shared/DeliveryAttributes.swift` (+ widget symlink)
- Create: `packages/expo-island-kit/ios/presets/DeliveryHandler.swift`
- Modify: `packages/expo-island-kit/ios/core/PresetRegistry.swift`
- Create: `apps/example/targets/island-kit-widget/DeliveryLiveActivity.swift`
- Modify: `apps/example/targets/island-kit-widget/IslandKitWidgetBundle.swift`
- Modify: `apps/example/App.tsx`

**Interfaces:**
- Consumes: `createLiveActivityFactory` (Phase 3), `LiveActivityPresetHandler`/`LiveActivityEngine`/`PropCoercion` (Phase 3), `presetAccentColor` (WidgetSupport).
- Produces: `DeliveryActivity`/`DeliveryProps`; `struct DeliveryAttributes`; `struct DeliveryHandler`; `PropCoercion.optDouble`; `struct DeliveryLiveActivity: Widget`.

- [ ] **Step 1: TS preset module + export**

Create `packages/expo-island-kit/src/presets/Delivery.ts`:
```ts
import { createLiveActivityFactory } from '../core/createLiveActivityFactory';

export interface DeliveryProps {
  status: 'confirmed' | 'preparing' | 'onTheWay' | 'delivered';
  etaMinutes?: number;
  courierName?: string;
  orderNumber: string;
  mapSnapshotUrl?: string;
  accentColor?: string;
}

export const DeliveryActivity = createLiveActivityFactory<DeliveryProps>('delivery');
```

Append to `packages/expo-island-kit/src/index.ts` (after the GenericProgress export):
```ts
export { DeliveryActivity, type DeliveryProps } from './presets/Delivery';
```

- [ ] **Step 2: Typecheck + rebuild build/**

Run: `cd /Users/danemmanuel/Documents/islandkit && pnpm --filter expo-island-kit exec tsc --noEmit && pnpm --filter expo-island-kit build`
Expected: exit 0; `build/presets/Delivery.js` exists.

- [ ] **Step 3: Add the `optDouble` generic coercion primitive**

In `packages/expo-island-kit/ios/core/PropCoercion.swift`, add inside `enum PropCoercion` (after `double`):
```swift
  // Optional double: absent key → keep `fallback`; present → coerce (or nil if mistyped).
  static func optDouble(_ props: [String: Any], _ key: String, _ fallback: Double?) -> Double? {
    guard props.keys.contains(key) else { return fallback }
    if let d = props[key] as? Double { return d }
    if let n = props[key] as? NSNumber { return n.doubleValue }
    return nil
  }
```

- [ ] **Step 4: Delivery Attributes (canonical) + widget symlink**

Create `packages/expo-island-kit/ios/shared/DeliveryAttributes.swift`:
```swift
import ActivityKit
import Foundation

// Compiled into BOTH the app (pod) target and the widget target (via a symlink under
// apps/example/targets/island-kit-widget/). `orderNumber` is immutable for the
// activity's life, so it lives on the Attributes, not ContentState.
public struct DeliveryAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var status: String
    public var etaMinutes: Double?
    public var courierName: String?
    public var mapSnapshotUrl: String?
    public var accentColorHex: String?

    public init(
      status: String,
      etaMinutes: Double? = nil,
      courierName: String? = nil,
      mapSnapshotUrl: String? = nil,
      accentColorHex: String? = nil
    ) {
      self.status = status
      self.etaMinutes = etaMinutes
      self.courierName = courierName
      self.mapSnapshotUrl = mapSnapshotUrl
      self.accentColorHex = accentColorHex
    }
  }

  public var orderNumber: String
  public var deepLinkUrl: String?

  public init(orderNumber: String, deepLinkUrl: String? = nil) {
    self.orderNumber = orderNumber
    self.deepLinkUrl = deepLinkUrl
  }
}
```

Create the widget symlink:
```bash
cd /Users/danemmanuel/Documents/islandkit
ln -s ../../../../packages/expo-island-kit/ios/shared/DeliveryAttributes.swift \
      apps/example/targets/island-kit-widget/DeliveryAttributes.swift
git add apps/example/targets/island-kit-widget/DeliveryAttributes.swift
```

- [ ] **Step 5: Delivery handler + decoder, register it**

Create `packages/expo-island-kit/ios/presets/DeliveryHandler.swift`:
```swift
import ActivityKit
import Foundation

struct DeliveryHandler: LiveActivityPresetHandler {
  let name = "delivery"

  @available(iOS 16.2, *)
  func start(props: [String: Any], deepLinkUrl: String?) -> String {
    let orderNumber = PropCoercion.string(props, "orderNumber", "")
    return LiveActivityEngine.start(
      DeliveryAttributes(orderNumber: orderNumber, deepLinkUrl: deepLinkUrl),
      Self.contentState(from: props, base: nil)
    )
  }

  @available(iOS 16.2, *)
  func update(id: String, props: [String: Any]) async {
    await LiveActivityEngine.update(DeliveryAttributes.self, id: id) { base in
      Self.contentState(from: props, base: base)
    }
  }

  @available(iOS 16.2, *)
  func end(id: String, dismissalPolicy: String?) async {
    await LiveActivityEngine.end(DeliveryAttributes.self, id: id, dismissalPolicy: dismissalPolicy)
  }

  // `orderNumber` is intentionally NOT decoded here — it is immutable and lives on
  // the Attributes (set at start). `accentColor` → `accentColorHex` (the rename).
  private static func contentState(
    from props: [String: Any],
    base: DeliveryAttributes.ContentState?
  ) -> DeliveryAttributes.ContentState {
    DeliveryAttributes.ContentState(
      status: PropCoercion.string(props, "status", base?.status ?? "confirmed"),
      etaMinutes: PropCoercion.optDouble(props, "etaMinutes", base?.etaMinutes),
      courierName: PropCoercion.optString(props, "courierName", base?.courierName),
      mapSnapshotUrl: PropCoercion.optString(props, "mapSnapshotUrl", base?.mapSnapshotUrl),
      accentColorHex: PropCoercion.optString(props, "accentColor", base?.accentColorHex)
    )
  }
}
```

In `packages/expo-island-kit/ios/core/PresetRegistry.swift`, append to the `all` array:
```swift
    DeliveryHandler(),
```

- [ ] **Step 6: Delivery widget (defensive map snapshot)**

Create `apps/example/targets/island-kit-widget/DeliveryLiveActivity.swift`:
```swift
import ActivityKit
import WidgetKit
import SwiftUI

private func deliveryIcon(_ status: String) -> String {
  switch status {
  case "confirmed": return "checkmark.circle.fill"
  case "preparing": return "shippingbox.fill"
  case "onTheWay": return "bicycle"
  case "delivered": return "house.fill"
  default: return "shippingbox"
  }
}

private func deliveryLabel(_ status: String) -> String {
  switch status {
  case "confirmed": return "Confirmed"
  case "preparing": return "Preparing"
  case "onTheWay": return "On the way"
  case "delivered": return "Delivered"
  default: return status
  }
}

private func etaText(_ minutes: Double?) -> String? {
  guard let minutes, minutes > 0 else { return nil }
  return "\(Int(minutes.rounded())) min"
}

// Bounded, failure-tolerant map image — widget extensions have tight memory limits,
// so the frame is capped and load failure/empty degrades to a placeholder (never a crash).
private struct MapSnapshot: View {
  let urlString: String?
  var body: some View {
    if let s = urlString, let url = URL(string: s) {
      AsyncImage(url: url) { phase in
        switch phase {
        case .success(let image): image.resizable().aspectRatio(contentMode: .fill)
        case .empty, .failure: placeholder
        @unknown default: placeholder
        }
      }
      .frame(maxWidth: .infinity)
      .frame(height: 72)
      .clipped()
      .clipShape(RoundedRectangle(cornerRadius: 8))
    }
  }
  private var placeholder: some View {
    ZStack { Rectangle().fill(.quaternary); Image(systemName: "map").foregroundStyle(.secondary) }
  }
}

private struct DeliveryLockScreenView: View {
  let context: ActivityViewContext<DeliveryAttributes>
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 12) {
        Image(systemName: deliveryIcon(context.state.status))
          .font(.title2).foregroundStyle(presetAccentColor(context.state.accentColorHex))
        VStack(alignment: .leading, spacing: 2) {
          Text(deliveryLabel(context.state.status)).font(.headline)
          Text("Order \(context.attributes.orderNumber)").font(.caption).foregroundStyle(.secondary)
        }
        Spacer()
        if let eta = etaText(context.state.etaMinutes) {
          Text(eta).font(.headline).foregroundStyle(presetAccentColor(context.state.accentColorHex))
        }
      }
      if let courier = context.state.courierName {
        Text("Courier: \(courier)").font(.subheadline).foregroundStyle(.secondary)
      }
      MapSnapshot(urlString: context.state.mapSnapshotUrl)
    }
    .padding()
  }
}

struct DeliveryLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: DeliveryAttributes.self) { context in
      DeliveryLockScreenView(context: context)
        .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Label(deliveryLabel(context.state.status), systemImage: deliveryIcon(context.state.status))
            .font(.caption).foregroundStyle(presetAccentColor(context.state.accentColorHex))
        }
        DynamicIslandExpandedRegion(.trailing) {
          if let eta = etaText(context.state.etaMinutes) {
            Text(eta).font(.caption).foregroundStyle(.secondary)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 6) {
            HStack {
              if let courier = context.state.courierName {
                Text(courier).font(.subheadline)
              }
              Spacer()
              Text("Order \(context.attributes.orderNumber)").font(.caption).foregroundStyle(.secondary)
            }
            MapSnapshot(urlString: context.state.mapSnapshotUrl)
          }
        }
      } compactLeading: {
        Image(systemName: deliveryIcon(context.state.status))
          .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      } compactTrailing: {
        if let eta = etaText(context.state.etaMinutes) {
          Text(eta).font(.caption2).foregroundStyle(.secondary)
        }
      } minimal: {
        Image(systemName: deliveryIcon(context.state.status))
          .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      }
      .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
      .keylineTint(presetAccentColor(context.state.accentColorHex))
    }
  }
}
```

- [ ] **Step 7: Register the widget in the bundle**

In `apps/example/targets/island-kit-widget/IslandKitWidgetBundle.swift`, add `DeliveryLiveActivity()` to the `body`:
```swift
  var body: some Widget {
    NowPlayingLiveActivity()
    GenericProgressLiveActivity()
    DeliveryLiveActivity()
  }
```

- [ ] **Step 8: Add a Delivery section to the example harness**

In `apps/example/App.tsx`:

(a) extend the import to include Delivery:
```tsx
import {
  DeliveryActivity,
  GenericProgressActivity,
  NowPlayingActivity,
  type DeliveryProps,
  type GenericProgressProps,
  type LiveActivityInstance,
  type NowPlayingProps,
} from 'expo-island-kit';
```

(b) add a props constant (after `genericProgressProps`):
```tsx
const deliveryProps: DeliveryProps = {
  status: 'onTheWay',
  etaMinutes: 12,
  courierName: 'Ade',
  orderNumber: '#48213',
  accentColor: '#22C55E',
};

const DELIVERY_STAGES: DeliveryProps['status'][] = ['confirmed', 'preparing', 'onTheWay', 'delivered'];
```

(c) add state + handlers (inside `App`, after the Generic Progress handlers):
```tsx
  const dRef = useRef<LiveActivityInstance<DeliveryProps> | null>(null);
  const [dStatus, setDStatus] = useState('Idle');
  const [dStage, setDStage] = useState(2); // 'onTheWay'

  function startD() {
    const i = DeliveryActivity.start(deliveryProps, 'islandkitexample://orders/48213');
    dRef.current = i;
    setDStage(2);
    setDStatus(i.id ? `Started (${i.id.slice(0, 8)}…)` : 'Start returned no id');
  }
  async function bumpD() {
    const i = dRef.current;
    if (!i) return setDStatus('No active activity — press Start');
    const next = Math.min(dStage + 1, DELIVERY_STAGES.length - 1);
    setDStage(next);
    const status = DELIVERY_STAGES[next];
    await i.update({ status, etaMinutes: status === 'delivered' ? 0 : Math.max(0, 12 - next * 4) });
    setDStatus(`Updated → ${status}`);
  }
  async function stopD() {
    const i = dRef.current;
    if (!i) return setDStatus('No active activity — press Start');
    await i.end('immediate');
    dRef.current = null;
    setDStatus('Ended');
  }
```

(d) add the JSX section (after the Generic Progress section, before `<StatusBar>`):
```tsx
      <Text style={styles.section}>Delivery</Text>
      <Text style={styles.status}>{dStatus}</Text>
      <Button label="Start" onPress={startD} />
      <Button label="Update (advance status)" onPress={bumpD} />
      <Button label="End" onPress={stopD} tone="#FF375F" />
```

- [ ] **Step 9: Typecheck the example app**

Run: `cd /Users/danemmanuel/Documents/islandkit && pnpm --filter example exec tsc --noEmit`
Expected: exit 0 (`DeliveryActivity`/`DeliveryProps` resolve from `build/`).

- [ ] **Step 10: Prebuild + build (app + widget)**

```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
CI=1 npx expo prebuild -p ios --clean
xcodebuild -workspace ios/example.xcworkspace -scheme example -configuration Debug \
  -destination "id=A7D7BEB3-8F26-4FA6-9043-231ED673927D" build 2>&1 | tee /tmp/ik-p4t1.log | tail -30
grep -q "\*\* BUILD SUCCEEDED \*\*" /tmp/ik-p4t1.log && echo "BUILD OK"
test -L apps/example/targets/island-kit-widget/DeliveryAttributes.swift && echo "delivery symlink survived --clean"
```
Expected: `** BUILD SUCCEEDED **`; symlink intact.

- [ ] **Step 11: Commit**

```bash
cd /Users/danemmanuel/Documents/islandkit
git add packages/expo-island-kit apps/example/targets apps/example/App.tsx
git commit -m "feat: add Delivery preset end to end (+ PropCoercion.optDouble)"
```

---

### Task 2: Generic Date-prop serialization in the factory (TS + Jest)

Isolated shared extension with its own review gate. Pure TS/Jest — no native build.

**Files:**
- Modify: `packages/expo-island-kit/src/core/createLiveActivityFactory.ts`
- Modify: `packages/expo-island-kit/src/__tests__/createLiveActivityFactory.test.ts`

**Interfaces:**
- Produces: the factory now converts any `Date`-valued prop to an ISO-8601 string before every native `start`/`update` call. (Consumed by Timer in Task 3 via `PropCoercion.date`.)

- [ ] **Step 1: Write the failing test**

Add to `packages/expo-island-kit/src/__tests__/createLiveActivityFactory.test.ts` (the file already imports `createLiveActivityFactory` — if not, add `import { createLiveActivityFactory } from '../core/createLiveActivityFactory';`):
```ts
test('start and update serialize Date-valued props to ISO strings before the native call', async () => {
  const factory = createLiveActivityFactory<{ label: string; endDate: Date }>('testDate');
  const end = new Date('2030-01-01T00:00:00.000Z');
  const instance = factory.start({ label: 'x', endDate: end });
  expect(mockNative.startLiveActivity).toHaveBeenCalledWith(
    'testDate',
    { label: 'x', endDate: '2030-01-01T00:00:00.000Z' },
    null,
  );
  await instance.update({ endDate: end });
  expect(mockNative.updateLiveActivity).toHaveBeenCalledWith(
    'testDate',
    'activity-1',
    { endDate: '2030-01-01T00:00:00.000Z' },
  );
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `cd /Users/danemmanuel/Documents/islandkit/packages/expo-island-kit && npx jest -t "serialize Date-valued"`
Expected: FAIL — the native mock is called with a `Date` object, not the ISO string.

- [ ] **Step 3: Implement the serialization**

In `packages/expo-island-kit/src/core/createLiveActivityFactory.ts`, add a helper above `createLiveActivityFactory`:
```ts
// Dates don't marshal across the Expo bridge cleanly; convert any Date-valued prop
// to an ISO-8601 string. The Swift decoder parses it back via PropCoercion.date.
function serializeProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    const value = props[key];
    out[key] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}
```

Then wrap the three prop-passing native calls. In `start`:
```ts
      const id = ExpoIslandKitModule.startLiveActivity(
        preset,
        serializeProps(props as unknown as Record<string, unknown>),
        deepLinkUrl ?? null,
      );
```
In `Instance.update`:
```ts
      await ExpoIslandKitModule.updateLiveActivity(preset, this.id, serializeProps(props as Record<string, unknown>));
```
In `Instance.end` (the `finalProps` branch):
```ts
      if (finalProps) {
        await ExpoIslandKitModule.updateLiveActivity(preset, this.id, serializeProps(finalProps as Record<string, unknown>));
      }
```

- [ ] **Step 4: Run the full suite — verify green**

Run: `cd /Users/danemmanuel/Documents/islandkit/packages/expo-island-kit && npx jest`
Expected: PASS — all tests (existing + the new Date-serialization test).

- [ ] **Step 5: Typecheck + rebuild build/**

Run: `cd /Users/danemmanuel/Documents/islandkit && pnpm --filter expo-island-kit exec tsc --noEmit && pnpm --filter expo-island-kit build`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/danemmanuel/Documents/islandkit
git add packages/expo-island-kit/src
git commit -m "feat: serialize Date-valued props to ISO in createLiveActivityFactory"
```

---

### Task 3: Timer preset end to end (+ `PropCoercion.date`, + doc correction)

**Files:**
- Create: `packages/expo-island-kit/src/presets/Timer.ts`
- Modify: `packages/expo-island-kit/src/index.ts`
- Modify: `packages/expo-island-kit/ios/core/PropCoercion.swift` (+`date`)
- Create: `packages/expo-island-kit/ios/shared/TimerAttributes.swift` (+ widget symlink)
- Create: `packages/expo-island-kit/ios/presets/TimerHandler.swift`
- Modify: `packages/expo-island-kit/ios/core/PresetRegistry.swift`
- Create: `apps/example/targets/island-kit-widget/TimerLiveActivity.swift`
- Modify: `apps/example/targets/island-kit-widget/IslandKitWidgetBundle.swift`
- Modify: `apps/example/App.tsx`
- Modify: `docs/islandkit-full-documentation.md` (§8.3)

**Interfaces:**
- Consumes: the factory's Date→ISO serialization (Task 2); `PropCoercion` (+`date`); `presetAccentColor`.
- Produces: `TimerActivity`/`TimerProps`; `struct TimerAttributes`; `struct TimerHandler`; `PropCoercion.date`; `struct TimerLiveActivity: Widget`.

- [ ] **Step 1: TS preset module + export**

Create `packages/expo-island-kit/src/presets/Timer.ts`:
```ts
import { createLiveActivityFactory } from '../core/createLiveActivityFactory';

export interface TimerProps {
  label: string;
  endDate: Date;
  isPaused?: boolean;
  accentColor?: string;
}

export const TimerActivity = createLiveActivityFactory<TimerProps>('timer');
```

Append to `packages/expo-island-kit/src/index.ts`:
```ts
export { TimerActivity, type TimerProps } from './presets/Timer';
```

- [ ] **Step 2: Typecheck + rebuild build/**

Run: `cd /Users/danemmanuel/Documents/islandkit && pnpm --filter expo-island-kit exec tsc --noEmit && pnpm --filter expo-island-kit build`
Expected: exit 0; `build/presets/Timer.js` exists.

- [ ] **Step 3: Add the `date` generic coercion primitive**

In `packages/expo-island-kit/ios/core/PropCoercion.swift`, add inside `enum PropCoercion`:
```swift
  // Optional date from an ISO-8601 string (produced by the factory's Date serialization).
  // Absent key / non-string → keep `fallback`.
  static func date(_ props: [String: Any], _ key: String, _ fallback: Date?) -> Date? {
    guard props.keys.contains(key), let s = props[key] as? String else { return fallback }
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f.date(from: s) ?? ISO8601DateFormatter().date(from: s) ?? fallback
  }
```

- [ ] **Step 4: Timer Attributes (canonical) + widget symlink**

Create `packages/expo-island-kit/ios/shared/TimerAttributes.swift`:
```swift
import ActivityKit
import Foundation

// Compiled into BOTH the app (pod) target and the widget target (via a symlink under
// apps/example/targets/island-kit-widget/). `endDate` drives a native Text(timerInterval:)
// countdown in the widget — it ticks with zero JS.
public struct TimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var label: String
    public var endDate: Date
    public var isPaused: Bool
    public var accentColorHex: String?

    public init(label: String, endDate: Date, isPaused: Bool = false, accentColorHex: String? = nil) {
      self.label = label
      self.endDate = endDate
      self.isPaused = isPaused
      self.accentColorHex = accentColorHex
    }
  }

  public var deepLinkUrl: String?

  public init(deepLinkUrl: String? = nil) {
    self.deepLinkUrl = deepLinkUrl
  }
}
```

Create the widget symlink:
```bash
cd /Users/danemmanuel/Documents/islandkit
ln -s ../../../../packages/expo-island-kit/ios/shared/TimerAttributes.swift \
      apps/example/targets/island-kit-widget/TimerAttributes.swift
git add apps/example/targets/island-kit-widget/TimerAttributes.swift
```

- [ ] **Step 5: Timer handler + decoder, register it**

Create `packages/expo-island-kit/ios/presets/TimerHandler.swift`:
```swift
import ActivityKit
import Foundation

struct TimerHandler: LiveActivityPresetHandler {
  let name = "timer"

  @available(iOS 16.2, *)
  func start(props: [String: Any], deepLinkUrl: String?) -> String {
    LiveActivityEngine.start(
      TimerAttributes(deepLinkUrl: deepLinkUrl),
      Self.contentState(from: props, base: nil)
    )
  }

  @available(iOS 16.2, *)
  func update(id: String, props: [String: Any]) async {
    await LiveActivityEngine.update(TimerAttributes.self, id: id) { base in
      Self.contentState(from: props, base: base)
    }
  }

  @available(iOS 16.2, *)
  func end(id: String, dismissalPolicy: String?) async {
    await LiveActivityEngine.end(TimerAttributes.self, id: id, dismissalPolicy: dismissalPolicy)
  }

  private static func contentState(
    from props: [String: Any],
    base: TimerAttributes.ContentState?
  ) -> TimerAttributes.ContentState {
    TimerAttributes.ContentState(
      label: PropCoercion.string(props, "label", base?.label ?? ""),
      endDate: PropCoercion.date(props, "endDate", base?.endDate) ?? base?.endDate ?? Date(),
      isPaused: PropCoercion.bool(props, "isPaused", base?.isPaused ?? false),
      accentColorHex: PropCoercion.optString(props, "accentColor", base?.accentColorHex)
    )
  }
}
```

In `packages/expo-island-kit/ios/core/PresetRegistry.swift`, append to the `all` array:
```swift
    TimerHandler(),
```

- [ ] **Step 6: Timer widget (native countdown + paused freeze)**

Create `apps/example/targets/island-kit-widget/TimerLiveActivity.swift`:
```swift
import ActivityKit
import WidgetKit
import SwiftUI

private func pausedRemaining(until end: Date) -> String {
  let secs = max(0, Int(end.timeIntervalSinceNow.rounded()))
  let h = secs / 3600, m = (secs % 3600) / 60, s = secs % 60
  return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
}

// Live native countdown when running; a static remaining time when paused OR already
// elapsed (Text(timerInterval:) requires a valid future range — guard against past dates).
private struct Countdown: View {
  let state: TimerAttributes.ContentState
  let font: Font
  var body: some View {
    if state.isPaused || state.endDate <= Date.now {
      Text(pausedRemaining(until: state.endDate)).font(font).monospacedDigit()
    } else {
      Text(timerInterval: Date.now...state.endDate, countsDown: true).font(font).monospacedDigit()
    }
  }
}

private struct TimerLockScreenView: View {
  let context: ActivityViewContext<TimerAttributes>
  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: "timer").font(.title2)
        .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      VStack(alignment: .leading, spacing: 2) {
        Text(context.state.label).font(.headline).lineLimit(1)
        Countdown(state: context.state, font: .title.weight(.semibold))
          .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      }
      Spacer()
      Image(systemName: context.state.isPaused ? "pause.fill" : "timer")
        .foregroundStyle(.secondary)
    }
    .padding()
  }
}

struct TimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TimerAttributes.self) { context in
      TimerLockScreenView(context: context)
        .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Label(context.state.label, systemImage: "timer")
            .font(.caption).foregroundStyle(presetAccentColor(context.state.accentColorHex))
        }
        DynamicIslandExpandedRegion(.bottom) {
          Countdown(state: context.state, font: .system(size: 44, weight: .semibold))
            .foregroundStyle(presetAccentColor(context.state.accentColorHex))
            .frame(maxWidth: .infinity)
        }
      } compactLeading: {
        Image(systemName: "timer")
          .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      } compactTrailing: {
        Countdown(state: context.state, font: .caption2)
          .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      } minimal: {
        Image(systemName: "timer")
          .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      }
      .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
      .keylineTint(presetAccentColor(context.state.accentColorHex))
    }
  }
}
```

- [ ] **Step 7: Register the widget in the bundle**

In `apps/example/targets/island-kit-widget/IslandKitWidgetBundle.swift`, add `TimerLiveActivity()`:
```swift
  var body: some Widget {
    NowPlayingLiveActivity()
    GenericProgressLiveActivity()
    DeliveryLiveActivity()
    TimerLiveActivity()
  }
```

- [ ] **Step 8: Add a Timer section to the example harness**

In `apps/example/App.tsx`:

(a) extend the import to include Timer:
```tsx
import {
  DeliveryActivity,
  GenericProgressActivity,
  NowPlayingActivity,
  TimerActivity,
  type DeliveryProps,
  type GenericProgressProps,
  type LiveActivityInstance,
  type NowPlayingProps,
  type TimerProps,
} from 'expo-island-kit';
```

(b) add a props constant (after `deliveryProps`):
```tsx
const timerProps: TimerProps = {
  label: 'Pasta',
  endDate: new Date(Date.now() + 9 * 60 * 1000),
  accentColor: '#FF9F0A',
};
```

(c) add state + handlers (inside `App`, after the Delivery handlers):
```tsx
  const tRef = useRef<LiveActivityInstance<TimerProps> | null>(null);
  const [tStatus, setTStatus] = useState('Idle');
  const tEndRef = useRef<Date>(timerProps.endDate);

  function startT() {
    const end = new Date(Date.now() + 9 * 60 * 1000);
    tEndRef.current = end;
    const i = TimerActivity.start({ ...timerProps, endDate: end }, 'islandkitexample://timers/pasta');
    tRef.current = i;
    setTStatus(i.id ? `Started (${i.id.slice(0, 8)}…)` : 'Start returned no id');
  }
  async function pauseT() {
    const i = tRef.current;
    if (!i) return setTStatus('No active activity — press Start');
    // Consumer tracks its own endDate (currentEndDate is a deferred convenience).
    await i.update({ label: timerProps.label, endDate: tEndRef.current, isPaused: true });
    setTStatus('Paused');
  }
  async function resumeT() {
    const i = tRef.current;
    if (!i) return setTStatus('No active activity — press Start');
    await i.update({ label: timerProps.label, endDate: tEndRef.current, isPaused: false });
    setTStatus('Resumed');
  }
  async function stopT() {
    const i = tRef.current;
    if (!i) return setTStatus('No active activity — press Start');
    await i.end('immediate');
    tRef.current = null;
    setTStatus('Ended');
  }
```

(d) add the JSX section (after the Delivery section):
```tsx
      <Text style={styles.section}>Timer</Text>
      <Text style={styles.status}>{tStatus}</Text>
      <Button label="Start" onPress={startT} />
      <Button label="Pause" onPress={pauseT} />
      <Button label="Resume" onPress={resumeT} />
      <Button label="End" onPress={stopT} tone="#FF375F" />
```

- [ ] **Step 9: Correct the doc's `currentEndDate` example**

In `docs/islandkit-full-documentation.md` §8.3, replace the update-example line and its surrounding comment so it no longer references the (deferred) `currentEndDate`. Change:
```ts
// Pausing does not require a new endDate calculation on your part beyond
// tracking remaining time in your own app state — pass isPaused and IslandKit
// freezes the native countdown display.
activity.update({ label: 'Pasta', endDate: activity.currentEndDate, isPaused: true });
```
to:
```ts
// Pausing freezes the native countdown display. Track the timer's endDate in your
// own app state and pass it back on update along with isPaused.
// (A convenience `currentEndDate` getter on the instance is planned for a future release.)
const endDate = /* the Date you passed to start(), held in your app state */;
activity.update({ label: 'Pasta', endDate, isPaused: true });
```

- [ ] **Step 10: Typecheck the example app**

Run: `cd /Users/danemmanuel/Documents/islandkit && pnpm --filter example exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 11: Prebuild + build (app + widget)**

```bash
cd /Users/danemmanuel/Documents/islandkit/apps/example
CI=1 npx expo prebuild -p ios --clean
xcodebuild -workspace ios/example.xcworkspace -scheme example -configuration Debug \
  -destination "id=A7D7BEB3-8F26-4FA6-9043-231ED673927D" build 2>&1 | tee /tmp/ik-p4t3.log | tail -30
grep -q "\*\* BUILD SUCCEEDED \*\*" /tmp/ik-p4t3.log && echo "BUILD OK"
test -L apps/example/targets/island-kit-widget/TimerAttributes.swift && echo "timer symlink survived --clean"
```
Expected: `** BUILD SUCCEEDED **`; symlink intact.

- [ ] **Step 12: Commit**

```bash
cd /Users/danemmanuel/Documents/islandkit
git add packages/expo-island-kit apps/example/targets apps/example/App.tsx docs/islandkit-full-documentation.md
git commit -m "feat: add Timer preset end to end (native countdown) + PropCoercion.date; fix doc currentEndDate example"
```

---

### Task 4: Simulator verification + DoD sign-off

No code — runs both new presets on the sim, confirms the existing two still work, records evidence.

**Files:** none (verification + ledger/memory + evidence).

- [ ] **Step 1: Clean-rebuild the package + boot the sim + install/run**

```bash
cd /Users/danemmanuel/Documents/islandkit
rm -rf packages/expo-island-kit/build && pnpm --filter expo-island-kit build   # drop stale orphans (tsc doesn't)
SIM=A7D7BEB3-8F26-4FA6-9043-231ED673927D
xcrun simctl boot "$SIM" 2>/dev/null; open -a Simulator
cd apps/example && CI=1 npx expo run:ios --device "$SIM"
```
Expected: app launches showing four sections (Now Playing, Generic Progress, Delivery, Timer) and `Supported: yes`. If Metro serves a stale bundle after the restructure, restart it with `-c` (broken watchman).

- [ ] **Step 2: Verify Delivery start/update/end**

Drive Start → Update (advance status) → End for the Delivery section (use the Phase-2/3 technique if automating: foreground the app via `simctl launch io.github.Justdan111.islandkitexample`; reveal the DI by foregrounding `com.apple.mobilesafari`). Screenshot the DI after Start to `docs/superpowers/evidence/phase4-01-delivery.png`. Confirm the status icon + ETA appear, Update advances the status icon/label, End removes it. Confirm the map region degrades gracefully (the mock props omit `mapSnapshotUrl`, so no map shows — no crash).

- [ ] **Step 3: Verify Timer start + countdown**

Start the Timer section; screenshot the DI to `docs/superpowers/evidence/phase4-02-timer.png`. Confirm the compact-trailing shows a live countdown (`Text(timerInterval:)`) ticking down. Tap Pause, then Resume, and note the displayed behavior. **Flag explicitly:** the pause-holds-still / resume-continues transition is a native-rendering behavior best confirmed on a physical device (record as device-deferred, not a sim blocker).

- [ ] **Step 4: Regression — the existing two presets still work**

Start → Update → End the Now Playing and Generic Progress sections (the Task-2 factory change touches every preset's `start`/`update`). Confirm both still render + update + end in the DI. Screenshot Generic Progress to `docs/superpowers/evidence/phase4-03-regression-gp.png`.

- [ ] **Step 5: Confirm no forbidden entitlements + all four Attributes single-source**

```bash
cd /Users/danemmanuel/Documents/islandkit
grep -rInE "application-groups|aps-environment|Push Notifications|getPushToken|pushTokenListener" \
  apps/example/app.json apps/example/targets packages/expo-island-kit \
  | grep -viE "//|/\*|note:|forbid|do not|phase 5" || echo "CLEAN: no App Group / Push / push-token"
for n in NowPlaying GenericProgress Delivery Timer; do
  git ls-files -s "packages/expo-island-kit/ios/shared/${n}Attributes.swift" | awk -v n="$n" '{print n" canonical",$1}'
  git ls-files -s "apps/example/targets/island-kit-widget/${n}Attributes.swift" | awk -v n="$n" '{print n" widget",$1,"(120000=symlink)"}'
done
```
Expected: `CLEAN`; each of the four Attributes = one canonical (100644) + one symlink (120000).

- [ ] **Step 6: Restore the harness if a temp verification harness was used, update ledger + memory, write evidence, commit**

If Step 2–4 used a temp self-driving `App.tsx`, restore the committed one (`git checkout -- apps/example/App.tsx`) and confirm the tree is clean. Append a "Phase 4 complete" section to `.superpowers/sdd/progress.md` (both presets start/update/end on sim; existing two regression-checked; abstraction bar held — only PropCoercion primitives + factory serialization + 2 registry lines + index exports changed). Update the `islandkit-build-state` memory. Write `docs/superpowers/evidence/phase4-README.md` noting: both presets validated on the simulator; **sim ≠ on-device visual sign-off**; Timer pause/resume + map-snapshot rendering explicitly device-deferred. Commit:
```bash
cd /Users/danemmanuel/Documents/islandkit
git add docs/superpowers/evidence
git commit -m "chore: phase 4 delivery + timer verified on simulator + evidence"
```

**Definition of done (from the spec) — check each:**
- [ ] `DeliveryActivity` + `TimerActivity` added end to end; canonical prop shapes exact.
- [ ] Only shared changes: `PropCoercion.optDouble` + `PropCoercion.date` + factory Date→ISO + 2 registry lines + 2 index exports. Engine/protocol/factory-shape/`types.ts` untouched (abstraction bar held — verified in review).
- [ ] Date-serialization Jest test added; full suite green.
- [ ] Regression: Now Playing + Generic Progress still start/update/end (Step 4).
- [ ] App + widget build; all four preset widgets registered.
- [ ] Delivery + Timer start/update/end verified on the sim; map degrades gracefully; countdown ticks (Steps 2–3).
- [ ] Doc §8.3 `currentEndDate` example corrected (Task 3 Step 9).
- [ ] No App Group / Push / push-token; `NowPlaying`/`GenericProgress` shapes unchanged.
- [ ] Timer pause/resume + map rendering flagged device-deferred; sim ≠ visual sign-off recorded (Step 6).

---

## Self-Review

**Spec coverage (§1–7):** Delivery (§2) → Task 1; generic Date serialization (§3.1) → Task 2; Timer (§3.2) → Task 3; abstraction bar (§4) → Global Constraints + per-task interface blocks + Task-4 DoD; doc correction (§5) → Task 3 Step 9; DoD (§6) → Task 4; Delivery-first ordering (§7) → task order. ✓

**Placeholder scan:** every code step has complete code. The doc-correction (Task 3 Step 9) shows exact before/after. The one intentional implementation-time choice — final SF Symbol names for the Delivery status map — is given concrete defaults in the code, adjustable for HIG fit. No TBD/TODO. ✓

**Type consistency:** `DeliveryProps`/`TimerProps` field names match §10 and the Swift ContentState decoders (with `accentColor`→`accentColorHex` the only rename in each; `orderNumber` on Attributes, not ContentState). `PropCoercion.optDouble`/`date` signatures match their call sites. Native surface unchanged from Phase 3 (presets flow through the existing `startLiveActivity`/`updateLiveActivity`/`endLiveActivity`/`isLiveActivitySupported`). `presetAccentColor` (not `accentColor`) used in both new widgets. Registry `all` gains exactly `DeliveryHandler()` + `TimerHandler()`. ✓

**Known risks flagged for execution:** (1) `Text(timerInterval:)` requires a future range — the `Countdown` view guards `endDate <= Date.now` and paused → static, avoiding an invalid-range crash. (2) After the src changes, clean-rebuild `build/` + restart Metro `-c` (broken watchman) or a stale bundle causes a runtime "X is not a function" (seen in Phase 3). (3) Delivery/Timer widgets are new files → require `prebuild --clean` (not just `pod install`) to wire into the widget target.
