<template>
  <PageLayout
    title="Prompts"
    description="Manage your AI prompts and templates"
    :show-header="!loading && prompts.length > 0"
    icon="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z"
  >
    <template #actions>
      <button 
        @click="navigateToNew"
        class="px-5 py-2.5 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-lg flex items-center gap-2 font-medium shadow-sm transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Prompt
      </button>
    </template>

    <!-- Loading State -->
    <LoadingState v-if="loading" message="Loading prompts..." />

    <!-- Prompts List -->
    <div v-else-if="prompts.length > 0" class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div v-for="prompt in prompts" :key="prompt.id" class="bg-card border border-border rounded-lg">
        <div class="p-5">
          <div class="flex items-start justify-between mb-3">
            <h3 class="font-semibold text-foreground flex-1 pr-2">{{ prompt.name }}</h3>
            <div class="flex items-center gap-1 flex-shrink-0">
              <button
                class="p-2 hover:bg-muted rounded-md transition-all relative group/copy"
                :title="copiedId === prompt.id ? 'Copied!' : 'Copy to clipboard'"
                @click.stop="copyPrompt(prompt)"
              >
                <svg
                  v-if="copiedId !== prompt.id"
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 text-muted-foreground group-hover/copy:text-foreground transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 text-green-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </button>
              <button
                class="p-2 hover:bg-muted rounded-md transition-all group/edit"
                title="Edit prompt"
                v-if="!isDefaultPrompt(prompt)"
                @click.stop="editPrompt(prompt)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground group-hover/edit:text-foreground transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <!-- Show delete button for non-default prompts -->
              <button
                v-if="!isDefaultPrompt(prompt)"
                class="p-2 hover:bg-muted rounded-md transition-all group/delete"
                title="Delete prompt"
                @click.stop="confirmDelete(prompt)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground group-hover/delete:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <!-- Show default badge for default prompt -->
              <span
                v-else
                class="px-2 py-1 ml-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-md border border-purple-200 dark:border-purple-700"
              >
                default prompt
              </span>
            </div>
          </div>
          <p class="text-sm text-muted-foreground line-clamp-3 leading-relaxed mb-4">
            {{ prompt.content }}
          </p>
        </div>
        <div class="flex items-center gap-5 text-xs text-muted-foreground py-4 px-4 border-t border-border bg-[#141414] rounded-b-lg">
          <span class="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Updated {{ getRelativeTime(prompt.updated_at) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else
      title="No prompts yet"
      description="Create your first prompt template to get started"
      button-text="Create Prompt"
      @action="navigateToNew"
    >
      <template #icon>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" />
        </svg>
      </template>
    </EmptyState>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="showDeleteDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showDeleteDialog = false"
    >
      <div class="bg-card rounded-2xl p-8 max-w-md w-full mx-4 border border-border">
        <h2 class="text-2xl font-bold mb-4">Delete Prompt</h2>
        
        <div class="space-y-4">
          <p class="text-muted-foreground">
            Are you sure you want to delete "<span class="font-semibold text-foreground">{{ promptToDelete?.name }}</span>"? This action cannot be undone.
          </p>

          <button
            class="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all"
            @click="deletePromptConfirmed"
          >
            Delete
          </button>

          <button
            class="w-full py-3 bg-muted text-foreground rounded-lg font-semibold hover:bg-muted/80 transition-all"
            @click="showDeleteDialog = false"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAllPrompts, deletePrompt, type Prompt } from '@/services/database'
import { useFormatters } from '@/composables/useFormatters'
import { useToast } from '@/composables/useToast'
import PageLayout from '@/components/PageLayout.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
const { success, error } = useToast()
const prompts = ref<Prompt[]>([])
const loading = ref(true)
const { getRelativeTime } = useFormatters()
const copiedId = ref<string | null>(null)
const showDeleteDialog = ref(false)
const promptToDelete = ref<Prompt | null>(null)

function navigateToNew() {
  router.push('/dashboard/prompts/new')
}

function isDefaultPrompt(prompt: Prompt): boolean {
  return prompt.name === 'Default Clip Detector'
}

async function loadPrompts() {
  loading.value = true
  try {
    prompts.value = await getAllPrompts()
  } catch (err) {
    console.error('Failed to load prompts:', err)
    error('Failed to load prompts', 'An error occurred while loading prompts. Please try again.')
  } finally {
    loading.value = false
  }
}

async function copyPrompt(prompt: Prompt) {
  try {
    await navigator.clipboard.writeText(prompt.content)
    copiedId.value = prompt.id
    success('Prompt copied', `"${prompt.name}" has been copied to clipboard`)
    // Clear the copied state after 2 seconds
    setTimeout(() => {
      copiedId.value = null
    }, 2000)
  } catch (error) {
    console.error('Failed to copy prompt:', error)
  }
}

function editPrompt(prompt: Prompt) {
  router.push(`/dashboard/prompts/${prompt.id}/edit`)
}

function confirmDelete(prompt: Prompt) {
  promptToDelete.value = prompt
  showDeleteDialog.value = true
}

async function deletePromptConfirmed() {
  if (!promptToDelete.value) return
  
  const deletedPromptName = promptToDelete.value.name
  
  try {
    await deletePrompt(promptToDelete.value.id)
    success('Prompt deleted', `"${deletedPromptName}" has been deleted successfully`)
    await loadPrompts()
  } catch (err) {
    console.error('Failed to delete prompt:', err)
    error('Failed to delete prompt', 'An error occurred while deleting the prompt. Please try again.')
  } finally {
    showDeleteDialog.value = false
    promptToDelete.value = null
  }
}

onMounted(() => {
  loadPrompts()
})
</script>
