<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
        @click.self="close"
      >
        <div class="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl">
          <div class="border-b border-white/10 px-5 py-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold text-zinc-100">Attach Video Context</h3>
                <p class="mt-1 text-sm text-zinc-500">
                  Pick a library project or built clip. We'll extract 6–12 keyframes for the AI.
                </p>
              </div>
              <button type="button" class="icon-btn" @click="close">
                <X :size="16" />
              </button>
            </div>

            <div class="mt-4 flex rounded-lg border border-white/10 p-0.5">
              <button
                v-for="tab in tabs"
                :key="tab.key"
                type="button"
                class="flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors"
                :class="activeTab === tab.key ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-zinc-200'"
                @click="activeTab = tab.key"
              >
                <component :is="tab.icon" :size="14" />
                {{ tab.label }}
              </button>
            </div>

            <div class="mt-3 flex items-center gap-2">
              <Search :size="14" class="shrink-0 text-zinc-500" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search…"
                class="field-input flex-1"
              />
            </div>
          </div>

          <div class="custom-scrollbar flex-1 overflow-y-auto p-4">
            <div v-if="isLoadingSources" class="flex flex-col items-center justify-center gap-2 py-16 text-zinc-500">
              <Loader2 :size="28" class="animate-spin text-purple-400" />
              <p class="text-sm">Loading sources…</p>
            </div>

            <div v-else-if="pickerError" class="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {{ pickerError }}
            </div>

            <div v-else-if="displayItems.length === 0" class="flex flex-col items-center gap-2 py-16 text-center text-zinc-500">
              <Film :size="36" class="text-zinc-700" />
              <p class="text-sm">No {{ activeTab === 'projects' ? 'library projects' : 'built clips' }} found</p>
            </div>

            <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button
                v-for="item in displayItems"
                :key="item.key"
                type="button"
                class="group overflow-hidden rounded-lg border text-left transition-all"
                :class="selectedKey === item.key ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-white/10 hover:border-white/25'"
                :disabled="isExtractingFrames"
                @click="selectItem(item)"
              >
                <div class="relative aspect-video bg-zinc-800">
                  <img
                    v-if="item.thumbnailUrl"
                    :src="item.thumbnailUrl"
                    :alt="item.name"
                    class="h-full w-full object-cover"
                  />
                  <div v-else class="flex h-full items-center justify-center">
                    <Film :size="28" class="text-zinc-600" />
                  </div>
                  <div
                    v-if="selectedKey === item.key && isExtractingFrames"
                    class="absolute inset-0 flex items-center justify-center bg-black/50"
                  >
                    <Loader2 :size="24" class="animate-spin text-purple-300" />
                  </div>
                </div>
                <div class="p-2.5">
                  <p class="truncate text-xs font-medium text-zinc-100">{{ item.name }}</p>
                  <p v-if="item.durationLabel" class="mt-0.5 text-[10px] text-zinc-500">{{ item.durationLabel }}</p>
                </div>
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
            <p v-if="isExtractingFrames" class="text-xs text-zinc-500">Extracting keyframes…</p>
            <p v-else class="text-xs text-zinc-500">Select one video to attach context</p>
            <button type="button" class="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5" @click="close">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Film, FolderOpen, Loader2, Search, X } from 'lucide-vue-next';
import {
  useThumbnailVideoContext,
  type ThumbnailKeyFrame,
  type ThumbnailVideoSelection,
  type ThumbnailVideoAttachPayload,
} from '@/composables/useThumbnailVideoContext';
import type { Clip, Project } from '@/services/database/types';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'attach', payload: ThumbnailVideoAttachPayload): void;
}>();

const {
  isLoadingSources,
  isExtractingFrames,
  error: pickerError,
  projects,
  builtClips,
  thumbnailCache,
  loadSources,
  buildProjectSelection,
  buildClipSelection,
  extractKeyFrames,
  toMediaPayload,
} = useThumbnailVideoContext();

const activeTab = ref<'projects' | 'clips'>('projects');
const searchQuery = ref('');
const selectedKey = ref<string | null>(null);

const tabs = [
  { key: 'projects' as const, label: 'Video Library', icon: FolderOpen },
  { key: 'clips' as const, label: 'Built Clips', icon: Film },
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
      void loadSources();
    }
  },
);

const displayItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (activeTab.value === 'projects') {
    return projects.value
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .map((project): PickerItem => ({
        key: `project:${project.id}`,
        name: project.name,
        thumbnailUrl: thumbnailCache.value.get(project.id),
        project,
      }));
  }

  return builtClips.value
    .filter((c) => {
      const name = c.name || c.project_name || '';
      return !q || name.toLowerCase().includes(q);
    })
    .map((clip): PickerItem => ({
      key: `clip:${clip.id}`,
      name: clip.name || clip.project_name || 'Untitled Clip',
      thumbnailUrl: thumbnailCache.value.get(clip.id),
      durationLabel: formatDuration(clip.built_duration ?? clip.duration),
      clip,
    }));
});

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function close() {
  emit('update:modelValue', false);
}

async function selectItem(item: PickerItem) {
  selectedKey.value = item.key;
  try {
    let selection: ThumbnailVideoSelection | null = null;
    if (item.project) {
      selection = await buildProjectSelection(item.project);
    } else if (item.clip) {
      selection = buildClipSelection(item.clip);
    }
    if (!selection) {
      pickerError.value = 'No playable video file found for this item';
      return;
    }

    const keyFrames = await extractKeyFrames(selection);
    const payload = toMediaPayload(selection, keyFrames);
    emit('attach', {
      selection,
      keyFrames,
      media_items: payload.media_items,
      key_frames: payload.key_frames,
    });
    close();
  } catch {
    // error surfaced via pickerError
  }
}
</script>

<style scoped>
@reference "../../style.css";

.field-input {
  @apply rounded-lg border border-white/10 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-purple-500;
}
.icon-btn {
  @apply flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-zinc-100;
}
.modal-enter-active,
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }
</style>
