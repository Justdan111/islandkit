import ActivityKit
import Foundation

// Generic ActivityKit operations, parameterized by the concrete ActivityAttributes
// type. All availability gating and error handling live here; handlers stay thin.
@available(iOS 16.2, *)
enum LiveActivityEngine {
  static func start<A: ActivityAttributes>(_ attributes: A, _ state: A.ContentState) -> String {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return "" }
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

  static func update<A: ActivityAttributes>(
    _ type: A.Type,
    id: String,
    newState: (A.ContentState) -> A.ContentState
  ) async {
    guard let activity = Activity<A>.activities.first(where: { $0.id == id }) else { return }
    await activity.update(ActivityContent(state: newState(activity.content.state), staleDate: nil))
  }

  static func end<A: ActivityAttributes>(_ type: A.Type, id: String, dismissalPolicy raw: String?) async {
    guard let activity = Activity<A>.activities.first(where: { $0.id == id }) else { return }
    await activity.end(nil, dismissalPolicy: DismissalPolicyParser.parse(raw))
  }
}
