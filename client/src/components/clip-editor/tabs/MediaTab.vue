<template>
  <div class="space-y-3">
    <!-- Unified Search Bar -->
    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style="color: var(--sidebar-text-muted)" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search media..."
        class="w-full pl-9 pr-3 py-2 rounded-lg text-sm border transition-colors focus:outline-none"
        style="background-color: var(--sidebar-hover); border-color: var(--sidebar-border); color: var(--sidebar-text)"
        @focus="(e) => (e.target.style.borderColor = 'var(--sidebar-accent)')"
        @blur="(e) => (e.target.style.borderColor = 'var(--sidebar-border)')"
      />
    </div>

    <!-- Project Media Section -->
    <CollapsibleSection title="PROJECT MEDIA" :count="filteredProjectMedia.length" :default-open="true">
      <div class="space-y-3">
        <!-- Media Type Filter Chips -->
        <div class="flex items-center gap-2 flex-wrap">
          <button
            v-for="filter in mediaFilters"
            :key="filter.id"
            @click="mediaTypeFilter = filter.id"
            class="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
            :style="
              mediaTypeFilter === filter.id
                ? 'background-color: var(--sidebar-active); color: var(--sidebar-accent)'
                : 'background-color: var(--sidebar-hover); color: var(--sidebar-text-muted)'
            "
            @mouseenter="
              (e) => {
                if (mediaTypeFilter !== filter.id) e.target.style.backgroundColor = 'var(--sidebar-active)';
              }
            "
            @mouseleave="
              (e) => {
                if (mediaTypeFilter !== filter.id) e.target.style.backgroundColor = 'var(--sidebar-hover)';
              }
            "
          >
            <component :is="filter.icon" :size="12" />
            {{ filter.label }} ({{ filter.count }})
          </button>

          <!-- Actions -->
          <div class="ml-auto flex items-center gap-1">
            <button
              @click="importAllMedia"
              :disabled="isImporting"
              class="p-1.5 rounded-md transition-all"
              :style="
                isImporting ? 'color: var(--sidebar-text-muted); opacity: 0.5' : 'color: var(--sidebar-text-muted)'
              "
              @mouseenter="
                (e) => {
                  if (!isImporting) e.currentTarget.style.color = 'var(--sidebar-accent)';
                }
              "
              @mouseleave="
                (e) => {
                  if (!isImporting) e.currentTarget.style.color = 'var(--sidebar-text-muted)';
                }
              "
              :title="isImporting ? 'Importing...' : 'Import media'"
            >
              <Loader2 v-if="isImporting" :size="14" class="animate-spin" />
              <Plus v-else :size="14" />
            </button>
          </div>
        </div>

        <!-- Media Grid -->
        <div v-if="loading" class="flex items-center justify-center py-6">
          <Loader2 :size="20" class="animate-spin" style="color: var(--sidebar-text-muted)" />
        </div>

        <div v-else-if="filteredProjectMedia.length === 0" class="py-6 text-center">
          <FolderOpen :size="24" class="mx-auto mb-2" style="color: var(--sidebar-text-muted); opacity: 0.5" />
          <p class="text-xs" style="color: var(--sidebar-text-muted)">
            {{ searchQuery ? 'No matching media found' : 'No media in this project' }}
          </p>
        </div>

        <div v-else class="grid grid-cols-3 gap-2">
          <MediaItem
            v-for="media in filteredProjectMedia"
            :key="media.id"
            :media="media"
            @click="addMediaToTimeline(media)"
          />
        </div>
      </div>
    </CollapsibleSection>

    <!-- Library Section -->
    <CollapsibleSection
      title="LIBRARY"
      :count="libraryFilter === 'clips' ? filteredClips.length : filteredRawVideos.length"
      :default-open="false"
    >
      <div class="space-y-3">
        <!-- Library Filter Toggle -->
        <div class="flex items-center gap-2 flex-wrap">
          <button
            @click="libraryFilter = 'clips'"
            class="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
            :style="
              libraryFilter === 'clips'
                ? 'background-color: var(--sidebar-active); color: var(--sidebar-accent)'
                : 'background-color: var(--sidebar-hover); color: var(--sidebar-text-muted)'
            "
            @mouseenter="
              (e) => {
                if (libraryFilter !== 'clips') e.target.style.backgroundColor = 'var(--sidebar-active)';
              }
            "
            @mouseleave="
              (e) => {
                if (libraryFilter !== 'clips') e.target.style.backgroundColor = 'var(--sidebar-hover)';
              }
            "
          >
            <Film :size="12" />
            My Clips ({{ filteredClips.length }})
          </button>
          <button
            @click="libraryFilter = 'videos'"
            class="px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
            :style="
              libraryFilter === 'videos'
                ? 'background-color: var(--sidebar-active); color: var(--sidebar-accent)'
                : 'background-color: var(--sidebar-hover); color: var(--sidebar-text-muted)'
            "
            @mouseenter="
              (e) => {
                if (libraryFilter !== 'videos') e.target.style.backgroundColor = 'var(--sidebar-active)';
              }
            "
            @mouseleave="
              (e) => {
                if (libraryFilter !== 'videos') e.target.style.backgroundColor = 'var(--sidebar-hover)';
              }
            "
          >
            <Video :size="12" />
            Raw Videos ({{ filteredRawVideos.length }})
          </button>
        </div>

        <!-- Clips List -->
        <div v-if="libraryFilter === 'clips'" class="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          <div v-if="libraryLoading" class="flex items-center justify-center py-6">
            <Loader2 :size="20" class="animate-spin" style="color: var(--sidebar-text-muted)" />
          </div>

          <div v-else-if="filteredClips.length === 0" class="py-6 text-center">
            <Film :size="24" class="mx-auto mb-2" style="color: var(--sidebar-text-muted); opacity: 0.5" />
            <p class="text-xs" style="color: var(--sidebar-text-muted)">
              {{ searchQuery ? 'No matching clips found' : 'No clips available' }}
            </p>
          </div>

          <div
            v-for="clip in filteredClips"
            :key="clip.id"
            class="group p-3 rounded-lg transition-all cursor-pointer border"
            style="background-color: var(--sidebar-hover); border-color: var(--sidebar-border)"
            draggable="true"
            @dragstart="(e) => onDragStart(e, 'clip', clip)"
            @click="addSourceToTimeline('clip', clip)"
            @mouseenter="
              (e) => {
                e.currentTarget.style.backgroundColor = 'var(--sidebar-active)';
                e.currentTarget.style.borderColor = 'var(--sidebar-accent)';
              }
            "
            @mouseleave="
              (e) => {
                e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
                e.currentTarget.style.borderColor = 'var(--sidebar-border)';
              }
            "
          >
            <div class="flex items-center gap-3">
              <div
                class="w-14 h-9 rounded overflow-hidden flex-shrink-0"
                style="background-color: var(--sidebar-surface)"
              >
                <img
                  v-if="getThumbnailUrl(clip.id)"
                  :src="getThumbnailUrl(clip.id)!"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Film :size="12" style="color: var(--sidebar-text-muted)" />
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs truncate" style="color: var(--sidebar-text)">{{ clip.name }}</p>
                <p class="text-[10px]" style="color: var(--sidebar-text-muted)">{{ formatDuration(clip.duration) }}</p>
              </div>
              <button
                @click.stop="addSourceToTimeline('clip', clip)"
                class="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style="background-color: var(--sidebar-active); color: var(--sidebar-accent)"
              >
                <Plus :size="12" />
              </button>
            </div>
          </div>
        </div>

        <!-- Raw Videos List -->
        <div v-if="libraryFilter === 'videos'" class="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          <div v-if="libraryLoading" class="flex items-center justify-center py-6">
            <Loader2 :size="20" class="animate-spin" style="color: var(--sidebar-text-muted)" />
          </div>

          <div v-else-if="filteredRawVideos.length === 0" class="py-6 text-center">
            <Video :size="24" class="mx-auto mb-2" style="color: var(--sidebar-text-muted); opacity: 0.5" />
            <p class="text-xs" style="color: var(--sidebar-text-muted)">
              {{ searchQuery ? 'No matching videos found' : 'No raw videos available' }}
            </p>
          </div>

          <div
            v-for="video in filteredRawVideos"
            :key="video.id"
            class="group p-3 rounded-lg transition-all cursor-pointer border"
            style="background-color: var(--sidebar-hover); border-color: var(--sidebar-border)"
            draggable="true"
            @dragstart="(e) => onDragStart(e, 'raw_video', video)"
            @click="addSourceToTimeline('raw_video', video)"
            @mouseenter="
              (e) => {
                e.currentTarget.style.backgroundColor = 'var(--sidebar-active)';
                e.currentTarget.style.borderColor = 'var(--sidebar-accent)';
              }
            "
            @mouseleave="
              (e) => {
                e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)';
                e.currentTarget.style.borderColor = 'var(--sidebar-border)';
              }
            "
          >
            <div class="flex items-center gap-3">
              <div
                class="w-14 h-9 rounded overflow-hidden flex-shrink-0"
                style="background-color: var(--sidebar-surface)"
              >
                <img
                  v-if="getThumbnailUrl(video.id)"
                  :src="getThumbnailUrl(video.id)!"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Video :size="12" style="color: var(--sidebar-text-muted)" />
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs truncate" style="color: var(--sidebar-text)">{{ video.name }}</p>
                <p class="text-[10px]" style="color: var(--sidebar-text-muted)">{{ formatDuration(video.duration) }}</p>
              </div>
              <button
                @click.stop="addSourceToTimeline('raw_video', video)"
                class="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style="background-color: var(--sidebar-active); color: var(--sidebar-accent)"
              >
                <Plus :size="12" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </CollapsibleSection>

    <!-- Intro/Outro Section -->
    <CollapsibleSection title="INTRO / OUTRO" :default-open="false">
      <IntroOutroTab
        :current-intro="currentIntro"
        :current-outro="currentOutro"
        :search-query="searchQuery"
        @add-intro="$emit('addIntro', $event)"
        @add-outro="$emit('addOutro', $event)"
        @remove-intro="$emit('removeIntro')"
        @remove-outro="$emit('removeOutro')"
      />
    </CollapsibleSection>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import { Search, Video, Music, Image as ImageIcon, Film, Plus, Loader2, FolderOpen } from 'lucide-vue-next';
  import type { SourceItem } from '@/types';
  import {
    getProjectMedia,
    addProjectMedia,
    recordMediaUsage,
    type ProjectMedia,
    type MediaType,
  } from '@/services/database/project-media';
  import { getAllClips } from '@/services/database/clips';
  import { getAllRawVideos } from '@/services/database/raw-videos';
  import { getAllProjects } from '@/services/database/projects';
  import { getThumbnailByClipId } from '@/services/database/thumbnails';
  import { getUserOrganizationAssets, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
  import { useAuthStore } from '@/stores/auth';
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

  const loading = ref(false);
  const libraryLoading = ref(false);
  const isImporting = ref(false);
  const searchQuery = ref('');
  const libraryFilter = ref<'clips' | 'videos'>('clips');
  const mediaTypeFilter = ref<'all' | 'video' | 'audio' | 'image'>('all');

  // Auth store for organization checks
  const authStore = useAuthStore();

  // Project media
  const projectMedia = ref<ProjectMedia[]>([]);
  const orgAssets = ref<ServerOrganizationAsset[]>([]);

  const hasOrganizations = computed(() => {
    const user = authStore.user;
    return user && (user.owned_organization_id || user.created_by_organization_id);
  });

  // Library data
  const clips = ref<SourceItem[]>([]);
  const rawVideos = ref<SourceItem[]>([]);
  const thumbnailCache = ref<Map<string, string>>(new Map());
  const projectNames = ref<Map<string, string>>(new Map());

  // Unified project media (includes organization assets)
  const allProjectMedia = computed(() => {
    // Convert org assets to a compatible format
    const orgMediaItems = orgAssets.value.map((a) => ({
      id: `org_${a.id}`,
      project_id: props.projectId || '',
      file_name: a.name,
      file_path: a.url,
      thumbnail_path: a.thumbnail_url,
      media_type: a.asset_type as MediaType,
      duration: a.duration,
      width: a.width,
      height: a.height,
      file_size: a.file_size,
      is_favorite: false,
      use_count: 0,
      last_used_at: null,
      created_at: new Date(a.inserted_at).getTime(),
      user_id: null,
      isOrgAsset: true,
      organization_name: a.organization_name,
    }));

    return [...projectMedia.value, ...(orgMediaItems as any)];
  });

  // Media type counts (include org assets)
  const videoCount = computed(() => allProjectMedia.value.filter((m) => m.media_type === 'video').length);
  const audioCount = computed(() => allProjectMedia.value.filter((m) => m.media_type === 'audio').length);
  const imageCount = computed(() => allProjectMedia.value.filter((m) => m.media_type === 'image').length);

  // Media filters configuration
  const mediaFilters = computed(() => [
    { id: 'all' as const, label: 'All', icon: FolderOpen, count: allProjectMedia.value.length },
    { id: 'video' as const, label: 'Video', icon: Video, count: videoCount.value },
    { id: 'audio' as const, label: 'Audio', icon: Music, count: audioCount.value },
    { id: 'image' as const, label: 'Images', icon: ImageIcon, count: imageCount.value },
  ]);

  // Unified filtered project media (combines favorites, recent, and all, including org assets)
  const filteredProjectMedia = computed(() => {
    let media = [...allProjectMedia.value];

    // Filter by type
    if (mediaTypeFilter.value !== 'all') {
      media = media.filter((m) => m.media_type === mediaTypeFilter.value);
    }

    // Filter by search
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      media = media.filter((m) => m.file_name.toLowerCase().includes(query));
    }

    // Sort by most recently used
    media.sort((a, b) => new Date(b.last_used_at || 0).getTime() - new Date(a.last_used_at || 0).getTime());

    return media;
  });

  const filteredClips = computed(() => {
    let filtered = clips.value;

    // Filter by search
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter((c) => c.name.toLowerCase().includes(query));
    }

    return filtered;
  });

  const filteredRawVideos = computed(() => {
    let filtered = rawVideos.value;

    // Filter by search
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter((v) => v.name.toLowerCase().includes(query));
    }

    return filtered;
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
      projectMedia.value = await getProjectMedia(props.projectId);
    } catch (error) {
      console.error('[MediaTab] Failed to load project media:', error);
    } finally {
      loading.value = false;
    }
  }

  async function loadOrgAssets() {
    if (!hasOrganizations.value) return;
    try {
      const response = await getUserOrganizationAssets();
      if (response.success) {
        // Filter to only media types (image, audio) - not intro/outro/watermark
        orgAssets.value = response.assets.filter((a) => a.asset_type === 'image' || a.asset_type === 'audio');
      }
    } catch (error) {
      console.error('[MediaTab] Failed to load org assets:', error);
    }
  }

  async function loadLibrary() {
    libraryLoading.value = true;
    try {
      const projectList = await getAllProjects();
      projectNames.value = new Map(projectList.map((p) => [String(p.id), p.name]));

      const [allClips, allRawVideos] = await Promise.all([getAllClips(), getAllRawVideos()]);

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
        'mp4',
        'mov',
        'avi',
        'mkv',
        'webm',
        'wmv',
        'flv',
        // Audio
        'mp3',
        'wav',
        'aac',
        'ogg',
        'flac',
        'm4a',
        // Image
        'jpg',
        'jpeg',
        'png',
        'gif',
        'webp',
        'svg',
        'bmp',
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
            const metadata = await invoke<{ duration: number; width: number; height: number }>('get_video_metadata', {
              videoPath: filePath,
            });
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
            const metadata = await invoke<{ width: number; height: number }>('get_image_metadata', {
              imagePath: filePath,
            });
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

      // Reload to update everything
      await loadProjectMedia();
    } catch (error) {
      console.error('[MediaTab] Failed to import media:', error);
    } finally {
      isImporting.value = false;
    }
  }

  async function addMediaToTimeline(media: ProjectMedia & { isOrgAsset?: boolean }) {
    // Record usage (only for non-org assets)
    if (!media.isOrgAsset) {
      await recordMediaUsage(media.id);
    }

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

    // Refresh to update sort order (only if not org asset)
    if (!media.isOrgAsset) {
      await loadProjectMedia();
    }
  }

  function onDragStart(event: DragEvent, type: 'clip' | 'raw_video', source: SourceItem) {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/json', JSON.stringify({ type, source }));
  }

  function addSourceToTimeline(type: 'clip' | 'raw_video', source: SourceItem) {
    emit('addSource', { ...source, type });
  }

  watch(
    () => props.projectId,
    () => {
      if (props.projectId) {
        loadProjectMedia();
      }
    },
    { immediate: true }
  );

  watch(
    () => authStore.user,
    (newUser, oldUser) => {
      const oldOrgId = oldUser?.owned_organization_id || oldUser?.created_by_organization_id;
      const newOrgId = newUser?.owned_organization_id || newUser?.created_by_organization_id;
      if (oldOrgId !== newOrgId) {
        loadOrgAssets();
      }
    },
    { deep: true }
  );

  onMounted(() => {
    loadLibrary();
    loadOrgAssets();
  });
</script>

<style scoped>
  /* Custom scrollbar styling for library lists */
  .space-y-2::-webkit-scrollbar {
    width: 6px;
  }

  .space-y-2::-webkit-scrollbar-track {
    background: transparent;
  }

  .space-y-2::-webkit-scrollbar-thumb {
    background-color: var(--sidebar-border);
    border-radius: 3px;
  }

  .space-y-2::-webkit-scrollbar-thumb:hover {
    background-color: var(--sidebar-text-muted);
  }

  /* Firefox scrollbar */
  .space-y-2 {
    scrollbar-width: thin;
    scrollbar-color: var(--sidebar-border) transparent;
  }

  /* Smooth transitions for all interactive elements */
  button {
    transition: all 150ms ease;
  }

  /* Focus styles for accessibility */
  input:focus {
    outline: none;
  }

  /* Placeholder styling */
  input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }
</style>
