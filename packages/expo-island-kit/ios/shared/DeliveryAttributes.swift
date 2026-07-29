import ActivityKit
import Foundation

// Compiled into BOTH the app (pod) target and the widget target (via a symlink under
// apps/example/targets/island-kit-widget/). `orderNumber` is immutable for the
// activity's life, so it lives on the Attributes, not ContentState.
public struct DeliveryAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public var status: String
    public var etaMinutes: Double?
    public var courierName: String?
    public var mapSnapshotUrl: String?
    public var accentColorHex: String?

    public init(
      status: String,
      etaMinutes: Double? = nil,
      courierName: String? = nil,
      mapSnapshotUrl: String? = nil,
      accentColorHex: String? = nil
    ) {
      self.status = status
      self.etaMinutes = etaMinutes
      self.courierName = courierName
      self.mapSnapshotUrl = mapSnapshotUrl
      self.accentColorHex = accentColorHex
    }
  }

  public var orderNumber: String
  public var deepLinkUrl: String?

  public init(orderNumber: String, deepLinkUrl: String? = nil) {
    self.orderNumber = orderNumber
    self.deepLinkUrl = deepLinkUrl
  }
}
