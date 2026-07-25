import { Platform } from 'react-native';

import ExpoIslandKitModule from './ExpoIslandKitModule';

export interface NowPlayingProps {
  title: string;
  artist: string;
  artworkUrl?: string;
  artworkAsset?: string;
  isPlaying: boolean;
  elapsedSeconds: number;
  durationSeconds: number;
  accentColor?: string;
}

export type DismissalPolicy = 'default' | 'immediate' | { after: Date };

export interface LiveActivityInstance<T> {
  readonly id: string;
  update(props: Partial<T>): Promise<void>;
  end(dismissalPolicy?: DismissalPolicy, finalProps?: Partial<T>): Promise<void>;
}

export interface LiveActivityFactory<T> {
  start(props: T, deepLinkUrl?: string): LiveActivityInstance<T>;
  getActiveInstances(): LiveActivityInstance<T>[];
  isSupported(): boolean;
}

function serializeDismissalPolicy(policy: DismissalPolicy): string {
  if (policy === 'default' || policy === 'immediate') {
    return policy;
  }
  return policy.after.toISOString();
}

const active = new Map<string, LiveActivityInstance<NowPlayingProps>>();

class NowPlayingInstance implements LiveActivityInstance<NowPlayingProps> {
  constructor(readonly id: string) {}

  async update(props: Partial<NowPlayingProps>): Promise<void> {
    if (Platform.OS !== 'ios') return;
    await ExpoIslandKitModule.updateNowPlaying(this.id, props as Record<string, unknown>);
  }

  async end(dismissalPolicy: DismissalPolicy = 'default', finalProps?: Partial<NowPlayingProps>): Promise<void> {
    active.delete(this.id);
    if (Platform.OS !== 'ios') return;
    if (finalProps) {
      await ExpoIslandKitModule.updateNowPlaying(this.id, finalProps as Record<string, unknown>);
    }
    await ExpoIslandKitModule.endNowPlaying(this.id, serializeDismissalPolicy(dismissalPolicy));
  }
}

export const NowPlayingActivity: LiveActivityFactory<NowPlayingProps> = {
  start(props: NowPlayingProps, deepLinkUrl?: string): LiveActivityInstance<NowPlayingProps> {
    const id = ExpoIslandKitModule.startNowPlaying(props as unknown as Record<string, unknown>, deepLinkUrl ?? null);
    const instance = new NowPlayingInstance(id);
    active.set(id, instance);
    return instance;
  },

  getActiveInstances(): LiveActivityInstance<NowPlayingProps>[] {
    return Array.from(active.values());
  },

  isSupported(): boolean {
    return Platform.OS === 'ios' && ExpoIslandKitModule.isNowPlayingSupported();
  },
};
