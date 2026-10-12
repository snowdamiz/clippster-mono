<template>
  <Modal
    v-model:open="isOpen"
    title="Attach video context"
    description="Choose a source — we extract keyframes and a transcript for thumbnail generation."
    :icon="Film"
    size="lg"
    flush
    class="h-[min(600px,calc(100vh-3rem))]"
    body-class="flex min-h-0 flex-col"
  >
    <div class="flex shrink-0 items-center gap-2 border-b border-line-subtle px-5 pb-3 pt-2">
      <SegmentedControl v-model="activeTab" :options="tabOptions" class="max-w-full overflow-x-auto" />
    </div>

    <!-- Keyed by tab / preparing state so each switch eases in -->
    <div :key="prepareProgress ? 'preparing' : activeTab" class="flex min-h-0 flex-1 animate-enter flex-col overflow-hidden">
      <!-- Preparing -->
      <div v-if="prepareProgress" class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center" role="status">
        <Loader2 class="size-6 animate-spin text-brand" />
        <p class="text-sm text-fg">{{ prepareProgress.message }}</p>
        <div class="h-1.5 w-48 overflow-hidden rounded-full bg-surface-active">
          <div class="h-full rounded-full bg-brand transition-[width]" :style="{ width: `${prepareProgress.progress}%` }" />
        </div>
      </div>

      <!-- Upload -->
      <div v-else-if="activeTab === 'upload'" class="flex flex-1 flex-col items-center justify-center gap-3 px-6">
        <Dropzone
          :icon="Upload"
          tone="brand"
          title="Upload video"
          hint="MP4, MOV, MKV, WebM — transcribed with Whisper"
          class="max-w-md"
          @select="pickUploadFile"
        />
      </div>

      <!-- YouTube -->
      <div v-else-if="activeTab === 'youtube'" class="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <div class="flex w-full max-w-md flex-col gap-3">
          <Field
            label="YouTube video URL"
            hint="Captions when available, otherwise Whisper. Frames are sampled from the video."
          >
            <Input
              v-model="youtubeUrl"
              type="url"
              placeholder="https://www.youtube.com/watch?v=…"
              @keydown.enter.prevent="attachYouTube"
            />
          </Field>
          <Button variant="primary" block :disabled="!youtubeUrl.trim()" @click="attachYouTube">
            <Link2 /> Attach YouTube video
          </Button>
        </div>
      </div>

      <!-- Library / Clips -->
      <template v-else>
        <div class="shrink-0 px-5 pt-3">
          <SearchField v-model="searchQuery" size="sm" placeholder="Search…" />
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-3">
          <!-- Skeleton only on the first load; reopening keeps the last list while it refreshes -->
          <div
            v-if="isLoadingSources && displayItems.length === 0"
            class="skeleton-group grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3"
          >
            <div v-for="i in 6" :key="i" class="overflow-hidden rounded-xl border border-line-subtle bg-surface">
              <div class="skeleton aspect-video rounded-none" />
              <div class="px-3 py-2.5"><div class="skeleton h-3.5 w-2/3 rounded" /></div>
            </div>
          </div>

          <Alert v-else-if="pickerError" variant="destructive">
            <AlertDescription>{{ pickerError }}</AlertDescription>
          </Alert>

          <EmptyState
            v-else-if="displayItems.length === 0"
            size="sm"
            :icon="Film"
            :title="`No ${activeTab === 'projects' ? 'projects' : 'built clips'} found`"
          />

          <div v-else class="grid animate-fade-in grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
            <MediaTile
              v-for="item in displayItems"
              :key="item.key"
              :title="item.name"
              :thumbnail="item.thumbnailUrl"
              :icon="Film"
              :meta="[item.durationLabel]"
              :selected="selectedKey === item.key"
              @open="selectLibraryItem(item)"
            />
          </div>
        </div>
      </template>
    </div>

    <template #footer>
      <p class="mr-auto min-w-0 truncate text-xs text-fg-muted">
        {{ prepareProgress ? prepareProgress.message : 'Select a source to attach context' }}
      </p>
      <Button variant="ghost" :disabled="!!prepareProgress" @click="close">Cancel</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Clapperboard, Film, FolderOpen, Link2, Loader2, Upload } from 'lucide-vue-next';
import { open } from '@tauri-apps/plugin-dialog';
import { MediaTile } from '@/components/ui/media-tile';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dropzone } from '@/components/ui/dropzone';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { SearchField } from '@/components/ui/search-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import {
  useThumbnailVideoContext,
  type ThumbnailVideoAttachPayload,
} from '@/composables/useThumbnailVideoContext';
import type { Clip, Project } from '@/services/database/types';
import {
  prepareLibraryVideoAttach,
  prepareUploadVideoAttach,
  prepareYouTubeVideoAttach,
  type ThumbnailPrepareProgress,
} from '@/services/thumbnailVideoPrepare';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'attach', payload: ThumbnailVideoAttachPayload): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const {
  isLoadingSources,
  error: pickerError,
  projects,
  builtClips,
  thumbnailCache,
  loadSources,
  buildProjectSelection,
  buildClipSelection,
} = useThumbnailVideoContext();

const activeTab = ref<'upload' | 'clips' | 'projects' | 'youtube'>('upload');
const searchQuery = ref('');
const selectedKey = ref<string | null>(null);
const youtubeUrl = ref('');
const prepareProgress = ref<ThumbnailPrepareProgress | null>(null);

const tabs = [
  { key: 'upload' as const, label: 'Upload', icon: Upload },
  { key: 'clips' as const, label: 'Built clips', icon: Clapperboard },
  { key: 'projects' as const, label: 'Projects', icon: FolderOpen },
  { key: 'youtube' as const, label: 'YouTube', icon: Link2 },
];
const tabOptions = tabs.map((tab) => ({ value: tab.key, label: tab.label, icon: tab.icon }));

interface PickerItem {
  key: string;
  name: string;
  thumbnailUrl?: string;
  durationLabel?: string;
  project?: Project;
  clip?: Clip;
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      searchQuery.value = '';
      selectedKey.value = null;
      youtubeUrl.value = '';
      prepareProgress.value = null;
      activeTab.value = 'upload';
      void loadSources();
    }
  },
);

const displayItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (activeTab.value === 'projects') {
    return projects.value
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .map(
        (project): PickerItem => ({
          key: `project:${project.id}`,
          name: project.name,
          thumbnailUrl: thumbnailCache.value.get(project.id),
          project,
        }),
      );
  }

  return builtClips.value
    .filter((c) => {
      const name = c.name || c.project_name || '';
      return !q || name.toLowerCase().includes(q);
    })
    .map(
      (clip): PickerItem => ({
        key: `clip:${clip.id}`,
        name: clip.name || clip.project_name || 'Untitled Clip',
        thumbnailUrl: thumbnailCache.value.get(clip.id),
        durationLabel: formatDuration(clip.built_duration ?? clip.duration),
        clip,
      }),
    );
});

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function close() {
  if (prepareProgress.value) return;
  isOpen.value = false;
}

function emitAttach(result: Awaited<ReturnType<typeof prepareLibraryVideoAttach>>) {
  emit('attach', {
    selection: result.selection,
    keyFrames: result.keyFrames,
    media_items: result.media_items,
    key_frames: result.key_frames,
    youtube_url: result.youtube_url,
    video_title: result.video_title,
    transcript: result.transcript,
    transcript_source: result.transcript_source,
  });
  prepareProgress.value = null;
  isOpen.value = false;
}

async function selectLibraryItem(item: PickerItem) {
  selectedKey.value = item.key;
  pickerError.value = null;
  try {
    let selection = null;
    if (item.project) selection = await buildProjectSelection(item.project);
    else if (item.clip) selection = buildClipSelection(item.clip);
    if (!selection) {
      pickerError.value = 'No playable video file found for this item';
      return;
    }
    prepareProgress.value = { stage: 'start', progress: 5, message: 'Preparing video…' };
    const result = await prepareLibraryVideoAttach(selection, (p) => {
      prepareProgress.value = p;
    });
    emitAttach(result);
  } catch (e) {
    prepareProgress.value = null;
    pickerError.value = e instanceof Error ? e.message : 'Failed to attach video';
  }
}

async function attachYouTube() {
  pickerError.value = null;
  try {
    prepareProgress.value = { stage: 'start', progress: 5, message: 'Starting YouTube prepare…' };
    const result = await prepareYouTubeVideoAttach(youtubeUrl.value.trim(), (p) => {
      prepareProgress.value = p;
    });
    emitAttach(result);
  } catch (e) {
    prepareProgress.value = null;
    pickerError.value = e instanceof Error ? e.message : 'Failed to attach YouTube video';
  }
}

async function pickUploadFile() {
  pickerError.value = null;
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'] }],
    });
    if (!selected || Array.isArray(selected)) return;
    const filePath = selected;
    const name = filePath.split(/[/\\]/).pop() || 'Upload';
    prepareProgress.value = { stage: 'start', progress: 5, message: 'Preparing upload…' };
    const result = await prepareUploadVideoAttach(filePath, name, (p) => {
      prepareProgress.value = p;
    });
    emitAttach(result);
  } catch (e) {
    prepareProgress.value = null;
    pickerError.value = e instanceof Error ? e.message : 'Failed to attach upload';
  }
}
</script>
