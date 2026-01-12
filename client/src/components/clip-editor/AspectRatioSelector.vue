<template>
  <div class="flex items-center gap-2 px-4 py-3 flex-shrink-0 z-10 relative">
    <!-- 16:9 Original (always selected) -->
    <button
      @click="selectRatio('16:9')"
      :class="[
        'flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all border',
        previewAspectRatio === '16:9'
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
          : 'bg-emerald-500/10 text-emerald-300/80 border-emerald-500/30 hover:bg-emerald-500/20',
      ]"
    >
      <div class="w-3.5 h-2 border border-current rounded-[1px]"></div>
      <span>16:9</span>
      <span class="text-[9px] text-emerald-400/70">Original</span>
    </button>

    <!-- Other aspect ratios -->
    <button
      v-for="ratio in otherRatios"
      :key="ratio.value"
      @click="onRatioClick(ratio.value)"
      @mousedown="clearTooltip"
      :class="[
        'group flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-all border relative',
        getRatioButtonClasses(ratio.value),
      ]"
      :title="tooltipVisible ? getRatioTooltip(ratio.value) : ''"
    >
      <!-- Ratio preview shape -->
      <div class="border border-current rounded-[2px]" :style="ratio.style"></div>

      <span>{{ ratio.value }}</span>

      <!-- Status indicator -->
      <span v-if="isRatioConfigured(ratio.value)" class="flex items-center gap-0.5">
        <Check :size="10" class="text-emerald-400" />
        <span class="text-[9px] text-emerald-400/70">{{ getRegionCount(ratio.value) }}</span>
      </span>
      <span v-else-if="isRatioSelected(ratio.value)" class="text-[9px] text-violet-400/70">Auto</span>
      <span v-else class="text-[9px] text-white/30 group-hover:text-white/50">Configure</span>
    </button>

    <!-- Status info (condensed) -->
    <div v-if="selectedAspectRatios.length > 0" class="ml-auto flex items-center gap-2">
      <span class="text-[10px] text-white/30">
        {{ selectedAspectRatios.length }} ratio{{ selectedAspectRatios.length !== 1 ? 's' : '' }} for export
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { Check } from 'lucide-vue-next';
  import type { ManualFramingConfigs } from '@/types';

  // Track tooltip visibility to hide it when opening dialog
  const tooltipVisible = ref(true);

  function clearTooltip() {
    tooltipVisible.value = false;
    // Re-enable tooltip after a short delay (after dialog opens)
    setTimeout(() => {
      tooltipVisible.value = true;
    }, 500);
  }

  interface OtherRatio {
    value: string;
    style: { width: string; height: string };
  }

  const props = defineProps<{
    previewAspectRatio: string;
    selectedAspectRatios: string[];
    framingConfigs: ManualFramingConfigs;
    framingMode: 'auto' | 'manual';
  }>();

  const emit = defineEmits<{
    (e: 'update:previewAspectRatio', ratio: string): void;
    (e: 'openManualEditor', ratio: string): void;
    (e: 'toggleRatioSelection', ratio: string): void;
  }>();

  // Other aspect ratios with their visual shapes
  const otherRatios = computed<OtherRatio[]>(() => [
    { value: '9:16', style: { width: '7px', height: '12px' } },
    { value: '4:5', style: { width: '9px', height: '11px' } },
    { value: '1:1', style: { width: '10px', height: '10px' } },
  ]);

  // Check if ratio is in selectedAspectRatios
  function isRatioSelected(ratio: string): boolean {
    return props.selectedAspectRatios.includes(ratio);
  }

  // Check if ratio has manual config with regions
  function isRatioConfigured(ratio: string): boolean {
    const config = props.framingConfigs[ratio as keyof ManualFramingConfigs];
    return config !== undefined && config.regions && config.regions.length > 0;
  }

  // Get region count for a ratio
  function getRegionCount(ratio: string): string {
    const config = props.framingConfigs[ratio as keyof ManualFramingConfigs];
    if (!config || !config.regions) return '0';
    return `${config.regions.length}`;
  }

  // Get button classes based on state
  function getRatioButtonClasses(ratio: string): string {
    const isActive = props.previewAspectRatio === ratio;
    const isSelected = isRatioSelected(ratio);
    const isConfigured = isRatioConfigured(ratio);

    if (isActive && isConfigured) {
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
    } else if (isActive && isSelected) {
      return 'bg-violet-500/20 text-violet-300 border-violet-500/50';
    } else if (isActive) {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/50';
    } else if (isConfigured) {
      return 'bg-white/5 text-emerald-300/80 border-emerald-500/30 hover:bg-emerald-500/10';
    } else if (isSelected) {
      return 'bg-white/5 text-violet-300/80 border-violet-500/30 hover:bg-violet-500/10';
    } else {
      return 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white/70';
    }
  }

  // Get tooltip for ratio button
  function getRatioTooltip(ratio: string): string {
    const isSelected = isRatioSelected(ratio);
    const isConfigured = isRatioConfigured(ratio);

    if (isConfigured) {
      return `${ratio} configured with manual framing - click to preview`;
    } else if (isSelected) {
      return `${ratio} selected for export with auto framing - click to configure manually`;
    } else {
      return `Click to add ${ratio} and configure framing`;
    }
  }

  // Select ratio for preview
  function selectRatio(ratio: string) {
    emit('update:previewAspectRatio', ratio);
  }

  // Handle click on a non-16:9 ratio
  function onRatioClick(ratio: string) {
    const isSelected = isRatioSelected(ratio);
    const isConfigured = isRatioConfigured(ratio);
    const isActive = props.previewAspectRatio === ratio;

    if (!isSelected) {
      // Not selected yet - add to selection and open manual editor
      emit('toggleRatioSelection', ratio);
      emit('openManualEditor', ratio);
    } else if (!isConfigured && isActive) {
      // Already active and selected but not configured - open manual editor
      emit('openManualEditor', ratio);
    } else {
      // Already selected - just switch preview
      selectRatio(ratio);
    }
  }
</script>
