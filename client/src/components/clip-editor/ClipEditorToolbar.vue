<template>
  <div class="toolbar">
    <!-- Tab buttons -->
    <nav class="toolbar__nav">
      <button
        v-for="tab in activeTabs"
        :key="tab.id"
        @click="handleTabChange(tab.id)"
        :title="tab.label"
        :class="['toolbar__tab', activeTab === tab.id && 'toolbar__tab--active']"
      >
        <span class="toolbar__tab-indicator"></span>
        <component :is="tab.icon" :size="18" class="toolbar__tab-icon" />
        <span class="toolbar__tab-label">{{ tab.label }}</span>
      </button>
    </nav>
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
  /* ===== Container ===== */
  .toolbar {
    display: flex;
    flex-direction: column;
    width: 64px;
    min-width: 70px;
    height: 100%;
    background-color: var(--sidebar-surface, #141416);
    border-right: 1px solid var(--sidebar-border, #1f1f23);
    flex-shrink: 0;
  }

  /* ===== Navigation ===== */
  .toolbar__nav {
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 6px 5px;
    flex: 1;
  }

  /* ===== Tab Button ===== */
  .toolbar__tab {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 5px;
    border-radius: 4px;
    background: transparent;
    border: none;
    color: var(--sidebar-text-muted, #71717a);
    cursor: pointer;
    transition: all 150ms ease;
    overflow: hidden;
  }

  .toolbar__tab:hover {
    color: var(--sidebar-text, #fafafa);
    background-color: var(--sidebar-hover, rgba(255, 255, 255, 0.05));
  }

  .toolbar__tab:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.3);
  }

  /* ===== Active Tab State ===== */
  .toolbar__tab--active {
    color: var(--sidebar-accent, #0ea5e9);
    background: linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(6, 182, 212, 0.08) 100%);
  }

  .toolbar__tab--active:hover {
    color: var(--sidebar-accent, #0ea5e9);
    background: linear-gradient(135deg, rgba(14, 165, 233, 0.2) 0%, rgba(6, 182, 212, 0.12) 100%);
  }

  /* ===== Left Accent Indicator ===== */
  .toolbar__tab-indicator {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 0;
    background: linear-gradient(180deg, var(--sidebar-accent, #0ea5e9), rgba(6, 182, 212, 0.6));
    border-radius: 0 2px 2px 0;
    transition: height 150ms ease;
  }

  .toolbar__tab--active .toolbar__tab-indicator {
    height: 60%;
  }

  /* ===== Icon ===== */
  .toolbar__tab-icon {
    flex-shrink: 0;
    transition: transform 150ms ease;
  }

  .toolbar__tab:hover .toolbar__tab-icon {
    transform: scale(1.05);
  }

  .toolbar__tab--active .toolbar__tab-icon {
    filter: drop-shadow(0 0 4px rgba(14, 165, 233, 0.4));
  }

  /* ===== Label ===== */
  .toolbar__tab-label {
    font-size: 0.58rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    text-align: center;
    white-space: nowrap;
    line-height: 1.2;
  }

  /* ===== Compact Mode (Icon Only) ===== */
  @media (max-height: 950px) {
    .toolbar {
      width: 44px;
      min-width: 44px;
    }

    .toolbar__nav {
      padding: 4px;
      gap: 0;
    }

    .toolbar__tab {
      padding: 8px 4px;
      gap: 0;
    }

    .toolbar__tab-label {
      display: none;
    }

    .toolbar__tab-indicator {
      height: 0;
    }

    .toolbar__tab--active .toolbar__tab-indicator {
      height: 50%;
    }
  }
</style>
