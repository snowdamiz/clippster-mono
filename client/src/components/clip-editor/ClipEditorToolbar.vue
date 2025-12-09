<template>
  <div class="flex items-center gap-1 p-2 border-b border-white/10 bg-[#0d0d0d]">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      @click="emit('tabChange', tab.id)"
      :class="[
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
        activeTab === tab.id
          ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
          : 'text-white/60 hover:text-white hover:bg-white/5',
      ]"
    >
      <component :is="tab.icon" :size="16" />
      <span>{{ tab.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
  import { Music, Palette, Type, Sticker, Sparkles } from 'lucide-vue-next';
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
    { id: 'effects' as const, label: 'Effects', icon: Sparkles },
  ];
</script>
