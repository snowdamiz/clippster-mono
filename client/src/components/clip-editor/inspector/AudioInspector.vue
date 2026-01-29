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
        v-model="localName"
        type="text"
        class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-sky-500/50 focus:bg-white/[0.08]"
        placeholder="Track name"
        @change="updateProperty('name', localName)"
      />
    </div>

    <!-- Volume Control -->
    <div class="flex flex-col gap-2">
      <label class="text-[13px] font-medium text-white/70">
        Volume: {{ volumePercent }}
      </label>
      <input
        v-model.number="localVolume"
        type="range"
        :min="constraints.volume.min"
        :max="constraints.volume.max"
        :step="constraints.volume.step"
        class="w-full h-1.5 rounded-[3px] bg-white/10 outline-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)] [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-sky-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
        @input="updateVolumeImmediate(parseFloat(($event.target as HTMLInputElement).value))"
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
        v-model.number="localPan"
        type="range"
        :min="constraints.pan.min"
        :max="constraints.pan.max"
        :step="constraints.pan.step"
        class="w-full h-1.5 rounded-[3px] bg-white/10 outline-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)] [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-sky-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.3)]"
        @input="updatePanImmediate(parseFloat(($event.target as HTMLInputElement).value))"
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
        v-model.number="localFadeIn"
        type="number"
        :min="constraints.fade.min"
        :max="constraints.fade.max"
        :step="constraints.fade.step"
        class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-sky-500/50 focus:bg-white/[0.08]"
        @input="updateFadeInImmediate(parseFloat(($event.target as HTMLInputElement).value))"
      />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-[13px] font-medium text-white/70">Fade Out (seconds)</label>
      <input
        v-model.number="localFadeOut"
        type="number"
        :min="constraints.fade.min"
        :max="constraints.fade.max"
        :step="constraints.fade.step"
        class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-sky-500/50 focus:bg-white/[0.08]"
        @input="updateFadeOutImmediate(parseFloat(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- Toggle Controls -->
    <div class="flex flex-col gap-2">
      <div class="flex gap-2">
        <button
          class="flex-1 flex items-center justify-center gap-2 p-2 bg-white/5 border border-white/10 rounded-md text-white/70 cursor-pointer transition-all duration-150 text-[13px] font-medium hover:bg-white/[0.08] hover:border-white/20"
          :class="{ 'bg-sky-500/20 border-sky-500/40 text-[var(--editor-accent)]': localIsMuted }"
          @click="updateMuteImmediate(toBinary(!fromBinary(localIsMuted)))"
        >
          <VolumeX :size="16" />
          <span>Mute</span>
        </button>

        <button
          class="flex-1 flex items-center justify-center gap-2 p-2 bg-white/5 border border-white/10 rounded-md text-white/70 cursor-pointer transition-all duration-150 text-[13px] font-medium hover:bg-white/[0.08] hover:border-white/20"
          :class="{ 'bg-sky-500/20 border-sky-500/40 text-[var(--editor-accent)]': localIsSolo }"
          @click="updateSoloImmediate(toBinary(!fromBinary(localIsSolo)))"
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
        v-model.number="localStartTime"
        type="number"
        :min="constraints.time.min"
        :step="constraints.time.step"
        class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-sky-500/50 focus:bg-white/[0.08]"
        @change="updateProperty('start_time', localStartTime)"
      />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-[13px] font-medium text-white/70">End Time</label>
      <input
        v-model.number="localEndTime"
        type="number"
        :min="constraints.time.min"
        :step="constraints.time.step"
        class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-zinc-100 text-sm outline-none transition-all duration-150 focus:border-sky-500/50 focus:bg-white/[0.08]"
        @change="updateProperty('end_time', localEndTime)"
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
  import { ref, watch, computed, inject, type ComputedRef } from 'vue';
  import { Music, VolumeX, Headphones, Trash2 } from 'lucide-vue-next';
  import type { VideoEditorAudioTrackRecord } from '@/services/database/video-editor-edits';
  import { toBinary, fromBinary } from '@/composables/clip-editor';
  import type { AudioMixerReturn } from '@/composables/useAudioMixer';

  const props = defineProps<{
    audioTrack: VideoEditorAudioTrackRecord;
  }>();

  const emit = defineEmits<{
    (e: 'update', property: string, value: any): void;
    (e: 'delete'): void;
  }>();

  // Inject audio mixer for real-time updates during playback
  // Note: This is provided as a computed ref from ClipEditorDialog, so we need to unwrap it
  const audioMixerRef = inject<ComputedRef<AudioMixerReturn | undefined>>('audioMixer');
  const audioMixer = computed(() => audioMixerRef?.value);

  // Local reactive state for immediate UI updates
  const localVolume = ref(props.audioTrack.volume);
  const localPan = ref(props.audioTrack.pan);
  const localFadeIn = ref(props.audioTrack.fade_in);
  const localFadeOut = ref(props.audioTrack.fade_out);
  const localName = ref(props.audioTrack.name);
  const localStartTime = ref(props.audioTrack.start_time);
  const localEndTime = ref(props.audioTrack.end_time);
  const localIsMuted = ref(props.audioTrack.is_muted);
  const localIsSolo = ref(props.audioTrack.is_solo);

  // Sync local state when prop changes (from external updates)
  watch(() => props.audioTrack, (newTrack) => {
    localVolume.value = newTrack.volume;
    localPan.value = newTrack.pan;
    localFadeIn.value = newTrack.fade_in;
    localFadeOut.value = newTrack.fade_out;
    localName.value = newTrack.name;
    localStartTime.value = newTrack.start_time;
    localEndTime.value = newTrack.end_time;
    localIsMuted.value = newTrack.is_muted;
    localIsSolo.value = newTrack.is_solo;
  }, { deep: true });

  // Computed formatting
  const volumePercent = computed(() => {
    return `${Math.round(localVolume.value * 100)}%`;
  });

  const panLabel = computed(() => {
    if (localPan.value < -0.1) return 'Left';
    if (localPan.value > 0.1) return 'Right';
    return 'Center';
  });

  // Constraints
  const constraints = {
    volume: { min: 0, max: 2, step: 0.01 },
    pan: { min: -1, max: 1, step: 0.01 },
    fade: { min: 0, max: 10, step: 0.1 },
    time: { min: 0, step: 0.01 },
  };

  // Debounced update timers
  let volumeTimer: ReturnType<typeof setTimeout> | null = null;
  let panTimer: ReturnType<typeof setTimeout> | null = null;
  let fadeTimer: ReturnType<typeof setTimeout> | null = null;

  function updateProperty(property: string, value: any) {
    emit('update', property, value);
  }

  function updateVolumeImmediate(value: number) {
    console.log(`[AudioInspector] 🎚️ Volume slider changed to: ${value.toFixed(3)} for track ${props.audioTrack.id.slice(0,8)}`);
    localVolume.value = value;
    
    // Update audio mixer immediately for real-time playback
    if (audioMixer.value) {
      console.log(`[AudioInspector] Calling setTrackVolume(${props.audioTrack.id.slice(0,8)}, ${value.toFixed(3)})`);
      audioMixer.value.setTrackVolume(props.audioTrack.id, value);
    }
    
    // Clear existing timer
    if (volumeTimer) {
      console.log(`[AudioInspector] Clearing existing volume timer for track ${props.audioTrack.id.slice(0,8)}`);
      clearTimeout(volumeTimer);
    }
    // Debounce database update
    volumeTimer = setTimeout(() => {
      console.log(`[AudioInspector] ⏰ 150ms timer expired - updating database and clearing override for track ${props.audioTrack.id.slice(0,8)}`);
      updateProperty('volume', value);
      // Clear the manual override after database update completes
      // This allows the track to return to using computed volume from the timeline
      if (audioMixer.value) {
        audioMixer.value.clearTrackVolumeOverride(props.audioTrack.id);
      }
    }, 150);
  }

  function updatePanImmediate(value: number) {
    localPan.value = value;
    
    // Pan updates will be handled by the next syncToTime call
    // since pan is part of the track's computed volume
    
    if (panTimer) clearTimeout(panTimer);
    panTimer = setTimeout(() => {
      updateProperty('pan', value);
    }, 150);
  }

  function updateFadeInImmediate(value: number) {
    localFadeIn.value = value;
    
    // Fade updates will be handled by the next syncToTime call
    
    if (fadeTimer) clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => {
      updateProperty('fade_in', value);
    }, 300);
  }

  function updateFadeOutImmediate(value: number) {
    localFadeOut.value = value;
    
    // Fade updates will be handled by the next syncToTime call
    
    if (fadeTimer) clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => {
      updateProperty('fade_out', value);
    }, 300);
  }

  function updateMuteImmediate(value: number) {
    localIsMuted.value = value;
    
    // Update audio mixer immediately for real-time playback
    if (audioMixer.value) {
      audioMixer.value.setTrackMuted(props.audioTrack.id, value === 1);
    }
    
    updateProperty('is_muted', value);
  }

  function updateSoloImmediate(value: number) {
    localIsSolo.value = value;
    
    // Solo requires updating all other tracks, so we'll let the database update handle it
    
    updateProperty('is_solo', value);
  }
</script>
