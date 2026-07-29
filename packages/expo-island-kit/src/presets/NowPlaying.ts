import { createLiveActivityFactory } from '../core/createLiveActivityFactory';

export interface NowPlayingProps {
  title: string;
  artist: string;
  artworkUrl?: string;
  artworkAsset?: string;
  isPlaying: boolean;
  elapsedSeconds: number;
  durationSeconds: number;
  accentColor?: string;
}

export const NowPlayingActivity = createLiveActivityFactory<NowPlayingProps>('nowPlaying');
