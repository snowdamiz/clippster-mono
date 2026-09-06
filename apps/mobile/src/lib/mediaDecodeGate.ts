/**

 * Global decode budget so thumbnail / filmstrip jobs do not fight active playback.

 * Call acquire while decoding stills; release in finally. Playback callers should

 * pause background work via isPlaybackCritical() when a preview is on screen.

 */



import { EDITOR_CACHE_POLICY } from '@/editor/performance/mediaPolicy';



let activeSlots = 0;

let playbackCritical = 0;

const waiters: Array<() => void> = [];



function flushWaiters() {

  while (

    waiters.length > 0 &&

    activeSlots < EDITOR_CACHE_POLICY.maxActiveThumbnailPlayers &&

    playbackCritical === 0

  ) {

    const next = waiters.shift();

    next?.();

  }

}



function acquireSlot(): Promise<void> {

  return new Promise((resolve) => {

    const tryAcquire = () => {

      if (

        activeSlots < EDITOR_CACHE_POLICY.maxActiveThumbnailPlayers &&

        playbackCritical === 0

      ) {

        activeSlots += 1;

        resolve();

        return;

      }

      waiters.push(tryAcquire);

    };

    tryAcquire();

  });

}



/** Mark that a user-facing player is actively decoding (project/clip/editor). */

export function beginPlaybackCritical(): () => void {

  playbackCritical += 1;

  return () => {

    playbackCritical = Math.max(0, playbackCritical - 1);

    flushWaiters();

  };

}



export function isPlaybackCritical(): boolean {

  return playbackCritical > 0;

}



export async function withThumbnailDecodeSlot<T>(work: () => Promise<T>): Promise<T> {

  await acquireSlot();



  // Playback may have claimed the decoder between queue wake and run — yield and wait.

  if (playbackCritical > 0) {

    activeSlots = Math.max(0, activeSlots - 1);

    flushWaiters();

    await acquireSlot();

  }



  try {

    return await work();

  } finally {

    activeSlots = Math.max(0, activeSlots - 1);

    flushWaiters();

  }

}


