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
    <div :class="[clipsCollapsed ? 'h-0' : 'flex-1', showPromptDropdown ? 'overflow-visible' : 'overflow-hidden']">
      <div v-if="!clipsCollapsed" class="h-full flex flex-col">
        <div ref="clipsContent" class="flex-1 flex items-center justify-center min-h-[120px]">
          <div class="text-center text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p class="text-xs mb-3">No clips generated yet</p>
            <div class="mb-4 flex flex-col items-center">
              <label class="block text-xs font-medium text-foreground/70 mb-2 text-center">
                Detection Prompt
              </label>
              <div class="relative">
                <button
                  @click="togglePromptDropdown"
                  class="flex px-3 py-2 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent text-left items-center justify-between min-w-[150px]"
                >
                  <span class="truncate flex-1 mr-2">
                    {{ selectedPrompt ? prompts.find(p => p.id === selectedPromptId.value)?.name || 'Select a prompt...' : 'Select a prompt...' }}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <!-- Dropdown Menu -->
                <div
                  v-if="showPromptDropdown"
                  class="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-[60] max-h-48 overflow-y-auto"
                  @click.stop
                >
                  <div class="p-1 min-w-[150px]">
                    <button
                      v-for="prompt in prompts"
                      :key="prompt.id"
                      @click="onPromptChange(prompt.id, prompt.content)"
                      class="block w-full text-left px-3 py-2 rounded-md hover:bg-muted/80 transition-colors text-xs whitespace-nowrap"
                      :title="`Use prompt: ${prompt.name}`"
                    >
                      {{ prompt.name }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button
              @click="handleDetectClips"
              :disabled="!selectedPrompt"
              class="px-4 py-2 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 disabled:from-gray-500/50 disabled:to-gray-600/50 disabled:cursor-not-allowed text-white rounded-md flex items-center gap-2 font-medium shadow-sm transition-all mx-auto text-xs"
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
import { ref, onMounted } from 'vue'
import { getAllPrompts, type Prompt } from '@/services/database'

interface Props {
  transcriptCollapsed: boolean
  clipsCollapsed: boolean
}

defineProps<Props>()

interface Emits {
  (e: 'toggleClips'): void
  (e: 'detectClips', prompt: string): void
}

const emit = defineEmits<Emits>()

const clipsContent = ref<HTMLElement>()
const prompts = ref<Prompt[]>([])
const selectedPromptId = ref<string>('')
const selectedPrompt = ref<string>('')
const showPromptDropdown = ref(false)

onMounted(async () => {
  try {
    prompts.value = await getAllPrompts()
    // Select the default prompt if available
    const defaultPrompt = prompts.value.find(p => p.name === 'Default Clip Detector')
    if (defaultPrompt) {
      selectedPromptId.value = defaultPrompt.id
      onPromptChange(defaultPrompt.id)
    } else if (prompts.value.length > 0) {
      selectedPromptId.value = prompts.value[0].id
      onPromptChange(prompts.value[0].id)
    }
  } catch (error) {
    console.error('Failed to load prompts:', error)
  }

  // Add click outside handler to close dropdown
  document.addEventListener('click', handleClickOutside)
})

function handleClickOutside(event: Event) {
  const target = event.target as HTMLElement
  if (!target.closest('.relative')) {
    showPromptDropdown.value = false
  }
}

function toggleClips() {
  emit('toggleClips')
}

function handleDetectClips() {
  emit('detectClips', selectedPrompt.value)
}

function onPromptChange(promptId: string, promptContent: string) {
  selectedPromptId.value = promptId
  selectedPrompt.value = promptContent
  showPromptDropdown.value = false
}

function togglePromptDropdown() {
  showPromptDropdown.value = !showPromptDropdown.value
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