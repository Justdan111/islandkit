import { Platform } from 'react-native';

import ExpoIslandKitModule, { type StartLiveActivityResult } from '../ExpoIslandKitModule';
import { IslandKitError, type IslandKitFailureReason } from './IslandKitError';
import type { DismissalPolicy, LiveActivityFactory, LiveActivityInstance } from './types';

const REASON_HINTS: Record<IslandKitFailureReason, string> = {
  'not-ios': 'Live Activities are iOS-only, so this call was a no-op.',
  'unsupported-os': 'Live Activities require iOS 16.2 or later.',
  'activities-disabled':
    'The user has Live Activities turned off in Settings ▸ <your app> ▸ Live Activities.',
  'system-refused': 'ActivityKit refused the request.',
};

function isDev(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

// Developer-facing diagnostics are __DEV__-only: visible in Metro, absent in production.
function warnDev(message: string): void {
  if (isDev()) {
    console.warn(`[IslandKit] ${message}`);
  }
}

function serializeDismissalPolicy(policy: DismissalPolicy): string {
  if (policy === 'default' || policy === 'immediate') {
    return policy;
  }
  return policy.after.toISOString();
}

// Out-of-range progress renders a broken bar rather than failing loudly, so clamp it
// here — in TS, where it applies to every preset uniformly and is unit-testable.
function clampProgress(preset: string, value: number): number {
  if (value >= 0 && value <= 1) {
    return value;
  }
  const clamped = Number.isNaN(value) ? 0 : Math.max(0, Math.min(1, value));
  warnDev(`${preset}: progress ${value} is outside 0–1 and was clamped to ${clamped}.`);
  return clamped;
}

// Deliberately a warning, not a throw: a timer can legitimately expire between computing
// endDate and this call landing, and crashing over a valid runtime state would be worse
// than the degradation it causes (a static, already-expired countdown).
function warnOnPastEndDate(preset: string, key: string, value: Date): void {
  if (key === 'endDate' && value.getTime() < Date.now()) {
    warnDev(
      `${preset}: endDate ${value.toISOString()} is in the past. ` +
        'The countdown will render as an already-expired static value.'
    );
  }
}

// null means the app was prebuilt before the list was published — unknown, not empty —
// so callers stay quiet rather than warn about a name they cannot actually check.
// Deliberately uncached: this is only reached when a consumer passes artworkAsset, so
// the call is rare, and caching would make the value order-dependent across a process.
function bundledAssetNames(): string[] | null {
  try {
    return ExpoIslandKitModule.getBundledAssetNames();
  } catch {
    return null;
  }
}

// A name that was never bundled resolves to nothing in the widget, which renders the URL
// or the placeholder instead — indistinguishable from passing no artwork at all. Say so
// here, where the developer can actually see it.
function warnOnArtworkAsset(preset: string, props: Record<string, unknown>): void {
  const asset = props.artworkAsset;
  if (typeof asset !== 'string' || asset === '') return;

  const available = bundledAssetNames();
  if (available && !available.includes(asset)) {
    warnDev(
      `${preset}: artworkAsset "${asset}" is not bundled, so no image will render. ` +
        `Bundled assets: ${available.length ? available.join(', ') : '(none)'}. ` +
        'Add it to the plugin\'s "assets" option and re-run: npx expo prebuild -p ios --clean'
    );
  }

  if (typeof props.artworkUrl === 'string' && props.artworkUrl !== '') {
    warnDev(
      `${preset}: both artworkAsset and artworkUrl are set. The bundled asset wins — ` +
        'it loads synchronously and cannot fail on the network.'
    );
  }
}

// Dates don't marshal across the Expo bridge cleanly; convert any Date-valued prop
// to an ISO-8601 string. The Swift decoder parses it back via PropCoercion.
//
// Only value-shaped hazards are validated here. Absent optional props are left absent
// on purpose: PropCoercion treats a missing key as "keep the previous value", so
// injecting defaults would silently break partial updates.
function serializeProps(preset: string, props: Record<string, unknown>): Record<string, unknown> {
  warnOnArtworkAsset(preset, props);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    const value = props[key];
    if (key === 'progress' && typeof value === 'number') {
      out[key] = clampProgress(preset, value);
    } else if (value instanceof Date) {
      warnOnPastEndDate(preset, key, value);
      out[key] = value.toISOString();
    } else {
      out[key] = value;
    }
  }
  return out;
}

// The native module throws only for developer mistakes. Exclusion is the case worth
// distinguishing, because its fix is a prebuild rather than a code change; anything
// else reaching here is an unknown preset name.
function toIslandKitError(preset: string, error: unknown): IslandKitError {
  const message = error instanceof Error ? error.message : String(error);
  const code = message.includes('not included') ? 'preset-excluded' : 'unknown-preset';
  return new IslandKitError(code, preset, message);
}

export function createLiveActivityFactory<T extends object>(
  preset: string
): LiveActivityFactory<T> {
  const active = new Map<string, LiveActivityInstance<T>>();

  class Instance implements LiveActivityInstance<T> {
    constructor(
      readonly id: string,
      readonly reason?: IslandKitFailureReason
    ) {}

    async update(props: Partial<T>): Promise<void> {
      if (Platform.OS !== 'ios') return;
      await ExpoIslandKitModule.updateLiveActivity(
        preset,
        this.id,
        serializeProps(preset, props as Record<string, unknown>)
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
          serializeProps(preset, finalProps as Record<string, unknown>)
        );
      }
      await ExpoIslandKitModule.endLiveActivity(
        preset,
        this.id,
        serializeDismissalPolicy(dismissalPolicy)
      );
    }
  }

  // An inert handle: every method still no-ops safely, and `reason` says why.
  function inert(reason: IslandKitFailureReason, detail?: string | null): Instance {
    warnDev(
      `${preset}: the Live Activity did not start (${reason}). ${REASON_HINTS[reason]}` +
        (detail ? ` ${detail}` : '')
    );
    return new Instance('', reason);
  }

  return {
    start(props: T, deepLinkUrl?: string): LiveActivityInstance<T> {
      // Guard before touching native: update()/end() already do, and start() calling
      // straight through on Android was a real crash path.
      if (Platform.OS !== 'ios') {
        return inert('not-ios');
      }

      let result: StartLiveActivityResult;
      try {
        result = ExpoIslandKitModule.startLiveActivity(
          preset,
          serializeProps(preset, props as unknown as Record<string, unknown>),
          deepLinkUrl ?? null
        );
      } catch (error) {
        throw toIslandKitError(preset, error);
      }

      const id = result?.id ?? '';
      if (!id) {
        // Reason should always be present alongside an empty id; if a future native
        // path forgets one, "system-refused" is the honest fallback.
        return inert(
          (result?.reason as IslandKitFailureReason) ?? 'system-refused',
          result?.detail
        );
      }

      const instance = new Instance(id);
      active.set(id, instance);
      return instance;
    },

    getActiveInstances(): LiveActivityInstance<T>[] {
      if (Platform.OS !== 'ios') return [];

      // Two sources of truth. ActivityKit's list is authoritative on existence — it
      // outlives this process and reflects OS/user dismissals; the in-process map
      // contributes nothing beyond identity for the activities we started ourselves.
      let nativeIds: string[];
      try {
        nativeIds = ExpoIslandKitModule.getActiveActivityIds(preset);
      } catch (error) {
        // Losing the cross-process view is not worth breaking the caller over.
        warnDev(`${preset}: could not read active activities from ActivityKit. ${String(error)}`);
        return Array.from(active.values());
      }

      // Mapping over the native ids settles all four rules at once: stale map entries
      // are dropped, an id in both sources yields the single tracked instance, and an
      // id only ActivityKit knows (a previous launch) is materialised as a real,
      // updatable and endable handle.
      return nativeIds.map((id) => active.get(id) ?? new Instance(id));
    },

    isSupported(): boolean {
      return Platform.OS === 'ios' && ExpoIslandKitModule.isLiveActivitySupported();
    },
  };
}
