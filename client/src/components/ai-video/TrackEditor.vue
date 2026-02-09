<template>
  <div class="track-editor">
    <div v-if="!composition" class="track-editor-empty">
      <p>Generate a composition to edit tracks</p>
    </div>

    <div v-else class="track-list custom-scrollbar">
      <div
        v-for="track in sortedTracks"
        :key="track.id"
        class="track-item"
        :class="{ 'track-item--expanded': expandedTrack === track.id }"
      >
        <div class="track-header" @click="toggleTrack(track.id)">
          <div class="track-header-left">
            <component :is="getTrackIcon(track.type)" :size="14" class="track-icon" />
            <span class="track-name">{{ track.name }}</span>
            <span class="track-type-badge">{{ track.type }}</span>
          </div>
          <div class="track-header-right">
            <span class="track-time">{{ formatTime(track.startTime) }} - {{ formatTime(track.endTime) }}</span>
            <button
              class="track-toggle-btn"
              @click.stop="toggleTrackVisibility(track)"
              :title="isTrackHidden(track) ? 'Show track' : 'Hide track'"
            >
              <component :is="isTrackHidden(track) ? EyeOff : Eye" :size="14" />
            </button>
            <ChevronDown :size="14" class="track-chevron" :class="{ 'rotated': expandedTrack === track.id }" />
          </div>
        </div>

        <Transition name="expand">
          <div v-if="expandedTrack === track.id" class="track-controls">
            <!-- Text Track Controls -->
            <template v-if="track.type === 'text' && track.properties.text">
              <div class="control-group">
                <label>Text</label>
                <textarea
                  :value="track.properties.text.content"
                  @input="updateTextContent(track, ($event.target as HTMLTextAreaElement).value)"
                  class="control-textarea"
                  rows="2"
                />
              </div>
              <div class="control-row">
                <div class="control-group control-group--half">
                  <label>Size</label>
                  <input
                    type="range"
                    :value="track.properties.text.fontSize"
                    @input="updateTextProp(track, 'fontSize', Number(($event.target as HTMLInputElement).value))"
                    min="16" max="120" step="2"
                    class="control-slider"
                  />
                  <span class="control-value">{{ track.properties.text.fontSize }}px</span>
                </div>
                <div class="control-group control-group--half">
                  <label>Color</label>
                  <input
                    type="color"
                    :value="track.properties.text.color"
                    @input="updateTextProp(track, 'color', ($event.target as HTMLInputElement).value)"
                    class="control-color"
                  />
                </div>
              </div>
              <div class="control-row">
                <div class="control-group control-group--half">
                  <label>X Position</label>
                  <input
                    type="range"
                    :value="typeof track.properties.x === 'number' ? track.properties.x : 50"
                    @input="updateTrackProp(track, 'x', Number(($event.target as HTMLInputElement).value))"
                    min="0" max="100" step="1"
                    class="control-slider"
                  />
                </div>
                <div class="control-group control-group--half">
                  <label>Y Position</label>
                  <input
                    type="range"
                    :value="typeof track.properties.y === 'number' ? track.properties.y : 85"
                    @input="updateTrackProp(track, 'y', Number(($event.target as HTMLInputElement).value))"
                    min="0" max="100" step="1"
                    class="control-slider"
                  />
                </div>
              </div>
            </template>

            <!-- Camera Motion Controls -->
            <template v-if="track.type === 'cameraMotion'">
              <div v-if="track.properties.effects" class="effects-list">
                <div v-for="(effect, idx) in (track.properties as any).effects" :key="idx" class="effect-item">
                  <div class="effect-header">
                    <span class="effect-name">{{ effect.type }}</span>
                    <button class="effect-remove-btn" @click="removeEffect(track, idx)" title="Remove">
                      <X :size="12" />
                    </button>
                  </div>
                  <div v-if="effect.intensity !== undefined" class="control-group">
                    <label>Intensity</label>
                    <input
                      type="range"
                      :value="effect.intensity"
                      @input="updateEffectProp(track, idx, 'intensity', Number(($event.target as HTMLInputElement).value))"
                      min="0" max="1" step="0.01"
                      class="control-slider"
                    />
                    <span class="control-value">{{ (effect.intensity * 100).toFixed(0) }}%</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Impact FX Controls -->
            <template v-if="track.type === 'impactFX'">
              <div v-if="(track.properties as any).effects" class="effects-list">
                <div v-for="(effect, idx) in (track.properties as any).effects" :key="idx" class="effect-item">
                  <div class="effect-header">
                    <span class="effect-name">{{ effect.type }}</span>
                    <span class="effect-time">{{ formatTime(effect.time) }}</span>
                    <button class="effect-remove-btn" @click="removeImpactEffect(track, idx)" title="Remove">
                      <X :size="12" />
                    </button>
                  </div>
                  <div v-if="effect.intensity !== undefined" class="control-group">
                    <label>Intensity</label>
                    <input
                      type="range"
                      :value="effect.intensity"
                      @input="updateImpactEffectProp(track, idx, 'intensity', Number(($event.target as HTMLInputElement).value))"
                      min="0" max="1" step="0.01"
                      class="control-slider"
                    />
                    <span class="control-value">{{ (effect.intensity * 100).toFixed(0) }}%</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Transition Controls -->
            <template v-if="track.type === 'transition'">
              <div v-if="(track.properties as any).transitions" class="effects-list">
                <div v-for="(tr, idx) in (track.properties as any).transitions" :key="idx" class="effect-item">
                  <div class="effect-header">
                    <span class="effect-name">{{ tr.type }}</span>
                    <span class="effect-time">{{ formatTime(tr.time) }}</span>
                    <button class="effect-remove-btn" @click="removeTransition(track, idx)" title="Remove">
                      <X :size="12" />
                    </button>
                  </div>
                  <div class="control-group">
                    <label>Duration</label>
                    <input
                      type="range"
                      :value="tr.duration"
                      @input="updateTransitionProp(track, idx, 'duration', Number(($event.target as HTMLInputElement).value))"
                      min="0.1" max="2" step="0.1"
                      class="control-slider"
                    />
                    <span class="control-value">{{ tr.duration.toFixed(1) }}s</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Video Track Controls -->
            <template v-if="track.type === 'video'">
              <div class="control-row">
                <div class="control-group control-group--half">
                  <label>Scale</label>
                  <input
                    type="range"
                    :value="typeof track.properties.scale === 'number' ? track.properties.scale : 1"
                    @input="updateTrackProp(track, 'scale', Number(($event.target as HTMLInputElement).value))"
                    min="0.5" max="2" step="0.05"
                    class="control-slider"
                  />
                  <span class="control-value">{{ ((typeof track.properties.scale === 'number' ? track.properties.scale : 1) * 100).toFixed(0) }}%</span>
                </div>
                <div class="control-group control-group--half">
                  <label>Opacity</label>
                  <input
                    type="range"
                    :value="typeof track.properties.opacity === 'number' ? track.properties.opacity : 1"
                    @input="updateTrackProp(track, 'opacity', Number(($event.target as HTMLInputElement).value))"
                    min="0" max="1" step="0.05"
                    class="control-slider"
                  />
                  <span class="control-value">{{ ((typeof track.properties.opacity === 'number' ? track.properties.opacity : 1) * 100).toFixed(0) }}%</span>
                </div>
              </div>
            </template>

            <!-- Delete Track -->
            <div class="track-actions">
              <button class="track-delete-btn" @click="deleteTrack(track.id)">
                <Trash2 :size="12" />
                <span>Remove Track</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Video, Music, Type, Layers, Zap, Film, Eye, EyeOff,
  ChevronDown, X, Trash2, Image as ImageIcon, Box
} from 'lucide-vue-next';
import type { AIVideoComposition, AIVideoTrack } from '@/types/ai-video';

const props = defineProps<{
  composition: AIVideoComposition | null;
}>();

const emit = defineEmits<{
  (e: 'update:composition', value: AIVideoComposition): void;
}>();

const expandedTrack = ref<string | null>(null);
const hiddenTracks = ref<Set<string>>(new Set());

const sortedTracks = computed(() => {
  if (!props.composition) return [];
  return [...props.composition.tracks].sort((a, b) => a.layer - b.layer);
});

function getTrackIcon(type: string) {
  switch (type) {
    case 'video': return Video;
    case 'audio': return Music;
    case 'text': return Type;
    case 'shape': return Box;
    case 'image': return ImageIcon;
    case 'cameraMotion': return Layers;
    case 'impactFX': return Zap;
    case 'transition': return Film;
    default: return Layers;
  }
}

function toggleTrack(id: string) {
  expandedTrack.value = expandedTrack.value === id ? null : id;
}

function isTrackHidden(track: AIVideoTrack): boolean {
  return hiddenTracks.value.has(track.id);
}

function toggleTrackVisibility(track: AIVideoTrack) {
  if (hiddenTracks.value.has(track.id)) {
    hiddenTracks.value.delete(track.id);
    updateTrackProp(track, 'opacity', 1);
  } else {
    hiddenTracks.value.add(track.id);
    updateTrackProp(track, 'opacity', 0);
  }
}

function emitUpdate(tracks: AIVideoTrack[]) {
  if (!props.composition) return;
  emit('update:composition', { ...props.composition, tracks });
}

function updateTrackProp(track: AIVideoTrack, prop: string, value: any) {
  if (!props.composition) return;
  const tracks = props.composition.tracks.map(t =>
    t.id === track.id
      ? { ...t, properties: { ...t.properties, [prop]: value } }
      : t
  );
  emitUpdate(tracks);
}

function updateTextContent(track: AIVideoTrack, content: string) {
  if (!props.composition || !track.properties.text) return;
  const tracks = props.composition.tracks.map(t =>
    t.id === track.id
      ? { ...t, properties: { ...t.properties, text: { ...t.properties.text!, content } } }
      : t
  );
  emitUpdate(tracks);
}

function updateTextProp(track: AIVideoTrack, prop: string, value: any) {
  if (!props.composition || !track.properties.text) return;
  const tracks = props.composition.tracks.map(t =>
    t.id === track.id
      ? { ...t, properties: { ...t.properties, text: { ...t.properties.text!, [prop]: value } } }
      : t
  );
  emitUpdate(tracks);
}

function updateEffectProp(track: AIVideoTrack, effectIdx: number, prop: string, value: any) {
  if (!props.composition) return;
  const tracks = props.composition.tracks.map(t => {
    if (t.id !== track.id) return t;
    const effects = [...((t.properties as any).effects || [])];
    effects[effectIdx] = { ...effects[effectIdx], [prop]: value };
    return { ...t, properties: { ...t.properties, effects } };
  });
  emitUpdate(tracks);
}

function updateImpactEffectProp(track: AIVideoTrack, effectIdx: number, prop: string, value: any) {
  updateEffectProp(track, effectIdx, prop, value);
}

function updateTransitionProp(track: AIVideoTrack, transIdx: number, prop: string, value: any) {
  if (!props.composition) return;
  const tracks = props.composition.tracks.map(t => {
    if (t.id !== track.id) return t;
    const transitions = [...((t.properties as any).transitions || [])];
    transitions[transIdx] = { ...transitions[transIdx], [prop]: value };
    return { ...t, properties: { ...t.properties, transitions } as any };
  });
  emitUpdate(tracks);
}

function removeEffect(track: AIVideoTrack, idx: number) {
  if (!props.composition) return;
  const tracks = props.composition.tracks.map(t => {
    if (t.id !== track.id) return t;
    const effects = [...((t.properties as any).effects || [])];
    effects.splice(idx, 1);
    return { ...t, properties: { ...t.properties, effects } };
  });
  emitUpdate(tracks);
}

function removeImpactEffect(track: AIVideoTrack, idx: number) {
  removeEffect(track, idx);
}

function removeTransition(track: AIVideoTrack, idx: number) {
  if (!props.composition) return;
  const tracks = props.composition.tracks.map(t => {
    if (t.id !== track.id) return t;
    const transitions = [...((t.properties as any).transitions || [])];
    transitions.splice(idx, 1);
    return { ...t, properties: { ...t.properties, transitions } as any };
  });
  emitUpdate(tracks);
}

function deleteTrack(id: string) {
  if (!props.composition) return;
  emitUpdate(props.composition.tracks.filter(t => t.id !== id));
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}
</script>

<style scoped>
.track-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.track-editor-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--muted-foreground);
  font-size: 0.8rem;
}

.track-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  padding: 4px;
}

.track-item {
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card);
  overflow: hidden;
}

.track-item--expanded {
  border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
}

.track-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.1s;
}

.track-header:hover {
  background: color-mix(in srgb, var(--primary) 5%, transparent);
}

.track-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.track-icon {
  color: var(--primary);
  flex-shrink: 0;
}

.track-name {
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-type-badge {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--primary) 15%, transparent);
  color: var(--primary);
  font-weight: 500;
  flex-shrink: 0;
}

.track-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.track-time {
  font-size: 10px;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
}

.track-toggle-btn {
  padding: 2px;
  border-radius: 4px;
  color: var(--muted-foreground);
  background: none;
  border: none;
  cursor: pointer;
}

.track-toggle-btn:hover {
  color: var(--foreground);
}

.track-chevron {
  color: var(--muted-foreground);
  transition: transform 0.2s;
}

.track-chevron.rotated {
  transform: rotate(180deg);
}

.track-controls {
  padding: 8px 10px 10px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.control-group label {
  font-size: 10px;
  font-weight: 500;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.control-group--half {
  flex: 1;
  min-width: 0;
}

.control-row {
  display: flex;
  gap: 10px;
}

.control-textarea {
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--foreground);
  font-size: 0.8rem;
  resize: vertical;
  font-family: inherit;
}

.control-slider {
  width: 100%;
  height: 4px;
  accent-color: var(--primary);
  cursor: pointer;
}

.control-color {
  width: 32px;
  height: 24px;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  background: none;
}

.control-value {
  font-size: 10px;
  color: var(--muted-foreground);
  font-variant-numeric: tabular-nums;
}

.effects-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.effect-item {
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--background);
  border: 1px solid var(--border);
}

.effect-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.effect-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--foreground);
}

.effect-time {
  font-size: 10px;
  color: var(--muted-foreground);
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.effect-remove-btn {
  padding: 2px;
  border-radius: 3px;
  color: var(--muted-foreground);
  background: none;
  border: none;
  cursor: pointer;
}

.effect-remove-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.track-actions {
  padding-top: 4px;
  border-top: 1px solid var(--border);
}

.track-delete-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: #ef4444;
  background: none;
  border: none;
  cursor: pointer;
}

.track-delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
