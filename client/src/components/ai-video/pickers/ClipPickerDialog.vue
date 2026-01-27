<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="clip-picker__overlay" @click.self="close">
        <Transition name="dialog" appear>
          <div v-if="isOpen" class="clip-picker" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="clip-picker__accent"></div>

            <!-- Header -->
            <div class="clip-picker__header">
              <button class="clip-picker__close" @click="close" title="Close">
                <X :size="18" />
              </button>
              <div class="clip-picker__icon">
                <Video :size="24" />
              </div>
              <h2 class="clip-picker__title">Select Clips</h2>
              <p class="clip-picker__subtitle">Choose built clips to use in your AI video. All edits, audio tracks, and effects will be preserved.</p>
            </div>

            <!-- Content -->
            <div class="clip-picker__content">
        <!-- Filters -->
        <div class="clip-picker__filters">
          <div class="clip-picker__search">
            <Search class="clip-picker__search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search clips..."
              class="clip-picker__search-input"
            />
          </div>

          <select v-model="projectFilter" class="clip-picker__filter">
            <option value="all">All Projects</option>
            <option v-for="project in projects" :key="project.id" :value="project.id">
              {{ project.name }}
            </option>
          </select>

          <select v-model="aspectRatioFilter" class="clip-picker__filter">
            <option value="all">All Ratios</option>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
            <option value="4:5">4:5</option>
          </select>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="clip-picker__loading">
          <Loader2 class="clip-picker__loading-icon" />
          <p>Loading clips...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="displayClips.length === 0" class="clip-picker__empty">
          <Video class="clip-picker__empty-icon" />
          <p class="clip-picker__empty-text">No clips found</p>
          <p class="clip-picker__empty-hint">
            {{ searchQuery ? 'Try adjusting your search or filters' : 'Build some clips first to use them here' }}
          </p>
        </div>

        <!-- Clips Grid -->
        <div v-else class="clip-picker__grid">
          <div
            v-for="clipData in displayClips"
            :key="clipData.clip.id"
            class="clip-picker__card"
            :class="{ 'clip-picker__card--selected': isSelected(clipData.clip.id) }"
            @click="toggleSelection(clipData)"
          >
            <!-- Selection Checkbox -->
            <div
              class="clip-picker__checkbox"
              :class="{ 'clip-picker__checkbox--visible': isSelected(clipData.clip.id) }"
              @click.stop="toggleSelection(clipData)"
            >
              <div
                class="clip-picker__checkbox-inner"
                :class="{ 'clip-picker__checkbox-inner--checked': isSelected(clipData.clip.id) }"
              >
                <Check v-if="isSelected(clipData.clip.id)" class="clip-picker__checkbox-icon" />
              </div>
            </div>

            <!-- Thumbnail -->
            <div class="clip-picker__thumbnail">
              <img
                v-if="getThumbnailUrl(clipData.clip)"
                :src="getThumbnailUrl(clipData.clip)"
                :alt="clipData.clip.name || 'Clip'"
                class="clip-picker__thumbnail-img"
              />
              <div v-else class="clip-picker__thumbnail-placeholder">
                <Video :size="48" class="clip-picker__thumbnail-icon" />
              </div>
            </div>

            <!-- Info -->
            <div class="clip-picker__info">
              <h4 class="clip-picker__name">{{ clipData.clip.name || 'Untitled Clip' }}</h4>
            </div>
          </div>
        </div>
      </div>

            <!-- Footer -->
            <div class="clip-picker__footer">
              <button @click="cancel" class="clip-picker__btn clip-picker__btn--secondary">
                Cancel
              </button>
              <button @click="confirm" :disabled="selectedClips.length === 0" class="clip-picker__btn clip-picker__btn--primary">
                Add {{ selectedClips.length }} Clip{{ selectedClips.length !== 1 ? 's' : '' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { Search, Video, Music, Type, Sparkles, Check, Loader2, X } from 'lucide-vue-next';
import { invoke } from '@tauri-apps/api/core';
import { getAllClipsWithBuilds } from '@/services/database/clip-build';
import { getClipEdit, getClipAudioTracks, getClipTextOverlays, getClipStickers, getClipWatermarks, getClipEffects } from '@/services/database/clip-edits';
import type { Clip, ClipBuild } from '@/services/database/types';
import type { 
  ClipAudioTrackRecord, 
  ClipTextOverlayRecord, 
  ClipStickerRecord, 
  ClipWatermarkRecord, 
  ClipEffectRecord 
} from '@/services/database/clip-edits';
import type { ImportedClipData } from '@/types/ai-video';

interface ClipWithFullData {
  clip: Clip & { builds: ClipBuild[] };
  editData?: {
    audioTracks: ClipAudioTrackRecord[];
    textOverlays: ClipTextOverlayRecord[];
    stickers: ClipStickerRecord[];
    watermarks: ClipWatermarkRecord[];
    effects: ClipEffectRecord[];
  };
}

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'select', clips: ImportedClipData[]): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const loading = ref(false);
const allClips = ref<ClipWithFullData[]>([]);
const selectedClips = ref<ClipWithFullData[]>([]);

// Debug: expose allClips length for template
const clipCount = computed(() => allClips.value.length);
const searchQuery = ref('');
const projectFilter = ref('all');
const aspectRatioFilter = ref('all');
const thumbnailCache = ref<Map<string, string>>(new Map());

function close() {
  cancel();
}

function getThumbnailUrl(clip: Clip & { builds: ClipBuild[] }): string | undefined {
  return thumbnailCache.value.get(clip.id);
}

// Helper to extract output paths from a build (same as Clips.vue)
function getOutputPathsFromBuild(build: ClipBuild): string[] {
  if (build.output_paths) {
    try {
      const parsed = JSON.parse(build.output_paths);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // If parsing fails, try using it as a single path
      if (typeof build.output_paths === 'string') {
        return [build.output_paths];
      }
    }
  }
  // Fallback to file_path if output_paths not available
  if (build.file_path) {
    return [build.file_path];
  }
  return [];
}

// Derive thumbnail path from video file path (same pattern as Clips.vue)
function deriveThumbnailPath(videoPath: string): string {
  // Extract filename without extension
  const parts = videoPath.split(/[/\\]/);
  const filename = parts.pop() || '';
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  
  // Get the thumbnails directory (parent of clips directory)
  const clipsIndex = videoPath.toLowerCase().indexOf('clips');
  if (clipsIndex > 0) {
    const basePath = videoPath.substring(0, clipsIndex);
    return `${basePath}thumbnails/${nameWithoutExt}_thumb.jpg`;
  }
  
  // Fallback: put thumbnail next to video
  return videoPath.replace(/\.[^.]+$/, '_thumb.jpg');
}

async function loadThumbnails() {
  // Load thumbnails for all clips that don't have one cached yet
  const clipsToLoad = allClips.value.filter(
    (clipData) => !thumbnailCache.value.has(clipData.clip.id)
  );

  if (clipsToLoad.length === 0) return;

  await Promise.all(
    clipsToLoad.map(async (clipData) => {
      const clip = clipData.clip;
      
      // Try multiple thumbnail sources in order of preference
      const thumbnailCandidates: string[] = [];
      
      // 1. Try built_thumbnail_path from clip
      if (clip.built_thumbnail_path) {
        thumbnailCandidates.push(clip.built_thumbnail_path);
      }
      
      // 2. Try deriving from built_file_path
      if (clip.built_file_path) {
        thumbnailCandidates.push(deriveThumbnailPath(clip.built_file_path));
      }
      
      // 3. Try thumbnail from builds
      if (clip.builds) {
        for (const build of clip.builds) {
          if (build.status === 'completed') {
            if (build.thumbnail_path) {
              thumbnailCandidates.push(build.thumbnail_path);
            }
            // Try deriving from build output paths
            const outputPaths = getOutputPathsFromBuild(build);
            for (const outputPath of outputPaths) {
              thumbnailCandidates.push(deriveThumbnailPath(outputPath));
            }
          }
        }
      }
      
      // Try each candidate until one works
      for (const thumbnailPath of thumbnailCandidates) {
        try {
          const exists = await invoke<boolean>('check_file_exists', { path: thumbnailPath });
          if (exists) {
            const dataUrl = await invoke<string>('read_file_as_data_url', {
              filePath: thumbnailPath,
            });
            thumbnailCache.value.set(clip.id, dataUrl);
            return; // Success, stop trying
          }
        } catch (err) {
          // Continue to next candidate
        }
      }
      
      console.warn(`[ClipPickerDialog] No thumbnail found for clip ${clip.id}`);
    })
  );
}

const projects = computed(() => {
  const projectMap = new Map<string, { id: string; name: string }>();
  allClips.value.forEach(clipData => {
    if (clipData.clip.project_id && clipData.clip.project_name) {
      projectMap.set(clipData.clip.project_id, {
        id: clipData.clip.project_id,
        name: clipData.clip.project_name,
      });
    }
  });
  return Array.from(projectMap.values());
});

// Use allClips directly with computed filtering - simpler reactivity
const displayClips = computed(() => {
  const result = allClips.value.filter(clipData => {
    const clip = clipData.clip;
    
    // Search filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      const name = (clip.name || '').toLowerCase();
      const projectName = (clip.project_name || '').toLowerCase();
      if (!name.includes(query) && !projectName.includes(query)) {
        return false;
      }
    }

    // Project filter
    if (projectFilter.value !== 'all' && clip.project_id !== projectFilter.value) {
      return false;
    }
    
    return true;
  });
  console.log('[ClipPickerDialog] displayClips computed:', {
    allClipsLength: allClips.value.length,
    resultLength: result.length,
    searchQuery: searchQuery.value,
    projectFilter: projectFilter.value,
    sampleClip: result[0]?.clip?.name
  });
  return result;
});

// Load clips when dialog opens
watch(() => props.modelValue, async (open) => {
  console.log('[ClipPickerDialog] Watch triggered, open:', open);
  if (open) {
    await loadClips();
  }
}, { immediate: true });

// Also load on mount if already open
onMounted(async () => {
  console.log('[ClipPickerDialog] Mounted, isOpen:', props.modelValue);
  if (props.modelValue) {
    await loadClips();
  }
});

async function loadClips() {
  loading.value = true;
  try {
    const clipsWithBuilds = await getAllClipsWithBuilds();
    console.log('[ClipPickerDialog] Total clips loaded:', clipsWithBuilds.length);
    
    // Filter to clips that have completed builds with actual output files
    const completedClips: (Clip & { builds: ClipBuild[] })[] = [];
    
    for (const clip of clipsWithBuilds) {
      // Check if clip has any completed builds with output files
      if (clip.builds && clip.builds.length > 0) {
        for (const build of clip.builds) {
          if (build.status === 'completed') {
            const outputPaths = getOutputPathsFromBuild(build);
            if (outputPaths.length > 0) {
              // Verify at least one output file exists
              for (const filePath of outputPaths) {
                try {
                  const fileExists = await invoke<boolean>('check_file_exists', { path: filePath });
                  if (fileExists) {
                    // Update clip with the first valid built file path for display
                    if (!clip.built_file_path) {
                      clip.built_file_path = filePath;
                    }
                    completedClips.push(clip);
                    break; // Found a valid build, move to next clip
                  }
                } catch (err) {
                  console.warn('[ClipPickerDialog] Error checking file:', err);
                }
              }
              if (completedClips.includes(clip)) break; // Already added this clip
            }
          }
        }
      }
    }
    
    console.log('[ClipPickerDialog] Clips with verified built files:', completedClips.length);
    
    if (completedClips.length > 0) {
      console.log('[ClipPickerDialog] Sample clip:', {
        id: completedClips[0].id,
        name: completedClips[0].name,
        built_file_path: completedClips[0].built_file_path,
        builds: completedClips[0].builds?.length,
      });
    }

    // Load full edit data for each clip
    const clipsWithFullData = await Promise.all(
      completedClips.map(async (clip) => {
        try {
          // Get the clip edit record
          const editRecord = await getClipEdit(clip.id);
          
          if (editRecord) {
            // Load all edit components
            const [audioTracks, textOverlays, stickers, watermarks, effects] = await Promise.all([
              getClipAudioTracks(editRecord.id),
              getClipTextOverlays(editRecord.id),
              getClipStickers(editRecord.id),
              getClipWatermarks(editRecord.id),
              getClipEffects(editRecord.id),
            ]);

            return {
              clip,
              editData: {
                audioTracks,
                textOverlays,
                stickers,
                watermarks,
                effects,
              },
            };
          }
          
          return { clip, editData: undefined };
        } catch (error) {
          console.error(`Failed to load edit data for clip ${clip.id}:`, error);
          return { clip, editData: undefined };
        }
      })
    );

    // Set the clips
    allClips.value = clipsWithFullData;
    console.log('[ClipPickerDialog] Final allClips.value length:', allClips.value.length);
    
    // Load thumbnails after clips are loaded
    await loadThumbnails();
  } catch (error) {
    console.error('Failed to load clips:', error);
  } finally {
    loading.value = false;
  }
}

function isSelected(clipId: string): boolean {
  return selectedClips.value.some(c => c.clip.id === clipId);
}

function toggleSelection(clipData: ClipWithFullData) {
  const index = selectedClips.value.findIndex(c => c.clip.id === clipData.clip.id);
  if (index >= 0) {
    selectedClips.value.splice(index, 1);
  } else {
    selectedClips.value.push(clipData);
  }
}

function cancel() {
  selectedClips.value = [];
  isOpen.value = false;
}

function confirm() {
  const importedClips: ImportedClipData[] = selectedClips.value.map(clipData => ({
    id: clipData.clip.id,
    name: clipData.clip.name || 'Untitled Clip',
    videoPath: clipData.clip.built_file_path || clipData.clip.file_path,
    thumbnailPath: getThumbnailUrl(clipData.clip) || clipData.clip.built_thumbnail_path || '',
    duration: clipData.clip.built_duration || clipData.clip.duration || 0,
    
    audioTracks: clipData.editData?.audioTracks.map(track => ({
      filePath: track.file_path,
      name: track.name,
      startTime: track.start_time,
      endTime: track.end_time,
      volume: track.volume,
      pan: track.pan,
      fadeIn: track.fade_in,
      fadeOut: track.fade_out,
    })) || [],
    
    textOverlays: clipData.editData?.textOverlays.map(overlay => ({
      text: overlay.text,
      startTime: overlay.start_time,
      endTime: overlay.end_time,
      positionX: overlay.position_x,
      positionY: overlay.position_y,
      styleData: JSON.parse(overlay.style_data),
      animation: overlay.animation,
    })) || [],
    
    stickers: clipData.editData?.stickers.map(sticker => ({
      stickerPath: sticker.sticker_path,
      startTime: sticker.start_time,
      endTime: sticker.end_time,
      positionX: sticker.position_x,
      positionY: sticker.position_y,
      scale: sticker.scale,
      rotation: sticker.rotation,
    })) || [],
    
    watermarks: clipData.editData?.watermarks.map(watermark => ({
      watermarkPath: watermark.watermark_path,
      startTime: watermark.start_time,
      endTime: watermark.end_time,
      positionX: watermark.position_x,
      positionY: watermark.position_y,
      scale: watermark.scale,
      opacity: watermark.opacity,
    })) || [],
    
    effects: clipData.editData?.effects.map(effect => ({
      effectType: effect.effect_type,
      startTime: effect.start_time,
      endTime: effect.end_time,
      settings: JSON.parse(effect.settings),
    })) || [],
  }));

  emit('select', importedClips);
  selectedClips.value = [];
  isOpen.value = false;
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
</script>

<style scoped>
/* ===== Overlay ===== */
.clip-picker__overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* ===== Dialog Container ===== */
.clip-picker {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 100%;
  max-width: 680px;
  margin: 1rem;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

/* ===== Accent Bar ===== */
.clip-picker__accent {
  height: 3px;
  background: var(--sidebar-accent);
  flex-shrink: 0;
}

/* ===== Header ===== */
.clip-picker__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1.5rem 1rem;
  text-align: center;
}

.clip-picker__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.clip-picker__close:hover {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.clip-picker__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background-color: var(--sidebar-active);
  color: var(--sidebar-accent);
  margin-bottom: 0.875rem;
}

.clip-picker__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.clip-picker__subtitle {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0.25rem 0 0;
}

/* ===== Content Area ===== */
.clip-picker__content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.clip-picker__content::-webkit-scrollbar {
  width: 6px;
}

.clip-picker__content::-webkit-scrollbar-track {
  background: transparent;
}

.clip-picker__content::-webkit-scrollbar-thumb {
  background-color: var(--border);
  border-radius: 3px;
}

.clip-picker__filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.clip-picker__search {
  position: relative;
  flex: 1;
  min-width: 200px;
}

.clip-picker__search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--muted-foreground);
  pointer-events: none;
}

.clip-picker__search-input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.5rem;
  background: var(--input);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--foreground);
  font-size: 0.875rem;
}

.clip-picker__search-input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 3px var(--sidebar-active);
}

.clip-picker__filter {
  padding: 0.5rem 0.75rem;
  background: var(--input);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--foreground);
  font-size: 0.875rem;
  cursor: pointer;
}

.clip-picker__loading,
.clip-picker__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  text-align: center;
}

.clip-picker__loading-icon {
  width: 48px;
  height: 48px;
  color: var(--muted-foreground);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.clip-picker__empty-icon {
  width: 48px;
  height: 48px;
  color: var(--muted-foreground);
}

.clip-picker__empty-text {
  font-size: 1rem;
  font-weight: 500;
  color: var(--foreground);
  margin: 0;
}

.clip-picker__empty-hint {
  font-size: 0.875rem;
  color: var(--muted-foreground);
  margin: 0;
}

.clip-picker__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  padding: 0.5rem;
  max-height: none;
}

.clip-picker__card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--card);
  border: 2px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 150ms ease;
}

.clip-picker__card:hover {
  border-color: var(--sidebar-accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.clip-picker__card--selected {
  border-color: var(--sidebar-accent);
  background: var(--sidebar-active);
}

.clip-picker__checkbox {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 24px;
  height: 24px;
  background: var(--card);
  border: 2px solid var(--border);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  transition: all 150ms ease;
}

.clip-picker__card--selected .clip-picker__checkbox {
  background: var(--sidebar-accent);
  border-color: var(--sidebar-accent);
}

.clip-picker__checkbox-icon {
  width: 16px;
  height: 16px;
  color: white;
}

.clip-picker__thumbnail {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--muted);
  overflow: hidden;
}

.clip-picker__thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.clip-picker__thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clip-picker__thumbnail-icon {
  width: 48px;
  height: 48px;
  color: var(--muted-foreground);
}

/* Selection Checkbox */
.clip-picker__checkbox {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 10;
  opacity: 0;
  transition: opacity 150ms ease;
}

.clip-picker__card:hover .clip-picker__checkbox,
.clip-picker__checkbox--visible {
  opacity: 1;
}

.clip-picker__checkbox-inner {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background-color: rgba(0, 0, 0, 0.6);
  border: 2px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 150ms ease;
}

.clip-picker__checkbox-inner:hover {
  background-color: rgba(0, 0, 0, 0.8);
}

.clip-picker__checkbox-inner--checked {
  background-color: var(--sidebar-accent);
  border-color: var(--sidebar-accent);
  color: white;
}

.clip-picker__checkbox-inner--checked:hover {
  background-color: var(--sidebar-accent);
  border-color: var(--sidebar-accent);
}

.clip-picker__checkbox-icon {
  width: 16px;
  height: 16px;
}

.clip-picker__badges {
  position: absolute;
  bottom: 0.5rem;
  left: 0.5rem;
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.clip-picker__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 6px;
  font-size: 0.75rem;
  color: white;
  backdrop-filter: blur(4px);
}

.clip-picker__badge-icon {
  width: 12px;
  height: 12px;
}

.clip-picker__info {
  padding: 0.75rem;
}

.clip-picker__name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--foreground);
  margin: 0 0 0.25rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clip-picker__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.clip-picker__meta-dot {
  opacity: 0.5;
}

/* ===== Footer ===== */
.clip-picker__footer {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border);
  background-color: var(--sidebar-surface);
}

.clip-picker__btn {
  flex: 1;
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
  border: none;
}

.clip-picker__btn--secondary {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.clip-picker__btn--secondary:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.clip-picker__btn--primary {
  background: var(--sidebar-accent);
  color: white;
}

.clip-picker__btn--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--sidebar-active);
}

.clip-picker__btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== Transitions ===== */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.dialog-enter-active {
  transition: all 200ms ease;
}

.dialog-leave-active {
  transition: all 150ms ease;
}

.dialog-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

.dialog-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
