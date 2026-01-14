<template>
  <div class="clip-editor-toolbar">
    <button
      v-for="tab in activeTabs"
      :key="tab.id"
      @click="handleTabChange(tab.id)"
      :title="tab.label"
      :class="['clip-editor-toolbar__tab', activeTab === tab.id ? 'clip-editor-toolbar__tab--active' : '']"
    >
      <component :is="tab.icon" :size="14" />
      <span class="clip-editor-toolbar__tab-label">{{ tab.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { Music, Layers, Droplet, MessageSquare, Sparkles, Wand2, Download, FolderOpen } from 'lucide-vue-next';
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

<style scoped>
  .clip-editor-toolbar {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem;
    border-bottom: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.08));
    background-color: rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
  }

  .clip-editor-toolbar__tab {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    background: transparent;
    border: 1px solid transparent;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .clip-editor-toolbar__tab:hover {
    color: rgba(255, 255, 255, 0.9);
    background-color: rgba(255, 255, 255, 0.05);
  }

  .clip-editor-toolbar__tab--active {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.15) 100%);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #a78bfa;
    padding: 0.375rem 0.625rem;
  }

  .clip-editor-toolbar__tab-label {
    white-space: nowrap;
  }
</style>
