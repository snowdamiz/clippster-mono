<template>
  <div class="flex h-full min-h-0 flex-col border-r border-line-subtle">
    <!-- Header (same height as the calendar's weekday row) -->
    <div class="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line-subtle px-3">
      <h3 class="flex min-w-0 items-center gap-2 text-xs font-semibold text-fg">
        <Film class="size-3.5 shrink-0 text-fg-subtle" />
        <span class="truncate">Built clips</span>
        <span class="tabular font-normal text-fg-subtle">{{ builtClipsCount }}</span>
      </h3>
      <span class="truncate text-2xs text-fg-subtle">Drag onto a day</span>
    </div>

    <div class="shrink-0 px-3 pt-3 pb-2">
      <SearchField v-model="searchQuery" size="sm" placeholder="Search clips…" />
    </div>

    <!-- Loading (first load only; reloads after scheduling keep the list) -->
    <div v-if="loading && !allBuilds.length" class="flex flex-col gap-0.5 overflow-hidden px-2 pb-3" aria-busy="true">
      <div v-for="i in 5" :key="i" class="flex items-center gap-2.5 p-1.5">
        <div class="skeleton aspect-video w-20 shrink-0" />
        <div class="flex flex-1 flex-col gap-1.5">
          <div class="skeleton h-3 w-3/4" />
          <div class="skeleton h-2.5 w-1/2" />
        </div>
      </div>
    </div>

    <!-- Empty -->
    <EmptyState
      v-else-if="filteredBuilds.length === 0"
      size="sm"
      :icon="Film"
      class="flex-1"
      :title="searchQuery ? 'No clips found' : 'No built clips yet'"
      :description="searchQuery ? 'Try a different search' : 'Build clips from your projects to schedule them'"
    />

    <!-- Builds -->
    <div v-else class="flex min-h-0 flex-1 animate-fade-in flex-col gap-0.5 overflow-y-auto px-2 pb-3">
      <div
        v-for="entry in filteredBuilds"
        :key="entry.key"
        class="group relative flex shrink-0 cursor-grab items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-surface-hover active:cursor-grabbing"
        :class="{ 'opacity-50': draggingBuildId === entry.build.id }"
        :title="`${entry.clip.name || 'Untitled Clip'} — drag onto a day to schedule`"
        @mousedown="handleMouseDown($event, entry)"
      >
        <!-- Thumbnail (letterboxed to the build's aspect ratio) -->
        <div class="relative grid aspect-video w-20 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-sunken">
          <img
            v-if="getThumbnailUrl(entry)"
            :src="getThumbnailUrl(entry) || ''"
            :alt="entry.clip.name || 'Clip thumbnail'"
            class="max-h-full max-w-full object-contain"
            :class="isPortrait(entry.aspectRatio) ? 'h-full w-auto' : 'h-auto w-full'"
            draggable="false"
          />
          <FileVideo v-else class="size-4 text-fg-disabled" />
          <span
            v-if="entry.build.duration || entry.clip.built_duration"
            class="tabular absolute right-1 bottom-1 rounded-[3px] bg-black/75 px-1 text-[10px] leading-[14px] font-medium text-white"
          >
            {{ formatDuration(entry.build.duration || entry.clip.built_duration || 0) }}
          </span>
        </div>

        <!-- Info -->
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <h4 class="truncate text-xs font-medium text-fg">{{ entry.clip.name || 'Untitled Clip' }}</h4>
          <p class="flex min-w-0 items-center gap-1 text-2xs text-fg-subtle">
            <span v-if="entry.clip.project_name" class="truncate">{{ entry.clip.project_name }}</span>
            <span v-if="entry.clip.project_name && entry.build.created_at" aria-hidden="true">·</span>
            <span v-if="entry.build.created_at" class="shrink-0">{{ formatDate(entry.build.created_at) }}</span>
          </p>
          <div class="flex min-w-0 items-center gap-1">
            <Badge v-if="entry.aspectRatio" variant="outline" class="tabular">{{ entry.aspectRatio }}</Badge>
            <Badge
              v-if="entry.build.branding_type === 'campaign' && entry.build.campaign_name"
              variant="neutral"
              class="min-w-0 shrink"
              :title="`Campaign: ${entry.build.campaign_name}`"
            >
              <Briefcase />
              <span class="truncate">{{ entry.build.campaign_name }}</span>
            </Badge>
            <Badge
              v-else-if="entry.build.branding_type === 'org' && entry.build.organization_name"
              variant="neutral"
              class="min-w-0 shrink"
              :title="entry.build.organization_name"
            >
              <Building2 />
              <span class="truncate">{{ entry.build.organization_name }}</span>
            </Badge>
          </div>
        </div>

        <!-- Schedule button (alternative to drag) -->
        <Button
          variant="secondary"
          size="icon-xs"
          class="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          title="Schedule this clip"
          aria-label="Schedule this clip"
          @click.stop="$emit('scheduleClip', entry.clip, entry.build)"
          @mousedown.stop
          @dragstart.stop.prevent
        >
          <CalendarPlus />
        </Button>
      </div>
    </div>

    <!-- Drag ghost -->
    <Teleport to="body">
      <div
        v-if="draggingEntry"
        class="pointer-events-none fixed z-[9999]"
        :style="{ left: `${dragPosition.x - 60}px`, top: `${dragPosition.y - 60}px` }"
      >
        <div class="w-[120px] overflow-hidden rounded-lg border border-brand-line bg-surface-raised shadow-[var(--shadow-lg)]">
          <div class="aspect-video bg-surface-sunken">
            <img
              v-if="getThumbnailUrl(draggingEntry)"
              :src="getThumbnailUrl(draggingEntry) || ''"
              :alt="draggingEntry.clip.name || 'Clip'"
              class="size-full object-cover"
            />
            <div v-else class="grid size-full place-items-center">
              <FileVideo class="size-5 text-fg-disabled" />
            </div>
          </div>
          <p class="truncate px-2 py-1 text-2xs font-medium text-fg">
            {{ draggingEntry.clip.name || 'Untitled Clip' }}
          </p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Film, FileVideo, CalendarPlus, Briefcase, Building2 } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchField } from '@/components/ui/search-field';
import { getAllClips } from '@/services/database/clips';
import { getClipBuilds } from '@/services/database/clip-build';
import { getThumbnailByClipId } from '@/services/database/thumbnails';
import { getStoragePath } from '@/services/storage';
import type { Clip, ClipBuild } from '@/services/database/types';
import { invoke } from '@tauri-apps/api/core';
import { useClipThumbnailStore } from '@/stores/clipThumbnails';
import { persistentCache } from '@/utils/persistentCache';

// Build entry combines clip info with specific build info
interface BuildEntry {
  clip: Clip;
  build: ClipBuild;
  filePath: string;
  aspectRatio: string | null;
  key: string;
}

const emit = defineEmits<{
  (e: 'scheduleClip', clip: Clip, build?: ClipBuild): void;
  (e: 'dragStart', clipData: { clipId: string; buildId: string; clipName: string | null; mediaUrl: string | null; thumbnailUrl: string | null; duration: number | null; projectName: string | null; organizationName: string | null; campaignName: string | null }): void;
  (e: 'dragMove', position: { x: number; y: number }): void;
  (e: 'dragEnd', position: { x: number; y: number }): void;
}>();

const thumbnailStore = useClipThumbnailStore();
const loading = ref(true);
const clips = ref<Clip[]>([]);
const allBuilds = ref<BuildEntry[]>([]);
const searchQuery = ref('');
const draggingEntry = ref<BuildEntry | null>(null);
const draggingBuildId = ref<string | null>(null);
const dragPosition = ref({ x: 0, y: 0 });

// Count of built clips for header
const builtClipsCount = computed(() => allBuilds.value.length);

// Search filter
const filteredBuilds = computed(() => {
  if (!searchQuery.value.trim()) return allBuilds.value;
  
  const query = searchQuery.value.toLowerCase();
  return allBuilds.value.filter((entry) => {
    const name = (entry.clip.name || '').toLowerCase();
    const projectName = (entry.clip.project_name || '').toLowerCase();
    const orgName = (entry.build.organization_name || '').toLowerCase();
    const campaignName = (entry.build.campaign_name || '').toLowerCase();
    return name.includes(query) || projectName.includes(query) || orgName.includes(query) || campaignName.includes(query);
  });
});

// Get thumbnail URL from cache
function getThumbnailUrl(entry: BuildEntry): string | null {
  // Try build-specific thumbnail first, then fall back to clip thumbnail from store
  return thumbnailStore.getBuildThumbnail(entry.build.id) || thumbnailStore.getThumbnail(entry.clip.id) || null;
}

// Get badge info for a build
function getBadgeInfo(build: ClipBuild): { type: 'org' | 'campaign' | null; name: string } {
  if (build.campaign_id && build.campaign_name) {
    return { type: 'campaign', name: build.campaign_name };
  }
  if (build.organization_id && build.organization_name) {
    return { type: 'org', name: build.organization_name };
  }
  return { type: null, name: '' };
}


// Format duration (seconds to MM:SS)
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format date
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
}

// Check if aspect ratio is portrait (taller than wide)
function isPortrait(aspectRatio: string | null): boolean {
  if (!aspectRatio) return false;
  
  const [width, height] = aspectRatio.split(':').map(Number);
  return height > width;
}

// Mouse-based drag handlers (not HTML5 drag-and-drop)
let isDragging = false;
let dragStartPos = { x: 0, y: 0 };
const DRAG_THRESHOLD = 5; // pixels before drag starts

function handleMouseDown(event: MouseEvent, entry: BuildEntry) {
  // Only left mouse button
  if (event.button !== 0) return;
  
  // Ignore if clicking on the schedule button
  if ((event.target as HTMLElement).closest('button')) return;
  
  event.preventDefault();
  isDragging = false;
  dragStartPos = { x: event.clientX, y: event.clientY };
  
  // Store the entry we might drag
  const potentialDragEntry = entry;
  
  const handleMouseMove = (e: MouseEvent) => {
    const dx = e.clientX - dragStartPos.x;
    const dy = e.clientY - dragStartPos.y;
    
    // Check if we've moved enough to start dragging
    if (!isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      isDragging = true;
      console.log('[ClipsSidebar] Drag start for build:', potentialDragEntry.build.id);
      
      draggingEntry.value = potentialDragEntry;
      draggingBuildId.value = potentialDragEntry.build.id;
      
      // Emit drag data to parent
      const dragData = {
        clipId: potentialDragEntry.clip.id,
        buildId: potentialDragEntry.build.id,
        clipName: potentialDragEntry.clip.name,
        mediaUrl: potentialDragEntry.filePath,
        thumbnailUrl: thumbnailStore.getBuildThumbnail(potentialDragEntry.build.id) || thumbnailStore.getThumbnail(potentialDragEntry.clip.id) || null,
        duration: potentialDragEntry.build.duration || potentialDragEntry.clip.built_duration,
        projectName: potentialDragEntry.clip.project_name,
        organizationName: potentialDragEntry.build.organization_name || null,
        campaignName: potentialDragEntry.build.campaign_name || null,
      };
      console.log('[ClipsSidebar] Emitting drag data:', dragData);
      emit('dragStart', dragData);
    }
    
    if (isDragging) {
      dragPosition.value = { x: e.clientX, y: e.clientY };
      emit('dragMove', { x: e.clientX, y: e.clientY });
    }
  };
  
  const handleMouseUp = (e: MouseEvent) => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    if (isDragging) {
      console.log('[ClipsSidebar] Drag end at:', e.clientX, e.clientY);
      emit('dragEnd', { x: e.clientX, y: e.clientY });
      draggingEntry.value = null;
      draggingBuildId.value = null;
    }
    
    isDragging = false;
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

// Load clips and their builds
async function loadClips() {
  loading.value = true;
  try {
    clips.value = await getAllClips();
    
    // Load builds and thumbnails in parallel
    await Promise.all([
      loadBuilds(),
      // Load clip thumbnails lazily (first 20 immediately, rest in background)
      thumbnailStore.loadThumbnailsLazy(clips.value.slice(0, 20), 'high'),
    ]);
    
    console.log('[ClipsSidebar] Loaded builds:', allBuilds.value.length);
    
    // Defer non-critical thumbnail loading to after initial render
    setTimeout(() => {
      // Continue loading remaining clip thumbnails
      if (clips.value.length > 20) {
        thumbnailStore.loadThumbnailsLazy(clips.value.slice(20), 'low');
      }
      
      // Load build-specific thumbnails in background
      loadThumbnailsDeferred();
    }, 100);
    
    console.log('[ClipsSidebar] Initial load complete');
  } catch (error) {
    console.error('[ClipsSidebar] Failed to load clips:', error);
  } finally {
    loading.value = false;
  }
}

// Deferred thumbnail loading for builds
async function loadThumbnailsDeferred() {
  try {
    const buildsNeedingThumbs = allBuilds.value.filter(
      (entry) => !thumbnailStore.hasBuildThumbnail(entry.build.id)
    );
    console.log('[ClipsSidebar] Builds needing thumbnails:', buildsNeedingThumbs.length);
    
    if (buildsNeedingThumbs.length === 0) return;
    
    // Load first batch immediately (visible ones), rest with lower priority
    const visibleBuilds = buildsNeedingThumbs.slice(0, 10);
    const remainingBuilds = buildsNeedingThumbs.slice(10);
    
    // Load visible builds first
    await loadThumbnailBatch(visibleBuilds, 3);
    
    // Load remaining builds in background with delays
    if (remainingBuilds.length > 0) {
      setTimeout(() => {
        loadThumbnailBatch(remainingBuilds, 10);
      }, 500);
    }
    
    console.log('[ClipsSidebar] Thumbnail loading complete');
  } catch (error) {
    console.error('[ClipsSidebar] Failed to load deferred thumbnails:', error);
  }
}

// Load thumbnails in batches
async function loadThumbnailBatch(builds: BuildEntry[], batchSize: number) {
  for (let i = 0; i < builds.length; i += batchSize) {
    const batch = builds.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (entry) => {
        try {
          const dataUrl = await loadBuildThumbnail(entry);
          if (dataUrl) {
            thumbnailStore.setBuildThumbnail(entry.build.id, dataUrl);
          }
        } catch (err) {
          // Silently skip
        }
      })
    );
  }
}

// Helper function to parse output paths from a build
function getOutputPathsFromBuild(build: ClipBuild): string[] {
  // Try parsing output_paths JSON array first
  if (build.output_paths) {
    try {
      const paths = JSON.parse(build.output_paths);
      if (Array.isArray(paths) && paths.length > 0) {
        return paths;
      }
    } catch {
      // Fall through to single file_path
    }
  }
  // Fallback to single file_path
  if (build.file_path) {
    return [build.file_path];
  }
  return [];
}

// Extract aspect ratio from filename (e.g., "clip_name_16-9_1.mp4" -> "16:9")
function extractAspectRatioFromPath(filePath: string): string | null {
  const fileName = filePath.split(/[/\\]/).pop() || '';
  const match = fileName.match(/_(\d+-\d+)_\d+\.\w+$/);
  return match ? match[1].replace('-', ':') : null;
}

// Load all builds for all clips - parallelized
async function loadBuilds() {
  const entries: BuildEntry[] = [];
  
  // Load builds for all clips in parallel
  const buildPromises = clips.value.map(async (clip) => {
    try {
      const builds = await getClipBuilds(clip.id);
      const clipEntries: BuildEntry[] = [];
      
      for (const build of builds) {
        if (build.status === 'completed') {
          const outputPaths = getOutputPathsFromBuild(build);
          
          // Create an entry for each output file
          for (let i = 0; i < outputPaths.length; i++) {
            const filePath = outputPaths[i];
            const aspectRatio = extractAspectRatioFromPath(filePath);
            
            clipEntries.push({
              clip,
              build,
              filePath,
              aspectRatio,
              key: outputPaths.length > 1 ? `${build.id}-${i}` : build.id,
            });
          }
        }
      }
      
      return clipEntries;
    } catch (error) {
      console.warn(`[ClipsSidebar] Failed to load builds for clip ${clip.id}:`, error);
      return [];
    }
  });
  
  // Wait for all builds to load in parallel
  const allClipEntries = await Promise.all(buildPromises);
  
  // Flatten and combine all entries
  for (const clipEntries of allClipEntries) {
    entries.push(...clipEntries);
  }
  
  // Sort by created_at descending (newest first)
  entries.sort((a, b) => (b.build.created_at || 0) - (a.build.created_at || 0));
  allBuilds.value = entries;
}

// Derive the expected thumbnail path from a video file path
// Thumbnails are named: {video_filename_without_ext}_thumb.jpg
async function getThumbnailPathForVideoFile(videoPath: string): Promise<string | null> {
  try {
    const basePath = await getStoragePath('thumbnails');
    const videoFileName = videoPath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || '';
    return `${basePath}/${videoFileName}_thumb.jpg`;
  } catch {
    return null;
  }
}

// Get thumbnail path for a specific build entry
function getThumbnailPathForEntry(entry: BuildEntry): string | null {
  // For multi-file builds, derive from the specific file path
  return entry.filePath;
}

// Load thumbnails for all builds
async function loadThumbnails() {
  const buildsNeedingThumbs = allBuilds.value.filter(
    (entry) => !thumbnailStore.hasBuildThumbnail(entry.build.id)
  );
  console.log('[ClipsSidebar] Builds needing thumbnails:', buildsNeedingThumbs.length);
  if (buildsNeedingThumbs.length === 0) return;

  let hasNew = false;
  const batchSize = 5;
  for (let i = 0; i < buildsNeedingThumbs.length; i += batchSize) {
    const batch = buildsNeedingThumbs.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (entry) => {
        try {
          const dataUrl = await loadBuildThumbnail(entry);
          if (dataUrl) {
            thumbnailStore.setBuildThumbnail(entry.build.id, dataUrl);
            hasNew = true;
          }
        } catch (err) {
          // Silently skip
        }
      })
    );
  }
  console.log('[ClipsSidebar] Thumbnail loading complete');
}

// Load thumbnail for a single build - tries multiple sources with caching
async function loadBuildThumbnail(entry: BuildEntry): Promise<string | null> {
  const { clip, build } = entry;
  
  // Check persistent cache first (24 hour TTL)
  try {
    const cached = await persistentCache.get<string>('thumbnails', `build-${build.id}`);
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.warn(`[ClipsSidebar] Failed to read build thumbnail from cache for ${build.id}:`, error);
  }
  
  let dataUrl: string | null = null;
  
  // Source 1: Build's thumbnail_path
  if (build.thumbnail_path && !dataUrl) {
    try {
      const exists = await invoke<boolean>('check_file_exists', { path: build.thumbnail_path });
      if (exists) {
        dataUrl = await invoke<string>('read_file_as_data_url', { filePath: build.thumbnail_path });
      }
    } catch { /* try next source */ }
  }
  
  // Source 2: Derive thumbnail path from entry's specific file_path
  if (entry.filePath && !dataUrl) {
    const derivedPath = await getThumbnailPathForVideoFile(entry.filePath);
    if (derivedPath) {
      try {
        const exists = await invoke<boolean>('check_file_exists', { path: derivedPath });
        if (exists) {
          dataUrl = await invoke<string>('read_file_as_data_url', { filePath: derivedPath });
        }
      } catch { /* try next source */ }
    }
  }

  // Source 3: Clip's built_thumbnail_path field
  if (clip.built_thumbnail_path && !dataUrl) {
    try {
      const exists = await invoke<boolean>('check_file_exists', { path: clip.built_thumbnail_path });
      if (exists) {
        dataUrl = await invoke<string>('read_file_as_data_url', { filePath: clip.built_thumbnail_path });
      }
    } catch { /* try next source */ }
  }

  // Source 4: Thumbnails table
  if (!dataUrl) {
    try {
      const thumbnail = await getThumbnailByClipId(clip.id);
      if (thumbnail?.file_path) {
        const exists = await invoke<boolean>('check_file_exists', { path: thumbnail.file_path });
        if (exists) {
          dataUrl = await invoke<string>('read_file_as_data_url', { filePath: thumbnail.file_path });
        }
      }
    } catch { /* try regeneration */ }
  }

  // Source 5: Regenerate from video file
  if (!dataUrl && entry.filePath) {
    try {
      const videoExists = await invoke<boolean>('check_file_exists', { path: entry.filePath });
      if (videoExists) {
        const newThumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
          videoPath: entry.filePath,
          timestampSeconds: 1.0,
          outputFilename: null,
        });
        dataUrl = await invoke<string>('read_file_as_data_url', { filePath: newThumbnailPath });
      }
    } catch (err) {
      console.warn(`[ClipsSidebar] Failed to regenerate thumbnail for build ${build.id}:`, err);
    }
  }
  
  // Save to persistent cache if we got a thumbnail (24 hours TTL)
  if (dataUrl) {
    persistentCache.set('thumbnails', `build-${build.id}`, dataUrl, 86400000).catch(err => {
      console.warn(`[ClipsSidebar] Failed to save build thumbnail to cache for ${build.id}:`, err);
    });
  }

  return dataUrl;
}

onMounted(() => {
  loadClips();
});

onUnmounted(() => {
  // Cleanup handled in mouseup handler
});

// Expose reload method
defineExpose({
  reload: loadClips,
});
</script>
