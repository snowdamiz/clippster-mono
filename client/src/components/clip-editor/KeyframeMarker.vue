<template>
  <div 
    class="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rotate-45 border border-gray-600 hover:bg-amber-400 hover:border-amber-600 cursor-pointer z-30 shadow-sm transition-colors duration-150"
    :class="{ 'bg-amber-400 border-amber-600 scale-125': isSelected }"
    @mousedown.stop="$emit('mousedown', $event)"
    @click.stop="$emit('click', $event)"
    :title="`Keyframe: ${property} = ${value}`"
  >
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isSelected?: boolean;
  property: string;
  value: number;
}>();

defineEmits<{
  (e: 'mousedown', event: MouseEvent): void;
  (e: 'click', event: MouseEvent): void;
}>();
</script>
