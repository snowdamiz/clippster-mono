import { placeShots } from '../compiler/compile';
import type { EditDocument } from '../types';
import { layerId, readOverrides, type SceneInventory } from './sceneLayers';
/** Resolve scene-relative inventory into absolute timeline positions, including drag previews. */
export function timelineLayers(document: EditDocument, inventories: SceneInventory[]) {
  const placed = placeShots(document);
  return inventories.flatMap((inventory) => {
    const shot = placed.find((item) => item.id === inventory.owner);
    const overlay = document.overlays.find((item) => item.id === inventory.owner);
    if (!shot && !overlay) return [];
    const start = shot?.start ?? overlay!.start;
    const end = shot?.end ?? start + overlay!.duration;
    const variables =
      document.shots.find((item) => item.id === inventory.owner)?.scene?.variables ??
      overlay?.variables;
    const overrides = readOverrides(variables?.__editorLayers);
    return inventory.layers.flatMap((layer) => {
      if (overrides[layer.key]?.deleted) return [];
      const offset = overrides[layer.key]?.start ?? layer.start;
      const duration = overrides[layer.key]?.duration ?? layer.duration;
      if (offset >= end - start) return [];
      const ranges = layer.ranges ?? [{ start: offset, duration }];
      const changedTiming =
        (overrides[layer.key]?.start !== undefined && offset !== layer.start) ||
        (overrides[layer.key]?.duration !== undefined && duration !== layer.duration);
      return (changedTiming ? [{ start: offset, duration }] : ranges).map((range) => ({
        id: layerId(inventory.owner, layer.key),
        label: layer.label,
        category: layer.category,
        start: start + range.start,
        duration: Math.max(
          1 / document.format.fps,
          Math.min(range.duration, end - start - range.start)
        ),
        trim: true,
      }));
    });
  });
}
