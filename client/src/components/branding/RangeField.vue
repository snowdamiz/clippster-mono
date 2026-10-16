<script setup lang="ts">
  /**
   * Labeled range slider row with the current value on the right, used by
   * the branding pickers (opacity, scale) and similar compact settings.
   */
  withDefaults(
    defineProps<{
      label: string;
      modelValue: number;
      min?: number;
      max?: number;
      step?: number;
      suffix?: string;
      disabled?: boolean;
    }>(),
    { min: 0, max: 100, step: 1, suffix: '%' }
  );

  const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
</script>

<template>
  <label class="flex min-w-0 items-center gap-3" :class="{ 'opacity-50': disabled }">
    <span class="w-14 shrink-0 text-xs text-fg-muted">{{ label }}</span>
    <input
      type="range"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      class="min-w-0 flex-1"
      @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
    />
    <span class="tabular w-10 shrink-0 text-right text-xs text-fg">{{ modelValue }}{{ suffix }}</span>
  </label>
</template>
