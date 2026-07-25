import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  NowPlayingActivity,
  type LiveActivityInstance,
  type NowPlayingProps,
} from 'expo-island-kit';

const DURATION = 231;

const initialProps: NowPlayingProps = {
  title: 'Midnight City',
  artist: 'M83',
  artworkUrl: 'https://picsum.photos/seed/islandkit/300',
  isPlaying: true,
  elapsedSeconds: 12,
  durationSeconds: DURATION,
  accentColor: '#FF375F',
};

export default function App() {
  const instanceRef = useRef<LiveActivityInstance<NowPlayingProps> | null>(null);
  const [status, setStatus] = useState('Idle');
  const [elapsed, setElapsed] = useState(initialProps.elapsedSeconds);
  const [playing, setPlaying] = useState(initialProps.isPlaying);

  const supported = NowPlayingActivity.isSupported();

  function start() {
    const instance = NowPlayingActivity.start(initialProps, 'islandkitexample://now-playing');
    instanceRef.current = instance;
    setStatus(instance.id ? `Started (${instance.id.slice(0, 8)}…)` : 'Start returned no id (unsupported?)');
  }

  async function bump() {
    const instance = instanceRef.current;
    if (!instance) return setStatus('No active activity — press Start');
    const nextElapsed = Math.min(elapsed + 30, DURATION);
    const nextPlaying = !playing;
    setElapsed(nextElapsed);
    setPlaying(nextPlaying);
    await instance.update({ elapsedSeconds: nextElapsed, isPlaying: nextPlaying });
    setStatus(`Updated → ${nextElapsed}s, ${nextPlaying ? 'playing' : 'paused'}`);
  }

  async function stop() {
    const instance = instanceRef.current;
    if (!instance) return setStatus('No active activity — press Start');
    await instance.end('immediate');
    instanceRef.current = null;
    setElapsed(initialProps.elapsedSeconds);
    setPlaying(initialProps.isPlaying);
    setStatus('Ended');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>IslandKit — Now Playing</Text>
      <Text style={styles.line}>Supported: {supported ? 'yes' : 'no'}</Text>
      <Text style={styles.status}>{status}</Text>

      <Button label="Start" onPress={start} />
      <Button label="Update (+30s, toggle play)" onPress={bump} />
      <Button label="End" onPress={stop} tone="#FF375F" />

      <StatusBar style="auto" />
    </View>
  );
}

function Button({ label, onPress, tone = '#0A84FF' }: { label: string; onPress: () => void; tone?: string }) {
  return (
    <Pressable style={[styles.button, { backgroundColor: tone }]} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', gap: 12, padding: 24 },
  title: { fontSize: 24, fontWeight: '700' },
  line: { fontSize: 15, color: '#333' },
  status: { fontSize: 14, color: '#666', marginBottom: 8, textAlign: 'center' },
  button: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, minWidth: 260, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
