<template>
  <div class="aspect-ratio-selector">
    <div class="flex gap-1 bg-muted/20 p-1 rounded-lg w-fit">
      <button
        v-for="ratio in aspectRatios"
        :key="ratio.id"
        @click="selectRatio(ratio)"
        :class="[
          'px-3 py-1.5 text-xs font-medium transition-all rounded-md',
          selectedRatioId === ratio.id
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        ]"
        :title="ratio.label"
      >
        {{ ratio.id }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';

  interface AspectRatio {
    id: string;
    label: string;
    width: number;
    height: number;
  }

  const aspectRatios: AspectRatio[] = [
    { id: '16:9', label: '16:9 Landscape', width: 16, height: 9 },
    { id: '9:16', label: '9:16 Vertical', width: 9, height: 16 },
    { id: '1:1', label: '1:1 Square', width: 1, height: 1 },
    { id: '4:5', label: '4:5 Portrait', width: 4, height: 5 },
  ];

  const selectedRatioId = ref<string>('16:9');

  const emit = defineEmits<{
    ratioChanged: [ratio: { width: number; height: number; id: string; label: string }];
  }>();

  function selectRatio(ratio: AspectRatio) {
    selectedRatioId.value = ratio.id;
  }

  // Watch for ratio changes and emit event
  watch(
    selectedRatioId,
    (newRatioId) => {
      const ratio = aspectRatios.find((r) => r.id === newRatioId);
      if (ratio) {
        emit('ratioChanged', {
          width: ratio.width,
          height: ratio.height,
          id: ratio.id,
          label: ratio.label,
        });
      }
    },
    { immediate: true }
  );

  // Expose selected ratio for parent access if needed
  defineExpose({
    selectedRatioId,
    selectedRatio: () => aspectRatios.find((r) => r.id === selectedRatioId.value),
  });
</script>

<style scoped>
  .aspect-ratio-selector {
    @apply flex items-center;
  }

  /* Smooth transitions */
  .transition-all {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }
</style>
