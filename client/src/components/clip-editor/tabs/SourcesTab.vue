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

    <!-- Search + filters -->
    <div class="flex flex-col gap-2">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search sources..."
          class="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500/50"
        />
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="sourceFilter = 'all'"
          :class="[
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors border',
            sourceFilter === 'all'
              ? 'bg-violet-500/20 text-violet-200 border-violet-500/40'
              : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10',
          ]"
        >
          All
        </button>
        <button
          @click="sourceFilter = 'recent'"
          :class="[
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors border',
            sourceFilter === 'recent'
              ? 'bg-violet-500/20 text-violet-200 border-violet-500/40'
              : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10',
          ]"
        >
          Recent
        </button>
      </div>
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
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-semibold text-white/70 uppercase tracking-wide">My Clips</h4>
            <span class="text-[11px] text-white/40">Showing built clips</span>
          </div>
        </div>
        <div v-if="clipsLoading" class="flex items-center justify-center gap-2 py-6 text-white/60">
          <Loader2 :size="16" class="animate-spin" />
          <span class="text-sm">Loading clips...</span>
        </div>

        <div
          v-else
          class="flex items-center justify-between px-2 py-2 bg-white/5 rounded-lg cursor-pointer select-none"
          @click="clipsCollapsed = !clipsCollapsed"
        >
          <div class="flex items-center gap-2">
            <ChevronRight
              :size="16"
              class="text-white/60 transition-transform"
              :class="clipsCollapsed ? '' : 'rotate-90 text-violet-300'"
            />
            <span class="text-sm text-white font-medium">My Clips ({{ displayClips.length }})</span>
          </div>
          <span class="text-xs text-white/40">{{ clipsCollapsed ? 'Show' : 'Hide' }}</span>
        </div>

        <div v-if="!clipsCollapsed">
          <div v-if="displayClips.length === 0" class="py-8 text-center">
            <Film :size="32" class="mx-auto text-white/20 mb-2" />
            <p class="text-sm text-white/40">No clips available</p>
            <p class="text-xs text-white/30 mt-1">Detect clips in your projects first</p>
          </div>

          <div
            v-for="clip in displayClips"
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
        </div>
      </template>

      <!-- Raw Videos Tab -->
      <template v-else-if="activeSourceTab === 'videos'">
        <div v-if="displayRawVideos.length === 0" class="py-8 text-center">
          <Video :size="32" class="mx-auto text-white/20 mb-2" />
          <p class="text-sm text-white/40">No raw videos available</p>
          <p class="text-xs text-white/30 mt-1">Import videos or create clip projects first</p>
        </div>

        <div
          v-for="video in displayRawVideos"
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
  import { Search, Upload, Film, Video, Plus, Loader2, ChevronRight } from 'lucide-vue-next';
  import type { SourceItem } from '@/types';
  import { getAllClips } from '@/services/database/clips';
  import { getAllRawVideos } from '@/services/database/raw-videos';
  import { getAllProjects } from '@/services/database/projects';
  import { getThumbnailByClipId } from '@/services/database/thumbnails';
  import { getStoragePath } from '@/services/storage';
  import { open } from '@tauri-apps/plugin-dialog';
  import { invoke } from '@tauri-apps/api/core';

  // Thumbnail cache for data URLs
  const thumbnailCache = ref<Map<string, string>>(new Map());

  const emit = defineEmits<{
    (e: 'addSource', source: SourceItem): void;
    (e: 'importFile', filePath: string, name: string, duration: number, thumbnailPath?: string): void;
  }>();

  const loading = ref(true);
  const clipsLoading = ref(false);
  const isImporting = ref(false);
  const searchQuery = ref('');
  const sourceFilter = ref<'all' | 'recent'>('all');
  const activeSourceTab = ref<'clips' | 'videos'>('clips');
  const clipsCollapsed = ref(true);

  // Source data
  const clips = ref<SourceItem[]>([]);
  const allClipsCache = ref<SourceItem[]>([]);
  const rawVideos = ref<SourceItem[]>([]);
  const projectNames = ref<Map<string, string>>(new Map());
  let sourcesPromise: Promise<void> | null = null;
  const normalizeId = (id: string | number | null | undefined): string | null =>
    id === null || id === undefined ? null : String(id);

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

  // Display sets with "recent" filter (simple last-10 heuristic)
  const displayClips = computed(() => {
    const base = filteredClips.value;
    if (sourceFilter.value === 'recent') {
      return base.slice(-10).reverse();
    }
    return base;
  });

  const displayRawVideos = computed(() => {
    const base = filteredRawVideos.value;
    if (sourceFilter.value === 'recent') {
      return base.slice(-10).reverse();
    }
    return base;
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

  async function getDerivedThumbnailPath(videoPath: string | null | undefined): Promise<string | null> {
    if (!videoPath) return null;
    try {
      const basePath = await getStoragePath('thumbnails');
      const videoFileName =
        videoPath
          .split(/[/\\]/)
          .pop()
          ?.replace(/\.[^.]+$/, '') || '';
      if (!videoFileName) return null;
      return `${basePath}/${videoFileName}_thumb.jpg`;
    } catch {
      return null;
    }
  }

  async function loadThumbnail(id: string, path: string | null, videoPath?: string | null): Promise<void> {
    if (thumbnailCache.value.has(id)) return;

    const candidatePaths: Array<string | null | undefined> = [path];
    // Derive fallback thumbnail path from the video file name
    if (videoPath) {
      candidatePaths.push(await getDerivedThumbnailPath(videoPath));
    }

    for (const candidate of candidatePaths) {
      if (!candidate) continue;
      try {
        const exists = await invoke<boolean>('check_file_exists', { path: candidate });
        if (exists) {
          const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: candidate });
          thumbnailCache.value.set(id, dataUrl);
          return;
        }
      } catch (err) {
        console.warn('[SourcesTab] Failed to load thumbnail:', err);
      }
    }
  }

  async function generateClipThumbnail(clip: SourceItem): Promise<boolean> {
    // Generate a thumbnail from the clip's own time window (midpoint), fallback to 0.5s
    if (!clip.path) return false;
    try {
      const clipDuration =
        clip.clipEndTime != null && clip.clipStartTime != null
          ? clip.clipEndTime - clip.clipStartTime
          : (clip.duration ?? 0);
      const start = clip.clipStartTime ?? 0;
      const target = clipDuration > 0 ? start + clipDuration / 2 : start + 0.5;
      const timestampSeconds = Math.max(0, target);

      const generatedPath = await invoke<string>('generate_thumbnail_at_timestamp', {
        videoPath: clip.path,
        timestampSeconds,
        outputFilename: `clip_${clip.id}_thumb_${Date.now()}`,
      });

      const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: generatedPath });
      thumbnailCache.value.set(clip.id, dataUrl);
      return true;
    } catch (err) {
      console.warn('[SourcesTab] Failed to generate clip thumbnail:', err);
      return false;
    }
  }

  // Prefer clip-specific thumbnail (thumbnails table). Fallback to stored/derived paths, and generate if missing.
  async function loadClipThumbnail(clip: SourceItem): Promise<void> {
    if (thumbnailCache.value.has(clip.id)) return;

    // Try clip-specific thumbnail (trimmed clip preview)
    try {
      const thumb = await getThumbnailByClipId(clip.id);
      if (thumb?.file_path) {
        const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: thumb.file_path });
        thumbnailCache.value.set(clip.id, dataUrl);
        return;
      }
    } catch (err) {
      console.warn('[SourcesTab] Failed to load clip thumbnail record:', err);
    }

    // Attempt to generate from the clip's own time window before falling back
    const generated = await generateClipThumbnail(clip);
    if (generated) return;

    // If this is a built/exported clip (no segment times), allow derived fallback from its own file
    const isBuiltClip = clip.clipStartTime == null && clip.clipEndTime == null;

    if (isBuiltClip) {
      await loadThumbnail(clip.id, clip.thumbnailPath, clip.path);
    } else {
      // For detected/raw segments, only try stored thumbnailPath (avoid raw VOD thumbnail)
      await loadThumbnail(clip.id, clip.thumbnailPath, null);
    }
  }

  async function loadSources(): Promise<void> {
    if (sourcesPromise) return sourcesPromise;

    sourcesPromise = (async () => {
      loading.value = true;
      try {
        // Load project names first (used for display)
        const projectList = await getAllProjects();
        projectNames.value = new Map(projectList.map((p) => [normalizeId(p.id) || '', p.name]));

        // Load raw videos (not gated by project selection)
        const allRawVideos = await getAllRawVideos();
        rawVideos.value = allRawVideos.map((v) => ({
          id: normalizeId(v.id) || v.id,
          type: 'raw_video' as const,
          name: v.original_filename || 'Untitled Video',
          path: v.file_path,
          thumbnailPath: v.thumbnail_path,
          duration: v.duration,
          projectId: normalizeId(v.project_id),
          projectName: projectNames.value.get(normalizeId(v.project_id) || '') || null,
        }));

        // Build a lookup of first raw video per project (for detected clips)
        const projectRawVideoMap = new Map<string, { path: string; duration: number | null; file_path?: string }>();
        rawVideos.value.forEach((rv) => {
          const pid = normalizeId(rv.projectId);
          if (pid && !projectRawVideoMap.has(pid)) {
            projectRawVideoMap.set(pid, { path: rv.path, duration: rv.duration, file_path: rv.path });
          }
        });

        // Load all built clips once; we'll filter per project on selection (cached for fallback)
        const allClips = await getAllClips();
        allClipsCache.value = allClips
          .filter((c) => c.built_file_path && c.build_status === 'completed')
          .map((c) => {
            const pid = normalizeId(c.project_id);
            const clipDuration =
              c.built_duration ??
              (c.start_time !== null && c.end_time !== null ? c.end_time - c.start_time : c.duration);

            const mapped: SourceItem = {
              id: normalizeId(c.id) || c.id,
              type: 'clip',
              name: c.name || 'Untitled Clip',
              path: c.built_file_path!,
              thumbnailPath: c.built_thumbnail_path || null,
              duration: clipDuration ?? null,
              projectId: pid,
              projectName: pid ? projectNames.value.get(pid) || null : c.project_name,
              clipStartTime: null,
              clipEndTime: null,
              sourceDuration: null,
            };
            return mapped;
          });

        // Set initial clips list to built clips and load thumbnails
        clips.value = allClipsCache.value;

        await Promise.all([
          ...rawVideos.value.map((v) => loadThumbnail(v.id, v.thumbnailPath, v.path)),
          ...clips.value.map((c) => loadClipThumbnail(c)),
        ]);
      } catch (error) {
        console.error('[SourcesTab] Failed to load sources:', error);
      } finally {
        loading.value = false;
        sourcesPromise = null;
      }
    })();

    return sourcesPromise;
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
