<template>
  <div class="border border-white/10 rounded-lg overflow-hidden">
    <button
      @click="isOpen = !isOpen"
      class="w-full flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 transition-colors"
    >
      <div class="flex items-center gap-2">
        <ChevronRight
          :size="14"
          class="text-white/60 transition-transform duration-200"
          :class="isOpen ? 'rotate-90' : ''"
        />
        <span class="text-xs font-medium text-white">{{ title }}</span>
        <span v-if="count !== undefined" class="text-[10px] text-white/40">({{ count }})</span>
      </div>
      <span class="text-[10px] text-white/40">{{ isOpen ? 'Hide' : 'Show' }}</span>
    </button>
    <div v-if="isOpen" class="p-3 bg-black/20">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ChevronRight } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    title: string;
    count?: number;
    defaultOpen?: boolean;
  }>(),
  {
    defaultOpen: false,
  }
);

const isOpen = ref(props.defaultOpen);

watch(() => props.defaultOpen, (newVal) => {
  isOpen.value = newVal;
});
</script>
