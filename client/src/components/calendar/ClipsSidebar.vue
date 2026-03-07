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
        :draggable="true"
        @dragstart="handleDragStart($event, clip)"
        @dragend="handleDragEnd"
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
          <div class="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
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
          @click="$emit('scheduleClip', clip)"
          class="absolute top-2 right-2 p-1.5 bg-blue-500/90 hover:bg-blue-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all"
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
import { getAllClipsWithBuilds } from '@/services/database/clip-build';
import type { Clip, ClipBuild } from '@/services/database/types';
import { invoke } from '@tauri-apps/api/core';

interface ClipWithBuilds extends Clip {
  builds: ClipBuild[];
}

const emit = defineEmits<{
  (e: 'scheduleClip', clip: ClipWithBuilds): void;
}>();

const loading = ref(true);
const clips = ref<ClipWithBuilds[]>([]);
const searchQuery = ref('');
const draggingClip = ref<ClipWithBuilds | null>(null);
const draggingClipId = ref<string | null>(null);
const dragPosition = ref({ x: 0, y: 0 });

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

// Get thumbnail URL (convert file path to asset URL)
function getThumbnailUrl(clip: ClipWithBuilds): string | null {
  if (!clip.built_thumbnail_path) return null;
  return `asset://localhost/${clip.built_thumbnail_path}`;
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

// Drag handlers
function handleDragStart(event: DragEvent, clip: ClipWithBuilds) {
  if (!event.dataTransfer) return;

  // Set transparent drag image
  const emptyImg = new Image();
  emptyImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=';
  event.dataTransfer.setDragImage(emptyImg, 0, 0);

  // Store clip data
  const dragData = {
    clipId: clip.id,
    clipName: clip.name,
    mediaUrl: clip.built_file_path,
    thumbnailUrl: clip.built_thumbnail_path,
    duration: clip.built_duration,
    projectName: clip.project_name,
  };

  event.dataTransfer.setData('application/json', JSON.stringify(dragData));
  event.dataTransfer.effectAllowed = 'copy';

  draggingClip.value = clip;
  draggingClipId.value = clip.id;
  dragPosition.value = { x: event.clientX, y: event.clientY };
}

function handleDragEnd() {
  draggingClip.value = null;
  draggingClipId.value = null;
}

function onDocumentDragOver(event: DragEvent) {
  if (draggingClip.value) {
    dragPosition.value = { x: event.clientX, y: event.clientY };
  }
}

// Load clips
async function loadClips() {
  loading.value = true;
  try {
    clips.value = await getAllClipsWithBuilds();
  } catch (error) {
    console.error('[ClipsSidebar] Failed to load clips:', error);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadClips();
  document.addEventListener('dragover', onDocumentDragOver);
});

onUnmounted(() => {
  document.removeEventListener('dragover', onDocumentDragOver);
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
