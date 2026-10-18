<template>
  <PageLayout
    title="Video library"
    description="Manage and organize your video projects"
    :show-header="true"
    :icon="Folder"
  >
    <template #actions>
      <Button variant="primary" @click="openCreateDialog">
        <Plus />
        New project
      </Button>
    </template>

    <template #toolbar>
      <SelectionBar
        v-if="selectedProjects.size > 0"
        :count="selectedProjects.size"
        :total="paginatedProjects.length"
        @clear="clearSelection"
        @select-all="selectAllCurrentPage"
      >
        <Button
          variant="destructive-soft"
          size="sm"
          :disabled="hasAnySelectedProjectDetecting()"
          :title="hasAnySelectedProjectDetecting() ? 'Cannot delete while detection is in progress' : undefined"
          @click="confirmBulkDelete"
        >
          <Trash2 />
          Delete selected
        </Button>
      </SelectionBar>
      <template v-else>
        <SearchPaletteTrigger
          placeholder="Search projects…"
          :query="searchQuery"
          size="sm"
          class="w-full max-w-[260px] flex-1"
          @open="openSearchPalette"
          @clear="searchQuery = ''"
        />
        <div class="ml-auto flex shrink-0 items-center gap-2">
          <SegmentedControl v-model="statusFilter" :options="statusFilterOptions" size="sm" />
          <div class="w-[148px] shrink-0">
            <CustomDropdown v-model="sortBy" :options="sortOptions" placeholder="Sort by" size="sm" />
          </div>
          <SegmentedControl v-model="viewMode" :options="viewModeOptions" size="sm" />
        </div>
      </template>
    </template>

    <div class="flex flex-1 flex-col gap-6 px-5 py-4">
      <slot name="notice" />
      <!-- Tour demo project -->
      <section v-if="mockProjectActive" class="flex flex-col gap-2.5">
        <SectionHeader title="Tour demo" />
        <div class="card-grid">
          <div
            class="flex flex-col overflow-hidden rounded-xl border border-line-subtle bg-surface"
            data-tour-id="tour-mock-project"
          >
            <div
              class="grid aspect-video place-items-center border-b border-line-subtle bg-surface-sunken text-fg-disabled"
            >
              <Folder class="size-7" />
            </div>
            <div class="flex flex-col gap-2.5 px-3 pb-3 pt-2">
              <div class="min-w-0">
                <h3 class="truncate text-sm font-medium text-fg">Demo VOD project</h3>
                <p class="text-xs text-fg-muted">Sample project for the tour</p>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <Button variant="secondary" size="xs" data-tour-id="tour-mock-detect" @click.prevent>
                  <Sparkles />
                  Detect clips
                </Button>
                <Button variant="secondary" size="xs" data-tour-id="tour-mock-transcribe" @click.prevent>
                  <FileText />
                  Transcribe
                </Button>
                <Button variant="secondary" size="xs" data-tour-id="tour-mock-preedit" @click.prevent>
                  <LayoutDashboard />
                  Pre-edit VOD
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Loading State (first load only; background refreshes keep the grid) -->
      <div v-if="loading && !projects.length" aria-busy="true" class="skeleton-group">
        <div v-if="viewMode === 'list'" class="flex flex-col gap-1">
          <div v-for="i in 8" :key="`skeleton-row-${i}`" class="flex h-11 items-center gap-3 px-2">
            <div class="skeleton h-8 w-14 shrink-0" />
            <div class="skeleton h-3.5 w-1/3" />
            <div class="skeleton ml-auto h-3 w-24" />
          </div>
        </div>
        <div v-else class="card-grid">
          <div v-for="i in 8" :key="`skeleton-${i}`" class="flex flex-col gap-2">
            <div class="skeleton aspect-video rounded-xl" />
            <div class="skeleton h-3.5 w-3/4" />
            <div class="skeleton h-3 w-1/2" />
          </div>
        </div>
      </div>

      <!-- Projects Content -->
      <template v-else-if="projects.length > 0 || getActiveDownloads().length > 0 || getQueuedDownloads().length > 0">
        <!-- Active Downloads Section -->
        <section
          v-if="getActiveDownloads().length > 0 || getQueuedDownloads().length > 0"
          class="flex flex-col gap-2.5"
        >
          <SectionHeader title="Active downloads" :count="getActiveDownloads().length + getQueuedDownloads().length">
            <Button variant="ghost" size="sm" title="Cancel all downloads" @click="handleCancelAllDownloads">
              <XCircle />
              Cancel all
            </Button>
          </SectionHeader>
          <div class="card-grid">
            <DownloadCard
              v-for="download in [...getActiveDownloads(), ...getQueuedDownloads()]"
              :key="download.id"
              :download="download"
            />
          </div>
        </section>

        <!-- Projects, grouped by date -->
        <div
          v-if="filteredProjects.length > 0"
          :key="`${viewMode}-${statusFilter}`"
          class="flex animate-enter flex-col gap-6"
        >
          <section v-for="group in groupedProjects" :key="group.dateLabel" class="@container flex flex-col gap-2.5">
            <SectionHeader :title="group.dateLabel" :count="group.projects.length" />

            <div
              :class="
                viewMode === 'list'
                  ? 'flex flex-col overflow-hidden rounded-xl border border-line-subtle bg-surface pb-1'
                  : 'card-grid'
              "
            >
              <!-- List column headings -->
              <div
                v-if="viewMode === 'list'"
                class="mb-1 flex h-8 items-center gap-3 border-b border-line-subtle px-3 text-2xs font-medium text-fg-subtle"
              >
                <span class="w-4 shrink-0" />
                <span class="flex-1 pl-[68px]">Name</span>
                <span class="flex shrink-0 items-center gap-4">
                  <span class="w-4" />
                  <span class="hidden w-20 text-right @xl:block">Duration</span>
                  <span class="w-12 text-right">Clips</span>
                  <span class="hidden w-24 text-right @2xl:block">Updated</span>
                </span>
                <span class="w-[118px] shrink-0" />
              </div>
              <LibraryProjectCard
                v-for="project in group.projects"
                :key="project.id"
                :name="project.name"
                :thumbnail="getThumbnailUrl(project.id)"
                :live="isProjectLive(project.id)"
                :selected="isProjectSelected(project.id)"
                :list="viewMode === 'list'"
                :class="viewMode === 'list' && 'mx-1'"
                @open="handleProjectClick(project)"
              >
                <template #badges>
                  <LibrarySelectCheckbox
                    :checked="isProjectSelected(project.id)"
                    :label="`Select ${project.name}`"
                    :overlay="viewMode !== 'list'"
                    :visible="selectedProjects.size > 0"
                    :class="viewMode === 'list' ? 'flex shrink-0' : 'absolute left-2 top-2 z-20 flex'"
                    @toggle="toggleProjectSelection(project.id)"
                  />
                  <template v-if="viewMode !== 'list'">
                    <div
                      class="pointer-events-none absolute bottom-2 left-2 z-10 flex max-w-[calc(100%-5rem)] flex-wrap gap-1"
                    >
                      <MediaChip v-if="isProjectLive(project.id)" variant="live">Live</MediaChip>
                      <MediaChip v-if="isProjectDetecting(project.id)">
                        <Loader2 class="animate-spin text-ai" />
                        Detecting…
                      </MediaChip>
                      <MediaChip
                        v-else-if="viewMode === 'folders' && hasChildren(project.id) && getChildCount(project.id) > 1"
                      >
                        <FolderOpen />
                        {{ getChildCount(project.id) }} parts
                      </MediaChip>
                      <MediaChip v-if="hasVodPreset(project.id) && !isLiveClipsContainerProject(project)">
                        <LayoutDashboard class="text-brand" />
                        {{ vodPresetConfigs[project.id]?.targetAspectRatio }} pre-edit
                      </MediaChip>
                    </div>
                    <MediaChip
                      v-if="getProjectDuration(project.id)"
                      class="tabular pointer-events-none absolute bottom-2 right-2 z-10"
                    >
                      {{ getProjectDuration(project.id) }}
                    </MediaChip>
                  </template>
                </template>

                <template #meta>
                  <slot name="project-status" :project="project" />
                  <template v-if="viewMode !== 'list'">
                    <PlatformLogo
                      v-if="getProjectPlatform(project)"
                      :platform="getProjectPlatform(project)"
                      size="xs"
                    />
                    <span class="truncate">{{ getRelativeTime(project.updated_at) }}</span>
                    <span class="size-[3px] shrink-0 rounded-full bg-fg-subtle" />
                    <span class="tabular shrink-0">{{ getClipCount(project.id) }} clips</span>
                  </template>
                  <div v-else class="flex items-center gap-4">
                    <div class="flex items-center gap-1.5">
                      <Badge v-if="isProjectLive(project.id)" variant="live">Live</Badge>
                      <Badge v-if="isProjectDetecting(project.id)" variant="ai">
                        <Loader2 class="animate-spin" />
                        Detecting…
                      </Badge>
                      <Badge v-if="hasVodPreset(project.id) && !isLiveClipsContainerProject(project)" variant="brand">
                        {{ vodPresetConfigs[project.id]?.targetAspectRatio }} pre-edit
                      </Badge>
                    </div>
                    <span class="grid w-4 place-items-center">
                      <PlatformLogo
                        v-if="getProjectPlatform(project)"
                        :platform="getProjectPlatform(project)"
                        size="xs"
                      />
                    </span>
                    <span class="tabular hidden w-20 whitespace-nowrap text-right @xl:block">
                      {{ getProjectDuration(project.id) || '—' }}
                    </span>
                    <span class="tabular w-12 text-right">{{ getClipCount(project.id) }}</span>
                    <span class="hidden w-24 truncate text-right @2xl:block">
                      {{ getRelativeTime(project.updated_at) }}
                    </span>
                  </div>
                </template>

                <!-- Hover actions -->
                <template #actions>
                  <slot name="extra-actions" :project="project" />
                  <div class="flex items-center gap-0.5" :class="viewMode === 'list' && 'w-[118px] justify-end'">
                    <LibraryCardAction
                      v-if="canDetectClips(project.id) && !isProjectDetecting(project.id) && isAIAllowed"
                      title="Detect clips"
                      :overlay="viewMode !== 'list'"
                      @click.stop="startProjectDetection(project)"
                    >
                      <Sparkles />
                    </LibraryCardAction>
                    <LibraryCardAction
                      v-if="canTranscribe(project.id)"
                      :title="isProjectTranscribed(project.id) ? 'Transcribed' : 'Transcribe'"
                      :active="isProjectTranscribed(project.id)"
                      :overlay="viewMode !== 'list'"
                      @click.stop="startTranscription(project)"
                    >
                      <FileText />
                    </LibraryCardAction>
                    <LibraryCardAction
                      v-if="
                        (hasDirectVideos(project.id) || hasChildren(project.id)) &&
                        !isLiveClipsContainerProject(project)
                      "
                      title="Pre-edit VOD"
                      :active="hasVodPreset(project.id)"
                      :overlay="viewMode !== 'list'"
                      @click.stop="openVodPresetEditor(project)"
                    >
                      <LayoutDashboard />
                    </LibraryCardAction>
                    <LibraryCardAction title="Edit" :overlay="viewMode !== 'list'" @click.stop="editProject(project)">
                      <Edit />
                    </LibraryCardAction>
                  </div>
                </template>
              </LibraryProjectCard>
            </div>
          </section>
        </div>

        <!-- No Results State (only show if no active downloads) -->
        <EmptyState
          v-if="filteredProjects.length === 0 && getActiveDownloads().length === 0 && getQueuedDownloads().length === 0"
          :icon="Search"
          title="No projects found"
          description="No projects match the current filters."
        >
          <Button
            variant="secondary"
            @click="
              searchQuery = '';
              statusFilter = 'all';
            "
          >
            Clear filters
          </Button>
        </EmptyState>
      </template>

      <!-- Empty State -->
      <EmptyState
        v-else-if="!mockProjectActive"
        :icon="Folder"
        title="No projects yet"
        description="Create a new project to get started."
      >
        <Button variant="secondary" @click="openCreateDialog">
          <Plus />
          New project
        </Button>
      </EmptyState>
    </div>

    <!-- Pagination Footer -->
    <PaginationFooter
      v-if="!loading && filteredProjects.length > 0"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total-items="filteredProjects.length"
      item-label="project"
      @go-to-page="goToPage"
      @previous="previousPage"
      @next="nextPage"
    />

    <!-- Project Dialog -->
    <slot name="dialogs" />
  </PageLayout>
</template>
<script lang="ts">
  import { defineComponent, markRaw } from 'vue';
  import { projectLibraryPresentation } from '@/lib/sharedViewPresentation';
  import LibraryProjectCard from '@/components/LibraryProjectCard.vue';
  import {
    Folder,
    Plus,
    Edit,
    Trash2,
    FolderOpen,
    XCircle,
    Search,
    Sparkles,
    Loader2,
    FileText,
    LayoutDashboard,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import { PlatformLogo } from '@/components/ui/platform-logo';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import DownloadCard from '@/components/DownloadCard.vue';
  import SearchPaletteTrigger from '@/components/SearchPaletteTrigger.vue';
  import { SelectionBar } from '@/components/ui/selection-bar';
  import LibraryCardAction from '@/components/library/LibraryCardAction.vue';
  import LibrarySelectCheckbox from '@/components/library/LibrarySelectCheckbox.vue';
  import { MediaChip } from '@/components/ui/media-tile';
  export default defineComponent({
    components: {
      LibraryProjectCard,
      Folder,
      Plus,
      Edit,
      Trash2,
      FolderOpen,
      XCircle,
      Search,
      Sparkles,
      Loader2,
      FileText,
      LayoutDashboard,
      PageLayout,
      PaginationFooter,
      Badge,
      Button,
      EmptyState,
      SectionHeader,
      SegmentedControl,
      PlatformLogo,
      CustomDropdown,
      DownloadCard,
      SearchPaletteTrigger,
      SelectionBar,
      LibraryCardAction,
      LibrarySelectCheckbox,
      MediaChip,
    },
    props: { model: { type: Object, required: true } },
    setup(props): Record<string, any> {
      return Object.assign(props.model, projectLibraryPresentation(props.model), {
        LibraryProjectCard: markRaw(LibraryProjectCard),
        Folder: markRaw(Folder),
        Plus: markRaw(Plus),
        Edit: markRaw(Edit),
        Trash2: markRaw(Trash2),
        FolderOpen: markRaw(FolderOpen),
        XCircle: markRaw(XCircle),
        Search: markRaw(Search),
        Sparkles: markRaw(Sparkles),
        Loader2: markRaw(Loader2),
        FileText: markRaw(FileText),
        LayoutDashboard: markRaw(LayoutDashboard),
        PageLayout: markRaw(PageLayout),
        PaginationFooter: markRaw(PaginationFooter),
        Badge: markRaw(Badge),
        Button: markRaw(Button),
        EmptyState: markRaw(EmptyState),
        SectionHeader: markRaw(SectionHeader),
        SegmentedControl: markRaw(SegmentedControl),
        PlatformLogo: markRaw(PlatformLogo),
        CustomDropdown: markRaw(CustomDropdown),
        DownloadCard: markRaw(DownloadCard),
        SearchPaletteTrigger: markRaw(SearchPaletteTrigger),
        SelectionBar: markRaw(SelectionBar),
        LibraryCardAction: markRaw(LibraryCardAction),
        LibrarySelectCheckbox: markRaw(LibrarySelectCheckbox),
        MediaChip: markRaw(MediaChip),
      });
    },
  });
</script>
