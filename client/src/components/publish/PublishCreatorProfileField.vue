<script setup lang="ts">
  /**
   * Optional "Creator profile" select used by the single-platform publish
   * dialogs. The model is the profile id as a string; '' means none.
   */
  import { computed } from 'vue';
  import { Field } from '@/components/ui/field';
  import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';

  const NONE = '__none__';

  const props = defineProps<{
    modelValue: string;
    profiles: Array<{ id: number; name: string }>;
    disabled?: boolean;
    id?: string;
  }>();

  const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

  const value = computed({
    get: () => props.modelValue || NONE,
    set: (v: string) => emit('update:modelValue', v === NONE ? '' : v),
  });
</script>

<template>
  <Field :for="id" hint="Associate this post with a creator profile for tracking">
    <template #label>
      Creator profile <span class="font-normal text-fg-subtle">(optional)</span>
    </template>
    <Select v-model="value" :disabled="disabled">
      <SelectTrigger :id="id">
        <SelectValue placeholder="None" />
      </SelectTrigger>
      <SelectContent class="min-w-[var(--reka-select-trigger-width)]">
        <SelectItem :value="NONE">None</SelectItem>
        <SelectSeparator />
        <SelectItem v-for="profile in profiles" :key="profile.id" :value="String(profile.id)">
          {{ profile.name }}
        </SelectItem>
      </SelectContent>
    </Select>
  </Field>
</template>
