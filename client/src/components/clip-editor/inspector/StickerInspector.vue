<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center gap-2 pb-3 border-b border-white/10 text-pink-500">
      <Smile :size="18" />
      <h4 class="text-sm font-semibold text-zinc-100 m-0">Sticker</h4>
    </div>

    <!-- Preview -->
    <div class="flex items-center justify-center p-8 bg-white/[0.03] border border-white/[0.08] rounded-lg">
      <span class="text-4xl">{{ getStickerPreview() }}</span>
    </div>

    <!-- Transform -->
    <div class="flex flex-col gap-2">
      <label class="text-xs font-medium text-white/70">Scale: {{ Math.round(sticker.scale * 100) }}%</label>
      <input
        :value="sticker.scale"
        type="range"
        min="0.1"
        max="3"
        step="0.05"
        class="w-full h-1.5 rounded-full bg-white/10 outline-none appearance-none -webkit-appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)] [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-pink-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
        @input="updateProperty('scale', parseFloat(($event.target as HTMLInputElement).value))"
      />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-xs font-medium text-white/70">Rotation: {{ Math.round(sticker.rotation) }}°</label>
      <input
        :value="sticker.rotation"
        type="range"
        min="-180"
        max="180"
        step="1"
        class="w-full h-1.5 rounded-full bg-white/10 outline-none appearance-none -webkit-appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)] [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-pink-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
        @input="updateProperty('rotation', parseFloat(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- Position -->
    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-white/70">X Position (%)</label>
        <input
          :value="sticker.position_x"
          type="number"
          min="0"
          max="100"
          class="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-pink-500/50 focus:bg-white/[0.08]"
          @input="updateProperty('position_x', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-white/70">Y Position (%)</label>
        <input
          :value="sticker.position_y"
          type="number"
          min="0"
          max="100"
          class="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-pink-500/50 focus:bg-white/[0.08]"
          @input="updateProperty('position_y', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <!-- Animation -->
    <div class="flex flex-col gap-2">
      <label class="text-xs font-medium text-white/70">Animation</label>
      <select
        :value="sticker.animation"
        class="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-pink-500/50 focus:bg-white/[0.08]"
        @change="updateProperty('animation', ($event.target as HTMLSelectElement).value)"
      >
        <option value="none">None</option>
        <option value="bounce">Bounce</option>
        <option value="spin">Spin</option>
        <option value="pulse">Pulse</option>
        <option value="shake">Shake</option>
        <option value="float">Float</option>
      </select>
    </div>

    <!-- Time Range -->
    <div class="grid grid-cols-2 gap-3">
      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-white/70">Start (s)</label>
        <input
          :value="sticker.start_time.toFixed(2)"
          type="number"
          min="0"
          step="0.1"
          class="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-pink-500/50 focus:bg-white/[0.08]"
          @input="updateProperty('start_time', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-xs font-medium text-white/70">End (s)</label>
        <input
          :value="sticker.end_time.toFixed(2)"
          type="number"
          min="0"
          step="0.1"
          class="w-full px-3 py-2 bg-white/[0.05] border border-white/10 rounded-lg text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-pink-500/50 focus:bg-white/[0.08]"
          @input="updateProperty('end_time', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <!-- Delete Button -->
    <div class="flex flex-col gap-2">
      <button
        class="flex items-center justify-center gap-2 px-2.5 py-2.5 bg-red-500/[0.15] border border-red-500/30 rounded-lg text-red-400 cursor-pointer transition-all duration-150 text-sm font-medium hover:bg-red-500/[0.25] hover:border-red-500/50"
        @click="$emit('delete')"
      >
        <Trash2 :size="16" />
        <span>Delete Sticker</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Smile, Trash2 } from 'lucide-vue-next';
  import type { VideoEditorStickerRecord } from '@/services/database/video-editor-edits';

  const props = defineProps<{
    sticker: VideoEditorStickerRecord;
  }>();

  const emit = defineEmits<{
    (e: 'update', property: string, value: any): void;
    (e: 'delete'): void;
  }>();

  function getStickerPreview(): string {
    if (props.sticker.sticker_type === 'emoji') {
      return props.sticker.sticker_path;
    }
    return '🖼️';
  }

  function updateProperty(property: string, value: any) {
    emit('update', property, value);
  }
</script>
