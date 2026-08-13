import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { areLiveActivitiesEnabled, NowPlayingActivity } from 'expo-island-kit';

const PRESETS = [
  {
    href: '/now-playing',
    title: 'Now Playing',
    description: 'Track title, artist, artwork and a scrubbing progress bar.',
  },
  {
    href: '/generic-progress',
    title: 'Generic Progress',
    description: 'Any 0–1 task with an SF Symbol — uploads, syncs, downloads.',
  },
  {
    href: '/delivery',
    title: 'Delivery',
    description: 'Four-stage order status with ETA, courier and a map snapshot.',
  },
  {
    href: '/timer',
    title: 'Timer',
    description: 'Live countdown to an end date, with pause and resume.',
  },
] as const;

export default function Index() {
  const supported = NowPlayingActivity.isSupported();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    areLiveActivitiesEnabled().then(
      (value) => {
        if (!cancelled) setEnabled(value);
      },
      () => {
        if (!cancelled) setEnabled(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const enabledLabel = enabled === null ? 'checking…' : enabled ? 'yes' : 'no';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Each screen starts, updates and ends one Live Activity. Leave the app to see it in the
        Dynamic Island, or lock the device for the Lock Screen banner.
      </Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLine}>Platform supported: {supported ? 'yes' : 'no'}</Text>
        <Text style={styles.statusLine}>Live Activities enabled: {enabledLabel}</Text>
      </View>

      {PRESETS.map((preset) => (
        <Link key={preset.href} href={preset.href} style={styles.card}>
          <View>
            <Text style={styles.cardTitle}>{preset.title}</Text>
            <Text style={styles.cardDescription}>{preset.description}</Text>
          </View>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#000' },
  content: { padding: 20, paddingBottom: 48, gap: 14 },
  intro: { color: '#9A9AA0', fontSize: 15, lineHeight: 21 },
  statusCard: { backgroundColor: '#1C1C1E', borderRadius: 14, gap: 4, padding: 14 },
  statusLine: { color: '#fff', fontSize: 15 },
  card: { backgroundColor: '#1C1C1E', borderRadius: 14, padding: 16 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cardDescription: { color: '#9A9AA0', fontSize: 14, lineHeight: 20, marginTop: 4 },
});
