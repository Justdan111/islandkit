import Foundation

// A preset handler erases its concrete ActivityAttributes type so all presets share
// one registry. ActivityKit calls happen inside iOS 16.2 availability guards.
protocol LiveActivityPresetHandler {
  var name: String { get }
  // Returns { "id": String, "reason": String? } — "" plus a reason when the environment
  // refused. Developer errors (unknown/excluded preset) throw in the module instead.
  @available(iOS 16.2, *) func start(props: [String: Any], deepLinkUrl: String?) -> [String: Any]
  @available(iOS 16.2, *) func update(id: String, props: [String: Any]) async
  @available(iOS 16.2, *) func end(id: String, dismissalPolicy: String?) async
  // ActivityKit's own list, which survives app restarts — unlike any in-process map.
  @available(iOS 16.2, *) func activeIds() -> [String]
}

// Adding a preset = add its handler to `all`.
enum PresetRegistry {
  private static let all: [LiveActivityPresetHandler] = [
    NowPlayingHandler(),
    GenericProgressHandler(),
    DeliveryHandler(),
    TimerHandler(),
  ]

  static func handler(_ preset: String) -> LiveActivityPresetHandler? {
    all.first { $0.name == preset }
  }

  // Used in the unknown-preset exception message so it can never drift from `all`.
  static var names: [String] {
    all.map { $0.name }
  }
}
