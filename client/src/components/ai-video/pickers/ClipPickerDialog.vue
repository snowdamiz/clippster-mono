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

          <CustomDropdown
            v-model="aspectRatioFilter"
            :options="aspectRatioOptions"
            placeholder="All Ratios"
            class="clip-picker__dropdown"
            trigger-class="clip-picker__dropdown-trigger"
          />
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
            v-for="buildItem in displayClips"
            :key="buildItem.id"
            class="clip-picker__card"
            :class="{ 'clip-picker__card--selected': isSelected(buildItem.id) }"
            @click="toggleSelection(buildItem)"
          >
            <!-- Selection Checkbox -->
            <div
              class="clip-picker__checkbox"
              :class="{ 'clip-picker__checkbox--visible': isSelected(buildItem.id) }"
              @click.stop="toggleSelection(buildItem)"
            >
              <div
                class="clip-picker__checkbox-inner"
                :class="{ 'clip-picker__checkbox-inner--checked': isSelected(buildItem.id) }"
              >
                <Check v-if="isSelected(buildItem.id)" class="clip-picker__checkbox-icon" />
              </div>
            </div>

            <!-- Aspect Ratio Badge -->
            <div v-if="buildItem.aspectRatio" class="clip-picker__aspect-badge">
              {{ buildItem.aspectRatio }}
            </div>

            <!-- Thumbnail -->
            <div class="clip-picker__thumbnail">
              <img
                v-if="getThumbnailUrl(buildItem)"
                :src="getThumbnailUrl(buildItem)"
                :alt="buildItem.clip.name || 'Clip'"
                class="clip-picker__thumbnail-img"
              />
              <div v-else class="clip-picker__thumbnail-placeholder">
                <Video :size="48" class="clip-picker__thumbnail-icon" />
              </div>
            </div>

            <!-- Info -->
            <div class="clip-picker__info">
              <h4 class="clip-picker__name">{{ buildItem.clip.name || 'Untitled Clip' }}</h4>
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
import CustomDropdown from '@/components/CustomDropdown.vue';
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

interface ClipBuildItem {
  id: string; // Unique ID for this build item (clip.id + build.id)
  clip: Clip & { builds: ClipBuild[] };
  build: ClipBuild; // The specific build this item represents
  aspectRatio: string | null;
  thumbnailUrl?: string;
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
const allClips = ref<ClipBuildItem[]>([]);
const selectedClips = ref<ClipBuildItem[]>([]);

// Debug: expose allClips length for template
const clipCount = computed(() => allClips.value.length);
const searchQuery = ref('');
const aspectRatioFilter = ref('all');
const thumbnailCache = ref<Map<string, string>>(new Map());

function close() {
  cancel();
}

function getThumbnailUrl(buildItem: ClipBuildItem): string | undefined {
  return buildItem.thumbnailUrl || thumbnailCache.value.get(buildItem.id);
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
// The video filename already contains the aspect ratio (e.g., clip_name_9-16_1.mp4)
// So the thumbnail is simply: clip_name_9-16_1_thumb.jpg
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
  // Load thumbnails for all build items that don't have one cached yet
  const itemsToLoad = allClips.value.filter(
    (buildItem) => !buildItem.thumbnailUrl && !thumbnailCache.value.has(buildItem.id)
  );

  if (itemsToLoad.length === 0) return;

  await Promise.all(
    itemsToLoad.map(async (buildItem) => {
      const { clip, build, aspectRatio } = buildItem;
      
      // Try multiple thumbnail sources in order of preference
      const thumbnailCandidates: string[] = [];
      
      // 1. Try deriving thumbnail from this build's output paths
      // The video filename already contains aspect ratio (e.g., clip_name_9-16_1.mp4)
      // So thumbnail will be: clip_name_9-16_1_thumb.jpg
      const outputPaths = getOutputPathsFromBuild(build);
      for (const outputPath of outputPaths) {
        thumbnailCandidates.push(deriveThumbnailPath(outputPath));
      }
      
      // 2. Try thumbnail from this specific build's thumbnail_path field
      if (build.thumbnail_path) {
        thumbnailCandidates.push(build.thumbnail_path);
      }
      
      // 3. Try deriving from clip's built_file_path
      if (clip.built_file_path) {
        thumbnailCandidates.push(deriveThumbnailPath(clip.built_file_path));
      }
      
      // 4. Try clip's built_thumbnail_path field
      if (clip.built_thumbnail_path) {
        thumbnailCandidates.push(clip.built_thumbnail_path);
      }
      
      // Try each candidate until one works
      for (const thumbnailPath of thumbnailCandidates) {
        try {
          const exists = await invoke<boolean>('check_file_exists', { path: thumbnailPath });
          if (exists) {
            const dataUrl = await invoke<string>('read_file_as_data_url', {
              filePath: thumbnailPath,
            });
            // Store in both the buildItem and cache
            buildItem.thumbnailUrl = dataUrl;
            thumbnailCache.value.set(buildItem.id, dataUrl);
            return; // Success, stop trying
          }
        } catch (err) {
          // Continue to next candidate
        }
      }
      
      console.warn(`[ClipPickerDialog] No thumbnail found for build item ${buildItem.id} (aspect ratio: ${aspectRatio})`);
    })
  );
}

const aspectRatioOptions = computed(() => [
  { label: 'All Ratios', value: 'all' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '1:1', value: '1:1' },
  { label: '4:5', value: '4:5' },
]);

// Use allClips directly with computed filtering - simpler reactivity
const displayClips = computed(() => {
  const result = allClips.value.filter(buildItem => {
    const clip = buildItem.clip;
    
    // Search filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      const name = (clip.name || '').toLowerCase();
      const projectName = (clip.project_name || '').toLowerCase();
      if (!name.includes(query) && !projectName.includes(query)) {
        return false;
      }
    }

    // Aspect ratio filter - check this specific build's aspect ratio
    if (aspectRatioFilter.value !== 'all') {
      if (buildItem.aspectRatio !== aspectRatioFilter.value) {
        return false;
      }
    }
    
    return true;
  });
  console.log('[ClipPickerDialog] displayClips computed:', {
    allClipsLength: allClips.value.length,
    resultLength: result.length,
    searchQuery: searchQuery.value,
    aspectRatioFilter: aspectRatioFilter.value,
    sampleBuildItem: result[0] ? {
      clipName: result[0].clip.name,
      aspectRatio: result[0].aspectRatio
    } : null
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
    
    // Create a ClipBuildItem for each completed build
    const buildItems: ClipBuildItem[] = [];
    
    for (const clip of clipsWithBuilds) {
      if (clip.builds && clip.builds.length > 0) {
        // Get edit data once per clip (shared across all builds)
        let editData: ClipBuildItem['editData'] | undefined;
        try {
          const editRecord = await getClipEdit(clip.id);
          if (editRecord) {
            const [audioTracks, textOverlays, stickers, watermarks, effects] = await Promise.all([
              getClipAudioTracks(editRecord.id),
              getClipTextOverlays(editRecord.id),
              getClipStickers(editRecord.id),
              getClipWatermarks(editRecord.id),
              getClipEffects(editRecord.id),
            ]);
            editData = { audioTracks, textOverlays, stickers, watermarks, effects };
          }
        } catch (error) {
          console.error(`Failed to load edit data for clip ${clip.id}:`, error);
        }

        // Create a separate item for each completed build
        for (const build of clip.builds) {
          if (build.status === 'completed') {
            const outputPaths = getOutputPathsFromBuild(build);
            if (outputPaths.length > 0) {
              // Verify at least one output file exists
              let hasValidFile = false;
              for (const filePath of outputPaths) {
                try {
                  const fileExists = await invoke<boolean>('check_file_exists', { path: filePath });
                  if (fileExists) {
                    hasValidFile = true;
                    break;
                  }
                } catch (err) {
                  console.warn('[ClipPickerDialog] Error checking file:', err);
                }
              }

              if (hasValidFile) {
                // Parse aspect ratios - create separate item for EACH aspect ratio
                let aspectRatios: (string | null)[] = [];
                if (build.aspect_ratios) {
                  try {
                    const parsed = JSON.parse(build.aspect_ratios);
                    if (Array.isArray(parsed)) {
                      aspectRatios = parsed;
                    } else {
                      aspectRatios = [build.aspect_ratios];
                    }
                  } catch {
                    aspectRatios = [build.aspect_ratios];
                  }
                }
                
                // If no aspect ratios found, create one item with null
                if (aspectRatios.length === 0) {
                  aspectRatios = [null];
                }

                // Create a separate ClipBuildItem for each aspect ratio
                for (const aspectRatio of aspectRatios) {
                  buildItems.push({
                    id: `${clip.id}_${build.id}_${aspectRatio || 'default'}`,
                    clip,
                    build,
                    aspectRatio,
                    editData,
                  });
                }
              }
            }
          }
        }
      }
    }
    
    console.log('[ClipPickerDialog] Build items created:', buildItems.length);
    
    if (buildItems.length > 0) {
      console.log('[ClipPickerDialog] Sample build item:', {
        id: buildItems[0].id,
        clipName: buildItems[0].clip.name,
        aspectRatio: buildItems[0].aspectRatio,
        buildId: buildItems[0].build.id,
      });
    }

    // Set the clips
    allClips.value = buildItems;
    console.log('[ClipPickerDialog] Final allClips.value length:', allClips.value.length);
    
    // Load thumbnails after clips are loaded
    await loadThumbnails();
  } catch (error) {
    console.error('Failed to load clips:', error);
  } finally {
    loading.value = false;
  }
}

function isSelected(buildItemId: string): boolean {
  return selectedClips.value.some(c => c.id === buildItemId);
}

function toggleSelection(buildItem: ClipBuildItem) {
  const index = selectedClips.value.findIndex(c => c.id === buildItem.id);
  if (index >= 0) {
    selectedClips.value.splice(index, 1);
  } else {
    selectedClips.value.push(buildItem);
  }
}

function cancel() {
  selectedClips.value = [];
  isOpen.value = false;
}

function confirm() {
  const importedClips: ImportedClipData[] = selectedClips.value.map(buildItem => {
    // Get the file path from the specific build
    const outputPaths = getOutputPathsFromBuild(buildItem.build);
    const videoPath = outputPaths[0] || buildItem.clip.built_file_path || buildItem.clip.file_path;
    
    return {
      id: buildItem.clip.id,
      name: buildItem.clip.name || 'Untitled Clip',
      videoPath,
      thumbnailPath: getThumbnailUrl(buildItem) || buildItem.clip.built_thumbnail_path || '',
      duration: buildItem.build.duration || buildItem.clip.built_duration || buildItem.clip.duration || 0,
      
      audioTracks: buildItem.editData?.audioTracks.map(track => ({
        filePath: track.file_path,
        name: track.name,
        startTime: track.start_time,
        endTime: track.end_time,
        volume: track.volume,
        pan: track.pan,
        fadeIn: track.fade_in,
        fadeOut: track.fade_out,
      })) || [],
      
      textOverlays: buildItem.editData?.textOverlays.map(overlay => ({
        text: overlay.text,
        startTime: overlay.start_time,
        endTime: overlay.end_time,
        positionX: overlay.position_x,
        positionY: overlay.position_y,
        styleData: JSON.parse(overlay.style_data),
        animation: overlay.animation,
      })) || [],
      
      stickers: buildItem.editData?.stickers.map(sticker => ({
        stickerPath: sticker.sticker_path,
        startTime: sticker.start_time,
        endTime: sticker.end_time,
        positionX: sticker.position_x,
        positionY: sticker.position_y,
        scale: sticker.scale,
        rotation: sticker.rotation,
      })) || [],
      
      watermarks: buildItem.editData?.watermarks.map(watermark => ({
        watermarkPath: watermark.watermark_path,
        startTime: watermark.start_time,
        endTime: watermark.end_time,
        positionX: watermark.position_x,
        positionY: watermark.position_y,
        scale: watermark.scale,
        opacity: watermark.opacity,
      })) || [],
      
      effects: buildItem.editData?.effects.map(effect => ({
        effectType: effect.effect_type,
        startTime: effect.start_time,
        endTime: effect.end_time,
        settings: JSON.parse(effect.settings),
      })) || [],
    };
  });

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
  border: 1px solid var(--sidebar-border);
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
  background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
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
  background-color: rgba(6, 182, 212, 0.15);
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
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.clip-picker__filters {
  display: flex;
  gap: 0.5rem;
  align-items: center;
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
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  font-size: 0.875rem;
  transition: all 150ms ease;
}

.clip-picker__search-input::placeholder {
  color: var(--sidebar-text-muted);
  opacity: 0.6;
}

.clip-picker__search-input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

.clip-picker__dropdown {
  flex-shrink: 0;
}

/* Override CustomDropdown's default w-full class */
.clip-picker__dropdown :deep(.relative) {
  width: auto !important;
  display: inline-block !important;
}

/* Dropdown trigger button styling */
:deep(.clip-picker__dropdown-trigger) {
  width: auto !important;
  min-width: 140px !important;
  padding: 0.5rem 0.75rem !important;
  background-color: var(--sidebar-hover) !important;
  border: 1px solid var(--sidebar-border) !important;
  border-radius: 8px !important;
  font-size: 0.875rem !important;
  color: var(--sidebar-text) !important;
  transition: all 150ms ease !important;
  justify-content: space-between !important;
  display: inline-flex !important;
}

:deep(.clip-picker__dropdown-trigger:hover) {
  border-color: rgba(255, 255, 255, 0.1) !important;
}

:deep(.clip-picker__dropdown-trigger:focus-within) {
  border-color: var(--sidebar-accent) !important;
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15) !important;
}

:deep(.clip-picker__dropdown-trigger span) {
  color: var(--sidebar-text) !important;
}

:deep(.clip-picker__dropdown-trigger svg) {
  width: 14px !important;
  height: 14px !important;
  color: var(--sidebar-text-muted) !important;
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

/* Aspect Ratio Badge */
.clip-picker__aspect-badge {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 5;
  padding: 0.25rem 0.5rem;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
  backdrop-filter: blur(4px);
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
  gap: 0.625rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--sidebar-border);
}

.clip-picker__btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 150ms ease;
}

.clip-picker__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.clip-picker__btn--secondary {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
  border: 1px solid var(--sidebar-border);
}

.clip-picker__btn--secondary:hover:not(:disabled) {
  background-color: var(--sidebar-active);
  border-color: rgba(255, 255, 255, 0.1);
}

.clip-picker__btn--primary {
  background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
  color: white;
}

.clip-picker__btn--primary:hover:not(:disabled) {
  opacity: 0.9;
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
  transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-leave-active {
  transition: all 150ms ease-in;
}

.dialog-enter-from {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}

.dialog-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>

<!-- Global styles for dropdown menu (rendered via Teleport outside component scope) -->
<style>
  /* Clip Picker dropdown menu styling */
  .clip-picker__dropdown + div[class*='fixed'],
  div.fixed.bg-popover {
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    animation: clipPickerDropdownFade 100ms ease-out !important;
  }

  @keyframes clipPickerDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Dropdown menu items */
  .clip-picker__dropdown + div[class*='fixed'] button,
  div.fixed.bg-popover button {
    display: flex !important;
    align-items: center !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 5px !important;
    font-size: 0.75rem !important;
    color: var(--sidebar-text) !important;
    transition: background-color 150ms ease !important;
  }

  .clip-picker__dropdown + div[class*='fixed'] button:hover,
  div.fixed.bg-popover button:hover {
    background-color: var(--sidebar-hover) !important;
  }

  .clip-picker__dropdown + div[class*='fixed'] button.bg-primary\/10,
  div.fixed.bg-popover button.bg-primary\/10 {
    background-color: rgba(6, 182, 212, 0.15) !important;
    color: var(--sidebar-accent) !important;
  }
</style>
