<template>
  <PageLayout
    title="Video Library"
    description="Manage and organize your video projects"
    :show-header="true"
    :icon="Folder"
  >
    <template #actions>
      <div class="projects-header-actions">
        <!-- Search -->
        <div class="projects-header__search">
          <Search class="projects-header__search-icon" />
          <Input
            v-model="searchQuery"
            placeholder="Search projects..."
            class="projects-header__search-input"
            @focus="openSearchPalette"
            readonly
          />
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
        <h1 class="projects__title">Video Library</h1>
        <p class="projects__subtitle">Manage and organize your downloaded videos and detect clips</p>
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
        <Transition name="selection-bar">
          <div v-if="selectedProjects.size > 0" class="projects__selection-bar">
            <div class="projects__selection-info">
              <Check class="projects__selection-icon" />
              <span>{{ selectedProjects.size }} selected</span>
              <button
                v-if="paginatedProjects.length > 0 && selectedProjects.size < paginatedProjects.length"
                @click="selectAllCurrentPage"
                class="projects__selection-action"
              >
                Select all on page
              </button>
            </div>
            <div class="projects__selection-actions">
              <button @click="clearSelection" class="projects__selection-clear">Clear</button>
              <button
                @click="confirmBulkDelete"
                :disabled="hasAnySelectedProjectDetecting()"
                class="projects__selection-delete"
                :class="{ 'projects__selection-delete--disabled': hasAnySelectedProjectDetecting() }"
                :title="hasAnySelectedProjectDetecting() ? 'Cannot delete while detection is in progress' : ''"
              >
                <Trash2 class="projects__selection-delete-icon" />
                Delete Selected
              </button>
            </div>
          </div>
        </Transition>

        <!-- Active Downloads Section -->
        <div v-if="getActiveDownloads().length > 0 || getQueuedDownloads().length > 0" class="projects__section">
          <div class="projects__section-header-row">
            <h3 class="projects__section-header">Active Downloads</h3>
            <button class="projects__cancel-all-btn" @click="handleCancelAllDownloads" title="Cancel all downloads">
              <XCircle :size="16" />
              Cancel All
            </button>
          </div>
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

            <div class="projects__grid" :class="{ 'projects__grid--list': viewMode === 'list' }">
              <div
                v-for="project in group.projects"
                :key="project.id"
                class="project-card"
                :class="{
                  'project-card--selected': isProjectSelected(project.id),
                  'project-card--list': viewMode === 'list',
                }"
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

                <!-- VOD Preset Badge -->
                <div v-if="hasVodPreset(project.id)" class="project-card__preset-badge">
                  <LayoutDashboard class="project-card__badge-icon" />
                  <span>{{ vodPresetConfigs[project.id]?.targetAspectRatio }} Pre-Edit</span>
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
                      v-if="getProjectPlatform(project) === 'YouTube'"
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
                      v-else-if="getProjectPlatform(project) === 'Rumble'"
                      class="project-card__platform project-card__platform--rumble"
                      title="Rumble"
                    >
                      <img src="/rumble.svg" class="project-card__platform-icon" />
                    </div>
                    <div
                      v-else-if="getProjectPlatform(project) === 'Twitter'"
                      class="project-card__platform project-card__platform--twitter"
                      title="Twitter"
                    >
                      <img src="/x.svg" class="project-card__platform-icon" />
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

                    <!-- Duration -->
                    <template v-if="getProjectDuration(project.id)">
                      <span class="project-card__dot"></span>
                      <span class="project-card__meta-text">{{ getProjectDuration(project.id) }}</span>
                    </template>

                    <span class="project-card__dot"></span>

                    <!-- Clip Count -->
                    <span class="project-card__meta-text">{{ getClipCount(project.id) }} clips</span>
                  </div>
                </div>

                <!-- Hover Overlay Buttons -->
                <div class="project-card__hover-actions">
                  <button
                    v-if="canDetectClips(project.id) && !isProjectDetecting(project.id) && isAIAllowed"
                    class="project-card__action-btn"
                    title="Detect Clips"
                    @click.stop="startProjectDetection(project)"
                  >
                    <Sparkles class="project-card__action-icon" />
                  </button>

                  <button
                    v-if="canTranscribe(project.id)"
                    class="project-card__action-btn"
                    :class="{ 'project-card__action-btn--transcribed': isProjectTranscribed(project.id) }"
                    :title="isProjectTranscribed(project.id) ? 'Transcribed' : 'Transcribe'"
                    @click.stop="startTranscription(project)"
                  >
                    <FileText class="project-card__action-icon" />
                  </button>

                  <button
                    v-if="hasDirectVideos(project.id) || hasChildren(project.id)"
                    class="project-card__action-btn"
                    :class="{ 'project-card__action-btn--preset-active': hasVodPreset(project.id) }"
                    title="Pre-Edit VOD"
                    @click.stop="openVodPresetEditor(project)"
                  >
                    <LayoutDashboard class="project-card__action-icon" />
                  </button>

                  <button class="project-card__action-btn" title="Edit" @click.stop="editProject(project)">
                    <Edit class="project-card__action-icon" />
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
      :video-duration="segmentsToDetect.length === 1 ? totalDetectionDuration : 0"
      :segment-count="segmentsToDetect.length > 1 ? segmentsToDetect.length : 0"
      :total-duration="totalDetectionDuration"
      @update:model-value="showProjectDetectDialog = $event"
      @confirm="onProjectDetectClipsConfirmed"
    />
    <!-- Transcription Confirm Dialog -->
    <TranscriptionConfirmDialog
      :model-value="showTranscribeDialog"
      :video-duration="0"
      :segment-count="segmentsToTranscribe.length"
      :total-duration="totalTranscribeDuration"
      :is-transcribed="segmentsToTranscribe.length === 1 && projectTranscriptStatus[segmentsToTranscribe[0]?.id]"
      @update:model-value="showTranscribeDialog = $event"
      @confirm="onTranscribeConfirmed"
    />
    <!-- Folder Clip Build Dialog -->
    <ClipBuildSettingsDialog
      v-model="showFolderBuildDialog"
      :clip="folderClipToBuild"
      :watermark-settings="folderCreatorWatermarkSettings"
      :default-intro="folderCreatorDefaultIntro"
      :default-outro="folderCreatorDefaultOutro"
      :creator-profile-server-id="folderCreatorProfileServerId"
      @confirm="onFolderBuildConfirm"
    />

    <!-- Free Tier Limit Dialog -->
    <FreeTierLimitDialog
      :show="showFreeTierLimitDialog"
      :limit-info="freeTierLimitInfo"
      @close="showFreeTierLimitDialog = false"
    />

    <!-- Folder Contents Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showFolderDialog && folderProject"
          class="folder-dialog__overlay"
          @click.self="showFolderDialog = false"
        >
          <Transition name="dialog" appear>
            <div
              v-if="showFolderDialog"
              class="folder-dialog"
              :class="folderDialogSizeClass"
              role="dialog"
              aria-modal="true"
            >
              <!-- Accent bar -->
              <div class="folder-dialog__accent"></div>

              <!-- Header (compact) -->
              <div class="folder-dialog__header">
                <div class="folder-dialog__header-left">
                  <!-- Selection Controls (visible when items selected) -->
                  <template v-if="selectedFolderChildren.size > 0">
                    <button
                      @click="confirmBulkDeleteFolderChildren"
                      :disabled="hasAnySelectedFolderChildDetecting()"
                      class="folder-dialog__selection-delete"
                      :class="{ 'folder-dialog__selection-delete--disabled': hasAnySelectedFolderChildDetecting() }"
                      :title="
                        hasAnySelectedFolderChildDetecting() ? 'Cannot delete while detection is in progress' : ''
                      "
                    >
                      <Trash2 :size="14" />
                      Delete ({{ selectedFolderChildren.size }})
                    </button>
                    <span class="folder-dialog__selection-count">{{ selectedFolderChildren.size }} selected</span>
                    <button @click="clearFolderChildSelection" class="folder-dialog__selection-clear">Clear</button>
                  </template>

                  <!-- Normal header (hidden when items selected) -->
                  <template v-else>
                    <div class="folder-dialog__header-icon">
                      <FolderOpen :size="16" />
                    </div>
                    <h2 class="folder-dialog__title" :title="folderProject.name">{{ folderProject.name }}</h2>
                  </template>
                </div>

                <button class="folder-dialog__close" @click="showFolderDialog = false" title="Close">
                  <X :size="18" />
                </button>
              </div>

              <!-- Tabs -->
              <div class="folder-dialog__tabs">
                <button
                  @click="onFolderTabChange('segments')"
                  class="folder-dialog__tab"
                  :class="{ 'folder-dialog__tab--active': folderActiveTab === 'segments' }"
                >
                  <FolderOpen :size="14" />
                  <span>Segments</span>
                  <span class="folder-dialog__tab-count">{{ getEffectiveSegmentCount(folderProject.id) }}</span>
                </button>
                <button
                  @click="onFolderTabChange('clips')"
                  class="folder-dialog__tab"
                  :class="{ 'folder-dialog__tab--active': folderActiveTab === 'clips' }"
                >
                  <Video :size="14" />
                  <span>Clips</span>
                  <span class="folder-dialog__tab-count">{{ folderTotalClipsCount }}</span>
                </button>
              </div>

              <!-- Tab-specific guidance -->
              <div
                class="folder-dialog__guidance"
                :class="`folder-dialog__guidance--${folderActiveTab}`"
              >
                <div v-if="folderActiveTab === 'segments'" class="folder-dialog__guidance-inner">
                  <div class="folder-dialog__guidance-icon folder-dialog__guidance-icon--edit">
                    <Edit :size="16" />
                  </div>
                  <div class="folder-dialog__guidance-text">
                    <p class="folder-dialog__guidance-title">Edit segments</p>
                    <p class="folder-dialog__guidance-body">
                      Open a segment to edit subtitles, adjust subtitle positioning, change framing, fine-tune
                      timing, and modify clip details.
                    </p>
                  </div>
                </div>
                <div v-else class="folder-dialog__guidance-inner">
                  <div class="folder-dialog__guidance-icon folder-dialog__guidance-icon--publish">
                    <Hammer :size="16" />
                  </div>
                  <div class="folder-dialog__guidance-text">
                    <p class="folder-dialog__guidance-title">Quick build &amp; publish</p>
                    <p class="folder-dialog__guidance-body">
                      Preview detected clips, build exports, and publish from here. This tab is not for editing
                      subtitles or positioning — use Segments for that.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Content -->
              <div
                class="folder-dialog__content"
                :class="{ 'folder-dialog__content--clips': folderActiveTab === 'clips' }"
              >
                <!-- Segments Tab -->
                <div v-if="folderActiveTab === 'segments'" class="folder-dialog__segments">
                  <div
                    class="folder-dialog__segments-grid"
                    :class="{
                      'folder-dialog__segments-grid--1': paginatedFolderChildren.length <= 1,
                      'folder-dialog__segments-grid--2': paginatedFolderChildren.length === 2,
                      'folder-dialog__segments-grid--3': paginatedFolderChildren.length >= 3,
                    }"
                  >
                    <div
                      v-for="project in paginatedFolderChildren"
                      :key="project.id"
                      class="folder-dialog__segment-card"
                      :class="{ 'folder-dialog__segment-card--selected': isFolderChildSelected(project.id) }"
                      @click="openWorkspace(project)"
                    >
                      <!-- Selection Checkbox -->
                      <div
                        class="folder-dialog__segment-checkbox"
                        :class="{ 'folder-dialog__segment-checkbox--visible': isFolderChildSelected(project.id) }"
                        @click.stop="toggleFolderChildSelection(project.id)"
                      >
                        <div
                          class="folder-dialog__segment-checkbox-box"
                          :class="{ 'folder-dialog__segment-checkbox-box--checked': isFolderChildSelected(project.id) }"
                        >
                          <Check v-if="isFolderChildSelected(project.id)" :size="14" />
                        </div>
                      </div>

                      <!-- Thumbnail background -->
                      <div
                        v-if="getThumbnailUrl(project.id)"
                        class="folder-dialog__segment-thumb"
                        :style="{ backgroundImage: `url(${getThumbnailUrl(project.id)})` }"
                      >
                        <div class="folder-dialog__segment-thumb-overlay"></div>
                      </div>
                      <div v-else class="folder-dialog__segment-thumb folder-dialog__segment-thumb--empty">
                        <div class="folder-dialog__segment-thumb-overlay"></div>
                        <div class="folder-dialog__segment-thumb-placeholder">
                          <Play :size="32" />
                        </div>
                      </div>

                      <!-- Detection Progress Indicator -->
                      <div v-if="isDetectionActive(project.id)" class="folder-dialog__segment-detecting">
                        <Loader2 :size="12" class="folder-dialog__spin" />
                        <span>Detecting...</span>
                      </div>
                      <!-- Transcription Progress Indicator -->
                      <div
                        v-else-if="activeTranscriptions.has(project.id)"
                        class="folder-dialog__segment-detecting"
                        style="background: rgba(34, 197, 94, 0.85)"
                      >
                        <Loader2 :size="12" class="folder-dialog__spin" />
                        <span>Transcribing...</span>
                      </div>
                      <!-- Transcribed Badge -->
                      <div
                        v-else-if="projectTranscriptStatus[project.id]"
                        class="folder-dialog__segment-duration"
                        style="background: rgba(34, 197, 94, 0.85)"
                      >
                        <FileText :size="12" />
                        Transcribed
                      </div>
                      <!-- Duration Badge -->
                      <div v-else-if="getProjectDuration(project.id)" class="folder-dialog__segment-duration">
                        <Clock :size="12" />
                        {{ getProjectDuration(project.id) }}
                      </div>

                      <!-- Info -->
                      <div class="folder-dialog__segment-info">
                        <h3 class="folder-dialog__segment-name">{{ project.name }}</h3>
                        <p class="folder-dialog__segment-meta">
                          {{ project.description || 'No description' }} • {{ getRelativeTime(project.updated_at) }}
                        </p>
                      </div>

                      <!-- Hover Overlay -->
                      <div class="folder-dialog__segment-hover">
                        <button
                          class="folder-dialog__segment-action"
                          title="Edit segment — subtitles, positioning, framing, and clip details"
                          @click.stop="openWorkspace(project)"
                        >
                          <Edit :size="20" />
                        </button>
                        <button
                          v-if="
                            canDetectClips(project.id) &&
                            !isDetectionActive(project.id) &&
                            !isProjectDetecting(folderProject?.id || '') &&
                            isAIAllowed
                          "
                          class="folder-dialog__segment-action"
                          title="Detect Clips"
                          @click.stop="startProjectDetection(project)"
                        >
                          <Sparkles :size="20" />
                        </button>
                        <button
                          v-if="
                            canTranscribe(project.id) &&
                            !isDetectionActive(project.id) &&
                            !activeTranscriptions.has(project.id)
                          "
                          class="folder-dialog__segment-action"
                          :class="{ 'folder-dialog__segment-action--transcribed': projectTranscriptStatus[project.id] }"
                          :title="projectTranscriptStatus[project.id] ? 'Already Transcribed' : 'Transcribe'"
                          @click.stop="startTranscription(project)"
                        >
                          <FileText :size="20" />
                        </button>
                        <button
                          v-if="!isDetectionActive(project.id) && !isProjectDetecting(folderProject?.id || '')"
                          class="folder-dialog__segment-action"
                          title="Delete"
                          @click.stop="confirmDelete(project)"
                        >
                          <Trash2 :size="20" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Clips Tab - 2 Column Layout -->
                <div v-else-if="folderActiveTab === 'clips'" class="folder-dialog__clips-layout">
                  <!-- Left Column: Clips List -->
                  <div class="folder-dialog__clips-list">
                    <!-- Loading State -->
                    <div v-if="folderClipsLoading" class="folder-dialog__clips-loading">
                      <Loader2 :size="24" class="folder-dialog__spin" />
                    </div>

                    <!-- Empty State -->
                    <div v-else-if="folderClips.length === 0" class="folder-dialog__clips-empty">
                      <div class="folder-dialog__clips-empty-icon">
                        <Video :size="32" />
                      </div>
                      <h3 class="folder-dialog__clips-empty-title">No Clips Detected</h3>
                      <p class="folder-dialog__clips-empty-text">
                        Run clip detection on a segment first. Detected clips will appear here for preview, quick
                        builds, and publishing.
                      </p>
                    </div>

                    <!-- Clips List -->
                    <div v-else class="folder-dialog__clips-items">
                      <ClipsTab
                        :clips="folderClips"
                        :project-id="folderProject?.id || null"
                        :hide-header="true"
                        :play-on-card-click="true"
                        :is-generating="false"
                        :generation-progress="0"
                        :generation-stage="''"
                        :generation-message="''"
                        :generation-error="''"
                        :playing-clip-id="clipToPreview?.id || null"
                        :is-playing-segments="false"
                        :hovered-timeline-clip-id="null"
                        :video-duration="0"
                        :prompts="folderPrompts"
                        :transcript-data="null"
                        :show-adjust-clip-button="true"
                        :vod-preset-config="folderProject ? vodPresetConfigs[folderProject.id] || null : null"
                        @play-clip="onClipsTabPlayClip"
                        @delete-clip="deleteFolderClip"
                        @edit-clip="onClipsTabEditClip"
                        @adjust-clip="onClipsTabAdjustClip"
                        @refresh-clips="onClipsTabRefreshClips"
                        @detect-clips="onClipsTabDetectClips"
                        @publish-now="onClipsTabPublishNow"
                      />
                    </div>
                  </div>

                  <!-- Right Column: Video Player -->
                  <div class="folder-dialog__player">
                    <!-- No clip selected state -->
                    <div v-if="!clipToPreview" class="folder-dialog__player-empty">
                      <div class="folder-dialog__player-empty-icon">
                        <PlayIcon :size="40" />
                      </div>
                      <h3 class="folder-dialog__player-empty-title">Select a Clip to Preview</h3>
                      <p class="folder-dialog__player-empty-text">
                        Click a clip to preview, build, or publish. To edit subtitles or positioning, open the segment
                        from the Segments tab.
                      </p>
                    </div>

                    <!-- Video Player -->
                    <template v-else>
                      <!-- Clip Info Header -->
                      <div class="folder-dialog__player-header">
                        <div class="folder-dialog__player-info">
                          <h3 class="folder-dialog__player-title">
                            {{ clipToPreview.current_version?.name || clipToPreview.name || 'Untitled Clip' }}
                          </h3>
                          <p class="folder-dialog__player-segment">{{ clipToPreview.segment_name }}</p>
                        </div>
                      </div>

                      <!-- Video Container -->
                      <div
                        ref="inlineVideoContainerRef"
                        class="folder-dialog__player-video"
                        :class="{ 'inline-video-fullscreen': isInlineVideoFullscreen }"
                      >
                        <video
                          v-if="inlineVideoSrc"
                          ref="inlineVideoRef"
                          class="folder-dialog__player-video-el"
                          :src="inlineVideoSrc"
                          @loadedmetadata="onInlineVideoLoaded"
                          @timeupdate="onInlineVideoTimeUpdate"
                          @ended="onInlineVideoEnded"
                          @click="toggleInlineVideoPlay"
                        ></video>
                        <div v-else-if="inlineVideoLoading" class="folder-dialog__player-loading">
                          <Loader2 :size="32" class="folder-dialog__spin" />
                        </div>
                        <div v-else class="folder-dialog__player-no-source">
                          <p>No video source available</p>
                        </div>

                        <!-- Watermark Overlay -->
                        <div
                          v-if="previewWatermarkData && previewWatermarkSettings && inlineVideoSrc"
                          class="folder-dialog__player-watermark"
                          :style="getPreviewWatermarkStyle"
                        >
                          <img
                            :src="previewWatermarkData.dataUrl"
                            alt="Watermark"
                            :class="isPreviewWatermarkFullFrame ? '' : 'folder-dialog__player-watermark-img'"
                            :style="getPreviewWatermarkImageStyle"
                          />
                        </div>

                        <!-- Custom Video Controls -->
                        <div
                          v-if="inlineVideoSrc"
                          class="folder-dialog__player-controls"
                          :class="{ 'folder-dialog__player-controls--visible': isInlineVideoFullscreen }"
                        >
                          <!-- Progress Bar -->
                          <div
                            ref="inlineProgressBarRef"
                            class="folder-dialog__player-progress"
                            @mousedown="startInlineSeekDrag"
                            @mousemove="onInlineTimelineHover"
                            @mouseleave="onInlineTimelineLeave"
                          >
                            <div class="folder-dialog__player-progress-track">
                              <div class="folder-dialog__player-progress-bg"></div>
                              <div
                                class="folder-dialog__player-progress-bar"
                                :class="{ 'folder-dialog__player-progress-bar--smooth': !inlineSeekDragging }"
                                :style="{ width: `${inlineVideoProgress}%` }"
                              ></div>
                            </div>
                            <div
                              class="folder-dialog__player-progress-thumb"
                              :class="{
                                'folder-dialog__player-progress-thumb--large': inlineSeekDragging,
                                'folder-dialog__player-progress-thumb--smooth': !inlineSeekDragging,
                              }"
                              :style="{ left: `${inlineVideoProgress}%` }"
                            ></div>
                            <div
                              v-if="inlineHoverTime !== null || inlineSeekDragging"
                              class="folder-dialog__player-progress-tooltip"
                              :style="{ left: `${inlineSeekDragging ? inlineVideoProgress : inlineHoverPosition}%` }"
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
                          <div class="folder-dialog__player-controls-row">
                            <div class="folder-dialog__player-controls-left">
                              <button @click="toggleInlineVideoPlay" class="folder-dialog__player-btn">
                                <PlayIcon v-if="!inlineVideoPlaying" :size="20" />
                                <Pause v-else :size="20" />
                              </button>
                              <div class="folder-dialog__player-volume">
                                <button @click="toggleInlineVideoMute" class="folder-dialog__player-btn">
                                  <VolumeX v-if="inlineVideoMuted || inlineVideoVolume === 0" :size="16" />
                                  <Volume2 v-else :size="16" />
                                </button>
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.1"
                                  :value="inlineVideoMuted ? 0 : inlineVideoVolume"
                                  @input="setInlineVideoVolume"
                                  class="folder-dialog__player-volume-slider"
                                />
                              </div>
                              <span class="folder-dialog__player-time">
                                {{ formatClipTime(inlineVideoCurrentTime) }} /
                                {{ formatClipTime(inlineVideoClipDuration) }}
                              </span>
                            </div>
                            <button
                              @click="toggleInlineVideoFullscreen"
                              class="folder-dialog__player-btn"
                              :title="isInlineVideoFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
                            >
                              <Minimize2 v-if="isInlineVideoFullscreen" :size="16" />
                              <Maximize2 v-else :size="16" />
                            </button>
                          </div>
                        </div>

                        <!-- Play overlay when paused -->
                        <div
                          v-if="inlineVideoSrc && !inlineVideoPlaying && !inlineVideoLoading"
                          class="folder-dialog__player-play-overlay"
                          @click="toggleInlineVideoPlay"
                        >
                          <div class="folder-dialog__player-play-btn">
                            <PlayIcon :size="32" />
                          </div>
                        </div>
                      </div>

                      <!-- Clip Description -->
                      <div
                        v-if="clipToPreview.current_version_detection_reason"
                        class="folder-dialog__player-description"
                      >
                        <p>"{{ clipToPreview.current_version_detection_reason }}"</p>
                      </div>
                    </template>
                  </div>
                </div>
              </div>

              <!-- Footer with Pagination (only for segments tab) -->
              <div v-if="folderActiveTab === 'segments' && folderTotalPages > 1" class="folder-dialog__footer">
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
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <!-- Delete Project Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDeleteDialog" class="delete-dialog__overlay" @click.self="handleDeleteDialogClose">
          <Transition name="dialog" appear>
            <div class="delete-dialog">
              <!-- Accent Bar -->
              <div class="delete-dialog__accent" />

              <!-- Header -->
              <div class="delete-dialog__header">
                <button
                  class="delete-dialog__close"
                  @click="handleDeleteDialogClose"
                  :disabled="deletingProject"
                  title="Close"
                >
                  <X :size="18" />
                </button>
                <div class="delete-dialog__icon">
                  <AlertTriangle :size="24" />
                </div>
                <h2 class="delete-dialog__title">Delete Project</h2>
                <p class="delete-dialog__subtitle">
                  {{
                    projectHasVideos || projectHasClips
                      ? 'This project contains content'
                      : 'This action cannot be undone'
                  }}
                </p>
              </div>

              <!-- Content -->
              <div class="delete-dialog__content">
                <div class="delete-dialog__message">
                  <p class="delete-dialog__text">
                    Are you sure you want to delete "
                    <span class="delete-dialog__text--highlight">{{ projectToDelete?.name }}</span>
                    "?
                  </p>
                  <p class="delete-dialog__warning">This action cannot be undone.</p>
                </div>

                <!-- Content warnings -->
                <div v-if="projectHasVideos || projectHasClips" class="delete-dialog__info-card">
                  <div class="delete-dialog__info-icon">
                    <Info :size="16" />
                  </div>
                  <div class="delete-dialog__info-content">
                    <p class="delete-dialog__info-title">What will be deleted:</p>
                    <ul class="delete-dialog__info-list">
                      <li v-if="projectHasVideos">
                        <strong>Delete:</strong>
                        Raw video files from disk
                      </li>
                      <li v-if="projectHasClips">
                        <strong>Delete:</strong>
                        Unbuilt clips not being edited
                      </li>
                      <li v-if="projectHasClips">
                        <strong>Keep:</strong>
                        Built clips (available in My Clips)
                      </li>
                      <li v-if="projectHasClips">
                        <strong>Keep:</strong>
                        Clips currently in the editor
                      </li>
                    </ul>
                  </div>
                </div>

                <!-- Segments deletion option - only show if more than 1 segment -->
                <div
                  v-if="hasChildren(projectToDelete?.id || '') && getChildCount(projectToDelete?.id || '') > 1"
                  class="delete-dialog__segments-section"
                >
                  <p class="delete-dialog__segments-title">
                    This project contains
                    <span class="delete-dialog__text--highlight">
                      {{ getChildCount(projectToDelete?.id || '') }} segments
                    </span>
                    . What would you like to do with them?
                  </p>
                  <div class="delete-dialog__segments-options">
                    <label
                      class="delete-dialog__segment-option"
                      :class="{ 'delete-dialog__segment-option--selected': !deleteSegmentsToo }"
                    >
                      <input type="radio" :value="false" v-model="deleteSegmentsToo" class="delete-dialog__radio" />
                      <div class="delete-dialog__segment-option-content">
                        <span class="delete-dialog__segment-option-title">Keep segments</span>
                        <p class="delete-dialog__segment-option-desc">
                          Segments will be un-grouped and remain in your library
                        </p>
                      </div>
                    </label>
                    <label
                      class="delete-dialog__segment-option"
                      :class="{ 'delete-dialog__segment-option--selected': deleteSegmentsToo }"
                    >
                      <input type="radio" :value="true" v-model="deleteSegmentsToo" class="delete-dialog__radio" />
                      <div class="delete-dialog__segment-option-content">
                        <span class="delete-dialog__segment-option-title">Delete all segments</span>
                        <p class="delete-dialog__segment-option-desc">
                          All {{ getChildCount(projectToDelete?.id || '') }} segments will be permanently deleted
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <!-- Single segment notice - auto-deleted with parent -->
                <div
                  v-else-if="hasChildren(projectToDelete?.id || '') && getChildCount(projectToDelete?.id || '') === 1"
                  class="delete-dialog__info-card"
                >
                  <div class="delete-dialog__info-icon">
                    <Info :size="16" />
                  </div>
                  <div class="delete-dialog__info-content">
                    <p class="delete-dialog__info-text">
                      This project contains
                      <span class="delete-dialog__text--highlight">1 segment</span>
                      which will also be deleted along with its video files.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="delete-dialog__footer">
                <button
                  class="delete-dialog__btn delete-dialog__btn--secondary"
                  @click="handleDeleteDialogClose"
                  :disabled="deletingProject"
                >
                  Cancel
                </button>
                <button
                  class="delete-dialog__btn delete-dialog__btn--primary"
                  @click="deleteProjectConfirmed"
                  :disabled="deletingProject"
                >
                  <Loader2 v-if="deletingProject" :size="16" class="delete-dialog__spinner" />
                  {{
                    deletingProject
                      ? 'Deleting...'
                      : deleteSegmentsToo && hasChildren(projectToDelete?.id || '')
                        ? getChildCount(projectToDelete?.id || '') === 1
                          ? 'Delete Project & Segment'
                          : `Delete Project & ${getChildCount(projectToDelete?.id || '')} Segments`
                        : 'Delete Project'
                  }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Bulk Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showBulkDeleteDialog"
      :title="`Delete ${selectedProjects.size} Projects`"
      subtitle="This action cannot be undone"
      :message="`Are you sure you want to delete ${selectedProjects.size} projects? This will also delete all associated segments and video files.`"
      :confirm-text="bulkDeleting ? 'Deleting...' : `Delete ${selectedProjects.size} Projects`"
      close-text="Cancel"
      variant="destructive"
      @close="handleBulkDeleteDialogClose"
      @confirm="bulkDeleteConfirmed"
    />

    <!-- Bulk Delete Folder Children Confirmation Modal -->
    <ConfirmationModal
      :show="showBulkDeleteFolderChildrenDialog"
      :title="`Delete ${selectedFolderChildren.size} Segments`"
      subtitle="This action cannot be undone"
      :message="`Are you sure you want to delete ${selectedFolderChildren.size} segment${selectedFolderChildren.size !== 1 ? 's' : ''}? This will also delete all associated video files.`"
      :confirm-text="`Delete ${selectedFolderChildren.size} Segments`"
      close-text="Cancel"
      variant="destructive"
      @close="handleBulkDeleteFolderChildrenDialogClose"
      @confirm="bulkDeleteFolderChildrenConfirmed"
    />

    <!-- Search Palette Modal -->
    <SearchPalette
      v-model="showSearchPalette"
      :search-query="paletteSearchQuery"
      :active-tab="paletteActiveTab"
      :placeholder="
        paletteActiveTab === 'search'
          ? 'Search projects by name or description...'
          : paletteActiveTab === 'live'
            ? 'Filter live projects...'
            : 'Filter projects with clips...'
      "
      :tabs="projectsPaletteTabs"
      @update:search-query="paletteSearchQuery = $event"
      @update:active-tab="onPaletteTabChange"
      @close="closeSearchPalette"
    >
      <!-- Search Results -->
      <template v-if="paletteSearchResults.length > 0">
        <div class="search-palette__results">
          <div class="search-palette__results-header">
            <span class="search-palette__results-label">
              {{
                paletteActiveTab === 'live'
                  ? 'Live Projects'
                  : paletteActiveTab === 'with_clips'
                    ? 'Projects with Clips'
                    : 'Results'
              }}
            </span>
            <span class="search-palette__results-count">{{ paletteSearchResults.length }} found</span>
          </div>
          <div class="search-palette__list">
            <div
              v-for="item in paletteSearchResults"
              :key="item.id"
              class="search-palette__item"
              @click="selectPaletteResult(item)"
            >
              <div class="search-palette__item-thumb-wrap">
                <div
                  v-if="item.thumbnailUrl"
                  class="search-palette__item-thumb"
                  :style="{ backgroundImage: `url(${item.thumbnailUrl})` }"
                ></div>
                <div v-else class="search-palette__item-thumb search-palette__item-thumb--empty">
                  <Folder class="w-5 h-5" />
                </div>
                <div v-if="item.isLive" class="search-palette__item-live-badge" title="Live">
                  <Radio class="w-3 h-3" />
                </div>
              </div>

              <div class="search-palette__item-content">
                <div class="search-palette__item-title">{{ item.project.name }}</div>
                <div class="search-palette__item-meta">
                  <!-- Platform -->
                  <span v-if="item.platform" class="search-palette__item-platform">
                    {{ item.platform }}
                  </span>
                  <!-- Live Badge -->
                  <span v-if="item.isLive" class="search-palette__item-live-tag">
                    <span class="search-palette__live-dot"></span>
                    Live
                  </span>
                  <!-- Clip Count -->
                  <span v-if="item.clipCount > 0" class="search-palette__item-clips">
                    {{ item.clipCount }} clip{{ item.clipCount !== 1 ? 's' : '' }}
                  </span>
                </div>
              </div>

              <div class="search-palette__item-arrow">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 4L10 8L6 12"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- No Results -->
      <template v-else-if="paletteSearchQuery || paletteActiveTab !== 'search'">
        <div class="search-palette__empty-state">
          <div class="search-palette__empty-icon-wrap">
            <Search v-if="paletteActiveTab === 'search'" class="search-palette__empty-icon" />
            <Radio v-else-if="paletteActiveTab === 'live'" class="search-palette__empty-icon" />
            <Video v-else class="search-palette__empty-icon" />
          </div>
          <h3 class="search-palette__empty-title">
            {{
              paletteActiveTab === 'live'
                ? 'No live projects'
                : paletteActiveTab === 'with_clips'
                  ? 'No projects with clips'
                  : 'No projects found'
            }}
          </h3>
          <p class="search-palette__empty-desc">
            {{
              paletteActiveTab === 'live'
                ? 'Start monitoring a livestream to see it here'
                : paletteActiveTab === 'with_clips'
                  ? 'Detect clips in your projects to see them here'
                  : 'Try a different search term'
            }}
          </p>
        </div>
      </template>

      <!-- Initial State -->
      <template v-else>
        <div class="search-palette__empty-state">
          <div class="search-palette__empty-icon-wrap search-palette__empty-icon-wrap--subtle">
            <Search class="search-palette__empty-icon" />
          </div>
          <h3 class="search-palette__empty-title">Search your projects</h3>
          <p class="search-palette__empty-desc">Find projects by name or description</p>
        </div>
      </template>
    </SearchPalette>

    <!-- Existing Project Dialog -->
    <ExistingProjectDialog
      :show="showExistingProjectDialog"
      :existing-project="existingProjectForClip"
      @open-existing="onOpenExistingProject"
      @create-new="onCreateNewProject"
    />

    <!-- Auth Modal -->
    <AuthModal v-model="showAuthModal" />

    <!-- Quick Publish Wizard -->
    <QuickPublishWizard
      :show="showFolderPublishWizard"
      :clip="folderClipToPublish"
      :clip-path="folderClipToPublishPath"
      :project-id="folderProject?.id || ''"
      :thumbnail-url="folderClipToPublishThumbnail"
      @close="onFolderPublishWizardClose"
    />

    <!-- VOD Preset Editor -->
    <VodPresetEditor
      v-model="showVodPresetEditor"
      :project-id="vodPresetProject?.id || ''"
      :initial-config="vodPresetInitialConfig"
      :creator-profile-id="vodPresetProject?.creator_profile_id"
      :thumbnail-url="vodPresetProject ? thumbnailCache.get(vodPresetProject.id) : null"
      :video-path="(vodPresetProject && projectVideos[vodPresetProject.id]?.[0]?.file_path) || null"
      :video-duration="(vodPresetProject && projectVideos[vodPresetProject.id]?.[0]?.duration) || 0"
      @confirm="onVodPresetConfirmed"
      @clear="onVodPresetCleared"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed, watch, nextTick, Transition } from 'vue';
  import { invoke } from '@tauri-apps/api/core';
  import { formatDateTime, formatDate } from '@/utils/dateTimeUtils';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import Hls from 'hls.js';
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
    XCircle,
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
    HelpCircle,
    AlertTriangle,
    Info,
    FileText,
    LayoutDashboard,
  } from 'lucide-vue-next';
  import {
    getAllProjects,
    getClipsWithVersionsByProjectId,
    getClipsWithVersionsForProjectAndChildren,
    deleteProject,
    deleteProjectWithRetention,
    createProject,
    updateProject,
    getRawVideosByProjectId,
    hasRawVideosForProject,
    hasClipsForProject,
    deleteClip,
    getAllPrompts,
    getCreatorProfileByProjectId,
    getIntroOutroById,
    getWatermarkByServerId,
    getVideoEditorProjectsForClip,
    getAllVideoEditorProjects,
    type Project,
    type RawVideo,
    type ClipWithVersion,
    type ClipWithVersionAndSegment,
    type IntroOutro,
    type Prompt,
    type WatermarkSettings,
    type VideoEditorProject,
    hasTranscriptForProject,
  } from '@/services/database';
  import {
    isShortVideoAutoClipEligible,
    SHORT_VIDEO_CLIP_THRESHOLD_SECONDS,
  } from '@/services/database/auto-clips';
  import { useInEditorClips } from '@/stores/useInEditorClips';
  import { useClipThumbnailStore } from '@/stores/clipThumbnails';
  import { persistentCache } from '@/utils/persistentCache';
  import { getWatermarkImage } from '@/services/database/watermarks';
  import { extractMintId } from '@/services/pumpfun';
  import { useFormatters } from '@/composables/useFormatters';
  import { useToast } from '@/composables/useToast';
  import { useLivestreamMonitoring } from '@/composables/useLivestreamMonitoring';
  import { useVideoOperations } from '@/composables/useVideoOperations';
  import { useDownloads } from '@/composables/useDownloads';
  import { resolveBrandingProfile } from '@/composables/useBrandingProfileSelection';
  import PageLayout from '@/components/PageLayout.vue';
  import SkeletonGrid from '@/components/SkeletonGrid.vue';
  import ProjectDialog, { type ProjectFormData } from '@/components/ProjectDialog.vue';
  import ProjectWorkspaceDialog from '@/components/ProjectWorkspaceDialog.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import { Input } from '@/components/ui/input';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import DownloadCard from '@/components/DownloadCard.vue';
  import SearchPalette, { type SearchPaletteTab } from '@/components/SearchPalette.vue';
  import ClipDetectionConfirmDialog from '@/components/ClipDetectionConfirmDialog.vue';
  import TranscriptionConfirmDialog from '@/components/TranscriptionConfirmDialog.vue';
  import ClipBuildSettingsDialog, {
    type BuildSettings,
    type IntroOutroItem,
  } from '@/components/ClipBuildSettingsDialog.vue';
  import FreeTierLimitDialog from '@/components/FreeTierLimitDialog.vue';
  import ClipsTab from '@/components/ClipsTab.vue';
  import QuickPublishWizard from '@/components/QuickPublishWizard.vue';
  import { useRouter } from 'vue-router';
  import ExistingProjectDialog from '@/components/clip-editor/ExistingProjectDialog.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import { createVideoEditorProjectFromClip } from '@/services/video-editor-project-creator';
  import { ensureAssetDownloaded, type ServerOrganizationAsset } from '@/services/orgAssetSync';
  import { getUserOrganizationAssets } from '@/services/organizationAssetsApi';
  import { useChunkedClipDetection } from '@/composables/useChunkedClipDetection';
  import { useTranscriptionOnly } from '@/composables/useTranscriptionOnly';
  import { useAuthStore } from '@/stores/auth';
  import { useClipDetectionTracking } from '@/composables/useClipDetectionTracking';
  import { useSubscriptionGate } from '@/composables/useSubscriptionGate';
  import { useSubscription } from '@/composables/useSubscription';
  import { useAIPermission } from '@/composables/useAIPermission';
  const router = useRouter();
  // AI Permission check
  const { isAIAllowed } = useAIPermission();
  const { gates } = useSubscriptionGate();
  const { fetchSubscriptionStatus } = useSubscription();
  import { utf8ToBase64Url } from '@/utils/encoding';
  import { save } from '@tauri-apps/plugin-dialog';
  import VodPresetEditor from '@/components/VodPresetEditor.vue';
  import {
    setProjectVodPreset,
    clearProjectVodPreset,
    getProjectVodPresetConfig,
  } from '@/services/database/vod-presets';
  import type { ActiveVodPresetConfig } from '@/types';

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
  const videoEditorProjects = ref<Record<string, VideoEditorProject>>({});
  const thumbnailCache = ref<Map<string, string>>(new Map());
  // Use persistent clip thumbnail store instead of component-level cache
  const clipThumbnailStore = useClipThumbnailStore();
  const { getRelativeTime, formatDuration } = useFormatters();
  const { success, error } = useToast();
  const { activeSessions } = useLivestreamMonitoring();
  const inEditorStore = useInEditorClips();
  inEditorStore.hydrate();
  const { processVideoFile } = useVideoOperations();
  const {
    getActiveDownloads,
    getQueuedDownloads,
    getCompletedDownloads,
    cancelAllDownloads,
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
  const showAuthModal = ref(false);

  // Project-level clip detection state
  const showProjectDetectDialog = ref(false);
  const projectToDetect = ref<Project | null>(null);
  const segmentsToDetect = ref<Project[]>([]);
  const totalDetectionDuration = ref(0);
  const isDetectingProject = ref(false);
  const authStore = useAuthStore();
  const { startDetection, updateProgress, completeDetection, isDetectionActive } = useClipDetectionTracking();

  // Transcription-only state
  const showTranscribeDialog = ref(false);
  const projectToTranscribe = ref<Project | null>(null);
  const segmentsToTranscribe = ref<Project[]>([]);
  const totalTranscribeDuration = ref(0);
  const projectTranscriptStatus = ref<Record<string, boolean>>({});
  const activeTranscriptions = ref<Set<string>>(new Set());

  // VOD Preset Editor state
  const showVodPresetEditor = ref(false);
  const vodPresetProject = ref<Project | null>(null);
  const vodPresetInitialConfig = ref<ActiveVodPresetConfig | null>(null);
  const vodPresetConfigs = ref<Record<string, ActiveVodPresetConfig>>({});

  function hasVodPreset(projectId: string): boolean {
    return !!vodPresetConfigs.value[projectId];
  }

  async function openVodPresetEditor(project: Project) {
    console.log('[Projects] Opening VodPresetEditor for project:', project.id, 'parent_id:', project.parent_id);
    vodPresetProject.value = project;
    // Load existing config
    try {
      const config = await getProjectVodPresetConfig(project.id);
      console.log(
        '[Projects] VodPresetEditor loaded existing config:',
        config ? `found (${config.targetAspectRatio})` : 'not found'
      );
      vodPresetInitialConfig.value = config;
    } catch (e) {
      console.warn('[Projects] Failed to load VOD preset config:', e);
      vodPresetInitialConfig.value = null;
    }
    showVodPresetEditor.value = true;
  }

  async function onVodPresetConfirmed(config: ActiveVodPresetConfig) {
    if (!vodPresetProject.value) return;
    const projectId = vodPresetProject.value.id;
    console.log('[Projects] Saving VOD preset to project:', projectId, 'aspect ratio:', config.targetAspectRatio);
    try {
      await setProjectVodPreset(projectId, config.presetId, config);
      vodPresetConfigs.value[projectId] = config;
      console.log('[Projects] VOD preset saved successfully to project:', projectId);
      success('VOD pre-edit settings applied');
    } catch (e) {
      console.error('[Projects] Failed to save VOD preset:', e);
      error('Failed to save pre-edit settings');
    }
  }

  async function onVodPresetCleared() {
    if (!vodPresetProject.value) return;
    const projectId = vodPresetProject.value.id;
    try {
      await clearProjectVodPreset(projectId);
      delete vodPresetConfigs.value[projectId];
      success('VOD pre-edit settings removed');
    } catch (e) {
      console.error('[Projects] Failed to clear VOD preset:', e);
      error('Failed to remove pre-edit settings');
    }
  }

  async function loadVodPresetConfigs() {
    for (const project of projects.value) {
      if (project.active_vod_preset_config) {
        try {
          vodPresetConfigs.value[project.id] = JSON.parse(project.active_vod_preset_config);
        } catch {
          // ignore parse errors
        }
      }
    }
  }

  // Filter state
  const searchQuery = ref('');
  const sortBy = ref('updated-desc');
  const statusFilter = ref('all');

  // Search palette state
  const showSearchPalette = ref(false);
  const paletteSearchQuery = ref('');
  const paletteActiveTab = ref<'search' | 'live' | 'with_clips'>('search');

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

  // Count live projects and projects with clips for palette tabs
  const liveProjectsCount = computed(() => {
    return projects.value.filter((p) => isProjectLive(p.id)).length;
  });

  const projectsWithClipsCount = computed(() => {
    return projects.value.filter((p) => getClipCount(p.id) > 0).length;
  });

  // Computed tabs for search palette
  const projectsPaletteTabs = computed((): SearchPaletteTab[] => [
    { id: 'search', label: 'Search All', icon: Search },
    {
      id: 'live',
      label: 'Live Projects',
      icon: Radio,
      badge: liveProjectsCount.value > 0 ? liveProjectsCount.value : undefined,
    },
    {
      id: 'with_clips',
      label: 'With Clips',
      icon: Video,
      badge: projectsWithClipsCount.value > 0 ? projectsWithClipsCount.value : undefined,
    },
  ]);

  // Search results for the palette
  interface PaletteProjectResult {
    id: string;
    project: Project;
    thumbnailUrl: string | null;
    isLive: boolean;
    clipCount: number;
    platform: string | null;
  }

  const paletteSearchResults = computed((): PaletteProjectResult[] => {
    if (!paletteSearchQuery.value && paletteActiveTab.value === 'search') return [];

    let result = [...projects.value];

    // Apply search query filter
    if (paletteSearchQuery.value) {
      const query = paletteSearchQuery.value.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query))
      );
    }

    // Apply tab-specific filters
    if (paletteActiveTab.value === 'live') {
      result = result.filter((p) => isProjectLive(p.id));
    } else if (paletteActiveTab.value === 'with_clips') {
      result = result.filter((p) => getClipCount(p.id) > 0);
    }

    // Sort by updated_at descending
    result.sort((a, b) => b.updated_at - a.updated_at);

    // Limit results
    return result.slice(0, 20).map((project) => ({
      id: project.id,
      project,
      thumbnailUrl: getThumbnailUrl(project.id),
      isLive: isProjectLive(project.id),
      clipCount: getClipCount(project.id),
      platform: getProjectPlatform(project),
    }));
  });

  function openSearchPalette() {
    showSearchPalette.value = true;
    paletteSearchQuery.value = searchQuery.value;
  }

  function closeSearchPalette() {
    showSearchPalette.value = false;
    paletteSearchQuery.value = '';
    paletteActiveTab.value = 'search';
  }

  function onPaletteTabChange(tabId: string) {
    paletteActiveTab.value = tabId as 'search' | 'live' | 'with_clips';
    paletteSearchQuery.value = '';
  }

  function selectPaletteResult(result: PaletteProjectResult) {
    closeSearchPalette();
    handleProjectClick(result.project);
  }

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

      // Load video editor projects and create mapping by name
      const allVideoEditorProjects = await getAllVideoEditorProjects();
      videoEditorProjects.value = {};
      for (const vep of allVideoEditorProjects) {
        videoEditorProjects.value[vep.name] = vep;
      }
      console.log('[Projects] Loaded video editor projects:', allVideoEditorProjects.length);

      // Parallelize clip counts and video loading for all projects
      const clipCountPromises = projects.value.map(async (project) => {
        const clips = await getClipsWithVersionsByProjectId(project.id);
        return { projectId: project.id, count: clips.length };
      });

      const videoPromises = projects.value.map(async (project) => {
        const videos = await getRawVideosByProjectId(project.id);
        return { projectId: project.id, videos };
      });

      // Load clips and videos in parallel
      const [clipResults, videoResults] = await Promise.all([
        Promise.all(clipCountPromises),
        Promise.all(videoPromises),
      ]);

      // Populate clip counts and project videos
      for (const result of clipResults) {
        clipCounts.value[result.projectId] = result.count;
      }

      for (const result of videoResults) {
        projectVideos.value[result.projectId] = result.videos;
      }

      // Load thumbnails for first 20 projects immediately, rest in background
      const projectsNeedingThumbs = projects.value.filter((p) => !thumbnailCache.value.has(p.id));
      const visibleProjects = projectsNeedingThumbs.slice(0, 20);
      const remainingProjects = projectsNeedingThumbs.slice(20);

      // Load visible project thumbnails immediately
      await loadProjectThumbnailsBatch(visibleProjects);

      // Defer remaining thumbnails to after initial render
      if (remainingProjects.length > 0) {
        setTimeout(() => {
          loadProjectThumbnailsBatch(remainingProjects);
        }, 100);
      }
      // Load transcript statuses for all projects (non-blocking)
      const allProjectIds = projects.value.map((p) => p.id);
      loadTranscriptStatuses(allProjectIds);

      // Load VOD preset configs from project data
      loadVodPresetConfigs();
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      loading.value = false;
    }
  }

  // Helper function to load thumbnails for a batch of projects
  async function loadProjectThumbnailsBatch(projectList: Project[]) {
    const batchSize = 5;
    for (let i = 0; i < projectList.length; i += batchSize) {
      const batch = projectList.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (project) => {
          // Check persistent cache first
          try {
            const cached = await persistentCache.get<string>('thumbnails', `project-${project.id}`);
            if (cached) {
              thumbnailCache.value.set(project.id, cached);
              return;
            }
          } catch (error) {
            console.warn('[Projects] Failed to read thumbnail from cache:', error);
          }

          const videos = projectVideos.value[project.id] || [];

          if (project.thumbnail_path) {
            try {
              const dataUrl = await invoke<string>('read_file_as_data_url', {
                filePath: project.thumbnail_path,
              });
              thumbnailCache.value.set(project.id, dataUrl);
              // Save to persistent cache (24 hours TTL)
              persistentCache.set('thumbnails', `project-${project.id}`, dataUrl, 86400000).catch(() => {});
            } catch (error) {
              console.warn('[Projects] Failed to load project thumbnail:', project.id, error);
            }
          } else if (videos.length > 0 && videos[0].thumbnail_path) {
            try {
              project.thumbnail_path = videos[0].thumbnail_path;
              const dataUrl = await invoke<string>('read_file_as_data_url', {
                filePath: videos[0].thumbnail_path,
              });
              thumbnailCache.value.set(project.id, dataUrl);
              persistentCache.set('thumbnails', `project-${project.id}`, dataUrl, 86400000).catch(() => {});
              await updateProject(project.id, undefined, undefined, videos[0].thumbnail_path);
            } catch (error) {
              console.warn('[Projects] Failed to load video thumbnail:', project.id, error);
            }
          } else {
            // Try to get thumbnail from first clip or children (deferred complex logic)
            await loadThumbnailFromClipsOrChildren(project);
          }
        })
      );
    }
  }

  // Helper function for complex thumbnail fallback logic
  async function loadThumbnailFromClipsOrChildren(project: Project) {
    try {
      const { getClipsWithBuildStatus } = await import('@/services/database/clip-build');
      const clips = await getClipsWithBuildStatus(project.id);

      if (clips.length > 0 && clips[0].built_thumbnail_path) {
        project.thumbnail_path = clips[0].built_thumbnail_path;
        const dataUrl = await invoke<string>('read_file_as_data_url', {
          filePath: clips[0].built_thumbnail_path,
        });
        thumbnailCache.value.set(project.id, dataUrl);
        persistentCache.set('thumbnails', `project-${project.id}`, dataUrl, 86400000).catch(() => {});
        await updateProject(project.id, undefined, undefined, clips[0].built_thumbnail_path);
        return;
      }

      // Try children as last resort
      const children = projects.value.filter((p) => p.parent_id === project.id);
      for (const child of children) {
        const childThumb = child.thumbnail_path || projectVideos.value[child.id]?.[0]?.thumbnail_path;
        if (childThumb) {
          project.thumbnail_path = childThumb;
          const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: childThumb });
          thumbnailCache.value.set(project.id, dataUrl);
          persistentCache.set('thumbnails', `project-${project.id}`, dataUrl, 86400000).catch(() => {});
          await updateProject(project.id, undefined, undefined, childThumb);
          break;
        }
      }
    } catch (error) {
      console.warn('[Projects] Failed to load thumbnail from clips/children:', project.id, error);
    }
  }

  function getProjectDuration(projectId: string): string | null {
    // First check if this is a video editor project (by name)
    const project = projects.value.find((p) => p.id === projectId);
    if (project && videoEditorProjects.value[project.name]) {
      const vep = videoEditorProjects.value[project.name];
      if (vep.total_duration > 0) {
        return formatDuration(vep.total_duration);
      }
    }

    // Fall back to raw_videos duration calculation
    let totalDuration = 0;

    // Check direct videos on this project
    const videos = projectVideos.value[projectId];
    if (videos && videos.length > 0) {
      totalDuration += videos.reduce((acc, v) => acc + (v.duration || 0), 0);
    }

    // Also check children if this is a folder project
    const children = childrenMap.value.get(projectId);
    if (children && children.length > 0) {
      for (const child of children) {
        const childVideos = projectVideos.value[child.id];
        if (childVideos && childVideos.length > 0) {
          totalDuration += childVideos.reduce((acc, v) => acc + (v.duration || 0), 0);
        }
      }
    }

    if (totalDuration > 0) {
      return formatDuration(totalDuration);
    }
    return null;
  }

  // Silently backfill metadata for any videos missing duration or thumbnail
  async function backgroundFixMissingMetadata() {
    try {
      const { getAllRawVideos, updateRawVideo } = await import('@/services/database');
      const allVideos = await getAllRawVideos();

      // Find videos with missing duration or thumbnail, but only if the file exists
      console.log(`[Projects] Checking ${allVideos.length} videos for missing metadata...`);
      const videosToFix = [];

      for (const video of allVideos) {
        // Skip if video already has complete metadata
        if (video.duration && video.duration > 0 && video.thumbnail_path) {
          continue;
        }

        // Check if file exists - skip orphaned videos silently
        const fileExists = (await invoke('check_file_exists', { path: video.file_path })) as boolean;
        if (!fileExists) {
          console.log(`[Projects] Skipping orphaned video (file doesn't exist): ${video.original_filename}`);
          continue;
        }

        // File exists and needs metadata - add to fix list
        videosToFix.push(video);
      }

      if (videosToFix.length === 0) {
        return;
      }

      console.log(`[Projects] Fixing metadata for ${videosToFix.length} videos...`);
      let fixed = 0;
      let failed = 0;
      let thumbnailsGenerated = 0;

      for (let i = 0; i < videosToFix.length; i++) {
        const video = videosToFix[i];
        console.log(`[Projects] Processing video ${i + 1}/${videosToFix.length}: ${video.original_filename}`);
        console.log(`[Projects] Video path: ${video.file_path}`);

        try {
          const updates: any = {};

          // Extract metadata if missing duration
          if (!video.duration || video.duration === 0) {
            console.log(`[Projects] Calling get_video_metadata for: ${video.file_path}`);
            const metadata = (await invoke('get_video_metadata', {
              videoPath: video.file_path,
            })) as any;

            console.log(`[Projects] Received metadata:`, metadata);

            if (metadata && metadata.duration) {
              updates.duration = metadata.duration;
              updates.width = metadata.width;
              updates.height = metadata.height;
              updates.codec = metadata.codec;
              console.log(`[Projects] ✓ Extracted metadata: ${metadata.duration}s`);
            } else {
              console.warn(`[Projects] ✗ No duration in metadata for: ${video.original_filename}`);
            }
          }

          // Generate thumbnail if missing
          if (!video.thumbnail_path) {
            console.log(`[Projects] Generating thumbnail for: ${video.file_path}`);
            try {
              const thumbnailPath = (await invoke('generate_video_thumbnail', {
                videoPath: video.file_path,
                timestamp: 5.0,
              })) as string;

              if (thumbnailPath) {
                updates.thumbnail_path = thumbnailPath;
                thumbnailsGenerated++;
                console.log(`[Projects] ✓ Generated thumbnail: ${thumbnailPath}`);
              }
            } catch (thumbErr) {
              console.warn(`[Projects] Failed to generate thumbnail:`, thumbErr);
            }
          }

          // Update database if we have any updates
          if (Object.keys(updates).length > 0) {
            await updateRawVideo(video.id, updates);
            fixed++;
            console.log(`[Projects] ✓ Updated video: ${video.original_filename}`);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`[Projects] ✗ Failed to fix metadata for ${video.original_filename}:`, errorMsg);
          failed++;
        }
      }

      console.log(
        `[Projects] Metadata backfill complete. Fixed: ${fixed}, Thumbnails: ${thumbnailsGenerated}, Failed: ${failed}`
      );

      // Reload projects to show updated durations and thumbnails
      await loadProjects();
    } catch (err) {
      console.error('[Projects] Error in backgroundFixMissingMetadata:', err);
    }
  }

  function getProjectPlatform(
    project: Project
  ): 'PumpFun' | 'Kick' | 'YouTube' | 'Twitch' | 'Rumble' | 'Twitter' | 'Manual' | null {
    // 0. Check explicit platform field
    if (project.platform) {
      return project.platform;
    }

    // 1. Check description for explicit source
    if (project.description) {
      const desc = project.description.toLowerCase();
      if (desc.includes('kick')) return 'Kick';
      if (desc.includes('pumpfun')) return 'PumpFun';
      if (desc.includes('youtube')) return 'YouTube';
      if (desc.includes('twitch')) return 'Twitch';
      if (desc.includes('rumble')) return 'Rumble';
      if (desc.includes('twitter')) return 'Twitter';
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
    // Check persistent clip thumbnail cache first
    const cachedThumbnail = clipThumbnailStore.getThumbnail(clip.id);
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
  const folderCreatorProfileServerId = ref<number | null>(null);
  const folderDownloadDropdownId = ref<string | null>(null);
  const folderPrompts = ref<Prompt[]>([]);

  const showExistingProjectDialog = ref(false);
  const existingProjectForClip = ref<VideoEditorProject | null>(null);
  const pendingClipToEdit = ref<{
    clipId: string;
    startTime: number;
    endTime: number;
    title: string;
    segments: { start_time: number; end_time: number }[];
  } | null>(null);

  // Folder clips grouping: Completed vs Found Clips
  const folderClipSections = computed(() => {
    const isCompleted = (clip: ClipWithVersionAndSegment) =>
      hasCompletedBuilds(clip) ||
      clip.build_status === 'completed' ||
      (clip.status === 'generated' && Boolean(clip.built_file_path));

    const completed = folderClips.value
      .filter((clip) => isCompleted(clip))
      .sort((a, b) => {
        const aBuilt = a.built_at || a.current_version_created_at || a.created_at || 0;
        const bBuilt = b.built_at || b.current_version_created_at || b.created_at || 0;
        return bBuilt - aBuilt;
      });

    const found = folderClips.value.filter((clip) => !isCompleted(clip));

    return [
      { title: 'Completed', accentClass: 'folder-dialog__clips-section-dot--completed', clips: completed },
      { title: 'Found Clips', accentClass: 'folder-dialog__clips-section-dot--found', clips: found },
    ].filter((section) => section.clips.length > 0 || section.title === 'Found Clips');
  });

  // Map for stable numbering across sections
  const folderClipIndexMap = computed(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const section of folderClipSections.value) {
      for (const clip of section.clips) {
        map.set(clip.id, idx++);
      }
    }
    return map;
  });

  // Creator profile defaults for folder dialog builds
  const folderCreatorDefaultIntro = ref<IntroOutro | null>(null);
  const folderCreatorDefaultOutro = ref<IntroOutro | null>(null);
  const folderCreatorWatermarkSettings = ref<WatermarkSettings | null>(null);
  const folderCreatorProfile = ref<any>(null);

  // Store unlisten functions for Tauri event cleanup
  const clipBuildUnlistenFunctions = ref<UnlistenFn[]>([]);

  // Computed class for folder dialog size based on active tab and content
  const folderDialogSizeClass = computed(() => {
    if (folderActiveTab.value === 'clips') {
      // Wide layout for 2-column view with inline video player
      return 'folder-dialog--xl';
    }
    // For segments tab, base width on segment count
    const segmentCount = folderProject.value ? getEffectiveSegmentCount(folderProject.value.id) : 0;
    if (segmentCount <= 1) return 'folder-dialog--sm';
    if (segmentCount === 2) return 'folder-dialog--md';
    return 'folder-dialog--lg';
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

      // Generate missing thumbnails in background (controlled: one at a time with 500ms delay)
      generateMissingThumbnailsInBackground();

      // Auto-select first clip for preview if clips exist and none selected
      if (folderClips.value.length > 0 && !clipToPreview.value) {
        previewClip(folderClips.value[0]);
        console.log('[Projects] Auto-selected first clip for preview:', folderClips.value[0].id);
      }
    } catch (e) {
      console.error('Failed to load folder clips:', e);
      folderClips.value = [];
    } finally {
      folderClipsLoading.value = false;
    }
  }

  // Load existing clip thumbnails in parallel (fast - just reading files)
  async function loadClipThumbnailsInParallel() {
    // Use persistent store's batch loading method - it handles deduplication and caching
    await clipThumbnailStore.loadThumbnails(folderClips.value);
  }

  // Track which projects have had thumbnails generated to avoid re-generation
  const thumbnailsGeneratedForProjects = ref(new Set<string>());

  // Cancellation flag for thumbnail generation - set to true when navigating away
  let thumbnailGenerationCancelled = false;
  // Flag to prevent concurrent thumbnail generation
  let thumbnailGenerationInProgress = false;

  // Generate thumbnails for clips that don't have one yet (background, non-blocking)
  async function generateMissingThumbnailsInBackground() {
    // Prevent concurrent runs
    if (thumbnailGenerationInProgress) {
      console.log('[Projects] Thumbnail generation already in progress, skipping');
      return;
    }

    const clipsWithoutThumbnails = folderClips.value.filter((clip) => !clip.built_thumbnail_path);

    if (clipsWithoutThumbnails.length === 0) return;

    // Check if we've already generated thumbnails for this project
    const projectId = folderProject.value?.id;
    if (projectId && thumbnailsGeneratedForProjects.value.has(projectId)) {
      console.log('[Projects] Thumbnails already generated for this project, skipping');
      return;
    }

    console.log(
      `[Projects] Generating thumbnails for ${clipsWithoutThumbnails.length} clips in background (one at a time)...`
    );

    // Reset cancellation flag and mark as in progress
    thumbnailGenerationCancelled = false;
    thumbnailGenerationInProgress = true;

    // Process ONE at a time to prevent spawning 50+ FFmpeg processes
    const dbUpdates: Array<{
      clipId: string;
      thumbnailPath: string;
      buildStatus: 'pending' | 'building' | 'completed' | 'failed';
    }> = [];

    try {
      // Process clips ONE AT A TIME sequentially (not in parallel)
      for (let i = 0; i < clipsWithoutThumbnails.length; i++) {
        // Check cancellation before each clip
        if (thumbnailGenerationCancelled) {
          console.log('[Projects] Thumbnail generation cancelled');
          break;
        }

        const clip = clipsWithoutThumbnails[i];

        try {
          const segmentId = clip.segment_id || clip.project_id;
          if (!segmentId) continue;

          let videos = projectVideos.value[segmentId];

          // Load videos on demand if not cached
          if (!videos || videos.length === 0) {
            try {
              videos = await getRawVideosByProjectId(segmentId);
              projectVideos.value[segmentId] = videos;
            } catch {
              continue;
            }
          }

          if (videos && videos.length > 0) {
            const videoPath = videos[0].file_path;
            const startTime =
              clip.current_version?.start_time ?? clip.current_version_start_time ?? clip.start_time ?? 0;

            // Generate thumbnail at clip start time (SINGLE process)
            const thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
              videoPath: videoPath,
              timestampSeconds: startTime,
              outputFilename: `clip_${clip.id}`,
            });

            // Check cancellation after FFmpeg completes
            if (thumbnailGenerationCancelled) {
              console.log('[Projects] Thumbnail generation cancelled after FFmpeg');
              break;
            }

            // Load the generated thumbnail into cache
            const dataUrl = await invoke<string>('read_file_as_data_url', {
              filePath: thumbnailPath,
            });
            clipThumbnailStore.setThumbnail(clip.id, dataUrl);

            // Update the clip's thumbnail path
            clip.built_thumbnail_path = thumbnailPath;

            // Queue database update instead of writing immediately
            dbUpdates.push({
              clipId: clip.id,
              thumbnailPath: thumbnailPath,
              buildStatus: (clip.build_status || 'pending') as 'pending' | 'building' | 'completed' | 'failed',
            });

            console.log(`[Projects] Generated thumbnail ${i + 1}/${clipsWithoutThumbnails.length}`);
          }
        } catch (err) {
          console.warn('Failed to generate clip thumbnail:', clip.id, err);
        }

        // Add delay between clips to prevent system overload (500ms)
        if (i < clipsWithoutThumbnails.length - 1 && !thumbnailGenerationCancelled) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    } finally {
      thumbnailGenerationInProgress = false;
    }

    // Batch write all database updates at once (only if not cancelled)
    if (dbUpdates.length > 0 && !thumbnailGenerationCancelled) {
      console.log(`[Projects] Writing ${dbUpdates.length} thumbnail updates to database...`);
      const { updateClipBuildStatus } = await import('@/services/database');

      // Write sequentially to avoid overwhelming the database
      for (const update of dbUpdates) {
        await updateClipBuildStatus(update.clipId, update.buildStatus, {
          builtThumbnailPath: update.thumbnailPath,
        });
      }
    }

    // Mark this project as having thumbnails generated (even if cancelled partway)
    if (projectId && dbUpdates.length > 0) {
      thumbnailsGeneratedForProjects.value.add(projectId);
    }

    console.log(`[Projects] Background thumbnail generation complete (${dbUpdates.length} generated)`);
  }

  // Cancel any running thumbnail generation
  function cancelThumbnailGeneration() {
    if (thumbnailGenerationInProgress) {
      console.log('[Projects] Cancelling thumbnail generation...');
      thumbnailGenerationCancelled = true;
    }
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

    console.log(`[Projects] Clip build complete: ${clip_id}`, { buildSuccess, output_path, buildError });

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

      // Show success toast with Publish Now option
      success('Build Complete', 'Your clip has been built successfully. Ready to publish!');
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
  async function onFolderTabChange(tab: 'segments' | 'clips') {
    folderActiveTab.value = tab;
    if (tab === 'clips' && folderProject.value) {
      // Load clips if not already loaded
      if (folderClips.value.length === 0) {
        await loadFolderClips(folderProject.value.id);
      }
      // Auto-select the first clip for preview
      if (folderClips.value.length > 0 && !clipToPreview.value) {
        previewClip(folderClips.value[0]);
      }
    }
    // Clear clip preview when switching away from clips tab
    if (tab === 'segments') {
      closeClipPreview();
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
  // Segmented playback state for stitched clips
  const inlineVideoSegments = ref<Array<{ start_time: number; end_time: number; duration: number }>>([]);
  const inlineCurrentSegmentIndex = ref(0);

  // HLS.js instance for proper MPEG-TS (.ts) file playback with A/V sync
  let inlineHlsInstance: Hls | null = null;

  // Check if a URL is an HLS playlist
  function isHlsUrl(url: string | null | undefined): boolean {
    return !!url && url.includes('.m3u8');
  }

  // Cleanup HLS instance
  function cleanupInlineHls(): void {
    if (inlineHlsInstance) {
      inlineHlsInstance.destroy();
      inlineHlsInstance = null;
    }
  }

  // Setup HLS playback for the inline video element
  function setupInlineHlsPlayback(videoEl: HTMLVideoElement, hlsUrl: string): void {
    cleanupInlineHls();

    if (Hls.isSupported()) {
      inlineHlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });

      inlineHlsInstance.loadSource(hlsUrl);
      inlineHlsInstance.attachMedia(videoEl);

      inlineHlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[Projects] HLS manifest parsed for inline video');
      });

      inlineHlsInstance.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error('[Projects] HLS fatal error:', data.type, data.details);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              inlineHlsInstance?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              inlineHlsInstance?.recoverMediaError();
              break;
            default:
              cleanupInlineHls();
              break;
          }
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      videoEl.src = hlsUrl;
    } else {
      console.error('[Projects] HLS not supported in this browser');
    }
  }

  // Helper function to construct video URL with proper endpoint for file type
  function constructInlineVideoUrl(filePath: string, port: number): string {
    const encodedPath = utf8ToBase64Url(filePath);

    // Check if this is a .ts file - browsers can't play MPEG-TS natively
    const isTsFile = filePath.toLowerCase().endsWith('.ts');

    if (isTsFile) {
      // Use ts-hls endpoint which wraps the .ts file in an HLS playlist
      return `http://localhost:${port}/ts-hls/${encodedPath}/playlist.m3u8`;
    }

    // Regular video file - serve directly
    return `http://localhost:${port}/video/${encodedPath}`;
  }

  // Watermark state for clip preview
  const previewWatermarkData = ref<{ dataUrl: string; width?: number; height?: number } | null>(null);
  const previewWatermarkSettings = ref<WatermarkSettings | null>(null);

  // Prepare video source when clip changes
  async function prepareInlineVideo() {
    // Cleanup any existing HLS instance
    cleanupInlineHls();

    if (!clipPreviewVideoPath.value) {
      inlineVideoSrc.value = null;
      return;
    }

    inlineVideoLoading.value = true;
    try {
      const port = await invoke<number>('get_video_server_port');
      // Use constructInlineVideoUrl to properly handle .ts files with HLS wrapper
      const timestamp = Date.now();
      const baseUrl = constructInlineVideoUrl(clipPreviewVideoPath.value, port);
      // Add timestamp to prevent caching
      inlineVideoSrc.value = baseUrl.includes('?') ? `${baseUrl}&t=${timestamp}` : `${baseUrl}?t=${timestamp}`;
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
      cleanupInlineHls();
      inlineVideoSrc.value = null;
      previewWatermarkData.value = null;
      previewWatermarkSettings.value = null;
    }
  });

  // Watch for inline video source changes to setup HLS if needed
  watch(
    () => inlineVideoSrc.value,
    (newSrc, oldSrc) => {
      if (newSrc && newSrc !== oldSrc && inlineVideoRef.value && isHlsUrl(newSrc)) {
        setupInlineHlsPlayback(inlineVideoRef.value, newSrc);
      } else if (!isHlsUrl(newSrc)) {
        cleanupInlineHls();
      }
    }
  );

  // Watch for inline video element becoming available to setup HLS if source is already set
  watch(inlineVideoRef, (newElement) => {
    if (newElement && inlineVideoSrc.value && isHlsUrl(inlineVideoSrc.value)) {
      setupInlineHlsPlayback(newElement, inlineVideoSrc.value);
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

      // If no project-level settings, try branding profile resolution (includes org/campaign/local profiles)
      if (!watermarkId) {
        let creatorProfile = await resolveBrandingProfile(segmentProjectId);
        console.log(
          '[Projects] loadPreviewWatermark: Branding profile for segment',
          segmentProjectId,
          ':',
          creatorProfile?.name || null
        );

        // If no branding profile on segment, try the parent folder as fallback
        if (!creatorProfile) {
          const project = projects.value.find((p) => p.id === segmentProjectId);
          if (project?.parent_id) {
            creatorProfile = await resolveBrandingProfile(project.parent_id);
            console.log(
              '[Projects] loadPreviewWatermark: Fallback to parent',
              project.parent_id,
              ':',
              creatorProfile?.name || null
            );
          }
        }

        if (creatorProfile?.watermark_id) {
          watermarkId = creatorProfile.watermark_id;
          watermarkSettingsRaw = creatorProfile.watermark_settings;
        }
      }

      // If no watermark found from creator profiles, check for free tier admin branding
      if (!watermarkId) {
        const { useFreeTierBranding } = await import('@/composables/useFreeTierBranding');
        const { getBrandingIfFreeTier } = useFreeTierBranding();
        const adminBranding = await getBrandingIfFreeTier();

        if (adminBranding?.watermark_id) {
          console.log('[Projects] loadPreviewWatermark: Using admin free tier watermark:', adminBranding.watermark_id);

          // Server provides a presigned URL — download directly via Tauri (bypasses CORS)
          if (adminBranding.watermark_url) {
            console.log('[Projects] loadPreviewWatermark: Downloading free tier watermark via presigned URL');
            try {
              const dataUrl = await invoke<string>('download_url_as_data_url', { url: adminBranding.watermark_url });
              const dimensions = await new Promise<{ width: number; height: number } | null>((resolve) => {
                const img = new Image();
                img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
                img.onerror = () => resolve(null);
                img.src = dataUrl;
              });
              previewWatermarkData.value = {
                dataUrl,
                width: dimensions?.width || undefined,
                height: dimensions?.height || undefined,
              };
              console.log('[Projects] loadPreviewWatermark: Free tier watermark loaded:', {
                width: dimensions?.width,
                height: dimensions?.height,
              });
            } catch (dlErr) {
              console.error('[Projects] loadPreviewWatermark: Failed to download free tier watermark:', dlErr);
              return;
            }
          } else {
            watermarkId = adminBranding.watermark_id;
          }
          watermarkSettingsRaw = adminBranding.watermark_settings
            ? JSON.stringify(adminBranding.watermark_settings)
            : null;
        } else {
          console.log(
            '[Projects] loadPreviewWatermark: No watermark_id found (checked creator profiles + admin branding)'
          );
          return;
        }
      }

      // Load the watermark image (skip if already loaded from free tier presigned URL above)
      if (!previewWatermarkData.value && watermarkId) {
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
      } // end if (!previewWatermarkData.value && watermarkId)

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
            // For org-asset watermarks (e.g. free tier admin branding), never override the
            // top-level watermarkId with the per-ratio one — those are the admin's local UUIDs.
            const isOrgAsset = watermarkId?.startsWith('org-asset-');
            watermarkSettings = {
              ...watermarkSettings,
              enabled: true,
              watermarkId: !isOrgAsset && ratioConfig.watermarkId ? ratioConfig.watermarkId : watermarkId,
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

  // Get clip segments for stitched clips, or single segment for continuous clips
  function getClipSegments(): Array<{ start_time: number; end_time: number; duration: number }> {
    if (!clipToPreview.value) return [];

    // Check if clip has multiple segments (stitched clip)
    if (clipToPreview.value.current_version_segments && clipToPreview.value.current_version_segments.length > 0) {
      return clipToPreview.value.current_version_segments.map((seg) => ({
        start_time: seg.start_time,
        end_time: seg.end_time,
        duration: seg.duration || seg.end_time - seg.start_time,
      }));
    }

    // Fallback: single continuous segment
    const startTime = clipToPreview.value?.current_version?.start_time ?? clipToPreview.value?.start_time ?? 0;
    const endTime = clipToPreview.value?.current_version?.end_time ?? clipToPreview.value?.end_time ?? 0;
    return [{ start_time: startTime, end_time: endTime, duration: endTime - startTime }];
  }

  // Get clip start and end times (for backward compatibility)
  function getClipStartTime(): number {
    const segments = getClipSegments();
    return segments.length > 0 ? segments[0].start_time : 0;
  }

  function getClipEndTime(): number {
    const segments = getClipSegments();
    return segments.length > 0 ? segments[segments.length - 1].end_time : 0;
  }

  // Handle inline video loaded - seek to clip start time
  function onInlineVideoLoaded() {
    if (inlineVideoRef.value && clipToPreview.value) {
      // Load segments for this clip
      inlineVideoSegments.value = getClipSegments();
      inlineCurrentSegmentIndex.value = 0;

      // Calculate total duration (sum of all segments)
      inlineVideoClipDuration.value = inlineVideoSegments.value.reduce((total, seg) => total + seg.duration, 0);

      // Seek to first segment start
      if (inlineVideoSegments.value.length > 0) {
        inlineVideoRef.value.currentTime = inlineVideoSegments.value[0].start_time;
      }

      inlineVideoCurrentTime.value = 0;
      inlineVideoProgress.value = 0;
      // Don't auto-play - let user start playback manually
      inlineVideoPlaying.value = false;
    }
  }

  // Handle inline video time update - handle segmented playback
  function onInlineVideoTimeUpdate() {
    if (
      inlineVideoRef.value &&
      clipToPreview.value &&
      !inlineSeekDragging.value &&
      inlineVideoSegments.value.length > 0
    ) {
      const currentSegment = inlineVideoSegments.value[inlineCurrentSegmentIndex.value];
      if (!currentSegment) return;

      const currentTime = inlineVideoRef.value.currentTime;

      // Check if we've reached the end of current segment
      if (currentTime >= currentSegment.end_time - 0.1) {
        // Move to next segment
        inlineCurrentSegmentIndex.value++;

        if (inlineCurrentSegmentIndex.value >= inlineVideoSegments.value.length) {
          // All segments played, loop back to first segment
          inlineCurrentSegmentIndex.value = 0;
          inlineVideoRef.value.currentTime = inlineVideoSegments.value[0].start_time;
          inlineVideoCurrentTime.value = 0;
          inlineVideoProgress.value = 0;
          return;
        } else {
          // Jump to next segment
          const nextSegment = inlineVideoSegments.value[inlineCurrentSegmentIndex.value];
          inlineVideoRef.value.currentTime = nextSegment.start_time;
        }
      }

      // Calculate elapsed time across all played segments
      let elapsedTime = 0;
      for (let i = 0; i < inlineCurrentSegmentIndex.value; i++) {
        elapsedTime += inlineVideoSegments.value[i].duration;
      }
      // Add time within current segment
      elapsedTime += Math.max(0, currentTime - currentSegment.start_time);

      inlineVideoCurrentTime.value = elapsedTime;
      inlineVideoProgress.value =
        inlineVideoClipDuration.value > 0 ? (elapsedTime / inlineVideoClipDuration.value) * 100 : 0;
    }
  }

  // Handle inline video ended - loop back to start
  function onInlineVideoEnded() {
    if (inlineVideoRef.value && clipToPreview.value && inlineVideoSegments.value.length > 0) {
      inlineCurrentSegmentIndex.value = 0;
      inlineVideoRef.value.currentTime = inlineVideoSegments.value[0].start_time;
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

  // Seek to specific time in clip (handles segmented clips)
  function seekInlineVideo(percent: number) {
    if (!inlineVideoRef.value || !clipToPreview.value || inlineVideoSegments.value.length === 0) return;

    // Calculate target elapsed time
    const targetElapsedTime = (percent / 100) * inlineVideoClipDuration.value;

    // Find which segment this time falls into
    let accumulatedTime = 0;
    for (let i = 0; i < inlineVideoSegments.value.length; i++) {
      const segment = inlineVideoSegments.value[i];
      if (accumulatedTime + segment.duration >= targetElapsedTime) {
        // Target time is in this segment
        const timeIntoSegment = targetElapsedTime - accumulatedTime;
        inlineCurrentSegmentIndex.value = i;
        inlineVideoRef.value.currentTime = segment.start_time + timeIntoSegment;
        inlineVideoCurrentTime.value = targetElapsedTime;
        inlineVideoProgress.value = percent;
        return;
      }
      accumulatedTime += segment.duration;
    }

    // Fallback: seek to last segment
    const lastSegment = inlineVideoSegments.value[inlineVideoSegments.value.length - 1];
    inlineCurrentSegmentIndex.value = inlineVideoSegments.value.length - 1;
    inlineVideoRef.value.currentTime = lastSegment.start_time;
  }

  // Start drag seeking
  function startInlineSeekDrag(event: MouseEvent) {
    if (!inlineVideoRef.value || !clipToPreview.value) return;

    inlineSeekDragging.value = true;
    const percent = getInlinePercentFromEvent(event);
    seekInlineVideo(percent);

    // Add document-level listeners for drag
    document.addEventListener('mousemove', onInlineSeekDrag);
    document.addEventListener('mouseup', stopInlineSeekDrag);

    event.preventDefault();
  }

  // Handle drag movement (called from document listener)
  function onInlineSeekDrag(event: MouseEvent) {
    if (!inlineSeekDragging.value) return;
    const percent = getInlinePercentFromEvent(event);
    seekInlineVideo(percent);
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

  function onClipsTabPlayClip(clip: ClipWithVersion) {
    const fullClip = folderClips.value.find((c) => c.id === clip.id);
    if (fullClip) {
      previewClip(fullClip);
    }
  }

  function onClipsTabAdjustClip(clipId: string) {
    // Find the clip to get its project ID
    const clip = folderClips.value.find((c) => c.id === clipId);
    if (!clip) return;

    // Find the segment (child project) this clip belongs to
    const children = getFolderChildren(folderProject.value?.id || '');
    const segmentProject = children.find((child: Project) => child.id === clip.project_id);

    if (segmentProject) {
      // Open workspace with the segment project and the clip pre-selected
      openWorkspace(segmentProject, clipId);
    } else if (folderProject.value && clip.project_id === folderProject.value.id) {
      // Standalone project (no children) - open the folder project itself
      openWorkspace(folderProject.value, clipId);
    }
  }

  async function onClipsTabEditClip(clipId: string) {
    const clip = folderClips.value.find((c) => c.id === clipId);
    if (!clip) {
      return;
    }

    const clipTitle = clip.current_version?.name || clip.current_version_name || clip.name || 'Untitled Clip';

    let segments: { start_time: number; end_time: number }[] = [];
    if (clip.current_version_segments && clip.current_version_segments.length > 0) {
      segments = clip.current_version_segments.map((segment) => ({
        start_time: segment.start_time,
        end_time: segment.end_time,
      }));
    } else {
      const startTime = clip.current_version?.start_time ?? clip.current_version_start_time ?? clip.start_time ?? 0;
      const endTime =
        clip.current_version?.end_time ??
        clip.current_version_end_time ??
        clip.end_time ??
        startTime + (clip.duration ?? 10);
      segments = [{ start_time: startTime, end_time: endTime }];
    }

    const startTime = Math.min(...segments.map((s) => s.start_time));
    const endTime = Math.max(...segments.map((s) => s.end_time));

    try {
      const existingProjects = await getVideoEditorProjectsForClip(clipId);
      if (existingProjects.length > 0) {
        existingProjectForClip.value = existingProjects[0];
        pendingClipToEdit.value = {
          clipId,
          startTime,
          endTime,
          title: clipTitle,
          segments,
        };
        showExistingProjectDialog.value = true;
        return;
      }
    } catch (error) {
      console.warn('[Projects] Failed to check for existing projects:', error);
    }

    await openClipInNewProject(clipId, clipTitle, startTime, endTime, segments);
  }

  async function onClipsTabRefreshClips() {
    if (folderProject.value?.id) {
      await loadFolderClips(folderProject.value.id);
    }
  }

  function onClipsTabDetectClips() {
    if (folderProject.value) {
      startProjectDetection(folderProject.value);
    }
  }

  // Quick Publish Wizard state for folder dialog
  const showFolderPublishWizard = ref(false);
  const folderClipToPublish = ref<ClipWithVersion | null>(null);
  const folderClipToPublishPath = ref<string>('');
  const folderClipToPublishThumbnail = ref<string | null>(null);

  function onClipsTabPublishNow(clip: ClipWithVersion) {
    folderClipToPublish.value = clip;
    // clip.file_path is the source segment video (local path), use as clip path so FFmpeg can probe dimensions
    // Fall back to projectVideos if clip has no direct file_path
    const projectId = clip.project_id || folderProject.value?.id;
    const fallbackVideo = projectId ? (projectVideos.value[projectId]?.[0] ?? null) : null;
    folderClipToPublishPath.value = clip.file_path || fallbackVideo?.file_path || '';
    folderClipToPublishThumbnail.value = clip.built_thumbnail_path || null;
    showFolderPublishWizard.value = true;
  }

  function onFolderPublishWizardClose() {
    showFolderPublishWizard.value = false;
    folderClipToPublish.value = null;
    folderClipToPublishPath.value = '';
    folderClipToPublishThumbnail.value = null;
  }

  async function loadFolderPrompts() {
    try {
      folderPrompts.value = await getAllPrompts();
    } catch (err) {
      console.warn('[Projects] Failed to load prompts:', err);
      folderPrompts.value = [];
    }
  }

  async function openClipInNewProject(
    clipId: string,
    clipTitle: string,
    startTime: number,
    endTime: number,
    segments: { start_time: number; end_time: number }[]
  ) {
    try {
      const result = await createVideoEditorProjectFromClip({
        clipId,
        clipTitle,
        clipStartTime: startTime,
        clipEndTime: endTime,
        clipSegments: segments,
      });

      showFolderDialog.value = false;
      router.push({ path: '/editor', query: { projectId: result.projectId } });
    } catch (err) {
      console.error('[Projects] Failed to create video editor project:', err);
      error('Failed to Open Editor', 'Could not create video editor project. Please try again.');
    }
  }

  function openClipInExistingProject(project: VideoEditorProject) {
    const pending = pendingClipToEdit.value;
    if (!pending) return;

    pendingClipToEdit.value = null;
    showExistingProjectDialog.value = false;
    existingProjectForClip.value = null;

    showFolderDialog.value = false;
    router.push({ path: '/editor', query: { projectId: project.id } });
  }

  function onOpenExistingProject() {
    if (existingProjectForClip.value) {
      openClipInExistingProject(existingProjectForClip.value);
    }
  }

  async function onCreateNewProject() {
    const pending = pendingClipToEdit.value;
    if (!pending) return;

    showExistingProjectDialog.value = false;
    existingProjectForClip.value = null;

    await openClipInNewProject(pending.clipId, pending.title, pending.startTime, pending.endTime, pending.segments);
  }

  // Build clip from folder view
  async function onFolderBuildClip(clip: ClipWithVersionAndSegment) {
    folderClipToBuild.value = clip;

    // Reset creator defaults
    folderCreatorDefaultIntro.value = null;
    folderCreatorDefaultOutro.value = null;
    folderCreatorWatermarkSettings.value = null;
    folderCreatorProfile.value = null;
    folderCreatorProfileServerId.value = null;

    // Look up branding profile for this clip's project (streamer, global, or user-selected)
    try {
      // Use the parent project ID (folder) or the segment's project ID
      const projectId = clip.project_id || clip.segment_id;
      const profile = await resolveBrandingProfile(projectId);

      if (profile) {
        console.log('[Projects] Found creator profile for folder build:', profile.name);
        folderCreatorProfile.value = profile;

        // Extract numeric server ID for campaign lookup (org profiles have numeric string IDs)
        if (profile.context_type === 'organization' && profile.id && !profile.id.startsWith('campaign-')) {
          const serverId = parseInt(profile.id, 10);
          if (!isNaN(serverId)) {
            folderCreatorProfileServerId.value = serverId;
          }
        }

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

  // Free tier limit dialog state
  const showFreeTierLimitDialog = ref(false);
  const freeTierLimitInfo = ref<{ used: number; limit: number; label: string } | null>(null);

  // Handle build confirmation
  async function onFolderBuildConfirm(settings: BuildSettings) {
    if (!folderClipToBuild.value) return;

    // Check free tier daily limit
    await fetchSubscriptionStatus();
    const user = authStore.user;
    const isFree =
      user &&
      !user.is_admin &&
      !user.created_by_organization_id &&
      (!(user as any).subscription_status ||
        (user as any).subscription_status === 'none' ||
        (user as any).subscription_status === 'expired');
    if (isFree) {
      const { getUsageCount, recordUsage } = await import('@/services/database/free-tier-usage');
      const FREE_LIMIT = 5;
      const used = await getUsageCount(String(user.id), 'clip_build');
      if (used >= FREE_LIMIT) {
        freeTierLimitInfo.value = { used, limit: FREE_LIMIT, label: 'clip builds' };
        showFreeTierLimitDialog.value = true;
        return;
      }
      await recordUsage(String(user.id), 'clip_build');
    }

    // Prevent duplicate builds
    if (isFolderBuildInProgress.value) {
      console.warn('[Projects] Folder build already in progress, ignoring duplicate request');
      return;
    }
    isFolderBuildInProgress.value = true;

    const clip = folderClipToBuild.value;

    try {
      console.log('[Projects] Starting folder build with aspectRatios:', settings.aspectRatios);
      console.log('[Projects] buildTargets:', settings.buildTargets);

      // Get the video file for this clip's segment
      const videos = projectVideos.value[clip.segment_id];
      if (!videos || videos.length === 0) {
        error('No video found', 'Cannot find the source video for this clip.');
        return;
      }
      const videoPath = videos[0].file_path;

      // Check if we have multi-build targets (orgs/campaigns selected)
      if (settings.buildTargets && settings.buildTargets.length > 0) {
        console.log('[Projects] Multi-build mode: processing', settings.buildTargets.length, 'targets');
        await executeMultiBuildTargets(clip, videoPath, settings);
        return;
      }

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

      // If no watermark from dialog, check for free tier admin branding
      if (!watermarkSettings) {
        const { useFreeTierBranding } = await import('@/composables/useFreeTierBranding');
        const { getBrandingIfFreeTier } = useFreeTierBranding();
        const adminBranding = await getBrandingIfFreeTier();

        if (adminBranding?.watermark_id) {
          console.log('[Projects] Applying admin free tier watermark to build:', adminBranding.watermark_id);

          // Parse per-ratio settings to get default position
          let defaultPos = { x: 12, y: 92, opacity: 80, scale: 20 };
          if (adminBranding.watermark_settings) {
            try {
              const perRatioSettings =
                typeof adminBranding.watermark_settings === 'string'
                  ? JSON.parse(adminBranding.watermark_settings)
                  : adminBranding.watermark_settings;
              const ratioConfig = perRatioSettings['16:9'];
              if (ratioConfig?.position) {
                defaultPos = ratioConfig.position;
              }
            } catch (e) {
              console.warn('[Projects] Failed to parse admin watermark settings:', e);
            }
          }

          // Download watermark via presigned URL to local file for FFmpeg
          let filePath: string | null = null;
          let wmWidth: number | null = null;
          let wmHeight: number | null = null;

          if (adminBranding.watermark_url) {
            try {
              const filename = `free-tier-watermark-${adminBranding.watermark_id.replace(/[^a-zA-Z0-9-]/g, '_')}.png`;
              filePath = await invoke<string>('download_org_asset_from_url', {
                url: adminBranding.watermark_url,
                filename,
                assetType: 'watermarks',
                organizationId: 'free-tier',
              });
              console.log('[Projects] Free tier watermark downloaded to:', filePath);
              // Measure dimensions
              const dataUrl = await invoke<string>('read_file_as_data_url', { filePath });
              const dims = await new Promise<{ width: number; height: number } | null>((resolve) => {
                const img = new Image();
                img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
                img.onerror = () => resolve(null);
                img.src = dataUrl;
              });
              wmWidth = dims?.width ?? null;
              wmHeight = dims?.height ?? null;
            } catch (dlErr) {
              console.error('[Projects] Failed to download free tier watermark for build:', dlErr);
            }
          } else {
            // Fallback: try local database lookup (for org members who have the asset synced)
            const { getWatermarkImage } = await import('@/services/database/watermarks');
            const watermarkImage = await getWatermarkImage(adminBranding.watermark_id);
            if (watermarkImage) {
              filePath = watermarkImage.file_path;
              wmWidth = watermarkImage.width ?? null;
              wmHeight = watermarkImage.height ?? null;
            }
          }

          if (filePath) {
            watermarkSettings = {
              enabled: true,
              watermarkId: adminBranding.watermark_id,
              filePath,
              width: wmWidth,
              height: wmHeight,
              positionX: defaultPos.x,
              positionY: defaultPos.y,
              opacity: defaultPos.opacity,
              scale: defaultPos.scale,
            };
            console.log('[Projects] Admin watermark settings applied:', {
              watermarkId: watermarkSettings.watermarkId,
              position: { x: defaultPos.x, y: defaultPos.y },
            });
          }
        }
      }

      // ── Campaign Branding Override ────────────────────────────────────────────
      // When user selected a campaign, its branding COMPLETELY replaces creator profile branding.
      // Also save campaign_id on the clip for payment tracking.
      if (settings.campaignId && settings.selectedCampaign) {
        const campaign = settings.selectedCampaign;
        console.log('[Projects] Applying campaign branding for:', campaign.title, '(id:', campaign.id, ')');

        // Override creator profile defaults with campaign global assets
        if (campaign.global_intro) {
          const { ensureAssetDownloaded } = await import('@/services/orgAssetSync');
          const introResult = await ensureAssetDownloaded({
            id: campaign.global_intro.id,
            name: campaign.global_intro.name,
            asset_type: 'intro',
            url: campaign.global_intro.url,
            organization_id: campaign.organization_id,
            organization_name: campaign.organization?.name || '',
            duration: campaign.global_intro.duration ? parseFloat(campaign.global_intro.duration) : undefined,
            inserted_at: campaign.inserted_at,
            updated_at: campaign.updated_at,
          } as unknown as import('@/services/orgAssetSync').ServerOrganizationAsset);
          if (introResult.success && introResult.filePath) {
            folderCreatorDefaultIntro.value = {
              id: `org-asset-${campaign.global_intro.id}`,
              type: 'intro',
              name: campaign.global_intro.name,
              file_path: introResult.filePath,
              duration: campaign.global_intro.duration ? parseFloat(campaign.global_intro.duration) : null,
              thumbnail_path: campaign.global_intro.thumbnail_url || null,
              thumbnail_generation_status: 'completed' as const,
              organization_id: String(campaign.organization_id),
              organization_name: campaign.organization?.name || null,
              created_at: Date.now(),
              updated_at: Date.now(),
            };
            console.log('[Projects] Campaign global intro applied:', campaign.global_intro.name);
          }
        } else {
          // No campaign global intro — clear creator default so no intro is forced
          folderCreatorDefaultIntro.value = null;
        }

        if (campaign.global_outro) {
          const { ensureAssetDownloaded } = await import('@/services/orgAssetSync');
          const outroResult = await ensureAssetDownloaded({
            id: campaign.global_outro.id,
            name: campaign.global_outro.name,
            asset_type: 'outro',
            url: campaign.global_outro.url,
            organization_id: campaign.organization_id,
            organization_name: campaign.organization?.name || '',
            duration: campaign.global_outro.duration ? parseFloat(campaign.global_outro.duration) : undefined,
            inserted_at: campaign.inserted_at,
            updated_at: campaign.updated_at,
          } as unknown as import('@/services/orgAssetSync').ServerOrganizationAsset);
          if (outroResult.success && outroResult.filePath) {
            folderCreatorDefaultOutro.value = {
              id: `org-asset-${campaign.global_outro.id}`,
              type: 'outro',
              name: campaign.global_outro.name,
              file_path: outroResult.filePath,
              duration: campaign.global_outro.duration ? parseFloat(campaign.global_outro.duration) : null,
              thumbnail_path: campaign.global_outro.thumbnail_url || null,
              thumbnail_generation_status: 'completed' as const,
              organization_id: String(campaign.organization_id),
              organization_name: campaign.organization?.name || null,
              created_at: Date.now(),
              updated_at: Date.now(),
            };

            console.log('[Projects] Campaign global outro applied:', campaign.global_outro.name);
          }
        } else {
          // No campaign global outro — clear creator default
          folderCreatorDefaultOutro.value = null;
        }

        // Override watermark with campaign branding profile watermark (if available via creator profile)
        const campaignCreatorProfile = campaign.creator_profiles?.[0] || campaign.creator_profile;
        if (campaignCreatorProfile?.watermark?.url) {
          const { invoke } = await import('@tauri-apps/api/core');
          const filename = `campaign-watermark-${campaignCreatorProfile.watermark.id}.png`;
          try {
            const filePath = await invoke<string>('download_org_asset_from_url', {
              url: campaignCreatorProfile.watermark.url,
              filename,
              assetType: 'watermarks',
              organizationId: String(campaign.organization_id),
            });

            let defaultPos = { x: 12, y: 92, opacity: 80, scale: 20 };
            if (campaignCreatorProfile.watermark_settings) {
              try {
                const wmSettings =
                  typeof campaignCreatorProfile.watermark_settings === 'string'
                    ? JSON.parse(campaignCreatorProfile.watermark_settings as unknown as string)
                    : campaignCreatorProfile.watermark_settings;
                const ratioConfig = wmSettings['16:9'];
                if (ratioConfig?.position) defaultPos = ratioConfig.position;
              } catch (e) {
                console.warn('[Projects] Failed to parse campaign watermark settings:', e);
              }
            }

            folderCreatorWatermarkSettings.value = {
              enabled: true,
              watermarkId: `org-asset-${campaignCreatorProfile.watermark.id}`,
              positionX: defaultPos.x,
              positionY: defaultPos.y,
              opacity: defaultPos.opacity,
              scale: defaultPos.scale,
              perRatioSettings: (campaignCreatorProfile.watermark_settings as any) ?? null,
            };
            console.log('[Projects] Campaign watermark applied:', campaignCreatorProfile.watermark.name);
          } catch (e) {
            console.warn('[Projects] Failed to download campaign watermark:', e);
            folderCreatorWatermarkSettings.value = null;
          }
        } else {
          // No campaign watermark — clear creator default
          folderCreatorWatermarkSettings.value = null;
        }

        // Clear the creator profile so it doesn't override the campaign branding
        folderCreatorProfile.value = null;

        // Save campaign_id to the clip for payment tracking
        try {
          const { updateClip } = await import('@/services/database/clips');
          await updateClip(clip.id, { campaign_id: settings.campaignId });
          console.log('[Projects] Saved campaign_id', settings.campaignId, 'to clip', clip.id);
        } catch (e) {
          console.warn('[Projects] Failed to save campaign_id to clip:', e);
        }
      }
      // ── End Campaign Branding Override ───────────────────────────────────────

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

      // Resolve per-ratio intro/outro from creator profile
      const introOutroPerRatio: Record<
        string,
        { introPath?: string; introDuration?: number; outroPath?: string; outroDuration?: number }
      > = {};

      // New approach: Use separate intro_ratio_settings and outro_ratio_settings
      // Fall back to intro_outro_settings for backward compatibility
      const profile = folderCreatorProfile.value;

      if (profile) {
        try {
          // Parse intro ratio settings
          let introRatioSettings: Record<string, { assetId: number }> = {};
          if (profile.intro_ratio_settings) {
            try {
              introRatioSettings = JSON.parse(profile.intro_ratio_settings);
            } catch (e) {
              console.warn('[Projects] Failed to parse intro_ratio_settings:', e);
            }
          }

          // Parse outro ratio settings
          let outroRatioSettings: Record<string, { assetId: number }> = {};
          if (profile.outro_ratio_settings) {
            try {
              outroRatioSettings = JSON.parse(profile.outro_ratio_settings);
            } catch (e) {
              console.warn('[Projects] Failed to parse outro_ratio_settings:', e);
            }
          }

          // Fallback: Try old intro_outro_settings format
          let legacyIntroOutroSettings: Record<string, { introId?: number; outroId?: number }> = {};
          if (profile.intro_outro_settings && !profile.intro_ratio_settings && !profile.outro_ratio_settings) {
            try {
              legacyIntroOutroSettings = JSON.parse(profile.intro_outro_settings);
            } catch (e) {
              console.warn('[Projects] Failed to parse intro_outro_settings:', e);
            }
          }

          // Resolve assets for each aspect ratio
          for (const ratio of settings.aspectRatios) {
            const ratioData: {
              introPath?: string;
              introDuration?: number;
              outroPath?: string;
              outroDuration?: number;
            } = {};

            // Resolve intro for this ratio
            const introConfig = introRatioSettings[ratio] || legacyIntroOutroSettings[ratio];
            const introAssetId = introConfig?.assetId || (introConfig as any)?.introId;
            if (introAssetId) {
              const introAsset = await getIntroOutroById(introAssetId);
              if (introAsset) {
                ratioData.introPath = introAsset.file_path || undefined;
                ratioData.introDuration = introAsset.duration || undefined;
                console.log(`[Projects] Resolved intro for ${ratio}:`, introAsset.name);
              }
            }

            // Resolve outro for this ratio
            const outroConfig = outroRatioSettings[ratio] || legacyIntroOutroSettings[ratio];
            const outroAssetId = outroConfig?.assetId || (outroConfig as any)?.outroId;
            if (outroAssetId) {
              const outroAsset = await getIntroOutroById(outroAssetId);
              if (outroAsset) {
                ratioData.outroPath = outroAsset.file_path || undefined;
                ratioData.outroDuration = outroAsset.duration || undefined;
                console.log(`[Projects] Resolved outro for ${ratio}:`, outroAsset.name);
              }
            }

            // Only add to map if we found at least one asset
            if (ratioData.introPath || ratioData.outroPath) {
              introOutroPerRatio[ratio] = ratioData;
            }
          }
        } catch (e) {
          console.warn('[Projects] Failed to resolve per-ratio intro/outro:', e);
        }
      }

      // Free tier branding override: replace user intro/outro with admin-configured branding
      const { useFreeTierBranding } = await import('@/composables/useFreeTierBranding');
      const { getBrandingIfFreeTier } = useFreeTierBranding();
      const adminBranding = await getBrandingIfFreeTier();
      if (adminBranding) {
        console.log('[Projects] Free tier user detected - applying admin branding');

        // Clear any user-selected global intro/outro
        introPath = null;
        introDuration = null;
        outroPath = null;
        outroDuration = null;

        // Resolve admin per-ratio intro/outro settings into file paths
        if (adminBranding.intro_settings || adminBranding.outro_settings) {
          const introRatioSettings = adminBranding.intro_settings ?? {};
          const outroRatioSettings = adminBranding.outro_settings ?? {};

          const allRatios = new Set([...Object.keys(introRatioSettings), ...Object.keys(outroRatioSettings)]);

          for (const ratio of allRatios) {
            const ratioData: {
              introPath?: string;
              introDuration?: number;
              outroPath?: string;
              outroDuration?: number;
            } = {};

            const introConfig = introRatioSettings[ratio];
            if (introConfig?.assetId) {
              // Use presigned URL if available (free tier users), otherwise fall back to local resolution
              if ((introConfig as any).url) {
                try {
                  const filename = `free-tier-intro-${introConfig.assetId.replace(/[^a-zA-Z0-9-]/g, '_')}.mp4`;
                  const localPath = await invoke<string>('download_org_asset_from_url', {
                    url: (introConfig as any).url,
                    filename,
                    assetType: 'intros',
                    organizationId: 'free-tier',
                  });
                  ratioData.introPath = localPath;
                  console.log(`[Projects] Admin intro for ${ratio} downloaded:`, localPath);
                } catch (dlErr) {
                  console.error(`[Projects] Failed to download admin intro for ${ratio}:`, dlErr);
                }
              } else {
                const { resolveIntroOutroById } = await import('@/services/database/intro-outros');
                const resolved = await resolveIntroOutroById(introConfig.assetId);
                if (resolved) {
                  ratioData.introPath = resolved.filePath;
                  ratioData.introDuration = resolved.duration ?? undefined;
                  console.log(`[Projects] Admin intro for ${ratio}:`, resolved.filePath);
                }
              }
            }

            const outroConfig = outroRatioSettings[ratio];
            if (outroConfig?.assetId) {
              // Use presigned URL if available (free tier users), otherwise fall back to local resolution
              if ((outroConfig as any).url) {
                try {
                  const filename = `free-tier-outro-${outroConfig.assetId.replace(/[^a-zA-Z0-9-]/g, '_')}.mp4`;
                  const localPath = await invoke<string>('download_org_asset_from_url', {
                    url: (outroConfig as any).url,
                    filename,
                    assetType: 'outros',
                    organizationId: 'free-tier',
                  });
                  ratioData.outroPath = localPath;
                  console.log(`[Projects] Admin outro for ${ratio} downloaded:`, localPath);
                } catch (dlErr) {
                  console.error(`[Projects] Failed to download admin outro for ${ratio}:`, dlErr);
                }
              } else {
                const { resolveIntroOutroById } = await import('@/services/database/intro-outros');
                const resolved = await resolveIntroOutroById(outroConfig.assetId);
                if (resolved) {
                  ratioData.outroPath = resolved.filePath;
                  ratioData.outroDuration = resolved.duration ?? undefined;
                  console.log(`[Projects] Admin outro for ${ratio}:`, resolved.filePath);
                }
              }
            }

            if (ratioData.introPath || ratioData.outroPath) {
              introOutroPerRatio[ratio] = ratioData;
            }
          }
        }
      }

      const { getClipTextBoxOverlaysForExport } = await import('@/utils/clipTextBox');
      const textOverlaysFromClipBox = await getClipTextBoxOverlaysForExport(clip.id);

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
        introOutroPerRatio: introOutroPerRatio,
        watermarkSettings: watermarkSettings,
        audioSettings: null,
        framingStrategy: null,
        videoFilterSegments: null, // No filter segments from folder view
        textOverlays: textOverlaysFromClipBox,
        stickers: null, // No stickers from folder view
        clipWatermarks: null, // No clip watermarks from folder view
        layoutOverlays: folderCreatorProfile.value?.layout_overlays
          ? JSON.parse(folderCreatorProfile.value.layout_overlays)
          : null,
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

  // Execute multiple build targets sequentially (for org/campaign multi-builds)
  async function executeMultiBuildTargets(clip: ClipWithVersionAndSegment, videoPath: string, settings: BuildSettings) {
    const buildTargets = settings.buildTargets!;
    console.log(`[Projects] Starting ${buildTargets.length} sequential builds`);

    const { createClipBuild, getClipBuilds, updateClipBuild } = await import('@/services/database/clip-build');
    const { getClipSegmentsByVersionId } = await import('@/services/database/clip-segments');
    const { updateClipBuildStatus } = await import('@/services/database');

    // Load segments once (shared across all builds)
    let segments: any[] = [];
    const versionId = clip.current_version_id || clip.current_version?.id;
    if (versionId) {
      try {
        const dbSegments = await getClipSegmentsByVersionId(versionId);
        if (dbSegments.length > 0) {
          segments = dbSegments.map((s: any) => ({
            id: s.id,
            start_time: s.start_time,
            end_time: s.end_time,
            duration: s.duration || s.end_time - s.start_time,
            transcript: s.transcript || null,
          }));
        }
      } catch (err) {
        console.warn('[Projects] Could not load segments:', err);
      }
    }

    // Fallback to synthetic segment
    if (segments.length === 0) {
      const startTime = clip.current_version?.start_time ?? clip.start_time ?? 0;
      const endTime = clip.current_version?.end_time ?? clip.end_time ?? 0;
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

    const { getClipTextBoxOverlaysForExport } = await import('@/utils/clipTextBox');
    const textOverlaysFromClipBoxMulti = await getClipTextBoxOverlaysForExport(clip.id);

    // Process each build target sequentially
    for (let i = 0; i < buildTargets.length; i++) {
      const target = buildTargets[i];
      console.log(
        `[Projects] Building ${i + 1}/${buildTargets.length}: ${target.type} - ${target.name} (${target.aspectRatios.join(', ')})`
      );

      // Get build number
      let buildNumber = 1;
      try {
        const existingBuilds = await getClipBuilds(clip.id);
        buildNumber = existingBuilds.length + 1;
      } catch {
        buildNumber = 1;
      }

      // Create build record for this target
      const buildId = await createClipBuild(clip.id, {
        aspectRatios: target.aspectRatios,
        quality: settings.quality,
        frameRate: settings.frameRate,
        outputFormat: settings.format,
        organizationId: target.organizationId || null,
        organizationName: target.organizationName || null,
        campaignId: target.type === 'campaign' ? target.id : null,
        campaignName: target.type === 'campaign' ? target.name : null,
        brandingProfileId: target.brandingProfileId ? String(target.brandingProfileId) : null,
        brandingType: target.type,
      });

      // Fetch branding assets for this target (watermark, intro, outro)
      let watermarkSettings = null;
      let introPath: string | null = null;
      let introDuration: number | null = null;
      let outroPath: string | null = null;
      let outroDuration: number | null = null;
      const introOutroPerRatio: Record<string, any> = {};

      // Fetch org/campaign branding profile assets
      if (target.brandingProfileId && target.organizationId) {
        try {
          const { getUserAssignedCreatorProfiles } = await import('@/services/organizationProfilesApi');
          const { ensureAssetDownloaded } = await import('@/services/orgAssetSync');

          // Get the creator profile to access its assets
          const profilesRes = await getUserAssignedCreatorProfiles();
          if (profilesRes.success && profilesRes.profiles) {
            const profile = profilesRes.profiles.find((p) => p.id === Number(target.brandingProfileId));

            if (profile) {
              // Download and apply watermark
              if (profile.watermark) {
                const wmResult = await ensureAssetDownloaded({
                  id: profile.watermark.id,
                  name: profile.watermark.name,
                  asset_type: 'watermark',
                  url: profile.watermark.url || '',
                  thumbnail_url: profile.watermark.thumbnail_url || null,
                  organization_id: target.organizationId,
                  organization_name: target.organizationName || '',
                  width: null,
                  height: null,
                  duration: null,
                  file_size: null,
                  mime_type: null,
                  uploaded_by: null,
                  inserted_at: profile.inserted_at,
                  updated_at: profile.updated_at,
                } as any);
                if (wmResult.success && wmResult.filePath) {
                  // Parse watermark settings for position
                  let posX = 88,
                    posY = 81,
                    opacity = 80,
                    scale = 20;
                  if (profile.watermark_settings) {
                    const wmSettings =
                      typeof profile.watermark_settings === 'string'
                        ? JSON.parse(profile.watermark_settings)
                        : profile.watermark_settings;
                    const defaultRatio = wmSettings['16:9'] || wmSettings['9:16'] || Object.values(wmSettings)[0];
                    if (defaultRatio?.position) {
                      posX = defaultRatio.position.x ?? posX;
                      posY = defaultRatio.position.y ?? posY;
                      opacity = defaultRatio.position.opacity ?? opacity;
                      scale = defaultRatio.position.scale ?? scale;
                    }
                  }
                  watermarkSettings = {
                    enabled: true,
                    watermarkId: String(profile.watermark.id),
                    filePath: wmResult.filePath,
                    width: null,
                    height: null,
                    positionX: posX,
                    positionY: posY,
                    opacity: opacity,
                    scale: scale,
                    perRatioSettings: profile.watermark_settings,
                  };
                  console.log(`[Projects] Applied ${target.type} watermark:`, profile.watermark.name);
                }
              }

              // Download and apply intro
              if (profile.intro) {
                const introResult = await ensureAssetDownloaded({
                  id: profile.intro.id,
                  name: profile.intro.name,
                  asset_type: 'intro',
                  url: profile.intro.url || '',
                  thumbnail_url: profile.intro.thumbnail_url || null,
                  organization_id: target.organizationId,
                  organization_name: target.organizationName || '',
                  width: null,
                  height: null,
                  duration: profile.intro.duration,
                  file_size: null,
                  mime_type: null,
                  uploaded_by: null,
                  inserted_at: profile.inserted_at,
                  updated_at: profile.updated_at,
                } as any);
                if (introResult.success && introResult.filePath) {
                  introPath = introResult.filePath;
                  introDuration = profile.intro.duration;
                  console.log(`[Projects] Applied ${target.type} intro:`, profile.intro.name);
                }
              }

              // Download and apply outro
              if (profile.outro) {
                const outroResult = await ensureAssetDownloaded({
                  id: profile.outro.id,
                  name: profile.outro.name,
                  asset_type: 'outro',
                  url: profile.outro.url || '',
                  thumbnail_url: profile.outro.thumbnail_url || null,
                  organization_id: target.organizationId,
                  organization_name: target.organizationName || '',
                  width: null,
                  height: null,
                  duration: profile.outro.duration,
                  file_size: null,
                  mime_type: null,
                  uploaded_by: null,
                  inserted_at: profile.inserted_at,
                  updated_at: profile.updated_at,
                } as any);
                if (outroResult.success && outroResult.filePath) {
                  outroPath = outroResult.filePath;
                  outroDuration = profile.outro.duration;
                  console.log(`[Projects] Applied ${target.type} outro:`, profile.outro.name);
                }
              }
            }
          }
        } catch (err) {
          console.warn(`[Projects] Failed to fetch branding for ${target.type} ${target.name}:`, err);
        }
      }

      // Create promise for build completion
      const buildCompletePromise = new Promise<void>((resolve, reject) => {
        const handleComplete = async (event: any) => {
          const payload = event.payload;
          if (payload.clip_id !== clip.id) return;

          window.removeEventListener('clip-build-complete' as any, handleComplete);

          if (payload.success && payload.output_path) {
            await updateClipBuild(buildId, {
              status: 'completed',
              filePath: payload.output_path,
              outputPaths: payload.all_output_paths,
              thumbnailPath: payload.thumbnail_path || undefined,
              duration: payload.duration || undefined,
            });
            resolve();
          } else {
            await updateClipBuild(buildId, {
              status: 'failed',
              errorMessage: payload.error || 'Build failed',
            });
            reject(new Error(payload.error || 'Build failed'));
          }
        };

        // Listen for Tauri event
        import('@tauri-apps/api/event').then(({ listen }) => {
          listen('clip-build-complete', handleComplete);
        });
      });

      // Start the build
      await invoke('build_clip_from_segments', {
        projectId: clip.segment_id,
        clipId: clip.id,
        clipName: clip.current_version?.name || clip.name || 'Untitled',
        videoPath,
        segments,
        subtitleSettings: null,
        subtitleOverrides: settings.subtitleOverrides || null,
        transcriptWords: [],
        transcriptSegments: [],
        maxWords: 3,
        aspectRatios: target.aspectRatios,
        quality: settings.quality,
        frameRate: settings.frameRate,
        outputFormat: settings.format,
        runNumber: clip.run_number || null,
        buildNumber,
        buildId,
        introPath,
        introDuration,
        outroPath,
        outroDuration,
        introOutroPerRatio: Object.keys(introOutroPerRatio).length > 0 ? introOutroPerRatio : null,
        watermarkSettings,
        audioSettings: null,
        framingStrategy: null,
        manualFramingConfigs: settings.manualFramingConfigs || null,
        segmentFramingConfigs: null,
        videoFilterSegments: null,
        textOverlays: textOverlaysFromClipBoxMulti,
        stickers: null,
        clipWatermarks: null,
        clipEffects: null,
        audioEffects: null,
        layoutOverlays: settings.layoutOverlays || null,
        campaignId: target.type === 'campaign' ? target.id : null,
        campaignBrandingProfileId: target.brandingProfileId,
        brandingType: target.type,
      });

      // Wait for this build to complete before starting next
      await buildCompletePromise;
      console.log(`[Projects] Completed build ${i + 1}/${buildTargets.length}`);
    }

    success('Builds completed', `Successfully built ${buildTargets.length} clips.`);
    showFolderBuildDialog.value = false;
    folderClipToBuild.value = null;
    isFolderBuildInProgress.value = false;

    // Refresh clips list
    if (clip.segment_id) {
      await loadFolderClips(clip.segment_id);
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
    return formatDateTime(new Date(timestamp * 1000));
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

    // Filter out empty projects (projects with no raw videos AND no clips)
    // This hides folders that were created for downloads but the download hasn't completed yet
    // or failed/was cancelled. Show projects that have at least one raw video OR at least one clip.
    result = result.filter((p) => {
      const videos = projectVideos.value[p.id] || [];
      const clipCount = getClipCount(p.id);

      // For parent projects (folders), check if any child has videos or clips
      if (hasChildren(p.id)) {
        const childProjects = projects.value.filter((child) => child.parent_id === p.id);
        return childProjects.some((child) => {
          const childVideos = projectVideos.value[child.id] || [];
          const childClipCount = getClipCount(child.id);
          return childVideos.length > 0 || childClipCount > 0;
        });
      }
      // For regular projects, check if they have videos OR clips
      return videos.length > 0 || clipCount > 0;
    });

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
      cancelThumbnailGeneration(); // Stop any running thumbnail generation
      // Clear project from generated set so thumbnails can regenerate on next visit
      if (folderProject.value?.id) {
        thumbnailsGeneratedForProjects.value.delete(folderProject.value.id);
      }
    }
  });

  async function openCreateDialog() {
    // Check if user is authenticated first
    if (!authStore.isAuthenticated) {
      showAuthModal.value = true;
      return;
    }

    // Check subscription access before allowing project creation
    if (!(await gates.createProject())) {
      return; // Gate was shown, user doesn't have access
    }

    selectedProject.value = null;
    showDialog.value = true;
  }

  function openWorkspace(project: Project, initialClipId?: string | null) {
    console.log('[Projects] Opening workspace for project:', project.id, 'parent_id:', project.parent_id);
    workspaceProject.value = project;
    workspaceInitialClipId.value = initialClipId || null;
    showWorkspaceDialog.value = true;
    showFolderDialog.value = false; // Close folder dialog if open
  }

  function editProject(project: Project) {
    selectedProject.value = project;
    showDialog.value = true;
  }

  // Cancel all active downloads
  async function handleCancelAllDownloads() {
    try {
      await cancelAllDownloads();
      success('Downloads cancelled', 'All active downloads have been cancelled');
    } catch (err) {
      console.error('[Projects] Failed to cancel all downloads:', err);
      error('Failed to cancel downloads', 'Could not cancel all downloads');
    }
  }

  async function handleProjectSubmit(data: ProjectFormData) {
    try {
      if (selectedProject.value) {
        // Update existing project
        await updateProject(
          selectedProject.value.id,
          data.name,
          data.description || undefined,
          undefined,
          undefined,
          data.creatorProfileId
        );

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
          const parentId = await createProject(
            data.name,
            data.description || undefined,
            undefined,
            'Manual',
            undefined,
            data.creatorProfileId || undefined
          );

          // Create child projects for each video
          for (const path of data.selectedVideoPaths) {
            // Use filename as child project name
            const filename = path.split(/[\\/]/).pop() || 'Part';
            // Remove extension
            const childName = filename.replace(/\.[^/.]+$/, '');

            // Create child project (inherits creator profile from parent)
            const childId = await createProject(
              childName,
              data.description || undefined,
              parentId,
              'Manual',
              undefined,
              data.creatorProfileId || undefined
            );

            // Process video and associate with child project
            await processVideoFile(path, childId);
          }

          success('Project created', `"${data.name}" has been created with ${data.selectedVideoPaths.length} parts`);
        } else {
          // Standard creation for single video or no video
          const projectId = await createProject(
            data.name,
            data.description || undefined,
            undefined,
            'Manual',
            undefined,
            data.creatorProfileId || undefined
          );

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
  // Uses enhanced deletion that respects in-editor and built clip retention
  async function deleteProjectWithFiles(projectId: string): Promise<void> {
    // Get in-editor clip IDs to preserve them during deletion
    const inEditorClipIds = new Set(inEditorStore.entries.map((e) => e.clipId));

    // Delete the project using enhanced deletion that retains built and in-editor clips
    const { deletedClipIds, retainedClipIds } = await deleteProjectWithRetention(projectId, inEditorClipIds);

    console.log(
      `[Projects] Project ${projectId} deleted. Clips deleted: ${deletedClipIds.length}, retained: ${retainedClipIds.length}`
    );

    // Get all raw videos for this project
    const videos = await getRawVideosByProjectId(projectId);

    // If there are retained clips (built or in-editor), preserve audio/waveform caches
    // These caches are needed for waveform display and editing
    const hasRetainedClips = retainedClipIds.length > 0;

    // Track unique session IDs for livestream recording cleanup
    const sessionIdsToDelete = new Set<string>();

    for (const video of videos) {
      try {
        // Check if this is a livestream recording by checking the file path
        // Livestream recordings are stored in: livestream_recordings/{session_id}/segment_*.ts
        if (video.file_path.includes('livestream_recordings')) {
          const pathParts = video.file_path.split(/[/\\]/);
          const recordingsIndex = pathParts.findIndex((part) => part === 'livestream_recordings');
          if (recordingsIndex !== -1 && recordingsIndex + 1 < pathParts.length) {
            const sessionId = pathParts[recordingsIndex + 1];
            sessionIdsToDelete.add(sessionId);
          }
        }

        // Always delete proxy files for this video source
        // Proxies are tied to the raw video, not the clips, so they should always be deleted
        try {
          await invoke('delete_proxy_files', {
            sourceId: video.id,
          });
          console.log(`[Projects] Deleted proxy files for source: ${video.id}`);
        } catch (proxyErr) {
          console.warn(`[Projects] Failed to delete proxy files for source ${video.id}:`, proxyErr);
          // Continue with other deletions
        }

        if (hasRetainedClips) {
          // Only delete video file and thumbnail, preserve audio/waveform caches
          // Retained clips (built or in-editor) still need these caches
          await invoke('delete_video_file', {
            filePath: video.file_path,
            thumbnailPath: video.thumbnail_path || null,
          });
          console.log(
            `[Projects] Deleted video/thumbnail only (preserving caches for ${retainedClipIds.length} retained clips): ${video.file_path}`
          );
        } else {
          // No retained clips, safe to delete everything
          await invoke('delete_raw_video_files', {
            filePath: video.file_path,
            thumbnailPath: video.thumbnail_path || null,
          });
          console.log(`[Projects] Comprehensive cleanup completed for: ${video.file_path}`);
        }
      } catch (err) {
        console.warn(`[Projects] Failed to delete video files for: ${video.file_path}`, err);
        // Continue deleting other files even if one fails
      }
    }

    // Delete livestream recording directories
    for (const sessionId of sessionIdsToDelete) {
      try {
        await invoke('delete_livestream_recording', {
          sessionId,
        });
        console.log(`[Projects] Deleted livestream recording directory for session: ${sessionId}`);
      } catch (err) {
        console.warn(`[Projects] Failed to delete livestream recording directory for session ${sessionId}:`, err);
        // Continue with other deletions
      }
    }
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
      console.error('[Projects] Failed to delete project:', err);
      error(
        'Failed to delete project',
        `An error occurred while deleting the project: ${err instanceof Error ? err.message : String(err)}`
      );
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
      console.error('[Projects] Failed to delete projects:', err);
      error(
        'Failed to delete projects',
        `An error occurred while deleting the projects: ${err instanceof Error ? err.message : String(err)}`
      );
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
      console.error('[Projects] Failed to delete segments:', err);
      error(
        'Failed to delete segments',
        `An error occurred while deleting the segments: ${err instanceof Error ? err.message : String(err)}`
      );
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

  function getProjectVideoDurationSeconds(projectId: string): number {
    const videos = projectVideos.value[projectId];
    if (!videos?.length) {
      return 0;
    }
    return videos.reduce((sum, v) => sum + (v.duration || 0), 0);
  }

  function isProjectShortVideoOnly(projectId: string): boolean {
    const children = getFolderChildren(projectId);
    if (children.length > 0) {
      const segmentsWithVideo = children.filter((child) => {
        const vids = projectVideos.value[child.id];
        return vids && vids.length > 0;
      });
      if (segmentsWithVideo.length === 0) {
        const dur = getProjectVideoDurationSeconds(projectId);
        return dur > 0 && isShortVideoAutoClipEligible(dur);
      }
      return segmentsWithVideo.every((child) =>
        isShortVideoAutoClipEligible(getProjectVideoDurationSeconds(child.id))
      );
    }

    const duration = getProjectVideoDurationSeconds(projectId);
    return duration > 0 && isShortVideoAutoClipEligible(duration);
  }

  function canDetectClips(projectId: string): boolean {
    if (isProjectShortVideoOnly(projectId)) {
      return false;
    }

    const videos = projectVideos.value[projectId];
    if (videos && videos.length > 0) {
      return true;
    }

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
    if (!authStore.isAuthenticated) {
      window.dispatchEvent(new CustomEvent('show-auth-modal'));
      return;
    }

    if (isProjectShortVideoOnly(project.id)) {
      error(
        'Clip detection unavailable',
        `Videos under ${SHORT_VIDEO_CLIP_THRESHOLD_SECONDS} seconds are already imported as a full clip. Transcribe and build from the clip instead.`
      );
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
    organizationId: number | null = null,
    startTime: number = 0,
    endTime: number = 0,
    subtitleSettings: { enabled: boolean; presetId: string } | null = null,
    enhanced: boolean = false
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
              startTime: startTime,
              endTime: endTime,
              subtitleSettings: subtitleSettings,
              enhanced,
              streamerMetadata: {
                display_name: segment.name,
                platform: segment.platform,
                creator_profile_id: segment.creator_profile_id,
              },
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
          `Processed ${successCount} of ${totalSegments} folder video(s). Found ${totalClipsFound} clips total.`
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

  // ===== Transcription-Only Functions =====

  function canTranscribe(projectId: string): boolean {
    const videos = projectVideos.value[projectId];
    if (videos && videos.length > 0) {
      return true;
    }
    const children = getFolderChildren(projectId);
    for (const child of children) {
      const childVideos = projectVideos.value[child.id];
      if (childVideos && childVideos.length > 0) {
        return true;
      }
    }
    return false;
  }

  function isProjectTranscribed(projectId: string): boolean {
    // For standalone projects, check directly
    const children = getFolderChildren(projectId);
    if (children.length === 0) {
      return !!projectTranscriptStatus.value[projectId];
    }
    // For folder projects, check if ALL children with videos are transcribed
    const childrenWithVideos = children.filter((child) => {
      const videos = projectVideos.value[child.id];
      return videos && videos.length > 0;
    });
    if (childrenWithVideos.length === 0) return false;
    return childrenWithVideos.every((child) => projectTranscriptStatus.value[child.id]);
  }

  async function loadTranscriptStatuses(projectIds: string[]) {
    for (const pid of projectIds) {
      try {
        projectTranscriptStatus.value[pid] = await hasTranscriptForProject(pid);
      } catch {
        // Non-critical — leave as false
      }
    }
  }

  async function startTranscription(project: Project) {
    if (!authStore.isAuthenticated) {
      window.dispatchEvent(new CustomEvent('show-auth-modal'));
      return;
    }

    if (!(await gates.aiDetection(`Transcribe "${project.name}"`))) {
      return;
    }

    // Gather segments to transcribe
    const children = getFolderChildren(project.id);
    if (children.length > 0) {
      segmentsToTranscribe.value = children.filter((child) => {
        const videos = projectVideos.value[child.id];
        return videos && videos.length > 0;
      });
    } else {
      const videos = projectVideos.value[project.id];
      if (videos && videos.length > 0) {
        segmentsToTranscribe.value = [project];
      } else {
        segmentsToTranscribe.value = [];
      }
    }

    if (segmentsToTranscribe.value.length === 0) {
      error('No videos found', 'This project has no videos to transcribe.');
      return;
    }

    // Calculate total duration
    totalTranscribeDuration.value = segmentsToTranscribe.value.reduce((acc, segment) => {
      const videos = projectVideos.value[segment.id];
      return acc + (videos?.reduce((sum, v) => sum + (v.duration || 0), 0) || 0);
    }, 0);

    projectToTranscribe.value = project;
    showTranscribeDialog.value = true;
  }

  async function onTranscribeConfirmed(organizationId: number | null = null) {
    if (!projectToTranscribe.value || segmentsToTranscribe.value.length === 0) {
      return;
    }

    const segments = [...segmentsToTranscribe.value];
    const totalSegments = segments.length;
    let successCount = 0;

    try {
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];

        success('Transcribing...', `Processing segment ${i + 1} of ${totalSegments}: ${segment.name}`, 3000);

        activeTranscriptions.value.add(segment.id);
        // Trigger reactivity
        activeTranscriptions.value = new Set(activeTranscriptions.value);

        try {
          const { transcribeProject, progress: transcribeProgress } = useTranscriptionOnly();

          const result = await transcribeProject(segment.id, {
            organizationId: organizationId,
          });

          if (result.success) {
            successCount++;
            projectTranscriptStatus.value[segment.id] = true;
          }
        } catch (err) {
          console.error(`Failed to transcribe segment ${segment.name}:`, err);
        } finally {
          activeTranscriptions.value.delete(segment.id);
          activeTranscriptions.value = new Set(activeTranscriptions.value);
        }
      }

      if (successCount === totalSegments) {
        success(
          'Transcription Complete',
          `Successfully transcribed ${successCount} segment${successCount !== 1 ? 's' : ''}.`
        );
      } else if (successCount > 0) {
        error(
          'Transcription Partially Complete',
          `Transcribed ${successCount} of ${totalSegments} segments. Some segments failed.`
        );
      } else {
        error('Transcription Failed', 'All segments failed to transcribe.');
      }
    } finally {
      projectToTranscribe.value = null;
      segmentsToTranscribe.value = [];
      totalTranscribeDuration.value = 0;
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
    await loadFolderPrompts();

    // Silently backfill metadata for any videos imported without duration/thumbnail
    backgroundFixMissingMetadata();

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
    // Cleanup HLS instance
    cleanupInlineHls();

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
    padding-bottom: 2rem;
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
    margin: 0 0 0.2rem;
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
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .projects__selection-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    font-weight: 500;
  }

  .projects__selection-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-accent);
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

  .projects__selection-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .projects__selection-clear {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .projects__selection-clear:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
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

  .projects__selection-delete-icon {
    width: 13px;
    height: 13px;
  }

  /* Selection Bar Transitions */
  .selection-bar-enter-active {
    animation: slideDown 0.2s ease-out;
  }

  .selection-bar-leave-active {
    animation: slideUp 0.15s ease-in;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideUp {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-8px);
    }
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

  .projects__section-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .projects__section-header {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin: 0;
    padding-bottom: 0.1rem;
  }

  .projects__cancel-all-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .projects__cancel-all-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border-color: var(--border-hover);
  }

  .projects__cancel-all-btn:active {
    transform: scale(0.98);
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
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 2200px) {
    .projects__grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  /* List View Override */
  .projects__grid--list {
    grid-template-columns: 1fr !important;
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
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
  }

  .project-card--selected:hover {
    border-color: var(--sidebar-accent);
  }

  .project-card--skeleton {
    pointer-events: none;
  }

  /* List View Card */
  .project-card--list {
    aspect-ratio: unset !important;
    display: flex;
    flex-direction: row;
    align-items: center;
    min-height: 96px;
    padding: 0.75rem;
    gap: 1rem;
    background-color: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
  }

  .project-card--list:hover {
    transform: translateY(-1px);
    background-color: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .project-card--list .project-card__thumbnail,
  .project-card--list .project-card__thumbnail--empty {
    position: relative;
    width: 140px;
    min-width: 140px;
    height: 80px;
    border-radius: 6px;
    overflow: hidden;
  }

  .project-card--list .project-card__vignette {
    display: none;
  }

  .project-card--list .project-card__bottom {
    position: relative;
    background: transparent;
    padding: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.375rem;
    min-width: 0;
  }

  .project-card--list .project-card__title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }

  .project-card--list .project-card__meta {
    opacity: 0.65;
    font-size: 0.8125rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .project-card--list .project-card__hover-actions {
    position: relative;
    opacity: 1;
    transform: none;
    margin-left: auto;
    padding-right: 0;
    display: flex;
    gap: 0.375rem;
    align-items: center;
  }

  .project-card--list .project-card__badge {
    left: 0.5rem;
    top: 0.5rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }

  .project-card--list .project-card__badge-icon {
    width: 14px;
    height: 14px;
  }

  .project-card--list .project-card__checkbox {
    position: relative;
    left: 0;
    right: auto;
    top: 0;
    transform: none;
    margin-right: 0.5rem;
    opacity: 1;
  }

  .project-card--list .project-card__platform-icon,
  .project-card--list .project-card__platform-svg {
    width: 14px;
    height: 14px;
  }

  .project-card--list .project-card__live {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
  }

  .project-card--list .project-card__live-dot {
    width: 6px;
    height: 6px;
  }

  .project-card--list .project-card__live-ping,
  .project-card--list .project-card__live-core {
    width: 6px;
    height: 6px;
  }

  .project-card--list .project-card__dot {
    width: 3px;
    height: 3px;
    opacity: 0.4;
  }

  .project-card--list .project-card__empty-icon {
    transform: scale(0.7);
  }

  .project-card--list .project-card__empty-live {
    transform: scale(0.7);
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

  .project-card__checkbox-inner--checked:hover {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
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
    gap: 0.25rem;
    padding: 0.3125rem 0.5rem;
    border-radius: 5px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .project-card__badge--detecting {
    background-color: rgba(147, 51, 234, 0.3);
    color: #c4b5fd;
  }

  .project-card__badge--folder {
    background-color: rgba(59, 130, 246, 0.3);
    color: #93c5fd;
  }

  .project-card__badge-icon {
    width: 10px;
    height: 10px;
  }

  .project-card__badge-icon--spin {
    animation: spin 0.8s linear infinite;
  }

  .project-card__preset-badge {
    position: absolute;
    top: 1rem;
    right: 1rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    border-radius: 0.375rem;
    backdrop-filter: blur(8px);
    z-index: 5;
    background-color: rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
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

  .project-card__platform--rumble {
    background-color: #85c742;
  }

  .project-card__platform--twitter {
    background-color: #000000;
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

  .project-card__action-btn--transcribed {
    background-color: rgba(34, 197, 94, 0.9);
    color: white;
  }

  .project-card__action-btn--transcribed:hover {
    background-color: #22c55e;
  }

  .project-card__action-btn--preset-active {
    background-color: rgba(16, 185, 129, 0.9);
    color: white;
  }

  .project-card__action-btn--preset-active:hover {
    background-color: #10b981;
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

  /* ========================================
     FOLDER DIALOG STYLES
     ======================================== */

  /* ===== Overlay ===== */
  .folder-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  /* ===== Dialog Container ===== */
  .folder-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .folder-dialog--sm {
    max-width: 520px;
  }

  .folder-dialog--md {
    max-width: 768px;
  }

  .folder-dialog--lg {
    max-width: 1024px;
  }

  .folder-dialog--xl {
    max-width: 1280px;
  }

  /* ===== Accent Bar ===== */
  .folder-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header (Compact) ===== */
  .folder-dialog__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.625rem 0.75rem;
    background-color: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid var(--sidebar-border);
  }

  .folder-dialog__header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .folder-dialog__header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .folder-dialog__title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .folder-dialog__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .folder-dialog__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  /* ===== Selection Controls ===== */
  .folder-dialog__selection-delete {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .folder-dialog__selection-delete:hover:not(:disabled) {
    opacity: 0.9;
  }

  .folder-dialog__selection-delete--disabled,
  .folder-dialog__selection-delete:disabled {
    background: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .folder-dialog__selection-count {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .folder-dialog__selection-clear {
    background: none;
    border: none;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: color 150ms ease;
  }

  .folder-dialog__selection-clear:hover {
    color: var(--sidebar-text);
  }

  /* ===== Tabs ===== */
  .folder-dialog__tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0 1rem;
    background-color: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid var(--sidebar-border);
    flex-shrink: 0;
  }

  .folder-dialog__tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    margin-bottom: -1px;
  }

  .folder-dialog__tab:hover {
    color: var(--sidebar-text);
  }

  .folder-dialog__tab--active {
    color: var(--sidebar-accent);
    border-bottom-color: var(--sidebar-accent);
  }

  .folder-dialog__tab-count {
    padding: 0.125rem 0.5rem;
    background-color: var(--sidebar-hover);
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 600;
  }

  .folder-dialog__tab--active .folder-dialog__tab-count {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  /* ===== Tab guidance ===== */
  .folder-dialog__guidance {
    flex-shrink: 0;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--sidebar-border);
    background-color: rgba(0, 0, 0, 0.15);
  }

  .folder-dialog__guidance--segments {
    border-left: 3px solid var(--sidebar-accent);
  }

  .folder-dialog__guidance--clips {
    border-left: 3px solid rgba(34, 197, 94, 0.85);
  }

  .folder-dialog__guidance-inner {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .folder-dialog__guidance-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    border-radius: 8px;
  }

  .folder-dialog__guidance-icon--edit {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .folder-dialog__guidance-icon--publish {
    background-color: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }

  .folder-dialog__guidance-text {
    min-width: 0;
  }

  .folder-dialog__guidance-title {
    margin: 0 0 0.25rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    line-height: 1.3;
  }

  .folder-dialog__guidance-body {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: var(--sidebar-text-muted);
  }

  /* ===== Content ===== */
  .folder-dialog__content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .folder-dialog__content--clips {
    display: flex;
    padding: 0;
    overflow: hidden;
  }

  .folder-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .folder-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .folder-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Segments Tab ===== */
  .folder-dialog__segments {
    width: 100%;
  }

  .folder-dialog__segments-grid {
    display: grid;
    gap: 1.25rem;
  }

  .folder-dialog__segments-grid--1 {
    grid-template-columns: 1fr;
  }

  .folder-dialog__segments-grid--2 {
    grid-template-columns: repeat(2, 1fr);
  }

  .folder-dialog__segments-grid--3 {
    grid-template-columns: repeat(3, 1fr);
  }

  /* ===== Segment Card ===== */
  .folder-dialog__segment-card {
    position: relative;
    aspect-ratio: 16 / 9;
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    border: 1px solid var(--sidebar-border);
    transition: all 200ms ease;
  }

  .folder-dialog__segment-card:hover {
    transform: scale(1.02);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .folder-dialog__segment-card--selected {
    border-color: var(--sidebar-accent);
    box-shadow:
      0 0 0 2px var(--sidebar-surface),
      0 0 0 4px var(--sidebar-accent);
  }

  /* ===== Segment Checkbox ===== */
  .folder-dialog__segment-checkbox {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 30;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .folder-dialog__segment-card:hover .folder-dialog__segment-checkbox,
  .folder-dialog__segment-checkbox--visible {
    opacity: 1;
  }

  .folder-dialog__segment-checkbox-box {
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
    transition: all 150ms ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .folder-dialog__segment-checkbox-box:hover {
    background-color: rgba(0, 0, 0, 0.8);
  }

  .folder-dialog__segment-checkbox-box--checked {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
  }

  /* ===== Segment Thumbnail ===== */
  .folder-dialog__segment-thumb {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }

  .folder-dialog__segment-thumb--empty {
    background-color: var(--sidebar-hover);
  }

  .folder-dialog__segment-thumb-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom right, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.6));
  }

  .folder-dialog__segment-thumb-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sidebar-text);
    opacity: 0.2;
  }

  /* ===== Segment Badges ===== */
  .folder-dialog__segment-detecting {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    background-color: rgba(147, 51, 234, 0.9);
    backdrop-filter: blur(4px);
    border-radius: 6px;
    color: white;
    font-size: 0.6875rem;
    font-weight: 700;
  }

  .folder-dialog__segment-duration {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    border-radius: 6px;
    color: white;
    font-size: 0.6875rem;
    font-weight: 500;
  }

  /* ===== Segment Info ===== */
  .folder-dialog__segment-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 5;
    padding: 0.75rem;
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
  }

  .folder-dialog__segment-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: white;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .folder-dialog__segment-meta {
    font-size: 0.6875rem;
    color: rgba(255, 255, 255, 0.7);
    margin: 0.25rem 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ===== Segment Hover Overlay ===== */
  .folder-dialog__segment-hover {
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

  .folder-dialog__segment-card:hover .folder-dialog__segment-hover {
    opacity: 1;
  }

  .folder-dialog__segment-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background-color: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 9999px;
    color: #1f2937;
    cursor: pointer;
    transition: all 150ms ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  .folder-dialog__segment-action--transcribed {
    background-color: rgba(34, 197, 94, 0.9);
    color: white;
  }

  .folder-dialog__segment-action--transcribed:hover {
    background-color: #22c55e;
  }

  .folder-dialog__segment-action:hover {
    background-color: white;
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }

  /* ===== Clips Tab Layout ===== */
  .folder-dialog__clips-layout {
    display: flex;
    flex: 1;
    height: 100%;
    min-height: 0;
  }

  /* ===== Clips List Column ===== */
  .folder-dialog__clips-list {
    width: 480px;
    flex-shrink: 0;
    max-height: calc(85vh - 120px);
    border-right: 1px solid var(--sidebar-border);
    overflow-y: auto;
    padding: 0 1rem 1rem 1rem;
  }

  .folder-dialog__clips-list::-webkit-scrollbar {
    width: 6px;
  }

  .folder-dialog__clips-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .folder-dialog__clips-list::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .folder-dialog__clips-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 0;
    color: var(--sidebar-text-muted);
  }

  .folder-dialog__clips-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    text-align: center;
  }

  .folder-dialog__clips-empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background-color: var(--sidebar-hover);
    border-radius: 9999px;
    color: var(--sidebar-text-muted);
    margin-bottom: 1rem;
  }

  .folder-dialog__clips-empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .folder-dialog__clips-empty-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 280px;
  }

  .folder-dialog__clips-items {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-bottom: 1rem;
  }

  /* ===== Clip Sections (Completed / Found) ===== */
  .folder-dialog__clips-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .folder-dialog__clips-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 0.125rem;
    color: var(--sidebar-text-muted);
    font-size: 0.75rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .folder-dialog__clips-section-title {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 700;
    color: var(--sidebar-text);
  }

  .folder-dialog__clips-section-label {
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .folder-dialog__clips-section-count {
    font-variant-numeric: tabular-nums;
    color: var(--sidebar-text-muted);
    font-weight: 600;
    opacity: 0.8;
  }

  .folder-dialog__clips-section-dot {
    width: 9px;
    height: 9px;
    border-radius: 9999px;
    display: inline-block;
  }

  .folder-dialog__clips-section-dot--completed {
    background-color: #22c55e;
  }

  .folder-dialog__clips-section-dot--found {
    background-color: #9ca3af;
  }

  /* ===== Clip Card ===== */
  .folder-dialog__clip-card {
    position: relative;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 200ms ease;
    overflow: hidden;
  }

  .folder-dialog__clip-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    background-color: var(--sidebar-active);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }

  .folder-dialog__clip-card--active {
    border-color: rgba(6, 182, 212, 0.5);
    background-color: rgba(6, 182, 212, 0.05);
    box-shadow: 0 0 0 1px rgba(6, 182, 212, 0.3);
  }

  .folder-dialog__clip-accent {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    opacity: 0.6;
    border-radius: 10px 0 0 10px;
  }

  .folder-dialog__clip-content {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem;
    padding-left: 1rem;
  }

  /* ===== Clip Thumbnail ===== */
  .folder-dialog__clip-thumb {
    position: relative;
    flex-shrink: 0;
    width: 144px;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    overflow: hidden;
    background-color: rgba(0, 0, 0, 0.5);
  }

  .folder-dialog__clip-thumb-img {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
  }

  .folder-dialog__clip-thumb-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sidebar-text-muted);
    opacity: 0.4;
  }

  .folder-dialog__clip-thumb-duration {
    position: absolute;
    bottom: 0.25rem;
    right: 0.25rem;
    padding: 0.125rem 0.375rem;
    background-color: rgba(0, 0, 0, 0.7);
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 500;
    color: white;
    font-variant-numeric: tabular-nums;
  }

  .folder-dialog__clip-thumb-hover {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.4);
    color: white;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .folder-dialog__clip-card:hover .folder-dialog__clip-thumb-hover {
    opacity: 1;
  }

  /* ===== Clip Details ===== */
  .folder-dialog__clip-details {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0.125rem 0;
  }

  .folder-dialog__clip-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .folder-dialog__clip-title-row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    min-width: 0;
  }

  .folder-dialog__clip-index {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--sidebar-text-muted);
    opacity: 0.5;
    margin-top: 0.125rem;
    font-variant-numeric: tabular-nums;
  }

  .folder-dialog__clip-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ===== Clip Actions ===== */
  .folder-dialog__clip-actions {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    flex-shrink: 0;
    margin: -0.25rem -0.25rem 0 0;
    opacity: 0;
    transition: opacity 200ms ease;
  }

  .folder-dialog__clip-card:hover .folder-dialog__clip-actions,
  .folder-dialog__clip-actions--visible {
    opacity: 1;
  }

  .folder-dialog__clip-action {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .folder-dialog__clip-action--preview:hover {
    background-color: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
  }

  .folder-dialog__clip-action--edit:hover {
    background-color: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .folder-dialog__clip-action--build:hover {
    background-color: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }

  .folder-dialog__clip-action--download {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    color: rgba(34, 197, 94, 0.8);
  }

  .folder-dialog__clip-action--download:hover {
    background-color: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }

  .folder-dialog__clip-action--delete:hover {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .folder-dialog__clip-download {
    position: relative;
  }

  /* ===== Download Menu ===== */
  .folder-dialog__download-menu {
    position: fixed;
    z-index: 99999;
    min-width: 260px;
    max-width: 340px;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    padding: 0.25rem 0;
    max-height: 300px;
    overflow-y: auto;
  }

  .folder-dialog__download-header {
    padding: 0.5rem 0.75rem;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sidebar-text-muted);
    border-bottom: 1px solid var(--sidebar-border);
    margin-bottom: 0.25rem;
  }

  .folder-dialog__download-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    text-align: left;
    cursor: pointer;
    transition: background-color 150ms ease;
  }

  .folder-dialog__download-item:last-child {
    border-bottom: none;
  }

  .folder-dialog__download-item:hover {
    background-color: var(--sidebar-hover);
  }

  .folder-dialog__download-item-icon {
    flex-shrink: 0;
    color: #4ade80;
  }

  .folder-dialog__download-item-info {
    flex: 1;
    min-width: 0;
  }

  .folder-dialog__download-item-name {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .folder-dialog__download-item-ratio {
    color: var(--sidebar-accent);
    font-weight: 600;
  }

  .folder-dialog__download-item-number {
    color: var(--sidebar-text-muted);
    opacity: 0.7;
  }

  .folder-dialog__download-item-filename {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .folder-dialog__download-item-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.125rem;
    font-size: 0.625rem;
    color: var(--sidebar-text-muted);
  }

  /* ===== Clip Metrics ===== */
  .folder-dialog__clip-metrics {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .folder-dialog__clip-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 500;
  }

  .folder-dialog__clip-badge--segment {
    background-color: rgba(6, 182, 212, 0.1);
    border: 1px solid rgba(6, 182, 212, 0.2);
    color: var(--sidebar-text);
    opacity: 0.7;
  }

  .folder-dialog__clip-badge--segment span {
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .folder-dialog__clip-badge--confidence {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  /* ===== Clip Footer ===== */
  .folder-dialog__clip-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
  }

  .folder-dialog__clip-time {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.6875rem;
    font-family: ui-monospace, monospace;
    font-variant-numeric: tabular-nums;
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .folder-dialog__clip-status {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .folder-dialog__clip-status--building {
    color: #60a5fa;
  }

  .folder-dialog__clip-status--built {
    color: #4ade80;
  }

  .folder-dialog__clip-run {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .folder-dialog__clip-run-dot {
    width: 8px;
    height: 8px;
    border-radius: 9999px;
  }

  /* ===== Player Column ===== */
  .folder-dialog__player {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 1rem;
    overflow-y: auto;
  }

  .folder-dialog__player-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    background-color: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
  }

  .folder-dialog__player-empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    background-color: var(--sidebar-hover);
    border-radius: 9999px;
    color: var(--sidebar-text-muted);
    opacity: 0.4;
    margin-bottom: 1rem;
  }

  .folder-dialog__player-empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    opacity: 0.8;
    margin: 0 0 0.5rem;
  }

  .folder-dialog__player-empty-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    opacity: 0.6;
    margin: 0;
    max-width: 280px;
  }

  .folder-dialog__player-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .folder-dialog__player-info {
    min-width: 0;
    flex: 1;
  }

  .folder-dialog__player-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .folder-dialog__player-segment {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .folder-dialog__player-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .folder-dialog__player-close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  /* ===== Video Container ===== */
  .folder-dialog__player-video {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background-color: black;
    border-radius: 10px;
    overflow: hidden;
  }

  .folder-dialog__player-video-el {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .folder-dialog__player-loading,
  .folder-dialog__player-no-source {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
  }

  .folder-dialog__player-watermark {
    position: absolute;
    pointer-events: none;
    z-index: 1;
    transition: opacity 300ms ease;
  }

  .folder-dialog__player-watermark-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  /* ===== Video Controls ===== */
  .folder-dialog__player-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 2;
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .folder-dialog__player-video:hover .folder-dialog__player-controls,
  .folder-dialog__player-controls--visible {
    opacity: 1;
  }

  .folder-dialog__player-progress {
    position: relative;
    height: 16px;
    width: 100%;
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .folder-dialog__player-progress-track {
    position: absolute;
    left: 0;
    right: 0;
    height: 4px;
    top: 50%;
    transform: translateY(-50%);
  }

  .folder-dialog__player-progress-bg {
    position: absolute;
    inset: 0;
    background-color: rgba(255, 255, 255, 0.2);
  }

  .folder-dialog__player-progress-bar {
    position: absolute;
    height: 100%;
    background-color: var(--sidebar-accent);
  }

  .folder-dialog__player-progress-bar--smooth {
    transition: width 75ms ease;
  }

  .folder-dialog__player-progress-thumb {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    background-color: var(--sidebar-accent);
    border-radius: 9999px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    pointer-events: none;
    transform: translate(-50%, -50%);
  }

  .folder-dialog__player-progress-thumb--large {
    width: 16px;
    height: 16px;
  }

  .folder-dialog__player-progress-thumb--smooth {
    transition:
      left 75ms ease,
      width 75ms ease,
      height 75ms ease;
  }

  .folder-dialog__player-progress-tooltip {
    position: absolute;
    top: -32px;
    padding: 0.25rem 0.5rem;
    background-color: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(4px);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    color: white;
    white-space: nowrap;
    pointer-events: none;
    z-index: 20;
    transform: translateX(-50%);
  }

  .folder-dialog__player-controls-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
  }

  .folder-dialog__player-controls-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .folder-dialog__player-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: white;
    cursor: pointer;
    transition: color 150ms ease;
    padding: 0;
  }

  .folder-dialog__player-btn:hover {
    color: var(--sidebar-accent);
  }

  .folder-dialog__player-volume {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .folder-dialog__player-volume-slider {
    width: 64px;
    height: 4px;
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 9999px;
    appearance: none;
    cursor: pointer;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .folder-dialog__player-volume:hover .folder-dialog__player-volume-slider {
    opacity: 1;
  }

  .folder-dialog__player-volume-slider::-webkit-slider-thumb {
    appearance: none;
    width: 10px;
    height: 10px;
    background-color: white;
    border-radius: 9999px;
  }

  .folder-dialog__player-time {
    font-size: 0.75rem;
    font-family: ui-monospace, monospace;
    font-variant-numeric: tabular-nums;
    color: white;
  }

  /* ===== Play Overlay ===== */
  .folder-dialog__player-play-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .folder-dialog__player-play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    border-radius: 9999px;
    color: white;
    padding-left: 4px;
  }

  /* ===== Player Description ===== */
  .folder-dialog__player-description {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
  }

  .folder-dialog__player-description p {
    font-size: 0.75rem;
    font-style: italic;
    color: var(--sidebar-text-muted);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ===== Footer ===== */
  .folder-dialog__footer {
    display: flex;
    justify-content: center;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-hover);
  }

  /* ===== Utility ===== */
  .folder-dialog__spin {
    animation: folder-dialog-spin 0.8s linear infinite;
  }

  @keyframes folder-dialog-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* ===== Search Palette Content Styles ===== */
  /* Results */
  .search-palette__results {
    display: flex;
    flex-direction: column;
  }

  .search-palette__results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .search-palette__results-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.35);
  }

  .search-palette__results-count {
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.4);
  }

  .search-palette__list {
    display: flex;
    flex-direction: column;
  }

  /* Item */
  .search-palette__item {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.75rem 1.25rem;
    cursor: pointer;
    transition: all 120ms ease;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  .search-palette__item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .search-palette__item:last-child {
    border-bottom: none;
  }

  .search-palette__item:active {
    background: rgba(255, 255, 255, 0.06);
  }

  .search-palette__item-thumb-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .search-palette__item-thumb {
    width: 72px;
    height: 42px;
    border-radius: 6px;
    background-size: cover;
    background-position: center;
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .search-palette__item-thumb--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.25);
  }

  .search-palette__item-live-badge {
    position: absolute;
    bottom: -4px;
    right: -4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    background: rgba(239, 68, 68, 0.9);
    border-radius: 9999px;
    color: white;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }

  .search-palette__item-content {
    flex: 1;
    min-width: 0;
  }

  .search-palette__item-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 0.25rem;
    letter-spacing: -0.01em;
  }

  .search-palette__item:hover .search-palette__item-title {
    color: white;
  }

  .search-palette__item-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    flex-wrap: wrap;
  }

  .search-palette__item-platform {
    color: rgba(255, 255, 255, 0.45);
    font-weight: 450;
  }

  .search-palette__item-live-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.125rem 0.5rem;
    background: rgba(239, 68, 68, 0.15);
    border-radius: 4px;
    color: #f87171;
    font-weight: 600;
    font-size: 0.6875rem;
  }

  .search-palette__live-dot {
    width: 5px;
    height: 5px;
    border-radius: 9999px;
    background: #f87171;
    animation: pulse-live 1.5s ease-in-out infinite;
  }

  @keyframes pulse-live {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .search-palette__item-clips {
    color: rgba(255, 255, 255, 0.4);
    font-weight: 450;
  }

  .search-palette__item-arrow {
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.2);
    transition: all 150ms ease;
  }

  .search-palette__item:hover .search-palette__item-arrow {
    color: rgba(255, 255, 255, 0.5);
    transform: translateX(2px);
  }

  /* Empty State */
  .search-palette__empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3.5rem 1.5rem;
    text-align: center;
  }

  .search-palette__empty-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    margin-bottom: 1.25rem;
  }

  .search-palette__empty-icon-wrap--subtle {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.05);
  }

  .search-palette__empty-icon {
    width: 26px;
    height: 26px;
    color: rgba(255, 255, 255, 0.3);
  }

  .search-palette__empty-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    margin: 0 0 0.375rem;
    letter-spacing: -0.01em;
  }

  .search-palette__empty-desc {
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.4);
    margin: 0;
    max-width: 280px;
    line-height: 1.5;
  }

  /* ===== Delete Dialog ===== */
  .delete-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .delete-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 480px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .delete-dialog__accent {
    height: 3px;
    flex-shrink: 0;
    background: linear-gradient(90deg, #ef4444, rgba(239, 68, 68, 0.5));
  }

  .delete-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .delete-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .delete-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .delete-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .delete-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    margin-bottom: 0.875rem;
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .delete-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .delete-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .delete-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .delete-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .delete-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .delete-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .delete-dialog__message {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .delete-dialog__text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.6;
  }

  .delete-dialog__text--highlight {
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .delete-dialog__warning {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.75rem 0 0;
    opacity: 0.7;
  }

  .delete-dialog__info-card {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    background-color: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.15);
    border-radius: 10px;
  }

  .delete-dialog__info-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    flex-shrink: 0;
    background-color: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  .delete-dialog__info-content {
    flex: 1;
    min-width: 0;
  }

  .delete-dialog__info-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .delete-dialog__info-text {
    font-size: 0.875rem;
    color: var(--sidebar-text);
    margin: 0;
    line-height: 1.5;
  }

  .delete-dialog__info-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .delete-dialog__info-list li {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
  }

  .delete-dialog__info-list li strong {
    color: var(--sidebar-text);
    font-weight: 600;
  }

  .delete-dialog__segments-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .delete-dialog__segments-title {
    font-size: 0.875rem;
    color: var(--sidebar-text);
    margin: 0;
    line-height: 1.5;
  }

  .delete-dialog__segments-options {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .delete-dialog__segment-option {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .delete-dialog__segment-option:hover {
    background-color: var(--sidebar-active);
    border-color: rgba(6, 182, 212, 0.3);
  }

  .delete-dialog__segment-option--selected {
    background-color: rgba(6, 182, 212, 0.08);
    border-color: rgba(6, 182, 212, 0.3);
  }

  .delete-dialog__radio {
    width: 16px;
    height: 16px;
    margin-top: 0.125rem;
    flex-shrink: 0;
    accent-color: #06b6d4;
    cursor: pointer;
  }

  .delete-dialog__segment-option-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .delete-dialog__segment-option-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .delete-dialog__segment-option-desc {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .delete-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .delete-dialog__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
  }

  .delete-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .delete-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    color: var(--sidebar-text);
  }

  .delete-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .delete-dialog__btn--primary {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
  }

  .delete-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .delete-dialog__spinner {
    animation: delete-dialog-spin 0.8s linear infinite;
  }

  @keyframes delete-dialog-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Modal transitions */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
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
