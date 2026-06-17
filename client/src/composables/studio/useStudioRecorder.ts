import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type {
  StudioDevice,
  StudioRecordingConfig,
  StudioRecordingResult,
  StudioAspectRatio,
  StudioRecordingMode,
  StudioRect,
  StudioWatermarkConfig,
  StudioBackgroundSourceType,
  StudioMediaSource,
} from '@/types/studio';
import { STUDIO_ASPECT_PRESETS, DEFAULT_CAMERA_PIP } from '@/types/studio';

export function useStudioRecorder() {
  const devices = ref<StudioDevice[]>([]);
  const loadingDevices = ref(false);
  const isRecording = ref(false);
  const elapsedSeconds = ref(0);
  const finalizing = ref(false);
  const error = ref<string | null>(null);

  const mode = ref<StudioRecordingMode>('screen_camera');
  const aspectRatio = ref<StudioAspectRatio>('16:9');
  const cameraDeviceId = ref<string | null>(null);
  const microphoneDeviceId = ref<string | null>(null);
  const displayId = ref<string | null>('desktop');
  const includeSystemAudio = ref(false);
  const hideCursor = ref(true);
  const micVolume = ref(100);
  const shareAudioVolume = ref(100);
  const sourceRect = ref<StudioRect>({ x: 0, y: 0, width: 1, height: 1 });
  const cameraPip = ref<StudioRect>({ ...DEFAULT_CAMERA_PIP });
  const watermarkRect = ref<StudioRect | null>(null);
  const watermarkPath = ref<string | null>(null);
  const watermarkOpacity = ref(0.8);
  const backgroundSourceType = ref<StudioBackgroundSourceType>('none');
  const mediaSource = ref<StudioMediaSource | null>(null);

  const cameras = computed(() => devices.value.filter((d) => d.kind === 'camera'));
  const microphones = computed(() => devices.value.filter((d) => d.kind === 'microphone'));
  const displays = computed(() => devices.value.filter((d) => d.kind === 'display'));

  const outputDimensions = computed(() => STUDIO_ASPECT_PRESETS[aspectRatio.value]);

  async function requestMediaPermissions() {
    if (!navigator.mediaDevices?.getUserMedia) return false;

    const streams: MediaStream[] = [];
    const permissionErrors: string[] = [];

    try {
      streams.push(await navigator.mediaDevices.getUserMedia({ video: true, audio: true }));
    } catch {
      for (const constraints of [{ video: true }, { audio: true }] as MediaStreamConstraints[]) {
        try {
          streams.push(await navigator.mediaDevices.getUserMedia(constraints));
        } catch (err) {
          permissionErrors.push(String(err));
        }
      }
    }

    streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));

    if (permissionErrors.length === 2) {
      throw new Error(
        'Camera and microphone permissions are blocked. Allow access in Windows privacy settings, then refresh devices.'
      );
    }

    return streams.length > 0;
  }

  async function listBrowserDevices(): Promise<StudioDevice[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];

    const browserDevices = await navigator.mediaDevices.enumerateDevices();
    return browserDevices
      .filter((device) => device.kind === 'videoinput' || device.kind === 'audioinput')
      .map((device, index) => {
        const isCamera = device.kind === 'videoinput';
        const label = device.label || `${isCamera ? 'Camera' : 'Microphone'} ${index + 1}`;
        return {
          id: `${isCamera ? 'video' : 'audio'}=${label}`,
          label,
          kind: isCamera ? 'camera' : 'microphone',
          browserDeviceId: device.deviceId,
        } satisfies StudioDevice;
      });
  }

  function mergeDevices(backendDevices: StudioDevice[], browserDevices: StudioDevice[]) {
    const result = [...backendDevices];
    const hasBackendCamera = backendDevices.some((device) => device.kind === 'camera');
    const hasBackendMicrophone = backendDevices.some((device) => device.kind === 'microphone');
    const existingIds = new Set(result.map((device) => device.id));

    for (const device of browserDevices) {
      const shouldUseFallback =
        (device.kind === 'camera' && !hasBackendCamera) ||
        (device.kind === 'microphone' && !hasBackendMicrophone);

      if (shouldUseFallback && !existingIds.has(device.id)) {
        result.push(device);
        existingIds.add(device.id);
      }
    }

    return result;
  }

  async function loadDevices() {
    loadingDevices.value = true;
    error.value = null;
    try {
      let permissionError: string | null = null;
      try {
        await requestMediaPermissions();
      } catch (err) {
        permissionError = String(err);
      }

      const backendDevices = await invoke<StudioDevice[]>('studio_list_devices');
      const browserDevices = await listBrowserDevices();
      console.log('[StudioRecorder] Devices from backend:', backendDevices);
      console.log('[StudioRecorder] Devices from browser:', browserDevices);
      devices.value = mergeDevices(backendDevices, browserDevices);

      console.log('[StudioRecorder] Cameras:', cameras.value);
      console.log('[StudioRecorder] Microphones:', microphones.value);

      if (!cameraDeviceId.value && cameras.value[0]) {
        cameraDeviceId.value = cameras.value[0].id;
      }
      if (!microphoneDeviceId.value && microphones.value[0]) {
        microphoneDeviceId.value = microphones.value[0].id;
      }
      if (permissionError && cameras.value.length === 0 && microphones.value.length === 0) {
        error.value = permissionError;
      }
    } catch (err) {
      error.value = String(err);
    } finally {
      loadingDevices.value = false;
    }
  }

  function clearMediaSource() {
    mediaSource.value = null;
    if (backgroundSourceType.value === 'media') {
      backgroundSourceType.value = 'none';
    }
  }

  function setMediaSource(path: string, label: string) {
    mediaSource.value = { path, label };
    backgroundSourceType.value = 'media';
    displayId.value = null;
    includeSystemAudio.value = false;
  }

  function setDisplayBackground() {
    mediaSource.value = null;
    backgroundSourceType.value = 'display';
  }

  function buildConfig(): StudioRecordingConfig {
    const preset = STUDIO_ASPECT_PRESETS[aspectRatio.value];
    let watermark: StudioWatermarkConfig | null = null;
    if (watermarkPath.value && watermarkRect.value) {
      watermark = {
        path: watermarkPath.value,
        x: watermarkRect.value.x,
        y: watermarkRect.value.y,
        width: watermarkRect.value.width,
        height: watermarkRect.value.height,
        opacity: watermarkOpacity.value,
      };
    }

    const resolvedDisplayId = displayId.value === 'browser-screen' ? 'desktop' : displayId.value;

    return {
      mode: mode.value,
      aspectRatio: aspectRatio.value,
      width: preset.width,
      height: preset.height,
      fps: 30,
      cameraDeviceId: mode.value === 'screen' ? null : cameraDeviceId.value,
      microphoneDeviceId: microphoneDeviceId.value,
      displayId: mode.value === 'camera' ? null : resolvedDisplayId,
      includeSystemAudio: includeSystemAudio.value,
      hideCursor: hideCursor.value,
      micVolume: micVolume.value / 100,
      shareAudioVolume: shareAudioVolume.value / 100,
      cameraPip: mode.value === 'screen_camera' ? cameraPip.value : null,
      watermark,
    };
  }

  async function finalizeWithIntroOutro(
    recordingPath: string,
    introPath?: string | null,
    outroPath?: string | null
  ): Promise<string> {
    finalizing.value = true;
    try {
      const finalPath = await invoke<string>('studio_finalize_recording', {
        config: {
          recordingPath,
          introPath: introPath || null,
          outroPath: outroPath || null,
        },
      });
      return finalPath;
    } finally {
      finalizing.value = false;
    }
  }

  return {
    devices,
    loadingDevices,
    isRecording,
    elapsedSeconds,
    finalizing,
    error,
    mode,
    aspectRatio,
    cameraDeviceId,
    microphoneDeviceId,
    displayId,
    includeSystemAudio,
    hideCursor,
    micVolume,
    shareAudioVolume,
    sourceRect,
    cameraPip,
    watermarkRect,
    watermarkPath,
    watermarkOpacity,
    backgroundSourceType,
    mediaSource,
    cameras,
    microphones,
    displays,
    outputDimensions,
    requestMediaPermissions,
    loadDevices,
    setMediaSource,
    clearMediaSource,
    setDisplayBackground,
    finalizeWithIntroOutro,
    buildConfig,
  };
}
