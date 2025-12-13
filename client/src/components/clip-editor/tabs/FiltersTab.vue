<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-white mb-3">Filters & Color</h3>
      <p class="text-xs text-white/50 mb-4">
        Add color filters to specific parts of your clip. Filters appear on the timeline and can be resized.
      </p>
    </div>

    <!-- Add Filter Section -->
    <div>
      <h4 class="text-sm font-medium text-white mb-3">Add Filter Preset</h4>
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="preset in filterPresets.filter((p) => p.id !== 'none')"
          :key="preset.id"
          @click="addPreset(preset.id)"
          class="p-2 rounded-lg border border-white/10 bg-white/5 hover:border-violet-500/50 hover:bg-violet-500/10 transition-all"
        >
          <div class="w-full aspect-square rounded bg-gradient-to-br mb-1" :style="preset.preview" />
          <span class="text-xs text-white/70">{{ preset.name }}</span>
        </button>
      </div>
    </div>

    <!-- Active Filter Segments List -->
    <div v-if="filterSegments.length > 0" class="border-t border-white/10 pt-4">
      <h4 class="text-sm font-medium text-white mb-3">Active Filters ({{ filterSegments.length }})</h4>

      <div class="space-y-3">
        <div
          v-for="segment in filterSegments"
          :key="segment.id"
          class="p-4 bg-white/5 rounded-lg border border-white/10"
          :class="{ 'border-violet-500/50 bg-violet-500/10': isSegmentActive(segment) }"
        >
          <div class="flex items-start justify-between mb-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <div class="w-4 h-4 rounded" :style="getPresetPreview(segment.settings.preset)" />
                <span class="text-sm text-white font-medium">{{ getPresetName(segment.settings.preset) }}</span>
                <span
                  v-if="isSegmentActive(segment)"
                  class="text-[10px] px-1.5 py-0.5 bg-violet-500/30 text-violet-300 rounded"
                >
                  Active
                </span>
              </div>
              <div class="text-xs text-white/50 mt-1">
                {{ formatTime(segment.startTime) }} - {{ formatTime(segment.endTime) }}
              </div>
            </div>
            <button @click="emit('deleteFilter', segment.id)" class="p-1.5 rounded hover:bg-white/10 transition-colors">
              <Trash2 :size="14" class="text-red-400" />
            </button>
          </div>

          <!-- Timing Controls -->
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label class="block text-xs text-white/60 mb-1">Start</label>
              <input
                type="number"
                :value="segment.startTime.toFixed(1)"
                @input="(e) => updateTiming(segment.id, 'startTime', parseFloat((e.target as HTMLInputElement).value))"
                step="0.1"
                min="0"
                :max="segment.endTime - 0.1"
                class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
              />
            </div>
            <div>
              <label class="block text-xs text-white/60 mb-1">End</label>
              <input
                type="number"
                :value="segment.endTime.toFixed(1)"
                @input="(e) => updateTiming(segment.id, 'endTime', parseFloat((e.target as HTMLInputElement).value))"
                step="0.1"
                :min="segment.startTime + 0.1"
                :max="duration"
                class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
              />
            </div>
          </div>

          <!-- Adjustments (collapsible) -->
          <details class="mt-2">
            <summary class="text-xs text-white/60 cursor-pointer hover:text-white/80">Adjust Settings</summary>
            <div class="mt-3 space-y-3">
              <!-- Brightness -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs text-white/60">Brightness</label>
                  <span class="text-xs text-white/40">{{ segment.settings.brightness }}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  :value="segment.settings.brightness"
                  @input="
                    (e) =>
                      updateSegmentSetting(segment.id, 'brightness', parseInt((e.target as HTMLInputElement).value))
                  "
                  class="w-full accent-violet-500"
                />
              </div>

              <!-- Contrast -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs text-white/60">Contrast</label>
                  <span class="text-xs text-white/40">{{ segment.settings.contrast }}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  :value="segment.settings.contrast"
                  @input="
                    (e) => updateSegmentSetting(segment.id, 'contrast', parseInt((e.target as HTMLInputElement).value))
                  "
                  class="w-full accent-violet-500"
                />
              </div>

              <!-- Saturation -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs text-white/60">Saturation</label>
                  <span class="text-xs text-white/40">{{ segment.settings.saturation }}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  :value="segment.settings.saturation"
                  @input="
                    (e) =>
                      updateSegmentSetting(segment.id, 'saturation', parseInt((e.target as HTMLInputElement).value))
                  "
                  class="w-full accent-violet-500"
                />
              </div>

              <!-- Hue -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs text-white/60">Hue</label>
                  <span class="text-xs text-white/40">{{ segment.settings.hue }}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  :value="segment.settings.hue"
                  @input="
                    (e) => updateSegmentSetting(segment.id, 'hue', parseInt((e.target as HTMLInputElement).value))
                  "
                  class="w-full accent-violet-500"
                />
              </div>

              <!-- Temperature -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs text-white/60">Temperature</label>
                  <span class="text-xs text-white/40">{{ segment.settings.temperature }}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  :value="segment.settings.temperature"
                  @input="
                    (e) =>
                      updateSegmentSetting(segment.id, 'temperature', parseInt((e.target as HTMLInputElement).value))
                  "
                  class="w-full accent-violet-500"
                />
              </div>

              <!-- Vignette -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs text-white/60">Vignette</label>
                  <span class="text-xs text-white/40">{{ segment.settings.vignette }}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  :value="segment.settings.vignette"
                  @input="
                    (e) => updateSegmentSetting(segment.id, 'vignette', parseInt((e.target as HTMLInputElement).value))
                  "
                  class="w-full accent-violet-500"
                />
              </div>

              <!-- Sharpen -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs text-white/60">Sharpen</label>
                  <span class="text-xs text-white/40">{{ segment.settings.sharpen }}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  :value="segment.settings.sharpen"
                  @input="
                    (e) => updateSegmentSetting(segment.id, 'sharpen', parseInt((e.target as HTMLInputElement).value))
                  "
                  class="w-full accent-violet-500"
                />
              </div>

              <!-- Fade -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs text-white/60">Fade</label>
                  <span class="text-xs text-white/40">{{ segment.settings.fade }}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  :value="segment.settings.fade"
                  @input="
                    (e) => updateSegmentSetting(segment.id, 'fade', parseInt((e.target as HTMLInputElement).value))
                  "
                  class="w-full accent-violet-500"
                />
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Trash2 } from 'lucide-vue-next';
  import type { FilterSettings, FilterSegment, FilterPreset } from '@/types';

  const props = defineProps<{
    filterSegments: FilterSegment[];
    currentTime: number;
    duration: number;
  }>();

  const emit = defineEmits<{
    (e: 'addFilter', settings: FilterSettings): void;
    (e: 'updateFilter', segmentId: string, updates: Partial<FilterSegment>): void;
    (e: 'deleteFilter', segmentId: string): void;
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

  function getPresetSettings(presetId: FilterPreset): FilterSettings {
    const settings = { ...getDefaultSettings(), preset: presetId };

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
    }

    return settings;
  }

  function addPreset(presetId: FilterPreset) {
    const settings = getPresetSettings(presetId);
    emit('addFilter', settings);
  }

  function isSegmentActive(segment: FilterSegment): boolean {
    return props.currentTime >= segment.startTime && props.currentTime <= segment.endTime;
  }

  function getPresetName(preset: FilterPreset | null): string {
    if (!preset || preset === 'none') return 'Custom';
    const found = filterPresets.find((p) => p.id === preset);
    return found?.name || 'Custom';
  }

  function getPresetPreview(preset: FilterPreset | null): Record<string, string> {
    if (!preset) return { background: '#444' };
    const found = filterPresets.find((p) => p.id === preset);
    return found?.preview || { background: '#444' };
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  }

  function updateTiming(segmentId: string, key: 'startTime' | 'endTime', value: number) {
    if (isNaN(value)) return;
    emit('updateFilter', segmentId, { [key]: value });
  }

  function updateSegmentSetting(segmentId: string, key: keyof FilterSettings, value: number) {
    const segment = props.filterSegments.find((s) => s.id === segmentId);
    if (!segment) return;

    const updatedSettings = { ...segment.settings, [key]: value, preset: 'none' as FilterPreset };
    emit('updateFilter', segmentId, { settings: updatedSettings });
  }
</script>
