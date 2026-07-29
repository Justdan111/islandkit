import ActivityKit
import Foundation

// Compiled into BOTH the app (pod) target and the widget target (via a symlink under
// apps/example/targets/island-kit-widget/). `endDate` drives a native Text(timerInterval:)
// countdown in the widget — it ticks with zero JS.
public struct TimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var label: String
    public var endDate: Date
    public var isPaused: Bool
    public var accentColorHex: String?

    public init(label: String, endDate: Date, isPaused: Bool = false, accentColorHex: String? = nil) {
      self.label = label
      self.endDate = endDate
      self.isPaused = isPaused
      self.accentColorHex = accentColorHex
    }
  }

  public var deepLinkUrl: String?

  public init(deepLinkUrl: String? = nil) {
    self.deepLinkUrl = deepLinkUrl
  }
}
