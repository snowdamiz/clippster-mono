import { useEffect } from 'react';
import { useVideoPlayer } from 'expo-video';

/** Audio-only timeline playback until native Oboe/Core Audio mix lands. */
export function EditorAudioPlayback({
  uri,
  sourceSeconds,
  playing,
  scrubbing,
  volume,
  speed,
}: {
  uri: string;
  sourceSeconds: number;
  playing: boolean;
  scrubbing: boolean;
  volume: number;
  speed: number;
}) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.currentTime = sourceSeconds;
    instance.volume = volume;
  });
  useEffect(() => {
    if (!scrubbing && (Math.abs(player.currentTime - sourceSeconds) > 0.2 || !playing)) {
      player.currentTime = sourceSeconds;
    }
    player.volume = volume;
    try {
      player.playbackRate = speed;
    } catch {
      // Some platforms reject extreme rates; volume/seek still apply.
    }
    if (playing) player.play();
    else player.pause();
  }, [player, playing, scrubbing, sourceSeconds, volume, speed]);
  return null;
}
