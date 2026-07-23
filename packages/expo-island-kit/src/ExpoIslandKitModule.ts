import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoIslandKitModule extends NativeModule<Record<string, never>> {
  areLiveActivitiesEnabled(): Promise<boolean>;
}

export default requireNativeModule<ExpoIslandKitModule>('ExpoIslandKit');
