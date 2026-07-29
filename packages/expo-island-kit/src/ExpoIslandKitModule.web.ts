// Web/non-native stub: Live Activities are iOS-only, so everything no-ops.
export default {
  async areLiveActivitiesEnabled(): Promise<boolean> {
    return false;
  },
  isLiveActivitySupported(): boolean {
    return false;
  },
  startLiveActivity(
    _preset: string,
    _props: Record<string, unknown>,
    _deepLinkUrl: string | null
  ): string {
    return '';
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
