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

            <!-- Project Filter (only in list view) -->
            <CustomDropdown
              v-if="viewMode === 'list'"
              v-model="projectFilter"
              :options="projectOptions"
              placeholder="Project"
              class="w-[160px]"
            />

            <!-- Sort Filter -->
            <CustomDropdown v-model="sortBy" :options="sortOptions" placeholder="Sort By" class="w-[170px]" />

            <!-- View Mode -->
            <div class="bg-muted/50 rounded-md p-1 flex items-center gap-1">
              <button
                @click="viewMode = 'folders'"
                :class="[
                  'p-2 rounded transition-colors',
                  viewMode === 'folders'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                ]"
                title="Folder View"
              >
                <Folder class="h-4 w-4" />
              </button>
              <button
                @click="viewMode = 'list'"
                :class="[
                  'p-2 rounded transition-colors',
                  viewMode === 'list'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                ]"
                title="List View"
              >
                <List class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Clips Grid -->
        <div v-if="filteredClips.length > 0" class="space-y-8">
          <!-- List View -->
          <div v-if="viewMode === 'list'" class="space-y-8">
            <div v-for="group in groupedClips" :key="group.dateLabel" class="space-y-4">
              <!-- Date Header -->
              <h3 class="text-sm font-medium text-muted-foreground border-b border-border pb-2">
                {{ group.dateLabel }}
              </h3>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <ClipCard
                  v-for="clip in group.clips"
                  :key="clip.id"
                  :clip="clip"
                  :thumbnail-url="getThumbnailUrl(clip)"
                  :project-name="clip.project_id ? getProjectName(clip.project_id) : null"
                  @play="playClip"
                  @delete="confirmDelete"
                />
              </div>
            </div>
          </div>

          <!-- Folder View -->
          <div v-else-if="viewMode === 'folders'" class="space-y-8">
            <div v-for="dateGroup in groupedFolderProjects" :key="dateGroup.dateLabel" class="space-y-4">
              <h3 class="text-sm font-medium text-muted-foreground border-b border-border pb-2">
                {{ dateGroup.dateLabel }}
              </h3>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div
                  v-for="group in dateGroup.folders"
                  :key="group.id"
                  class="relative bg-card rounded-md overflow-hidden cursor-pointer group aspect-video hover:scale-102 transition-all border border-border shadow-sm"
                  @click="openFolder(group)"
                >
                  <!-- Thumbnail -->
                  <div
                    v-if="group.clips.length > 0 && getThumbnailUrl(group.clips[0])"
                    class="absolute inset-0 z-0"
                    :style="{
                      backgroundImage: `url(${getThumbnailUrl(group.clips[0])})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }"
                  >
                    <div class="absolute inset-0 bg-gradient-to-br from-black/50 via-black/20 to-black/60"></div>
                  </div>
                  <div v-else class="absolute inset-0 z-0 bg-muted flex items-center justify-center">
                    <Folder class="h-16 w-16 text-muted-foreground/50" />
                  </div>

                  <!-- Count Badge -->
                  <div
                    class="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-blue-600/90 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-sm"
                  >
                    <FolderOpen class="w-3 h-3" />
                    <span>{{ group.clips.length }} Clips</span>
                  </div>

                  <!-- Bottom Info -->
                  <div class="absolute bottom-2 left-2 right-2 z-5 bg-black/40 backdrop-blur-sm p-2 rounded-md">
                    <h3 class="text-md font-semibold text-white mb-1 line-clamp-1">{{ group.name }}</h3>
                    <p class="text-xs text-white/80">Updated {{ getRelativeTime(group.updatedAt) }}</p>
                  </div>
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
      v-if="!loading && filteredClips.length > 0 && viewMode === 'list'"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total-items="filteredClips.length"
      item-label="clip"
      @go-to-page="goToPage"
      @previous="previousPage"
      @next="nextPage"
    />
    <!-- Folder Contents Dialog -->
    <div
      v-if="showFolderDialog && folderProject"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showFolderDialog = false"
    >
      <div
        class="bg-card rounded-lg w-full mx-4 border border-border flex flex-col overflow-hidden shadow-2xl transition-all duration-200 max-h-[80vh]"
        :class="{
          'max-w-lg': paginatedFolderClips.length <= 1,
          'max-w-3xl': paginatedFolderClips.length === 2,
          'max-w-5xl': paginatedFolderClips.length >= 3,
        }"
      >
        <!-- Header -->
        <div class="py-2 px-3 border-b border-border flex items-center justify-between bg-black/30">
          <div class="flex items-center justify-center gap-2.5">
            <div class="bg-primary/10 p-1.5 rounded-md">
              <FolderOpen class="h-4 w-4 text-primary" />
            </div>
            <h2 class="text-md font-medium text-foreground -mt-1">{{ folderProject.name }}</h2>
          </div>
          <button
            @click="showFolderDialog = false"
            class="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-8">
          <div v-for="group in groupedFolderClips" :key="group.dateLabel" class="space-y-4">
            <!-- Date Header -->
            <h3 class="text-sm font-medium text-muted-foreground border-b border-border pb-2">
              {{ group.dateLabel }}
            </h3>

            <div
              class="grid gap-5"
              :class="{
                'grid-cols-1': group.clips.length === 1 && groupedFolderClips.length === 1,
                'grid-cols-1 md:grid-cols-2':
                  (group.clips.length === 2 && groupedFolderClips.length === 1) ||
                  (paginatedFolderClips.length > 1 && paginatedFolderClips.length <= 4),
                'grid-cols-1 md:grid-cols-2 lg:grid-cols-3':
                  paginatedFolderClips.length >= 5 || groupedFolderClips.length > 1,
              }"
            >
              <ClipCard
                v-for="clip in group.clips"
                :key="clip.id"
                :clip="clip"
                :thumbnail-url="getThumbnailUrl(clip)"
                :project-name="null"
                @play="playClip"
                @delete="confirmDelete"
              />
            </div>
          </div>
        </div>

        <!-- Footer with Pagination -->
        <div v-if="folderTotalPages > 1" class="bg-muted/10">
          <PaginationFooter
            :current-page="folderCurrentPage"
            :total-pages="folderTotalPages"
            :total-items="folderProject.clips.length"
            item-label="clip"
            mode="static"
            @go-to-page="(page) => (folderCurrentPage = page)"
            @previous="folderCurrentPage--"
            @next="folderCurrentPage++"
          />
        </div>
      </div>
    </div>

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
  import { LayoutGrid, Folder, Play, Trash2, Video, Search, X, List, FolderOpen } from 'lucide-vue-next';
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
  import ClipCard from '@/components/ClipCard.vue';
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

  // View state
  const viewMode = ref<'folders' | 'list'>('folders');
  const showFolderDialog = ref(false);
  const folderProject = ref<{ id: string; name: string; clips: Clip[] } | null>(null);
  const folderCurrentPage = ref(1);
  const folderItemsPerPage = 12;

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
    return groupClips(paginatedClips.value);
  });

  function groupClips(clipsToGroup: Clip[]) {
    // If we are sorting by name or duration, skip date grouping
    if (sortBy.value.startsWith('name') || sortBy.value.startsWith('duration')) {
      return [{ dateLabel: 'Clips', clips: clipsToGroup }];
    }

    const groups: { dateLabel: string; clips: Clip[] }[] = [];
    let currentLabel = '';
    let currentClips: Clip[] = [];

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
  }

  const groupedByProject = computed(() => {
    const groups = new Map<
      string,
      { id: string; name: string; project: Project | null; clips: Clip[]; updatedAt: number }
    >();
    const uncategorized: Clip[] = [];

    // Use filteredClips so search/filter applies to folder contents/visibility
    for (const clip of filteredClips.value) {
      if (clip.project_id) {
        // Resolve parent
        let projectId = clip.project_id;
        let project = projectCache.value.get(projectId);

        if (project && project.parent_id) {
          const parent = projectCache.value.get(project.parent_id);
          if (parent) {
            projectId = parent.id;
            project = parent;
          }
        }

        if (project) {
          if (!groups.has(projectId)) {
            groups.set(projectId, {
              id: projectId,
              name: project.name,
              project: project,
              clips: [],
              updatedAt: project.updated_at,
            });
          }
          groups.get(projectId)!.clips.push(clip);
        } else {
          uncategorized.push(clip);
        }
      } else {
        uncategorized.push(clip);
      }
    }

    const result = Array.from(groups.values());

    // Determine sorting
    const [field, direction] = sortBy.value.split('-');

    // Add uncategorized if any
    if (uncategorized.length > 0) {
      // Find latest clip date for uncategorized to use as updatedAt
      let maxDate = 0;
      for (const c of uncategorized) {
        if (c.created_at > maxDate) maxDate = c.created_at;
      }

      result.push({
        id: 'uncategorized',
        name: 'Uncategorized',
        project: null,
        clips: uncategorized,
        updatedAt: maxDate,
      });
    }

    // Sort projects
    result.sort((a, b) => {
      if (field === 'name') {
        const res = a.name.localeCompare(b.name);
        return direction === 'asc' ? res : -res;
      } else {
        // Default to date/duration sorting (using updatedAt for projects)
        const timeA = a.updatedAt;
        const timeB = b.updatedAt;
        if (timeA < timeB) return direction === 'asc' ? -1 : 1;
        if (timeA > timeB) return direction === 'asc' ? 1 : -1;
        return 0;
      }
    });

    return result;
  });

  const groupedFolderProjects = computed(() => {
    // If sorting by name, return single group
    if (sortBy.value.startsWith('name')) {
      return [{ dateLabel: 'Projects', folders: groupedByProject.value }];
    }

    const groups: { dateLabel: string; folders: typeof groupedByProject.value }[] = [];
    let currentLabel = '';
    let currentFolders: typeof groupedByProject.value = [];

    for (const folder of groupedByProject.value) {
      const label = getDateLabel(folder.updatedAt);

      if (label !== currentLabel) {
        if (currentLabel) {
          groups.push({ dateLabel: currentLabel, folders: currentFolders });
        }
        currentLabel = label;
        currentFolders = [folder];
      } else {
        currentFolders.push(folder);
      }
    }

    if (currentLabel) {
      groups.push({ dateLabel: currentLabel, folders: currentFolders });
    } else if (groupedByProject.value.length > 0 && groups.length === 0) {
      groups.push({ dateLabel: 'Projects', folders: groupedByProject.value });
    }

    return groups;
  });

  const paginatedFolderClips = computed(() => {
    if (!folderProject.value) return [];
    const startIndex = (folderCurrentPage.value - 1) * folderItemsPerPage;
    return folderProject.value.clips.slice(startIndex, startIndex + folderItemsPerPage);
  });

  const groupedFolderClips = computed(() => {
    return groupClips(paginatedFolderClips.value);
  });

  const folderTotalPages = computed(() => {
    if (!folderProject.value) return 0;
    return Math.ceil(folderProject.value.clips.length / folderItemsPerPage);
  });

  function openFolder(group: { id: string; name: string; clips: Clip[] }) {
    folderProject.value = group;
    folderCurrentPage.value = 1;
    showFolderDialog.value = true;
  }

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
