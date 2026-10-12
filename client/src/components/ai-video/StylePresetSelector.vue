<template>
  <div class="grid grid-cols-2 gap-1.5">
    <button
      v-for="pack in AI_VIDEO_STYLE_PACKS"
      :key="pack.id"
      type="button"
      class="flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
      :class="
        modelValue === pack.id
          ? 'border-brand-line bg-brand-soft'
          : 'border-line-subtle bg-surface hover:border-line-strong hover:bg-surface-hover'
      "
      :aria-pressed="modelValue === pack.id"
      @click="selectPreset(pack.id)"
    >
      <span class="text-xs font-medium leading-4" :class="modelValue === pack.id ? 'text-brand' : 'text-fg'">
        {{ pack.name }}
      </span>
      <span class="text-2xs leading-[14px] text-fg-subtle">{{ pack.description }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
  import type { StylePackId } from '@/types/ai-video';
  import { AI_VIDEO_STYLE_PACKS } from '@/data/ai-video-style-packs';

  defineProps<{
    modelValue: StylePackId | null;
  }>();

  const emit = defineEmits<{
    (e: 'update:modelValue', value: StylePackId): void;
  }>();

  function selectPreset(id: StylePackId) {
    emit('update:modelValue', id);
  }
</script>
