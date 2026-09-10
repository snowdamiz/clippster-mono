<template>
  <PageLayout
    title="AI Image Creator"
    description="Create production-ready images or build transcript-backed thumbnails"
    :show-header="true"
    :icon="Images"
  >
    <template #actions>
      <button
        type="button"
        class="flex h-8 items-center gap-2 rounded-md bg-[var(--sidebar-accent)] px-3 text-xs font-semibold text-[var(--sidebar-bg)] disabled:opacity-50"
        :disabled="isCreatingProject"
        @click="showCreateDialog = true"
      >
        <Plus :size="14" />
        New Project
      </button>
    </template>

    <div class="flex min-h-0 flex-1 flex-col gap-5 p-6">
      <div>
        <h1 class="text-2xl font-bold text-zinc-100">Projects</h1>
        <p class="mt-1 text-sm text-zinc-500">
          Image and thumbnail projects open full-page. Export, save locally, or save a workable file when a result is ready.
        </p>
      </div>

      <div v-if="isLoadingSessions" class="flex flex-1 items-center justify-center">
        <Loader2 :size="32" class="animate-spin text-zinc-500" />
      </div>

      <div
        v-else-if="sessions.length"
        class="grid grid-cols-1 gap-4 overflow-y-auto md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      >
        <article
          v-for="project in sessions"
          :key="`${project.creator_mode}-${project.id}`"
          class="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-zinc-900 text-left transition hover:-translate-y-0.5 hover:border-sky-500/50"
          role="button"
          tabindex="0"
          @click="openProject(project)"
          @keydown.enter="openProject(project)"
        >
          <img
            v-if="project.thumbnail_url"
            :src="project.thumbnail_url"
            :alt="project.name || 'Project preview'"
            class="size-full object-cover"
          />
          <div v-else class="flex size-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950">
            <Images :size="48" class="text-zinc-700" />
          </div>
          <div class="absolute left-3 top-3 flex gap-1.5">
            <span
              class="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              :class="
                project.creator_mode === 'image' ? 'bg-sky-600/90 text-white' : 'bg-cyan-700/90 text-white'
              "
            >
              {{ project.creator_mode === 'image' ? 'Image' : 'Thumbnail' }}
            </span>
            <span
              v-if="project.creator_mode === 'thumbnail' && project.generation_mode"
              class="rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-zinc-200"
            >
              {{ project.generation_mode === 'quick' ? 'Quick' : 'Editable' }}
            </span>
          </div>
          <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-14">
            <p class="truncate font-semibold text-white">
              {{ project.name || (project.creator_mode === 'image' ? 'Untitled Image' : 'Untitled Thumbnail') }}
            </p>
            <div class="mt-1 flex items-center justify-between text-xs text-zinc-400">
              <span>{{ formatStatus(project.status) }}</span>
              <button
                type="button"
                class="rounded p-1 opacity-0 transition hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100"
                title="Delete project"
                @click.stop="removeProject(project)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div class="flex size-16 items-center justify-center rounded-2xl bg-zinc-900">
          <Images :size="32" class="text-zinc-600" />
        </div>
        <h2 class="text-lg font-semibold text-zinc-200">Create your first project</h2>
        <p class="max-w-md text-sm text-zinc-500">
          Start an image or thumbnail project. Both open full-page and can be saved into Image Editor.
        </p>
        <button
          type="button"
          class="mt-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
          @click="showCreateDialog = true"
        >
          Start creating
        </button>
      </div>
    </div>

    <CreateAIImageProjectDialog
      v-model="showCreateDialog"
      :is-creating="isCreatingProject"
      @confirm="confirmCreate"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { Images, Loader2, Plus, Trash2 } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import CreateAIImageProjectDialog from '@/components/ai-image/CreateAIImageProjectDialog.vue';
  import { useAIImageSession } from '@/composables/useAIImageSession';
  import { createThumbnailSession } from '@/services/aiThumbnailApi';
  import type { AIImageSessionSummary } from '@/services/aiImageApi';

  const router = useRouter();
  const { listSessions, createSession, deleteSession } = useAIImageSession();

  const sessions = ref<AIImageSessionSummary[]>([]);
  const isLoadingSessions = ref(false);
  const showCreateDialog = ref(false);
  const isCreatingProject = ref(false);

  onMounted(loadProjects);

  async function loadProjects() {
    isLoadingSessions.value = true;
    try {
      sessions.value = await listSessions();
    } finally {
      isLoadingSessions.value = false;
    }
  }

  async function confirmCreate(payload: {
    name: string;
    creator_mode: 'image' | 'thumbnail';
    generation_mode: 'editable' | 'quick';
  }) {
    isCreatingProject.value = true;
    try {
      if (payload.creator_mode === 'image') {
        const created = await createSession(payload.name);
        showCreateDialog.value = false;
        await router.push({
          path: '/ai-image/session',
          query: { session: String(created.id) },
        });
      } else {
        const created = await createThumbnailSession({
          name: payload.name,
          generation_mode: payload.generation_mode,
        });
        showCreateDialog.value = false;
        await router.push({
          path: '/ai-image/thumbnail',
          query: { session: String(created.id) },
        });
      }
    } catch (cause) {
      console.error('[AIImageGenerator] create failed:', cause);
      alert('Failed to create project. Please try again.');
    } finally {
      isCreatingProject.value = false;
    }
  }

  async function openProject(project: AIImageSessionSummary) {
    if (project.creator_mode === 'thumbnail') {
      await router.push({
        path: '/ai-image/thumbnail',
        query: { session: String(project.id) },
      });
      return;
    }
    await router.push({
      path: '/ai-image/session',
      query: { session: String(project.id) },
    });
  }

  async function removeProject(project: AIImageSessionSummary) {
    const label =
      project.name || (project.creator_mode === 'image' ? 'Untitled Image' : 'Untitled Thumbnail');
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    await deleteSession(project.id);
    sessions.value = sessions.value.filter((item) => item.id !== project.id);
  }

  function formatStatus(status: string) {
    return (
      (
        {
          discovery: 'Planning',
          generating: 'Generating',
          generated: 'Ready',
          completed: 'Ready',
        } as Record<string, string>
      )[status] || status
    );
  }
</script>
