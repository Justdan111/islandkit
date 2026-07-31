import ActivityKit
import WidgetKit
import SwiftUI

private func deliveryIcon(_ status: String) -> String {
  switch status {
  case "confirmed": return "checkmark.circle.fill"
  case "preparing": return "shippingbox.fill"
  case "onTheWay": return "bicycle"
  case "delivered": return "house.fill"
  default: return "shippingbox"
  }
}

private func deliveryLabel(_ status: String) -> String {
  switch status {
  case "confirmed": return "Confirmed"
  case "preparing": return "Preparing"
  case "onTheWay": return "On the way"
  case "delivered": return "Delivered"
  default: return status
  }
}

private func etaText(_ minutes: Double?) -> String? {
  guard let minutes, minutes > 0 else { return nil }
  return "\(Int(minutes.rounded())) min"
}

// Bounded, failure-tolerant map image — widget extensions have tight memory limits,
// so the frame is capped and load failure/empty degrades to a placeholder (never a crash).
private struct MapSnapshot: View {
  let urlString: String?
  var body: some View {
    if let s = urlString, let url = URL(string: s) {
      AsyncImage(url: url) { phase in
        switch phase {
        case .success(let image): image.resizable().aspectRatio(contentMode: .fill)
        case .empty, .failure: placeholder
        @unknown default: placeholder
        }
      }
      .frame(maxWidth: .infinity)
      .frame(height: 72)
      .clipped()
      .clipShape(RoundedRectangle(cornerRadius: 8))
    }
  }
  private var placeholder: some View {
    ZStack { Rectangle().fill(.quaternary); Image(systemName: "map").foregroundStyle(.secondary) }
  }
}

private struct DeliveryLockScreenView: View {
  let context: ActivityViewContext<DeliveryAttributes>
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 12) {
        Image(systemName: deliveryIcon(context.state.status))
          .font(.title2).foregroundStyle(presetAccentColor(context.state.accentColorHex))
        VStack(alignment: .leading, spacing: 2) {
          Text(deliveryLabel(context.state.status)).font(.headline)
          Text("Order \(context.attributes.orderNumber)").font(.caption).foregroundStyle(.secondary)
        }
        Spacer()
        if let eta = etaText(context.state.etaMinutes) {
          Text(eta).font(.headline).foregroundStyle(presetAccentColor(context.state.accentColorHex))
        }
      }
      if let courier = context.state.courierName {
        Text("Courier: \(courier)").font(.subheadline).foregroundStyle(.secondary)
      }
      MapSnapshot(urlString: context.state.mapSnapshotUrl)
    }
    .padding()
  }
}

struct DeliveryLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: DeliveryAttributes.self) { context in
      DeliveryLockScreenView(context: context)
        .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Label(deliveryLabel(context.state.status), systemImage: deliveryIcon(context.state.status))
            .font(.caption).foregroundStyle(presetAccentColor(context.state.accentColorHex))
        }
        DynamicIslandExpandedRegion(.trailing) {
          if let eta = etaText(context.state.etaMinutes) {
            Text(eta).font(.caption).foregroundStyle(.secondary)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 6) {
            HStack {
              if let courier = context.state.courierName {
                Text(courier).font(.subheadline)
              }
              Spacer()
              Text("Order \(context.attributes.orderNumber)").font(.caption).foregroundStyle(.secondary)
            }
            MapSnapshot(urlString: context.state.mapSnapshotUrl)
          }
        }
      } compactLeading: {
        Image(systemName: deliveryIcon(context.state.status))
          .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      } compactTrailing: {
        if let eta = etaText(context.state.etaMinutes) {
          Text(eta).font(.caption2).foregroundStyle(.secondary)
        }
      } minimal: {
        Image(systemName: deliveryIcon(context.state.status))
          .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      }
      .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
      .keylineTint(presetAccentColor(context.state.accentColorHex))
    }
  }
}
