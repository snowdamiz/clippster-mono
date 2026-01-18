<template>
  <div class="clips-page">
    <PageLayout
      title="Built Clips"
      description="Browse and manage your generated video clips"
      :show-header="true"
      :icon="LayoutGrid"
    >
      <template #actions>
        <div class="clips-header-actions">
          <!-- Search -->
          <div class="clips-header__search">
            <Search class="clips-header__search-icon" />
            <Input
              v-model="searchQuery"
              placeholder="Search clips..."
              class="clips-header__search-input"
              @focus="openSearchPalette"
              readonly
            />
          </div>

          <!-- Status Filter -->
          <CustomDropdown
            v-model="statusFilter"
            :options="statusOptions"
            placeholder="Status"
            class="clips-header__filter"
            trigger-class="clips-header__dropdown-trigger"
          />

          <!-- Aspect Ratio Filter (only in list view, if multiple ratios exist) -->
          <CustomDropdown
            v-if="viewMode === 'list' && aspectRatioOptions.length > 2"
            v-model="aspectRatioFilter"
            :options="aspectRatioOptions"
            placeholder="Ratio"
            class="clips-header__filter"
            trigger-class="clips-header__dropdown-trigger"
          />

          <!-- Project Filter (only in list view) -->
          <CustomDropdown
            v-if="viewMode === 'list'"
            v-model="projectFilter"
            :options="projectOptions"
            placeholder="Project"
            class="clips-header__filter clips-header__filter--wide"
            trigger-class="clips-header__dropdown-trigger"
          />

          <!-- Sort Filter -->
          <CustomDropdown
            v-model="sortBy"
            :options="sortOptions"
            placeholder="Sort By"
            class="clips-header__sort"
            trigger-class="clips-header__dropdown-trigger"
          />

          <!-- View Mode -->
          <div class="clips-header__view-toggle">
            <button
              @click="viewMode = 'folders'"
              class="clips-header__view-btn"
              :class="{ 'clips-header__view-btn--active': viewMode === 'folders' }"
              title="Folder View"
            >
              <Folder class="clips-header__view-icon" />
            </button>
            <button
              @click="viewMode = 'list'"
              class="clips-header__view-btn"
              :class="{ 'clips-header__view-btn--active': viewMode === 'list' }"
              title="List View"
            >
              <List class="clips-header__view-icon" />
            </button>
          </div>

          <!-- Open Folder Button -->
          <button
            @click="openClipsFolder"
            :disabled="!hasAnyClipsWithFiles"
            :title="hasAnyClipsWithFiles ? 'Open clips folder' : 'No clips available'"
            class="clips-header__folder-btn"
          >
            <FolderOpen class="clips-header__folder-icon" />
          </button>
        </div>
      </template>

      <div class="clips__content" :class="{ 'clips__content--empty': !loading && displayableBuilds.length === 0 }">
        <!-- Untranscribed Filter Banner -->
        <div v-if="showOnlyUntranscribed" class="clips__filter-banner">
          <div class="clips__filter-banner-content">
            <FileText class="clips__filter-banner-icon" />
            <span class="clips__filter-banner-text">Showing only clips without transcripts</span>
          </div>
          <button @click="showOnlyUntranscribed = false" class="clips__filter-banner-close">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Page Heading -->
        <div v-if="displayableBuilds.length > 0 || loading" class="clips__heading">
          <h1 class="clips__title">Built Clips</h1>
          <p class="clips__subtitle">Browse and manage your generated video clips</p>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="clips__loading">
          <div class="clips__grid">
            <div v-for="i in 6" :key="`skeleton-${i}`" class="clips-card clips-card--skeleton">
              <div class="clips-card__skeleton-bg"></div>
              <div class="clips-card__bottom">
                <div class="clips-skeleton__card-title"></div>
                <div class="clips-skeleton__card-meta"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Content when not loading -->
        <div v-else-if="displayableBuilds.length > 0" class="clips__main">
          <!-- Selection Bar (shown when items selected) -->
          <Transition name="selection-bar">
            <div v-if="totalSelectedCount > 0" class="clips__selection-bar">
              <div class="clips__selection-info">
                <Check class="clips__selection-icon" />
                <span>{{ totalSelectedCount }} selected</span>
              </div>
              <div class="clips__selection-actions">
                <button @click="clearSelection" class="clips__selection-clear">Clear</button>
                <button @click="confirmBulkDelete" class="clips__selection-delete">
                  <Trash2 class="clips__selection-delete-icon" />
                  Delete Selected
                </button>
              </div>
            </div>
          </Transition>

          <!-- Builds Grid -->
          <div v-if="filteredBuilds.length > 0" class="clips__section">
            <!-- List View - Shows individual builds as cards -->
            <div v-if="viewMode === 'list'">
              <div v-for="group in groupedBuilds" :key="group.dateLabel" class="clips__date-group">
                <!-- Date Header -->
                <h3 class="clips__section-header">{{ group.dateLabel }}</h3>

                <div class="clips__grid">
                  <div
                    v-for="item in group.builds"
                    :key="item.id"
                    class="clips-card-wrapper"
                    :class="{ 'clips-card-wrapper--selected': isBuildSelected(item.id) }"
                  >
                    <!-- Selection Checkbox -->
                    <div
                      class="clips-card__checkbox"
                      :class="{ 'clips-card__checkbox--visible': isBuildSelected(item.id) }"
                      @click.stop="toggleBuildSelection(item.id)"
                    >
                      <div
                        class="clips-card__checkbox-inner"
                        :class="{ 'clips-card__checkbox-inner--checked': isBuildSelected(item.id) }"
                      >
                        <Check v-if="isBuildSelected(item.id)" class="clips-card__checkbox-icon" />
                      </div>
                    </div>

                    <BuildCard
                      :build="item.build"
                      :clip-name="item.clipName"
                      :thumbnail-url="item.thumbnailUrl"
                      :project-name="item.projectName"
                      :file-path="item.filePath"
                      :display-aspect-ratio="item.aspectRatio ?? undefined"
                      :show-build-number="item.hasMultipleBuilds"
                      @play="
                        (build, filePath) => playBuild(build, filePath || item.filePath, item.clipName, item.projectId)
                      "
                      @save="(build, filePath) => saveBuild(build, filePath || item.filePath)"
                      @delete="confirmDeleteBuild"
                      @openProject="(build) => openProjectForClip(build, item.clip)"
                      @publish="
                        (build, filePath) => initiatePublish(build, filePath || item.filePath, item.thumbnailUrl)
                      "
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Folder View -->
            <div v-else-if="viewMode === 'folders'">
              <div v-for="dateGroup in groupedFolderProjects" :key="dateGroup.dateLabel" class="clips__date-group">
                <h3 class="clips__section-header">{{ dateGroup.dateLabel }}</h3>

                <div class="clips__grid">
                  <div
                    v-for="group in dateGroup.folders"
                    :key="group.id"
                    class="clips-card"
                    :class="{ 'clips-card--selected': isFolderSelected(group.id) }"
                    @click="openFolder(group)"
                  >
                    <!-- Selection Checkbox -->
                    <div
                      class="clips-card__checkbox"
                      :class="{ 'clips-card__checkbox--visible': isFolderSelected(group.id) }"
                      @click.stop="toggleFolderSelection(group.id)"
                    >
                      <div
                        class="clips-card__checkbox-inner"
                        :class="{ 'clips-card__checkbox-inner--checked': isFolderSelected(group.id) }"
                      >
                        <Check v-if="isFolderSelected(group.id)" class="clips-card__checkbox-icon" />
                      </div>
                    </div>

                    <!-- Badges Group -->
                    <div class="clips-card__badges-group">
                      <!-- Count Badge -->
                      <div class="clips-card__badge clips-card__badge--count">
                        <FolderOpen class="clips-card__badge-icon" />
                        <span>{{ getFolderBuildsCount(group.clips) }} Clips</span>
                      </div>

                      <!-- Untranscribed Badge -->
                      <div
                        v-if="hasUntranscribedClips(group.clips)"
                        class="clips-card__badge clips-card__badge--untranscribed"
                        title="Contains clips without transcripts"
                      >
                        <FileText class="clips-card__badge-icon-sm" />
                      </div>
                    </div>

                    <!-- Thumbnail -->
                    <div
                      v-if="group.clips.length > 0 && getThumbnailUrl(group.clips[0])"
                      class="clips-card__thumbnail"
                      :style="{ backgroundImage: `url(${getThumbnailUrl(group.clips[0])})` }"
                    >
                      <div class="clips-card__vignette"></div>
                    </div>
                    <div v-else class="clips-card__thumbnail clips-card__thumbnail--empty">
                      <div class="clips-card__thumbnail-gradient"></div>
                      <div class="clips-card__empty-icon">
                        <Folder class="clips-card__folder-icon" />
                      </div>
                    </div>

                    <!-- Bottom Info -->
                    <div class="clips-card__bottom">
                      <h3 class="clips-card__title" :title="group.name">{{ group.name }}</h3>
                      <div class="clips-card__meta">
                        <span class="clips-card__meta-text">Updated {{ getRelativeTime(group.updatedAt) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Pagination Footer -->
          <PaginationFooter
            v-if="filteredBuilds.length > 0 && viewMode === 'list'"
            :current-page="currentPage"
            :total-pages="totalPages"
            :total-items="filteredBuilds.length"
            item-label="build"
            @go-to-page="goToPage"
            @previous="previousPage"
            @next="nextPage"
          />

          <!-- No Results State -->
          <div v-if="filteredBuilds.length === 0" class="clips__no-results">
            <div class="clips__no-results-icon-wrapper">
              <Search class="clips__no-results-icon" />
            </div>
            <h3 class="clips__no-results-title">No builds found</h3>
            <p class="clips__no-results-description">
              We couldn't find any builds matching your search filters. Try adjusting your search query or filters.
            </p>
            <button
              @click="
                searchQuery = '';
                statusFilter = 'all';
                projectFilter = 'all';
                aspectRatioFilter = 'all';
              "
              class="clips__no-results-btn"
            >
              Clear filters
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="clips__empty">
          <div class="clips__empty-icon-wrapper">
            <Video class="clips__empty-icon" />
          </div>
          <h3 class="clips__empty-title">No builds yet</h3>
          <p class="clips__empty-description">Build your first video clip from a project to see it here</p>
        </div>
      </div>
    </PageLayout>
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
                  <template v-if="selectedFolderDialogBuilds.size > 0">
                    <button
                      @click="confirmBulkDeleteFolderDialogBuilds"
                      class="folder-dialog__selection-delete"
                    >
                      <Trash2 :size="14" />
                      Delete ({{ selectedFolderDialogBuilds.size }})
                    </button>
                    <span class="folder-dialog__selection-count">{{ selectedFolderDialogBuilds.size }} selected</span>
                    <button @click="clearFolderDialogBuildSelection" class="folder-dialog__selection-clear">
                      Clear
                    </button>
                  </template>

                  <!-- Normal header (hidden when items selected) -->
                  <template v-else>
                    <div class="folder-dialog__header-icon">
                      <FolderOpen :size="16" />
                    </div>
                    <h2 class="folder-dialog__title" :title="folderProject.name">{{ folderProject.name }}</h2>
                    <span class="folder-dialog__file-count">
                      ({{ folderBuilds.length }} file{{ folderBuilds.length !== 1 ? 's' : '' }})
                    </span>
                  </template>
                </div>

                <div class="folder-dialog__header-right">
                  <!-- Aspect Ratio Filter (only show if multiple ratios available) -->
                  <div v-if="folderAspectRatioOptions.length > 2" class="folder-dialog__aspect-filter">
                    <button
                      v-for="option in folderAspectRatioOptions"
                      :key="option.value"
                      @click="folderAspectRatioFilter = option.value"
                      class="folder-dialog__aspect-btn"
                      :class="{ 'folder-dialog__aspect-btn--active': folderAspectRatioFilter === option.value }"
                    >
                      {{ option.value === 'all' ? 'All' : option.label }}
                    </button>
                  </div>

                  <button class="folder-dialog__close" @click="showFolderDialog = false" title="Close">
                    <X :size="18" />
                  </button>
                </div>
              </div>

              <!-- Content -->
              <div class="folder-dialog__content">
                <div v-for="group in groupedFolderBuilds" :key="group.dateLabel" class="folder-dialog__date-group">
                  <!-- Date Header -->
                  <h3 class="folder-dialog__date-header">
                    {{ group.dateLabel }}
                  </h3>

                  <div class="folder-dialog__builds-list">
                    <div
                      v-for="item in group.builds"
                      :key="item.id"
                      class="folder-dialog__build-row"
                      :class="{ 'folder-dialog__build-row--selected': isFolderDialogBuildSelected(item.id) }"
                    >
                      <!-- Selection Checkbox -->
                      <div
                        class="folder-dialog__checkbox"
                        @click.stop="toggleFolderDialogBuildSelection(item.id)"
                      >
                        <div
                          class="folder-dialog__checkbox-box"
                          :class="{ 'folder-dialog__checkbox-box--checked': isFolderDialogBuildSelected(item.id) }"
                        >
                          <Check v-if="isFolderDialogBuildSelected(item.id)" :size="14" />
                        </div>
                      </div>

                      <!-- Thumbnail -->
                      <div 
                        class="folder-dialog__build-thumb"
                        @click="playBuild(item.build, item.filePath, item.clipName, item.projectId)"
                      >
                        <img
                          v-if="item.thumbnailUrl"
                          :src="item.thumbnailUrl"
                          :alt="item.clipName"
                          class="folder-dialog__build-thumb-img"
                        />
                        <div v-else class="folder-dialog__build-thumb-placeholder">
                          <Video :size="24" />
                        </div>

                        <!-- Building Overlay -->
                        <div
                          v-if="item.build.status === 'building'"
                          class="folder-dialog__build-thumb-overlay-building"
                        >
                          <Loader2 :size="20" class="folder-dialog__spin" />
                        </div>
                      </div>

                      <!-- Content -->
                      <div 
                        class="folder-dialog__build-content"
                        @click="playBuild(item.build, item.filePath, item.clipName, item.projectId)"
                      >
                        <!-- Header: Title -->
                        <div class="folder-dialog__build-header">
                          <h3 class="folder-dialog__build-name">{{ item.clipName }}</h3>
                        </div>

                        <!-- Badges Row -->
                        <div class="folder-dialog__build-badges">
                          <!-- Duration Badge -->
                          <div v-if="item.build.duration" class="folder-dialog__build-badge">
                            <Clock :size="11" />
                            {{ formatDuration(item.build.duration) }}
                          </div>

                          <!-- Building Status Badge -->
                          <div v-if="item.build.status === 'building'" class="folder-dialog__build-badge folder-dialog__build-badge--building">
                            <Loader2 :size="11" class="folder-dialog__spin" />
                            Building...
                          </div>

                          <!-- Aspect Ratio Badge -->
                          <div v-if="item.aspectRatio" class="folder-dialog__build-badge">
                            {{ item.aspectRatio }}
                          </div>

                          <!-- Build Number Badge -->
                          <div v-if="item.hasMultipleBuilds" class="folder-dialog__build-badge folder-dialog__build-badge--number">
                            #{{ item.build.build_number }}
                          </div>

                          <!-- Sibling count badge -->
                          <div
                            v-if="folderAspectRatioFilter !== 'all' && getBuildSiblingCount(item.build.id) > 1"
                            class="folder-dialog__build-badge folder-dialog__build-badge--sibling"
                            :title="`This build has ${getBuildSiblingCount(item.build.id)} aspect ratio variants`"
                          >
                            <Ratio class="w-2.5 h-2.5" />
                            {{ getBuildSiblingCount(item.build.id) }}
                          </div>
                        </div>

                        <!-- Timestamp -->
                        <div class="folder-dialog__build-meta">
                          {{ getRelativeTime(item.build.created_at) }}
                        </div>
                      </div>

                      <!-- Actions -->
                      <div class="folder-dialog__build-actions">
                        <!-- Play Button -->
                        <button
                          class="folder-dialog__build-action-btn"
                          title="Play"
                          @click.stop="playBuild(item.build, item.filePath, item.clipName, item.projectId)"
                        >
                          <Play :size="16" />
                        </button>
                        
                        <!-- Download Button -->
                        <button
                          class="folder-dialog__build-action-btn"
                          title="Download"
                          @click.stop="saveBuild(item.build, item.filePath)"
                        >
                          <Download :size="16" />
                        </button>

                        <!-- More Actions Menu -->
                        <div class="relative" data-action-menu>
                          <button
                            :ref="(el) => setFolderDialogActionMenuButtonRef(el, item.id)"
                            class="folder-dialog__build-action-btn"
                            :class="{ 'folder-dialog__build-action-btn--active': folderDialogActionMenuId === item.id }"
                            title="More actions"
                            @click.stop="toggleFolderDialogActionMenu(item.id)"
                          >
                            <MoreVertical :size="16" />
                          </button>

                          <!-- Action Menu Dropdown - Teleported to body -->
                          <Teleport to="body">
                            <div
                              v-if="folderDialogActionMenuId === item.id"
                              class="folder-dialog-dropdown fixed z-[9999] w-[200px] rounded-lg shadow-2xl py-1.5 overflow-hidden"
                              :style="getFolderDialogActionMenuPosition(item.id)"
                              data-action-menu
                              @click.stop
                            >
                              <!-- Open in Project Workspace -->
                              <button
                                class="folder-dialog-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  openProjectForClip(item.build, item.clip);
                                  closeFolderDialogActionMenu();
                                "
                              >
                                <ExternalLink class="h-4 w-4" style="color: var(--sidebar-text-muted)" />
                                <span>Open in Project</span>
                              </button>

                              <!-- Open in Video Editor -->
                              <button
                                v-if="item.videoEditorProjectId"
                                class="folder-dialog-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  openVideoEditorProject(item.videoEditorProjectId);
                                  closeFolderDialogActionMenu();
                                "
                              >
                                <Film class="h-4 w-4" style="color: var(--sidebar-text-muted)" />
                                <span>Open in Video Editor</span>
                              </button>

                              <!-- Publish to Instagram -->
                              <button
                                class="folder-dialog-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  initiatePublish(item.build, item.filePath, item.thumbnailUrl);
                                  closeFolderDialogActionMenu();
                                "
                              >
                                <Instagram class="h-4 w-4" style="color: var(--sidebar-text-muted)" />
                                <span>Publish to Instagram</span>
                              </button>

                              <!-- Divider -->
                              <div class="folder-dialog-dropdown-divider h-px my-1 mx-2"></div>

                              <!-- Delete -->
                              <button
                                class="folder-dialog-dropdown-item folder-dialog-dropdown-item--danger w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  confirmDeleteBuild(item.build);
                                  closeFolderDialogActionMenu();
                                "
                              >
                                <Trash2 class="h-4 w-4" />
                                <span>Delete Build</span>
                              </button>
                            </div>
                          </Teleport>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer with Pagination -->
              <div v-if="folderTotalPages > 1" class="folder-dialog__footer">
                <PaginationFooter
                  :current-page="folderCurrentPage"
                  :total-pages="folderTotalPages"
                  :total-items="folderBuilds.length"
                  item-label="build"
                  mode="static"
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

    <!-- Video Player Dialog -->
    <VideoPlayerDialog
      :video="clipToPlay"
      :show-video-player="showVideoPlayer"
      :watermark-settings="playerWatermarkSettings"
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
      title="Delete Build"
      :message="'Are you sure you want to delete build'"
      :item-name="buildToDelete ? `#${buildToDelete.build_number}` : 'this build'"
      suffix="? The video file will be permanently removed."
      confirm-text="Delete Build"
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
      :title="`Delete ${selectedFolderDialogBuilds.size} Build${selectedFolderDialogBuilds.size !== 1 ? 's' : ''}`"
      :message="`Are you sure you want to delete`"
      :item-name="`${selectedFolderDialogBuilds.size} build${selectedFolderDialogBuilds.size !== 1 ? 's' : ''}`"
      suffix="? The video files will be permanently removed."
      :confirm-text="`Delete ${selectedFolderDialogBuilds.size} Build${selectedFolderDialogBuilds.size !== 1 ? 's' : ''}`"
      variant="destructive"
      @close="handleBulkDeleteFolderDialogBuildsDialogClose"
      @confirm="bulkDeleteFolderDialogBuildsConfirmed"
    />

    <!-- Organization Select Dialog for Publishing -->
    <OrganizationSelectDialog
      :open="showOrgSelectDialog"
      @close="showOrgSelectDialog = false"
      @select="onOrganizationSelected"
    />

    <!-- Publish to Instagram Dialog -->
    <InstagramPublishDialog
      :open="showPublishDialog"
      :organization-id="selectedOrganization?.id"
      :organization-name="selectedOrganization?.name"
      :media-url="publishMediaUrl"
      :thumbnail-url="publishThumbnailUrl"
      :media-type="'video'"
      :is-admin="isAdminOfSelectedOrg"
      :creator-profiles="publishCreatorProfiles"
      @close="onPublishDialogClose"
      @published="onPublished"
    />

    <!-- Uploading Media Overlay -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="isUploadingMedia"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
        >
          <div class="text-center">
            <div
              class="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            ></div>
            <p class="text-white text-lg font-medium">Uploading video...</p>
            <p class="text-zinc-400 text-sm mt-1">Please wait while we prepare your clip</p>
          </div>
        </div>
      </Transition>
    </Teleport>

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
        <!-- Untranscribed Info Banner (subtle, when searching) -->
        <div v-if="untranscribedClipsCount > 0 && paletteSearchQuery" class="search-palette__info-banner">
          <AlertCircle class="search-palette__info-icon" />
          <span class="search-palette__info-text">
            {{ untranscribedClipsCount }} clip{{ untranscribedClipsCount !== 1 ? 's' : '' }} without transcripts won't
            appear in transcript search
          </span>
          <button @click="showUntranscribedClips" class="search-palette__info-link">View →</button>
        </div>

        <!-- Search Results -->
        <div v-if="paletteSearchQuery && paletteSearchResults.length > 0" class="search-palette__results">
          <div class="search-palette__results-header">
            <span class="search-palette__results-label">Results</span>
            <span class="search-palette__results-count">{{ paletteSearchResults.length }} found</span>
          </div>
          <div class="search-palette__list">
            <div
              v-for="item in paletteSearchResults"
              :key="item.id"
              class="search-palette__item"
              @click="selectSearchResult(item)"
            >
              <div class="search-palette__item-thumb-wrap">
                <div
                  v-if="item.thumbnailUrl"
                  class="search-palette__item-thumb"
                  :style="{ backgroundImage: `url(${item.thumbnailUrl})` }"
                ></div>
                <div v-else class="search-palette__item-thumb search-palette__item-thumb--empty">
                  <Video class="w-5 h-5" />
                </div>
                <div v-if="!item.isTranscribed" class="search-palette__item-no-transcript" title="No transcript">
                  <FileText class="w-3 h-3" />
                </div>
              </div>

              <div class="search-palette__item-content">
                <div class="search-palette__item-title">{{ item.clipName }}</div>
                <div class="search-palette__item-meta">
                  <span v-if="item.projectName" class="search-palette__item-project">{{ item.projectName }}</span>
                  <span v-if="item.matchType === 'transcript'" class="search-palette__item-match-tag">
                    <span class="search-palette__match-dot"></span>
                    Transcript match
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

        <!-- No Search Results -->
        <div v-else-if="paletteSearchQuery && paletteSearchResults.length === 0" class="search-palette__empty-state">
          <div class="search-palette__empty-icon-wrap">
            <Search class="search-palette__empty-icon" />
          </div>
          <h3 class="search-palette__empty-title">No clips found</h3>
          <p class="search-palette__empty-desc">Try a different search term or check untranscribed clips</p>
        </div>

        <!-- Initial State -->
        <div v-else class="search-palette__empty-state">
          <div class="search-palette__empty-icon-wrap search-palette__empty-icon-wrap--subtle">
            <Search class="search-palette__empty-icon" />
          </div>
          <h3 class="search-palette__empty-title">Search your clips</h3>
          <p class="search-palette__empty-desc">Find clips by name, project, or transcript content</p>
        </div>
      </template>

      <!-- Untranscribed Mode -->
      <template v-else-if="paletteViewMode === 'untranscribed'">
        <!-- Untranscribed clips list -->
        <div v-if="paletteUntranscribedClips.length > 0" class="search-palette__results">
          <div class="search-palette__results-header">
            <span class="search-palette__results-label">Clips without transcripts</span>
            <span class="search-palette__results-count">
              {{ paletteUntranscribedClips.length }} clip{{ paletteUntranscribedClips.length !== 1 ? 's' : '' }}
            </span>
          </div>
          <div class="search-palette__list">
            <div
              v-for="item in paletteUntranscribedClips"
              :key="item.id"
              class="search-palette__item"
              @click="selectSearchResult(item)"
            >
              <div class="search-palette__item-thumb-wrap">
                <div
                  v-if="item.thumbnailUrl"
                  class="search-palette__item-thumb"
                  :style="{ backgroundImage: `url(${item.thumbnailUrl})` }"
                ></div>
                <div v-else class="search-palette__item-thumb search-palette__item-thumb--empty">
                  <Video class="w-5 h-5" />
                </div>
                <div class="search-palette__item-no-transcript" title="No transcript">
                  <FileText class="w-3 h-3" />
                </div>
              </div>

              <div class="search-palette__item-content">
                <div class="search-palette__item-title">{{ item.clipName }}</div>
                <div class="search-palette__item-meta">
                  <span v-if="item.projectName" class="search-palette__item-project">{{ item.projectName }}</span>
                  <span class="search-palette__item-untranscribed-tag">Needs transcript</span>
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

        <!-- No Untranscribed Clips -->
        <div v-else class="search-palette__empty-state">
          <div class="search-palette__empty-icon-wrap search-palette__empty-icon-wrap--success">
            <Check class="search-palette__empty-icon" />
          </div>
          <h3 class="search-palette__empty-title">All clips transcribed!</h3>
          <p class="search-palette__empty-desc">All your clips have transcripts and can be searched</p>
        </div>
      </template>

      <!-- Footer for untranscribed mode -->
      <template #footer v-if="paletteViewMode === 'untranscribed' && paletteUntranscribedClips.length > 0">
        <button @click="applyUntranscribedFilter" class="search-palette__apply-btn">
          <FileText class="w-4 h-4" />
          Show only untranscribed in main view
        </button>
      </template>
    </SearchPalette>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed, watch, Transition } from 'vue';
  import { invoke } from '@tauri-apps/api/core';
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
    Instagram,
    Clock,
    Loader2,
    ExternalLink,
    Film,
    MoreVertical,
  } from 'lucide-vue-next';
  import {
    getAllClipsWithBuilds,
    deleteClipBuild,
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
  import PageLayout from '@/components/PageLayout.vue';
  import VideoPlayerDialog from '@/components/VideoPlayerDialog.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import BuildCard from '@/components/BuildCard.vue';
  import ProjectWorkspaceDialog from '@/components/ProjectWorkspaceDialog.vue';
  import OrganizationSelectDialog from '@/components/OrganizationSelectDialog.vue';
  import InstagramPublishDialog from '@/components/InstagramPublishDialog.vue';
  import { Input } from '@/components/ui/input';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import SearchPalette, { type SearchPaletteTab } from '@/components/SearchPalette.vue';
  import {
    uploadMediaForPost,
    getMyAssignedCreatorProfiles,
    type AssignedCreatorProfile,
  } from '@/services/socialAccountsApi';

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
  const showVideoPlayer = ref(false);
  const clipToPlay = ref<RawVideo | null>(null);
  const playerWatermarkSettings = ref<WatermarkSettings | null>(null);
  const thumbnailCache = ref<Map<string, string>>(new Map());
  const buildThumbnailCache = ref<Map<string, string>>(new Map());
  const rawVideoCache = ref<Map<string, (RawVideo & { thumbnail_path: string | null })[]>>(new Map());
  const projectCache = ref<Map<string, Project>>(new Map());
  const { getRelativeTime, formatDuration } = useFormatters();
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  // Build deletion state
  const showDeleteBuildDialog = ref(false);
  const buildToDelete = ref<ClipBuild | null>(null);

  // View state
  const viewMode = ref<'folders' | 'list'>('folders');
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

  // Instagram publish state
  const authStore = useAuthStore();
  const router = useRouter();
  const showOrgSelectDialog = ref(false);
  const showPublishDialog = ref(false);
  const publishingBuild = ref<{ build: ClipBuild; filePath: string; thumbnailUrl: string | null } | null>(null);
  const selectedOrganization = ref<{ id: string | number; name: string; role: string } | null>(null);
  const publishMediaUrl = ref('');
  const publishThumbnailUrl = ref('');
  const publishCreatorProfiles = ref<{ id: number; name: string }[]>([]);
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

  // Folder dialog action menu dropdown state
  const folderDialogActionMenuId = ref<string | null>(null);
  const folderDialogActionMenuButtonRefs = ref<Map<string, HTMLElement>>(new Map());

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
    { label: 'All Status', value: 'all' },
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

  // Get unique aspect ratios available across all builds
  const aspectRatioOptions = computed(() => {
    const ratios = new Set<string>();
    for (const build of displayableBuilds.value) {
      if (build.aspectRatio) {
        ratios.add(build.aspectRatio);
      }
    }
    const options = [{ label: 'All Ratios', value: 'all' }];
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

      // If clip has builds, create displayable items for each output file
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

              // Look up thumbnail by file path first (each aspect ratio has its own thumbnail)
              // Then fall back to build's thumbnail_path, then to clip thumbnail
              const fileSpecificThumbnail = buildThumbnailCache.value.get(filePath);
              const buildThumbnail = buildThumbnailCache.value.get(build.id);
              const thumbnailUrl = fileSpecificThumbnail || buildThumbnail || clipThumbnailUrl;

              builds.push({
                // Use build ID + index for unique key when multiple files per build
                id: outputPaths.length > 1 ? `${build.id}-${i}` : build.id,
                build,
                clip,
                clipName,
                projectName,
                projectId: clip.project_id,
                thumbnailUrl,
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

              // Look up thumbnail by file path first (each aspect ratio has its own thumbnail)
              // Then fall back to build's thumbnail_path, then to clip thumbnail
              const fileSpecificThumbnail = buildThumbnailCache.value.get(filePath);
              const buildThumbnail = buildThumbnailCache.value.get(build.id);
              const thumbnailUrl = fileSpecificThumbnail || buildThumbnail || clipThumbnailUrl;

              builds.push({
                id: outputPaths.length > 1 ? `${build.id}-${i}` : build.id,
                build,
                clip,
                clipName,
                projectName: folderProject.value!.name,
                projectId: clip.project_id,
                thumbnailUrl,
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
    const options = [{ label: 'All Ratios', value: 'all' }];
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

  // Computed class for folder dialog size (list layout uses consistent width)
  const folderDialogSizeClass = computed(() => {
    // List layout works better with a consistent width
    return 'folder-dialog--list';
  });

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

  // Folder dialog action menu functions
  function setFolderDialogActionMenuButtonRef(el: any, buildId: string) {
    if (el && el instanceof HTMLElement) {
      folderDialogActionMenuButtonRefs.value.set(buildId, el);
    } else {
      folderDialogActionMenuButtonRefs.value.delete(buildId);
    }
  }

  function toggleFolderDialogActionMenu(buildId: string) {
    folderDialogActionMenuId.value = folderDialogActionMenuId.value === buildId ? null : buildId;
  }

  function closeFolderDialogActionMenu() {
    folderDialogActionMenuId.value = null;
  }

  function getFolderDialogActionMenuPosition(buildId: string): Record<string, string> {
    const button = folderDialogActionMenuButtonRefs.value.get(buildId);
    if (!button) {
      return { top: '0px', left: '0px' };
    }

    const rect = button.getBoundingClientRect();
    const menuWidth = 200;
    const menuMaxHeight = 280;
    const padding = 8;

    // Align to right edge of button
    let left = rect.right - menuWidth;

    // Ensure it doesn't go off the left edge
    if (left < padding) {
      left = padding;
    }

    // Ensure it doesn't go off the right edge
    const viewportWidth = window.innerWidth;
    if (left + menuWidth > viewportWidth - padding) {
      left = viewportWidth - menuWidth - padding;
    }

    // Position below button
    let top = rect.bottom + 4;
    const viewportHeight = window.innerHeight;

    // Flip above if not enough space below
    if (top + menuMaxHeight > viewportHeight - padding) {
      top = rect.top - menuMaxHeight - 4;
      // If still doesn't fit, position at top of viewport
      if (top < padding) {
        top = padding;
      }
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
    };
  }

  // Close folder dialog action menu when clicking outside
  function handleFolderDialogClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-action-menu]')) {
      if (folderDialogActionMenuId.value !== null) {
        folderDialogActionMenuId.value = null;
      }
    }
  }

  // Count total output files in a project folder (counts each aspect ratio variant separately)
  function getFolderBuildsCount(clips: ClipWithBuilds[]): number {
    let count = 0;
    for (const clip of clips) {
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
      closeFolderDialogActionMenu();
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

        await deleteClipBuild(buildItem.build.id);
        try {
          await invoke('delete_file', { path: buildItem.build.file_path });
        } catch (fileError) {
          console.warn('Could not delete build file:', fileError);
        }
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

      // Load which clips have transcripts (for untranscribed detection)
      await loadTranscribedClipIds();

      // Load thumbnails, project info, and raw videos for all clips
      for (const clip of clips.value) {
        await loadClipThumbnail(clip);

        // Load project info if clip has a project
        if (clip.project_id) {
          await getProjectInfo(clip.project_id);
          // Load raw videos for this project to use as fallback thumbnails
          await loadRawVideosForProject(clip.project_id);
        }

        // Load build thumbnails for this clip - load for each output file
        if (clip.builds && clip.builds.length > 0) {
          for (const build of clip.builds) {
            if (build.status === 'completed') {
              // Load thumbnails for each output file (each aspect ratio has its own thumbnail)
              const outputPaths = getOutputPathsFromBuild(build);
              for (const outputPath of outputPaths) {
                await loadThumbnailForOutputFile(outputPath);
              }

              // Also load legacy thumbnail_path if available
              if (build.thumbnail_path) {
                await loadBuildThumbnail(build);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load clips:', error);
    } finally {
      loading.value = false;
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
            thumbnailCache.value.set(clip.id, dataUrl);
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
    if (buildThumbnailCache.value.has(filePath)) {
      return;
    }

    try {
      // Derive the expected thumbnail path
      const thumbnailPath = await getThumbnailPathForVideoFile(filePath);
      if (!thumbnailPath) return;

      // Check if file exists
      const fileExists = await invoke<boolean>('check_file_exists', {
        path: thumbnailPath,
      });

      if (fileExists) {
        const dataUrl = await invoke<string>('read_file_as_data_url', {
          filePath: thumbnailPath,
        });
        buildThumbnailCache.value.set(filePath, dataUrl);
      }
    } catch (error) {
      console.warn(`Failed to load thumbnail for output file ${filePath}:`, error);
    }
  }

  // Legacy function - load a build's thumbnail from its thumbnail_path field
  async function loadBuildThumbnail(build: ClipBuild): Promise<void> {
    // Skip if no thumbnail path or already cached
    if (!build.thumbnail_path || buildThumbnailCache.value.has(build.id)) {
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
        buildThumbnailCache.value.set(build.id, dataUrl);
      }
    } catch (error) {
      console.warn(`Failed to load thumbnail for build ${build.id}:`, error);
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
    buildToDelete.value = build;
    showDeleteBuildDialog.value = true;
  }

  function handleDeleteBuildDialogClose() {
    showDeleteBuildDialog.value = false;
    buildToDelete.value = null;
  }

  async function deleteBuildConfirmed() {
    if (!buildToDelete.value) return;

    try {
      // Delete the build record from database
      await deleteClipBuild(buildToDelete.value.id);

      // Try to delete the actual file
      try {
        await invoke('delete_file', { path: buildToDelete.value.file_path });
      } catch (fileError) {
        console.warn('Could not delete build file:', fileError);
        // Don't fail the whole operation if file deletion fails
      }

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
      return `Delete ${count} Project${count !== 1 ? 's' : ''}`;
    }
    const count = totalSelectedCount.value;
    return `Delete ${count} Build${count !== 1 ? 's' : ''}`;
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
      return 'Delete All Builds';
    }
    const count = totalSelectedCount.value;
    return `Delete ${count} Build${count !== 1 ? 's' : ''}`;
  });

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

          await deleteClipBuild(buildItem.build.id);
          try {
            await invoke('delete_file', { path: buildItem.build.file_path });
          } catch (fileError) {
            console.warn('Could not delete build file:', fileError);
          }
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
  // Instagram Publishing Functions
  // ============================================================================

  /**
   * Initiate the publish flow. First show org selection dialog.
   */
  function initiatePublish(build: ClipBuild, filePath: string, thumbnailUrl: string | null) {
    publishingBuild.value = { build, filePath, thumbnailUrl };
    showOrgSelectDialog.value = true;
  }

  /**
   * Helper to convert data URL to File
   */
  function dataUrlToFile(dataUrl: string, fileName: string): File {
    const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid data URL format');
    }
    const mimeType = base64Match[1];
    const base64Data = base64Match[2];

    // Decode base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new File([bytes], fileName, { type: mimeType });
  }

  /**
   * Handle organization selection from the dialog
   */
  async function onOrganizationSelected(org: { id: string | number; name: string; role: string }) {
    selectedOrganization.value = org;
    showOrgSelectDialog.value = false;

    if (!publishingBuild.value) return;

    // Show loading state
    isUploadingMedia.value = true;

    try {
      // 1. Read the video file from disk as data URL
      const { filePath, thumbnailUrl } = publishingBuild.value;
      const videoDataUrl = await invoke<string>('read_file_as_data_url', { filePath });
      const fileName = filePath.split(/[/\\]/).pop() || 'video.mp4';
      const videoFile = dataUrlToFile(videoDataUrl, fileName);

      // 2. Optionally read thumbnail
      let thumbnailFile: File | undefined;
      if (thumbnailUrl) {
        try {
          // Try to load thumbnail from local path
          const thumbPath = thumbnailUrl.startsWith('file://') ? thumbnailUrl.replace('file://', '') : thumbnailUrl;

          // Check if it's a local path (not a data URL or http)
          if (!thumbPath.startsWith('data:') && !thumbPath.startsWith('http')) {
            const thumbDataUrl = await invoke<string>('read_file_as_data_url', { filePath: thumbPath });
            thumbnailFile = dataUrlToFile(thumbDataUrl, 'thumbnail.jpg');
          }
        } catch (thumbError) {
          console.warn('Could not read thumbnail:', thumbError);
        }
      }

      // 3. Upload to R2 storage
      const uploadResult = await uploadMediaForPost(org.id, videoFile, thumbnailFile);

      if (!uploadResult.success || !uploadResult.media_url) {
        throw new Error(uploadResult.error || 'Failed to upload media');
      }

      publishMediaUrl.value = uploadResult.media_url;
      publishThumbnailUrl.value = uploadResult.thumbnail_url || thumbnailUrl || '';

      // 4. Load creator profiles for this user
      const profilesResult = await getMyAssignedCreatorProfiles();
      if (profilesResult.success) {
        // Filter to only profiles from the selected organization
        publishCreatorProfiles.value = profilesResult.profiles
          .filter((p) => String(p.organization_id) === String(org.id))
          .map((p) => ({ id: p.id, name: p.name }));
      } else {
        publishCreatorProfiles.value = [];
      }

      // 5. Open the publish dialog
      showPublishDialog.value = true;
    } catch (error) {
      console.error('Failed to prepare for publishing:', error);
      showErrorToast('Upload Failed', error instanceof Error ? error.message : 'Failed to upload video');
    } finally {
      isUploadingMedia.value = false;
    }
  }

  /**
   * Handle publish dialog close
   */
  function onPublishDialogClose() {
    showPublishDialog.value = false;
    publishingBuild.value = null;
    publishMediaUrl.value = '';
    publishThumbnailUrl.value = '';
    publishCreatorProfiles.value = [];
  }

  /**
   * Handle successful publish
   */
  function onPublished(_post: unknown) {
    showSuccessToast('Published!', 'Your clip is being published to Instagram.');
    onPublishDialogClose();
  }

  /**
   * Computed: Check if current user is admin of selected org
   */
  const isAdminOfSelectedOrg = computed(() => {
    if (!selectedOrganization.value) return false;
    return selectedOrganization.value.role === 'admin' || selectedOrganization.value.role === 'owner';
  });

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
    document.addEventListener('click', handleFolderDialogClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleFolderDialogClickOutside);
  });
</script>

<style scoped>
  /* Root wrapper to ensure single root element for Transition */
  .clips-page {
    position: relative;
    width: 100%;
    min-height: 100%;
  }

  /* ===== Content Container ===== */
  .clips__content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    width: 100%;
    flex: 1;
  }

  .clips__content--empty {
    justify-content: center;
    align-items: center;
  }

  .clips__main {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .clips__loading {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* ===== Filter Banner ===== */
  .clips__filter-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1.25rem;
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.12) 0%, rgba(251, 191, 36, 0.06) 100%);
    border: 1px solid rgba(251, 191, 36, 0.2);
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  .clips__filter-banner-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .clips__filter-banner-icon {
    width: 18px;
    height: 18px;
    color: rgb(251, 191, 36);
    flex-shrink: 0;
  }

  .clips__filter-banner-text {
    font-size: 0.875rem;
    color: rgb(251, 191, 36);
    font-weight: 600;
  }

  .clips__filter-banner-close {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: rgb(251, 191, 36);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .clips__filter-banner-close:hover {
    background-color: rgba(251, 191, 36, 0.2);
  }

  /* ===== Page Heading ===== */
  .clips__heading {
    margin-bottom: 0.5rem;
  }

  .clips__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .clips__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Header Actions ===== */
  .clips-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .clips-header__search {
    position: relative;
    width: 180px;
  }

  .clips-header__search-icon {
    position: absolute;
    left: 0.625rem;
    top: 50%;
    transform: translateY(-50%);
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    pointer-events: none;
  }

  .clips-header__search-input {
    width: 100%;
    padding-left: 2rem;
    height: 32px;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.75rem;
  }

  .clips-header__search-input:focus {
    border-color: var(--sidebar-accent);
    outline: none;
  }

  .clips-header__filter {
    width: 110px;
    flex-shrink: 0;
  }

  .clips-header__filter--wide {
    width: 140px;
  }

  .clips-header__sort {
    width: 140px;
    flex-shrink: 0;
  }

  /* Dropdown trigger button styling */
  :deep(.clips-header__dropdown-trigger) {
    height: 32px !important;
    padding: 0 0.625rem !important;
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 6px !important;
    font-size: 0.75rem !important;
    color: var(--sidebar-text) !important;
    transition: all 150ms ease !important;
  }

  :deep(.clips-header__dropdown-trigger:hover) {
    border-color: rgba(255, 255, 255, 0.15) !important;
  }

  :deep(.clips-header__dropdown-trigger span) {
    color: var(--sidebar-text) !important;
  }

  :deep(.clips-header__dropdown-trigger svg) {
    width: 12px !important;
    height: 12px !important;
    color: var(--sidebar-text-muted) !important;
  }

  .clips-header__view-toggle {
    display: flex;
    align-items: center;
    padding: 0.125rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    transition: opacity 150ms ease;
  }

  .clips-header__view-btn {
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

  .clips-header__view-btn:hover:not(:disabled) {
    color: var(--sidebar-text);
  }

  .clips-header__view-btn--active {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .clips-header__view-icon {
    width: 14px;
    height: 14px;
  }

  .clips-header__folder-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .clips-header__folder-btn:hover:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.15);
    color: var(--sidebar-text);
  }

  .clips-header__folder-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .clips-header__folder-icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Skeleton Loading States ===== */
  .clips-skeleton__card-title {
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

  .clips-skeleton__card-meta {
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
  .clips__selection-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .clips__selection-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    font-weight: 500;
  }

  .clips__selection-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-accent);
  }

  .clips__selection-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .clips__selection-clear {
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

  .clips__selection-clear:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .clips__selection-delete {
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

  .clips__selection-delete:hover:not(:disabled) {
    background-color: #dc2626;
  }

  .clips__selection-delete-icon {
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
  .clips__section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .clips__date-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .clips__section-header {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin: 0;
    padding-bottom: 0.1rem;
  }

  /* ===== Clips Grid ===== */
  .clips__grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1.25rem;
  }

  @media (min-width: 1024px) {
    .clips__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1400px) {
    .clips__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 1800px) {
    .clips__grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (min-width: 2200px) {
    .clips__grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  /* ===== Clips Card (Folder View) ===== */
  .clips-card {
    position: relative;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition: all 200ms ease;
    aspect-ratio: 16 / 9;
  }

  .clips-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    transform: scale(1.02);
  }

  .clips-card--selected {
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
  }

  .clips-card--selected:hover {
    border-color: var(--sidebar-accent);
  }

  .clips-card--skeleton {
    pointer-events: none;
  }

  .clips-card__skeleton-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--sidebar-hover) 0%, var(--sidebar-surface) 100%);
  }

  /* Card wrapper for list view items */
  .clips-card-wrapper {
    position: relative;
    border-radius: 10px;
    transition: all 200ms ease;
  }

  .clips-card-wrapper--selected {
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
  }

  .clips-card-wrapper--selected:hover {
    border-color: var(--sidebar-accent);
  }

  /* Checkbox */
  .clips-card__checkbox {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 30;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .clips-card:hover .clips-card__checkbox,
  .clips-card-wrapper:hover .clips-card__checkbox,
  .clips-card__checkbox--visible {
    opacity: 1;
  }

  .clips-card__checkbox-inner {
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

  .clips-card__checkbox-inner:hover {
    background-color: rgba(0, 0, 0, 0.8);
  }

  .clips-card__checkbox-inner--checked {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
  }

  .clips-card__checkbox-inner--checked:hover {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
  }

  .clips-card__checkbox-icon {
    width: 16px;
    height: 16px;
  }

  /* Badges Group */
  .clips-card__badges-group {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .clips-card__badge {
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

  .clips-card__badge--count {
    background-color: rgba(37, 99, 235, 0.9);
    color: white;
  }

  .clips-card__badge--untranscribed {
    background-color: rgba(0, 0, 0, 0.6);
    color: rgba(251, 191, 36, 0.9);
    border: 1px solid rgba(251, 191, 36, 0.3);
    padding: 0.25rem 0.375rem;
  }

  .clips-card__badge-icon {
    width: 12px;
    height: 12px;
  }

  .clips-card__badge-icon-sm {
    width: 11px;
    height: 11px;
  }

  /* Thumbnail */
  .clips-card__thumbnail {
    position: absolute;
    inset: 0;
    z-index: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }

  .clips-card__vignette {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 40%, transparent 70%);
  }

  .clips-card__thumbnail--empty {
    background-color: var(--sidebar-hover);
  }

  .clips-card__thumbnail-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(0, 0, 0, 0.5) 100%);
  }

  /* Empty State Icons */
  .clips-card__empty-icon {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.2;
  }

  .clips-card__folder-icon {
    width: 64px;
    height: 64px;
    color: var(--sidebar-text);
  }

  /* Bottom Info */
  .clips-card__bottom {
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

  .clips-card__title {
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

  .clips-card:hover .clips-card__title {
    color: rgba(255, 255, 255, 0.9);
  }

  .clips-card__meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    flex-wrap: wrap;
  }

  .clips-card__meta-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ===== No Results State ===== */
  .clips__no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1rem;
    text-align: center;
  }

  .clips__no-results-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background-color: var(--sidebar-hover);
    border-radius: 9999px;
    margin-bottom: 1rem;
  }

  .clips__no-results-icon {
    width: 32px;
    height: 32px;
    color: var(--sidebar-text-muted);
  }

  .clips__no-results-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
  }

  .clips__no-results-description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1rem;
    max-width: 24rem;
  }

  .clips__no-results-btn {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-accent);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .clips__no-results-btn:hover {
    opacity: 0.8;
    text-decoration: underline;
  }

  /* ===== Empty State ===== */
  .clips__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .clips__empty-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: var(--sidebar-hover);
    border-radius: 16px;
    margin-bottom: 1.5rem;
  }

  .clips__empty-icon {
    width: 36px;
    height: 36px;
    color: var(--sidebar-text-muted);
  }

  .clips__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .clips__empty-description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
  }

  /* Fade transition for upload overlay */
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }

  /* ===== Search Palette Content Styles ===== */
  /* Info Banner */
  .search-palette__info-banner {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.625rem 1.25rem;
    background: rgba(6, 182, 212, 0.06);
    border-bottom: 1px solid rgba(6, 182, 212, 0.1);
  }

  .search-palette__info-icon {
    width: 14px;
    height: 14px;
    color: rgba(6, 182, 212, 0.7);
    flex-shrink: 0;
  }

  .search-palette__info-text {
    flex: 1;
    font-size: 0.75rem;
    color: rgba(6, 182, 212, 0.8);
    font-weight: 450;
  }

  .search-palette__info-link {
    padding: 0;
    background: none;
    border: none;
    font-size: 0.75rem;
    font-weight: 600;
    color: #06b6d4;
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .search-palette__info-link:hover {
    opacity: 0.8;
  }

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

  .search-palette__item-no-transcript {
    position: absolute;
    bottom: -4px;
    right: -4px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    background: rgba(6, 182, 212, 0.9);
    border-radius: 9999px;
    color: rgba(0, 0, 0, 0.85);
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

  .search-palette__item-project {
    color: rgba(255, 255, 255, 0.45);
    font-weight: 450;
  }

  .search-palette__item-match-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.125rem 0.5rem;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 4px;
    color: #c4b5fd;
    font-weight: 600;
    font-size: 0.6875rem;
  }

  .search-palette__match-dot {
    width: 5px;
    height: 5px;
    border-radius: 9999px;
    background: #c4b5fd;
  }

  .search-palette__item-untranscribed-tag {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    background: rgba(6, 182, 212, 0.12);
    border-radius: 4px;
    color: rgba(6, 182, 212, 0.9);
    font-weight: 600;
    font-size: 0.6875rem;
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

  .search-palette__empty-icon-wrap--success {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.2);
  }

  .search-palette__empty-icon-wrap--success .search-palette__empty-icon {
    color: rgb(34, 197, 94);
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

  /* Apply Button */
  .search-palette__apply-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%);
    border: 1px solid rgba(6, 182, 212, 0.25);
    border-radius: 10px;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #06b6d4;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .search-palette__apply-btn:hover {
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%);
    border-color: rgba(6, 182, 212, 0.35);
    transform: translateY(-1px);
  }

  .search-palette__apply-btn:active {
    transform: translateY(0);
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

  .folder-dialog--list {
    max-width: 700px;
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
    flex: 1;
  }

  .folder-dialog__header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
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

  .folder-dialog__file-count {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    white-space: nowrap;
    flex-shrink: 0;
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

  /* ===== Aspect Ratio Filter ===== */
  .folder-dialog__aspect-filter {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    padding: 0.25rem;
  }

  .folder-dialog__aspect-btn {
    padding: 0.375rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .folder-dialog__aspect-btn:hover {
    color: var(--sidebar-text);
    background-color: rgba(255, 255, 255, 0.05);
  }

  .folder-dialog__aspect-btn--active {
    background-color: var(--sidebar-accent);
    color: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  /* ===== Content ===== */
  .folder-dialog__content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1.5rem;
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

  /* ===== Date Groups ===== */
  .folder-dialog__date-group {
    margin-bottom: 1.5rem;
  }

  .folder-dialog__date-group:last-child {
    margin-bottom: 0;
  }

  .folder-dialog__date-header {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    border-bottom: 1px solid var(--sidebar-border);
    padding-bottom: 0.5rem;
    margin-bottom: 0.75rem;
  }

  /* ===== Builds List ===== */
  .folder-dialog__builds-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ===== Build Row ===== */
  .folder-dialog__build-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background-color: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .folder-dialog__build-row:hover {
    background-color: var(--sidebar-hover);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .folder-dialog__build-row--selected {
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 1px var(--sidebar-accent);
  }

  /* ===== Checkbox ===== */
  .folder-dialog__checkbox {
    flex-shrink: 0;
    cursor: pointer;
  }

  .folder-dialog__checkbox-box {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .folder-dialog__checkbox-box:hover {
    background-color: rgba(0, 0, 0, 0.5);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .folder-dialog__checkbox-box--checked {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
  }

  /* ===== Build Thumbnail ===== */
  .folder-dialog__build-thumb {
    position: relative;
    flex-shrink: 0;
    width: 120px;
    height: 68px;
    border-radius: 6px;
    overflow: hidden;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
  }

  .folder-dialog__build-thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .folder-dialog__build-thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sidebar-text-muted);
    opacity: 0.3;
  }

  .folder-dialog__build-thumb-overlay-building {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  /* ===== Build Content ===== */
  .folder-dialog__build-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .folder-dialog__build-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .folder-dialog__build-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ===== Build Badges ===== */
  .folder-dialog__build-badges {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .folder-dialog__build-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background-color: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
  }

  .folder-dialog__build-badge--building {
    background-color: rgba(147, 51, 234, 0.2);
    color: rgb(196, 181, 253);
  }

  .folder-dialog__build-badge--number {
    background-color: rgba(34, 197, 94, 0.2);
    color: rgb(134, 239, 172);
  }

  .folder-dialog__build-badge--sibling {
    background-color: rgba(59, 130, 246, 0.2);
    color: rgb(147, 197, 253);
  }

  .folder-dialog__build-meta {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
  }

  /* ===== Build Actions ===== */
  .folder-dialog__build-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .folder-dialog__build-action-btn {
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
  }

  .folder-dialog__build-action-btn:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .folder-dialog__build-action-btn--danger:hover {
    background-color: rgba(239, 68, 68, 0.15);
    color: rgb(248, 113, 113);
  }

  .folder-dialog__build-action-btn--editor:hover {
    background-color: rgba(59, 130, 246, 0.15);
    color: rgb(96, 165, 250);
  }

  .folder-dialog__build-action-btn--active {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  /* Spin animation for loading states */
  .folder-dialog__spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* ===== Footer ===== */
  .folder-dialog__footer {
    background-color: rgba(0, 0, 0, 0.2);
    border-top: 1px solid var(--sidebar-border);
    flex-shrink: 0;
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
    transition: all 200ms ease-out;
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }
</style>

<!-- Global styles for folder dialog dropdown menus (rendered via Teleport outside component scope) -->
<style>
  /* ===== Folder Dialog Dropdown Menu Styling ===== */
  .folder-dialog-dropdown {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    animation: folderDialogDropdownFade 150ms ease-out;
  }

  @keyframes folderDialogDropdownFade {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .folder-dialog-dropdown-item {
    color: var(--sidebar-text);
  }

  .folder-dialog-dropdown-item:hover {
    background-color: var(--sidebar-hover);
  }

  .folder-dialog-dropdown-item--danger {
    color: #f87171;
  }

  .folder-dialog-dropdown-item--danger:hover {
    background-color: rgba(239, 68, 68, 0.1);
    color: #f87171;
  }

  .folder-dialog-dropdown-divider {
    background-color: var(--sidebar-border);
  }
</style>
