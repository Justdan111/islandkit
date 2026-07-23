// Web/non-native stub: Live Activities are iOS-only, so this always resolves false.
export default {
  async areLiveActivitiesEnabled(): Promise<boolean> {
    return false;
  },
};
