import ExpoModulesCore

public class ExpoIslandKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoIslandKit")

    AsyncFunction("setValueAsync") { (value: String) in
    }
  }
}
