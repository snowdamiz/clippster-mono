<template>
  <PageLayout title="Projects" description="Manage and organize your video projects" :show-header="true" :icon="Folder">
    <template #actions>
      <div class="projects-header-actions">
        <!-- Search -->
        <div class="projects-header__search">
          <Search class="projects-header__search-icon" />
          <Input v-model="searchQuery" placeholder="Search projects..." class="projects-header__search-input" />
        </div>

        <!-- Status Filter -->
        <CustomDropdown
          v-model="statusFilter"
          :options="statusOptions"
          placeholder="Status"
          class="projects-header__filter"
          trigger-class="projects-header__dropdown-trigger"
        />

        <!-- Sort Filter -->
        <CustomDropdown
          v-model="sortBy"
          :options="sortOptions"
          placeholder="Sort By"
          class="projects-header__sort"
          trigger-class="projects-header__dropdown-trigger"
        />

        <!-- View Mode -->
        <div
          class="projects-header__view-toggle"
          :class="{ 'projects-header__view-toggle--disabled': searchQuery || statusFilter === 'has_clips' }"
        >
          <button
            @click="viewMode = 'folders'"
            :disabled="!!searchQuery || statusFilter === 'has_clips'"
            class="projects-header__view-btn"
            :class="{ 'projects-header__view-btn--active': viewMode === 'folders' }"
            title="Folder View"
          >
            <Folder class="projects-header__view-icon" />
          </button>
          <button
            @click="viewMode = 'list'"
            :disabled="!!searchQuery || statusFilter === 'has_clips'"
            class="projects-header__view-btn"
            :class="{ 'projects-header__view-btn--active': viewMode === 'list' }"
            title="List View"
          >
            <List class="projects-header__view-icon" />
          </button>
        </div>

        <!-- New Project Button -->
        <button @click="openCreateDialog" class="projects-create-btn">
          <Plus class="projects-create-btn__icon" />
          New Project
        </button>
      </div>
    </template>

    <div
      class="projects__content"
      :class="{
        'projects__content--empty':
          !loading && projects.length === 0 && getActiveDownloads().length === 0 && getQueuedDownloads().length === 0,
      }"
    >
      <!-- Page Heading -->
      <div
        v-if="projects.length > 0 || loading || getActiveDownloads().length > 0 || getQueuedDownloads().length > 0"
        class="projects__heading"
      >
        <h1 class="projects__title">Your Projects</h1>
        <p class="projects__subtitle">Manage and organize your video projects, detect clips, and build content</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="projects__loading">
        <!-- Skeleton Cards Grid -->
        <div class="projects__grid">
          <div v-for="i in 6" :key="`skeleton-${i}`" class="project-card project-card--skeleton">
            <div class="project-card__skeleton-bg"></div>
            <div class="project-card__bottom">
              <div class="projects-skeleton__card-title"></div>
              <div class="projects-skeleton__card-meta"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Projects Content -->
      <div
        v-else-if="projects.length > 0 || getActiveDownloads().length > 0 || getQueuedDownloads().length > 0"
        class="projects__main"
      >
        <!-- Selection Bar (shown when items selected) -->
        <div v-if="selectedProjects.size > 0" class="projects__selection-bar">
          <button
            @click="confirmBulkDelete"
            :disabled="hasAnySelectedProjectDetecting()"
            class="projects__selection-delete"
            :class="{ 'projects__selection-delete--disabled': hasAnySelectedProjectDetecting() }"
            :title="hasAnySelectedProjectDetecting() ? 'Cannot delete while detection is in progress' : ''"
          >
            <Trash2 class="projects__selection-icon" />
            Delete ({{ selectedProjects.size }})
          </button>
          <button
            v-if="paginatedProjects.length > 0 && selectedProjects.size < paginatedProjects.length"
            @click="selectAllCurrentPage"
            class="projects__selection-action"
          >
            Select all on page
          </button>
          <span class="projects__selection-count">{{ selectedProjects.size }} selected</span>
          <button @click="clearSelection" class="projects__selection-clear">Clear</button>
        </div>

        <!-- Active Downloads Section -->
        <div v-if="getActiveDownloads().length > 0 || getQueuedDownloads().length > 0" class="projects__section">
          <h3 class="projects__section-header">Active Downloads</h3>
          <div class="projects__grid projects__grid--downloads">
            <DownloadCard
              v-for="download in [...getActiveDownloads(), ...getQueuedDownloads()]"
              :key="download.id"
              :download="download"
            />
          </div>
        </div>

        <!-- Projects Grid -->
        <div v-if="filteredProjects.length > 0" class="projects__section">
          <div v-for="group in groupedProjects" :key="group.dateLabel" class="projects__date-group">
            <!-- Date Header -->
            <h3 class="projects__section-header">{{ group.dateLabel }}</h3>

            <div class="projects__grid">
              <div
                v-for="project in group.projects"
                :key="project.id"
                class="project-card"
                :class="{ 'project-card--selected': isProjectSelected(project.id) }"
                @click="handleProjectClick(project)"
              >
                <!-- Selection Checkbox (visible on hover or when selected) -->
                <div
                  class="project-card__checkbox"
                  :class="{ 'project-card__checkbox--visible': isProjectSelected(project.id) }"
                  @click.stop="toggleProjectSelection(project.id)"
                >
                  <div
                    class="project-card__checkbox-inner"
                    :class="{ 'project-card__checkbox-inner--checked': isProjectSelected(project.id) }"
                  >
                    <Check v-if="isProjectSelected(project.id)" class="project-card__checkbox-icon" />
                  </div>
                </div>

                <!-- Processing Indicator (if project or any segment is being detected) -->
                <div v-if="isProjectDetecting(project.id)" class="project-card__badge project-card__badge--detecting">
                  <Loader2 class="project-card__badge-icon project-card__badge-icon--spin" />
                  <span>Detecting...</span>
                </div>
                <!-- Folder Badge (if has children and in folder view, only show if not detecting/merging) -->
                <div
                  v-else-if="viewMode === 'folders' && hasChildren(project.id) && getChildCount(project.id) > 1"
                  class="project-card__badge project-card__badge--folder"
                >
                  <FolderOpen class="project-card__badge-icon" />
                  <span>{{ getChildCount(project.id) }} Parts</span>
                </div>

                <!-- Thumbnail background with vignette -->
                <div
                  v-if="getThumbnailUrl(project.id)"
                  class="project-card__thumbnail"
                  :style="{
                    backgroundImage: `url(${getThumbnailUrl(project.id)})`,
                  }"
                >
                  <!-- Vignette overlay -->
                  <div class="project-card__vignette"></div>
                </div>
                <!-- Fallback background for projects without thumbnails -->
                <div v-else class="project-card__thumbnail project-card__thumbnail--empty">
                  <div class="project-card__thumbnail-gradient"></div>

                  <!-- Live Empty State -->
                  <div v-if="isProjectLive(project.id)" class="project-card__empty-live">
                    <div class="project-card__empty-live-pulse">
                      <div class="project-card__empty-live-ring"></div>
                      <Radio class="project-card__empty-live-icon" />
                    </div>
                    <span class="project-card__empty-live-text">Monitoring</span>
                  </div>
                  <!-- Standard Empty State -->
                  <div v-else class="project-card__empty-icon">
                    <Folder class="project-card__folder-icon" />
                  </div>
                </div>

                <!-- Bottom Overlay with Info -->
                <div class="project-card__bottom">
                  <!-- Title -->
                  <h3 class="project-card__title" :title="project.name">
                    {{ project.name }}
                  </h3>

                  <!-- Metadata Row -->
                  <div class="project-card__meta">
                    <!-- Platform Icon -->
                    <div
                      v-if="getProjectPlatform(project) === 'Youtube'"
                      class="project-card__platform project-card__platform--youtube"
                      title="YouTube"
                    >
                      <img src="/youtube.svg" class="project-card__platform-icon" />
                    </div>
                    <div
                      v-else-if="getProjectPlatform(project) === 'Twitch'"
                      class="project-card__platform project-card__platform--twitch"
                      title="Twitch"
                    >
                      <img src="/twitch.svg" class="project-card__platform-icon" />
                    </div>
                    <div
                      v-else-if="getProjectPlatform(project) === 'Kick'"
                      class="project-card__platform project-card__platform--kick"
                      title="Kick"
                    >
                      <img src="/kick.svg" class="project-card__platform-icon project-card__platform-icon--kick" />
                    </div>
                    <div
                      v-else-if="getProjectPlatform(project) === 'PumpFun'"
                      class="project-card__platform project-card__platform--pumpfun"
                      title="PumpFun"
                    >
                      <img
                        src="/capsule.svg"
                        class="project-card__platform-icon project-card__platform-icon--pumpfun"
                      />
                    </div>
                    <div
                      v-else-if="getProjectPlatform(project) === 'Manual'"
                      class="project-card__platform project-card__platform--manual"
                      title="Manual"
                    >
                      <Monitor class="project-card__platform-svg" />
                    </div>

                    <!-- Live Indicator -->
                    <div v-if="isProjectLive(project.id)" class="project-card__live">
                      <span class="project-card__live-dot">
                        <span class="project-card__live-ping"></span>
                        <span class="project-card__live-core"></span>
                      </span>
                      <span class="project-card__live-text">Live</span>
                    </div>

                    <span
                      v-if="!isProjectLive(project.id) && getProjectPlatform(project)"
                      class="project-card__dot"
                    ></span>

                    <!-- Time -->
                    <span class="project-card__meta-text">{{ getRelativeTime(project.updated_at) }}</span>

                    <span class="project-card__dot"></span>

                    <!-- Clip Count -->
                    <span class="project-card__meta-text">{{ getClipCount(project.id) }} clips</span>
                  </div>
                </div>

                <!-- Hover Overlay Buttons -->
                <div class="project-card__hover-actions">
                  <button
                    v-if="viewMode === 'folders' && (hasChildren(project.id) || hasDirectVideos(project.id))"
                    class="project-card__action-btn"
                    title="View Project"
                    @click.stop="handleProjectClick(project)"
                  >
                    <FolderOpen class="project-card__action-icon" />
                  </button>
                  <button
                    v-else
                    class="project-card__action-btn"
                    title="Open Workspace"
                    @click.stop="handleProjectClick(project)"
                  >
                    <Play class="project-card__action-icon" />
                  </button>

                  <button
                    v-if="canDetectClips(project.id) && !isProjectDetecting(project.id) && isAIAllowed"
                    class="project-card__action-btn"
                    title="Detect Clips"
                    @click.stop="startProjectDetection(project)"
                  >
                    <Sparkles class="project-card__action-icon" />
                  </button>

                  <button class="project-card__action-btn" title="Edit" @click.stop="editProject(project)">
                    <Edit class="project-card__action-icon" />
                  </button>
                  <button
                    v-if="!isProjectDetecting(project.id)"
                    class="project-card__action-btn"
                    title="Delete"
                    @click.stop="confirmDelete(project)"
                  >
                    <Trash2 class="project-card__action-icon" />
                  </button>
                </div>
              </div>
            </div>
          </div>
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

        <!-- No Results State (only show if no active downloads) -->
        <div
          v-if="filteredProjects.length === 0 && getActiveDownloads().length === 0 && getQueuedDownloads().length === 0"
          class="projects__no-results"
        >
          <div class="projects__no-results-icon-wrapper">
            <Search class="projects__no-results-icon" />
          </div>
          <h3 class="projects__no-results-title">No projects found</h3>
          <p class="projects__no-results-description">
            We couldn't find any projects matching your search filters. Try adjusting your search query or filters.
          </p>
          <button
            @click="
              searchQuery = '';
              statusFilter = 'all';
            "
            class="projects__no-results-btn"
          >
            Clear filters
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="projects__empty">
        <div class="projects__empty-icon-wrapper">
          <Folder class="projects__empty-icon" />
        </div>
        <h3 class="projects__empty-title">No projects found</h3>
        <p class="projects__empty-description">Create a new project to get started</p>
      </div>
    </div>

    <!-- Project Dialog -->
    <ProjectDialog v-model="showDialog" :project="selectedProject" @submit="handleProjectSubmit" />
    <!-- Project Workspace Dialog -->
    <ProjectWorkspaceDialog
      v-model="showWorkspaceDialog"
      :project="workspaceProject"
      :initial-clip-id="workspaceInitialClipId"
    />
    <!-- Project-Level Clip Detection Dialog -->
    <ClipDetectionConfirmDialog
      :model-value="showProjectDetectDialog"
      :video-duration="0"
      :segment-count="segmentsToDetect.length"
      :total-duration="totalDetectionDuration"
      @update:model-value="showProjectDetectDialog = $event"
      @confirm="onProjectDetectClipsConfirmed"
    />
    <!-- Folder Clip Build Dialog -->
    <ClipBuildSettingsDialog
      v-model="showFolderBuildDialog"
      :clip="folderClipToBuild"
      :watermark-settings="folderCreatorWatermarkSettings"
      :default-intro="folderCreatorDefaultIntro"
      :default-outro="folderCreatorDefaultOutro"
      @confirm="onFolderBuildConfirm"
    />

    <!-- Folder Contents Dialog -->
    <div
      v-if="showFolderDialog && folderProject"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <div
        class="bg-card rounded-lg w-full mx-4 border border-border flex flex-col overflow-hidden shadow-2xl transition-all duration-200 max-h-[80vh]"
        :class="folderDialogWidthClass"
      >
        <!-- Header -->
        <div class="py-2 px-3 border-b border-border flex items-center justify-between bg-black/30">
          <div class="flex items-center gap-2.5 min-w-0">
            <!-- Selection Controls (visible when items selected) -->
            <div v-if="selectedFolderChildren.size > 0" class="flex items-center gap-3">
              <button
                @click="confirmBulkDeleteFolderChildren"
                :disabled="hasAnySelectedFolderChildDetecting()"
                :class="[
                  'px-3 py-1.5 text-white rounded-md flex items-center gap-2 font-medium text-sm transition-all',
                  hasAnySelectedFolderChildDetecting()
                    ? 'bg-gray-500 cursor-not-allowed opacity-50'
                    : 'bg-red-600 hover:bg-red-700',
                ]"
                :title="hasAnySelectedFolderChildDetecting() ? 'Cannot delete while detection is in progress' : ''"
              >
                <Trash2 class="h-4 w-4" />
                Delete ({{ selectedFolderChildren.size }})
              </button>
              <span class="text-sm text-muted-foreground">{{ selectedFolderChildren.size }} selected</span>
              <button
                @click="clearFolderChildSelection"
                class="text-xs text-muted-foreground hover:text-foreground font-medium"
              >
                Clear
              </button>
            </div>

            <!-- Normal header (hidden when items selected) -->
            <template v-else>
              <div class="bg-primary/10 p-1.5 rounded-md shrink-0">
                <FolderOpen class="h-4 w-4 text-primary" />
              </div>
              <h2 class="text-md font-medium text-foreground -mt-1 truncate" :title="folderProject.name">
                {{ folderProject.name }}
              </h2>
            </template>
          </div>
          <button
            @click="showFolderDialog = false"
            class="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex items-center border-b border-border px-4 bg-black/20">
          <button
            @click="onFolderTabChange('segments')"
            :class="[
              'relative px-4 py-2.5 text-sm font-medium transition-all duration-200 flex items-center gap-2',
              folderActiveTab === 'segments' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80',
            ]"
          >
            <FolderOpen class="h-4 w-4" />
            Segments
            <span class="text-xs bg-muted px-1.5 py-0.5 rounded-full">
              {{ getEffectiveSegmentCount(folderProject.id) }}
            </span>
            <div
              v-if="folderActiveTab === 'segments'"
              class="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
            ></div>
          </button>
          <button
            @click="onFolderTabChange('clips')"
            :class="[
              'relative px-4 py-2.5 text-sm font-medium transition-all duration-200 flex items-center gap-2',
              folderActiveTab === 'clips' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80',
            ]"
          >
            <Video class="h-4 w-4" />
            Clips
            <span class="text-xs bg-muted px-1.5 py-0.5 rounded-full">{{ folderTotalClipsCount }}</span>
            <div
              v-if="folderActiveTab === 'clips'"
              class="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
            ></div>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 min-h-0 flex flex-col" :class="folderActiveTab === 'clips' ? '' : 'overflow-y-auto p-6'">
          <!-- Segments Tab -->
          <div
            v-if="folderActiveTab === 'segments'"
            class="grid gap-5"
            :class="{
              'grid-cols-1': paginatedFolderChildren.length <= 1,
              'grid-cols-1 md:grid-cols-2': paginatedFolderChildren.length === 2,
              'grid-cols-1 md:grid-cols-2 lg:grid-cols-3': paginatedFolderChildren.length >= 3,
            }"
          >
            <div
              v-for="project in paginatedFolderChildren"
              :key="project.id"
              class="relative bg-card rounded-md overflow-hidden cursor-pointer group aspect-video hover:scale-102 transition-all border border-border shadow-sm"
              :class="{ 'ring-2 ring-primary ring-offset-2 ring-offset-background': isFolderChildSelected(project.id) }"
              @click="openWorkspace(project)"
            >
              <!-- Selection Checkbox (visible on hover or when selected) -->
              <div
                class="absolute top-3 right-3 z-30 transition-opacity"
                :class="isFolderChildSelected(project.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                @click.stop="toggleFolderChildSelection(project.id)"
              >
                <div
                  :class="[
                    'w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer shadow-md border border-white/45',
                    isFolderChildSelected(project.id)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-black/60 text-white hover:bg-black/80',
                  ]"
                >
                  <Check v-if="isFolderChildSelected(project.id)" class="w-4 h-4" />
                </div>
              </div>

              <!-- Thumbnail background -->
              <div
                v-if="getThumbnailUrl(project.id)"
                class="absolute inset-0 z-0 rounded-md"
                :style="{
                  backgroundImage: `url(${getThumbnailUrl(project.id)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }"
              >
                <div class="absolute inset-0 bg-gradient-to-br from-black/50 via-black/20 to-black/60"></div>
              </div>
              <div v-else class="absolute inset-0 z-0 bg-muted">
                <div class="absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-black/40"></div>
                <div class="absolute inset-0 flex items-center justify-center opacity-20">
                  <Play class="h-12 w-12 text-foreground" />
                </div>
              </div>

              <!-- Detection Progress Indicator (for individual segment) -->
              <div
                v-if="isDetectionActive(project.id)"
                class="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-purple-600/90 text-white px-2 py-1 rounded-md text-xs font-bold shadow-sm backdrop-blur-sm"
              >
                <Loader2 class="w-3 h-3 animate-spin" />
                <span>Detecting...</span>
              </div>
              <!-- Duration Badge (only show if not detecting) -->
              <div v-else-if="getProjectDuration(project.id)" class="absolute top-3 left-3 z-5">
                <span
                  class="text-xs px-2 py-1 rounded-md text-white bg-black/60 backdrop-blur-sm font-medium flex items-center gap-1.5"
                >
                  <Clock class="w-3 h-3" />
                  {{ getProjectDuration(project.id) }}
                </span>
              </div>

              <!-- Info -->
              <div class="absolute bottom-0 left-0 right-0 z-5 bg-black/60 backdrop-blur-sm p-3 rounded-b-md">
                <h3 class="text-sm font-semibold text-white line-clamp-1">{{ project.name }}</h3>
                <p class="text-xs text-white/70 line-clamp-1 mt-0.5">
                  {{ project.description || 'No description' }} • {{ getRelativeTime(project.updated_at) }}
                </p>
              </div>

              <!-- Hover Overlay -->
              <div
                class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 flex items-center justify-center gap-3"
              >
                <button
                  class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                  title="Open Workspace"
                  @click.stop="openWorkspace(project)"
                >
                  <Play class="h-5 w-5" />
                </button>
                <button
                  v-if="
                    canDetectClips(project.id) &&
                    !isDetectionActive(project.id) &&
                    !isProjectDetecting(folderProject?.id || '') &&
                    isAIAllowed
                  "
                  class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                  title="Detect Clips"
                  @click.stop="startProjectDetection(project)"
                >
                  <Sparkles class="h-5 w-5" />
                </button>
                <button
                  v-if="!isDetectionActive(project.id) && !isProjectDetecting(folderProject?.id || '')"
                  class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                  title="Delete"
                  @click.stop="confirmDelete(project)"
                >
                  <Trash2 class="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Clips Tab - 2 Column Layout -->
          <div v-else-if="folderActiveTab === 'clips'" class="flex-1 flex min-h-0">
            <!-- Left Column: Clips List -->
            <div class="w-[480px] flex-shrink-0 border-r border-border overflow-y-auto p-4">
              <!-- Loading State -->
              <div v-if="folderClipsLoading" class="flex items-center justify-center py-12">
                <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
              </div>

              <!-- Empty State -->
              <div
                v-else-if="folderClips.length === 0"
                class="flex flex-col items-center justify-center py-12 text-center"
              >
                <div class="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
                  <Video class="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 class="text-lg font-medium text-foreground mb-2">No Clips Detected</h3>
                <p class="text-sm text-muted-foreground max-w-xs">
                  Run clip detection on individual segments to find viral moments.
                </p>
              </div>

              <!-- Clips List -->
              <div v-else class="space-y-3 pb-4">
                <div
                  v-for="(clip, index) in folderClips"
                  :key="clip.id"
                  class="group relative bg-card/50 backdrop-blur-sm border rounded-lg cursor-pointer transition-all duration-200"
                  :class="
                    clipToPreview?.id === clip.id
                      ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border/50 hover:border-border/80 hover:bg-card/70 hover:shadow-lg hover:shadow-black/10'
                  "
                  @click="previewClip(clip)"
                >
                  <!-- Left accent bar -->
                  <div
                    v-if="clip.run_number"
                    class="absolute left-0 top-0 bottom-0 w-1 transition-all duration-200 rounded-l-lg"
                    :style="{ backgroundColor: clip.session_run_color || '#8B5CF6', opacity: 0.6 }"
                  ></div>

                  <div class="flex gap-3 p-3 pl-4">
                    <!-- Thumbnail (16:9 aspect ratio) -->
                    <div class="relative flex-shrink-0 w-40 aspect-video rounded-lg overflow-hidden bg-black/50">
                      <div
                        v-if="getClipThumbnailUrl(clip)"
                        class="absolute inset-0"
                        :style="{
                          backgroundImage: `url(${getClipThumbnailUrl(clip)})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }"
                      ></div>
                      <div v-else class="absolute inset-0 flex items-center justify-center">
                        <Video class="w-6 h-6 text-muted-foreground/40" />
                      </div>
                      <!-- Duration badge -->
                      <div
                        class="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-[10px] font-medium text-white tabular-nums"
                      >
                        {{ getClipDuration(clip) }}
                      </div>
                      <!-- Play overlay on hover -->
                      <div
                        class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      >
                        <PlayIcon class="w-6 h-6 text-white" />
                      </div>
                    </div>

                    <!-- Content -->
                    <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <!-- Header: Title & Actions -->
                      <div class="flex items-start justify-between gap-2">
                        <div class="flex items-start gap-2 min-w-0">
                          <span class="text-xs font-bold text-foreground/30 mt-0.5 tabular-nums select-none">
                            #{{ index + 1 }}
                          </span>
                          <h5 class="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                            {{ clip.current_version?.name || clip.name || 'Untitled Clip' }}
                          </h5>
                        </div>

                        <!-- Actions -->
                        <div
                          class="flex items-center gap-0.5 transition-opacity duration-200 flex-shrink-0 -mr-1 -mt-1"
                          :class="
                            hasCompletedBuilds(clip) || clip.build_status === 'building'
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100'
                          "
                        >
                          <!-- Play button (preview) -->
                          <button
                            class="p-1.5 hover:bg-violet-500/15 rounded-md transition-colors text-foreground/60 hover:text-violet-400"
                            title="Preview clip"
                            @click.stop="previewClip(clip)"
                          >
                            <PlayIcon class="h-4 w-4" />
                          </button>

                          <!-- Edit button (open in segment) -->
                          <button
                            class="p-1.5 hover:bg-blue-500/15 rounded-md transition-colors text-foreground/60 hover:text-blue-400"
                            title="Edit in Segment"
                            @click.stop="openSegmentWithClip(clip)"
                          >
                            <ExternalLink class="h-4 w-4" />
                          </button>

                          <!-- Build button -->
                          <button
                            v-if="clip.build_status !== 'building'"
                            class="p-1.5 hover:bg-green-500/15 rounded-md transition-colors text-foreground/60 hover:text-green-400"
                            title="Build clip"
                            @click.stop="onFolderBuildClip(clip)"
                          >
                            <Hammer class="h-4 w-4" />
                          </button>

                          <!-- Download dropdown (only when built) -->
                          <div v-if="hasCompletedBuilds(clip)" class="relative">
                            <button
                              :ref="(el) => setFolderDropdownButtonRef(el, clip.id)"
                              class="p-1.5 hover:bg-green-500/15 rounded-md transition-colors text-green-500/80 hover:text-green-400 flex items-center gap-0.5"
                              title="Download built clip"
                              @click.stop="toggleFolderDownloadDropdown(clip.id)"
                            >
                              <DownloadIcon class="h-4 w-4" />
                              <ChevronDownIcon class="h-3 w-3" />
                            </button>

                            <!-- Dropdown menu with list of all builds - Teleported to body -->
                            <Teleport to="body">
                              <div
                                v-if="folderDownloadDropdownId === clip.id"
                                class="fixed z-[9999] min-w-[260px] max-w-[340px] bg-popover border border-border rounded-md shadow-lg py-1 max-h-[300px] overflow-y-auto"
                                :style="getFolderDropdownPosition(clip.id)"
                                @click.stop
                              >
                                <div
                                  class="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border/50 mb-1 flex items-center justify-between"
                                >
                                  <span>Downloads ({{ getDownloadableFilesCount(clip) }})</span>
                                </div>
                                <!-- Individual file items from all builds -->
                                <button
                                  v-for="(file, fileIdx) in getDownloadableFiles(clip)"
                                  :key="`${file.build.id}-${fileIdx}`"
                                  class="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/50 flex items-center gap-3 border-b border-border/20 last:border-b-0"
                                  @click.stop="
                                    onFolderSaveFile(file.filePath);
                                    closeFolderDownloadDropdown();
                                  "
                                >
                                  <DownloadIcon class="h-4 w-4 text-green-500 flex-shrink-0" />
                                  <div class="flex-1 min-w-0">
                                    <div class="text-xs font-medium truncate flex items-center gap-1.5">
                                      <span v-if="file.aspectRatio" class="text-primary/80 font-semibold">
                                        {{ file.aspectRatio }}
                                      </span>
                                      <span class="text-muted-foreground/70">#{{ file.build.build_number }}</span>
                                      <span class="truncate">{{ getBuildFileName(file.filePath) }}</span>
                                    </div>
                                    <div class="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                      <span v-if="file.build.completed_at">
                                        {{ formatBuildDate(file.build.completed_at) }}
                                      </span>
                                      <span v-if="file.build.file_size && getDownloadableFiles(clip).length === 1">
                                        {{ formatFileSize(file.build.file_size) }}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                                <!-- Fallback for legacy builds (clip.built_file_path) -->
                                <button
                                  v-if="getDownloadableFilesCount(clip) === 0 && clip.built_file_path"
                                  class="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/50 flex items-center gap-3"
                                  @click.stop="
                                    onFolderSaveFile(clip.built_file_path);
                                    closeFolderDownloadDropdown();
                                  "
                                >
                                  <DownloadIcon class="h-4 w-4 text-green-500 flex-shrink-0" />
                                  <div class="flex-1 min-w-0">
                                    <div class="text-xs font-medium truncate">
                                      {{ getBuildFileName(clip.built_file_path) }}
                                    </div>
                                  </div>
                                </button>
                              </div>
                            </Teleport>
                          </div>

                          <!-- Delete button -->
                          <button
                            v-if="!hasCompletedBuilds(clip)"
                            class="p-1.5 hover:bg-red-500/15 rounded-md transition-colors text-foreground/60 hover:text-red-400"
                            title="Delete clip"
                            @click.stop="deleteFolderClip(clip.id)"
                          >
                            <Trash2 class="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <!-- Metrics Row -->
                      <div class="flex items-center flex-wrap gap-2">
                        <!-- Segment Badge -->
                        <div
                          class="inline-flex items-center gap-1.5 text-[11px] font-medium text-foreground/70 bg-primary/10 px-2 py-0.5 rounded border border-primary/20"
                        >
                          <FolderOpen class="h-3 w-3 opacity-70" />
                          <span class="truncate max-w-[120px]">{{ clip.segment_name }}</span>
                        </div>

                        <!-- Virality Score -->
                        <div
                          v-if="
                            clip.current_version_virality_score !== undefined &&
                            clip.current_version_virality_score !== null
                          "
                          class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium transition-colors"
                          :class="getViralityColorClass(clip.current_version_virality_score)"
                          title="Predicted Virality Score"
                        >
                          <Flame class="h-3 w-3" />
                          <span>{{ Math.round(clip.current_version_virality_score) }}%</span>
                        </div>

                        <!-- Confidence (more subtle) -->
                        <div
                          v-if="clip.current_version_confidence_score"
                          class="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/60"
                          title="AI Confidence Score"
                        >
                          <BrainIcon class="h-3 w-3" />
                          <span>{{ Math.round((clip.current_version_confidence_score || 0) * 100) }}%</span>
                        </div>
                      </div>

                      <!-- Footer Info -->
                      <div class="flex items-center justify-between text-[11px] text-muted-foreground/60 mt-auto">
                        <div class="flex items-center gap-3">
                          <span class="font-mono tabular-nums">
                            {{ formatClipTime(clip.current_version_start_time || 0) }} -
                            {{ formatClipTime(clip.current_version_end_time || 0) }}
                          </span>

                          <!-- Build Status -->
                          <span v-if="clip.build_status === 'building'" class="text-blue-400 flex items-center gap-1">
                            <Loader2 class="h-3 w-3 animate-spin" />
                            Building...
                          </span>
                          <span v-else-if="hasCompletedBuilds(clip)" class="text-green-400 flex items-center gap-1">
                            <Check class="h-3 w-3" />
                            {{ getDownloadableFilesCount(clip) || 1 }} File{{
                              (getDownloadableFilesCount(clip) || 1) !== 1 ? 's' : ''
                            }}
                          </span>
                        </div>

                        <!-- Run Info -->
                        <div class="flex items-center gap-2">
                          <span v-if="clip.run_number" class="flex items-center gap-1.5">
                            <div
                              class="w-2 h-2 rounded-full"
                              :style="{ backgroundColor: clip.session_run_color || '#8B5CF6' }"
                            ></div>
                            Run {{ clip.run_number }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Video Player -->
            <div class="flex-1 flex flex-col p-4 overflow-y-auto">
              <!-- No clip selected state -->
              <div
                v-if="!clipToPreview"
                class="flex-1 flex flex-col items-center justify-center text-center bg-black/20 rounded-xl border border-border/30"
              >
                <div class="w-20 h-20 bg-muted/10 rounded-full flex items-center justify-center mb-4">
                  <PlayIcon class="w-10 h-10 text-muted-foreground/40" />
                </div>
                <h3 class="text-lg font-medium text-foreground/80 mb-2">Select a Clip to Preview</h3>
                <p class="text-sm text-muted-foreground/60 max-w-xs">
                  Click on any clip from the list to preview it here
                </p>
              </div>

              <!-- Video Player -->
              <template v-else>
                <!-- Clip Info Header -->
                <div class="flex items-center justify-between mb-3">
                  <div class="min-w-0 flex-1">
                    <h3 class="text-base font-semibold text-foreground truncate">
                      {{ clipToPreview.current_version?.name || clipToPreview.name || 'Untitled Clip' }}
                    </h3>
                    <p class="text-xs text-muted-foreground flex items-center gap-2">
                      <span class="truncate">{{ clipToPreview.segment_name }}</span>
                    </p>
                  </div>
                  <button
                    @click="closeClipPreview"
                    class="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground flex-shrink-0"
                    title="Close preview"
                  >
                    <X class="h-4 w-4" />
                  </button>
                </div>

                <!-- Video Container - Fixed 16:9 aspect ratio with custom controls -->
                <div
                  ref="inlineVideoContainerRef"
                  class="w-full aspect-video bg-black rounded-lg overflow-hidden relative group"
                  :class="{ 'inline-video-fullscreen': isInlineVideoFullscreen }"
                >
                  <video
                    v-if="inlineVideoSrc"
                    ref="inlineVideoRef"
                    class="w-full h-full object-contain"
                    :src="inlineVideoSrc"
                    @loadedmetadata="onInlineVideoLoaded"
                    @timeupdate="onInlineVideoTimeUpdate"
                    @ended="onInlineVideoEnded"
                    @click="toggleInlineVideoPlay"
                  ></video>
                  <div v-else-if="inlineVideoLoading" class="w-full h-full flex items-center justify-center">
                    <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <p class="text-muted-foreground text-sm">No video source available</p>
                  </div>

                  <!-- Watermark Overlay -->
                  <div
                    v-if="previewWatermarkData && previewWatermarkSettings && inlineVideoSrc"
                    class="absolute pointer-events-none z-10 transition-opacity duration-300"
                    :style="getPreviewWatermarkStyle"
                  >
                    <img
                      :src="previewWatermarkData.dataUrl"
                      alt="Watermark"
                      :class="isPreviewWatermarkFullFrame ? '' : 'max-w-full max-h-full object-contain'"
                      :style="getPreviewWatermarkImageStyle"
                    />
                  </div>

                  <!-- Custom Video Controls -->
                  <div
                    v-if="inlineVideoSrc"
                    class="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    :class="isInlineVideoFullscreen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                  >
                    <!-- Full-width Progress Bar -->
                    <div
                      ref="inlineProgressBarRef"
                      class="relative h-4 w-full cursor-pointer group/progress flex items-center"
                      @mousedown="startInlineSeekDrag"
                      @mousemove="onInlineTimelineHover"
                      @mouseleave="onInlineTimelineLeave"
                    >
                      <!-- Visual track (centered in larger hit area) -->
                      <div class="absolute inset-x-0 h-1 top-1/2 -translate-y-1/2">
                        <!-- Background track -->
                        <div class="absolute inset-0 bg-white/20"></div>
                        <!-- Progress Bar -->
                        <div
                          class="absolute h-full bg-violet-500"
                          :class="{ 'transition-all duration-75': !inlineSeekDragging }"
                          :style="{ width: `${inlineVideoProgress}%` }"
                        ></div>
                      </div>
                      <!-- Seek thumb - always visible, larger during drag -->
                      <div
                        class="absolute top-1/2 bg-violet-400 rounded-full shadow-md pointer-events-none"
                        :class="[
                          inlineSeekDragging ? 'w-4 h-4' : 'w-3 h-3',
                          { 'transition-all duration-75': !inlineSeekDragging },
                        ]"
                        :style="{ left: `${inlineVideoProgress}%`, transform: 'translate(-50%, -50%)' }"
                      ></div>
                      <!-- Hover/drag time preview -->
                      <div
                        v-if="inlineHoverTime !== null || inlineSeekDragging"
                        class="absolute -top-8 bg-black/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded font-medium whitespace-nowrap z-20 pointer-events-none"
                        :style="{
                          left: `${inlineSeekDragging ? inlineVideoProgress : inlineHoverPosition}%`,
                          transform: 'translateX(-50%)',
                        }"
                      >
                        {{
                          formatDuration(
                            inlineSeekDragging
                              ? (inlineVideoProgress / 100) * inlineVideoClipDuration
                              : (inlineHoverTime ?? 0)
                          )
                        }}
                      </div>
                    </div>

                    <!-- Controls Row -->
                    <div class="flex items-center justify-between px-3 py-2">
                      <div class="flex items-center gap-3">
                        <!-- Play/Pause -->
                        <button @click="toggleInlineVideoPlay" class="text-white hover:text-primary transition-colors">
                          <PlayIcon v-if="!inlineVideoPlaying" class="w-5 h-5" />
                          <Pause v-else class="w-5 h-5" />
                        </button>

                        <!-- Volume -->
                        <div class="flex items-center gap-1.5 group/volume">
                          <button
                            @click="toggleInlineVideoMute"
                            class="text-white hover:text-primary transition-colors"
                          >
                            <VolumeX v-if="inlineVideoMuted || inlineVideoVolume === 0" class="w-4 h-4" />
                            <Volume2 v-else class="w-4 h-4" />
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            :value="inlineVideoMuted ? 0 : inlineVideoVolume"
                            @input="setInlineVideoVolume"
                            class="w-16 h-1 bg-white/20 rounded-full appearance-none cursor-pointer opacity-0 group-hover/volume:opacity-100 transition-opacity [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                          />
                        </div>

                        <!-- Time Display -->
                        <span class="text-white text-xs font-mono tabular-nums">
                          {{ formatClipTime(inlineVideoCurrentTime) }} / {{ formatClipTime(inlineVideoClipDuration) }}
                        </span>
                      </div>

                      <!-- Fullscreen -->
                      <button
                        @click="toggleInlineVideoFullscreen"
                        class="text-white hover:text-primary transition-colors"
                        :title="isInlineVideoFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
                      >
                        <Minimize2 v-if="isInlineVideoFullscreen" class="w-4 h-4" />
                        <Maximize2 v-else class="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <!-- Play overlay when paused -->
                  <div
                    v-if="inlineVideoSrc && !inlineVideoPlaying && !inlineVideoLoading"
                    class="absolute inset-0 flex items-center justify-center cursor-pointer"
                    @click="toggleInlineVideoPlay"
                  >
                    <div class="w-16 h-16 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <PlayIcon class="w-8 h-8 text-white ml-1" />
                    </div>
                  </div>
                </div>

                <!-- Clip Description -->
                <div v-if="clipToPreview.current_version_detection_reason" class="mt-3 p-2.5 bg-muted/20 rounded-lg">
                  <p class="text-xs text-muted-foreground italic line-clamp-2">
                    "{{ clipToPreview.current_version_detection_reason }}"
                  </p>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Footer with Pagination (only for segments tab) -->
        <div
          v-if="folderActiveTab === 'segments' && folderTotalPages > 1"
          class="px-6 py-4 border-t border-border bg-muted/10 flex justify-center"
        >
          <PaginationFooter
            :current-page="folderCurrentPage"
            :total-pages="folderTotalPages"
            :total-items="getEffectiveSegmentCount(folderProject.id)"
            item-label="part"
            @go-to-page="(page) => (folderCurrentPage = page)"
            @previous="folderCurrentPage--"
            @next="folderCurrentPage++"
          />
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="showDeleteDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <div class="bg-card rounded-lg p-8 max-w-md w-full mx-4 border border-border">
        <h2 class="text-2xl font-bold mb-4">
          {{ projectHasVideos || projectHasClips ? 'Delete Project with Content' : 'Delete Project' }}
        </h2>

        <div class="space-y-4">
          <p class="text-muted-foreground">
            <span v-if="projectHasVideos && projectHasClips">
              This project contains both videos and detected clips. Deleting this project will remove the project
              structure, but all videos and clips will remain in your library.
            </span>
            <span v-else-if="projectHasVideos">
              This project contains videos. Deleting this project will remove the project structure, but all videos will
              remain in your library.
            </span>
            <span v-else-if="projectHasClips">
              This project contains detected clips. Deleting this project will remove the project structure, but all
              clips will remain in your library.
            </span>
            <span v-else>Are you sure you want to delete</span>
            "
            <span class="font-semibold text-foreground">{{ projectToDelete?.name }}</span>
            "?
            <span class="block mt-1">This action cannot be undone.</span>
          </p>

          <!-- Segments deletion option - only show if more than 1 segment -->
          <div
            v-if="hasChildren(projectToDelete?.id || '') && getChildCount(projectToDelete?.id || '') > 1"
            class="bg-muted/50 rounded-lg p-4 border border-border"
          >
            <p class="text-sm text-muted-foreground mb-3">
              This project contains
              <span class="font-semibold text-foreground">{{ getChildCount(projectToDelete?.id || '') }} segments</span>
              . What would you like to do with them?
            </p>
            <div class="space-y-2">
              <label
                class="flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors"
                :class="!deleteSegmentsToo ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'"
              >
                <input
                  type="radio"
                  :value="false"
                  v-model="deleteSegmentsToo"
                  class="w-4 h-4 text-primary accent-primary"
                />
                <div>
                  <span class="text-sm font-medium text-foreground">Keep segments</span>
                  <p class="text-xs text-muted-foreground">Segments will be un-grouped and remain in your library</p>
                </div>
              </label>
              <label
                class="flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors"
                :class="deleteSegmentsToo ? 'bg-red-500/10 border border-red-500/30' : 'hover:bg-muted'"
              >
                <input
                  type="radio"
                  :value="true"
                  v-model="deleteSegmentsToo"
                  class="w-4 h-4 text-red-500 accent-red-500"
                />
                <div>
                  <span class="text-sm font-medium text-foreground">Delete all segments</span>
                  <p class="text-xs text-muted-foreground">
                    All {{ getChildCount(projectToDelete?.id || '') }} segments will be permanently deleted
                  </p>
                </div>
              </label>
            </div>
          </div>

          <!-- Single segment notice - auto-deleted with parent -->
          <div
            v-else-if="hasChildren(projectToDelete?.id || '') && getChildCount(projectToDelete?.id || '') === 1"
            class="bg-muted/50 rounded-lg p-4 border border-border"
          >
            <p class="text-sm text-muted-foreground">
              This project contains
              <span class="font-semibold text-foreground">1 segment</span>
              which will also be deleted along with its video files.
            </p>
          </div>
          <button
            class="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md font-semibold hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            @click="deleteProjectConfirmed"
            :disabled="deletingProject"
          >
            {{
              deleteSegmentsToo && hasChildren(projectToDelete?.id || '')
                ? getChildCount(projectToDelete?.id || '') === 1
                  ? 'Delete Project & Segment'
                  : `Delete Project & ${getChildCount(projectToDelete?.id || '')} Segments`
                : 'Delete Project'
            }}
          </button>
          <button
            class="w-full py-3 bg-muted text-foreground rounded-md font-semibold hover:bg-muted/80 transition-all"
            @click="handleDeleteDialogClose"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Bulk Delete Confirmation Modal -->
    <div
      v-if="showBulkDeleteDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <div class="bg-card rounded-lg p-8 max-w-md w-full mx-4 border border-border">
        <h2 class="text-2xl font-bold mb-4">Delete {{ selectedProjects.size }} Projects</h2>

        <div class="space-y-4">
          <p class="text-muted-foreground">
            Are you sure you want to delete
            <span class="font-semibold text-foreground">{{ selectedProjects.size }} projects</span>
            ? This will also delete all associated segments and video files.
            <span class="block mt-1">This action cannot be undone.</span>
          </p>

          <button
            class="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md font-semibold hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            @click="bulkDeleteConfirmed"
            :disabled="bulkDeleting"
          >
            Delete {{ selectedProjects.size }} Projects
          </button>
          <button
            class="w-full py-3 bg-muted text-foreground rounded-md font-semibold hover:bg-muted/80 transition-all"
            @click="handleBulkDeleteDialogClose"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Bulk Delete Folder Children Confirmation Modal -->
    <div
      v-if="showBulkDeleteFolderChildrenDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]"
    >
      <div class="bg-card rounded-lg p-8 max-w-md w-full mx-4 border border-border">
        <h2 class="text-2xl font-bold mb-4">Delete {{ selectedFolderChildren.size }} Segments</h2>

        <div class="space-y-4">
          <p class="text-muted-foreground">
            Are you sure you want to delete
            <span class="font-semibold text-foreground">
              {{ selectedFolderChildren.size }} segment{{ selectedFolderChildren.size !== 1 ? 's' : '' }}
            </span>
            ? This will also delete all associated video files.
            <span class="block mt-1">This action cannot be undone.</span>
          </p>

          <button
            class="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md font-semibold hover:from-red-700 hover:to-red-800 transition-all"
            @click="bulkDeleteFolderChildrenConfirmed"
          >
            Delete {{ selectedFolderChildren.size }} Segments
          </button>
          <button
            class="w-full py-3 bg-muted text-foreground rounded-md font-semibold hover:bg-muted/80 transition-all"
            @click="handleBulkDeleteFolderChildrenDialogClose"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import {
    Folder,
    Plus,
    Play,
    Edit,
    Trash2,
    Radio,
    List,
    FolderOpen,
    X,
    Search,
    Clock,
    Monitor,
    Check,
    Sparkles,
    Loader2,
    Video,
    Flame,
    ExternalLink,
    PlayIcon,
    Hammer,
    DownloadIcon,
    ChevronDownIcon,
    BrainIcon,
    Pause,
    VolumeX,
    Volume2,
    Maximize2,
    Minimize2,
  } from 'lucide-vue-next';
  import {
    getAllProjects,
    getClipsWithVersionsByProjectId,
    getClipsWithVersionsForProjectAndChildren,
    deleteProject,
    createProject,
    updateProject,
    getRawVideosByProjectId,
    hasRawVideosForProject,
    hasClipsForProject,
    deleteClip,
    getCreatorProfileByProjectId,
    getIntroOutroById,
    getWatermarkByServerId,
    type Project,
    type RawVideo,
    type ClipWithVersionAndSegment,
    type IntroOutro,
    type WatermarkSettings,
  } from '@/services/database';
  import { getWatermarkImage } from '@/services/database/watermarks';
  import { extractMintId } from '@/services/pumpfun';
  import { useFormatters } from '@/composables/useFormatters';
  import { useToast } from '@/composables/useToast';
  import { useLivestreamMonitoring } from '@/composables/useLivestreamMonitoring';
  import { useVideoOperations } from '@/composables/useVideoOperations';
  import { useDownloads } from '@/composables/useDownloads';
  import PageLayout from '@/components/PageLayout.vue';
  import SkeletonGrid from '@/components/SkeletonGrid.vue';
  import ProjectDialog, { type ProjectFormData } from '@/components/ProjectDialog.vue';
  import ProjectWorkspaceDialog from '@/components/ProjectWorkspaceDialog.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import { Input } from '@/components/ui/input';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import DownloadCard from '@/components/DownloadCard.vue';
  import ClipDetectionConfirmDialog from '@/components/ClipDetectionConfirmDialog.vue';
  import ClipBuildSettingsDialog, {
    type BuildSettings,
    type IntroOutroItem,
  } from '@/components/ClipBuildSettingsDialog.vue';
  import { ensureAssetDownloaded, type ServerOrganizationAsset } from '@/services/orgAssetSync';
  import { getUserOrganizationAssets } from '@/services/organizationAssetsApi';
  import { useChunkedClipDetection } from '@/composables/useChunkedClipDetection';
  import { useAuthStore } from '@/stores/auth';
  import { useClipDetectionTracking } from '@/composables/useClipDetectionTracking';
  import { useSubscriptionGate } from '@/composables/useSubscriptionGate';
  import { useAIPermission } from '@/composables/useAIPermission';
  // AI Permission check
  const { isAIAllowed } = useAIPermission();
  const { gates } = useSubscriptionGate();
  import { utf8ToBase64 } from '@/utils/encoding';
  import { save } from '@tauri-apps/plugin-dialog';

  const projects = ref<Project[]>([]);
  const loading = ref(true);
  const clipCounts = ref<Record<string, number>>({});
  const showDialog = ref(false);
  const selectedProject = ref<Project | null>(null);
  const showDeleteDialog = ref(false);
  const projectToDelete = ref<Project | null>(null);
  const projectHasVideos = ref(false);
  const projectHasClips = ref(false);
  const deleteSegmentsToo = ref(false);
  const showWorkspaceDialog = ref(false);
  const workspaceProject = ref<Project | null>(null);
  const workspaceInitialClipId = ref<string | null>(null);
  const projectVideos = ref<Record<string, RawVideo[]>>({});
  const thumbnailCache = ref<Map<string, string>>(new Map());
  const clipThumbnailCache = ref<Map<string, string>>(new Map());
  const { getRelativeTime, formatDuration } = useFormatters();
  const { success, error } = useToast();
  const { activeSessions } = useLivestreamMonitoring();
  const { processVideoFile } = useVideoOperations();
  const {
    getActiveDownloads,
    getQueuedDownloads,
    getCompletedDownloads,
    initialize: initializeDownloads,
  } = useDownloads();

  // View state
  const viewMode = ref<'folders' | 'list'>('folders');
  const showFolderDialog = ref(false);
  const folderProject = ref<Project | null>(null);
  // Delete state
  const deletingProject = ref(false);
  const bulkDeleting = ref(false);

  // Multi-select state
  const selectedProjects = ref<Set<string>>(new Set());
  const showBulkDeleteDialog = ref(false);
  const selectedFolderChildren = ref<Set<string>>(new Set());
  const showBulkDeleteFolderChildrenDialog = ref(false);

  // Project-level clip detection state
  const showProjectDetectDialog = ref(false);
  const projectToDetect = ref<Project | null>(null);
  const segmentsToDetect = ref<Project[]>([]);
  const totalDetectionDuration = ref(0);
  const isDetectingProject = ref(false);
  const authStore = useAuthStore();
  const { startDetection, updateProgress, completeDetection, isDetectionActive } = useClipDetectionTracking();

  // Filter state
  const searchQuery = ref('');
  const sortBy = ref('updated-desc');
  const statusFilter = ref('all');

  const statusOptions = [
    { label: 'All Status', value: 'all' },
    { label: 'Live Now', value: 'live' },
    { label: 'Has Clips', value: 'has_clips' },
  ];

  const sortOptions = [
    { label: 'Updated: Newest', value: 'updated-desc' },
    { label: 'Updated: Oldest', value: 'updated-asc' },
    { label: 'Created: Newest', value: 'created-desc' },
    { label: 'Created: Oldest', value: 'created-asc' },
    { label: 'Name: A-Z', value: 'name-asc' },
    { label: 'Name: Z-A', value: 'name-desc' },
  ];

  // Pagination state
  const currentPage = ref(1);
  const projectsPerPage = 20;

  async function loadProjects(isBackgroundRefresh = false) {
    console.log('[Projects] loadProjects called, isBackgroundRefresh:', isBackgroundRefresh);
    if (!isBackgroundRefresh) {
      loading.value = true;
    }
    try {
      projects.value = await getAllProjects();
      console.log('[Projects] Loaded projects:', projects.value.length, 'total');
      console.log('[Projects] Top-level projects:', projects.value.filter((p) => !p.parent_id).length);
      console.log('[Projects] Child projects:', projects.value.filter((p) => p.parent_id).length);

      // Load clip counts and video thumbnails for each project
      for (const project of projects.value) {
        const clips = await getClipsWithVersionsByProjectId(project.id);
        clipCounts.value[project.id] = clips.length;

        // Load videos for this project
        const videos = await getRawVideosByProjectId(project.id);
        projectVideos.value[project.id] = videos;

        // Load project thumbnail or use first video's thumbnail
        // If we're doing a background refresh, we might want to re-verify thumbnails for modified projects
        // But checking !has() is usually enough if we clear the cache for modified projects before calling this
        if (!thumbnailCache.value.has(project.id)) {
          if (project.thumbnail_path) {
            // Use project's stored thumbnail if available
            try {
              const dataUrl = await invoke<string>('read_file_as_data_url', {
                filePath: project.thumbnail_path,
              });
              thumbnailCache.value.set(project.id, dataUrl);
            } catch (error) {
              console.warn('Failed to load project thumbnail:', project.id, error);
            }
          } else if (videos.length > 0 && videos[0].thumbnail_path) {
            // Fall back to first video's thumbnail
            try {
              // Update the project object in memory
              project.thumbnail_path = videos[0].thumbnail_path;

              const dataUrl = await invoke<string>('read_file_as_data_url', {
                filePath: videos[0].thumbnail_path,
              });
              thumbnailCache.value.set(project.id, dataUrl);

              // Save this thumbnail to the project for future use
              await updateProject(project.id, undefined, undefined, videos[0].thumbnail_path);
            } catch (error) {
              console.warn('Failed to load video thumbnail for project:', project.id, error);
            }
          } else {
            // Check if it's a parent project and try to get thumbnail from children
            // This handles auto-segmented projects that have child projects but no direct videos yet
            try {
              // We can find children from the already loaded projects list if available,
              // or we might need to check if we have child projects that are segments
              // Since projects is already populated with all projects, let's check for children
              // But we are inside the loop populating it.
              // Let's try to find any project with parent_id === project.id
              const children = projects.value.filter((p) => p.parent_id === project.id);
              if (children.length > 0) {
                // Found children, try to get a thumbnail from one of them
                for (const child of children) {
                  // Try to find thumbnail from child project directly
                  let childThumb = child.thumbnail_path;

                  // If not on project, check if we have videos for this child already loaded
                  if (!childThumb && projectVideos.value[child.id]?.length > 0) {
                    childThumb = projectVideos.value[child.id][0].thumbnail_path;
                  }

                  if (childThumb) {
                    // Set thumbnail on the parent project object in memory
                    project.thumbnail_path = childThumb;

                    const dataUrl = await invoke<string>('read_file_as_data_url', {
                      filePath: childThumb,
                    });
                    thumbnailCache.value.set(project.id, dataUrl);

                    // Save to parent in DB if not already set
                    await updateProject(project.id, undefined, undefined, childThumb);
                    break;
                  } else {
                    // Force fetch child videos if not yet loaded (rare race condition fallback)
                    try {
                      const childVideos = await getRawVideosByProjectId(child.id);
                      projectVideos.value[child.id] = childVideos;

                      if (childVideos.length > 0 && childVideos[0].thumbnail_path) {
                        childThumb = childVideos[0].thumbnail_path;
                        project.thumbnail_path = childThumb;
                        const dataUrl = await invoke<string>('read_file_as_data_url', {
                          filePath: childThumb,
                        });
                        thumbnailCache.value.set(project.id, dataUrl);
                        await updateProject(project.id, undefined, undefined, childThumb);
                        break;
                      }
                    } catch (e) {
                      console.warn('Failed to fetch child videos for thumbnail propagation', e);
                    }
                  }
                }
              }
            } catch (error) {
              console.warn('Failed to load thumbnail from children for project:', project.id, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      loading.value = false;
    }
  }

  function getProjectDuration(projectId: string): string | null {
    const videos = projectVideos.value[projectId];
    if (videos && videos.length > 0) {
      const duration = videos.reduce((acc, v) => acc + (v.duration || 0), 0);
      if (duration > 0) {
        return formatDuration(duration);
      }
    }
    return null;
  }

  function getProjectPlatform(project: Project): 'PumpFun' | 'Kick' | 'Youtube' | 'Twitch' | 'Manual' | null {
    // 0. Check explicit platform field
    if (project.platform) {
      return project.platform;
    }

    // 1. Check description for explicit source
    if (project.description) {
      const desc = project.description.toLowerCase();
      if (desc.includes('kick')) return 'Kick';
      if (desc.includes('pumpfun')) return 'PumpFun';
      if (desc.includes('youtube')) return 'Youtube';
      if (desc.includes('twitch')) return 'Twitch';
    }

    // 2. Check videos
    const videos = projectVideos.value[project.id];
    if (videos && videos.length > 0) {
      // Check first video
      const v = videos[0];
      if (v.source_mint_id) {
        // Try to guess from ID format if description failed
        // Note: extractMintId is very permissive and matches simple words like "games" (Kick slug)
        // so we check length to differentiate Mint IDs (long) from slugs (short)
        const isLikelyMintId = v.source_mint_id.length >= 32 && extractMintId(v.source_mint_id);

        if (isLikelyMintId) return 'PumpFun';
        return 'Kick';
      } else {
        return 'Manual';
      }
    }

    // 3. Check children if folder
    if (hasChildren(project.id)) {
      const children = getFolderChildren(project.id);
      if (children.length > 0) return getProjectPlatform(children[0]);
    }

    return null;
  }

  function getClipCount(projectId: string): number {
    const ownCount = clipCounts.value[projectId] || 0;
    const children = childrenMap.value.get(projectId);

    if (children && children.length > 0) {
      return children.reduce((acc, child) => acc + (clipCounts.value[child.id] || 0), ownCount);
    }

    return ownCount;
  }

  function getThumbnailUrl(projectId: string): string | null {
    return thumbnailCache.value.get(projectId) || null;
  }

  // Get thumbnail URL for a clip - uses cached data URLs
  function getClipThumbnailUrl(clip: ClipWithVersionAndSegment): string | null {
    // Check clip thumbnail cache first
    const cachedThumbnail = clipThumbnailCache.value.get(clip.id);
    if (cachedThumbnail) {
      return cachedThumbnail;
    }
    // Fall back to segment thumbnail
    return getThumbnailUrl(clip.segment_id);
  }

  function isProjectLive(projectId: string) {
    for (const session of activeSessions.value.values()) {
      if (session.projectId === projectId) {
        return true;
      }
    }
    return false;
  }

  // Helper to map parentId -> children
  const childrenMap = computed(() => {
    const map = new Map<string, Project[]>();
    for (const p of projects.value) {
      if (p.parent_id) {
        if (!map.has(p.parent_id)) {
          map.set(p.parent_id, []);
        }
        map.get(p.parent_id)?.push(p);
      }
    }
    return map;
  });

  function hasChildren(projectId: string): boolean {
    return (childrenMap.value.get(projectId)?.length || 0) > 0;
  }

  function getChildCount(projectId: string): number {
    return childrenMap.value.get(projectId)?.length || 0;
  }

  // Check if project has videos directly attached (for standalone projects)
  function hasDirectVideos(projectId: string): boolean {
    const videos = projectVideos.value[projectId];
    return videos && videos.length > 0;
  }

  // Get the effective segments for a project (children if any, or the project itself if standalone with videos)
  function getEffectiveSegments(projectId: string): Project[] {
    const children = getFolderChildren(projectId);
    if (children.length > 0) {
      return children;
    }
    // For standalone projects with videos, return the project itself as a "segment"
    const project = projects.value.find((p) => p.id === projectId);
    if (project && hasDirectVideos(projectId)) {
      return [project];
    }
    return [];
  }

  function getEffectiveSegmentCount(projectId: string): number {
    return getEffectiveSegments(projectId).length;
  }

  // Folder dialog pagination
  const folderCurrentPage = ref(1);
  const folderItemsPerPage = 6;

  // Folder dialog tabs and clips
  const folderActiveTab = ref<'segments' | 'clips'>('segments');
  const folderClips = ref<ClipWithVersionAndSegment[]>([]);
  const folderClipsLoading = ref(false);
  const folderClipToBuild = ref<ClipWithVersionAndSegment | null>(null);
  const showFolderBuildDialog = ref(false);
  const folderDownloadDropdownId = ref<string | null>(null);

  // Creator profile defaults for folder dialog builds
  const folderCreatorDefaultIntro = ref<IntroOutro | null>(null);
  const folderCreatorDefaultOutro = ref<IntroOutro | null>(null);
  const folderCreatorWatermarkSettings = ref<WatermarkSettings | null>(null);

  // Store unlisten functions for Tauri event cleanup
  const clipBuildUnlistenFunctions = ref<UnlistenFn[]>([]);

  // Computed class for folder dialog width based on active tab and content
  const folderDialogWidthClass = computed(() => {
    if (folderActiveTab.value === 'clips') {
      // Wide layout for 2-column view with inline video player
      return 'max-w-6xl';
    }
    // For segments tab, base width on segment count
    const segmentCount = folderProject.value ? getEffectiveSegmentCount(folderProject.value.id) : 0;
    if (segmentCount <= 1) return 'max-w-lg';
    if (segmentCount === 2) return 'max-w-3xl';
    return 'max-w-5xl';
  });
  const folderDropdownButtonRefs = ref<Map<string, HTMLElement>>(new Map());
  const clipToPreview = ref<ClipWithVersionAndSegment | null>(null);

  // Computed property to get video file path for clip preview
  const clipPreviewVideoPath = computed(() => {
    if (!clipToPreview.value) return null;
    const segmentId = clipToPreview.value.segment_id || clipToPreview.value.project_id;
    if (!segmentId) return null;
    const videos = projectVideos.value[segmentId];
    if (videos && videos.length > 0) {
      return videos[0].file_path;
    }
    return null;
  });

  // Computed style for watermark position
  const getPreviewWatermarkStyle = computed(() => {
    if (!previewWatermarkSettings.value) return {};

    const settings = previewWatermarkSettings.value;

    // The inline player is always 16:9, so check for per-ratio settings for 16:9
    const perRatio = settings.perRatioSettings;
    const ratioConfig = perRatio?.['16:9'];

    // Check for explicit full-frame overlay mode from per-ratio settings
    if (ratioConfig?.position?.isFullFrameOverlay) {
      return {
        width: '100%',
        height: '100%',
        left: '0%',
        top: '0%',
        transform: 'none',
      };
    }

    // Check for explicit full-frame overlay mode flag (top-level)
    if (settings.isFullFrameOverlay) {
      return {
        width: '100%',
        height: '100%',
        left: '0%',
        top: '0%',
        transform: 'none',
      };
    }

    // Check if this is a full-frame 1920x1080 watermark (16:9 overlay) - backward compatibility
    const wmWidth = previewWatermarkData.value?.width ?? null;
    const wmHeight = previewWatermarkData.value?.height ?? null;
    const ratio = wmWidth && wmHeight ? wmWidth / wmHeight : null;
    const is16x9 = ratio ? Math.abs(ratio - 16 / 9) < 0.02 : false;
    const isFullFrame = is16x9 && wmWidth !== null && wmHeight !== null && wmWidth >= 1600 && wmHeight >= 900;

    // Full-frame watermarks fill the entire video and sit at 0,0
    if (isFullFrame) {
      return {
        width: '100%',
        height: '100%',
        left: '0%',
        top: '0%',
        transform: 'none',
      };
    }

    // Use per-ratio position settings if available, otherwise fall back to top-level settings
    const positionX = ratioConfig?.position?.x ?? settings.positionX ?? 12;
    const positionY = ratioConfig?.position?.y ?? settings.positionY ?? 92;
    const scale = ratioConfig?.position?.scale ?? settings.scale ?? 20;

    return {
      left: `${positionX}%`,
      top: `${positionY}%`,
      transform: 'translate(-50%, -50%)',
      width: `${scale}%`,
      maxWidth: `${scale}%`,
    };
  });

  // Computed opacity for watermark (uses per-ratio settings if available)
  const getPreviewWatermarkOpacity = computed(() => {
    if (!previewWatermarkSettings.value) return 0.8;

    const settings = previewWatermarkSettings.value;

    // The inline player is always 16:9, so check for per-ratio settings for 16:9
    const perRatio = settings.perRatioSettings;
    const ratioConfig = perRatio?.['16:9'];

    // Use per-ratio opacity if available, otherwise fall back to top-level setting
    const opacity = ratioConfig?.position?.opacity ?? settings.opacity ?? 80;
    return opacity / 100;
  });

  // Check if preview watermark is in full-frame overlay mode
  const isPreviewWatermarkFullFrame = computed(() => {
    if (!previewWatermarkSettings.value) return false;

    const settings = previewWatermarkSettings.value;

    // The inline player is always 16:9, so check for per-ratio settings for 16:9
    const perRatio = settings.perRatioSettings;
    const ratioConfig = perRatio?.['16:9'];

    // Check for explicit full-frame overlay mode from per-ratio settings
    if (ratioConfig?.position?.isFullFrameOverlay) {
      return true;
    }

    // Check for explicit full-frame overlay mode flag (top-level)
    if (settings.isFullFrameOverlay) {
      return true;
    }

    // Check if this is a full-frame 1920x1080 watermark (16:9 overlay) - auto-detect
    const wmWidth = previewWatermarkData.value?.width ?? null;
    const wmHeight = previewWatermarkData.value?.height ?? null;
    const ratio = wmWidth && wmHeight ? wmWidth / wmHeight : null;
    const is16x9 = ratio ? Math.abs(ratio - 16 / 9) < 0.02 : false;
    const isFullFrame = is16x9 && wmWidth !== null && wmHeight !== null && wmWidth >= 1600 && wmHeight >= 900;

    return isFullFrame;
  });

  // Get preview watermark image style - for full-frame mode, fill the container
  const getPreviewWatermarkImageStyle = computed(() => {
    const baseStyle: Record<string, string | number> = {
      opacity: getPreviewWatermarkOpacity.value,
    };

    if (isPreviewWatermarkFullFrame.value) {
      return {
        ...baseStyle,
        width: '100%',
        height: '100%',
        objectFit: 'fill' as const,
      };
    }

    return baseStyle;
  });

  function getFolderChildren(projectId: string): Project[] {
    return childrenMap.value.get(projectId) || [];
  }

  // Load clips for folder view - loads thumbnails in parallel for better performance
  async function loadFolderClips(projectId: string) {
    folderClipsLoading.value = true;
    try {
      // Load clips from database
      folderClips.value = await getClipsWithVersionsForProjectAndChildren(projectId);

      // Load existing thumbnails in parallel (non-blocking, fast)
      loadClipThumbnailsInParallel();

      // Generate missing thumbnails in background (non-blocking, slow)
      generateMissingThumbnailsInBackground();
    } catch (e) {
      console.error('Failed to load folder clips:', e);
      folderClips.value = [];
    } finally {
      folderClipsLoading.value = false;
    }
  }

  // Load existing clip thumbnails in parallel (fast - just reading files)
  async function loadClipThumbnailsInParallel() {
    const clipsWithThumbnails = folderClips.value.filter(
      (clip) => clip.built_thumbnail_path && !clipThumbnailCache.value.has(clip.id)
    );

    if (clipsWithThumbnails.length === 0) return;

    // Load all thumbnails in parallel
    await Promise.all(
      clipsWithThumbnails.map(async (clip) => {
        try {
          const dataUrl = await invoke<string>('read_file_as_data_url', {
            filePath: clip.built_thumbnail_path,
          });
          clipThumbnailCache.value.set(clip.id, dataUrl);
        } catch (err) {
          console.warn('Failed to load clip thumbnail:', clip.id, err);
        }
      })
    );
  }

  // Generate thumbnails for clips that don't have one yet (background, non-blocking)
  async function generateMissingThumbnailsInBackground() {
    const clipsWithoutThumbnails = folderClips.value.filter((clip) => !clip.built_thumbnail_path);

    if (clipsWithoutThumbnails.length === 0) return;

    console.log(`[Projects] Generating thumbnails for ${clipsWithoutThumbnails.length} clips in background...`);

    // Process in parallel batches for better performance
    const batchSize = 3;
    for (let i = 0; i < clipsWithoutThumbnails.length; i += batchSize) {
      const batch = clipsWithoutThumbnails.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (clip) => {
          try {
            const segmentId = clip.segment_id || clip.project_id;
            if (!segmentId) return;

            let videos = projectVideos.value[segmentId];

            // Load videos on demand if not cached
            if (!videos || videos.length === 0) {
              try {
                videos = await getRawVideosByProjectId(segmentId);
                projectVideos.value[segmentId] = videos;
              } catch {
                return;
              }
            }

            if (videos && videos.length > 0) {
              const videoPath = videos[0].file_path;
              const startTime =
                clip.current_version?.start_time ?? clip.current_version_start_time ?? clip.start_time ?? 0;

              // Generate thumbnail at clip start time
              const thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
                videoPath: videoPath,
                timestampSeconds: startTime,
                outputFilename: `clip_${clip.id}`,
              });

              // Load the generated thumbnail into cache
              const dataUrl = await invoke<string>('read_file_as_data_url', {
                filePath: thumbnailPath,
              });
              clipThumbnailCache.value.set(clip.id, dataUrl);

              // Update the clip's thumbnail path
              clip.built_thumbnail_path = thumbnailPath;

              // Persist to database (non-blocking)
              const { updateClipBuildStatus } = await import('@/services/database');
              await updateClipBuildStatus(clip.id, clip.build_status || 'pending', {
                builtThumbnailPath: thumbnailPath,
              });
            }
          } catch (err) {
            console.warn('Failed to generate clip thumbnail:', clip.id, err);
          }
        })
      );
    }

    console.log('[Projects] Background thumbnail generation complete');
  }

  // Handle clip build progress events (for folder dialog builds)
  function handleFolderClipBuildProgress(event: any) {
    const payload = event.payload || event.detail;
    const { clip_id, progress, stage } = payload;

    // Skip completed stage - let the completion handler deal with it
    if (stage === 'completed') {
      return;
    }

    // Handle cancellation
    if (stage === 'cancelled') {
      const clip = folderClips.value.find((c) => c.id === clip_id);
      if (clip) {
        clip.build_status = 'pending';
        clip.build_progress = 0;
      }
      return;
    }

    // Update local state only - no database writes during progress
    // This keeps UI responsive without causing refreshes
    const clip = folderClips.value.find((c) => c.id === clip_id);
    if (clip) {
      clip.build_status = 'building';
      clip.build_progress = progress;
    }
  }

  // Handle clip build completion events (for folder dialog builds)
  function handleFolderClipBuildComplete(event: any) {
    const payload = event.payload || event.detail;
    if (!payload) return;

    const { clip_id, success: buildSuccess, output_path, all_output_paths, error: buildError } = payload;

    // Only process clips that belong to the folder view
    // This prevents duplicate processing when multiple components listen to the same event
    const clip = folderClips.value.find((c) => c.id === clip_id);
    if (!clip) {
      console.log(`[Projects] Clip ${clip_id} not in folder view, skipping database update`);
      return;
    }

    console.log(`[Projects] Clip build complete: ${clip_id}`, { buildSuccess, output_path });

    const isCancelled = buildError && (buildError.includes('cancelled') || buildError.includes('Cancelled'));

    // Update local state immediately for instant UI feedback
    if (buildSuccess) {
      clip.build_status = 'completed';
      clip.build_progress = 100;
      clip.built_file_path = output_path;
      // Update the builds array locally so download dropdown works immediately
      if (!clip.builds) clip.builds = [];
      const existingBuildIdx = clip.builds.findIndex((b: any) => b.status === 'building');
      if (existingBuildIdx >= 0) {
        clip.builds[existingBuildIdx].status = 'completed';
        clip.builds[existingBuildIdx].file_path = output_path;
        clip.builds[existingBuildIdx].output_paths = JSON.stringify(all_output_paths || [output_path]);
      }
      console.log(`[Projects] Local state updated for completed clip: ${clip_id}`);
    } else if (isCancelled) {
      clip.build_status = 'pending';
      clip.build_progress = 0;
    } else {
      clip.build_status = 'failed';
      clip.build_error = buildError || 'Unknown build error';
    }

    // Update database in the background (non-blocking)
    // This runs async without awaiting, so UI stays responsive
    (async () => {
      if (buildSuccess) {
        try {
          const { updateClipBuildStatus, getClipBuilds, updateClipBuild } = await import('@/services/database');

          await updateClipBuildStatus(clip_id, 'completed', {
            progress: 100,
            builtFilePath: output_path,
            error: undefined,
          });

          // Update the build record
          const builds = await getClipBuilds(clip_id);
          const buildingRecord = builds.find((b) => b.status === 'building');

          if (buildingRecord) {
            await updateClipBuild(buildingRecord.id, {
              status: 'completed',
              filePath: output_path,
              outputPaths: all_output_paths || (output_path ? [output_path] : []),
            });
            console.log(`[Projects] Database updated for clip: ${clip_id}`);
          } else {
            // No 'building' record found - this can happen if another handler already updated it
            // or if the build was started without creating a record (legacy). Just log a warning.
            console.warn(`[Projects] No 'building' record found for clip ${clip_id}, skipping build record update`);
          }
        } catch (dbError) {
          console.error('[Projects] Failed to update clip build in database:', dbError);
        }
      } else if (!isCancelled) {
        try {
          const { updateClipBuildStatus } = await import('@/services/database');
          await updateClipBuildStatus(clip_id, 'failed', {
            progress: 0,
            error: buildError || 'Unknown build error',
          });
        } catch {}
      }
    })();
  }

  // Get total clips count for folder (including standalone projects)
  const folderTotalClipsCount = computed(() => {
    if (!folderProject.value) return 0;
    const children = getFolderChildren(folderProject.value.id);
    if (children.length > 0) {
      return children.reduce((acc, child) => acc + (clipCounts.value[child.id] || 0), 0);
    }
    // For standalone projects, return clips for the project itself
    return clipCounts.value[folderProject.value.id] || 0;
  });

  // Handle folder tab change
  function onFolderTabChange(tab: 'segments' | 'clips') {
    folderActiveTab.value = tab;
    if (tab === 'clips' && folderProject.value && folderClips.value.length === 0) {
      loadFolderClips(folderProject.value.id);
    }
    // Clear clip preview when switching away from clips tab
    if (tab === 'segments') {
      closeClipPreview();
    }
  }

  // Open segment workspace and navigate to specific clip
  function openSegmentWithClip(clip: ClipWithVersionAndSegment) {
    const segmentProject = projects.value.find((p) => p.id === clip.segment_id);
    if (segmentProject) {
      showFolderDialog.value = false;
      openWorkspace(segmentProject, clip.id);
    }
  }

  // Preview clip in popup player
  // Inline video player state
  const inlineVideoRef = ref<HTMLVideoElement | null>(null);
  const inlineVideoContainerRef = ref<HTMLElement | null>(null);
  const isInlineVideoFullscreen = ref(false);
  const inlineVideoSrc = ref<string | null>(null);
  const inlineVideoLoading = ref(false);
  const inlineVideoPlaying = ref(false);
  const inlineVideoMuted = ref(false);
  const inlineVideoVolume = ref(1);
  const inlineVideoCurrentTime = ref(0); // Relative to clip start (0 = clip start)
  const inlineVideoClipDuration = ref(0);
  const inlineVideoProgress = ref(0);
  const inlineSeekDragging = ref(false);
  const inlineProgressBarRef = ref<HTMLElement | null>(null);
  const inlineHoverTime = ref<number | null>(null);
  const inlineHoverPosition = ref(0);

  // Watermark state for clip preview
  const previewWatermarkData = ref<{ dataUrl: string; width?: number; height?: number } | null>(null);
  const previewWatermarkSettings = ref<WatermarkSettings | null>(null);

  // Prepare video source when clip changes
  async function prepareInlineVideo() {
    if (!clipPreviewVideoPath.value) {
      inlineVideoSrc.value = null;
      return;
    }

    inlineVideoLoading.value = true;
    try {
      const port = await invoke<number>('get_video_server_port');
      const encodedPath = utf8ToBase64(clipPreviewVideoPath.value);
      const timestamp = Date.now();
      inlineVideoSrc.value = `http://localhost:${port}/video/${encodedPath}?t=${timestamp}`;
    } catch (err) {
      console.error('Failed to prepare video:', err);
      inlineVideoSrc.value = null;
    } finally {
      inlineVideoLoading.value = false;
    }
  }

  // Watch for clip changes to prepare video and load watermark
  watch(clipToPreview, async (newClip) => {
    if (newClip) {
      await prepareInlineVideo();
      await loadPreviewWatermark(newClip);
    } else {
      inlineVideoSrc.value = null;
      previewWatermarkData.value = null;
      previewWatermarkSettings.value = null;
    }
  });

  // Load watermark for the clip preview based on project settings or creator profile
  async function loadPreviewWatermark(clip: ClipWithVersionAndSegment) {
    previewWatermarkData.value = null;
    previewWatermarkSettings.value = null;

    try {
      // Get the segment's project ID - this is where the creator profile is linked
      const segmentProjectId = clip.segment_id;
      if (!segmentProjectId) {
        console.log('[Projects] loadPreviewWatermark: No segment_id found');
        return;
      }
      console.log('[Projects] loadPreviewWatermark: Loading for segment:', segmentProjectId);

      // First, check if the segment project or its parent has default_watermark_settings
      let watermarkId: string | null = null;
      let watermarkSettingsRaw: string | null = null;

      const segmentProject = projects.value.find((p) => p.id === segmentProjectId);
      if (segmentProject?.default_watermark_settings) {
        try {
          const storedSettings = JSON.parse(segmentProject.default_watermark_settings);
          if (storedSettings.watermarkId) {
            watermarkId = storedSettings.watermarkId;
            watermarkSettingsRaw = storedSettings.watermarkSettings;
            console.log('[Projects] loadPreviewWatermark: Found project-level watermark:', watermarkId);
          }
        } catch (e) {
          console.warn('[Projects] loadPreviewWatermark: Failed to parse project watermark settings:', e);
        }
      }

      // If no project-level settings, check parent project
      if (!watermarkId && segmentProject?.parent_id) {
        const parentProject = projects.value.find((p) => p.id === segmentProject.parent_id);
        if (parentProject?.default_watermark_settings) {
          try {
            const storedSettings = JSON.parse(parentProject.default_watermark_settings);
            if (storedSettings.watermarkId) {
              watermarkId = storedSettings.watermarkId;
              watermarkSettingsRaw = storedSettings.watermarkSettings;
              console.log('[Projects] loadPreviewWatermark: Found parent project-level watermark:', watermarkId);
            }
          } catch (e) {
            console.warn('[Projects] loadPreviewWatermark: Failed to parse parent project watermark settings:', e);
          }
        }
      }

      // If no project-level settings, try creator profile lookup
      if (!watermarkId) {
        // Get the creator profile for the segment (not the parent folder)
        let creatorProfile = await getCreatorProfileByProjectId(segmentProjectId);
        console.log(
          '[Projects] loadPreviewWatermark: Creator profile for segment',
          segmentProjectId,
          ':',
          creatorProfile
        );

        // If no creator profile on segment, try the parent folder as fallback
        if (!creatorProfile) {
          const project = projects.value.find((p) => p.id === segmentProjectId);
          if (project?.parent_id) {
            creatorProfile = await getCreatorProfileByProjectId(project.parent_id);
            console.log('[Projects] loadPreviewWatermark: Fallback to parent', project.parent_id, ':', creatorProfile);
          }
        }

        if (creatorProfile?.watermark_id) {
          watermarkId = creatorProfile.watermark_id;
          watermarkSettingsRaw = creatorProfile.watermark_settings;
        }
      }

      if (!watermarkId) {
        console.log('[Projects] loadPreviewWatermark: No watermark_id found');
        return;
      }

      // Load the watermark image
      console.log('[Projects] loadPreviewWatermark: Loading watermark image for ID:', watermarkId);

      // Check if this is an organization asset (ID format: org-asset-{serverId})
      if (watermarkId.startsWith('org-asset-')) {
        const serverId = parseInt(watermarkId.replace('org-asset-', ''), 10);
        console.log('[Projects] loadPreviewWatermark: Loading org watermark with serverId:', serverId);
        if (!isNaN(serverId)) {
          // First try to load from local cache
          const localWatermark = await getWatermarkByServerId(serverId);
          if (localWatermark) {
            console.log('[Projects] loadPreviewWatermark: Found cached org watermark:', localWatermark.name);
            const dataUrl = await invoke<string>('read_file_as_data_url', {
              filePath: localWatermark.file_path,
            });
            const measured =
              !localWatermark.width || !localWatermark.height
                ? await new Promise<{ width: number; height: number } | null>((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
                    img.onerror = () => resolve(null);
                    img.src = dataUrl;
                  })
                : { width: localWatermark.width, height: localWatermark.height };
            previewWatermarkData.value = {
              dataUrl,
              width: measured?.width || localWatermark.width || undefined,
              height: measured?.height || localWatermark.height || undefined,
            };
            console.log('[Projects] loadPreviewWatermark: Org watermark loaded from cache');
          } else {
            // Not cached locally - download through Tauri (bypasses CORS)
            console.log('[Projects] loadPreviewWatermark: Org watermark not cached, downloading from server...');
            try {
              const serverResponse = await getUserOrganizationAssets();
              if (serverResponse.success && serverResponse.assets) {
                const serverAsset = serverResponse.assets.find(
                  (a) => a.id === serverId && a.asset_type === 'watermark'
                );
                if (serverAsset && serverAsset.url) {
                  console.log('[Projects] loadPreviewWatermark: Downloading org watermark:', serverAsset.name);
                  // Download and cache the asset locally (bypasses CORS)
                  const downloadResult = await ensureAssetDownloaded(serverAsset);
                  if (downloadResult.success && downloadResult.filePath) {
                    console.log(
                      '[Projects] loadPreviewWatermark: Org watermark downloaded to:',
                      downloadResult.filePath
                    );
                    const dataUrl = await invoke<string>('read_file_as_data_url', {
                      filePath: downloadResult.filePath,
                    });
                    // Measure dimensions from the loaded data URL
                    const dimensions = await new Promise<{ width: number; height: number } | null>((resolve) => {
                      const img = new Image();
                      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
                      img.onerror = () => resolve(null);
                      img.src = dataUrl;
                    });
                    previewWatermarkData.value = {
                      dataUrl,
                      width: dimensions?.width || serverAsset.width || undefined,
                      height: dimensions?.height || serverAsset.height || undefined,
                    };
                    console.log('[Projects] loadPreviewWatermark: Org watermark loaded from download:', {
                      width: dimensions?.width,
                      height: dimensions?.height,
                    });
                  } else {
                    console.error(
                      '[Projects] loadPreviewWatermark: Failed to download org watermark:',
                      downloadResult.error
                    );
                    return;
                  }
                } else {
                  console.log('[Projects] loadPreviewWatermark: Server asset not found for serverId:', serverId);
                  return;
                }
              }
            } catch (fetchError) {
              console.error('[Projects] loadPreviewWatermark: Failed to fetch org assets:', fetchError);
              return;
            }
          }
        }
      } else {
        // Regular watermark lookup by ID
        const watermark = await getWatermarkImage(watermarkId);
        if (!watermark) {
          console.log('[Projects] loadPreviewWatermark: No watermark found in database for ID:', watermarkId);
          return;
        }
        console.log('[Projects] loadPreviewWatermark: Watermark found:', watermark.name);

        // Load watermark data URL
        const dataUrl = await invoke<string>('read_file_as_data_url', {
          filePath: watermark.file_path,
        });

        // Get dimensions from database or measure the image
        let wmWidth = watermark.width || undefined;
        let wmHeight = watermark.height || undefined;

        // If dimensions not in database, measure the image
        if (!wmWidth || !wmHeight) {
          try {
            const measured = await new Promise<{ width: number; height: number } | null>((resolve) => {
              const img = new Image();
              img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
              img.onerror = () => resolve(null);
              img.src = dataUrl;
            });
            if (measured) {
              wmWidth = measured.width;
              wmHeight = measured.height;
            }
          } catch {
            // Ignore measurement errors
          }
        }

        previewWatermarkData.value = {
          dataUrl,
          width: wmWidth,
          height: wmHeight,
        };
        console.log('[Projects] loadPreviewWatermark: Watermark data loaded:', { width: wmWidth, height: wmHeight });
      }

      // Parse watermark settings (from project or creator profile)
      let watermarkSettings: WatermarkSettings = {
        enabled: true,
        watermarkId: watermarkId,
        positionX: 12,
        positionY: 92,
        opacity: 80,
        scale: 20,
        perRatioSettings: null,
      };

      // Try to parse stored watermark settings
      if (watermarkSettingsRaw) {
        try {
          const parsed =
            typeof watermarkSettingsRaw === 'string' ? JSON.parse(watermarkSettingsRaw) : watermarkSettingsRaw;

          // Store full per-ratio settings for use in getPreviewWatermarkStyle
          watermarkSettings.perRatioSettings = parsed;

          // Get the 16:9 settings (default preview aspect ratio for inline player)
          const ratioConfig = parsed['16:9'];
          if (ratioConfig) {
            // Handle both old format (direct x/y/opacity/scale) and new format (position object)
            const position = ratioConfig.position || ratioConfig;
            watermarkSettings = {
              ...watermarkSettings,
              enabled: true,
              watermarkId: ratioConfig.watermarkId || watermarkId,
              positionX: position.x ?? 12,
              positionY: position.y ?? 92,
              opacity: position.opacity ?? 80,
              scale: position.scale ?? 20,
              isFullFrameOverlay: position.isFullFrameOverlay ?? false,
              perRatioSettings: parsed,
            };
          }
        } catch (e) {
          // Use defaults if parsing fails
        }
      }

      previewWatermarkSettings.value = watermarkSettings;
      console.log('[Projects] loadPreviewWatermark: Settings loaded:', watermarkSettings);
    } catch (error) {
      console.error('[Projects] Failed to load watermark for preview:', error);
      previewWatermarkData.value = null;
      previewWatermarkSettings.value = null;
    }
  }

  function previewClip(clip: ClipWithVersionAndSegment) {
    clipToPreview.value = clip;
  }

  // Close clip preview
  function closeClipPreview() {
    // Exit fullscreen if in fullscreen mode
    if (isInlineVideoFullscreen.value && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      isInlineVideoFullscreen.value = false;
    }
    if (inlineVideoRef.value) {
      inlineVideoRef.value.pause();
    }
    clipToPreview.value = null;
    inlineVideoSrc.value = null;
    inlineVideoPlaying.value = false;
    inlineVideoCurrentTime.value = 0;
    inlineVideoProgress.value = 0;
    inlineVideoClipDuration.value = 0;
  }

  // Get clip start and end times
  function getClipStartTime(): number {
    return clipToPreview.value?.current_version?.start_time ?? clipToPreview.value?.start_time ?? 0;
  }

  function getClipEndTime(): number {
    return clipToPreview.value?.current_version?.end_time ?? clipToPreview.value?.end_time ?? 0;
  }

  // Handle inline video loaded - seek to clip start time
  function onInlineVideoLoaded() {
    if (inlineVideoRef.value && clipToPreview.value) {
      const startTime = getClipStartTime();
      const endTime = getClipEndTime();
      inlineVideoClipDuration.value = endTime - startTime;
      inlineVideoRef.value.currentTime = startTime;
      inlineVideoCurrentTime.value = 0;
      inlineVideoProgress.value = 0;
      inlineVideoRef.value.play();
      inlineVideoPlaying.value = true;
    }
  }

  // Handle inline video time update - loop within clip bounds
  function onInlineVideoTimeUpdate() {
    if (inlineVideoRef.value && clipToPreview.value && !inlineSeekDragging.value) {
      const startTime = getClipStartTime();
      const endTime = getClipEndTime();
      const currentTime = inlineVideoRef.value.currentTime;

      // Loop back if past end time
      if (currentTime >= endTime) {
        inlineVideoRef.value.currentTime = startTime;
        return;
      }

      // Update relative time display (relative to clip start)
      inlineVideoCurrentTime.value = Math.max(0, currentTime - startTime);
      inlineVideoProgress.value =
        inlineVideoClipDuration.value > 0 ? (inlineVideoCurrentTime.value / inlineVideoClipDuration.value) * 100 : 0;
    }
  }

  // Handle inline video ended - loop back to start
  function onInlineVideoEnded() {
    if (inlineVideoRef.value && clipToPreview.value) {
      const startTime = getClipStartTime();
      inlineVideoRef.value.currentTime = startTime;
      inlineVideoRef.value.play();
    }
  }

  // Toggle play/pause
  function toggleInlineVideoPlay() {
    if (!inlineVideoRef.value) return;
    if (inlineVideoPlaying.value) {
      inlineVideoRef.value.pause();
      inlineVideoPlaying.value = false;
    } else {
      inlineVideoRef.value.play();
      inlineVideoPlaying.value = true;
    }
  }

  // Toggle mute
  function toggleInlineVideoMute() {
    if (!inlineVideoRef.value) return;
    inlineVideoMuted.value = !inlineVideoMuted.value;
    inlineVideoRef.value.muted = inlineVideoMuted.value;
  }

  // Set volume
  function setInlineVideoVolume(event: Event) {
    if (!inlineVideoRef.value) return;
    const value = parseFloat((event.target as HTMLInputElement).value);
    inlineVideoVolume.value = value;
    inlineVideoRef.value.volume = value;
    if (value > 0 && inlineVideoMuted.value) {
      inlineVideoMuted.value = false;
      inlineVideoRef.value.muted = false;
    }
  }

  // Calculate percent from mouse position on progress bar
  function getInlinePercentFromEvent(event: MouseEvent): number {
    if (!inlineProgressBarRef.value) return 0;
    const rect = inlineProgressBarRef.value.getBoundingClientRect();
    const x = event.clientX - rect.left;
    return Math.max(0, Math.min(100, (x / rect.width) * 100));
  }

  // Seek video to a specific percent
  function seekInlineVideoToPercent(percent: number) {
    if (!inlineVideoRef.value || !clipToPreview.value) return;
    const startTime = getClipStartTime();
    const newTime = startTime + (percent / 100) * inlineVideoClipDuration.value;
    inlineVideoRef.value.currentTime = newTime;
    inlineVideoCurrentTime.value = (percent / 100) * inlineVideoClipDuration.value;
    inlineVideoProgress.value = percent;
  }

  // Start drag seeking
  function startInlineSeekDrag(event: MouseEvent) {
    if (!inlineVideoRef.value || !clipToPreview.value) return;

    inlineSeekDragging.value = true;
    const percent = getInlinePercentFromEvent(event);
    seekInlineVideoToPercent(percent);

    // Add document-level listeners for drag
    document.addEventListener('mousemove', onInlineSeekDrag);
    document.addEventListener('mouseup', stopInlineSeekDrag);

    event.preventDefault();
  }

  // Handle drag movement (called from document listener)
  function onInlineSeekDrag(event: MouseEvent) {
    if (!inlineSeekDragging.value) return;
    const percent = getInlinePercentFromEvent(event);
    seekInlineVideoToPercent(percent);
  }

  // Stop drag seeking
  function stopInlineSeekDrag() {
    if (!inlineSeekDragging.value) return;
    inlineSeekDragging.value = false;
    document.removeEventListener('mousemove', onInlineSeekDrag);
    document.removeEventListener('mouseup', stopInlineSeekDrag);
  }

  // Handle hover for time preview
  function onInlineTimelineHover(event: MouseEvent) {
    if (inlineSeekDragging.value) return;
    if (!inlineVideoClipDuration.value) return;

    const percent = getInlinePercentFromEvent(event);
    inlineHoverTime.value = (percent / 100) * inlineVideoClipDuration.value;
    inlineHoverPosition.value = percent;
  }

  // Clear hover state when leaving timeline
  function onInlineTimelineLeave() {
    if (!inlineSeekDragging.value) {
      inlineHoverTime.value = null;
    }
  }

  // Toggle fullscreen - use container so custom controls are included
  async function toggleInlineVideoFullscreen() {
    if (!inlineVideoContainerRef.value) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        isInlineVideoFullscreen.value = false;
      } else {
        await inlineVideoContainerRef.value.requestFullscreen();
        isInlineVideoFullscreen.value = true;
      }
    } catch (err) {
      console.error('[Projects] Fullscreen error:', err);
    }
  }

  // Handle fullscreen change events (e.g., user presses Escape)
  function handleInlineVideoFullscreenChange() {
    isInlineVideoFullscreen.value = !!document.fullscreenElement;
  }

  // Delete clip from folder view
  async function deleteFolderClip(clipId: string) {
    try {
      await deleteClip(clipId);
      folderClips.value = folderClips.value.filter((c) => c.id !== clipId);
      await loadProjects();
      success('Clip deleted', 'The clip has been removed.');
    } catch (e) {
      error('Failed to delete clip', 'An error occurred while deleting the clip.');
    }
  }

  // Build clip from folder view
  async function onFolderBuildClip(clip: ClipWithVersionAndSegment) {
    folderClipToBuild.value = clip;

    // Reset creator defaults
    folderCreatorDefaultIntro.value = null;
    folderCreatorDefaultOutro.value = null;
    folderCreatorWatermarkSettings.value = null;

    // Look up creator profile for this clip's project
    try {
      // Use the parent project ID (folder) or the segment's project ID
      const projectId = clip.project_id || clip.segment_id;
      const profile = await getCreatorProfileByProjectId(projectId);

      if (profile) {
        console.log('[Projects] Found creator profile for folder build:', profile.name);

        // Load creator's default intro
        if (profile.intro_id) {
          const intro = await getIntroOutroById(profile.intro_id);
          if (intro) {
            folderCreatorDefaultIntro.value = intro;
            console.log('[Projects] Loaded creator default intro:', intro.name);
          }
        }

        // Load creator's default outro
        if (profile.outro_id) {
          const outro = await getIntroOutroById(profile.outro_id);
          if (outro) {
            folderCreatorDefaultOutro.value = outro;
            console.log('[Projects] Loaded creator default outro:', outro.name);
          }
        }

        // Load creator's default watermark settings
        if (profile.watermark_id) {
          const watermark = await getWatermarkImage(profile.watermark_id);
          if (watermark) {
            // Parse the creator's watermark settings from JSON
            let creatorSettings = { x: 12, y: 92, opacity: 80, scale: 20 };
            if (profile.watermark_settings) {
              try {
                const parsed = JSON.parse(profile.watermark_settings);
                // Default to 16:9 settings for now (the build system will use the right one based on aspect ratio)
                creatorSettings = parsed['16:9'] || creatorSettings;
              } catch (e) {
                console.warn('[Projects] Failed to parse creator watermark settings:', e);
              }
            }
            folderCreatorWatermarkSettings.value = {
              enabled: true,
              watermarkId: profile.watermark_id,
              positionX: creatorSettings.x,
              positionY: creatorSettings.y,
              opacity: creatorSettings.opacity,
              scale: creatorSettings.scale,
              // Store the full per-ratio settings for the build system
              perRatioSettings: profile.watermark_settings ? JSON.parse(profile.watermark_settings) : null,
            };
            console.log('[Projects] Loaded creator default watermark with custom position');
          }
        }
      }
    } catch (err) {
      console.warn('[Projects] Failed to load creator profile for folder build:', err);
    }

    showFolderBuildDialog.value = true;
  }

  // Track if we're currently processing a folder build to prevent duplicates
  const isFolderBuildInProgress = ref(false);

  // Handle build confirmation
  async function onFolderBuildConfirm(settings: BuildSettings) {
    if (!folderClipToBuild.value) return;

    // Prevent duplicate builds
    if (isFolderBuildInProgress.value) {
      console.warn('[Projects] Folder build already in progress, ignoring duplicate request');
      return;
    }
    isFolderBuildInProgress.value = true;

    const clip = folderClipToBuild.value;

    try {
      console.log('[Projects] Starting folder build with aspectRatios:', settings.aspectRatios);
      // Get the video file for this clip's segment
      const videos = projectVideos.value[clip.segment_id];
      if (!videos || videos.length === 0) {
        error('No video found', 'Cannot find the source video for this clip.');
        return;
      }
      const videoPath = videos[0].file_path;

      // IMPORTANT: Reload segments from database to get latest edits from timeline
      // The clip object may have stale data if user edited segments on timeline
      const { getClipSegmentsByVersionId } = await import('@/services/database/clip-segments');
      let segments: any[] = [];

      // Try to get fresh segments from database first
      const versionId = clip.current_version_id || clip.current_version?.id;
      if (versionId) {
        try {
          const dbSegments = await getClipSegmentsByVersionId(versionId);
          if (dbSegments.length > 0) {
            segments = dbSegments.map((segment: any) => ({
              id: segment.id,
              start_time: segment.start_time,
              end_time: segment.end_time,
              duration: segment.duration || segment.end_time - segment.start_time,
              transcript: segment.transcript || null,
            }));
            console.log(
              '[Projects] Loaded fresh segments from database:',
              segments.map((s) => ({
                start: s.start_time,
                end: s.end_time,
              }))
            );
          }
        } catch (err) {
          console.warn('[Projects] Could not reload segments from database:', err);
        }
      }

      // Fall back to cached data if database fetch failed or returned empty
      if (segments.length === 0) {
        if (
          clip.current_version_segments &&
          Array.isArray(clip.current_version_segments) &&
          clip.current_version_segments.length > 0
        ) {
          segments = clip.current_version_segments.map((segment: any) => ({
            id: segment.id,
            start_time: segment.start_time,
            end_time: segment.end_time,
            duration: segment.duration || segment.end_time - segment.start_time,
            transcript: segment.transcript || null,
          }));
        } else {
          // Fallback: create single segment from clip timing
          const startTime = clip.current_version?.start_time ?? clip.current_version_start_time ?? 0;
          const endTime = clip.current_version?.end_time ?? clip.current_version_end_time ?? 0;
          segments = [
            {
              id: `fallback-${clip.id}`,
              start_time: startTime,
              end_time: endTime,
              duration: endTime - startTime,
              transcript: null,
            },
          ];
        }
      }

      // Update database status to building
      const { updateClipBuildStatus, createClipBuild, getClipBuilds } = await import('@/services/database');
      await updateClipBuildStatus(clip.id, 'building', { progress: 0 });

      // Get build number
      let buildNumber = 1;
      try {
        const existingBuilds = await getClipBuilds(clip.id);
        buildNumber = existingBuilds.length + 1;
      } catch {
        buildNumber = 1;
      }

      // Create build record
      let buildId: string | null = null;
      try {
        buildId = await createClipBuild(clip.id, {
          aspectRatios: settings.aspectRatios,
          quality: settings.quality,
          frameRate: settings.frameRate,
          outputFormat: settings.format,
          includeSubtitles: false,
        });
      } catch (err) {
        console.warn('[Projects] Could not create build record:', err);
      }

      // Prepare watermark settings if enabled
      let watermarkSettings = null;
      if (settings.watermark && settings.watermark.enabled && settings.watermark.watermarkId) {
        const { getWatermarkImage } = await import('@/services/database/watermarks');
        const watermarkImage = await getWatermarkImage(settings.watermark.watermarkId);
        if (watermarkImage) {
          watermarkSettings = {
            enabled: true,
            watermarkId: settings.watermark.watermarkId,
            filePath: watermarkImage.file_path,
            width: watermarkImage.width ?? null,
            height: watermarkImage.height ?? null,
            positionX: settings.watermark.positionX,
            positionY: settings.watermark.positionY,
            opacity: settings.watermark.opacity,
            scale: settings.watermark.scale,
          };
        }
      }

      // Determine effective intro/outro: creator profile defaults take precedence (mandatory), then dialog selection
      // Creator profile intro/outro MUST be applied when set - they are mandatory defaults
      const effectiveIntro = folderCreatorDefaultIntro.value || settings.intro;
      const effectiveOutro = folderCreatorDefaultOutro.value || settings.outro;

      let introPath: string | null = null;
      let outroPath: string | null = null;
      let introDuration: number | null = null;
      let outroDuration: number | null = null;

      // Handle intro
      if (effectiveIntro) {
        introPath = effectiveIntro.file_path || null;
        introDuration = effectiveIntro.duration || null;
        const introSource = folderCreatorDefaultIntro.value ? '(creator profile)' : '(dialog selection)';
        console.log('[Projects] Using intro:', effectiveIntro.name, introSource);

        // Download org intro if needed (cast to any for org asset properties)
        const introAny = effectiveIntro as any;
        if (introAny.isOrgAsset && introAny.serverId) {
          console.log('[Projects] Downloading org intro asset on-demand:', effectiveIntro.name);
          const introResult = await ensureAssetDownloaded({
            id: introAny.serverId,
            name: effectiveIntro.name,
            asset_type: 'intro',
            url: introAny.serverUrl || effectiveIntro.file_path,
            organization_id: Number(introAny.organization_id),
            organization_name: introAny.organization_name || undefined,
            duration: effectiveIntro.duration || undefined,
            thumbnail_url: introAny.thumbnail_path || undefined,
            inserted_at: introAny.created_at,
            updated_at: introAny.updated_at,
          } as unknown as ServerOrganizationAsset);

          if (introResult.success && introResult.filePath) {
            introPath = introResult.filePath;
            console.log('[Projects] Org intro downloaded to:', introPath);
          } else {
            throw new Error(`Failed to download intro asset: ${introResult.error || 'Unknown error'}`);
          }
        }
      }

      // Handle outro
      if (effectiveOutro) {
        outroPath = effectiveOutro.file_path || null;
        outroDuration = effectiveOutro.duration || null;
        const outroSource = folderCreatorDefaultOutro.value ? '(creator profile)' : '(dialog selection)';
        console.log('[Projects] Using outro:', effectiveOutro.name, outroSource);

        // Download org outro if needed (cast to any for org asset properties)
        const outroAny = effectiveOutro as any;
        if (outroAny.isOrgAsset && outroAny.serverId) {
          console.log('[Projects] Downloading org outro asset on-demand:', effectiveOutro.name);
          const outroResult = await ensureAssetDownloaded({
            id: outroAny.serverId,
            name: effectiveOutro.name,
            asset_type: 'outro',
            url: outroAny.serverUrl || effectiveOutro.file_path,
            organization_id: Number(outroAny.organization_id),
            organization_name: outroAny.organization_name || undefined,
            duration: effectiveOutro.duration || undefined,
            thumbnail_url: outroAny.thumbnail_path || undefined,
            inserted_at: outroAny.created_at,
            updated_at: outroAny.updated_at,
          } as unknown as ServerOrganizationAsset);

          if (outroResult.success && outroResult.filePath) {
            outroPath = outroResult.filePath;
            console.log('[Projects] Org outro downloaded to:', outroPath);
          } else {
            throw new Error(`Failed to download outro asset: ${outroResult.error || 'Unknown error'}`);
          }
        }
      }

      // Start the build using the correct command
      await invoke('build_clip_from_segments', {
        projectId: clip.segment_id,
        clipId: clip.id,
        clipName: clip.current_version?.name || clip.name || 'Untitled',
        videoPath: videoPath,
        segments: segments,
        subtitleSettings: null, // No subtitles from folder view
        transcriptWords: [],
        transcriptSegments: [],
        maxWords: 3,
        aspectRatios: settings.aspectRatios,
        quality: settings.quality,
        frameRate: settings.frameRate,
        outputFormat: settings.format,
        runNumber: clip.run_number || null,
        buildNumber: buildNumber,
        buildId: buildId,
        introPath: introPath,
        introDuration: introDuration,
        outroPath: outroPath,
        outroDuration: outroDuration,
        watermarkSettings: watermarkSettings,
        audioSettings: null,
        framingStrategy: null,
        videoFilterSegments: null, // No filter segments from folder view
        textOverlays: null, // No text overlays from folder view
        stickers: null, // No stickers from folder view
        clipWatermarks: null, // No clip watermarks from folder view
      });

      success('Build started', 'Your clip is being built in the background.');
      showFolderBuildDialog.value = false;
      folderClipToBuild.value = null;

      // Update local state immediately to show building status
      // (Tauri events will handle progress and completion updates)
      const clipToUpdate = folderClips.value.find((c) => c.id === clip.id);
      if (clipToUpdate) {
        clipToUpdate.build_status = 'building';
        clipToUpdate.build_progress = 0;
      }
    } catch (e) {
      // Update status to failed if build didn't start
      try {
        const { updateClipBuildStatus } = await import('@/services/database');
        await updateClipBuildStatus(clip.id, 'failed', {
          error: e instanceof Error ? e.message : 'Build failed to start',
        });
      } catch {}
      error('Build failed', e instanceof Error ? e.message : 'An error occurred while building the clip.');
    } finally {
      // Reset the build in progress flag
      isFolderBuildInProgress.value = false;
    }
  }

  // Toggle download dropdown
  function toggleFolderDownloadDropdown(clipId: string) {
    folderDownloadDropdownId.value = folderDownloadDropdownId.value === clipId ? null : clipId;
  }

  // Helper functions for clip display
  function getClipDuration(clip: ClipWithVersionAndSegment): string {
    const startTime = clip.current_version?.start_time ?? clip.start_time ?? 0;
    const endTime = clip.current_version?.end_time ?? clip.end_time ?? 0;
    const duration = endTime - startTime;
    return formatDuration(duration);
  }

  function formatClipTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getViralityColorClass(score: number): string {
    if (score >= 80) return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    if (score >= 60) return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
  }

  function hasCompletedBuilds(clip: ClipWithVersionAndSegment): boolean {
    // Check for builds in the builds array
    if (clip.builds && clip.builds.some((b: any) => b.status === 'completed')) {
      return true;
    }
    // Fallback to legacy built_file_path
    return clip.build_status === 'completed' || Boolean(clip.built_file_path);
  }

  // Get completed builds from a clip
  function getCompletedBuilds(clip: ClipWithVersionAndSegment): any[] {
    if (!clip.builds) return [];
    return clip.builds.filter((b: any) => b.status === 'completed');
  }

  // Parse output paths from a build (supports both new output_paths array and legacy single file_path)
  function getOutputPathsFromBuild(build: any): string[] {
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

  // Downloadable file interface
  interface DownloadableFile {
    build: any;
    filePath: string;
    aspectRatio: string | null;
  }

  // Get all downloadable files from all completed builds for a clip
  function getDownloadableFiles(clip: ClipWithVersionAndSegment): DownloadableFile[] {
    const completedBuilds = getCompletedBuilds(clip);
    const files: DownloadableFile[] = [];

    for (const build of completedBuilds) {
      const paths = getOutputPathsFromBuild(build);
      for (const filePath of paths) {
        // Extract aspect ratio from filename (e.g., "clip_name_16-9_1.mp4" -> "16:9")
        const fileName = filePath.split(/[/\\]/).pop() || '';
        const aspectRatioMatch = fileName.match(/_(\d+-\d+)_\d+\.\w+$/);
        const aspectRatio = aspectRatioMatch ? aspectRatioMatch[1].replace('-', ':') : null;

        files.push({
          build,
          filePath,
          aspectRatio,
        });
      }
    }

    return files;
  }

  // Get total count of downloadable files for a clip
  function getDownloadableFilesCount(clip: ClipWithVersionAndSegment): number {
    return getDownloadableFiles(clip).length;
  }

  // Get filename from path
  function getBuildFileName(filePath: string | null): string {
    if (!filePath) return 'Built clip';
    return filePath.split(/[/\\]/).pop() || 'Built clip';
  }

  // Format build date
  function formatBuildDate(timestamp: number | null): string {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Format file size
  function formatFileSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  // Set dropdown button ref for positioning
  function setFolderDropdownButtonRef(el: any, clipId: string) {
    if (el && el instanceof HTMLElement) {
      folderDropdownButtonRefs.value.set(clipId, el);
    } else {
      folderDropdownButtonRefs.value.delete(clipId);
    }
  }

  // Get dropdown position for teleported menu
  function getFolderDropdownPosition(clipId: string): Record<string, string> {
    const button = folderDropdownButtonRefs.value.get(clipId);
    if (!button) {
      return { top: '0px', left: '0px' };
    }

    const rect = button.getBoundingClientRect();
    const dropdownWidth = 280;
    const dropdownMaxHeight = 300;
    const padding = 8;

    // Calculate horizontal position - align to right edge of button, but keep within viewport
    let left = rect.right - dropdownWidth;

    if (left < padding) {
      left = padding;
    }

    const viewportWidth = window.innerWidth;
    if (left + dropdownWidth > viewportWidth - padding) {
      left = viewportWidth - dropdownWidth - padding;
    }

    // Calculate vertical position - prefer below, but flip above if not enough space
    let top = rect.bottom + 4;
    const viewportHeight = window.innerHeight;

    if (top + dropdownMaxHeight > viewportHeight - padding) {
      top = rect.top - dropdownMaxHeight - 4;
      if (top < padding) {
        top = padding;
      }
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
    };
  }

  // Close download dropdown
  function closeFolderDownloadDropdown() {
    folderDownloadDropdownId.value = null;
  }

  // Save a specific file
  async function onFolderSaveFile(filePath: string) {
    if (!filePath) return;

    try {
      const defaultName = filePath.split(/[/\\]/).pop() || 'clip.mp4';
      const savePath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'Video', extensions: ['mp4'] }],
      });

      if (savePath) {
        await invoke('copy_clip_to_destination', { sourcePath: filePath, destinationPath: savePath });
        success('Clip saved', 'Your clip has been saved successfully.');
      }
    } catch (e) {
      console.error('[Projects] Failed to save file:', e);
      error('Save failed', 'Failed to save the clip file.');
    }
  }

  const paginatedFolderChildren = computed(() => {
    if (!folderProject.value) return [];
    const segments = getEffectiveSegments(folderProject.value.id);
    const startIndex = (folderCurrentPage.value - 1) * folderItemsPerPage;
    return segments.slice(startIndex, startIndex + folderItemsPerPage);
  });

  const folderTotalPages = computed(() => {
    if (!folderProject.value) return 0;
    return Math.ceil(getEffectiveSegments(folderProject.value.id).length / folderItemsPerPage);
  });

  function handleProjectClick(project: Project) {
    // Open folder dialog for projects with children OR standalone projects with videos
    // This allows users to review detected clips via the Clips tab
    if (viewMode.value === 'folders' && (hasChildren(project.id) || hasDirectVideos(project.id))) {
      folderProject.value = project;
      folderCurrentPage.value = 1; // Reset to first page
      folderActiveTab.value = 'segments'; // Reset to segments tab
      folderClips.value = []; // Clear clips
      showFolderDialog.value = true;
      // Preload clips in background
      loadFolderClips(project.id);
    } else {
      openWorkspace(project);
    }
  }

  // Filter projects based on view mode and filters
  const filteredProjects = computed(() => {
    let result = projects.value;

    // Note: We no longer filter out projects based on active downloads.
    // Projects should always appear in folder view once created.
    // Active downloads are shown separately in the Active Downloads section.

    // 1. Filter by View Mode (only if NOT searching)
    // If user is searching, we want to search across all projects regardless of folder structure
    // Also if filtering by "Has Clips", we want to show all matching projects regardless of hierarchy
    if (!searchQuery.value && statusFilter.value !== 'has_clips') {
      if (viewMode.value === 'folders') {
        result = result.filter((p) => !p.parent_id);
      } else if (viewMode.value === 'list') {
        // In list view, hide "parent" projects (folders) - show only leaf nodes
        result = result.filter((p) => !hasChildren(p.id));
      }
    }

    // 2. Search Text
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query))
      );
    }

    // 3. Status Filter
    if (statusFilter.value !== 'all') {
      switch (statusFilter.value) {
        case 'live':
          result = result.filter((p) => isProjectLive(p.id));
          break;
        case 'has_clips':
          result = result.filter((p) => getClipCount(p.id) > 0);
          break;
        case 'has_videos':
          result = result.filter((p) => (projectVideos.value[p.id]?.length || 0) > 0);
          break;
        case 'empty':
          result = result.filter((p) => getClipCount(p.id) === 0 && (projectVideos.value[p.id]?.length || 0) === 0);
          break;
      }
    }

    // 4. Sorting
    // Note: projects are already sorted by updated_at desc from DB, but we apply client side sort here
    const [field, direction] = sortBy.value.split('-');

    result = [...result].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      if (field === 'updated') {
        valA = a.updated_at;
        valB = b.updated_at;
      } else if (field === 'created') {
        valA = a.created_at;
        valB = b.created_at;
      } else if (field === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  });

  // Pagination logic
  const totalPages = computed(() => Math.ceil(filteredProjects.value.length / projectsPerPage));

  const paginatedProjects = computed(() => {
    const startIndex = (currentPage.value - 1) * projectsPerPage;
    const endIndex = startIndex + projectsPerPage;
    return filteredProjects.value.slice(startIndex, endIndex);
  });

  // Group by date logic
  const groupedProjects = computed(() => {
    // If we are sorting by name, or filtering specifically, we might want to skip grouping or adjust it.
    // For now, if sorting by name, we skip date grouping.
    if (sortBy.value.startsWith('name')) {
      return [{ dateLabel: 'Projects', projects: paginatedProjects.value }];
    }

    const groups: { dateLabel: string; projects: Project[] }[] = [];

    let currentLabel = '';
    let currentProjects: Project[] = [];

    // Use paginatedProjects which are already sorted by filteredProjects
    const projectsToGroup = paginatedProjects.value;

    for (const project of projectsToGroup) {
      // Determine which date to use for grouping
      const timestamp = sortBy.value.startsWith('created') ? project.created_at : project.updated_at;
      const label = getDateLabel(timestamp);

      if (label !== currentLabel) {
        if (currentLabel) {
          groups.push({ dateLabel: currentLabel, projects: currentProjects });
        }
        currentLabel = label;
        currentProjects = [project];
      } else {
        currentProjects.push(project);
      }
    }

    if (currentLabel) {
      groups.push({ dateLabel: currentLabel, projects: currentProjects });
    } else if (projectsToGroup.length > 0 && groups.length === 0) {
      // Fallback if loop didn't produce groups (shouldn't happen if list not empty)
      groups.push({ dateLabel: 'Projects', projects: projectsToGroup });
    }

    return groups;
  });

  function getDateLabel(timestamp: number): string {
    // Wait, services/database/core.ts usually uses Date.now() which is ms.
    // But let's verify. The migration says INTEGER.
    // In useFormatters: const now = Math.floor(Date.now() / 1000) -> input timestamp is in seconds.
    // Let's check if updated_at in DB is seconds or ms.
    // In database/projects.ts: const now = timestamp();
    // In database/core.ts: export const timestamp = () => Math.floor(Date.now() / 1000);
    // So it is SECONDS.

    const d = new Date(timestamp * 1000);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const projectDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (projectDate.getTime() === today.getTime()) return 'Today';
    if (projectDate.getTime() === yesterday.getTime()) return 'Yesterday';

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

  // Reset to first page when projects change or filters change
  watch([projects, viewMode, searchQuery, sortBy, statusFilter], () => {
    currentPage.value = 1;
  });

  // Clear folder child selection when folder dialog closes
  watch(showFolderDialog, (isOpen) => {
    if (!isOpen) {
      clearFolderChildSelection();
      closeFolderDownloadDropdown();
      closeClipPreview();
    }
  });

  async function openCreateDialog() {
    // Check subscription access before allowing project creation
    if (!(await gates.createProject())) {
      return; // Gate was shown, user doesn't have access
    }

    selectedProject.value = null;
    showDialog.value = true;
  }

  function openWorkspace(project: Project, initialClipId?: string | null) {
    workspaceProject.value = project;
    workspaceInitialClipId.value = initialClipId || null;
    showWorkspaceDialog.value = true;
    showFolderDialog.value = false; // Close folder dialog if open
  }

  function editProject(project: Project) {
    selectedProject.value = project;
    showDialog.value = true;
  }

  async function handleProjectSubmit(data: ProjectFormData) {
    try {
      if (selectedProject.value) {
        // Update existing project
        await updateProject(selectedProject.value.id, data.name, data.description || undefined);

        // Add newly selected videos if any
        if (data.selectedVideoPaths && data.selectedVideoPaths.length > 0) {
          for (const path of data.selectedVideoPaths) {
            await processVideoFile(path, selectedProject.value.id);
          }
        }

        success('Project updated', `"${data.name}" has been updated successfully`);
      } else {
        // Create new project

        // Check if we have multiple videos - if so, create a parent project with child projects
        if (data.selectedVideoPaths && data.selectedVideoPaths.length > 1) {
          // Create parent project
          const parentId = await createProject(data.name, data.description || undefined, undefined, 'Manual');

          // Create child projects for each video
          for (const path of data.selectedVideoPaths) {
            // Use filename as child project name
            const filename = path.split(/[\\/]/).pop() || 'Part';
            // Remove extension
            const childName = filename.replace(/\.[^/.]+$/, '');

            // Create child project
            const childId = await createProject(childName, data.description || undefined, parentId, 'Manual');

            // Process video and associate with child project
            await processVideoFile(path, childId);
          }

          success('Project created', `"${data.name}" has been created with ${data.selectedVideoPaths.length} parts`);
        } else {
          // Standard creation for single video or no video
          const projectId = await createProject(data.name, data.description || undefined, undefined, 'Manual');

          // Import and associate selected video (if any)
          if (data.selectedVideoPaths && data.selectedVideoPaths.length > 0) {
            for (const path of data.selectedVideoPaths) {
              await processVideoFile(path, projectId);
            }
          }

          success('Project created', `"${data.name}" has been created successfully`);
        }
      }

      // Reload projects
      await loadProjects();

      if (!selectedProject.value) {
        // For new projects, find the newly created project
        const newProject = projects.value.find((p) => p.name === data.name);

        if (newProject) {
          // Check if it's a folder project (has children)
          const isFolder = hasChildren(newProject.id);

          if (isFolder) {
            // If it's a folder, open the folder view
            folderProject.value = newProject;
            showFolderDialog.value = true;
          } else {
            // If it's a regular project, open the workspace
            workspaceProject.value = newProject;
            showWorkspaceDialog.value = true;
          }
        }
      }

      // Close dialog
      showDialog.value = false;
      selectedProject.value = null;
    } catch (err) {
      error(
        selectedProject.value ? 'Failed to update project' : 'Failed to create project',
        'An error occurred while saving the project. Please try again.'
      );
    }
  }

  async function confirmDelete(project: Project) {
    projectToDelete.value = project;

    // Check if project has videos and clips
    try {
      projectHasVideos.value = await hasRawVideosForProject(project.id);
      projectHasClips.value = await hasClipsForProject(project.id);

      // Auto-select delete segments if there's only 1 child (single segment projects)
      const childCount = getChildCount(project.id);
      if (childCount === 1) {
        deleteSegmentsToo.value = true;
      }

      showDeleteDialog.value = true;
    } catch (err) {
      // If we can't check, proceed with normal deletion
      projectHasVideos.value = false;
      projectHasClips.value = false;
      showDeleteDialog.value = true;
    }
  }

  function handleDeleteDialogClose() {
    showDeleteDialog.value = false;
    projectHasVideos.value = false;
    projectHasClips.value = false;
    deleteSegmentsToo.value = false;
    projectToDelete.value = null;
  }

  // Helper function to delete a project and its associated video files from the filesystem
  async function deleteProjectWithFiles(projectId: string): Promise<void> {
    // Get all raw videos for this project
    const videos = await getRawVideosByProjectId(projectId);

    // Delete each video file from the filesystem
    for (const video of videos) {
      try {
        await invoke('delete_video_file', {
          filePath: video.file_path,
          thumbnailPath: video.thumbnail_path || null,
        });
      } catch (err) {
        console.warn(`Failed to delete video file: ${video.file_path}`, err);
        // Continue deleting other files even if one fails
      }
    }

    // Now delete the project from the database
    await deleteProject(projectId);
  }

  async function deleteProjectConfirmed() {
    if (!projectToDelete.value || deletingProject.value) return;
    deletingProject.value = true;
    // Close the dialog immediately to avoid duplicate clicks while deletion runs
    showDeleteDialog.value = false;

    const deletedProjectName = projectToDelete.value.name;
    const projectId = projectToDelete.value.id;
    const childCount = getChildCount(projectId);

    try {
      // If user chose to delete segments too (or single segment auto-delete), delete all child projects first
      if (deleteSegmentsToo.value && hasChildren(projectId)) {
        const children = getFolderChildren(projectId);
        for (const child of children) {
          // Delete child project with its files
          await deleteProjectWithFiles(child.id);
        }
      }

      // Delete the main project (just the DB record, files were in children for segmented projects)
      // For non-segmented projects, also delete any direct video files
      await deleteProjectWithFiles(projectId);

      const message =
        deleteSegmentsToo.value && childCount > 0
          ? `"${deletedProjectName}" and ${childCount} segment${childCount > 1 ? 's' : ''} have been deleted successfully`
          : `"${deletedProjectName}" has been deleted successfully`;

      success('Project deleted', message);
      await loadProjects();

      // If we deleted the currently open folder project, close the dialog
      if (folderProject.value && folderProject.value.id === projectId) {
        showFolderDialog.value = false;
        folderProject.value = null;
      }
    } catch (err) {
      error('Failed to delete project', 'An error occurred while deleting the project. Please try again.');
    } finally {
      deletingProject.value = false;
      projectHasVideos.value = false;
      projectHasClips.value = false;
      deleteSegmentsToo.value = false;
      projectToDelete.value = null;
    }
  }

  // Multi-select functions
  function toggleProjectSelection(projectId: string, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    if (selectedProjects.value.has(projectId)) {
      selectedProjects.value.delete(projectId);
    } else {
      selectedProjects.value.add(projectId);
    }
    // Trigger reactivity
    selectedProjects.value = new Set(selectedProjects.value);
  }

  function isProjectSelected(projectId: string): boolean {
    return selectedProjects.value.has(projectId);
  }

  function clearSelection() {
    selectedProjects.value.clear();
    selectedProjects.value = new Set(selectedProjects.value);
  }

  function selectAllCurrentPage() {
    const ids = paginatedProjects.value.map((p) => p.id);
    selectedProjects.value = new Set(ids);
  }

  function confirmBulkDelete() {
    if (selectedProjects.value.size > 0) {
      showBulkDeleteDialog.value = true;
    }
  }

  function handleBulkDeleteDialogClose() {
    showBulkDeleteDialog.value = false;
  }

  async function bulkDeleteConfirmed() {
    if (bulkDeleting.value) return;
    bulkDeleting.value = true;
    const projectIds = Array.from(selectedProjects.value);
    let deletedCount = 0;

    try {
      for (const projectId of projectIds) {
        // Get the project to check for children
        const project = projects.value.find((p) => p.id === projectId);
        if (!project) continue;

        // Delete children if any
        if (hasChildren(projectId)) {
          const children = getFolderChildren(projectId);
          for (const child of children) {
            await deleteProjectWithFiles(child.id);
          }
        }

        // Delete the project
        await deleteProjectWithFiles(projectId);
        deletedCount++;
      }

      success('Projects deleted', `${deletedCount} project${deletedCount !== 1 ? 's' : ''} deleted successfully`);
      selectedProjects.value.clear();
      await loadProjects();
    } catch (err) {
      error('Failed to delete projects', 'An error occurred while deleting the projects.');
    } finally {
      showBulkDeleteDialog.value = false;
      bulkDeleting.value = false;
    }
  }

  // Folder children multi-select functions
  function toggleFolderChildSelection(projectId: string, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    if (selectedFolderChildren.value.has(projectId)) {
      selectedFolderChildren.value.delete(projectId);
    } else {
      selectedFolderChildren.value.add(projectId);
    }
    selectedFolderChildren.value = new Set(selectedFolderChildren.value);
  }

  function isFolderChildSelected(projectId: string): boolean {
    return selectedFolderChildren.value.has(projectId);
  }

  function clearFolderChildSelection() {
    selectedFolderChildren.value.clear();
    selectedFolderChildren.value = new Set(selectedFolderChildren.value);
  }

  function confirmBulkDeleteFolderChildren() {
    if (selectedFolderChildren.value.size > 0) {
      showBulkDeleteFolderChildrenDialog.value = true;
    }
  }

  function handleBulkDeleteFolderChildrenDialogClose() {
    showBulkDeleteFolderChildrenDialog.value = false;
  }

  async function bulkDeleteFolderChildrenConfirmed() {
    const projectIds = Array.from(selectedFolderChildren.value);
    let deletedCount = 0;

    try {
      for (const projectId of projectIds) {
        await deleteProjectWithFiles(projectId);
        deletedCount++;
      }

      success('Segments deleted', `${deletedCount} segment${deletedCount !== 1 ? 's' : ''} deleted successfully`);
      selectedFolderChildren.value.clear();
      await loadProjects();

      // Close folder dialog if all segments were deleted
      if (folderProject.value && getEffectiveSegmentCount(folderProject.value.id) === 0) {
        showFolderDialog.value = false;
        folderProject.value = null;
      }
    } catch (err) {
      error('Failed to delete segments', 'An error occurred while deleting the segments.');
    } finally {
      showBulkDeleteFolderChildrenDialog.value = false;
    }
  }

  // Project-level clip detection methods
  function isProjectDetecting(projectId: string): boolean {
    // Check if the project itself is being detected
    if (isDetectionActive(projectId)) {
      return true;
    }

    // Check if any child segment is being detected
    const children = getFolderChildren(projectId);
    for (const child of children) {
      if (isDetectionActive(child.id)) {
        return true;
      }
    }

    return false;
  }

  function hasAnySelectedProjectDetecting(): boolean {
    for (const projectId of selectedProjects.value) {
      if (isProjectDetecting(projectId)) {
        return true;
      }
    }
    return false;
  }

  function hasAnySelectedFolderChildDetecting(): boolean {
    for (const projectId of selectedFolderChildren.value) {
      if (isDetectionActive(projectId)) {
        return true;
      }
    }
    // Also check if the parent folder is detecting
    if (folderProject.value && isProjectDetecting(folderProject.value.id)) {
      return true;
    }
    return false;
  }

  function canDetectClips(projectId: string): boolean {
    // Check if project has videos directly
    const videos = projectVideos.value[projectId];
    if (videos && videos.length > 0) {
      return true;
    }

    // Check if any children have videos
    const children = getFolderChildren(projectId);
    for (const child of children) {
      const childVideos = projectVideos.value[child.id];
      if (childVideos && childVideos.length > 0) {
        return true;
      }
    }

    return false;
  }

  async function startProjectDetection(project: Project) {
    // Check if user is authenticated
    if (!authStore.isAuthenticated) {
      window.dispatchEvent(new CustomEvent('show-auth-modal'));
      return;
    }

    // Check AI access (requires credits) before allowing detection
    if (!(await gates.aiDetection(`Detect clips in "${project.name}"`))) {
      return; // Gate was shown, user doesn't have access
    }

    // Gather segments to detect (children if they exist, otherwise the project itself)
    const children = getFolderChildren(project.id);
    if (children.length > 0) {
      // Filter children that have videos
      segmentsToDetect.value = children.filter((child) => {
        const videos = projectVideos.value[child.id];
        return videos && videos.length > 0;
      });
    } else {
      // Single project (no children)
      const videos = projectVideos.value[project.id];
      if (videos && videos.length > 0) {
        segmentsToDetect.value = [project];
      } else {
        segmentsToDetect.value = [];
      }
    }

    if (segmentsToDetect.value.length === 0) {
      error('No videos found', 'This project has no videos to detect clips from.');
      return;
    }

    // Calculate total duration
    totalDetectionDuration.value = segmentsToDetect.value.reduce((acc, segment) => {
      const videos = projectVideos.value[segment.id];
      return acc + (videos?.reduce((sum, v) => sum + (v.duration || 0), 0) || 0);
    }, 0);

    projectToDetect.value = project;
    showProjectDetectDialog.value = true;
  }

  async function onProjectDetectClipsConfirmed(
    _promptId: string,
    promptContent: string,
    organizationId: number | null = null
  ) {
    if (!projectToDetect.value || segmentsToDetect.value.length === 0) {
      return;
    }

    const segments = [...segmentsToDetect.value];
    const parentProjectId = projectToDetect.value.id;
    const totalSegments = segments.length;
    let successCount = 0;
    let totalClipsFound = 0;

    isDetectingProject.value = true;

    try {
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];

        // Show progress toast
        success('Detecting clips...', `Processing segment ${i + 1} of ${totalSegments}: ${segment.name}`, 3000);

        // Start global tracking for this segment (so it shows in workspace if user navigates there)
        startDetection(segment.id);

        try {
          const { detectClipsWithChunking, progress: chunkedProgress } = useChunkedClipDetection();

          // Watch chunked detection progress and update global state for this segment
          const stopProgressWatch = watch(
            chunkedProgress,
            (newProgress) => {
              updateProgress(
                segment.id,
                newProgress.progress,
                newProgress.stage,
                newProgress.message,
                newProgress.error || ''
              );
            },
            { immediate: true }
          );

          try {
            const result = await detectClipsWithChunking(segment.id, promptContent, {
              chunkDurationMinutes: 15,
              overlapSeconds: 30,
              forceReprocess: false,
              organizationId: organizationId,
            });

            if (result.success) {
              successCount++;
              // Get clip count from the result or refresh clip counts
              const clips = await getClipsWithVersionsByProjectId(segment.id);
              totalClipsFound += clips.length;
              completeDetection(segment.id);
            } else if (result.cancelled) {
              completeDetection(segment.id, 'Cancelled');
            } else {
              completeDetection(segment.id, result.error || 'Detection failed');
            }
          } finally {
            stopProgressWatch();
          }
        } catch (err) {
          console.error(`Failed to detect clips for segment ${segment.name}:`, err);
          completeDetection(segment.id, err instanceof Error ? err.message : 'Detection failed');
          // Continue with remaining segments even if one fails
        }
      }

      // Show summary toast
      if (successCount === totalSegments) {
        success(
          'Detection Complete',
          `Successfully processed ${successCount} segment${successCount !== 1 ? 's' : ''}. Found ${totalClipsFound} clips total.`
        );
      } else {
        error(
          'Detection Partially Complete',
          `Processed ${successCount} of ${totalSegments} segments. Some segments failed.`
        );
      }

      // Refresh projects to update clip counts
      await loadProjects();

      // Emit refresh event for clips page
      const refreshEvent = new CustomEvent('refresh-clips-projects', {
        detail: { projectId: parentProjectId },
      });
      document.dispatchEvent(refreshEvent);
    } finally {
      isDetectingProject.value = false;
      projectToDetect.value = null;
      segmentsToDetect.value = [];
      totalDetectionDuration.value = 0;
    }
  }

  // Listen for clip refresh events from workspace dialog
  function handleClipRefreshEvent(_event: CustomEvent) {
    loadProjects();
  }

  // Listen for video added events (to update project thumbnails)
  function handleVideoAdded(event: Event) {
    console.log('[Projects] video-added event received');
    const customEvent = event as CustomEvent;
    const detail = customEvent.detail;
    console.log('[Projects] video-added detail:', detail);

    // Clear thumbnail cache for this project and any parent to force refresh
    if (detail && detail.projectId) {
      thumbnailCache.value.delete(detail.projectId);

      // Try to find parent project via completed downloads
      // This is necessary because the new child project might not be in projects.value yet
      // and we need to invalidate the parent's thumbnail cache so it can update
      const completed = getCompletedDownloads();
      const download = completed.find((d) => d.projectId === detail.projectId);

      if (download && download.parentProjectId) {
        thumbnailCache.value.delete(download.parentProjectId);
      }

      // Also fallback: check if we can find the project in current list (if it's an update)
      const project = projects.value.find((p) => p.id === detail.projectId);
      if (project && project.parent_id) {
        thumbnailCache.value.delete(project.parent_id);
      }
    }

    // Wait a moment for the DB write to complete, then force a reload
    // Increased delay to ensure consistency especially for sequential segment completions
    setTimeout(async () => {
      // Force a full refresh including reloading active downloads state
      await initializeDownloads();
      // Pass true to avoid showing skeletons during background refresh
      loadProjects(true);
    }, 1500);
  }

  // Click outside handler for folder download dropdown
  function handleFolderDropdownClickOutside(event: MouseEvent) {
    if (folderDownloadDropdownId.value !== null) {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        folderDownloadDropdownId.value = null;
      }
    }
  }

  onMounted(async () => {
    // Initialize downloads state from persistence
    await initializeDownloads();

    await loadProjects();

    // Add event listener for clip refresh events
    document.addEventListener('refresh-clips-projects', handleClipRefreshEvent as EventListener);
    // Add event listener for video added events
    window.addEventListener('video-added', handleVideoAdded as EventListener);
    // Add fullscreen change listener for inline video player
    document.addEventListener('fullscreenchange', handleInlineVideoFullscreenChange);
    // Add click outside handler for folder download dropdown
    document.addEventListener('click', handleFolderDropdownClickOutside);

    // Add Tauri event listeners for clip build events (folder dialog builds)
    try {
      const progressUnlisten = await listen('clip-build-progress', handleFolderClipBuildProgress);
      const completeUnlisten = await listen('clip-build-complete', handleFolderClipBuildComplete);
      clipBuildUnlistenFunctions.value = [progressUnlisten, completeUnlisten];
      console.log('[Projects] Tauri clip build event listeners set up successfully');
    } catch (error) {
      console.error('[Projects] Failed to set up Tauri event listeners:', error);
    }
  });

  onUnmounted(() => {
    // Clean up event listeners
    document.removeEventListener('refresh-clips-projects', handleClipRefreshEvent as EventListener);
    window.removeEventListener('video-added', handleVideoAdded as EventListener);
    document.removeEventListener('fullscreenchange', handleInlineVideoFullscreenChange);
    document.removeEventListener('click', handleFolderDropdownClickOutside);
    // Cleanup drag listeners
    document.removeEventListener('mousemove', onInlineSeekDrag);
    document.removeEventListener('mouseup', stopInlineSeekDrag);

    // Exit fullscreen if unmounting while in fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    // Clean up Tauri event listeners
    clipBuildUnlistenFunctions.value.forEach((unlisten) => {
      try {
        unlisten();
      } catch (error) {
        console.error('[Projects] Error cleaning up Tauri listener:', error);
      }
    });
    clipBuildUnlistenFunctions.value = [];
  });
</script>

<style scoped>
  /* ===== Content Container ===== */
  .projects__content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    width: 100%;
    flex: 1;
  }

  .projects__content--empty {
    justify-content: center;
    align-items: center;
  }

  .projects__main {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .projects__loading {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* ===== Page Heading ===== */
  .projects__heading {
    margin-bottom: 0.5rem;
  }

  .projects__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.02em;
  }

  .projects__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Header Actions ===== */
  .projects-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .projects-header__search {
    position: relative;
    width: 200px;
  }

  .projects-header__search-icon {
    position: absolute;
    left: 0.625rem;
    top: 50%;
    transform: translateY(-50%);
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    pointer-events: none;
  }

  .projects-header__search-input {
    width: 100%;
    padding-left: 2rem;
    height: 32px;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.75rem;
  }

  .projects-header__search-input:focus {
    border-color: var(--sidebar-accent);
    outline: none;
  }

  .projects-header__filter {
    width: 110px;
    flex-shrink: 0;
  }

  .projects-header__sort {
    width: 140px;
    flex-shrink: 0;
  }

  /* Dropdown trigger button styling */
  :deep(.projects-header__dropdown-trigger) {
    height: 32px !important;
    padding: 0 0.625rem !important;
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 6px !important;
    font-size: 0.75rem !important;
    color: var(--sidebar-text) !important;
    transition: all 150ms ease !important;
  }

  :deep(.projects-header__dropdown-trigger:hover) {
    border-color: rgba(255, 255, 255, 0.15) !important;
  }

  :deep(.projects-header__dropdown-trigger span) {
    color: var(--sidebar-text) !important;
  }

  :deep(.projects-header__dropdown-trigger svg) {
    width: 12px !important;
    height: 12px !important;
    color: var(--sidebar-text-muted) !important;
  }

  .projects-header__view-toggle {
    display: flex;
    align-items: center;
    padding: 0.125rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    transition: opacity 150ms ease;
  }

  .projects-header__view-toggle--disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .projects-header__view-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .projects-header__view-btn:hover:not(:disabled) {
    color: var(--sidebar-text);
  }

  .projects-header__view-btn--active {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .projects-header__view-icon {
    width: 14px;
    height: 14px;
  }

  .projects-create-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .projects-create-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .projects-create-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .projects-create-btn__icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Skeleton Loading States ===== */
  .projects-skeleton__card-title {
    height: 16px;
    width: 70%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }

  .projects-skeleton__card-meta {
    height: 12px;
    width: 50%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.15s;
    border-radius: 4px;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* ===== Selection Bar ===== */
  .projects__selection-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.625rem 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .projects__selection-delete {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    background-color: #ef4444;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .projects__selection-delete:hover:not(:disabled) {
    background-color: #dc2626;
  }

  .projects__selection-delete--disabled {
    background-color: #6b7280;
    cursor: not-allowed;
    opacity: 0.5;
  }

  .projects__selection-icon {
    width: 13px;
    height: 13px;
  }

  .projects__selection-action {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-accent);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.375rem 0;
    transition: opacity 150ms ease;
  }

  .projects__selection-action:hover {
    opacity: 0.8;
  }

  .projects__selection-count {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    font-weight: 500;
  }

  .projects__selection-clear {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    padding: 0.375rem 0.75rem;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .projects__selection-clear:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  /* ===== Sections ===== */
  .projects__section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .projects__date-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .projects__section-header {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin: 0;
    padding-bottom: 0.1rem;
  }

  /* ===== Projects Grid ===== */
  .projects__grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1.25rem;
  }

  @media (min-width: 640px) {
    .projects__grid {
      grid-template-columns: repeat(1, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .projects__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1400px) {
    .projects__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 1800px) {
    .projects__grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (min-width: 2200px) {
    .projects__grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  /* ===== Project Card ===== */
  .project-card {
    position: relative;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition: all 200ms ease;
    aspect-ratio: 16 / 9;
  }

  .project-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    transform: scale(1.02);
  }

  .project-card--selected {
    border-color: var(--sidebar-accent);
    box-shadow:
      0 0 0 2px var(--sidebar-accent),
      0 8px 32px rgba(0, 0, 0, 0.25);
  }

  .project-card--skeleton {
    pointer-events: none;
  }

  .project-card__skeleton-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--sidebar-hover) 0%, var(--sidebar-surface) 100%);
  }

  /* Checkbox */
  .project-card__checkbox {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 30;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .project-card:hover .project-card__checkbox,
  .project-card__checkbox--visible {
    opacity: 1;
  }

  .project-card__checkbox-inner {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.45);
    color: white;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: all 150ms ease;
  }

  .project-card__checkbox-inner:hover {
    background-color: rgba(0, 0, 0, 0.8);
  }

  .project-card__checkbox-inner--checked {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
  }

  .project-card__checkbox-icon {
    width: 16px;
    height: 16px;
  }

  /* Badges */
  .project-card__badge {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .project-card__badge--detecting {
    background-color: rgba(147, 51, 234, 0.9);
    color: white;
  }

  .project-card__badge--folder {
    background-color: rgba(37, 99, 235, 0.9);
    color: white;
  }

  .project-card__badge-icon {
    width: 12px;
    height: 12px;
  }

  .project-card__badge-icon--spin {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Thumbnail */
  .project-card__thumbnail {
    position: absolute;
    inset: 0;
    z-index: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }

  .project-card__vignette {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 40%, transparent 70%);
  }

  .project-card__thumbnail--empty {
    background-color: var(--sidebar-hover);
  }

  .project-card__thumbnail-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(0, 0, 0, 0.5) 100%);
  }

  /* Empty State Icons */
  .project-card__empty-live {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    opacity: 0.5;
  }

  .project-card__empty-live-pulse {
    position: relative;
  }

  .project-card__empty-live-ring {
    position: absolute;
    inset: 0;
    background-color: #ef4444;
    border-radius: 9999px;
    animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
    opacity: 0.2;
  }

  .project-card__empty-live-icon {
    width: 48px;
    height: 48px;
    color: #ef4444;
    position: relative;
    z-index: 10;
  }

  .project-card__empty-live-text {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .project-card__empty-icon {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.2;
  }

  .project-card__folder-icon {
    width: 64px;
    height: 64px;
    color: var(--sidebar-text);
  }

  @keyframes ping {
    75%,
    100% {
      transform: scale(2);
      opacity: 0;
    }
  }

  /* Bottom Info */
  .project-card__bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 5;
    padding: 1rem;
    padding-top: 7rem;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.7) 50%, transparent 100%);
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .project-card__title {
    font-size: 1rem;
    font-weight: 700;
    color: white;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    line-height: 1.3;
    transition: color 150ms ease;
  }

  .project-card:hover .project-card__title {
    color: rgba(255, 255, 255, 0.9);
  }

  .project-card__meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    flex-wrap: wrap;
  }

  .project-card__meta-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .project-card__dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.4);
    flex-shrink: 0;
  }

  /* Platform Icons */
  .project-card__platform {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .project-card__platform--youtube {
    background-color: #dc2626;
  }

  .project-card__platform--twitch {
    background-color: #9146ff;
  }

  .project-card__platform--kick {
    background-color: #53fc18;
  }

  .project-card__platform--pumpfun {
    background-color: #10b981;
  }

  .project-card__platform--manual {
    background-color: #475569;
    color: white;
  }

  .project-card__platform-icon {
    width: 10px;
    height: 10px;
    filter: invert(1) brightness(2);
  }

  .project-card__platform-icon--kick {
    filter: none;
  }

  .project-card__platform-icon--pumpfun {
    filter: brightness(2);
  }

  .project-card__platform-svg {
    width: 10px;
    height: 10px;
  }

  /* Live Indicator */
  .project-card__live {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.125rem 0.375rem;
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 9999px;
    color: #ef4444;
    font-weight: 700;
  }

  .project-card__live-dot {
    position: relative;
    display: flex;
    width: 6px;
    height: 6px;
  }

  .project-card__live-ping {
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    background-color: #f87171;
    opacity: 0.75;
    animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
  }

  .project-card__live-core {
    position: relative;
    width: 6px;
    height: 6px;
    border-radius: 9999px;
    background-color: #ef4444;
  }

  .project-card__live-text {
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Hover Actions */
  .project-card__hover-actions {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background-color: rgba(0, 0, 0, 0.4);
    opacity: 0;
    transition: opacity 200ms ease;
  }

  .project-card:hover .project-card__hover-actions {
    opacity: 1;
  }

  .project-card__action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background-color: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 9999px;
    color: #1f2937;
    cursor: pointer;
    transition: all 150ms ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  .project-card__action-btn:hover {
    background-color: white;
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }

  .project-card__action-icon {
    width: 20px;
    height: 20px;
  }

  /* ===== No Results State ===== */
  .projects__no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1rem;
    text-align: center;
  }

  .projects__no-results-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background-color: var(--sidebar-hover);
    border-radius: 9999px;
    margin-bottom: 1rem;
  }

  .projects__no-results-icon {
    width: 32px;
    height: 32px;
    color: var(--sidebar-text-muted);
  }

  .projects__no-results-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
  }

  .projects__no-results-description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1rem;
    max-width: 24rem;
  }

  .projects__no-results-btn {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-accent);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .projects__no-results-btn:hover {
    opacity: 0.8;
    text-decoration: underline;
  }

  /* ===== Empty State ===== */
  .projects__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .projects__empty-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: var(--sidebar-hover);
    border-radius: 16px;
    margin-bottom: 1.5rem;
  }

  .projects__empty-icon {
    width: 36px;
    height: 36px;
    color: var(--sidebar-text-muted);
  }

  .projects__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .projects__empty-description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 300px;
  }

  /* ===== Fullscreen Video Player ===== */
  .inline-video-fullscreen {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    max-height: none !important;
    aspect-ratio: auto !important;
    z-index: 9999 !important;
    border-radius: 0 !important;
    background: black !important;
  }

  .inline-video-fullscreen video {
    width: 100% !important;
    height: 100% !important;
    object-fit: contain !important;
  }
</style>

<!-- Global styles for dropdown menu (rendered via Teleport outside component scope) -->
<style>
  /* Projects page dropdown menu styling */
  .projects-header__filter + div[class*='fixed'],
  .projects-header__sort + div[class*='fixed'],
  div.fixed.bg-popover {
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    animation: projectsDropdownFade 100ms ease-out !important;
  }

  @keyframes projectsDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Dropdown menu items */
  div.fixed.bg-popover button {
    display: flex !important;
    align-items: center !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 5px !important;
    font-size: 0.75rem !important;
    color: var(--sidebar-text) !important;
    transition: background-color 150ms ease !important;
  }

  div.fixed.bg-popover button:hover {
    background-color: var(--sidebar-hover) !important;
  }

  div.fixed.bg-popover button.bg-primary\/10 {
    background-color: rgba(6, 182, 212, 0.15) !important;
    color: var(--sidebar-accent) !important;
  }
</style>
