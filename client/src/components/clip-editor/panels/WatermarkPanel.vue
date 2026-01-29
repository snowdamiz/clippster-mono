<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <h3 class="text-base font-semibold text-zinc-100 m-0">Watermark</h3>
    </div>

    <!-- Creator Default Watermark Info -->
    <div v-if="creatorWatermarkId" class="p-3 bg-blue-500/10 border border-blue-500/30 rounded-md">
      <div class="flex items-center gap-2 text-blue-400 text-xs font-semibold mb-2">
        <Sparkles :size="14" />
        <span>Creator Profile Default</span>
      </div>
      <p class="text-xs text-white/70 m-0 leading-6">
        This clip will use the watermark configured in your creator profile.
      </p>
    </div>

    <!-- Enable/Disable Toggle -->
    <div class="flex flex-col gap-2">
      <label class="flex items-center gap-2 text-sm font-medium text-white/90 cursor-pointer">
        <input v-model="enabled" type="checkbox" class="w-[18px] h-[18px] cursor-pointer" />
        <span>Enable Watermark</span>
      </label>
    </div>

    <!-- Per-Ratio Settings -->
    <div v-if="enabled" class="flex flex-col gap-2">
      <!-- Aspect Ratio Selector -->
      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-white/70">Active Aspect Ratio</label>
        <div class="grid grid-cols-4 gap-1.5">
          <button
            v-for="ratio in aspectRatios"
            :key="ratio"
            class="p-2 bg-white/5 border border-white/10 rounded text-white/70 cursor-pointer transition-all duration-150 text-xs font-medium hover:bg-white/8"
            :class="{ 'bg-blue-500/20 border-blue-500/40 text-blue-400': selectedRatio === ratio }"
            @click="selectedRatio = ratio"
          >
            {{ ratio }}
          </button>
        </div>
      </div>

      <!-- Position Presets -->
      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-white/70">Position Preset</label>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="preset in positionPresets"
            :key="preset.id"
            class="p-2 bg-white/5 border border-white/10 rounded text-white/70 cursor-pointer transition-all duration-150 text-[0.75rem] font-medium hover:bg-blue-500/15 hover:border-blue-500/30 hover:text-blue-400"
            :title="preset.label"
            @click="applyPreset(preset)"
          >
            {{ preset.label }}
          </button>
        </div>
      </div>

      <!-- Manual Position -->
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-2">
          <label class="text-xs font-medium text-white/70">X Position (%)</label>
          <input
            :value="currentConfig.positionX"
            type="number"
            :min="constraints.position.min"
            :max="constraints.position.max"
            class="w-full p-2 bg-white/5 border border-white/10 rounded-md text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-blue-500/50 focus:bg-white/8"
            @input="updateConfig('positionX', parseFloat(($event.target as HTMLInputElement).value))"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-xs font-medium text-white/70">Y Position (%)</label>
          <input
            :value="currentConfig.positionY"
            type="number"
            :min="constraints.position.min"
            :max="constraints.position.max"
            class="w-full p-2 bg-white/5 border border-white/10 rounded-md text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-blue-500/50 focus:bg-white/8"
            @input="updateConfig('positionY', parseFloat(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>

      <!-- Scale -->
      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-white/70">Scale: {{ formatScale(currentConfig.scale) }}</label>
        <input
          :value="currentConfig.scale"
          type="range"
          :min="constraints.scale.min"
          :max="constraints.scale.max"
          step="1"
          class="w-full h-1.5 rounded bg-white/10 outline-none appearance-none [&::-webkit-slider-thumb]:-webkit-appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)] [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
          @input="updateConfig('scale', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>

      <!-- Opacity -->
      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-white/70">Opacity: {{ formatOpacity(currentConfig.opacity) }}</label>
        <input
          :value="currentConfig.opacity"
          type="range"
          :min="constraints.opacity.min"
          :max="constraints.opacity.max"
          step="1"
          class="w-full h-1.5 rounded bg-white/10 outline-none appearance-none [&::-webkit-slider-thumb]:-webkit-appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)] [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
          @input="updateConfig('opacity', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>

      <!-- Time Range -->
      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-white/70">Visibility</label>
        <div class="flex items-center gap-2">
          <input
            :value="currentConfig.startTime"
            type="number"
            :min="constraints.time.min"
            :step="constraints.time.step"
            class="w-full p-2 bg-white/5 border border-white/10 rounded-md text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-blue-500/50 focus:bg-white/8"
            placeholder="Start (s)"
            @input="updateConfig('startTime', parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="text-white/50 text-sm">to</span>
          <input
            :value="currentConfig.endTime"
            type="number"
            :min="constraints.time.min"
            :step="constraints.time.step"
            class="w-full p-2 bg-white/5 border border-white/10 rounded-md text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-blue-500/50 focus:bg-white/8"
            placeholder="End (s)"
            @input="updateConfig('endTime', parseFloat(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>

      <!-- Apply Button -->
      <button
        class="flex items-center justify-center gap-2 p-3 bg-blue-500/15 border border-blue-500/30 rounded-md text-blue-400 cursor-pointer transition-all duration-150 text-sm font-medium hover:bg-blue-500/25 hover:border-blue-500/50"
        @click="handleApply"
      >
        <Save :size="16" />
        <span>Apply Settings</span>
      </button>
    </div>

    <!-- Info -->
    <div class="flex gap-2 p-3 bg-white/3 border border-white/8 rounded-md text-[0.75rem] text-white/60 leading-6">
      <Info :size="14" />
      <p class="m-0">Watermark settings can be configured per aspect ratio for optimal placement.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Sparkles, Info, Save } from 'lucide-vue-next';
  import {
    useWatermarkSettings,
    formatScale,
    formatOpacity,
  } from '@/composables/clip-editor';

  const props = defineProps<{
    creatorWatermarkId: string | null;
    creatorWatermarkSettings: any;
    editId: string | null;
  }>();

  const emit = defineEmits<{
    (e: 'watermarkUpdated'): void;
  }>();

  // Use composable for watermark settings with persistence
  const {
    enabled,
    selectedRatio,
    currentConfig,
    aspectRatios,
    positionPresets,
    constraints,
    isSaving,
    hasUnsavedChanges,
    applyPreset,
    updateConfig,
    saveSettings,
  } = useWatermarkSettings({
    initialEnabled: !!props.creatorWatermarkId,
    initialSettings: props.creatorWatermarkSettings,
    onSettingsChange: () => {
      // Settings changed, will be applied on handleApply
    },
    onSave: async (settings) => {
      // TODO: Implement database persistence when watermark storage is ready
      // Example: await updateWatermarkSettings(props.editId, settings);
      console.log('[WatermarkPanel] Saving watermark settings:', settings);
    },
  });

  async function handleApply() {
    console.log('[WatermarkPanel] Applying watermark settings for', selectedRatio.value);
    await saveSettings();
    emit('watermarkUpdated');
  }
</script>
