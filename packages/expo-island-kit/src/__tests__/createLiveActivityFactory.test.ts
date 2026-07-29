jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

jest.mock('../ExpoIslandKitModule', () => {
  const mockModule = {
    isLiveActivitySupported: jest.fn(() => true),
    startLiveActivity: jest.fn(
      (_preset: string, _props: Record<string, unknown>, _deepLink: string | null) => 'activity-1',
    ),
    updateLiveActivity: jest.fn(async () => {}),
    endLiveActivity: jest.fn(async () => {}),
    areLiveActivitiesEnabled: jest.fn(async () => true),
  };
  return { __esModule: true, default: mockModule };
});

import ExpoIslandKitModule from '../ExpoIslandKitModule';
import { GenericProgressActivity } from '../presets/GenericProgress';
import { NowPlayingActivity } from '../presets/NowPlaying';

const mockNative = ExpoIslandKitModule as unknown as {
  isLiveActivitySupported: jest.Mock;
  startLiveActivity: jest.Mock;
  updateLiveActivity: jest.Mock;
  endLiveActivity: jest.Mock;
  areLiveActivitiesEnabled: jest.Mock;
};

const npProps = { title: 'Song', artist: 'Artist', isPlaying: true, elapsedSeconds: 10, durationSeconds: 200 };

beforeEach(() => {
  jest.clearAllMocks();
  mockNative.isLiveActivitySupported.mockReturnValue(true);
  mockNative.startLiveActivity.mockReturnValue('activity-1');
  NowPlayingActivity.getActiveInstances().forEach((i) => i.end('immediate'));
  GenericProgressActivity.getActiveInstances().forEach((i) => i.end('immediate'));
  jest.clearAllMocks();
});

test('start passes (preset, props, deepLink) and returns an instance carrying the native id', () => {
  const instance = NowPlayingActivity.start(npProps, 'myapp://now-playing');
  expect(mockNative.startLiveActivity).toHaveBeenCalledWith('nowPlaying', npProps, 'myapp://now-playing');
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
  expect(mockNative.endLiveActivity).toHaveBeenCalledWith('nowPlaying', 'activity-1', '2030-01-01T00:00:00.000Z');
});

test('end applies finalProps via update before ending', async () => {
  const instance = NowPlayingActivity.start(npProps);
  await instance.end('default', { isPlaying: false });
  expect(mockNative.updateLiveActivity).toHaveBeenCalledWith('nowPlaying', 'activity-1', { isPlaying: false });
  expect(mockNative.endLiveActivity).toHaveBeenCalled();
});

test('unsupported start (empty id) returns an inert handle that is not tracked', () => {
  mockNative.startLiveActivity.mockReturnValue('');
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
  expect(mockNative.startLiveActivity).toHaveBeenCalledWith('genericProgress', { title: 'Upload', progress: 0.3 }, 'myapp://x');
  expect(gp.id).toBe('activity-1');
  expect(GenericProgressActivity.getActiveInstances()).toHaveLength(1);
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(0);
});
