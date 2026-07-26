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

    // Starts a preset's activity, returning its id ("" when unsupported/unknown/failed).
    Function("startLiveActivity") { (preset: String, props: [String: Any], deepLinkUrl: String?) -> String in
      guard #available(iOS 16.2, *), let handler = PresetRegistry.handler(preset) else { return "" }
      return handler.start(props: props, deepLinkUrl: deepLinkUrl)
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
