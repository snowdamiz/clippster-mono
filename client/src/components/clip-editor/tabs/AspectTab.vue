<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-white mb-3">Aspect Ratio Framing</h3>
      <p class="text-xs text-white/50 mb-4">
        Configure how this clip is cropped for different aspect ratios when exported.
      </p>
    </div>

    <!-- Target Aspect Ratios -->
    <div class="space-y-3">
      <h4 class="text-xs font-medium text-white/70 uppercase tracking-wide">Target Formats</h4>
      <div class="grid grid-cols-2 gap-2">
        <!-- 9:16 Portrait -->
        <button
          @click="toggleRatio('9:16')"
          :class="[
            'group relative overflow-hidden rounded-lg border-2 transition-all p-3',
            selectedRatios.includes('9:16')
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-white/10 bg-white/5 hover:border-violet-500/30 hover:bg-white/10',
          ]"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-4 h-7 border-2 rounded transition-all"
              :class="selectedRatios.includes('9:16') ? 'border-violet-400' : 'border-white/30'"
            ></div>
            <div class="text-left">
              <span class="text-sm font-medium text-white">9:16</span>
              <p class="text-[10px] text-white/50">TikTok • Reels</p>
            </div>
            <div
              v-if="selectedRatios.includes('9:16')"
              class="absolute top-2 right-2 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center"
            >
              <Check :size="10" class="text-white" />
            </div>
          </div>
        </button>

        <!-- 4:5 Portrait -->
        <button
          @click="toggleRatio('4:5')"
          :class="[
            'group relative overflow-hidden rounded-lg border-2 transition-all p-3',
            selectedRatios.includes('4:5')
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-white/10 bg-white/5 hover:border-violet-500/30 hover:bg-white/10',
          ]"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-5 h-6 border-2 rounded transition-all"
              :class="selectedRatios.includes('4:5') ? 'border-violet-400' : 'border-white/30'"
            ></div>
            <div class="text-left">
              <span class="text-sm font-medium text-white">4:5</span>
              <p class="text-[10px] text-white/50">Instagram Post</p>
            </div>
            <div
              v-if="selectedRatios.includes('4:5')"
              class="absolute top-2 right-2 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center"
            >
              <Check :size="10" class="text-white" />
            </div>
          </div>
        </button>

        <!-- 1:1 Square -->
        <button
          @click="toggleRatio('1:1')"
          :class="[
            'group relative overflow-hidden rounded-lg border-2 transition-all p-3',
            selectedRatios.includes('1:1')
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-white/10 bg-white/5 hover:border-violet-500/30 hover:bg-white/10',
          ]"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-6 h-6 border-2 rounded transition-all"
              :class="selectedRatios.includes('1:1') ? 'border-violet-400' : 'border-white/30'"
            ></div>
            <div class="text-left">
              <span class="text-sm font-medium text-white">1:1</span>
              <p class="text-[10px] text-white/50">Instagram Feed</p>
            </div>
            <div
              v-if="selectedRatios.includes('1:1')"
              class="absolute top-2 right-2 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center"
            >
              <Check :size="10" class="text-white" />
            </div>
          </div>
        </button>

        <!-- 16:9 Landscape (default) -->
        <div class="p-3 rounded-lg border-2 border-emerald-500/30 bg-emerald-500/5">
          <div class="flex items-center gap-3">
            <div class="w-8 h-5 border-2 border-emerald-400 rounded"></div>
            <div class="text-left">
              <span class="text-sm font-medium text-white">16:9</span>
              <p class="text-[10px] text-emerald-400/70">Original • Default</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Framing Mode Selection -->
    <div v-if="selectedRatios.length > 0" class="space-y-3">
      <h4 class="text-xs font-medium text-white/70 uppercase tracking-wide">Framing Mode</h4>

      <div class="grid grid-cols-2 gap-3">
        <button
          @click="framingMode = 'auto'"
          :class="[
            'relative p-3 rounded-lg border-2 transition-all text-left',
            framingMode === 'auto'
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-white/10 bg-white/5 hover:border-violet-500/30',
          ]"
        >
          <div class="flex items-center gap-2 mb-1.5">
            <div
              :class="[
                'w-6 h-6 rounded flex items-center justify-center',
                framingMode === 'auto' ? 'bg-violet-500/20' : 'bg-white/10',
              ]"
            >
              <Sparkles :size="12" :class="framingMode === 'auto' ? 'text-violet-400' : 'text-white/50'" />
            </div>
            <span :class="['text-xs font-medium', framingMode === 'auto' ? 'text-violet-300' : 'text-white']">
              Auto
            </span>
          </div>
          <p class="text-[10px] text-white/40 leading-relaxed">AI detects speakers and content</p>
        </button>

        <button
          @click="framingMode = 'manual'"
          :class="[
            'relative p-3 rounded-lg border-2 transition-all text-left',
            framingMode === 'manual'
              ? 'border-violet-500 bg-violet-500/10'
              : 'border-white/10 bg-white/5 hover:border-violet-500/30',
          ]"
        >
          <div class="flex items-center gap-2 mb-1.5">
            <div
              :class="[
                'w-6 h-6 rounded flex items-center justify-center',
                framingMode === 'manual' ? 'bg-violet-500/20' : 'bg-white/10',
              ]"
            >
              <PencilRuler :size="12" :class="framingMode === 'manual' ? 'text-violet-400' : 'text-white/50'" />
            </div>
            <span :class="['text-xs font-medium', framingMode === 'manual' ? 'text-violet-300' : 'text-white']">
              Manual
            </span>
          </div>
          <p class="text-[10px] text-white/40 leading-relaxed">Configure regions yourself</p>
        </button>
      </div>
    </div>

    <!-- Manual Configuration Section -->
    <Transition name="slide-fade">
      <div v-if="framingMode === 'manual' && selectedRatios.length > 0" class="space-y-3">
        <h4 class="text-xs font-medium text-white/70 uppercase tracking-wide">Configure Regions</h4>
        <p class="text-[10px] text-white/40">Click an aspect ratio to configure its crop regions</p>

        <div class="space-y-2">
          <button
            v-for="ratio in selectedRatios"
            :key="ratio"
            @click="openPOIEditor(ratio)"
            class="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all border"
            :class="
              isRatioConfigured(ratio)
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:border-violet-500/40'
            "
          >
            <div class="flex items-center gap-3">
              <div
                class="border-2 rounded flex-shrink-0"
                :class="isRatioConfigured(ratio) ? 'border-emerald-400' : 'border-white/30'"
                :style="getRatioPreviewStyle(ratio)"
              ></div>
              <span class="text-sm font-medium">{{ ratio }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="isRatioConfigured(ratio)" class="text-[10px] text-emerald-400/80">
                ✓ {{ getConfigForRatio(ratio)?.regions.length }} region{{
                  getConfigForRatio(ratio)?.regions.length !== 1 ? 's' : ''
                }}
              </span>
              <span v-else class="text-[10px] text-white/40">Click to configure</span>
              <ChevronRight :size="14" class="text-white/30" />
            </div>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Manual POI Editor Dialog -->
    <ManualPOIEditor
      v-model="showPOIEditor"
      :initial-config="getConfigForRatio(editingRatio)"
      :target-aspect-ratio="editingRatio"
      :source-aspect-ratio="'16:9'"
      :thumbnail-url="thumbnailUrl"
      :video-path="videoPath"
      :clip-start-time="clipStartTime"
      :clip-end-time="clipEndTime"
      @confirm="onPOIConfigConfirm"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { Check, Sparkles, PencilRuler, ChevronRight, Layers, Crop } from 'lucide-vue-next';
  import ManualPOIEditor from '@/components/poi/ManualPOIEditor.vue';
  import type { ManualFramingConfig, ManualFramingConfigs } from '@/types';

  const props = defineProps<{
    framingConfigs: ManualFramingConfigs;
    selectedAspectRatios: string[];
    framingModeValue: 'auto' | 'manual';
    thumbnailUrl: string | null;
    videoPath: string | null;
    clipStartTime: number;
    clipEndTime: number;
    previewAspectRatio: string;
  }>();

  const emit = defineEmits<{
    (e: 'update:framingConfigs', configs: ManualFramingConfigs): void;
    (e: 'update:selectedAspectRatios', ratios: string[]): void;
    (e: 'update:framingMode', mode: 'auto' | 'manual'): void;
    (e: 'update:previewAspectRatio', ratio: string): void;
  }>();

  // Local state
  const showPOIEditor = ref(false);
  const editingRatio = ref<string>('9:16');

  // Computed properties synced with props
  const selectedRatios = computed({
    get: () => props.selectedAspectRatios,
    set: (val) => emit('update:selectedAspectRatios', val),
  });

  const framingMode = computed({
    get: () => props.framingModeValue,
    set: (val) => emit('update:framingMode', val),
  });

  const previewAspectRatio = computed(() => props.previewAspectRatio);

  // Count of configured ratios
  const configuredCount = computed(() => {
    return props.selectedAspectRatios.filter((ratio) => isRatioConfigured(ratio)).length;
  });

  // Toggle aspect ratio selection
  function toggleRatio(ratio: string) {
    const current = [...props.selectedAspectRatios];
    const index = current.indexOf(ratio);
    if (index > -1) {
      current.splice(index, 1);
      // If we're removing the currently previewed ratio, switch to 16:9 or the first remaining ratio
      if (props.previewAspectRatio === ratio) {
        const newRatio = current.length > 0 ? current[0] : '16:9';
        emit('update:previewAspectRatio', newRatio);
      }
    } else {
      current.push(ratio);
      // Switch preview to the newly selected ratio
      emit('update:previewAspectRatio', ratio);
    }
    emit('update:selectedAspectRatios', current);
  }

  // Check if a ratio is configured
  function isRatioConfigured(ratio: string): boolean {
    const config = props.framingConfigs[ratio as keyof ManualFramingConfigs];
    return config !== undefined && config.regions.length > 0;
  }

  // Get config for a ratio
  function getConfigForRatio(ratio: string): ManualFramingConfig | null {
    return props.framingConfigs[ratio as keyof ManualFramingConfigs] || null;
  }

  // Get preview style for ratio icon
  function getRatioPreviewStyle(ratio: string): { width: string; height: string } {
    switch (ratio) {
      case '9:16':
        return { width: '12px', height: '21px' };
      case '4:5':
        return { width: '16px', height: '20px' };
      case '1:1':
        return { width: '18px', height: '18px' };
      default:
        return { width: '18px', height: '10px' };
    }
  }

  // Open POI editor for a specific ratio
  function openPOIEditor(ratio: string) {
    editingRatio.value = ratio;
    showPOIEditor.value = true;
  }

  // Handle POI config confirmation
  function onPOIConfigConfirm(config: ManualFramingConfig) {
    const ratio = config.targetAspectRatio as keyof ManualFramingConfigs;
    const updated: ManualFramingConfigs = {
      ...props.framingConfigs,
      [ratio]: config,
    };
    emit('update:framingConfigs', updated);
  }
</script>

<style scoped>
  /* Slide-fade transition */
  .slide-fade-enter-active {
    transition: all 0.3s ease-out;
  }

  .slide-fade-leave-active {
    transition: all 0.2s ease-in;
  }

  .slide-fade-enter-from,
  .slide-fade-leave-to {
    opacity: 0;
    transform: translateY(-10px);
  }
</style>
