<template>
  <div 
    class="w-14 shrink-0 flex flex-row bg-[var(--editor-surface)] border-r border-[var(--editor-border)] transition-[width] duration-300 ease-in-out" 
    :class="{ '!w-[336px]': activePanel }"
  >
    <div class="flex flex-col gap-1 p-2 w-14 shrink-0 overflow-y-auto">
      <button
        v-for="panel in panels"
        :key="panel.id"
        class="relative flex items-center justify-center w-10 h-10 bg-transparent border-none rounded-lg text-[var(--editor-text-muted)] cursor-pointer transition-all duration-150 ease-in-out hover:bg-white/10 hover:text-[var(--editor-text)]"
        :class="{ 'bg-sky-500/15 text-[var(--editor-accent)] shadow-[inset_0_0_0_1px_rgba(14,165,233,0.3)]': activePanel === panel.id }"
        :title="panel.label"
        @click="selectPanel(panel.id)"
      >
        <component :is="panel.icon" :size="20" />
        <span class="hidden">{{ panel.label }}</span>
      </button>
    </div>

    <div v-if="activePanel" class="w-[280px] shrink-0 bg-[var(--editor-surface-elevated)] border-r border-[var(--editor-border)] overflow-y-auto flex flex-col">
      <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--editor-border)] shrink-0">
        <h3 class="text-[0.875rem] font-semibold text-[var(--editor-text)] uppercase tracking-wider">{{ currentPanelLabel }}</h3>
        <button 
          class="flex items-center justify-center w-6 h-6 bg-transparent border-none rounded text-[var(--editor-text-muted)] cursor-pointer transition-all duration-150 ease-in-out hover:bg-white/10 hover:text-[var(--editor-text)]" 
          @click="closePanel" 
          title="Close panel"
        >
          <X :size="16" />
        </button>
      </div>
      <!-- Panel content will be rendered here based on activePanel -->
      <div class="flex flex-col gap-4 p-4 overflow-y-auto flex-1">
        <!-- Media Panel -->
        <MediaPanel
          v-if="activePanel === 'media'"
          :edit-id="editId"
          :project-id="projectId"
          @mediaAdded="$emit('mediaAdded', $event)"
          @mediaUpdated="$emit('mediaUpdated')"
        />

        <!-- Audio Panel -->
        <AudioPanel
          v-if="activePanel === 'audio'"
          :edit-id="editId"
          @detachAudio="$emit('detachAudio')"
          @tracksUpdated="$emit('tracksUpdated')"
        />

        <!-- Text Panel -->
        <TextPanel
          v-else-if="activePanel === 'text'"
          :edit-id="editId"
          :current-time="currentTime"
          @textAdded="$emit('textAdded', $event)"
          @textSelected="$emit('textSelected', $event)"
          @textsUpdated="$emit('textsUpdated')"
        />

        <!-- Stickers Panel -->
        <StickersPanel
          v-else-if="activePanel === 'stickers'"
          :edit-id="editId"
          :current-time="currentTime"
          @stickerAdded="$emit('stickerAdded', $event)"
          @stickerSelected="$emit('stickerSelected', $event)"
          @stickersUpdated="$emit('stickersUpdated')"
        />

        <!-- Watermark Panel -->
        <WatermarkPanel
          v-else-if="activePanel === 'watermark'"
          :creator-watermark-id="creatorWatermarkId"
          :creator-watermark-settings="creatorWatermarkSettings"
          :edit-id="editId"
          @watermarkUpdated="$emit('watermarkUpdated')"
        />

        <!-- Intro/Outro Panel -->
        <IntroOutroPanel
          v-else-if="activePanel === 'intro'"
          :creator-default-intro="creatorDefaultIntro"
          :creator-default-outro="creatorDefaultOutro"
          @introToggled="$emit('introToggled', $event)"
          @outroToggled="$emit('outroToggled', $event)"
        />

        <!-- Framing Panel -->
        <FramingPanel
          v-else-if="activePanel === 'framing'"
          :edit-id="editId"
          @ratiosChanged="$emit('ratiosChanged', $event)"
          @framingModeChanged="$emit('framingModeChanged', $event)"
          @openFramingEditor="$emit('openFramingEditor')"
        />

        <!-- Placeholder for other panels -->
        <div v-else class="flex flex-col gap-3">
          <p class="text-[var(--editor-text-muted)] text-sm text-center py-8 px-4">{{ currentPanelLabel }} tools coming soon...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { IntroOutroRef } from '@/types';
import MediaPanel from './panels/MediaPanel.vue';
import AudioPanel from './panels/AudioPanel.vue';
import TextPanel from './panels/TextPanel.vue';
import StickersPanel from './panels/StickersPanel.vue';
import WatermarkPanel from './panels/WatermarkPanel.vue';
import IntroOutroPanel from './panels/IntroOutroPanel.vue';
import FramingPanel from './panels/FramingPanel.vue';
import { 
  Film, 
  Music, 
  Type, 
  Smile, 
  Sparkles, 
  ArrowLeftRight, 
  Sliders, 
  Palette,
  Crop,
  Image,
  Video,
  X
} from 'lucide-vue-next';

const props = withDefaults(defineProps<{
  activePanel: string;
  editId: string | null;
  projectId?: string | null;
  currentTime?: number;
  creatorWatermarkId?: string | null;
  creatorWatermarkSettings?: any;
  creatorDefaultIntro?: IntroOutroRef | null;
  creatorDefaultOutro?: IntroOutroRef | null;
  hasInspector?: boolean;
}>(), {
  projectId: null,
  creatorWatermarkId: null,
  creatorDefaultIntro: null,
  creatorDefaultOutro: null,
});

const emit = defineEmits<{
  (e: 'update:activePanel', value: string): void;
  (e: 'panelChange', value: string): void;
  (e: 'mediaAdded', mediaId: string): void;
  (e: 'mediaUpdated'): void;
  (e: 'detachAudio'): void;
  (e: 'tracksUpdated'): void;
  (e: 'textAdded', textId: string): void;
  (e: 'textSelected', text: any): void;
  (e: 'textsUpdated'): void;
  (e: 'stickerAdded', stickerId: string): void;
  (e: 'stickerSelected', sticker: any): void;
  (e: 'stickersUpdated'): void;
  (e: 'watermarkUpdated'): void;
  (e: 'introToggled', enabled: boolean): void;
  (e: 'outroToggled', enabled: boolean): void;
  (e: 'ratiosChanged', ratios: string[]): void;
  (e: 'framingModeChanged', mode: string): void;
  (e: 'openFramingEditor'): void;
}>();

const panels = [
  { id: 'media', label: 'Media', icon: Film },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'stickers', label: 'Stickers', icon: Smile },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'transitions', label: 'Transitions', icon: ArrowLeftRight },
  { id: 'filters', label: 'Filters', icon: Palette },
  { id: 'adjust', label: 'Adjust', icon: Sliders },
  { id: 'framing', label: 'Framing', icon: Crop },
  { id: 'watermark', label: 'Watermark', icon: Image },
  { id: 'intro', label: 'Intro/Outro', icon: Video },
];

const currentPanelLabel = computed(() => {
  const panel = panels.find(p => p.id === props.activePanel);
  return panel?.label || 'Unknown';
});

function selectPanel(panelId: string) {
  // Clicking the same tab always closes the panel
  if (props.activePanel === panelId) {
    emit('update:activePanel', '');
    emit('panelChange', '');
  } else {
    emit('update:activePanel', panelId);
    emit('panelChange', panelId);
  }
}

function closePanel() {
  emit('update:activePanel', '');
  emit('panelChange', '');
}
</script>



