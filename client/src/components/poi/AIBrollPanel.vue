<template>
  <div
    class="ai-broll-panel flex h-full min-h-0 flex-col"
    :class="variant === 'editor' ? 'bg-transparent' : 'border-r border-zinc-800 bg-zinc-900/80'"
  >
    <div class="border-b border-zinc-800/80 px-3 py-2.5">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <Sparkles class="size-4 shrink-0 text-violet-400" />
            <span class="text-sm font-semibold text-zinc-100">AI B-roll</span>
          </div>
          <p v-if="variant === 'editor' && clipDuration" class="mt-0.5 pl-6 text-[10px] text-zinc-500">
            {{ activeCount }} suggestion{{ activeCount === 1 ? '' : 's' }} · {{ formatTime(clipDuration) }} clip
          </p>
        </div>
        <button
          v-if="variant !== 'editor'"
          type="button"
          class="shrink-0 text-zinc-500 hover:text-zinc-300"
          title="Close panel"
          @click="$emit('close')"
        >
          <X class="size-4" />
        </button>
      </div>
    </div>

    <div class="space-y-2.5 border-b border-zinc-800/60 px-3 py-3">
      <div class="grid grid-cols-2 gap-2">
        <label class="block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Density
          <Select
            :model-value="localOptions.density"
            @update:model-value="(v) => (localOptions.density = v as AiBrollPlannerOptions['density'])"
          >
            <SelectTrigger class="mt-1 h-8 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent class="border-white/10 bg-zinc-900">
              <SelectItem value="low" class="text-xs text-zinc-200">Low (1-2)</SelectItem>
              <SelectItem value="medium" class="text-xs text-zinc-200">Medium (2-3)</SelectItem>
              <SelectItem value="high" class="text-xs text-zinc-200">High (3-4)</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label class="block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Style
          <Select
            :model-value="localOptions.style"
            @update:model-value="(v) => (localOptions.style = v as AiBrollPlannerOptions['style'])"
          >
            <SelectTrigger class="mt-1 h-8 w-full rounded-md border border-white/10 bg-white/5 px-2 text-xs text-zinc-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent class="border-white/10 bg-zinc-900">
              <SelectItem value="mixed" class="text-xs text-zinc-200">Mixed</SelectItem>
              <SelectItem value="literal" class="text-xs text-zinc-200">Literal</SelectItem>
              <SelectItem value="metaphorical" class="text-xs text-zinc-200">Metaphorical</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      <button
        type="button"
        class="flex w-full items-center justify-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
        :disabled="isGenerating || !canGenerate"
        @click="$emit('generate', localOptions)"
      >
        <Loader2 v-if="isGenerating" class="size-3.5 animate-spin" />
        <Sparkles v-else class="size-3.5" />
        {{ isGenerating ? 'Analyzing transcript...' : 'Generate suggestions' }}
      </button>

      <button
        v-if="suggestions.length > 0"
        type="button"
        class="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700/60 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700/80 disabled:opacity-40"
        :disabled="isFetching"
        @click="$emit('fetch-all')"
      >
        <Loader2 v-if="isFetching" class="size-3.5 animate-spin" />
        <Search v-else class="size-3.5" />
        Refresh stock previews
      </button>

      <p v-if="error" class="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-400">
        {{ error }}
      </p>
      <p v-else-if="!canGenerate" class="text-[11px] text-amber-400/90">
        Transcript required for AI B-roll suggestions.
      </p>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-3 py-2">
      <p
        v-if="suggestions.length === 0 && !isGenerating"
        class="px-1 py-6 text-center text-xs leading-relaxed text-zinc-500"
      >
        AI proposes timed stock B-roll from your transcript. Pick an option, then add it to the timeline.
      </p>

      <div
        v-for="s in suggestions.filter((x) => x.status !== 'rejected')"
        :key="s.id"
        class="border-b border-zinc-800/70 py-3 last:border-b-0"
      >
        <div class="mb-2 flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-mono text-[10px] tabular-nums text-violet-300">
                {{ formatTime(s.startTime) }}-{{ formatTime(s.endTime) }}
              </span>
              <span
                class="rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
                :class="statusClass(s.status)"
              >
                {{ statusLabel(s.status) }}
              </span>
            </div>
            <p class="mt-1 truncate text-xs font-medium text-zinc-100">{{ s.visualQuery }}</p>
            <p v-if="s.transcriptText" class="mt-0.5 line-clamp-1 text-[10px] italic text-zinc-500">
              "{{ s.transcriptText }}"
            </p>
          </div>

          <button
            type="button"
            class="rounded-md bg-zinc-800 p-1.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
            title="Dismiss"
            @click="$emit('reject', s.id)"
          >
            <X class="size-3.5" />
          </button>
        </div>

        <div v-if="s.candidates.length > 0" class="mb-2 grid grid-cols-2 gap-2">
          <button
            v-for="c in s.candidates.slice(0, 6)"
            :key="c.id"
            type="button"
            class="group relative aspect-video overflow-hidden rounded-md border-2 bg-zinc-950 transition-all"
            :class="s.selectedCandidateId === c.id ? 'border-violet-400 ring-1 ring-violet-400/40' : 'border-zinc-800 hover:border-zinc-600'"
            @mouseenter="playCandidatePreview"
            @mouseleave="pauseCandidatePreview"
            @click="$emit('select-candidate', s.id, c.id)"
          >
            <img
              v-if="c.previewUrl"
              :src="c.previewUrl"
              class="size-full object-cover"
              alt=""
            />
            <div v-else class="flex size-full items-center justify-center bg-zinc-800">
              <Film class="size-3 text-zinc-600" />
            </div>
            <video
              v-if="c.mediaType === 'video'"
              :src="c.downloadUrl"
              class="absolute inset-0 size-full object-cover opacity-0 transition-opacity group-hover:opacity-100"
              muted
              loop
              playsinline
              preload="metadata"
            />
          </button>
        </div>

        <div class="flex items-center gap-1.5">
          <button
            v-if="s.status !== 'applied'"
            type="button"
            class="flex-1 rounded-md bg-violet-600 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40"
            :disabled="s.status === 'fetching' || (s.candidates.length === 0 && s.status !== 'ready')"
            @click="$emit('apply', s.id)"
          >
            <span v-if="s.status === 'fetching'" class="inline-flex items-center gap-1">
              <Loader2 class="size-3 animate-spin" /> Loading...
            </span>
            <span v-else>Add to timeline</span>
          </button>
          <div
            v-else
            class="flex-1 rounded-md border border-emerald-500/25 bg-emerald-500/15 py-1.5 text-center text-xs font-medium text-emerald-300"
          >
            On timeline
          </div>
          <button
            type="button"
            class="rounded-md bg-zinc-800 p-1.5 text-zinc-400 hover:bg-zinc-700"
            title="Search again"
            @click="$emit('regenerate', s.id)"
          >
            <RefreshCw class="size-3.5" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="readyCount > 0" class="border-t border-zinc-800/80 bg-zinc-900/30 px-3 py-2.5">
      <button
        type="button"
        class="w-full rounded-md border border-zinc-700/60 bg-zinc-800 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
        @click="$emit('apply-all')"
      >
        Add all ready ({{ readyCount }})
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { Sparkles, X, Loader2, Search, RefreshCw, Film } from 'lucide-vue-next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AiBrollPlannerOptions, AiBrollSuggestion } from '@/types/ai-broll';

const props = withDefaults(
  defineProps<{
    suggestions: AiBrollSuggestion[];
    isGenerating: boolean;
    isFetching: boolean;
    error: string | null;
    canGenerate: boolean;
    plannerOptions: AiBrollPlannerOptions;
    variant?: 'poi' | 'editor';
    clipDuration?: number;
  }>(),
  { variant: 'poi', clipDuration: 0 },
);

defineEmits<{
  close: [];
  generate: [options: AiBrollPlannerOptions];
  'fetch-all': [];
  apply: [suggestionId: string];
  'apply-all': [];
  regenerate: [suggestionId: string];
  reject: [suggestionId: string];
  'select-candidate': [suggestionId: string, candidateId: string];
}>();

const localOptions = reactive({ ...props.plannerOptions });

watch(
  () => props.plannerOptions,
  (next) => {
    Object.assign(localOptions, next);
  },
  { deep: true },
);

const readyCount = computed(() => props.suggestions.filter((s) => s.status === 'ready').length);
const activeCount = computed(() => props.suggestions.filter((s) => s.status !== 'rejected').length);

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function statusLabel(status: AiBrollSuggestion['status']): string {
  switch (status) {
    case 'applied':
      return 'Applied';
    case 'ready':
      return 'Ready';
    case 'fetching':
      return 'Loading';
    case 'failed':
      return 'Failed';
    default:
      return 'Suggested';
  }
}

function statusClass(status: AiBrollSuggestion['status']): string {
  switch (status) {
    case 'applied':
      return 'bg-emerald-500/25 text-emerald-200';
    case 'ready':
      return 'bg-violet-500/25 text-violet-200';
    case 'fetching':
      return 'bg-blue-500/25 text-blue-200';
    case 'failed':
      return 'bg-red-500/25 text-red-200';
    default:
      return 'bg-zinc-700/60 text-zinc-300';
  }
}

function playCandidatePreview(event: MouseEvent) {
  const video = (event.currentTarget as HTMLElement).querySelector('video');
  if (!video) return;
  video.currentTime = 0;
  void video.play().catch(() => {});
}

function pauseCandidatePreview(event: MouseEvent) {
  const video = (event.currentTarget as HTMLElement).querySelector('video');
  if (!video) return;
  video.pause();
  video.currentTime = 0;
}
</script>
