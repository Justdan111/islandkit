import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { areLiveActivitiesEnabled } from 'expo-island-kit';

export default function App() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    areLiveActivitiesEnabled()
      .then(setEnabled)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>IslandKit</Text>
      <Text style={styles.line}>
        Native bridge:{' '}
        {error ? `error — ${error}` : enabled === null ? 'calling…' : 'OK'}
      </Text>
      <Text style={styles.line}>
        Live Activities enabled:{' '}
        {enabled === null ? '…' : enabled ? 'true' : 'false'}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 8,
  },
  title: { fontSize: 28, fontWeight: '700' },
  line: { fontSize: 16 },
});
