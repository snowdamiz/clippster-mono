<template>
  <div :class="clipsCollapsed ? 'flex-1' : transcriptCollapsed ? 'h-auto' : 'flex-1'" class="p-4 border-b border-border flex flex-col">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-foreground">Transcript</h3>
      <button
        @click="toggleTranscript"
        class="p-1 hover:bg-muted rounded transition-colors"
        :title="transcriptCollapsed ? 'Expand transcript' : 'Collapse transcript'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground transition-transform duration-300 ease-in-out" :class="{ 'rotate-180': transcriptCollapsed }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
    <div :class="transcriptCollapsed ? 'h-0' : 'flex-1'" class="overflow-hidden">
      <div v-if="!transcriptCollapsed" class="h-full flex flex-col">
        <!-- Empty state for transcript -->
        <div v-if="!transcriptData" class="flex-1 flex items-center justify-center min-h-[120px]">
          <div class="text-center text-muted-foreground px-6">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="text-xs mb-2">No transcript available</p>
            <p class="text-xs text-foreground/60">Audio is automatically transcribed when clips are detected</p>
          </div>
        </div>
        <!-- Transcript content will appear here when available -->
        <div v-else ref="transcriptContent" class="text-muted-foreground text-sm space-y-2">
          <!-- Actual transcript content will go here -->
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  transcriptCollapsed: boolean
  clipsCollapsed: boolean
  transcriptData: any
}

defineProps<Props>()

interface Emits {
  (e: 'toggleTranscript'): void
}

const emit = defineEmits<Emits>()

const transcriptContent = ref<HTMLElement>()

function toggleTranscript() {
  emit('toggleTranscript')
}
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