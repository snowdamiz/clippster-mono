import Hls from 'hls.js';

function videoEvent(video: HTMLVideoElement, event: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(event, ready);
      video.removeEventListener('error', fail);
      signal.removeEventListener('abort', abort);
    };
    const ready = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error('Could not decode the video for Auto framing.'));
    };
    const abort = () => {
      cleanup();
      reject(new DOMException('Cancelled', 'AbortError'));
    };
    const timer = setTimeout(fail, 30000);
    video.addEventListener(event, ready, { once: true });
    video.addEventListener('error', fail, { once: true });
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

export async function openAnalysisVideo(url: string, signal: AbortSignal) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  let hls: Hls | undefined;
  const close = () => {
    hls?.destroy();
    video.pause();
    video.removeAttribute('src');
    video.load();
  };
  try {
    const ready = videoEvent(video, 'loadeddata', signal);
    if (url.includes('.m3u8') && Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 5, maxMaxBufferLength: 10 });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else video.src = url;
    await ready;
    return {
      video,
      close,
      async seek(time: number) {
        signal.throwIfAborted();
        if (Math.abs(video.currentTime - time) < 0.001 && video.readyState >= 2) return;
        const seeked = videoEvent(video, 'seeked', signal);
        video.currentTime = time;
        await seeked;
        if (Math.abs(video.currentTime - time) > 0.1)
          throw new Error(
            'The source video could not seek accurately. Reopen the clip or use Manual framing.'
          );
        if (video.readyState < 2) await videoEvent(video, 'loadeddata', signal);
      },
    };
  } catch (error) {
    close();
    throw error;
  }
}
