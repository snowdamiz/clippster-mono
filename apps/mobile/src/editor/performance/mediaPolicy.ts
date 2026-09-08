export const EDITOR_CACHE_POLICY = {
  maxThumbnailFramesInMemory: 96,
  maxActiveThumbnailPlayers: 2,
  proxyDiskBudgetBytes: 1_500_000_000,
  thumbnailDiskBudgetBytes: 128_000_000,
} as const;

export interface EditorSourceProfile {
  width: number;
  height: number;
  fps: number;
  bitrate?: number;
  codec?: string;
  keyframeIntervalSeconds?: number;
}

export interface EditorDeviceProfile {
  memoryClass: 'low' | 'mid' | 'high';
  hardwareDecode: boolean;
}

export interface EditorProxyDecision {
  required: boolean;
  height: 540 | 720;
  reason: string;
}

export function decideEditorProxy(
  source: EditorSourceProfile,
  device: EditorDeviceProfile,
): EditorProxyDecision {
  const highResolution = source.width > 1920 || source.height > 1080;
  const highFrameRate = source.fps > 30;
  const highBitrate = (source.bitrate ?? 0) > 20_000_000;
  const longGop = (source.keyframeIntervalSeconds ?? 0) > 2;
  const unsupportedDecode =
    !device.hardwareDecode ||
    Boolean(source.codec && !['h264', 'hevc', 'h265'].includes(source.codec.toLowerCase()));
  const required =
    unsupportedDecode ||
    highResolution ||
    highFrameRate ||
    highBitrate ||
    longGop ||
    (device.memoryClass === 'low' && (source.width > 1280 || source.fps > 30));
  const reasons = [
    unsupportedDecode ? 'decoder' : null,
    highResolution ? 'resolution' : null,
    highFrameRate ? 'frame rate' : null,
    highBitrate ? 'bitrate' : null,
    longGop ? 'keyframe spacing' : null,
    device.memoryClass === 'low' ? 'device memory' : null,
  ].filter((reason): reason is string => Boolean(reason));
  return {
    required,
    height: device.memoryClass === 'low' ? 540 : 720,
    reason: required ? reasons.join(', ') : 'source playback is within measured thresholds',
  };
}
