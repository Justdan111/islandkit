/**
 * Why a Live Activity did not start, when not starting is *not* a programming error.
 *
 * These are user- and OS-controlled conditions, so `start()` stays inert and reports
 * the reason on the returned instance rather than throwing — an app must not crash
 * because someone turned Live Activities off in Settings. Developer mistakes (an
 * unknown or excluded preset) throw {@link IslandKitError} instead.
 *
 * `'not-ios'` is produced by the JS layer; the other three come from the native module.
 */
export type IslandKitFailureReason =
  'not-ios' | 'unsupported-os' | 'activities-disabled' | 'system-refused';

/**
 * A misuse of IslandKit that can only be fixed in code — either the preset name is not
 * one IslandKit knows, or it is valid but was excluded from this build by the config
 * plugin's `presets` option (so no widget was generated to render it).
 *
 * `message` is the native module's message verbatim; it names the fix, not just the
 * symptom.
 */
export class IslandKitError extends Error {
  readonly code: 'unknown-preset' | 'preset-excluded';
  readonly preset: string;

  constructor(code: IslandKitError['code'], preset: string, message: string) {
    super(message);
    this.name = 'IslandKitError';
    this.code = code;
    this.preset = preset;
  }
}
