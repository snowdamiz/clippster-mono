<template>
  <div class="ai-timeline flex h-full min-h-0 flex-col">
    <!-- Time ruler (offset by the track header column) -->
    <div class="relative h-5 shrink-0 border-b border-line-subtle bg-surface pl-[var(--track-header)] pr-4">
      <div class="relative h-full">
        <div
          v-for="mark in timeMarks"
          :key="mark"
          class="absolute top-0 flex h-full items-center border-l border-line pl-1"
          :style="{ left: `${(mark / duration) * 100}%` }"
        >
          <span class="tabular text-2xs text-fg-subtle">{{ formatTime(mark) }}</span>
        </div>
      </div>
    </div>

    <!-- Tracks -->
    <div class="relative min-h-0 flex-1 overflow-y-auto">
      <div
        v-for="track in sortedTracks"
        :key="track.id"
        class="flex min-h-8 border-b border-line-subtle last:border-b-0"
      >
        <div
          class="flex w-[var(--track-header)] shrink-0 items-center gap-1.5 border-r border-line-subtle bg-panel px-2 py-1.5"
        >
          <component :is="getTrackIcon(track.type)" class="size-3.5 shrink-0 text-fg-subtle" />
          <span class="min-w-0 flex-1 truncate text-xs text-fg" :title="track.name">{{ track.name }}</span>
          <span
            class="size-2 shrink-0 rounded-full"
            :style="{ background: trackColor(track.type) }"
            :title="track.type"
            :aria-label="track.type"
          />
        </div>

        <div class="relative min-w-0 flex-1 bg-surface py-1 pr-4">
          <!-- Effect tracks: individual effects -->
          <template v-if="track.type === 'cameraMotion' || track.type === 'impactFX'">
            <div
              v-for="(effect, idx) in getTrackEffects(track)"
              :key="`${track.id}-effect-${idx}`"
              class="ai-timeline__segment"
              :style="segmentStyle(track.type, effect.startTime, effect.endTime - effect.startTime)"
              :title="effect.type"
            >
              <span class="truncate">{{ effect.type }}</span>
            </div>
          </template>

          <!-- Transition tracks: individual transitions -->
          <template v-else-if="track.type === 'transition'">
            <div
              v-for="(transition, idx) in getTrackTransitions(track)"
              :key="`${track.id}-transition-${idx}`"
              class="ai-timeline__segment"
              :style="segmentStyle(track.type, transition.time, transition.duration)"
              :title="transition.type"
            >
              <span class="truncate">{{ transition.type }}</span>
            </div>
          </template>

          <!-- Everything else: one segment for the track span -->
          <div
            v-else
            class="ai-timeline__segment"
            :style="segmentStyle(track.type, track.startTime, track.endTime - track.startTime)"
          >
            <span class="tabular truncate">{{ formatTime(track.endTime - track.startTime) }}</span>
          </div>
        </div>
      </div>

      <!-- Playhead -->
      <div
        class="pointer-events-none absolute inset-y-0 z-10 w-px bg-brand transition-[left] duration-100 ease-linear"
        :style="{ left: `calc(var(--track-header) + (100% - var(--track-header) - 1rem) * ${playheadPosition / 100})` }"
      >
        <span class="absolute -left-[3.5px] -top-px size-2 rounded-full bg-brand" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Video, Music, Type, Shapes, Camera, Zap, Repeat } from 'lucide-vue-next';
import type { AIVideoComposition } from '@/types/ai-video';

const props = defineProps<{
  composition: AIVideoComposition | null;
  currentTime?: number;
}>();

const duration = computed(() => {
  return props.composition?.duration || 0;
});

const playheadPosition = computed(() => {
  if (!duration.value || props.currentTime === undefined || props.currentTime === null) {
    return 0;
  }
  return (props.currentTime / duration.value) * 100;
});

const sortedTracks = computed(() => {
  if (!props.composition) return [];
  return [...props.composition.tracks].sort((a, b) => a.layer - b.layer);
});

const timeMarks = computed(() => {
  const marks: number[] = [];
  const dur = duration.value;
  
  let interval = 2;
  if (dur > 600) interval = 60;
  else if (dur > 300) interval = 30;
  else if (dur > 120) interval = 20;
  else if (dur > 60) interval = 10;
  else if (dur > 30) interval = 5;
  
  for (let i = 0; i <= dur; i += interval) {
    marks.push(i);
  }
  
  return marks;
});

function getTrackIcon(type: string) {
  switch (type) {
    case 'video':
    case 'image':
      return Video;
    case 'audio':
      return Music;
    case 'text':
      return Type;
    case 'shape':
      return Shapes;
    case 'cameraMotion':
      return Camera;
    case 'impactFX':
      return Zap;
    case 'transition':
      return Repeat;
    default:
      return Video;
  }
}

// Track colors are data colors (the shared --track-* palette).
const TRACK_COLORS: Record<string, string> = {
  video: 'var(--track-video)',
  image: 'var(--track-video)',
  audio: 'var(--track-audio)',
  text: 'var(--track-text)',
  shape: 'var(--track-sticker)',
  cameraMotion: 'var(--track-intro)',
  impactFX: 'var(--danger)',
  transition: 'var(--track-watermark)',
};

function trackColor(type: string) {
  return TRACK_COLORS[type] || 'var(--track-video)';
}

function segmentStyle(type: string, start: number, length: number) {
  const dur = duration.value || 1;
  return {
    left: `${(start / dur) * 100}%`,
    width: `${(length / dur) * 100}%`,
    '--segment-color': trackColor(type),
  };
}

function getTrackEffects(track: any) {
  const effects = track.properties?.effects || [];
  return effects.map((effect: any) => ({
    ...effect,
    startTime: effect.startTime ?? effect.time ?? 0,
    endTime: effect.endTime ?? ((effect.time ?? 0) + (effect.duration ?? 0)),
  }));
}

function getTrackTransitions(track: any) {
  return track.properties?.transitions || [];
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
}
</script>

<style scoped>
  .ai-timeline {
    --track-header: 140px;
  }

  /* Timeline clip: tinted fill + colored edge in the track's data color */
  .ai-timeline__segment {
    position: absolute;
    top: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 22px;
    min-width: 4px;
    padding: 0 6px;
    transform: translateY(-50%);
    overflow: hidden;
    border-radius: 4px;
    border: 1px solid color-mix(in srgb, var(--segment-color) 60%, transparent);
    background: color-mix(in srgb, var(--segment-color) 28%, var(--surface));
    color: var(--fg);
    font-size: 0.6875rem;
    font-weight: 500;
    white-space: nowrap;
  }
</style>
