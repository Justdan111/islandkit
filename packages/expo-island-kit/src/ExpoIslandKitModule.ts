import { NativeModule, requireNativeModule } from 'expo';

/**
 * What the native `startLiveActivity` returns. `id` is empty exactly when the activity
 * did not start, in which case `reason` says why; `detail` carries ActivityKit's own
 * error text on the `system-refused` path.
 */
export interface StartLiveActivityResult {
  id: string;
  reason?: string | null;
  detail?: string | null;
}

declare class ExpoIslandKitModule extends NativeModule<Record<string, never>> {
  areLiveActivitiesEnabled(): Promise<boolean>;
  isLiveActivitySupported(): boolean;
  /** Throws for developer error (unknown or excluded preset). */
  startLiveActivity(
    preset: string,
    props: Record<string, unknown>,
    deepLinkUrl: string | null
  ): StartLiveActivityResult;
  /**
   * Images the plugin's `assets` option bundled into the widget extension, or null when
   * the app was prebuilt by a version that did not publish the list.
   */
  getBundledAssetNames(): string[] | null;
  /** ActivityKit's own ids, which unlike the JS map survive app termination. */
  getActiveActivityIds(preset: string): string[];
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
