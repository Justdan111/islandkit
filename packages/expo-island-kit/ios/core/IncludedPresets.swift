import Foundation

// Which presets the config plugin actually generated widgets for, published by
// app.plugin.js as the `IslandKitIncludedPresets` Info.plist array.
//
// Narrowing the plugin's `presets` option omits a preset's Widget from the generated
// target, but every handler stays registered natively — so without this list `start()`
// would return a perfectly valid id for a preset that has no compiled widget to render
// it, and nothing anywhere could detect it.
//
// Back-compat: a MISSING key means an app prebuilt by an older IslandKit. That is
// "unknown", never "excluded" — only an explicitly present array may report exclusion.
enum IncludedPresets {
  // Read once: Bundle.main's info dictionary is fixed for the process lifetime.
  private static let cached: [String]? =
    Bundle.main.object(forInfoDictionaryKey: "IslandKitIncludedPresets") as? [String]

  static func excludes(_ preset: String) -> Bool {
    guard let list = cached else { return false }
    return !list.contains(preset)
  }

  static var listDescription: String {
    let list = cached ?? []
    return list.isEmpty ? "(none)" : list.joined(separator: ", ")
  }
}
