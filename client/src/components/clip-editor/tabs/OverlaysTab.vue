<template>
  <div class="space-y-4">
    <!-- Sub-tabs -->
    <div class="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
      <button
        @click="activeSubTab = 'text'"
        :class="[
          'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5',
          activeSubTab === 'text'
            ? 'bg-violet-500/20 text-violet-300'
            : 'text-white/50 hover:text-white/70',
        ]"
      >
        <Type :size="12" />
        Text
      </button>
      <button
        @click="activeSubTab = 'stickers'"
        :class="[
          'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5',
          activeSubTab === 'stickers'
            ? 'bg-violet-500/20 text-violet-300'
            : 'text-white/50 hover:text-white/70',
        ]"
      >
        <Sticker :size="12" />
        Stickers
      </button>
    </div>

    <!-- Text Sub-tab -->
    <TextOverlayTab
      v-if="activeSubTab === 'text'"
      :text-overlays="textOverlays"
      :current-time="currentTime"
      :duration="duration"
      :preview-aspect-ratio="previewAspectRatio"
      :selected-aspect-ratios="selectedAspectRatios"
      :framing-configs="framingConfigs"
      @add-text="(text: string, style: TextOverlayStyle) => emit('addText', text, style)"
      @update-text="(overlayId: string, updates: Partial<TextOverlay>) => emit('updateText', overlayId, updates)"
      @delete-text="(overlayId: string) => emit('deleteText', overlayId)"
      @update:preview-aspect-ratio="(ratio: string) => emit('update:previewAspectRatio', ratio)"
    />

    <!-- Stickers Sub-tab -->
    <StickersTab
      v-if="activeSubTab === 'stickers'"
      :stickers="stickers"
      :current-time="currentTime"
      :duration="duration"
      :preview-aspect-ratio="previewAspectRatio"
      :selected-aspect-ratios="selectedAspectRatios"
      :framing-configs="framingConfigs"
      :video-dimensions="videoDimensions"
      @add-sticker="(path: string, type: 'image' | 'emoji' | 'gif', options?: any) => emit('addSticker', path, type, options)"
      @update-sticker="(stickerId: string, updates: Partial<StickerType>) => emit('updateSticker', stickerId, updates)"
      @delete-sticker="(stickerId: string) => emit('deleteSticker', stickerId)"
      @update:preview-aspect-ratio="(ratio: string) => emit('update:previewAspectRatio', ratio)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Type, Sticker } from 'lucide-vue-next';
import type { TextOverlay, Sticker as StickerType, ManualFramingConfigs, TextOverlayStyle } from '@/types';
import TextOverlayTab from './TextOverlayTab.vue';
import StickersTab from './StickersTab.vue';

defineProps<{
  textOverlays: TextOverlay[];
  stickers: StickerType[];
  currentTime: number;
  duration: number;
  previewAspectRatio: string;
  selectedAspectRatios: string[];
  framingConfigs: ManualFramingConfigs;
  videoDimensions: { width: number; height: number };
}>();

// Match the exact signatures from the original tab components
const emit = defineEmits<{
  (e: 'addText', text: string, style: TextOverlayStyle): void;
  (e: 'updateText', overlayId: string, updates: Partial<TextOverlay>): void;
  (e: 'deleteText', overlayId: string): void;
  (e: 'addSticker', stickerPath: string, type: 'image' | 'emoji' | 'gif', options?: { scale?: number; position?: { x: number; y: number } }): void;
  (e: 'updateSticker', stickerId: string, updates: Partial<StickerType>): void;
  (e: 'deleteSticker', stickerId: string): void;
  (e: 'update:previewAspectRatio', ratio: string): void;
}>();

const activeSubTab = ref<'text' | 'stickers'>('text');
</script>
