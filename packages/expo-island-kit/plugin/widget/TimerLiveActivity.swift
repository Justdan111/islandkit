import ActivityKit
import WidgetKit
import SwiftUI

private func pausedRemaining(until end: Date) -> String {
  let secs = max(0, Int(end.timeIntervalSinceNow.rounded()))
  let h = secs / 3600, m = (secs % 3600) / 60, s = secs % 60
  return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
}

// Live native countdown when running; a static remaining time when paused OR already
// elapsed (Text(timerInterval:) requires a valid future range — guard against past dates).
private struct Countdown: View {
  let state: TimerAttributes.ContentState
  let font: Font
  var body: some View {
    if state.isPaused || state.endDate <= Date.now {
      Text(pausedRemaining(until: state.endDate)).font(font).monospacedDigit()
    } else {
      Text(timerInterval: Date.now...state.endDate, countsDown: true).font(font).monospacedDigit()
    }
  }
}

private struct TimerLockScreenView: View {
  let context: ActivityViewContext<TimerAttributes>
  var body: some View {
    HStack(spacing: 12) {
      Image(systemName: "timer").font(.title2)
        .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      VStack(alignment: .leading, spacing: 2) {
        Text(context.state.label).font(.headline).lineLimit(1)
        Countdown(state: context.state, font: .title.weight(.semibold))
          .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      }
      Spacer()
      Image(systemName: context.state.isPaused ? "pause.fill" : "timer")
        .foregroundStyle(.secondary)
    }
    .padding()
  }
}

struct TimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TimerAttributes.self) { context in
      TimerLockScreenView(context: context)
        .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Label(context.state.label, systemImage: "timer")
            .font(.caption).foregroundStyle(presetAccentColor(context.state.accentColorHex))
        }
        DynamicIslandExpandedRegion(.bottom) {
          Countdown(state: context.state, font: .system(size: 44, weight: .semibold))
            .foregroundStyle(presetAccentColor(context.state.accentColorHex))
            .frame(maxWidth: .infinity)
        }
      } compactLeading: {
        Image(systemName: "timer")
          .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      } compactTrailing: {
        Countdown(state: context.state, font: .caption2)
          .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      } minimal: {
        Image(systemName: "timer")
          .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      }
      .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
      .keylineTint(presetAccentColor(context.state.accentColorHex))
    }
  }
}
