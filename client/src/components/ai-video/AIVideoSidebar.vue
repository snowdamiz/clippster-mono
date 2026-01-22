<template>
  <div class="flex flex-col h-full bg-zinc-950 border-r border-zinc-800">
    <div class="flex border-b border-zinc-800">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="[
          'flex-1 px-4 py-3 text-sm font-medium transition-colors',
          activeTab === tab.id
            ? 'text-white border-b-2 border-blue-500'
            : 'text-zinc-400 hover:text-zinc-200'
        ]"
      >
        <component :is="tab.icon" class="w-4 h-4 inline mr-2" />
        {{ tab.label }}
      </button>
    </div>

    <div class="flex-1 overflow-hidden">
      <MediaLibraryPanel
        v-if="activeTab === 'media'"
        :media="media"
        @import-local="$emit('importLocal')"
        @open-asset-picker="$emit('openAssetPicker')"
        @open-clip-picker="$emit('openClipPicker')"
        @remove-media="$emit('removeMedia', $event)"
      />

      <PromptPanel
        v-else-if="activeTab === 'prompt'"
        :prompt="prompt"
        :aspect-ratio="aspectRatio"
        :duration="duration"
        :style="style"
        :has-media="hasMedia"
        :is-generating="isGenerating"
        @update:prompt="$emit('update:prompt', $event)"
        @update:aspect-ratio="$emit('update:aspectRatio', $event)"
        @update:duration="$emit('update:duration', $event)"
        @update:style="$emit('update:style', $event)"
        @generate="$emit('generate')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { FolderOpen, Wand2 } from 'lucide-vue-next';
import MediaLibraryPanel from './MediaLibraryPanel.vue';
import PromptPanel from './PromptPanel.vue';
import type { AIVideoMediaItem } from '@/types/ai-video';

defineProps<{
  media: AIVideoMediaItem[];
  prompt: string;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
  duration: number;
  style: string;
  hasMedia: boolean;
  isGenerating: boolean;
}>();

defineEmits<{
  (e: 'importLocal'): void;
  (e: 'openAssetPicker'): void;
  (e: 'openClipPicker'): void;
  (e: 'removeMedia', id: string): void;
  (e: 'update:prompt', value: string): void;
  (e: 'update:aspectRatio', value: '16:9' | '9:16' | '1:1' | '4:5'): void;
  (e: 'update:duration', value: number): void;
  (e: 'update:style', value: string): void;
  (e: 'generate'): void;
}>();

const activeTab = ref<'media' | 'prompt'>('media');

const tabs = [
  { id: 'media' as const, label: 'Media', icon: FolderOpen },
  { id: 'prompt' as const, label: 'Prompt', icon: Wand2 },
];
</script>
