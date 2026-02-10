<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header (can be hidden when integrated into parent tabs) -->
    <div v-if="!hideHeader" class="flex items-center justify-between py-3 border-b border-border/30">
      <div class="flex items-center gap-3">
        <div
          class="w-8 h-8 bg-gradient-to-br from-green-500/15 to-emerald-500/15 rounded-lg flex items-center justify-center border border-green-500/20"
        >
          <FileText class="h-4 w-4 text-green-400" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-foreground">Transcript</h3>
          <p class="text-[10px] text-muted-foreground">
            {{ transcriptData?.words?.length ? `${transcriptData.words.length} words` : 'No transcript' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loadingTranscript" class="flex-1 flex items-center justify-center">
      <div class="text-center text-muted-foreground px-6 animate-fade-in">
        <div class="relative">
          <Loader2 class="animate-spin h-8 w-8 mx-auto mb-3 text-primary" />
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="h-3 w-3 rounded-full bg-primary/20 animate-pulse"></div>
          </div>
        </div>
        <p class="text-sm font-medium">Loading transcript...</p>
        <p class="text-[10px] text-muted-foreground/70 mt-1">Processing audio</p>
      </div>
    </div>

    <!-- No transcript state -->
    <div
      v-else-if="!transcriptData || !transcriptData.words.length"
      class="flex-1 flex items-center justify-center px-4"
    >
      <div class="text-center text-muted-foreground max-w-xs">
        <div class="mb-6 flex flex-col items-center">
          <div
            class="w-16 h-16 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg flex items-center justify-center mb-4 border border-green-500/20"
          >
            <FileText class="h-7 w-7 text-green-400/70" />
          </div>
          <h4 class="text-sm font-semibold text-foreground mb-1.5">No Transcript Yet</h4>
          <p class="text-xs text-muted-foreground leading-relaxed">
            Generate clips first to automatically transcribe audio from your video
          </p>
        </div>
      </div>
    </div>

    <!-- Transcript with Toolbar -->
    <template v-else>
      <!-- Search Bar (only shown when header is visible) -->
      <div v-if="!hideHeader" class="py-2">
        <div class="relative flex items-center gap-1">
          <div class="relative flex-1">
            <div class="absolute left-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <Search class="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
            <input
              ref="searchInputRef"
              v-model="internalSearchQuery"
              type="text"
              placeholder="Search transcript..."
              class="w-full pl-8 py-1.5 text-xs bg-muted/30 border border-border/40 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200 placeholder:text-muted-foreground/50"
              :class="{ 'pr-20': internalSearchQuery.trim(), 'pr-3': !internalSearchQuery.trim() }"
              @keydown.enter.prevent="navigateMatch(1)"
              @keydown.shift.enter.prevent="navigateMatch(-1)"
            />
            <!-- Match count + clear inside the input -->
            <div v-if="internalSearchQuery.trim()" class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span class="text-[10px] tabular-nums whitespace-nowrap" :class="matchOccurrences.length > 0 ? 'text-muted-foreground/70' : 'text-red-400/70'">
                {{ matchOccurrences.length > 0 ? `${currentMatchIndex + 1} of ${matchOccurrences.length}` : 'No results' }}
              </span>
              <button
                @click="clearSearch"
                class="p-0.5 hover:bg-white/10 rounded transition-colors text-muted-foreground/50 hover:text-muted-foreground"
                title="Clear search"
              >
                <XIcon class="h-3 w-3" />
              </button>
            </div>
          </div>
          <!-- Navigation arrows -->
          <template v-if="internalSearchQuery.trim() && matchOccurrences.length > 0">
            <button
              @click="navigateMatch(-1)"
              class="p-1 hover:bg-white/10 rounded transition-colors text-muted-foreground/60 hover:text-foreground border border-border/40"
              title="Previous match (Shift+Enter)"
            >
              <ChevronUp class="h-3.5 w-3.5" />
            </button>
            <button
              @click="navigateMatch(1)"
              class="p-1 hover:bg-white/10 rounded transition-colors text-muted-foreground/60 hover:text-foreground border border-border/40"
              title="Next match (Enter)"
            >
              <ChevronDown class="h-3.5 w-3.5" />
            </button>
          </template>
        </div>
      </div>

      <!-- Strikethrough Toolbar -->
      <div class="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/20">
        <button
          @click="strikethroughMode = !strikethroughMode"
          :class="[
            'flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-colors border',
            strikethroughMode
              ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : 'bg-muted/30 text-muted-foreground border-border/40 hover:text-foreground hover:bg-muted/50',
          ]"
          :title="strikethroughMode ? 'Exit strikethrough mode' : 'Strikethrough mode — click words to mark for removal'"
        >
          <Strikethrough class="h-3 w-3" />
          {{ strikethroughMode ? 'Marking...' : 'Mark' }}
        </button>
        <template v-if="strikethroughCount > 0">
          <span class="text-[10px] text-red-400/80 tabular-nums">{{ strikethroughCount }} marked</span>
          <button
            @click="clearStrikethrough"
            class="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground bg-muted/30 rounded transition-colors"
            title="Clear all marks"
          >
            <Undo2 class="h-2.5 w-2.5" />
          </button>
          <button
            @click="commitStrikethrough"
            class="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-red-400 hover:text-red-300 bg-red-500/15 hover:bg-red-500/25 rounded transition-colors border border-red-500/20"
            title="Delete all marked words (ripple-delete from timeline)"
          >
            <Trash2 class="h-2.5 w-2.5" />
            Delete Marked
          </button>
        </template>
      </div>

      <!-- Transcript content -->
      <div ref="transcriptContent" class="flex-1 overflow-y-auto custom-scrollbar relative mt-3">
        <!-- Floating Selection Toolbar -->
        <Transition name="toolbar-fade">
          <div
            v-if="showSelectionToolbar && selectionTimeRange"
            class="absolute z-20 -translate-x-1/2 pointer-events-auto"
            :style="{ top: `${selectionToolbarPos.top}px`, left: `${selectionToolbarPos.left}px` }"
          >
            <div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 border border-white/15 rounded-lg shadow-xl shadow-black/40 backdrop-blur-sm">
              <!-- Time range display -->
              <span class="text-[10px] font-mono text-muted-foreground/80 tabular-nums">
                {{ formatTime(selectionTimeRange.startTime) }} – {{ formatTime(selectionTimeRange.endTime) }}
              </span>
              <div class="w-px h-3.5 bg-white/10"></div>
              <!-- Create Clip button -->
              <button
                @click.stop="onCreateClipFromSelection"
                class="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded transition-colors border border-emerald-500/20"
                title="Create clip from selection"
              >
                <Scissors class="h-3 w-3" />
                Clip
              </button>
              <!-- Split button -->
              <button
                @click.stop="splitAtWordBoundary(selectionStartIndex)"
                class="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors border border-blue-500/20"
                title="Split video at selection start"
              >
                <SplitSquareHorizontal class="h-3 w-3" />
                Split
              </button>
              <!-- Delete button -->
              <button
                @click.stop="deleteSelectedWords"
                class="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors border border-red-500/20"
                title="Delete selected words (ripple-delete from timeline)"
              >
                <Trash2 class="h-3 w-3" />
                Delete
              </button>
              <!-- Close button -->
              <button
                @click.stop="clearWordSelection"
                class="p-0.5 text-muted-foreground/50 hover:text-muted-foreground rounded transition-colors hover:bg-white/10"
                title="Clear selection"
              >
                <XIcon class="h-3 w-3" />
              </button>
            </div>
          </div>
        </Transition>

        <div class="text-sm text-foreground leading-relaxed break-words pb-4 min-h-full select-none transcript-content">
          <span
            v-for="(word, index) in transcriptData.words"
            :key="`word-${index}`"
            :ref="(el) => setWordRef(el, index)"
            :class="getWordClasses(word, index)"
            class="inline-block px-1 py-0.5 mx-0.5 rounded-md cursor-pointer whitespace-normal word-interactive"
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
              class="bg-transparent border-b border-primary outline-none text-inherit min-w-[20px] px-0"
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
  import { ref, computed, watch, nextTick, onUnmounted, onMounted } from 'vue';
  import { useTranscriptData } from '../composables/useTranscriptData';
  import { Loader2, FileText, Search, ChevronUp, ChevronDown, X as XIcon, Scissors, Film, Strikethrough, Trash2, SplitSquareHorizontal, Undo2 } from 'lucide-vue-next';

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
  const searchInputRef = ref<HTMLInputElement>();
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
      return 'line-through text-red-400/60 bg-red-500/10 border border-red-500/20';
    }

    // Determine the basic state (current, spoken, future) first
    let stateClasses = '';
    if (currentWordIndex.value === -1 || props.currentTime === undefined || props.duration === 0) {
      stateClasses = 'text-muted-foreground/80 ';
    } else {
      const currentWord = transcriptData.value?.words[currentWordIndex.value];
      if (currentWord) {
        const currentStart = getWordStart(currentWord);
        const currentEnd = getWordEnd(currentWord);
        const wordStart = getWordStart(word);
        const wordEnd = getWordEnd(word);

        // Current word (being spoken) - highest priority
        if (currentStart === wordStart && currentEnd === wordEnd) {
          return 'bg-primary text-primary-foreground current-word';
        }

        // Already spoken words
        if (wordEnd < props.currentTime) {
          stateClasses = 'text-foreground font-medium ';
        } else {
          // Future words
          stateClasses = 'text-muted-foreground/70 ';
        }
      } else {
        stateClasses = 'text-muted-foreground/80 ';
      }
    }

    // Check for word range selection (clip creation) - blue highlight
    if (isWordInSelection(index)) {
      return 'bg-blue-500/30 text-blue-200 border border-blue-400/40 word-selected';
    }

    // Check for active match (currently navigated to) - orange highlight
    if (isActiveMatch(index)) {
      return 'bg-orange-500/40 text-orange-200 border border-orange-400/50 ring-1 ring-orange-400/30 active-match';
    }

    // Check for search match and overlay on top of state
    if (isWordMatched(word, index)) {
      // Search match takes precedence but we maintain font weight from state
      return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
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
        wordElement.style.background = 'hsl(var(--blue-500) / 0.9)';
        wordElement.style.color = 'white';
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
        alert(`Failed to update word: ${result.error}`);
        cancelWordEdit();
      }
    } catch (error) {
      console.error('[TranscriptPanel] Error updating word:', error);
      alert('An error occurred while updating the word');
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
  /* Custom scrollbar - consistent with other tabs */
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
    margin: 4px 0;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: hsl(var(--muted-foreground) / 0.3);
    border-radius: 3px;
    border: 1px solid transparent;
    background-clip: padding-box;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--muted-foreground) / 0.5);
    background-clip: padding-box;
  }

  /* Fade in animation */
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.5s ease-out;
  }

  /* Current word pulse animation */
  .current-word {
    animation: pulse-glow 1.2s ease-in-out infinite;
    position: relative;
  }

  .current-word::after {
    content: '';
    position: absolute;
    inset: -3px;
    background: hsl(var(--primary) / 0.1);
    border-radius: 0.375rem;
    pointer-events: none;
    animation: pulse-border 1.2s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%,
    100% {
      box-shadow: 0 0 8px hsl(var(--primary) / 0.2);
    }
    50% {
      box-shadow: 0 0 12px hsl(var(--primary) / 0.3);
    }
  }

  @keyframes pulse-border {
    0%,
    100% {
      opacity: 0;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Interactive word effects */
  .word-interactive {
    position: relative;
  }

  .word-interactive::before {
    content: '';
    position: absolute;
    inset: -2px;
    background: hsl(var(--primary) / 0.15);
    border-radius: 0.375rem;
    opacity: 0;
    pointer-events: none;
  }

  .word-interactive:hover::before {
    opacity: 1;
  }

  .word-interactive:active::before {
    background: hsl(var(--primary) / 0.25);
    opacity: 1;
  }

  /* Smooth transitions */
  .transition-colors {
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }

  .transition-transform {
    transition-property: transform;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 300ms;
  }

  .ease-in-out {
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ease-out {
    transition-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }

  .rotate-180 {
    transform: rotate(180deg);
  }

  .transition-all {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 200ms;
  }

  /* User select for copy functionality */
  .select-text {
    user-select: text;
    -webkit-user-select: text;
    -moz-user-select: text;
  }

  /* Word editing input styles - use maximum specificity */
  div.transcript-content .word-interactive input[type='text'],
  .word-interactive input[type='text'] {
    all: initial !important;
    font-family: inherit !important;
    font-size: inherit !important;
    font-weight: inherit !important;
    line-height: inherit !important;

    background: #0f172a !important;
    border: none !important;
    border-bottom: 2px solid #3b82f6 !important;
    outline: none !important;
    color: #ffffff !important;
    padding: 2px 4px !important;
    margin: 0 !important;
    min-width: 1ch !important;
    border-radius: 4px !important;
    transition: all 0.2s ease !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3) !important;

    /* Force text color with multiple approaches */
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
    text-shadow: none !important;
  }

  .word-interactive input[type='text']:focus {
    background: #020617 !important;
    border-bottom-color: #60a5fa !important;
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
    box-shadow:
      0 0 0 2px rgba(59, 130, 246, 0.3),
      0 1px 3px rgba(0, 0, 0, 0.3) !important;
  }

  /* Override any inherited color from parent elements */
  .word-interactive:has(input[type='text']) {
    color: inherit !important;
  }

  .word-interactive:has(input[type='text']) * {
    color: #ffffff !important;
  }

  .word-interactive input[type='text']::selection {
    background: hsl(var(--primary) / 0.3);
    color: hsl(var(--primary-foreground));
  }

  /* Visual feedback for words being edited */
  .word-interactive:has(input:focus) {
    background: hsl(var(--muted));
    border-radius: 0.375rem;
    padding: 2px;
  }

  /* Fix hover effect for already selected/highlighted words */
  .word-interactive.current-word:hover {
    background: hsl(var(--primary) / 0.9) !important;
    color: hsl(var(--primary-foreground)) !important;
  }

  .word-interactive.current-word:hover::before {
    opacity: 0; /* Hide the default hover effect on current word */
  }

  .word-interactive.text-foreground.font-medium:hover {
    background: hsl(var(--muted) / 0.7) !important;
    color: hsl(var(--foreground)) !important;
  }

  .word-interactive.text-muted-foreground\:\/70:hover {
    background: hsl(var(--muted) / 0.5) !important;
    color: hsl(var(--foreground)) !important;
  }

  /* Add hover effect for search matches */
  .word-interactive[class*='bg-yellow-500']:hover {
    background: hsl(var(--yellow-500) / 0.3) !important;
    color: hsl(var(--yellow-300)) !important;
  }

  /* Word selection highlight for clip creation */
  .word-selected {
    cursor: pointer;
  }

  .word-interactive.word-selected:hover {
    background: rgba(59, 130, 246, 0.4) !important;
    color: rgb(191, 219, 254) !important;
  }

  /* Floating toolbar transitions */
  .toolbar-fade-enter-active {
    transition: all 150ms ease-out;
  }

  .toolbar-fade-leave-active {
    transition: all 100ms ease-in;
  }

  .toolbar-fade-enter-from {
    opacity: 0;
    transform: translateX(-50%) translateY(4px);
  }

  .toolbar-fade-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(4px);
  }

  .toolbar-fade-enter-to,
  .toolbar-fade-leave-from {
    transform: translateX(-50%) translateY(0);
  }
</style>
