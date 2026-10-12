<template>
  <div v-if="booting" class="flex min-h-screen items-center justify-center gap-2 text-sm text-fg-muted" role="status">
    <Loader2 :size="16" class="animate-spin text-fg-subtle" />
    Opening your workspace…
  </div>
  <div v-else-if="!user && embedded" class="flex min-h-screen items-center justify-center p-6">
    <div class="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-surface p-6 text-center shadow-[var(--shadow-lg)]">
      <p class="text-sm text-fg-muted">Your session expired. Sign in to continue.</p>
      <a href="/login" target="_top" class="button-primary">Sign in</a>
    </div>
  </div>
  <AuthScreen v-else-if="!user" @authenticated="signedIn" />
  <div v-else-if="needsPlanSelection(user)" class="flex min-h-screen items-center justify-center p-6">
    <div class="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-surface p-6 text-center shadow-[var(--shadow-lg)]">
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
      <aside v-if="!embedded" class="flex w-[var(--sidebar-width-collapsed)] shrink-0 flex-col md:w-[var(--sidebar-width)]">
        <nav class="flex flex-1 flex-col gap-3 px-2 pt-1 md:px-2.5" aria-label="Main navigation">
          <div>
            <p class="hidden px-2.5 pb-1 pt-1 text-2xs font-medium text-fg-subtle md:block">Browse</p>
            <SidebarNavigationItem
              name="Download Video"
              href="#new-project"
              :icon="Video"
              :collapsed="compact"
              @click.prevent="creating = true"
            />
          </div>
          <div>
            <p class="hidden px-2.5 pb-1 pt-1 text-2xs font-medium text-fg-subtle md:block">Library</p>
            <SidebarNavigationItem
              name="Video"
              href="#projects"
              :icon="Folder"
              :collapsed="compact"
              active
              @click.prevent="creating = false"
            />
          </div>
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
      <main
        class="min-w-0 flex-1 overflow-hidden"
        :class="embedded ? 'bg-panel' : 'mb-[var(--panel-inset)] mr-[var(--panel-inset)] rounded-xl border border-line-subtle bg-panel'"
      >
        <AccountTools v-if="toolView" :view="toolView" :billing-url="accountBilling" />
        <PageLayout v-else title="Video Library" description="Manage and organize your video projects" :show-header="true" :icon="Folder">
          <template #actions>
            <button class="button-primary" @click="creating = true">
              <Plus :size="16" />
              New project
            </button>
          </template>
          <template #toolbar>
            <label class="relative flex w-56 min-w-0 items-center">
              <Search :size="14" class="pointer-events-none absolute left-2.5 text-fg-subtle" />
              <input v-model="searchQuery" class="field pl-8" aria-label="Search projects" placeholder="Search projects…" />
            </label>
            <div class="ml-auto flex items-center gap-2">
              <select v-model="statusFilter" class="field w-auto" aria-label="Project status">
                <option value="all">All projects</option>
                <option value="ready">Ready</option>
                <option value="has_clips">Has clips</option>
                <option value="error">Failed</option>
                <option value="empty">Empty</option>
              </select>
              <select v-model="sortBy" class="field w-auto" aria-label="Sort projects">
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name">Name</option>
              </select>
              <select v-model="viewMode" class="field w-auto" aria-label="Library view">
                <option value="folders">Folders</option>
                <option value="grid">Grid</option>
                <option value="list">List</option>
              </select>
            </div>
          </template>
          <div class="flex flex-1 flex-col px-5 py-4">
            <p
              v-if="error && !creating"
              role="alert"
              class="mb-4 rounded-lg border border-[var(--danger-line)] bg-danger-soft px-3 py-2.5 text-sm text-danger"
            >
              {{ error }}
            </p>
            <div v-if="loading" role="status" class="flex flex-1 items-center justify-center gap-2 text-sm text-fg-muted">
              <Loader2 :size="16" class="animate-spin text-fg-subtle" />
              Loading projects…
            </div>
            <div v-else-if="!items.length" class="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
              <span class="grid size-12 place-items-center rounded-xl border border-line bg-surface-hover text-fg-muted">
                <Folder :size="22" />
              </span>
              <div>
                <h3 class="text-base font-semibold text-fg">No projects yet</h3>
                <p class="mt-1 text-sm text-fg-muted">Download a video or upload a file to start clipping.</p>
              </div>
              <button class="button-primary mt-1" @click="creating = true">
                <Plus :size="16" />
                New project
              </button>
            </div>
            <div v-else class="flex flex-col gap-5">
              <div class="flex min-h-7 flex-wrap items-center gap-3 text-sm text-fg-muted">
                <label class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    class="size-4 accent-[var(--brand)]"
                    :checked="visibleProjects.length > 0 && visibleProjects.every(p => selectedProjects.includes(p.id))"
                    @change="selectedProjects = ($event.target as HTMLInputElement).checked ? visibleProjects.map(p => p.id) : []"
                  />
                  Select visible
                </label>
                <template v-if="selectedProjects.length">
                  <span class="tabular font-medium text-fg">{{ selectedProjects.length }} selected</span>
                  <button class="button-secondary" :disabled="working" @click="moveSelected">Move to folder</button>
                  <button class="button-secondary !text-danger" :disabled="working" @click="deleteSelected">Delete</button>
                </template>
              </div>
              <p v-if="!visibleProjects.length" class="py-10 text-center text-sm text-fg-muted">No projects match your filters.</p>
              <section v-for="group in groups" :key="group.label" class="flex flex-col gap-2.5">
                <h3 class="text-sm font-semibold text-fg">
                  {{ group.label }}
                  <span class="tabular ml-1 font-normal text-fg-subtle">{{ group.projects.length }}</span>
                </h3>
                <div :class="viewMode === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3'">
                  <LibraryProjectCard
                    v-for="project in group.projects"
                    :key="project.id"
                    :name="project.name"
                    :list="viewMode === 'list'"
                    :selected="selectedProjects.includes(project.id)"
                    @open="open(project.id)"
                  >
                    <template #badges>
                      <input
                        v-model="selectedProjects"
                        type="checkbox"
                        :value="project.id"
                        :aria-label="`Select ${project.name}`"
                        class="size-4 shrink-0 accent-[var(--brand)]"
                        :class="viewMode === 'list' ? '' : 'absolute left-2.5 top-2.5 z-20'"
                        @click.stop
                      />
                    </template>
                    <template v-if="project.status === 'ready'" #thumbnail>
                      <video :src="sourcePath(project.id) + '#t=0.1'" preload="metadata" muted class="h-full w-full object-cover" />
                    </template>
                    <template #meta>
                      <span class="flex items-center gap-1.5 text-xs text-fg-muted">
                        <span>{{ new Date(project.updatedAt).toLocaleDateString() }}</span>
                        <span class="text-fg-disabled">·</span>
                        <span class="tabular">{{ project.status === 'ready' ? `${Math.ceil(project.duration / 60)} min` : project.status }}</span>
                        <span class="text-fg-disabled">·</span>
                        <span class="tabular">{{ project.clips.length }} clips</span>
                      </span>
                    </template>
                    <template #actions>
                      <button
                        class="grid size-7 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
                        title="Rename project"
                        :aria-label="`Rename ${project.name}`"
                        @click.stop="renameProject(project)"
                      >
                        <Pencil :size="14" />
                      </button>
                      <button
                        class="grid size-7 place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
                        :aria-label="`Open workspace: ${project.name}`"
                        title="Open workspace"
                        @click.stop="open(project.id)"
                      >
                        <Edit :size="14" />
                      </button>
                      <button
                        class="grid size-7 place-items-center rounded-md text-fg-muted transition-colors hover:bg-danger-soft hover:text-danger"
                        :aria-label="`Delete ${project.name}`"
                        title="Delete project"
                        :disabled="working"
                        @click.stop="removeProject(project.id, project.name)"
                      >
                        <Trash2 :size="14" />
                      </button>
                    </template>
                  </LibraryProjectCard>
                </div>
              </section>
            </div>
          </div>
        </PageLayout>
      </main>
    </div>
    <ProjectDialogFrame :model-value="creating" :loading="working" @close="creating = false" @submit="create">
      <form class="flex flex-col gap-4" @submit.prevent="create">
        <div class="flex flex-col gap-1.5">
          <label for="web-project-name" class="text-xs font-medium text-fg-muted">
            Project name
            <span class="text-danger">*</span>
          </label>
          <input
            id="web-project-name"
            ref="nameInput"
            v-model="projectName"
            class="field"
            required
            minlength="2"
            maxlength="120"
            placeholder="Enter a project name"
          />
        </div>
        <p v-if="error" role="alert" class="text-xs text-danger">{{ error }}</p>
      </form>
    </ProjectDialogFrame>
    <BrowserProjectWorkspace
      v-if="state.workspace.value"
      :key="state.workspace.value.project.id"
      :project="state.workspace.value.project"
      :busy="state.busy.value"
      :error="state.error.value"
      :active-job="state.activeJob.value"
      :upload-progress="state.uploadProgress.value"
      :billing-url="accountBilling"
      @close="close"
      @import="(url) => run(() => state.action((id) => projects.importSource(id, url)))"
      @upload="(file) => run(() => state.uploadSource(file))"
      @detect="(prompt) => run(() => state.action((id) => projects.detect(id, prompt)))"
      @transcribe="run(() => state.action((id) => workspaceClient.post(`/web/projects/${id}/transcribe`)))"
      @manual="manual"
      @transcript-clip="(start, end) => manual(start, end)"
      @save="save"
      @build="(id) => run(() => state.action((projectId) => projects.build(projectId, id)))"
      @remove="(id) => run(() => state.action((projectId) => projects.removeClip(projectId, id)))"
      @cancel="(id) => run(() => state.action(() => projects.cancel(id)))"
    />
  </div>
</template>
<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, nextTick, defineAsyncComponent } from 'vue'
  import { Folder, Plus, Video, Edit, Trash2, LogOut, Pencil, Search, Loader2 } from 'lucide-vue-next'
  import type { AuthUser, WebProject, WebClip } from '@clippster/shared-types'
  import { needsPlanSelection } from '@clippster/shared-types'
  import AppBrand from '../../../client/src/components/AppBrand.vue'
  import ProjectDialogFrame from '../../../client/src/components/ProjectDialogFrame.vue'
  import PageLayout from '../../../client/src/components/PageLayout.vue'
  import LibraryProjectCard from '../../../client/src/components/LibraryProjectCard.vue'
  import SidebarNavigationItem from '../../../client/src/components/SidebarNavigationItem.vue'
  import AuthScreen from './components/AuthScreen.vue'
  const AccountTools = defineAsyncComponent(() => import('./components/AccountTools.vue'))
  const BrowserProjectWorkspace = defineAsyncComponent(() => import('./components/BrowserProjectWorkspace.vue'))
  import { auth, client, workspaceClient, projects, sessionExpired, sourcePath, errorMessage } from './api'
  import { useWorkspace } from './useWorkspace'
  const user = ref<AuthUser | null>(null)
  const params = new URLSearchParams(location.search)
  const embedded = params.has('embedded')
  const toolView = ['creators', 'campaigns', 'prompts', 'calendar'].includes(params.get('view') || '') ? params.get('view')! : ''
  const accountBilling = ref('/account/billing')
  const booting = ref(true)
  const items = ref<WebProject[]>([])
  const searchQuery = ref(''), statusFilter = ref('all'), sortBy = ref('newest'), viewMode = ref('folders')
  const selectedProjects = ref<string[]>([])
  const visibleProjects = computed(() => items.value.filter(project =>
    `${project.name} ${project.folder || ''}`.toLowerCase().includes(searchQuery.value.toLowerCase()) &&
    (statusFilter.value === 'all' || (statusFilter.value === 'has_clips' ? project.clips.length > 0 : project.status === statusFilter.value)))
    .sort((a, b) => sortBy.value === 'name' ? a.name.localeCompare(b.name) : sortBy.value === 'oldest' ? a.updatedAt - b.updatedAt : b.updatedAt - a.updatedAt))
  const groups = computed(() => {
    const values = new Map<string, WebProject[]>()
    const today = new Date().toLocaleDateString()
    for (const project of visibleProjects.value) {
      const day = new Date(project.updatedAt).toLocaleDateString()
      const label = viewMode.value === 'folders' ? project.folder || 'Unfiled' : day === today ? 'Today' : day
      values.set(label, [...(values.get(label) || []), project])
    }
    return Array.from(values, ([label, projects]) => ({ label, projects }))
  })
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
  const projectName = ref('')
  const nameInput = ref<HTMLInputElement>()
  const state = useWorkspace()
  async function renameProject(project: WebProject) {
    const name = window.prompt('Project name', project.name)
    if (!name?.trim()) return
    await run(async () => { await workspaceClient.patch(`/web/projects/${project.id}`, { name }); await load() })
  }
  async function moveSelected() {
    const folder = window.prompt('Folder name (leave empty for Unfiled)')
    if (folder === null) return
    await run(async () => { for (const id of selectedProjects.value) await workspaceClient.patch(`/web/projects/${id}`, { folder }); selectedProjects.value = []; await load() })
  }
  async function deleteSelected() {
    if (!window.confirm(`Delete ${selectedProjects.value.length} projects and all their clips?`)) return
    await run(async () => { try { for (const id of [...selectedProjects.value]) { await projects.remove(id); selectedProjects.value = selectedProjects.value.filter(value => value !== id) } } finally { await load() } })
  }
  watch(() => state.workspace.value?.jobs[0]?.status, (status, previous) => {
    if (embedded && status === 'completed' && previous !== 'completed')
      window.parent.postMessage({ type: 'clippster-account-refresh' }, location.origin)
  })
  watch(creating, async (value) => {
    if (value) {
      await nextTick()
      nameInput.value?.focus()
    }
  })
  watch(sessionExpired, (expired) => {
    if (expired) {
      user.value = null
      items.value = []
      state.close()
    }
  })
  async function load() {
    loading.value = true
    try {
      items.value = (await projects.list()).projects
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      loading.value = false
    }
  }
  async function signedIn(value: AuthUser) {
    sessionExpired.value = false
    user.value = value
    if (!needsPlanSelection(value)) await load()
    if (embedded && params.get('view') === 'download' && !needsPlanSelection(value)) creating.value = true
  }
  async function logout() {
    await client.post('/auth/logout')
    user.value = null
    items.value = []
    state.close()
  }
  async function open(id: string) {
    error.value = ''
    try {
      await state.open(id)
    } catch (cause) {
      error.value = errorMessage(cause)
    }
  }
  async function close() {
    state.close()
    await load()
  }
  async function create() {
    if (!nameInput.value?.reportValidity()) return
    working.value = true
    error.value = ''
    try {
      const result = await projects.create(projectName.value)
      creating.value = false
      projectName.value = ''
      await load()
      await open(result.project.id)
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      working.value = false
    }
  }
  async function removeProject(id: string, name: string) {
    if (!window.confirm(`Delete “${name}” and all its source files and clips?`)) return
    working.value = true
    error.value = ''
    try {
      await projects.remove(id)
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
  async function manual(time: number, end?: number) {
    const project = state.workspace.value?.project
    if (!project) return
    const start = Math.min(time, project.duration - 0.1)
    await run(() =>
      state.saveClip({
        name: `Clip ${project.clips.length + 1}`,
        aspectRatio: '9:16',
        captions: false,
        segments: [{ start_time: start, end_time: Math.min(end ?? start + 30, project.duration) }]
      })
    )
  }
  async function save(clip: WebClip, build: boolean) {
    await run(async () => {
      await state.saveClip(clip, clip.id, clip.revision)
      if (build) await state.action((id) => projects.build(id, clip.id))
    })
  }
  onMounted(async () => {
    const settings = await client.get<{ accountOrigin: string }>('/auth/config').catch(() => null)
    if (settings && !embedded) accountBilling.value = `${settings.accountOrigin}/account/billing`
    try {
      const result = await auth.me()
      if (result.success && result.user) await signedIn(result.user)
    } catch {
      error.value = 'Unable to connect to Clippster.'
    } finally {
      booting.value = false
    }
  })
</script>
