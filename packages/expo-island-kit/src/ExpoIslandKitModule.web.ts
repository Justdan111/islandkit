import { registerWebModule, NativeModule } from 'expo';

// ExpoIslandKitModule is not available on the web platform.
class ExpoIslandKitModule extends NativeModule<{}> {}

export default registerWebModule(ExpoIslandKitModule, 'ExpoIslandKitModule');
