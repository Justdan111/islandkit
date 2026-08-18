import type { StartLiveActivityResult } from './ExpoIslandKitModule';

// Web/non-native stub: Live Activities are iOS-only, so everything no-ops.
//
// The shapes here must track the native module's declaration, not merely satisfy the
// call sites. The factory guards on Platform.OS before reaching this on web, so a
// mismatch stays invisible until something bypasses that guard — a web Jest preset, or
// any consumer importing the module directly — at which point it fails as a type error
// or an undefined method rather than the safe no-op this file exists to provide.
export default {
  async areLiveActivitiesEnabled(): Promise<boolean> {
    return false;
  },
  isLiveActivitySupported(): boolean {
    return false;
  },
  // Mirrors the native contract: an empty id always carries a reason. 'not-ios' is the
  // same value the factory uses for this case, so callers see one consistent answer
  // whichever layer produced it.
  startLiveActivity(
    _preset: string,
    _props: Record<string, unknown>,
    _deepLinkUrl: string | null
  ): StartLiveActivityResult {
    return { id: '', reason: 'not-ios' };
  },
  getActiveActivityIds(_preset: string): string[] {
    return [];
  },
  async updateLiveActivity(
    _preset: string,
    _activityId: string,
    _props: Record<string, unknown>
  ): Promise<void> {},
  async endLiveActivity(
    _preset: string,
    _activityId: string,
    _dismissalPolicy: string | null
  ): Promise<void> {},
};
