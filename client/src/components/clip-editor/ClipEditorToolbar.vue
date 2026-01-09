<template>
  <div class="flex items-center gap-0.5 p-1.5 border-b border-white/10 bg-[#0d0d0d]">
    <button
      v-for="tab in activeTabs"
      :key="tab.id"
      @click="handleTabChange(tab.id)"
      :title="tab.label"
      :class="[
        'flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all',
        activeTab === tab.id
          ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2.5'
          : 'text-white/50 hover:text-white hover:bg-white/5 px-2',
      ]"
    >
      <component :is="tab.icon" :size="14" />
      <span class="whitespace-nowrap">{{ tab.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import {
    Music,
    Layers,
    Droplet,
    MessageSquare,
    Sparkles,
    Wand2,
    Download,
    FolderOpen,
  } from 'lucide-vue-next';
  import type { ClipEditorTab, VideoEditorTab } from '@/types';

  const props = withDefaults(
    defineProps<{
      activeTab: ClipEditorTab | VideoEditorTab;
      editorMode?: boolean;
    }>(),
    {
      editorMode: false,
    }
  );

  const emit = defineEmits<{
    (e: 'tabChange', tab: ClipEditorTab | VideoEditorTab): void;
  }>();

  // Consolidated tabs for both modes
  // Media: Sources + Intro/Outro (project-specific media library)
  // Audio: Audio mixer and music
  // Effects: Transitions + Effects
  // Overlays: Text + Stickers
  // Aspect: Aspect Ratio settings
  // Captions: Subtitles + Transcript
  // Watermark: Watermark (kept separate per user request)
  // Export: Export settings
  const tabs = [
    { id: 'media' as const, label: 'Media', icon: FolderOpen },
    { id: 'audio' as const, label: 'Audio', icon: Music },
    { id: 'effects' as const, label: 'Effects', icon: Wand2 },
    { id: 'overlays' as const, label: 'Overlays', icon: Layers },
    { id: 'aspect' as const, label: 'Aspect', icon: Sparkles },
    { id: 'captions' as const, label: 'Captions', icon: MessageSquare },
    { id: 'watermark' as const, label: 'Watermark', icon: Droplet },
    { id: 'export' as const, label: 'Export', icon: Download },
  ];

  const activeTabs = computed(() => {
    return tabs;
  });

  function handleTabChange(tabId: string) {
    emit('tabChange', tabId as ClipEditorTab | VideoEditorTab);
  }
</script>
