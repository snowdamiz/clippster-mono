<template>
  <PageLayout
    title="Projects"
    description="Manage and organize your video projects"
    :show-header="projects.length > 0"
    :icon="Folder"
  >
    <template #actions>
      <button
        @click="openCreateDialog"
        class="px-5 py-2.5 bg-muted hover:bg-muted/80 text-white rounded-md flex items-center gap-2 font-medium shadow-sm transition-all"
      >
        <Plus class="h-5 w-5" />
        New Project
      </button>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="space-y-6">
      <SkeletonGrid />
    </div>

    <!-- Projects Content -->
    <div
      v-else-if="projects.length > 0 || getActiveDownloads().length > 0 || getQueuedDownloads().length > 0"
      class="space-y-8"
    >
      <!-- Filter Toolbar -->
      <div class="-mt-2 bg-card flex flex-col md:flex-row gap-4 items-center justify-between">
        <!-- Left: Search or Selection Info -->
        <div class="flex items-center gap-3 w-full md:w-auto">
          <!-- Selection Controls (visible when items selected) -->
          <div v-if="selectedProjects.size > 0" class="flex items-center gap-3">
            <button
              @click="confirmBulkDelete"
              :disabled="hasAnySelectedProjectDetecting()"
              :class="[
                'px-3 py-2 text-white rounded-md flex items-center gap-2 font-medium text-sm transition-all',
                hasAnySelectedProjectDetecting()
                  ? 'bg-gray-500 cursor-not-allowed opacity-50'
                  : 'bg-red-600 hover:bg-red-700',
              ]"
              :title="hasAnySelectedProjectDetecting() ? 'Cannot delete while detection is in progress' : ''"
            >
              <Trash2 class="h-4 w-4" />
              Delete ({{ selectedProjects.size }})
            </button>
            <span class="text-sm text-muted-foreground">{{ selectedProjects.size }} selected</span>
            <button @click="clearSelection" class="text-xs text-muted-foreground hover:text-foreground font-medium">
              Clear
            </button>
          </div>

          <!-- Search (hidden when items selected) -->
          <div v-else class="relative w-full md:w-72">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Search projects..." class="pl-9 bg-background/50" />
          </div>
        </div>

        <!-- Right: Filters & View Mode -->
        <div class="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <!-- Reset Filters Button -->
          <button
            v-if="searchQuery || statusFilter !== 'all'"
            @click="
              searchQuery = '';
              statusFilter = 'all';
            "
            class="text-xs px-2 py-1 text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-md transition-colors whitespace-nowrap font-medium flex items-center gap-1"
          >
            <X class="h-3 w-3" />
            Reset
          </button>

          <!-- Status Filter -->
          <CustomDropdown v-model="statusFilter" :options="statusOptions" placeholder="Status" class="w-[140px]" />

          <!-- Sort Filter -->
          <CustomDropdown v-model="sortBy" :options="sortOptions" placeholder="Sort By" class="w-[160px]" />

          <!-- View Mode -->
          <div
            class="bg-muted/50 rounded-md p-1 flex items-center gap-1 transition-opacity"
            :class="{ 'opacity-50 pointer-events-none': searchQuery || statusFilter === 'has_clips' }"
          >
            <button
              @click="viewMode = 'folders'"
              :disabled="!!searchQuery || statusFilter === 'has_clips'"
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
              :disabled="!!searchQuery || statusFilter === 'has_clips'"
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

      <!-- Active Downloads Section -->
      <div v-if="getActiveDownloads().length > 0 || getQueuedDownloads().length > 0" class="space-y-4">
        <h3 class="text-sm font-medium text-muted-foreground border-b border-border pb-2">Active Downloads</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <DownloadCard
            v-for="download in [...getActiveDownloads(), ...getQueuedDownloads()]"
            :key="download.id"
            :download="download"
          />
        </div>
      </div>

      <!-- Projects Grid -->
      <div v-if="filteredProjects.length > 0" class="space-y-8">
        <div v-for="group in groupedProjects" :key="group.dateLabel" class="space-y-4">
          <!-- Date Header -->
          <h3 class="text-sm font-medium text-muted-foreground border-b border-border pb-2">{{ group.dateLabel }}</h3>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div
              v-for="project in group.projects"
              :key="project.id"
              class="relative bg-card rounded-md overflow-hidden cursor-pointer group aspect-video hover:scale-102 transition-all"
              :class="{ 'ring-2 ring-primary ring-offset-2 ring-offset-background': isProjectSelected(project.id) }"
              @click="handleProjectClick(project)"
            >
              <!-- Selection Checkbox (visible on hover or when selected) -->
              <div
                class="absolute top-4 right-4 z-30 transition-opacity"
                :class="isProjectSelected(project.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                @click.stop="toggleProjectSelection(project.id)"
              >
                <div
                  :class="[
                    'w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer shadow-md',
                    isProjectSelected(project.id)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-black/60 text-white hover:bg-black/80',
                  ]"
                >
                  <Check v-if="isProjectSelected(project.id)" class="w-4 h-4" />
                </div>
              </div>

              <!-- Processing Indicator (if project or any segment is being detected) -->
              <div
                v-if="isProjectDetecting(project.id)"
                class="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-purple-600/90 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-sm"
              >
                <Loader2 class="w-3 h-3 animate-spin" />
                <span>Detecting...</span>
              </div>
              <!-- Folder Badge (if has children and in folder view, only show if not detecting) -->
              <div
                v-else-if="viewMode === 'folders' && hasChildren(project.id) && getChildCount(project.id) > 1"
                class="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-blue-600/90 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-sm"
              >
                <FolderOpen class="w-3 h-3" />
                <span>{{ getChildCount(project.id) }} Parts</span>
              </div>

              <!-- Thumbnail background with vignette -->
              <div
                v-if="getThumbnailUrl(project.id)"
                class="absolute inset-0 z-0"
                :style="{
                  backgroundImage: `url(${getThumbnailUrl(project.id)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }"
              >
                <!-- Dark vignette overlay handled by bottom gradient now, but keep subtle global one -->
                <div class="absolute inset-0 bg-black/10"></div>
              </div>
              <!-- Fallback background for projects without thumbnails -->
              <div v-else class="absolute inset-0 z-0 bg-muted">
                <div class="absolute inset-0 bg-gradient-to-br from-black/50 via-black/40 to-black/50"></div>

                <!-- Live Empty State -->
                <div
                  v-if="isProjectLive(project.id)"
                  class="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-50"
                >
                  <div class="relative">
                    <div class="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20"></div>
                    <Radio class="h-12 w-12 text-red-500 relative z-10" />
                  </div>
                  <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monitoring</span>
                </div>
                <!-- Standard Empty State -->
                <div v-else class="absolute inset-0 flex items-center justify-center opacity-20">
                  <Folder class="h-16 w-16 text-foreground" />
                </div>
              </div>

              <!-- Bottom Overlay with Info -->
              <div
                class="absolute bottom-0 left-0 right-0 z-5 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-28 flex flex-col gap-1.5"
              >
                <!-- Title -->
                <h3
                  class="text-base font-bold text-white leading-tight line-clamp-1 group-hover:text-white/90 transition-colors"
                  :title="project.name"
                >
                  {{ project.name }}
                </h3>

                <!-- Metadata Row -->
                <div class="flex items-center gap-2 text-xs text-white/70 font-medium">
                  <!-- Platform Icon -->
                  <div
                    v-if="getProjectPlatform(project) === 'Youtube'"
                    class="w-4 h-4 bg-red-600 rounded flex items-center justify-center shadow-sm shrink-0"
                    title="YouTube"
                  >
                    <img src="/youtube.svg" class="w-2.5 h-2.5 invert brightness-200" />
                  </div>
                  <div
                    v-else-if="getProjectPlatform(project) === 'Twitch'"
                    class="w-4 h-4 bg-[#9146FF] rounded flex items-center justify-center shadow-sm shrink-0"
                    title="Twitch"
                  >
                    <img src="/twitch.svg" class="w-2.5 h-2.5 invert brightness-200" />
                  </div>
                  <div
                    v-else-if="getProjectPlatform(project) === 'Kick'"
                    class="w-4 h-4 bg-[#53FC18] rounded flex items-center justify-center shadow-sm shrink-0"
                    title="Kick"
                  >
                    <img src="/kick.svg" class="w-2.5 h-2.5" />
                  </div>
                  <div
                    v-else-if="getProjectPlatform(project) === 'PumpFun'"
                    class="w-4 h-4 bg-emerald-500 rounded flex items-center justify-center shadow-sm shrink-0"
                    title="PumpFun"
                  >
                    <img src="/capsule.svg" class="w-2.5 h-2.5 brightness-200" />
                  </div>
                  <div
                    v-else-if="getProjectPlatform(project) === 'Manual'"
                    class="w-4 h-4 bg-slate-700 rounded flex items-center justify-center shadow-sm shrink-0 text-white"
                    title="Manual"
                  >
                    <Monitor class="w-2.5 h-2.5" />
                  </div>

                  <!-- Live Indicator -->
                  <div
                    v-if="isProjectLive(project.id)"
                    class="flex items-center gap-1.5 text-red-500 font-bold px-1.5 py-0.5 bg-red-500/10 rounded-full border border-red-500/20"
                  >
                    <span class="relative flex h-1.5 w-1.5">
                      <span
                        class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"
                      ></span>
                      <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                    </span>
                    <span class="text-[10px] uppercase tracking-wider">Live</span>
                  </div>

                  <span
                    v-if="!isProjectLive(project.id) && getProjectPlatform(project)"
                    class="w-0.5 h-0.5 rounded-full bg-white/40"
                  ></span>

                  <!-- Time -->
                  <span class="truncate">{{ getRelativeTime(project.updated_at) }}</span>

                  <span class="w-0.5 h-0.5 rounded-full bg-white/40"></span>

                  <!-- Clip Count -->
                  <span class="truncate">{{ getClipCount(project.id) }} clips</span>
                </div>
              </div>

              <!-- Hover Overlay Buttons -->
              <div
                class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-5 flex items-center justify-center gap-3"
              >
                <button
                  v-if="viewMode === 'folders' && hasChildren(project.id) && getChildCount(project.id) > 1"
                  class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                  title="View Folder"
                  @click.stop="handleProjectClick(project)"
                >
                  <FolderOpen class="h-5 w-5" />
                </button>
                <button
                  v-else
                  class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                  title="Open Workspace"
                  @click.stop="handleProjectClick(project)"
                >
                  <Play class="h-5 w-5" />
                </button>

                <button
                  v-if="canDetectClips(project.id)"
                  class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                  title="Detect Clips"
                  @click.stop="startProjectDetection(project)"
                >
                  <Sparkles class="h-5 w-5" />
                </button>

                <button
                  class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                  title="Edit"
                  @click.stop="editProject(project)"
                >
                  <Edit class="h-5 w-5" />
                </button>
                <button
                  v-if="!isProjectDetecting(project.id)"
                  class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                  title="Delete"
                  @click.stop="confirmDelete(project)"
                >
                  <Trash2 class="h-5 w-5" />
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
        class="flex flex-col items-center justify-center py-16 text-center space-y-4"
      >
        <div class="bg-muted rounded-full p-4">
          <Search class="h-8 w-8 text-muted-foreground" />
        </div>
        <div class="space-y-1">
          <h3 class="font-semibold text-lg">No projects found</h3>
          <p class="text-muted-foreground text-sm max-w-sm">
            We couldn't find any projects matching your search filters. Try adjusting your search query or filters.
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
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else
      title="No projects found"
      description="Create a new project to get started"
      button-text="Create Project"
      @action="openCreateDialog"
    />
    <!-- Project Dialog -->
    <ProjectDialog v-model="showDialog" :project="selectedProject" @submit="handleProjectSubmit" />
    <!-- Project Workspace Dialog -->
    <ProjectWorkspaceDialog v-model="showWorkspaceDialog" :project="workspaceProject" />
    <!-- Project-Level Clip Detection Dialog -->
    <ClipDetectionConfirmDialog
      :model-value="showProjectDetectDialog"
      :video-duration="0"
      :segment-count="segmentsToDetect.length"
      :total-duration="totalDetectionDuration"
      @update:model-value="showProjectDetectDialog = $event"
      @confirm="onProjectDetectClipsConfirmed"
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
          'max-w-lg': getFolderChildren(folderProject.id).length <= 1,
          'max-w-3xl': getFolderChildren(folderProject.id).length === 2,
          'max-w-5xl': getFolderChildren(folderProject.id).length >= 3,
        }"
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

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6">
          <div
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
                    'w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer shadow-md',
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
        </div>

        <!-- Footer with Pagination -->
        <div v-if="folderTotalPages > 1" class="px-6 py-4 border-t border-border bg-muted/10 flex justify-center">
          <PaginationFooter
            :current-page="folderCurrentPage"
            :total-pages="folderTotalPages"
            :total-items="getFolderChildren(folderProject.id).length"
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
      @click.self="handleDeleteDialogClose"
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
            class="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md font-semibold hover:from-red-700 hover:to-red-800 transition-all"
            @click="deleteProjectConfirmed"
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
      @click.self="handleBulkDeleteDialogClose"
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
            class="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md font-semibold hover:from-red-700 hover:to-red-800 transition-all"
            @click="bulkDeleteConfirmed"
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
      @click.self="handleBulkDeleteFolderChildrenDialogClose"
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
  } from 'lucide-vue-next';
  import {
    getAllProjects,
    getClipsWithVersionsByProjectId,
    deleteProject,
    createProject,
    updateProject,
    getRawVideosByProjectId,
    hasRawVideosForProject,
    hasClipsForProject,
    type Project,
    type RawVideo,
  } from '@/services/database';
  import { extractMintId } from '@/services/pumpfun';
  import { useFormatters } from '@/composables/useFormatters';
  import { useToast } from '@/composables/useToast';
  import { useLivestreamMonitoring } from '@/composables/useLivestreamMonitoring';
  import { useVideoOperations } from '@/composables/useVideoOperations';
  import { useDownloads } from '@/composables/useDownloads';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import SkeletonGrid from '@/components/SkeletonGrid.vue';
  import ProjectDialog, { type ProjectFormData } from '@/components/ProjectDialog.vue';
  import ProjectWorkspaceDialog from '@/components/ProjectWorkspaceDialog.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import { Input } from '@/components/ui/input';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import DownloadCard from '@/components/DownloadCard.vue';
  import ClipDetectionConfirmDialog from '@/components/ClipDetectionConfirmDialog.vue';
  import { useChunkedClipDetection } from '@/composables/useChunkedClipDetection';
  import { useAuthStore } from '@/stores/auth';
  import { useClipDetectionTracking } from '@/composables/useClipDetectionTracking';

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
  const projectVideos = ref<Record<string, RawVideo[]>>({});
  const thumbnailCache = ref<Map<string, string>>(new Map());
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
  const { startDetection, updateProgress, completeDetection, isDetectionActive, getDetectionState } =
    useClipDetectionTracking();

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
    if (!isBackgroundRefresh) {
      loading.value = true;
    }
    try {
      projects.value = await getAllProjects();

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

  // Folder dialog pagination
  const folderCurrentPage = ref(1);
  const folderItemsPerPage = 6;

  function getFolderChildren(projectId: string): Project[] {
    return childrenMap.value.get(projectId) || [];
  }

  const paginatedFolderChildren = computed(() => {
    if (!folderProject.value) return [];
    const children = getFolderChildren(folderProject.value.id);
    const startIndex = (folderCurrentPage.value - 1) * folderItemsPerPage;
    return children.slice(startIndex, startIndex + folderItemsPerPage);
  });

  const folderTotalPages = computed(() => {
    if (!folderProject.value) return 0;
    return Math.ceil(getFolderChildren(folderProject.value.id).length / folderItemsPerPage);
  });

  function handleProjectClick(project: Project) {
    if (viewMode.value === 'folders' && hasChildren(project.id)) {
      if (getChildCount(project.id) > 1) {
        // Open folder dialog if more than 1 child
        folderProject.value = project;
        folderCurrentPage.value = 1; // Reset to first page
        showFolderDialog.value = true;
      } else {
        // If only 1 child, open that child directly (or the parent workspace if that's preferred logic)
        // The user requested "looks like normal project card" if 1 segment.
        // But structurally it's Parent -> Child.
        // If we click Parent, we probably want to see the content of the Child.
        const children = getFolderChildren(project.id);
        if (children.length > 0) {
          openWorkspace(children[0]);
        } else {
          openWorkspace(project);
        }
      }
    } else {
      openWorkspace(project);
    }
  }

  // Filter projects based on view mode and filters
  const filteredProjects = computed(() => {
    let result = projects.value;

    // 0. Filter out projects associated with active downloads that don't have thumbnails yet
    const activeList = getActiveDownloads();
    const queuedList = getQueuedDownloads();
    const allActiveDownloads = [...activeList, ...queuedList];
    const activeDownloadProjectIds = new Set(
      allActiveDownloads.flatMap((d) => [d.projectId, d.parentProjectId].filter(Boolean))
    );

    result = result.filter((p) => {
      // If it's a project associated with an active/queued download
      if (activeDownloadProjectIds.has(p.id)) {
        // Only show if it has a thumbnail (meaning content has been processed)
        return thumbnailCache.value.has(p.id);
      }
      return true;
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
    }
  });

  function openCreateDialog() {
    selectedProject.value = null;
    showDialog.value = true;
  }

  function openWorkspace(project: Project) {
    workspaceProject.value = project;
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
    if (!projectToDelete.value) return;

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
      showDeleteDialog.value = false;
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

  function confirmBulkDelete() {
    if (selectedProjects.value.size > 0) {
      showBulkDeleteDialog.value = true;
    }
  }

  function handleBulkDeleteDialogClose() {
    showBulkDeleteDialog.value = false;
  }

  async function bulkDeleteConfirmed() {
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

      // Close folder dialog if all children were deleted
      if (folderProject.value && getFolderChildren(folderProject.value.id).length === 0) {
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

  function getProjectDetectionProgress(projectId: string): { progress: number; message: string } | null {
    // Check if the project itself is being detected
    const selfState = getDetectionState(projectId);
    if (selfState?.isActive) {
      return { progress: selfState.progress, message: selfState.message };
    }

    // Check children and aggregate progress
    const children = getFolderChildren(projectId);
    const activeChildren = children.filter((child) => isDetectionActive(child.id));

    if (activeChildren.length > 0) {
      // Find the currently active child
      for (const child of activeChildren) {
        const state = getDetectionState(child.id);
        if (state?.isActive) {
          const childIndex = children.findIndex((c) => c.id === child.id);
          return {
            progress: state.progress,
            message: `Segment ${childIndex + 1}/${children.length}: ${state.message}`,
          };
        }
      }
    }

    return null;
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

  function getProjectTotalDuration(projectId: string): number {
    let totalDuration = 0;

    // Get duration from direct videos
    const videos = projectVideos.value[projectId];
    if (videos) {
      totalDuration += videos.reduce((acc, v) => acc + (v.duration || 0), 0);
    }

    // Get duration from children
    const children = getFolderChildren(projectId);
    for (const child of children) {
      const childVideos = projectVideos.value[child.id];
      if (childVideos) {
        totalDuration += childVideos.reduce((acc, v) => acc + (v.duration || 0), 0);
      }
    }

    return totalDuration;
  }

  function startProjectDetection(project: Project) {
    // Check if user is authenticated
    if (!authStore.isAuthenticated) {
      window.dispatchEvent(new CustomEvent('show-auth-modal'));
      return;
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

  async function onProjectDetectClipsConfirmed(_promptId: string, promptContent: string) {
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
    const customEvent = event as CustomEvent;
    const detail = customEvent.detail;

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

  onMounted(async () => {
    // Initialize downloads state from persistence
    await initializeDownloads();

    await loadProjects();

    // Add event listener for clip refresh events
    document.addEventListener('refresh-clips-projects', handleClipRefreshEvent as EventListener);
    // Add event listener for video added events
    window.addEventListener('video-added', handleVideoAdded as EventListener);
  });

  onUnmounted(() => {
    // Clean up event listener
    document.removeEventListener('refresh-clips-projects', handleClipRefreshEvent as EventListener);
    window.removeEventListener('video-added', handleVideoAdded as EventListener);
  });
</script>
