import { ref, computed } from 'vue';
import type {
  StudioAspectRatio,
  StudioLayout,
  StudioLayer,
  StudioLayerKind,
  StudioRect,
  StudioRecordingMode,
  StudioTemplate,
} from '@/types/studio';
import {
  DEFAULT_CAMERA_PIP,
  DEFAULT_SOURCE_RECT,
  DEFAULT_WATERMARK_RECT,
  STUDIO_LAYER_IDS,
} from '@/types/studio';

let layerCounter = 0;

export function createLayerId(prefix = 'layer'): string {
  layerCounter += 1;
  return `${prefix}-${Date.now()}-${layerCounter}`;
}

export function createScreenLayer(rect: StudioRect = { ...DEFAULT_SOURCE_RECT }): StudioLayer {
  return {
    id: STUDIO_LAYER_IDS.screen,
    kind: 'screen',
    name: 'Screen',
    rect: { ...rect },
    zIndex: 10,
    visible: true,
    opacity: 1,
    fit: 'contain',
  };
}

export function createCameraLayer(rect: StudioRect = { ...DEFAULT_CAMERA_PIP }): StudioLayer {
  return {
    id: STUDIO_LAYER_IDS.camera,
    kind: 'camera',
    name: 'Camera',
    rect: { ...rect },
    zIndex: 20,
    visible: true,
    opacity: 1,
    fit: 'cover',
  };
}

export function createWatermarkLayer(
  rect: StudioRect = { ...DEFAULT_WATERMARK_RECT },
  imagePath?: string | null
): StudioLayer {
  return {
    id: STUDIO_LAYER_IDS.watermark,
    kind: 'image',
    name: 'Watermark',
    rect: { ...rect },
    zIndex: 100,
    visible: true,
    opacity: 0.8,
    fit: 'fill',
    imagePath: imagePath ?? null,
  };
}

export function createImageLayer(
  imagePath: string,
  name = 'Overlay',
  rect: StudioRect = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }
): StudioLayer {
  return {
    id: createLayerId('image'),
    kind: 'image',
    name,
    rect: { ...rect },
    zIndex: 80,
    visible: true,
    opacity: 1,
    fit: 'fill',
    imagePath,
  };
}

export function createShapeLayer(
  name = 'Border',
  rect: StudioRect = { x: 0.05, y: 0.05, width: 0.9, height: 0.9 },
  options?: Partial<Pick<StudioLayer, 'border' | 'glow' | 'fill' | 'borderRadius'>>
): StudioLayer {
  return {
    id: createLayerId('shape'),
    kind: 'shape',
    name,
    rect: { ...rect },
    zIndex: 30,
    visible: true,
    opacity: 1,
    fill: options?.fill ?? null,
    border: options?.border ?? { color: '#ec4899', width: 3 },
    glow: options?.glow ?? { color: '#ec4899', blur: 12 },
    borderRadius: options?.borderRadius ?? 0,
  };
}

export function createTextLayer(
  text: string,
  rect: StudioRect = { x: 0.1, y: 0.45, width: 0.8, height: 0.1 }
): StudioLayer {
  return {
    id: createLayerId('text'),
    kind: 'text',
    name: 'Text',
    rect: { ...rect },
    zIndex: 60,
    visible: true,
    opacity: 1,
    text,
    textColor: '#ffffff',
    fontSize: 48,
    fontWeight: '700',
  };
}

export function createDefaultLayout(
  aspectRatio: StudioAspectRatio = '16:9',
  mode: StudioRecordingMode = 'screen_camera'
): StudioLayout {
  const layers: StudioLayer[] = [];

  if (mode !== 'camera') {
    layers.push(createScreenLayer());
  }
  if (mode === 'screen_camera' || mode === 'camera') {
    layers.push(
      createCameraLayer(
        mode === 'camera'
          ? { x: 0, y: 0, width: 1, height: 1 }
          : { ...DEFAULT_CAMERA_PIP }
      )
    );
  }

  return {
    version: 1,
    aspectRatio,
    backgroundFill: '#0a0a0b',
    layers,
  };
}

export function getLayerById(layout: StudioLayout, id: string): StudioLayer | undefined {
  return layout.layers.find((l) => l.id === id);
}

export function getScreenRect(layout: StudioLayout): StudioRect {
  return getLayerById(layout, STUDIO_LAYER_IDS.screen)?.rect ?? { ...DEFAULT_SOURCE_RECT };
}

export function getCameraRect(layout: StudioLayout): StudioRect {
  return getLayerById(layout, STUDIO_LAYER_IDS.camera)?.rect ?? { ...DEFAULT_CAMERA_PIP };
}

export function getWatermarkLayer(layout: StudioLayout): StudioLayer | undefined {
  return getLayerById(layout, STUDIO_LAYER_IDS.watermark);
}

export function sortedLayers(layout: StudioLayout): StudioLayer[] {
  return [...layout.layers].filter((l) => l.visible).sort((a, b) => a.zIndex - b.zIndex);
}

export function overlayLayers(layout: StudioLayout): StudioLayer[] {
  return sortedLayers(layout).filter(
    (l) => l.kind === 'image' || l.kind === 'shape' || l.kind === 'text'
  );
}

export function updateLayerRect(layout: StudioLayout, layerId: string, rect: StudioRect): StudioLayout {
  return {
    ...layout,
    layers: layout.layers.map((l) => (l.id === layerId ? { ...l, rect: { ...rect } } : l)),
  };
}

export function updateLayer(layout: StudioLayout, layerId: string, patch: Partial<StudioLayer>): StudioLayout {
  return {
    ...layout,
    layers: layout.layers.map((l) => (l.id === layerId ? { ...l, ...patch, rect: patch.rect ?? l.rect } : l)),
  };
}

export function addLayer(layout: StudioLayout, layer: StudioLayer): StudioLayout {
  return {
    ...layout,
    layers: [...layout.layers, layer],
  };
}

export function removeLayer(layout: StudioLayout, layerId: string): StudioLayout {
  if (
    layerId === STUDIO_LAYER_IDS.screen ||
    layerId === STUDIO_LAYER_IDS.camera ||
    layerId === STUDIO_LAYER_IDS.watermark
  ) {
    return layout;
  }
  return {
    ...layout,
    layers: layout.layers.filter((l) => l.id !== layerId),
  };
}

export function ensureLayoutForMode(layout: StudioLayout, mode: StudioRecordingMode): StudioLayout {
  let next = { ...layout, layers: [...layout.layers] };

  const hasScreen = next.layers.some((l) => l.id === STUDIO_LAYER_IDS.screen);
  const hasCamera = next.layers.some((l) => l.id === STUDIO_LAYER_IDS.camera);

  if (mode !== 'camera' && !hasScreen) {
    next = addLayer(next, createScreenLayer());
  }
  if ((mode === 'screen_camera' || mode === 'camera') && !hasCamera) {
    next = addLayer(
      next,
      createCameraLayer(mode === 'camera' ? { x: 0, y: 0, width: 1, height: 1 } : { ...DEFAULT_CAMERA_PIP })
    );
  }

  if (mode === 'screen' || mode === 'camera') {
    next = {
      ...next,
      layers: next.layers.filter((l) => l.id !== STUDIO_LAYER_IDS.camera || mode === 'camera'),
    };
  }
  if (mode === 'camera') {
    next = {
      ...next,
      layers: next.layers.filter((l) => l.id !== STUDIO_LAYER_IDS.screen),
    };
    const cameraLayer = getLayerById(next, STUDIO_LAYER_IDS.camera);
    if (cameraLayer) {
      next = updateLayer(next, STUDIO_LAYER_IDS.camera, {
        rect: { x: 0, y: 0, width: 1, height: 1 },
      });
    }
  }

  return next;
}

/** Migrate legacy template fields into layout */
export function migrateTemplate(template: StudioTemplate & { cameraPip?: StudioRect }): StudioTemplate {
  if (template.layout?.version === 1 && template.layout.layers.length > 0) {
    return template;
  }

  const aspectRatio = template.aspectRatio ?? '16:9';
  const layout = createDefaultLayout(aspectRatio, template.mode);
  let migrated = layout;

  if (template.cameraPip) {
    migrated = updateLayer(migrated, STUDIO_LAYER_IDS.camera, { rect: { ...template.cameraPip } });
  }
  if (template.mode === 'camera') {
    migrated = updateLayer(migrated, STUDIO_LAYER_IDS.camera, {
      rect: { x: 0, y: 0, width: 1, height: 1 },
    });
  }
  if (template.watermarkOverride) {
    migrated = addLayer(migrated, createWatermarkLayer({ ...template.watermarkOverride }));
  }

  return {
    ...template,
    layout: migrated,
  };
}

/** Build layout from legacy recorder rects */
export function layoutFromLegacy(
  aspectRatio: StudioAspectRatio,
  mode: StudioRecordingMode,
  sourceRect: StudioRect,
  cameraPip: StudioRect,
  watermarkRect: StudioRect | null,
  watermarkPath: string | null,
  overlayLayersList: StudioLayer[] = []
): StudioLayout {
  let layout = createDefaultLayout(aspectRatio, mode);
  layout = updateLayer(layout, STUDIO_LAYER_IDS.screen, { rect: { ...sourceRect } });
  layout = updateLayer(layout, STUDIO_LAYER_IDS.camera, { rect: { ...cameraPip } });

  if (watermarkRect && watermarkPath) {
    const existing = getWatermarkLayer(layout);
    if (existing) {
      layout = updateLayer(layout, STUDIO_LAYER_IDS.watermark, {
        rect: { ...watermarkRect },
        imagePath: watermarkPath,
      });
    } else {
      layout = addLayer(layout, createWatermarkLayer({ ...watermarkRect }, watermarkPath));
    }
  }

  for (const layer of overlayLayersList) {
    if (layer.id !== STUDIO_LAYER_IDS.screen && layer.id !== STUDIO_LAYER_IDS.camera && layer.id !== STUDIO_LAYER_IDS.watermark) {
      layout = addLayer(layout, { ...layer });
    }
  }

  return layout;
}

export function isTransformableLayer(layer: StudioLayer, mode: StudioRecordingMode): boolean {
  if (layer.kind === 'screen') return mode !== 'camera';
  if (layer.kind === 'camera') return mode === 'screen_camera' || mode === 'camera';
  return layer.kind === 'image' || layer.kind === 'shape' || layer.kind === 'text';
}

export function useStudioLayout(initial?: StudioLayout) {
  const layout = ref<StudioLayout>(
    initial ?? createDefaultLayout('16:9', 'screen_camera')
  );
  const selectedLayerId = ref<string | null>(null);

  const selectedLayer = computed(() =>
    selectedLayerId.value ? getLayerById(layout.value, selectedLayerId.value) : undefined
  );

  function setLayout(next: StudioLayout) {
    layout.value = next;
  }

  function selectLayer(id: string | null) {
    selectedLayerId.value = id;
  }

  function patchLayer(id: string, patch: Partial<StudioLayer>) {
    layout.value = updateLayer(layout.value, id, patch);
  }

  function patchLayerRect(id: string, rect: StudioRect) {
    layout.value = updateLayerRect(layout.value, id, rect);
  }

  function addOverlayLayer(layer: StudioLayer) {
    layout.value = addLayer(layout.value, layer);
    selectedLayerId.value = layer.id;
  }

  function removeOverlayLayer(id: string) {
    layout.value = removeLayer(layout.value, id);
    if (selectedLayerId.value === id) selectedLayerId.value = null;
  }

  function applyLayoutTemplate(templateLayout: StudioLayout, mode: StudioRecordingMode) {
    layout.value = ensureLayoutForMode({ ...templateLayout, layers: templateLayout.layers.map((l) => ({ ...l, rect: { ...l.rect } })) }, mode);
  }

  return {
    layout,
    selectedLayerId,
    selectedLayer,
    setLayout,
    selectLayer,
    patchLayer,
    patchLayerRect,
    addOverlayLayer,
    removeOverlayLayer,
    applyLayoutTemplate,
  };
}
