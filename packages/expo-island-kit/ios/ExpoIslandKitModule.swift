import ExpoModulesCore
import ActivityKit
import Foundation

public class ExpoIslandKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoIslandKit")

    // Whether the user currently allows Live Activities. False on iOS < 16.1.
    AsyncFunction("areLiveActivitiesEnabled") { () -> Bool in
      if #available(iOS 16.1, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    // Synchronous "can I show a Live Activity right now?" — shared by every preset's
    // isSupported(). areActivitiesEnabled is Apple's documented gate (false on
    // incapable devices and when the user disabled Live Activities).
    Function("isLiveActivitySupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    // Starts a preset's activity, returning { "id": String, "reason": String? }.
    //
    // Two kinds of failure, deliberately signalled differently: a developer mistake
    // (unknown or excluded preset) THROWS, because it can only be fixed in code; a
    // user/OS condition (old iOS, Live Activities switched off, ActivityKit refusing)
    // returns an empty id with a reason, because an app must not crash over a setting.
    Function("startLiveActivity") { (preset: String, props: [String: Any], deepLinkUrl: String?) -> [String: Any] in
      guard let handler = PresetRegistry.handler(preset) else {
        throw UnknownPresetException(preset)
      }
      if IncludedPresets.excludes(preset) {
        throw PresetExcludedException((preset, IncludedPresets.listDescription))
      }
      guard #available(iOS 16.2, *) else {
        return ["id": "", "reason": "unsupported-os"]
      }
      return handler.start(props: props, deepLinkUrl: deepLinkUrl)
    }

    // ActivityKit's own list, which unlike the JS-side map survives app termination.
    Function("getActiveActivityIds") { (preset: String) -> [String] in
      guard #available(iOS 16.2, *), let handler = PresetRegistry.handler(preset) else { return [] }
      return handler.activeIds()
    }

    AsyncFunction("updateLiveActivity") { (preset: String, activityId: String, props: [String: Any]) -> Void in
      guard #available(iOS 16.2, *), let handler = PresetRegistry.handler(preset) else { return }
      await handler.update(id: activityId, props: props)
    }

    // dismissalPolicy: "default", "immediate", or an ISO-8601 date string.
    AsyncFunction("endLiveActivity") { (preset: String, activityId: String, dismissalPolicy: String?) -> Void in
      guard #available(iOS 16.2, *), let handler = PresetRegistry.handler(preset) else { return }
      await handler.end(id: activityId, dismissalPolicy: dismissalPolicy)
    }
  }
}

// Developer errors. These surface to JS as real thrown errors, which the TS factory
// rewraps as IslandKitError — the message carries the fix, not just the symptom.

internal final class UnknownPresetException: GenericException<String> {
  override var reason: String {
    "unknown preset \"\(param)\". Valid presets: nowPlaying, genericProgress, delivery, timer."
  }
}

// param: (requested preset, comma-separated included list)
internal final class PresetExcludedException: GenericException<(String, String)> {
  override var reason: String {
    "preset \"\(param.0)\" is not included in this build. Included: \(param.1). "
      + "Add it to the plugin's \"presets\" option and re-run: npx expo prebuild -p ios --clean"
  }
}
