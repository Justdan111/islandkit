import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoIslandKitModule extends NativeModule<Record<string, never>> {
  areLiveActivitiesEnabled(): Promise<boolean>;
  isLiveActivitySupported(): boolean;
  startLiveActivity(
    preset: string,
    props: Record<string, unknown>,
    deepLinkUrl: string | null
  ): string;
  updateLiveActivity(
    preset: string,
    activityId: string,
    props: Record<string, unknown>
  ): Promise<void>;
  endLiveActivity(
    preset: string,
    activityId: string,
    dismissalPolicy: string | null
  ): Promise<void>;
}

export default requireNativeModule<ExpoIslandKitModule>('ExpoIslandKit');
