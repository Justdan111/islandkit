// Web/non-native stub: Live Activities are iOS-only, so everything no-ops.
export default {
  async areLiveActivitiesEnabled(): Promise<boolean> {
    return false;
  },
  isNowPlayingSupported(): boolean {
    return false;
  },
  startNowPlaying(_props: Record<string, unknown>, _deepLinkUrl: string | null): string {
    return '';
  },
  async updateNowPlaying(_activityId: string, _props: Record<string, unknown>): Promise<void> {},
  async endNowPlaying(_activityId: string, _dismissalPolicy: string | null): Promise<void> {},
};
