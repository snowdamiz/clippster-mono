<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <h3 class="text-base font-semibold text-zinc-100 m-0">Aspect Ratio & Framing</h3>
    </div>

    <!-- Aspect Ratio Selection -->
    <div class="flex flex-col gap-3">
      <label class="text-sm font-semibold text-white/90">Export Aspect Ratios</label>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="ratio in aspectRatios"
          :key="ratio"
          class="relative flex items-center justify-center p-4 bg-white/5 border border-white/10 rounded-md text-white/70 cursor-pointer transition-all duration-150 font-semibold hover:bg-white/10 hover:border-white/20"
          :class="{ 'bg-sky-500/15 border-sky-500/40 text-[var(--editor-accent)]': isRatioSelected(ratio) }"
          @click="handleToggleRatio(ratio)"
        >
          <span class="font-semibold">{{ ratio }}</span>
          <Check v-if="isRatioSelected(ratio)" :size="14" class="absolute top-2 right-2" />
        </button>
      </div>
    </div>

    <!-- Framing Mode -->
    <div class="flex flex-col gap-3">
      <label class="text-sm font-semibold text-white/90">Framing Mode</label>
      <div class="flex flex-col gap-2">
        <label
          v-for="mode in framingModes"
          :key="mode.id"
          class="flex p-3 bg-white/5 border border-white/10 rounded-md cursor-pointer transition-all duration-150 hover:bg-white/10 hover:border-white/20"
          :class="{ 'bg-sky-500/15 border-sky-500/40': framingMode === mode.id }"
        >
          <input v-model="framingMode" type="radio" :value="mode.id" class="mr-3" @change="handleModeChange(mode.id)" />
          <div class="flex items-start gap-3 flex-1 text-white/90">
            <component :is="mode.icon" :size="18" />
            <div class="flex flex-col gap-1">
              <span class="text-sm font-semibold text-zinc-100">{{ mode.name }}</span>
              <span class="text-xs text-white/60">{{ mode.description }}</span>
            </div>
          </div>
        </label>
      </div>
    </div>

    <!-- Manual Framing Button -->
    <div v-if="isManualMode" class="flex flex-col gap-3">
      <button
        class="flex items-center justify-center gap-2 p-3 bg-sky-500/15 border border-sky-500/30 rounded-md text-[var(--editor-accent)] cursor-pointer transition-all duration-150 text-sm font-medium hover:bg-sky-500/25 hover:border-sky-500/50"
        @click="handleOpenFramingEditor"
      >
        <Crop :size="16" />
        <span>Edit Crop Regions</span>
      </button>
      <p class="text-xs text-white/50 m-0 text-center">Define custom crop regions for each aspect ratio</p>
    </div>

    <!-- Info -->
    <div class="flex gap-2 p-3 bg-white/5 border border-white/10 rounded-md text-xs text-white/60 leading-6">
      <Info :size="14" />
      <p class="m-0">Configure how your video is framed for different aspect ratios when exporting.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Check, Crop, Info } from 'lucide-vue-next';
  import { useFramingSettings, type AspectRatio, type FramingModeId } from '@/composables/clip-editor';

  const props = defineProps<{
    editId: string | null;
  }>();

  const emit = defineEmits<{
    (e: 'ratiosChanged', ratios: string[]): void;
    (e: 'framingModeChanged', mode: string): void;
    (e: 'openFramingEditor'): void;
  }>();

  // Use composable for framing settings
  const {
    selectedRatios,
    framingMode,
    aspectRatios,
    framingModes,
    isRatioSelected,
    toggleRatio,
    setFramingMode,
    isManualMode,
  } = useFramingSettings({
    onRatiosChange: (ratios) => emit('ratiosChanged', ratios),
    onModeChange: (mode) => emit('framingModeChanged', mode),
  });

  function handleToggleRatio(ratio: AspectRatio) {
    toggleRatio(ratio);
  }

  function handleModeChange(mode: FramingModeId) {
    setFramingMode(mode);
  }

  function handleOpenFramingEditor() {
    emit('openFramingEditor');
  }
</script>
