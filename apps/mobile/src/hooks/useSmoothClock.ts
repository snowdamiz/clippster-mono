import { useCallback, useEffect, useRef, useState } from 'react';

export function useSmoothClock({
  playing,
  duration,
  rate = 1,
  onEnd,
}: {
  playing: boolean;
  duration: number;
  rate?: number;
  onEnd?: () => void;
}): { time: number; seek: (seconds: number) => void } {
  const [time, setTime] = useState(0);
  const timeRef = useRef(0);
  const durationRef = useRef(duration);
  const rateRef = useRef(rate);
  const onEndRef = useRef(onEnd);
  durationRef.current = duration;
  rateRef.current = rate;
  onEndRef.current = onEnd;

  const seek = useCallback((seconds: number) => {
    const next = Math.max(0, Math.min(durationRef.current, seconds));
    timeRef.current = next;
    setTime(next);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = ((now - last) / 1000) * rateRef.current;
      last = now;
      const next = Math.min(durationRef.current, timeRef.current + delta);
      timeRef.current = next;
      setTime(next);
      if (next >= durationRef.current && durationRef.current > 0) {
        onEndRef.current?.();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  return { time, seek };
}
