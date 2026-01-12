<template>
  <div class="track-renderer absolute inset-0 pointer-events-none">
    <!-- Render all items in this track -->
    <div
      v-for="item in visibleItems"
      :key="item.id"
      class="timeline-item absolute transform-gpu"
      :class="{ 'pointer-events-auto': !isLocked && item.type !== 'effect' }"
      :style="{ ...getItemStyle(item), overflow: 'visible' }"
      :data-item-id="item.id"
      :data-item-type="item.type"
      @mousedown.stop="(e) => $emit('itemMousedown', e, item)"
    >
      <!-- Video Item -->
      <video
        v-if="item.type === 'video' && !isImage(item)"
        :ref="(el) => setVideoRef(el as HTMLVideoElement, item)"
        :src="getItemSrc(item)"
        class="w-full h-full object-fill"
        muted
        playsinline
        loop
      />

      <!-- Image/Watermark Item -->
      <img
        v-else-if="isImage(item) || item.type === 'sticker' || item.type === 'watermark'"
        :src="getItemSrc(item)"
        class="w-full h-full object-contain"
        draggable="false"
        @load="(e) => $emit('itemImageLoad', e, item)"
      />

      <!-- Sticker (Emoji) -->
      <div
        v-else-if="isEmoji(item)"
        class="w-full h-full flex items-center justify-center select-none emoji-sticker"
        :style="getEmojiStyle(item)"
      >
        {{ item.originalData?.stickerPath || item.originalData?.sticker_path }}
      </div>

      <!-- Text Item -->
      <span v-else-if="item.type === 'text'" class="whitespace-pre-wrap inline-block" :style="getTextStyle(item)">
        {{ item.originalData?.text || item.name }}
      </span>

      <!-- Effect Item (Filter, Blur, Flash) -->
      <div
        v-else-if="item.type === 'effect'"
        class="absolute inset-0 pointer-events-none"
        :style="getEffectStyle(item)"
      >
        <!-- Flash effect overlay -->
        <div
          v-if="getEffectType(item) === 'flash'"
          class="absolute inset-0 bg-white"
          :style="{ opacity: getFlashOpacity(item) }"
        />
        <!-- Chroma Key effect -->
        <div v-else-if="getEffectType(item) === 'chroma'" class="absolute inset-0" :style="getChromaKeyStyle(item)" />
      </div>

      <!-- Adjustment Layer (applies filters to layers below) -->
      <div
        v-else-if="item.type === 'adjustment_layer'"
        class="absolute inset-0 pointer-events-none"
        :style="getAdjustmentLayerStyle(item)"
      >
        <!-- Visual indicator for adjustment layer in edit mode -->
        <div
          v-if="isSelected(item.id)"
          class="absolute inset-0 border-2 border-dashed border-purple-500/50 flex items-center justify-center"
        >
          <span class="text-purple-400 text-xs bg-black/50 px-2 py-1 rounded">Adjustment Layer</span>
        </div>
      </div>

      <!-- Transform Controls (Selection & Handles) -->
      <TransformControls
        v-if="isSelected(item.id)"
        :scale="getItemScale(item)"
        :class="{ 'pointer-events-none': isLocked }"
        @resize-start="
          (handle, e) => {
            $emit('itemResizeStart', e, item, handle);
          }
        "
        @rotate-start="
          (e) => {
            $emit('itemRotateStart', e, item);
          }
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, watch, ref } from 'vue';
  import type { Track, TimelineItem } from '@/types/timeline-model';
  import { AnimationService } from '@/services/AnimationService';
  import TransformControls from './TransformControls.vue';

  const props = defineProps<{
    track: Track;
    currentTime: number;
    isPlaying: boolean;
    selectedItemIds: Set<string>;
    canvasSize: { width: number; height: number };
    aspectRatio?: string; // Current aspect ratio for per-ratio config lookups (e.g., "16:9", "9:16")
    scaleOverrides?: Record<string, number>;
    rotationOverrides?: Record<string, number>;
    widthOverrides?: Record<string, number>;
    positionOverrides?: Record<string, { x: number; y: number }>;
    itemStyleOverrides?: Record<string, Record<string, string>>;
  }>();

  const emit = defineEmits<{
    (e: 'itemMousedown', event: MouseEvent, item: TimelineItem): void;
    (e: 'itemResizeStart', event: MouseEvent, item: TimelineItem, handle: 'tl' | 'tr' | 'bl' | 'br'): void;
    (e: 'itemRotateStart', event: MouseEvent, item: TimelineItem): void;
    (e: 'itemImageLoad', event: Event, item: TimelineItem): void;
  }>();

  const videoRefs = ref<HTMLVideoElement[]>([]);
  const isLocked = computed(() => props.track.isLocked);

  function setVideoRef(el: HTMLVideoElement | null, item: TimelineItem) {
    if (!el) return;
    // Simple array management - in a real app might want a Map<ItemId, Element>
    if (!videoRefs.value.includes(el)) {
      videoRefs.value.push(el);
    }
  }

  // Filter items that are currently visible
  const visibleItems = computed(() => {
    if (!props.track.isVisible) return [];

    return props.track.items.filter((item) => {
      return props.currentTime >= item.startTime && props.currentTime < item.startTime + item.duration;
    });
  });

  // Sync video elements with timeline time
  watch(
    () => props.currentTime,
    (newTime) => {
      if (!props.isPlaying) {
        // When paused, strictly sync frames
        syncVideos(newTime);
      } else {
        // When playing, we allow the video to run, but check for drift
        // or if the video just appeared (became visible)
        syncVideos(newTime, 0.5); // 0.5s tolerance
      }
    }
  );

  watch(
    () => props.isPlaying,
    (playing) => {
      if (visibleItems.value.length === 0) return;

      // Use nextTick or simple timeout to ensure refs are active
      setTimeout(() => {
        if (videoRefs.value) {
          videoRefs.value.forEach((el) => {
            if (!el) return;
            if (playing) {
              el.play().catch((e) => console.warn('Autoplay prevented', e));
            } else {
              el.pause();
            }
          });
        }
      }, 0);
    }
  );

  // Watch visible items to trigger play on new items if playing
  watch(visibleItems, (newItems, oldItems) => {
    if (props.isPlaying && newItems.length > 0) {
      setTimeout(() => {
        // Sync and play new videos
        syncVideos(props.currentTime);
        if (videoRefs.value) {
          videoRefs.value.forEach((el) => {
            if (el && el.paused) el.play().catch(() => {});
          });
        }
      }, 50);
    }
  });

  function syncVideos(globalTime: number, tolerance = 0.1) {
    if (!videoRefs.value) return;

    videoRefs.value.forEach((el, index) => {
      // Find the item corresponding to this element (assuming index match if v-for order is stable)
      // Actually v-for ref array order isn't guaranteed to match item order in Vue 3.
      // But since we render visibleItems, we can try to map.
      // Better way: pass index to ref function or filter.
      // For now, let's assume we can just check the time range.

      if (!el) return;

      // We need to find which item this video belongs to.
      // Since we can't easily map refs back to items in generic array without ID,
      // let's rely on the fact that `visibleItems` usually has 0 or 1 item per track for video tracks.
      // If multiple overlapping items on same track? (Timeline model allows it but usually avoided)

      // We'll iterate visibleItems and assume 1-to-1 if length matches, or finding matching src
      const item = visibleItems.value.find((i) => getItemSrc(i) === el.src || el.src.endsWith(getItemSrc(i)));

      if (item) {
        // Calculate relative time in the source video
        // Global Time = Item Start + Offset
        // Source Time = Source Start (trimStart) + Offset
        // Offset = Global Time - Item Start
        // Source Time = trimStart + (Global Time - Item Start)

        const offset = globalTime - item.startTime;
        const trimStart = item.trimStart || 0;
        const targetTime = trimStart + offset;

        // Check drift
        if (Math.abs(el.currentTime - targetTime) > tolerance) {
          el.currentTime = targetTime;
        }
      }
    });
  }

  function isSelected(itemId: string): boolean {
    return props.selectedItemIds.has(itemId);
  }

  function isEmoji(item: TimelineItem): boolean {
    return (
      item.type === 'sticker' &&
      (item.originalData?.stickerType === 'emoji' || item.originalData?.sticker_type === 'emoji')
    );
  }

  function isImage(item: TimelineItem): boolean {
    // Simple check based on sourcePath extension or type logic
    // For now, treat stickers as images (unless emoji), and check paths for others
    if (item.type === 'sticker') {
      return !isEmoji(item);
    }
    if (item.type === 'video' && item.sourcePath) {
      return /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(item.sourcePath);
    }
    return false;
  }

  function getEmojiStyle(item: TimelineItem) {
    // Base font size for emojis
    // If overrides exist, use them, otherwise default
    const overrides = props.itemStyleOverrides?.[item.id];

    return {
      fontSize: overrides?.fontSize || '48px',
      lineHeight: overrides?.lineHeight || '1',
      // Allow color override for text-based emojis if needed
      color: overrides?.color,
    };
  }

  function getItemSrc(item: TimelineItem): string {
    // Map back to specific properties based on type
    if (item.type === 'sticker') {
      return item.originalData?.stickerPath || '';
    }
    if (item.type === 'video') {
      return item.sourcePath || '';
    }
    return '';
  }

  // Get the current scale for an item (used by TransformControls to counter-scale)
  function getItemScale(item: TimelineItem): number {
    const relativeTime = props.currentTime - item.startTime;
    let scale = AnimationService.getValueAtTime(item, 'scale', relativeTime, item.scale ?? 1);

    if (props.scaleOverrides && props.scaleOverrides[item.id] !== undefined) {
      scale = props.scaleOverrides[item.id];
    } else if (item.type === 'text' && item.originalData?.perRatioConfigs && props.aspectRatio) {
      const config = item.originalData.perRatioConfigs[props.aspectRatio];
      if (config?.scale !== undefined) {
        scale = config.scale;
      }
    }

    return scale;
  }

  function getItemStyle(item: TimelineItem) {
    // Calculate relative time within the item
    const relativeTime = props.currentTime - item.startTime;

    // Get scale using shared function
    const scale = getItemScale(item);

    // For rotation, check rotationOverrides first (for live drag feedback),
    // then perRatioConfigs (for persisted per-aspect-ratio rotation),
    // then fall back to item.rotation or AnimationService
    let rotation = AnimationService.getValueAtTime(item, 'rotation', relativeTime, item.rotation ?? 0);
    if (props.rotationOverrides && props.rotationOverrides[item.id] !== undefined) {
      rotation = props.rotationOverrides[item.id];
    } else if (item.type === 'text' && item.originalData?.perRatioConfigs && props.aspectRatio) {
      // For text items, check perRatioConfigs for aspect-ratio specific rotation
      const config = item.originalData.perRatioConfigs[props.aspectRatio];
      if (config?.rotation !== undefined) {
        rotation = config.rotation;
      }
    }

    let positionX = AnimationService.getValueAtTime(item, 'position_x', relativeTime, item.positionX ?? 0.5);
    let positionY = AnimationService.getValueAtTime(item, 'position_y', relativeTime, item.positionY ?? 0.5);

    if (props.positionOverrides && props.positionOverrides[item.id]) {
      positionX = props.positionOverrides[item.id].x;
      positionY = props.positionOverrides[item.id].y;
    }

    const opacity = AnimationService.getValueAtTime(item, 'opacity', relativeTime, item.opacity ?? 1);

    // Position is normalized 0-1 (0% to 100%)
    const x = positionX * 100;
    const y = positionY * 100;

    // Determine width - text items use auto width (scale handles sizing)
    let itemWidth: string = 'auto';
    if (item.type === 'video' && !item.originalData?.isFullFrameOverlay) {
      itemWidth = '100%';
    }
    // Text items always use 'auto' width - sizing is controlled via scale transform

    // Base transform
    const baseStyle = {
      left: `${x}%`,
      top: `${y}%`,
      transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
      opacity: opacity,
      width: itemWidth,
      height: item.type === 'video' && !item.originalData?.isFullFrameOverlay ? '100%' : 'auto',
    };

    // Merge with overrides if present
    if (props.itemStyleOverrides && props.itemStyleOverrides[item.id]) {
      return {
        ...baseStyle,
        ...props.itemStyleOverrides[item.id],
      };
    }

    return baseStyle;
  }

  function getTextStyle(item: TimelineItem) {
    if (item.type !== 'text' || !item.originalData) return {};

    // Get style from perRatioConfigs first, then fall back to default style
    let style = item.originalData.style || {};
    if (item.originalData.perRatioConfigs && props.aspectRatio) {
      const ratioConfig = item.originalData.perRatioConfigs[props.aspectRatio];
      if (ratioConfig?.style) {
        style = { ...style, ...ratioConfig.style };
      }
    }

    const overrides = props.itemStyleOverrides?.[item.id];

    const result: Record<string, any> = {
      fontFamily: overrides?.fontFamily || style.fontFamily,
      fontSize: overrides?.fontSize || (style.fontSize ? `${style.fontSize}px` : undefined),
      fontWeight: overrides?.fontWeight || style.fontWeight,
      color: overrides?.color || style.color || style.textColor,
      textAlign: overrides?.textAlign || style.textAlign || 'center',
      lineHeight: overrides?.lineHeight || style.lineHeight,
      letterSpacing: overrides?.letterSpacing || style.letterSpacing,
    };

    // Shadow (exports via ASS for simple, PNG for advanced)
    if (style.shadowEnabled) {
      const offsetX = style.shadowOffsetX || 2;
      const offsetY = style.shadowOffsetY || 2;
      const blur = style.shadowBlur || 4;
      const color = style.shadowColor || '#000000';
      result.textShadow = `${offsetX}px ${offsetY}px ${blur}px ${color}`;
    }

    // Outer glow effect (advanced - rendered to PNG on export)
    if (style.glow?.enabled) {
      const glowBlur = style.glow.blur || 20;
      const glowColor = style.glow.color || '#ffffff';
      const existingShadow = result.textShadow || '';
      const glowShadow = `0 0 ${glowBlur}px ${glowColor}`;
      result.textShadow = existingShadow ? `${existingShadow}, ${glowShadow}` : glowShadow;
    }

    // Text gradient (advanced - rendered to PNG on export)
    if (style.gradient?.enabled && style.gradient.colors?.length >= 2) {
      const colors = style.gradient.colors
        .sort((a: any, b: any) => a.position - b.position)
        .map((c: any) => `${c.color} ${c.position}%`)
        .join(', ');
      const angle = style.gradient.angle || 90;
      result.background = `linear-gradient(${angle}deg, ${colors})`;
      result.webkitBackgroundClip = 'text';
      result.webkitTextFillColor = 'transparent';
      result.backgroundClip = 'text';
    }

    // Text stroke (exports via ASS)
    if (style.border1Width && style.border1Width > 0) {
      result.webkitTextStroke = `${style.border1Width}px ${style.border1Color || '#000000'}`;
      result.paintOrder = 'stroke fill';
    }

    // Chat bubble styling (advanced - rendered to PNG on export)
    const chatBubble = style.chatBubble;
    if (chatBubble?.enabled) {
      let bubbleRadius = 18;
      switch (chatBubble.shape) {
        case 'rounded':
          bubbleRadius = 18;
          break;
        case 'pointed':
          bubbleRadius = 8;
          break;
        case 'cloud':
          bubbleRadius = 24;
          break;
        case 'square':
          bubbleRadius = 4;
          break;
      }
      result.backgroundColor = style.backgroundColor || '#007AFF';
      result.padding = `${style.padding || 12}px ${(style.padding || 12) * 1.5}px`;
      result.borderRadius = `${bubbleRadius}px`;
      result.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
    } else if (style.backgroundEnabled && style.backgroundColor) {
      // Regular background (exports via ASS box)
      result.backgroundColor = style.backgroundColor;
      result.padding = `${style.padding || 8}px`;
      result.borderRadius = `${style.borderRadius || 4}px`;
    }

    return result;
  }

  function getEffectType(item: TimelineItem): string {
    if (item.type !== 'effect') return '';
    return item.originalData?.effect_type || item.originalData?.type || '';
  }

  function getEffectStyle(item: TimelineItem) {
    const type = getEffectType(item);
    const settings = item.originalData?.settings || {};

    if (type === 'filter') {
      return {
        backdropFilter: getFilterString(settings),
        WebkitBackdropFilter: getFilterString(settings), // Safari support
      };
    }

    if (type === 'blur') {
      const amount = settings.blurAmount ?? 0;
      // AnimationService could be used here for dynamic blur if needed
      return {
        backdropFilter: `blur(${amount}px)`,
        WebkitBackdropFilter: `blur(${amount}px)`,
      };
    }

    // Flash is handled by inner div, but container needs to be full size
    if (type === 'flash') {
      return {
        zIndex: 9999, // Ensure flash is on top
      };
    }

    return {};
  }

  function getFilterString(settings: any): string {
    if (!settings) return 'none';

    const filters: string[] = [];

    // Standard CSS filters
    if (settings.brightness !== undefined && settings.brightness !== 0)
      filters.push(`brightness(${100 + settings.brightness}%)`);
    if (settings.contrast !== undefined && settings.contrast !== 0)
      filters.push(`contrast(${100 + settings.contrast}%)`);
    if (settings.saturation !== undefined && settings.saturation !== 0)
      filters.push(`saturate(${100 + settings.saturation}%)`);
    if (settings.hue !== undefined && settings.hue !== 0) filters.push(`hue-rotate(${settings.hue}deg)`);
    if (settings.sepia !== undefined && settings.sepia !== 0) filters.push(`sepia(${settings.sepia}%)`);
    if (settings.blur !== undefined && settings.blur !== 0) filters.push(`blur(${settings.blur}px)`);
    if (settings.invert !== undefined && settings.invert !== 0) filters.push(`invert(${settings.invert}%)`);
    if (settings.grayscale !== undefined && settings.grayscale !== 0) filters.push(`grayscale(${settings.grayscale}%)`);

    return filters.length > 0 ? filters.join(' ') : 'none';
  }

  function getFlashOpacity(item: TimelineItem): number {
    const settings = item.originalData?.settings || {};
    const intensity = settings.intensity ?? 1;
    const frequency = settings.frequency ?? 1;

    // Calculate relative time
    const relativeTime = props.currentTime - item.startTime;

    // Simple flash pattern: Sine wave based on frequency
    // or single flash? "Flash" usually implies a strobe or a single burst.
    // Let's implement a strobe effect if frequency > 0, otherwise constant opacity (unlikely for flash) or single pulse.

    if (frequency > 0) {
      // Strobe: 0 to intensity
      return ((Math.sin(relativeTime * frequency * Math.PI * 2) + 1) / 2) * intensity;
    }

    return intensity;
  }

  function getChromaKeyStyle(item: TimelineItem): Record<string, string> {
    const settings = item.originalData?.settings || {};
    const keyColor = settings.keyColor || '#00ff00'; // Default green
    const tolerance = settings.tolerance ?? 0.4;
    const softness = settings.softness ?? 0.1;

    // CSS-based chroma key using mix-blend-mode and filters
    // Note: True chroma key requires WebGL/Canvas, this is a CSS approximation
    return {
      backgroundColor: keyColor,
      mixBlendMode: 'difference',
      opacity: String(tolerance),
      filter: `blur(${softness * 10}px)`,
    };
  }

  function getAdjustmentLayerStyle(item: TimelineItem): Record<string, string> {
    const settings = item.originalData?.settings || {};

    // Adjustment layers apply filters to everything below them
    // Using backdrop-filter to affect underlying content
    const filterString = getFilterString(settings);

    // Calculate animated values if keyframes exist
    const relativeTime = props.currentTime - item.startTime;
    const opacity = AnimationService.getValueAtTime(item, 'opacity', relativeTime, item.opacity ?? 1);

    return {
      backdropFilter: filterString,
      WebkitBackdropFilter: filterString,
      opacity: String(opacity),
      // Ensure it covers the full frame
      position: 'absolute',
      inset: '0',
      // Blend mode for adjustment layer
      mixBlendMode: settings.blendMode || 'normal',
    };
  }
</script>
