import { ref, computed, onUnmounted } from 'vue';
import Hls, { type Level } from 'hls.js';
import {
  checkKickLivestream,
  getKickStreamUrl,
  type KickLivestreamStatus,
} from '@/services/kick';

type ConnectionState = 'idle' | 'connecting' | 'ready' | 'error';

interface QualityOption {
  id: number;
  label: string;
  width?: number;
  height?: number;
  bitrate?: number;
  isAuto?: boolean;
}

interface KickViewerState {
  connectionState: ConnectionState;
  error: string | null;
  channelSlug: string | null;
  title: string | null;
  viewerCount: number | null;
  playbackUrl: string | null;
  startedAt: string | null;
  isLive: boolean;
  language: string | null;
  latencyMs: number | null;
  currentTime: number;
  duration: number;
  bufferedRanges: Array<{ start: number; end: number }>;
  isPlaying: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  volume: number;
  isAtLiveEdge: boolean;
  dvrWindowSeconds: number;
}

const LIVE_EDGE_THRESHOLD_SECONDS = 5;
const PROGRESS_UPDATE_INTERVAL_MS = 1000;
const LOCAL_STORAGE_VOLUME_KEY = 'kick-viewer-volume';
const LOCAL_STORAGE_MUTED_KEY = 'kick-viewer-muted';

function loadVolumePreference() {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_VOLUME_KEY);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!Number.isNaN(parsed)) {
        return Math.min(Math.max(parsed, 0), 1);
      }
    }
  } catch {
    // ignore
  }
  return 1;
}

function loadMutedPreference() {
  try {
    return localStorage.getItem(LOCAL_STORAGE_MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function useKickLivestreamViewer() {
  const state = ref<KickViewerState>({
    connectionState: 'idle',
    error: null,
    channelSlug: null,
    title: null,
    viewerCount: null,
    playbackUrl: null,
    startedAt: null,
    isLive: false,
    language: null,
    latencyMs: null,
    currentTime: 0,
    duration: 0,
    bufferedRanges: [],
    isPlaying: false,
    isBuffering: true,
    isMuted: loadMutedPreference(),
    volume: loadVolumePreference(),
    isAtLiveEdge: true,
    dvrWindowSeconds: 0,
  });

  const qualities = ref<QualityOption[]>([{ id: -1, label: 'Auto', isAuto: true }]);
  const selectedQuality = ref<number | 'auto'>('auto');
  const metadata = ref<KickLivestreamStatus | null>(null);

  let videoElement: HTMLVideoElement | null = null;
  let hls: Hls | null = null;
  let progressInterval: number | null = null;

  function resetState() {
    state.value.connectionState = 'idle';
    state.value.error = null;
    state.value.channelSlug = null;
    state.value.title = null;
    state.value.viewerCount = null;
    state.value.playbackUrl = null;
    state.value.startedAt = null;
    state.value.isLive = false;
    state.value.language = null;
    state.value.latencyMs = null;
    state.value.currentTime = 0;
    state.value.duration = 0;
    state.value.bufferedRanges = [];
    state.value.isPlaying = false;
    state.value.isBuffering = true;
    state.value.isAtLiveEdge = true;
    state.value.dvrWindowSeconds = 0;
    metadata.value = null;
    qualities.value = [{ id: -1, label: 'Auto', isAuto: true }];
    selectedQuality.value = 'auto';
  }

  function destroyHls() {
    if (hls) {
      hls.destroy();
      hls = null;
    }
  }

  function cleanupProgressTimer() {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }

  function startProgressTimer() {
    cleanupProgressTimer();
    if (!videoElement) return;
    progressInterval = window.setInterval(() => {
      updateMetricsFromVideo();
    }, PROGRESS_UPDATE_INTERVAL_MS);
  }

  function updateMetricsFromVideo() {
    if (!videoElement) return;
    const { currentTime, duration, buffered } = videoElement;
    state.value.currentTime = currentTime;

    if (Number.isFinite(duration) && duration > 0) {
      state.value.duration = duration;
    }

    const ranges: Array<{ start: number; end: number }> = [];
    for (let i = 0; i < buffered.length; i += 1) {
      ranges.push({
        start: buffered.start(i),
        end: buffered.end(i),
      });
    }
    state.value.bufferedRanges = ranges;

    const durationReference =
      state.value.duration > 0 ? state.value.duration : state.value.dvrWindowSeconds;
    if (durationReference > 0) {
      const delta = Math.max(0, durationReference - currentTime);
      state.value.isAtLiveEdge = delta <= LIVE_EDGE_THRESHOLD_SECONDS;
    }
  }

  function handleVideoPlaying() {
    state.value.isPlaying = true;
    state.value.isBuffering = false;
  }

  function handleVideoPause() {
    state.value.isPlaying = false;
  }

  function handleVideoWaiting() {
    state.value.isBuffering = true;
  }

  function attachVideoEvents() {
    if (!videoElement) return;
    videoElement.addEventListener('playing', handleVideoPlaying);
    videoElement.addEventListener('pause', handleVideoPause);
    videoElement.addEventListener('waiting', handleVideoWaiting);
    videoElement.addEventListener('timeupdate', updateMetricsFromVideo);
    videoElement.addEventListener('progress', updateMetricsFromVideo);
  }

  function detachVideoEvents() {
    if (!videoElement) return;
    videoElement.removeEventListener('playing', handleVideoPlaying);
    videoElement.removeEventListener('pause', handleVideoPause);
    videoElement.removeEventListener('waiting', handleVideoWaiting);
    videoElement.removeEventListener('timeupdate', updateMetricsFromVideo);
    videoElement.removeEventListener('progress', updateMetricsFromVideo);
  }

  function setVideoElement(element: HTMLVideoElement | null) {
    if (videoElement === element) return;
    detachVideoEvents();
    videoElement = element;
    if (videoElement) {
      videoElement.volume = state.value.volume;
      videoElement.muted = state.value.isMuted;
      attachVideoEvents();
      startProgressTimer();
      if (state.value.playbackUrl && state.value.connectionState === 'ready') {
        attachStream(state.value.playbackUrl);
      }
    } else {
      cleanupProgressTimer();
    }
  }

  function buildQualityLabel(level: Level, index: number) {
    if (level.name && level.name.length > 0) {
      return level.name;
    }
    const resolution =
      level.height && level.width ? `${level.height}p` : `Level ${index + 1}`;
    const bitrate = level.bitrate ? `${Math.round(level.bitrate / 1000)} kbps` : '';
    return bitrate ? `${resolution} · ${bitrate}` : resolution;
  }

  function updateQualityOptions(levels: Level[]) {
    const options: QualityOption[] = [
      { id: -1, label: 'Auto', isAuto: true },
      ...levels.map((level, idx) => ({
        id: idx,
        label: buildQualityLabel(level, idx),
        width: level.width,
        height: level.height,
        bitrate: level.bitrate,
      })),
    ];
    qualities.value = options;
  }

  function bindHlsEvents(instance: Hls) {
    instance.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      updateQualityOptions(data.levels);
      state.value.isBuffering = false;
      state.value.connectionState = 'ready';
      state.value.error = null;
      if (videoElement && videoElement.paused) {
        videoElement.play().catch(() => {});
      }
    });

    instance.on(Hls.Events.LEVEL_LOADED, (_, data) => {
      const { totalduration, live } = data.details;
      if (Number.isFinite(totalduration)) {
        state.value.duration = totalduration;
        state.value.dvrWindowSeconds = totalduration;
      }
      state.value.isLive = Boolean(live);
      updateMetricsFromVideo();
    });

    instance.on(Hls.Events.FRAG_BUFFERED, () => {
      state.value.isBuffering = false;
    });

    instance.on(Hls.Events.ERROR, (_, data) => {
      if (!hls) return;
      const { fatal, type, details } = data;
      console.warn('[KickViewer] HLS error:', type, details);
      if (fatal) {
        switch (type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            state.value.connectionState = 'error';
            state.value.error = `Playback error: ${details}`;
            destroyHls();
            break;
        }
      }
    });
  }

  function attachStream(playbackUrl: string) {
    if (!videoElement) {
      throw new Error('Video element not set');
    }

    destroyHls();

    state.value.isBuffering = true;
    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        liveSyncDurationCount: 4,
        backBufferLength: 300,
      });
      bindHlsEvents(hls);
      hls.loadSource(playbackUrl);
      hls.attachMedia(videoElement);
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = playbackUrl;
      videoElement.load();
      videoElement.play().catch(() => {});
      state.value.connectionState = 'ready';
      state.value.isBuffering = false;
    } else {
      state.value.connectionState = 'error';
      state.value.error = 'HLS playback is not supported in this browser.';
    }
  }

  async function connect(channelSlug: string) {
    if (!videoElement) {
      throw new Error('Video element not set');
    }

    state.value.connectionState = 'connecting';
    state.value.error = null;
    state.value.channelSlug = channelSlug;
    state.value.isBuffering = true;

    try {
      const status = await checkKickLivestream(channelSlug);
      if (!status.isLive) {
        throw new Error('Channel is currently offline');
      }

      metadata.value = status;
      state.value.title = status.title || null;
      state.value.viewerCount = status.viewerCount ?? null;
      state.value.startedAt = status.startedAt || null;
      state.value.language = status.language || null;
      state.value.isLive = status.isLive;

      const playbackUrl = status.playbackUrl || (await getKickStreamUrl(channelSlug));
      state.value.playbackUrl = playbackUrl;

      attachStream(playbackUrl);
      startProgressTimer();
    } catch (error) {
      state.value.connectionState = 'error';
      state.value.error =
        error instanceof Error ? error.message : 'Failed to start Kick stream';
      destroyHls();
      cleanupProgressTimer();
      throw error;
    }
  }

  function disconnect() {
    destroyHls();
    cleanupProgressTimer();
    if (videoElement) {
      videoElement.removeAttribute('src');
      videoElement.load();
    }
    resetState();
  }

  function play() {
    if (!videoElement) return;
    videoElement
      .play()
      .then(() => {
        state.value.isPlaying = true;
      })
      .catch(() => {
        state.value.isPlaying = false;
      });
  }

  function pause() {
    if (!videoElement) return;
    videoElement.pause();
    state.value.isPlaying = false;
  }

  function togglePlayPause() {
    if (state.value.isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function setVolume(volume: number) {
    const clamped = Math.min(Math.max(volume, 0), 1);
    state.value.volume = clamped;
    if (videoElement) {
      videoElement.volume = clamped;
      state.value.isMuted = clamped === 0;
      if (clamped > 0) {
        videoElement.muted = false;
        state.value.isMuted = false;
      }
    }
    try {
      localStorage.setItem(LOCAL_STORAGE_VOLUME_KEY, String(clamped));
    } catch {
      // ignore
    }
  }

  function toggleMute() {
    const nextMuted = !state.value.isMuted;
    state.value.isMuted = nextMuted;
    if (videoElement) {
      videoElement.muted = nextMuted;
      if (!nextMuted && state.value.volume === 0) {
        setVolume(0.5);
      }
    }
    try {
      localStorage.setItem(LOCAL_STORAGE_MUTED_KEY, String(nextMuted));
    } catch {
      // ignore
    }
  }

  function seek(seconds: number) {
    if (!videoElement) return;
    const durationReference =
      state.value.duration > 0 ? state.value.duration : state.value.dvrWindowSeconds;
    const clamped = Math.min(Math.max(seconds, 0), durationReference);
    videoElement.currentTime = clamped;
    state.value.isAtLiveEdge = Math.abs(durationReference - clamped) <= LIVE_EDGE_THRESHOLD_SECONDS;
  }

  function seekToLive() {
    const durationReference =
      state.value.duration > 0 ? state.value.duration : state.value.dvrWindowSeconds;
    if (durationReference > 0) {
      seek(Math.max(durationReference - 0.5, 0));
    }
  }

  async function refreshMetadata() {
    if (!state.value.channelSlug) return null;
    try {
      const status = await checkKickLivestream(state.value.channelSlug);
      metadata.value = status;
      state.value.viewerCount = status.viewerCount ?? state.value.viewerCount;
      state.value.title = status.title || state.value.title;
      return status;
    } catch (error) {
      console.warn('[KickViewer] Failed to refresh metadata', error);
      return null;
    }
  }

  function selectQuality(optionId: number | 'auto') {
    selectedQuality.value = optionId;
    if (!hls) return;
    if (optionId === 'auto' || optionId === -1) {
      hls.currentLevel = -1;
      hls.loadLevel = -1;
    } else {
      hls.currentLevel = optionId;
      hls.loadLevel = optionId;
    }
  }

  const qualityLabel = computed(() => {
    const match = qualities.value.find((quality) => quality.id === selectedQuality.value);
    return match?.label ?? 'Auto';
  });

  onUnmounted(() => {
    disconnect();
    detachVideoEvents();
  });

  return {
    state,
    metadata: computed(() => metadata.value),
    qualities: computed(() => qualities.value),
    selectedQuality: computed(() => selectedQuality.value),
    qualityLabel,
    connect,
    disconnect,
    setVideoElement,
    play,
    pause,
    togglePlayPause,
    setVolume,
    toggleMute,
    seek,
    seekToLive,
    refreshMetadata,
    selectQuality,
  };
}
