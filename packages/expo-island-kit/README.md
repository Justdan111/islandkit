# expo-island-kit

Drop-in iOS Live Activities and Dynamic Island presets for Expo. Four pre-built presets, zero Swift.

You install the package, add one config plugin, prebuild, and call a TypeScript function. IslandKit ships the SwiftUI widget extension and the ActivityKit plumbing for you — you never open Xcode to write a view.

---

## Demos

<!-- MEDIA SLOT: now-playing.gif — device capture, iPhone 14 Pro, compact + expanded -->
_Now Playing — recording coming soon._

<!-- MEDIA SLOT: generic-progress.gif — device capture, iPhone 14 Pro, compact + expanded -->
_Generic Progress — recording coming soon._

<!-- MEDIA SLOT: delivery.gif — device capture, iPhone 14 Pro, compact + expanded -->
_Delivery — recording coming soon._

<!-- MEDIA SLOT: timer.gif — device capture, iPhone 14 Pro, compact + expanded -->
_Timer — recording coming soon._

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
  update(props: Partial<T>): Promise<void>;
  end(dismissalPolicy?: DismissalPolicy, finalProps?: Partial<T>): Promise<void>;
}
```

`id` is the ActivityKit activity id, or `''` when the start failed (unsupported OS, Live Activities disabled, or a native error). A `''` handle still no-ops safely — check it if you want failures to be visible.

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

- **The `presets` footgun.** Narrowing `presets` omits that preset's widget from the generated target. The TypeScript factory still exists and `start()` still returns an instance, so **calling an excluded preset renders nothing, silently.** If a preset doesn't appear, check your `presets` array first.
- **`getActiveInstances()` only sees activities started by the current app process.** Live Activities survive app termination, but instances from a previous launch are not returned, so they cannot be updated or ended through it. Workaround: track your own activity ids, or end activities before the app exits.
- **No push updates.** Updates come from the app process only. Push-driven updates require a paid Apple Developer account and are not implemented.
- **No App Groups.** The App Groups capability is not added and is not supported.
- **Native errors are currently coarse.** Failures degrade to a no-op with an empty activity id (`instance.id === ''`) rather than a descriptive error. If nothing appears, check the id before anything else.
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
- Richer native error reporting to replace the current empty-id no-op.

---

## License

MIT — see [LICENSE](./LICENSE).

Source, issues and contributing: [github.com/Justdan111/islandkit](https://github.com/Justdan111/islandkit).
