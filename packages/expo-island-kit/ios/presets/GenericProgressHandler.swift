import ActivityKit
import Foundation

struct GenericProgressHandler: LiveActivityPresetHandler {
  let name = "genericProgress"

  @available(iOS 16.2, *)
  func start(props: [String: Any], deepLinkUrl: String?) -> [String: Any] {
    LiveActivityEngine.start(
      GenericProgressAttributes(deepLinkUrl: deepLinkUrl),
      Self.contentState(from: props, base: nil)
    )
  }

  @available(iOS 16.2, *)
  func activeIds() -> [String] {
    LiveActivityEngine.activeIds(GenericProgressAttributes.self)
  }

  @available(iOS 16.2, *)
  func update(id: String, props: [String: Any]) async {
    await LiveActivityEngine.update(GenericProgressAttributes.self, id: id) { base in
      Self.contentState(from: props, base: base)
    }
  }

  @available(iOS 16.2, *)
  func end(id: String, dismissalPolicy: String?) async {
    await LiveActivityEngine.end(GenericProgressAttributes.self, id: id, dismissalPolicy: dismissalPolicy)
  }

  private static func contentState(
    from props: [String: Any],
    base: GenericProgressAttributes.ContentState?
  ) -> GenericProgressAttributes.ContentState {
    GenericProgressAttributes.ContentState(
      title: PropCoercion.string(props, "title", base?.title ?? ""),
      subtitle: PropCoercion.optString(props, "subtitle", base?.subtitle),
      progress: PropCoercion.double(props, "progress", base?.progress ?? 0),
      iconSystemName: PropCoercion.optString(props, "iconSystemName", base?.iconSystemName),
      accentColorHex: PropCoercion.optString(props, "accentColor", base?.accentColorHex)
    )
  }
}
