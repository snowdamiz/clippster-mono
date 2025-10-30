<template>
  <div :class="transcriptCollapsed ? 'flex-1' : clipsCollapsed ? 'h-auto' : 'flex-1'" class="p-4 flex flex-col">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-foreground">Generated Clips</h3>
      <button
        @click="toggleClips"
        class="p-1 hover:bg-muted rounded transition-colors"
        :title="clipsCollapsed ? 'Expand clips' : 'Collapse clips'"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground transition-transform duration-300 ease-in-out" :class="{ 'rotate-180': clipsCollapsed }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
    <div :class="clipsCollapsed ? 'h-0' : 'flex-1'" class="overflow-hidden">
      <div v-if="!clipsCollapsed" class="h-full flex flex-col">
        <div ref="clipsContent" class="flex-1 flex items-center justify-center min-h-[120px]">
          <div class="text-center text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p class="text-xs mb-4">No clips generated yet</p>
            <button
              @click="$emit('detectClips')"
              class="px-4 py-2 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-md flex items-center gap-2 font-medium shadow-sm transition-all mx-auto text-xs"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Detect Clips
            </button>
          </div>
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
}

defineProps<Props>()

interface Emits {
  (e: 'toggleClips'): void
  (e: 'detectClips'): void
}

const emit = defineEmits<Emits>()

const clipsContent = ref<HTMLElement>()

function toggleClips() {
  emit('toggleClips')
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