<template>
  <div class="ai-timeline">
    <div class="ai-timeline__container">
      <!-- Time Ruler -->
      <div class="ai-timeline__ruler">
        <div class="ai-timeline__ruler-labels">
          <div
            v-for="mark in timeMarks"
            :key="mark"
            class="ai-timeline__ruler-mark"
            :style="{ left: `${(mark / duration) * 100}%` }"
          >
            <span class="ai-timeline__ruler-label">{{ formatTime(mark) }}</span>
          </div>
        </div>
      </div>

      <!-- Tracks Container -->
      <div class="ai-timeline__tracks-wrapper">
        <div class="ai-timeline__tracks">
          <div
            v-for="track in sortedTracks"
            :key="track.id"
            class="ai-timeline__track"
          >
            <div class="ai-timeline__track-header">
              <div class="ai-timeline__track-info">
                <component :is="getTrackIcon(track.type)" :size="14" class="ai-timeline__track-icon" />
                <span class="ai-timeline__track-name">{{ track.name }}</span>
              </div>
              <span class="ai-timeline__track-badge" :class="`ai-timeline__track-badge--${track.type}`">
                {{ track.type }}
              </span>
            </div>
            
            <div class="ai-timeline__track-content">
              <!-- Show individual effects/transitions for effect tracks -->
              <template v-if="track.type === 'cameraMotion' || track.type === 'impactFX'">
                <div
                  v-for="(effect, idx) in getTrackEffects(track)"
                  :key="`${track.id}-effect-${idx}`"
                  class="ai-timeline__segment ai-timeline__segment--effect"
                  :style="{
                    left: `${(effect.startTime / duration) * 100}%`,
                    width: `${((effect.endTime - effect.startTime) / duration) * 100}%`,
                  }"
                  :class="`ai-timeline__segment--${track.type}`"
                  :title="effect.type"
                >
                  <div class="ai-timeline__segment-content">
                    <span class="ai-timeline__segment-label">{{ effect.type }}</span>
                  </div>
                </div>
              </template>
              
              <!-- Show individual transitions -->
              <template v-else-if="track.type === 'transition'">
                <div
                  v-for="(transition, idx) in getTrackTransitions(track)"
                  :key="`${track.id}-transition-${idx}`"
                  class="ai-timeline__segment ai-timeline__segment--transition"
                  :style="{
                    left: `${(transition.time / duration) * 100}%`,
                    width: `${(transition.duration / duration) * 100}%`,
                  }"
                  :class="`ai-timeline__segment--${track.type}`"
                  :title="transition.type"
                >
                  <div class="ai-timeline__segment-content">
                    <span class="ai-timeline__segment-label">{{ transition.type }}</span>
                  </div>
                </div>
              </template>
              
              <!-- Show full track segment for other types -->
              <template v-else>
                <div
                  class="ai-timeline__segment"
                  :style="{
                    left: `${(track.startTime / duration) * 100}%`,
                    width: `${((track.endTime - track.startTime) / duration) * 100}%`,
                  }"
                  :class="`ai-timeline__segment--${track.type}`"
                >
                  <div class="ai-timeline__segment-content">
                    <span class="ai-timeline__segment-label">{{ formatTime(track.endTime - track.startTime) }}</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Playhead -->
        <div 
          class="ai-timeline__playhead"
          :style="{ left: `${playheadPosition}%` }"
        >
          <div class="ai-timeline__playhead-line"></div>
          <div class="ai-timeline__playhead-handle"></div>
        </div>
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
  const dur = props.composition?.duration || 0;
  console.log('[AITimeline] Duration:', dur);
  return dur;
});

const playheadPosition = computed(() => {
  if (!duration.value || props.currentTime === undefined || props.currentTime === null) {
    return 0;
  }
  const position = (props.currentTime / duration.value) * 100;
  // Log only occasionally to avoid spam
  if (Math.floor(props.currentTime) % 5 === 0) {
    console.log('[AITimeline] Playhead at', props.currentTime.toFixed(2), 's →', position.toFixed(2), '%');
  }
  return position;
});

const sortedTracks = computed(() => {
  if (!props.composition) return [];
  const tracks = [...props.composition.tracks].sort((a, b) => a.layer - b.layer);
  console.log('[AITimeline] Tracks:', tracks.length, tracks.map(t => ({
    name: t.name,
    type: t.type,
    layer: t.layer,
    startTime: t.startTime,
    endTime: t.endTime
  })));
  return tracks;
});

const timeMarks = computed(() => {
  const marks: number[] = [];
  const dur = duration.value;
  
  // Calculate appropriate interval based on duration
  let interval = 2;
  if (dur > 600) interval = 60;        // 10+ min: every minute
  else if (dur > 300) interval = 30;   // 5-10 min: every 30s
  else if (dur > 120) interval = 20;   // 2-5 min: every 20s
  else if (dur > 60) interval = 10;    // 1-2 min: every 10s
  else if (dur > 30) interval = 5;     // 30s-1min: every 5s
  
  for (let i = 0; i <= dur; i += interval) {
    marks.push(i);
  }
  
  console.log('[AITimeline] Time marks:', marks.length, 'marks with interval', interval, 'for duration', dur);
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

function getTrackEffects(track: any) {
  const effects = track.properties?.effects || [];
  console.log(`[AITimeline] Track "${track.name}" effects:`, effects);
  const mapped = effects.map((effect: any) => ({
    ...effect,
    startTime: effect.startTime ?? effect.time ?? 0,
    endTime: effect.endTime ?? (effect.time + effect.duration) ?? 0,
  }));
  console.log(`[AITimeline] Mapped effects:`, mapped);
  return mapped;
}

function getTrackTransitions(track: any) {
  const transitions = track.properties?.transitions || [];
  console.log(`[AITimeline] Track "${track.name}" transitions:`, transitions);
  return transitions;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
}
</script>

<style scoped>
.ai-timeline {
  margin-top: 0.75rem;
  background: var(--sidebar-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  padding-right: 1rem; /* Add right padding to container */
}

.ai-timeline__container {
  position: relative;
}

/* Ruler */
.ai-timeline__ruler {
  height: 20px;
  background: var(--sidebar-surface);
  border-bottom: 1px solid var(--border);
  position: relative;
  padding-right: 1rem; /* Add right padding to match tracks */
}

.ai-timeline__ruler-labels {
  position: relative;
  height: 100%;
}

.ai-timeline__ruler-mark {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  padding-left: 4px;
}

.ai-timeline__ruler-mark::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border);
}

.ai-timeline__ruler-label {
  font-size: 0.625rem;
  font-weight: 500;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
}

/* Tracks Wrapper */
.ai-timeline__tracks-wrapper {
  position: relative;
  overflow-y: auto;
  max-height: 180px;
}

.ai-timeline__tracks {
  position: relative;
}

/* Track */
.ai-timeline__track {
  display: flex;
  border-bottom: 1px solid var(--border);
  min-height: 32px;
}

.ai-timeline__track:last-child {
  border-bottom: none;
}

.ai-timeline__track-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  width: 140px;
  flex-shrink: 0;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
}

.ai-timeline__track-info {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex: 1;
  min-width: 0;
}

.ai-timeline__track-icon {
  flex-shrink: 0;
  color: var(--muted-foreground);
}

.ai-timeline__track-name {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-timeline__track-badge {
  font-size: 0.5625rem;
  font-weight: 600;
  padding: 0.0625rem 0.25rem;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.ai-timeline__track-badge--video { background: var(--sidebar-active); color: var(--sidebar-accent); }
.ai-timeline__track-badge--audio { background: hsl(var(--chart-2) / 0.12); color: hsl(var(--chart-2)); }
.ai-timeline__track-badge--text { background: hsl(var(--chart-3) / 0.12); color: hsl(var(--chart-3)); }
.ai-timeline__track-badge--shape { background: hsl(var(--chart-4) / 0.12); color: hsl(var(--chart-4)); }
.ai-timeline__track-badge--cameraMotion { background: hsl(var(--chart-1) / 0.12); color: hsl(var(--chart-1)); }
.ai-timeline__track-badge--impactFX { background: var(--destructive); color: var(--destructive-foreground); }

/* Track Content */
.ai-timeline__track-content {
  position: relative;
  flex: 1;
  padding: 0.25rem 1rem 0.25rem 0; /* Add right padding */
  background: var(--sidebar-surface);
}

/* Segment */
.ai-timeline__segment {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  overflow: hidden;
}

.ai-timeline__segment::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 100%);
  pointer-events: none;
}

.ai-timeline__segment:hover {
  transform: translateY(-50%) translateY(-1px);
  filter: brightness(1.1);
}

.ai-timeline__segment--video {
  background: var(--sidebar-accent);
}

.ai-timeline__segment--audio {
  background: hsl(var(--chart-2));
}

.ai-timeline__segment--text {
  background: hsl(var(--chart-3));
}

.ai-timeline__segment--shape {
  background: hsl(var(--chart-4));
}

.ai-timeline__segment--cameraMotion {
  background: hsl(var(--chart-1));
}

.ai-timeline__segment--impactFX {
  background: var(--destructive);
}

.ai-timeline__segment-content {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 0.375rem;
}

.ai-timeline__segment-label {
  font-size: 0.625rem;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  white-space: nowrap;
}

/* Playhead */
.ai-timeline__playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px; /* Make slightly wider for visibility */
  pointer-events: none;
  z-index: 100;
  transition: left 0.1s linear;
  margin-left: 140px; /* Offset for track headers */
}

.ai-timeline__playhead-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 1px;
  background: var(--sidebar-accent);
  box-shadow: 0 0 4px var(--sidebar-active);
}

.ai-timeline__playhead-handle {
  position: absolute;
  top: -3px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 8px;
  background: var(--sidebar-accent);
  border: 1.5px solid var(--background);
  border-radius: 50%;
  box-shadow: 0 1px 4px var(--sidebar-active);
}
</style>
