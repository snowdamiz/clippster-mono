import {
  createDefaultRatioAwareTransform,
  type MediaAssetRef,
  type MobileEditProjectV3,
  type VideoTrack
} from '../model/schema'

/** Keep captions, audio and overlays above a fully composed framing source. */
export function framedExportDocument(
  document: MobileEditProjectV3,
  uri: string,
  durationTicks: number
): MobileEditProjectV3 {
  const asset: MediaAssetRef = {
    id: document.id + '__framed_asset',
    kind: 'video',
    sourceKind: 'upload',
    sourceUri: uri,
    sourceFingerprint: uri,
    durationTicks,
    width: 1080,
    height: 1920,
    hasAudio: true
  }
  return {
    ...document,
    canvas: { ...document.canvas, activeRatio: '9:16' },
    assets: { ...document.assets, [asset.id]: asset },
    tracks: document.tracks.map((track) =>
      track.kind !== 'video'
        ? track
        : ({
            ...track,
            transitions: [],
            items: [
              {
                id: track.id + '__framed_video',
                kind: 'video',
                assetId: asset.id,
                sourceStart: 0,
                sourceEnd: durationTicks,
                timelineStart: 0,
                timelineEnd: durationTicks,
                speed: 1,
                volume: 1,
                pitchPolicy: 'preserve',
                transform: createDefaultRatioAwareTransform(),
                effectStack: [],
                label: 'Framed source'
              }
            ]
          } satisfies VideoTrack)
    )
  }
}
