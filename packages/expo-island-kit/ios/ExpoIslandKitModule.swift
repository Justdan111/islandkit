import ExpoModulesCore
import ActivityKit

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
  }
}
