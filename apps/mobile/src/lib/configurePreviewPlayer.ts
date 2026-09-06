import type { VideoPlayer } from 'expo-video';

/**
 * Continuous local VOD playback (project workspace).
 * Prefer a healthier forward buffer so decode hiccups don't empty the pipeline.
 * Android default preferredForwardBufferDuration is 20s; 2s was causing random freezes.
 */
export function configureVodPlayer(player: VideoPlayer): void {
  player.timeUpdateEventInterval = 0.25;
  player.bufferOptions = {
    waitsToMinimizeStalling: true,
    preferredForwardBufferDuration: 12,
    minBufferForPlayback: 1,
    prioritizeTimeOverSizeThreshold: true,
  };
}

/**
 * Clip / adjust / framing previews — seek-heavy, short sources.
 * Keep a smaller buffer so scrubbing doesn't hold a huge decode window.
 */
export function configurePreviewPlayer(player: VideoPlayer): void {
  player.timeUpdateEventInterval = 0.25;
  player.bufferOptions = {
    waitsToMinimizeStalling: false,
    preferredForwardBufferDuration: 4,
    minBufferForPlayback: 0.25,
    prioritizeTimeOverSizeThreshold: true,
  };
}
