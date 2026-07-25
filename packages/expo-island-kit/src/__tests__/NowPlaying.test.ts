jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

jest.mock('../ExpoIslandKitModule', () => {
  const mockModule = {
    isNowPlayingSupported: jest.fn(() => true),
    startNowPlaying: jest.fn((_props: Record<string, unknown>, _deepLink: string | null) => 'activity-1'),
    updateNowPlaying: jest.fn(async () => {}),
    endNowPlaying: jest.fn(async () => {}),
    areLiveActivitiesEnabled: jest.fn(async () => true),
  };
  return { __esModule: true, default: mockModule };
});

import { NowPlayingActivity, NowPlayingProps } from '../NowPlaying';
import ExpoIslandKitModule from '../ExpoIslandKitModule';

const mockNative = ExpoIslandKitModule;

const baseProps: NowPlayingProps = {
  title: 'Song',
  artist: 'Artist',
  isPlaying: true,
  elapsedSeconds: 10,
  durationSeconds: 200,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNative.isNowPlayingSupported.mockReturnValue(true);
  mockNative.startNowPlaying.mockReturnValue('activity-1');
  // End any leftover instances from a previous test.
  NowPlayingActivity.getActiveInstances().forEach((i) => i.end('immediate'));
  jest.clearAllMocks();
});

test('start passes props + deepLink to native and returns an instance carrying the native id', () => {
  const instance = NowPlayingActivity.start(baseProps, 'myapp://now-playing');
  expect(mockNative.startNowPlaying).toHaveBeenCalledWith(baseProps, 'myapp://now-playing');
  expect(instance.id).toBe('activity-1');
});

test('start with no deepLink passes null', () => {
  NowPlayingActivity.start(baseProps);
  expect(mockNative.startNowPlaying).toHaveBeenCalledWith(baseProps, null);
});

test('start returns an inert handle but does NOT track it when native reports unsupported (empty id)', () => {
  mockNative.startNowPlaying.mockReturnValue('');
  const instance = NowPlayingActivity.start(baseProps);
  expect(instance.id).toBe('');
  // A ghost empty-id handle must never leak into getActiveInstances().
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(0);
});

test('a second unsupported start does not collapse onto a shared empty-id key', () => {
  mockNative.startNowPlaying.mockReturnValue('');
  NowPlayingActivity.start(baseProps);
  NowPlayingActivity.start(baseProps);
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(0);
});

test('update forwards the partial props under the instance id', async () => {
  const instance = NowPlayingActivity.start(baseProps);
  await instance.update({ isPlaying: false, elapsedSeconds: 42 });
  expect(mockNative.updateNowPlaying).toHaveBeenCalledWith('activity-1', { isPlaying: false, elapsedSeconds: 42 });
});

test("end maps 'immediate' policy and removes the instance from getActiveInstances", async () => {
  const instance = NowPlayingActivity.start(baseProps);
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(1);
  await instance.end('immediate');
  expect(mockNative.endNowPlaying).toHaveBeenCalledWith('activity-1', 'immediate');
  expect(NowPlayingActivity.getActiveInstances()).toHaveLength(0);
});

test("end defaults to 'default' policy when none given", async () => {
  const instance = NowPlayingActivity.start(baseProps);
  await instance.end();
  expect(mockNative.endNowPlaying).toHaveBeenCalledWith('activity-1', 'default');
});

test('end serializes { after: Date } to an ISO string', async () => {
  const instance = NowPlayingActivity.start(baseProps);
  const after = new Date('2030-01-01T00:00:00.000Z');
  await instance.end({ after });
  expect(mockNative.endNowPlaying).toHaveBeenCalledWith('activity-1', '2030-01-01T00:00:00.000Z');
});

test('end applies finalProps via update before ending', async () => {
  const instance = NowPlayingActivity.start(baseProps);
  await instance.end('default', { isPlaying: false });
  expect(mockNative.updateNowPlaying).toHaveBeenCalledWith('activity-1', { isPlaying: false });
  expect(mockNative.endNowPlaying).toHaveBeenCalled();
});

test('isSupported reflects the native capability check', () => {
  mockNative.isNowPlayingSupported.mockReturnValue(false);
  expect(NowPlayingActivity.isSupported()).toBe(false);
  mockNative.isNowPlayingSupported.mockReturnValue(true);
  expect(NowPlayingActivity.isSupported()).toBe(true);
});
