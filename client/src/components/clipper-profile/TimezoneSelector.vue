<template>
  <!--
    Timezone picker for clipper profiles. Uses the curated, offset-sorted list
    from utils/timezones (and keeps an existing saved zone selectable). The
    menu is teleported, so it works inside scroll containers and modals.
  -->
  <CustomDropdown
    :model-value="modelValue || null"
    :options="timezones"
    :placeholder="placeholder || 'Select timezone'"
    :size="size"
    @update:model-value="handleChange"
  />
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { getGlobalTimezoneSelectOptions } from '@/utils/timezones';

  const props = defineProps<{
    modelValue: string | null;
    placeholder?: string;
    size?: 'sm' | 'md';
  }>();

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
  }>();

  const timezones = computed(() =>
    getGlobalTimezoneSelectOptions(new Date(), props.modelValue).map(({ value, label }) => ({ value, label }))
  );

  const handleChange = (value: unknown) => {
    if (typeof value === 'string') {
      emit('update:modelValue', value);
    }
  };
</script>
