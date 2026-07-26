import { Platform } from 'react-native';

import ExpoIslandKitModule from '../ExpoIslandKitModule';
import type { DismissalPolicy, LiveActivityFactory, LiveActivityInstance } from './types';

function serializeDismissalPolicy(policy: DismissalPolicy): string {
  if (policy === 'default' || policy === 'immediate') {
    return policy;
  }
  return policy.after.toISOString();
}

export function createLiveActivityFactory<T extends object>(preset: string): LiveActivityFactory<T> {
  const active = new Map<string, LiveActivityInstance<T>>();

  class Instance implements LiveActivityInstance<T> {
    constructor(readonly id: string) {}

    async update(props: Partial<T>): Promise<void> {
      if (Platform.OS !== 'ios') return;
      await ExpoIslandKitModule.updateLiveActivity(preset, this.id, props as Record<string, unknown>);
    }

    async end(dismissalPolicy: DismissalPolicy = 'default', finalProps?: Partial<T>): Promise<void> {
      active.delete(this.id);
      if (Platform.OS !== 'ios') return;
      if (finalProps) {
        await ExpoIslandKitModule.updateLiveActivity(preset, this.id, finalProps as Record<string, unknown>);
      }
      await ExpoIslandKitModule.endLiveActivity(preset, this.id, serializeDismissalPolicy(dismissalPolicy));
    }
  }

  return {
    start(props: T, deepLinkUrl?: string): LiveActivityInstance<T> {
      const id = ExpoIslandKitModule.startLiveActivity(
        preset,
        props as unknown as Record<string, unknown>,
        deepLinkUrl ?? null,
      );
      const instance = new Instance(id);
      // Don't track a "" id (unsupported/disabled/failed) — the inert handle
      // still no-ops safely, but getActiveInstances() must not leak a ghost.
      if (id) {
        active.set(id, instance);
      }
      return instance;
    },

    getActiveInstances(): LiveActivityInstance<T>[] {
      return Array.from(active.values());
    },

    isSupported(): boolean {
      return Platform.OS === 'ios' && ExpoIslandKitModule.isLiveActivitySupported();
    },
  };
}
