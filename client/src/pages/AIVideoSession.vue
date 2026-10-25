<template>
  <div class="flex h-full w-full flex-col overflow-hidden bg-panel">
    <SessionHeader :title="title" :icon="Wand2" back-label="Back to projects" @back="requestClose">
      <template #title>
        <SessionTitle :title="title" @rename="project.rename" />
      </template>
      <template #badge>
        <Badge :variant="status.variant" class="hidden sm:inline-flex">{{ status.label }}</Badge>
        <Badge variant="brand" class="hidden sm:inline-flex">Beta</Badge>
      </template>
      <template #actions>
        <Button
          variant="primary"
          size="sm"
          :disabled="!project.document.value || !!project.running.value"
          :loading="exporting"
          @click="project.exportVideo()"
        >
          <Download v-if="!exporting" />
          Export
        </Button>
      </template>
    </SessionHeader>

    <EmptyState
      v-if="bootError"
      :icon="AlertTriangle"
      tone="danger"
      title="Couldn't open this project"
      :description="bootError"
    >
      <Button variant="secondary" @click="leave">Back to projects</Button>
    </EmptyState>

    <div v-else-if="project.loading.value || !project.session.value" class="flex flex-1 items-center justify-center">
      <Loader2 class="size-6 animate-spin text-fg-subtle" />
    </div>

    <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div class="flex min-h-0 flex-1 overflow-hidden">
        <AIVideoSidebar />

        <main class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-sunken">
          <WorkingStage v-if="project.stage.value === 'working'" />
          <ResultStage v-else-if="project.stage.value === 'result'" />
          <div v-else class="flex flex-1 items-center justify-center p-6">
            <EmptyState
              :icon="Clapperboard"
              title="Your video will appear here"
              description="Chat through the idea on the left. When the plan looks right, press Build. Planning is free; you only use credits when it builds."
            />
          </div>
        </main>
      </div>
      <div
        id="ai-video-timeline"
        class="h-[clamp(190px,32vh,300px)] max-h-[48%] shrink-0 overflow-hidden border-t border-line-subtle bg-panel"
      >
        <div v-if="!project.document.value" class="flex h-full flex-col">
          <div class="flex h-11 shrink-0 items-center border-b border-line-subtle px-3 text-xs font-semibold text-fg">
            Timeline
          </div>
          <div class="grid flex-1 place-items-center text-xs text-fg-subtle">
            Your scenes, text, graphics and audio will appear here.
          </div>
        </div>
      </div>
    </div>

    <ConfirmationModal
      :show="confirmLeave"
      title="Stop the AI?"
      message="The AI is still working on this video. If you leave now it stops, and you aren't charged for the unfinished edit."
      suffix=""
      confirm-text="Stop and leave"
      variant="destructive"
      @close="confirmLeave = false"
      @confirm="leave"
    />
  </div>
</template>

<script setup lang="ts">
  /** One AI video project, full page like the AI image creator: sources and chat in the rail, the video on the right. */
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { AlertTriangle, Clapperboard, Download, Loader2, Wand2 } from 'lucide-vue-next';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import SessionHeader from '@/components/create/SessionHeader.vue';
  import SessionTitle from '@/components/create/SessionTitle.vue';
  import { Badge, type BadgeVariants } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import ResultStage from '@/ai-video/components/ResultStage.vue';
  import AIVideoSidebar from '@/ai-video/components/AIVideoSidebar.vue';
  import WorkingStage from '@/ai-video/components/WorkingStage.vue';
  import { provideProject } from '@/ai-video/projectContext';
  import { takeStartingSources } from '@/ai-video/startingSources';
  import { useAIVideoProject } from '@/ai-video/useAIVideoProject';

  const route = useRoute();
  const router = useRouter();
  const project = useAIVideoProject();
  provideProject(project);

  const bootError = ref<string | null>(null);
  const confirmLeave = ref(false);

  const title = computed(() => project.session.value?.name || 'Untitled project');
  const exporting = computed(() => {
    const state = project.exportState.value;
    return !!state && !state.path && !state.error;
  });
  const status = computed((): { label: string; variant: BadgeVariants['variant'] } => {
    if (project.running.value) return { label: 'Working', variant: 'warning' };
    if (project.document.value) return { label: 'Ready', variant: 'success' };
    return { label: project.hasPlanChat.value ? 'Planning' : 'Draft', variant: 'neutral' };
  });

  onMounted(() => void boot());
  onBeforeUnmount(() => project.close());

  async function boot() {
    const raw = route.query.session;
    const id = Number(Array.isArray(raw) ? raw[0] : raw);
    if (!Number.isFinite(id) || id <= 0) {
      await router.replace('/ai-video');
      return;
    }
    await project.open(id);
    if (!project.session.value) {
      bootError.value = 'It may have been deleted, or the connection dropped. Go back and try again.';
      return;
    }
    const sources = takeStartingSources(id);
    if (!sources) return;
    await project.addMedia(sources.files);
    if (sources.example?.kind === 'url') project.setExampleUrl(sources.example.value);
    else if (sources.example) project.setExampleFile(sources.example.value);
  }

  function requestClose() {
    if (project.running.value) confirmLeave.value = true;
    else leave();
  }

  function leave() {
    confirmLeave.value = false;
    project.close();
    void router.push('/ai-video');
  }
</script>
