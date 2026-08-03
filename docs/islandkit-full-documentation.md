
# IslandKit

**Drop-in Live Activities and Dynamic Island presets for Expo & React Native.**

`expo-island-kit` gives you production-quality, Apple-HIG-correct Dynamic Island and Lock Screen Live Activities — Now Playing, Delivery Tracking, Timers, and Generic Progress — without writing a line of Swift. You configure a preset from TypeScript; IslandKit handles the ActivityKit plumbing, the widget extension, and the native bridge.

> **Status note:** This document is the full specification and reference documentation for IslandKit, written docs-first to guide implementation. Package name (`expo-island-kit`) is a working name — confirm npm availability before publishing.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Why IslandKit](#2-why-islandkit)
3. [How It Works — Architecture](#3-how-it-works--architecture)
4. [Requirements](#4-requirements)
5. [Installation & Setup](#5-installation--setup)
6. [Quick Start](#6-quick-start)
7. [Core Concepts](#7-core-concepts)
8. [Presets — Full Reference](#8-presets--full-reference)
9. [Shared API Reference](#9-shared-api-reference)
10. [TypeScript Types Reference](#10-typescript-types-reference)
11. [Configuration Reference (app.json)](#11-configuration-reference-appjson)
12. [Remote Push Updates (APNs)](#12-remote-push-updates-apns)
13. [Platform & Device Compatibility](#13-platform--device-compatibility)
14. [Error Handling & Edge Cases](#14-error-handling--edge-cases)
15. [Best Practices & Performance](#15-best-practices--performance)
16. [Testing Guide](#16-testing-guide)
17. [Troubleshooting / FAQ](#17-troubleshooting--faq)
18. [Example App Walkthrough](#18-example-app-walkthrough)
19. [Versioning & Compatibility Policy](#19-versioning--compatibility-policy)
20. [Roadmap](#20-roadmap)
21. [Contributing](#21-contributing)
22. [License](#22-license)

---

## 1. Introduction

### What is IslandKit

IslandKit is an Expo module that lets a React Native app start, update, and end **iOS Live Activities** — the live-updating cards that appear in the **Dynamic Island**, on the **Lock Screen**, and in **Notification Center** — using a plain TypeScript API instead of native Swift code.

Where Apple's ActivityKit requires you to define native `ActivityAttributes`, build a WidgetKit extension target in Xcode, and write SwiftUI views for every region of the Dynamic Island, IslandKit ships that native layer **pre-built** as a set of ready-made "presets" for the most common real-world use cases:

- **Now Playing** — music/podcast/audio playback, like Apple Music or Spotify
- **Delivery** — food delivery / parcel tracking, like Uber Eats or DoorDash
- **Timer** — countdowns, workouts, cook timers
- **Generic Progress** — anything else with a title, icon, and progress bar

You call `NowPlayingActivity.start({...})` from JavaScript. IslandKit does the rest.

### Who this is for

- Expo/React Native developers who want the "this app feels native" polish of a Live Activity without maintaining a Swift codebase
- Teams who don't have (or don't want to dedicate) an iOS-native engineer just for this one feature
- Anyone who tried wiring up ActivityKit by hand and hit the wall of Xcode target configuration, entitlements, and App Groups

### What this is *not*

- Not a general-purpose native widget builder — for iOS home-screen widgets unrelated to Live Activities, use Expo's official `expo-widgets`
- Not cross-platform (yet) — this version is iOS-only. Android's equivalent surface (Android 16 "Live Updates" / `Notification.ProgressStyle`) is tracked in the [Roadmap](#20-roadmap)
- Not a replacement for understanding ActivityKit's constraints — IslandKit removes the *implementation* burden, not Apple's platform rules (activity budgets, one active Live Activity per type, etc.)

---

## 2. Why IslandKit

### The landscape as of mid-2026

| Approach | What you write | Control | Best for |
|---|---|---|---|
| Raw ActivityKit + Xcode | Swift, SwiftUI, manual Xcode target | Full | Native iOS teams |
| `expo-widgets` (official Expo SDK 56+) | TSX via `@expo/ui/swift-ui` | Constrained to Expo's abstraction | Apps that want zero-Swift widgets, fine with the newer/limited component set |
| Community bridges (`expo-live-activity`, etc.) | Swift for layout, TS for state | Full, but you own the Swift | Teams willing to hand-write SwiftUI once |
| **IslandKit** | TypeScript only, presets pre-built in Swift | Full native fidelity, zero Swift for consumers | Apps that want a specific, common use case (music, delivery, timer) shipped and polished |

IslandKit's SwiftUI layer is built on top of **`@bacons/apple-targets`** (`expo-apple-targets`), the actively-maintained config plugin that generates real Xcode widget extension targets from a `targets/` folder — the same underlying mechanism serious production Live Activity implementations use. This means IslandKit's presets get full native control (exact HIG spacing, real SwiftUI animations, `Text(timerInterval:)` native countdowns) rather than being boxed into a JS-driven layout abstraction.

### Design principles

1. **Zero Swift for consumers.** If you have to open Xcode to ship a feature, IslandKit failed at its job.
2. **HIG-correct by default.** Every preset follows Apple's Dynamic Island layout guidance (region sizing, safe areas, minimum tap targets) out of the box.
3. **Graceful degradation.** On devices/OS versions that don't support a feature, calls no-op safely instead of crashing.
4. **Tree-shakeable presets.** You only ship the native code for the presets you actually use, keeping binary size and build time down.
5. **Escape hatches, not walls.** Every preset accepts an `accentColor`, custom icons, and a deep link — enough customization for most brands without needing a fully generic layout engine.

---

## 3. How It Works — Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Your React Native App (TypeScript)                          │
│  import { NowPlayingActivity } from 'expo-island-kit'         │
└───────────────────────────┬───────────────────────────────────┘
                            │  JS/TS API
┌───────────────────────────▼───────────────────────────────────┐
│  IslandKit JS Layer                                           │
│  - Type-safe props per preset                                 │
│  - Validates + serializes state                                │
│  - Wraps Expo Modules native calls in Promises/EventEmitters   │
└───────────────────────────┬───────────────────────────────────┘
                            │  Expo Modules API (JSI bridge)
┌───────────────────────────▼───────────────────────────────────┐
│  Native Module (Swift, ExpoModulesCore)                       │
│  - Decodes JSON into typed ActivityAttributes/ContentState     │
│  - Calls Activity.request() / .update() / .end()               │
│  - Emits push-token and user-interaction events back to JS     │
└───────────────────────────┬───────────────────────────────────┘
                            │  ActivityKit
┌───────────────────────────▼───────────────────────────────────┐
│  Widget Extension Target (generated by @bacons/apple-targets)  │
│  - One SwiftUI view per preset (NowPlayingWidget.swift, etc.)   │
│  - Defines compact/minimal/expanded Dynamic Island regions      │
│  - Defines the Lock Screen banner view                         │
└─────────────────────────────────────────────────────────────────┘
```

### The three moving parts, in plain terms

1. **The config plugin** (built on `@bacons/apple-targets`) runs during `expo prebuild` and generates the actual Xcode widget extension target, wires up the App Group entitlement your main app and the extension both need to share data, and adds the presets you opted into.
2. **The native bridge** (an Expo Module) is the thin Swift layer that translates your JS function calls into real `ActivityKit` calls (`Activity<Attributes>.request(attributes:content:)`, `.update(_:)`, `.end(_:dismissalPolicy:)`).
3. **The preset SwiftUI views** are the pre-written, polished layouts that live inside the widget extension and render whatever content state you pushed from JS.

You only ever touch layer 1 (config) and interact with the exported TS API — layers 2 and 3 ship inside the package.

---

## 4. Requirements

### Development environment

| Requirement | Why |
|---|---|
| macOS + Xcode (current stable) | Building the widget extension target requires Xcode; EAS Build can build in CI but local iteration is far faster with Xcode installed |
| Apple Developer Program membership ($99/yr) | Required for App Group entitlements, ActivityKit push entitlements, and any physical-device testing |
| Expo SDK 54+ | IslandKit relies on config plugin capabilities and prebuild behavior available from SDK 54 onward |
| A **development build** (`expo-dev-client`) or EAS Build | Live Activities **cannot** run inside Expo Go — there is no way around this, since it requires a compiled native extension target |

### Runtime requirements (end-user devices)

| Requirement | Detail |
|---|---|
| iOS 16.1+ | Minimum OS version for the Live Activities API (Lock Screen / Notification Center presentation) |
| iOS 16.2+ | Recommended minimum — this is when Apple stabilized several ActivityKit behaviors that earlier community packages worked around |
| iPhone 14 Pro / 14 Pro Max or newer for Dynamic Island | The Dynamic Island **hardware** presentation is only available on iPhone 14 Pro and 14 Pro Max, and on **all** iPhone 15, 16, and 17 models (Dynamic Island became standard across the full lineup starting with iPhone 15) |
| Any iPhone on iOS 16.1+ without Dynamic Island hardware | Still gets the Lock Screen banner and Notification Center entry — just no compact/minimal pill presentation |

> Always verify current OS-version and hardware-support numbers against Apple's ActivityKit documentation before shipping — these details have shifted across iOS releases and will continue to.

---

## 5. Installation & Setup

### 5.1 Install the package

```bash
npx expo install expo-island-kit
```

### 5.2 Add the config plugin

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

That is the whole setup — IslandKit generates the widget extension target for you. **Do not also list `@bacons/apple-targets`**: IslandKit applies it internally, and listing both builds every target twice.

**Known limitation:** `@bacons/apple-targets@5.0.0` (the newest published version, as of writing) cannot handle two targets of the same `type`. If your own `targets/` directory defines a second **widget** extension, prebuild will crash with a `removeFromProject` error — this does not affect other target types (e.g. `share`, `notification-content`), which are picked up fine alongside IslandKit's. If your app needs its own Widget, add it inside a single widget extension rather than maintaining a second `type: "widget"` target.

To customise, pass options: `["expo-island-kit", { "presets": ["nowPlaying", "timer"] }]`. See [Section 11](#11-configuration-reference-appjson).

### 5.3 Prebuild

```bash
npx expo prebuild -p ios --clean
```

This generates your `ios/` folder, including the widget extension target, with `NSSupportsLiveActivities` set on your app automatically.

### 5.4 Build a dev client

```bash
npx expo run:ios
# or, for a shareable build:
eas build --profile development --platform ios
```

### 5.5 Verify setup

```ts
import { isDynamicIslandSupported, areLiveActivitiesEnabled } from 'expo-island-kit';

console.log('Has Dynamic Island hardware:', isDynamicIslandSupported);
console.log('User has Live Activities enabled:', await areLiveActivitiesEnabled());
```

If `areLiveActivitiesEnabled()` returns `false`, the user has disabled Live Activities globally in Settings → Face ID & Passcode, or per-app in Settings → [Your App] → Live Activities — your app should handle this gracefully (see [Section 14](#14-error-handling--edge-cases)).

---

## 6. Quick Start

A complete Now Playing example, start to finish:

```tsx
import { View, Button } from 'react-native';
import { NowPlayingActivity, type NowPlayingInstance } from 'expo-island-kit';
import { useRef } from 'react';

export default function PlayerScreen() {
  const activityRef = useRef<NowPlayingInstance | null>(null);

  const startActivity = () => {
    activityRef.current = NowPlayingActivity.start(
      {
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        artworkUrl: 'https://example.com/artwork.jpg',
        isPlaying: true,
        elapsedSeconds: 0,
        durationSeconds: 200,
        accentColor: '#FA2D48',
      },
      'myapp://player' // deep link when the user taps the activity
    );
  };

  const updateProgress = (elapsedSeconds: number) => {
    activityRef.current?.update({ elapsedSeconds, isPlaying: true });
  };

  const stopActivity = async () => {
    await activityRef.current?.end('immediate');
    activityRef.current = null;
  };

  return (
    <View>
      <Button title="Start Live Activity" onPress={startActivity} />
      <Button title="Update Progress" onPress={() => updateProgress(46)} />
      <Button title="End Activity" onPress={stopActivity} />
    </View>
  );
}
```

That's the entire integration. No Swift, no Xcode target editing after the initial `prebuild`.

---

## 7. Core Concepts

If you're new to ActivityKit, these are the concepts IslandKit is built on top of — understanding them will help you use the escape hatches and debug issues.

### Live Activity vs. Widget

A **widget** (home screen) is passive — it refreshes on a timeline the system controls. A **Live Activity** is active — your app pushes updates to it in near-real-time, and it's meant to represent something *currently happening* (a ride, a delivery, a song playing, a timer running).

### Attributes vs. Content State

Every Live Activity has two kinds of data:

- **Attributes** — fixed for the life of the activity, set once at `start()`. Example: the order number for a delivery.
- **Content State** — what you call `.update()` with. Example: the courier's ETA, which changes over time.

IslandKit's `start(props, deepLink)` sets both in one call by convention (fields that logically don't change, like `orderNumber`, become attributes; the rest become content state), so you don't need to think about this split yourself.

### The Dynamic Island's regions

| Region | What it is | Example (Now Playing) |
|---|---|---|
| `compactLeading` | Left side of the pill when another app is active | Album art thumbnail |
| `compactTrailing` | Right side of the pill | Mini waveform / play icon |
| `minimal` | Shown when **multiple** Live Activities are competing for space | Just the album art icon |
| `expandedLeading` | Left column when the user long-presses to expand | Album art |
| `expandedTrailing` | Right column when expanded | Track duration |
| `expandedCenter` | Center of the expanded view | (rarely used — reserved for critical info) |
| `expandedBottom` | Bottom row when expanded, usually widest | Title, artist, scrubber, playback controls |
| Lock Screen banner | Full-width card on the Lock Screen | Same content as expanded, laid out for a wider surface |

Each IslandKit preset pre-fills all of these regions with a sensible, HIG-correct layout — you only pass data, not layout.

### Activity lifecycle

```
start() → [one or more update() calls] → end()
```

- `start()` returns an activity **instance** — store it (or its `.id`) if you need to update or end it later, including across app restarts (persist the ID yourself, e.g. in AsyncStorage).
- `update()` reflects immediately in the UI.
- `end()` accepts a **dismissal policy**: `'default'` (system decides), `'immediate'` (removed right away), or `{ after: someDate }` (removed at a specific time, useful for showing a final "Delivered!" state for a few seconds before it disappears).

### Push-to-start vs. per-activity push tokens

- A **push-to-start token** lets your server start a *new* Live Activity remotely, without the app being open (useful for e.g. "your order just shipped").
- A **per-activity push token** lets your server `update()` or `end()` an *existing* activity remotely (useful for delivery ETA changes pushed from your backend rather than polled by the client).

Both require `enablePushNotifications: true` in the config plugin and a properly configured APNs setup — see [Section 12](#12-remote-push-updates-apns).

### System-imposed limits

- Only **one active instance per Live Activity type** is generally expected by users, though ActivityKit technically supports multiple — IslandKit's presets default to single-instance behavior per preset.
- iOS automatically ends Live Activities that go stale for too long, to prevent battery/notification abuse. The exact time budget has been adjusted by Apple across iOS releases — don't hardcode assumptions about it into your product logic. Keep activities updated with meaningful cadence and always call `.end()` yourself when the represented event is truly over.
- Frequent updates (more than roughly once a second) will be throttled by the system regardless of what your code sends — design your update cadence around "when something meaningfully changed," not a fixed timer.

---

## 8. Presets — Full Reference

### 8.1 `NowPlayingActivity`

For music, podcast, or any audio playback experience.

**Props**

| Prop | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | Yes | Track/episode title |
| `artist` | `string` | Yes | Artist/show name |
| `artworkUrl` | `string` | No | Remote image URL for album art |
| `artworkAsset` | `string` | No | Local asset name (bundled in the app) — use instead of `artworkUrl` for instant, offline-safe rendering |
| `isPlaying` | `boolean` | Yes | Drives the play/pause icon and whether the progress bar animates |
| `elapsedSeconds` | `number` | Yes | Current playback position |
| `durationSeconds` | `number` | Yes | Total track length |
| `accentColor` | `string` (hex) | No | Tint for controls and progress bar. Defaults to system accent |

**Layout**

- Compact: artwork thumbnail (leading) + animated mini waveform or play/pause glyph (trailing)
- Minimal: artwork thumbnail only
- Expanded: artwork (leading), duration (trailing), title/artist + scrubber + previous/play-pause/next controls (bottom)
- Lock Screen: full-width card with artwork, title, artist, scrubber, and controls

**Example**

```ts
const activity = NowPlayingActivity.start({
  title: 'Blinding Lights',
  artist: 'The Weeknd',
  artworkUrl: 'https://example.com/art.jpg',
  isPlaying: true,
  elapsedSeconds: 0,
  durationSeconds: 200,
}, 'myapp://now-playing');
```

---

### 8.2 `DeliveryActivity`

For food delivery, parcel tracking, or any "something is on its way" flow.

**Props**

| Prop | Type | Required | Description |
|---|---|---|---|
| `status` | `'confirmed' \| 'preparing' \| 'onTheWay' \| 'delivered'` | Yes | Drives the icon and status text |
| `etaMinutes` | `number` | No | Minutes remaining, shown in compact trailing and expanded |
| `courierName` | `string` | No | Shown in the expanded view |
| `orderNumber` | `string` | Yes | Set once as an attribute (immutable for the activity's life) |
| `mapSnapshotUrl` | `string` | No | Optional static map image for the expanded/Lock Screen view |
| `accentColor` | `string` (hex) | No | Brand tint |

**Layout**

- Compact: status icon (leading) + ETA text (trailing)
- Minimal: status icon
- Expanded: status icon + label (leading), ETA (trailing), courier + order number (bottom), optional map snapshot
- Lock Screen: full card with status, ETA, courier, and map

**Example**

```ts
const activity = DeliveryActivity.start({
  status: 'onTheWay',
  etaMinutes: 12,
  courierName: 'Ade',
  orderNumber: '#48213',
  accentColor: '#22C55E',
}, 'myapp://orders/48213');

// Later, when status changes:
activity.update({ status: 'delivered', etaMinutes: 0 });
await activity.end('default', undefined, { after: /* 4 hours from now */ new Date(Date.now() + 4 * 60 * 60 * 1000) });
```

---

### 8.3 `TimerActivity`

For countdowns — cook timers, workout intervals, focus sessions.

**Props**

| Prop | Type | Required | Description |
|---|---|---|---|
| `label` | `string` | Yes | What the timer represents, e.g. "Pasta" or "Rest" |
| `endDate` | `Date` | Yes | When the timer should reach zero — IslandKit uses native `Text(timerInterval:)` under the hood so the countdown ticks with zero JS involvement and zero battery cost |
| `isPaused` | `boolean` | No | When `true`, freezes the displayed time instead of counting down |
| `accentColor` | `string` (hex) | No | Tint |

**Layout**

- Compact: label glyph (leading) + live countdown text (trailing)
- Minimal: countdown-only compact glyph
- Expanded: label + large live countdown + pause/resume affordance
- Lock Screen: label + large countdown

**Example**

```ts
const activity = TimerActivity.start({
  label: 'Pasta',
  endDate: new Date(Date.now() + 9 * 60 * 1000), // 9 minutes from now
}, 'myapp://timers/pasta');

// Pausing freezes the native countdown display. Track the timer's endDate in your
// own app state and pass it back on update along with isPaused.
// (A convenience `currentEndDate` getter on the instance is planned for a future release.)
// `myTimerEndDate` is the Date you passed to start(), held in your own app state:
activity.update({ label: 'Pasta', endDate: myTimerEndDate, isPaused: true });
```

> Because the countdown is rendered natively via `Text(timerInterval:)`, it keeps ticking accurately even if your app is fully backgrounded — you don't need to call `.update()` every second.

---

### 8.4 `GenericProgressActivity`

The escape hatch for anything that doesn't fit the other three — a workout, a file upload, a multi-step process.

**Props**

| Prop | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | Yes | Main label |
| `subtitle` | `string` | No | Secondary line |
| `progress` | `number` (0–1) | Yes | Drives the progress bar |
| `iconSystemName` | `string` | No | An SF Symbol name (e.g. `"arrow.up.circle"`) |
| `accentColor` | `string` (hex) | No | Tint |

**Layout**

- Compact: icon (leading) + percentage text (trailing)
- Minimal: icon only
- Expanded: icon + title/subtitle + progress bar
- Lock Screen: full card with progress bar

**Example**

```ts
const activity = GenericProgressActivity.start({
  title: 'Uploading backup',
  subtitle: '128 of 400 photos',
  progress: 0.32,
  iconSystemName: 'icloud.and.arrow.up',
}, 'myapp://backup');
```

---

## 9. Shared API Reference

All four presets share the same instance and factory shape.

### Factory methods (e.g. `NowPlayingActivity`)

| Method | Signature | Description |
|---|---|---|
| `start` | `(props: T, deepLinkUrl?: string) => LiveActivityInstance<T>` | Starts a new activity. Returns `undefined`-safe — check `isSupported()` first for critical paths |
| `getActiveInstances` | `() => LiveActivityInstance<T>[]` | Returns all currently running instances of this preset type (usually 0 or 1) |
| `isSupported` | `() => boolean` | Whether this preset can run on the current device/OS |

### Instance methods (returned by `start()`)

| Method | Signature | Description |
|---|---|---|
| `update` | `(props: Partial<T>) => Promise<void>` | Pushes new content state. UI reflects it immediately |
| `end` | `(dismissalPolicy?: DismissalPolicy, finalProps?: Partial<T>) => Promise<void>` | Ends the activity, optionally showing final content first |
| `getPushToken` | `() => Promise<string \| null>` | Returns the per-activity APNs push token, once available |
| `addPushTokenListener` | `(cb: (token: string) => void) => Subscription` | Fires whenever the push token changes |
| `id` | `string` | Stable identifier — persist this if you need to reconnect to the activity after an app restart |

### Global functions

| Function | Description |
|---|---|
| `isDynamicIslandSupported` | `boolean` constant — whether this device has Dynamic Island hardware |
| `areLiveActivitiesEnabled()` | `Promise<boolean>` — whether the user allows Live Activities for this app right now |
| `addPushToStartTokenListener(cb)` | Subscribes to the app-wide push-to-start token, used to start activities remotely |
| `addUserInteractionListener(cb)` | Fires when the user taps a button inside an activity (e.g. play/pause) |

---

## 10. TypeScript Types Reference

```ts
export type DismissalPolicy = 'default' | 'immediate' | { after: Date };

export interface LiveActivityInstance<T> {
  readonly id: string;
  update(props: Partial<T>): Promise<void>;
  end(dismissalPolicy?: DismissalPolicy, finalProps?: Partial<T>): Promise<void>;
  getPushToken(): Promise<string | null>;
  addPushTokenListener(cb: (token: string) => void): { remove(): void };
}

export interface LiveActivityFactory<T> {
  start(props: T, deepLinkUrl?: string): LiveActivityInstance<T>;
  getActiveInstances(): LiveActivityInstance<T>[];
  isSupported(): boolean;
}

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

export interface DeliveryProps {
  status: 'confirmed' | 'preparing' | 'onTheWay' | 'delivered';
  etaMinutes?: number;
  courierName?: string;
  orderNumber: string;
  mapSnapshotUrl?: string;
  accentColor?: string;
}

export interface TimerProps {
  label: string;
  endDate: Date;
  isPaused?: boolean;
  accentColor?: string;
}

export interface GenericProgressProps {
  title: string;
  subtitle?: string;
  progress: number; // 0–1
  iconSystemName?: string;
  accentColor?: string;
}

export const NowPlayingActivity: LiveActivityFactory<NowPlayingProps>;
export const DeliveryActivity: LiveActivityFactory<DeliveryProps>;
export const TimerActivity: LiveActivityFactory<TimerProps>;
export const GenericProgressActivity: LiveActivityFactory<GenericProgressProps>;

export const isDynamicIslandSupported: boolean;
export function areLiveActivitiesEnabled(): Promise<boolean>;
export function addPushToStartTokenListener(
  cb: (event: { token: string }) => void
): { remove(): void };
export function addUserInteractionListener(
  cb: (event: { activityId: string; action: string }) => void
): { remove(): void };
```

---

## 11. Configuration Reference (app.json)

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

**Not yet available.** `groupIdentifier` and `enablePushNotifications` are planned for the remote-push release and are ignored (with a warning) today — both need a paid Apple Developer account. Set your team via `ios.appleTeamId` rather than a plugin option; the widget target signs from it.

The generated `targets/island-kit-widget/` directory is **build output**: it is overwritten on every `expo prebuild` and should be git-ignored. Do not edit it by hand.

After changing any of these, re-run `npx expo prebuild --clean` to regenerate the native project.

---

## 12. Remote Push Updates (APNs)

Use this when you want your **server**, not the client app, to update or start a Live Activity — e.g. a delivery ETA changing based on backend logic, or starting an activity from a push notification while the app is closed.

### 12.1 Getting tokens

```ts
import { addPushToStartTokenListener } from 'expo-island-kit';
import { DeliveryActivity } from 'expo-island-kit';

// App-wide: lets your server START a new activity remotely
addPushToStartTokenListener(({ token }) => {
  sendTokenToYourBackend('push-to-start', token);
});

// Per-activity: lets your server UPDATE/END this specific activity
const activity = DeliveryActivity.start({ /* ... */ });
const token = await activity.getPushToken();
sendTokenToYourBackend('per-activity', token, activity.id);
```

### 12.2 Sending an update from your server (Node.js example)

```js
// Requires an APNs auth key (.p8) with the ActivityKit push type configured.
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

function buildApnsJwt({ keyId, teamId, privateKey }) {
  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    keyid: keyId,
    issuer: teamId,
    expiresIn: '20m',
  });
}

async function pushLiveActivityUpdate({ deviceToken, bundleId, payload }) {
  const token = buildApnsJwt({
    keyId: process.env.APNS_KEY_ID,
    teamId: process.env.APNS_TEAM_ID,
    privateKey: process.env.APNS_PRIVATE_KEY,
  });

  const res = await fetch(`https://api.push.apple.com/3/device/${deviceToken}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${token}`,
      'apns-topic': `${bundleId}.push-type.liveactivity`,
      'apns-push-type': 'liveactivity',
      'apns-priority': '10',
    },
    body: JSON.stringify({
      aps: {
        timestamp: Math.floor(Date.now() / 1000),
        event: 'update', // or 'end', or 'start' for push-to-start tokens
        'content-state': payload,
      },
    }),
  });

  return res.status;
}
```

### 12.3 Sending an update from your server (Go example)

Since ActivityKit push payloads are just standard APNs HTTP/2 requests, a Go backend needs no special SDK — any APNs-capable HTTP/2 client works.

```go
package liveactivity

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type ContentUpdate struct {
	Timestamp    int64       `json:"timestamp"`
	Event        string      `json:"event"` // "update" | "end" | "start"
	ContentState interface{} `json:"content-state"`
}

func PushUpdate(client *http.Client, deviceToken, bundleID, jwtToken string, state interface{}) error {
	body, _ := json.Marshal(map[string]interface{}{
		"aps": ContentUpdate{
			Timestamp:    time.Now().Unix(),
			Event:        "update",
			ContentState: state,
		},
	})

	req, _ := http.NewRequest("POST",
		fmt.Sprintf("https://api.push.apple.com/3/device/%s", deviceToken),
		bytes.NewReader(body))

	req.Header.Set("authorization", "bearer "+jwtToken)
	req.Header.Set("apns-topic", bundleID+".push-type.liveactivity")
	req.Header.Set("apns-push-type", "liveactivity")
	req.Header.Set("apns-priority", "10")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}
```

### 12.4 Payload shape per preset

The `content-state` object must match the same shape your `update()` calls use on the client (minus attribute-only fields like `orderNumber`). For example, a `DeliveryActivity` remote update:

```json
{
  "aps": {
    "timestamp": 1751000000,
    "event": "update",
    "content-state": {
      "status": "onTheWay",
      "etaMinutes": 8
    }
  }
}
```

---

## 13. Platform & Device Compatibility

| Device / OS | Dynamic Island pill | Lock Screen banner | Notes |
|---|---|---|---|
| iPhone 14 Pro / Pro Max, iOS 16.1+ | ✅ | ✅ | First Dynamic Island hardware |
| iPhone 15 / 15 Plus / 15 Pro / 15 Pro Max | ✅ | ✅ | Dynamic Island standard across the line |
| iPhone 16 / 16 Plus / 16 Pro / 16 Pro Max and later | ✅ | ✅ | |
| iPhone 14, 14 Plus, 13, SE, and older | ❌ | ✅ | Live Activity still works, just no pill |
| iPad | ❌ | ➖ | ActivityKit does not support Live Activities on iPadOS as of this writing — verify against current Apple docs |
| Android (any) | ❌ | ❌ | Out of scope for this version — all IslandKit calls no-op safely |
| iOS < 16.1 | ❌ | ❌ | All calls no-op safely; use `areLiveActivitiesEnabled()` / OS version checks to hide related UI |

Always branch your UI on `isDynamicIslandSupported` and `areLiveActivitiesEnabled()` rather than assuming — a large share of active iPhones in any given year will still be pre-Dynamic-Island hardware.

---

## 14. Error Handling & Edge Cases

| Scenario | IslandKit behavior | What you should do |
|---|---|---|
| User disabled Live Activities (Settings) | `start()` resolves but the activity never visually appears; `areLiveActivitiesEnabled()` returns `false` | Check this before starting, and consider a soft in-app prompt explaining what they're missing |
| Device has no Dynamic Island | Activity still shows on Lock Screen / Notification Center | No action needed — this is expected, not an error |
| OS < 16.1 | All factory methods return `undefined` from `start()` | Feature-detect with `NowPlayingActivity.isSupported()` before wiring up UI that depends on it |
| App is force-quit while an activity is running | The activity keeps running (managed by the system), but you lose your JS reference to it | Persist `activity.id` yourself (e.g. AsyncStorage) if you need to reconnect and call `.update()`/`.end()` later |
| Too many rapid `update()` calls | The system throttles / coalesces updates | Debounce update calls in your app code (see [Best Practices](#15-best-practices--performance)) |
| Missing App Group entitlement | Native module throws on `start()` | Confirm `groupIdentifier` matches between the config plugin and re-run `prebuild --clean` |
| Push token requested without `enablePushNotifications: true` | `getPushToken()` resolves `null` | Enable the flag in the config plugin and rebuild |

---

## 15. Best Practices & Performance

- **Debounce updates.** Don't call `.update()` on every animation frame of a progress bar — batch changes to at most once per second for anything continuous.
- **Prefer native countdowns for timers.** `TimerActivity` uses `Text(timerInterval:)` internally specifically so you don't need a JS interval ticking in the background — lean on this rather than calling `.update()` every second yourself.
- **Keep images small and local when possible.** `artworkAsset` (bundled) renders instantly; `artworkUrl` (remote) has to be fetched by the extension process, which has a much smaller memory budget than your main app — very large remote images can cause the extension to be killed by the system.
- **Always call `.end()`.** Don't rely on the system's automatic timeout as your primary cleanup path — end the activity explicitly when the represented event (song stops, delivery completes, timer finishes) is actually over.
- **One activity per type at a time.** Starting a second `NowPlayingActivity` while one is already running is rarely what users want — check `getActiveInstances()` first if there's any chance of double-starting.
- **Test with real content lengths.** Long artist names, long delivery statuses, etc. — SwiftUI will truncate gracefully, but preview with your actual longest realistic strings, not just "Song Title."

---

## 16. Testing Guide

### In the simulator

- Use an iPhone 14 Pro or newer simulator (Xcode ships Dynamic Island-aware simulators for these devices).
- Xcode's Live Activity preview canvas lets you preview each region (`compactLeading`, `expanded`, etc.) without running the full app — useful when iterating on the Swift layout itself.
- To simulate a **remote push update** without a real server, drag a `.apns` payload file onto the running simulator window — this is an Apple-provided simulator feature for exactly this purpose.

### On a physical device

- Confirm the long-press-to-expand gesture, haptics, and Dynamic Island animation timing — these don't fully replicate in the simulator.
- Test with the device locked (Lock Screen banner) and unlocked with another app open (Dynamic Island pill).
- Test after force-quitting your app entirely — the activity should persist.

### Device/OS matrix to cover before shipping

- [ ] iPhone with Dynamic Island, latest iOS
- [ ] iPhone with Dynamic Island, oldest iOS version you claim to support
- [ ] iPhone without Dynamic Island (Lock Screen only path)
- [ ] Live Activities disabled in Settings (graceful no-op path)
- [ ] Airplane mode / no network (remote push path should fail silently, local `update()` should still work)

---

## 17. Troubleshooting / FAQ

**Q: My activity doesn't appear at all.**
Check, in order: `areLiveActivitiesEnabled()`, that `NSSupportsLiveActivities` is `true` in the generated `Info.plist` (the config plugin sets this — confirm after `prebuild`), and that you're running a dev client/EAS build, not Expo Go.

**Q: It works in the simulator but not on my device.**
Almost always a code-signing / App Group mismatch. Confirm `appleTeamId` and `groupIdentifier` in your config match what's in your Apple Developer account, then `prebuild --clean` and rebuild.

**Q: Can I run this in Expo Go?**
No. Live Activities require a compiled widget extension target, which Expo Go cannot include. A development build is mandatory.

**Q: Can I have a Now Playing and a Timer activity running at the same time?**
Yes — different preset types can run concurrently. Within the *same* preset type, IslandKit's presets are designed around a single active instance, matching what users typically expect.

**Q: Does this work on iPad?**
Live Activities are an iPhone-focused feature; iPad support is not part of ActivityKit as of this writing. Verify against current Apple documentation if this matters for your app.

**Q: My push updates aren't arriving.**
Confirm `enablePushNotifications: true` is set and you've rebuilt, that your APNs auth key has the ActivityKit push type enabled in your Apple Developer account, and that the `apns-topic` header exactly matches `<your bundle id>.push-type.liveactivity`.

---

## 18. Example App Walkthrough

The repository ships an `apps/example` Expo app demonstrating all four presets:

- **`/player`** — a mock audio player wired to `NowPlayingActivity`, with a scrubber that calls `.update()` on seek and play/pause
- **`/delivery`** — a simulated order flow that steps through `confirmed → preparing → onTheWay → delivered`, ending the activity automatically 4 hours after delivery
- **`/timer`** — a cook-timer UI using `TimerActivity`, including pause/resume
- **`/upload`** — a fake file-upload progress screen using `GenericProgressActivity`

The example consumes IslandKit exactly as any consumer does — via the `expo-island-kit` config plugin in `app.json` — and carries **no widget Swift in its tracked source**. `npx expo prebuild -p ios --clean` regenerates `apps/example/targets/island-kit-widget/` from the package before every build; that directory is git-ignored build output, not something checked into the repo.

Clone it, run `npx expo prebuild -p ios --clean && npx expo run:ios`, and use it as a reference implementation when integrating IslandKit into your own app.

---

## 19. Versioning & Compatibility Policy

IslandKit follows semantic versioning with two additional compatibility axes to track, since this package sits between three moving platforms (npm semver, Expo SDK, and iOS/Xcode):

| Axis | Policy |
|---|---|
| npm semver | Standard — breaking JS API changes bump major |
| Expo SDK support | Each IslandKit minor release documents its supported Expo SDK range; supporting old SDKs indefinitely is not guaranteed given how config plugin internals evolve |
| iOS/Xcode | Deployment target and Swift code are updated as needed to stay building on the current stable Xcode; changes here are called out in the changelog even when they don't bump the npm major version |

Check the compatibility table in the repository README before upgrading either Expo or IslandKit in an existing project.

---

## 20. Roadmap

- [ ] Android parity via Android 16 "Live Updates" (`Notification.ProgressStyle`) behind the same JS API, so a single `DeliveryActivity.start()` call works cross-platform
- [ ] Additional presets: Ride/Navigation, Sports Score, Call
- [ ] A visual preset customizer (theme playground) for tweaking colors/fonts without touching Swift
- [ ] CLI diagnostics command (`npx expo-island-kit doctor`) to check entitlements, App Group, and Info.plist config automatically
- [ ] Expo Router deep-link helper for typed navigation from activity taps

---

## 21. Contributing

Contributions are welcome, especially for new presets and Android parity. Before opening a PR:

1. Open an issue describing the preset or change first — native/Swift changes are expensive to review without agreement on scope
2. New presets must include: the SwiftUI views for all Dynamic Island regions + Lock Screen banner, TypeScript types, a README section following the format in [Section 8](#8-presets--full-reference), and an example screen in `apps/example`
3. Run the existing test suite and add coverage for new JS-layer logic

---

## 22. License

MIT — free for personal and commercial use.

---

*End of documentation.*
