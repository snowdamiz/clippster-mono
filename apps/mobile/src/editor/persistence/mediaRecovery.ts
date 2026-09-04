import type { MediaAssetRef, MobileEditProjectV3 } from '../model/schema';

export interface MediaProbeResult {
  exists: boolean;
  fingerprint?: string;
}

export interface MissingMedia {
  asset: MediaAssetRef;
  reason: 'missing' | 'changed';
}

export type MediaProbe = (asset: MediaAssetRef) => Promise<MediaProbeResult>;

export async function findUnavailableMedia(
  document: MobileEditProjectV3,
  probe: MediaProbe,
): Promise<MissingMedia[]> {
  const results = await Promise.all(
    Object.values(document.assets).map(async (asset): Promise<MissingMedia | null> => {
      const result = await probe(asset);
      if (!result.exists) return { asset, reason: 'missing' };
      const comparable = !asset.sourceFingerprint.startsWith('legacy-uri:');
      if (comparable && result.fingerprint && result.fingerprint !== asset.sourceFingerprint) {
        return { asset, reason: 'changed' };
      }
      return null;
    }),
  );
  return results.filter((result): result is MissingMedia => result != null);
}
