<script setup lang="ts">
  /**
   * Caption / description textarea with a character counter and an optional
   * validation message (e.g. too many hashtags).
   */
  import { computed } from 'vue';
  import { Field } from '@/components/ui/field';
  import { Textarea } from '@/components/ui/textarea';

  const props = withDefaults(
    defineProps<{
      modelValue: string;
      label?: string;
      placeholder?: string;
      maxlength: number;
      rows?: number;
      disabled?: boolean;
      /** Validation message shown on the left of the counter. */
      error?: string | null;
      id?: string;
    }>(),
    { label: 'Caption', placeholder: 'Add a caption for your post…', rows: 3 }
  );

  const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

  const value = computed({
    get: () => props.modelValue,
    set: (v: string | number) => emit('update:modelValue', String(v)),
  });
  const over = computed(() => props.modelValue.length > props.maxlength);
</script>

<template>
  <Field :label="label" :for="id">
    <Textarea
      :id="id"
      v-model="value"
      :rows="rows"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :disabled="disabled"
      class="min-h-0 resize-none"
    />
    <div class="flex items-center justify-between gap-3 text-xs">
      <span v-if="error" class="text-danger">{{ error }}</span>
      <span class="tabular ml-auto" :class="over ? 'text-danger' : 'text-fg-subtle'">
        {{ modelValue.length.toLocaleString() }} / {{ maxlength.toLocaleString() }}
      </span>
    </div>
  </Field>
</template>
