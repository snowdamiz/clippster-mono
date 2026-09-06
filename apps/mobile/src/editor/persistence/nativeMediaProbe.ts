import * as FileSystem from 'expo-file-system/legacy';

import type { MediaAssetRef } from '../model/schema';
import type { MediaProbeResult } from './mediaRecovery';

function fileUri(uri: string): string {
  if (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://')
  ) {
    return uri;
  }
  return `file://${uri}`;
}

export async function fingerprintMediaUri(uri: string): Promise<string> {
  if (uri.startsWith('http://') || uri.startsWith('https://')) return `remote:${uri}`;
  const info = await FileSystem.getInfoAsync(fileUri(uri));
  if (!info.exists) throw new Error(`Media is missing: ${uri}`);
  const size = 'size' in info ? info.size : 0;
  const modified = 'modificationTime' in info ? info.modificationTime : 0;
  return `local:${size}:${modified}`;
}

export async function probeNativeMedia(asset: MediaAssetRef): Promise<MediaProbeResult> {
  if (asset.sourceUri.startsWith('http://') || asset.sourceUri.startsWith('https://')) {
    return { exists: true, fingerprint: asset.sourceFingerprint };
  }
  const info = await FileSystem.getInfoAsync(fileUri(asset.sourceUri));
  if (!info.exists) return { exists: false };
  const size = 'size' in info ? info.size : 0;
  const modified = 'modificationTime' in info ? info.modificationTime : 0;
  return { exists: true, fingerprint: `local:${size}:${modified}` };
}
