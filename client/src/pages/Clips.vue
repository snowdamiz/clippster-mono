<template>
  <div class="clips-page">
    <PageLayout
      title="Clips"
      description="Browse and manage all your video clips"
      :show-header="!loading && clips.length > 0"
      icon="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4"
    >
      <template #actions>
        <button
          @click="openClipsFolder"
          :disabled="!hasAnyClipsWithFiles"
          :title="hasAnyClipsWithFiles ? 'Open clips folder' : 'No clips available to show in folder'"
          class="p-3 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        </button>
      </template>
      <!-- Loading State -->
      <LoadingState v-if="loading" message="Loading clips..." />
      <!-- Content when not loading -->

      <div v-else>
        <!-- Header with stats -->
        <div v-if="clips.length > 0" class="flex items-center justify-between mb-4">
          <p class="text-sm text-muted-foreground">{{ clips.length }} clip{{ clips.length !== 1 ? 's' : '' }}</p>
        </div>
        <!-- Clips Grid -->
        <div v-if="clips.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div
            v-for="clip in paginatedClips"
            :key="clip.id"
            class="relative bg-card rounded-lg overflow-hidden cursor-pointer group aspect-video hover:scale-102 transition-all"
            @click="playClip(clip)"
          >
            <!-- Thumbnail background with vignette -->
            <div
              v-if="getThumbnailUrl(clip)"
              class="absolute inset-0 z-0"
              :style="{
                backgroundImage: `url(${getThumbnailUrl(clip)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }"
            >
              <!-- Dark vignette overlay -->
              <div class="absolute inset-0 bg-gradient-to-br from-black/50 via-black/20 to-black/60"></div>
            </div>
            <!-- Top right status badge -->
            <div class="absolute top-4 right-4 z-5">
              <span
                :class="[
                  'text-xs px-2 py-1 rounded-md border',
                  getThumbnailUrl(clip)
                    ? getClipStatusBadgeClass(clip.status)
                    : 'text-muted-foreground bg-muted border-border',
                ]"
              >
                {{ getClipStatusText(clip.status) }}
              </span>
            </div>
            <!-- Bottom left title and description -->
            <div class="absolute bottom-2 left-2 right-2 z-5 bg-black/40 backdrop-blur-sm p-2 rounded-md">
              <h3
                :class="[
                  'text-md font-semibold mb-1 group-hover:transition-colors line-clamp-2',
                  getThumbnailUrl(clip)
                    ? 'text-white group-hover:text-white/80'
                    : 'text-foreground group-hover:text-foreground/80',
                ]"
              >
                {{ clip.name || 'Untitled Clip' }}
              </h3>

              <p
                :class="[
                  'text-xs mb-1 line-clamp-1',
                  getThumbnailUrl(clip) ? 'text-white/70' : 'text-muted-foreground/80',
                ]"
                v-if="clip.project_id && getProjectName(clip.project_id)"
              >
                Project: {{ getProjectName(clip.project_id) }}
              </p>

              <p :class="['text-sm line-clamp-1', getThumbnailUrl(clip) ? 'text-white/80' : 'text-muted-foreground']">
                {{ getRelativeTime(clip.created_at) }}
              </p>
            </div>
            <!-- Hover Overlay Buttons -->
            <div
              v-if="getThumbnailUrl(clip)"
              class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-5 flex items-center justify-center gap-4"
            >
              <button
                class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                :title="clip.status === 'detected' && !clip.file_path ? 'Clip not generated yet' : 'Play'"
                @click.stop="playClip(clip)"
                :disabled="clip.status === 'detected' && !clip.file_path"
              >
                <svg
                  class="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />

                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
              <button
                class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                title="Delete"
                @click.stop="confirmDelete(clip)"
              >
                <svg
                  class="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <!-- Empty State -->
        <EmptyState
          v-if="clips.length === 0"
          title="No clips yet"
          description="Generate or detect your first video clip to get started"
          button-text="Upload Clip"
        >
          <template #icon>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-16 w-16 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />

              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </template>
        </EmptyState>
      </div>
      <!-- Close content when not loading -->
    </PageLayout>
    <!-- Pagination Footer -->
    <PaginationFooter
      v-if="!loading && clips.length > 0"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total-items="clips.length"
      item-label="clip"
      @go-to-page="goToPage"
      @previous="previousPage"
      @next="nextPage"
    />
    <!-- Video Player Dialog -->
    <VideoPlayerDialog :video="clipToPlay" :show-video-player="showVideoPlayer" @close="showVideoPlayer = false" />
    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteDialog"
      title="Delete Clip"
      :message="'Are you sure you want to delete'"
      :item-name="clipToDelete?.name || 'this clip'"
      suffix="?"
      confirm-text="Delete"
      @close="handleDeleteDialogClose"
      @confirm="deleteClipConfirmed"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, computed, watch } from 'vue';
  import { invoke } from '@tauri-apps/api/core';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import {
    getGeneratedClips,
    getDetectedClips,
    deleteClip,
    getThumbnailByClipId,
    getProject,
    getRawVideosByProjectId,
    type Clip,
    type Project,
    type RawVideo,
  } from '@/services/database';
  import { getStoragePath } from '@/services/storage';
  import { useFormatters } from '@/composables/useFormatters';
  import PageLayout from '@/components/PageLayout.vue';
  import LoadingState from '@/components/LoadingState.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import VideoPlayerDialog from '@/components/VideoPlayerDialog.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';

  const clips = ref<Clip[]>([]);
  const loading = ref(true);
  const showDeleteDialog = ref(false);
  const clipToDelete = ref<Clip | null>(null);
  const showVideoPlayer = ref(false);
  const clipToPlay = ref<RawVideo | null>(null);
  const thumbnailCache = ref<Map<string, string>>(new Map());
  const rawVideoCache = ref<Map<string, (RawVideo & { thumbnail_path: string | null })[]>>(new Map());
  const projectCache = ref<Map<string, Project>>(new Map());
  const { getRelativeTime } = useFormatters();

  // Pagination state
  const currentPage = ref(1);
  const clipsPerPage = 20;

  // Computed property to check if any clips have actual files
  const hasAnyClipsWithFiles = computed(() => {
    return clips.value.some((clip) => clip.file_path && clip.file_path.trim() !== '');
  });

  // Pagination computed properties
  const totalPages = computed(() => Math.ceil(clips.value.length / clipsPerPage));
  const paginatedClips = computed(() => {
    const startIndex = (currentPage.value - 1) * clipsPerPage;
    const endIndex = startIndex + clipsPerPage;
    const paginated = clips.value.slice(startIndex, endIndex);
    return paginated;
  });

  // Pagination functions
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page;
    }
  }

  function nextPage() {
    if (currentPage.value < totalPages.value) {
      currentPage.value++;
    }
  }

  function previousPage() {
    if (currentPage.value > 1) {
      currentPage.value--;
    }
  }

  // Reset to first page when clips change
  watch(clips, () => {
    currentPage.value = 1;
  });

  async function loadClips() {
    loading.value = true;
    try {
      // Load both generated and detected clips
      const [generatedClips, detectedClips] = await Promise.all([getGeneratedClips(), getDetectedClips()]);

      // Combine and sort by created_at date
      clips.value = [...generatedClips, ...detectedClips].sort((a, b) => b.created_at - a.created_at);

      // Load thumbnails, project info, and raw videos for all clips
      for (const clip of clips.value) {
        await loadClipThumbnail(clip);

        // Load project info if clip has a project
        if (clip.project_id) {
          await getProjectInfo(clip.project_id);
          // Load raw videos for this project to use as fallback thumbnails
          await loadRawVideosForProject(clip.project_id);
        }
      }
    } catch (error) {
      console.error('Failed to load clips:', error);
    } finally {
      loading.value = false;
    }
  }

  async function loadRawVideosForProject(projectId: string): Promise<void> {
    // Check cache first
    if (rawVideoCache.value.has(projectId)) {
      return;
    }

    try {
      const rawVideos = await getRawVideosByProjectId(projectId);

      // Convert raw video thumbnails to data URLs for caching
      const processedRawVideos = await Promise.all(
        rawVideos.map(async (video) => {
          let thumbnailDataUrl = null;
          if (video.thumbnail_path) {
            try {
              const fileExists = await invoke<boolean>('check_file_exists', {
                path: video.thumbnail_path,
              });

              if (fileExists) {
                try {
                  thumbnailDataUrl = await invoke<string>('read_file_as_data_url', {
                    filePath: video.thumbnail_path,
                  });
                } catch (error) {
                  console.warn(`Failed to load raw video thumbnail for ${video.id}:`, error);
                }
              } else {
                console.warn(`Raw video thumbnail file does not exist: ${video.thumbnail_path}`);
              }
            } catch (error) {
              console.warn(`Failed to check thumbnail existence for ${video.id}:`, error);
            }
          }

          // If no thumbnail path or failed to load, use error SVG
          if (!thumbnailDataUrl) {
            thumbnailDataUrl = '/download_error.svg';
          }

          return { ...video, thumbnail_path: thumbnailDataUrl };
        })
      );

      rawVideoCache.value.set(projectId, processedRawVideos);
    } catch (error) {
      console.error('Failed to load raw videos for project:', error);
    }
  }

  async function loadClipThumbnail(clip: Clip) {
    try {
      const thumbnail = await getThumbnailByClipId(clip.id);
      if (thumbnail && thumbnail.file_path) {
        // Convert local file path to data URL for browser display
        const dataUrl = await invoke<string>('read_file_as_data_url', {
          filePath: thumbnail.file_path,
        });
        thumbnailCache.value.set(clip.id, dataUrl);
      }
    } catch (error) {
      console.error(`Failed to load thumbnail for clip ${clip.id}:`, error);
    }
  }

  async function getProjectInfo(projectId: string): Promise<Project | null> {
    // Check cache first
    if (projectCache.value.has(projectId)) {
      return projectCache.value.get(projectId) || null;
    }

    try {
      const project = await getProject(projectId);
      if (project) {
        projectCache.value.set(projectId, project);
      }
      return project;
    } catch (error) {
      return null;
    }
  }

  function getThumbnailUrl(clip: Clip): string | null {
    // First try to get clip-specific thumbnail
    const clipThumbnail = thumbnailCache.value.get(clip.id);
    if (clipThumbnail) {
      return clipThumbnail;
    }

    // If no clip thumbnail and this is a detected clip, try to use raw video thumbnail
    if (clip.status === 'detected' && clip.project_id) {
      const rawVideos = rawVideoCache.value.get(clip.project_id);
      if (rawVideos && rawVideos.length > 0) {
        // Use the first raw video's thumbnail as fallback
        const rawVideo = rawVideos[0];
        if (rawVideo.thumbnail_path) {
          return rawVideo.thumbnail_path;
        }
      }
    }

    return null;
  }

  function getClipStatusBadgeClass(status: string | null): string {
    switch (status) {
      case 'generated':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'detected':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'processing':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  }

  function getProjectName(projectId: string): string | null {
    const project = projectCache.value.get(projectId);
    return project?.name || null;
  }

  function getClipStatusText(status: string | null): string {
    switch (status) {
      case 'generated':
        return 'Generated';
      case 'detected':
        return 'Detected';
      case 'processing':
        return 'Processing';
      default:
        return 'Unknown';
    }
  }

  async function openClipsFolder() {
    try {
      const basePath = await getStoragePath('base');
      await revealItemInDir(basePath);
    } catch (err) {
      console.error('Failed to open Clippster directory:', err);
    }
  }

  async function playClip(clip: Clip) {
    try {
      // Check if clip has a valid file path
      if (!clip.file_path) {
        return;
      }

      // Convert clip to RawVideo-like format for the video player
      const clipAsVideo = {
        id: clip.id,
        project_id: clip.project_id,
        file_path: clip.file_path,
        original_filename: clip.name || 'Untitled Clip',
        thumbnail_path: getThumbnailUrl(clip),
        duration: clip.duration,
        width: null,
        height: null,
        frame_rate: null,
        codec: null,
        file_size: null,
        original_project_id: null,
        created_at: clip.created_at,
        updated_at: clip.updated_at,
        // Segment tracking fields (null for clips)
        source_clip_id: null,
        source_mint_id: null,
        segment_number: null,
        is_segment: false,
        segment_start_time: null,
        segment_end_time: null,
      };
      clipToPlay.value = clipAsVideo;
      showVideoPlayer.value = true;
    } catch (err) {
      console.error('Failed to prepare clip:', err);
    }
  }

  async function confirmDelete(clip: Clip) {
    clipToDelete.value = clip;
    showDeleteDialog.value = true;
  }

  function handleDeleteDialogClose() {
    showDeleteDialog.value = false;
    clipToDelete.value = null;
  }

  async function deleteClipConfirmed() {
    if (!clipToDelete.value) return;

    try {
      await deleteClip(clipToDelete.value.id);

      // Remove from thumbnail cache if exists
      if (clipToDelete.value.id && thumbnailCache.value.has(clipToDelete.value.id)) {
        thumbnailCache.value.delete(clipToDelete.value.id);
      }

      await loadClips();
    } catch (error) {
      console.error('Failed to delete clip:', error);
    }

    showDeleteDialog.value = false;
    clipToDelete.value = null;
  }

  onMounted(() => {
    loadClips();
  });
</script>

<style scoped>
  /* Root wrapper to ensure single root element for Transition */
  .clips-page {
    position: relative;
    width: 100%;
    min-height: 100%;
  }
</style>
