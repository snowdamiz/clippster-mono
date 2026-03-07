<template>
  <div class="flex flex-col h-full bg-zinc-950 border-r border-white/10">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-white/10">
      <div class="flex items-center gap-2 mb-2">
        <Film class="size-4 text-blue-400" />
        <h3 class="text-sm font-semibold text-zinc-200">Built Clips</h3>
      </div>
      <p class="text-[10px] text-zinc-500">
        {{ builtClips.length }} clip{{ builtClips.length !== 1 ? 's' : '' }} ready to schedule
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
    <div v-else-if="filteredClips.length === 0" class="flex-1 flex flex-col items-center justify-center px-6 text-center">
      <Film class="size-8 text-zinc-700 mb-3" />
      <p class="text-sm text-zinc-400 mb-1">
        {{ searchQuery ? 'No clips found' : 'No built clips yet' }}
      </p>
      <p class="text-xs text-zinc-600">
        {{ searchQuery ? 'Try a different search' : 'Build clips from your projects to schedule them' }}
      </p>
    </div>

    <!-- Clips List -->
    <div v-else class="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
      <div
        v-for="clip in filteredClips"
        :key="clip.id"
        @mousedown="handleMouseDown($event, clip)"
        class="group relative bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 rounded-lg overflow-hidden cursor-move transition-all"
        :class="{ 'opacity-50': draggingClipId === clip.id }"
      >
        <!-- Thumbnail -->
        <div class="relative aspect-video bg-zinc-900">
          <img
            v-if="getThumbnailUrl(clip)"
            :src="getThumbnailUrl(clip) || ''"
            :alt="clip.name || 'Clip thumbnail'"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <FileVideo class="size-6 text-zinc-700" />
          </div>
          
          <!-- Duration badge -->
          <div v-if="clip.built_duration" class="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-medium text-white">
            {{ formatDuration(clip.built_duration) }}
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
          <h4 class="text-xs font-medium text-zinc-200 truncate mb-0.5" :title="clip.name || 'Untitled Clip'">
            {{ clip.name || 'Untitled Clip' }}
          </h4>
          <div class="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <span v-if="clip.project_name" class="truncate">{{ clip.project_name }}</span>
            <span v-if="clip.project_name && clip.built_at" class="w-0.5 h-0.5 rounded-full bg-zinc-600" />
            <span v-if="clip.built_at">{{ formatDate(clip.built_at) }}</span>
          </div>
        </div>

        <!-- Schedule button (alternative to drag) -->
        <button
          @click.stop="$emit('scheduleClip', clip)"
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
        v-if="draggingClip"
        class="fixed pointer-events-none z-[9999]"
        :style="{ left: `${dragPosition.x - 60}px`, top: `${dragPosition.y - 60}px` }"
      >
        <div class="w-[120px] bg-zinc-900 border-2 border-blue-500 rounded-lg overflow-hidden shadow-2xl">
          <div class="aspect-video bg-zinc-950">
            <img
              v-if="getThumbnailUrl(draggingClip)"
              :src="getThumbnailUrl(draggingClip) || ''"
              :alt="draggingClip.name || 'Clip'"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <FileVideo class="size-5 text-zinc-700" />
            </div>
          </div>
          <div class="px-2 py-1 bg-blue-500">
            <p class="text-[10px] font-medium text-white truncate">
              {{ draggingClip.name || 'Untitled Clip' }}
            </p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Film, Search, Loader2, FileVideo, Calendar, GripVertical } from 'lucide-vue-next';
import { getAllClips } from '@/services/database/clips';
import { getThumbnailByClipId } from '@/services/database/thumbnails';
import { getStoragePath } from '@/services/storage';
import type { Clip } from '@/services/database/types';
import { invoke } from '@tauri-apps/api/core';

const emit = defineEmits<{
  (e: 'scheduleClip', clip: Clip): void;
  (e: 'dragStart', clipData: { clipId: string; clipName: string | null; mediaUrl: string | null; thumbnailUrl: string | null; duration: number | null; projectName: string | null }): void;
  (e: 'dragMove', position: { x: number; y: number }): void;
  (e: 'dragEnd', position: { x: number; y: number }): void;
}>();

const loading = ref(true);
const clips = ref<Clip[]>([]);
const searchQuery = ref('');
const draggingClip = ref<Clip | null>(null);
const draggingClipId = ref<string | null>(null);
const dragPosition = ref({ x: 0, y: 0 });
const thumbnailCache = ref<Map<string, string>>(new Map());

// Filter to only built clips
const builtClips = computed(() => {
  return clips.value.filter(
    (clip) => clip.build_status === 'completed' && clip.built_file_path
  );
});

// Search filter
const filteredClips = computed(() => {
  if (!searchQuery.value.trim()) return builtClips.value;
  
  const query = searchQuery.value.toLowerCase();
  return builtClips.value.filter((clip) => {
    const name = (clip.name || '').toLowerCase();
    const projectName = (clip.project_name || '').toLowerCase();
    return name.includes(query) || projectName.includes(query);
  });
});

// Get thumbnail URL from cache
function getThumbnailUrl(clip: Clip): string | null {
  return thumbnailCache.value.get(clip.id) || null;
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

// Mouse-based drag handlers (not HTML5 drag-and-drop)
let isDragging = false;
let dragStartPos = { x: 0, y: 0 };
const DRAG_THRESHOLD = 5; // pixels before drag starts

function handleMouseDown(event: MouseEvent, clip: Clip) {
  // Only left mouse button
  if (event.button !== 0) return;
  
  // Ignore if clicking on the schedule button
  if ((event.target as HTMLElement).closest('button')) return;
  
  event.preventDefault();
  isDragging = false;
  dragStartPos = { x: event.clientX, y: event.clientY };
  
  // Store the clip we might drag
  const potentialDragClip = clip;
  
  const handleMouseMove = (e: MouseEvent) => {
    const dx = e.clientX - dragStartPos.x;
    const dy = e.clientY - dragStartPos.y;
    
    // Check if we've moved enough to start dragging
    if (!isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      isDragging = true;
      console.log('[ClipsSidebar] Drag start for clip:', potentialDragClip.id, potentialDragClip.name);
      
      draggingClip.value = potentialDragClip;
      draggingClipId.value = potentialDragClip.id;
      
      // Emit drag data to parent
      const dragData = {
        clipId: potentialDragClip.id,
        clipName: potentialDragClip.name,
        mediaUrl: potentialDragClip.built_file_path,
        thumbnailUrl: thumbnailCache.value.get(potentialDragClip.id) || null,
        duration: potentialDragClip.built_duration,
        projectName: potentialDragClip.project_name,
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
      draggingClip.value = null;
      draggingClipId.value = null;
    }
    
    isDragging = false;
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

// Load clips and their thumbnails
async function loadClips() {
  loading.value = true;
  try {
    clips.value = await getAllClips();
    console.log('[ClipsSidebar] Loaded clips:', clips.value.length, 'built:', builtClips.value.length);
    await loadThumbnails();
    console.log('[ClipsSidebar] Thumbnails loaded:', thumbnailCache.value.size);
  } catch (error) {
    console.error('[ClipsSidebar] Failed to load clips:', error);
  } finally {
    loading.value = false;
  }
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

// Load thumbnails using the same approach as Clips.vue
async function loadThumbnails() {
  const clipsNeedingThumbs = builtClips.value.filter(
    (c) => !thumbnailCache.value.has(c.id)
  );
  console.log('[ClipsSidebar] Clips needing thumbnails:', clipsNeedingThumbs.length);
  if (clipsNeedingThumbs.length === 0) return;

  let hasNew = false;
  const batchSize = 5;
  for (let i = 0; i < clipsNeedingThumbs.length; i += batchSize) {
    const batch = clipsNeedingThumbs.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (clip) => {
        try {
          const dataUrl = await loadClipThumbnail(clip);
          if (dataUrl) {
            thumbnailCache.value.set(clip.id, dataUrl);
            hasNew = true;
          }
        } catch (err) {
          // Silently skip
        }
      })
    );
  }
  console.log('[ClipsSidebar] Thumbnail loading complete:', thumbnailCache.value.size);
  // Trigger reactivity by creating new Map
  if (hasNew) {
    thumbnailCache.value = new Map(thumbnailCache.value);
  }
}

// Load thumbnail for a single clip - tries multiple sources and regenerates if needed
async function loadClipThumbnail(clip: Clip): Promise<string | null> {
  // Source 1: Derive thumbnail path from built_file_path (most reliable)
  if (clip.built_file_path) {
    const derivedPath = await getThumbnailPathForVideoFile(clip.built_file_path);
    if (derivedPath) {
      try {
        const exists = await invoke<boolean>('check_file_exists', { path: derivedPath });
        if (exists) {
          return await invoke<string>('read_file_as_data_url', { filePath: derivedPath });
        }
      } catch { /* try next source */ }
    }
  }

  // Source 2: built_thumbnail_path field
  if (clip.built_thumbnail_path) {
    try {
      const exists = await invoke<boolean>('check_file_exists', { path: clip.built_thumbnail_path });
      if (exists) {
        return await invoke<string>('read_file_as_data_url', { filePath: clip.built_thumbnail_path });
      }
    } catch { /* try next source */ }
  }

  // Source 3: Thumbnails table
  try {
    const thumbnail = await getThumbnailByClipId(clip.id);
    if (thumbnail?.file_path) {
      const exists = await invoke<boolean>('check_file_exists', { path: thumbnail.file_path });
      if (exists) {
        return await invoke<string>('read_file_as_data_url', { filePath: thumbnail.file_path });
      }
    }
  } catch { /* try regeneration */ }

  // Source 4: Regenerate from video file
  if (clip.built_file_path) {
    try {
      const videoExists = await invoke<boolean>('check_file_exists', { path: clip.built_file_path });
      if (videoExists) {
        const newThumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
          videoPath: clip.built_file_path,
          timestampSeconds: 1.0,
          outputFilename: null,
        });
        return await invoke<string>('read_file_as_data_url', { filePath: newThumbnailPath });
      }
    } catch (err) {
      console.warn(`[ClipsSidebar] Failed to regenerate thumbnail for ${clip.id}:`, err);
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
