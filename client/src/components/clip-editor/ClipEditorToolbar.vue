<template>
  <div class="flex items-center gap-0.5 p-1.5 border-b border-white/10 bg-[#0d0d0d]">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      @click="emit('tabChange', tab.id)"
      :title="tab.label"
      :class="[
        'flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all',
        activeTab === tab.id
          ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2.5'
          : 'text-white/50 hover:text-white hover:bg-white/5 px-2',
      ]"
    >
      <component :is="tab.icon" :size="14" />
      <span v-if="activeTab === tab.id" class="whitespace-nowrap">{{ tab.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
  import { Music, Palette, Type, Sticker, Sparkles, Crop, FileText, Droplet, Captions } from 'lucide-vue-next';
  import type { ClipEditorTab } from '@/types';

  defineProps<{
    activeTab: ClipEditorTab;
  }>();

  const emit = defineEmits<{
    (e: 'tabChange', tab: ClipEditorTab): void;
  }>();

  const tabs = [
    { id: 'audio' as const, label: 'Audio', icon: Music },
    { id: 'filters' as const, label: 'Filters', icon: Palette },
    { id: 'text' as const, label: 'Text', icon: Type },
    { id: 'stickers' as const, label: 'Stickers', icon: Sticker },
    { id: 'watermark' as const, label: 'Watermark', icon: Droplet },
    { id: 'subtitles' as const, label: 'Subtitles', icon: Captions },
    { id: 'aspect' as const, label: 'Aspect', icon: Crop },
    { id: 'transcript' as const, label: 'Transcript', icon: FileText },
  ];
</script>
