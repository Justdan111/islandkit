import ActivityKit
import Foundation

// Compiled into BOTH the app (pod) target and the widget target (via a symlink under
// apps/example/targets/island-kit-widget/) — ActivityKit requires the same
// ActivityAttributes type in both the app and the widget extension.
public struct NowPlayingAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var title: String
    public var artist: String
    public var artworkUrl: String?
    public var artworkAsset: String?
    public var isPlaying: Bool
    public var elapsedSeconds: Double
    public var durationSeconds: Double
    public var accentColorHex: String?

    public init(
      title: String,
      artist: String,
      artworkUrl: String? = nil,
      artworkAsset: String? = nil,
      isPlaying: Bool,
      elapsedSeconds: Double,
      durationSeconds: Double,
      accentColorHex: String? = nil
    ) {
      self.title = title
      self.artist = artist
      self.artworkUrl = artworkUrl
      self.artworkAsset = artworkAsset
      self.isPlaying = isPlaying
      self.elapsedSeconds = elapsedSeconds
      self.durationSeconds = durationSeconds
      self.accentColorHex = accentColorHex
    }
  }

  public var deepLinkUrl: String?

  public init(deepLinkUrl: String? = nil) {
    self.deepLinkUrl = deepLinkUrl
  }
}
