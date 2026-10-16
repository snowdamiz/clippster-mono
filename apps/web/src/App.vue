<template>
  <div v-if="booting" class="flex min-h-screen items-center justify-center gap-2 text-sm text-fg-muted" role="status">
    <Loader2 :size="16" class="animate-spin text-fg-subtle" />
    Opening your workspace…
  </div>
  <div v-else-if="!user && embedded" class="flex min-h-screen items-center justify-center p-6">
    <div
      class="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-surface p-6 text-center shadow-[var(--shadow-lg)]"
    >
      <p class="text-sm text-fg-muted">Your session expired. Sign in to continue.</p>
      <a href="/login" target="_top" class="button-primary">Sign in</a>
    </div>
  </div>
  <AuthScreen v-else-if="!user" @authenticated="signedIn" />
  <div v-else-if="needsPlanSelection(user)" class="flex min-h-screen items-center justify-center p-6">
    <div
      class="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-surface p-6 text-center shadow-[var(--shadow-lg)]"
    >
      <AppBrand />
      <div>
        <h1 class="text-base font-semibold text-fg">Choose a plan to continue</h1>
        <p class="mt-1 text-sm text-fg-muted">Select Free or a paid plan with your Clippster account.</p>
      </div>
      <a :href="accountBilling" target="_top" class="button-primary">Choose a plan</a>
    </div>
  </div>
  <div v-else class="flex h-screen flex-col overflow-hidden bg-canvas">
    <header v-if="!embedded" class="flex h-9 shrink-0 items-center justify-center">
      <AppBrand class="opacity-80" />
    </header>
    <div class="flex min-h-0 flex-1">
      <aside
        v-if="!embedded"
        class="flex w-[var(--sidebar-width-collapsed)] shrink-0 flex-col md:w-[var(--sidebar-width)]"
      >
        <nav class="flex flex-1 flex-col gap-1 px-2 pt-1 md:px-2.5" aria-label="Main navigation">
          <p
            class="mb-1 hidden px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-text-muted)] opacity-70 md:block"
          >
            Browse
          </p>
          <SidebarNavigationItem
            name="Download Video"
            :active="toolView === 'download'"
            href="#new-project"
            :icon="Video"
            :collapsed="compact"
            @click.prevent="
              toolView = 'download'
              creating = false
            "
          />
          <p
            class="mb-1 mt-4 hidden px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-text-muted)] opacity-70 md:block"
          >
            Library
          </p>
          <SidebarNavigationItem
            name="Video"
            href="#projects"
            :icon="Folder"
            :collapsed="compact"
            :active="!toolView"
            @click.prevent="
              toolView = ''
              creating = false
            "
          />
          <SidebarNavigationItem
            name="Built Clips"
            href="#built-clips"
            :icon="LayoutGrid"
            :collapsed="compact"
            :active="toolView === 'built'"
            @click.prevent="
              toolView = 'built'
              creating = false
            "
          />
        </nav>
        <div class="p-2">
          <p class="mb-1 hidden truncate px-2.5 text-xs text-fg-subtle md:block">{{ user.email }}</p>
          <SidebarNavigationItem
            name="Sign out"
            href="#sign-out"
            :icon="LogOut"
            :collapsed="compact"
            @click.prevent="logout"
          />
        </div>
      </aside>
      <main class="min-w-0 flex-1">
        <ProjectWorkspacePage
          v-if="state.workspace.value"
          :key="state.workspace.value.project.id"
          :project="state.workspace.value.project"
          :initial-clip-id="initialClipId"
          :busy="state.busy.value"
          :error="state.error.value"
          :active-job="state.activeJob.value"
          :upload-progress="state.uploadProgress.value"
          :billing-url="accountBilling"
          @close="close"
          @workspace-updated="state.workspace.value = $event"
          @import="(url) => run(() => state.action((id) => projects.importSource(id, url)))"
          @upload="(file) => run(() => state.uploadSource(file))"
          @detect="
            (options) => run(() => state.action((id) => workspaceClient.post(`/web/projects/${id}/detect`, options)))
          "
          @transcribe="
            (organizationId) =>
              run(() =>
                state.action((id) => workspaceClient.post(`/web/projects/${id}/transcribe`, { organizationId }))
              )
          "
          @cancel="(id) => run(() => state.action(() => projects.cancel(id)))"
        />
        <CreatorProfiles v-else-if="toolView === 'creators'" />
        <StreamVods v-else-if="toolView === 'download'" :platform="vodSearch.platform" :channel="vodSearch.channel" />
        <BuiltClips v-else-if="toolView === 'built'" @open="openBuiltProject" />
        <ClipperProfile v-else-if="toolView === 'profile'" style="height: 100%; min-height: 0" />
        <WebAccountSettings v-else-if="toolView === 'settings'" />
        <AccountTools v-else-if="toolView" :view="toolView" :billing-url="accountBilling" />
        <ProjectLibraryView v-else :model="libraryModel">
          <template #notice>
            <p v-if="error" role="alert" class="m-6 rounded-lg bg-red-500/10 p-3 text-red-300">{{ error }}</p>
          </template>
          <template #project-status="{ project }">
            <span
              v-if="project.status === 'error'"
              class="project-card__badge bg-red-500/20 text-red-300"
              :title="project.error || 'Download failed'"
            >
              Download failed
            </span>
          </template>
          <template #extra-actions="{ project }">
            <button
              v-if="project.status === 'error' && project.sourceUrl"
              title="Retry download"
              class="project-card__action-btn"
              @click.stop="retryDownload(project)"
            >
              <Download class="project-card__action-icon" />
            </button>
          </template>
        </ProjectLibraryView>
      </main>
    </div>
    <ProjectDialog
      v-model="creating"
      :saving="working"
      :project="
        editingProject
          ? {
              id: editingProject.id,
              name: editingProject.name,
              description: editingProject.description,
              creator_profile_id: editingProject.creatorId ? String(editingProject.creatorId) : null
            }
          : null
      "
      @submit="submitProject"
    />
    <ProjectLibrarySearch :model="searchPaletteModel" />
  </div>
</template>
<script setup lang="ts">
  import { ref, reactive, computed, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue'
  import { refreshWorkspacePermissions } from './workspacePermissions'
  import { Folder, Search, Radio, Video, Download, LogOut, LayoutGrid } from 'lucide-vue-next'
  import type { AuthUser, WebProject, WebJob } from '@clippster/shared-types'
  import { needsPlanSelection } from '@clippster/shared-types'
  import AppBrand from '@/components/AppBrand.vue'
  import ProjectDialog, { type ProjectFormData } from '@/components/ProjectDialog.vue'
  import ProjectLibrarySearch from '@/components/ProjectLibrarySearch.vue'
  import { selectedVideoFile, releaseSelectedFiles } from './creatorProfileRuntime'
  import { upload } from './api'
  import ProjectLibraryView from '@/components/ProjectLibraryView.vue'
  import { statusOptions, sortOptions, getDateLabel } from '@/lib/projectLibraryPresentation'
  import { useFormatters } from '@/composables/useFormatters'
  import SidebarNavigationItem from '@/components/SidebarNavigationItem.vue'
  import AuthScreen from './components/AuthScreen.vue'
  const AccountTools = defineAsyncComponent(() => import('./components/AccountTools.vue'))
  const CreatorProfiles = defineAsyncComponent(() => import('./components/CreatorProfiles.vue'))
  const StreamVods = defineAsyncComponent(() => import('./components/StreamVods.vue'))
  const ProjectWorkspacePage = defineAsyncComponent(() => import('./components/ProjectWorkspacePage.vue'))
  const BuiltClips = defineAsyncComponent(() => import('./components/BuiltClips.vue'))
  const ClipperProfile = defineAsyncComponent(() => import('@/pages/ClipperProfilePage.vue'))
  const WebAccountSettings = defineAsyncComponent(() => import('./components/WebAccountSettings.vue'))
  import { auth, client, workspaceClient, projects, sessionExpired, sourcePath, errorMessage } from './api'
  import { useWorkspace } from './useWorkspace'
  import { setWorkspaceAccount } from './workspaceAccount'
  const user = ref<AuthUser | null>(null)
  watch(user, (value) => setWorkspaceAccount(value), { immediate: true })
  const params = new URLSearchParams(location.search)
  const embedded = params.has('embedded')
  const toolViews = ['download', 'creators', 'campaigns', 'prompts', 'calendar', 'built', 'profile', 'settings']
  const toolView = ref(toolViews.includes(params.get('view') || '') ? params.get('view')! : '')
  const initialClipId = ref<string | null>(params.get('clip'))
  const vodSearch = ref({
    platform: params.get('platform') || '',
    channel: params.get('channel') || params.get('id') || ''
  })
  const accountBilling = ref('/account/billing')
  const booting = ref(true)
  const items = ref<WebProject[]>([])
  const libraryJobs = ref<WebJob[]>([])
  const searchQuery = ref(''),
    statusFilter = ref('all'),
    sortBy = ref('updated-desc'),
    viewMode = ref('folders')
  const { getRelativeTime, formatDuration } = useFormatters()
  const selectedProjects = ref<string[]>([])
  const media = matchMedia('(max-width: 767px)')
  const compact = ref(media.matches)
  const resize = () => {
    compact.value = media.matches
  }
  media.addEventListener('change', resize)
  onUnmounted(() => media.removeEventListener('change', resize))
  const error = ref('')
  const loading = ref(false)
  const working = ref(false)
  const creating = ref(false)
  const editingProject = ref<WebProject | null>(null),
    showLibrarySearch = ref(false)
  const state = useWorkspace()
  const activeProjectIds = computed(
    () => new Set(libraryJobs.value.filter((job) => job.kind === 'import').map((job) => job.projectId))
  )
  const libraryProjects = computed(() =>
    items.value
      .filter((project) => !activeProjectIds.value.has(project.id))
      .map((project) => ({ ...project, updated_at: new Date(project.updatedAt).toISOString() }))
  )
  const libraryFiltered = computed(() =>
    libraryProjects.value
      .filter(
        (project) =>
          project.name.toLowerCase().includes(searchQuery.value.toLowerCase()) &&
          (statusFilter.value === 'all' || (statusFilter.value === 'has_clips' && project.clips.length > 0))
      )
      .sort((a, b) =>
        sortBy.value.startsWith('name')
          ? (sortBy.value.endsWith('asc') ? 1 : -1) * a.name.localeCompare(b.name)
          : (sortBy.value.endsWith('asc') ? 1 : -1) *
            (sortBy.value.startsWith('created') ? a.createdAt - b.createdAt : a.updatedAt - b.updatedAt)
      )
  )
  const libraryPage = ref(1)
  const libraryPaginated = computed(() =>
    libraryFiltered.value.slice((libraryPage.value - 1) * 20, libraryPage.value * 20)
  )
  const libraryGroups = computed(() => {
    if (sortBy.value.startsWith('name')) return [{ dateLabel: 'Projects', projects: libraryPaginated.value }]
    const date = (project: WebProject) =>
      getDateLabel(sortBy.value.startsWith('created') ? project.createdAt : project.updatedAt)
    return Array.from(new Set(libraryPaginated.value.map(date))).map((dateLabel) => ({
      dateLabel,
      projects: libraryPaginated.value.filter((project) => date(project) === dateLabel)
    }))
  })
  const downloadCards = computed(() =>
    libraryJobs.value
      .filter((job) => job.kind === 'import')
      .map((job) => ({
        id: job.id,
        message: job.message,
        title: items.value.find((project) => project.id === job.projectId)?.name || 'Downloading video',
        isQueued: job.status === 'queued',
        progress: { progress: job.progress }
      }))
  )
  const findProject = (id: string) => items.value.find((project) => project.id === id)
  const ready = (id: string) => findProject(id)?.status === 'ready'
  async function retryDownload(project: WebProject) {
    if (!project.sourceUrl) return
    try {
      await projects.importSource(project.id, project.sourceUrl, project.sourceRange)
      await load()
    } catch (cause) {
      error.value = errorMessage(cause)
    }
  }
  const libraryModel = reactive({
    projects: libraryProjects,
    filteredProjects: libraryFiltered,
    paginatedProjects: libraryPaginated,
    groupedProjects: libraryGroups,
    loading,
    searchQuery,
    statusFilter,
    sortBy,
    viewMode,
    currentPage: libraryPage,
    totalPages: computed(() => Math.max(1, Math.ceil(libraryFiltered.value.length / 20))),
    statusOptions,
    sortOptions,
    assetBase: '/workspace',
    selectedProjects: computed(() => new Set(selectedProjects.value)),
    clearSelection: () => {
      selectedProjects.value = []
    },
    isProjectSelected: (id: string) => selectedProjects.value.includes(id),
    toggleProjectSelection: (id: string) => {
      selectedProjects.value = selectedProjects.value.includes(id)
        ? selectedProjects.value.filter((value) => value !== id)
        : [...selectedProjects.value, id]
    },
    selectAllCurrentPage: () => {
      selectedProjects.value = libraryPaginated.value.map((project) => project.id)
    },
    confirmBulkDelete: deleteSelected,
    hasAnySelectedProjectDetecting: () =>
      libraryJobs.value.some((job) => selectedProjects.value.includes(job.projectId)),
    getActiveDownloads: () => downloadCards.value.filter((download) => !download.isQueued),
    getQueuedDownloads: () => downloadCards.value.filter((download) => download.isQueued),
    handleCancelAllDownloads: async () => {
      await Promise.all(libraryJobs.value.filter((job) => job.kind === 'import').map((job) => projects.cancel(job.id)))
      await load()
    },
    goToPage: (page: number) => {
      libraryPage.value = page
    },
    nextPage: () => {
      libraryPage.value++
    },
    previousPage: () => {
      libraryPage.value--
    },
    handleProjectClick: (project: WebProject) => {
      if (project.status === 'ready') void open(project.id)
    },
    editProject: renameProject,
    openCreateDialog: () => {
      editingProject.value = null
      creating.value = true
    },
    openSearchPalette: () => {
      showLibrarySearch.value = true
    },
    getThumbnailUrl: (id: string) => (ready(id) ? sourcePath(id).replace(/\/source$/, '/thumbnail') : undefined),
    getRelativeTime: (date: string) => getRelativeTime(new Date(date).getTime()),
    getProjectDuration: (id: string) => (findProject(id)?.duration ? formatDuration(findProject(id)!.duration) : ''),
    getClipCount: (id: string) => findProject(id)?.clips.length || 0,
    getProjectPlatform: (project: WebProject) =>
      project.sourceUrl?.includes('kick.com')
        ? 'Kick'
        : project.sourceUrl?.includes('twitch.tv')
          ? 'Twitch'
          : project.sourceUrl?.includes('youtu')
            ? 'YouTube'
            : 'Manual',
    canDetectClips: (id: string) => ready(id) && !!findProject(id)?.hasAudio,
    canTranscribe: (id: string) => ready(id) && !!findProject(id)?.hasAudio,
    isProjectDetecting: (id: string) => libraryJobs.value.some((job) => job.projectId === id && job.kind === 'detect'),
    isProjectTranscribed: (id: string) => !!findProject(id)?.words.length,
    startProjectDetection: (project: WebProject) => open(project.id),
    startTranscription: async (project: WebProject) => {
      await workspaceClient.post(`/web/projects/${project.id}/transcribe`)
      await load()
    },
    openVodPresetEditor: (project: WebProject) => open(project.id),
    isAIAllowed: true,
    hasDirectVideos: ready,
    hasChildren: () => false,
    getChildCount: () => 0,
    hasVodPreset: () => false,
    vodPresetConfigs: {},
    isLiveClipsContainerProject: () => false,
    isProjectLive: () => false,
    mockProjectActive: false
  })
  const paletteSearchQuery = ref(''),
    paletteActiveTab = ref('search')
  const closeSearchPalette = () => {
    showLibrarySearch.value = false
    paletteSearchQuery.value = ''
    paletteActiveTab.value = 'search'
  }
  const searchPaletteModel = reactive({
    showSearchPalette: showLibrarySearch,
    paletteSearchQuery,
    paletteActiveTab,
    projectsPaletteTabs: computed(() => [
      { id: 'search', label: 'Search All', icon: Search },
      { id: 'live', label: 'Live Projects', icon: Radio },
      {
        id: 'with_clips',
        label: 'With Clips',
        icon: Video,
        badge: libraryProjects.value.filter((project) => project.clips.length).length || undefined
      }
    ]),
    paletteSearchResults: computed(() =>
      !paletteSearchQuery.value && paletteActiveTab.value === 'search'
        ? []
        : libraryProjects.value
            .filter(
              (project) =>
                (project.name + ' ' + (project.description || ''))
                  .toLowerCase()
                  .includes(paletteSearchQuery.value.toLowerCase()) &&
                paletteActiveTab.value !== 'live' &&
                (paletteActiveTab.value !== 'with_clips' || project.clips.length > 0)
            )
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 20)
            .map((project) => ({
              id: project.id,
              project,
              thumbnailUrl: libraryModel.getThumbnailUrl(project.id),
              isLive: false,
              clipCount: project.clips.length,
              platform: libraryModel.getProjectPlatform(project)
            }))
    ),
    closeSearchPalette,
    onPaletteTabChange: (tab: string) => {
      paletteActiveTab.value = tab
      paletteSearchQuery.value = ''
    },
    selectPaletteResult: (result: { project: WebProject }) => {
      closeSearchPalette()
      libraryModel.handleProjectClick(result.project)
    }
  })
  watch(showLibrarySearch, (shown) => {
    if (shown) paletteSearchQuery.value = searchQuery.value
  })
  const showLibrary = () => {
    toolView.value = ''
    state.close()
    void load()
  }
  const refreshLibrary = () => {
    void load(true)
  }
  window.addEventListener('clippster-show-library', showLibrary)
  window.addEventListener('clippster-refresh-library', refreshLibrary)
  const libraryPoll = setInterval(() => {
    if (user.value && !toolView.value && !state.workspace.value && libraryJobs.value.length) void load(true)
  }, 2500)
  onUnmounted(() => {
    clearInterval(libraryPoll)
    window.removeEventListener('clippster-show-library', showLibrary)
    window.removeEventListener('clippster-refresh-library', refreshLibrary)
  })
  const openCreatorProject = (event: Event) => {
    const id = (event as CustomEvent<string>).detail
    if (typeof id === 'string') {
      toolView.value = ''
      void open(id)
    }
  }
  const searchCreatorVods = (event: Event) => {
    const detail = (event as CustomEvent<{ platform: string; channel: string }>).detail
    if (detail?.platform && detail?.channel) {
      vodSearch.value = detail
      toolView.value = 'download'
    }
  }
  window.addEventListener('clippster-search-vods', searchCreatorVods)
  onUnmounted(() => window.removeEventListener('clippster-search-vods', searchCreatorVods))
  window.addEventListener('clippster-open-project', openCreatorProject)
  onUnmounted(() => window.removeEventListener('clippster-open-project', openCreatorProject))
  function renameProject(project: WebProject) {
    editingProject.value = project
    creating.value = true
  }
  async function deleteSelected() {
    if (!window.confirm(`Delete ${selectedProjects.value.length} projects and all their clips?`)) return
    await run(async () => {
      try {
        for (const id of [...selectedProjects.value]) {
          await projects.remove(id)
          selectedProjects.value = selectedProjects.value.filter((value) => value !== id)
        }
      } finally {
        await load()
      }
    })
  }
  watch(
    () => state.workspace.value?.jobs[0]?.status,
    (status, previous) => {
      if (embedded && status === 'completed' && previous !== 'completed')
        window.parent.postMessage({ type: 'clippster-account-refresh' }, location.origin)
    }
  )
  watch(sessionExpired, (expired) => {
    if (expired) {
      user.value = null
      items.value = []
      state.close()
    }
  })
  let refreshingLibrary = false
  async function load(silent = false) {
    if (refreshingLibrary) return
    refreshingLibrary = true
    if (!silent) loading.value = true
    try {
      const result = await projects.list()
      items.value = result.projects
      libraryJobs.value = result.jobs || []
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      loading.value = false
      refreshingLibrary = false
    }
  }
  async function signedIn(value: AuthUser) {
    sessionExpired.value = false
    user.value = value
    if (!needsPlanSelection(value)) await Promise.allSettled([load(), refreshWorkspacePermissions()])
  }
  async function logout() {
    await client.post('/auth/logout')
    user.value = null
    items.value = []
    state.close()
  }
  function updateWorkspaceUrl(id: string | null) {
    const url = new URL(location.href)
    if (id) url.searchParams.set('project', id)
    else url.searchParams.delete('project')
    if (id && initialClipId.value) url.searchParams.set('clip', initialClipId.value)
    else url.searchParams.delete('clip')
    if (url.href !== location.href) {
      if (embedded) history.replaceState(null, '', url)
      else history.pushState(null, '', url)
    }
    if (embedded)
      window.parent.postMessage(
        { type: 'clippster-workspace-navigation', projectId: id, clipId: initialClipId.value, view: toolView.value },
        location.origin
      )
  }
  async function open(id: string) {
    error.value = ''
    try {
      await state.open(id)
      updateWorkspaceUrl(id)
    } catch (cause) {
      error.value = errorMessage(cause)
    }
  }
  async function close() {
    initialClipId.value = null
    state.close()
    updateWorkspaceUrl(null)
    await load()
  }
  async function openBuiltProject(id: string, clipId: string) {
    initialClipId.value = clipId
    await open(id)
  }
  const restoreWorkspace = () => {
    const query = new URL(location.href).searchParams
    initialClipId.value = query.get('clip')
    const id = query.get('project')
    if (id && user.value) void open(id)
    else {
      state.close()
      toolView.value = toolViews.includes(query.get('view') || '') ? query.get('view')! : ''
      void load()
    }
  }
  window.addEventListener('popstate', restoreWorkspace)
  onUnmounted(() => window.removeEventListener('popstate', restoreWorkspace))
  watch(toolView, (next, previous) => {
    if (next === previous) return
    if (state.workspace.value) {
      state.close()
      updateWorkspaceUrl(null)
    }
    if (!embedded) {
      const url = new URL(location.href)
      url.searchParams.set('view', next || 'library')
      if (url.href !== location.href) history.pushState(null, '', url)
    }
  })
  async function submitProject(data: ProjectFormData) {
    if (working.value) return
    working.value = true
    error.value = ''
    try {
      const result = editingProject.value ? { project: editingProject.value } : await projects.create(data.name)
      await workspaceClient.patch('/web/projects/' + result.project.id, {
        name: data.name,
        description: data.description,
        creatorId: data.creatorProfileId ? Number(data.creatorProfileId) : null
      })
      if (!editingProject.value) {
        for (let index = 0; index < data.selectedVideoPaths.length; index++) {
          const videoProject =
            index === 0 ? result : await projects.create(`${data.name} · Part ${index + 1}`.slice(0, 120))
          if (index > 0)
            await workspaceClient.patch(`/web/projects/${videoProject.project.id}`, {
              description: data.description,
              creatorId: data.creatorProfileId ? Number(data.creatorProfileId) : null,
              folder: data.name
            })
          await upload(videoProject.project.id, selectedVideoFile(data.selectedVideoPaths[index]), () => {})
        }
      }
      creating.value = false
      editingProject.value = null
      releaseSelectedFiles()
      await load()
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      working.value = false
    }
  }
  async function run(operation: () => Promise<unknown>) {
    try {
      await operation()
      if (embedded) window.parent.postMessage({ type: 'clippster-account-refresh' }, location.origin)
    } catch {
      /* The workspace keeps the actionable error visible. */
    }
  }
  onMounted(async () => {
    const settings = await client.get<{ accountOrigin: string }>('/auth/config').catch(() => null)
    if (settings && !embedded) accountBilling.value = `${settings.accountOrigin}/account/billing`
    try {
      const result = await auth.me()
      if (result.success && result.user) {
        await signedIn(result.user)
        const projectId = params.get('project')
        if (projectId && !needsPlanSelection(result.user)) await open(projectId)
      }
    } catch {
      error.value = 'Unable to connect to Clippster.'
    } finally {
      booting.value = false
    }
  })
</script>
