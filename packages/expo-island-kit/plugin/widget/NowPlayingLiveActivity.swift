import ActivityKit
import WidgetKit
import SwiftUI
import UIKit

// Square artwork, in precedence order: a bundled asset, then a remote URL, then an SF
// Symbol placeholder.
//
// `artworkAsset` wins over `artworkUrl` deliberately. A bundled image is already inside
// this extension's bundle, so it loads synchronously and cannot fail on a slow or dead
// network -- in a memory- and time-constrained widget process that is the more reliable
// input, so when a consumer supplies both, the reliable one is used.
private struct Artwork: View {
  let state: NowPlayingAttributes.ContentState

  var body: some View {
    if let name = state.artworkAsset, let image = Self.bundledImage(name) {
      Image(uiImage: image).resizable().aspectRatio(contentMode: .fill)
    } else if let urlString = state.artworkUrl, let url = URL(string: urlString) {
      AsyncImage(url: url) { image in
        image.resizable().aspectRatio(contentMode: .fill)
      } placeholder: {
        placeholder
      }
    } else {
      placeholder
    }
  }

  // Loads an image the config plugin's `assets` option copied into this extension's
  // bundle. UIImage(named:) covers an asset-catalog entry; the explicit bundle path
  // covers the loose file the plugin actually copies. A name that matches neither falls
  // through to nil, so the view degrades to the URL or the placeholder rather than
  // rendering blank -- the developer is warned from the JS side, where it is visible.
  private static func bundledImage(_ name: String) -> UIImage? {
    if let image = UIImage(named: name) { return image }
    let ns = name as NSString
    let ext = ns.pathExtension.isEmpty ? "png" : ns.pathExtension
    guard let path = Bundle.main.path(forResource: ns.deletingPathExtension, ofType: ext) else {
      return nil
    }
    return UIImage(contentsOfFile: path)
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
