import { defineStore } from 'pinia';
import { getKickClips, extractChannelSlug, type KickClip } from '@/services/kick';

interface KickRecentSearch {
  slug: string;
  displayText: string;
  timestamp: number;
  label?: string;
  imageUrl?: string;
}

interface KickState {
  clips: KickClip[];
  currentChannelSlug: string;
  loading: boolean;
  error: string;
  hasMore: boolean;
  total: number;
  lastSearchTime: number | null;
  recentSearches: KickRecentSearch[];
}

const RECENT_SEARCHES_KEY = 'kick_recent_searches';
const MAX_RECENT_SEARCHES = 10;

export const useKickStore = defineStore('kick', {
  state: (): KickState => {
    let recentSearches: KickRecentSearch[] = [];
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored && stored.trim() !== '') {
        recentSearches = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load recent Kick searches', error);
    }

    return {
      clips: [],
      currentChannelSlug: '',
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
    getCurrentChannelSlug: (state) => state.currentChannelSlug,
    getClipsCount: (state) => state.clips.length,
    getLastSearchTime: (state) => state.lastSearchTime,
    getRecentSearches: (state) => state.recentSearches.slice().reverse(), // Most recent first
  },

  actions: {
    saveRecentSearches() {
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(this.recentSearches));
      } catch (error) {
        console.error('Failed to save recent Kick searches', error);
      }
    },

    addToRecentSearches(slug: string, displayText: string, label?: string, imageUrl?: string) {
      // Remove existing if present (to move to top)
      this.recentSearches = this.recentSearches.filter((s) => s.slug !== slug);

      // Add new
      this.recentSearches.push({
        slug,
        displayText,
        timestamp: Date.now(),
        label,
        imageUrl,
      });

      // Limit size
      if (this.recentSearches.length > MAX_RECENT_SEARCHES) {
        this.recentSearches = this.recentSearches.slice(
          this.recentSearches.length - MAX_RECENT_SEARCHES
        );
      }

      this.saveRecentSearches();
    },

    clearRecentSearches() {
      this.recentSearches = [];
      this.saveRecentSearches();
    },

    updateRecentSearchLabel(slug: string, label: string) {
      const search = this.recentSearches.find((s) => s.slug === slug);
      if (search) {
        search.label = label;
        this.saveRecentSearches();
      }
    },

    async searchClips(query: string, limit: number = 20) {
      this.loading = true;
      this.error = '';
      this.clips = [];

      const slug = extractChannelSlug(query);

      if (!slug) {
        this.error = 'Invalid channel URL or slug';
        this.loading = false;
        return { success: false, error: this.error };
      }

      this.currentChannelSlug = slug;

      try {
        const result = await getKickClips(slug, limit);

        if (result.success) {
          this.clips = result.clips;
          this.hasMore = result.hasMore;
          this.total = result.total;
          this.lastSearchTime = Date.now();

          // Add to recent searches (if we got results or at least it was a valid search attempt that didn't error)
          // If result.total > 0, definitely add. Even if 0, maybe valid channel just no clips?
          // For now, add if success.
          const channelInfo = result.clips.length > 0 ? result.clips[0] : null;
          // Kick clips don't have channel info directly in the simplified clip object I made,
          // but the fetch-kick-clips.mjs script could provide it.
          // For now, use a placeholder or empty image.

          this.addToRecentSearches(slug, slug, undefined, channelInfo?.thumbnailUrl);
          // Note: thumbnailUrl is of the clip, not channel profile. But acceptable for now.
        } else {
          this.error = result.error || 'Failed to fetch clips';
        }

        return result;
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'An unexpected error occurred';
        return { success: false, error: this.error };
      } finally {
        this.loading = false;
      }
    },

    clearClips() {
      this.clips = [];
      this.currentChannelSlug = '';
      this.error = '';
      this.total = 0;
    },
  },
});
