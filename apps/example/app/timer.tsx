import { useRef, useState } from 'react';
import { TimerActivity, type LiveActivityInstance, type TimerProps } from 'expo-island-kit';

import { ActionButton, DemoScreen } from '../components/DemoScreen';

const TIMER_LABEL = 'Pasta';
const TIMER_MINUTES = 9;
const ACCENT_COLOR = '#FF9F0A';

export default function TimerScreen() {
  const instance = useRef<LiveActivityInstance<TimerProps> | null>(null);
  // The consumer tracks its own endDate — pausing does not rewrite it,
  // so resume has to pass a fresh one (currentEndDate is a deferred convenience).
  const endDate = useRef<Date>(new Date());
  const [status, setStatus] = useState('Idle');

  function start() {
    const end = new Date(Date.now() + TIMER_MINUTES * 60 * 1000);
    endDate.current = end;
    const activity = TimerActivity.start(
      { label: TIMER_LABEL, endDate: end, accentColor: ACCENT_COLOR },
      'islandkitexample://timers/pasta'
    );
    instance.current = activity;
    setStatus(activity.id ? `Started (${activity.id})` : 'Start returned no id');
  }

  async function setPaused(isPaused: boolean) {
    const activity = instance.current;
    if (!activity) {
      setStatus('No active activity — press Start');
      return;
    }
    await activity.update({ label: TIMER_LABEL, endDate: endDate.current, isPaused });
    setStatus(isPaused ? 'Paused' : 'Resumed');
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
      title="Timer"
      description={`A ${TIMER_MINUTES}-minute countdown that ticks live in the Dynamic Island. Pause freezes it and Resume restarts it against the same end date.`}
      status={status}>
      <ActionButton label="Start" onPress={start} />
      <ActionButton label="Pause" onPress={() => setPaused(true)} tone="neutral" />
      <ActionButton label="Resume" onPress={() => setPaused(false)} tone="neutral" />
      <ActionButton label="End" onPress={end} tone="danger" />
    </DemoScreen>
  );
}
