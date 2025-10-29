import { defineStore } from 'pinia'
import { getPumpFunClips, extractMintId, type PumpFunClip } from '@/services/pumpfun'

interface PumpFunState {
  clips: PumpFunClip[]
  currentMintId: string
  loading: boolean
  error: string
  hasMore: boolean
  total: number
  lastSearchTime: number | null
}

export const usePumpFunStore = defineStore('pumpfun', {
  state: (): PumpFunState => ({
    clips: [],
    currentMintId: '',
    loading: false,
    error: '',
    hasMore: false,
    total: 0,
    lastSearchTime: null
  }),

  getters: {
    hasClips: (state) => state.clips.length > 0,
    getCurrentMintId: (state) => state.currentMintId,
    getClipsCount: (state) => state.clips.length,
    getLastSearchTime: (state) => state.lastSearchTime
  },

  actions: {
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