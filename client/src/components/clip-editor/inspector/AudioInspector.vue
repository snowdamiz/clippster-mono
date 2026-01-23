<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center gap-2 pb-3 border-b border-white/10">
      <Music :size="18" />
      <h4 class="text-[15px] font-semibold text-zinc-100 m-0">Audio Track</h4>
    </div>

    <!-- Track Name -->
    <div class="flex flex-col gap-2">
      <label class="text-[13px] font-medium text-white/70">Track Name</label>
      <input
        :value="audioTrack.name"
        type="text"
        class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-sky-500/50 focus:bg-white/[0.08]"
        placeholder="Track name"
        @input="updateProperty('name', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Volume Control -->
    <div class="flex flex-col gap-2">
      <label class="text-[13px] font-medium text-white/70">
        Volume: {{ volumePercent }}
      </label>
      <input
        :value="audioTrack.volume"
        type="range"
        :min="constraints.volume.min"
        :max="constraints.volume.max"
        :step="constraints.volume.step"
        class="w-full h-1.5 rounded-[3px] bg-white/10 outline-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)] [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-violet-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
        @input="updateProperty('volume', parseFloat(($event.target as HTMLInputElement).value))"
      />
      <div class="flex justify-between text-[11px] text-white/50">
        <span>0%</span>
        <span>100%</span>
        <span>200%</span>
      </div>
    </div>

    <!-- Pan Control -->
    <div class="flex flex-col gap-2">
      <label class="text-[13px] font-medium text-white/70">
        Pan: {{ panLabel }}
      </label>
      <input
        :value="audioTrack.pan"
        type="range"
        :min="constraints.pan.min"
        :max="constraints.pan.max"
        :step="constraints.pan.step"
        class="w-full h-1.5 rounded-[3px] bg-white/10 outline-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)] [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-violet-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
        @input="updateProperty('pan', parseFloat(($event.target as HTMLInputElement).value))"
      />
      <div class="flex justify-between text-[11px] text-white/50">
        <span>Left</span>
        <span>Center</span>
        <span>Right</span>
      </div>
    </div>

    <!-- Fade Controls -->
    <div class="flex flex-col gap-2">
      <label class="text-[13px] font-medium text-white/70">Fade In (seconds)</label>
      <input
        :value="audioTrack.fade_in"
        type="number"
        :min="constraints.fade.min"
        :max="constraints.fade.max"
        :step="constraints.fade.step"
        class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-sky-500/50 focus:bg-white/[0.08]"
        @input="updateProperty('fade_in', parseFloat(($event.target as HTMLInputElement).value))"
      />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-[13px] font-medium text-white/70">Fade Out (seconds)</label>
      <input
        :value="audioTrack.fade_out"
        type="number"
        :min="constraints.fade.min"
        :max="constraints.fade.max"
        :step="constraints.fade.step"
        class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-sky-500/50 focus:bg-white/[0.08]"
        @input="updateProperty('fade_out', parseFloat(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- Toggle Controls -->
    <div class="flex flex-col gap-2">
      <div class="flex gap-2">
        <button
          class="flex-1 flex items-center justify-center gap-2 p-2 bg-white/5 border border-white/10 rounded-md text-white/70 cursor-pointer transition-all duration-150 text-[13px] font-medium hover:bg-white/[0.08] hover:border-white/20"
          :class="{ 'bg-sky-500/20 border-sky-500/40 text-[var(--editor-accent)]': audioTrack.is_muted }"
          @click="updateProperty('is_muted', toBinary(!fromBinary(audioTrack.is_muted)))"
        >
          <VolumeX :size="16" />
          <span>Mute</span>
        </button>

        <button
          class="flex-1 flex items-center justify-center gap-2 p-2 bg-white/5 border border-white/10 rounded-md text-white/70 cursor-pointer transition-all duration-150 text-[13px] font-medium hover:bg-white/[0.08] hover:border-white/20"
          :class="{ 'bg-sky-500/20 border-sky-500/40 text-[var(--editor-accent)]': audioTrack.is_solo }"
          @click="updateProperty('is_solo', toBinary(!fromBinary(audioTrack.is_solo)))"
        >
          <Headphones :size="16" />
          <span>Solo</span>
        </button>
      </div>
    </div>

    <!-- Time Range -->
    <div class="flex flex-col gap-2">
      <label class="text-[13px] font-medium text-white/70">Start Time</label>
      <input
        :value="audioTrack.start_time.toFixed(2)"
        type="number"
        :min="constraints.time.min"
        :step="constraints.time.step"
        class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-sky-500/50 focus:bg-white/[0.08]"
        @input="updateProperty('start_time', parseFloat(($event.target as HTMLInputElement).value))"
      />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-[13px] font-medium text-white/70">End Time</label>
      <input
        :value="audioTrack.end_time.toFixed(2)"
        type="number"
        :min="constraints.time.min"
        :step="constraints.time.step"
        class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-sky-500/50 focus:bg-white/[0.08]"
        @input="updateProperty('end_time', parseFloat(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- Delete Button -->
    <div class="flex flex-col gap-2">
      <button class="flex items-center justify-center gap-2 p-[10px] bg-red-500/15 border border-red-500/30 rounded-md text-red-400 cursor-pointer transition-all duration-150 text-sm font-medium hover:bg-red-500/25 hover:border-red-500/50" @click="$emit('delete')">
        <Trash2 :size="16" />
        <span>Delete Track</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { toRef } from 'vue';
  import { Music, VolumeX, Headphones, Trash2 } from 'lucide-vue-next';
  import type { VideoEditorAudioTrackRecord } from '@/services/database/video-editor-edits';
  import { useAudioInspectorLogic, toBinary, fromBinary } from '@/composables/clip-editor';

  const props = defineProps<{
    audioTrack: VideoEditorAudioTrackRecord;
  }>();

  const emit = defineEmits<{
    (e: 'update', property: string, value: any): void;
    (e: 'delete'): void;
  }>();

  // Use composable for formatting and constraints
  const { volumePercent, panLabel, constraints } = useAudioInspectorLogic({
    volume: toRef(() => props.audioTrack.volume),
    pan: toRef(() => props.audioTrack.pan),
  });

  function updateProperty(property: string, value: any) {
    emit('update', property, value);
  }
</script>
