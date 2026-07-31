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
//
// Named `presetAccentColor` rather than `accentColor` because SwiftUI's `View`
// has a deprecated instance method `accentColor(_ accentColor: Color?) -> some View`.
// Swift's unqualified lookup inside a View's `body` prefers that member over a
// module-scope free function of the same name — even though its `Color?`
// parameter can't accept our `String?` argument — producing a hard type error
// instead of falling back to this function. Avoid the name collision entirely.
// Falls back through: the preset's own accentColor prop -> the plugin's
// defaultAccentColor option (generated into IslandKitDefaults.swift, nil when unset)
// -> the system accent.
func presetAccentColor(_ hex: String?) -> Color {
  Color(hex: hex) ?? Color(hex: islandKitDefaultAccentHex) ?? .accentColor
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
