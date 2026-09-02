<script setup lang="ts">
  import { LayoutGrid, PanelTop } from 'lucide-vue-next';
  import type { CircleLayout } from './types';

  defineProps<{
    modelValue: CircleLayout;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: CircleLayout];
  }>();
</script>

<template>
  <div
    class="circle-layout-selector inline-flex rounded-lg border border-white/10 bg-black/20 p-0.5"
    role="group"
    aria-label="Circle layout"
  >
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition"
      :class="
        modelValue === 'main_room' ? 'bg-[var(--sidebar-accent)] text-white' : 'text-zinc-400 hover:text-zinc-100'
      "
      @click="emit('update:modelValue', 'main_room')"
    >
      <LayoutGrid class="h-3.5 w-3.5" />
      Main room
    </button>
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition"
      :class="
        modelValue === 'floating_panel' ? 'bg-[var(--sidebar-accent)] text-white' : 'text-zinc-400 hover:text-zinc-100'
      "
      @click="emit('update:modelValue', 'floating_panel')"
    >
      <PanelTop class="h-3.5 w-3.5" />
      Floating panel
    </button>
  </div>
</template>
