<template>
  <div class="studio-preview" ref="containerRef">
    <div
      class="studio-preview__canvas"
      :style="canvasStyle"
      @mousedown.self="selectLayer(null)"
    >
      <canvas
        ref="compositeCanvasRef"
        class="studio-preview__composite"
        @mousedown.self="selectLayer(null)"
      />

      <div v-if="showPlaceholder" class="studio-preview__placeholder">
        <Monitor v-if="backgroundSourceType === 'display'" :size="32" class="studio-preview__placeholder-icon" />
        <Film v-else :size="32" class="studio-preview__placeholder-icon" />
        <span class="studio-preview__placeholder-label">{{ placeholderLabel }}</span>
      </div>

      <div class="studio-preview__overlay" @mousedown.self="selectLayer(null)">
        <template v-for="layer in interactiveLayers" :key="layer.id">
          <div
            v-if="selectedLayerId === layer.id"
            class="studio-preview__selection-box"
            :class="selectionClass(layer)"
            :style="rectToOverlayStyle(layer.rect)"
          >
            <div
              class="studio-preview__resize-handle"
              @mousedown.stop="startResize(layer.id, $event)"
            />
          </div>
          <div
            class="studio-preview__layer-hit"
            :style="rectToOverlayStyle(layer.rect)"
            @mousedown.stop="startMove(layer.id, $event)"
          />
        </template>
      </div>
    </div>

    <video ref="screenVideoRef" class="studio-preview__hidden-source" muted playsinline />
    <video ref="mediaVideoRef" class="studio-preview__hidden-source" playsinline />
    <video ref="cameraVideoRef" class="studio-preview__hidden-source" muted playsinline />

    <p class="studio-preview__hint">
      Drag screen, PiP, and overlays to reposition. Click empty space to deselect.
    </p>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, onMounted, onUnmounted, watch } from 'vue';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import { Monitor, Film } from 'lucide-vue-next';
  import type {
    StudioRect,
    StudioAspectRatio,
    StudioRecordingMode,
    StudioBackgroundSourceType,
    StudioMediaSource,
    StudioLayout,
    StudioLayer,
  } from '@/types/studio';
  import { STUDIO_ASPECT_PRESETS, STUDIO_LAYER_IDS } from '@/types/studio';
  import { isTransformableLayer, sortedLayers } from '@/composables/studio/useStudioLayout';

  const props = defineProps<{
    mode: StudioRecordingMode;
    aspectRatio: StudioAspectRatio;
    layout: StudioLayout;
    selectedLayerId?: string | null;
    cameraPreviewDeviceId?: string | null;
    screenPreviewStream?: MediaStream | null;
    backgroundSourceType?: StudioBackgroundSourceType;
    mediaSource?: StudioMediaSource | null;
  }>();

  const emit = defineEmits<{
    (e: 'update:layout', value: StudioLayout): void;
    (e: 'update:selectedLayerId', value: string | null): void;
    (e: 'media-ended'): void;
  }>();

  const containerRef = ref<HTMLElement | null>(null);
  const compositeCanvasRef = ref<HTMLCanvasElement | null>(null);
  const cameraVideoRef = ref<HTMLVideoElement | null>(null);
  const screenVideoRef = ref<HTMLVideoElement | null>(null);
  const mediaVideoRef = ref<HTMLVideoElement | null>(null);
  const cameraStream = ref<MediaStream | null>(null);
  const imageCache = ref<Map<string, HTMLImageElement>>(new Map());
  const availableSize = ref({ width: 0, height: 0 });
  let animationFrameId: number | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const selectedLayerId = computed({
    get: () => props.selectedLayerId ?? null,
    set: (v) => emit('update:selectedLayerId', v),
  });

  const outputDimensions = computed(() => STUDIO_ASPECT_PRESETS[props.aspectRatio]);

  const canvasStyle = computed(() => {
    const preset = outputDimensions.value;
    const ratio = preset.width / preset.height;
    const availableWidth = availableSize.value.width;
    const availableHeight = Math.max(0, availableSize.value.height - 18);

    if (availableWidth > 0 && availableHeight > 0) {
      const widthFromHeight = availableHeight * ratio;
      const width = Math.min(availableWidth, widthFromHeight);
      const height = width / ratio;
      return {
        aspectRatio: `${preset.width} / ${preset.height}`,
        width: `${width}px`,
        height: `${height}px`,
      };
    }

    return {
      aspectRatio: `${preset.width} / ${preset.height}`,
      width: '100%',
      height: 'auto',
      maxHeight: '100%',
      maxWidth: '100%',
    };
  });

  const backgroundSourceType = computed(() => props.backgroundSourceType ?? 'none');

  const showPlaceholder = computed(() => {
    if (props.mode === 'camera') return !cameraStream.value;
    if (backgroundSourceType.value === 'display') return !props.screenPreviewStream;
    if (backgroundSourceType.value === 'media') return !props.mediaSource;
    return true;
  });

  const placeholderLabel = computed(() => {
    if (props.mode === 'camera') return 'Camera';
    if (backgroundSourceType.value === 'media') return 'Choose a media file';
    return 'Choose a screen or window';
  });

  const interactiveLayers = computed(() => {
    const hasScreenSource =
      backgroundSourceType.value === 'display'
        ? !!props.screenPreviewStream
        : backgroundSourceType.value === 'media'
          ? !!props.mediaSource
          : false;

    return sortedLayers(props.layout).filter((layer) => {
      if (!isTransformableLayer(layer, props.mode)) return false;
      if (layer.kind === 'screen') return hasScreenSource;
      if (layer.kind === 'camera') return props.mode === 'screen_camera' || props.mode === 'camera';
      return true;
    });
  });

  function rectToOverlayStyle(rect: StudioRect) {
    return {
      left: `${rect.x * 100}%`,
      top: `${rect.y * 100}%`,
      width: `${rect.width * 100}%`,
      height: `${rect.height * 100}%`,
    };
  }

  function selectionClass(layer: StudioLayer) {
    if (layer.kind === 'screen') return 'studio-preview__selection-box--source';
    if (layer.id === STUDIO_LAYER_IDS.watermark) return 'studio-preview__selection-box--watermark';
    return '';
  }

  function selectLayer(id: string | null) {
    selectedLayerId.value = id;
  }

  function getLayerRect(layerId: string): StudioRect | null {
    const layer = props.layout.layers.find((l) => l.id === layerId);
    return layer ? { ...layer.rect } : null;
  }

  function patchLayerRect(layerId: string, rect: StudioRect) {
    emit('update:layout', {
      ...props.layout,
      layers: props.layout.layers.map((l) =>
        l.id === layerId ? { ...l, rect: { ...rect } } : l
      ),
    });
  }

  let dragState: {
    layerId: string;
    isResize: boolean;
    startX: number;
    startY: number;
    origin: StudioRect;
    layerKind: StudioLayer['kind'];
  } | null = null;

  function getCanvasRect() {
    return containerRef.value?.querySelector('.studio-preview__canvas')?.getBoundingClientRect();
  }

  function startMove(layerId: string, event: MouseEvent) {
    const layer = props.layout.layers.find((l) => l.id === layerId);
    if (!layer || !isTransformableLayer(layer, props.mode)) return;
    if (layer.kind === 'screen' && props.mode === 'camera') return;
    selectLayer(layerId);
    const origin = getLayerRect(layerId);
    if (!origin) return;
    dragState = {
      layerId,
      isResize: false,
      startX: event.clientX,
      startY: event.clientY,
      origin,
      layerKind: layer.kind,
    };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
  }

  function startResize(layerId: string, event: MouseEvent) {
    const layer = props.layout.layers.find((l) => l.id === layerId);
    if (!layer) return;
    const origin = getLayerRect(layerId);
    if (!origin) return;
    dragState = {
      layerId,
      isResize: true,
      startX: event.clientX,
      startY: event.clientY,
      origin,
      layerKind: layer.kind,
    };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
  }

  function onDrag(event: MouseEvent) {
    if (!dragState) return;
    const rect = getCanvasRect();
    if (!rect) return;

    const dx = (event.clientX - dragState.startX) / rect.width;
    const dy = (event.clientY - dragState.startY) / rect.height;
    const origin = dragState.origin;
    const isScreen = dragState.layerKind === 'screen';

    if (dragState.isResize) {
      const next: StudioRect = isScreen
        ? {
            x: origin.x,
            y: origin.y,
            width: Math.min(4, Math.max(0.05, origin.width + dx)),
            height: Math.min(4, Math.max(0.05, origin.height + dy)),
          }
        : {
            x: origin.x,
            y: origin.y,
            width: Math.min(1 - origin.x, Math.max(0.05, origin.width + dx)),
            height: Math.min(1 - origin.y, Math.max(0.05, origin.height + dy)),
          };
      patchLayerRect(dragState.layerId, next);
    } else {
      const next: StudioRect = isScreen
        ? {
            x: Math.min(0.95, Math.max(0.05 - origin.width, origin.x + dx)),
            y: Math.min(0.95, Math.max(0.05 - origin.height, origin.y + dy)),
            width: origin.width,
            height: origin.height,
          }
        : {
            x: Math.min(1 - origin.width, Math.max(0, origin.x + dx)),
            y: Math.min(1 - origin.y, Math.max(0, origin.y + dy)),
            width: origin.width,
            height: origin.height,
          };
      patchLayerRect(dragState.layerId, next);
    }
  }

  function endDrag() {
    dragState = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', endDrag);
  }

  function drawVideoCover(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    const scale = Math.max(w / vw, h / vh);
    const sw = vw * scale;
    const sh = vh * scale;
    const dx = x + (w - sw) / 2;
    const dy = y + (h - sh) / 2;
    ctx.drawImage(video, dx, dy, sw, sh);
  }

  function drawVideoContain(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    const scale = Math.min(w / vw, h / vh);
    const sw = vw * scale;
    const sh = vh * scale;
    const dx = x + (w - sw) / 2;
    const dy = y + (h - sh) / 2;
    ctx.drawImage(video, dx, dy, sw, sh);
  }

  function drawVideoInRect(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    layer: StudioLayer,
    canvasW: number,
    canvasH: number
  ) {
    const x = layer.rect.x * canvasW;
    const y = layer.rect.y * canvasH;
    const w = layer.rect.width * canvasW;
    const h = layer.rect.height * canvasH;
    const fit = layer.fit ?? 'cover';
    if (fit === 'contain') drawVideoContain(ctx, video, x, y, w, h);
    else drawVideoCover(ctx, video, x, y, w, h);
  }

  function drawRoundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number
  ) {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawShapeLayer(ctx: CanvasRenderingContext2D, layer: StudioLayer, canvasW: number, canvasH: number) {
    const x = layer.rect.x * canvasW;
    const y = layer.rect.y * canvasH;
    const w = layer.rect.width * canvasW;
    const h = layer.rect.height * canvasH;
    const radius = layer.borderRadius ?? 0;

    ctx.save();
    ctx.globalAlpha = layer.opacity;

    if (layer.glow) {
      ctx.shadowColor = layer.glow.color;
      ctx.shadowBlur = layer.glow.blur;
    }

    if (layer.fill) {
      if (radius > 0) {
        drawRoundedRectPath(ctx, x, y, w, h, radius);
        ctx.fillStyle = layer.fill;
        ctx.fill();
      } else {
        ctx.fillStyle = layer.fill;
        ctx.fillRect(x, y, w, h);
      }
    }

    if (layer.border && layer.border.width > 0) {
      ctx.shadowBlur = layer.glow?.blur ?? 0;
      ctx.strokeStyle = layer.border.color;
      ctx.lineWidth = layer.border.width;
      if (radius > 0) {
        drawRoundedRectPath(ctx, x, y, w, h, radius);
        ctx.stroke();
      } else {
        ctx.strokeRect(x + layer.border.width / 2, y + layer.border.width / 2, w - layer.border.width, h - layer.border.width);
      }
    }

    ctx.restore();
  }

  function drawImageLayer(ctx: CanvasRenderingContext2D, layer: StudioLayer, canvasW: number, canvasH: number) {
    if (!layer.imagePath) return;
    const img = imageCache.value.get(layer.imagePath);
    if (!img) return;

    const x = layer.rect.x * canvasW;
    const y = layer.rect.y * canvasH;
    const w = layer.rect.width * canvasW;
    const h = layer.rect.height * canvasH;

    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  }

  function drawTextLayer(ctx: CanvasRenderingContext2D, layer: StudioLayer, canvasW: number, canvasH: number) {
    if (!layer.text) return;
    const x = layer.rect.x * canvasW;
    const y = layer.rect.y * canvasH;
    const w = layer.rect.width * canvasW;
    const h = layer.rect.height * canvasH;
    const fontSize = layer.fontSize ?? Math.max(16, h * 0.6);

    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.fillStyle = layer.textColor ?? '#ffffff';
    ctx.font = `${layer.fontWeight ?? '700'} ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(layer.text, x + w / 2, y + h / 2, w);
    ctx.restore();
  }

  function drawFrame() {
    const canvas = compositeCanvasRef.value;
    if (!canvas) return;

    const preset = outputDimensions.value;
    if (canvas.width !== preset.width || canvas.height !== preset.height) {
      canvas.width = preset.width;
      canvas.height = preset.height;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = props.layout.backgroundFill || '#0a0a0b';
    ctx.fillRect(0, 0, w, h);

    const cameraVideo = cameraVideoRef.value;
    const screenVideo = screenVideoRef.value;
    const mediaVideo = mediaVideoRef.value;

    const layers = sortedLayers(props.layout);
    let drewScreen = false;

    for (const layer of layers) {
      if (layer.kind === 'background') continue;

      if (layer.kind === 'screen') {
        if (props.mode === 'camera') continue;
        if (backgroundSourceType.value === 'display' && screenVideo && screenVideo.readyState >= 2) {
          ctx.save();
          ctx.globalAlpha = layer.opacity;
          drawVideoInRect(ctx, screenVideo, layer, w, h);
          ctx.restore();
          drewScreen = true;
        } else if (backgroundSourceType.value === 'media' && mediaVideo && mediaVideo.readyState >= 2) {
          ctx.save();
          ctx.globalAlpha = layer.opacity;
          drawVideoInRect(ctx, mediaVideo, layer, w, h);
          ctx.restore();
          drewScreen = true;
        }
      } else if (layer.kind === 'camera') {
        if (cameraVideo && cameraVideo.readyState >= 2) {
          if (props.mode === 'camera') {
            drawVideoCover(ctx, cameraVideo, 0, 0, w, h);
          } else if (props.mode === 'screen_camera') {
            ctx.save();
            ctx.globalAlpha = layer.opacity;
            drawVideoInRect(ctx, cameraVideo, layer, w, h);
            ctx.restore();
          }
        }
      } else if (layer.kind === 'shape') {
        drawShapeLayer(ctx, layer, w, h);
      } else if (layer.kind === 'image') {
        drawImageLayer(ctx, layer, w, h);
      } else if (layer.kind === 'text') {
        drawTextLayer(ctx, layer, w, h);
      }
    }

    if (!drewScreen && props.mode === 'screen_camera' && cameraVideo && cameraVideo.readyState >= 2) {
      drawVideoCover(ctx, cameraVideo, 0, 0, w, h);
    }
  }

  function loadImageForLayer(layer: StudioLayer) {
    if (!layer.imagePath) return;
    if (imageCache.value.has(layer.imagePath)) return;

    const img = new Image();
    img.onload = () => {
      imageCache.value.set(layer.imagePath!, img);
      drawFrame();
    };
    img.onerror = () => {
      imageCache.value.delete(layer.imagePath!);
    };
    try {
      img.src = convertFileSrc(layer.imagePath);
    } catch {
      img.src = layer.imagePath;
    }
  }

  function syncImageCache() {
    const paths = new Set(
      props.layout.layers.filter((l) => l.kind === 'image' && l.imagePath).map((l) => l.imagePath!)
    );
    for (const layer of props.layout.layers) {
      if (layer.kind === 'image' && layer.imagePath) {
        loadImageForLayer(layer);
      }
    }
    for (const key of [...imageCache.value.keys()]) {
      if (!paths.has(key)) imageCache.value.delete(key);
    }
  }

  function startCompositorLoop() {
    if (animationFrameId !== null) return;
    const loop = () => {
      drawFrame();
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  function stopCompositorLoop() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function stopCameraPreview() {
    cameraStream.value?.getTracks().forEach((track) => track.stop());
    cameraStream.value = null;
    if (cameraVideoRef.value) cameraVideoRef.value.srcObject = null;
  }

  async function startCameraPreview() {
    stopCameraPreview();
    if (props.mode !== 'camera' && props.mode !== 'screen_camera') return;
    if (!navigator.mediaDevices?.getUserMedia) return;

    try {
      const videoConstraint: boolean | MediaTrackConstraints = props.cameraPreviewDeviceId
        ? { deviceId: { exact: props.cameraPreviewDeviceId } }
        : true;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: false,
      });

      cameraStream.value = stream;
      await nextTick();
      if (cameraVideoRef.value) {
        cameraVideoRef.value.srcObject = stream;
        cameraVideoRef.value.play().catch(() => undefined);
      }
    } catch (err) {
      console.warn('[StudioPreview] Failed to start camera preview:', err);
    }
  }

  async function bindScreenStream(stream: MediaStream | null) {
    await nextTick();
    if (!screenVideoRef.value) return;
    screenVideoRef.value.srcObject = stream;
    if (stream) {
      screenVideoRef.value.play().catch(() => undefined);
    }
  }

  async function bindMediaSource(source: StudioMediaSource | null) {
    await nextTick();
    if (!mediaVideoRef.value) return;

    if (!source) {
      mediaVideoRef.value.pause();
      mediaVideoRef.value.removeAttribute('src');
      mediaVideoRef.value.load();
      return;
    }

    mediaVideoRef.value.src = convertFileSrc(source.path);
    mediaVideoRef.value.loop = false;
    mediaVideoRef.value.muted = false;
    mediaVideoRef.value.volume = 0;
    mediaVideoRef.value.onended = () => emit('media-ended');
    mediaVideoRef.value.play().catch(() => undefined);
  }

  watch(
    () => [props.mode, props.cameraPreviewDeviceId],
    () => {
      void startCameraPreview();
    },
    { immediate: true }
  );

  watch(
    () => props.screenPreviewStream,
    (stream) => {
      void bindScreenStream(stream ?? null);
    },
    { immediate: true }
  );

  watch(
    () => props.mediaSource,
    (source) => {
      void bindMediaSource(source ?? null);
    },
    { immediate: true }
  );

  watch(
    () => props.layout.layers,
    () => {
      syncImageCache();
      drawFrame();
    },
    { deep: true, immediate: true }
  );

  watch(
    () => [props.mode, props.aspectRatio, props.layout],
    () => drawFrame(),
    { deep: true }
  );

  onMounted(() => {
    if (containerRef.value) {
      resizeObserver = new ResizeObserver(([entry]) => {
        if (!entry) return;
        availableSize.value = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        };
      });
      resizeObserver.observe(containerRef.value);
    }
    startCompositorLoop();
  });

  onUnmounted(() => {
    endDrag();
    resizeObserver?.disconnect();
    resizeObserver = null;
    stopCompositorLoop();
    stopCameraPreview();
  });

  defineExpose({
    getCanvas: () => compositeCanvasRef.value,
    getFullscreenElement: () => containerRef.value?.querySelector<HTMLElement>('.studio-preview__canvas') ?? null,
    getMediaVideo: () => mediaVideoRef.value,
    drawFrame,
    deselectAll: () => selectLayer(null),
  });
</script>

<style scoped>
  .studio-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .studio-preview__canvas {
    position: relative;
    flex: 0 0 auto;
    background: #0a0a0b;
    overflow: hidden;
    margin: 0 auto;
  }

  .studio-preview__canvas:fullscreen {
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    max-height: none !important;
    background: #000;
  }

  .studio-preview__canvas:fullscreen .studio-preview__composite {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #000;
  }

  .studio-preview__canvas:fullscreen .studio-preview__overlay {
    display: none;
  }

  .studio-preview__composite {
    display: block;
    width: 100%;
    height: 100%;
  }

  .studio-preview__placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--sidebar-text-muted);
    pointer-events: none;
  }

  .studio-preview__overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .studio-preview__layer-hit {
    position: absolute;
    pointer-events: auto;
    cursor: move;
  }

  .studio-preview__selection-box {
    position: absolute;
    pointer-events: none;
    border: 1px dashed rgba(6, 182, 212, 0.75);
    border-radius: 2px;
    box-shadow: 0 0 0 1px rgba(6, 182, 212, 0.2);
  }

  .studio-preview__selection-box--source {
    border-color: rgba(168, 85, 247, 0.75);
    box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.2);
  }

  .studio-preview__selection-box--watermark {
    border-color: rgba(234, 179, 8, 0.75);
    box-shadow: 0 0 0 1px rgba(234, 179, 8, 0.2);
  }

  .studio-preview__resize-handle {
    position: absolute;
    right: -4px;
    bottom: -4px;
    width: 10px;
    height: 10px;
    background: var(--sidebar-accent);
    border-radius: 2px;
    pointer-events: auto;
    cursor: nwse-resize;
  }

  .studio-preview__hidden-source {
    position: fixed;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
    left: -9999px;
    top: -9999px;
  }

  .studio-preview__placeholder-icon {
    opacity: 0.5;
  }

  .studio-preview__placeholder-label {
    font-size: 0.75rem;
    opacity: 0.6;
  }

  .studio-preview__hint {
    flex-shrink: 0;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    text-align: center;
    margin: 0;
  }
</style>
