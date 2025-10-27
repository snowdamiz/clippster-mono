<template>
  <div>
    <!-- Page Title and Actions -->
    <div v-if="!loading && prompts.length > 0" class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold text-foreground">Prompts</h1>
          <p class="text-muted-foreground mt-2">Manage your AI prompts and templates</p>
        </div>
        <button class="px-5 py-2.5 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-lg flex items-center gap-2 font-medium shadow-sm transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          New Prompt
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-muted-foreground">Loading prompts...</div>
    </div>

    <!-- Prompts List -->
    <div v-else-if="prompts.length > 0" class="space-y-4">
      <div v-for="prompt in prompts" :key="prompt.id" class="bg-card border border-border rounded-xl p-5 hover:border-foreground/20 group">
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-start gap-4 flex-1">
            <div class="p-2.5 bg-muted rounded-lg flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-foreground mb-2 group-hover:text-foreground/80">{{ prompt.name }}</h3>
              <p class="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                {{ prompt.content }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button class="p-2 hover:bg-muted rounded-md" title="Copy" @click.stop="copyPrompt(prompt)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground hover:text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button class="p-2 hover:bg-muted rounded-md" title="Edit" @click.stop="editPrompt(prompt)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground hover:text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button class="p-2 hover:bg-muted rounded-md" title="Delete" @click.stop="confirmDelete(prompt)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground hover:text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        <div class="flex items-center gap-5 text-xs text-muted-foreground pt-4 border-t border-border">
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
    <div v-else class="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)]">
      <div class="p-5 bg-muted rounded-full mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4v-4z" />
        </svg>
      </div>
      <h3 class="text-xl font-semibold text-foreground mb-2">No prompts yet</h3>
      <p class="text-muted-foreground mb-6">Create your first prompt template to get started</p>
      <button class="px-5 py-2.5 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-lg font-medium shadow-sm transition-all">
        Create Prompt
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAllPrompts, deletePrompt, type Prompt } from '@/services/database'

const prompts = ref<Prompt[]>([])
const loading = ref(true)

async function loadPrompts() {
  loading.value = true
  try {
    prompts.value = await getAllPrompts()
  } catch (error) {
    console.error('Failed to load prompts:', error)
  } finally {
    loading.value = false
  }
}

function getRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp
  
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`
  return `${Math.floor(diff / 2592000)}mo ago`
}

async function copyPrompt(prompt: Prompt) {
  try {
    await navigator.clipboard.writeText(prompt.content)
    // TODO: Add toast notification
    console.log('Prompt copied to clipboard')
  } catch (error) {
    console.error('Failed to copy prompt:', error)
  }
}

function editPrompt(prompt: Prompt) {
  // TODO: Implement edit functionality
  console.log('Edit prompt:', prompt)
}

async function confirmDelete(prompt: Prompt) {
  // TODO: Add proper confirmation dialog
  if (confirm(`Are you sure you want to delete "${prompt.name}"?`)) {
    try {
      await deletePrompt(prompt.id)
      await loadPrompts()
    } catch (error) {
      console.error('Failed to delete prompt:', error)
    }
  }
}

onMounted(() => {
  loadPrompts()
})
</script>
