import { useRef, useState } from 'react';
import {
  NowPlayingActivity,
  type LiveActivityInstance,
  type NowPlayingProps,
} from 'expo-island-kit';

import { ActionButton, DemoScreen } from '../components/DemoScreen';

const DURATION = 231;

const nowPlayingProps: NowPlayingProps = {
  title: 'Midnight City',
  artist: 'M83',
  artworkUrl: 'https://picsum.photos/seed/islandkit/300',
  isPlaying: true,
  elapsedSeconds: 12,
  durationSeconds: DURATION,
  accentColor: '#FF375F',
};

export default function NowPlayingScreen() {
  const instance = useRef<LiveActivityInstance<NowPlayingProps> | null>(null);
  const [status, setStatus] = useState('Idle');
  const [elapsed, setElapsed] = useState(nowPlayingProps.elapsedSeconds);
  const [playing, setPlaying] = useState(nowPlayingProps.isPlaying);

  function start() {
    const activity = NowPlayingActivity.start(
      nowPlayingProps,
      'islandkitexample://now-playing'
    );
    instance.current = activity;
    setElapsed(nowPlayingProps.elapsedSeconds);
    setPlaying(nowPlayingProps.isPlaying);
    setStatus(activity.id ? `Started (${activity.id})` : 'Start returned no id');
  }

  async function update() {
    const activity = instance.current;
    if (!activity) {
      setStatus('No active activity — press Start');
      return;
    }
    const nextElapsed = Math.min(elapsed + 30, DURATION);
    const nextPlaying = !playing;
    setElapsed(nextElapsed);
    setPlaying(nextPlaying);
    await activity.update({ elapsedSeconds: nextElapsed, isPlaying: nextPlaying });
    setStatus(`Updated → ${nextElapsed}s, ${nextPlaying ? 'playing' : 'paused'}`);
  }

  async function end() {
    const activity = instance.current;
    if (!activity) {
      setStatus('No active activity — press Start');
      return;
    }
    await activity.end('immediate');
    instance.current = null;
    setStatus('Ended');
  }

  return (
    <DemoScreen
      title="Now Playing"
      description="Media playback with artwork and a progress bar. Update advances playback by 30 seconds and toggles the play/pause state."
      status={status}>
      <ActionButton label="Start" onPress={start} />
      <ActionButton label="Update (+30s, toggle play)" onPress={update} tone="neutral" />
      <ActionButton label="End" onPress={end} tone="danger" />
    </DemoScreen>
  );
}
