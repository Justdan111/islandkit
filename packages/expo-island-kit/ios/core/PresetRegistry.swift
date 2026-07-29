import Foundation

// A preset handler erases its concrete ActivityAttributes type so all presets share
// one registry. ActivityKit calls happen inside iOS 16.2 availability guards.
protocol LiveActivityPresetHandler {
  var name: String { get }
  @available(iOS 16.2, *) func start(props: [String: Any], deepLinkUrl: String?) -> String
  @available(iOS 16.2, *) func update(id: String, props: [String: Any]) async
  @available(iOS 16.2, *) func end(id: String, dismissalPolicy: String?) async
}

// Adding a preset = add its handler to `all`.
enum PresetRegistry {
  private static let all: [LiveActivityPresetHandler] = [
    NowPlayingHandler(),
    GenericProgressHandler(),
  ]

  static func handler(_ preset: String) -> LiveActivityPresetHandler? {
    all.first { $0.name == preset }
  }
}
