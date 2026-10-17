<template>
  <div
    class="ai-broll-panel flex h-full min-h-0 flex-col"
    :class="variant === 'editor' ? 'bg-transparent' : 'border-r border-line-subtle bg-surface'"
  >
    <div class="border-b border-line-subtle px-3 pb-3 pt-2.5">
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <Sparkles class="size-4 shrink-0 text-ai" />
            <span class="text-sm font-semibold text-fg">B-roll</span>
          </div>
          <p v-if="variant === 'editor' && clipDuration" class="tabular mt-0.5 pl-6 text-2xs text-fg-subtle">
            {{ activeCount }} suggestion{{ activeCount === 1 ? '' : 's' }} · {{ formatTime(clipDuration) }} clip
          </p>
        </div>
        <Button
          v-if="variant !== 'editor'"
          variant="ghost"
          size="icon-sm"
          title="Close panel"
          aria-label="Close panel"
          @click="$emit('close')"
        >
          <X />
        </Button>
      </div>

      <SegmentedControl v-model="activeTab" :options="tabOptions" size="sm" block class="mt-2.5" />
    </div>

    <!-- Tab panel: keyed so switching AI / manual eases in -->
    <div :key="activeTab" class="flex min-h-0 flex-1 animate-enter flex-col">
      <!-- AI suggestions tab -->
      <template v-if="activeTab === 'ai'">
        <div class="flex flex-col gap-2.5 border-b border-line-subtle px-3 py-3">
          <div class="grid grid-cols-2 gap-2">
            <Field label="Density">
              <Select
                :model-value="localOptions.density"
                @update:model-value="(v) => (localOptions.density = v as AiBrollPlannerOptions['density'])"
              >
                <SelectTrigger class="h-[var(--control-sm)] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (1-2)</SelectItem>
                  <SelectItem value="medium">Medium (2-3)</SelectItem>
                  <SelectItem value="high">High (3-4)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Style">
              <Select
                :model-value="localOptions.style"
                @update:model-value="(v) => (localOptions.style = v as AiBrollPlannerOptions['style'])"
              >
                <SelectTrigger class="h-[var(--control-sm)] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixed">Mixed</SelectItem>
                  <SelectItem value="literal">Literal</SelectItem>
                  <SelectItem value="metaphorical">Metaphorical</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Button
            variant="primary"
            size="sm"
            block
            :loading="isGenerating"
            :disabled="!canGenerate"
            @click="$emit('generate', localOptions)"
          >
            <Sparkles v-if="!isGenerating" />
            {{ isGenerating ? 'Analyzing transcript...' : 'Generate suggestions' }}
          </Button>

          <Button
            v-if="suggestions.length > 0"
            variant="secondary"
            size="sm"
            block
            :loading="isFetching"
            @click="$emit('fetch-all')"
          >
            <Search v-if="!isFetching" />
            Refresh stock previews
          </Button>

          <p v-if="error" class="rounded-md bg-danger-soft px-2 py-1.5 text-xs text-danger">
            {{ error }}
          </p>
          <p v-else-if="!canGenerate" class="text-xs text-warning">
            Transcript required for AI B-roll suggestions. Use Manual search instead.
          </p>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <p
            v-if="suggestions.length === 0 && !isGenerating"
            class="px-1 py-6 text-center text-xs leading-relaxed text-fg-subtle"
          >
            AI proposes timed stock B-roll from your transcript. Pick an option, then add it to the timeline.
          </p>

          <div
            v-for="s in suggestions.filter((x) => x.status !== 'rejected')"
            :key="s.id"
            class="border-b border-line-subtle py-3 last:border-b-0"
          >
            <div class="mb-2 flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-2xs tabular-nums text-fg-muted">
                    {{ formatTime(s.startTime) }}-{{ formatTime(s.endTime) }}
                  </span>
                  <Badge :variant="statusClass(s.status)">{{ statusLabel(s.status) }}</Badge>
                </div>
                <p class="mt-1 truncate text-xs font-medium text-fg">{{ s.visualQuery }}</p>
                <p v-if="s.transcriptText" class="mt-0.5 line-clamp-1 text-2xs italic text-fg-subtle">
                  "{{ s.transcriptText }}"
                </p>
              </div>

              <Button variant="ghost" size="icon-xs" title="Dismiss" aria-label="Dismiss" @click="$emit('reject', s.id)">
                <X />
              </Button>
            </div>

            <div v-if="s.candidates.length > 0" class="mb-2 grid grid-cols-2 gap-2">
              <BrollCandidateTile
                v-for="c in s.candidates.slice(0, 6)"
                :key="c.id"
                :candidate="c"
                :selected="s.selectedCandidateId === c.id"
                @mouseenter="playCandidatePreview"
                @mouseleave="pauseCandidatePreview"
                @click="$emit('select-candidate', s.id, c.id)"
              />
            </div>

            <div class="flex items-center gap-1.5">
              <Button
                v-if="s.status !== 'applied'"
                variant="secondary"
                size="sm"
                class="flex-1"
                :loading="s.status === 'fetching'"
                :disabled="s.candidates.length === 0 && s.status !== 'ready'"
                @click="$emit('apply', s.id)"
              >
                {{ s.status === 'fetching' ? 'Loading...' : 'Add to timeline' }}
              </Button>
              <div
                v-else
                class="flex h-[var(--control-sm)] flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-success-soft text-xs font-medium text-success"
              >
                <Check class="size-3.5" />
                On timeline
              </div>
              <Button variant="ghost" size="icon-sm" title="Search again" aria-label="Search again" @click="$emit('regenerate', s.id)">
                <RefreshCw />
              </Button>
            </div>
          </div>
        </div>

        <div v-if="readyCount > 0" class="border-t border-line-subtle px-3 py-2.5">
          <Button variant="secondary" size="sm" block @click="$emit('apply-all')">Add all ready ({{ readyCount }})</Button>
        </div>
      </template>

      <!-- Manual search tab -->
      <template v-else>
        <div class="flex flex-col gap-2.5 border-b border-line-subtle px-3 py-3">
          <Field label="Search stock">
            <Input
              v-model="localManualQuery"
              type="text"
              placeholder="e.g. city skyline, coffee shop..."
              class="h-[var(--control-sm)] text-xs"
              @keydown.enter.prevent="submitManualSearch"
            />
          </Field>

          <div class="grid grid-cols-2 gap-2">
            <Field label="Media">
              <Select
                :model-value="localManualMediaType"
                @update:model-value="(v) => (localManualMediaType = v as ManualBrollMediaType)"
              >
                <SelectTrigger class="h-[var(--control-sm)] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="all">Both</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Duration (s)">
              <Input
                v-model.number="localManualDuration"
                type="number"
                min="1"
                :max="Math.max(1, Math.floor(clipDuration || 60))"
                step="0.5"
                class="h-[var(--control-sm)] text-xs"
              />
            </Field>
          </div>

          <Button
            variant="secondary"
            size="sm"
            block
            :loading="isManualSearching"
            :disabled="!localManualQuery.trim()"
            @click="submitManualSearch"
          >
            <Search v-if="!isManualSearching" />
            {{ isManualSearching ? 'Searching...' : 'Search' }}
          </Button>

          <p v-if="manualSearchError" class="rounded-md bg-danger-soft px-2 py-1.5 text-xs text-danger">
            {{ manualSearchError }}
          </p>
          <p v-else class="tabular text-xs text-fg-subtle">
            Add at playhead · {{ formatTime(playheadTime) }}
            <span v-if="clipDuration"> · {{ formatTime(clipDuration) }} clip</span>
          </p>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <p
            v-if="manualSearchResults.length === 0 && !isManualSearching"
            class="px-1 py-6 text-center text-xs leading-relaxed text-fg-subtle"
          >
            Search Pexels and Pixabay for stock footage or stills. Select a result and add it at the current playhead — no
            transcript needed.
          </p>

          <div v-if="manualSearchResults.length > 0" class="grid grid-cols-2 gap-2">
            <BrollCandidateTile
              v-for="c in manualSearchResults"
              :key="c.id"
              :candidate="c"
              :selected="selectedManualCandidateId === c.id"
              show-type
              @mouseenter="playCandidatePreview"
              @mouseleave="pauseCandidatePreview"
              @click="$emit('manual-select-candidate', c.id)"
            />
          </div>
        </div>

        <div v-if="manualSearchResults.length > 0" class="border-t border-line-subtle px-3 py-2.5">
          <Button
            variant="primary"
            size="sm"
            block
            :loading="isManualAdding"
            :disabled="!selectedManualCandidateId"
            @click="submitManualAdd"
          >
            <Plus v-if="!isManualAdding" />
            Add at {{ formatTime(playheadTime) }}
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Sparkles, X, Search, RefreshCw, Plus, Check } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import BrollCandidateTile from './BrollCandidateTile.vue';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AiBrollCandidate, AiBrollPlannerOptions, AiBrollSuggestion } from '@/types/ai-broll';
import type { ManualBrollMediaType } from '@/composables/useAiBroll';

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
    playheadTime?: number;
    manualSearchQuery?: string;
    manualSearchMediaType?: ManualBrollMediaType;
    manualSearchResults?: AiBrollCandidate[];
    selectedManualCandidateId?: string | null;
    isManualSearching?: boolean;
    manualSearchError?: string | null;
    isManualAdding?: boolean;
  }>(),
  {
    variant: 'poi',
    clipDuration: 0,
    playheadTime: 0,
    manualSearchQuery: '',
    manualSearchMediaType: 'video',
    manualSearchResults: () => [],
    selectedManualCandidateId: null,
    isManualSearching: false,
    manualSearchError: null,
    isManualAdding: false,
  },
);

const emit = defineEmits<{
  close: [];
  generate: [options: AiBrollPlannerOptions];
  'fetch-all': [];
  apply: [suggestionId: string];
  'apply-all': [];
  regenerate: [suggestionId: string];
  reject: [suggestionId: string];
  'select-candidate': [suggestionId: string, candidateId: string];
  'manual-search': [query: string, mediaType: ManualBrollMediaType];
  'manual-select-candidate': [candidateId: string];
  'manual-add': [payload: { candidateId: string; duration: number; startTime: number }];
  'update:manualSearchQuery': [value: string];
  'update:manualSearchMediaType': [value: ManualBrollMediaType];
}>();

const activeTab = ref<'ai' | 'manual'>(props.canGenerate ? 'ai' : 'manual');
const tabOptions = [
  { value: 'ai' as const, label: 'AI suggestions' },
  { value: 'manual' as const, label: 'Manual search' },
];

const localOptions = reactive({ ...props.plannerOptions });
const localManualQuery = ref(props.manualSearchQuery);
const localManualMediaType = ref<ManualBrollMediaType>(props.manualSearchMediaType);
const localManualDuration = ref(4);

watch(
  () => props.plannerOptions,
  (next) => {
    Object.assign(localOptions, next);
  },
  { deep: true },
);

watch(
  () => props.manualSearchQuery,
  (next) => {
    localManualQuery.value = next;
  },
);

watch(localManualQuery, (next) => {
  emit('update:manualSearchQuery', next);
});

watch(
  () => props.manualSearchMediaType,
  (next) => {
    localManualMediaType.value = next;
  },
);

watch(localManualMediaType, (next) => {
  emit('update:manualSearchMediaType', next);
});

watch(
  () => props.canGenerate,
  (canGenerate) => {
    if (!canGenerate && activeTab.value === 'ai') {
      activeTab.value = 'manual';
    }
  },
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

function statusClass(status: AiBrollSuggestion['status']): 'success' | 'brand' | 'neutral' | 'danger' {
  switch (status) {
    case 'applied':
      return 'success';
    case 'ready':
      return 'brand';
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}

function submitManualSearch() {
  const query = localManualQuery.value.trim();
  if (!query) return;
  emit('manual-search', query, localManualMediaType.value);
}

function submitManualAdd() {
  if (!props.selectedManualCandidateId) return;
  const maxDuration = Math.max(1, props.clipDuration - props.playheadTime);
  const duration = Math.min(Math.max(1, localManualDuration.value || 4), maxDuration || 60);
  emit('manual-add', {
    candidateId: props.selectedManualCandidateId,
    duration,
    startTime: props.playheadTime,
  });
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
