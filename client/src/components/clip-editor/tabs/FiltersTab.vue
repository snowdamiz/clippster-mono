<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-white mb-3">Filters & Color</h3>
      <p class="text-xs text-white/50 mb-4">Apply visual filters and adjust color settings.</p>
    </div>

    <!-- Filter Presets -->
    <div>
      <h4 class="text-sm font-medium text-white mb-3">Presets</h4>
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="preset in filterPresets"
          :key="preset.id"
          @click="selectPreset(preset.id)"
          :class="[
            'p-2 rounded-lg border transition-all',
            currentSettings?.preset === preset.id
              ? 'border-violet-500 bg-violet-500/20'
              : 'border-white/10 bg-white/5 hover:border-white/20',
          ]"
        >
          <div class="w-full aspect-square rounded bg-gradient-to-br mb-1" :style="preset.preview" />
          <span class="text-xs text-white/70">{{ preset.name }}</span>
        </button>
      </div>
    </div>

    <!-- Manual Adjustments -->
    <div class="border-t border-white/10 pt-4">
      <h4 class="text-sm font-medium text-white mb-3">Adjustments</h4>
      <div class="space-y-4">
        <!-- Brightness -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs text-white/60">Brightness</label>
            <span class="text-xs text-white/40">{{ currentSettings?.brightness || 0 }}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            :value="currentSettings?.brightness || 0"
            @input="(e) => updateSetting('brightness', e)"
            class="w-full accent-violet-500"
          />
        </div>

        <!-- Contrast -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs text-white/60">Contrast</label>
            <span class="text-xs text-white/40">{{ currentSettings?.contrast || 0 }}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            :value="currentSettings?.contrast || 0"
            @input="(e) => updateSetting('contrast', e)"
            class="w-full accent-violet-500"
          />
        </div>

        <!-- Saturation -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs text-white/60">Saturation</label>
            <span class="text-xs text-white/40">{{ currentSettings?.saturation || 0 }}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            :value="currentSettings?.saturation || 0"
            @input="(e) => updateSetting('saturation', e)"
            class="w-full accent-violet-500"
          />
        </div>

        <!-- Hue -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs text-white/60">Hue</label>
            <span class="text-xs text-white/40">{{ currentSettings?.hue || 0 }}°</span>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            :value="currentSettings?.hue || 0"
            @input="(e) => updateSetting('hue', e)"
            class="w-full accent-violet-500"
          />
        </div>

        <!-- Temperature -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs text-white/60">Temperature</label>
            <span class="text-xs text-white/40">{{ currentSettings?.temperature || 0 }}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            :value="currentSettings?.temperature || 0"
            @input="(e) => updateSetting('temperature', e)"
            class="w-full accent-violet-500"
          />
        </div>

        <!-- Vignette -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs text-white/60">Vignette</label>
            <span class="text-xs text-white/40">{{ currentSettings?.vignette || 0 }}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            :value="currentSettings?.vignette || 0"
            @input="(e) => updateSetting('vignette', e)"
            class="w-full accent-violet-500"
          />
        </div>

        <!-- Sharpen -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs text-white/60">Sharpen</label>
            <span class="text-xs text-white/40">{{ currentSettings?.sharpen || 0 }}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            :value="currentSettings?.sharpen || 0"
            @input="(e) => updateSetting('sharpen', e)"
            class="w-full accent-violet-500"
          />
        </div>

        <!-- Fade -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs text-white/60">Fade</label>
            <span class="text-xs text-white/40">{{ currentSettings?.fade || 0 }}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            :value="currentSettings?.fade || 0"
            @input="(e) => updateSetting('fade', e)"
            class="w-full accent-violet-500"
          />
        </div>
      </div>
    </div>

    <!-- Reset Button -->
    <button
      @click="resetFilters"
      class="w-full py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
    >
      Reset to Default
    </button>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { FilterSettings, FilterPreset } from '@/types';

  const props = defineProps<{
    filterSettings: FilterSettings | null;
  }>();

  const emit = defineEmits<{
    (e: 'updateFilter', settings: FilterSettings | null): void;
  }>();

  const filterPresets: { id: FilterPreset; name: string; preview: Record<string, string> }[] = [
    { id: 'none', name: 'None', preview: { background: 'linear-gradient(135deg, #666 0%, #333 100%)' } },
    { id: 'warm', name: 'Warm', preview: { background: 'linear-gradient(135deg, #f7a14f 0%, #c67834 100%)' } },
    { id: 'cool', name: 'Cool', preview: { background: 'linear-gradient(135deg, #64b5f6 0%, #1976d2 100%)' } },
    { id: 'vintage', name: 'Vintage', preview: { background: 'linear-gradient(135deg, #d4a373 0%, #6b5b4f 100%)' } },
    { id: 'bw', name: 'B&W', preview: { background: 'linear-gradient(135deg, #999 0%, #333 100%)' } },
    { id: 'sepia', name: 'Sepia', preview: { background: 'linear-gradient(135deg, #d4a37a 0%, #7a5c3e 100%)' } },
    { id: 'dramatic', name: 'Dramatic', preview: { background: 'linear-gradient(135deg, #2d3436 0%, #000 100%)' } },
    { id: 'vivid', name: 'Vivid', preview: { background: 'linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%)' } },
    { id: 'muted', name: 'Muted', preview: { background: 'linear-gradient(135deg, #a8a8a8 0%, #6b6b6b 100%)' } },
    {
      id: 'cinematic',
      name: 'Cinematic',
      preview: { background: 'linear-gradient(135deg, #2c3e50 0%, #1a252f 100%)' },
    },
    { id: 'retro', name: 'Retro', preview: { background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' } },
    { id: 'noir', name: 'Noir', preview: { background: 'linear-gradient(135deg, #434343 0%, #000000 100%)' } },
  ];

  const currentSettings = computed(() => {
    return props.filterSettings || getDefaultSettings();
  });

  function getDefaultSettings(): FilterSettings {
    return {
      preset: 'none',
      brightness: 0,
      contrast: 0,
      saturation: 0,
      hue: 0,
      temperature: 0,
      vignette: 0,
      sharpen: 0,
      fade: 0,
    };
  }

  function selectPreset(presetId: FilterPreset) {
    const settings = { ...currentSettings.value, preset: presetId };

    // Apply preset-specific adjustments
    switch (presetId) {
      case 'warm':
        settings.temperature = 30;
        settings.saturation = 10;
        break;
      case 'cool':
        settings.temperature = -30;
        settings.saturation = 5;
        break;
      case 'vintage':
        settings.saturation = -20;
        settings.contrast = 10;
        settings.fade = 20;
        break;
      case 'bw':
        settings.saturation = -100;
        break;
      case 'sepia':
        settings.saturation = -50;
        settings.temperature = 40;
        break;
      case 'dramatic':
        settings.contrast = 30;
        settings.saturation = -10;
        settings.vignette = 30;
        break;
      case 'vivid':
        settings.saturation = 40;
        settings.contrast = 20;
        break;
      case 'muted':
        settings.saturation = -30;
        settings.contrast = -10;
        break;
      case 'cinematic':
        settings.contrast = 15;
        settings.saturation = -15;
        settings.temperature = -10;
        settings.vignette = 20;
        break;
      case 'retro':
        settings.temperature = 20;
        settings.fade = 15;
        settings.contrast = -5;
        break;
      case 'noir':
        settings.saturation = -100;
        settings.contrast = 40;
        settings.vignette = 40;
        break;
      default:
        // Reset to defaults for 'none'
        Object.assign(settings, getDefaultSettings(), { preset: presetId });
    }

    emit('updateFilter', settings);
  }

  function updateSetting(key: keyof FilterSettings, e: Event) {
    const target = e.target as HTMLInputElement;
    const value = parseInt(target.value);
    const settings = { ...currentSettings.value, [key]: value, preset: 'none' as FilterPreset };
    emit('updateFilter', settings);
  }

  function resetFilters() {
    emit('updateFilter', null);
  }
</script>
