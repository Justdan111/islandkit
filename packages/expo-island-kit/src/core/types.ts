import type { IslandKitFailureReason } from './IslandKitError';

export type DismissalPolicy = 'default' | 'immediate' | { after: Date };

export interface LiveActivityInstance<T> {
  readonly id: string;
  /**
   * Why the activity did not start. Set only when `id === ''`; absent on a live
   * instance. An inert instance's `update`/`end` are safe no-ops.
   */
  readonly reason?: IslandKitFailureReason;
  update(props: Partial<T>): Promise<void>;
  end(dismissalPolicy?: DismissalPolicy, finalProps?: Partial<T>): Promise<void>;
}

export interface LiveActivityFactory<T> {
  start(props: T, deepLinkUrl?: string): LiveActivityInstance<T>;
  getActiveInstances(): LiveActivityInstance<T>[];
  isSupported(): boolean;
}
