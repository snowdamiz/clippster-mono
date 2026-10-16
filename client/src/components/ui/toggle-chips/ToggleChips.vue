<script setup lang="ts">
  /**
   * Wrapping row of multi-select pill chips (tags, platforms, languages,
   * tiers, payment methods, ...). `v-model` is the array of selected values.
   *
   *   <ToggleChips v-model="profile.languages" :options="languageOptions" label="Languages" />
   *   <ToggleChips v-model="tags" :options="TAGS" :max="5" />
   *
   * Also emits `toggle` with the clicked value, for callers that keep their
   * own add/remove logic:
   *
   *   <ToggleChips :model-value="form.allowed_tiers" :options="tiers" @toggle="toggleTier" />
   *
   * With `max`, unselected chips are disabled once that many are selected.
   * For a single on/off filter button in a toolbar use `FilterToggle`
   * (components/directory) instead.
   */
  import { computed } from 'vue';
  import { Check } from 'lucide-vue-next';

  const props = withDefaults(
    defineProps<{
      modelValue?: ReadonlyArray<string> | null;
      options: ReadonlyArray<{ value: string; label: string }>;
      /** Maximum number of selected values. */
      max?: number;
      disabled?: boolean;
      /** Accessible name for the group. */
      label?: string;
      /** Show a check icon on selected chips. */
      checkmark?: boolean;
    }>(),
    { modelValue: () => [], checkmark: true }
  );

  const emit = defineEmits<{
    'update:modelValue': [value: string[]];
    toggle: [value: string];
  }>();

  const selected = computed(() => props.modelValue ?? []);
  const atMax = computed(() => !!props.max && selected.value.length >= props.max);
  const isSelected = (value: string) => selected.value.includes(value);

  function toggle(value: string) {
    const on = isSelected(value);
    if (!on && atMax.value) return;
    emit('toggle', value);
    emit('update:modelValue', on ? selected.value.filter((v) => v !== value) : [...selected.value, value]);
  }
</script>

<template>
  <div class="flex flex-wrap gap-1.5" role="group" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-pressed="isSelected(option.value)"
      :disabled="disabled || (!isSelected(option.value) && atMax)"
      class="inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45"
      :class="
        isSelected(option.value)
          ? 'border-brand-line bg-brand-soft text-brand hover:bg-[var(--brand-soft-hover)]'
          : 'border-line bg-surface-raised text-fg-muted hover:border-line-strong hover:text-fg'
      "
      @click="toggle(option.value)"
    >
      <Check v-if="checkmark && isSelected(option.value)" class="size-3 shrink-0" />
      {{ option.label }}
    </button>
  </div>
</template>
