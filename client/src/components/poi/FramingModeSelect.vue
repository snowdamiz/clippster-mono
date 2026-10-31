<template>
  <div class="grid grid-cols-2 gap-2">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :disabled="option.value === 'auto' && !available"
      :aria-pressed="modelValue === option.value"
      class="flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      :class="
        modelValue === option.value
          ? 'border-brand-line bg-brand-soft'
          : 'border-line bg-surface hover:border-line-strong'
      "
      @click="$emit('update:modelValue', option.value)"
    >
      <span class="flex items-center gap-2 text-sm font-medium text-fg">
        <component :is="option.icon" class="size-4" />
        {{ option.label }}
        <Badge v-if="option.value === 'auto' && !available">Coming soon</Badge>
      </span>
      <span class="text-xs text-fg-muted">{{ option.description }}</span>
    </button>
  </div>
</template>
<script setup lang="ts">
  import { Sparkles, PencilRuler } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  withDefaults(defineProps<{ modelValue?: 'auto' | 'manual'; available?: boolean }>(), {
    modelValue: 'manual',
    available: false,
  });
  defineEmits<{ 'update:modelValue': [value: 'auto' | 'manual'] }>();
  const options = [
    {
      value: 'auto' as const,
      label: 'Auto',
      icon: Sparkles,
      description: 'Follow faces on your device, then preview and adjust',
    },
    {
      value: 'manual' as const,
      label: 'Manual',
      icon: PencilRuler,
      description: 'Choose source regions and arrange your layout',
    },
  ];
</script>
