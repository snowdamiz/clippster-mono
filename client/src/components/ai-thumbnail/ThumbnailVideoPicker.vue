<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex h-[600px] max-w-2xl flex-col gap-0 border-white/10 bg-[#1e1e22] p-0">
      <DialogHeader class="shrink-0 px-4 pb-0 pt-4">
        <DialogTitle class="text-sm font-medium text-zinc-200">Attach Video Context</DialogTitle>
        <DialogDescription class="text-xs text-zinc-500">
          Choose a source — we extract keyframes and a transcript for thumbnail generation.
        </DialogDescription>
      </DialogHeader>

      <!-- Tab bar — matches editor Import Media -->
      <div class="mt-3 flex shrink-0 items-center overflow-x-auto border-b border-white/10 px-4">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="flex items-center gap-1 whitespace-nowrap border-b-2 px-2 py-2 text-[11px] font-medium transition-colors"
          :class="
            activeTab === tab.key
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          "
          @click="activeTab = tab.key"
        >
          <component :is="tab.icon" class="size-3.5" />
          {{ tab.label }}
        </button>
      </div>

      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- Preparing -->
        <div
          v-if="prepareProgress"
          class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
        >
          <Loader2 class="size-8 animate-spin text-blue-400" />
          <p class="text-sm text-zinc-200">{{ prepareProgress.message }}</p>
          <div class="h-1.5 w-48 overflow-hidden rounded-full bg-zinc-800">
            <div
              class="h-full bg-blue-500 transition-all"
              :style="{ width: `${prepareProgress.progress}%` }"
            />
          </div>
        </div>

        <!-- Upload -->
        <div
          v-else-if="activeTab === 'upload'"
          class="flex flex-1 flex-col items-center justify-center gap-3 px-6"
        >
          <button
            type="button"
            class="flex w-full max-w-md flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-white/15 px-6 py-12 text-center transition-colors hover:border-blue-500/40 hover:bg-white/[0.03]"
            @click="pickUploadFile"
          >
            <div class="flex size-12 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
              <Upload class="size-6" />
            </div>
            <div>
              <p class="text-sm font-medium text-zinc-100">Upload Video</p>
              <p class="mt-1 text-xs text-zinc-500">MP4, MOV, MKV, WebM — transcribed with Whisper</p>
            </div>
          </button>
        </div>

        <!-- YouTube -->
        <div
          v-else-if="activeTab === 'youtube'"
          class="flex flex-1 flex-col items-center justify-center gap-4 px-6"
        >
          <div class="w-full max-w-md space-y-3">
            <label class="block text-xs font-medium text-zinc-400">YouTube video URL</label>
            <input
              v-model="youtubeUrl"
              type="url"
              placeholder="https://www.youtube.com/watch?v=…"
              class="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-blue-500"
              @keydown.enter.prevent="attachYouTube"
            />
            <p class="text-xs text-zinc-500">
              Captions when available, otherwise Whisper. Frames are sampled from the video.
            </p>
            <button
              type="button"
              class="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              :disabled="!youtubeUrl.trim()"
              @click="attachYouTube"
            >
              <Link2 class="size-4" />
              Attach YouTube video
            </button>
          </div>
        </div>

        <!-- Library / Clips -->
        <template v-else>
          <div class="shrink-0 border-b border-white/10 px-4 py-2">
            <div class="relative">
              <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search…"
                class="w-full rounded-md border border-white/10 bg-zinc-900 py-1.5 pl-8 pr-3 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-blue-500"
              />
            </div>
          </div>

          <div class="custom-scrollbar flex-1 overflow-y-auto p-4">
            <div v-if="isLoadingSources" class="flex flex-col items-center justify-center gap-2 py-16 text-zinc-500">
              <Loader2 class="size-7 animate-spin text-blue-400" />
              <p class="text-sm">Loading sources…</p>
            </div>

            <div v-else-if="pickerError" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {{ pickerError }}
            </div>

            <div
              v-else-if="displayItems.length === 0"
              class="flex flex-col items-center justify-center gap-2 py-16 text-center text-zinc-500"
            >
              <Film class="size-9 text-zinc-700" />
              <p class="text-sm">
                No {{ activeTab === 'projects' ? 'projects' : 'built clips' }} found
              </p>
            </div>

            <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button
                v-for="item in displayItems"
                :key="item.key"
                type="button"
                class="group overflow-hidden rounded-lg border text-left transition-all"
                :class="
                  selectedKey === item.key
                    ? 'border-blue-500 ring-2 ring-blue-500/30'
                    : 'border-white/10 hover:border-white/25'
                "
                @click="selectLibraryItem(item)"
              >
                <div class="relative aspect-video bg-zinc-800">
                  <img
                    v-if="item.thumbnailUrl"
                    :src="item.thumbnailUrl"
                    :alt="item.name"
                    class="h-full w-full object-cover"
                  />
                  <div v-else class="flex h-full items-center justify-center">
                    <Film class="size-7 text-zinc-600" />
                  </div>
                </div>
                <div class="p-2.5">
                  <p class="truncate text-xs font-medium text-zinc-100">{{ item.name }}</p>
                  <p v-if="item.durationLabel" class="mt-0.5 text-[10px] text-zinc-500">
                    {{ item.durationLabel }}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </template>
      </div>

      <DialogFooter class="shrink-0 border-t border-white/10 px-4 py-3 sm:justify-between">
        <p class="text-xs text-zinc-500">
          {{ prepareProgress ? prepareProgress.message : 'Select a source to attach context' }}
        </p>
        <Button variant="outline" size="sm" :disabled="!!prepareProgress" @click="close">
          Cancel
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Clapperboard, Film, FolderOpen, Link2, Loader2, Search, Upload } from 'lucide-vue-next';
import { open } from '@tauri-apps/plugin-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
  { key: 'upload' as const, label: 'Upload Video', icon: Upload },
  { key: 'clips' as const, label: 'Built Clips', icon: Clapperboard },
  { key: 'projects' as const, label: 'Projects', icon: FolderOpen },
  { key: 'youtube' as const, label: 'YouTube', icon: Link2 },
];

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
