import ActivityKit
import Foundation

// NOTE: This struct is duplicated verbatim in the widget target
// (apps/example/targets/island-kit-widget/NowPlayingAttributes.swift).
// ActivityKit requires the same ActivityAttributes type in both the app and
// the widget extension. Keep the two files byte-for-byte identical.
// Phase 3 will extract this into a shared location to remove the duplication.
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
