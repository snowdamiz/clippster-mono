import { onMounted, onUnmounted } from 'vue';

export type RafLoopOptions = {
  autoStart?: boolean;
  fps?: number | (() => number);
  pauseWhenHidden?: boolean;
};

export type RafLoopController = {
  start: () => void;
  stop: () => void;
  requestFrame: () => void;
  isRunning: () => boolean;
};

/**
 * Controllable rAF scheduler. Persistent loops are frame-rate limited, while
 * requestFrame() supports one-shot invalidation without polling while idle.
 */
export function useRafLoop(
  callback: (opts: { time: number }) => void,
  options: RafLoopOptions = {}
): RafLoopController {
  const { autoStart = true, fps, pauseWhenHidden = true } = options;
  let requestId: number | null = null;
  let previousCallbackTime: number | null = null;
  let running = false;
  let frameRequested = false;
  let mounted = false;

  const isHidden = () => pauseWhenHidden && typeof document !== 'undefined' && document.hidden;

  const getFrameInterval = () => {
    const requestedFps = typeof fps === 'function' ? fps() : fps;
    return requestedFps && requestedFps > 0 ? 1000 / requestedFps : 0;
  };

  const schedule = () => {
    if (!mounted || requestId !== null || isHidden() || (!running && !frameRequested)) return;
    requestId = requestAnimationFrame(loop);
  };

  const loop = (timestamp: number) => {
    requestId = null;
    if (isHidden()) return;

    const interval = getFrameInterval();
    const elapsed = previousCallbackTime === null ? interval : timestamp - previousCallbackTime;
    const due = (!running && frameRequested) || interval === 0 || elapsed >= interval - 0.5;

    if (due) {
      frameRequested = false;
      previousCallbackTime = timestamp;
      callback({ time: elapsed });
    }

    schedule();
  };

  const start = () => {
    running = true;
    schedule();
  };

  const stop = () => {
    running = false;
    previousCallbackTime = null;
    if (!frameRequested && requestId !== null) {
      cancelAnimationFrame(requestId);
      requestId = null;
    }
  };

  const requestFrame = () => {
    frameRequested = true;
    schedule();
  };

  const handleVisibilityChange = () => {
    if (isHidden()) {
      if (requestId !== null) {
        cancelAnimationFrame(requestId);
        requestId = null;
      }
      previousCallbackTime = null;
      return;
    }
    schedule();
  };

  onMounted(() => {
    mounted = true;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (autoStart) start();
  });

  onUnmounted(() => {
    mounted = false;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (requestId !== null) cancelAnimationFrame(requestId);
    requestId = null;
  });

  return {
    start,
    stop,
    requestFrame,
    isRunning: () => running,
  };
}
