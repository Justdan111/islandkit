import SwiftUI
import WidgetKit

@main
struct IslandKitWidgetBundle: WidgetBundle {
  var body: some Widget {
    NowPlayingLiveActivity()
    GenericProgressLiveActivity()
  }
}
