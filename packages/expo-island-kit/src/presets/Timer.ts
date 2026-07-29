import { createLiveActivityFactory } from '../core/createLiveActivityFactory';

export interface TimerProps {
  label: string;
  endDate: Date;
  isPaused?: boolean;
  accentColor?: string;
}

export const TimerActivity = createLiveActivityFactory<TimerProps>('timer');
