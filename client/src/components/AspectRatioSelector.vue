<template>
  <div class="aspect-ratio-selector">
    <div class="flex gap-0.5 bg-black/40 backdrop-blur-sm p-1 rounded-lg border border-white/[0.06] w-fit">
      <button
        v-for="ratio in aspectRatios"
        :key="ratio.id"
        @click="selectRatio(ratio)"
        :class="[
          'relative px-3 py-1.5 text-xs font-medium transition-all duration-200 rounded-md flex items-center gap-1.5',
          selectedRatioId === ratio.id
            ? 'bg-gradient-to-r from-violet-500/90 to-purple-600/90 text-white shadow-lg shadow-violet-500/20'
            : 'text-white/50 hover:text-white/80 hover:bg-white/[0.06]',
        ]"
        :title="ratio.label"
      >
        <!-- Ratio visual indicator -->
        <div
          class="flex items-center justify-center transition-colors duration-200"
          :class="selectedRatioId === ratio.id ? 'text-white/90' : 'text-white/40'"
        >
          <div
            class="border rounded-sm transition-all duration-200"
            :class="[selectedRatioId === ratio.id ? 'border-white/60' : 'border-current', getRatioBoxClass(ratio.id)]"
          ></div>
        </div>
        <span class="tabular-nums">{{ ratio.id }}</span>
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

  function getRatioBoxClass(ratioId: string): string {
    switch (ratioId) {
      case '16:9':
        return 'w-4 h-2.5';
      case '9:16':
        return 'w-2 h-3.5';
      case '1:1':
        return 'w-3 h-3';
      case '4:5':
        return 'w-2.5 h-3';
      default:
        return 'w-3 h-2';
    }
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
