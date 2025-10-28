<template>
  <PageLayout
    title="PumpFun"
    description="Direct VOD processing for PumpFun streams"
    :show-header="clips.length > 0"
  >
    <template #actions v-if="clips.length > 0">
      <div class="flex items-center gap-3">
        <input
          v-model="mintId"
          type="text"
          placeholder="Mint ID"
          class="px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
          @keyup.enter="handleSearch"
          :disabled="loading"
        />
        <button
          @click="handleSearch"
          :disabled="loading || !mintId.trim()"
          class="w-12 h-12 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-lg flex items-center justify-center font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          :title="loading ? 'Searching...' : 'Search'"
        >
          <svg v-if="!loading" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <svg v-else class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </button>
      </div>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="space-y-6">
      <!-- Search Bar -->
      <div class="flex items-center justify-center gap-3">
        <input
          v-model="mintId"
          type="text"
          placeholder="Mint ID"
          class="px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
          disabled
        />
        <button
          disabled
          class="w-12 h-12 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 text-white rounded-lg flex items-center justify-center font-medium shadow-sm transition-all opacity-50 cursor-not-allowed"
          title="Searching..."
        >
          <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </button>
      </div>
      <LoadingState message="Fetching VODs..." />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-red-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 class="text-lg font-semibold text-red-400 mb-2">Error</h3>
      <p class="text-muted-foreground">{{ error }}</p>
      <button
        @click="handleSearch"
        class="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
      >
        Try Again
      </button>
    </div>

    <!-- VODs Grid -->
    <div v-else-if="clips.length > 0" class="space-y-6">
      <div class="flex items-center justify-between">
        <p class="text-sm text-muted-foreground">
          Found {{ total }} VOD{{ total !== 1 ? 's' : '' }}
        </p>
        <span v-if="hasMore" class="text-sm text-purple-400">
          More available
        </span>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <VodCard 
          v-for="clip in clips" 
          :key="clip.clipId" 
          :clip="clip"
          @click="handleClipClick(clip)"
        />
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else
      title="No VODs yet"
      description="Enter a mint ID to search for PumpFun VODs"
    >
      <template #icon>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </template>
      <template #action>
        <div class="flex items-center gap-3">
          <input
            v-model="mintId"
            type="text"
            placeholder="Mint ID"
            class="px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
            @keyup.enter="handleSearch"
          />
          <button
            @click="handleSearch"
            :disabled="!mintId.trim()"
            class="w-12 h-12 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-lg flex items-center justify-center font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </template>
    </EmptyState>
  </PageLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import PageLayout from '@/components/PageLayout.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import VodCard from '@/components/VodCard.vue'
import { getPumpFunClips, type PumpFunClip } from '@/services/pumpfun'
import { useToast } from '@/composables/useToast'

const { success, error: showError } = useToast()

const mintId = ref('')
const loading = ref(false)
const error = ref('')
const clips = ref<PumpFunClip[]>([])
const hasMore = ref(false)
const total = ref(0)

async function handleSearch() {
  const trimmedMintId = mintId.value.trim()
  
  if (!trimmedMintId) {
    showError('Invalid Input', 'Please enter a mint ID')
    return
  }
  
  loading.value = true
  error.value = ''
  clips.value = []
  
  try {
    const result = await getPumpFunClips(trimmedMintId, 20)
    
    if (result.success) {
      clips.value = result.clips
      hasMore.value = result.hasMore
      total.value = result.total
      
      if (result.total === 0) {
        showError('No VODs Found', 'This mint ID has no available VODs')
      } else {
        success('VODs Loaded', `Found ${result.total} VOD${result.total !== 1 ? 's' : ''}`)
      }
    } else {
      error.value = result.error || 'Failed to fetch VODs'
      showError('Search Failed', error.value)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'An unexpected error occurred'
    showError('Error', error.value)
  } finally {
    loading.value = false
  }
}

function handleClipClick(clip: PumpFunClip) {
  console.log('Clicked clip:', clip)
  // TODO: Implement clip playback or details view
}
</script>
