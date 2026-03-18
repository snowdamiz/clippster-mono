<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="border-b border-white/10 px-4 py-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-foreground">Transcript</h3>
          <p class="mt-1 text-[10px] text-muted-foreground">
            {{ transcriptWordCount > 0 ? `${transcriptWordCount} words attached to this video` : 'No transcript loaded' }}
          </p>
        </div>
        <div class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
          Word-timed
        </div>
      </div>

      <div class="mt-3 flex items-center gap-2">
        <div class="relative flex-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <input
            ref="searchInputRef"
            v-model="internalSearchQuery"
            type="text"
            placeholder="Search transcript"
            class="h-9 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-24 text-xs text-foreground outline-none transition focus:border-emerald-500/40 focus:bg-white/[0.07]"
            @keydown.enter.prevent="navigateMatch(1)"
            @keydown.shift.enter.prevent="navigateMatch(-1)"
          />
          <div
            v-if="internalSearchQuery.trim()"
            class="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1"
          >
            <span
              class="text-[10px] tabular-nums"
              :class="matchOccurrences.length > 0 ? 'text-muted-foreground' : 'text-amber-300/80'"
            >
              {{ matchOccurrences.length > 0 ? `${currentMatchIndex + 1}/${matchOccurrences.length}` : 'No results' }}
            </span>
            <button
              class="rounded p-0.5 text-muted-foreground/70 transition hover:bg-white/10 hover:text-foreground"
              title="Clear search"
              @click="clearSearch"
            >
              <X class="size-3" />
            </button>
          </div>
        </div>

        <button
          v-if="matchOccurrences.length > 0"
          class="rounded-lg border border-white/10 bg-white/5 p-2 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
          title="Previous result"
          @click="navigateMatch(-1)"
        >
          <ChevronUp class="size-3.5" />
        </button>
        <button
          v-if="matchOccurrences.length > 0"
          class="rounded-lg border border-white/10 bg-white/5 p-2 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
          title="Next result"
          @click="navigateMatch(1)"
        >
          <ChevronDown class="size-3.5" />
        </button>
      </div>

      <div
        v-if="selectionTimeRange"
        class="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2"
      >
        <span class="text-[10px] font-mono tabular-nums text-emerald-200">
          {{ formatTime(selectionTimeRange.startTime) }} - {{ formatTime(selectionTimeRange.endTime) }}
        </span>
        <span class="text-[10px] text-emerald-100/70">
          {{ selectedWordCount }} selected
        </span>
        <div class="flex-1"></div>
        <button
          class="inline-flex items-center gap-1 rounded-md border border-emerald-400/25 bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-200 transition hover:bg-emerald-500/25"
          @click="createClipFromSelection"
        >
          <Scissors class="size-3" />
          Create Clip
        </button>
        <button
          class="rounded-md px-2 py-1 text-[10px] text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
          @click="clearSelection"
        >
          Clear
        </button>
      </div>

      <p v-else class="mt-3 text-[10px] text-muted-foreground">
        Click a word to seek. Drag across words to create a clip. Double-click a word to edit it.
      </p>
    </div>

    <div v-if="loadingTranscript" class="flex flex-1 items-center justify-center px-6">
      <div class="text-center text-muted-foreground">
        <Loader2 class="mx-auto mb-3 size-7 animate-spin text-emerald-400" />
        <p class="text-sm font-medium text-foreground">Loading transcript...</p>
        <p class="mt-1 text-[10px]">Fetching word timings for this video.</p>
      </div>
    </div>

    <div
      v-else-if="!transcriptData || transcriptWordCount === 0"
      class="flex flex-1 items-center justify-center px-6"
    >
      <div class="max-w-xs text-center text-muted-foreground">
        <FileText class="mx-auto mb-3 size-8 text-emerald-400/70" />
        <p class="text-sm font-medium text-foreground">Transcript unavailable</p>
        <p class="mt-1 text-xs leading-relaxed">
          This tab appears when the workspace finds transcript words attached to the source video.
        </p>
      </div>
    </div>

    <div
      v-else
      ref="transcriptContentRef"
      class="workspace-transcript-scroll custom-scrollbar flex-1 overflow-y-auto px-4 py-4"
      @mouseup="onWordMouseUp"
    >
      <div class="text-sm leading-7 text-foreground/95">
        <span
          v-for="(word, index) in transcriptData.words"
          :key="`workspace-transcript-word-${index}`"
          :ref="(el) => setWordRef(el, index)"
          :class="getWordClasses(index)"
          class="inline-block rounded-md px-1 py-0.5 align-baseline transition-colors"
          @click="onWordClick(word, index)"
          @dblclick="onWordDoubleClick(word, index)"
          @mousedown="onWordMouseDown($event, index)"
          @mouseenter="onWordMouseEnter(index)"
          :title="getWordTitle(word, index)"
        >
          <input
            v-if="editingWordIndex === index"
            :data-word-index="index"
            v-model="editingWordText"
            class="min-w-[24px] border-b border-emerald-400 bg-transparent px-0 text-inherit outline-none"
            style="font: inherit"
            @blur="saveWordEdit"
            @keydown="onWordKeydown"
          />
          <span v-else>{{ getWordText(word) }}{{ index < transcriptWordCount - 1 ? ' ' : '' }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onMounted, onUnmounted, ref, watch, type ComponentPublicInstance } from 'vue';
  import {
    ChevronDown,
    ChevronUp,
    FileText,
    Loader2,
    Scissors,
    Search,
    X,
  } from 'lucide-vue-next';
  import { updateTranscriptWord } from '@/services/database';
  import { useTranscriptData } from '@/composables/useTranscriptData';

  interface Props {
    projectId?: string | null;
    currentTime?: number;
    duration?: number;
  }

  const props = withDefaults(defineProps<Props>(), {
    projectId: null,
    currentTime: 0,
    duration: 0,
  });

  interface Emits {
    (e: 'seekVideo', time: number): void;
    (e: 'createClipFromTranscript', startTime: number, endTime: number, transcriptText: string): void;
  }

  const emit = defineEmits<Emits>();

  const { transcriptData, loadTranscriptData } = useTranscriptData(computed(() => props.projectId || null));

  const transcriptContentRef = ref<HTMLElement | null>(null);
  const searchInputRef = ref<HTMLInputElement | null>(null);
  const loadingTranscript = ref(false);
  const currentWordIndex = ref(-1);
  const editingWordIndex = ref(-1);
  const editingWordText = ref('');
  const wordElements = ref<Map<number, HTMLElement>>(new Map());
  const preventAutoscroll = ref(false);

  const isSelecting = ref(false);
  const selectionAnchorIndex = ref(-1);
  const selectionStartIndex = ref(-1);
  const selectionEndIndex = ref(-1);

  const internalSearchQuery = ref('');
  const debouncedSearchQuery = ref('');
  const currentMatchIndex = ref(0);
  let searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
  let autoscrollTimeout: ReturnType<typeof setTimeout> | null = null;

  const transcriptWordCount = computed(() => transcriptData.value?.words.length ?? 0);

  const matchedPhraseIndices = computed((): number[] => {
    if (!debouncedSearchQuery.value.trim() || !transcriptData.value?.words.length) return [];

    const queryWords = debouncedSearchQuery.value
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    if (queryWords.length === 0) return [];

    const matches: number[] = [];
    const words = transcriptData.value.words;

    for (let index = 0; index <= words.length - queryWords.length; index++) {
      let phraseMatches = true;

      for (let queryIndex = 0; queryIndex < queryWords.length; queryIndex++) {
        const wordText = normalizeSearchText(getWordText(words[index + queryIndex]));
        const queryText = normalizeSearchText(queryWords[queryIndex]);

        if (!wordText.includes(queryText)) {
          phraseMatches = false;
          break;
        }
      }

      if (phraseMatches) {
        for (let queryIndex = 0; queryIndex < queryWords.length; queryIndex++) {
          matches.push(index + queryIndex);
        }
      }
    }

    return matches;
  });

  const matchOccurrences = computed((): number[] => {
    if (!debouncedSearchQuery.value.trim() || !transcriptData.value?.words.length) return [];

    const queryWords = debouncedSearchQuery.value
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    if (queryWords.length === 0) return [];

    const matches: number[] = [];
    const words = transcriptData.value.words;

    for (let index = 0; index <= words.length - queryWords.length; index++) {
      let phraseMatches = true;

      for (let queryIndex = 0; queryIndex < queryWords.length; queryIndex++) {
        const wordText = normalizeSearchText(getWordText(words[index + queryIndex]));
        const queryText = normalizeSearchText(queryWords[queryIndex]);

        if (!wordText.includes(queryText)) {
          phraseMatches = false;
          break;
        }
      }

      if (phraseMatches) {
        matches.push(index);
      }
    }

    return matches;
  });

  const activeMatchWordIndex = computed((): number => {
    if (matchOccurrences.value.length === 0) return -1;
    return matchOccurrences.value[currentMatchIndex.value] ?? -1;
  });

  const selectionTimeRange = computed(() => {
    if (selectionStartIndex.value === -1 || selectionEndIndex.value === -1 || !transcriptData.value) {
      return null;
    }

    const startWord = transcriptData.value.words[selectionStartIndex.value];
    const endWord = transcriptData.value.words[selectionEndIndex.value];

    if (!startWord || !endWord) return null;

    return {
      startTime: getWordStart(startWord),
      endTime: getWordEnd(endWord),
    };
  });

  const selectedWordCount = computed(() => {
    if (selectionStartIndex.value === -1 || selectionEndIndex.value === -1) return 0;
    return selectionEndIndex.value - selectionStartIndex.value + 1;
  });

  const selectionText = computed(() => {
    if (!transcriptData.value || selectionStartIndex.value === -1 || selectionEndIndex.value === -1) {
      return '';
    }

    return transcriptData.value.words
      .slice(selectionStartIndex.value, selectionEndIndex.value + 1)
      .map((word) => getWordText(word))
      .join(' ');
  });

  watch(
    internalSearchQuery,
    (value) => {
      if (searchDebounceTimeout) {
        clearTimeout(searchDebounceTimeout);
      }

      searchDebounceTimeout = setTimeout(() => {
        debouncedSearchQuery.value = value;
        currentMatchIndex.value = 0;
      }, 250);
    },
    { immediate: true }
  );

  watch(matchOccurrences, (occurrences) => {
    if (occurrences.length === 0) return;

    nextTick(() => {
      const firstMatch = wordElements.value.get(occurrences[0]);
      firstMatch?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  watch(
    () => props.projectId,
    async (projectId) => {
      if (!projectId) {
        loadingTranscript.value = false;
        clearSelection();
        return;
      }

      await refreshTranscript(projectId);
    },
    { immediate: true }
  );

  watch(
    () => props.currentTime,
    () => {
      updateCurrentWordIndex();
    },
    { immediate: true }
  );

  onMounted(() => {
    document.addEventListener('transcript-updated', handleTranscriptUpdated as EventListener);
    document.addEventListener('mouseup', handleDocumentMouseUp);
  });

  onUnmounted(() => {
    document.removeEventListener('transcript-updated', handleTranscriptUpdated as EventListener);
    document.removeEventListener('mouseup', handleDocumentMouseUp);

    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = null;
    }

    if (autoscrollTimeout) {
      clearTimeout(autoscrollTimeout);
      autoscrollTimeout = null;
    }

    wordElements.value.clear();
  });

  async function refreshTranscript(projectId: string) {
    loadingTranscript.value = true;
    clearSelection();

    try {
      await loadTranscriptData(projectId);
    } finally {
      loadingTranscript.value = false;
      updateCurrentWordIndex();
    }
  }

  async function handleTranscriptUpdated(event: Event) {
    const customEvent = event as CustomEvent<{ projectId?: string }>;
    const eventProjectId = customEvent.detail?.projectId;

    if (!eventProjectId || !props.projectId || String(eventProjectId) !== String(props.projectId)) {
      return;
    }

    await refreshTranscript(props.projectId);
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function normalizeSearchText(value: string): string {
    return value.toLowerCase().replace(/[^\w\s]/g, '');
  }

  function setWordRef(element: Element | ComponentPublicInstance | null, index: number) {
    if (element instanceof HTMLElement) {
      wordElements.value.set(index, element);
      return;
    }

    wordElements.value.delete(index);
  }

  function getWordText(word: any): string {
    return word.text || word.word || word.content || String(word);
  }

  function getWordStart(word: any): number {
    return word.start || word.begin || word.startTime || 0;
  }

  function getWordEnd(word: any): number {
    return word.end || word.finish || word.endTime || getWordStart(word);
  }

  function getWordMiddle(word: any): number {
    const start = getWordStart(word);
    const end = getWordEnd(word);
    return start + (end - start) / 2;
  }

  function updateCurrentWordIndex() {
    if (!transcriptData.value?.words.length) {
      currentWordIndex.value = -1;
      return;
    }

    const words = transcriptData.value.words;
    const currentTime = props.currentTime ?? 0;

    let nextIndex = -1;

    for (let index = 0; index < words.length; index++) {
      const word = words[index];
      if (currentTime >= getWordStart(word) && currentTime <= getWordEnd(word)) {
        nextIndex = index;
        break;
      }
    }

    if (nextIndex === -1) {
      let closestDistance = Infinity;

      for (let index = 0; index < words.length; index++) {
        const distance = Math.abs(getWordStart(words[index]) - currentTime);
        if (distance < closestDistance) {
          closestDistance = distance;
          nextIndex = index;
        }
      }
    }

    if (nextIndex === currentWordIndex.value) {
      return;
    }

    const oldIndex = currentWordIndex.value;
    currentWordIndex.value = nextIndex;

    const isBackwardSeek = nextIndex < oldIndex && oldIndex - nextIndex > 5;
    const isLargeSeek = Math.abs(nextIndex - oldIndex) > 20;
    const isAtBeginning = nextIndex <= 10;

    scrollToCurrentWord(isBackwardSeek || isLargeSeek || isAtBeginning);
  }

  function scrollToCurrentWord(forceScroll = false) {
    if (currentWordIndex.value === -1 || preventAutoscroll.value || !transcriptContentRef.value) {
      return;
    }

    const wordElement = wordElements.value.get(currentWordIndex.value);
    if (!wordElement) return;

    nextTick(() => {
      const container = transcriptContentRef.value;
      if (!container) return;

      const containerTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const wordTop = wordElement.offsetTop;
      const wordBottom = wordTop + wordElement.offsetHeight;
      const safeTop = containerTop + 48;
      const safeBottom = containerTop + containerHeight - 48;

      if (!forceScroll && wordTop >= safeTop && wordBottom <= safeBottom) {
        return;
      }

      let targetTop = containerTop;

      if (forceScroll) {
        targetTop = Math.max(0, wordTop - 24);
      } else if (wordTop < safeTop) {
        targetTop = Math.max(0, wordTop - 64);
      } else if (wordBottom > safeBottom) {
        targetTop = wordBottom - containerHeight + 64;
      }

      if (Math.abs(targetTop - containerTop) > 4) {
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    });
  }

  function isWordMatched(index: number): boolean {
    return matchedPhraseIndices.value.includes(index);
  }

  function isWordActiveMatch(index: number): boolean {
    if (activeMatchWordIndex.value === -1 || !debouncedSearchQuery.value.trim()) return false;

    const queryLength = debouncedSearchQuery.value.trim().split(/\s+/).filter(Boolean).length;
    return index >= activeMatchWordIndex.value && index < activeMatchWordIndex.value + queryLength;
  }

  function isWordSelected(index: number): boolean {
    if (selectionStartIndex.value === -1 || selectionEndIndex.value === -1) return false;
    return index >= selectionStartIndex.value && index <= selectionEndIndex.value;
  }

  function getWordClasses(index: number): string {
    if (isWordSelected(index)) {
      return 'cursor-pointer border border-emerald-400/40 bg-emerald-500/20 text-emerald-100';
    }

    if (isWordActiveMatch(index)) {
      return 'cursor-pointer border border-amber-300/40 bg-amber-500/20 text-amber-100';
    }

    if (isWordMatched(index)) {
      return 'cursor-pointer bg-amber-500/10 text-amber-100';
    }

    if (currentWordIndex.value === index) {
      return 'cursor-pointer bg-cyan-500/85 text-white shadow-sm';
    }

    if (currentWordIndex.value !== -1 && transcriptData.value?.words[index]) {
      const word = transcriptData.value.words[index];
      if (getWordEnd(word) < (props.currentTime ?? 0)) {
        return 'cursor-pointer text-foreground';
      }
    }

    return 'cursor-pointer text-muted-foreground hover:bg-white/6 hover:text-foreground';
  }

  function getWordTitle(word: any, index: number): string {
    if (editingWordIndex.value === index) {
      return 'Editing word';
    }

    return `Jump to ${formatTime(getWordMiddle(word))}. Double-click to edit.`;
  }

  function navigateMatch(direction: number) {
    if (matchOccurrences.value.length === 0) return;

    let nextIndex = currentMatchIndex.value + direction;
    if (nextIndex < 0) nextIndex = matchOccurrences.value.length - 1;
    if (nextIndex >= matchOccurrences.value.length) nextIndex = 0;
    currentMatchIndex.value = nextIndex;

    const wordIndex = matchOccurrences.value[nextIndex];
    const word = transcriptData.value?.words[wordIndex];
    if (!word) return;

    emit('seekVideo', getWordStart(word));

    nextTick(() => {
      wordElements.value.get(wordIndex)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function clearSearch() {
    internalSearchQuery.value = '';
    debouncedSearchQuery.value = '';
    currentMatchIndex.value = 0;
    searchInputRef.value?.focus();
  }

  function onWordMouseDown(event: MouseEvent, index: number) {
    if (event.button !== 0 || editingWordIndex.value !== -1) return;

    event.preventDefault();
    isSelecting.value = true;
    selectionAnchorIndex.value = index;
    selectionStartIndex.value = index;
    selectionEndIndex.value = index;
  }

  function onWordMouseEnter(index: number) {
    if (!isSelecting.value || selectionAnchorIndex.value === -1) return;

    selectionStartIndex.value = Math.min(selectionAnchorIndex.value, index);
    selectionEndIndex.value = Math.max(selectionAnchorIndex.value, index);
  }

  function onWordMouseUp() {
    if (!isSelecting.value) return;
    isSelecting.value = false;

    if (selectionStartIndex.value === selectionEndIndex.value) {
      clearSelection();
    }
  }

  function handleDocumentMouseUp() {
    onWordMouseUp();
  }

  function clearSelection() {
    selectionAnchorIndex.value = -1;
    selectionStartIndex.value = -1;
    selectionEndIndex.value = -1;
  }

  function createClipFromSelection() {
    if (!selectionTimeRange.value || !selectionText.value.trim()) return;

    emit(
      'createClipFromTranscript',
      selectionTimeRange.value.startTime,
      selectionTimeRange.value.endTime,
      selectionText.value
    );

    clearSelection();
  }

  function holdAutoscroll() {
    preventAutoscroll.value = true;

    if (autoscrollTimeout) {
      clearTimeout(autoscrollTimeout);
    }

    autoscrollTimeout = setTimeout(() => {
      preventAutoscroll.value = false;
      autoscrollTimeout = null;
    }, 5000);
  }

  function onWordClick(word: any, index: number) {
    if (editingWordIndex.value !== -1) return;
    if (selectedWordCount.value > 1 && isWordSelected(index)) return;

    holdAutoscroll();
    emit('seekVideo', getWordMiddle(word));
  }

  function onWordDoubleClick(word: any, index: number) {
    holdAutoscroll();
    startWordEdit(word, index);
  }

  function startWordEdit(word: any, index: number) {
    editingWordIndex.value = index;
    editingWordText.value = getWordText(word);

    nextTick(() => {
      const input = document.querySelector(`input[data-word-index="${index}"]`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }

  function cancelWordEdit() {
    editingWordIndex.value = -1;
    editingWordText.value = '';
    preventAutoscroll.value = false;
  }

  async function saveWordEdit() {
    if (editingWordIndex.value === -1 || !props.projectId) {
      cancelWordEdit();
      return;
    }

    const wordIndex = editingWordIndex.value;
    const newText = editingWordText.value.trim();
    const existingWord = transcriptData.value?.words[wordIndex];

    if (!existingWord || !newText) {
      cancelWordEdit();
      return;
    }

    const oldText = getWordText(existingWord);
    if (oldText === newText) {
      cancelWordEdit();
      return;
    }

    const result = await updateTranscriptWord(props.projectId, wordIndex, newText);
    if (!result.success) {
      console.error('[ProjectWorkspaceTranscriptTab] Failed to update word:', result.error);
      cancelWordEdit();
      return;
    }

    const mutableWord = transcriptData.value?.words[wordIndex] as any;
    if (mutableWord) {
      if (mutableWord.word !== undefined) mutableWord.word = newText;
      if (mutableWord.text !== undefined) mutableWord.text = newText;
      if (mutableWord.content !== undefined) mutableWord.content = newText;
    }

    editingWordIndex.value = -1;
    editingWordText.value = '';
    preventAutoscroll.value = false;
  }

  function onWordKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      void saveWordEdit();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      cancelWordEdit();
      return;
    }

    if (
      event.key === 'Tab' &&
      editingWordIndex.value !== -1 &&
      editingWordIndex.value < transcriptWordCount.value - 1
    ) {
      event.preventDefault();
      const nextIndex = editingWordIndex.value + 1;
      void saveWordEdit().then(() => {
        const nextWord = transcriptData.value?.words[nextIndex];
        if (nextWord) {
          startWordEdit(nextWord, nextIndex);
        }
      });
    }
  }
</script>

<style scoped>
  .workspace-transcript-scroll {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
  }

  .workspace-transcript-scroll::-webkit-scrollbar {
    width: 6px;
  }

  .workspace-transcript-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .workspace-transcript-scroll::-webkit-scrollbar-thumb {
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.16);
  }

  .workspace-transcript-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.24);
  }
</style>
