import { placeShots } from '../compiler/compile';
import { findSceneText } from './sceneText';
import { documentDuration } from './validate';
import type { EditDocument, MediaItem } from '../types';
import { trimSceneLayer } from './layerTiming';
import type { SceneInventory } from './sceneLayers';

export interface BlockTiming {
  id: string;
  start: number;
  duration: number;
  linked: boolean;
  shot: boolean;
}
export function blockTiming(
  document: EditDocument,
  id: string | null,
  files: Record<string, string> = {}
): BlockTiming | null {
  const field = findSceneText(document, id, files);
  const index = document.shots.findIndex((shot) => shot.id === (field?.shotId ?? id));
  if (index >= 0)
    return {
      id: document.shots[index].id,
      start: placeShots(document)[index].start,
      duration: document.shots[index].duration,
      linked: !!field,
      shot: true,
    };
  const overlay = document.overlays.find((overlay) => overlay.id === id);
  return overlay
    ? {
        id: overlay.id,
        start: overlay.start,
        duration: overlay.duration,
        linked: false,
        shot: false,
      }
    : null;
}

/** Frame-aligned ripple trimming. Later shots and overlays move with the cut; footage never exceeds its source. */
export function trimBlock(
  document: EditDocument,
  id: string,
  edge: 'start' | 'end',
  delta: number,
  media: MediaItem[],
  maxSeconds: number,
  files: Record<string, string> = {},
  inventories: SceneInventory[] = []
): EditDocument {
  if (id.startsWith('layer:')) return trimSceneLayer(document, id, edge, delta, inventories);
  if (!Number.isFinite(delta)) return document;
  const timing = blockTiming(document, id, files);
  if (!timing) return document;
  const fps = document.format.fps;
  const snap = (n: number) => Math.round(n * fps) / fps;
  const minimum = Math.ceil(0.1 * fps) / fps;
  if (!timing.shot) {
    const start =
      edge === 'start'
        ? Math.max(
            0,
            Math.min(timing.start + timing.duration - minimum, snap(timing.start + delta))
          )
        : timing.start;
    const end =
      edge === 'end'
        ? Math.max(
            start + minimum,
            Math.min(documentDuration(document), snap(timing.start + timing.duration + delta))
          )
        : timing.start + timing.duration;
    if (start === timing.start && end - start === timing.duration) return document;
    return {
      ...document,
      overlays: document.overlays.map((overlay) =>
        overlay.id === timing.id ? { ...overlay, start, duration: snap(end - start) } : overlay
      ),
    };
  }
  const shot = document.shots.find((shot) => shot.id === timing.id)!;
  const source = media.find((item) => item.id === shot.mediaId);
  const footage = !!source && source.kind === 'video';
  const oldEnd = timing.start + timing.duration;
  let duration = shot.duration + (edge === 'end' ? delta : -delta);
  const maximum = Math.max(minimum, maxSeconds - documentDuration(document) + shot.duration);
  let sourceIn = shot.sourceIn;
  if (footage && edge === 'start') {
    const requested = snap(delta);
    const trim = Math.max(-sourceIn / shot.speed, Math.min(shot.duration - minimum, requested));
    duration = shot.duration - trim;
  }
  duration = Math.max(
    minimum,
    Math.min(
      maximum,
      footage
        ? edge === 'end'
          ? (source!.duration - sourceIn) / shot.speed
          : (shot.sourceIn + shot.duration * shot.speed) / shot.speed
        : Infinity,
      snap(duration)
    )
  );
  duration = Math.floor((duration + 1e-9) * fps) / fps;
  if (footage && edge === 'start')
    sourceIn = Math.max(0, shot.sourceIn + (shot.duration - duration) * shot.speed);
  if (Math.abs(duration - shot.duration) < 1e-8) return document;
  const shift = snap(duration - shot.duration);
  const total = snap(documentDuration(document) + shift);
  const overlays = document.overlays
    .map((overlay) => {
      if (overlay.start >= oldEnd - 1e-6) return { ...overlay, start: snap(overlay.start + shift) };
      if (overlay.start >= timing.start && overlay.start + overlay.duration <= oldEnd + 1e-6) {
        const ratio = duration / shot.duration;
        return {
          ...overlay,
          start: snap(timing.start + (overlay.start - timing.start) * ratio),
          duration: Math.max(minimum, snap(overlay.duration * ratio)),
        };
      }
      const end = overlay.start + overlay.duration;
      return end >= oldEnd
        ? { ...overlay, duration: Math.max(minimum, snap(overlay.duration + shift)) }
        : overlay;
    })
    .filter((overlay) => total - overlay.start >= minimum - 1e-6)
    .map((overlay) => ({
      ...overlay,
      duration: Math.min(overlay.duration, snap(total - overlay.start)),
    }));
  return {
    ...document,
    shots: document.shots.map((item) =>
      item.id === shot.id
        ? {
            ...item,
            duration,
            sourceIn,
            scene: item.scene
              ? {
                  ...item.scene,
                  variables: {
                    ...item.scene.variables,
                    __editorTimeScale:
                      (Number(item.scene.variables.__editorTimeScale ?? 1) * duration) /
                      shot.duration,
                  },
                }
              : null,
          }
        : item
    ),
    overlays,
  };
}
