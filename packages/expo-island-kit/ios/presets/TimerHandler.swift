import ActivityKit
import Foundation

struct TimerHandler: LiveActivityPresetHandler {
  let name = "timer"

  @available(iOS 16.2, *)
  func start(props: [String: Any], deepLinkUrl: String?) -> [String: Any?] {
    LiveActivityEngine.start(
      TimerAttributes(deepLinkUrl: deepLinkUrl),
      Self.contentState(from: props, base: nil)
    )
  }

  @available(iOS 16.2, *)
  func activeIds() -> [String] {
    LiveActivityEngine.activeIds(TimerAttributes.self)
  }

  @available(iOS 16.2, *)
  func update(id: String, props: [String: Any]) async {
    await LiveActivityEngine.update(TimerAttributes.self, id: id) { base in
      Self.contentState(from: props, base: base)
    }
  }

  @available(iOS 16.2, *)
  func end(id: String, dismissalPolicy: String?) async {
    await LiveActivityEngine.end(TimerAttributes.self, id: id, dismissalPolicy: dismissalPolicy)
  }

  private static func contentState(
    from props: [String: Any],
    base: TimerAttributes.ContentState?
  ) -> TimerAttributes.ContentState {
    TimerAttributes.ContentState(
      label: PropCoercion.string(props, "label", base?.label ?? ""),
      endDate: PropCoercion.date(props, "endDate", base?.endDate) ?? base?.endDate ?? Date(),
      isPaused: PropCoercion.bool(props, "isPaused", base?.isPaused ?? false),
      accentColorHex: PropCoercion.optString(props, "accentColor", base?.accentColorHex)
    )
  }
}
