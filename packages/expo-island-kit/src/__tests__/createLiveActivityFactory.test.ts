import { Platform } from 'react-native';

import ExpoIslandKitModule from '../ExpoIslandKitModule';
import { IslandKitError, type IslandKitFailureReason } from '../core/IslandKitError';
import { createLiveActivityFactory } from '../core/createLiveActivityFactory';
import { GenericProgressActivity } from '../presets/GenericProgress';
import { NowPlayingActivity } from '../presets/NowPlaying';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

jest.mock('../ExpoIslandKitModule', () => {
  const mockModule = {
    isLiveActivitySupported: jest.fn(() => true),
    startLiveActivity: jest.fn(
      (_preset: string, _props: Record<string, unknown>, _deepLink: string | null) => ({
        id: 'activity-1',
        reason: null,
      })
    ),
    getActiveActivityIds: jest.fn((_preset: string) => [] as string[]),
    getBundledAssetNames: jest.fn(() => null as string[] | null),
    updateLiveActivity: jest.fn(async () => {}),
    endLiveActivity: jest.fn(async () => {}),
    areLiveActivitiesEnabled: jest.fn(async () => true),
  };
  return { __esModule: true, default: mockModule };
});

const mockNative = ExpoIslandKitModule as unknown as {
  isLiveActivitySupported: jest.Mock;
  startLiveActivity: jest.Mock;
  getActiveActivityIds: jest.Mock;
  getBundledAssetNames: jest.Mock;
  updateLiveActivity: jest.Mock;
  endLiveActivity: jest.Mock;
  areLiveActivitiesEnabled: jest.Mock;
};

// The jest.mock factory above returns a plain mutable object, so `OS` can be
// reassigned per-test to exercise the non-iOS path.
const mutablePlatform = Platform as unknown as { OS: string };

const globals = globalThis as unknown as { __DEV__: boolean };

const npProps = {
  title: 'Song',
  artist: 'Artist',
  isPlaying: true,
  elapsedSeconds: 10,
  durationSeconds: 200,
};

let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mutablePlatform.OS = 'ios';
  globals.__DEV__ = true;
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockNative.isLiveActivitySupported.mockReturnValue(true);
  mockNative.startLiveActivity.mockReturnValue({ id: 'activity-1', reason: null });
  // Purge each factory's in-process map. getActiveInstances() is native-driven now, so
  // the shared fixture id has to be reported for the tracked entries to be reachable.
  mockNative.getActiveActivityIds.mockReturnValue(['activity-1']);
  NowPlayingActivity.getActiveInstances().forEach((i) => i.end('immediate'));
  GenericProgressActivity.getActiveInstances().forEach((i) => i.end('immediate'));
  mockNative.getActiveActivityIds.mockReturnValue([]);
  jest.clearAllMocks();
});

afterEach(() => {
  warnSpy.mockRestore();
});

test('start passes (preset, props, deepLink) and returns an instance carrying the native id', () => {
  const instance = NowPlayingActivity.start(npProps, 'myapp://now-playing');
  expect(mockNative.startLiveActivity).toHaveBeenCalledWith(
    'nowPlaying',
    npProps,
    'myapp://now-playing'
  );
  expect(instance.id).toBe('activity-1');
});

test('start with no deepLink passes null', () => {
  NowPlayingActivity.start(npProps);
  expect(mockNative.startLiveActivity).toHaveBeenCalledWith('nowPlaying', npProps, null);
});

test('update forwards (preset, id, partial props)', async () => {
  const instance = NowPlayingActivity.start(npProps);
  await instance.update({ isPlaying: false, elapsedSeconds: 42 });
  expect(mockNative.updateLiveActivity).toHaveBeenCalledWith('nowPlaying', 'activity-1', {
    isPlaying: false,
    elapsedSeconds: 42,
  });
});

test("end maps 'immediate' and removes the instance", async () => {
  const instance = NowPlayingActivity.start(npProps);
  mockNative.getActiveActivityIds.mockReturnValue(['activity-1']);
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(1);
  await instance.end('immediate');
  expect(mockNative.endLiveActivity).toHaveBeenCalledWith('nowPlaying', 'activity-1', 'immediate');
  // ActivityKit stops listing an ended activity; getActiveInstances follows it.
  mockNative.getActiveActivityIds.mockReturnValue([]);
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(0);
});

test("end defaults to 'default' when none given", async () => {
  const instance = NowPlayingActivity.start(npProps);
  await instance.end();
  expect(mockNative.endLiveActivity).toHaveBeenCalledWith('nowPlaying', 'activity-1', 'default');
});

test('end serializes { after: Date } to ISO', async () => {
  const instance = NowPlayingActivity.start(npProps);
  await instance.end({ after: new Date('2030-01-01T00:00:00.000Z') });
  expect(mockNative.endLiveActivity).toHaveBeenCalledWith(
    'nowPlaying',
    'activity-1',
    '2030-01-01T00:00:00.000Z'
  );
});

test('end applies finalProps via update before ending', async () => {
  const instance = NowPlayingActivity.start(npProps);
  await instance.end('default', { isPlaying: false });
  expect(mockNative.updateLiveActivity).toHaveBeenCalledWith('nowPlaying', 'activity-1', {
    isPlaying: false,
  });
  expect(mockNative.endLiveActivity).toHaveBeenCalled();
});

test('unsupported start (empty id) returns an inert handle that is not tracked', () => {
  mockNative.startLiveActivity.mockReturnValue({ id: '', reason: 'unsupported-os' });
  const instance = NowPlayingActivity.start(npProps);
  expect(instance.id).toBe('');
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(0);
});

test('isSupported reflects the native capability check', () => {
  mockNative.isLiveActivitySupported.mockReturnValue(false);
  expect(NowPlayingActivity.isSupported()).toBe(false);
  mockNative.isLiveActivitySupported.mockReturnValue(true);
  expect(NowPlayingActivity.isSupported()).toBe(true);
});

test('a second preset reuses the factory under its own name with separate tracking', () => {
  const gp = GenericProgressActivity.start({ title: 'Upload', progress: 0.3 }, 'myapp://x');
  expect(mockNative.startLiveActivity).toHaveBeenCalledWith(
    'genericProgress',
    { title: 'Upload', progress: 0.3 },
    'myapp://x'
  );
  expect(gp.id).toBe('activity-1');
  // Each factory asks ActivityKit about its own preset, so the ids never cross over.
  mockNative.getActiveActivityIds.mockImplementation((preset: string) =>
    preset === 'genericProgress' ? ['activity-1'] : []
  );
  expect(GenericProgressActivity.getActiveInstances()).toHaveLength(1);
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(0);
});

test('start and update serialize Date-valued props to ISO strings before the native call', async () => {
  const factory = createLiveActivityFactory<{ label: string; endDate: Date }>('testDate');
  const end = new Date('2030-01-01T00:00:00.000Z');
  const instance = factory.start({ label: 'x', endDate: end });
  expect(mockNative.startLiveActivity).toHaveBeenCalledWith(
    'testDate',
    { label: 'x', endDate: '2030-01-01T00:00:00.000Z' },
    null
  );
  await instance.update({ endDate: end });
  expect(mockNative.updateLiveActivity).toHaveBeenCalledWith('testDate', 'activity-1', {
    endDate: '2030-01-01T00:00:00.000Z',
  });
});

// --- failure reasons -------------------------------------------------------

test.each<IslandKitFailureReason>(['unsupported-os', 'activities-disabled', 'system-refused'])(
  'returns an inert instance carrying the native reason %s',
  (reason) => {
    mockNative.startLiveActivity.mockReturnValue({ id: '', reason });
    const instance = NowPlayingActivity.start(npProps);
    expect(instance.id).toBe('');
    expect(instance.reason).toBe(reason);
    expect(NowPlayingActivity.getActiveInstances()).toHaveLength(0);
  }
);

test('a started instance carries no reason', () => {
  const instance = NowPlayingActivity.start(npProps);
  expect(instance.id).toBe('activity-1');
  expect(instance.reason).toBeUndefined();
});

test('warns in __DEV__ when the activity did not start, naming the reason', () => {
  mockNative.startLiveActivity.mockReturnValue({ id: '', reason: 'activities-disabled' });
  NowPlayingActivity.start(npProps);
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(String(warnSpy.mock.calls[0][0])).toContain('activities-disabled');
});

test('suppresses the reason warning outside __DEV__', () => {
  globals.__DEV__ = false;
  mockNative.startLiveActivity.mockReturnValue({ id: '', reason: 'activities-disabled' });
  const instance = NowPlayingActivity.start(npProps);
  expect(instance.reason).toBe('activities-disabled');
  expect(warnSpy).not.toHaveBeenCalled();
});

test('surfaces the native detail on the system-refused warning', () => {
  mockNative.startLiveActivity.mockReturnValue({
    id: '',
    reason: 'system-refused',
    detail: 'target does not support this activity type',
  });
  NowPlayingActivity.start(npProps);
  expect(String(warnSpy.mock.calls[0][0])).toContain('target does not support this activity type');
});

// --- non-iOS ---------------------------------------------------------------

test('returns an inert not-ios instance without calling native off iOS', () => {
  mutablePlatform.OS = 'android';
  const instance = NowPlayingActivity.start(npProps);
  expect(instance.id).toBe('');
  expect(instance.reason).toBe('not-ios');
  expect(mockNative.startLiveActivity).not.toHaveBeenCalled();
});

// --- IslandKitError --------------------------------------------------------

test('rethrows an excluded-preset native error as IslandKitError with code preset-excluded', () => {
  const nativeMessage =
    'preset "delivery" is not included in this build. Included: nowPlaying, timer. ' +
    'Add it to the plugin\'s "presets" option and re-run: npx expo prebuild -p ios --clean';
  mockNative.startLiveActivity.mockImplementation(() => {
    throw new Error(nativeMessage);
  });
  expect(() => NowPlayingActivity.start(npProps)).toThrow(IslandKitError);
  try {
    NowPlayingActivity.start(npProps);
  } catch (error) {
    const err = error as IslandKitError;
    expect(err.code).toBe('preset-excluded');
    expect(err.preset).toBe('nowPlaying');
    expect(err.name).toBe('IslandKitError');
    // The native message carries the fix; it must survive the rewrap verbatim.
    expect(err.message).toBe(nativeMessage);
  }
  expect.assertions(5);
});

test('rethrows any other native start error as IslandKitError with code unknown-preset', () => {
  mockNative.startLiveActivity.mockImplementation(() => {
    throw new Error(
      'unknown preset "nope". Valid presets: nowPlaying, genericProgress, delivery, timer.'
    );
  });
  const factory = createLiveActivityFactory<{ title: string }>('nope');
  try {
    factory.start({ title: 'x' });
  } catch (error) {
    const err = error as IslandKitError;
    expect(err).toBeInstanceOf(IslandKitError);
    expect(err.code).toBe('unknown-preset');
    expect(err.preset).toBe('nope');
  }
  expect.assertions(3);
});

test('does not track an instance when the native call throws', () => {
  mockNative.startLiveActivity.mockImplementation(() => {
    throw new Error('unknown preset "nowPlaying".');
  });
  expect(() => NowPlayingActivity.start(npProps)).toThrow(IslandKitError);
  mockNative.startLiveActivity.mockReturnValue({ id: 'activity-1', reason: null });
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(0);
});

// --- prop validation -------------------------------------------------------

test.each([
  [1.7, 1],
  [-0.5, 0],
  [Number.NaN, 0],
])('clamps progress %p into 0..1 as %p', (input, expected) => {
  GenericProgressActivity.start({ title: 'Upload', progress: input });
  expect(mockNative.startLiveActivity.mock.calls[0][1].progress).toBe(expected);
  expect(warnSpy).toHaveBeenCalled();
});

test('leaves an in-range progress untouched and does not warn', () => {
  GenericProgressActivity.start({ title: 'Upload', progress: 0.42 });
  expect(mockNative.startLiveActivity.mock.calls[0][1].progress).toBe(0.42);
  expect(warnSpy).not.toHaveBeenCalled();
});

test('clamps progress on update too', async () => {
  const instance = GenericProgressActivity.start({ title: 'Upload', progress: 0.1 });
  await instance.update({ progress: 2 });
  expect(mockNative.updateLiveActivity).toHaveBeenCalledWith('genericProgress', 'activity-1', {
    progress: 1,
  });
});

test('warns but does not throw when a Date-valued endDate is in the past', () => {
  const factory = createLiveActivityFactory<{ label: string; endDate: Date }>('timer');
  const past = new Date(Date.now() - 60_000);
  expect(() => factory.start({ label: 'x', endDate: past })).not.toThrow();
  expect(warnSpy).toHaveBeenCalledTimes(1);
  expect(String(warnSpy.mock.calls[0][0])).toContain('endDate');
  expect(mockNative.startLiveActivity.mock.calls[0][1].endDate).toBe(past.toISOString());
});

test('does not warn for a future endDate', () => {
  const factory = createLiveActivityFactory<{ label: string; endDate: Date }>('timer');
  factory.start({ label: 'x', endDate: new Date(Date.now() + 60_000) });
  expect(warnSpy).not.toHaveBeenCalled();
});

test('does not inject defaults for absent optional props', () => {
  // PropCoercion's "absent key keeps the previous value" semantics on update depend
  // on absence staying distinguishable from an injected default — see the design spec.
  GenericProgressActivity.start({ title: 'Upload', progress: 0.5 });
  expect(mockNative.startLiveActivity.mock.calls[0][1]).toEqual({
    title: 'Upload',
    progress: 0.5,
  });
});

// --- getActiveInstances across processes ------------------------------------
//
// Two sources of truth: ActivityKit's own list (authoritative on existence) and the
// in-process map (contributes identity only). Every failure mode here is quiet, so
// each rule from the design spec's §6 gets its own test.

test('getActiveInstances queries native with this factory preset name', () => {
  mockNative.getActiveActivityIds.mockReturnValue([]);
  GenericProgressActivity.getActiveInstances();
  expect(mockNative.getActiveActivityIds).toHaveBeenCalledWith('genericProgress');
});

test('merges without duplicating an id present in both sources', () => {
  const started = NowPlayingActivity.start(npProps);
  mockNative.getActiveActivityIds.mockReturnValue(['activity-1']);
  const instances = NowPlayingActivity.getActiveInstances();
  expect(instances).toHaveLength(1);
  // The tracked instance is reused rather than shadowed by a fresh handle.
  expect(instances[0]).toBe(started);
});

test('materialises a native-only id as an instance that really ends that activity', async () => {
  // Nothing in the JS map: this is an activity started by a previous app process.
  mockNative.getActiveActivityIds.mockReturnValue(['prev-launch-1']);
  const instances = NowPlayingActivity.getActiveInstances();
  expect(instances).toHaveLength(1);
  expect(instances[0].id).toBe('prev-launch-1');
  expect(instances[0].reason).toBeUndefined();

  await instances[0].end('immediate');
  expect(mockNative.endLiveActivity).toHaveBeenCalledWith(
    'nowPlaying',
    'prev-launch-1',
    'immediate'
  );
});

test('a materialised native-only instance is also updatable', async () => {
  mockNative.getActiveActivityIds.mockReturnValue(['prev-launch-2']);
  const [instance] = NowPlayingActivity.getActiveInstances();
  await instance.update({ isPlaying: false });
  expect(mockNative.updateLiveActivity).toHaveBeenCalledWith('nowPlaying', 'prev-launch-2', {
    isPlaying: false,
  });
});

test('drops a JS-map id the native list no longer reports', () => {
  NowPlayingActivity.start(npProps);
  // The OS or the user dismissed it; a ghost here would silently no-op on end().
  mockNative.getActiveActivityIds.mockReturnValue([]);
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(0);
});

test('returns an empty array when native reports no activities', () => {
  mockNative.getActiveActivityIds.mockReturnValue([]);
  expect(NowPlayingActivity.getActiveInstances()).toEqual([]);
});

test('falls back to the in-process map when the native call throws', () => {
  const started = NowPlayingActivity.start(npProps);
  mockNative.getActiveActivityIds.mockImplementation(() => {
    throw new Error('native unavailable');
  });
  let instances: ReturnType<typeof NowPlayingActivity.getActiveInstances> = [];
  expect(() => {
    instances = NowPlayingActivity.getActiveInstances();
  }).not.toThrow();
  expect(instances).toHaveLength(1);
  expect(instances[0]).toBe(started);
});

test('returns an empty array off iOS without calling native', () => {
  NowPlayingActivity.start(npProps);
  mutablePlatform.OS = 'android';
  expect(NowPlayingActivity.getActiveInstances()).toEqual([]);
  expect(mockNative.getActiveActivityIds).not.toHaveBeenCalled();
});

describe('artworkAsset diagnostics', () => {
  beforeEach(() => {
    mockNative.getBundledAssetNames.mockReturnValue(null);
  });

  it('warns when artworkAsset names an image that was not bundled', () => {
    mockNative.getBundledAssetNames.mockReturnValue(['cover.png']);
    NowPlayingActivity.start({ ...npProps, artworkAsset: 'missing.png' });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('artworkAsset "missing.png" is not bundled')
    );
    // The message has to name the fix, not just the symptom.
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('cover.png'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('prebuild -p ios --clean'));
  });

  it('stays quiet when artworkAsset names a bundled image', () => {
    mockNative.getBundledAssetNames.mockReturnValue(['cover.png']);
    NowPlayingActivity.start({ ...npProps, artworkAsset: 'cover.png' });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('stays quiet when the bundled list is unavailable, rather than warning on a guess', () => {
    // null = prebuilt by a version that never published the list. Unknown, not empty.
    mockNative.getBundledAssetNames.mockReturnValue(null);
    NowPlayingActivity.start({ ...npProps, artworkAsset: 'anything.png' });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns that the bundled asset wins when both artworkAsset and artworkUrl are set', () => {
    mockNative.getBundledAssetNames.mockReturnValue(['cover.png']);
    NowPlayingActivity.start({
      ...npProps,
      artworkAsset: 'cover.png',
      artworkUrl: 'https://example.com/a.png',
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('both artworkAsset and artworkUrl are set')
    );
  });

  it('does not consult the bundled list when artworkAsset is absent', () => {
    NowPlayingActivity.start({ ...npProps, artworkUrl: 'https://example.com/a.png' });
    expect(mockNative.getBundledAssetNames).not.toHaveBeenCalled();
  });

  it('suppresses artworkAsset warnings outside __DEV__', () => {
    globals.__DEV__ = false;
    mockNative.getBundledAssetNames.mockReturnValue(['cover.png']);
    NowPlayingActivity.start({ ...npProps, artworkAsset: 'missing.png' });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('degrades quietly when the native lookup throws', () => {
    mockNative.getBundledAssetNames.mockImplementation(() => {
      throw new Error('no native module');
    });
    expect(() => NowPlayingActivity.start({ ...npProps, artworkAsset: 'x.png' })).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('is not bundled'));
  });
});
