<template>
  <PageLayout
    title="PumpFun"
    description="Direct VOD processing for PumpFun streams"
    :show-header="pumpFunStore.clips.length > 0"
  >
    <template #actions v-if="pumpFunStore.clips.length > 0">
      <div class="flex items-center gap-3">
        <!-- Recent Searches Dropdown -->
        <div class="relative" v-if="pumpFunStore.getRecentSearches.length > 0">
          <button
            @click="showRecentDropdown = !showRecentDropdown"
            class="px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all flex items-center gap-2"
            title="Recent searches"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-sm">Recent</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 transition-transform" :class="{ 'rotate-180': showRecentDropdown }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="showRecentDropdown"
            class="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto"
            @click.stop
          >
            <div class="p-2">
              <div class="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">Recent Searches</div>
              <button
                v-for="search in pumpFunStore.getRecentSearches.slice(0, 10)"
                :key="search.mintId"
                @click="handleRecentSearchClick(search); showRecentDropdown = false"
                class="w-full text-left px-3 py-2 rounded-md hover:bg-muted/80 transition-colors flex items-center gap-2 group"
                :title="`Search: ${search.displayText}`"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-muted-foreground group-hover:text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-sm truncate">{{ search.displayText }}</span>
              </button>
              <button
                @click="pumpFunStore.clearRecentSearches(); showRecentDropdown = false"
                class="w-full text-left px-3 py-2 rounded-md hover:bg-red-500/10 text-red-400 text-xs transition-colors mt-1"
                title="Clear all recent searches"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>

        <input
          v-model="mintId"
          type="text"
          placeholder="Mint ID or PumpFun URL"
          class="px-4 py-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
          @keyup.enter="handleSearch"
          :disabled="pumpFunStore.loading"
        />
        <button
          @click="handleSearch"
          :disabled="pumpFunStore.loading || !mintId.trim()"
          class="w-12 h-12 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-lg flex items-center justify-center font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          :title="pumpFunStore.loading ? 'Searching...' : 'Search'"
        >
          <svg v-if="!pumpFunStore.loading" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    <div v-if="pumpFunStore.loading" class="space-y-6">
      <!-- Search Bar -->
      <div class="flex items-center justify-center gap-3">
        <input
          v-model="mintId"
          type="text"
          placeholder="Mint ID or PumpFun URL"
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

      <!-- Skeleton Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Show 6 skeleton cards during loading -->
        <div v-for="i in 6" :key="i" class="relative bg-card border border-border rounded-xl overflow-hidden animate-pulse">
          <!-- Thumbnail skeleton -->
          <div class="aspect-video bg-muted/50 relative">
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="flex flex-col items-center gap-3">
                <svg class="animate-spin h-8 w-8 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-sm text-muted-foreground">Loading...</span>
              </div>
            </div>
          </div>
          <!-- Info skeleton -->
          <div class="p-4">
            <div class="h-5 bg-muted/50 rounded mb-2 w-3/4"></div>
            <div class="h-3 bg-muted/50 rounded mb-2 w-1/2"></div>
            <div class="h-3 bg-muted/50 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="pumpFunStore.error" class="bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-red-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 class="text-lg font-semibold text-red-400 mb-2">Error</h3>
      <p class="text-muted-foreground">{{ pumpFunStore.error }}</p>
      <button
        @click="handleSearch"
        class="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
      >
        Try Again
      </button>
    </div>

    <!-- VODs Grid -->
    <div v-else-if="pumpFunStore.clips.length > 0" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <VodCard
          v-for="clip in pumpFunStore.clips"
          :key="clip.clipId"
          :clip="clip"
          @click="handleClipClick(clip)"
          @download="handleDownloadClip"
        />
      </div>
    </div>

    <!-- Empty State with Recent Searches -->
    <div v-else class="flex flex-col items-center justify-center min-h-[calc(100vh-16rem)]">
      <!-- Recent Searches (shown above the empty state) -->
      <div v-if="pumpFunStore.getRecentSearches.length > 0" class="w-full max-w-md mb-8">
        <div class="text-center mb-4">
          <h3 class="text-sm font-medium text-muted-foreground">Recent Searches</h3>
          <p class="text-xs text-muted-foreground mt-1">Select a previous search to continue</p>
        </div>

        <!-- Recent Searches Dropdown -->
        <div class="relative">
          <button
            @click="showEmptyRecentDropdown = !showEmptyRecentDropdown"
            class="w-full px-4 py-3 bg-muted border border-border rounded-lg text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all flex items-center justify-between"
            title="Select a recent search"
          >
            <div class="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-sm">Choose a recent search</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 transition-transform" :class="{ 'rotate-180': showEmptyRecentDropdown }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Dropdown Menu -->
          <div
            v-if="showEmptyRecentDropdown"
            class="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto"
            @click.stop
          >
            <div class="p-2">
              <div class="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">Recent Searches</div>
              <button
                v-for="search in pumpFunStore.getRecentSearches.slice(0, 10)"
                :key="search.mintId"
                @click="handleRecentSearchClick(search); showEmptyRecentDropdown = false"
                class="w-full text-left px-3 py-2 rounded-md hover:bg-muted/80 transition-colors flex items-center gap-2 group"
                :title="`Search: ${search.displayText}`"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-muted-foreground group-hover:text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-sm truncate">{{ search.displayText }}</span>
              </button>
              <button
                @click="pumpFunStore.clearRecentSearches(); showEmptyRecentDropdown = false"
                class="w-full text-left px-3 py-2 rounded-md hover:bg-red-500/10 text-red-400 text-xs transition-colors mt-1"
                title="Clear all recent searches"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State Component -->
      <EmptyState
        title="Search VODs on Pump"
        description="Enter a mint ID or PumpFun URL to search for VODs"
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
              placeholder="Mint ID or PumpFun URL"
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
    </div>

    <!-- Download Confirmation Modal -->
    <div
      v-if="showDownloadDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showDownloadDialog = false"
    >
      <div class="bg-card rounded-2xl p-8 max-w-md w-full mx-4 border border-border">
        <h2 class="text-2xl font-bold mb-4">Download Stream</h2>

        <div class="space-y-4">
          <p class="text-muted-foreground">
            Are you sure you want to download "<span class="font-semibold text-foreground">{{ clipToDownload?.title }}</span>"? This will download the full stream to your device.
          </p>

          <!-- Stream Details -->
          <div class="bg-muted/50 rounded-lg p-4 space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">Stream Length:</span>
              <span class="font-medium text-foreground">{{ formatDuration(clipToDownload?.duration) }}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">Estimated Download Time:</span>
              <span class="font-medium text-foreground">{{ estimatedDownloadTime }}</span>
            </div>
          </div>

          <button
            class="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            @click="downloadClipConfirmed"
            :disabled="downloadStarting"
          >
            <span v-if="downloadStarting" class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Starting Download...
            </span>
            <span v-else>Download</span>
          </button>

          <button
            class="w-full py-3 bg-muted text-foreground rounded-lg font-semibold hover:bg-muted/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            @click="showDownloadDialog = false"
            :disabled="downloadStarting"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import PageLayout from '@/components/PageLayout.vue'
import EmptyState from '@/components/EmptyState.vue'
import VodCard from '@/components/VodCard.vue'
import { type PumpFunClip } from '@/services/pumpfun'
import { useToast } from '@/composables/useToast'
import { useDownloads } from '@/composables/useDownloads'
import { usePumpFunStore } from '@/stores/pumpfun'

const { success, error: showError } = useToast()
const { startDownload } = useDownloads()
const router = useRouter()
const pumpFunStore = usePumpFunStore()

// Initialize component
onMounted(() => {
  // Add click outside listener to close dropdown
  document.addEventListener('click', handleClickOutside)
})

// Clean up event listener
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Handle click outside to close dropdowns
function handleClickOutside(event: Event) {
  const target = event.target as HTMLElement
  if (!target.closest('.relative')) {
    showRecentDropdown.value = false
    showEmptyRecentDropdown.value = false
  }
}

const mintId = ref(pumpFunStore.currentMintId)
const showDownloadDialog = ref(false)
const clipToDownload = ref<PumpFunClip | null>(null)
const downloadStarting = ref(false)
const showRecentDropdown = ref(false)
const showEmptyRecentDropdown = ref(false)

// Computed properties for dialog
const formatDuration = (duration?: number) => {
  if (!duration) return 'Unknown'
  const hours = Math.floor(duration / 3600)
  const minutes = Math.floor((duration % 3600) / 60)
  const seconds = Math.floor(duration % 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
}

const estimatedDownloadTime = computed(() => {
  if (!clipToDownload.value?.duration) return 'Unknown'

  // Estimate based on 1 GB per hour of video content
  const estimatedSizeGB = (clipToDownload.value.duration / 3600) * 1
  // Assume average download speed of 50 Mbps
  const avgDownloadSpeedMbps = 50
  // Convert GB to Mb and calculate download time in seconds
  const downloadTimeSeconds = (estimatedSizeGB * 8000) / avgDownloadSpeedMbps

  return formatDuration(downloadTimeSeconds)
})

function handleRecentSearchClick(search: { mintId: string; displayText: string }) {
  mintId.value = search.displayText
  handleSearch()
}

async function handleSearch() {
  const input = mintId.value.trim()

  if (!input) {
    showError('Invalid Input', 'Please enter a mint ID or PumpFun URL')
    return
  }

  // Update the input field to show the extracted mint ID for clarity
  if (input !== pumpFunStore.currentMintId && pumpFunStore.currentMintId) {
    mintId.value = pumpFunStore.currentMintId
  }

  try {
    const result = await pumpFunStore.searchClips(input, 20)

    if (result.success) {
      if (result.total === 0) {
        showError('No VODs Found', 'This mint ID has no available VODs')
      } else {
        success('VODs Loaded', `Found ${result.total} VOD${result.total !== 1 ? 's' : ''}`)
      }
    } else {
      showError('Search Failed', result.error || 'Failed to fetch VODs')
    }
  } catch (err) {
    showError('Error', err instanceof Error ? err.message : 'An unexpected error occurred')
  }
}

function handleClipClick(clip: PumpFunClip) {
  console.log('Clicked clip:', clip)
  // TODO: Implement clip playback or details view
}

function handleDownloadClip(clip: PumpFunClip) {
  clipToDownload.value = clip
  showDownloadDialog.value = true
}

async function downloadClipConfirmed() {
  if (!clipToDownload.value) return

  const clip = clipToDownload.value // Store reference for error handling
  downloadStarting.value = true

  try {
    console.log('[PumpFun] Starting download for clip:', clip)

    // Get the best available video URL
    const videoUrl = clip.mp4Url || clip.playlistUrl

    console.log('[PumpFun] Video URL:', videoUrl)
    console.log('[PumpFun] Mint ID:', pumpFunStore.currentMintId)

    if (!videoUrl) {
      throw new Error('No video URL available for this VOD')
    }

    // Start the download
    console.log('[PumpFun] Calling startDownload...')
    const downloadId = await startDownload(
      clip.title,
      videoUrl,
      pumpFunStore.currentMintId
    )

    console.log('[PumpFun] Download started with ID:', downloadId)

    // Show success toast
    success('Download Started', `Downloading "${clip.title}"`)

    console.log('[PumpFun] Dialog closed, navigating to Videos page')

    // Close dialog immediately
    showDownloadDialog.value = false
    clipToDownload.value = null

    // Small delay to show loading state briefly, then navigate
    setTimeout(() => {
      downloadStarting.value = false
      // Navigate to Videos page to see progress
      router.push('/dashboard/videos')
    }, 500)
  } catch (err) {
    console.error('Failed to download clip:', err)
    showError('Download Failed', `Failed to download "${clip.title}": ${err}`)
    // Reset loading state on error
    downloadStarting.value = false
    showDownloadDialog.value = false
    clipToDownload.value = null
  }
}
</script>
