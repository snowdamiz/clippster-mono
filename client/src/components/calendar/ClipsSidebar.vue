<template>
  <div class="flex flex-col h-full bg-zinc-950 border-r border-white/10">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-white/10">
      <div class="flex items-center gap-2 mb-2">
        <Film class="size-4 text-blue-400" />
        <h3 class="text-sm font-semibold text-zinc-200">Built Clips</h3>
      </div>
      <p class="text-[10px] text-zinc-500">
        {{ builtClipsCount }} build{{ builtClipsCount !== 1 ? 's' : '' }} ready to schedule
      </p>
    </div>

    <!-- Search -->
    <div class="px-4 py-2 border-b border-white/5">
      <div class="relative">
        <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search clips..."
          class="w-full pl-8 pr-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-md text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-colors"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <Loader2 class="size-5 animate-spin text-blue-400" />
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredBuilds.length === 0" class="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <Film class="size-8 text-zinc-700 mb-3" />
      <p class="text-sm text-zinc-400 mb-1">
        {{ searchQuery ? 'No clips found' : 'No built clips yet' }}
      </p>
      <p class="text-xs text-zinc-600">
        {{ searchQuery ? 'Try a different search' : 'Build clips from your projects to schedule them' }}
      </p>
    </div>

    <!-- Builds List -->
    <div v-else class="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
      <div
        v-for="entry in filteredBuilds"
        :key="entry.key"
        @mousedown="handleMouseDown($event, entry)"
        class="group relative bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 rounded-lg overflow-hidden cursor-move transition-all"
        :class="{ 'opacity-50': draggingBuildId === entry.build.id }"
      >
        <!-- Thumbnail -->
        <div class="relative aspect-video bg-zinc-900">
          <!-- Thumbnail with correct aspect ratio (letterboxed/pillarboxed) -->
          <div v-if="getThumbnailUrl(entry)" class="absolute inset-0 z-0 flex items-center justify-center">
            <img
              :src="getThumbnailUrl(entry) || ''"
              :alt="entry.clip.name || 'Clip thumbnail'"
              class="max-w-full max-h-full object-contain"
              :class="isPortrait(entry.aspectRatio) ? 'h-full w-auto' : 'w-full h-auto'"
            />
          </div>
          <div v-else class="absolute inset-0 z-0 flex items-center justify-center">
            <FileVideo class="size-6 text-zinc-700" />
          </div>
          
          <!-- Org/Campaign badge -->
          <div
            v-if="entry.build.branding_type === 'campaign' && entry.build.campaign_name"
            class="absolute left-1 top-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
            style="background-color: rgba(249, 115, 22, 0.9);"
            :title="`Campaign: ${entry.build.campaign_name}`"
          >
            <Briefcase class="size-2.5" />
            <span class="max-w-[50px] truncate">{{ entry.build.campaign_name }}</span>
          </div>
          <div
            v-else-if="entry.build.branding_type === 'org' && entry.build.organization_name"
            class="absolute left-1 top-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
            :style="{ backgroundColor: getOrgColor(entry.build.organization_id) + 'E6' }"
            :title="entry.build.organization_name"
          >
            <Building2 class="size-2.5" />
            <span class="max-w-[50px] truncate">{{ entry.build.organization_name }}</span>
          </div>
          
          <!-- Duration badge -->
          <div v-if="entry.build.duration || entry.clip.built_duration" class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-medium text-white">
            {{ formatDuration(entry.build.duration || entry.clip.built_duration || 0) }}
          </div>

          <!-- Drag hint -->
          <div class="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
            <div class="bg-blue-500/90 text-white px-2 py-1 rounded-md text-[10px] font-medium flex items-center gap-1">
              <GripVertical class="size-3" />
              Drag to schedule
            </div>
          </div>
        </div>

        <!-- Info -->
        <div class="p-2">
          <h4 class="text-xs font-medium text-zinc-200 truncate mb-0.5" :title="entry.clip.name || 'Untitled Clip'">
            {{ entry.clip.name || 'Untitled Clip' }}
          </h4>
          <div class="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <span v-if="entry.clip.project_name" class="truncate">{{ entry.clip.project_name }}</span>
            <span v-if="entry.clip.project_name && entry.build.created_at" class="w-0.5 h-0.5 rounded-full bg-zinc-600" />
            <span v-if="entry.build.created_at">{{ formatDate(entry.build.created_at) }}</span>
          </div>
        </div>

        <!-- Schedule button (alternative to drag) -->
        <button
          @click.stop="$emit('scheduleClip', entry.clip, entry.build)"
          @mousedown.stop
          @dragstart.stop.prevent
          class="absolute top-2 right-2 p-1.5 bg-blue-500/90 hover:bg-blue-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all z-10"
          title="Schedule this clip"
        >
          <Calendar class="size-3" />
        </button>
      </div>
    </div>

    <!-- Drag Ghost Portal -->
    <Teleport to="body">
      <div
        v-if="draggingEntry"
        class="fixed pointer-events-none z-[9999]"
        :style="{ left: `${dragPosition.x - 60}px`, top: `${dragPosition.y - 60}px` }"
      >
        <div class="w-[120px] bg-zinc-900 border-2 border-blue-500 rounded-lg overflow-hidden shadow-2xl">
          <div class="aspect-video bg-zinc-950">
            <img
              v-if="getThumbnailUrl(draggingEntry)"
              :src="getThumbnailUrl(draggingEntry) || ''"
              :alt="draggingEntry.clip.name || 'Clip'"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <FileVideo class="size-5 text-zinc-700" />
            </div>
          </div>
          <div class="px-2 py-1 bg-blue-500">
            <p class="text-[10px] font-medium text-white truncate">
              {{ draggingEntry.clip.name || 'Untitled Clip' }}
            </p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Film, Search, Loader2, FileVideo, Calendar, GripVertical, Briefcase, Building2 } from 'lucide-vue-next';
import { getAllClips } from '@/services/database/clips';
import { getClipBuilds } from '@/services/database/clip-build';
import { getThumbnailByClipId } from '@/services/database/thumbnails';
import { getStoragePath } from '@/services/storage';
import type { Clip, ClipBuild } from '@/services/database/types';
import { invoke } from '@tauri-apps/api/core';
import { useClipThumbnailStore } from '@/stores/clipThumbnails';

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

// Generate consistent color for organization based on ID (same palette as run colors)
function getOrgColor(orgId: number | null): string {
  if (!orgId) return '#3B82F6'; // Default blue
  
  const colors = [
    '#8B5CF6', // Purple
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#EC4899', // Pink
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#A855F7', // Violet
    '#F97316', // Orange
  ];
  
  return colors[orgId % colors.length];
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
    await loadBuilds();
    console.log('[ClipsSidebar] Loaded builds:', allBuilds.value.length);
    
    // Batch load clip thumbnails using the persistent store
    await thumbnailStore.loadThumbnails(clips.value);
    
    // Load build-specific thumbnails
    await loadThumbnails();
    console.log('[ClipsSidebar] Thumbnails loaded');
  } catch (error) {
    console.error('[ClipsSidebar] Failed to load clips:', error);
  } finally {
    loading.value = false;
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

// Load all builds for all clips
async function loadBuilds() {
  const entries: BuildEntry[] = [];
  for (const clip of clips.value) {
    try {
      const builds = await getClipBuilds(clip.id);
      for (const build of builds) {
        if (build.status === 'completed') {
          const outputPaths = getOutputPathsFromBuild(build);
          
          // Create an entry for each output file
          for (let i = 0; i < outputPaths.length; i++) {
            const filePath = outputPaths[i];
            const aspectRatio = extractAspectRatioFromPath(filePath);
            
            entries.push({
              clip,
              build,
              filePath,
              aspectRatio,
              key: outputPaths.length > 1 ? `${build.id}-${i}` : build.id,
            });
          }
        }
      }
    } catch (error) {
      console.warn(`[ClipsSidebar] Failed to load builds for clip ${clip.id}:`, error);
    }
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

// Load thumbnail for a single build - tries multiple sources
async function loadBuildThumbnail(entry: BuildEntry): Promise<string | null> {
  const { clip, build } = entry;
  
  // Source 1: Build's thumbnail_path
  if (build.thumbnail_path) {
    try {
      const exists = await invoke<boolean>('check_file_exists', { path: build.thumbnail_path });
      if (exists) {
        return await invoke<string>('read_file_as_data_url', { filePath: build.thumbnail_path });
      }
    } catch { /* try next source */ }
  }
  
  // Source 2: Derive thumbnail path from entry's specific file_path
  if (entry.filePath) {
    const derivedPath = await getThumbnailPathForVideoFile(entry.filePath);
    if (derivedPath) {
      try {
        const exists = await invoke<boolean>('check_file_exists', { path: derivedPath });
        if (exists) {
          return await invoke<string>('read_file_as_data_url', { filePath: derivedPath });
        }
      } catch { /* try next source */ }
    }
  }

  // Source 3: Clip's built_thumbnail_path field
  if (clip.built_thumbnail_path) {
    try {
      const exists = await invoke<boolean>('check_file_exists', { path: clip.built_thumbnail_path });
      if (exists) {
        return await invoke<string>('read_file_as_data_url', { filePath: clip.built_thumbnail_path });
      }
    } catch { /* try next source */ }
  }

  // Source 4: Thumbnails table
  try {
    const thumbnail = await getThumbnailByClipId(clip.id);
    if (thumbnail?.file_path) {
      const exists = await invoke<boolean>('check_file_exists', { path: thumbnail.file_path });
      if (exists) {
        return await invoke<string>('read_file_as_data_url', { filePath: thumbnail.file_path });
      }
    }
  } catch { /* try regeneration */ }

  // Source 5: Regenerate from video file
  if (entry.filePath) {
    try {
      const videoExists = await invoke<boolean>('check_file_exists', { path: entry.filePath });
      if (videoExists) {
        const newThumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
          videoPath: entry.filePath,
          timestampSeconds: 1.0,
          outputFilename: null,
        });
        return await invoke<string>('read_file_as_data_url', { filePath: newThumbnailPath });
      }
    } catch (err) {
      console.warn(`[ClipsSidebar] Failed to regenerate thumbnail for build ${build.id}:`, err);
    }
  }

  return null;
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

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}
</style>
