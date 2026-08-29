import { useEventListener } from 'expo';
import type { VideoPlayer } from 'expo-video';
import { useCallback, useRef, useState } from 'react';
import {
  runOnJS,
  useAnimatedReaction,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

const DEFAULT_DRIFT_SECONDS = 0.45;
const REACT_TICKS_PER_SECOND = 10;

function knownDuration(seconds: number | null | undefined): number {
  return seconds && seconds > 0 ? seconds : Number.POSITIVE_INFINITY;
}

/**
 * Drives a UI-thread display clock from useFrameCallback while playing.
 * React state is throttled so VideoView / controls are not re-rendered every frame.
 * Player timeUpdate is used only for drift correction, not as the display source.
 */
export function useSmoothPlayerTime(
  player: VideoPlayer,
  onTimeChange?: (seconds: number) => void,
): { currentTime: number; timeSV: SharedValue<number>; noteSeek: (seconds: number) => void } {
  const timeSV = useSharedValue(player.currentTime ?? 0);
  const playingSV = useSharedValue(Boolean(player.playing));
  const rateSV = useSharedValue(player.playbackRate || 1);
  const durationSV = useSharedValue(knownDuration(player.duration));

  const [currentTime, setCurrentTime] = useState(() => player.currentTime ?? 0);
  const onTimeRef = useRef(onTimeChange);
  onTimeRef.current = onTimeChange;

  const publishTime = useCallback((next: number) => {
    setCurrentTime(next);
    onTimeRef.current?.(next);
  }, []);

  const noteSeek = useCallback(
    (seconds: number) => {
      const next = Math.max(0, seconds);
      timeSV.value = next;
      publishTime(next);
    },
    [publishTime, timeSV],
  );

  useFrameCallback((frame) => {
    'worklet';
    if (!playingSV.value) return;
    const dt = (frame.timeSincePreviousFrame ?? 0) / 1000;
    if (dt <= 0) return;
    const step = Math.min(dt, 0.05);
    timeSV.value = Math.min(durationSV.value, timeSV.value + step * rateSV.value);
  });

  useAnimatedReaction(
    () => Math.floor(timeSV.value * REACT_TICKS_PER_SECOND),
    (bucket, previous) => {
      if (bucket === previous) return;
      runOnJS(publishTime)(bucket / REACT_TICKS_PER_SECOND);
    },
  );

  useEventListener(player, 'timeUpdate', (payload: { currentTime: number }) => {
    durationSV.value = knownDuration(player.duration);
    rateSV.value = player.playbackRate || 1;

    if (!playingSV.value) {
      timeSV.value = payload.currentTime;
      publishTime(payload.currentTime);
      return;
    }

    const drift = Math.abs(payload.currentTime - timeSV.value);
    if (drift > DEFAULT_DRIFT_SECONDS) {
      timeSV.value = payload.currentTime;
    }
  });

  useEventListener(player, 'playingChange', () => {
    const wasPlaying = playingSV.value;
    playingSV.value = Boolean(player.playing);
    rateSV.value = player.playbackRate || 1;
    durationSV.value = knownDuration(player.duration);

    if (playingSV.value && !wasPlaying) {
      timeSV.value = player.currentTime ?? timeSV.value;
      return;
    }

    if (!playingSV.value && wasPlaying) {
      const next = player.currentTime ?? timeSV.value;
      timeSV.value = next;
      publishTime(next);
    }
  });

  useEventListener(player, 'statusChange', () => {
    durationSV.value = knownDuration(player.duration);
  });

  return { currentTime, timeSV, noteSeek };
}
