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
