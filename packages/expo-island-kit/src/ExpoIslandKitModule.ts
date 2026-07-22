import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoIslandKitModule extends NativeModule<{}> {
  setValueAsync(value: string): Promise<void>;
}

export default requireNativeModule<ExpoIslandKitModule>('ExpoIslandKit');
