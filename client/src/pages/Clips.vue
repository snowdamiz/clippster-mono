<template>
  <div class="relative h-full w-full">
    <PageLayout
      title="Built Clips"
      description="Browse and manage your generated video clips"
      :show-header="true"
      :icon="LayoutGrid"
    >
      <template v-if="displayableBuilds.length > 0" #badge>
        <Badge class="tabular">{{ displayableBuilds.length }}</Badge>
      </template>

      <template #actions>
        <Button
          variant="ghost"
          size="icon-sm"
          :disabled="!hasAnyClipsWithFiles"
          :title="hasAnyClipsWithFiles ? 'Open clips folder' : 'No clips available'"
          aria-label="Open clips folder"
          @click="openClipsFolder"
        >
          <FolderOpen />
        </Button>
      </template>

      <template v-if="initialLoading || displayableBuilds.length > 0" #toolbar>
        <SelectionBar
          v-if="totalSelectedCount > 0"
          :count="totalSelectedCount"
          :total="selectAllTotal"
          @clear="clearSelection"
          @select-all="selectAll"
        >
          <Button variant="destructive-soft" size="sm" @click="confirmBulkDelete">
            <Trash2 />
            Delete
          </Button>
        </SelectionBar>

        <div v-else class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <!-- Search (opens the search palette) -->
          <SearchPaletteTrigger
            placeholder="Search clips…"
            :query="searchQuery"
            class="min-w-[140px] max-w-[260px] flex-1"
            @open="openSearchPalette"
            @clear="searchQuery = ''"
          />

          <!-- Untranscribed-only filter chip -->
          <span
            v-if="showOnlyUntranscribed"
            class="inline-flex h-[var(--control-md)] shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border border-brand-line bg-brand-soft pl-2.5 pr-1 text-xs font-medium text-brand"
          >
            <FileText class="size-3.5" />
            Untranscribed only
            <button
              type="button"
              class="grid size-5 place-items-center rounded transition-colors hover:bg-brand-soft"
              aria-label="Show all clips"
              title="Show all clips"
              @click="showOnlyUntranscribed = false"
            >
              <X class="size-3.5" />
            </button>
          </span>

          <div class="w-32 shrink-0">
            <CustomDropdown v-model="statusFilter" :options="statusOptions" placeholder="Status" />
          </div>
          <div v-if="viewMode === 'list' && aspectRatioOptions.length > 2" class="w-28 shrink-0">
            <CustomDropdown v-model="aspectRatioFilter" :options="aspectRatioOptions" placeholder="Ratio" />
          </div>
          <div v-if="viewMode === 'list'" class="w-40 shrink-0">
            <CustomDropdown v-model="projectFilter" :options="projectOptions" placeholder="Project" />
          </div>

          <div class="ml-auto flex shrink-0 items-center gap-2">
            <div class="w-36">
              <CustomDropdown v-model="sortBy" :options="sortOptions" placeholder="Sort by" />
            </div>
            <SegmentedControl v-model="viewMode" :options="viewModeOptions" />
          </div>
        </div>
      </template>

      <div class="flex flex-1 flex-col px-5 py-4">
        <!-- Loading State (first load only; refetches keep the current grid) -->
        <div
          v-if="initialLoading"
          class="skeleton-group card-grid"
          aria-busy="true"
        >
          <div v-for="i in 8" :key="`skeleton-${i}`" class="flex flex-col gap-2">
            <div class="skeleton aspect-video rounded-xl" />
            <div class="skeleton h-3.5 w-3/4" />
            <div class="skeleton h-3 w-1/2" />
          </div>
        </div>

        <template v-else-if="displayableBuilds.length > 0">
          <div v-if="filteredBuilds.length > 0" :key="viewMode" class="flex animate-enter flex-col gap-6">
            <!-- List View - individual builds as cards -->
            <template v-if="viewMode === 'list'">
              <section v-for="group in groupedBuilds" :key="group.dateLabel">
                <SectionHeader :title="group.dateLabel" :count="group.builds.length" class="mb-2" />
                <div class="card-grid">
                  <BuildCard
                    v-for="item in group.builds"
                    :key="item.id"
                    :build="item.build"
                    :clip-name="item.clipName"
                    :thumbnail-url="item.thumbnailUrl"
                    :project-name="item.projectName"
                    :file-path="item.filePath"
                    :display-aspect-ratio="item.aspectRatio ?? undefined"
                    :show-build-number="item.hasMultipleBuilds"
                    selectable
                    :selected="isBuildSelected(item.id)"
                    @toggle-select="toggleBuildSelection(item.id)"
                    @play="
                      (build, filePath) => playBuild(build, filePath || item.filePath, item.clipName, item.projectId)
                    "
                    @save="(build, filePath) => saveBuild(build, filePath || item.filePath)"
                    @delete="() => confirmDeleteBuild(item.build)"
                    @openProject="(build) => openProjectForClip(build, item.clip)"
                    @publish="
                      (build, filePath) => initiatePublish(build, filePath || item.filePath, item.thumbnailUrl, item.clip)
                    "
                  />
                </div>
              </section>
            </template>

            <!-- Folder View - one tile per project -->
            <template v-else-if="viewMode === 'folders'">
              <section v-for="dateGroup in groupedFolderProjects" :key="dateGroup.dateLabel">
                <SectionHeader :title="dateGroup.dateLabel" :count="dateGroup.folders.length" class="mb-2" />
                <div class="card-grid">
                  <MediaTile
                    v-for="group in dateGroup.folders"
                    :key="group.id"
                    :title="group.name"
                    :thumbnail="group.clips.length > 0 ? getThumbnailUrl(group.clips[0]) : null"
                    :icon="Folder"
                    :meta="[
                      `${getFolderBuildsCount(group.clips)} clip${getFolderBuildsCount(group.clips) !== 1 ? 's' : ''}`,
                      `Updated ${getRelativeTime(group.updatedAt)}`,
                    ]"
                    selectable
                    :selected="isFolderSelected(group.id)"
                    @open="openFolder(group)"
                    @toggle-select="toggleFolderSelection(group.id)"
                  >
                    <template v-if="hasUntranscribedClips(group.clips)" #badges>
                      <Badge class="border-transparent bg-black/70 text-warning" title="Contains clips without transcripts">
                        <FileText />
                        Untranscribed
                      </Badge>
                    </template>
                  </MediaTile>
                </div>
              </section>
            </template>
          </div>

          <!-- No Results State -->
          <EmptyState
            v-else
            :icon="Search"
            title="No builds found"
            description="No builds match your search or filters. Try adjusting them."
          >
            <Button variant="secondary" @click="clearFilters">Clear filters</Button>
          </EmptyState>
        </template>

        <!-- Empty State -->
        <EmptyState
          v-else
          :icon="Video"
          title="No builds yet"
          description="Build your first video clip from a project to see it here."
        />
      </div>

      <!-- Pagination Footer -->
      <PaginationFooter
        v-if="!initialLoading && filteredBuilds.length > 0 && viewMode === 'list'"
        :current-page="currentPage"
        :total-pages="totalPages"
        :total-items="filteredBuilds.length"
        item-label="build"
        @go-to-page="goToPage"
        @previous="previousPage"
        @next="nextPage"
      />
    </PageLayout>

    <!-- Folder Contents Dialog -->
    <Modal
      :open="showFolderDialog && !!folderProject && !showWorkspaceDialog && !showSimplifiedPublishDialog"
      size="xl"
      :icon="FolderOpen"
      :title="folderProject?.name"
      :description="`${folderBuilds.length} file${folderBuilds.length !== 1 ? 's' : ''}`"
      flush
      :footer-class="selectedFolderDialogBuilds.size === 0 ? 'block border-t-0 p-0' : undefined"
      @close="showFolderDialog = false"
    >
      <template v-if="folderAspectRatioOptions.length > 2" #header-actions>
        <SegmentedControl v-model="folderAspectRatioFilter" size="sm" :options="folderAspectRatioSegments" />
      </template>

      <div :key="folderAspectRatioFilter" class="flex animate-enter flex-col gap-4 px-3 pb-4 pt-2">
        <section v-for="group in groupedFolderBuilds" :key="group.dateLabel">
          <SectionHeader :title="group.dateLabel" variant="eyebrow" class="mb-1 px-2" />

          <div class="flex flex-col gap-0.5">
            <div
              v-for="item in group.builds"
              :key="item.id"
              class="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors"
              :class="isFolderDialogBuildSelected(item.id) ? 'bg-brand-soft' : 'hover:bg-surface-hover'"
            >
              <Checkbox
                :model-value="isFolderDialogBuildSelected(item.id)"
                aria-label="Select build"
                @update:model-value="toggleFolderDialogBuildSelection(item.id)"
              />

              <!-- Thumbnail -->
              <button
                type="button"
                class="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-surface-sunken"
                :title="`Play ${item.clipName}`"
                @click="playBuild(item.build, item.filePath, item.clipName, item.projectId)"
              >
                <img
                  v-if="item.thumbnailUrl"
                  :src="item.thumbnailUrl"
                  :alt="item.clipName"
                  class="size-full object-cover"
                />
                <span v-else class="absolute inset-0 grid place-items-center text-fg-subtle">
                  <Video class="size-5" />
                </span>
                <span
                  v-if="item.build.status === 'building'"
                  class="absolute inset-0 grid place-items-center bg-black/60 text-white"
                >
                  <Loader2 class="size-5 animate-spin" />
                </span>
                <span
                  v-if="item.build.duration"
                  class="tabular absolute bottom-1 right-1 rounded bg-black/70 px-1 text-2xs font-medium leading-4 text-white"
                >
                  {{ formatDuration(item.build.duration) }}
                </span>
              </button>

              <!-- Content -->
              <button
                type="button"
                class="min-w-0 flex-1 text-left"
                @click="playBuild(item.build, item.filePath, item.clipName, item.projectId)"
              >
                <p class="truncate text-sm font-medium text-fg">{{ item.clipName }}</p>
                <div class="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <Badge v-if="item.build.status === 'building'" variant="brand">
                    <Loader2 class="animate-spin" />
                    Building…
                  </Badge>
                  <Badge v-if="item.aspectRatio" class="tabular">{{ item.aspectRatio }}</Badge>
                  <Badge v-if="item.hasMultipleBuilds" class="tabular">#{{ item.build.build_number }}</Badge>
                  <Badge
                    v-if="folderAspectRatioFilter !== 'all' && getBuildSiblingCount(item.build.id) > 1"
                    :title="`This build has ${getBuildSiblingCount(item.build.id)} aspect ratio variants`"
                  >
                    <Ratio />
                    {{ getBuildSiblingCount(item.build.id) }}
                  </Badge>
                  <Badge
                    v-if="item.build.is_published"
                    variant="success"
                    :title="item.build.published_at ? `Published ${getRelativeTime(item.build.published_at)}` : 'Published'"
                  >
                    <Check />
                    Published
                  </Badge>
                  <span class="text-xs text-fg-subtle">{{ getRelativeTime(item.build.created_at) }}</span>
                </div>
              </button>

              <!-- Actions -->
              <div class="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Play"
                  aria-label="Play"
                  @click="playBuild(item.build, item.filePath, item.clipName, item.projectId)"
                >
                  <Play />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Download"
                  aria-label="Download"
                  @click="saveBuild(item.build, item.filePath)"
                >
                  <Download />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon-sm" title="More actions" aria-label="More actions">
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-52">
                    <DropdownMenuItem @click="openProjectForClip(item.build, item.clip)">
                      <ExternalLink />
                      Open in project
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      v-if="item.videoEditorProjectId"
                      @click="openVideoEditorProject(item.videoEditorProjectId)"
                    >
                      <Film />
                      Open in video editor
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="initiatePublish(item.build, item.filePath, item.thumbnailUrl, item.clip)">
                      <Share2 />
                      Publish
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="router.push(`/design-studio/edit?coverForClip=${item.clip.id}`)">
                      <Paintbrush />
                      Design cover
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      class="text-danger focus:bg-danger-soft [&>svg]:!text-danger"
                      @click="confirmDeleteBuild(item.build)"
                    >
                      <Trash2 />
                      Delete build
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </section>
      </div>

      <template v-if="selectedFolderDialogBuilds.size > 0 || folderTotalPages > 1" #footer>
        <template v-if="selectedFolderDialogBuilds.size > 0">
          <span class="tabular mr-auto text-sm font-medium text-fg">
            {{ selectedFolderDialogBuilds.size }} selected
          </span>
          <Button variant="ghost" @click="clearFolderDialogBuildSelection">Clear</Button>
          <Button variant="destructive" @click="confirmBulkDeleteFolderDialogBuilds">
            <Trash2 />
            Delete {{ selectedFolderDialogBuilds.size }}
          </Button>
        </template>
        <PaginationFooter
          v-else
          :current-page="folderCurrentPage"
          :total-pages="folderTotalPages"
          :total-items="folderBuilds.length"
          item-label="build"
          mode="static"
          @go-to-page="(page) => (folderCurrentPage = page)"
          @previous="folderCurrentPage--"
          @next="folderCurrentPage++"
        />
      </template>
    </Modal>

    <!-- Video Player Dialog -->
    <VideoPlayerDialog
      :video="clipToPlay"
      :show-video-player="showVideoPlayer"
      :watermark-settings="playerWatermarkSettings"
      :z-index="10000"
      @close="showVideoPlayer = false"
    />

    <!-- Project Workspace Dialog -->
    <ProjectWorkspaceDialog
      v-model="showWorkspaceDialog"
      :project="workspaceProject"
      :initial-clip-id="workspaceInitialClipId"
    />

    <!-- Delete Build Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteBuildDialog"
      title="Delete build"
      :message="'Are you sure you want to delete build'"
      :item-name="buildToDelete ? buildToDelete.clipName : 'this build'"
      suffix="? The video file will be permanently removed."
      confirm-text="Delete build"
      variant="destructive"
      @close="handleDeleteBuildDialogClose"
      @confirm="deleteBuildConfirmed"
    />

    <!-- Bulk Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showBulkDeleteDialog"
      :title="bulkDeleteTitle"
      message="Are you sure you want to delete"
      :item-name="bulkDeleteItemName"
      suffix="? The video files will be permanently removed."
      :confirm-text="bulkDeleteConfirmText"
      variant="destructive"
      @close="handleBulkDeleteDialogClose"
      @confirm="bulkDeleteConfirmed"
    />

    <!-- Bulk Delete Folder Dialog Builds Confirmation Modal -->
    <ConfirmationModal
      :show="showBulkDeleteFolderDialogBuildsDialog"
      :title="`Delete ${selectedFolderDialogBuilds.size} build${selectedFolderDialogBuilds.size !== 1 ? 's' : ''}`"
      :message="`Are you sure you want to delete`"
      :item-name="`${selectedFolderDialogBuilds.size} build${selectedFolderDialogBuilds.size !== 1 ? 's' : ''}`"
      suffix="? The video files will be permanently removed."
      :confirm-text="`Delete ${selectedFolderDialogBuilds.size} build${selectedFolderDialogBuilds.size !== 1 ? 's' : ''}`"
      variant="destructive"
      @close="handleBulkDeleteFolderDialogBuildsDialogClose"
      @confirm="bulkDeleteFolderDialogBuildsConfirmed"
    />

    <!-- Simplified Publish Dialog -->
    <SimplifiedPublishDialog
      v-if="publishingBuild?.build"
      v-model="showSimplifiedPublishDialog"
      :clip="publishingBuild.clip || null"
      :build="publishingBuild.build"
      :file-path="publishingBuild.filePath"
      :thumbnail-url="publishingBuild.thumbnailUrl"
      @close="onPublishDialogClose"
    />

    <!-- Uploading Media -->
    <Modal :open="isUploadingMedia" size="sm" :dismissible="false" hide-close>
      <div class="flex flex-col items-center gap-2 py-4 text-center">
        <Loader2 class="mb-1 size-6 animate-spin text-brand" />
        <p class="text-sm font-medium text-fg">Uploading video…</p>
        <p class="text-xs text-fg-muted">Please wait while we prepare your clip</p>
      </div>
    </Modal>

    <!-- Search Palette Modal -->
    <SearchPalette
      v-model="showSearchPalette"
      :search-query="paletteSearchQuery"
      :active-tab="paletteViewMode"
      :placeholder="
        paletteViewMode === 'untranscribed'
          ? 'Filter untranscribed clips...'
          : 'Search clips by name, project, or transcript...'
      "
      :tabs="clipsPaletteTabs"
      @update:search-query="paletteSearchQuery = $event"
      @update:active-tab="onPaletteTabChange"
      @close="closeSearchPalette"
    >
      <!-- Search Mode -->
      <template v-if="paletteViewMode === 'search'">
        <!-- Untranscribed info (when searching) -->
        <div
          v-if="untranscribedClipsCount > 0 && paletteSearchQuery"
          class="flex items-center gap-2 border-b border-line-subtle px-4 py-2 text-xs text-fg-muted"
        >
          <AlertCircle class="size-3.5 shrink-0 text-warning" />
          <span class="min-w-0 flex-1">
            {{ untranscribedClipsCount }} clip{{ untranscribedClipsCount !== 1 ? 's' : '' }} without transcripts won't
            appear in transcript search
          </span>
          <Button variant="link" size="xs" @click="showUntranscribedClips">View</Button>
        </div>

        <!-- Search Results -->
        <div v-if="paletteSearchQuery && paletteSearchResults.length > 0" class="p-2">
          <SectionHeader title="Results" variant="eyebrow" class="px-2">
            <span class="tabular text-xs text-fg-subtle">{{ paletteSearchResults.length }} found</span>
          </SectionHeader>
          <BuildPaletteItem
            v-for="item in paletteSearchResults"
            :key="item.id"
            :title="item.clipName"
            :project-name="item.projectName"
            :thumbnail-url="item.thumbnailUrl"
            :untranscribed="!item.isTranscribed"
            :tag="item.matchType === 'transcript' ? 'transcript' : null"
            @select="selectSearchResult(item)"
          />
        </div>

        <!-- No Search Results -->
        <EmptyState
          v-else-if="paletteSearchQuery && paletteSearchResults.length === 0"
          size="sm"
          :icon="Search"
          title="No clips found"
          description="Try a different search term or check untranscribed clips"
        />

        <!-- Initial State -->
        <EmptyState
          v-else
          size="sm"
          :icon="Search"
          title="Search your clips"
          description="Find clips by name, project, or transcript content"
        />
      </template>

      <!-- Untranscribed Mode -->
      <template v-else-if="paletteViewMode === 'untranscribed'">
        <div v-if="paletteUntranscribedClips.length > 0" class="p-2">
          <SectionHeader title="Clips without transcripts" variant="eyebrow" class="px-2">
            <span class="tabular text-xs text-fg-subtle">
              {{ paletteUntranscribedClips.length }} clip{{ paletteUntranscribedClips.length !== 1 ? 's' : '' }}
            </span>
          </SectionHeader>
          <BuildPaletteItem
            v-for="item in paletteUntranscribedClips"
            :key="item.id"
            :title="item.clipName"
            :project-name="item.projectName"
            :thumbnail-url="item.thumbnailUrl"
            untranscribed
            @select="selectSearchResult(item)"
          />
        </div>

        <!-- No Untranscribed Clips -->
        <EmptyState
          v-else
          size="sm"
          :icon="Check"
          tone="success"
          title="All clips transcribed"
          description="All your clips have transcripts and can be searched"
        />
      </template>

      <!-- Footer for untranscribed mode -->
      <template #footer v-if="paletteViewMode === 'untranscribed' && paletteUntranscribedClips.length > 0">
        <Button variant="secondary" block @click="applyUntranscribedFilter">
          <FileText />
          Show only untranscribed in main view
        </Button>
      </template>
    </SearchPalette>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, computed, watch } from 'vue';
  import { invoke } from '@tauri-apps/api/core';
  import { formatDate } from '@/utils/dateTimeUtils';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import { save } from '@tauri-apps/plugin-dialog';
  import { useRouter } from 'vue-router';
  import {
    LayoutGrid,
    Folder,
    Video,
    Search,
    X,
    List,
    FolderOpen,
    Check,
    Trash2,
    Ratio,
    FileText,
    AlertCircle,
    Play,
    Download,
    Share2,
    Loader2,
    ExternalLink,
    Film,
    MoreVertical,
    Paintbrush,
  } from 'lucide-vue-next';
  import {
    getAllClipsWithBuilds,
    deleteClipBuild,
    deleteClip,
    getThumbnailByClipId,
    getProject,
    getRawVideosByProjectId,
    getCreatorProfileByProjectId,
    searchTranscriptSegmentsByClipIds,
    getClipIdsWithTranscripts,
    getVideoEditorProjectsForClip,
    type Clip,
    type ClipBuild,
    type Project,
    type RawVideo,
  } from '@/services/database';
  import type { WatermarkSettings } from '@/types';
  import { useToast } from '@/composables/useToast';
  import { getStoragePath } from '@/services/storage';
  import { useFormatters } from '@/composables/useFormatters';
  import { useAuthStore } from '@/stores/auth';
  import { useClipThumbnailStore } from '@/stores/clipThumbnails';
  import { persistentCache } from '@/utils/persistentCache';
  import PageLayout from '@/components/PageLayout.vue';
  import VideoPlayerDialog from '@/components/VideoPlayerDialog.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import BuildCard from '@/components/BuildCard.vue';
  import ProjectWorkspaceDialog from '@/components/ProjectWorkspaceDialog.vue';
  import SimplifiedPublishDialog from '@/components/SimplifiedPublishDialog.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { MediaTile } from '@/components/ui/media-tile';
  import { SelectionBar } from '@/components/ui/selection-bar';
  import BuildPaletteItem from '@/components/builds/BuildPaletteItem.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import SearchPalette, { type SearchPaletteTab } from '@/components/SearchPalette.vue';
  import SearchPaletteTrigger from '@/components/SearchPaletteTrigger.vue';
  import {
    uploadMediaForPost,
    getMyAssignedCreatorProfiles,
    type AssignedCreatorProfile,
  } from '@/services/socialAccountsApi';
  import { uploadUserMediaForPost } from '@/services/userInstagramApi';

  type ClipWithBuilds = Clip & { builds: ClipBuild[] };

  // A displayable item represents a single output file from a build
  // Builds with multiple aspect ratios are expanded into multiple DisplayableBuild items
  interface DisplayableBuild {
    id: string; // Unique ID for this displayable item (buildId + fileIndex for multi-file builds)
    build: ClipBuild;
    clip: ClipWithBuilds;
    clipName: string;
    projectName: string | null;
    projectId: string | null;
    thumbnailUrl: string | null;
    createdAt: number; // For sorting - use build completion time
    videoEditorProjectId?: string | null; // ID of video editor project containing this clip
    /** The specific file path for this item (may differ from build.file_path for multi-file builds) */
    filePath: string;
    /** The aspect ratio for this specific file (extracted from filename) */
    aspectRatio: string | null;
    /** Whether this clip has multiple builds (to show/hide build number badge) */
    hasMultipleBuilds: boolean;
    /** Whether the clip has a transcript */
    isTranscribed?: boolean;
    /** Match type for search results */
    matchType?: 'transcript' | 'name';
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

  const clips = ref<ClipWithBuilds[]>([]);
  const loading = ref(true);
  // Skeletons only on the first load; refetches (after deletes, publishes) keep the grid on screen.
  const initialLoading = computed(() => loading.value && displayableBuilds.value.length === 0);
  const showVideoPlayer = ref(false);
  const clipToPlay = ref<RawVideo | null>(null);
  const playerWatermarkSettings = ref<WatermarkSettings | null>(null);
  const thumbnailStore = useClipThumbnailStore();
  const rawVideoCache = ref<Map<string, (RawVideo & { thumbnail_path: string | null })[]>>(new Map());
  const projectCache = ref<Map<string, Project>>(new Map());
  const { getRelativeTime, formatDuration } = useFormatters();
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  // Build deletion state
  const showDeleteBuildDialog = ref(false);
  const buildToDelete = ref<DisplayableBuild | null>(null);

  // View state
  const viewMode = ref<'folders' | 'list'>('list');
  const showFolderDialog = ref(false);
  const folderProject = ref<{ id: string; name: string; clips: ClipWithBuilds[] } | null>(null);
  const folderCurrentPage = ref(1);
  const folderItemsPerPage = 12;
  const folderAspectRatioFilter = ref<string>('all');

  // Multi-select state
  const selectedBuilds = ref<Set<string>>(new Set());
  const selectedFolders = ref<Set<string>>(new Set());
  const showBulkDeleteDialog = ref(false);
  const selectedFolderDialogBuilds = ref<Set<string>>(new Set());
  const showBulkDeleteFolderDialogBuildsDialog = ref(false);

  // Project workspace dialog state
  const showWorkspaceDialog = ref(false);
  const workspaceProject = ref<Project | null>(null);
  const workspaceInitialClipId = ref<string | null>(null);

  // Publish state
  const authStore = useAuthStore();
  const router = useRouter();
  const showSimplifiedPublishDialog = ref(false);
  const showYoutubePublishDialog = ref(false);
  const selectedPlatform = ref<'instagram' | 'twitter' | 'tiktok' | 'youtube'>('instagram');
  const publishingBuild = ref<{ build: ClipBuild; clip: ClipWithBuilds | null; filePath: string; thumbnailUrl: string | null } | null>(null);
  const selectedOrganization = ref<{ id: string | number; name: string; role: string } | null>(null);
  const publishMediaUrl = ref('');
  const publishThumbnailUrl = ref('');
  const publishCreatorProfiles = ref<{ id: number; name: string }[]>([]);
  const publishCreatorProfileId = ref<number | undefined>(undefined);
  const publishCampaignId = ref<number | undefined>(undefined);
  const isUploadingMedia = ref(false);

  // Filter state
  const searchQuery = ref('');
  const sortBy = ref('created-desc');
  const statusFilter = ref('all');
  const projectFilter = ref('all');
  const aspectRatioFilter = ref('all');
  const clipIdsWithTranscriptMatch = ref<Set<string>>(new Set());
  const clipIdsWithTranscripts = ref<Set<string>>(new Set());

  // Search palette state
  const showSearchPalette = ref(false);
  const paletteSearchQuery = ref('');
  const showOnlyUntranscribed = ref(false);
  const paletteViewMode = ref<'search' | 'untranscribed'>('search');

  // Video editor project tracking (clipId -> videoEditorProjectId)
  const clipVideoEditorProjects = ref<Map<string, string>>(new Map());

  // Computed tabs for search palette
  const clipsPaletteTabs = computed((): SearchPaletteTab[] => [
    { id: 'search', label: 'Search All', icon: Search },
    {
      id: 'untranscribed',
      label: 'Untranscribed',
      icon: FileText,
      badge: untranscribedClipsCount.value > 0 ? untranscribedClipsCount.value : undefined,
    },
  ]);

  function onPaletteTabChange(tabId: string) {
    paletteViewMode.value = tabId as 'search' | 'untranscribed';
    paletteSearchQuery.value = '';
  }

  const statusOptions = [
    { label: 'All statuses', value: 'all' },
    { label: 'Generated', value: 'generated' },
    { label: 'Processing', value: 'processing' },
  ];

  const projectOptions = computed(() => {
    const projects = new Map<string, string>();
    // Collect all unique projects from clips (including deleted projects via project_name)
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
        } else if (clip.project_name) {
          // Project no longer exists, use stored project_name
          const deletedProjectKey = `deleted:${clip.project_name}`;
          projects.set(deletedProjectKey, clip.project_name);
        }
      } else if (clip.project_name) {
        // Clip has stored project_name from a deleted project
        const deletedProjectKey = `deleted:${clip.project_name}`;
        projects.set(deletedProjectKey, clip.project_name);
      }
    });

    const options = Array.from(projects.entries())
      .map(([id, name]) => ({
        label: name,
        value: id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [{ label: 'All projects', value: 'all' }, ...options];
  });

  const sortOptions = [
    { label: 'Newest first', value: 'created-desc' },
    { label: 'Oldest first', value: 'created-asc' },
    { label: 'Name A–Z', value: 'name-asc' },
    { label: 'Name Z–A', value: 'name-desc' },
    { label: 'Longest first', value: 'duration-desc' },
    { label: 'Shortest first', value: 'duration-asc' },
  ];

  const viewModeOptions: SegmentedOption<'folders' | 'list'>[] = [
    { value: 'folders', icon: Folder, title: 'Folder view' },
    { value: 'list', icon: List, title: 'List view' },
  ];

  // Get unique aspect ratios available across all builds
  const aspectRatioOptions = computed(() => {
    const ratios = new Set<string>();
    for (const build of displayableBuilds.value) {
      if (build.aspectRatio) {
        ratios.add(build.aspectRatio);
      }
    }
    const options = [{ label: 'All ratios', value: 'all' }];
    // Sort ratios in a logical order
    const sortOrder = ['16:9', '9:16', '4:5', '1:1', '4:3', '3:4', '21:9'];
    const sortedRatios = Array.from(ratios).sort((a, b) => {
      const aIdx = sortOrder.indexOf(a);
      const bIdx = sortOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
    for (const ratio of sortedRatios) {
      options.push({ label: ratio, value: ratio });
    }
    return options;
  });

  // Debounced transcript search
  const transcriptSearchTimeoutId = ref<number | null>(null);

  async function performTranscriptSearch(query: string) {
    if (!query.trim()) {
      clipIdsWithTranscriptMatch.value.clear();
      return;
    }

    // Get all unique clip IDs from displayable builds
    const clipIds = [...new Set(displayableBuilds.value.map((b) => b.clip.id))];

    try {
      const matchedClipIds = await searchTranscriptSegmentsByClipIds(query, clipIds);
      clipIdsWithTranscriptMatch.value = new Set(matchedClipIds);
    } catch (error) {
      console.error('Failed to search transcripts:', error);
      clipIdsWithTranscriptMatch.value.clear();
    }
  }

  // Debounce transcript search to avoid excessive database queries
  function debouncedTranscriptSearch(query: string) {
    if (transcriptSearchTimeoutId.value !== null) {
      clearTimeout(transcriptSearchTimeoutId.value);
    }

    transcriptSearchTimeoutId.value = window.setTimeout(() => {
      performTranscriptSearch(query);
    }, 300) as unknown as number; // 300ms debounce
  }

  // Pagination state
  const currentPage = ref(1);
  const clipsPerPage = 20;

  // Computed property to check if any builds exist
  const hasAnyClipsWithFiles = computed(() => {
    return displayableBuilds.value.length > 0;
  });

  // Transform clips into displayable builds (each output file becomes its own card)
  // Builds with multiple aspect ratios are expanded into separate items
  const displayableBuilds = computed((): DisplayableBuild[] => {
    const builds: DisplayableBuild[] = [];

    for (const clip of clips.value) {
      // Get clip metadata
      const clipName = clip.name || 'Untitled Clip';
      const projectName = getClipProjectName(clip);
      const clipThumbnailUrl = getThumbnailUrl(clip);

      // Count completed builds for this clip
      const completedBuildsCount = clip.builds?.filter((b) => b.status === 'completed').length || 0;
      const hasMultipleBuilds = completedBuildsCount > 1;

      // Handle video editor exports (source='video_editor') - they don't have clip_builds
      if ((clip as any).source === 'video_editor' && clip.build_status === 'completed' && clip.built_file_path) {
        const filePath = clip.built_file_path;
        const aspectRatio = extractAspectRatioFromPath(filePath);
        const thumbnailUrl = thumbnailStore.getBuildThumbnail(filePath) || clipThumbnailUrl;

        // Create a fake build object for video editor exports
        const fakeBuild: ClipBuild = {
          id: clip.id,
          clip_id: clip.id,
          build_number: 1,
          status: 'completed' as const,
          file_path: filePath,
          output_paths: filePath,
          aspect_ratios: aspectRatio || '',
          thumbnail_path: clip.built_thumbnail_path,
          quality: 'high' as const,
          frame_rate: 30,
          output_format: 'mp4' as const,
          include_subtitles: false,
          progress: 100,
          error_message: null,
          file_size: clip.built_file_size,
          duration: clip.built_duration || clip.duration,
          started_at: clip.created_at,
          created_at: clip.created_at,
          completed_at: clip.built_at || clip.created_at,
          // Branding context fields
          organization_id: null,
          organization_name: null,
          campaign_id: null,
          campaign_name: null,
          branding_profile_id: null,
          branding_type: 'personal',
          // Published status
          is_published: false,
          published_at: null,
        };

        builds.push({
          id: clip.id,
          build: fakeBuild,
          clip,
          clipName,
          projectName,
          projectId: clip.project_id,
          thumbnailUrl,
          createdAt: clip.built_at || clip.created_at,
          filePath,
          aspectRatio,
          hasMultipleBuilds: false,
        });
      }
      // If clip has builds, create displayable items for each output file
      else if (clip.builds && clip.builds.length > 0) {
        for (const build of clip.builds) {
          if (build.status === 'completed') {
            // Get all output paths for this build
            const outputPaths = getOutputPathsFromBuild(build);

            if (outputPaths.length === 0) continue;

            // Create a displayable item for each output file
            for (let i = 0; i < outputPaths.length; i++) {
              const filePath = outputPaths[i];
              const aspectRatio = extractAspectRatioFromPath(filePath);

              // Look up thumbnail by file path first (each aspect ratio has its own thumbnail)
              // Then fall back to build's thumbnail_path, then to clip thumbnail
              console.log(`[Clips] Creating displayable build: ${filePath} | AR: ${aspectRatio} | Build#${build.build_number} | Type: ${build.branding_type} | Campaign: ${build.campaign_name || 'null'} | Org: ${build.organization_name || 'null'}`);

              builds.push({
                // Use build ID + index for unique key when multiple files per build
                id: outputPaths.length > 1 ? `${build.id}-${i}` : build.id,
                build,
                clip,
                clipName,
                projectName,
                projectId: clip.project_id,
                thumbnailUrl: thumbnailStore.getBuildThumbnail(filePath) || thumbnailStore.getBuildThumbnail(build.id) || clipThumbnailUrl,
                createdAt: build.completed_at || build.created_at,
                filePath,
                aspectRatio,
                hasMultipleBuilds,
              });
            }
          }
        }
      }
    }

    return builds;
  });

  // Filtered builds (each build is shown as a separate card)
  const filteredBuilds = computed((): DisplayableBuild[] => {
    let result = [...displayableBuilds.value];

    // 0. Filter for untranscribed clips only (if active)
    if (showOnlyUntranscribed.value) {
      // Filter to clips that don't have transcripts (using clipIdsWithTranscripts loaded on mount)
      result = result.filter((item) => !clipIdsWithTranscripts.value.has(item.clip.id));
    }

    // 1. Search Text - now includes transcript search
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      result = result.filter(
        (item) =>
          item.clipName.toLowerCase().includes(query) ||
          (item.projectName && item.projectName.toLowerCase().includes(query)) ||
          clipIdsWithTranscriptMatch.value.has(item.clip.id)
      );
    }

    // 2. Status Filter - builds are always "generated"
    if (statusFilter.value !== 'all' && statusFilter.value !== 'generated') {
      result = [];
    }

    // 3. Project Filter
    if (projectFilter.value !== 'all') {
      result = result.filter((item) => {
        // Handle deleted project filter (starts with "deleted:")
        if (projectFilter.value.startsWith('deleted:')) {
          const deletedProjectName = projectFilter.value.substring(8);
          return item.clip.project_name === deletedProjectName;
        }

        if (!item.projectId) return false;
        // Match if project ID is the selected ID (direct match)
        if (item.projectId === projectFilter.value) return true;

        // Match if project's parent ID is the selected ID (child match)
        const project = projectCache.value.get(item.projectId);
        return project?.parent_id === projectFilter.value;
      });
    }

    // 4. Aspect Ratio Filter
    if (aspectRatioFilter.value !== 'all') {
      result = result.filter((item) => item.aspectRatio === aspectRatioFilter.value);
    }

    // 5. Sorting
    const [field, direction] = sortBy.value.split('-');
    result = [...result].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      if (field === 'created') {
        valA = a.createdAt;
        valB = b.createdAt;
      } else if (field === 'name') {
        valA = a.clipName.toLowerCase();
        valB = b.clipName.toLowerCase();
      } else if (field === 'duration') {
        valA = a.build.duration || 0;
        valB = b.build.duration || 0;
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  });

  // Keep filteredClips for backward compatibility with folder view
  const filteredClips = computed(() => {
    return clips.value.filter((c) => c.status !== 'detected');
  });

  // Pagination computed properties
  const totalPages = computed(() => Math.ceil(filteredBuilds.value.length / clipsPerPage));

  const paginatedBuilds = computed(() => {
    const startIndex = (currentPage.value - 1) * clipsPerPage;
    const endIndex = startIndex + clipsPerPage;
    return filteredBuilds.value.slice(startIndex, endIndex);
  });

  // Group builds by date
  const groupedBuilds = computed(() => {
    return groupBuilds(paginatedBuilds.value);
  });

  function groupBuilds(buildsToGroup: DisplayableBuild[]) {
    // If we are sorting by name or duration, skip date grouping
    if (sortBy.value.startsWith('name') || sortBy.value.startsWith('duration')) {
      return [{ dateLabel: 'Builds', builds: buildsToGroup }];
    }

    const groups: { dateLabel: string; builds: DisplayableBuild[] }[] = [];
    let currentLabel = '';
    let currentBuilds: DisplayableBuild[] = [];

    for (const item of buildsToGroup) {
      const label = getDateLabel(item.createdAt);

      if (label !== currentLabel) {
        if (currentLabel) {
          groups.push({ dateLabel: currentLabel, builds: currentBuilds });
        }
        currentLabel = label;
        currentBuilds = [item];
      } else {
        currentBuilds.push(item);
      }
    }

    if (currentLabel) {
      groups.push({ dateLabel: currentLabel, builds: currentBuilds });
    } else if (buildsToGroup.length > 0 && groups.length === 0) {
      groups.push({ dateLabel: 'Builds', builds: buildsToGroup });
    }

    return groups;
  }

  const groupedByProject = computed(() => {
    const groups = new Map<
      string,
      {
        id: string;
        name: string;
        project: Project | null;
        clips: ClipWithBuilds[];
        updatedAt: number;
        isDeleted?: boolean;
      }
    >();
    const uncategorized: ClipWithBuilds[] = [];

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
          // Project no longer exists in cache, check if clip has stored project_name
          if (clip.project_name) {
            // Use stored project_name to create a group for this deleted project
            const deletedProjectKey = `deleted:${clip.project_name}`;
            if (!groups.has(deletedProjectKey)) {
              groups.set(deletedProjectKey, {
                id: deletedProjectKey,
                name: clip.project_name,
                project: null,
                clips: [],
                updatedAt: clip.created_at,
                isDeleted: true,
              });
            }
            // Update the group's updatedAt to the latest clip date
            const group = groups.get(deletedProjectKey)!;
            if (clip.created_at > group.updatedAt) {
              group.updatedAt = clip.created_at;
            }
            group.clips.push(clip);
          } else {
            uncategorized.push(clip);
          }
        }
      } else if (clip.project_name) {
        // Clip has no project_id but has a stored project_name (project was deleted)
        const deletedProjectKey = `deleted:${clip.project_name}`;
        if (!groups.has(deletedProjectKey)) {
          groups.set(deletedProjectKey, {
            id: deletedProjectKey,
            name: clip.project_name,
            project: null,
            clips: [],
            updatedAt: clip.created_at,
            isDeleted: true,
          });
        }
        // Update the group's updatedAt to the latest clip date
        const group = groups.get(deletedProjectKey)!;
        if (clip.created_at > group.updatedAt) {
          group.updatedAt = clip.created_at;
        }
        group.clips.push(clip);
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
    // Filter out projects with no builds
    const projectsWithBuilds = groupedByProject.value.filter((folder) => getFolderBuildsCount(folder.clips) > 0);

    // If sorting by name, return single group
    if (sortBy.value.startsWith('name')) {
      return [{ dateLabel: 'Projects', folders: projectsWithBuilds }];
    }

    const groups: { dateLabel: string; folders: typeof groupedByProject.value }[] = [];
    let currentLabel = '';
    let currentFolders: typeof groupedByProject.value = [];

    for (const folder of projectsWithBuilds) {
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
    } else if (projectsWithBuilds.length > 0 && groups.length === 0) {
      groups.push({ dateLabel: 'Projects', folders: projectsWithBuilds });
    }

    return groups;
  });

  // Get all builds for the currently open folder (expanded by output files)
  const folderBuildsAll = computed((): DisplayableBuild[] => {
    if (!folderProject.value) return [];

    const builds: DisplayableBuild[] = [];
    for (const clip of folderProject.value.clips) {
      const clipName = clip.name || 'Untitled Clip';
      const clipThumbnailUrl = getThumbnailUrl(clip);

      // Count completed builds for this clip
      const completedBuildsCount = clip.builds?.filter((b) => b.status === 'completed').length || 0;
      const hasMultipleBuilds = completedBuildsCount > 1;

      if (clip.builds && clip.builds.length > 0) {
        for (const build of clip.builds) {
          if (build.status === 'completed') {
            // Get all output paths for this build
            const outputPaths = getOutputPathsFromBuild(build);

            if (outputPaths.length === 0) continue;

            // Create a displayable item for each output file
            for (let i = 0; i < outputPaths.length; i++) {
              const filePath = outputPaths[i];
              const aspectRatio = extractAspectRatioFromPath(filePath);

              builds.push({
                id: outputPaths.length > 1 ? `${build.id}-${i}` : build.id,
                build,
                clip,
                clipName,
                projectName: folderProject.value!.name,
                projectId: clip.project_id,
                thumbnailUrl: thumbnailStore.getBuildThumbnail(filePath) || thumbnailStore.getBuildThumbnail(build.id) || clipThumbnailUrl,
                createdAt: build.completed_at || build.created_at,
                filePath,
                aspectRatio,
                hasMultipleBuilds,
                videoEditorProjectId: clipVideoEditorProjects.value.get(clip.id) || null,
              });
            }
          }
        }
      }
    }

    // Sort by creation date descending
    return builds.sort((a, b) => b.createdAt - a.createdAt);
  });

  // Get unique aspect ratios available in the folder for filter options
  const folderAspectRatioOptions = computed(() => {
    const ratios = new Set<string>();
    for (const build of folderBuildsAll.value) {
      if (build.aspectRatio) {
        ratios.add(build.aspectRatio);
      }
    }
    const options = [{ label: 'All ratios', value: 'all' }];
    // Sort ratios in a logical order
    const sortOrder = ['16:9', '9:16', '4:5', '1:1', '4:3', '3:4', '21:9'];
    const sortedRatios = Array.from(ratios).sort((a, b) => {
      const aIdx = sortOrder.indexOf(a);
      const bIdx = sortOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
    for (const ratio of sortedRatios) {
      options.push({ label: ratio, value: ratio });
    }
    return options;
  });

  // Filtered folder builds based on aspect ratio filter
  const folderBuilds = computed((): DisplayableBuild[] => {
    if (folderAspectRatioFilter.value === 'all') {
      return folderBuildsAll.value;
    }
    return folderBuildsAll.value.filter((b) => b.aspectRatio === folderAspectRatioFilter.value);
  });

  // Aspect ratio filter options for the folder dialog's segmented control
  const folderAspectRatioSegments = computed((): SegmentedOption<string>[] =>
    folderAspectRatioOptions.value.map((option) => ({
      value: option.value,
      label: option.value === 'all' ? 'All' : option.label,
    }))
  );

  // Check if a build has siblings (other aspect ratios from the same build)
  function getBuildSiblingCount(buildId: string): number {
    const baseBuildId = buildId.split('-')[0];
    // Look in the unfiltered list to get total siblings
    return folderBuildsAll.value.filter((b) => b.build.id === baseBuildId).length;
  }

  const paginatedFolderBuilds = computed(() => {
    const startIndex = (folderCurrentPage.value - 1) * folderItemsPerPage;
    return folderBuilds.value.slice(startIndex, startIndex + folderItemsPerPage);
  });

  const groupedFolderBuilds = computed(() => {
    return groupBuilds(paginatedFolderBuilds.value);
  });

  const folderTotalPages = computed(() => {
    return Math.ceil(folderBuilds.value.length / folderItemsPerPage);
  });

  async function openFolder(group: { id: string; name: string; clips: ClipWithBuilds[] }) {
    folderProject.value = group;
    folderCurrentPage.value = 1;
    folderAspectRatioFilter.value = 'all';
    showFolderDialog.value = true;
    
    // Load video editor projects for all clips in the folder
    await loadVideoEditorProjectsForClips(group.clips.map(c => c.id));
  }

  // Load video editor projects for clips
  async function loadVideoEditorProjectsForClips(clipIds: string[]) {
    try {
      // Load in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < clipIds.length; i += batchSize) {
        const batch = clipIds.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (clipId) => {
            try {
              const projects = await getVideoEditorProjectsForClip(clipId);
              if (projects.length > 0) {
                // If clip is in multiple video editor projects, use the first one
                clipVideoEditorProjects.value.set(clipId, projects[0].id);
              }
            } catch (error) {
              console.warn(`[Clips] Failed to load video editor projects for clip ${clipId}:`, error);
            }
          })
        );
      }
      // Trigger reactivity
      clipVideoEditorProjects.value = new Map(clipVideoEditorProjects.value);
    } catch (error) {
      console.warn('[Clips] Failed to load video editor projects:', error);
    }
  }

  // Open video editor with a specific project
  function openVideoEditorProject(projectId: string) {
    // Navigate to video editor page with state to auto-open the project
    router.push({
      path: '/video-editor',
      state: { openProjectId: projectId }
    });
  }

  // Count total output files in a project folder (counts each aspect ratio variant separately)
  function getFolderBuildsCount(clips: ClipWithBuilds[]): number {
    let count = 0;
    for (const clip of clips) {
      if ((clip as any).source === 'video_editor' && clip.build_status === 'completed' && clip.built_file_path) {
        count += 1;
        continue;
      }
      if (clip.builds) {
        for (const build of clip.builds) {
          if (build.status === 'completed') {
            // Count each output file (supports multiple aspect ratios per build)
            const outputPaths = getOutputPathsFromBuild(build);
            count += outputPaths.length;
          }
        }
      }
    }
    return count;
  }

  // Check if any clips in a folder are untranscribed
  function hasUntranscribedClips(clips: ClipWithBuilds[]): boolean {
    // A folder has untranscribed clips if any of its clips don't have transcripts
    return clips.some((clip) => !clipIdsWithTranscripts.value.has(clip.id));
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

    return formatDate(d);
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

  // Reset to first page when clips/builds change or filters change
  watch(
    [
      clips,
      displayableBuilds,
      searchQuery,
      sortBy,
      statusFilter,
      projectFilter,
      aspectRatioFilter,
      showOnlyUntranscribed,
    ],
    () => {
      currentPage.value = 1;
      // Clear transcript matches if search query is empty
      if (!searchQuery.value) {
        clipIdsWithTranscriptMatch.value.clear();
      }
    }
  );

  // Clear selections when switching view mode
  watch(viewMode, () => {
    clearSelection();
  });

  // Clear folder dialog build selection when folder dialog closes
  watch(showFolderDialog, (isOpen) => {
    if (!isOpen) {
      clearFolderDialogBuildSelection();
    }
  });

  // Watch for search query changes and trigger transcript search
  watch(searchQuery, (newQuery) => {
    debouncedTranscriptSearch(newQuery);
  });

  // Folder dialog build multi-select functions
  function toggleFolderDialogBuildSelection(buildId: string, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    if (selectedFolderDialogBuilds.value.has(buildId)) {
      selectedFolderDialogBuilds.value.delete(buildId);
    } else {
      selectedFolderDialogBuilds.value.add(buildId);
    }
    selectedFolderDialogBuilds.value = new Set(selectedFolderDialogBuilds.value);
  }

  function isFolderDialogBuildSelected(buildId: string): boolean {
    return selectedFolderDialogBuilds.value.has(buildId);
  }

  function clearFolderDialogBuildSelection() {
    selectedFolderDialogBuilds.value.clear();
    selectedFolderDialogBuilds.value = new Set(selectedFolderDialogBuilds.value);
  }

  function isVideoEditorDisplayBuild(item: DisplayableBuild): boolean {
    return (item.clip as any).source === 'video_editor';
  }

  async function deleteDisplayableBuild(item: DisplayableBuild): Promise<void> {
    if (isVideoEditorDisplayBuild(item)) {
      await deleteClip(item.clip.id);
    } else {
      await deleteClipBuild(item.build.id);
    }

    const pathToDelete = item.filePath || item.build.file_path;
    if (!pathToDelete) return;

    try {
      await invoke('delete_file', { path: pathToDelete });
    } catch (fileError) {
      console.warn('Could not delete build file:', fileError);
    }
  }

  function confirmBulkDeleteFolderDialogBuilds() {
    if (selectedFolderDialogBuilds.value.size > 0) {
      showBulkDeleteFolderDialogBuildsDialog.value = true;
    }
  }

  function handleBulkDeleteFolderDialogBuildsDialogClose() {
    showBulkDeleteFolderDialogBuildsDialog.value = false;
    selectedFolderDialogBuilds.value.clear();
  }

  async function bulkDeleteFolderDialogBuildsConfirmed() {
    const buildIds = Array.from(selectedFolderDialogBuilds.value);
    let deletedCount = 0;

    try {
      for (const buildId of buildIds) {
        const buildItem = folderBuilds.value.find((b) => b.id === buildId);
        if (!buildItem) continue;

        await deleteDisplayableBuild(buildItem);
        deletedCount++;
      }

      await loadClips();
      showSuccessToast('Builds Deleted', `${deletedCount} build${deletedCount !== 1 ? 's' : ''} deleted successfully.`);
      selectedFolderDialogBuilds.value.clear();

      // If folder dialog is open, refresh its data
      if (showFolderDialog.value && folderProject.value) {
        const currentFolderId = folderProject.value.id;
        const updatedGroup = Array.from(groupedByProject.value.values()).find(g => g.id === currentFolderId);
        
        if (updatedGroup && getFolderBuildsCount(updatedGroup.clips) > 0) {
          // Update the folder project with fresh data
          folderProject.value = updatedGroup;
        } else {
          // No builds left, close the dialog
          showFolderDialog.value = false;
          folderProject.value = null;
        }
      }
    } catch (error) {
      console.error('Failed to delete builds:', error);
      showErrorToast('Delete Failed', 'Failed to delete some builds.');
    }

    showBulkDeleteFolderDialogBuildsDialog.value = false;
  }

  async function loadClips() {
    loading.value = true;
    try {
      // Load all clips with their builds
      clips.value = await getAllClipsWithBuilds();

      // Collect unique project IDs for batch loading
      const uniqueProjectIds = new Set<string>();
      clips.value.forEach(clip => {
        if (clip.project_id) {
          uniqueProjectIds.add(clip.project_id);
        }
      });

      // Start all critical operations in parallel
      await Promise.all([
        // Load which clips have transcripts (for untranscribed detection)
        loadTranscribedClipIds(),
        
        // Lazy load only first batch of clip thumbnails (visible ones)
        // The rest will load on demand via Intersection Observer
        thumbnailStore.loadThumbnailsLazy(clips.value.slice(0, 20), 'high'),
        
        // Batch load all project info in parallel
        Promise.all(Array.from(uniqueProjectIds).map(projectId => getProjectInfo(projectId))),
      ]);

      // Defer non-critical operations (raw videos and build thumbnails) to after initial render
      // This allows the page to show the basic clip list immediately
      setTimeout(() => {
        loadDeferredData(uniqueProjectIds);
      }, 100);

      // Continue loading remaining thumbnails in background
      if (clips.value.length > 20) {
        setTimeout(() => {
          thumbnailStore.loadThumbnailsLazy(clips.value.slice(20), 'low');
        }, 500);
      }
    } catch (error) {
      console.error('Failed to load clips:', error);
    } finally {
      loading.value = false;
    }
  }

  async function loadDeferredData(projectIds: Set<string>) {
    try {
      // Load raw videos for all projects in parallel (batched)
      await Promise.all(
        Array.from(projectIds).map(projectId => loadRawVideosForProject(projectId))
      );

      // Collect all build thumbnail tasks
      const buildThumbnailTasks: Promise<void>[] = [];
      for (const clip of clips.value) {
        if (clip.builds && clip.builds.length > 0) {
          for (const build of clip.builds) {
            if (build.status === 'completed') {
              // Load thumbnails for each output file (each aspect ratio has its own thumbnail)
              const outputPaths = getOutputPathsFromBuild(build);
              for (const outputPath of outputPaths) {
                buildThumbnailTasks.push(loadThumbnailForOutputFile(outputPath));
              }

              // Also load legacy thumbnail_path if available
              if (build.thumbnail_path) {
                buildThumbnailTasks.push(loadBuildThumbnail(build));
              }
            }
          }
        }
      }

      // Load all build thumbnails in parallel batches
      const batchSize = 10;
      for (let i = 0; i < buildThumbnailTasks.length; i += batchSize) {
        const batch = buildThumbnailTasks.slice(i, i + batchSize);
        await Promise.all(batch);
      }
    } catch (error) {
      console.error('Failed to load deferred data:', error);
    }
  }

  async function loadTranscribedClipIds() {
    try {
      const clipIds = clips.value.map((clip) => clip.id);
      if (clipIds.length === 0) {
        clipIdsWithTranscripts.value = new Set();
        return;
      }
      const transcribedIds = await getClipIdsWithTranscripts(clipIds);
      clipIdsWithTranscripts.value = new Set(transcribedIds);
    } catch (error) {
      console.error('Failed to load transcribed clip IDs:', error);
      clipIdsWithTranscripts.value = new Set();
    }
  }

  async function loadRawVideosForProject(projectId: string): Promise<void> {
    // Check memory cache first
    if (rawVideoCache.value.has(projectId)) {
      return;
    }

    // Check persistent cache (30 minutes TTL)
    try {
      const cached = await persistentCache.get<(RawVideo & { thumbnail_path: string | null })[]>(
        'rawVideos',
        projectId
      );
      if (cached && cached.length > 0) {
        rawVideoCache.value.set(projectId, cached);
        return;
      }
    } catch (error) {
      console.warn('Failed to read raw videos from persistent cache:', error);
    }

    try {
      const rawVideos = await getRawVideosByProjectId(projectId);

      // Convert raw video thumbnails to data URLs for caching (batched)
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
      
      // Save to persistent cache (30 minutes TTL)
      persistentCache.set('rawVideos', projectId, processedRawVideos, 1800000).catch(err => {
        console.warn('Failed to save raw videos to persistent cache:', err);
      });
    } catch (error) {
      console.error('Failed to load raw videos for project:', error);
    }
  }

  async function loadClipThumbnail(clip: Clip) {
    // Skip if already in cache
    if (thumbnailStore.hasThumbnail(clip.id)) {
      return;
    }

    try {
      // Try multiple sources for thumbnail in order of preference:
      // 1. Clip's built_thumbnail_path (set by Rust backend during build)
      // 2. Thumbnail from thumbnails table (clip detection thumbnail)

      const thumbnailSources: string[] = [];

      // 1. Clip's built_thumbnail_path (set by Rust backend during build)
      if (clip.built_thumbnail_path) {
        thumbnailSources.push(clip.built_thumbnail_path);
      }

      // 2. Thumbnail from thumbnails table
      const thumbnail = await getThumbnailByClipId(clip.id);
      if (thumbnail && thumbnail.file_path) {
        thumbnailSources.push(thumbnail.file_path);
      }

      // Try each source until one works
      for (const thumbnailPath of thumbnailSources) {
        try {
          const fileExists = await invoke<boolean>('check_file_exists', { path: thumbnailPath });
          if (fileExists) {
            const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: thumbnailPath });
            thumbnailStore.setThumbnail(clip.id, dataUrl);
            return;
          }
        } catch {
          // Try next source
        }
      }
    } catch (error) {
      console.error(`Failed to load thumbnail for clip ${clip.id}:`, error);
    }
  }

  // Derive the expected thumbnail path from a video file path
  // Thumbnails are named: {video_filename_without_ext}_thumb.jpg
  // and stored in the Clippster thumbnails directory
  async function getThumbnailPathForVideoFile(videoPath: string): Promise<string | null> {
    try {
      // Get the thumbnails directory from storage
      const basePath = await getStoragePath('thumbnails');
      const videoFileName =
        videoPath
          .split(/[/\\]/)
          .pop()
          ?.replace(/\.[^.]+$/, '') || '';
      return `${basePath}/${videoFileName}_thumb.jpg`;
    } catch {
      return null;
    }
  }

  // Load thumbnail for a specific output file path and cache it
  async function loadThumbnailForOutputFile(filePath: string): Promise<void> {
    // Skip if already cached
    if (thumbnailStore.hasBuildThumbnail(filePath)) {
      return;
    }

    console.log(`[Clips] Loading thumbnail for output file: ${filePath}`);

    try {
      // Derive the expected thumbnail path
      const thumbnailPath = await getThumbnailPathForVideoFile(filePath);
      console.log(`[Clips] Expected thumbnail path: ${thumbnailPath}`);
      
      if (!thumbnailPath) {
        console.warn(`[Clips] Could not derive thumbnail path for ${filePath}`);
        return;
      }

      // Check if file exists
      const fileExists = await invoke<boolean>('check_file_exists', {
        path: thumbnailPath,
      });

      console.log(`[Clips] Thumbnail exists: ${fileExists}`);

      if (fileExists) {
        const dataUrl = await invoke<string>('read_file_as_data_url', {
          filePath: thumbnailPath,
        });
        thumbnailStore.setBuildThumbnail(filePath, dataUrl);
        console.log(`[Clips] Loaded existing thumbnail for ${filePath}`);
      } else {
        // Thumbnail doesn't exist - regenerate it from the video file
        console.log(`[Clips] Thumbnail missing, regenerating for ${filePath}`);
        
        // Check if the video file exists
        const videoExists = await invoke<boolean>('check_file_exists', {
          path: filePath,
        });
        
        console.log(`[Clips] Video file exists: ${videoExists}`);
        
        if (videoExists) {
          try {
            // Generate thumbnail at 1 second mark
            console.log(`[Clips] Calling generate_thumbnail_at_timestamp...`);
            const newThumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
              videoPath: filePath,
              timestampSeconds: 1.0,
              outputFilename: null,
            });
            
            console.log(`[Clips] Generated thumbnail at: ${newThumbnailPath}`);
            
            // Load the newly generated thumbnail
            const dataUrl = await invoke<string>('read_file_as_data_url', {
              filePath: newThumbnailPath,
            });
            thumbnailStore.setBuildThumbnail(filePath, dataUrl);
            console.log(`[Clips] ✅ Successfully regenerated and loaded thumbnail for ${filePath}`);
          } catch (genError) {
            console.error(`[Clips] ❌ Failed to regenerate thumbnail for ${filePath}:`, genError);
          }
        } else {
          console.warn(`[Clips] ❌ Video file does not exist: ${filePath}`);
        }
      }
    } catch (error) {
      console.error(`[Clips] ❌ Failed to load thumbnail for output file ${filePath}:`, error);
    }
  }

  // Legacy function - load a build's thumbnail from its thumbnail_path field
  async function loadBuildThumbnail(build: ClipBuild): Promise<void> {
    // Skip if no thumbnail path or already cached
    if (!build.thumbnail_path || thumbnailStore.hasBuildThumbnail(build.id)) {
      return;
    }

    try {
      // Check if file exists
      const fileExists = await invoke<boolean>('check_file_exists', {
        path: build.thumbnail_path,
      });

      if (fileExists) {
        const dataUrl = await invoke<string>('read_file_as_data_url', {
          filePath: build.thumbnail_path,
        });
        thumbnailStore.setBuildThumbnail(build.id, dataUrl);
      }
    } catch (error) {
      console.warn(`Failed to load thumbnail for build ${build.id}:`, error);
    }
  }

  async function getProjectInfo(projectId: string): Promise<Project | null> {
    // Check memory cache first
    if (projectCache.value.has(projectId)) {
      return projectCache.value.get(projectId) || null;
    }

    // Check persistent cache (1 hour TTL)
    try {
      const cached = await persistentCache.get<Project>('projects', projectId);
      if (cached) {
        projectCache.value.set(projectId, cached);
        return cached;
      }
    } catch (error) {
      console.warn('Failed to read from persistent cache:', error);
    }

    try {
      const project = await getProject(projectId);
      if (project) {
        projectCache.value.set(projectId, project);
        
        // Save to persistent cache (1 hour TTL)
        persistentCache.set('projects', projectId, project, 3600000).catch(err => {
          console.warn('Failed to save to persistent cache:', err);
        });

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
    // First try to get clip-specific thumbnail from persistent store
    const clipThumbnail = thumbnailStore.getThumbnail(clip.id);
    if (clipThumbnail) {
      return clipThumbnail;
    }

    // If no clip thumbnail and clip has a project, try to use raw video thumbnail as fallback
    if (clip.project_id) {
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

  // Get project name for a clip, with fallback to stored project_name for deleted projects
  function getClipProjectName(clip: Clip): string | null {
    // First try to get from live project cache
    if (clip.project_id) {
      const project = projectCache.value.get(clip.project_id);
      if (project) {
        return project.name;
      }
    }
    // Fallback to stored project_name (for deleted projects)
    return clip.project_name || null;
  }

  async function openClipsFolder() {
    try {
      const basePath = await getStoragePath('base');
      await revealItemInDir(basePath);
    } catch (err) {
      console.error('Failed to open Clippster directory:', err);
    }
  }

  async function playBuild(build: ClipBuild, filePath?: string, clipName?: string, projectId?: string | null) {
    try {
      const videoPath = filePath || build.file_path;
      if (!videoPath) {
        showErrorToast('Error', 'No video file available for this build');
        return;
      }

      // Extract aspect ratio from filename for display
      const aspectRatio = extractAspectRatioFromPath(videoPath);
      const aspectLabel = aspectRatio ? ` (${aspectRatio})` : '';

      // Use the clip name if provided, otherwise fall back to build number
      const displayName = clipName ? `${clipName}${aspectLabel}` : `Build #${build.build_number}${aspectLabel}`;

      // Convert build to RawVideo-like format for the video player
      const buildAsVideo = {
        id: build.id,
        project_id: build.clip_id,
        file_path: videoPath,
        original_filename: displayName,
        thumbnail_path: build.thumbnail_path,
        duration: build.duration,
        width: null,
        height: null,
        frame_rate: null,
        codec: null,
        file_size: build.file_size,
        original_project_id: null,
        created_at: build.created_at,
        updated_at: build.created_at,
        source_clip_id: null,
        source_mint_id: null,
        segment_number: null,
        is_segment: false,
        segment_start_time: null,
        segment_end_time: null,
      };
      clipToPlay.value = buildAsVideo;

      // Don't load watermark settings for built clips - the watermark is already baked into the video
      // The video player watermark overlay is only for preview purposes during editing
      playerWatermarkSettings.value = null;

      showVideoPlayer.value = true;
    } catch (err) {
      console.error('Failed to prepare build:', err);
      showErrorToast('Error', 'Failed to play build');
    }
  }

  // Build operations
  async function saveBuild(build: ClipBuild, filePath?: string) {
    const sourcePath = filePath || build.file_path;
    if (!sourcePath) {
      showErrorToast('Error', 'No build file path available');
      return;
    }

    try {
      // Extract the filename from the source path
      const fileName = sourcePath.split(/[/\\]/).pop() || 'clip.mp4';

      // Open save dialog so user can choose where to save
      const destinationPath = await save({
        title: 'Save Build As',
        defaultPath: fileName,
        filters: [
          { name: 'Video Files', extensions: ['mp4', 'mov'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      // User cancelled the dialog
      if (!destinationPath) {
        return;
      }

      // Copy the build to the selected destination
      await invoke('copy_clip_to_destination', {
        sourcePath: sourcePath,
        destinationPath: destinationPath,
      });

      showSuccessToast('Build Saved', `Build saved to ${destinationPath}`);
    } catch (error) {
      console.error('Failed to save build:', error);
      showErrorToast('Save Failed', 'Could not save the build file.');
    }
  }

  function confirmDeleteBuild(build: ClipBuild) {
    const buildItem = displayableBuilds.value.find((item) => item.id === build.id)
      ?? folderBuilds.value.find((item) => item.id === build.id)
      ?? displayableBuilds.value.find((item) => item.build.id === build.id)
      ?? folderBuilds.value.find((item) => item.build.id === build.id)
      ?? null;
    buildToDelete.value = buildItem;
    showDeleteBuildDialog.value = true;
  }

  function handleDeleteBuildDialogClose() {
    showDeleteBuildDialog.value = false;
    buildToDelete.value = null;
  }

  async function deleteBuildConfirmed() {
    if (!buildToDelete.value) return;

    try {
      await deleteDisplayableBuild(buildToDelete.value);

      await loadClips();

      // If folder dialog is open, refresh its data
      if (showFolderDialog.value && folderProject.value) {
        const currentFolderId = folderProject.value.id;
        const updatedGroup = Array.from(groupedByProject.value.values()).find(g => g.id === currentFolderId);
        
        if (updatedGroup && getFolderBuildsCount(updatedGroup.clips) > 0) {
          // Update the folder project with fresh data
          folderProject.value = updatedGroup;
        } else {
          // No builds left, close the dialog
          showFolderDialog.value = false;
          folderProject.value = null;
        }
      }

      showSuccessToast('Build Deleted', 'The build has been deleted.');
    } catch (error) {
      console.error('Failed to delete build:', error);
      showErrorToast('Delete Failed', 'Failed to delete the build.');
    }

    showDeleteBuildDialog.value = false;
    buildToDelete.value = null;
  }

  // Multi-select functions
  function toggleBuildSelection(buildId: string, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    if (selectedBuilds.value.has(buildId)) {
      selectedBuilds.value.delete(buildId);
    } else {
      selectedBuilds.value.add(buildId);
    }
    // Trigger reactivity
    selectedBuilds.value = new Set(selectedBuilds.value);
  }

  function isBuildSelected(buildId: string): boolean {
    return selectedBuilds.value.has(buildId);
  }

  function toggleFolderSelection(folderId: string, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    if (selectedFolders.value.has(folderId)) {
      selectedFolders.value.delete(folderId);
    } else {
      selectedFolders.value.add(folderId);
    }
    // Trigger reactivity
    selectedFolders.value = new Set(selectedFolders.value);
  }

  function isFolderSelected(folderId: string): boolean {
    return selectedFolders.value.has(folderId);
  }

  // Combined selection count based on current view
  const totalSelectedCount = computed(() => {
    if (viewMode.value === 'folders') {
      return selectedFolders.value.size;
    }
    return selectedBuilds.value.size;
  });

  const bulkDeleteTitle = computed(() => {
    if (viewMode.value === 'folders') {
      const count = selectedFolders.value.size;
      return `Delete ${count} project${count !== 1 ? 's' : ''}`;
    }
    const count = totalSelectedCount.value;
    return `Delete ${count} build${count !== 1 ? 's' : ''}`;
  });

  const bulkDeleteItemName = computed(() => {
    if (viewMode.value === 'folders') {
      const count = selectedFolders.value.size;
      return `all builds from ${count} project${count !== 1 ? 's' : ''}`;
    }
    const count = totalSelectedCount.value;
    return `${count} build${count !== 1 ? 's' : ''}`;
  });

  const bulkDeleteConfirmText = computed(() => {
    if (viewMode.value === 'folders') {
      return 'Delete all builds';
    }
    const count = totalSelectedCount.value;
    return `Delete ${count} build${count !== 1 ? 's' : ''}`;
  });

  const shouldShowSelectAll = computed(() => {
    if (viewMode.value === 'folders') {
      const totalFolders = groupedFolderProjects.value.flatMap(dateGroup => dateGroup.folders).length;
      return totalFolders > 0 && selectedFolders.value.size < totalFolders;
    } else {
      return paginatedBuilds.value.length > 0 && selectedBuilds.value.size < paginatedBuilds.value.length;
    }
  });

  // Number of items "Select all" would select (current page / visible folders)
  const selectAllTotal = computed(() => {
    if (viewMode.value === 'folders') {
      return groupedFolderProjects.value.flatMap((dateGroup) => dateGroup.folders).length;
    }
    return paginatedBuilds.value.length;
  });

  function clearFilters() {
    searchQuery.value = '';
    statusFilter.value = 'all';
    projectFilter.value = 'all';
    aspectRatioFilter.value = 'all';
  }

  function selectAll() {
    if (viewMode.value === 'folders') {
      // Select all folders on current page (flatten all date groups)
      const folderIds = groupedFolderProjects.value.flatMap(dateGroup => 
        dateGroup.folders.map(folder => folder.id)
      );
      selectedFolders.value = new Set(folderIds);
    } else {
      // Select all builds on current page
      const buildIds = paginatedBuilds.value.map(b => b.id);
      selectedBuilds.value = new Set(buildIds);
    }
  }

  function clearSelection() {
    selectedBuilds.value.clear();
    selectedBuilds.value = new Set(selectedBuilds.value);
    selectedFolders.value.clear();
    selectedFolders.value = new Set(selectedFolders.value);
  }

  function confirmBulkDelete() {
    if (totalSelectedCount.value > 0) {
      showBulkDeleteDialog.value = true;
    }
  }

  function handleBulkDeleteDialogClose() {
    showBulkDeleteDialog.value = false;
  }

  async function bulkDeleteConfirmed() {
    let deletedCount = 0;

    try {
      if (viewMode.value === 'folders') {
        // Delete all builds in selected folders
        const folderIds = Array.from(selectedFolders.value);
        for (const folderId of folderIds) {
          const folder = groupedByProject.value.find((g) => g.id === folderId);
          if (!folder) continue;

          // Delete all builds in this folder
          for (const clip of folder.clips) {
            if ((clip as any).source === 'video_editor' && clip.build_status === 'completed' && clip.built_file_path) {
              await deleteClip(clip.id);
              try {
                await invoke('delete_file', { path: clip.built_file_path });
              } catch (fileError) {
                console.warn('Could not delete build file:', fileError);
              }
              deletedCount++;
              continue;
            }

            if (clip.builds) {
              for (const build of clip.builds) {
                if (build.status === 'completed' && build.file_path) {
                  await deleteClipBuild(build.id);
                  try {
                    await invoke('delete_file', { path: build.file_path });
                  } catch (fileError) {
                    console.warn('Could not delete build file:', fileError);
                  }
                  deletedCount++;
                }
              }
            }
          }
        }
        selectedFolders.value.clear();
      } else {
        // Delete selected builds
        const buildIds = Array.from(selectedBuilds.value);
        for (const buildId of buildIds) {
          const buildItem = displayableBuilds.value.find((b) => b.id === buildId);
          if (!buildItem) continue;

          await deleteDisplayableBuild(buildItem);
          deletedCount++;
        }
        selectedBuilds.value.clear();
      }

      await loadClips();
      showSuccessToast('Builds Deleted', `${deletedCount} build${deletedCount !== 1 ? 's' : ''} deleted successfully.`);
    } catch (error) {
      console.error('Failed to delete builds:', error);
      showErrorToast('Delete Failed', 'Failed to delete some builds.');
    }

    showBulkDeleteDialog.value = false;
  }

  // Open project workspace with a specific clip preselected
  async function openProjectForClip(_build: ClipBuild, clip: ClipWithBuilds) {
    if (!clip.project_id) {
      showErrorToast('Cannot Open Project', 'This clip is not associated with a project.');
      return;
    }

    // Get the project from cache or load it
    let project: Project | null | undefined = projectCache.value.get(clip.project_id);

    if (!project) {
      try {
        project = await getProject(clip.project_id);
        if (project) {
          projectCache.value.set(clip.project_id, project);
        }
      } catch (error) {
        console.error('Failed to load project:', error);
      }
    }

    if (!project) {
      showErrorToast('Project Not Found', 'The project associated with this clip could not be found.');
      return;
    }

    // Set the workspace state and open the dialog
    workspaceProject.value = project;
    workspaceInitialClipId.value = clip.id;
    showWorkspaceDialog.value = true;
  }

  // ============================================================================
  // Publishing Functions (3-Dialog Flow)
  // ============================================================================

  /**
   * Initiate the publish flow with SimplifiedPublishDialog.
   */
  async function initiatePublish(build: ClipBuild, filePath: string, thumbnailUrl: string | null, clip?: ClipWithBuilds) {
    publishingBuild.value = { build, clip: clip || null, filePath, thumbnailUrl };
    showSimplifiedPublishDialog.value = true;
  }

  function onPublishDialogClose() {
    showSimplifiedPublishDialog.value = false;
    publishingBuild.value = null;
  }

  // Handle closing workspace dialog - clear initial clip ID
  watch(showWorkspaceDialog, (isOpen) => {
    if (!isOpen) {
      workspaceInitialClipId.value = null;
    }
  });

  // Search palette functions
  function openSearchPalette() {
    showSearchPalette.value = true;
    paletteSearchQuery.value = searchQuery.value;
  }

  function closeSearchPalette() {
    showSearchPalette.value = false;
    paletteSearchQuery.value = '';
    paletteViewMode.value = 'search';
  }

  function selectSearchResult(item: DisplayableBuild) {
    // Apply the search and close palette
    searchQuery.value = item.clipName;
    closeSearchPalette();
  }

  function showUntranscribedClips() {
    // Switch to untranscribed view mode within the palette
    onPaletteTabChange('untranscribed');
  }

  function switchToSearchMode() {
    onPaletteTabChange('search');
  }

  function applyUntranscribedFilter() {
    // Apply the untranscribed filter to the main page and close palette
    closeSearchPalette();
    searchQuery.value = '';
    showOnlyUntranscribed.value = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Count clips without transcripts
  const untranscribedClipsCount = computed(() => {
    // Count unique clips that don't have transcript segments
    const uniqueClipIds = new Set<string>();
    for (const build of displayableBuilds.value) {
      uniqueClipIds.add(build.clip.id);
    }

    // Count clips that don't have transcripts
    let count = 0;
    for (const clipId of uniqueClipIds) {
      if (!clipIdsWithTranscripts.value.has(clipId)) {
        count++;
      }
    }
    return count;
  });

  // Get untranscribed clips for palette display
  const paletteUntranscribedClips = computed((): (DisplayableBuild & { isTranscribed: boolean })[] => {
    // Get unique clips first (one entry per clip, not per build)
    const seenClipIds = new Set<string>();
    return displayableBuilds.value
      .filter((build) => {
        // Skip if we've already seen this clip
        if (seenClipIds.has(build.clip.id)) return false;
        seenClipIds.add(build.clip.id);
        // Only show clips without transcripts
        return !clipIdsWithTranscripts.value.has(build.clip.id);
      })
      .slice(0, 30) // Limit results
      .map((item) => ({
        ...item,
        isTranscribed: false,
      }));
  });

  // Search results for palette
  const paletteSearchResults = computed((): DisplayableBuild[] => {
    if (!paletteSearchQuery.value) return [];

    const query = paletteSearchQuery.value.toLowerCase();
    return displayableBuilds.value
      .filter((item) => {
        const nameMatch = item.clipName.toLowerCase().includes(query);
        const projectMatch = item.projectName && item.projectName.toLowerCase().includes(query);
        // clipIdsWithTranscriptMatch contains clips that matched the search query in their transcript
        const transcriptMatch = clipIdsWithTranscriptMatch.value.has(item.clip.id);
        return nameMatch || projectMatch || transcriptMatch;
      })
      .slice(0, 20) // Limit to 20 results
      .map((item) => ({
        ...item,
        matchType: clipIdsWithTranscriptMatch.value.has(item.clip.id) ? 'transcript' : 'name',
        // isTranscribed uses clipIdsWithTranscripts (which clips have any transcripts at all)
        isTranscribed: clipIdsWithTranscripts.value.has(item.clip.id),
      }));
  });

  // Watch palette search query for transcript search
  watch(paletteSearchQuery, (newQuery) => {
    debouncedTranscriptSearch(newQuery);
  });

  onMounted(() => {
    loadClips();
  });
</script>
