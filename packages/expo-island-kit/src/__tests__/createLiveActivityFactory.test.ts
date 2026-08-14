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
  NowPlayingActivity.getActiveInstances().forEach((i) => i.end('immediate'));
  GenericProgressActivity.getActiveInstances().forEach((i) => i.end('immediate'));
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
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(1);
  await instance.end('immediate');
  expect(mockNative.endLiveActivity).toHaveBeenCalledWith('nowPlaying', 'activity-1', 'immediate');
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
