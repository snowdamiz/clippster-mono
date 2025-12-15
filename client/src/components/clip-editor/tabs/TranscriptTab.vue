<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Search Bar -->
    <div class="pb-3 border-b border-border/30">
      <div class="relative">
        <div class="absolute left-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <Search class="h-3.5 w-3.5 text-muted-foreground/50" />
        </div>
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          placeholder="Search transcript..."
          class="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/30 border border-border/40 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200 placeholder:text-muted-foreground/50"
        />
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

    <!-- Transcript content -->
    <template v-else>
      <!-- Clip time range indicator -->
      <div class="py-2 px-1 text-xs text-muted-foreground/60 flex items-center gap-2">
        <Clock class="h-3 w-3" />
        <span>Clip: {{ formatTime(clipStartTime) }} - {{ formatTime(clipEndTime) }}</span>
        <span class="text-muted-foreground/40">•</span>
        <span>{{ clipWords.length }} words</span>
      </div>

      <!-- Transcript words -->
      <div ref="transcriptContent" class="flex-1 overflow-y-auto custom-scrollbar relative mt-1">
        <div class="text-sm text-foreground leading-relaxed break-words pb-4 min-h-full select-text transcript-content">
          <span
            v-for="(word, index) in clipWords"
            :key="`word-${index}`"
            :ref="(el) => setWordRef(el, index)"
            :class="getWordClasses(word, index)"
            class="inline-block px-1 py-0.5 mx-0.5 rounded-md cursor-pointer whitespace-normal word-interactive"
            @click="onWordClick(word, index)"
            @dblclick="onWordDoubleClick(word, index)"
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
            <span v-else>{{ getWordText(word) }}{{ index < clipWords.length - 1 ? ' ' : '' }}</span>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, nextTick, onUnmounted, onMounted } from 'vue';
  import { useTranscriptData } from '@/composables/useTranscriptData';
  import { Loader2, FileText, Search, Clock } from 'lucide-vue-next';

  interface SourceTimeRange {
    start: number;
    end: number;
  }

  interface Props {
    projectId?: string | null;
    currentTime?: number; // Effective time (accounting for segment cuts)
    clipStartTime?: number;
    clipEndTime?: number;
    duration?: number;
    // Editor mode: specific time ranges from video sources for filtering
    sourceTimeRanges?: SourceTimeRange[];
  }

  const props = withDefaults(defineProps<Props>(), {
    currentTime: 0,
    clipStartTime: 0,
    clipEndTime: 0,
    duration: 0,
    sourceTimeRanges: () => [],
  });

  const emit = defineEmits<{
    (e: 'seekVideo', time: number): void; // Emits absolute time for video seeking
  }>();

  const transcriptContent = ref<HTMLElement>();
  const loadingTranscript = ref(false);
  const currentWordIndex = ref(-1);
  const wordElements = ref<Map<number, HTMLElement>>(new Map());

  // Word editing state
  const editingWordIndex = ref(-1);
  const editingWordText = ref('');

  // Search state
  const searchQuery = ref('');
  const debouncedSearchQuery = ref('');
  const searchInputRef = ref<HTMLInputElement>();
  let searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

  // Flag to prevent autoscroll when user manually clicks words
  const preventAutoscroll = ref(false);

  // Use transcript data composable
  const { transcriptData, loadTranscriptData } = useTranscriptData(computed(() => props.projectId || null));

  // Check if a word overlaps with any of the source time ranges
  function isWordInSourceRanges(wordStart: number, wordEnd: number): boolean {
    if (!props.sourceTimeRanges || props.sourceTimeRanges.length === 0) {
      return true; // No ranges specified, include all
    }
    return props.sourceTimeRanges.some((range) => wordEnd >= range.start && wordStart <= range.end);
  }

  // Filter words to only show those within clip time range
  const clipWords = computed(() => {
    if (!transcriptData.value?.words?.length) return [];

    return transcriptData.value.words.filter((word: any) => {
      const wordStart = getWordStart(word);
      const wordEnd = getWordEnd(word);

      // If we have source time ranges (editor mode), use those for filtering
      if (props.sourceTimeRanges && props.sourceTimeRanges.length > 0) {
        return isWordInSourceRanges(wordStart, wordEnd);
      }

      // Otherwise use the clip range (clip mode)
      return wordEnd >= props.clipStartTime && wordStart <= props.clipEndTime;
    });
  });

  // Watch search query and debounce it
  watch(searchQuery, (newValue) => {
    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout);
    }
    searchDebounceTimeout = setTimeout(() => {
      debouncedSearchQuery.value = newValue;
    }, 300);
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
    if (!debouncedSearchQuery.value.trim() || !clipWords.value.length) return [];

    const query = debouncedSearchQuery.value.toLowerCase().trim();
    const queryWords = query.split(/\s+/).filter((word) => word.length > 0);

    if (queryWords.length === 0) return [];

    const words = clipWords.value;
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

  function isWordMatched(_word: any, index: number): boolean {
    if (!debouncedSearchQuery.value.trim()) return false;
    return matchedPhraseIndices.value.includes(index);
  }

  // Check if we're in editor mode (source ranges provided means editor mode)
  const isEditorMode = computed(() => props.sourceTimeRanges && props.sourceTimeRanges.length > 0);

  // Get CSS classes for a word based on its state relative to currentTime
  function getWordClasses(word: any, index: number): string {
    // In editor mode, currentTime is already the source video time
    // In clip mode, convert effective time back to absolute time
    const absoluteCurrentTime = isEditorMode.value ? props.currentTime : props.clipStartTime + props.currentTime;

    // Determine the basic state (current, spoken, future) first
    let stateClasses = '';

    const wordStart = getWordStart(word);
    const wordEnd = getWordEnd(word);

    // Current word (being spoken)
    if (absoluteCurrentTime >= wordStart && absoluteCurrentTime <= wordEnd) {
      // Check for search match overlay
      if (isWordMatched(word, index)) {
        return 'bg-primary text-primary-foreground current-word border border-yellow-500/50';
      }
      return 'bg-primary text-primary-foreground current-word';
    }

    // Already spoken words
    if (wordEnd < absoluteCurrentTime) {
      stateClasses = 'text-foreground font-medium ';
    } else {
      // Future words
      stateClasses = 'text-muted-foreground/70 ';
    }

    // Check for search match and overlay on top of state
    if (isWordMatched(word, index)) {
      return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
    } else {
      return stateClasses.trim();
    }
  }

  function seekToTime(time: number) {
    // Emit the absolute time for the video element
    emit('seekVideo', time);
  }

  // Word editing functions
  function onWordClick(word: any, _index: number) {
    // Only seek if not currently editing
    if (editingWordIndex.value === -1) {
      // Prevent autoscroll after manual click
      preventAutoscroll.value = true;

      // Clear any existing timeout
      if ((window as any).transcriptAutoscrollTimeout) {
        clearTimeout((window as any).transcriptAutoscrollTimeout);
      }

      // Set new timeout
      (window as any).transcriptAutoscrollTimeout = setTimeout(() => {
        preventAutoscroll.value = false;
        (window as any).transcriptAutoscrollTimeout = null;
      }, 5000);

      // Seek to the word's time (absolute time)
      seekToTime(getWordMiddle(word));
    }
  }

  function onWordDoubleClick(word: any, index: number) {
    // Prevent autoscroll when starting to edit
    preventAutoscroll.value = true;

    if ((window as any).transcriptAutoscrollTimeout) {
      clearTimeout((window as any).transcriptAutoscrollTimeout);
    }

    (window as any).transcriptAutoscrollTimeout = setTimeout(() => {
      preventAutoscroll.value = false;
      (window as any).transcriptAutoscrollTimeout = null;
    }, 5000);

    // Start editing this word
    startWordEdit(word, index);
  }

  function startWordEdit(word: any, index: number) {
    editingWordIndex.value = index;
    editingWordText.value = getWordText(word);

    // Focus the input field after DOM update
    nextTick(() => {
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

    const word = clipWords.value[index];
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
      // Import database function dynamically
      const { updateTranscriptWord } = await import('@/services/database');

      // Find the original index in the full transcript
      const originalWord = transcriptData.value?.words.find(
        (w: any) => getWordStart(w) === getWordStart(word) && getWordEnd(w) === getWordEnd(word)
      );
      const originalIndex = originalWord ? transcriptData.value?.words.indexOf(originalWord) : -1;

      if (originalIndex === -1) {
        console.error('[TranscriptTab] Could not find original word index');
        cancelWordEdit();
        return;
      }

      const result = await updateTranscriptWord(props.projectId, originalIndex, newText);

      if (result.success) {
        console.log(`[TranscriptTab] Successfully updated word ${originalIndex}: "${oldText}" -> "${newText}"`);

        // Update local data immediately for responsive UI
        if (transcriptData.value?.words[originalIndex]) {
          const wordToUpdate = transcriptData.value.words[originalIndex] as any;
          if (wordToUpdate.word !== undefined) {
            wordToUpdate.word = newText;
          }
          if (wordToUpdate.text !== undefined) {
            wordToUpdate.text = newText;
          }
          if (wordToUpdate.content !== undefined) {
            wordToUpdate.content = newText;
          }
        }

        editingWordIndex.value = -1;
        editingWordText.value = '';
        preventAutoscroll.value = false;
      } else {
        console.error('[TranscriptTab] Failed to update word:', result.error);
        alert(`Failed to update word: ${result.error}`);
        cancelWordEdit();
      }
    } catch (error) {
      console.error('[TranscriptTab] Error updating word:', error);
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
        saveWordEdit();
        // Move to next word after save
        if (editingWordIndex.value < clipWords.value.length - 1) {
          setTimeout(() => {
            startWordEdit(clipWords.value[editingWordIndex.value + 1], editingWordIndex.value + 1);
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

  // Update current word index based on effective time
  function updateCurrentWordIndex() {
    if (!clipWords.value.length || props.currentTime === undefined) {
      currentWordIndex.value = -1;
      return;
    }

    // In editor mode, currentTime is already the source video time
    // In clip mode, convert effective time to absolute time
    const absoluteCurrentTime = isEditorMode.value ? props.currentTime : props.clipStartTime + props.currentTime;

    // Find the word that contains the current time
    let newIndex = -1;
    for (let i = 0; i < clipWords.value.length; i++) {
      const word = clipWords.value[i];
      const wordStart = getWordStart(word);
      const wordEnd = getWordEnd(word);

      if (absoluteCurrentTime >= wordStart && absoluteCurrentTime <= wordEnd) {
        newIndex = i;
        break;
      }
    }

    // If no exact match, find the closest word by start time
    if (newIndex === -1) {
      let closestDistance = Infinity;
      for (let i = 0; i < clipWords.value.length; i++) {
        const word = clipWords.value[i];
        const wordStart = getWordStart(word);
        const distance = Math.abs(wordStart - absoluteCurrentTime);
        if (distance < closestDistance) {
          closestDistance = distance;
          newIndex = i;
        }
      }
    }

    if (newIndex !== currentWordIndex.value) {
      const oldIndex = currentWordIndex.value;
      currentWordIndex.value = newIndex;

      // Auto-scroll logic
      const isSignificantJump = Math.abs(newIndex - oldIndex) > 5;
      scrollToCurrentWord(isSignificantJump);
    }
  }

  // Scroll to keep the current word visible
  function scrollToCurrentWord(forceScroll = false) {
    if (currentWordIndex.value === -1 || !transcriptContent.value) return;
    if (preventAutoscroll.value) return;

    const wordElement = wordElements.value.get(currentWordIndex.value);
    if (!wordElement) return;

    nextTick(() => {
      if (!transcriptContent.value || !wordElement) return;

      const container = transcriptContent.value;
      const containerScrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const containerScrollHeight = container.scrollHeight;
      const wordOffsetTop = wordElement.offsetTop;
      const wordHeight = wordElement.offsetHeight;

      if (containerScrollHeight <= containerHeight) {
        return;
      }

      const safeTop = containerScrollTop + 40;
      const safeBottom = containerScrollTop + containerHeight - 40;

      if (!forceScroll && wordOffsetTop >= safeTop && wordOffsetTop + wordHeight <= safeBottom) {
        return;
      }

      let targetScrollTop = containerScrollTop;

      if (forceScroll) {
        const contentTop = Math.min(wordOffsetTop, containerScrollHeight - containerHeight);
        targetScrollTop = Math.max(0, contentTop - 10);
      } else if (wordOffsetTop < safeTop) {
        targetScrollTop = Math.max(0, wordOffsetTop - 60);
      } else if (wordOffsetTop + wordHeight > safeBottom) {
        targetScrollTop = wordOffsetTop + wordHeight - containerHeight + 60;
      }

      if (!forceScroll) {
        const maxScrollTop = containerScrollHeight - containerHeight;
        targetScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
      }

      if (Math.abs(containerScrollTop - targetScrollTop) > 5) {
        container.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth',
        });
      }
    });
  }

  // Load transcript data when projectId changes
  watch(
    () => props.projectId,
    async (newProjectId) => {
      if (newProjectId) {
        loadingTranscript.value = true;
        try {
          await loadTranscriptData(newProjectId);
        } catch (error) {
          console.error('[TranscriptTab] Failed to load transcript:', error);
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

  // Cleanup on unmount
  onUnmounted(() => {
    wordElements.value.clear();

    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout);
      searchDebounceTimeout = null;
    }

    if ((window as any).transcriptAutoscrollTimeout) {
      clearTimeout((window as any).transcriptAutoscrollTimeout);
      (window as any).transcriptAutoscrollTimeout = null;
    }
  });
</script>

<style scoped>
  /* Custom scrollbar */
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

  /* User select for copy functionality */
  .select-text {
    user-select: text;
    -webkit-user-select: text;
    -moz-user-select: text;
  }

  /* Word editing input styles */
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
    -webkit-text-fill-color: #ffffff !important;
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
</style>
