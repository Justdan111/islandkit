import ActivityKit
import Foundation

// Compiled into BOTH the app (pod) target and the widget target — the same
// ActivityAttributes type must exist in both. The widget target references this
// exact file via a symlink under apps/example/targets/island-kit-widget/.
public struct GenericProgressAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var title: String
    public var subtitle: String?
    public var progress: Double
    public var iconSystemName: String?
    public var accentColorHex: String?

    public init(
      title: String,
      subtitle: String? = nil,
      progress: Double,
      iconSystemName: String? = nil,
      accentColorHex: String? = nil
    ) {
      self.title = title
      self.subtitle = subtitle
      self.progress = progress
      self.iconSystemName = iconSystemName
      self.accentColorHex = accentColorHex
    }
  }

  public var deepLinkUrl: String?

  public init(deepLinkUrl: String? = nil) {
    self.deepLinkUrl = deepLinkUrl
  }
}
