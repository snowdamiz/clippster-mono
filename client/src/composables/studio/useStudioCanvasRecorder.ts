import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { StudioRecordingResult } from '@/types/studio';

export interface StudioCanvasRecorderOptions {
  canvas: HTMLCanvasElement;
  fps: number;
  width: number;
  height: number;
  micDeviceId: string | null;
  micVolume: number;
  shareAudioVolume: number;
  displayStream: MediaStream | null;
  mediaVideo: HTMLVideoElement | null;
  onDraw: () => void;
}

export function useStudioCanvasRecorder() {
  const isRecording = ref(false);
  const elapsedSeconds = ref(0);

  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let animationFrameId: number | null = null;
  let audioContext: AudioContext | null = null;
  let micGainNode: GainNode | null = null;
  let shareGainNode: GainNode | null = null;
  let micStream: MediaStream | null = null;

  function stopDrawLoop() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function startDrawLoop(onDraw: () => void) {
    stopDrawLoop();
    const loop = () => {
      onDraw();
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function cleanupAudio() {
    micStream?.getTracks().forEach((track) => track.stop());
    micStream = null;
    micGainNode = null;
    shareGainNode = null;
    if (audioContext) {
      audioContext.close().catch(() => undefined);
      audioContext = null;
    }
  }

  function setMicVolume(volume: number) {
    if (micGainNode) micGainNode.gain.value = volume / 100;
  }

  function setShareAudioVolume(volume: number) {
    if (shareGainNode) shareGainNode.gain.value = volume / 100;
  }

  function pickMimeType(): string {
    const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? 'video/webm';
  }

  function connectShareAudio(
    ctx: AudioContext,
    destination: MediaStreamAudioDestinationNode,
    displayStream: MediaStream | null,
    mediaVideo: HTMLVideoElement | null,
    shareAudioVolume: number
  ) {
    const shareGain = ctx.createGain();
    shareGain.gain.value = shareAudioVolume / 100;
    shareGain.connect(destination);
    shareGainNode = shareGain;

    if (displayStream?.getAudioTracks().length) {
      const shareSource = ctx.createMediaStreamSource(displayStream);
      shareSource.connect(shareGain);
      return;
    }

    if (mediaVideo && typeof (mediaVideo as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream === 'function') {
      try {
        const mediaStream = (mediaVideo as HTMLVideoElement & { captureStream: () => MediaStream }).captureStream();
        if (mediaStream.getAudioTracks().length) {
          const mediaSource = ctx.createMediaStreamSource(mediaStream);
          mediaSource.connect(shareGain);
        }
      } catch {
        // Media element may not expose audio via captureStream.
      }
    }
  }

  async function start(options: StudioCanvasRecorderOptions): Promise<void> {
    if (isRecording.value) return;

    options.canvas.width = options.width;
    options.canvas.height = options.height;

    startDrawLoop(options.onDraw);

    const videoStream = options.canvas.captureStream(options.fps);
    audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

    if (options.micDeviceId) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: options.micDeviceId } },
        });
        const micSource = audioContext.createMediaStreamSource(micStream);
        micGainNode = audioContext.createGain();
        micGainNode.gain.value = options.micVolume / 100;
        micSource.connect(micGainNode);
        micGainNode.connect(destination);
      } catch (err) {
        console.warn('[StudioCanvasRecorder] Mic capture failed:', err);
      }
    }

    connectShareAudio(
      audioContext,
      destination,
      options.displayStream,
      options.mediaVideo,
      options.shareAudioVolume
    );

    if (destination.stream.getAudioTracks().length) {
      tracks.push(...destination.stream.getAudioTracks());
    }

    const combined = new MediaStream(tracks);
    const mimeType = pickMimeType();
    mediaRecorder = new MediaRecorder(combined, { mimeType });
    chunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    mediaRecorder.start(1000);
    isRecording.value = true;
    elapsedSeconds.value = 0;
    timerInterval = setInterval(() => {
      elapsedSeconds.value += 1;
    }, 1000);
  }

  async function stop(): Promise<StudioRecordingResult | null> {
    if (!isRecording.value || !mediaRecorder) return null;

    stopTimer();
    isRecording.value = false;

    const recorder = mediaRecorder;
    mediaRecorder = null;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      if (recorder.state !== 'inactive') recorder.stop();
      else resolve();
    });

    stopDrawLoop();
    cleanupAudio();

    const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
    chunks = [];

    const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
    const result = await invoke<StudioRecordingResult>('studio_save_recording', { bytes });
    return result;
  }

  function dispose() {
    stopTimer();
    stopDrawLoop();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    mediaRecorder = null;
    chunks = [];
    isRecording.value = false;
    cleanupAudio();
  }

  return {
    isRecording,
    elapsedSeconds,
    start,
    stop,
    dispose,
    setMicVolume,
    setShareAudioVolume,
  };
}
