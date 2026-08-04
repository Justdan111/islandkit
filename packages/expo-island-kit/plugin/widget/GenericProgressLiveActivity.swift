import ActivityKit
import WidgetKit
import SwiftUI

private struct GPIcon: View {
  let systemName: String?
  var body: some View { Image(systemName: systemName ?? "circle.dashed") }
}

private struct GenericProgressLockScreenView: View {
  let context: ActivityViewContext<GenericProgressAttributes>

  var body: some View {
    HStack(spacing: 12) {
      GPIcon(systemName: context.state.iconSystemName)
        .font(.title2)
        .foregroundStyle(presetAccentColor(context.state.accentColorHex))
        .frame(width: 40)
      VStack(alignment: .leading, spacing: 4) {
        Text(context.state.title).font(.headline).lineLimit(1)
        if let subtitle = context.state.subtitle {
          Text(subtitle).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
        }
        ProgressView(value: progressFraction(context.state.progress))
          .tint(presetAccentColor(context.state.accentColorHex))
      }
    }
    .padding()
  }
}

struct GenericProgressLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: GenericProgressAttributes.self) { context in
      GenericProgressLockScreenView(context: context)
        .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          GPIcon(systemName: context.state.iconSystemName)
            .font(.title3)
            .foregroundStyle(presetAccentColor(context.state.accentColorHex))
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 6) {
            Text(context.state.title).font(.headline).lineLimit(1)
            if let subtitle = context.state.subtitle {
              Text(subtitle).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
            }
            ProgressView(value: progressFraction(context.state.progress))
              .tint(presetAccentColor(context.state.accentColorHex))
          }
        }
      } compactLeading: {
        GPIcon(systemName: context.state.iconSystemName)
          .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      } compactTrailing: {
        Text("\(Int(progressFraction(context.state.progress) * 100))%")
          .font(.caption2)
          .foregroundStyle(.secondary)
      } minimal: {
        GPIcon(systemName: context.state.iconSystemName)
          .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      }
      .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
      .keylineTint(presetAccentColor(context.state.accentColorHex))
    }
  }
}
