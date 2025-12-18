<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-white mb-1">Media Sources</h3>
      <p class="text-xs text-white/50 mb-4">Add videos and clips to your timeline.</p>
    </div>

    <!-- Add Source Buttons -->
    <div class="space-y-2">
      <button
        @click="openFilePicker"
        :disabled="isImporting"
        class="w-full py-3 border-2 border-dashed border-white/20 hover:border-violet-500/50 rounded-lg text-sm text-white/60 hover:text-violet-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Loader2 v-if="isImporting" :size="16" class="animate-spin" />
        <Upload v-else :size="16" />
        {{ isImporting ? 'Importing...' : 'Import Video File' }}
      </button>
    </div>

    <!-- Search -->
    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search sources..."
        class="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500/50"
      />
    </div>

    <!-- Tabs -->
    <div class="flex items-center gap-1 -mt-4 p-1 bg-white/5 rounded-lg">
      <button
        @click="activeSourceTab = 'clips'"
        :class="[
          'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
          activeSourceTab === 'clips' ? 'bg-violet-500/20 text-violet-300' : 'text-white/50 hover:text-white/70',
        ]"
      >
        My Clips ({{ filteredClips.length }})
      </button>
      <button
        @click="activeSourceTab = 'videos'"
        :class="[
          'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
          activeSourceTab === 'videos' ? 'bg-violet-500/20 text-violet-300' : 'text-white/50 hover:text-white/70',
        ]"
      >
        Raw Videos ({{ filteredRawVideos.length }})
      </button>
    </div>

    <!-- Content -->
    <div class="space-y-2 pr-1">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-8">
        <Loader2 :size="24" class="animate-spin text-white/40" />
      </div>

      <!-- Clips Tab -->
      <template v-else-if="activeSourceTab === 'clips'">
        <div v-if="filteredClips.length === 0" class="py-8 text-center">
          <Film :size="32" class="mx-auto text-white/20 mb-2" />
          <p class="text-sm text-white/40">No clips available</p>
          <p class="text-xs text-white/30 mt-1">Detect clips in your projects first</p>
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
            <!-- Thumbnail -->
            <div class="w-16 h-10 rounded overflow-hidden bg-black/50 flex-shrink-0">
              <img
                v-if="getThumbnailUrl(clip.id)"
                :src="getThumbnailUrl(clip.id)!"
                class="w-full h-full object-cover"
                @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <Film :size="14" class="text-white/30" />
              </div>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="text-sm text-white truncate">{{ clip.name }}</p>
              <p class="text-xs text-white/40">
                {{ clip.duration ? formatDuration(clip.duration) : 'Unknown' }}
                <span v-if="clip.projectName" class="text-white/30">• {{ clip.projectName }}</span>
              </p>
            </div>

            <!-- Add button -->
            <button
              @click.stop="addSourceToTimeline('clip', clip)"
              class="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Add to timeline"
            >
              <Plus :size="14" />
            </button>
          </div>
        </div>
      </template>

      <!-- Raw Videos Tab -->
      <template v-else-if="activeSourceTab === 'videos'">
        <div v-if="filteredRawVideos.length === 0" class="py-8 text-center">
          <Video :size="32" class="mx-auto text-white/20 mb-2" />
          <p class="text-sm text-white/40">No raw videos available</p>
          <p class="text-xs text-white/30 mt-1">Import videos or create clip projects first</p>
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
            <!-- Thumbnail -->
            <div class="w-16 h-10 rounded overflow-hidden bg-black/50 flex-shrink-0">
              <img
                v-if="getThumbnailUrl(video.id)"
                :src="getThumbnailUrl(video.id)!"
                class="w-full h-full object-cover"
                @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <Video :size="14" class="text-white/30" />
              </div>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p class="text-sm text-white truncate">{{ video.name }}</p>
              <p class="text-xs text-white/40">
                {{ video.duration ? formatDuration(video.duration) : 'Unknown' }}
                <span v-if="video.projectName" class="text-white/30">• {{ video.projectName }}</span>
              </p>
            </div>

            <!-- Add button -->
            <button
              @click.stop="addSourceToTimeline('raw_video', video)"
              class="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Add to timeline"
            >
              <Plus :size="14" />
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { Search, Upload, Film, Video, Plus, Loader2 } from 'lucide-vue-next';
  import type { SourceItem } from '@/types';
  import { getAllClips } from '@/services/database/clips';
  import { getAllRawVideos, getRawVideosByProjectId } from '@/services/database/raw-videos';
  import { getAllProjects } from '@/services/database/projects';
  import { open } from '@tauri-apps/plugin-dialog';
  import { invoke } from '@tauri-apps/api/core';
  import { syncOrganizationAssets } from '@/services/orgAssetSync';

  // Thumbnail cache for data URLs
  const thumbnailCache = ref<Map<string, string>>(new Map());

  const emit = defineEmits<{
    (e: 'addSource', source: SourceItem): void;
    (e: 'importFile', filePath: string, name: string, duration: number, thumbnailPath?: string): void;
  }>();

  const loading = ref(true);
  const isImporting = ref(false);
  const searchQuery = ref('');
  const activeSourceTab = ref<'clips' | 'videos'>('clips');

  // Source data
  const clips = ref<SourceItem[]>([]);
  const rawVideos = ref<SourceItem[]>([]);
  const projectNames = ref<Map<string, string>>(new Map());

  // Filtered sources
  const filteredClips = computed(() => {
    if (!searchQuery.value) return clips.value;
    const query = searchQuery.value.toLowerCase();
    return clips.value.filter(
      (c) => c.name.toLowerCase().includes(query) || c.projectName?.toLowerCase().includes(query)
    );
  });

  const filteredRawVideos = computed(() => {
    if (!searchQuery.value) return rawVideos.value;
    const query = searchQuery.value.toLowerCase();
    return rawVideos.value.filter(
      (v) => v.name.toLowerCase().includes(query) || v.projectName?.toLowerCase().includes(query)
    );
  });

  // Methods
  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}:${remainingMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getThumbnailUrl(id: string): string | null {
    return thumbnailCache.value.get(id) || null;
  }

  async function loadThumbnail(id: string, path: string | null): Promise<void> {
    if (!path || thumbnailCache.value.has(id)) return;

    try {
      const exists = await invoke<boolean>('check_file_exists', { path });
      if (exists) {
        const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: path });
        thumbnailCache.value.set(id, dataUrl);
      }
    } catch (err) {
      console.warn('[SourcesTab] Failed to load thumbnail:', err);
    }
  }

  async function loadSources() {
    loading.value = true;
    try {
      // Load project names first
      const projects = await getAllProjects();
      projectNames.value = new Map(projects.map((p) => [p.id, p.name]));

      // Build a cache of project raw videos for efficient lookup
      const projectRawVideosCache = new Map<string, { path: string; duration: number | null }>();
      for (const project of projects) {
        const rawVids = await getRawVideosByProjectId(project.id);
        if (rawVids.length > 0) {
          // Use the first raw video for the project (main source video)
          projectRawVideosCache.set(project.id, {
            path: rawVids[0].file_path,
            duration: rawVids[0].duration ?? null,
          });
        }
      }

      // Load ALL detected clips (not just those with builds)
      const allClips = await getAllClips();
      clips.value = await Promise.all(
        allClips.map(async (c) => {
          // Get the raw video path from the project
          const projectRawVideo = c.project_id ? projectRawVideosCache.get(c.project_id) : null;

          // For detected clips: use the raw video as source with trim times
          // For built clips: use the built file path
          const hasBuiltFile = c.built_file_path && c.build_status === 'completed';
          const clipDuration = c.start_time !== null && c.end_time !== null ? c.end_time - c.start_time : c.duration;

          return {
            id: c.id,
            type: 'clip' as const,
            name: c.name || 'Untitled Clip',
            // Use raw video path for detected clips, built file for exported clips
            path: hasBuiltFile ? c.built_file_path! : projectRawVideo?.path || c.file_path,
            thumbnailPath: c.built_thumbnail_path || null,
            duration: clipDuration ?? null,
            projectId: c.project_id,
            projectName: c.project_id ? projectNames.value.get(c.project_id) || null : c.project_name,
            // Clip segment timing (for detected clips that reference a raw video)
            clipStartTime: !hasBuiltFile && projectRawVideo ? c.start_time : null,
            clipEndTime: !hasBuiltFile && projectRawVideo ? c.end_time : null,
            sourceDuration: !hasBuiltFile && projectRawVideo ? projectRawVideo.duration : null,
          };
        })
      );

      // Load raw videos
      const allRawVideos = await getAllRawVideos();
      rawVideos.value = allRawVideos.map((v) => ({
        id: v.id,
        type: 'raw_video' as const,
        name: v.original_filename || 'Untitled Video',
        path: v.file_path,
        thumbnailPath: v.thumbnail_path,
        duration: v.duration,
        projectId: v.project_id,
        projectName: v.project_id ? projectNames.value.get(v.project_id) || null : null,
      }));

      // Load thumbnails for all sources
      await Promise.all([
        ...clips.value.map((c) => loadThumbnail(c.id, c.thumbnailPath)),
        ...rawVideos.value.map((v) => loadThumbnail(v.id, v.thumbnailPath)),
      ]);
    } catch (error) {
      console.error('[SourcesTab] Failed to load sources:', error);
    } finally {
      loading.value = false;
    }
  }

  function onDragStart(event: DragEvent, type: 'clip' | 'raw_video', source: SourceItem) {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type,
        source,
      })
    );
  }

  function addSourceToTimeline(type: 'clip' | 'raw_video', source: SourceItem) {
    emit('addSource', {
      ...source,
      type,
    });
  }

  async function openFilePicker() {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Video Files',
            extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv'],
          },
        ],
      });

      if (selected && typeof selected === 'string') {
        isImporting.value = true;

        try {
          // Get video metadata
          const metadata = await invoke<{
            duration: number;
            width: number;
            height: number;
            codec: string;
          }>('get_video_metadata', { videoPath: selected });

          // Extract filename from path
          const fileName = selected.split(/[/\\]/).pop() || 'Imported Video';

          // Generate thumbnail
          let thumbnailPath: string | undefined;
          try {
            thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
              videoPath: selected,
              timestampSeconds: 1,
              outputFilename: `imported_${Date.now()}`,
            });
          } catch (thumbErr) {
            console.warn('[SourcesTab] Failed to generate thumbnail:', thumbErr);
          }

          emit('importFile', selected, fileName, metadata.duration, thumbnailPath);
        } catch (metaErr) {
          console.error('[SourcesTab] Failed to get video metadata:', metaErr);
          // Emit with unknown duration
          const fileName = selected.split(/[/\\]/).pop() || 'Imported Video';
          emit('importFile', selected, fileName, 0);
        } finally {
          isImporting.value = false;
        }
      }
    } catch (error) {
      console.error('[SourcesTab] Failed to open file picker:', error);
      isImporting.value = false;
    }
  }

  // Lifecycle
  onMounted(() => {
    loadSources();

    // Trigger organization asset sync in background
    syncOrganizationAssets().catch((err) => {
      console.warn('[SourcesTab] Organization asset sync failed:', err);
    });
  });

  // Expose refresh method
  defineExpose({
    refresh: loadSources,
  });
</script>

<style scoped>
  .scrollbar-thin {
    scrollbar-width: thin;
  }

  .scrollbar-thumb-white\/10::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  .scrollbar-track-transparent::-webkit-scrollbar-track {
    background-color: transparent;
  }

  ::-webkit-scrollbar {
    width: 6px;
  }
</style>
