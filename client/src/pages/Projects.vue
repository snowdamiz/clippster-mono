<template>
  <PageLayout
    title="Projects"
    description="Manage and organize your video projects"
    :show-header="projects.length > 0"
    :icon="Folder"
  >
    <template #actions>
      <Button @click="openCreateDialog" class="flex items-center gap-2">
        <Plus class="h-5 w-5" />
        New Project
      </Button>
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
                    'w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer shadow-md border border-white/45',
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
              <!-- Folder Badge (if has children and in folder view, only show if not detecting/merging) -->
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
                  v-if="viewMode === 'folders' && (hasChildren(project.id) || hasDirectVideos(project.id))"
                  class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                  title="View Project"
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
                  v-if="canDetectClips(project.id) && !isProjectDetecting(project.id)"
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
      @click.self="showFolderDialog = false"
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
                    !isProjectDetecting(folderProject?.id || '')
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
                <div class="w-full aspect-video bg-black rounded-lg overflow-hidden relative group">
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

                  <!-- Custom Video Controls -->
                  <div
                    v-if="inlineVideoSrc"
                    class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <!-- Progress Bar -->
                    <div
                      class="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group/progress"
                      @click="seekInlineVideo"
                      @mousedown="startInlineSeekDrag"
                    >
                      <div
                        class="h-full bg-primary rounded-full relative"
                        :style="{ width: `${inlineVideoProgress}%` }"
                      >
                        <div
                          class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-md"
                        ></div>
                      </div>
                    </div>

                    <!-- Controls Row -->
                    <div class="flex items-center justify-between">
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
                      >
                        <Maximize2 class="w-4 h-4" />
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
    getWatermarkImage,
    type Project,
    type RawVideo,
    type ClipWithVersionAndSegment,
    type IntroOutro,
    type WatermarkSettings,
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
  import ClipBuildSettingsDialog, { type BuildSettings } from '@/components/ClipBuildSettingsDialog.vue';
  import { useChunkedClipDetection } from '@/composables/useChunkedClipDetection';
  import { useAuthStore } from '@/stores/auth';
  import { useClipDetectionTracking } from '@/composables/useClipDetectionTracking';
  import { Button } from '@/components/ui/button';
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

    console.log(`[Projects] Clip build complete: ${clip_id}`, { buildSuccess, output_path });

    const clip = folderClips.value.find((c) => c.id === clip_id);
    const isCancelled = buildError && (buildError.includes('cancelled') || buildError.includes('Cancelled'));

    // Update local state immediately for instant UI feedback
    if (clip) {
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
    }

    // Update database in the background (non-blocking)
    // This runs async without awaiting, so UI stays responsive
    (async () => {
      if (buildSuccess) {
        try {
          const { updateClipBuildStatus, getClipBuilds, updateClipBuild, createClipBuild } = await import(
            '@/services/database'
          );

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
          } else {
            // Fallback: create a new build record
            const buildId = await createClipBuild(clip_id, {});
            await updateClipBuild(buildId, {
              status: 'completed',
              filePath: output_path,
              outputPaths: all_output_paths || (output_path ? [output_path] : []),
            });
          }

          console.log(`[Projects] Database updated for clip: ${clip_id}`);
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
  const inlineVideoSrc = ref<string | null>(null);
  const inlineVideoLoading = ref(false);
  const inlineVideoPlaying = ref(false);
  const inlineVideoMuted = ref(false);
  const inlineVideoVolume = ref(1);
  const inlineVideoCurrentTime = ref(0); // Relative to clip start (0 = clip start)
  const inlineVideoClipDuration = ref(0);
  const inlineVideoProgress = ref(0);
  const inlineSeekDragging = ref(false);

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

  // Watch for clip changes to prepare video
  watch(clipToPreview, async (newClip) => {
    if (newClip) {
      await prepareInlineVideo();
    } else {
      inlineVideoSrc.value = null;
    }
  });

  function previewClip(clip: ClipWithVersionAndSegment) {
    clipToPreview.value = clip;
  }

  // Close clip preview
  function closeClipPreview() {
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

  // Seek video based on click position
  function seekInlineVideo(event: MouseEvent) {
    if (!inlineVideoRef.value || !clipToPreview.value) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const startTime = getClipStartTime();
    const newTime = startTime + percent * inlineVideoClipDuration.value;
    inlineVideoRef.value.currentTime = newTime;
    inlineVideoCurrentTime.value = percent * inlineVideoClipDuration.value;
    inlineVideoProgress.value = percent * 100;
  }

  // Start drag seeking
  function startInlineSeekDrag(event: MouseEvent) {
    inlineSeekDragging.value = true;

    const onMouseMove = (e: MouseEvent) => {
      if (!inlineVideoRef.value || !clipToPreview.value) return;
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const startTime = getClipStartTime();
      const newTime = startTime + percent * inlineVideoClipDuration.value;
      inlineVideoRef.value.currentTime = newTime;
      inlineVideoCurrentTime.value = percent * inlineVideoClipDuration.value;
      inlineVideoProgress.value = percent * 100;
    };

    const onMouseUp = () => {
      inlineSeekDragging.value = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // Toggle fullscreen
  function toggleInlineVideoFullscreen() {
    if (!inlineVideoRef.value) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      inlineVideoRef.value.requestFullscreen();
    }
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
            folderCreatorWatermarkSettings.value = {
              enabled: true,
              watermarkId: profile.watermark_id,
              positionX: 8,
              positionY: 92,
              opacity: 80,
              scale: 15,
            };
            console.log('[Projects] Loaded creator default watermark');
          }
        }
      }
    } catch (err) {
      console.warn('[Projects] Failed to load creator profile for folder build:', err);
    }

    showFolderBuildDialog.value = true;
  }

  // Handle build confirmation
  async function onFolderBuildConfirm(settings: BuildSettings) {
    if (!folderClipToBuild.value) return;
    const clip = folderClipToBuild.value;

    try {
      // Get the video file for this clip's segment
      const videos = projectVideos.value[clip.segment_id];
      if (!videos || videos.length === 0) {
        error('No video found', 'Cannot find the source video for this clip.');
        return;
      }
      const videoPath = videos[0].file_path;

      // Get or create segments from the clip
      let segments: any[] = [];
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
        const { getWatermarkImage } = await import('@/services/database');
        const watermarkImage = await getWatermarkImage(settings.watermark.watermarkId);
        if (watermarkImage) {
          watermarkSettings = {
            enabled: true,
            watermarkId: settings.watermark.watermarkId,
            filePath: watermarkImage.file_path,
            positionX: settings.watermark.positionX,
            positionY: settings.watermark.positionY,
            opacity: settings.watermark.opacity,
            scale: settings.watermark.scale,
          };
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
        introPath: settings.intro?.file_path || null,
        introDuration: settings.intro?.duration || null,
        outroPath: settings.outro?.file_path || null,
        outroDuration: settings.outro?.duration || null,
        watermarkSettings: watermarkSettings,
        audioSettings: null,
        framingStrategy: null,
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
      closeFolderDownloadDropdown();
      closeClipPreview();
    }
  });

  function openCreateDialog() {
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
    document.removeEventListener('click', handleFolderDropdownClickOutside);

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
