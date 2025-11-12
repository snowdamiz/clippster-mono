<template>
  <div class="border-b border-border flex flex-col h-full bg-gradient-to-b from-background to-muted/5">
    <!-- Loading state -->
    <div v-if="loadingTranscript" class="flex-1 flex items-center justify-center">
      <div class="text-center text-muted-foreground px-6 animate-fade-in">
        <div class="relative">
          <svg
            class="animate-spin h-10 w-10 mx-auto mb-4 text-primary"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="h-4 w-4 rounded-full bg-primary/20 animate-pulse"></div>
          </div>
        </div>
        <p class="text-sm font-medium">Loading transcript...</p>
        <p class="text-xs text-muted-foreground/70 mt-1">Processing audio</p>
      </div>
    </div>

    <!-- No transcript state -->
    <div v-else-if="!transcriptData || !transcriptData.words.length" class="flex-1 flex items-center justify-center">
      <div class="text-center text-muted-foreground px-6 animate-fade-in">
        <div class="relative inline-block mb-4">
          <div class="absolute inset-0 bg-primary/10 rounded-full blur-xl"></div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-12 w-12 mx-auto relative text-primary/70"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p class="text-sm font-medium mb-2">No transcript available</p>
        <p class="text-xs text-muted-foreground/60 max-w-[200px] mx-auto leading-relaxed">
          Audio is automatically transcribed when clips are detected
        </p>
      </div>
    </div>

    <!-- Transcript with Toolbar -->
    <template v-else>
      <!-- Transcript Toolbar -->
      <div class="flex items-center justify-between px-4 mt-5 mb-3">
        <!-- Search Bar -->
        <div class="flex-1 max-w-xs">
          <div class="relative">
            <div class="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 text-muted-foreground/50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              placeholder="Search transcript..."
              class="w-full pl-10 pr-3 py-1.5 text-sm bg-muted/40 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200 placeholder:text-muted-foreground/60"
            />
          </div>
        </div>
      </div>

      <!-- Transcript content -->
      <div ref="transcriptContent" class="flex-1 overflow-y-auto transcript-scrollbar relative">
        <div
          class="text-base text-foreground leading-loose break-words px-4 pb-6 min-h-full select-text transcript-content"
        >
          <span
            v-for="(word, index) in transcriptData.words"
            :key="`word-${index}`"
            :ref="(el) => setWordRef(el, index)"
            :class="getWordClasses(word, index)"
            class="inline-block px-1 py-0.5 mx-0.5 rounded-md transition-all duration-300 ease-out cursor-pointer hover:bg-primary/10 hover:scale-105 whitespace-normal word-interactive"
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
            <span v-else>{{ getWordText(word) }}{{ index < transcriptData.words.length - 1 ? ' ' : '' }}</span>
          </span>
        </div>

        <!-- Scroll indicator -->
        <div
          v-if="showScrollIndicator"
          class="absolute bottom-8 left-1/2 transform -translate-x-1/2 pointer-events-none animate-bounce z-10"
        >
          <div class="bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-full text-xs font-medium shadow-lg">
            Scroll to explore
            <svg class="inline-block ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, nextTick, onUnmounted } from 'vue';
  import { useTranscriptData } from '../composables/useTranscriptData';

  interface WordInfo {
    text: string;
    start: number;
    end: number;
    confidence?: number;
  }

  interface Props {
    projectId?: string | null;
    currentTime?: number;
    duration?: number;
  }

  const props = withDefaults(defineProps<Props>(), {
    currentTime: 0,
    duration: 0,
  });

  interface Emits {
    (e: 'seekVideo', time: number): void;
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

  // Search state
  const searchQuery = ref('');
  const searchInputRef = ref<HTMLInputElement>();

  // Use transcript data composable
  const { transcriptData, loadTranscriptData } = useTranscriptData(computed(() => props.projectId || null));

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

  // Search functionality
  function getMatchedPhraseIndices(): number[] {
    if (!searchQuery.value.trim() || !transcriptData.value?.words.length) return [];

    const query = searchQuery.value.toLowerCase().trim();
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
  }

  function isWordMatched(word: any, index: number): boolean {
    if (!searchQuery.value.trim()) return false;

    const matchedIndices = getMatchedPhraseIndices();
    return matchedIndices.includes(index);
  }

  // Get CSS classes for a word based on its state relative to currentTime
  function getWordClasses(word: any, index: number): string {
    let baseClasses = '';

    // Check for search match first (highest priority)
    if (isWordMatched(word, index)) {
      baseClasses += 'bg-yellow-500/20 text-yellow-300 font-semibold border border-yellow-500/30 rounded-md ';
    } else if (currentWordIndex.value === -1 || props.currentTime === undefined || props.duration === 0) {
      baseClasses += 'text-muted-foreground/80 ';
    } else {
      const currentWord = transcriptData.value?.words[currentWordIndex.value];
      if (!currentWord) {
        baseClasses += 'text-muted-foreground/80 ';
      } else {
        const currentStart = getWordStart(currentWord);
        const currentEnd = getWordEnd(currentWord);
        const wordStart = getWordStart(word);
        const wordEnd = getWordEnd(word);

        // Current word (being spoken)
        if (currentStart === wordStart && currentEnd === wordEnd) {
          return (
            baseClasses +
            'bg-primary text-primary-foreground font-semibold shadow-lg ring-2 ring-primary/50 ring-offset-1 current-word'
          );
        }

        // Already spoken words
        if (wordEnd < props.currentTime) {
          baseClasses += 'text-foreground font-medium ';
        }

        // Future words
        baseClasses += 'text-muted-foreground/70 ';
      }
    }

    return baseClasses.trim();
  }

  function seekToTime(time: number) {
    emit('seekVideo', time);
  }

  // Word editing functions
  function onWordClick(word: any, index: number) {
    // Only seek if not currently editing
    if (editingWordIndex.value === -1) {
      seekToTime(getWordMiddle(word));
    }
  }

  function onWordDoubleClick(word: any, index: number) {
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
          if (transcriptData.value.words[index].word !== undefined) {
            transcriptData.value.words[index].word = newText;
          }
          if (transcriptData.value.words[index].text !== undefined) {
            transcriptData.value.words[index].text = newText;
          }
          if (transcriptData.value.words[index].content !== undefined) {
            transcriptData.value.words[index].content = newText;
          }
        }

        editingWordIndex.value = -1;
        editingWordText.value = '';
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

  // Cleanup refs on unmount
  onUnmounted(() => {
    if (transcriptContent.value) {
      transcriptContent.value.removeEventListener('scroll', handleScroll);
    }
    wordElements.value.clear();
  });
</script>

<style scoped>
  /* Custom scrollbar */
  .transcript-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--primary) / 0.3) transparent;
  }

  .transcript-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .transcript-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .transcript-scrollbar::-webkit-scrollbar-thumb {
    background-color: hsl(var(--primary) / 0.3);
    border-radius: 3px;
    transition: background-color 0.2s;
  }

  .transcript-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: hsl(var(--primary) / 0.5);
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
    animation: pulse-glow 1.5s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%,
    100% {
      box-shadow: 0 0 10px hsl(var(--primary) / 0.3);
    }
    50% {
      box-shadow: 0 0 20px hsl(var(--primary) / 0.5);
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
    background: hsl(var(--primary) / 0.1);
    border-radius: 0.375rem;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .word-interactive:hover::before {
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
    background: hsl(var(--primary) / 0.8) !important;
    color: hsl(var(--primary-foreground)) !important;
    box-shadow: 0 2px 8px hsl(var(--primary) / 0.3) !important;
  }

  .word-interactive.text-foreground.font-medium:hover {
    background: hsl(var(--muted) / 0.8) !important;
    color: hsl(var(--foreground)) !important;
  }

  .word-interactive.text-muted-foreground\:\/70:hover {
    background: hsl(var(--muted) / 0.6) !important;
    color: hsl(var(--foreground)) !important;
  }
</style>
