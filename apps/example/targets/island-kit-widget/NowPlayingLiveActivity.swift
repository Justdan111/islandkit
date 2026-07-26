import ActivityKit
import WidgetKit
import SwiftUI

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
        ProgressView(value: progressFraction(elapsed: context.state.elapsedSeconds, duration: context.state.durationSeconds))
          .tint(presetAccentColor(context.state.accentColorHex))
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
        .foregroundStyle(presetAccentColor(context.state.accentColorHex))
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
            ProgressView(value: progressFraction(elapsed: context.state.elapsedSeconds, duration: context.state.durationSeconds))
              .tint(presetAccentColor(context.state.accentColorHex))
          }
        }
      } compactLeading: {
        Artwork(state: context.state)
          .frame(width: 20, height: 20)
          .clipShape(RoundedRectangle(cornerRadius: 4))
      } compactTrailing: {
        Image(systemName: context.state.isPlaying ? "pause.fill" : "play.fill")
          .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      } minimal: {
        Image(systemName: context.state.isPlaying ? "pause.fill" : "play.fill")
          .foregroundStyle(presetAccentColor(context.state.accentColorHex))
      }
      .widgetURL(context.attributes.deepLinkUrl.flatMap(URL.init(string:)))
      .keylineTint(presetAccentColor(context.state.accentColorHex))
    }
  }
}
