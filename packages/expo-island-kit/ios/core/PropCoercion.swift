import ActivityKit
import Foundation

// Shared coercion helpers turning a JS [String: Any] props dict into typed values.
// `optString` distinguishes "key absent → keep previous value" from
// "key present but wrong type → nil".
enum PropCoercion {
  static func string(_ props: [String: Any], _ key: String, _ fallback: String) -> String {
    props[key] as? String ?? fallback
  }
  static func optString(_ props: [String: Any], _ key: String, _ fallback: String?) -> String? {
    props.keys.contains(key) ? props[key] as? String : fallback
  }
  static func bool(_ props: [String: Any], _ key: String, _ fallback: Bool) -> Bool {
    if let b = props[key] as? Bool { return b }
    if let n = props[key] as? NSNumber { return n.boolValue }
    return fallback
  }
  static func double(_ props: [String: Any], _ key: String, _ fallback: Double) -> Double {
    if let d = props[key] as? Double { return d }
    if let n = props[key] as? NSNumber { return n.doubleValue }
    return fallback
  }
  // Optional double: absent key → keep `fallback`; present → coerce (or nil if mistyped).
  static func optDouble(_ props: [String: Any], _ key: String, _ fallback: Double?) -> Double? {
    guard props.keys.contains(key) else { return fallback }
    if let d = props[key] as? Double { return d }
    if let n = props[key] as? NSNumber { return n.doubleValue }
    return nil
  }
  // Optional date from an ISO-8601 string (produced by the factory's Date serialization).
  // Absent key / non-string → keep `fallback`.
  static func date(_ props: [String: Any], _ key: String, _ fallback: Date?) -> Date? {
    guard props.keys.contains(key), let s = props[key] as? String else { return fallback }
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f.date(from: s) ?? ISO8601DateFormatter().date(from: s) ?? fallback
  }
}

// Parses the dismissal-policy string from JS: "immediate", "default", or an ISO-8601 date.
@available(iOS 16.2, *)
enum DismissalPolicyParser {
  static func parse(_ raw: String?) -> ActivityUIDismissalPolicy {
    switch raw {
    case "immediate":
      return .immediate
    case .some(let value) where value != "default":
      let formatter = ISO8601DateFormatter()
      formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
      if let date = formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value) {
        return .after(date)
      }
      return .default
    default:
      return .default
    }
  }
}
