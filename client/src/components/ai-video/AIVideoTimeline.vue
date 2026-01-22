<template>
  <div class="ai-video-timeline">
    <!-- Timeline Header -->
    <div class="timeline-header">
      <div class="timeline-title">Timeline</div>
      <div class="timeline-duration">{{ formatTime(duration) }}</div>
    </div>

    <!-- Timeline Tracks -->
    <div class="timeline-tracks">
      <div
        v-for="track in sortedTracks"
        :key="track.id"
        class="timeline-track"
      >
        <div class="track-label">
          <component :is="getTrackIcon(track.type)" :size="14" />
          <span>{{ track.name }}</span>
        </div>
        <div class="track-content">
          <div
            v-for="segment in getTrackSegments(track)"
            :key="segment.id"
            class="track-segment"
            :style="{
              left: `${(segment.startTime / duration) * 100}%`,
              width: `${((segment.endTime - segment.startTime) / duration) * 100}%`,
            }"
            :class="`segment-${track.type}`"
          >
            <div class="segment-label">{{ segment.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Playhead -->
    <div
      class="timeline-playhead"
      :style="{ left: `${(currentTime / duration) * 100}%` }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Image, Video, Music, Type } from 'lucide-vue-next';
import type { AIVideoComposition } from '@/types/ai-video';

const props = defineProps<{
  composition: AIVideoComposition | null;
  currentTime: number;
  duration: number;
}>();

const sortedTracks = computed(() => {
  if (!props.composition) return [];
  return [...props.composition.tracks].sort((a, b) => (b.layer || 0) - (a.layer || 0));
});

function getTrackIcon(type: string) {
  switch (type) {
    case 'video':
      return Video;
    case 'image':
      return Image;
    case 'audio':
      return Music;
    case 'text':
      return Type;
    default:
      return Image;
  }
}

function getTrackSegments(track: any) {
  return [{
    id: track.id,
    startTime: track.startTime,
    endTime: track.endTime,
    label: track.name || track.type,
  }];
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
</script>

<style scoped>
.ai-video-timeline {
  background: #18181b;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1rem;
  position: relative;
  min-height: 200px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding: 0 0.5rem;
}

.timeline-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.timeline-duration {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  font-variant-numeric: tabular-nums;
}

.timeline-tracks {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
}

.timeline-track {
  display: flex;
  gap: 0.75rem;
  min-height: 40px;
}

.track-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 120px;
  flex-shrink: 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.25rem;
}

.track-content {
  flex: 1;
  position: relative;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0.25rem;
  min-height: 40px;
}

.track-segment {
  position: absolute;
  top: 4px;
  bottom: 4px;
  border-radius: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  color: white;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s;
}

.track-segment:hover {
  filter: brightness(1.2);
  transform: translateY(-1px);
}

.segment-video {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: 1px solid rgba(59, 130, 246, 0.5);
}

.segment-image {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  border: 1px solid rgba(139, 92, 246, 0.5);
}

.segment-audio {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: 1px solid rgba(16, 185, 129, 0.5);
}

.segment-text {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border: 1px solid rgba(245, 158, 11, 0.5);
}

.segment-label {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timeline-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #ef4444;
  pointer-events: none;
  z-index: 10;
  transition: left 0.1s linear;
}

.timeline-playhead::before {
  content: '';
  position: absolute;
  top: 0;
  left: -4px;
  width: 10px;
  height: 10px;
  background: #ef4444;
  border-radius: 50%;
}
</style>
