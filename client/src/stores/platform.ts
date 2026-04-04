import { defineStore } from 'pinia';
import { type PlatformId, platformConfigs } from '@/config/platforms';
import {
  getPumpFunClips,
  extractMintId,
  searchPumpFunTokens,
  fetchTokenMetadataFromServer,
} from '@/services/pumpfun';
import { getKickClips, extractChannelSlug, checkKickLivestream } from '@/services/kick';
import { getTwitchVods, extractChannelName, checkTwitchLivestream, type TwitchVod } from '@/services/twitch';
import { getYouTubeVods, extractYouTubeChannel, type YouTubeVod } from '@/services/youtube';
import { getRumbleVods, extractRumbleChannel, checkRumbleLivestream, type RumbleVod } from '@/services/rumble';
import { extractTwitterBroadcastId, validateTwitterUrl, getTwitterBroadcastInfo } from '@/services/twitter';
import { cache } from '@/utils/persistentCache';

// Unified clip type that works across platforms
export interface PlatformClip {
  clipId: string;
  sessionId?: string;
  title: string;
  duration?: number; // Optional - may not be available for all platforms (e.g., Twitter live broadcasts)
  thumbnailUrl?: string;
  playlistUrl?: string;
  mp4Url?: string;
  clipType: 'COMPLETE' | 'HIGHLIGHT';
  startTime?: string;
  endTime?: string;
  createdAt?: string;
  isLive?: boolean;
  views?: number;
  uploader?: string; // Channel name or username
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
  audioRecentSearches: RecentSearch[];
  activePlatform: PlatformId;
}

const MAX_RECENT_SEARCHES = 20; // Increased since we're combining all platforms
const RECENT_SEARCHES_KEY = 'vods_recent_searches';
const AUDIO_RECENT_SEARCHES_KEY = 'audio_recent_searches';

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

// Load audio recent searches from localStorage
function loadAudioRecentSearches(): RecentSearch[] {
  try {
    const stored = localStorage.getItem(AUDIO_RECENT_SEARCHES_KEY);
    if (stored && stored.trim() !== '') {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load audio recent searches', error);
  }
  return [];
}

// Migrate old per-platform searches to unified format
function migrateOldSearches(): RecentSearch[] {
  const allSearches: RecentSearch[] = [];
  const platforms: PlatformId[] = ['pumpfun', 'kick', 'twitch', 'YouTube', 'rumble', 'twitter'];
  const oldKeys: Record<PlatformId, string> = {
    pumpfun: 'pumpfun_recent_searches',
    kick: 'kick_recent_searches',
    twitch: 'twitch_recent_searches',
    YouTube: 'youtube_recent_searches',
    rumble: 'rumble_recent_searches',
    twitter: 'twitter_recent_searches',
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

// Save audio recent searches to localStorage
function saveAudioRecentSearches(searches: RecentSearch[]) {
  try {
    localStorage.setItem(AUDIO_RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch (error) {
    console.error('Failed to save audio recent searches', error);
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

    // Load audio recent searches
    const audioRecentSearches = loadAudioRecentSearches();

    return {
      clips: [],
      currentSearchId: '',
      loading: false,
      error: '',
      hasMore: false,
      total: 0,
      lastSearchTime: null,
      recentSearches,
      audioRecentSearches,
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
    // Get audio recent searches sorted by timestamp (most recent first)
    getAudioRecentSearches: (state) => {
      return [...state.audioRecentSearches].sort((a, b) => b.timestamp - a.timestamp);
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

    // Add a search to audio recent searches
    addToAudioRecentSearches(
      id: string,
      displayText: string,
      platform: PlatformId,
      label?: string,
      metadata?: { symbol?: string; name?: string; imageUrl?: string }
    ) {
      const existingIndex = this.audioRecentSearches.findIndex(
        (search) => search.id === id && search.platform === platform
      );

      if (existingIndex !== -1) {
        // Update existing entry
        this.audioRecentSearches[existingIndex].timestamp = Date.now();
        this.audioRecentSearches[existingIndex].displayText = displayText;
        if (label !== undefined) {
          this.audioRecentSearches[existingIndex].label = label;
        }
        if (metadata) {
          if (metadata.symbol) this.audioRecentSearches[existingIndex].symbol = metadata.symbol;
          if (metadata.name) this.audioRecentSearches[existingIndex].name = metadata.name;
          if (metadata.imageUrl) this.audioRecentSearches[existingIndex].imageUrl = metadata.imageUrl;
        }
      } else {
        // Add new entry
        this.audioRecentSearches.push({
          id,
          platform,
          displayText,
          label,
          timestamp: Date.now(),
          ...metadata,
        });

        // Limit total searches
        if (this.audioRecentSearches.length > MAX_RECENT_SEARCHES) {
          // Remove oldest
          this.audioRecentSearches.sort((a, b) => b.timestamp - a.timestamp);
          this.audioRecentSearches = this.audioRecentSearches.slice(0, MAX_RECENT_SEARCHES);
        }
      }

      saveAudioRecentSearches(this.audioRecentSearches);
    },

    // Background metadata fetch for Kick (avatar/username)
    async fetchKickMetadata(channelSlug: string) {
      try {
        console.log('[Platform] Fetching Kick metadata for:', channelSlug);
        const status = await checkKickLivestream(channelSlug);
        console.log('[Platform] Kick metadata response:', {
          username: status.username,
          profileImageUrl: status.profileImageUrl,
          isLive: status.isLive,
        });
        
        // Update metadata even if channel is offline (username/avatar should still be available)
        if (status && (status.username || status.profileImageUrl)) {
          this.updateRecentSearchMetadata(channelSlug, 'kick', {
            name: status.username,
            imageUrl: status.profileImageUrl,
          });
          console.log('[Platform] Updated Kick metadata for:', channelSlug);
        } else {
          console.warn('[Platform] No Kick metadata available for:', channelSlug);
        }
      } catch (error) {
        console.error('[Platform] Failed to fetch Kick metadata for:', channelSlug, error);
      }
    },

    // Background metadata fetch for Rumble (channel name and avatar from livestream check)
    async fetchRumbleMetadata(channelId: string) {
      try {
        console.log('[Platform] Fetching Rumble metadata for:', channelId);
        const status = await checkRumbleLivestream(channelId);
        console.log('[Platform] Rumble status response:', status);
        
        let profileImageUrl = status?.profileImageUrl;
        
        // If no profile image from livestream check, try to get from VODs
        if (!profileImageUrl) {
          console.log('[Platform] No profile image from livestream check, trying VODs...');
          try {
            const vods = await getRumbleVods(channelId, 1);
            if (vods.length > 0 && vods[0].thumbnailUrl) {
              // Use the first VOD's thumbnail as a fallback
              profileImageUrl = vods[0].thumbnailUrl;
              console.log('[Platform] Using VOD thumbnail as fallback:', profileImageUrl);
            }
          } catch (vodError) {
            console.warn('[Platform] Failed to fetch VODs for avatar fallback:', vodError);
          }
        }
        
        if (status?.channelName || profileImageUrl) {
          const metadata = {
            name: status?.channelName || channelId.replace(/^(c\/|user\/)/, ''),
            imageUrl: profileImageUrl,
          };
          console.log('[Platform] Updating Rumble metadata with:', metadata);
          this.updateRecentSearchMetadata(channelId, 'rumble', metadata);
          console.log('[Platform] Recent searches after update:', this.recentSearches);
        } else {
          console.warn('[Platform] No Rumble metadata available');
        }
      } catch (error) {
        console.error('[Platform] Failed to fetch Rumble metadata for:', channelId, error);
      }
    },

    // Background metadata fetch for YouTube (channel name and avatar from VODs)
    async fetchYouTubeMetadata(channelId: string) {
      try {
        console.log('[Platform] Fetching YouTube metadata for:', channelId);
        const vods = await getYouTubeVods(channelId, 1);
        
        if (vods.length > 0) {
          // Use the first VOD's thumbnail as avatar
          const metadata = {
            name: channelId.replace(/^@/, ''), // Remove @ prefix if present
            imageUrl: vods[0].thumbnailUrl,
          };
          console.log('[Platform] Updating YouTube metadata with:', metadata);
          this.updateRecentSearchMetadata(channelId, 'YouTube', metadata);
        } else {
          console.warn('[Platform] No YouTube VODs found for:', channelId);
        }
      } catch (error) {
        console.error('[Platform] Failed to fetch YouTube metadata for:', channelId, error);
      }
    },

    // Refresh missing metadata (avatars) for recent searches
    async refreshRecentSearchMetadata() {
      // Process sequentially to avoid burst requests
      for (const search of this.recentSearches) {
        if (search.platform === 'kick' && !search.imageUrl) {
          await this.fetchKickMetadata(search.id);
        } else if (search.platform === 'twitch' && !search.imageUrl) {
          await this.fetchTwitchMetadata(search.id);
        } else if (search.platform === 'rumble' && (!search.name || !search.imageUrl)) {
          await this.fetchRumbleMetadata(search.id);
        } else if (search.platform === 'YouTube' && (!search.name || !search.imageUrl)) {
          await this.fetchYouTubeMetadata(search.id);
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

    // Clear all audio recent searches
    clearAudioRecentSearches() {
      this.audioRecentSearches = [];
      saveAudioRecentSearches([]);
    },

    // Remove audio platform searches (YouTube/Twitter) from VOD recent searches
    // This cleans up searches that were incorrectly added before the fix
    cleanupAudioSearchesFromVodList() {
      const audioPlatforms: PlatformId[] = ['YouTube', 'twitter'];
      const originalLength = this.recentSearches.length;
      
      this.recentSearches = this.recentSearches.filter(
        (search) => !audioPlatforms.includes(search.platform)
      );
      
      if (this.recentSearches.length !== originalLength) {
        saveRecentSearches(this.recentSearches);
        return originalLength - this.recentSearches.length;
      }
      return 0;
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
    async searchClips(input: string, limit: number = 20, tab?: 'streams' | 'videos', skipRecentSearches: boolean = false) {
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
          fallbackUsed?: boolean;
          actualTab?: 'streams' | 'videos';
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

          case 'twitch':
            extractedId = extractChannelName(trimmedInput);
            if (!extractedId) {
              this.error = 'Invalid Twitch channel URL or username';
              this.loading = false;
              return { success: false, error: this.error };
            }
            this.currentSearchId = extractedId;
            result = await this.getTwitchClips(extractedId, limit);
            break;

          case 'YouTube': {
            // Import extractYouTubeVideoId dynamically
            const { extractYouTubeVideoId } = await import('@/services/youtube');
            
            // Check if it's a direct video URL
            const videoId = extractYouTubeVideoId(trimmedInput);
            if (videoId) {
              // Direct video URL - pass through as-is, backend will handle it
              extractedId = trimmedInput.trim();
              this.currentSearchId = videoId;
            } else {
              // Channel URL or handle
              extractedId = extractYouTubeChannel(trimmedInput) || trimmedInput.trim();
              if (!extractedId) {
                this.error = 'Invalid YouTube URL. Enter a channel URL (@handle or /channel/ID) or a direct video link.';
                this.loading = false;
                return { success: false, error: this.error };
              }
              this.currentSearchId = extractedId;
            }
            
            const tabToUse = tab || 'streams';
            console.log('[Platform Store] YouTube search - input:', extractedId, 'tab:', tabToUse, 'isVideo:', !!videoId);
            result = await this.getYouTubeClips(extractedId, limit, tabToUse);
            break;
          }

          case 'rumble': {
            // Import extractRumbleVideoId dynamically
            const { extractRumbleVideoId } = await import('@/services/rumble');
            
            // Check if it's a direct video URL
            const videoId = extractRumbleVideoId(trimmedInput);
            if (videoId) {
              // Direct video URL - pass through as-is, backend will handle it
              extractedId = trimmedInput.trim();
              this.currentSearchId = videoId;
              console.log('[Platform Store] Rumble search - video URL detected:', videoId);
              result = await this.getRumbleClips(extractedId, limit, tab || 'streams');
              break;
            }
            
            // If it's a full URL, use it directly to preserve /livestreams or /videos paths
            // Otherwise, extract the channel name
            let channelInput: string;
            if (trimmedInput.includes('rumble.com/')) {
              const extracted = extractRumbleChannel(trimmedInput);
              if (!extracted) {
                this.error = 'Invalid Rumble URL. Enter a channel URL (rumble.com/c/ChannelName) or a direct video link.';
                this.loading = false;
                return { success: false, error: this.error };
              }
              extractedId = extracted;
              channelInput = trimmedInput;
            } else {
              extractedId = extractRumbleChannel(trimmedInput) || trimmedInput.trim();
              channelInput = extractedId;
            }

            if (!extractedId) {
              this.error = 'Invalid Rumble channel URL or name';
              this.loading = false;
              return { success: false, error: this.error };
            }
            this.currentSearchId = extractedId;
            const tabToUse = tab || 'streams';
            result = await this.getRumbleClips(channelInput, limit, tabToUse);
            break;
          }

          case 'twitter': {
            // Twitter supports broadcast/space URLs and regular tweet video URLs
            const broadcastId = extractTwitterBroadcastId(trimmedInput);
            
            // Check if it's a valid Twitter/X URL (broadcast, space, or regular tweet)
            const isValidTwitterUrl = trimmedInput.includes('twitter.com') || trimmedInput.includes('x.com');
            
            if (!isValidTwitterUrl) {
              this.error = 'Invalid X/Twitter URL. Enter a broadcast, space, or tweet video URL.';
              this.loading = false;
              return { success: false, error: this.error };
            }
            
            // Use broadcast ID if available, otherwise use the full URL
            this.currentSearchId = broadcastId || trimmedInput;
            console.log('[Platform Store] Twitter search - URL:', trimmedInput, 'broadcastId:', broadcastId);
            result = await this.getTwitterClip(trimmedInput);
            break;
          }

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
              (clip) => (clip.duration ?? 0) >= config.filterMinDuration!
            );
          }

          this.clips = filteredClips;
          this.hasMore = result.hasMore;
          this.total = filteredClips.length;
          this.lastSearchTime = Date.now();

          // Save to recent searches with platform
          // Skip for Twitter - it's handled in getTwitterClip with full metadata
          // Skip if caller wants to manage recent searches separately (e.g., Download Audio)
          if (!skipRecentSearches && this.activePlatform !== 'twitter') {
            this.addToRecentSearches(extractedId!, trimmedInput, this.activePlatform, undefined);
          }

          // Fetch metadata for PumpFun, Kick, Twitch, Rumble, or YouTube searches
          if (this.activePlatform === 'pumpfun') {
            this.fetchPumpFunMetadata(extractedId!);
          } else if (this.activePlatform === 'kick') {
            this.fetchKickMetadata(extractedId!);
          } else if (this.activePlatform === 'twitch') {
            this.fetchTwitchMetadata(extractedId!);
          } else if (this.activePlatform === 'rumble') {
            this.fetchRumbleMetadata(extractedId!);
          } else if (this.activePlatform === 'YouTube') {
            this.fetchYouTubeMetadata(extractedId!);
          }

          return {
            success: true,
            clips: filteredClips,
            total: filteredClips.length,
            hasMore: result.hasMore,
            fallbackUsed: result.fallbackUsed,
            actualTab: result.actualTab,
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

    // Helper to convert Twitch VODs to PlatformClip format
    async getTwitchClips(channelName: string, limit: number = 20): Promise<{
      success: boolean;
      clips: PlatformClip[];
      hasMore: boolean;
      total: number;
      error?: string;
    }> {
      try {
        const vods = await getTwitchVods(channelName, limit);
        const clips: PlatformClip[] = vods.map((vod: TwitchVod) => ({
          clipId: vod.vodId,
          title: vod.title || `VOD ${vod.vodId}`,
          duration: vod.duration || 0,
          thumbnailUrl: vod.thumbnailUrl,
          playlistUrl: vod.url,
          mp4Url: vod.url,
          clipType: 'COMPLETE' as const,
          createdAt: vod.createdAt,
          views: vod.viewCount,
        }));
        return {
          success: true,
          clips,
          hasMore: clips.length >= limit,
          total: clips.length,
        };
      } catch (error) {
        return {
          success: false,
          clips: [],
          hasMore: false,
          total: 0,
          error: error instanceof Error ? error.message : 'Failed to fetch Twitch VODs',
        };
      }
    },

    // Helper to convert Rumble VODs to PlatformClip format
    async getRumbleClips(channelName: string, limit: number = 20, tab: 'streams' | 'videos' = 'streams'): Promise<{
      success: boolean;
      clips: PlatformClip[];
      hasMore: boolean;
      total: number;
      error?: string;
      fallbackUsed?: boolean;
      actualTab?: 'streams' | 'videos';
    }> {
      try {
        // Construct URL with /livestreams or /videos path based on tab
        let urlToFetch = channelName;
        
        // If it's already a full URL, extract the base and reconstruct with the correct path
        if (channelName.includes('rumble.com/')) {
          // Strip query string before appending path, then remove any existing /livestreams or /videos suffix
          const withoutQuery = channelName.split('?')[0];
          const baseUrl = withoutQuery.split(/\/(livestreams|videos)/)[0];
          urlToFetch = `${baseUrl}/${tab === 'streams' ? 'livestreams' : 'videos'}`;
        } else {
          // Construct URL from channel name
          const channelPath = channelName.startsWith('c/') || channelName.startsWith('user/') 
            ? channelName 
            : `c/${channelName}`;
          urlToFetch = `https://rumble.com/${channelPath}/${tab === 'streams' ? 'livestreams' : 'videos'}`;
        }
        
        // Check cache first (5 minute TTL)
        const cacheKey = `rumble_${tab}_${channelName}_${limit}`;
        const cached = cache.get<RumbleVod[]>(cacheKey);
        if (cached && cached.length > 0) {
          console.log('[Platform Store] Using cached Rumble', tab, '- found', cached.length, 'items');
          // Apply the same filtering logic to cached data
          let filteredVods = tab === 'streams' 
            ? cached.filter(vod => vod.isLive)
            : cached.filter(vod => !vod.isLive);
          
          const clips: PlatformClip[] = filteredVods.map((vod: RumbleVod) => {
            const createdAt = this.parseRumbleDate(vod.uploadDate);
            return {
              clipId: vod.videoId,
              title: vod.title || `Video ${vod.videoId}`,
              duration: vod.duration || 0,
              thumbnailUrl: vod.thumbnailUrl,
              playlistUrl: vod.url,
              mp4Url: vod.url,
              clipType: 'COMPLETE' as const,
              createdAt,
              views: vod.viewCount ?? undefined,
            };
          });
          return {
            success: true,
            clips,
            hasMore: clips.length >= limit,
            total: clips.length,
            actualTab: tab,
          };
        }
        
        console.log('[Platform Store] Fetching Rumble', tab, 'from:', urlToFetch);
        const vods = await getRumbleVods(urlToFetch, limit);
        
        // Filter VODs based on tab selection using was_live field
        // Note: Rumble's /livestreams and /videos URLs return the same content,
        // so we must filter client-side based on the was_live field from yt-dlp
        let filteredVods = tab === 'streams' 
          ? vods.filter(vod => vod.isLive)  // isLive = is_live || was_live from backend
          : vods.filter(vod => !vod.isLive);
        
        console.log('[Platform Store] Filtered', filteredVods.length, 'out of', vods.length, 'VODs for tab:', tab);
        
        let fallbackUsed = false;
        let actualTab = tab;
        
        // If no results after filtering, try the other tab
        if (filteredVods.length === 0 && vods.length > 0) {
          const fallbackTab = tab === 'streams' ? 'videos' : 'streams';
          console.log('[Platform Store] No results in', tab, 'tab, trying', fallbackTab, 'tab');
          filteredVods = fallbackTab === 'streams'
            ? vods.filter(vod => vod.isLive)
            : vods.filter(vod => !vod.isLive);
          console.log('[Platform Store] Fallback filtered', filteredVods.length, 'VODs');
          
          if (filteredVods.length > 0) {
            fallbackUsed = true;
            actualTab = fallbackTab;
          }
        }
        
        // Cache the raw VODs (not filtered) so we can use them for both tabs
        if (vods.length > 0) {
          cache.set(cacheKey, vods, 5 * 60 * 1000);
        }
        
        const clips: PlatformClip[] = filteredVods.map((vod: RumbleVod) => {
          // upload_date from yt-dlp is YYYYMMDD — convert to ISO
          const createdAt = this.parseRumbleDate(vod.uploadDate);
          
          return {
            clipId: vod.videoId,
            title: vod.title || `Video ${vod.videoId}`,
            duration: vod.duration || 0,
            thumbnailUrl: vod.thumbnailUrl,
            playlistUrl: vod.url,
            mp4Url: vod.url,
            clipType: 'COMPLETE' as const,
            createdAt,
            views: vod.viewCount ?? undefined,
          };
        });
        return {
          success: true,
          clips,
          hasMore: clips.length >= limit,
          total: clips.length,
          fallbackUsed,
          actualTab,
        };
      } catch (error) {
        return {
          success: false,
          clips: [],
          hasMore: false,
          total: 0,
          error: error instanceof Error ? error.message : 'Failed to fetch Rumble VODs',
        };
      }
    },
    
    // Helper to parse Rumble date formats
    parseRumbleDate(uploadDate?: string): string | undefined {
      if (!uploadDate) return undefined;
      
      const raw = uploadDate;
      if (/^\d{8}$/.test(raw)) {
        return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      } else if (/^\d{9,13}$/.test(raw)) {
        const ms = raw.length <= 10 ? Number(raw) * 1000 : Number(raw);
        return new Date(ms).toISOString();
      } else {
        return raw;
      }
    },

    // Helper to convert YouTube VODs to PlatformClip format
    async getYouTubeClips(channelId: string, limit: number = 20, tab: 'streams' | 'videos' = 'streams'): Promise<{
      success: boolean;
      clips: PlatformClip[];
      hasMore: boolean;
      total: number;
      error?: string;
      fallbackUsed?: boolean;
      actualTab?: 'streams' | 'videos';
    }> {
      try {
        console.log('[Platform Store] getYouTubeClips - channelId:', channelId, 'tab:', tab);
        
        // Check cache first (5 minute TTL)
        const cacheKey = `youtube_${tab}_${channelId}_${limit}`;
        const cached = cache.get<YouTubeVod[]>(cacheKey);
        if (cached && cached.length > 0) {
          console.log('[Platform Store] Using cached YouTube', tab, '- found', cached.length, 'items');
          const clips: PlatformClip[] = cached.map((vod: YouTubeVod) => ({
            clipId: vod.videoId,
            title: vod.title || `Video ${vod.videoId}`,
            duration: vod.duration || 0,
            thumbnailUrl: vod.thumbnailUrl,
            playlistUrl: vod.url,
            mp4Url: vod.url,
            clipType: 'COMPLETE' as const,
            createdAt: this.parseYouTubeDate(vod.uploadDate),
            views: vod.viewCount ?? undefined,
          }));
          return {
            success: true,
            clips,
            hasMore: clips.length >= limit,
            total: clips.length,
            actualTab: tab,
          };
        }
        
        // Import getYouTubeVideos dynamically
        const { getYouTubeVideos } = await import('@/services/youtube');
        
        // Try primary tab first
        let vods = tab === 'videos' 
          ? await getYouTubeVideos(channelId, limit)
          : await getYouTubeVods(channelId, limit);
        console.log('[Platform Store] Fetched', vods.length, tab === 'videos' ? 'videos' : 'streams');
        
        let fallbackUsed = false;
        let actualTab = tab;
        
        // If no results, automatically try the other tab
        if (vods.length === 0) {
          const fallbackTab = tab === 'streams' ? 'videos' : 'streams';
          console.log('[Platform Store] No results in', tab, 'tab, trying', fallbackTab, 'tab');
          vods = fallbackTab === 'videos'
            ? await getYouTubeVideos(channelId, limit)
            : await getYouTubeVods(channelId, limit);
          console.log('[Platform Store] Fallback fetched', vods.length, fallbackTab);
          
          if (vods.length > 0) {
            fallbackUsed = true;
            actualTab = fallbackTab;
          }
        }
        
        // Cache the results (5 minute TTL)
        if (vods.length > 0) {
          const cacheKey = `youtube_${actualTab}_${channelId}_${limit}`;
          cache.set(cacheKey, vods, 5 * 60 * 1000);
        }
        
        const clips: PlatformClip[] = vods.map((vod: YouTubeVod) => {
          // Parse date
          const createdAt = this.parseYouTubeDate(vod.uploadDate);
          
          return {
            clipId: vod.videoId,
            title: vod.title || `Video ${vod.videoId}`,
            duration: vod.duration || 0,
            thumbnailUrl: vod.thumbnailUrl,
            playlistUrl: vod.url,
            mp4Url: vod.url,
            clipType: 'COMPLETE' as const,
            createdAt,
            views: vod.viewCount ?? undefined,
          };
        });
        return {
          success: true,
          clips,
          hasMore: clips.length >= limit,
          total: clips.length,
          fallbackUsed,
          actualTab,
        };
      } catch (error) {
        return {
          success: false,
          clips: [],
          hasMore: false,
          total: 0,
          error: error instanceof Error ? error.message : 'Failed to fetch YouTube VODs',
        };
      }
    },
    
    // Helper to parse YouTube date formats
    parseYouTubeDate(uploadDate?: string): string | undefined {
      if (!uploadDate) return undefined;
      
      const raw = uploadDate;
      if (/^\d{8}$/.test(raw)) {
        // YYYYMMDD → YYYY-MM-DD
        return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      } else if (/^\d{9,13}$/.test(raw)) {
        // Unix epoch seconds or milliseconds → ISO string
        const ms = raw.length <= 10 ? Number(raw) * 1000 : Number(raw);
        return new Date(ms).toISOString();
      } else {
        return raw;
      }
    },

    // Helper to get a single Twitter broadcast/space as a clip
    async getTwitterClip(url: string): Promise<{
      success: boolean;
      clips: PlatformClip[];
      hasMore: boolean;
      total: number;
      error?: string;
      warning?: string;
    }> {
      try {
        // Validate the URL
        const validatedUrl = await validateTwitterUrl(url);
        const broadcastId = extractTwitterBroadcastId(validatedUrl);
        
        if (!broadcastId) {
          return {
            success: false,
            clips: [],
            hasMore: false,
            total: 0,
            error: 'Invalid Twitter broadcast/space URL',
          };
        }

        // Fetch metadata from yt-dlp
        console.log('[Platform] Fetching Twitter metadata for:', validatedUrl);
        const metadata = await getTwitterBroadcastInfo(validatedUrl);
        console.log('[Platform] Twitter metadata received:', metadata);

        // Check if metadata fetch failed but we still have the URL
        let warning: string | undefined;
        if (metadata.error) {
          warning = `Could not fetch broadcast details: ${metadata.error}. You can still download the VOD, but duration and thumbnail may not be available.`;
          console.warn('[Platform] Twitter metadata fetch failed:', metadata.error);
        }

        // For Twitter, we return a single "clip" representing the broadcast/space
        const clip: PlatformClip = {
          clipId: broadcastId,
          title: metadata.title || `X Broadcast ${broadcastId}`,
          duration: metadata.duration, // Don't default to 0, keep undefined if not available
          thumbnailUrl: metadata.thumbnail,
          playlistUrl: validatedUrl,
          mp4Url: validatedUrl,
          clipType: 'COMPLETE' as const,
          createdAt: metadata.timestamp || new Date().toISOString(), // Use actual broadcast timestamp, fallback to current date
          uploader: metadata.username || metadata.uploader,
        };
        
        // Add to recent searches with avatar
        // Store the full URL as both id and displayText so clicking works correctly
        if (metadata.username || broadcastId) {
          this.addToRecentSearches(
            validatedUrl,
            validatedUrl, // displayText is the URL for searching
            'twitter',
            metadata.username || broadcastId, // label is the username shown below avatar
            {
              name: metadata.title || `X Broadcast ${broadcastId}`, // name is the title shown in bold
              imageUrl: metadata.avatarUrl,
            }
          );
        }

        return {
          success: true,
          clips: [clip],
          hasMore: false,
          total: 1,
          warning,
        };
      } catch (error) {
        return {
          success: false,
          clips: [],
          hasMore: false,
          total: 0,
          error: error instanceof Error ? error.message : 'Failed to fetch Twitter broadcast info',
        };
      }
    },

    // Background metadata fetch for Twitch (avatar/username)
    async fetchTwitchMetadata(channelName: string) {
      try {
        const status = await checkTwitchLivestream(channelName);
        if (status) {
          this.updateRecentSearchMetadata(channelName, 'twitch', {
            name: status.displayName,
            imageUrl: status.profileImageUrl,
          });
        }
      } catch {
        // Ignore errors; non-fatal
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
