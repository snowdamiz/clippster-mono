<template>
  <div class="space-y-4">
    <!-- Unified Search Bar -->
    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search media..."
        class="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500/50"
      />
    </div>

    <!-- Sub-tabs -->
    <div class="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
      <button
        v-for="subTab in subTabs"
        :key="subTab.id"
        @click="activeSubTab = subTab.id"
        :class="[
          'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5',
          activeSubTab === subTab.id
            ? 'bg-violet-500/20 text-violet-300'
            : 'text-white/50 hover:text-white/70',
        ]"
      >
        <component :is="subTab.icon" :size="12" />
        {{ subTab.label }}
      </button>
    </div>

    <!-- Project Media Sub-tab -->
    <div v-if="activeSubTab === 'project'" class="space-y-4">
      <!-- Single Import Button -->
      <button
        @click="importAllMedia"
        :disabled="isImporting"
        class="w-full py-3 border border-dashed border-white/20 hover:border-violet-500/50 rounded-lg text-sm text-white/60 hover:text-violet-400 transition-colors flex items-center justify-center gap-2"
      >
        <Plus :size="16" />
        {{ isImporting ? 'Importing...' : 'Import Media' }}
      </button>

      <!-- Media Type Filter Tabs -->
      <div class="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
        <button
          @click="mediaTypeFilter = 'all'"
          :class="[
            'flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1',
            mediaTypeFilter === 'all' ? 'bg-violet-500/20 text-violet-300' : 'text-white/50 hover:text-white/70',
          ]"
        >
          All ({{ projectMedia.length }})
        </button>
        <button
          @click="mediaTypeFilter = 'video'"
          :class="[
            'flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1',
            mediaTypeFilter === 'video' ? 'bg-violet-500/20 text-violet-300' : 'text-white/50 hover:text-white/70',
          ]"
        >
          Video ({{ videoCount }})
        </button>
        <button
          @click="mediaTypeFilter = 'audio'"
          :class="[
            'flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1',
            mediaTypeFilter === 'audio' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/50 hover:text-white/70',
          ]"
        >
          Audio ({{ audioCount }})
        </button>
        <button
          @click="mediaTypeFilter = 'image'"
          :class="[
            'flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1',
            mediaTypeFilter === 'image' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/50 hover:text-white/70',
          ]"
        >
          Images ({{ imageCount }})
        </button>
      </div>

      <!-- Search removed from here -->

      <!-- Favorites Section (Collapsible) -->
      <CollapsibleSection
        v-if="favoriteMedia.length > 0"
        title="Favorites"
        :count="favoriteMedia.length"
        :default-open="true"
      >
        <div class="grid grid-cols-3 gap-2">
          <MediaItem
            v-for="media in favoriteMedia"
            :key="media.id"
            :media="media"
            @click="addMediaToTimeline(media)"
            @toggle-favorite="toggleFavorite(media.id)"
          />
        </div>
      </CollapsibleSection>

      <!-- Recent Section (Collapsible) -->
      <CollapsibleSection
        v-if="recentMedia.length > 0"
        title="Recent"
        :count="recentMedia.length"
        :default-open="true"
      >
        <div class="grid grid-cols-3 gap-2">
          <MediaItem
            v-for="media in recentMedia"
            :key="media.id"
            :media="media"
            @click="addMediaToTimeline(media)"
            @toggle-favorite="toggleFavorite(media.id)"
          />
        </div>
      </CollapsibleSection>

      <!-- All Media Section (Collapsible) -->
      <CollapsibleSection
        title="All Media"
        :count="filteredMedia.length"
        :default-open="favoriteMedia.length === 0 && recentMedia.length === 0"
      >
        <div v-if="loading" class="flex items-center justify-center py-8">
          <Loader2 :size="24" class="animate-spin text-white/40" />
        </div>

        <div v-else-if="filteredMedia.length === 0" class="py-8 text-center">
          <FolderOpen :size="32" class="mx-auto text-white/20 mb-2" />
          <p class="text-sm text-white/40">No media in this project</p>
          <p class="text-xs text-white/30 mt-1">Import video, audio, or images to get started</p>
        </div>

        <div v-else class="grid grid-cols-3 gap-2">
          <MediaItem
            v-for="media in filteredMedia"
            :key="media.id"
            :media="media"
            @click="addMediaToTimeline(media)"
            @toggle-favorite="toggleFavorite(media.id)"
          />
        </div>
      </CollapsibleSection>
    </div>

    <!-- Library Sub-tab (Global clips/videos) -->
    <div v-if="activeSubTab === 'library'" class="space-y-4">
      <!-- Filter tabs -->
      <div class="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
        <button
          @click="libraryFilter = 'clips'"
          :class="[
            'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            libraryFilter === 'clips' ? 'bg-violet-500/20 text-violet-300' : 'text-white/50 hover:text-white/70',
          ]"
        >
          My Clips ({{ filteredClips.length }})
        </button>
        <button
          @click="libraryFilter = 'videos'"
          :class="[
            'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            libraryFilter === 'videos' ? 'bg-violet-500/20 text-violet-300' : 'text-white/50 hover:text-white/70',
          ]"
        >
          Raw Videos ({{ filteredRawVideos.length }})
        </button>
      </div>

      <!-- Search removed from here -->

      <!-- Clips list -->
      <div v-if="libraryFilter === 'clips'" class="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        <div v-if="libraryLoading" class="flex items-center justify-center py-8">
          <Loader2 :size="24" class="animate-spin text-white/40" />
        </div>

        <div v-else-if="filteredClips.length === 0" class="py-8 text-center">
          <Film :size="32" class="mx-auto text-white/20 mb-2" />
          <p class="text-sm text-white/40">No clips available</p>
        </div>

        <div
          v-for="clip in filteredClips"
          :key="clip.id"
          class="group p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/30 rounded-lg transition-all cursor-pointer"
          draggable="true"
          @dragstart="(e) => onDragStart(e, 'clip', clip)"
          @click="addSourceToTimeline('clip', clip)"
        >
          <div class="flex items-center gap-3">
            <div class="w-14 h-9 rounded overflow-hidden bg-black/50 flex-shrink-0">
              <img
                v-if="getThumbnailUrl(clip.id)"
                :src="getThumbnailUrl(clip.id)!"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <Film :size="12" class="text-white/30" />
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-white truncate">{{ clip.name }}</p>
              <p class="text-[10px] text-white/40">{{ formatDuration(clip.duration) }}</p>
            </div>
            <button
              @click.stop="addSourceToTimeline('clip', clip)"
              class="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Plus :size="12" />
            </button>
          </div>
        </div>
      </div>

      <!-- Raw videos list -->
      <div v-if="libraryFilter === 'videos'" class="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        <div v-if="libraryLoading" class="flex items-center justify-center py-8">
          <Loader2 :size="24" class="animate-spin text-white/40" />
        </div>

        <div v-else-if="filteredRawVideos.length === 0" class="py-8 text-center">
          <Video :size="32" class="mx-auto text-white/20 mb-2" />
          <p class="text-sm text-white/40">No raw videos available</p>
        </div>

        <div
          v-for="video in filteredRawVideos"
          :key="video.id"
          class="group p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30 rounded-lg transition-all cursor-pointer"
          draggable="true"
          @dragstart="(e) => onDragStart(e, 'raw_video', video)"
          @click="addSourceToTimeline('raw_video', video)"
        >
          <div class="flex items-center gap-3">
            <div class="w-14 h-9 rounded overflow-hidden bg-black/50 flex-shrink-0">
              <img
                v-if="getThumbnailUrl(video.id)"
                :src="getThumbnailUrl(video.id)!"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <Video :size="12" class="text-white/30" />
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-white truncate">{{ video.name }}</p>
              <p class="text-[10px] text-white/40">{{ formatDuration(video.duration) }}</p>
            </div>
            <button
              @click.stop="addSourceToTimeline('raw_video', video)"
              class="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Plus :size="12" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Intro/Outro Sub-tab -->
    <div v-if="activeSubTab === 'intro-outro'" class="space-y-4">
      <IntroOutroTab
        :current-intro="currentIntro"
        :current-outro="currentOutro"
        @add-intro="$emit('addIntro', $event)"
        @add-outro="$emit('addOutro', $event)"
        @remove-intro="$emit('removeIntro')"
        @remove-outro="$emit('removeOutro')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  Search,
  Video,
  Music,
  Image as ImageIcon,
  Film,
  Plus,
  Loader2,
  FolderOpen,
  Library,
  Clapperboard,
  Star,
} from 'lucide-vue-next';
import type { SourceItem } from '@/types';
import {
  getProjectMedia,
  getRecentProjectMedia,
  getFavoriteProjectMedia,
  addProjectMedia,
  toggleFavorite as toggleFavoriteDb,
  recordMediaUsage,
  type ProjectMedia,
  type MediaType,
} from '@/services/database/project-media';
import { getAllClips } from '@/services/database/clips';
import { getAllRawVideos } from '@/services/database/raw-videos';
import { getAllProjects } from '@/services/database/projects';
import { getThumbnailByClipId } from '@/services/database/thumbnails';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import CollapsibleSection from '../CollapsibleSection.vue';
import MediaItem from '../MediaItem.vue';
import IntroOutroTab from './IntroOutroTab.vue';

const props = defineProps<{
  projectId: string | null;
  currentIntro: any;
  currentOutro: any;
}>();

const emit = defineEmits<{
  (e: 'addSource', source: SourceItem): void;
  (e: 'importFile', filePath: string, name: string, duration: number, thumbnailPath?: string): void;
  (e: 'addProjectMedia', media: ProjectMedia): void;
  (e: 'addIntro', intro: any): void;
  (e: 'addOutro', outro: any): void;
  (e: 'removeIntro'): void;
  (e: 'removeOutro'): void;
}>();

type SubTabId = 'project' | 'library' | 'intro-outro';

const subTabs: { id: SubTabId; label: string; icon: typeof FolderOpen }[] = [
  { id: 'project', label: 'Project', icon: FolderOpen },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'intro-outro', label: 'Intro/Outro', icon: Clapperboard },
];

const activeSubTab = ref<'project' | 'library' | 'intro-outro'>('project');
const loading = ref(false);
const libraryLoading = ref(false);
const isImporting = ref(false);
const searchQuery = ref('');
const libraryFilter = ref<'clips' | 'videos'>('clips');
const mediaTypeFilter = ref<'all' | 'video' | 'audio' | 'image'>('all');

// Project media
const projectMedia = ref<ProjectMedia[]>([]);
const recentMedia = ref<ProjectMedia[]>([]);
const favoriteMedia = ref<ProjectMedia[]>([]);

// Library data
const clips = ref<SourceItem[]>([]);
const rawVideos = ref<SourceItem[]>([]);
const thumbnailCache = ref<Map<string, string>>(new Map());
const projectNames = ref<Map<string, string>>(new Map());

// Media type counts
const videoCount = computed(() => projectMedia.value.filter((m) => m.media_type === 'video').length);
const audioCount = computed(() => projectMedia.value.filter((m) => m.media_type === 'audio').length);
const imageCount = computed(() => projectMedia.value.filter((m) => m.media_type === 'image').length);

const filteredMedia = computed(() => {
  let media = projectMedia.value;
  
  // Filter by type
  if (mediaTypeFilter.value !== 'all') {
    media = media.filter((m) => m.media_type === mediaTypeFilter.value);
  }
  
  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    media = media.filter((m) => m.file_name.toLowerCase().includes(query));
  }
  
  return media;
});

const filteredClips = computed(() => {
  if (!searchQuery.value) return clips.value;
  const query = searchQuery.value.toLowerCase();
  return clips.value.filter((c) => c.name.toLowerCase().includes(query));
});

const filteredRawVideos = computed(() => {
  if (!searchQuery.value) return rawVideos.value;
  const query = searchQuery.value.toLowerCase();
  return rawVideos.value.filter((v) => v.name.toLowerCase().includes(query));
});

function formatDuration(seconds: number | null): string {
  if (!seconds) return 'Unknown';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getThumbnailUrl(id: string): string | null {
  return thumbnailCache.value.get(id) || null;
}

async function loadProjectMedia() {
  if (!props.projectId) return;
  
  loading.value = true;
  try {
    const [all, recent, favorites] = await Promise.all([
      getProjectMedia(props.projectId),
      getRecentProjectMedia(props.projectId, 10),
      getFavoriteProjectMedia(props.projectId),
    ]);
    
    projectMedia.value = all;
    recentMedia.value = recent;
    favoriteMedia.value = favorites;
  } catch (error) {
    console.error('[MediaTab] Failed to load project media:', error);
  } finally {
    loading.value = false;
  }
}

async function loadLibrary() {
  libraryLoading.value = true;
  try {
    const projectList = await getAllProjects();
    projectNames.value = new Map(projectList.map((p) => [String(p.id), p.name]));

    const [allClips, allRawVideos] = await Promise.all([
      getAllClips(),
      getAllRawVideos(),
    ]);

    clips.value = allClips
      .filter((c) => c.built_file_path && c.build_status === 'completed')
      .map((c) => ({
        id: String(c.id),
        type: 'clip' as const,
        name: c.name || 'Untitled Clip',
        path: c.built_file_path!,
        thumbnailPath: c.built_thumbnail_path || null,
        duration: c.built_duration ?? c.duration ?? null,
        projectId: c.project_id ? String(c.project_id) : null,
        projectName: c.project_id ? projectNames.value.get(String(c.project_id)) || null : null,
      }));

    rawVideos.value = allRawVideos.map((v) => ({
      id: String(v.id),
      type: 'raw_video' as const,
      name: v.original_filename || 'Untitled Video',
      path: v.file_path,
      thumbnailPath: v.thumbnail_path,
      duration: v.duration,
      projectId: v.project_id ? String(v.project_id) : null,
      projectName: v.project_id ? projectNames.value.get(String(v.project_id)) || null : null,
    }));

    // Load thumbnails
    await Promise.all([
      ...clips.value.map((c) => loadThumbnail(c.id, c.thumbnailPath)),
      ...rawVideos.value.map((v) => loadThumbnail(v.id, v.thumbnailPath)),
    ]);
  } catch (error) {
    console.error('[MediaTab] Failed to load library:', error);
  } finally {
    libraryLoading.value = false;
  }
}

async function loadThumbnail(id: string, path: string | null): Promise<void> {
  if (thumbnailCache.value.has(id) || !path) return;
  try {
    const exists = await invoke<boolean>('check_file_exists', { path });
    if (exists) {
      const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: path });
      thumbnailCache.value.set(id, dataUrl);
    }
  } catch (err) {
    console.warn('[MediaTab] Failed to load thumbnail:', err);
  }
}

async function importAllMedia() {
  if (!props.projectId) return;

  try {
    // All supported media extensions
    const allExtensions = [
      // Video
      'mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv',
      // Audio
      'mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a',
      // Image
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp',
    ];

    const selected = await open({
      multiple: true,
      filters: [{ name: 'Media Files', extensions: allExtensions }],
    });

    if (!selected) return;

    isImporting.value = true;
    const files = Array.isArray(selected) ? selected : [selected];

    for (const filePath of files) {
      const fileName = filePath.split(/[/\\]/).pop() || 'Imported File';
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      
      // Determine media type from extension
      let mediaType: MediaType;
      if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv'].includes(ext)) {
        mediaType = 'video';
      } else if (['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'].includes(ext)) {
        mediaType = 'audio';
      } else {
        mediaType = 'image';
      }

      let duration: number | null = null;
      let width: number | null = null;
      let height: number | null = null;
      let thumbnailPath: string | null = null;

      // Get metadata based on type
      if (mediaType === 'video') {
        try {
          const metadata = await invoke<{ duration: number; width: number; height: number }>('get_video_metadata', { videoPath: filePath });
          duration = metadata.duration;
          width = metadata.width;
          height = metadata.height;
          
          // Generate thumbnail
          thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
            videoPath: filePath,
            timestampSeconds: 1,
            outputFilename: `media_${Date.now()}`,
          });
        } catch (err) {
          console.warn('[MediaTab] Failed to get video metadata:', err);
        }
      } else if (mediaType === 'audio') {
        try {
          const metadata = await invoke<{ duration: number }>('get_audio_metadata', { audioPath: filePath });
          duration = metadata.duration;
        } catch (err) {
          console.warn('[MediaTab] Failed to get audio metadata:', err);
        }
      } else if (mediaType === 'image') {
        try {
          const metadata = await invoke<{ width: number; height: number }>('get_image_metadata', { imagePath: filePath });
          width = metadata.width;
          height = metadata.height;
        } catch (err) {
          console.warn('[MediaTab] Failed to get image metadata:', err);
        }
      }

      // Add to database
      const media = await addProjectMedia(props.projectId, {
        mediaType,
        filePath,
        fileName,
        thumbnailPath,
        duration,
        width,
        height,
      });

      if (media) {
        projectMedia.value.unshift(media);
      }
    }

    // Reload to update favorites/recent
    await loadProjectMedia();
  } catch (error) {
    console.error('[MediaTab] Failed to import media:', error);
  } finally {
    isImporting.value = false;
  }
}

async function importMedia(mediaType: MediaType, extensions: string[]) {
  if (!props.projectId) return;

  try {
    const selected = await open({
      multiple: true,
      filters: [{ name: `${mediaType} Files`, extensions }],
    });

    if (!selected) return;

    isImporting.value = true;
    const files = Array.isArray(selected) ? selected : [selected];

    for (const filePath of files) {
      const fileName = filePath.split(/[/\\]/).pop() || 'Imported File';
      
      let duration: number | null = null;
      let width: number | null = null;
      let height: number | null = null;
      let thumbnailPath: string | null = null;

      // Get metadata based on type
      if (mediaType === 'video') {
        try {
          const metadata = await invoke<{ duration: number; width: number; height: number }>('get_video_metadata', { videoPath: filePath });
          duration = metadata.duration;
          width = metadata.width;
          height = metadata.height;
          
          // Generate thumbnail
          thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
            videoPath: filePath,
            timestampSeconds: 1,
            outputFilename: `media_${Date.now()}`,
          });
        } catch (err) {
          console.warn('[MediaTab] Failed to get video metadata:', err);
        }
      } else if (mediaType === 'audio') {
        try {
          const metadata = await invoke<{ duration: number }>('get_audio_metadata', { audioPath: filePath });
          duration = metadata.duration;
        } catch (err) {
          console.warn('[MediaTab] Failed to get audio metadata:', err);
        }
      } else if (mediaType === 'image') {
        try {
          const metadata = await invoke<{ width: number; height: number }>('get_image_metadata', { imagePath: filePath });
          width = metadata.width;
          height = metadata.height;
        } catch (err) {
          console.warn('[MediaTab] Failed to get image metadata:', err);
        }
      }

      // Add to database
      const media = await addProjectMedia(props.projectId, {
        mediaType,
        filePath,
        fileName,
        thumbnailPath,
        duration,
        width,
        height,
      });

      if (media) {
        projectMedia.value.unshift(media);
      }
    }

    // Reload to update favorites/recent
    await loadProjectMedia();
  } catch (error) {
    console.error('[MediaTab] Failed to import media:', error);
  } finally {
    isImporting.value = false;
  }
}

async function addMediaToTimeline(media: ProjectMedia) {
  // Record usage
  await recordMediaUsage(media.id);
  
  // Emit based on type
  if (media.media_type === 'video') {
    emit('addSource', {
      id: media.id,
      type: 'raw_video',
      name: media.file_name,
      path: media.file_path,
      thumbnailPath: media.thumbnail_path,
      duration: media.duration,
      projectId: media.project_id,
      projectName: null,
    });
  } else if (media.media_type === 'audio') {
    emit('importFile', media.file_path, media.file_name, media.duration || 0, media.thumbnail_path || undefined);
  } else if (media.media_type === 'image') {
    emit('addProjectMedia', media);
  }
  
  // Refresh recent
  recentMedia.value = await getRecentProjectMedia(props.projectId!, 10);
}

async function toggleFavorite(id: string) {
  const newState = await toggleFavoriteDb(id);
  
  // Update local state
  const media = projectMedia.value.find((m) => m.id === id);
  if (media) {
    media.is_favorite = newState;
  }
  
  // Refresh favorites
  favoriteMedia.value = await getFavoriteProjectMedia(props.projectId!);
}

function onDragStart(event: DragEvent, type: 'clip' | 'raw_video', source: SourceItem) {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('application/json', JSON.stringify({ type, source }));
}

function addSourceToTimeline(type: 'clip' | 'raw_video', source: SourceItem) {
  emit('addSource', { ...source, type });
}

watch(() => props.projectId, () => {
  if (props.projectId) {
    loadProjectMedia();
  }
}, { immediate: true });

onMounted(() => {
  loadLibrary();
});
</script>
