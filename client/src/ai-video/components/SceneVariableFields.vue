<script setup lang="ts">
  import { computed } from 'vue';
  import { Input } from '@/components/ui/input';
  import { sceneTextFields } from '../director/sceneText';
  import type { ShotScene, VariableValue } from '../types';
  const props = defineProps<{ id: string; scene: ShotScene; files?: Record<string, string> }>();
  const emit = defineEmits<{ change: [key: string, value: VariableValue] }>();
  const text = computed(() => sceneTextFields(props.id, props.scene, props.files));
  const styles = computed(() =>
    Object.entries(props.scene.variables).filter(
      ([key, value]) =>
        !key.startsWith('__editor') &&
        !text.value.some((field) => field.key === key) &&
        !String(value).startsWith('media:')
    )
  );
</script>
<template>
  <label v-for="field in text" :key="field.id" class="flex flex-col gap-1 text-xs text-fg-muted">
    {{ field.label }}
    <Input
      :aria-label="field.label"
      :model-value="field.value"
      @update:model-value="(value) => emit('change', field.key, String(value))"
    />
  </label>
  <label v-for="[key, value] in styles" :key="key" class="flex flex-col gap-1 text-xs text-fg-muted">
    {{ key }}
    <input
      v-if="typeof value === 'boolean'"
      type="checkbox"
      :checked="value"
      @change="emit('change', key, ($event.target as HTMLInputElement).checked)"
    />
    <Input
      v-else
      :type="typeof value === 'number' ? 'number' : /^#[\da-f]{3,8}$/i.test(value) ? 'color' : 'text'"
      :model-value="value"
      @update:model-value="(next) => emit('change', key, typeof value === 'number' ? Number(next) : String(next))"
    />
  </label>
</template>
