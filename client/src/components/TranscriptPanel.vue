<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Loading state -->
    <div v-if="loadingTranscript" class="flex flex-1 flex-col items-center justify-center gap-2 text-fg-muted">
      <Loader2 class="size-5 animate-spin text-fg-subtle" />
      <p class="text-sm">Loading transcript...</p>
    </div>

    <!-- No transcript state -->
    <EmptyState
      v-else-if="!transcriptData || !transcriptData.words.length"
      :icon="FileText"
      size="sm"
      title="No transcript yet"
      description="Generate clips first to automatically transcribe audio from your video."
      class="flex-1"
    />

    <!-- Transcript with toolbar -->
    <template v-else>
      <!-- Search (only when the header is shown; otherwise the parent drives searchQuery) -->
      <div
        v-if="!hideHeader"
        class="flex h-11 shrink-0 items-center gap-1 border-b border-line-subtle px-3"
        @keydown.enter.exact.prevent="navigateMatch(1)"
        @keydown.shift.enter.prevent="navigateMatch(-1)"
      >
        <SearchField
          ref="searchInputRef"
          v-model="internalSearchQuery"
          size="sm"
          placeholder="Search transcript..."
          class="flex-1"
          @clear="clearSearch"
        />
        <template v-if="internalSearchQuery.trim()">
          <span
            class="tabular shrink-0 whitespace-nowrap px-1 text-2xs"
            :class="matchOccurrences.length > 0 ? 'text-fg-muted' : 'text-danger'"
          >
            {{ matchOccurrences.length > 0 ? `${currentMatchIndex + 1} of ${matchOccurrences.length}` : 'No results' }}
          </span>
          <template v-if="matchOccurrences.length > 0">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Previous match (Shift+Enter)"
              aria-label="Previous match"
              @click="navigateMatch(-1)"
            >
              <ChevronUp />
            </Button>
            <Button variant="ghost" size="icon-sm" title="Next match (Enter)" aria-label="Next match" @click="navigateMatch(1)">
              <ChevronDown />
            </Button>
          </template>
        </template>
      </div>

      <!-- Strikethrough toolbar -->
      <div class="flex h-9 shrink-0 items-center gap-1.5 border-b border-line-subtle px-3">
        <Button
          :variant="strikethroughMode ? 'destructive-soft' : 'ghost'"
          size="xs"
          :aria-pressed="strikethroughMode"
          :title="strikethroughMode ? 'Exit strikethrough mode' : 'Strikethrough mode — click words to mark for removal'"
          @click="strikethroughMode = !strikethroughMode"
        >
          <Strikethrough />
          {{ strikethroughMode ? 'Marking...' : 'Mark' }}
        </Button>
        <template v-if="strikethroughCount > 0">
          <span class="tabular whitespace-nowrap text-2xs text-danger">{{ strikethroughCount }} marked</span>
          <Button variant="ghost" size="icon-xs" title="Clear all marks" aria-label="Clear all marks" @click="clearStrikethrough">
            <Undo2 />
          </Button>
          <Button
            variant="destructive-soft"
            size="xs"
            title="Delete all marked words (ripple-delete from timeline)"
            @click="commitStrikethrough"
          >
            <Trash2 />
            Delete marked
          </Button>
        </template>
        <span v-if="strikethroughCount === 0" class="tabular ms-auto shrink-0 text-2xs text-fg-subtle">
          {{ transcriptData.words.length }} words
        </span>
      </div>

      <!-- Transcript content -->
      <div ref="transcriptContent" class="relative flex-1 overflow-y-auto px-3 pt-3">
        <!-- Floating selection toolbar -->
        <Transition name="toolbar-fade">
          <div
            v-if="showSelectionToolbar && selectionTimeRange"
            class="pointer-events-auto absolute z-20 -translate-x-1/2"
            :style="{ top: `${selectionToolbarPos.top}px`, left: `${selectionToolbarPos.left}px` }"
          >
            <div class="flex items-center gap-1 rounded-lg bg-surface-raised p-1 shadow-[var(--shadow-md)]">
              <span class="tabular px-1.5 text-2xs text-fg-muted">
                {{ formatTime(selectionTimeRange.startTime) }} – {{ formatTime(selectionTimeRange.endTime) }}
              </span>
              <span class="h-4 w-px bg-line" aria-hidden="true"></span>
              <Button variant="ghost" size="xs" title="Create clip from selection" @click.stop="onCreateClipFromSelection">
                <Scissors />
                Clip
              </Button>
              <Button
                variant="ghost"
                size="xs"
                title="Split video at selection start"
                @click.stop="splitAtWordBoundary(selectionStartIndex)"
              >
                <SplitSquareHorizontal />
                Split
              </Button>
              <Button
                variant="destructive-soft"
                size="xs"
                title="Delete selected words (ripple-delete from timeline)"
                @click.stop="deleteSelectedWords"
              >
                <Trash2 />
                Delete
              </Button>
              <Button variant="ghost" size="icon-xs" title="Clear selection" aria-label="Clear selection" @click.stop="clearWordSelection">
                <XIcon />
              </Button>
            </div>
          </div>
        </Transition>

        <div class="transcript-content min-h-full select-none break-words pb-4 text-sm leading-7 text-fg">
          <span
            v-for="(word, index) in transcriptData.words"
            :key="`word-${index}`"
            :ref="(el) => setWordRef(el, index)"
            :class="getWordClasses(word, index)"
            class="word-interactive mx-px inline-block cursor-pointer whitespace-normal rounded px-[3px] leading-6 transition-colors"
            @click="onWordClick(word, index)"
            @dblclick="onWordDoubleClick(word, index)"
            @mousedown="onWordMouseDown($event, index)"
            @mouseenter="onWordMouseEnter(index)"
            @mouseup="onWordMouseUp($event)"
            :title="getWordTitle(word, index)"
          >
            <!-- Show input field when editing this word -->
            <input
              v-if="editingWordIndex === index"
              :data-word-index="index"
              v-model="editingWordText"
              @blur="saveWordEdit()"
              @keydown="onWordKeydown($event)"
              class="min-w-[20px] px-0 outline-none"
              style="font: inherit"
            />
            <!-- Show normal word text when not editing -->
            <span v-else>{{ getWordText(word) }}{{ index < transcriptData.words.length - 1 ? ' ' : '' }}</span>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { useToast } from '@/composables/useToast';
  import { ref, computed, watch, nextTick, onUnmounted, onMounted } from 'vue';
  import { useTranscriptData } from '../composables/useTranscriptData';
  import { Loader2, FileText, ChevronUp, ChevronDown, X as XIcon, Scissors, Strikethrough, Trash2, SplitSquareHorizontal, Undo2 } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { SearchField } from '@/components/ui/search-field';

  interface Props {
    projectId?: string | null;
    currentTime?: number;
    duration?: number;
    hideHeader?: boolean;
    searchQuery?: string;
  }

  const props = withDefaults(defineProps<Props>(), {
    currentTime: 0,
    duration: 0,
    hideHeader: false,
    searchQuery: '',
  });

  interface Emits {
    (e: 'seekVideo', time: number): void;
    (e: 'createClipFromTranscript', startTime: number, endTime: number, transcriptText: string): void;
    (e: 'deleteTimeRange', startTime: number, endTime: number): void;
    (e: 'splitAtTime', time: number): void;
  }

  const emit = defineEmits<Emits>();

  const transcriptContent = ref<HTMLElement>();
  const loadingTranscript = ref(false);
  const currentWordIndex = ref(-1);
  const wordElements = ref<Map<number, HTMLElement>>(new Map());
  const showScrollIndicator = ref(true);
  const userHasScrolled = ref(false);

  // Word editing state
  const editingWordIndex = ref(-1);
  const editingWordText = ref('');

  // Word range selection state (for clip creation)
  const isSelecting = ref(false);
  const selectionAnchorIndex = ref(-1);
  const selectionStartIndex = ref(-1);
  const selectionEndIndex = ref(-1);
  const showSelectionToolbar = ref(false);
  const selectionToolbarPos = ref({ top: 0, left: 0 });

  // Strikethrough mode state
  const strikethroughMode = ref(false);
  const strikethroughIndices = ref<Set<number>>(new Set());
  const strikethroughCount = computed(() => strikethroughIndices.value.size);

  // Search state - internal query for when header is shown, prop for when hidden
  const internalSearchQuery = ref('');
  const debouncedSearchQuery = ref('');
  const searchInputRef = ref<{ focus: () => void } | null>(null);
  const currentMatchIndex = ref(0);
  let searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

  // Computed search query - uses prop when header is hidden, internal state otherwise
  const effectiveSearchQuery = computed(() => {
    return props.hideHeader ? props.searchQuery : internalSearchQuery.value;
  });

  // Flag to prevent autoscroll when user manually clicks words
  const preventAutoscroll = ref(false);

  // Use transcript data composable
  const { transcriptData, loadTranscriptData } = useTranscriptData(computed(() => props.projectId || null));

  // Watch effective search query and debounce it
  watch(effectiveSearchQuery, (newValue) => {
    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout);
    }
    searchDebounceTimeout = setTimeout(() => {
      debouncedSearchQuery.value = newValue;
      // Reset to first match when search changes
      currentMatchIndex.value = 0;
    }, 300); // 300ms debounce
  });

  // Format time in MM:SS format
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function setWordRef(el: any, index: number) {
    if (el && el instanceof HTMLElement) {
      wordElements.value.set(index, el);
    } else {
      wordElements.value.delete(index);
    }
  }

  // Helper function to get text from word with different possible property names
  function getWordText(word: any): string {
    return word.text || word.word || word.content || String(word);
  }

  // Helper function to get start time from word with different possible property names
  function getWordStart(word: any): number {
    return word.start || word.begin || word.startTime || 0;
  }

  // Helper function to get end time from word with different possible property names
  function getWordEnd(word: any): number {
    return word.end || word.finish || word.endTime || getWordStart(word) + 1;
  }

  // Helper function to get the middle time of a word for more accurate seeking
  function getWordMiddle(word: any): number {
    const start = getWordStart(word);
    const end = getWordEnd(word);
    return start + (end - start) / 2;
  }

  // Search functionality - computed property to cache matched indices
  const matchedPhraseIndices = computed((): number[] => {
    if (!debouncedSearchQuery.value.trim() || !transcriptData.value?.words.length) return [];

    const query = debouncedSearchQuery.value.toLowerCase().trim();
    const queryWords = query.split(/\s+/).filter((word) => word.length > 0);

    if (queryWords.length === 0) return [];

    const words = transcriptData.value.words;
    const matchedIndices: number[] = [];

    // Search for the phrase in the transcript
    for (let i = 0; i <= words.length - queryWords.length; i++) {
      let isMatch = true;

      // Check if the sequence of words matches the query
      for (let j = 0; j < queryWords.length; j++) {
        const wordText = getWordText(words[i + j]).toLowerCase();
        // Remove punctuation for comparison
        const cleanWordText = wordText.replace(/[^\w\s]/g, '');
        const cleanQueryWord = queryWords[j].replace(/[^\w\s]/g, '');

        if (!cleanWordText.includes(cleanQueryWord)) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) {
        // Add all indices for the matched phrase
        for (let j = 0; j < queryWords.length; j++) {
          matchedIndices.push(i + j);
        }
      }
    }

    return matchedIndices;
  });

  // Distinct match occurrences - each entry is the starting word index of a match
  const matchOccurrences = computed((): number[] => {
    if (!debouncedSearchQuery.value.trim() || !transcriptData.value?.words.length) return [];

    const query = debouncedSearchQuery.value.toLowerCase().trim();
    const queryWords = query.split(/\s+/).filter((word) => word.length > 0);
    if (queryWords.length === 0) return [];

    const words = transcriptData.value.words;
    const occurrences: number[] = [];

    for (let i = 0; i <= words.length - queryWords.length; i++) {
      let isMatch = true;
      for (let j = 0; j < queryWords.length; j++) {
        const wordText = getWordText(words[i + j]).toLowerCase();
        const cleanWordText = wordText.replace(/[^\w\s]/g, '');
        const cleanQueryWord = queryWords[j].replace(/[^\w\s]/g, '');
        if (!cleanWordText.includes(cleanQueryWord)) {
          isMatch = false;
          break;
        }
      }
      if (isMatch) {
        occurrences.push(i);
      }
    }

    return occurrences;
  });

  // The word index of the currently active/focused match
  const activeMatchWordIndex = computed((): number => {
    if (matchOccurrences.value.length === 0) return -1;
    return matchOccurrences.value[currentMatchIndex.value] ?? -1;
  });

  function isWordMatched(_word: any, index: number): boolean {
    if (!debouncedSearchQuery.value.trim()) return false;
    return matchedPhraseIndices.value.includes(index);
  }

  function isActiveMatch(index: number): boolean {
    if (activeMatchWordIndex.value === -1) return false;
    const query = debouncedSearchQuery.value.toLowerCase().trim();
    const queryWords = query.split(/\s+/).filter((w) => w.length > 0);
    return index >= activeMatchWordIndex.value && index < activeMatchWordIndex.value + queryWords.length;
  }

  function navigateMatch(direction: number) {
    if (matchOccurrences.value.length === 0) return;

    let newIndex = currentMatchIndex.value + direction;
    // Wrap around
    if (newIndex < 0) newIndex = matchOccurrences.value.length - 1;
    if (newIndex >= matchOccurrences.value.length) newIndex = 0;
    currentMatchIndex.value = newIndex;

    // Get the starting word index of this match
    const wordIdx = matchOccurrences.value[newIndex];
    const word = transcriptData.value?.words[wordIdx];
    if (!word) return;

    // Seek video to this word's timestamp
    seekToTime(getWordStart(word));

    // Scroll to the matched word element
    nextTick(() => {
      const wordElement = wordElements.value.get(wordIdx);
      if (wordElement && transcriptContent.value) {
        wordElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  function clearSearch() {
    internalSearchQuery.value = '';
    debouncedSearchQuery.value = '';
    currentMatchIndex.value = 0;
    searchInputRef.value?.focus();
  }

  // Auto-scroll to first match when results change
  watch(matchOccurrences, (occurrences) => {
    if (occurrences.length > 0 && currentMatchIndex.value === 0) {
      const wordIdx = occurrences[0];
      nextTick(() => {
        const wordElement = wordElements.value.get(wordIdx);
        if (wordElement && transcriptContent.value) {
          wordElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  });

  // Get CSS classes for a word based on its state relative to currentTime
  function getWordClasses(word: any, index: number): string {
    // Strikethrough takes highest priority
    if (strikethroughIndices.value.has(index)) {
      return 'line-through text-danger/70 bg-danger-soft';
    }

    // Determine the basic state (current, spoken, future) first
    let stateClasses = '';
    if (currentWordIndex.value === -1 || props.currentTime === undefined || props.duration === 0) {
      stateClasses = 'text-fg-muted ';
    } else {
      const currentWord = transcriptData.value?.words[currentWordIndex.value];
      if (currentWord) {
        const currentStart = getWordStart(currentWord);
        const currentEnd = getWordEnd(currentWord);
        const wordStart = getWordStart(word);
        const wordEnd = getWordEnd(word);

        // Current word (being spoken) - highest priority
        if (currentStart === wordStart && currentEnd === wordEnd) {
          return 'bg-brand text-brand-fg current-word';
        }

        // Already spoken words
        if (wordEnd < props.currentTime) {
          stateClasses = 'text-fg ';
        } else {
          // Future words
          stateClasses = 'text-fg-subtle ';
        }
      } else {
        stateClasses = 'text-fg-muted ';
      }
    }

    // Check for word range selection (clip creation) - blue highlight
    if (isWordInSelection(index)) {
      return 'bg-brand-soft text-fg ring-1 ring-inset ring-[var(--brand-line)] word-selected';
    }

    // Check for active match (currently navigated to) - orange highlight
    if (isActiveMatch(index)) {
      return 'bg-warning/35 text-fg ring-1 ring-inset ring-warning active-match';
    }

    // Check for search match and overlay on top of state
    if (isWordMatched(word, index)) {
      // Search match takes precedence but we maintain font weight from state
      return 'bg-warning-soft text-warning word-match';
    } else {
      return stateClasses.trim();
    }
  }

  function seekToTime(time: number) {
    emit('seekVideo', time);
  }

  // ===== Word Range Selection (Clip Creation) =====

  function isWordInSelection(index: number): boolean {
    if (selectionStartIndex.value === -1 || selectionEndIndex.value === -1) return false;
    return index >= selectionStartIndex.value && index <= selectionEndIndex.value;
  }

  // Computed: time range of the current selection
  const selectionTimeRange = computed(() => {
    if (selectionStartIndex.value === -1 || selectionEndIndex.value === -1 || !transcriptData.value) {
      return null;
    }
    const words = transcriptData.value.words;
    const startWord = words[selectionStartIndex.value];
    const endWord = words[selectionEndIndex.value];
    if (!startWord || !endWord) return null;
    return {
      startTime: getWordStart(startWord),
      endTime: getWordEnd(endWord),
    };
  });

  // Computed: selected transcript text
  const selectionText = computed(() => {
    if (selectionStartIndex.value === -1 || selectionEndIndex.value === -1 || !transcriptData.value) {
      return '';
    }
    const words = transcriptData.value.words;
    return words
      .slice(selectionStartIndex.value, selectionEndIndex.value + 1)
      .map((w: any) => getWordText(w))
      .join(' ');
  });

  function onWordMouseDown(event: MouseEvent, index: number) {
    // Only start selection on left click, and not when editing
    if (event.button !== 0 || editingWordIndex.value !== -1) return;

    // Prevent native text selection
    event.preventDefault();

    isSelecting.value = true;
    selectionAnchorIndex.value = index;
    selectionStartIndex.value = index;
    selectionEndIndex.value = index;
    showSelectionToolbar.value = false;
  }

  function onWordMouseEnter(index: number) {
    if (!isSelecting.value || selectionAnchorIndex.value === -1) return;

    // Update selection range based on anchor and current hover
    selectionStartIndex.value = Math.min(selectionAnchorIndex.value, index);
    selectionEndIndex.value = Math.max(selectionAnchorIndex.value, index);
  }

  function onWordMouseUp(event: MouseEvent) {
    if (!isSelecting.value) return;
    isSelecting.value = false;

    // Only show toolbar if more than 1 word is selected
    if (selectionStartIndex.value !== selectionEndIndex.value && selectionStartIndex.value !== -1) {
      // Position toolbar above the last selected word
      const endElement = wordElements.value.get(selectionEndIndex.value);
      const startElement = wordElements.value.get(selectionStartIndex.value);
      if (startElement && endElement && transcriptContent.value) {
        const containerRect = transcriptContent.value.getBoundingClientRect();
        const startRect = startElement.getBoundingClientRect();
        const endRect = endElement.getBoundingClientRect();

        // Center toolbar between start and end, positioned above
        const midX = (startRect.left + endRect.right) / 2 - containerRect.left;
        const topY = startRect.top - containerRect.top + transcriptContent.value.scrollTop - 8;

        selectionToolbarPos.value = { top: topY, left: midX };
        showSelectionToolbar.value = true;
      }
    } else {
      // Single word click — clear selection and do normal seek
      clearWordSelection();
    }
  }

  function clearWordSelection() {
    selectionStartIndex.value = -1;
    selectionEndIndex.value = -1;
    selectionAnchorIndex.value = -1;
    showSelectionToolbar.value = false;
  }

  function onCreateClipFromSelection() {
    if (!selectionTimeRange.value) return;
    emit(
      'createClipFromTranscript',
      selectionTimeRange.value.startTime,
      selectionTimeRange.value.endTime,
      selectionText.value
    );
    clearWordSelection();
  }

  // ===== Strikethrough Mode =====

  function toggleStrikethroughWord(index: number) {
    if (strikethroughIndices.value.has(index)) {
      strikethroughIndices.value.delete(index);
    } else {
      strikethroughIndices.value.add(index);
    }
    strikethroughIndices.value = new Set(strikethroughIndices.value);
  }

  function clearStrikethrough() {
    strikethroughIndices.value = new Set();
  }

  function commitStrikethrough() {
    if (strikethroughIndices.value.size === 0 || !transcriptData.value) return;

    const sorted = Array.from(strikethroughIndices.value).sort((a, b) => a - b);
    const ranges: { start: number; end: number }[] = [];
    let rangeStart = sorted[0];
    let rangeEnd = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === rangeEnd + 1) {
        rangeEnd = sorted[i];
      } else {
        ranges.push({ start: rangeStart, end: rangeEnd });
        rangeStart = sorted[i];
        rangeEnd = sorted[i];
      }
    }
    ranges.push({ start: rangeStart, end: rangeEnd });

    // Emit delete for each contiguous range (in reverse to preserve indices)
    for (let i = ranges.length - 1; i >= 0; i--) {
      const range = ranges[i];
      const words = transcriptData.value.words;
      const startWord = words[range.start];
      const endWord = words[range.end];
      if (startWord && endWord) {
        emit('deleteTimeRange', getWordStart(startWord), getWordEnd(endWord));
      }
    }

    strikethroughIndices.value = new Set();
    strikethroughMode.value = false;
  }

  // ===== Delete Selected Words =====

  function deleteSelectedWords() {
    if (selectionStartIndex.value === -1 || selectionEndIndex.value === -1 || !transcriptData.value) return;
    const words = transcriptData.value.words;
    const startWord = words[selectionStartIndex.value];
    const endWord = words[selectionEndIndex.value];
    if (startWord && endWord) {
      emit('deleteTimeRange', getWordStart(startWord), getWordEnd(endWord));
    }
    clearWordSelection();
  }

  // ===== Split at Cursor =====

  function splitAtWordBoundary(index: number) {
    if (!transcriptData.value || index <= 0 || index >= transcriptData.value.words.length) return;
    const word = transcriptData.value.words[index];
    if (word) {
      emit('splitAtTime', getWordStart(word));
    }
  }

  // Word editing functions
  function onWordClick(word: any, index: number) {
    // Strikethrough mode: toggle word
    if (strikethroughMode.value) {
      toggleStrikethroughWord(index);
      return;
    }

    // Only seek if not currently editing
    if (editingWordIndex.value === -1) {
      // Prevent autoscroll completely after manual click
      preventAutoscroll.value = true;

      // Clear any existing timeout
      if (window.autoscrollTimeout) {
        clearTimeout(window.autoscrollTimeout);
      }

      // Set new timeout - longer duration for better UX
      window.autoscrollTimeout = setTimeout(() => {
        preventAutoscroll.value = false;
        window.autoscrollTimeout = null;
      }, 5000); // Prevent autoscroll for 5 seconds after manual click

      // DIRECT DOM MANIPULATION for instant feedback
      const wordElement = wordElements.value.get(index);
      if (wordElement) {
        // Apply instant visual feedback directly to DOM
        wordElement.style.background = 'var(--brand)';
        wordElement.style.color = 'var(--brand-fg)';
        wordElement.style.zIndex = '10';
        wordElement.style.position = 'relative';

        // Clear the direct styling after a short delay
        setTimeout(() => {
          if (wordElement) {
            wordElement.style.background = '';
            wordElement.style.color = '';
            wordElement.style.zIndex = '';
            wordElement.style.position = '';
          }
        }, 150);
      }

      // Now perform the actual seek
      seekToTime(getWordMiddle(word));
    }
  }

  function onWordDoubleClick(word: any, index: number) {
    // Prevent autoscroll when starting to edit
    preventAutoscroll.value = true;

    // Clear any existing timeout
    if (window.autoscrollTimeout) {
      clearTimeout(window.autoscrollTimeout);
    }

    // Set new timeout for editing
    window.autoscrollTimeout = setTimeout(() => {
      preventAutoscroll.value = false;
      window.autoscrollTimeout = null;
    }, 5000); // Prevent autoscroll for 5 seconds during editing

    // Start editing this word
    startWordEdit(word, index);
  }

  function startWordEdit(word: any, index: number) {
    editingWordIndex.value = index;
    editingWordText.value = getWordText(word);

    // Focus the input field after DOM update
    nextTick(() => {
      // Use querySelector to find the input element since we're in a v-for loop
      const inputElement = document.querySelector(`input[data-word-index="${index}"]`) as HTMLInputElement;
      if (inputElement) {
        inputElement.focus();
        inputElement.select();
      }
    });
  }

  function cancelWordEdit() {
    editingWordIndex.value = -1;
    editingWordText.value = '';

    // Reset autoscroll prevention when editing is cancelled
    preventAutoscroll.value = false;
  }

  async function saveWordEdit() {
    if (editingWordIndex.value === -1 || !props.projectId) {
      return;
    }

    const index = editingWordIndex.value;
    const newText = editingWordText.value.trim();

    if (!newText) {
      cancelWordEdit();
      return;
    }

    const word = transcriptData.value?.words[index];
    if (!word) {
      cancelWordEdit();
      return;
    }

    const oldText = getWordText(word);
    if (oldText === newText) {
      cancelWordEdit();
      return;
    }

    try {
      // Import database function dynamically to avoid circular imports
      const { updateTranscriptWord } = await import('@/services/database');

      const result = await updateTranscriptWord(props.projectId, index, newText);

      if (result.success) {
        console.log(`[TranscriptPanel] Successfully updated word ${index}: "${oldText}" -> "${newText}"`);

        // Update local data immediately for responsive UI
        if (transcriptData.value?.words[index]) {
          // Update the word in different possible formats
          const word = transcriptData.value.words[index] as any;
          if (word.word !== undefined) {
            word.word = newText;
          }
          if (word.text !== undefined) {
            word.text = newText;
          }
          if (word.content !== undefined) {
            word.content = newText;
          }
        }

        editingWordIndex.value = -1;
        editingWordText.value = '';

        // Reset autoscroll prevention when editing is completed successfully
        preventAutoscroll.value = false;
      } else {
        console.error('[TranscriptPanel] Failed to update word:', result.error);
        // Show error feedback to user
        useToast().error('Could not update word', result.error);
        cancelWordEdit();
      }
    } catch (error) {
      console.error('[TranscriptPanel] Error updating word:', error);
      useToast().error('Could not update word', 'Something went wrong. Please try again.');
      cancelWordEdit();
    }
  }

  function onWordKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        saveWordEdit();
        break;
      case 'Escape':
        event.preventDefault();
        cancelWordEdit();
        break;
      case 'Tab':
        event.preventDefault();
        // Save and move to next word
        saveWordEdit();
        // Move to next word after save
        if (editingWordIndex.value < (transcriptData.value?.words.length || 0) - 1) {
          setTimeout(() => {
            startWordEdit(transcriptData.value?.words[editingWordIndex.value + 1], editingWordIndex.value + 1);
          }, 100);
        }
        break;
    }
  }

  function getWordTitle(word: any, index: number): string {
    if (editingWordIndex.value === index) {
      return 'Editing... Press Enter to save, Escape to cancel, Tab to edit next word';
    }
    return `Jump to ${formatTime(getWordMiddle(word))}. Double-click to edit this word`;
  }

  // Track the previous word index to detect backward seeks
  const previousWordIndex = ref(-1);

  // Find the current word index based on currentTime
  function updateCurrentWordIndex() {
    if (!transcriptData.value || !transcriptData.value.words.length || props.currentTime === undefined) {
      currentWordIndex.value = -1;
      previousWordIndex.value = -1;
      return;
    }

    const words = transcriptData.value.words;
    const currentTime = props.currentTime;

    // Find the word that contains the current time
    let newIndex = -1;
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordStart = getWordStart(word);
      const wordEnd = getWordEnd(word);

      if (currentTime >= wordStart && currentTime <= wordEnd) {
        newIndex = i;
        break;
      }
    }

    // If no exact match found, find the closest word by start time (same approach as Timeline)
    if (newIndex === -1) {
      let closestDistance = Infinity;
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordStart = getWordStart(word);
        const distance = Math.abs(wordStart - currentTime);
        if (distance < closestDistance) {
          closestDistance = distance;
          newIndex = i;
        }
      }
    }

    if (newIndex !== currentWordIndex.value) {
      const oldIndex = currentWordIndex.value;
      currentWordIndex.value = newIndex;

      // Check if this is a significant backward seek or any seek to different area
      const isBackwardSeek = newIndex < oldIndex && oldIndex - newIndex > 5;
      const isAnySeek = Math.abs(newIndex - oldIndex) > 20; // Any seek of 20+ words
      const isSeekingToBeginning = newIndex <= 10; // First 10 words (beginning of transcript)

      // Auto-scroll to keep current word visible (force scroll on any significant seek)
      const shouldForceScroll = isBackwardSeek || isAnySeek || isSeekingToBeginning;

      scrollToCurrentWord(shouldForceScroll);

      previousWordIndex.value = newIndex;
    }
  }

  // Scroll to keep the current word visible
  function scrollToCurrentWord(forceScroll = false) {
    if (currentWordIndex.value === -1 || !transcriptContent.value) return;

    // Don't scroll at all if user recently interacted with words (ignore even force scrolls)
    if (preventAutoscroll.value) return;

    const wordElement = wordElements.value.get(currentWordIndex.value);
    if (!wordElement) return;

    // Use nextTick to ensure DOM is updated
    nextTick(() => {
      if (!transcriptContent.value || !wordElement) return;

      const container = transcriptContent.value;
      const containerScrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const containerScrollHeight = container.scrollHeight;
      const wordOffsetTop = wordElement.offsetTop;
      const wordHeight = wordElement.offsetHeight;

      // Check if scrolling is possible
      if (containerScrollHeight <= containerHeight) {
        return;
      }

      // Define safe viewing boundaries (very conservative)
      const safeTop = containerScrollTop + 40; // 40px from top
      const safeBottom = containerScrollTop + containerHeight - 40; // 40px from bottom

      // Check if word is outside safe viewing area (only for normal scrolling)
      if (!forceScroll && wordOffsetTop >= safeTop && wordOffsetTop + wordHeight <= safeBottom) {
        return; // Word is already in safe view, no scrolling needed
      }

      // Calculate minimal scroll needed
      let targetScrollTop = containerScrollTop;

      if (forceScroll) {
        // Force scroll - position word right at the very top
        // Calculate target based on word's actual position within the content
        const contentTop = Math.min(wordOffsetTop, containerScrollHeight - containerHeight);
        targetScrollTop = Math.max(0, contentTop - 10);
      } else if (wordOffsetTop < safeTop) {
        // Word is too high, scroll up just enough to bring it into view
        targetScrollTop = Math.max(0, wordOffsetTop - 60); // 60px from top
      } else if (wordOffsetTop + wordHeight > safeBottom) {
        // Word is too low, scroll down just enough to bring it into view
        targetScrollTop = wordOffsetTop + wordHeight - containerHeight + 60; // 60px from top
      }

      // Don't clamp for force scroll - allow it to position correctly
      if (!forceScroll) {
        const maxScrollTop = containerScrollHeight - containerHeight;
        targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
      }
      // For force scroll, skip clamping entirely to allow proper positioning

      // Only scroll if we actually need to move
      if (Math.abs(containerScrollTop - targetScrollTop) > 5) {
        container.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth',
        });
      }
    });
  }

  // Handle scroll indicator
  function handleScroll() {
    if (!userHasScrolled.value) {
      userHasScrolled.value = true;
      showScrollIndicator.value = false;
    }
  }

  // Load transcript data when projectId changes
  watch(
    () => props.projectId,
    async (newProjectId) => {
      if (newProjectId) {
        loadingTranscript.value = true;
        try {
          // Remove old scroll listener if it exists
          if (transcriptContent.value) {
            transcriptContent.value.removeEventListener('scroll', handleScroll);
          }

          await loadTranscriptData(newProjectId);
          // Show scroll indicator for new transcripts
          await nextTick();
          if (transcriptData.value?.words.length) {
            showScrollIndicator.value = true;
            userHasScrolled.value = false;
            // Attach scroll listener when transcript becomes available
            if (transcriptContent.value) {
              transcriptContent.value.addEventListener('scroll', handleScroll, { passive: true });
            }
            // Auto-hide after 3 seconds
            setTimeout(() => {
              showScrollIndicator.value = false;
            }, 3000);
          }
        } catch (error) {
          console.error('[TranscriptPanel] Failed to load transcript:', error);
        } finally {
          loadingTranscript.value = false;
        }
      }
    },
    { immediate: true }
  );

  // Update current word when currentTime changes
  watch(
    () => props.currentTime,
    () => {
      updateCurrentWordIndex();
    },
    { immediate: true }
  );

  // Listen for transcript updates
  onMounted(() => {
    const refreshListener = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const eventProjectId = customEvent.detail?.projectId;
      const currentProjectId = props.projectId;

      console.log('[TranscriptPanel] Received transcript-updated event', {
        eventProjectId,
        currentProjectId,
        match: String(eventProjectId) === String(currentProjectId),
      });

      // Use string comparison to handle any type coercion issues
      if (eventProjectId && currentProjectId && String(eventProjectId) === String(currentProjectId)) {
        console.log('[TranscriptPanel] Project ID matches, reloading transcript data...');
        loadingTranscript.value = true;
        try {
          await loadTranscriptData(currentProjectId);
          console.log(
            '[TranscriptPanel] Transcript data reloaded, words count:',
            transcriptData.value?.words?.length || 0
          );
        } catch (error) {
          console.error('[TranscriptPanel] Failed to reload transcript data:', error);
        } finally {
          loadingTranscript.value = false;
        }
      }
    };

    document.addEventListener('transcript-updated', refreshListener);

    // Store listener reference for cleanup
    (window as any)._transcriptRefreshListener = refreshListener;
  });

  // Cleanup refs on unmount
  onUnmounted(() => {
    if (transcriptContent.value) {
      transcriptContent.value.removeEventListener('scroll', handleScroll);
    }

    // Remove transcript update listener
    if ((window as any)._transcriptRefreshListener) {
      document.removeEventListener('transcript-updated', (window as any)._transcriptRefreshListener);
      (window as any)._transcriptRefreshListener = null;
    }

    wordElements.value.clear();

    // Clear debounce timeout
    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = null;
    }

    // Clear autoscroll timeout
    if (window.autoscrollTimeout) {
      clearTimeout(window.autoscrollTimeout);
      window.autoscrollTimeout = null;
    }
  });
</script>

<style scoped>
  /* Word hover wash (state classes come from getWordClasses). */
  .word-interactive:hover {
    background-color: var(--surface-active);
    color: var(--fg);
  }

  .word-interactive.current-word:hover {
    background-color: var(--brand-hover);
    color: var(--brand-fg);
  }

  .word-interactive.word-selected:hover,
  .word-interactive.word-match:hover {
    background-color: var(--brand-soft-hover);
  }

  /* Inline word editor */
  .word-interactive input {
    font: inherit;
    color: var(--fg);
    -webkit-text-fill-color: var(--fg);
    background: var(--surface-sunken);
    border: none;
    border-bottom: 2px solid var(--brand);
    border-radius: 4px;
    padding: 0 4px;
    margin: 0;
    min-width: 1ch;
  }

  .word-interactive:has(input) {
    background: var(--surface-raised);
  }

  .word-interactive input::selection {
    background: var(--brand-soft-hover);
  }

  /* Floating toolbar transition (horizontal centering uses the `translate` property) */
  .toolbar-fade-enter-active {
    transition: opacity 150ms ease-out, transform 150ms ease-out;
  }

  .toolbar-fade-leave-active {
    transition: opacity 100ms ease-in, transform 100ms ease-in;
  }

  .toolbar-fade-enter-from,
  .toolbar-fade-leave-to {
    opacity: 0;
    transform: translateY(4px);
  }
</style>
