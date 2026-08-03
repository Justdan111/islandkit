# expo-island-kit

Drop-in iOS Live Activities and Dynamic Island presets for Expo

## Installation & Setup

### 1. Install the package

```bash
npx expo install expo-island-kit
```

### 2. Add the config plugin

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

To customise, pass options — see the full docs' [Configuration Reference](../../docs/islandkit-full-documentation.md#11-configuration-reference-appjson) for all of them:

```json
["expo-island-kit", { "presets": ["nowPlaying", "timer"] }]
```

### 3. Prebuild

```bash
npx expo prebuild -p ios --clean
```

This generates your `ios/` folder, including the widget extension target, with `NSSupportsLiveActivities` set on your app automatically.

The generated `targets/island-kit-widget/` directory is **build output**: it is overwritten on every `expo prebuild` and should be git-ignored. Do not edit it by hand. Add it to your `.gitignore`:

```
# .gitignore
targets/
```

See `docs/islandkit-full-documentation.md` in the repo for the full API reference, preset props, and configuration options.
