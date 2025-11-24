import { defineStore } from 'pinia';
import {
  getPumpFunClips,
  extractMintId,
  type PumpFunClip,
  searchPumpFunTokens,
  fetchTokenMetadataFromServer,
} from '@/services/pumpfun';

interface RecentSearch {
  mintId: string;
  displayText: string;
  timestamp: number;
  label?: string;
  symbol?: string;
  name?: string;
  imageUrl?: string;
}

interface PumpFunState {
  clips: PumpFunClip[];
  currentMintId: string;
  loading: boolean;
  error: string;
  hasMore: boolean;
  total: number;
  lastSearchTime: number | null;
  recentSearches: RecentSearch[];
}

const RECENT_SEARCHES_KEY = 'pumpfun_recent_searches';
const MAX_RECENT_SEARCHES = 10;

export const usePumpFunStore = defineStore('pumpfun', {
  state: (): PumpFunState => {
    // Initialize recent searches from localStorage on store creation
    let recentSearches: RecentSearch[] = [];
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored && stored.trim() !== '') {
        recentSearches = JSON.parse(stored);
      }
    } catch (error) {
      // Silently handle localStorage parsing errors
    }

    return {
      clips: [],
      currentMintId: '',
      loading: false,
      error: '',
      hasMore: false,
      total: 0,
      lastSearchTime: null,
      recentSearches,
    };
  },

  getters: {
    hasClips: (state) => state.clips.length > 0,
    getCurrentMintId: (state) => state.currentMintId,
    getClipsCount: (state) => state.clips.length,
    getLastSearchTime: (state) => state.lastSearchTime,
    getRecentSearches: (state) => state.recentSearches.slice().reverse(), // Most recent first
  },

  actions: {
    // Save recent searches to localStorage
    saveRecentSearches() {
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(this.recentSearches));
      } catch (error) {
        // Silently handle localStorage save errors
      }
    },

    // Add a search to recent searches
    addToRecentSearches(
      mintId: string,
      displayText: string,
      label?: string,
      metadata?: { symbol?: string; name?: string; imageUrl?: string }
    ) {
      const existingIndex = this.recentSearches.findIndex((search) => search.mintId === mintId);

      if (existingIndex !== -1) {
        // Update existing entry without changing order
        this.recentSearches[existingIndex].timestamp = Date.now();
        this.recentSearches[existingIndex].displayText = displayText;
        // Only update label if a new one is provided
        if (label !== undefined) {
          this.recentSearches[existingIndex].label = label;
        }
        // Update metadata if provided
        if (metadata) {
          if (metadata.symbol) this.recentSearches[existingIndex].symbol = metadata.symbol;
          if (metadata.name) this.recentSearches[existingIndex].name = metadata.name;
          if (metadata.imageUrl) this.recentSearches[existingIndex].imageUrl = metadata.imageUrl;
        }
      } else {
        // Add new entry at the beginning
        this.recentSearches.unshift({
          mintId,
          displayText,
          label,
          timestamp: Date.now(),
          ...metadata,
        });

        // Limit to max recent searches
        this.recentSearches = this.recentSearches.slice(0, MAX_RECENT_SEARCHES);
      }

      // Save to localStorage
      this.saveRecentSearches();
    },

    // Update metadata for a recent search
    updateRecentSearchMetadata(
      mintId: string,
      metadata: { symbol?: string; name?: string; imageUrl?: string }
    ) {
      const searchIndex = this.recentSearches.findIndex((search) => search.mintId === mintId);
      if (searchIndex !== -1) {
        if (metadata.symbol) this.recentSearches[searchIndex].symbol = metadata.symbol;
        if (metadata.name) this.recentSearches[searchIndex].name = metadata.name;
        if (metadata.imageUrl) this.recentSearches[searchIndex].imageUrl = metadata.imageUrl;
        this.saveRecentSearches();
      }
    },

    // Clear all recent searches
    clearRecentSearches() {
      this.recentSearches = [];
      this.saveRecentSearches();
    },

    // Remove a specific recent search
    removeFromRecentSearches(mintId: string) {
      this.recentSearches = this.recentSearches.filter((search) => search.mintId !== mintId);
      this.saveRecentSearches();
    },

    // Update label for a recent search
    updateRecentSearchLabel(mintId: string, label: string) {
      const searchIndex = this.recentSearches.findIndex((search) => search.mintId === mintId);
      if (searchIndex !== -1) {
        this.recentSearches[searchIndex].label = label.trim() || undefined;
        this.saveRecentSearches();
      }
    },

    // Refresh metadata for all recent searches
    async refreshRecentSearchesMetadata() {
      for (const search of this.recentSearches) {
        // Only fetch if missing key metadata
        if (!search.symbol || !search.imageUrl) {
          try {
            // First try DexScreener
            const results = await searchPumpFunTokens(search.mintId);
            let match = null;

            if (results && results.length > 0) {
              match = results.find((r) => r.mint === search.mintId) || results[0];
            }

            // If no match or missing data, try server (Metaplex)
            if (!match || !match.image) {
              const serverMeta = await fetchTokenMetadataFromServer(search.mintId);
              if (serverMeta) {
                match = serverMeta;
              }
            }

            if (match) {
              this.updateRecentSearchMetadata(search.mintId, {
                symbol: match.symbol,
                name: match.name,
                imageUrl: match.image,
              });
            }
          } catch (error) {
            // Silently fail
          }
        }
      }
    },

    async searchClips(mintIdInput: string, limit: number = 20) {
      const input = mintIdInput.trim();

      if (!input) {
        this.error = 'Please enter a mint ID or PumpFun URL';
        return { success: false, error: this.error };
      }

      // Extract mint ID from input (supports both direct mint IDs and PumpFun URLs)
      const extractedMintId = extractMintId(input);

      if (!extractedMintId) {
        this.error = 'Please enter a valid mint ID or PumpFun URL';
        return { success: false, error: this.error };
      }

      this.loading = true;
      this.error = '';
      this.currentMintId = extractedMintId;

      try {
        const result = await getPumpFunClips(extractedMintId, limit);

        if (result.success) {
          // Filter out clips shorter than 3 minutes (180 seconds)
          const filteredClips = result.clips.filter((clip) => clip.duration >= 180);
          this.clips = filteredClips;
          this.hasMore = result.hasMore;
          this.total = filteredClips.length;
          this.lastSearchTime = Date.now();

          // Save to recent searches on successful search, preserving existing label and order
          this.addToRecentSearches(extractedMintId, input, undefined);

          // Trigger metadata fetch for this search
          searchPumpFunTokens(extractedMintId)
            .then(async (results) => {
              let match = null;
              if (results && results.length > 0) {
                match = results.find((r) => r.mint === extractedMintId) || results[0];
              }

              // If no match or missing data, try server (Metaplex)
              if (!match || !match.image) {
                const serverMeta = await fetchTokenMetadataFromServer(extractedMintId);
                if (serverMeta) {
                  match = serverMeta;
                }
              }

              if (match) {
                this.updateRecentSearchMetadata(extractedMintId, {
                  symbol: match.symbol,
                  name: match.name,
                  imageUrl: match.image,
                });
              }
            })
            .catch(() => {
              // Ignore metadata fetch errors
            });

          return {
            success: true,
            clips: filteredClips,
            total: filteredClips.length,
            hasMore: result.hasMore,
          };
        } else {
          this.error = result.error || 'Failed to fetch VODs';
          return { success: false, error: this.error };
        }
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'An unexpected error occurred';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    clearClips() {
      this.clips = [];
      this.currentMintId = '';
      this.error = '';
      this.hasMore = false;
      this.total = 0;
      this.lastSearchTime = null;
    },

    setLoading(loading: boolean) {
      this.loading = loading;
    },

    setError(error: string) {
      this.error = error;
    },

    clearError() {
      this.error = '';
    },
  },
});
