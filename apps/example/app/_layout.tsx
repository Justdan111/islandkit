import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff' },
          contentStyle: { backgroundColor: '#000' },
        }}>
        <Stack.Screen name="index" options={{ title: 'IslandKit' }} />
        <Stack.Screen name="now-playing" options={{ title: 'Now Playing' }} />
        <Stack.Screen name="generic-progress" options={{ title: 'Generic Progress' }} />
        <Stack.Screen name="delivery" options={{ title: 'Delivery' }} />
        <Stack.Screen name="timer" options={{ title: 'Timer' }} />
      </Stack>
    </>
  );
}
