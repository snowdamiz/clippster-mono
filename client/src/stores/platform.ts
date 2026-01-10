import { defineStore } from 'pinia';
import { type PlatformId, platformConfigs } from '@/config/platforms';
import {
  getPumpFunClips,
  extractMintId,
  searchPumpFunTokens,
  fetchTokenMetadataFromServer,
} from '@/services/pumpfun';
import { getKickClips, extractChannelSlug, checkKickLivestream } from '@/services/kick';

// Unified clip type that works across platforms
export interface PlatformClip {
  clipId: string;
  sessionId?: string;
  title: string;
  duration: number;
  thumbnailUrl?: string;
  playlistUrl?: string;
  mp4Url?: string;
  clipType: 'COMPLETE' | 'HIGHLIGHT';
  startTime?: string;
  endTime?: string;
  createdAt?: string;
  isLive?: boolean;
  views?: number;
}

export interface RecentSearch {
  id: string; // mintId for pumpfun, slug for kick, etc.
  platform: PlatformId;
  displayText: string;
  timestamp: number;
  label?: string;
  symbol?: string;
  name?: string;
  imageUrl?: string;
}

interface PlatformState {
  clips: PlatformClip[];
  currentSearchId: string; // mintId or channelSlug depending on platform
  loading: boolean;
  error: string;
  hasMore: boolean;
  total: number;
  lastSearchTime: number | null;
  recentSearches: RecentSearch[];
  activePlatform: PlatformId;
}

const MAX_RECENT_SEARCHES = 20; // Increased since we're combining all platforms
const RECENT_SEARCHES_KEY = 'vods_recent_searches';

// Load recent searches from localStorage
function loadRecentSearches(): RecentSearch[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (stored && stored.trim() !== '') {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load recent searches', error);
  }
  return [];
}

// Migrate old per-platform searches to unified format
function migrateOldSearches(): RecentSearch[] {
  const allSearches: RecentSearch[] = [];
  const platforms: PlatformId[] = ['pumpfun', 'kick', 'twitch', 'youtube'];
  const oldKeys: Record<PlatformId, string> = {
    pumpfun: 'pumpfun_recent_searches',
    kick: 'kick_recent_searches',
    twitch: 'twitch_recent_searches',
    youtube: 'youtube_recent_searches',
  };

  for (const platform of platforms) {
    try {
      const oldKey = oldKeys[platform];
      const stored = localStorage.getItem(oldKey);
      if (stored && stored.trim() !== '') {
        const oldSearches = JSON.parse(stored);
        for (const search of oldSearches) {
          allSearches.push({
            ...search,
            platform,
            // Handle old format where id might be named differently
            id: search.id || search.mintId || search.slug,
          });
        }
        // Remove old key after migration
        localStorage.removeItem(oldKey);
      }
    } catch (error) {
      console.warn(`Failed to migrate old searches for ${platform}`, error);
    }
  }

  return allSearches;
}

// Ensure all searches have a platform property (fix for existing data)
function ensurePlatformProperty(searches: RecentSearch[]): RecentSearch[] {
  return searches.map((search) => {
    if (!search.platform) {
      // Try to detect platform from ID format
      // Mint IDs are 43-44 character base58 strings
      if (search.id && /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(search.id)) {
        return { ...search, platform: 'pumpfun' as PlatformId };
      }
      // Otherwise assume Kick (usernames are typically shorter alphanumeric)
      return { ...search, platform: 'kick' as PlatformId };
    }
    return search;
  });
}

// Save recent searches to localStorage
function saveRecentSearches(searches: RecentSearch[]) {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch (error) {
    console.error('Failed to save recent searches', error);
  }
}

export const usePlatformStore = defineStore('platform', {
  state: (): PlatformState => {
    // Load existing searches or migrate old ones
    let recentSearches = loadRecentSearches();
    if (recentSearches.length === 0) {
      recentSearches = migrateOldSearches();
    }
    // Ensure all searches have platform property (fix for existing data without platform)
    recentSearches = ensurePlatformProperty(recentSearches);
    if (recentSearches.length > 0) {
      saveRecentSearches(recentSearches);
    }

    return {
      clips: [],
      currentSearchId: '',
      loading: false,
      error: '',
      hasMore: false,
      total: 0,
      lastSearchTime: null,
      recentSearches,
      activePlatform: 'pumpfun',
    };
  },

  getters: {
    hasClips: (state) => state.clips.length > 0,
    getCurrentSearchId: (state) => state.currentSearchId,
    getClipsCount: (state) => state.clips.length,
    getLastSearchTime: (state) => state.lastSearchTime,
    // Get all recent searches sorted by timestamp (most recent first)
    getRecentSearches: (state) => {
      return [...state.recentSearches].sort((a, b) => b.timestamp - a.timestamp);
    },
    // Get recent searches for a specific platform
    getRecentSearchesByPlatform: (state) => (platform: PlatformId) => {
      return state.recentSearches
        .filter((s) => s.platform === platform)
        .sort((a, b) => b.timestamp - a.timestamp);
    },
    getActivePlatform: (state) => state.activePlatform,
  },

  actions: {
    // Set the active platform
    setActivePlatform(platformId: PlatformId) {
      if (this.activePlatform !== platformId) {
        this.activePlatform = platformId;
        // Clear current clips when switching platforms
        this.clearClips();
      }
    },

    // Add a search to recent searches
    addToRecentSearches(
      id: string,
      displayText: string,
      platform: PlatformId,
      label?: string,
      metadata?: { symbol?: string; name?: string; imageUrl?: string }
    ) {
      const existingIndex = this.recentSearches.findIndex(
        (search) => search.id === id && search.platform === platform
      );

      if (existingIndex !== -1) {
        // Update existing entry
        this.recentSearches[existingIndex].timestamp = Date.now();
        this.recentSearches[existingIndex].displayText = displayText;
        if (label !== undefined) {
          this.recentSearches[existingIndex].label = label;
        }
        if (metadata) {
          if (metadata.symbol) this.recentSearches[existingIndex].symbol = metadata.symbol;
          if (metadata.name) this.recentSearches[existingIndex].name = metadata.name;
          if (metadata.imageUrl) this.recentSearches[existingIndex].imageUrl = metadata.imageUrl;
        }
      } else {
        // Add new entry
        this.recentSearches.push({
          id,
          platform,
          displayText,
          label,
          timestamp: Date.now(),
          ...metadata,
        });

        // Limit total searches
        if (this.recentSearches.length > MAX_RECENT_SEARCHES) {
          // Remove oldest
          this.recentSearches.sort((a, b) => b.timestamp - a.timestamp);
          this.recentSearches = this.recentSearches.slice(0, MAX_RECENT_SEARCHES);
        }
      }

      saveRecentSearches(this.recentSearches);
    },

    // Background metadata fetch for Kick (avatar/username)
    async fetchKickMetadata(channelSlug: string) {
      try {
        const status = await checkKickLivestream(channelSlug);
        if (status) {
          this.updateRecentSearchMetadata(channelSlug, 'kick', {
            name: status.username,
            imageUrl: status.profileImageUrl,
          });
        }
      } catch {
        // Ignore errors; non-fatal
      }
    },

    // Refresh missing metadata (avatars) for recent searches
    async refreshRecentSearchMetadata() {
      // Process sequentially to avoid burst requests
      for (const search of this.recentSearches) {
        if (search.platform === 'kick' && !search.imageUrl) {
          await this.fetchKickMetadata(search.id);
        }
      }
    },

    // Update metadata for a recent search
    updateRecentSearchMetadata(
      id: string,
      platform: PlatformId,
      metadata: { symbol?: string; name?: string; imageUrl?: string }
    ) {
      const search = this.recentSearches.find((s) => s.id === id && s.platform === platform);
      if (search) {
        if (metadata.symbol) search.symbol = metadata.symbol;
        if (metadata.name) search.name = metadata.name;
        if (metadata.imageUrl) search.imageUrl = metadata.imageUrl;
        saveRecentSearches(this.recentSearches);
      }
    },

    // Clear all recent searches
    clearRecentSearches() {
      this.recentSearches = [];
      saveRecentSearches([]);
    },

    // Remove a specific recent search
    removeFromRecentSearches(id: string, platform: PlatformId) {
      const index = this.recentSearches.findIndex((s) => s.id === id && s.platform === platform);
      if (index !== -1) {
        this.recentSearches.splice(index, 1);
        saveRecentSearches(this.recentSearches);
      }
    },

    // Update label for a recent search
    updateRecentSearchLabel(id: string, platform: PlatformId, label: string) {
      const search = this.recentSearches.find((s) => s.id === id && s.platform === platform);
      if (search) {
        search.label = label.trim() || undefined;
        saveRecentSearches(this.recentSearches);
      }
    },

    // Refresh metadata for PumpFun recent searches
    async refreshRecentSearchesMetadata() {
      const pumpfunSearches = this.recentSearches.filter((s) => s.platform === 'pumpfun');

      for (const search of pumpfunSearches) {
        if (!search.symbol || !search.imageUrl) {
          try {
            const results = await searchPumpFunTokens(search.id);
            let match = null;

            if (results && results.length > 0) {
              match = results.find((r) => r.mint === search.id) || results[0];
            }

            if (!match || !match.image) {
              const serverMeta = await fetchTokenMetadataFromServer(search.id);
              if (serverMeta) {
                match = serverMeta;
              }
            }

            if (match) {
              this.updateRecentSearchMetadata(search.id, 'pumpfun', {
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

    // Universal search function that handles different platforms
    async searchClips(input: string, limit: number = 20) {
      const trimmedInput = input.trim();
      const config = platformConfigs[this.activePlatform];

      if (!trimmedInput) {
        this.error = `Please enter a ${config.searchLabel}`;
        return { success: false, error: this.error };
      }

      this.loading = true;
      this.error = '';

      try {
        let result: {
          success: boolean;
          clips: PlatformClip[];
          hasMore: boolean;
          total: number;
          error?: string;
        };
        let extractedId: string | null = null;

        switch (this.activePlatform) {
          case 'pumpfun':
            extractedId = extractMintId(trimmedInput);
            if (!extractedId) {
              this.error = 'Please enter a valid mint ID or PumpFun URL';
              this.loading = false;
              return { success: false, error: this.error };
            }
            this.currentSearchId = extractedId;
            result = await getPumpFunClips(extractedId, limit);
            break;

          case 'kick':
            extractedId = extractChannelSlug(trimmedInput);
            if (!extractedId) {
              this.error = 'Invalid channel URL or slug';
              this.loading = false;
              return { success: false, error: this.error };
            }
            this.currentSearchId = extractedId;
            result = await getKickClips(extractedId, limit);
            break;

          default:
            this.error = 'Platform not supported yet';
            this.loading = false;
            return { success: false, error: this.error };
        }

        if (result.success) {
          // Apply platform-specific filtering
          let filteredClips = result.clips;
          if (config.filterMinDuration) {
            filteredClips = result.clips.filter(
              (clip) => clip.duration >= config.filterMinDuration!
            );
          }

          this.clips = filteredClips;
          this.hasMore = result.hasMore;
          this.total = filteredClips.length;
          this.lastSearchTime = Date.now();

          // Save to recent searches with platform
          this.addToRecentSearches(extractedId!, trimmedInput, this.activePlatform, undefined);

          // Fetch metadata for PumpFun or Kick searches
          if (this.activePlatform === 'pumpfun') {
            this.fetchPumpFunMetadata(extractedId!);
          } else if (this.activePlatform === 'kick') {
            this.fetchKickMetadata(extractedId!);
          }

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

    // Fetch PumpFun token metadata in the background
    async fetchPumpFunMetadata(mintId: string) {
      try {
        const results = await searchPumpFunTokens(mintId);
        let match = null;

        if (results && results.length > 0) {
          match = results.find((r) => r.mint === mintId) || results[0];
        }

        if (!match || !match.image) {
          const serverMeta = await fetchTokenMetadataFromServer(mintId);
          if (serverMeta) {
            match = serverMeta;
          }
        }

        if (match) {
          this.updateRecentSearchMetadata(mintId, 'pumpfun', {
            symbol: match.symbol,
            name: match.name,
            imageUrl: match.image,
          });
        }
      } catch (error) {
        // Silently fail metadata fetch
      }
    },

    clearClips() {
      this.clips = [];
      this.currentSearchId = '';
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
