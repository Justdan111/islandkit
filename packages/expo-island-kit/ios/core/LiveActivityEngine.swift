import ActivityKit
import Foundation

// Generic ActivityKit operations, parameterized by the concrete ActivityAttributes
// type. All availability gating and error handling live here; handlers stay thin.
@available(iOS 16.2, *)
enum LiveActivityEngine {
  // Returns { "id": String, "reason": String? }. An empty id always carries a reason, so
  // the caller can tell a disabled user toggle from ActivityKit refusing the request.
  // Reason strings are part of the public contract — the TS layer matches them literally.
  static func start<A: ActivityAttributes>(_ attributes: A, _ state: A.ContentState) -> [String: Any] {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      return ["id": "", "reason": "activities-disabled"]
    }
    do {
      let activity = try Activity.request(
        attributes: attributes,
        content: ActivityContent(state: state, staleDate: nil)
      )
      // Success omits "reason" rather than sending an explicit nil: the dictionary is
      // [String: Any], so a nil value would have to be boxed, and "absent" already
      // means "no failure" on the JS side.
      return ["id": activity.id]
    } catch {
      // Previously discarded entirely, which is why failure presented as silence.
      NSLog("[IslandKit] Activity.request failed: \(error.localizedDescription)")
      return ["id": "", "reason": "system-refused", "detail": error.localizedDescription]
    }
  }

  // ActivityKit is authoritative on which activities exist: its list includes activities
  // started by a previous process and excludes ones the OS or the user dismissed.
  static func activeIds<A: ActivityAttributes>(_ type: A.Type) -> [String] {
    Activity<A>.activities.map { $0.id }
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
