<script setup lang="ts">
  import { LayoutGrid, PanelTop } from 'lucide-vue-next';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import type { CircleLayout } from './types';

  defineProps<{
    modelValue: CircleLayout;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: CircleLayout];
  }>();

  const options: SegmentedOption<CircleLayout>[] = [
    { value: 'main_room', label: 'Main room', icon: LayoutGrid },
    { value: 'floating_panel', label: 'Floating panel', icon: PanelTop },
  ];
</script>

<template>
  <SegmentedControl
    class="circle-layout-selector"
    aria-label="Circle layout"
    :model-value="modelValue"
    :options="options"
    @update:model-value="(value) => emit('update:modelValue', value)"
  />
</template>
