import { Platform } from 'react-native';

import ExpoIslandKitModule from './ExpoIslandKitModule';

/**
 * Whether the user currently allows Live Activities for this app right now.
 * Returns false on non-iOS platforms and on iOS versions below 16.1.
 */
export async function areLiveActivitiesEnabled(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }
  return ExpoIslandKitModule.areLiveActivitiesEnabled();
}
