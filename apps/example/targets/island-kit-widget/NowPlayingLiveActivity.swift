import ActivityKit
import WidgetKit
import SwiftUI

// Accent color from state, falling back to the system accent.
private func accent(_ state: NowPlayingAttributes.ContentState) -> Color {
  Color(hex: state.accentColorHex) ?? .accentColor
}

private func progress(_ state: NowPlayingAttributes.ContentState) -> Double {
  guard state.durationSeconds > 0 else { return 0 }
  return min(max(state.elapsedSeconds / state.durationSeconds, 0), 1)
}

private func timeString(_ seconds: Double) -> String {
  let total = Int(seconds.rounded())
  return String(format: "%d:%02d", total / 60, total % 60)
}

// Square artwork: remote image when a URL is present, else an SF Symbol placeholder.
private struct Artwork: View {
  let state: NowPlayingAttributes.ContentState

  var body: some View {
    if let urlString = state.artworkUrl, let url = URL(string: urlString) {
      AsyncImage(url: url) { image in
        image.resizable().aspectRatio(contentMode: .fill)
      } placeholder: {
        placeholder
      }
    } else {
      placeholder
    }
  }

  private var placeholder: some View {
    ZStack {
      Rectangle().fill(.quaternary)
      Image(systemName: "music.note").foregroundStyle(.secondary)
    }
  }
}

private struct NowPlayingLockScreenView: View {
  let context: ActivityViewContext<NowPlayingAttributes>

  var body: some View {
    HStack(spacing: 12) {
      Artwork(state: context.state)
        .frame(width: 56, height: 56)
        .clipShape(RoundedRectangle(cornerRadius: 8))
      VStack(alignment: .leading, spacing: 4) {
        Text(context.state.title).font(.headline).lineLimit(1)
        Text(context.state.artist).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
        ProgressView(value: progress(context.state)).tint(accent(context.state))
        HStack {
          Text(timeString(context.state.elapsedSeconds))
          Spacer()
          Text(timeString(context.state.durationSeconds))
        }
        .font(.caption2)
        .foregroundStyle(.secondary)
      }
      Image(systemName: context.state.isPlaying ? "pause.fill" : "play.fill")
        .font(.title2)
        .foregroundStyle(accent(context.state))
    }
    .padding()
  }
}

struct NowPlayingLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: NowPlayingAttributes.self) { context in
      NowPlayingLockScreenView(context: context)
        .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Artwork(state: context.state)
            .frame(width: 44, height: 44)
            .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(timeString(context.state.durationSeconds))
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 6) {
            Text(context.state.title).font(.headline).lineLimit(1)
            Text(context.state.artist).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
            ProgressView(value: progress(context.state)).tint(accent(context.state))
          }
        }
      } compactLeading: {
        Artwork(state: context.state)
          .frame(width: 20, height: 20)
          .clipShape(RoundedRectangle(cornerRadius: 4))
      } compactTrailing: {
        Image(systemName: context.state.isPlaying ? "pause.fill" : "play.fill")
          .foregroundStyle(accent(context.state))
      } minimal: {
        Image(systemName: context.state.isPlaying ? "pause.fill" : "play.fill")
          .foregroundStyle(accent(context.state))
      }
      .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
      .keylineTint(accent(context.state))
    }
  }
}
