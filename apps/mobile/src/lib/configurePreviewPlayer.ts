import type { VideoPlayer } from 'expo-video';

/** Shared setup for local VOD / clip preview players. */
export function configurePreviewPlayer(player: VideoPlayer): void {
  player.timeUpdateEventInterval = 0.25;
  // Local files should keep decoding, not pause to "rebuffer" on timestamp jumps.
  player.bufferOptions = {
    waitsToMinimizeStalling: false,
    preferredForwardBufferDuration: 2,
    minBufferForPlayback: 0.05,
    prioritizeTimeOverSizeThreshold: true,
  };
}
