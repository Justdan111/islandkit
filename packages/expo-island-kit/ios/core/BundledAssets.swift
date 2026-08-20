import Foundation

// Which images the config plugin's `assets` option bundled into the widget extension,
// published by app.plugin.js as the `IslandKitBundledAssets` Info.plist array.
//
// The widget resolves `artworkAsset` against its own bundle, so a name that was never
// declared in `assets` simply finds nothing and the view falls back to the URL or the
// placeholder. That failure is invisible: the developer sees no artwork and no error.
// Exposing the list lets the JS layer say which names are actually available.
//
// Back-compat matches IncludedPresets: a MISSING key means an app prebuilt by an older
// IslandKit, which is "unknown", not "nothing bundled" — so callers must treat nil and
// empty differently and avoid warning when the list simply is not published.
enum BundledAssets {
  // Read once: Bundle.main's info dictionary is fixed for the process lifetime.
  private static let cached: [String]? =
    Bundle.main.object(forInfoDictionaryKey: "IslandKitBundledAssets") as? [String]

  static var names: [String]? { cached }
}
