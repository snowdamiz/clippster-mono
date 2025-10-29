import { defineStore } from 'pinia'
import { getPumpFunClips, extractMintId, type PumpFunClip } from '@/services/pumpfun'

interface RecentSearch {
  mintId: string
  displayText: string
  timestamp: number
}

interface PumpFunState {
  clips: PumpFunClip[]
  currentMintId: string
  loading: boolean
  error: string
  hasMore: boolean
  total: number
  lastSearchTime: number | null
  recentSearches: RecentSearch[]
}

const RECENT_SEARCHES_KEY = 'pumpfun_recent_searches'
const MAX_RECENT_SEARCHES = 10

export const usePumpFunStore = defineStore('pumpfun', {
  state: (): PumpFunState => {
    // Initialize recent searches from localStorage on store creation
    let recentSearches: RecentSearch[] = []
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
      if (stored) {
        recentSearches = JSON.parse(stored)
      }
    } catch (error) {
      console.error('[PumpFun] Failed to load recent searches on init:', error)
    }

    return {
      clips: [],
      currentMintId: '',
      loading: false,
      error: '',
      hasMore: false,
      total: 0,
      lastSearchTime: null,
      recentSearches
    }
  },

  getters: {
    hasClips: (state) => state.clips.length > 0,
    getCurrentMintId: (state) => state.currentMintId,
    getClipsCount: (state) => state.clips.length,
    getLastSearchTime: (state) => state.lastSearchTime,
    getRecentSearches: (state) => state.recentSearches.slice().reverse() // Most recent first
  },

  actions: {
    // Save recent searches to localStorage
    saveRecentSearches() {
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(this.recentSearches))
      } catch (error) {
        console.error('[PumpFun] Failed to save recent searches:', error)
      }
    },

    // Add a search to recent searches
    addToRecentSearches(mintId: string, displayText: string) {
      // Remove existing entry if it exists
      this.recentSearches = this.recentSearches.filter(search => search.mintId !== mintId)

      // Add new entry at the beginning
      this.recentSearches.unshift({
        mintId,
        displayText,
        timestamp: Date.now()
      })

      // Limit to max recent searches
      this.recentSearches = this.recentSearches.slice(0, MAX_RECENT_SEARCHES)

      // Save to localStorage
      this.saveRecentSearches()
    },

    // Clear all recent searches
    clearRecentSearches() {
      this.recentSearches = []
      this.saveRecentSearches()
    },

    // Remove a specific recent search
    removeFromRecentSearches(mintId: string) {
      this.recentSearches = this.recentSearches.filter(search => search.mintId !== mintId)
      this.saveRecentSearches()
    },

    async searchClips(mintIdInput: string, limit: number = 20) {
      const input = mintIdInput.trim()

      if (!input) {
        this.error = 'Please enter a mint ID or PumpFun URL'
        return { success: false, error: this.error }
      }

      // Extract mint ID from input (supports both direct mint IDs and PumpFun URLs)
      const extractedMintId = extractMintId(input)

      if (!extractedMintId) {
        this.error = 'Please enter a valid mint ID or PumpFun URL'
        return { success: false, error: this.error }
      }

      this.loading = true
      this.error = ''
      this.currentMintId = extractedMintId

      try {
        const result = await getPumpFunClips(extractedMintId, limit)

        if (result.success) {
          this.clips = result.clips
          this.hasMore = result.hasMore
          this.total = result.total
          this.lastSearchTime = Date.now()

          // Save to recent searches on successful search
          this.addToRecentSearches(extractedMintId, input)

          return {
            success: true,
            clips: result.clips,
            total: result.total,
            hasMore: result.hasMore
          }
        } else {
          this.error = result.error || 'Failed to fetch VODs'
          return { success: false, error: this.error }
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'An unexpected error occurred'
        return { success: false, error: this.error }
      } finally {
        this.loading = false
      }
    },

    clearClips() {
      this.clips = []
      this.currentMintId = ''
      this.error = ''
      this.hasMore = false
      this.total = 0
      this.lastSearchTime = null
    },

    setLoading(loading: boolean) {
      this.loading = loading
    },

    setError(error: string) {
      this.error = error
    },

    clearError() {
      this.error = ''
    }
  }
})