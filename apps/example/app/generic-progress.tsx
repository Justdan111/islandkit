import { useRef, useState } from 'react';
import {
  GenericProgressActivity,
  type GenericProgressProps,
  type LiveActivityInstance,
} from 'expo-island-kit';

import { ActionButton, DemoScreen } from '../components/DemoScreen';

const genericProgressProps: GenericProgressProps = {
  title: 'Uploading backup',
  subtitle: '128 of 400 photos',
  progress: 0.32,
  iconSystemName: 'icloud.and.arrow.up',
  accentColor: '#0A84FF',
};

export default function GenericProgressScreen() {
  const instance = useRef<LiveActivityInstance<GenericProgressProps> | null>(null);
  const [status, setStatus] = useState('Idle');
  const [progress, setProgress] = useState(genericProgressProps.progress);

  function start() {
    const activity = GenericProgressActivity.start(
      genericProgressProps,
      'islandkitexample://backup'
    );
    instance.current = activity;
    setProgress(genericProgressProps.progress);
    setStatus(activity.id ? `Started (${activity.id})` : 'Start returned no id');
  }

  async function update() {
    const activity = instance.current;
    if (!activity) {
      setStatus('No active activity — press Start');
      return;
    }
    const next = Math.min(progress + 0.2, 1);
    setProgress(next);
    await activity.update({
      progress: next,
      subtitle: `${Math.round(next * 400)} of 400 photos`,
    });
    setStatus(`Updated → ${Math.round(next * 100)}%`);
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
      title="Generic Progress"
      description="Any task with a 0–1 progress value and an SF Symbol. Update advances the upload by 20% and rewrites the subtitle."
      status={status}>
      <ActionButton label="Start" onPress={start} />
      <ActionButton label="Update (+20%)" onPress={update} tone="neutral" />
      <ActionButton label="End" onPress={end} tone="danger" />
    </DemoScreen>
  );
}
