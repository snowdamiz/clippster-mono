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

    <slot name="notice" />
    <div
      class="projects__content"
      :class="{
        'projects__content--empty':
          !loading && projects.length === 0 && getActiveDownloads().length === 0 && getQueuedDownloads().length === 0,
      }"
    >
      <!-- Page Heading -->
      <div
        v-if="projects.length > 0 || loading || getActiveDownloads().length > 0 || getQueuedDownloads().length > 0 || mockProjectActive"
        class="projects__heading"
      >
        <h1 class="projects__title">Video Library</h1>
        <p class="projects__subtitle">Manage and organize your downloaded videos and detect clips</p>
      </div>

      <!-- Tour demo project -->
      <div v-if="mockProjectActive" class="projects__section" style="margin-bottom: 1rem">
        <h3 class="projects__section-header">Tour Demo</h3>
        <div class="projects__grid">
          <div class="project-card" data-tour-id="tour-mock-project">
            <div class="project-card__thumbnail project-card__thumbnail--empty">
              <div class="project-card__thumbnail-gradient"></div>
              <div class="project-card__empty-icon">
                <Folder class="project-card__folder-icon" />
              </div>
            </div>
            <div class="project-card__bottom">
              <h3 class="project-card__title">Demo VOD Project</h3>
              <div class="project-card__meta">Sample project for the tour</div>
              <div class="project-card__actions" style="display: flex; gap: 0.35rem; margin-top: 0.5rem">
                <button type="button" class="projects-section-btn" data-tour-id="tour-mock-detect" @click.prevent>
                  Detect Clips
                </button>
                <button type="button" class="projects-section-btn" data-tour-id="tour-mock-transcribe" @click.prevent>
                  Transcribe
                </button>
                <button type="button" class="projects-section-btn" data-tour-id="tour-mock-preedit" @click.prevent>
                  Pre-Edit VOD
                </button>
              </div>
            </div>
          </div>
        </div>
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
              <LibraryProjectCard
                v-for="project in group.projects" :key="project.id" :name="project.name"
                :thumbnail="getThumbnailUrl(project.id)" :live="isProjectLive(project.id)"
                :selected="isProjectSelected(project.id)" :list="viewMode === 'list'"
                @open="handleProjectClick(project)"
              >
                <template #badges>
                <slot name="project-status" :project="project" />
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
                <div
                  v-if="hasVodPreset(project.id) && !isLiveClipsContainerProject(project)"
                  class="project-card__preset-badge"
                >
                  <LayoutDashboard class="project-card__badge-icon" />
                  <span>{{ vodPresetConfigs[project.id]?.targetAspectRatio }} Pre-Edit</span>
                </div>

                </template>
                <template #meta>
                    <!-- Platform Icon -->
                    <div
                      v-if="getProjectPlatform(project) === 'YouTube'"
                      class="project-card__platform project-card__platform--youtube"
                      title="YouTube"
                    >
                      <img :src="assetBase + '/youtube.svg'" class="project-card__platform-icon" />
                    </div>
                    <div
                      v-else-if="getProjectPlatform(project) === 'Twitch'"
                      class="project-card__platform project-card__platform--twitch"
                      title="Twitch"
                    >
                      <img :src="assetBase + '/twitch.svg'" class="project-card__platform-icon" />
                    </div>
                    <div
                      v-else-if="getProjectPlatform(project) === 'Kick'"
                      class="project-card__platform project-card__platform--kick"
                      title="Kick"
                    >
                      <img :src="assetBase + '/kick.svg'" class="project-card__platform-icon project-card__platform-icon--kick" />
                    </div>
                    <div
                      v-else-if="getProjectPlatform(project) === 'Rumble'"
                      class="project-card__platform project-card__platform--rumble"
                      title="Rumble"
                    >
                      <img :src="assetBase + '/rumble.svg'" class="project-card__platform-icon" />
                    </div>
                    <div
                      v-else-if="getProjectPlatform(project) === 'Twitter'"
                      class="project-card__platform project-card__platform--twitter"
                      title="Twitter"
                    >
                      <img :src="assetBase + '/x.svg'" class="project-card__platform-icon" />
                    </div>
                    <div
                      v-else-if="getProjectPlatform(project) === 'PumpFun'"
                      class="project-card__platform project-card__platform--pumpfun"
                      title="PumpFun"
                    >
                      <img
                        :src="assetBase + '/capsule.svg'"
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
                </template>

                <!-- Hover Overlay Buttons -->
                <template #actions>
                  <slot name="extra-actions" :project="project" />
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
                    v-if="
                      (hasDirectVideos(project.id) || hasChildren(project.id)) &&
                      !isLiveClipsContainerProject(project)
                    "
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
                </template>
              </LibraryProjectCard>
            </div>
          </div>
        </div>

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

    
<slot name="dialogs" />
<template #footer><PaginationFooter v-if="!loading && filteredProjects.length > 0" :current-page="currentPage" :total-pages="totalPages" :total-items="filteredProjects.length" item-label="project" mode="static" @go-to-page="goToPage" @previous="previousPage" @next="nextPage" /></template>
</PageLayout></template>
<script lang="ts">
import { defineComponent, markRaw, type PropType } from 'vue';
import PageLayout from '@/components/PageLayout.vue';
import LibraryProjectCard from '@/components/LibraryProjectCard.vue';
import DownloadCard from '@/components/DownloadCard.vue';
import PaginationFooter from '@/components/PaginationFooter.vue';
import CustomDropdown from '@/components/CustomDropdown.vue';
import { Input } from '@/components/ui/input';
import { Folder, FolderOpen, Plus, Search, Check, List, Trash2, XCircle, Loader2, LayoutDashboard, Monitor, Sparkles, FileText, Edit } from 'lucide-vue-next';
export default defineComponent({
 components: { PageLayout, LibraryProjectCard, DownloadCard, PaginationFooter, CustomDropdown, Input, Folder, FolderOpen, Plus, Search, Check, List, Trash2, XCircle, Loader2, LayoutDashboard, Monitor, Sparkles, FileText, Edit },
 props: { model: { type: Object as PropType<Record<string, any>>, required: true } },
 setup(props) { props.model.Folder = markRaw(Folder); props.model.assetBase ??= ''; return props.model; }
});
</script>
<style src="@/styles/projectLibrary.css"></style>
