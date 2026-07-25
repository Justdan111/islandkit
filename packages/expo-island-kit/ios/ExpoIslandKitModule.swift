import ExpoModulesCore
import ActivityKit
import Foundation

public class ExpoIslandKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoIslandKit")

    // Whether the user currently allows Live Activities for this app.
    // Resolves false on iOS < 16.1; the JS layer already guards non-iOS.
    AsyncFunction("areLiveActivitiesEnabled") { () -> Bool in
      if #available(iOS 16.1, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    // Synchronous "can I show a Now Playing Live Activity right now?" check, backing
    // NowPlayingActivity.isSupported(). This intentionally returns areActivitiesEnabled
    // (not a bare OS-version check): ActivityKit exposes no separate device-capability
    // API, and areActivitiesEnabled is Apple's documented gate — it is false both on
    // incapable devices and when the user has disabled Live Activities, which is the
    // safe signal for a caller deciding whether to call start(). Phase 3's shared API
    // may split "device-capable" from "user-enabled" if the spec calls for it.
    Function("isNowPlayingSupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    // Starts a Now Playing Live Activity and returns its id synchronously.
    // Returns "" when unsupported / disabled (JS treats "" as a no-op handle).
    Function("startNowPlaying") { (props: [String: Any], deepLinkUrl: String?) -> String in
      guard #available(iOS 16.2, *), ActivityAuthorizationInfo().areActivitiesEnabled else {
        return ""
      }
      let state = Self.contentState(from: props, base: nil)
      let attributes = NowPlayingAttributes(deepLinkUrl: deepLinkUrl)
      do {
        let activity = try Activity.request(
          attributes: attributes,
          content: ActivityContent(state: state, staleDate: nil)
        )
        return activity.id
      } catch {
        return ""
      }
    }

    // Applies a partial update to an existing activity.
    AsyncFunction("updateNowPlaying") { (activityId: String, props: [String: Any]) -> Void in
      guard #available(iOS 16.2, *) else { return }
      guard let activity = Activity<NowPlayingAttributes>.activities.first(where: { $0.id == activityId }) else {
        return
      }
      let newState = Self.contentState(from: props, base: activity.content.state)
      await activity.update(ActivityContent(state: newState, staleDate: nil))
    }

    // Ends an activity with the given dismissal policy.
    // policy: "default", "immediate", or an ISO-8601 date string ({ after: Date }).
    AsyncFunction("endNowPlaying") { (activityId: String, dismissalPolicy: String?) -> Void in
      guard #available(iOS 16.2, *) else { return }
      guard let activity = Activity<NowPlayingAttributes>.activities.first(where: { $0.id == activityId }) else {
        return
      }
      await activity.end(nil, dismissalPolicy: Self.dismissalPolicy(from: dismissalPolicy))
    }
  }

  // MARK: - Helpers

  @available(iOS 16.2, *)
  private static func dismissalPolicy(from raw: String?) -> ActivityUIDismissalPolicy {
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

  // Builds a ContentState from a JS props dict. When `base` is provided
  // (updates), only the keys present in `props` override it (partial update).
  private static func contentState(
    from props: [String: Any],
    base: NowPlayingAttributes.ContentState?
  ) -> NowPlayingAttributes.ContentState {
    func string(_ key: String, _ fallback: String) -> String { props[key] as? String ?? fallback }
    func optString(_ key: String, _ fallback: String?) -> String? {
      props.keys.contains(key) ? props[key] as? String : fallback
    }
    func bool(_ key: String, _ fallback: Bool) -> Bool {
      if let b = props[key] as? Bool { return b }
      if let n = props[key] as? NSNumber { return n.boolValue }
      return fallback
    }
    func double(_ key: String, _ fallback: Double) -> Double {
      if let d = props[key] as? Double { return d }
      if let n = props[key] as? NSNumber { return n.doubleValue }
      return fallback
    }

    return NowPlayingAttributes.ContentState(
      title: string("title", base?.title ?? ""),
      artist: string("artist", base?.artist ?? ""),
      artworkUrl: optString("artworkUrl", base?.artworkUrl),
      artworkAsset: optString("artworkAsset", base?.artworkAsset),
      isPlaying: bool("isPlaying", base?.isPlaying ?? false),
      elapsedSeconds: double("elapsedSeconds", base?.elapsedSeconds ?? 0),
      durationSeconds: double("durationSeconds", base?.durationSeconds ?? 0),
      accentColorHex: optString("accentColor", base?.accentColorHex)
    )
  }
}
