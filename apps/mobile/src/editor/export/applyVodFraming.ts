import type { ManualFramingConfig, TargetAspectRatio } from '@clippster/shared-types';

import {
  type MobileEditProjectV3,
  type OverlayTrack,
  type Transform,
  type VideoTrack,
} from '../model/schema';

const FULL_CROP = { x: 0, y: 0, width: 1, height: 1 };

function transformForUse169(
  framing: ManualFramingConfig,
): Transform {
  const source = framing.sourceTransform ?? { scale: 1, x: 0, y: 0 };
  return {
    positionX: 0.5 + source.x,
    positionY: 0.5 + source.y,
    scaleX: source.scale,
    scaleY: source.scale,
    rotationDeg: 0,
    anchorX: 0.5,
    anchorY: 0.5,
    fit: 'contain',
  };
}

/**
 * Converts the persisted desktop-compatible Use 16:9 framing mode into native
 * editor layers for a 9:16 export: blurred cover background + sharp 16:9 plate.
 */
export function applyVodFramingForExport(
  document: MobileEditProjectV3,
  ratio: TargetAspectRatio,
  framing: ManualFramingConfig | null | undefined,
): MobileEditProjectV3 {
  if (ratio !== '9:16' || framing?.sourceFrameMode !== 'use16x9') return document;

  const videoIndex = document.tracks.findIndex((track) => track.kind === 'video');
  if (videoIndex < 0) return document;
  const videoTrack = document.tracks[videoIndex] as VideoTrack;
  const blurIntensity = framing.blurEnabled
    ? Math.max(0, Math.min(100, ((framing.blurAmount ?? 12) / 30) * 100))
    : 0;
  const sharpTransform = transformForUse169(framing);

  const backgroundTrack: VideoTrack = {
    ...videoTrack,
    items: videoTrack.items.map((item) => ({
      ...item,
      transform: {
        base: { ...item.transform.base },
        overrides: {
          ...item.transform.overrides,
          '9:16': {
            positionX: 0.5,
            positionY: 0.5,
            scaleX: 1.08,
            scaleY: 1.08,
            rotationDeg: 0,
            anchorX: 0.5,
            anchorY: 0.5,
            fit: 'cover',
          },
        },
      },
      effectStack:
        blurIntensity > 0
          ? [...item.effectStack, { type: 'blur' as const, intensity: blurIntensity }]
          : item.effectStack,
    })),
  };

  const sharpTrack: OverlayTrack = {
    id: `${videoTrack.id}__use169_sharp`,
    kind: 'overlay',
    items: videoTrack.items.map((item) => ({
      id: `${item.id}__use169_sharp`,
      kind: 'overlay',
      assetId: item.assetId,
      timelineStart: item.timelineStart,
      timelineEnd: item.timelineEnd,
      sourceStart: item.sourceStart,
      sourceEnd: item.sourceEnd,
      speed: item.speed,
      volume: 0,
      opacity: 1,
      crop: FULL_CROP,
      transform: {
        base: sharpTransform,
        overrides: { '9:16': sharpTransform },
      },
      effectStack: item.effectStack.map((effect) => ({ ...effect })),
    })),
  };

  const tracks = [...document.tracks];
  tracks.splice(videoIndex, 1, backgroundTrack, sharpTrack);
  return {
    ...document,
    canvas: { ...document.canvas, activeRatio: ratio },
    tracks,
  };
}
