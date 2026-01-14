<template>
  <div class="aspect-selector">
    <!-- 16:9 Original -->
    <button
      @click="selectRatio('16:9')"
      :class="['ratio-btn', { active: previewAspectRatio === '16:9' }]"
      title="16:9 Original"
    >
      <svg viewBox="0 0 16 9" class="ratio-icon">
        <rect x="0.5" y="0.5" width="15" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1" />
      </svg>
    </button>

    <!-- 9:16 Vertical -->
    <button @click="onRatioClick('9:16')" :class="['ratio-btn', getBtnState('9:16')]" :title="getRatioTooltip('9:16')">
      <svg viewBox="0 0 9 16" class="ratio-icon ratio-icon--tall">
        <rect x="0.5" y="0.5" width="8" height="15" rx="1" fill="none" stroke="currentColor" stroke-width="1" />
      </svg>
      <span v-if="isRatioConfigured('9:16')" class="check-badge"><Check :size="6" /></span>
    </button>

    <!-- 4:5 Portrait -->
    <button @click="onRatioClick('4:5')" :class="['ratio-btn', getBtnState('4:5')]" :title="getRatioTooltip('4:5')">
      <svg viewBox="0 0 12 15" class="ratio-icon ratio-icon--portrait">
        <rect x="0.5" y="0.5" width="11" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1" />
      </svg>
      <span v-if="isRatioConfigured('4:5')" class="check-badge"><Check :size="6" /></span>
    </button>

    <!-- 1:1 Square -->
    <button @click="onRatioClick('1:1')" :class="['ratio-btn', getBtnState('1:1')]" :title="getRatioTooltip('1:1')">
      <svg viewBox="0 0 12 12" class="ratio-icon ratio-icon--square">
        <rect x="0.5" y="0.5" width="11" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1" />
      </svg>
      <span v-if="isRatioConfigured('1:1')" class="check-badge"><Check :size="6" /></span>
    </button>
  </div>
</template>

<script setup lang="ts">
  import { Check } from 'lucide-vue-next';
  import type { ManualFramingConfigs } from '@/types';

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

  function isRatioSelected(ratio: string): boolean {
    return props.selectedAspectRatios.includes(ratio);
  }

  function isRatioConfigured(ratio: string): boolean {
    const config = props.framingConfigs[ratio as keyof ManualFramingConfigs];
    return config !== undefined && config.regions && config.regions.length > 0;
  }

  function getBtnState(ratio: string): Record<string, boolean> {
    return {
      active: props.previewAspectRatio === ratio,
      configured: isRatioConfigured(ratio),
      selected: isRatioSelected(ratio) && !isRatioConfigured(ratio),
    };
  }

  function getRatioTooltip(ratio: string): string {
    if (isRatioConfigured(ratio)) return `${ratio} - Configured`;
    if (isRatioSelected(ratio)) return `${ratio} - Auto`;
    return `Add ${ratio}`;
  }

  function selectRatio(ratio: string) {
    emit('update:previewAspectRatio', ratio);
  }

  function onRatioClick(ratio: string) {
    const isSelected = isRatioSelected(ratio);
    const isConfigured = isRatioConfigured(ratio);
    const isActive = props.previewAspectRatio === ratio;

    if (!isSelected) {
      emit('toggleRatioSelection', ratio);
      emit('openManualEditor', ratio);
    } else if (!isConfigured && isActive) {
      emit('openManualEditor', ratio);
    } else {
      selectRatio(ratio);
    }
  }
</script>

<style scoped>
  .aspect-selector {
    display: flex;
    flex-direction: column;
    align-self: flex-start;
    gap: 4px;
    padding: 4px;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    margin-right: -10px;
  }

  .ratio-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(255, 255, 255, 0.35);
    cursor: pointer;
    transition: all 120ms ease;
  }

  .ratio-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
  }

  .ratio-btn.active {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .ratio-btn.active:hover {
    background: rgba(16, 185, 129, 0.25);
  }

  .ratio-btn.configured {
    color: rgba(16, 185, 129, 0.7);
  }

  .ratio-btn.configured:hover {
    color: #34d399;
  }

  .ratio-btn.selected {
    color: rgba(139, 92, 246, 0.7);
  }

  .ratio-btn.selected:hover {
    color: #a78bfa;
  }

  .ratio-icon {
    width: 16px;
    height: 9px;
  }

  .ratio-icon--tall {
    width: 9px;
    height: 16px;
  }

  .ratio-icon--portrait {
    width: 12px;
    height: 15px;
  }

  .ratio-icon--square {
    width: 12px;
    height: 12px;
  }

  .check-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #10b981;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
