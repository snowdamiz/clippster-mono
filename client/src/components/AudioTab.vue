<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Header (can be hidden when integrated into parent tabs) -->
    <div v-if="!hideHeader" class="flex items-center justify-between py-3 border-b border-border/30">
      <div class="flex items-center gap-3">
        <div
          class="w-8 h-8 bg-gradient-to-br from-blue-500/15 to-cyan-500/15 rounded-lg flex items-center justify-center border border-blue-500/20"
        >
          <Volume2 class="h-4 w-4 text-blue-400" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-foreground">Audio</h3>
          <p class="text-[10px] text-muted-foreground">Volume & normalization</p>
        </div>
      </div>
      <button
        @click="resetToDefaults"
        class="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 rounded-md transition-all border border-border/40 hover:border-border/60"
        title="Reset all settings to defaults"
      >
        <RotateCcw class="h-3 w-3" />
        Reset
      </button>
    </div>

    <!-- Settings Content -->
    <div class="flex-1 overflow-y-auto py-4 custom-scrollbar space-y-6">
      <!-- Volume Section -->
      <div class="space-y-3">
        <h4 class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Volume</h4>

        <!-- Volume/Gain Slider -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <label class="text-xs font-semibold text-foreground">Gain Adjustment</label>
            <span
              :class="[
                'text-xs font-mono px-2 py-1 rounded',
                localSettings.volume === 0
                  ? 'text-muted-foreground bg-muted/50'
                  : localSettings.volume > 0
                    ? 'text-green-400 bg-green-500/10'
                    : 'text-orange-400 bg-orange-500/10',
              ]"
            >
              {{ localSettings.volume > 0 ? '+' : '' }}{{ localSettings.volume }} dB
            </span>
          </div>
          <div class="relative h-2 bg-muted-foreground/30 rounded-md">
            <!-- Track fill - centered at 0 dB -->
            <div
              class="absolute top-0 h-full rounded-md transition-all duration-200"
              :class="localSettings.volume >= 0 ? 'bg-green-500' : 'bg-orange-500'"
              :style="getVolumeTrackStyle()"
            ></div>
            <!-- Center marker (0 dB) -->
            <div class="absolute top-0 left-1/2 w-0.5 h-full bg-foreground/30 -translate-x-1/2"></div>
            <input
              type="range"
              v-model.number="localSettings.volume"
              @input="emitSettingsChange"
              min="-20"
              max="20"
              step="1"
              class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
            />
          </div>
          <div class="flex justify-between text-[10px] text-muted-foreground/60 px-0.5">
            <span>-20 dB</span>
            <span>0 dB</span>
            <span>+20 dB</span>
          </div>
        </div>
      </div>

      <!-- Normalization Section -->
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <h4 class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Normalization</h4>
          <span
            class="text-[9px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20"
          >
            Export Only
          </span>
        </div>

        <!-- Normalize Toggle -->
        <div class="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/30">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <AudioWaveform class="h-4 w-4 text-muted-foreground" />
              <span class="text-sm font-medium text-foreground">Normalize Audio</span>
            </div>
            <p class="text-[10px] text-muted-foreground mt-1 ml-6">
              Automatically adjust audio levels to target loudness (-16 LUFS)
            </p>
          </div>
          <button
            @click="toggleNormalize"
            type="button"
            :class="[
              'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30',
              localSettings.normalize ? 'bg-primary' : 'bg-muted-foreground/30',
            ]"
            :title="localSettings.normalize ? 'Disable normalization' : 'Enable normalization'"
            :aria-pressed="localSettings.normalize"
          >
            <span
              :class="[
                'inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-all duration-200 ease-in-out',
                localSettings.normalize ? 'translate-x-[18px]' : 'translate-x-0.5',
              ]"
            ></span>
          </button>
        </div>
      </div>

      <!-- Info Section -->
      <div class="p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
        <div class="flex gap-2.5">
          <Info class="h-3.5 w-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div class="text-[10px] text-muted-foreground leading-relaxed">
            <p class="mb-1">
              <span class="text-foreground font-medium">Volume</span>
              adjusts in real-time preview.
            </p>
            <p>
              <span class="text-foreground font-medium">Normalize</span>
              is applied during export only.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, onMounted } from 'vue';
  import { Volume2, RotateCcw, AudioWaveform, Info } from 'lucide-vue-next';
  import {
    getDefaultAudioSettings,
    getProjectAudioSettings,
    updateProjectAudioSettings,
    type AudioSettings,
  } from '@/services/database';

  // Props
  interface AudioTabProps {
    projectId: string | null;
    hideHeader?: boolean;
  }

  const props = withDefaults(defineProps<AudioTabProps>(), {
    projectId: null,
    hideHeader: false,
  });

  // Emits
  const emit = defineEmits<{
    settingsChanged: [settings: AudioSettings];
  }>();

  // State
  const localSettings = ref<AudioSettings>(getDefaultAudioSettings());
  const saveTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
  const isLoading = ref(false);

  // Watch for project changes
  watch(
    () => props.projectId,
    async (newProjectId) => {
      if (newProjectId) {
        await loadSettings(newProjectId);
      } else {
        localSettings.value = getDefaultAudioSettings();
      }
    },
    { immediate: true }
  );

  // Functions
  async function loadSettings(projectId: string) {
    isLoading.value = true;
    try {
      localSettings.value = await getProjectAudioSettings(projectId);
    } catch (error) {
      console.error('[AudioTab] Failed to load settings:', error);
      localSettings.value = getDefaultAudioSettings();
    } finally {
      isLoading.value = false;
    }
  }

  function emitSettingsChange() {
    emit('settingsChanged', { ...localSettings.value });
    debouncedSave();
  }

  function debouncedSave() {
    if (saveTimeout.value) {
      clearTimeout(saveTimeout.value);
    }
    saveTimeout.value = setTimeout(async () => {
      if (props.projectId) {
        try {
          await updateProjectAudioSettings(props.projectId, localSettings.value);
        } catch (error) {
          console.error('[AudioTab] Failed to save settings:', error);
        }
      }
    }, 500);
  }

  function toggleNormalize() {
    localSettings.value.normalize = !localSettings.value.normalize;
    emitSettingsChange();
  }

  function resetToDefaults() {
    localSettings.value = getDefaultAudioSettings();
    emitSettingsChange();
  }

  function getVolumeTrackStyle() {
    const volume = localSettings.value.volume;
    const center = 50; // 50% is center (0 dB)

    if (volume >= 0) {
      // Positive: fill from center to right
      const width = (volume / 20) * 50;
      return {
        left: `${center}%`,
        width: `${width}%`,
      };
    } else {
      // Negative: fill from left of center
      const width = (Math.abs(volume) / 20) * 50;
      return {
        left: `${center - width}%`,
        width: `${width}%`,
      };
    }
  }

  onMounted(async () => {
    if (props.projectId) {
      await loadSettings(props.projectId);
    }
  });

  // Expose methods for parent component access
  defineExpose({
    resetToDefaults,
  });
</script>

<style scoped>
  /* Custom slider styling */
  .slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    outline: none;
  }

  .slider::-webkit-slider-track {
    background: transparent;
    height: 8px;
    border-radius: 4px;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .slider::-webkit-slider-thumb:active {
    transform: scale(1.1);
  }

  .slider::-moz-range-track {
    background: transparent;
    height: 8px;
    border-radius: 4px;
    border: none;
  }

  .slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .slider::-moz-range-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .slider::-moz-range-thumb:active {
    transform: scale(1.1);
  }

  .slider::-moz-range-progress {
    background: hsl(var(--primary));
    height: 8px;
    border-radius: 4px 0 0 4px;
  }

  /* Custom scrollbar styling */
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
    margin: 4px 0;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: hsl(var(--muted-foreground) / 0.3);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--muted-foreground) / 0.5);
    background-clip: padding-box;
  }

  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
  }
</style>
