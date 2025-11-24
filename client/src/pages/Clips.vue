<template>
  <div class="clips-page">
    <PageLayout
      title="Clips"
      description="Browse and manage all your video clips"
      :show-header="true"
      :icon="LayoutGrid"
    >
      <template #actions>
        <button
          @click="openClipsFolder"
          :disabled="!hasAnyClipsWithFiles"
          :title="hasAnyClipsWithFiles ? 'Open clips folder' : 'No clips available to show in folder'"
          class="p-3 bg-muted hover:bg-muted/80 text-foreground rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Folder class="h-5 w-5" />
        </button>
      </template>
      <!-- Loading State -->
      <div v-if="loading" class="space-y-6">
        <SkeletonGrid />
      </div>
      <!-- Content when not loading -->

      <div v-else>
        <!-- Filter Toolbar -->
        <div class="mb-6 bg-card flex flex-col md:flex-row gap-4 items-center justify-between" v-if="clips.length > 0">
          <!-- Left: Search -->
          <div class="relative w-full md:w-72">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Search clips or projects..." class="pl-9 bg-background/50" />
          </div>

          <!-- Right: Filters -->
          <div class="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <!-- Reset Filters Button -->
            <button
              v-if="searchQuery || statusFilter !== 'all' || projectFilter !== 'all'"
              @click="
                searchQuery = '';
                statusFilter = 'all';
                projectFilter = 'all';
              "
              class="text-xs px-2 py-1 text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-md transition-colors whitespace-nowrap font-medium flex items-center gap-1"
            >
              <X class="h-3 w-3" />
              Reset
            </button>

            <!-- Status Filter -->
            <CustomDropdown v-model="statusFilter" :options="statusOptions" placeholder="Status" class="w-[140px]" />

            <!-- Project Filter -->
            <CustomDropdown v-model="projectFilter" :options="projectOptions" placeholder="Project" class="w-[160px]" />

            <!-- Sort Filter -->
            <CustomDropdown v-model="sortBy" :options="sortOptions" placeholder="Sort By" class="w-[170px]" />
          </div>
        </div>

        <!-- Clips Grid -->
        <div v-if="filteredClips.length > 0" class="space-y-8">
          <div v-for="group in groupedClips" :key="group.dateLabel" class="space-y-4">
            <!-- Date Header -->
            <h3 class="text-sm font-medium text-muted-foreground border-b border-border pb-2">
              {{ group.dateLabel }}
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div
                v-for="clip in group.clips"
                :key="clip.id"
                class="relative bg-card rounded-md overflow-hidden cursor-pointer group aspect-video hover:scale-102 transition-all"
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

                  <p
                    :class="['text-sm line-clamp-1', getThumbnailUrl(clip) ? 'text-white/80' : 'text-muted-foreground']"
                  >
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
                    <Play class="h-6 w-6" />
                  </button>
                  <button
                    class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                    title="Delete"
                    @click.stop="confirmDelete(clip)"
                  >
                    <Trash2 class="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- No Results State -->
        <div
          v-if="clips.length > 0 && filteredClips.length === 0"
          class="flex flex-col items-center justify-center py-16 text-center space-y-4"
        >
          <div class="bg-muted rounded-full p-4">
            <Search class="h-8 w-8 text-muted-foreground" />
          </div>
          <div class="space-y-1">
            <h3 class="font-semibold text-lg">No clips found</h3>
            <p class="text-muted-foreground text-sm max-w-sm">
              We couldn't find any clips matching your search filters. Try adjusting your search query or filters.
            </p>
          </div>
          <button
            @click="
              searchQuery = '';
              statusFilter = 'all';
            "
            class="text-primary hover:underline text-sm font-medium"
          >
            Clear filters
          </button>
        </div>

        <!-- Empty State -->
        <EmptyState
          v-if="clips.length === 0"
          title="No clips yet"
          description="Generate or detect your first video clip to get started"
        >
          <template #icon>
            <Video class="h-16 w-16 text-muted-foreground" />
          </template>
        </EmptyState>
      </div>
      <!-- Close content when not loading -->
    </PageLayout>
    <!-- Pagination Footer -->
    <PaginationFooter
      v-if="!loading && filteredClips.length > 0"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total-items="filteredClips.length"
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
  import { LayoutGrid, Folder, Play, Trash2, Video, Search, X, Calendar } from 'lucide-vue-next';
  import {
    getAllClips,
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
  import EmptyState from '@/components/EmptyState.vue';
  import SkeletonGrid from '@/components/SkeletonGrid.vue';
  import VideoPlayerDialog from '@/components/VideoPlayerDialog.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import { Input } from '@/components/ui/input';
  import CustomDropdown from '@/components/CustomDropdown.vue';

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

  // Filter state
  const searchQuery = ref('');
  const sortBy = ref('created-desc');
  const statusFilter = ref('all');
  const projectFilter = ref('all');

  const statusOptions = [
    { label: 'All Status', value: 'all' },
    { label: 'Generated', value: 'generated' },
    { label: 'Detected', value: 'detected' },
    { label: 'Processing', value: 'processing' },
  ];

  const projectOptions = computed(() => {
    const projects = new Map<string, string>();
    // Collect all unique projects from clips
    clips.value.forEach((clip) => {
      if (clip.project_id) {
        const project = projectCache.value.get(clip.project_id);
        if (project) {
          // Resolve to parent if available
          let targetProject = project;
          if (project.parent_id) {
            const parent = projectCache.value.get(project.parent_id);
            if (parent) {
              targetProject = parent;
            }
          }
          projects.set(targetProject.id, targetProject.name);
        }
      }
    });

    const options = Array.from(projects.entries())
      .map(([id, name]) => ({
        label: name,
        value: id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [{ label: 'All Projects', value: 'all' }, ...options];
  });

  const sortOptions = [
    { label: 'Created: Newest', value: 'created-desc' },
    { label: 'Created: Oldest', value: 'created-asc' },
    { label: 'Name: A-Z', value: 'name-asc' },
    { label: 'Name: Z-A', value: 'name-desc' },
    { label: 'Duration: Longest', value: 'duration-desc' },
    { label: 'Duration: Shortest', value: 'duration-asc' },
  ];

  // Pagination state
  const currentPage = ref(1);
  const clipsPerPage = 20;

  // Computed property to check if any clips have actual files
  const hasAnyClipsWithFiles = computed(() => {
    return clips.value.some((clip) => clip.file_path && clip.file_path.trim() !== '');
  });

  // Filtered clips
  const filteredClips = computed(() => {
    let result = clips.value;

    // 1. Search Text
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      result = result.filter(
        (c) =>
          (c.name && c.name.toLowerCase().includes(query)) ||
          (c.project_id && getProjectName(c.project_id)?.toLowerCase().includes(query))
      );
    }

    // 2. Status Filter
    if (statusFilter.value !== 'all') {
      result = result.filter((c) => c.status === statusFilter.value);
    }

    // 3. Project Filter
    if (projectFilter.value !== 'all') {
      result = result.filter((c) => {
        if (!c.project_id) return false;
        // Match if clip project ID is the selected ID (direct match)
        if (c.project_id === projectFilter.value) return true;

        // Match if clip project's parent ID is the selected ID (child match)
        const project = projectCache.value.get(c.project_id);
        return project?.parent_id === projectFilter.value;
      });
    }

    // 4. Sorting
    const [field, direction] = sortBy.value.split('-');
    result = [...result].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      if (field === 'created') {
        valA = a.created_at;
        valB = b.created_at;
      } else if (field === 'name') {
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
      } else if (field === 'duration') {
        valA = a.duration || 0;
        valB = b.duration || 0;
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  });

  // Pagination computed properties
  const totalPages = computed(() => Math.ceil(filteredClips.value.length / clipsPerPage));

  const paginatedClips = computed(() => {
    const startIndex = (currentPage.value - 1) * clipsPerPage;
    const endIndex = startIndex + clipsPerPage;
    return filteredClips.value.slice(startIndex, endIndex);
  });

  // Group by date logic
  const groupedClips = computed(() => {
    // If we are sorting by name or duration, skip date grouping
    if (sortBy.value.startsWith('name') || sortBy.value.startsWith('duration')) {
      return [{ dateLabel: 'Clips', clips: paginatedClips.value }];
    }

    const groups: { dateLabel: string; clips: Clip[] }[] = [];
    let currentLabel = '';
    let currentClips: Clip[] = [];

    const clipsToGroup = paginatedClips.value;

    for (const clip of clipsToGroup) {
      const label = getDateLabel(clip.created_at);

      if (label !== currentLabel) {
        if (currentLabel) {
          groups.push({ dateLabel: currentLabel, clips: currentClips });
        }
        currentLabel = label;
        currentClips = [clip];
      } else {
        currentClips.push(clip);
      }
    }

    if (currentLabel) {
      groups.push({ dateLabel: currentLabel, clips: currentClips });
    } else if (clipsToGroup.length > 0 && groups.length === 0) {
      groups.push({ dateLabel: 'Clips', clips: clipsToGroup });
    }

    return groups;
  });

  function getDateLabel(timestamp: number): string {
    const d = new Date(timestamp * 1000);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const clipDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (clipDate.getTime() === today.getTime()) return 'Today';
    if (clipDate.getTime() === yesterday.getTime()) return 'Yesterday';

    return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

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

  // Reset to first page when clips change or filters change
  watch([clips, searchQuery, sortBy, statusFilter, projectFilter], () => {
    currentPage.value = 1;
  });

  async function loadClips() {
    loading.value = true;
    try {
      // Load all clips
      clips.value = await getAllClips();

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

        // Recursively load parent if exists
        if (project.parent_id) {
          await getProjectInfo(project.parent_id);
        }
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
      case 'completed': // Handle potential 'completed' status same as generated
        return 'bg-emerald-600 text-white border-emerald-500 shadow-sm font-medium';
      case 'detected':
        return 'bg-amber-400 text-black border-amber-500 shadow-sm font-medium';
      case 'processing':
        return 'bg-blue-600 text-white border-blue-500 shadow-sm font-medium';
      default:
        return 'bg-gray-600 text-gray-100 border-gray-500 shadow-sm';
    }
  }

  function getProjectName(projectId: string): string | null {
    const project = projectCache.value.get(projectId);
    return project?.name || null;
  }

  function getClipStatusText(status: string | null): string {
    switch (status) {
      case 'generated':
      case 'completed':
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
