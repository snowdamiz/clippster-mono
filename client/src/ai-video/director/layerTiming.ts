import type { EditDocument } from '../types';
import { layerId, readOverrides, setLayerOverride, type SceneInventory } from './sceneLayers';
/** Trim an element's visibility window or one animation without rippling the scene. */
export function trimSceneLayer(
  document: EditDocument,
  id: string,
  edge: 'start' | 'end',
  delta: number,
  inventories: SceneInventory[]
): EditDocument {
  if (!Number.isFinite(delta)) return document;
  for (const inventory of inventories) {
    const layer = inventory.layers.find((layer) => layerId(inventory.owner, layer.key) === id);
    if (!layer) continue;
    const shot = document.shots.find((shot) => shot.id === inventory.owner);
    const overlay = document.overlays.find((overlay) => overlay.id === inventory.owner);
    const span = shot?.duration ?? overlay?.duration;
    if (!span) return document;
    const variables = shot?.scene?.variables ?? overlay?.variables;
    const overrides = readOverrides(variables?.__editorLayers)[layer.key] ?? {};
    const fps = document.format.fps;
    const snap = (value: number) => Math.round(value * fps) / fps;
    const start = overrides.start ?? layer.start;
    const duration = overrides.duration ?? layer.duration;
    const end = Math.min(span, start + duration);
    const nextStart =
      edge === 'start' ? Math.min(end - 1 / fps, Math.max(0, snap(start + delta))) : start;
    const nextEnd =
      edge === 'end' ? Math.min(span, Math.max(start + 1 / fps, snap(end + delta))) : end;
    if (Math.abs(nextStart - start) < 0.0001 && Math.abs(nextEnd - start - duration) < 0.0001)
      return document;
    return setLayerOverride(document, inventory.owner, layer.key, {
      start: nextStart,
      duration: nextEnd - nextStart,
    });
  }
  return document;
}
