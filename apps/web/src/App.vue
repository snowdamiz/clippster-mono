<template>
  <div v-if="booting" class="flex min-h-screen items-center justify-center text-sm text-zinc-500" role="status">
    Opening your workspace…
  </div>
  <AuthScreen v-else-if="!user" @authenticated="signedIn" />
  <div v-else class="flex h-screen flex-col overflow-hidden">
    <header class="flex h-8 shrink-0 items-center justify-center border-b border-[var(--sidebar-border)] bg-[#0a0a0b]">
      <AppBrand />
    </header>
    <div class="flex min-h-0 flex-1">
      <aside class="flex w-12 shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] md:w-60">
        <nav class="flex-1 p-1.5 md:p-3" aria-label="Main navigation">
          <p
            class="mb-1 hidden px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-[var(--sidebar-text-muted)] opacity-70 md:block"
          >
            Browse
          </p>
          <SidebarNavigationItem
            name="Download Video"
            href="#new-project"
            :icon="Video"
            :collapsed="compact"
            @click.prevent="creating = true"
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
            active
            @click.prevent="creating = false"
          />
        </nav>
        <div class="border-t border-[var(--sidebar-border)] p-1.5 md:p-3">
          <p class="mb-2 hidden truncate px-3 text-xs text-[var(--sidebar-text-muted)] md:block">{{ user.email }}</p>
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
        <PageLayout
          title="Video Library"
          description="Manage and organize your video projects"
          :show-header="true"
          :icon="Folder"
        >
          <template #actions>
            <button class="projects-create-btn" @click="creating = true">
              <Plus class="projects-create-btn__icon" />
              New Project
            </button>
          </template>
          <div
            class="projects__content"
            :class="{ 'projects__content--empty': !items.length && !creating && !loading }"
          >
            <div v-if="items.length || loading || creating" class="projects__heading">
              <h1 class="projects__title">Video Library</h1>
              <p class="projects__subtitle">Manage and organize your downloaded videos and detect clips</p>
            </div>
            <p
              v-if="error && !creating"
              role="alert"
              class="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
            >
              {{ error }}
            </p>
            <div v-if="loading" role="status" class="projects__loading">Loading projects…</div>
            <div v-else-if="!items.length" class="projects__empty">
              <div class="projects__empty-icon-wrapper"><Folder class="projects__empty-icon" /></div>
              <h3 class="projects__empty-title">No projects found</h3>
              <p class="projects__empty-description">Create a new project to get started</p>
            </div>
            <div v-else class="projects__main">
              <div v-for="group in groups" :key="group.label" class="projects__date-group">
                <h3 class="projects__section-header">{{ group.label }}</h3>
                <div class="projects__grid">
                  <LibraryProjectCard
                    v-for="project in group.projects"
                    :key="project.id"
                    :name="project.name"
                    @open="open(project.id)"
                  >
                    <template v-if="project.status === 'ready'" #thumbnail>
                      <video
                        :src="sourcePath(project.id) + '#t=0.1'"
                        preload="metadata"
                        muted
                        class="h-full w-full object-cover"
                      />
                    </template>
                    <template #meta>
                      <span class="project-card__meta-text">
                        {{ new Date(project.updatedAt).toLocaleDateString() }}
                      </span>
                      <span class="project-card__dot"></span>
                      <span class="project-card__meta-text">
                        {{ project.status === 'ready' ? `${Math.ceil(project.duration / 60)} min` : project.status }}
                      </span>
                      <span class="project-card__dot"></span>
                      <span class="project-card__meta-text">{{ project.clips.length }} clips</span>
                    </template>
                    <template #actions>
                      <button
                        class="project-card__action-btn"
                        :aria-label="`Open workspace: ${project.name}`"
                        title="Open workspace"
                        @click.stop="open(project.id)"
                      >
                        <Edit class="project-card__action-icon" />
                      </button>
                      <button
                        class="project-card__action-btn"
                        :aria-label="`Delete ${project.name}`"
                        title="Delete project"
                        :disabled="working"
                        @click.stop="removeProject(project.id, project.name)"
                      >
                        <Trash2 class="project-card__action-icon" />
                      </button>
                    </template>
                  </LibraryProjectCard>
                </div>
              </div>
            </div>
          </div>
        </PageLayout>
      </main>
    </div>
    <ProjectDialogFrame :model-value="creating" :loading="working" @close="creating = false" @submit="create">
      <form class="project-content" @submit.prevent="create">
        <div class="project-section">
          <h3 class="project-section__title">Project Details</h3>
          <div class="project-field">
            <label for="web-project-name" class="project-field__label">
              Project name
              <span class="project-field__required">*</span>
            </label>
            <input
              id="web-project-name"
              ref="nameInput"
              v-model="projectName"
              class="project-field__input"
              required
              minlength="2"
              maxlength="120"
              placeholder="Enter project name"
            />
          </div>
        </div>
        <p v-if="error" role="alert" class="project-field__error">{{ error }}</p>
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
      @close="close"
      @import="(url) => run(() => state.action((id) => projects.importSource(id, url)))"
      @upload="(file) => run(() => state.uploadSource(file))"
      @detect="(prompt) => run(() => state.action((id) => projects.detect(id, prompt)))"
      @manual="manual"
      @save="save"
      @build="(id) => run(() => state.action((projectId) => projects.build(projectId, id)))"
      @remove="(id) => run(() => state.action((projectId) => projects.removeClip(projectId, id)))"
      @cancel="(id) => run(() => state.action(() => projects.cancel(id)))"
    />
  </div>
</template>
<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, nextTick, defineAsyncComponent } from 'vue'
  import { Folder, Plus, Video, Edit, Trash2, LogOut } from 'lucide-vue-next'
  import type { AuthUser, WebProject, WebClip } from '@clippster/shared-types'
  import AppBrand from '../../../client/src/components/AppBrand.vue'
  import ProjectDialogFrame from '../../../client/src/components/ProjectDialogFrame.vue'
  import PageLayout from '../../../client/src/components/PageLayout.vue'
  import LibraryProjectCard from '../../../client/src/components/LibraryProjectCard.vue'
  import SidebarNavigationItem from '../../../client/src/components/SidebarNavigationItem.vue'
  import AuthScreen from './components/AuthScreen.vue'
  const BrowserProjectWorkspace = defineAsyncComponent(() => import('./components/BrowserProjectWorkspace.vue'))
  import { auth, client, projects, sessionExpired, sourcePath, errorMessage } from './api'
  import { useWorkspace } from './useWorkspace'
  const user = ref<AuthUser | null>(null)
  const booting = ref(true)
  const items = ref<WebProject[]>([])
  const groups = computed(() => {
    const values = new Map<string, WebProject[]>()
    const today = new Date().toLocaleDateString()
    for (const project of items.value) {
      const day = new Date(project.updatedAt).toLocaleDateString()
      const label = day === today ? 'Today' : day
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
    await load()
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
    } catch {
      /* The workspace keeps the actionable error visible. */
    }
  }
  async function manual(time: number) {
    const project = state.workspace.value?.project
    if (!project) return
    const start = Math.min(time, project.duration - 0.1)
    await run(() =>
      state.saveClip({
        name: `Clip ${project.clips.length + 1}`,
        aspectRatio: '9:16',
        captions: false,
        segments: [{ start_time: start, end_time: Math.min(start + 30, project.duration) }]
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

<style scoped src="../../../client/src/styles/projectForm.css"></style>
