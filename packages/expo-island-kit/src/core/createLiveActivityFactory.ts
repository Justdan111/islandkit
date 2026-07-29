import { Platform } from 'react-native';

import ExpoIslandKitModule from '../ExpoIslandKitModule';
import type { DismissalPolicy, LiveActivityFactory, LiveActivityInstance } from './types';

function serializeDismissalPolicy(policy: DismissalPolicy): string {
  if (policy === 'default' || policy === 'immediate') {
    return policy;
  }
  return policy.after.toISOString();
}

// Dates don't marshal across the Expo bridge cleanly; convert any Date-valued prop
// to an ISO-8601 string. The Swift decoder parses it back via PropCoercion.date.
function serializeProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    const value = props[key];
    out[key] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

export function createLiveActivityFactory<T extends object>(
  preset: string
): LiveActivityFactory<T> {
  const active = new Map<string, LiveActivityInstance<T>>();

  class Instance implements LiveActivityInstance<T> {
    constructor(readonly id: string) {}

    async update(props: Partial<T>): Promise<void> {
      if (Platform.OS !== 'ios') return;
      await ExpoIslandKitModule.updateLiveActivity(
        preset,
        this.id,
        serializeProps(props as Record<string, unknown>)
      );
    }

    async end(
      dismissalPolicy: DismissalPolicy = 'default',
      finalProps?: Partial<T>
    ): Promise<void> {
      active.delete(this.id);
      if (Platform.OS !== 'ios') return;
      if (finalProps) {
        await ExpoIslandKitModule.updateLiveActivity(
          preset,
          this.id,
          serializeProps(finalProps as Record<string, unknown>)
        );
      }
      await ExpoIslandKitModule.endLiveActivity(
        preset,
        this.id,
        serializeDismissalPolicy(dismissalPolicy)
      );
    }
  }

  return {
    start(props: T, deepLinkUrl?: string): LiveActivityInstance<T> {
      const id = ExpoIslandKitModule.startLiveActivity(
        preset,
        serializeProps(props as unknown as Record<string, unknown>),
        deepLinkUrl ?? null
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
