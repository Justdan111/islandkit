import { useRef, useState } from 'react';
import {
  DeliveryActivity,
  type DeliveryProps,
  type LiveActivityInstance,
} from 'expo-island-kit';

import { ActionButton, DemoScreen } from '../components/DemoScreen';

const deliveryProps: DeliveryProps = {
  status: 'onTheWay',
  etaMinutes: 12,
  courierName: 'Ade',
  // orderNumber is immutable: it is set at start and ignored by update.
  orderNumber: '#48213',
  accentColor: '#22C55E',
};

const DELIVERY_STAGES: DeliveryProps['status'][] = [
  'confirmed',
  'preparing',
  'onTheWay',
  'delivered',
];

const INITIAL_STAGE = DELIVERY_STAGES.indexOf(deliveryProps.status);

export default function DeliveryScreen() {
  const instance = useRef<LiveActivityInstance<DeliveryProps> | null>(null);
  const [status, setStatus] = useState('Idle');
  const [stage, setStage] = useState(INITIAL_STAGE);

  function start() {
    const activity = DeliveryActivity.start(
      deliveryProps,
      'islandkitexample://orders/48213'
    );
    instance.current = activity;
    setStage(INITIAL_STAGE);
    setStatus(activity.id ? `Started (${activity.id})` : 'Start returned no id');
  }

  async function update() {
    const activity = instance.current;
    if (!activity) {
      setStatus('No active activity — press Start');
      return;
    }
    const next = Math.min(stage + 1, DELIVERY_STAGES.length - 1);
    setStage(next);
    const nextStatus = DELIVERY_STAGES[next];
    await activity.update({
      status: nextStatus,
      etaMinutes: nextStatus === 'delivered' ? 0 : Math.max(0, 12 - next * 4),
    });
    setStatus(`Updated → ${nextStatus}`);
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
      title="Delivery"
      description="Order tracking through confirmed → preparing → onTheWay → delivered. Update advances one stage and shortens the ETA. The order number is fixed at start."
      status={status}>
      <ActionButton label="Start" onPress={start} />
      <ActionButton label="Update (advance status)" onPress={update} tone="neutral" />
      <ActionButton label="End" onPress={end} tone="danger" />
    </DemoScreen>
  );
}
