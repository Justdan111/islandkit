import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoIslandKitModule extends NativeModule<Record<string, never>> {
  areLiveActivitiesEnabled(): Promise<boolean>;
  isNowPlayingSupported(): boolean;
  startNowPlaying(props: Record<string, unknown>, deepLinkUrl: string | null): string;
  updateNowPlaying(activityId: string, props: Record<string, unknown>): Promise<void>;
  endNowPlaying(activityId: string, dismissalPolicy: string | null): Promise<void>;
}

export default requireNativeModule<ExpoIslandKitModule>('ExpoIslandKit');
