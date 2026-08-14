import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export type ButtonTone = 'primary' | 'neutral' | 'danger';

const TONE_COLORS: Record<ButtonTone, string> = {
  primary: '#0A84FF',
  neutral: '#3A3A3C',
  danger: '#FF375F',
};

export function DemoScreen({
  title,
  description,
  status,
  children,
}: {
  title: string;
  description: string;
  status: string;
  children: ReactNode;
}) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Status</Text>
        <Text style={styles.statusValue}>{status}</Text>
      </View>

      <View style={styles.actions}>{children}</View>
    </ScrollView>
  );
}

export function ActionButton({
  label,
  onPress,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: TONE_COLORS[tone], opacity: pressed ? 0.7 : 1 },
      ]}
      onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#000' },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700' },
  description: { color: '#9A9AA0', fontSize: 15, lineHeight: 21 },
  statusCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  statusLabel: {
    color: '#7A7A80',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statusValue: { color: '#fff', fontSize: 15 },
  actions: { gap: 10 },
  button: {
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
