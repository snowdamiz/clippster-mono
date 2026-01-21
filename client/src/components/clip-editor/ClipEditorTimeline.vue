<template>
  <div class="editor-timeline">
    <div class="editor-timeline__tracks">
      <!-- Video Track -->
      <div class="editor-timeline__track">
        <div class="editor-timeline__track-label">
          <Film :size="14" />
          <span>V1</span>
        </div>
        <div class="editor-timeline__track-content" @click="handleTrackClick">
          <!-- Intro segment (if present) -->
          <div
            v-if="introRef"
            class="editor-timeline__segment editor-timeline__segment--intro"
            :style="getSegmentStyle(0, introRef.duration)"
          >
            <span class="editor-timeline__segment-label">Intro</span>
          </div>

          <!-- Main video segments -->
          <div
            class="editor-timeline__segment editor-timeline__segment--video"
            :class="{ 'editor-timeline__segment--selected': selectedItem === 'main' && selectedItemType === 'segment' }"
            :style="getSegmentStyle(introOffset, duration - introOffset - outroOffset)"
            @click.stop="selectItem('main', 'segment')"
          >
            <span class="editor-timeline__segment-label">Main Content</span>
          </div>

          <!-- Outro segment (if present) -->
          <div
            v-if="outroRef"
            class="editor-timeline__segment editor-timeline__segment--outro"
            :style="getSegmentStyle(duration - outroOffset, outroRef.duration)"
          >
            <span class="editor-timeline__segment-label">Outro</span>
          </div>

          <!-- Playhead -->
          <div
            class="editor-timeline__playhead"
            :class="{ 'editor-timeline__playhead--dragging': isDraggingPlayhead }"
            :style="{ left: playheadPosition + 'px' }"
            @mousedown="handlePlayheadMouseDown"
          >
            <div class="editor-timeline__playhead-line"></div>
            <div class="editor-timeline__playhead-handle"></div>
          </div>
        </div>
      </div>

      <!-- Audio Track (original) -->
      <div class="editor-timeline__track">
        <div class="editor-timeline__track-label">
          <Music :size="14" />
          <span>A0</span>
        </div>
        <div class="editor-timeline__track-content" @click="handleTrackClick">
          <!-- Audio waveform placeholder -->
          <div class="editor-timeline__waveform">
            <div class="editor-timeline__waveform-bars">
              <!-- Simplified waveform bars -->
              <div
                v-for="i in 100"
                :key="i"
                class="editor-timeline__waveform-bar"
                :style="{ height: Math.random() * 100 + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Additional Audio Tracks -->
      <div
        v-for="(audioTrack, index) in audioTracks"
        :key="audioTrack.id"
        class="editor-timeline__track"
      >
        <div class="editor-timeline__track-label">
          <Music :size="14" />
          <span>A{{ index + 1 }}</span>
        </div>
        <div class="editor-timeline__track-content" @click="handleTrackClick">
          <div
            class="editor-timeline__segment editor-timeline__segment--audio"
            :class="{ 'editor-timeline__segment--selected': selectedItem?.id === audioTrack.id }"
            :style="getSegmentStyle(audioTrack.start_time, audioTrack.end_time - audioTrack.start_time)"
            @click.stop="selectItem(audioTrack, 'audio')"
          >
            <span class="editor-timeline__segment-label">{{ audioTrack.name }}</span>
            
            <!-- Mute/Solo indicators -->
            <div class="editor-timeline__track-indicators">
              <span v-if="audioTrack.is_muted" class="editor-timeline__indicator editor-timeline__indicator--muted">M</span>
              <span v-if="audioTrack.is_solo" class="editor-timeline__indicator editor-timeline__indicator--solo">S</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Text Track -->
      <div
        v-if="textOverlays.length > 0"
        class="editor-timeline__track"
      >
        <div class="editor-timeline__track-label">
          <Type :size="14" />
          <span>T1</span>
        </div>
        <div class="editor-timeline__track-content" @click="handleTrackClick">
          <div
            v-for="textOverlay in textOverlays"
            :key="textOverlay.id"
            class="editor-timeline__segment editor-timeline__segment--text"
            :class="{ 'editor-timeline__segment--selected': selectedItem?.id === textOverlay.id }"
            :style="getSegmentStyle(textOverlay.start_time, textOverlay.end_time - textOverlay.start_time)"
            @click.stop="selectItem(textOverlay, 'text')"
          >
            <span class="editor-timeline__segment-label">{{ truncate(textOverlay.text, 20) }}</span>
          </div>
        </div>
      </div>

      <!-- Sticker Track -->
      <div
        v-if="stickers.length > 0"
        class="editor-timeline__track"
      >
        <div class="editor-timeline__track-label">
          <Smile :size="14" />
          <span>S1</span>
        </div>
        <div class="editor-timeline__track-content" @click="handleTrackClick">
          <div
            v-for="sticker in stickers"
            :key="sticker.id"
            class="editor-timeline__segment editor-timeline__segment--sticker"
            :class="{ 'editor-timeline__segment--selected': selectedItem?.id === sticker.id }"
            :style="getSegmentStyle(sticker.start_time, sticker.end_time - sticker.start_time)"
            @click.stop="selectItem(sticker, 'sticker')"
          >
            <span class="editor-timeline__segment-label">Sticker</span>
          </div>
        </div>
      </div>

      <!-- Watermark Track -->
      <div
        v-if="watermarks.length > 0"
        class="editor-timeline__track"
      >
        <div class="editor-timeline__track-label">
          <Image :size="14" />
          <span>W1</span>
        </div>
        <div class="editor-timeline__track-content" @click="handleTrackClick">
          <div
            v-for="watermark in watermarks"
            :key="watermark.id"
            class="editor-timeline__segment editor-timeline__segment--watermark"
            :class="{ 'editor-timeline__segment--selected': selectedItem?.id === watermark.id }"
            :style="getSegmentStyle(watermark.start_time, watermark.end_time - watermark.start_time)"
            @click.stop="selectItem(watermark, 'watermark')"
          >
            <span class="editor-timeline__segment-label">Watermark</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Film, Music, Type, Smile, Image } from 'lucide-vue-next';
import type { FullVideoEditorEdit } from '@/services/database/video-editor-edits';
import type { IntroOutroRef } from '@/types';

const props = defineProps<{
  editorEdit: FullVideoEditorEdit | null;
  currentTime: number;
  duration: number;
  zoomLevel: number;
  selectedItem: any;
  introRef: IntroOutroRef | null;
  outroRef: IntroOutroRef | null;
}>();

const emit = defineEmits<{
  (e: 'seek', time: number): void;
  (e: 'selectItem', item: any, type: string): void;
  (e: 'updateItem', item: any): void;
}>();

// Track width (pixels per second)
const pixelsPerSecond = computed(() => 100 * props.zoomLevel);

// Intro/outro offsets
const introOffset = computed(() => props.introRef?.duration || 0);
const outroOffset = computed(() => props.outroRef?.duration || 0);

// Playhead position
const playheadPosition = computed(() => {
  return props.currentTime * pixelsPerSecond.value;
});

// Extract items from editor edit
const audioTracks = computed(() => props.editorEdit?.audioTracks || []);
const textOverlays = computed(() => props.editorEdit?.textOverlays || []);
const stickers = computed(() => props.editorEdit?.stickers || []);
const watermarks = computed(() => props.editorEdit?.watermarks || []);

// Get segment style based on time and duration
function getSegmentStyle(startTime: number, segmentDuration: number) {
  return {
    left: startTime * pixelsPerSecond.value + 'px',
    width: segmentDuration * pixelsPerSecond.value + 'px',
  };
}

// Playhead dragging state
const isDraggingPlayhead = ref(false);

// Handle track click to seek
function handleTrackClick(event: MouseEvent) {
  const track = event.currentTarget as HTMLElement;
  const rect = track.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const time = clickX / pixelsPerSecond.value;
  emit('seek', Math.max(0, Math.min(time, props.duration)));
}

// Handle playhead drag
function handlePlayheadMouseDown(event: MouseEvent) {
  event.stopPropagation();
  isDraggingPlayhead.value = true;
  
  const onMouseMove = (e: MouseEvent) => {
    if (!isDraggingPlayhead.value) return;
    
    // Find the track content element to calculate position
    const trackContent = document.querySelector('.editor-timeline__track-content');
    if (!trackContent) return;
    
    const rect = trackContent.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const time = clickX / pixelsPerSecond.value;
    emit('seek', Math.max(0, Math.min(time, props.duration)));
  };
  
  const onMouseUp = () => {
    isDraggingPlayhead.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

// Props access for comparison
const selectedItemType = computed(() => props.selectedItem ? 'segment' : null);

// Select item
function selectItem(item: any, type: string) {
  emit('selectItem', item, type);
}

// Truncate text
function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}
</script>

<style scoped>
.editor-timeline {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  background-color: #0a0a0a;
}

.editor-timeline__tracks {
  display: flex;
  flex-direction: column;
  min-width: max-content;
}

.editor-timeline__track {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 48px;
}

.editor-timeline__track-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 60px;
  padding: 0 0.75rem;
  background-color: rgba(0, 0, 0, 0.4);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8125rem;
  font-weight: 600;
  flex-shrink: 0;
}

.editor-timeline__track-content {
  position: relative;
  flex: 1;
  min-height: 48px;
  cursor: pointer;
}

.editor-timeline__segment {
  position: absolute;
  top: 4px;
  height: 40px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 150ms ease;
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  overflow: hidden;
}

.editor-timeline__segment:hover {
  border-color: rgba(255, 255, 255, 0.4);
  z-index: 1;
}

.editor-timeline__segment--selected {
  border-color: rgba(255, 255, 255, 0.8);
  border-width: 2px;
  z-index: 2;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.4);
}

.editor-timeline__segment--intro,
.editor-timeline__segment--outro {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(99, 102, 241, 0.2) 100%);
  border-color: rgba(99, 102, 241, 0.4);
}

.editor-timeline__segment--video {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.2) 100%);
  border-color: rgba(139, 92, 246, 0.4);
}

.editor-timeline__segment--audio {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.2) 100%);
  border-color: rgba(34, 197, 94, 0.4);
}

.editor-timeline__segment--text {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.3) 0%, rgba(251, 191, 36, 0.2) 100%);
  border-color: rgba(251, 191, 36, 0.4);
}

.editor-timeline__segment--sticker {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.3) 0%, rgba(236, 72, 153, 0.2) 100%);
  border-color: rgba(236, 72, 153, 0.4);
}

.editor-timeline__segment--watermark {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(59, 130, 246, 0.2) 100%);
  border-color: rgba(59, 130, 246, 0.4);
}

.editor-timeline__segment-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.editor-timeline__playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  pointer-events: auto;
  z-index: 10;
  cursor: ew-resize;
}

.editor-timeline__playhead--dragging {
  cursor: grabbing;
}

.editor-timeline__playhead-line {
  width: 100%;
  height: 100%;
  background-color: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
}

.editor-timeline__playhead::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid #ef4444;
  pointer-events: none;
}

.editor-timeline__playhead-handle {
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 12px;
  background-color: #ef4444;
  border: 2px solid #fff;
  border-radius: 50%;
  cursor: ew-resize;
  transition: transform 150ms ease;
}

.editor-timeline__playhead:hover .editor-timeline__playhead-handle,
.editor-timeline__playhead--dragging .editor-timeline__playhead-handle {
  transform: translateX(-50%) scale(1.3);
}

.editor-timeline__waveform {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 4px 0;
}

.editor-timeline__waveform-bars {
  display: flex;
  align-items: center;
  gap: 2px;
  width: 100%;
  height: 100%;
}

.editor-timeline__waveform-bar {
  flex: 1;
  background: linear-gradient(180deg, rgba(34, 197, 94, 0.6) 0%, rgba(34, 197, 94, 0.3) 100%);
  border-radius: 1px;
  min-height: 2px;
}

.editor-timeline__track-indicators {
  display: flex;
  gap: 0.25rem;
  margin-left: auto;
  padding-left: 0.5rem;
}

.editor-timeline__indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 3px;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.editor-timeline__indicator--muted {
  background-color: rgba(239, 68, 68, 0.3);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.5);
}

.editor-timeline__indicator--solo {
  background-color: rgba(251, 191, 36, 0.3);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.5);
}
</style>

