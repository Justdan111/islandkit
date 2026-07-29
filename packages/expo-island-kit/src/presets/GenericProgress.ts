import { createLiveActivityFactory } from '../core/createLiveActivityFactory';

export interface GenericProgressProps {
  title: string;
  subtitle?: string;
  progress: number; // 0–1
  iconSystemName?: string;
  accentColor?: string;
}

export const GenericProgressActivity =
  createLiveActivityFactory<GenericProgressProps>('genericProgress');
