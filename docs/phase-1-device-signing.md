# Phase 1 — Run on a physical device (one-time signing)

The simulator build is verified: the example app builds, boots on an iPhone 17 Pro
simulator, and a native call round-trips to JS (`Native bridge: OK / Live Activities
enabled: true`). To complete the Phase-1 definition of done on real Dynamic Island
hardware (iPhone 14 Pro or newer), do this once.

## Prerequisites (already true in this repo)

- Project lives at a **space-free, non-cloud-synced path** (`/Users/danemmanuel/dev/islandkit`).
  Two independent constraints apply, and the location must satisfy both:
  - **No spaces.** React Native's prebuilt-core podspec builds a `file://` URI from
    the path and fails on spaces.
  - **No iCloud sync.** Under an iCloud-synced folder (`~/Documents` with "Desktop &
    Documents Folders" on), iCloud stamps `com.apple.FinderInfo` onto build products
    within ~30s. `codesign` then rejects the ExpoModulesJSI framework with *"resource
    fork, Finder information, or similar detritus not allowed"* and the build fails.
    Clearing attributes beforehand does not help — the stamping happens mid-build, and
    the framework's DerivedData path is hardcoded inside `node_modules`.

  Note: turning iCloud sync **off** does not leave files where they are — macOS empties
  `~/Documents` and moves everything into `~/Library/Mobile Documents/…`, which is both
  still iCloud and full of spaces. Back up or push before changing that setting.
- On **Expo SDK 57** (RN 0.86.2). This machine's Xcode is 26.6 (Swift 6.3.3), past
  the Xcode 26.4+ / Swift 6.3 (`weak let`) threshold that SDK 56+ requires — the
  earlier SDK 55 pin is lifted.
- Xcode 26.6 needs the **iOS 26.5 platform** installed (`xcodebuild -downloadPlatform
  iOS`). A leftover older simulator runtime alone is not enough: without the matching
  platform, `xcodebuild` reports *no eligible destinations* and refuses to build.

## Steps

1. From `apps/example`, (re)generate native and open the workspace:
   ```bash
   cd apps/example
   npx expo prebuild -p ios      # if ios/ is not present
   xed ios/example.xcworkspace   # opens Xcode on the workspace (NOT the .xcodeproj)
   ```
2. Select the **example** app target → **Signing & Capabilities**.
3. Check **Automatically manage signing**.
4. Set **Team** to your Personal Team (your free Apple ID).
5. Confirm the bundle identifier is `io.github.Justdan111.islandkitexample`
   (globally unique — do not change it to a generic value).
6. Do **not** add any capabilities — no App Groups, no Push Notifications.
7. Plug in the device, trust the Mac, then from `apps/example`:
   ```bash
   npx expo run:ios --device        # pick your physical device when prompted
   ```
8. On first launch, on the device go to Settings → General → VPN & Device
   Management and trust your developer certificate.
9. The app should launch and show **"IslandKit / Native bridge: OK"** plus a
   real "Live Activities enabled" value.

## Notes

- The app's iOS deployment target is 15.1; the `expo-island-kit` pod is iOS 15.1
  with ActivityKit code guarded by `@available(iOS 16.1, *)`. On a device below
  iOS 16.1, `areLiveActivitiesEnabled()` returns `false` (graceful degradation).
- If the build fails on signing, it is almost always the bundle identifier
  already being taken or the Team not selected — fix steps 3–5 and retry.
- Metro port: this repo's dev server uses 8081. If you run another Expo project
  at the same time, give one of them a different port (`--port 8090`) so the dev
  client loads the right bundle.
