# expo-island-kit

Drop-in iOS Live Activities and Dynamic Island presets for Expo. Four pre-built presets, zero Swift.

You install the package, add one config plugin, prebuild, and call a TypeScript function. IslandKit ships the SwiftUI widget extension and the ActivityKit plumbing for you — you never open Xcode to write a view.

---

## Demos

Recorded on an iPhone 14 Pro. Each clip starts the activity, leaves the app so the
Dynamic Island takes over, and updates it live.

<!--
  These URLs are absolute on purpose. This README is published to npm, and npm does not
  resolve relative image paths — and the GIFs live in docs/, which is excluded from the
  package tarball, so a relative path would point at nothing for an installed consumer.
  They render once the repository is public; while it is private they will 404.
-->

**Now Playing**

![Now Playing preset in the Dynamic Island](https://raw.githubusercontent.com/Justdan111/islandkit/main/docs/gif/nowplaying.gif)

**Generic Progress**

![Generic Progress preset in the Dynamic Island](https://raw.githubusercontent.com/Justdan111/islandkit/main/docs/gif/progress.gif)

**Delivery**

![Delivery preset in the Dynamic Island](https://raw.githubusercontent.com/Justdan111/islandkit/main/docs/gif/delivery.gif)

**Timer**

![Timer preset counting down in the Dynamic Island](https://raw.githubusercontent.com/Justdan111/islandkit/main/docs/gif/timer.gif)

---

## Requirements

| | |
|---|---|
| Expo SDK | 57 |
| iOS | 16.2+ (the widget target's deployment target) |
| Xcode | 26.4+ (Swift 6.3, required by Expo SDK 56 and newer) |
| Dynamic Island | iPhone 14 Pro or newer |

**iOS only.** On iOS 16.2+ devices *without* a Dynamic Island, Live Activities still work — they render as the Lock Screen banner. On Android and web, the whole API is present and type-checks, but every call is a safe no-op: `isSupported()` and `areLiveActivitiesEnabled()` return `false`, and `start()` returns an inert handle whose `update()`/`end()` do nothing.

---

## Quick start

Four steps, start to a live Dynamic Island. Works the same in **JavaScript and
TypeScript** — types ship with the package, so TS users get autocomplete without
installing anything extra.

**1. Install**

```bash
npx expo install expo-island-kit
```

**2. Add the plugin to `app.json`, listing the presets you want**

```json
{
  "expo": {
    "plugins": [
      ["expo-island-kit", { "presets": ["genericProgress", "timer"] }]
    ]
  }
}
```

Only the presets you list get a widget built. Omit `presets` entirely to get all four.
Calling a preset you left out throws — see [Known limitations](#known-limitations).

**3. Prebuild**

```bash
npx expo prebuild -p ios --clean
```

**4. Start, update, end**

```ts
import { GenericProgressActivity } from 'expo-island-kit';

// start() is synchronous and returns a handle immediately.
const upload = GenericProgressActivity.start({
  title: 'Uploading backup',
  subtitle: '0 of 400 photos',
  progress: 0,
  iconSystemName: 'icloud.and.arrow.up',
  accentColor: '#0A84FF',
});

if (!upload.id) {
  // Not an error you have to handle — the handle below still no-ops safely.
  console.log('Live Activity unavailable:', upload.reason);
}

// update() and end() are async.
await upload.update({ progress: 0.5, subtitle: '200 of 400 photos' });
await upload.end('immediate');
```

Run it on a real device or an iPhone 14 Pro-class simulator, then leave the app —
the Dynamic Island only shows the activity while your app is backgrounded.

---

## Install

```bash
npx expo install expo-island-kit
```

Add the config plugin to `app.json`:

```json
{ "expo": { "plugins": ["expo-island-kit"] } }
```

Then prebuild:

```bash
npx expo prebuild -p ios --clean
```

**`--clean` is required.** Running plain `npx expo prebuild` over an existing widget target fails with:

```
withIosXcodeProjectBeta2BaseMod: Cannot read properties of undefined
```

Prebuild generates your `ios/` folder plus the widget extension target at `targets/island-kit-widget/`, and sets `NSSupportsLiveActivities` on your app for you. `targets/` is build output — git-ignore it:

```gitignore
# .gitignore
targets/
```

For physical-device builds, set your team so the widget target can be signed:

```json
{ "expo": { "ios": { "bundleIdentifier": "com.yourcompany.yourapp", "appleTeamId": "YOUR_TEAM_ID" } } }
```

---

## Quickstart

Every preset follows the same shape: `start(props, deepLinkUrl?)` returns an instance you `update()` and then `end()`.

### Now Playing

```ts
import { NowPlayingActivity } from 'expo-island-kit';

const activity = NowPlayingActivity.start(
  {
    title: 'Midnight City',
    artist: 'M83',
    isPlaying: true,
    elapsedSeconds: 12,
    durationSeconds: 231,
    accentColor: '#FF375F',
  },
  'myapp://now-playing'
);

await activity.update({ elapsedSeconds: 42 });
await activity.end('immediate');
```

### Generic Progress

```ts
import { GenericProgressActivity } from 'expo-island-kit';

const upload = GenericProgressActivity.start({
  title: 'Uploading video',
  subtitle: 'sunset-clip.mov',
  progress: 0, // 0–1
  iconSystemName: 'arrow.up.circle.fill',
  accentColor: '#0A84FF',
});

await upload.update({ progress: 0.65, subtitle: '65% — about a minute left' });
await upload.end('default', { title: 'Upload complete', progress: 1 });
```

### Delivery

```ts
import { DeliveryActivity } from 'expo-island-kit';

const order = DeliveryActivity.start(
  {
    orderNumber: '#A4821', // immutable — set once at start
    status: 'confirmed',
    etaMinutes: 32,
    accentColor: '#30D158',
  },
  'myapp://orders/A4821'
);

await order.update({ status: 'preparing', etaMinutes: 25 });
await order.update({
  status: 'onTheWay',
  etaMinutes: 8,
  courierName: 'Ada',
  mapSnapshotUrl: 'https://example.com/snapshots/A4821.png',
});
await order.end('default', { status: 'delivered' });
```

### Timer

```ts
import { TimerActivity } from 'expo-island-kit';

const timer = TimerActivity.start({
  label: 'Pasta',
  endDate: new Date(Date.now() + 10 * 60 * 1000), // a real Date
  accentColor: '#FF9F0A',
});

// The countdown ticks natively — you do not need to push updates every second.
await timer.update({ isPaused: true }); // pause
await timer.update({ endDate: new Date(Date.now() + 4 * 60 * 1000), isPaused: false }); // resume

await timer.end({ after: new Date(Date.now() + 30 * 1000) });
```

> Pausing does not rewrite `endDate` for you. Track the remaining time yourself and pass a fresh `endDate` when you resume.

### Checking availability first

```ts
import { areLiveActivitiesEnabled, TimerActivity } from 'expo-island-kit';

if (TimerActivity.isSupported() && (await areLiveActivitiesEnabled())) {
  TimerActivity.start({ label: 'Tea', endDate: new Date(Date.now() + 180_000) });
}
```

---

## Images and icons

### A system icon (SF Symbol)

`GenericProgressProps.iconSystemName` takes an SF Symbol name. Anything in Apple's
[SF Symbols](https://developer.apple.com/sf-symbols/) catalogue works — the string must
match the symbol name exactly, and an unknown name renders nothing.

```ts
GenericProgressActivity.start({
  title: 'Uploading backup',
  progress: 0.32,
  iconSystemName: 'icloud.and.arrow.up', // also e.g. 'arrow.down.circle.fill', 'square.and.arrow.up'
  accentColor: '#0A84FF',
});
```

### A remote image by URL

Two presets take a remote image: `NowPlayingProps.artworkUrl` and
`DeliveryProps.mapSnapshotUrl`. Both are plain `https://` strings, loaded by the widget
at render time.

```ts
NowPlayingActivity.start({
  title: 'Midnight City',
  artist: 'M83',
  artworkUrl: 'https://example.com/art/midnight-city-256.jpg',
  isPlaying: true,
  elapsedSeconds: 12,
  durationSeconds: 231,
});

DeliveryActivity.start({
  orderNumber: '#48213',
  status: 'onTheWay',
  etaMinutes: 12,
  mapSnapshotUrl: 'https://example.com/snapshots/48213-480w.png',
});
```

Both are optional. Omit them and the preset renders its own placeholder rather than
failing.

### Keep images small — this is Apple's constraint, not IslandKit's

The Dynamic Island and Lock Screen banner are drawn by a **widget extension**, which iOS
runs under a hard memory limit far tighter than your app's. Decoding a large image can
exceed it, and when that happens the system kills the extension — the symptom is an
activity that renders blank or vanishes, with no error in your JS.

Practical guidance:

- Serve images already sized for the slot. Artwork is displayed small; a 256×256 asset
  is plenty, and a 3000×3000 original is a liability.
- Prefer compressed JPEG/PNG over anything large or progressive.
- Remote images are fetched over the network at render time, so a slow or failing URL
  shows the placeholder instead. Don't rely on one being available instantly.

**Bundled/local image assets are not supported yet.** Remote URLs are the only image
input that reaches the widget today; see [Known limitations](#known-limitations).

---

## API reference

### `areLiveActivitiesEnabled(): Promise<boolean>`

Whether the user currently allows Live Activities for your app (Settings ▸ *Your App* ▸ Live Activities). Returns `false` on non-iOS platforms and on iOS below 16.1.

### `LiveActivityFactory<T>`

Each of `NowPlayingActivity`, `GenericProgressActivity`, `DeliveryActivity` and `TimerActivity` is a `LiveActivityFactory`:

```ts
interface LiveActivityFactory<T> {
  start(props: T, deepLinkUrl?: string): LiveActivityInstance<T>;
  getActiveInstances(): LiveActivityInstance<T>[];
  isSupported(): boolean;
}
```

- `start` is **synchronous** and always returns a handle. `deepLinkUrl` is the URL opened when the user taps the activity — it must match your app's `scheme`.
- `getActiveInstances` returns the activities started by *this* app process (see [Known limitations](#known-limitations)).
- `isSupported` reports whether the device/OS can host Live Activities at all — it does not check the user's permission; use `areLiveActivitiesEnabled()` for that.

### `LiveActivityInstance<T>`

```ts
interface LiveActivityInstance<T> {
  readonly id: string;
  readonly reason?: IslandKitFailureReason; // set only when id === ''
  update(props: Partial<T>): Promise<void>;
  end(dismissalPolicy?: DismissalPolicy, finalProps?: Partial<T>): Promise<void>;
}
```

`id` is the ActivityKit activity id, or `''` when the activity could not start — in which case `reason` says why. A `''` handle still no-ops safely, so you never have to null-check before calling `update`/`end`.

### Failure: what throws and what doesn't

IslandKit distinguishes **your** mistakes from **the user's** settings. Mistakes throw, because only a code change fixes them. Conditions the user or OS controls never throw — an app should not crash because someone turned a toggle off.

```ts
type IslandKitFailureReason =
  | 'not-ios'              // running on a non-iOS platform
  | 'unsupported-os'       // iOS older than 16.2
  | 'activities-disabled'  // the user switched Live Activities off in Settings
  | 'system-refused';      // ActivityKit rejected the request (e.g. too many active)

class IslandKitError extends Error {
  readonly code: 'unknown-preset' | 'preset-excluded';
  readonly preset: string;
}
```

| Situation | Behaviour |
|---|---|
| Preset name isn't a real preset | **throws** `IslandKitError` (`unknown-preset`) |
| Preset excluded from the plugin's `presets` | **throws** `IslandKitError` (`preset-excluded`) |
| Non-iOS platform, iOS < 16.2, user disabled, ActivityKit refused | inert instance: `id === ''`, `reason` set |

The recommended pattern — no `try`/`catch` needed for the environmental cases:

```ts
const activity = NowPlayingActivity.start(props);
if (!activity.id) {
  console.log('Live Activity unavailable:', activity.reason);
}
```

In development builds an inert start also logs a warning naming the reason, so it shows up in Metro without any code on your side.

### `DismissalPolicy`

```ts
type DismissalPolicy = 'default' | 'immediate' | { after: Date };
```

- `'default'` — the system keeps the ended activity on screen briefly (up to ~4 hours).
- `'immediate'` — removed at once.
- `{ after: date }` — removed at `date`.

### `NowPlayingProps`

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

### `GenericProgressProps`

| `GenericProgressProps` | type | required |
|---|---|---|
| `title` | `string` | yes |
| `subtitle` | `string` | no |
| `progress` | `number` (0–1) | yes |
| `iconSystemName` | `string` (SF Symbol) | no |
| `accentColor` | `string` (hex) | no |

### `DeliveryProps`

| `DeliveryProps` | type | required |
|---|---|---|
| `status` | `'confirmed' \| 'preparing' \| 'onTheWay' \| 'delivered'` | yes |
| `etaMinutes` | `number` | no |
| `courierName` | `string` | no |
| `orderNumber` | `string` | yes (immutable — set at `start`, ignored by `update`) |
| `mapSnapshotUrl` | `string` | no |
| `accentColor` | `string` (hex) | no |

### `TimerProps`

| `TimerProps` | type | required |
|---|---|---|
| `label` | `string` | yes |
| `endDate` | `Date` | yes |
| `isPaused` | `boolean` | no |
| `accentColor` | `string` (hex) | no |

### Prop validation

Two values are checked before they reach the native layer, because both fail quietly otherwise:

- **`progress` is clamped to `0`–`1`.** Out-of-range values render a broken bar rather than erroring, so they are clamped and warned about in development. `NaN` becomes `0`.
- **A `Timer.endDate` in the past warns in development** but is not an error — a timer can legitimately expire between computing the date and starting the activity. The countdown renders as static remaining time rather than ticking.

Optional props are deliberately **not** given default values. Absence is meaningful: on `update`, a prop you omit keeps its previous value, so injecting a default would silently overwrite state you meant to leave alone.

---

## Config plugin options

```json
{
  "expo": {
    "plugins": [
      ["expo-island-kit", { "presets": ["nowPlaying", "timer"], "defaultAccentColor": "#FF375F" }]
    ]
  }
}
```

| option | default | notes |
|---|---|---|
| `presets` | all four | array; empty array or unknown key throws with the valid list |
| `deploymentTarget` | `'16.2'` | widget target's iOS deployment target |
| `bundleIdentifier` | `<appId>.widget` | omitted by default so apple-targets' derived id is preserved |
| `defaultAccentColor` | `nil` | fallback accent when a preset omits `accentColor` |

Valid `presets` keys: `nowPlaying`, `genericProgress`, `delivery`, `timer`.

**Options that warn instead of erroring** (so an older copy-pasted snippet still builds):

| option | why |
|---|---|
| `appleTeamId` | set `ios.appleTeamId` in your app config instead — the widget target signs from it |
| `groupIdentifier` | App Groups are not supported |
| `enablePushNotifications` | push updates are not supported |

**Do not also list `@bacons/apple-targets` in your `plugins` array.** IslandKit applies it for you; listing both applies it twice and prebuild fails with `withIosXcodeProjectBeta2BaseMod: Cannot read properties of undefined`. IslandKit warns when it sees this.

Related known issue: `@bacons/apple-targets@5.0.0` cannot handle two targets of the same `type`. If your own `targets/` directory defines a second **widget** extension, prebuild crashes with a `removeFromProject` error. Other target types (`share`, `notification-content`, …) coexist with IslandKit's fine.

---

## Known limitations

Read this section before filing a bug — most surprises are here.

- **Calling a preset you excluded throws.** Narrowing `presets` omits that preset's widget from the generated target, so there is nothing to render it. `start()` throws an `IslandKitError` naming the preset and the included list, rather than starting an invisible activity. If you narrow `presets`, remember to re-run `npx expo prebuild -p ios --clean`.
- **`getActiveInstances()` is a query against iOS, not a view of your own state.** It returns what ActivityKit currently reports, so an activity the user or the system dismissed disappears from it even if your code started it. Using it as a local registry — `getActiveInstances().forEach((i) => i.end())` — will do nothing when iOS disagrees. Instances for activities you did not start in this process are new objects each call, so compare by `id`, not by reference.
- **No push updates.** Updates come from the app process only. Push-driven updates require a paid Apple Developer account and are not implemented.
- **No App Groups.** The App Groups capability is not added and is not supported.
- **`NowPlayingProps.artworkAsset` is accepted but does nothing.** The prop exists in the types and is carried all the way to the widget's content state, but no preset renders it — only `artworkUrl` is drawn. Use a remote URL for artwork; bundled-asset support is on the roadmap.
- **No theming and no animation control.** Layouts are fixed. `accentColor` is the only visual knob.
- **The generated widget target is not customisable.** `targets/island-kit-widget/` is overwritten on every prebuild by design; there is no supported override or eject mechanism yet.
- **The plugin regenerates `targets/island-kit-widget/` on any Expo config read** — `expo start`, `expo config`, `expo-doctor` and EAS config resolution all evaluate the plugin chain and rewrite it. The content is byte-identical each time, but mtimes change, so Xcode may recompile the widget more than strictly necessary; avoid running `expo start` concurrently with a build.

---

## Upgrading

After upgrading the package, always re-run:

```bash
npx expo prebuild -p ios --clean
```

The widget target is generated *from the installed package version*, so an upgrade that doesn't re-prebuild leaves you running stale native code. Never hand-edit `targets/island-kit-widget/` — it is regenerated and overwritten every prebuild.

---

## Roadmap

**Not yet available.** Planned, in rough order:

- **v2: theming** — colours, fonts and layout variants beyond `accentColor`.
- **v2: animations** — transition control for content-state changes.
- **Push-driven updates** — updating an activity from your server via ActivityKit push tokens (requires a paid Apple Developer account).

---

## License

MIT — see [LICENSE](./LICENSE).

Source, issues and contributing: [github.com/Justdan111/islandkit](https://github.com/Justdan111/islandkit).
