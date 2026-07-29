import { createLiveActivityFactory } from '../core/createLiveActivityFactory';

export interface DeliveryProps {
  status: 'confirmed' | 'preparing' | 'onTheWay' | 'delivered';
  etaMinutes?: number;
  courierName?: string;
  orderNumber: string;
  mapSnapshotUrl?: string;
  accentColor?: string;
}

export const DeliveryActivity = createLiveActivityFactory<DeliveryProps>('delivery');
