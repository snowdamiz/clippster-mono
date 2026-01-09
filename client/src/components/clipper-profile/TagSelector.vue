<template>
  <div class="tag-selector">
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="tag in options"
        :key="tag.value"
        type="button"
        @click="toggleTag(tag.value)"
        class="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
        :class="isSelected(tag.value) 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-muted/50 text-muted-foreground hover:bg-muted'"
      >
        {{ tag.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface TagOption {
  value: string;
  label: string;
}

const props = defineProps<{
  modelValue: string[];
  options: TagOption[];
  max?: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void;
}>();

const isSelected = (value: string) => props.modelValue.includes(value);

const toggleTag = (value: string) => {
  const current = [...props.modelValue];
  const index = current.indexOf(value);
  
  if (index >= 0) {
    current.splice(index, 1);
  } else {
    if (props.max && current.length >= props.max) {
      return;
    }
    current.push(value);
  }
  
  emit('update:modelValue', current);
};
</script>
