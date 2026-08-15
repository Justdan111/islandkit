import ActivityKit
import Foundation

struct NowPlayingHandler: LiveActivityPresetHandler {
  let name = "nowPlaying"

  @available(iOS 16.2, *)
  func start(props: [String: Any], deepLinkUrl: String?) -> [String: Any] {
    LiveActivityEngine.start(
      NowPlayingAttributes(deepLinkUrl: deepLinkUrl),
      Self.contentState(from: props, base: nil)
    )
  }

  @available(iOS 16.2, *)
  func activeIds() -> [String] {
    LiveActivityEngine.activeIds(NowPlayingAttributes.self)
  }

  @available(iOS 16.2, *)
  func update(id: String, props: [String: Any]) async {
    await LiveActivityEngine.update(NowPlayingAttributes.self, id: id) { base in
      Self.contentState(from: props, base: base)
    }
  }

  @available(iOS 16.2, *)
  func end(id: String, dismissalPolicy: String?) async {
    await LiveActivityEngine.end(NowPlayingAttributes.self, id: id, dismissalPolicy: dismissalPolicy)
  }

  // JS props → ContentState. On update, keys absent from `props` keep their prior
  // value from `base`. `accentColor` maps to `accentColorHex` (the one rename).
  private static func contentState(
    from props: [String: Any],
    base: NowPlayingAttributes.ContentState?
  ) -> NowPlayingAttributes.ContentState {
    NowPlayingAttributes.ContentState(
      title: PropCoercion.string(props, "title", base?.title ?? ""),
      artist: PropCoercion.string(props, "artist", base?.artist ?? ""),
      artworkUrl: PropCoercion.optString(props, "artworkUrl", base?.artworkUrl),
      artworkAsset: PropCoercion.optString(props, "artworkAsset", base?.artworkAsset),
      isPlaying: PropCoercion.bool(props, "isPlaying", base?.isPlaying ?? false),
      elapsedSeconds: PropCoercion.double(props, "elapsedSeconds", base?.elapsedSeconds ?? 0),
      durationSeconds: PropCoercion.double(props, "durationSeconds", base?.durationSeconds ?? 0),
      accentColorHex: PropCoercion.optString(props, "accentColor", base?.accentColorHex)
    )
  }
}
