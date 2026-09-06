import * as FileSystem from 'expo-file-system/legacy';

import {
  decideEditorProxy,
  type EditorDeviceProfile,
} from '../performance/mediaPolicy';
import type { MediaDerivativeRef } from '../model/schema';

const PROXY_DIR = `${FileSystem.documentDirectory}editor-media/proxies/`;

async function ensureProxyDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(PROXY_DIR, { intermediates: true });
}

function deviceProfile(): EditorDeviceProfile {
  // Conservative default until we wire ReactNativeDeviceInfo memory class.
  return { memoryClass: 'mid', hardwareDecode: true };
}

/**
 * Build a lower-res preview proxy when mediaPolicy says the source is too heavy.
 * Native generateProxy is currently a copy stub — FFmpeg does the real scale.
 */
export async function prepareEditorProxy(
  sourceUri: string,
): Promise<MediaDerivativeRef | undefined> {
  if (!sourceUri || sourceUri.startsWith('pending://') || sourceUri.startsWith('http')) {
    return undefined;
  }

  let width = 0;
  let height = 0;
  let codec = 'h264';
  try {
    const { getNativeEditorModule, isNativeEditorAvailable } = await import(
      '@clippster/editor-native'
    );
    if (!isNativeEditorAvailable()) return undefined;
    const native = getNativeEditorModule();
    if (!native) return undefined;
    const probe = await native.probeMedia(sourceUri);
    width = Number(probe.width) || 0;
    height = Number(probe.height) || 0;
    codec = String(probe.videoCodec || 'h264');
  } catch (error) {
    console.warn('[EditorProxy] probe failed', error);
    return undefined;
  }
  if (width <= 0 || height <= 0) return undefined;

  const decision = decideEditorProxy(
    { width, height, fps: 30, codec },
    deviceProfile(),
  );
  if (!decision.required) return undefined;

  const { isFfmpegAvailable, runFfmpeg } = await import('@/services/ffmpeg');
  if (!(await isFfmpegAvailable())) return undefined;

  await ensureProxyDir();
  const stamp = Date.now();
  const dest = `${PROXY_DIR}proxy_${stamp}_${decision.height}.mp4`;
  const input = sourceUri.replace(/^file:\/\//, '');
  const output = dest.replace(/^file:\/\//, '');

  try {
    await runFfmpeg([
      '-y',
      '-i',
      input,
      '-vf',
      `scale=-2:${decision.height}`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-an',
      '-movflags',
      '+faststart',
      output,
    ]);
    const info = await FileSystem.getInfoAsync(dest);
    if (!info.exists) return undefined;
    return {
      uri: dest,
      width: Math.round((width / height) * decision.height),
      height: decision.height,
      createdAt: stamp,
    };
  } catch (error) {
    console.warn('[EditorProxy] scale failed', error);
    return undefined;
  }
}
