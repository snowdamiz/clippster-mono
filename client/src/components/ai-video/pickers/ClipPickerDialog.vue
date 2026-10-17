<template>
  <Modal
    :open="isOpen"
    title="Select clips"
    description="Choose built clips to use in your AI video. All edits, audio tracks and effects are preserved."
    :icon="Video"
    size="xl"
    flush
    body-class="flex min-h-0 flex-col"
    @close="close"
  >
    <div class="flex shrink-0 items-center gap-2 border-b border-line-subtle px-5 pb-3 pt-2">
      <SearchField v-model="searchQuery" placeholder="Search clips…" class="min-w-[140px] max-w-64 flex-1" />
      <div class="w-36 shrink-0">
        <CustomDropdown v-model="aspectRatioFilter" :options="aspectRatioOptions" placeholder="All ratios" />
      </div>
    </div>

    <div class="min-h-[320px] flex-1 overflow-y-auto px-5 py-4">
      <!-- Skeleton only on the first load; reopening keeps the last list while it refreshes -->
      <div v-if="loading && !allClips.length" class="skeleton-group grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        <div v-for="i in 6" :key="i" class="overflow-hidden rounded-xl border border-line-subtle bg-surface">
          <div class="skeleton aspect-video rounded-none" />
          <div class="px-3 py-2.5"><div class="skeleton h-3.5 w-2/3 rounded" /></div>
        </div>
      </div>

      <EmptyState
        v-else-if="displayClips.length === 0"
        size="sm"
        :icon="Video"
        title="No clips found"
        :description="searchQuery ? 'Try adjusting your search or filters.' : 'Build some clips first to use them here.'"
      />

      <div v-else class="grid animate-fade-in grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        <MediaTile
          v-for="buildItem in displayClips"
          :key="buildItem.id"
          :title="buildItem.clip.name || 'Untitled clip'"
          :thumbnail="getThumbnailUrl(buildItem)"
          :icon="Video"
          selectable
          :selected="isSelected(buildItem.id)"
          @open="toggleSelection(buildItem)"
          @toggle-select="toggleSelection(buildItem)"
        >
          <template v-if="buildItem.aspectRatio" #badges>
            <MediaChip>{{ buildItem.aspectRatio }}</MediaChip>
          </template>
        </MediaTile>
      </div>
    </div>

    <template #footer>
      <span class="mr-auto text-xs text-fg-muted">
        <span class="tabular">{{ selectedClips.length }}</span> selected
      </span>
      <Button variant="ghost" @click="cancel">Cancel</Button>
      <Button variant="primary" :disabled="selectedClips.length === 0" @click="confirm">
        Add {{ selectedClips.length }} clip{{ selectedClips.length !== 1 ? 's' : '' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { Video, Music, Type, Sparkles } from 'lucide-vue-next';
import CustomDropdown from '@/components/CustomDropdown.vue';
import { MediaChip, MediaTile } from '@/components/ui/media-tile';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { SearchField } from '@/components/ui/search-field';
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
  { label: 'All ratios', value: 'all' },
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
