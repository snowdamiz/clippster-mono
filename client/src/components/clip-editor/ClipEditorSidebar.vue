<template>
  <div class="editor-sidebar">
    <div class="editor-sidebar__tabs">
      <button
        v-for="panel in panels"
        :key="panel.id"
        class="editor-sidebar__tab"
        :class="{ 'editor-sidebar__tab--active': activePanel === panel.id }"
        :title="panel.label"
        @click="selectPanel(panel.id)"
      >
        <component :is="panel.icon" :size="20" />
        <span class="editor-sidebar__tab-label">{{ panel.label }}</span>
      </button>
    </div>

    <div class="editor-sidebar__content">
      <!-- Panel content will be rendered here based on activePanel -->
      <div class="editor-sidebar__panel">
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
        <div v-else class="editor-sidebar__panel-body">
          <p class="editor-sidebar__placeholder">{{ currentPanelLabel }} tools coming soon...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { IntroOutroRef } from '@/types';
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
  Video
} from 'lucide-vue-next';

const props = defineProps<{
  activePanel: string;
  editId: string | null;
  currentTime?: number;
  creatorWatermarkId?: string | null;
  creatorWatermarkSettings?: any;
  creatorDefaultIntro?: IntroOutroRef | null;
  creatorDefaultOutro?: IntroOutroRef | null;
}>();

const emit = defineEmits<{
  (e: 'update:activePanel', value: string): void;
  (e: 'panelChange', value: string): void;
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
  emit('update:activePanel', panelId);
  emit('panelChange', panelId);
}
</script>

<style scoped>
.editor-sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background-color: #0d0d0d;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.editor-sidebar__tabs {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  max-height: 50%;
  overflow-y: auto;
}

.editor-sidebar__tab {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.875rem;
  font-weight: 500;
  text-align: left;
}

.editor-sidebar__tab:hover {
  background-color: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.9);
}

.editor-sidebar__tab--active {
  background-color: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.3);
  color: #a78bfa;
}

.editor-sidebar__tab-label {
  flex: 1;
}

.editor-sidebar__content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.editor-sidebar__panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.editor-sidebar__panel-title {
  font-size: 1rem;
  font-weight: 600;
  color: #f4f4f5;
  margin: 0;
}

.editor-sidebar__panel-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.editor-sidebar__placeholder {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.875rem;
  text-align: center;
  padding: 2rem 1rem;
}
</style>

