import ActivityKit
import Foundation

struct DeliveryHandler: LiveActivityPresetHandler {
  let name = "delivery"

  @available(iOS 16.2, *)
  func start(props: [String: Any], deepLinkUrl: String?) -> [String: Any] {
    let orderNumber = PropCoercion.string(props, "orderNumber", "")
    return LiveActivityEngine.start(
      DeliveryAttributes(orderNumber: orderNumber, deepLinkUrl: deepLinkUrl),
      Self.contentState(from: props, base: nil)
    )
  }

  @available(iOS 16.2, *)
  func activeIds() -> [String] {
    LiveActivityEngine.activeIds(DeliveryAttributes.self)
  }

  @available(iOS 16.2, *)
  func update(id: String, props: [String: Any]) async {
    await LiveActivityEngine.update(DeliveryAttributes.self, id: id) { base in
      Self.contentState(from: props, base: base)
    }
  }

  @available(iOS 16.2, *)
  func end(id: String, dismissalPolicy: String?) async {
    await LiveActivityEngine.end(DeliveryAttributes.self, id: id, dismissalPolicy: dismissalPolicy)
  }

  // `orderNumber` is intentionally NOT decoded here — it is immutable and lives on
  // the Attributes (set at start). `accentColor` → `accentColorHex` (the rename).
  private static func contentState(
    from props: [String: Any],
    base: DeliveryAttributes.ContentState?
  ) -> DeliveryAttributes.ContentState {
    DeliveryAttributes.ContentState(
      status: PropCoercion.string(props, "status", base?.status ?? "confirmed"),
      etaMinutes: PropCoercion.optDouble(props, "etaMinutes", base?.etaMinutes),
      courierName: PropCoercion.optString(props, "courierName", base?.courierName),
      mapSnapshotUrl: PropCoercion.optString(props, "mapSnapshotUrl", base?.mapSnapshotUrl),
      accentColorHex: PropCoercion.optString(props, "accentColor", base?.accentColorHex)
    )
  }
}
