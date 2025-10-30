<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="close"
    >
      <div class="bg-card rounded-t-2xl rounded-b-2xl w-full h-full border border-border shadow-2xl"
           style="margin: 30px; max-height: calc(100vh - 60px); max-width: calc(100vw - 60px);">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-[#0a0a0a]/50 backdrop-blur-sm rounded-t-xl">
          <div class="flex-1 min-w-0">
            <h2 class="text-sm font-medium text-foreground/90 truncate">{{ project?.name || 'New Project' }}</h2>
          </div>
          <button
            @click="close"
            class="p-1.5 hover:bg-[#ffffff]/10 rounded-md transition-colors"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-foreground/70 hover:text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Main Content Area -->
        <div class="flex flex-col h-full" style="height: calc(100% - 52px);">
          <!-- Top Row: Video Player, Transcript, and Clips -->
          <div class="flex flex-1 min-h-0 border-b border-border">
            <!-- Video Player Section -->
            <div class="w-1/2 min-w-0 p-4 border-r border-border">
              <div class="h-full rounded-lg flex items-center justify-center">
                <div class="text-center text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p class="text-sm">Video Player</p>
                </div>
              </div>
            </div>

            <!-- Right Side: Transcript and Clips -->
            <div class="w-1/2 min-w-0 flex flex-col">
              <!-- Transcript Section -->
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
                <div v-if="!transcriptCollapsed" class="overflow-hidden">
                  <div ref="transcriptContent" class="text-muted-foreground text-sm space-y-2">
                    <div class="p-2 hover:bg-black/10 rounded cursor-pointer">
                      <span class="text-xs text-muted-foreground/60">00:00</span>
                      <p class="text-xs mt-1">Welcome to the project workspace...</p>
                    </div>
                    <div class="p-2 hover:bg-black/10 rounded cursor-pointer">
                      <span class="text-xs text-muted-foreground/60">00:05</span>
                      <p class="text-xs mt-1">This is where your transcript will appear...</p>
                    </div>
                    <div class="p-2 hover:bg-black/10 rounded cursor-pointer">
                      <span class="text-xs text-muted-foreground/60">00:10</span>
                      <p class="text-xs mt-1">Click on any text to jump to that timestamp...</p>
                    </div>
                  </div>
                  </div>
              </div>

              <!-- Generated Clips Section -->
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
                          <button class="px-4 py-2 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-lg flex items-center gap-2 font-medium shadow-sm transition-all mx-auto text-xs">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Generate Clips
                          </button>
                        </div>
                      </div>
                    </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Row: Timeline -->
          <div class="h-36 bg-[#0a0a0a]/30 border-t border-border">
            <div class="p-4 h-full">
              <!-- Timeline Header -->
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-medium text-foreground">Timeline</h3>
                <button class="px-3 py-1 bg-muted hover:bg-muted/80 rounded text-xs text-foreground transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Play
                </button>
              </div>

              <!-- Timeline Tracks -->
              <div class="bg-muted/20 rounded-lg h-20 relative overflow-hidden">
                <!-- Video Track -->
                <div class="h-full">
                  <div class="flex items-center h-full px-2">
                    <!-- Track Label -->
                    <div class="w-16 h-12 pr-2 flex items-center justify-center text-xs text-center text-muted-foreground/60 border-r border-border/70">Video</div>
                    <!-- Track Content -->
                    <div class="flex-1 h-full flex items-center justify-center">
                      <div class="text-center text-muted-foreground/40">
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Remove all the old problematic CSS - we'll handle animations via JavaScript hooks */
</style>

<script setup lang="ts">
import { ref } from 'vue'
import { type Project } from '@/services/database'

const props = defineProps<{
  modelValue: boolean
  project?: Project | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// Initialize reactive state
const transcriptCollapsed = ref(false)
const clipsCollapsed = ref(false)

// Template refs for content measurement
const transcriptContent = ref<HTMLElement>()
const clipsContent = ref<HTMLElement>()

function close() {
  emit('update:modelValue', false)
}

function toggleTranscript() {
  transcriptCollapsed.value = !transcriptCollapsed.value

  // If we're collapsing transcript, auto-expand clips
  if (transcriptCollapsed.value) {
    clipsCollapsed.value = false
  }
}

function toggleClips() {
  clipsCollapsed.value = !clipsCollapsed.value

  // If we're collapsing clips, auto-expand transcript
  if (clipsCollapsed.value) {
    transcriptCollapsed.value = false
  }
}

</script>