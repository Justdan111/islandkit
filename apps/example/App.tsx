import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  DeliveryActivity,
  GenericProgressActivity,
  NowPlayingActivity,
  type DeliveryProps,
  type GenericProgressProps,
  type LiveActivityInstance,
  type NowPlayingProps,
} from 'expo-island-kit';

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

const genericProgressProps: GenericProgressProps = {
  title: 'Uploading backup',
  subtitle: '128 of 400 photos',
  progress: 0.32,
  iconSystemName: 'icloud.and.arrow.up',
  accentColor: '#0A84FF',
};

const deliveryProps: DeliveryProps = {
  status: 'onTheWay',
  etaMinutes: 12,
  courierName: 'Ade',
  orderNumber: '#48213',
  accentColor: '#22C55E',
};

const DELIVERY_STAGES: DeliveryProps['status'][] = ['confirmed', 'preparing', 'onTheWay', 'delivered'];

export default function App() {
  const supported = NowPlayingActivity.isSupported();

  const npRef = useRef<LiveActivityInstance<NowPlayingProps> | null>(null);
  const [npStatus, setNpStatus] = useState('Idle');
  const [elapsed, setElapsed] = useState(nowPlayingProps.elapsedSeconds);
  const [playing, setPlaying] = useState(nowPlayingProps.isPlaying);

  const gpRef = useRef<LiveActivityInstance<GenericProgressProps> | null>(null);
  const [gpStatus, setGpStatus] = useState('Idle');
  const [progress, setProgress] = useState(genericProgressProps.progress);

  const dRef = useRef<LiveActivityInstance<DeliveryProps> | null>(null);
  const [dStatus, setDStatus] = useState('Idle');
  const [dStage, setDStage] = useState(2); // 'onTheWay'

  function startNp() {
    const i = NowPlayingActivity.start(nowPlayingProps, 'islandkitexample://now-playing');
    npRef.current = i;
    setNpStatus(i.id ? `Started (${i.id.slice(0, 8)}…)` : 'Start returned no id');
  }
  async function bumpNp() {
    const i = npRef.current;
    if (!i) return setNpStatus('No active activity — press Start');
    const nextElapsed = Math.min(elapsed + 30, DURATION);
    const nextPlaying = !playing;
    setElapsed(nextElapsed);
    setPlaying(nextPlaying);
    await i.update({ elapsedSeconds: nextElapsed, isPlaying: nextPlaying });
    setNpStatus(`Updated → ${nextElapsed}s, ${nextPlaying ? 'playing' : 'paused'}`);
  }
  async function stopNp() {
    const i = npRef.current;
    if (!i) return setNpStatus('No active activity — press Start');
    await i.end('immediate');
    npRef.current = null;
    setNpStatus('Ended');
  }

  function startGp() {
    const i = GenericProgressActivity.start(genericProgressProps, 'islandkitexample://backup');
    gpRef.current = i;
    setGpStatus(i.id ? `Started (${i.id.slice(0, 8)}…)` : 'Start returned no id');
  }
  async function bumpGp() {
    const i = gpRef.current;
    if (!i) return setGpStatus('No active activity — press Start');
    const next = Math.min(progress + 0.2, 1);
    setProgress(next);
    await i.update({ progress: next, subtitle: `${Math.round(next * 400)} of 400 photos` });
    setGpStatus(`Updated → ${Math.round(next * 100)}%`);
  }
  async function stopGp() {
    const i = gpRef.current;
    if (!i) return setGpStatus('No active activity — press Start');
    await i.end('immediate');
    gpRef.current = null;
    setGpStatus('Ended');
  }

  function startD() {
    const i = DeliveryActivity.start(deliveryProps, 'islandkitexample://orders/48213');
    dRef.current = i;
    setDStage(2);
    setDStatus(i.id ? `Started (${i.id.slice(0, 8)}…)` : 'Start returned no id');
  }
  async function bumpD() {
    const i = dRef.current;
    if (!i) return setDStatus('No active activity — press Start');
    const next = Math.min(dStage + 1, DELIVERY_STAGES.length - 1);
    setDStage(next);
    const status = DELIVERY_STAGES[next];
    await i.update({ status, etaMinutes: status === 'delivered' ? 0 : Math.max(0, 12 - next * 4) });
    setDStatus(`Updated → ${status}`);
  }
  async function stopD() {
    const i = dRef.current;
    if (!i) return setDStatus('No active activity — press Start');
    await i.end('immediate');
    dRef.current = null;
    setDStatus('Ended');
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>IslandKit</Text>
      <Text style={styles.line}>Supported: {supported ? 'yes' : 'no'}</Text>

      <Text style={styles.section}>Now Playing</Text>
      <Text style={styles.status}>{npStatus}</Text>
      <Button label="Start" onPress={startNp} />
      <Button label="Update (+30s, toggle play)" onPress={bumpNp} />
      <Button label="End" onPress={stopNp} tone="#FF375F" />

      <Text style={styles.section}>Generic Progress</Text>
      <Text style={styles.status}>{gpStatus}</Text>
      <Button label="Start" onPress={startGp} />
      <Button label="Update (+20%)" onPress={bumpGp} />
      <Button label="End" onPress={stopGp} tone="#FF375F" />

      <Text style={styles.section}>Delivery</Text>
      <Text style={styles.status}>{dStatus}</Text>
      <Button label="Start" onPress={startD} />
      <Button label="Update (advance status)" onPress={bumpD} />
      <Button label="End" onPress={stopD} tone="#FF375F" />

      <StatusBar style="auto" />
    </ScrollView>
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
  container: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', gap: 10, padding: 24, paddingTop: 72 },
  title: { fontSize: 24, fontWeight: '700' },
  line: { fontSize: 15, color: '#333' },
  section: { fontSize: 18, fontWeight: '700', marginTop: 20 },
  status: { fontSize: 14, color: '#666', textAlign: 'center' },
  button: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, minWidth: 260, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
