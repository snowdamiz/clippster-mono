/**
 * Rewrite desktop libx264 export plans for mobile LGPL encoders.
 * Kept free of react-native imports so unit tests can run in Node.
 */

export type MobileVideoCodec = 'h264_mediacodec' | 'h264_videotoolbox' | 'mpeg4';

const HW_CODECS = new Set<MobileVideoCodec>(['h264_mediacodec', 'h264_videotoolbox']);

export function preferredMobileVideoCodec(platform: string): MobileVideoCodec {
  return platform === 'ios' ? 'h264_videotoolbox' : 'h264_mediacodec';
}

export function adaptArgsForMobileEncoders(
  args: string[],
  codec: MobileVideoCodec = 'h264_mediacodec',
): string[] {
  const out: string[] = [];
  let replacedVideoCodec = false;
  let hasVideoBitrate = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '-c:v' || arg === '-vcodec') && i + 1 < args.length) {
      const value = args[i + 1];
      out.push(arg);
      if (
        value === 'libx264' ||
        value === 'h264_mediacodec' ||
        value === 'h264_videotoolbox' ||
        value === 'mpeg4'
      ) {
        out.push(codec);
        replacedVideoCodec = true;
      } else {
        out.push(value);
      }
      i += 1;
      continue;
    }
    if (arg === '-preset' && i + 1 < args.length) {
      i += 1;
      continue;
    }
    if (arg === '-crf' && i + 1 < args.length) {
      i += 1;
      continue;
    }
    if ((arg === '-b:v' || arg === '-q:v') && i + 1 < args.length) {
      hasVideoBitrate = true;
      out.push(arg, args[i + 1]);
      i += 1;
      continue;
    }
    out.push(arg);
  }

  if (replacedVideoCodec && !hasVideoBitrate) {
    const yIndex = out.lastIndexOf('-y');
    const insertAt = yIndex >= 0 ? yIndex : out.length - 1;
    const bitrateArgs =
      codec === 'mpeg4' ? ['-q:v', '5'] : ['-b:v', '4M', '-pix_fmt', 'yuv420p'];
    out.splice(insertAt, 0, ...bitrateArgs);
  }

  return out;
}

/** Drop -vf / -filter_complex / -filter:v entries that burn ASS captions (libass often absent). */
export function stripAssFilters(args: string[]): string[] | null {
  let changed = false;
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (
      (arg === '-vf' || arg === '-filter_complex' || arg === '-filter:v') &&
      i + 1 < args.length
    ) {
      const filter = args[i + 1];
      if (/\bass\s*=/.test(filter)) {
        changed = true;
        i += 1;
        continue;
      }
    }
    out.push(arg);
  }
  return changed ? out : null;
}

export function isHardwareMobileCodec(codec: string): boolean {
  return HW_CODECS.has(codec as MobileVideoCodec);
}
