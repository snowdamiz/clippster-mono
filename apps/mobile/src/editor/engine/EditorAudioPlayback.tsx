import { useEffect, useRef } from 'react';
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
    instance.muted = false;
  });
  const lastSeekSeconds = useRef(sourceSeconds);

  useEffect(() => {
    player.volume = volume;
    try {
      player.playbackRate = speed;
    } catch {
      // Some platforms reject extreme rates; volume/seek still apply.
    }

    const drift = Math.abs(player.currentTime - sourceSeconds);
    const shouldSeek =
      !scrubbing &&
      (!playing || drift > 0.35 || Math.abs(sourceSeconds - lastSeekSeconds.current) > 0.35);

    if (shouldSeek) {
      player.currentTime = sourceSeconds;
      lastSeekSeconds.current = sourceSeconds;
    }

    if (playing) player.play();
    else player.pause();
  }, [player, playing, scrubbing, sourceSeconds, volume, speed]);

  return null;
}
