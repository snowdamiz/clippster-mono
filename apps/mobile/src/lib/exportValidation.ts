export interface MediaProbeMetadata {
  width: number;
  height: number;
  duration: number;
  videoCodec: string;
  audioCodec: string | null;
}

export function validateExportMetadata(
  metadata: MediaProbeMetadata,
  expected: {
    width: number;
    height: number;
    duration: number;
    frameTolerance: number;
    requireAudio?: boolean;
  },
): void {
  if (metadata.width !== expected.width || metadata.height !== expected.height) {
    throw new Error(
      `Export dimensions are ${metadata.width}x${metadata.height}; expected ${expected.width}x${expected.height}`,
    );
  }
  if (metadata.videoCodec !== 'h264') {
    throw new Error(`Export video codec is ${metadata.videoCodec}; expected H.264`);
  }
  if ((expected.requireAudio ?? true) && metadata.audioCodec !== 'aac') {
    throw new Error(`Export audio codec is ${metadata.audioCodec ?? 'missing'}; expected AAC`);
  }
  if (!(expected.requireAudio ?? true) && metadata.audioCodec && metadata.audioCodec !== 'aac') {
    throw new Error(`Export audio codec is ${metadata.audioCodec}; expected AAC when audio is present`);
  }
  if (Math.abs(metadata.duration - expected.duration) > expected.frameTolerance) {
    throw new Error('Export duration is outside the one-frame tolerance');
  }
}
