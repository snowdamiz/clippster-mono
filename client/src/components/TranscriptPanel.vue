<template>
  <div class="border-b border-border flex flex-col h-full">
    <!-- Loading state -->
    <div v-if="loadingTranscript" class="flex-1 flex items-center justify-center">
      <div class="text-center text-muted-foreground px-6">
        <svg
          class="animate-spin h-6 w-6 mx-auto mb-3"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p class="text-xs">Loading transcript...</p>
      </div>
    </div>

    <!-- No transcript state -->
    <div v-else-if="!transcriptData || !transcriptData.words.length" class="flex-1 flex items-center justify-center">
      <div class="text-center text-muted-foreground px-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-8 w-8 mx-auto mb-3"
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
        <p class="text-xs mb-2">No transcript available</p>
        <p class="text-xs text-foreground/60">Audio is automatically transcribed when clips are detected</p>
      </div>
    </div>

    <!-- Transcript content -->
    <div v-else ref="transcriptContent" class="flex-1 overflow-y-auto pr-2">
      <div class="text-sm text-foreground leading-relaxed break-words py-2 min-h-full">
        <span
          v-for="(word, index) in transcriptData.words"
          :key="`word-${index}`"
          :ref="(el) => setWordRef(el, index)"
          :class="getWordClasses(word)"
          class="inline-block px-0.5 py-0.5 rounded transition-all duration-200 cursor-pointer hover:bg-muted/50 whitespace-normal"
          @click="seekToTime(getWordStart(word))"
        >
          {{ getWordText(word) }}{{ index < transcriptData.words.length - 1 ? ' ' : '' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
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

  // Use transcript data composable
  const { transcriptData, loadTranscriptData } = useTranscriptData(computed(() => props.projectId || null));

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

  // Get CSS classes for a word based on its state relative to currentTime
  function getWordClasses(word: any): string {
    if (currentWordIndex.value === -1 || props.currentTime === undefined || props.duration === 0) {
      return 'text-muted-foreground';
    }

    const currentWord = transcriptData.value?.words[currentWordIndex.value];
    if (!currentWord) return 'text-muted-foreground';

    const currentStart = getWordStart(currentWord);
    const currentEnd = getWordEnd(currentWord);
    const wordStart = getWordStart(word);
    const wordEnd = getWordEnd(word);

    // Current word (being spoken)
    if (currentStart === wordStart && currentEnd === wordEnd) {
      return 'bg-primary text-primary-foreground font-semibold scale-105 shadow-sm';
    }

    // Already spoken words
    if (wordEnd < props.currentTime) {
      return 'text-foreground/70';
    }

    // Future words
    return 'text-muted-foreground';
  }

  function seekToTime(time: number) {
    emit('seekVideo', time);
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
      // If we've passed the word, track the most recent one
      if (currentTime > wordEnd) {
        newIndex = i;
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

  // Load transcript data when projectId changes
  watch(
    () => props.projectId,
    async (newProjectId) => {
      if (newProjectId) {
        loadingTranscript.value = true;
        try {
          await loadTranscriptData(newProjectId);
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
    wordElements.value.clear();
  });
</script>

<style scoped>
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

  .rotate-180 {
    transform: rotate(180deg);
  }

  .transition-all {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 200ms;
  }
</style>
