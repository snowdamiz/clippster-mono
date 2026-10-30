import type { EditDocument } from '../types';
export interface SceneLayer {
  key: string;
  kind: 'element' | 'animation';
  category: 'icons' | 'images' | 'shapes' | 'animation';
  label: string;
  selector?: string;
  tween?: number;
  start: number;
  duration: number;
  ranges?: Array<{ start: number; duration: number }>;
  styles?: Record<string, string>;
  src?: string;
  ease?: string;
  properties?: Record<string, string | number>;
  fromProperties?: Record<string, string | number>;
}
export interface SceneInventory {
  owner: string;
  layers: SceneLayer[];
}
export interface LayerOverride {
  styles?: Record<string, string>;
  src?: string;
  svg?: string;
  start?: number;
  duration?: number;
  ease?: string;
  hidden?: boolean;
  deleted?: boolean;
  properties?: Record<string, string | number>;
  fromProperties?: Record<string, string | number>;
}
export type LayerOverrides = Record<string, LayerOverride>;
export const layerId = (owner: string, key: string) =>
  `layer:${encodeURIComponent(owner)}:${encodeURIComponent(key)}`;
export function readOverrides(value: unknown): LayerOverrides {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
export function setLayerOverride(
  document: EditDocument,
  owner: string,
  key: string,
  change: Partial<LayerOverride>
): EditDocument {
  const update = (variables: Record<string, string | number | boolean>) => {
    const overrides = readOverrides(variables.__editorLayers);
    return {
      ...variables,
      __editorLayers: JSON.stringify({ ...overrides, [key]: { ...overrides[key], ...change } }),
    };
  };
  return {
    ...document,
    shots: document.shots.map((shot) =>
      shot.id === owner && shot.scene
        ? { ...shot, scene: { ...shot.scene, variables: update(shot.scene.variables) } }
        : shot
    ),
    overlays: document.overlays.map((overlay) =>
      overlay.id === owner ? { ...overlay, variables: update(overlay.variables) } : overlay
    ),
  };
}
