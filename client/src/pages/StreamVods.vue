<template>
  <div class="streamvods">
    <PageLayout
      title="Stream VODs"
      description="Download VODs from your favorite streaming platforms"
      :show-header="true"
      :icon="Video"
    >
      <template #actions>
        <div class="streamvods-actions">
          <!-- Recent Searches Dropdown -->
          <div class="streamvods-recent" v-if="platformStore.getRecentSearches.length > 0">
            <button
              @click="showRecentDropdown = !showRecentDropdown"
              class="streamvods-recent__trigger"
              title="Recent searches"
            >
              <Clock class="streamvods-recent__trigger-icon" />
              <span class="streamvods-recent__trigger-text">Recent</span>
              <ChevronDown
                class="streamvods-recent__trigger-chevron"
                :class="{ 'streamvods-recent__trigger-chevron--open': showRecentDropdown }"
              />
            </button>
            <div v-if="showRecentDropdown" class="streamvods-recent__dropdown" @click.stop>
              <div class="streamvods-recent__header">Recent Searches</div>
              <div
                v-for="search in platformStore.getRecentSearches.slice(0, 15)"
                :key="`${search.platform}-${search.id}`"
                class="streamvods-recent__item"
                @click="
                  handleRecentSearchClick(search);
                  showRecentDropdown = false;
                "
              >
                <div class="streamvods-recent__avatar">
                  <div class="streamvods-recent__avatar-img">
                    <img v-if="search.imageUrl" :src="search.imageUrl" />
                    <component
                      v-else
                      :is="getPlatformFallbackIcon(search.platform)"
                      class="streamvods-recent__avatar-fallback"
                    />
                  </div>
                  <div
                    class="streamvods-recent__avatar-badge"
                    :class="`streamvods-recent__avatar-badge--${search.platform}`"
                  >
                    <img :src="getPlatformIcon(search.platform)" />
                  </div>
                </div>
                <div class="streamvods-recent__info">
                  <span class="streamvods-recent__name">
                    <template v-if="search.symbol">{{ search.symbol }}</template>
                    <template v-else-if="search.label">{{ search.label }}</template>
                    <template v-else>{{ truncateId(search.id) }}</template>
                  </span>
                  <span class="streamvods-recent__detail">
                    <template v-if="search.name">{{ search.name }}</template>
                    <template v-else>{{ search.displayText }}</template>
                  </span>
                </div>
              </div>
              <button
                @click="
                  platformStore.clearRecentSearches();
                  showRecentDropdown = false;
                "
                class="streamvods-recent__clear"
              >
                Clear All
              </button>
            </div>
          </div>

          <!-- Search Input with Auto-Detection -->
          <div class="streamvods-search">
            <transition name="scale" mode="out-in">
              <div
                v-if="detectedPlatform === 'pumpfun'"
                class="streamvods-search__platform streamvods-search__platform--pumpfun"
                key="pf"
              >
                <img src="/capsule.svg" class="streamvods-search__platform-icon" />
              </div>
              <div
                v-else-if="detectedPlatform === 'kick'"
                class="streamvods-search__platform streamvods-search__platform--kick"
                key="kick"
              >
                <img src="/kick.svg" class="streamvods-search__platform-icon streamvods-search__platform-icon--dark" />
              </div>
              <div
                v-else-if="detectedPlatform === 'twitch'"
                class="streamvods-search__platform streamvods-search__platform--twitch"
                key="tw"
              >
                <img src="/twitch.svg" class="streamvods-search__platform-icon" />
              </div>
              <div
                v-else-if="detectedPlatform === 'youtube'"
                class="streamvods-search__platform streamvods-search__platform--youtube"
                key="yt"
              >
                <img src="/youtube.svg" class="streamvods-search__platform-icon" />
              </div>
              <Search v-else class="streamvods-search__icon" key="search" />
            </transition>
            <input
              v-model="searchInput"
              class="streamvods-search__input"
              placeholder="Paste stream link, mint ID, or username..."
              :disabled="platformStore.loading"
              @input="detectPlatform"
              @keyup.enter="handleSearch"
            />
          </div>
          <button class="streamvods-search-btn" :disabled="!searchInput || platformStore.loading" @click="handleSearch">
            <Loader2
              v-if="platformStore.loading"
              class="streamvods-search-btn__icon streamvods-search-btn__icon--spin"
            />
            <Search v-else class="streamvods-search-btn__icon" />
            Search
          </button>
        </div>
      </template>

      <div
        class="streamvods__content"
        :class="{ 'streamvods__content--empty': platformStore.clips.length === 0 && !platformStore.loading }"
      >
        <!-- Page Heading -->
        <div v-if="platformStore.clips.length > 0 || platformStore.loading" class="streamvods__heading">
          <h1 class="streamvods__title">Stream VOD Library</h1>
          <p class="streamvods__subtitle">Search and download VODs from your favorite streaming platforms</p>
        </div>

        <!-- Loading State -->
        <div v-if="platformStore.loading" class="streamvods__loading">
          <div class="streamvods__section-header">
            <div class="streamvods__section-header-left">
              <div class="streamvods__section-icon">
                <Video />
              </div>
              <div class="streamvods__section-text">
                <h2 class="streamvods__section-title">Loading VODs</h2>
                <p class="streamvods__section-subtitle">Fetching available streams...</p>
              </div>
            </div>
          </div>
          <div class="streamvods__grid">
            <div v-for="i in 6" :key="i" class="vod-card vod-card--skeleton">
              <div class="vod-card__skeleton-bg"></div>
              <div class="vod-card__bottom">
                <div class="vod-card__skeleton-title"></div>
                <div class="vod-card__skeleton-meta"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="platformStore.error" class="streamvods__error">
          <div class="streamvods__error-icon">
            <AlertTriangle />
          </div>
          <h3 class="streamvods__error-title">Error</h3>
          <p class="streamvods__error-message">{{ platformStore.error }}</p>
          <button @click="handleSearch" class="streamvods__error-btn">Try Again</button>
        </div>

        <!-- VODs Grid -->
        <div v-else-if="platformStore.clips.length > 0" class="streamvods__results">
          <!-- Results Count -->
          <div class="streamvods__results-count">
            {{ paginatedClips.length }} {{ paginatedClips.length === 1 ? 'item' : 'items' }}
            <span v-if="totalPages > 1">(Page {{ currentPage }} of {{ totalPages }})</span>
          </div>

          <!-- VOD Cards Grid -->
          <div class="streamvods__grid">
            <div v-for="clip in paginatedClips" :key="clip.clipId" class="vod-card" @click="handleClipClick(clip)">
              <!-- Thumbnail Background -->
              <div
                v-if="clip.thumbnailUrl"
                class="vod-card__thumbnail"
                :style="{ backgroundImage: `url(${clip.thumbnailUrl})` }"
              ></div>

              <!-- Vignette Overlay -->
              <div class="vod-card__vignette"></div>

              <!-- Platform Badge -->
              <div class="vod-card__badges">
                <span v-if="detectedPlatform" class="vod-card__badge" :class="`vod-card__badge--${detectedPlatform}`">
                  <img :src="getPlatformIcon(detectedPlatform)" class="vod-card__badge-icon" />
                </span>
                <span class="vod-card__badge vod-card__badge--duration">
                  <Clock class="vod-card__badge-icon-svg" />
                  {{ formatDuration(clip.duration) }}
                </span>
              </div>

              <!-- Hover Actions -->
              <div class="vod-card__actions">
                <button class="vod-card__action-btn" title="Download" @click.stop="handleDownloadClip(clip)">
                  <Download class="vod-card__action-icon" />
                </button>
              </div>

              <!-- Bottom Info Overlay -->
              <div class="vod-card__bottom">
                <h3 class="vod-card__name" :title="clip.title">{{ clip.title }}</h3>
                <div class="vod-card__meta">
                  <span>{{ clip.createdAt ? formatAbsoluteDate(clip.createdAt) : 'No timestamp' }}</span>
                  <template v-if="clip.createdAt">
                    <span class="vod-card__meta-dot"></span>
                    <span>{{ formatRelativeTime(clip.createdAt) }}</span>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="streamvods__empty">
          <div class="streamvods__empty-icon-wrapper">
            <Video class="streamvods__empty-icon" />
          </div>
          <h3 class="streamvods__empty-title">Search for VODs</h3>
          <p class="streamvods__empty-description">Paste a stream link, mint ID, or channel username to find VODs</p>
        </div>
      </div>

      <!-- Pagination Footer -->
      <PaginationFooter
        v-if="platformStore.clips.length > 0"
        :current-page="currentPage"
        :total-pages="totalPages"
        :total-items="platformStore.clips.length"
        item-label="VOD"
        @go-to-page="goToPage"
        @previous="previousPage"
        @next="nextPage"
      />
    </PageLayout>

    <!-- Download Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDownloadDialog" class="download-modal__overlay" @click.self="closeDownloadDialog()">
          <Transition name="dialog" appear>
            <div class="download-modal">
              <!-- Accent Bar -->
              <div class="download-modal__accent"></div>

              <!-- Header -->
              <div class="download-modal__header">
                <button class="download-modal__close" @click="closeDownloadDialog()" title="Close">
                  <X :size="18" />
                </button>
                <div class="download-modal__icon">
                  <Download :size="24" />
                </div>
                <h2 class="download-modal__title">Download Options</h2>
                <p class="download-modal__subtitle">Configure your download settings</p>
              </div>

              <!-- Content -->
              <div class="download-modal__content">
                <!-- VOD Preview Card -->
                <div class="download-preview">
                  <div class="download-preview__thumb">
                    <img v-if="clipToDownload?.thumbnailUrl" :src="clipToDownload.thumbnailUrl" />
                    <div v-else class="download-preview__placeholder">
                      <Video :size="28" />
                    </div>
                  </div>
                  <div class="download-preview__info">
                    <h3 class="download-preview__title">{{ clipToDownload?.title }}</h3>
                    <div class="download-preview__meta">
                      <span class="download-preview__duration">
                        <Clock :size="10" />
                        {{ formatDuration(clipToDownload?.duration) }}
                      </span>
                      <span class="download-preview__sep">·</span>
                      <span>
                        {{
                          clipToDownload?.createdAt
                            ? formatAbsoluteDate(clipToDownload?.createdAt, true)
                            : 'No timestamp'
                        }}
                      </span>
                      <template v-if="clipToDownload?.createdAt">
                        <span class="download-preview__sep">·</span>
                        <span>{{ formatRelativeTime(clipToDownload?.createdAt) }}</span>
                      </template>
                    </div>
                  </div>
                </div>

                <!-- Time Range Section -->
                <div class="download-section">
                  <div class="download-section__header">
                    <span class="download-section__label">Select Range</span>
                    <span
                      class="download-section__badge"
                      :class="
                        isFullStreamSelected ? 'download-section__badge--full' : 'download-section__badge--partial'
                      "
                    >
                      {{ isFullStreamSelected ? 'Full Stream' : formatDuration(selectedDuration) }}
                    </span>
                  </div>
                  <div class="download-section__card">
                    <TimeRangePicker
                      v-model="selectedTimeRange"
                      :total-duration="clipToDownload?.duration || 0"
                      @change="handleTimeRangeChange"
                    />
                  </div>
                  <button v-if="!isFullStreamSelected" @click="resetToFullStream" class="download-section__reset">
                    <RotateCcw :size="12" />
                    Reset to full stream
                  </button>
                </div>

                <!-- Auto-Segment Section -->
                <div v-if="selectedDuration > 900" class="download-section">
                  <div class="download-segment">
                    <div class="download-segment__header">
                      <label class="download-segment__toggle">
                        <input type="checkbox" v-model="autoSegment" class="download-segment__checkbox" />
                        <span class="download-segment__label">Auto-segment into parts</span>
                      </label>
                      <span v-if="autoSegment" class="download-section__badge download-section__badge--partial">
                        ~{{ estimatedParts }} parts
                      </span>
                    </div>
                    <div v-if="autoSegment" class="download-segment__options">
                      <div class="download-segment__row">
                        <span class="download-segment__opt-label">Part Duration</span>
                        <span class="download-segment__opt-value">{{ autoSegmentDuration }} min</span>
                      </div>
                      <input
                        type="range"
                        v-model.number="autoSegmentDuration"
                        min="15"
                        max="60"
                        step="5"
                        class="download-segment__slider"
                      />
                      <div class="download-segment__marks">
                        <span>15m</span>
                        <span>30m</span>
                        <span>45m</span>
                        <span>60m</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="download-modal__footer">
                <button
                  class="download-modal__btn download-modal__btn--secondary"
                  @click="closeDownloadDialog()"
                  :disabled="downloadStarting"
                >
                  Cancel
                </button>
                <button
                  class="download-modal__btn download-modal__btn--primary"
                  @click="downloadClipConfirmed"
                  :disabled="downloadStarting || selectedTimeRange.endTime <= selectedTimeRange.startTime"
                >
                  <Loader2 v-if="downloadStarting" :size="14" class="download-modal__btn-spinner" />
                  <span>{{ downloadStarting ? 'Starting...' : 'Start Download' }}</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Auth Modal -->
    <AuthModal v-model="showAuthModal" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, Teleport, Transition } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import TimeRangePicker from '@/components/TimeRangePicker.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import { usePlatformStore, type PlatformClip } from '@/stores/platform';
  import { platformConfigs, type PlatformId } from '@/config/platforms';
  import { extractMintId } from '@/services/pumpfun';
  import { extractChannelSlug } from '@/services/kick';
  import { useToast } from '@/composables/useToast';
  import { useDownloads } from '@/composables/useDownloads';
  import { getNextSegmentNumber } from '@/services/database';
  import { Clock, ChevronDown, X, AlertTriangle, Download, Video, Search, Loader2, RotateCcw } from 'lucide-vue-next';
  import { getCreatorProfileByPlatformId } from '@/services/database';
  import { getUserAssignedCreatorProfiles } from '@/services/organizationProfilesApi';
  import { useSubscriptionGate } from '@/composables/useSubscriptionGate';
  import { useAuthStore } from '@/stores/auth';

  const router = useRouter();
  const { gates } = useSubscriptionGate();
  const route = useRoute();
  const { success, error: showError } = useToast();
  const { startDownload } = useDownloads();
  const platformStore = usePlatformStore();
  const authStore = useAuthStore();

  // Component state
  const searchInput = ref('');
  const showDownloadDialog = ref(false);
  const clipToDownload = ref<PlatformClip | null>(null);
  const downloadStarting = ref(false);
  const showRecentDropdown = ref(false);
  const selectedTimeRange = ref({ startTime: 0, endTime: 0 });
  const nextSegmentNumber = ref(1);
  const autoSegment = ref(false);
  const autoSegmentDuration = ref(30);
  const currentPage = ref(1);
  const clipsPerPage = 20;
  const showAuthModal = ref(false);

  // Auto-detected platform from input
  const detectedPlatform = ref<PlatformId | null>(null);
  const currentPlatformConfig = computed(() => platformConfigs[detectedPlatform.value || platformStore.activePlatform]);

  function detectPlatform() {
    const val = searchInput.value?.trim();

    if (!val) {
      detectedPlatform.value = null;
      return;
    }

    // Check PumpFun using the robust extractor (handles URLs and Mint IDs)
    if (extractMintId(val)) {
      detectedPlatform.value = 'pumpfun';
      return;
    }

    const lowerVal = val.toLowerCase();

    // Check for YouTube
    if (lowerVal.includes('youtube.com') || lowerVal.includes('youtu.be')) {
      detectedPlatform.value = 'youtube';
      return;
    }

    // Check for Twitch
    if (lowerVal.includes('twitch.tv')) {
      detectedPlatform.value = 'twitch';
      return;
    }

    // Check for Kick URLs
    if (lowerVal.includes('kick.com')) {
      detectedPlatform.value = 'kick';
      return;
    }

    // Check if it could be a Kick username (alphanumeric with underscores/hyphens, 3+ chars)
    // This is a fallback - if it's not a URL and not a mint ID, assume Kick username
    if (/^[a-zA-Z0-9_-]{3,}$/.test(val) && !extractMintId(val)) {
      detectedPlatform.value = 'kick';
      return;
    }

    detectedPlatform.value = null;
  }

  // Initialize
  onMounted(async () => {
    document.addEventListener('click', handleClickOutside);
    await platformStore.refreshRecentSearchMetadata();
    detectPlatform();

    // Check for query params (from Creator Profiles navigation)
    const queryPlatform = route.query.platform as string | undefined;
    const querySearch = route.query.search as string | undefined;

    if (queryPlatform && querySearch) {
      // Set the platform and search from query params
      const validPlatforms = ['pumpfun', 'kick', 'twitch', 'youtube'] as const;
      if (validPlatforms.includes(queryPlatform as any)) {
        detectedPlatform.value = queryPlatform as PlatformId;
        searchInput.value = querySearch;

        // Clear query params from URL to prevent re-search on navigation
        router.replace({ path: route.path, query: {} });

        // Trigger search
        await handleSearch();
        return;
      }
    }

    // Restore platform state if clips are already loaded (e.g., returning from another page)
    if (platformStore.clips.length > 0) {
      detectedPlatform.value = platformStore.activePlatform;
      // Restore the search input to show what's currently loaded
      if (platformStore.currentSearchId) {
        searchInput.value = platformStore.currentSearchId;
      }
    }
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  function handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.streamvods-recent')) {
      showRecentDropdown.value = false;
    }
  }

  // Computed properties for the unified download UI
  // Use a generous tolerance (5 seconds or 1% of duration) to account for slider precision
  const isFullStreamSelected = computed(() => {
    if (!clipToDownload.value?.duration) return true;
    const duration = clipToDownload.value.duration;
    const tolerance = Math.max(5, duration * 0.01); // At least 5 seconds or 1% of duration
    return selectedTimeRange.value.startTime <= tolerance && selectedTimeRange.value.endTime >= duration - tolerance;
  });

  const selectedDuration = computed(() => {
    return selectedTimeRange.value.endTime - selectedTimeRange.value.startTime;
  });

  const estimatedParts = computed(() => {
    if (!autoSegment.value) return 1;
    return Math.ceil(selectedDuration.value / (autoSegmentDuration.value * 60));
  });

  function resetToFullStream() {
    if (clipToDownload.value?.duration) {
      selectedTimeRange.value = { startTime: 0, endTime: clipToDownload.value.duration };
    }
  }

  // Utility functions
  function truncateId(id: string) {
    if (!id || id.length < 8) return id;
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
  }

  // Platform helper functions for recent searches dropdown
  function getPlatformIcon(platform: PlatformId): string {
    const icons: Record<PlatformId, string> = {
      pumpfun: '/capsule.svg',
      kick: '/kick.svg',
      twitch: '/twitch.svg',
      youtube: '/youtube.svg',
    };
    return icons[platform] || '/capsule.svg';
  }

  function getPlatformDisplayName(platform: PlatformId): string {
    const names: Record<PlatformId, string> = {
      pumpfun: 'PumpFun',
      kick: 'Kick',
      twitch: 'Twitch',
      youtube: 'YouTube',
    };
    return names[platform] || platform;
  }

  function getPlatformFallbackIcon(_platform: PlatformId) {
    // Return a component or default to Clock
    return Clock;
  }

  const formatDuration = (duration?: number) => {
    if (!duration) return 'Unknown';
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  function formatRelativeTime(timestamp?: number | string | Date) {
    if (!timestamp) return 'Streamed recently';
    const date = new Date(timestamp);
    const now = new Date();
    const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (secondsAgo < 60) return 'Streamed just now';
    if (secondsAgo < 3600) return `Streamed ${Math.floor(secondsAgo / 60)} minutes ago`;
    if (secondsAgo < 86400) return `Streamed ${Math.floor(secondsAgo / 3600)} hours ago`;
    if (secondsAgo < 604800) return `Streamed ${Math.floor(secondsAgo / 86400)} days ago`;
    return `Streamed ${Math.floor(secondsAgo / 604800)} weeks ago`;
  }

  function formatAbsoluteDate(timestamp?: number | string | Date, includeTime = false) {
    if (!timestamp) return 'No timestamp';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Invalid date';

    const dateOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    };

    if (includeTime) {
      return date.toLocaleString(undefined, {
        ...dateOptions,
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString(undefined, dateOptions);
  }

  // Pagination
  const totalPages = computed(() => Math.ceil(platformStore.clips.length / clipsPerPage));
  const paginatedClips = computed(() => {
    const start = (currentPage.value - 1) * clipsPerPage;
    return platformStore.clips.slice(start, start + clipsPerPage);
  });

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages.value) currentPage.value = page;
  }
  function nextPage() {
    if (currentPage.value < totalPages.value) currentPage.value++;
  }
  function previousPage() {
    if (currentPage.value > 1) currentPage.value--;
  }

  watch(
    () => platformStore.clips,
    () => {
      currentPage.value = 1;
    }
  );

  // Search handlers
  function handleRecentSearchClick(search: { id: string; displayText: string; platform: PlatformId }) {
    searchInput.value = search.displayText;
    // Set the detected platform from the search instead of auto-detecting
    detectedPlatform.value = search.platform;
    handleSearch();
  }

  async function handleSearch() {
    const input = searchInput.value.trim();
    if (!input) {
      showError('Invalid Input', 'Please enter a stream link, mint ID, or username');
      return;
    }

    // Check if user is authenticated
    if (!authStore.isAuthenticated) {
      showAuthModal.value = true;
      return;
    }

    // Only auto-detect platform if not already explicitly set (e.g., from query params or recent search)
    if (!detectedPlatform.value) {
      detectPlatform();
    }

    if (!detectedPlatform.value) {
      showError(
        'Unknown Platform',
        'Could not detect the platform. Please enter a valid PumpFun link/mint ID, Kick link/username, or Twitch link/channel name.'
      );
      return;
    }

    // Check if platform is coming soon
    const config = platformConfigs[detectedPlatform.value];
    if (config.isComingSoon) {
      showError(
        `${config.name} Coming Soon`,
        config.comingSoonMessage || `${config.name} integration is not yet available.`
      );
      return;
    }

    // Set the active platform in the store
    platformStore.setActivePlatform(detectedPlatform.value);

    try {
      const result = await platformStore.searchClips(input, 20);
      if (result.success) {
        if (result.total === 0) {
          showError('No VODs Found', 'No available VODs found for this search');
        } else {
          success('VODs Loaded', `Found ${result.total} VOD${result.total !== 1 ? 's' : ''}`);
        }
      } else {
        showError('Search Failed', result.error || 'Failed to fetch VODs');
      }
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }

  // Clip handlers
  function handleClipClick(clip: PlatformClip) {
    console.log('Clicked clip:', clip);
  }

  async function handleDownloadClip(clip: PlatformClip) {
    // Check subscription access before allowing download
    if (!(await gates.download(`Download "${clip.title}"`))) {
      return; // Gate was shown, user doesn't have access
    }

    clipToDownload.value = clip;
    selectedTimeRange.value = { startTime: 0, endTime: clip.duration || 0 };
    // Default auto-segment off, user can enable if they want to split
    autoSegment.value = false;
    calculateNextSegmentNumber(clip.clipId);
    showDownloadDialog.value = true;
  }

  async function calculateNextSegmentNumber(clipId: string) {
    try {
      nextSegmentNumber.value = await getNextSegmentNumber(clipId);
    } catch {
      nextSegmentNumber.value = 1;
    }
  }

  function handleTimeRangeChange(range: { startTime: number; endTime: number }) {
    selectedTimeRange.value = range;
  }

  function closeDownloadDialog() {
    showDownloadDialog.value = false;
    clipToDownload.value = null;
  }

  async function downloadClipConfirmed() {
    if (!clipToDownload.value || !currentPlatformConfig.value) return;

    const clip = clipToDownload.value;
    downloadStarting.value = true;

    try {
      const videoUrl = clip.mp4Url || clip.playlistUrl;
      if (!videoUrl) throw new Error('No video URL available for this VOD');

      // Only pass segment range if user has trimmed the selection (not full stream)
      const segmentRange = !isFullStreamSelected.value
        ? { startTime: selectedTimeRange.value.startTime, endTime: selectedTimeRange.value.endTime }
        : undefined;

      // Auto-segment applies to the selected range (whether full or trimmed)
      const shouldAutoSegment = autoSegment.value && selectedDuration.value > 900;

      // Look up creator profile by platform + platform ID to get watermark settings
      // First try local profiles, then check organization profiles
      // This works for both PumpFun (mint ID) and Kick (channel slug)
      let creatorWatermarkSettings: { watermarkId: string; watermarkSettings: string } | undefined;
      if (detectedPlatform.value && platformStore.currentSearchId) {
        console.log('[StreamVods] Looking up creator watermark for:', {
          platform: detectedPlatform.value,
          platformId: platformStore.currentSearchId,
        });

        try {
          // Try local profiles first
          const localProfile = await getCreatorProfileByPlatformId(
            detectedPlatform.value,
            platformStore.currentSearchId
          );
          if (localProfile?.watermark_id && localProfile?.watermark_settings) {
            console.log('[StreamVods] Found local creator profile with watermark:', localProfile.name);
            creatorWatermarkSettings = {
              watermarkId: localProfile.watermark_id,
              watermarkSettings: localProfile.watermark_settings,
            };
          }

          // If not found locally, try organization profiles
          if (!creatorWatermarkSettings && authStore.isAuthenticated) {
            console.log('[StreamVods] No local profile found, checking organization profiles...');
            const orgResponse = await getUserAssignedCreatorProfiles();
            if (orgResponse.success && orgResponse.profiles.length > 0) {
              console.log('[StreamVods] Searching', orgResponse.profiles.length, 'organization profiles');
              // Find a profile with a matching platform link
              for (const orgProfile of orgResponse.profiles) {
                // Log all platform links for debugging
                console.log(
                  '[StreamVods] Checking org profile:',
                  orgProfile.name,
                  'platform_links:',
                  orgProfile.platform_links.map((l) => ({ platform: l.platform, platform_id: l.platform_id }))
                );

                const matchingLink = orgProfile.platform_links.find((link) => {
                  if (link.platform !== detectedPlatform.value) return false;

                  // Extract the normalized ID from the stored platform_id
                  // This handles cases where the server stores full URLs instead of just IDs
                  let storedId = link.platform_id;
                  if (link.platform === 'kick') {
                    // Try to extract channel slug from URL if it's a full URL
                    const extractedSlug = extractChannelSlug(storedId);
                    if (extractedSlug) storedId = extractedSlug;
                  } else if (link.platform === 'pumpfun') {
                    // Try to extract mint ID from URL if it's a full URL
                    const extractedMint = extractMintId(storedId);
                    if (extractedMint) storedId = extractedMint;
                  }

                  return storedId.toLowerCase() === platformStore.currentSearchId.toLowerCase();
                });
                if (matchingLink) {
                  console.log('[StreamVods] Found matching org profile:', orgProfile.name, 'link:', matchingLink);
                  if (orgProfile.watermark_id && orgProfile.watermark_settings) {
                    // Transform watermark_settings to prefix per-ratio watermarkIds with org-asset-
                    // The server returns raw server IDs (integers) for per-ratio watermarkIds
                    const transformedSettings: Record<string, any> = {};
                    for (const [ratio, config] of Object.entries(orgProfile.watermark_settings)) {
                      if (config && typeof config === 'object') {
                        const ratioConfig = config as { watermarkId?: number; position?: any };
                        transformedSettings[ratio] = {
                          ...ratioConfig,
                          // Prefix the per-ratio watermarkId if present
                          watermarkId: ratioConfig.watermarkId ? `org-asset-${ratioConfig.watermarkId}` : null,
                        };
                      } else {
                        // null means disabled for this ratio
                        transformedSettings[ratio] = config;
                      }
                    }

                    creatorWatermarkSettings = {
                      watermarkId: `org-asset-${orgProfile.watermark_id}`,
                      watermarkSettings: JSON.stringify(transformedSettings),
                    };
                    console.log('[StreamVods] Using org watermark:', creatorWatermarkSettings.watermarkId);
                    break;
                  } else {
                    console.log('[StreamVods] Org profile has no watermark configured');
                  }
                }
              }
              if (!creatorWatermarkSettings) {
                console.log(
                  '[StreamVods] No matching org profile found. Looking for platform:',
                  detectedPlatform.value,
                  'platformId:',
                  platformStore.currentSearchId
                );
              }
            }
          }
        } catch (err) {
          // Silently ignore - watermark just won't be applied
          console.log('[StreamVods] Could not fetch creator profile for watermark:', err);
        }
      }

      await startDownload(
        clip.title,
        videoUrl,
        platformStore.currentSearchId,
        segmentRange,
        clip.clipId,
        clip.duration,
        {
          autoSegment: shouldAutoSegment,
          segmentDuration: autoSegmentDuration.value * 60,
          provider: currentPlatformConfig.value.provider as 'pumpfun' | 'kick' | 'twitch',
          creatorWatermarkSettings,
        }
      );

      let downloadMessage: string;

      if (shouldAutoSegment) {
        const parts = estimatedParts.value;
        const rangeLabel = isFullStreamSelected.value ? 'stream' : 'selection';
        downloadMessage = `Splitting ${rangeLabel} into ~${parts} parts (~${autoSegmentDuration.value} min each).`;
      } else if (!isFullStreamSelected.value) {
        downloadMessage = `Downloading ${formatDuration(selectedDuration.value)} segment of "${clip.title}".`;
      } else {
        downloadMessage = `Downloading full stream "${clip.title}".`;
      }

      success('Download Started', downloadMessage);
      closeDownloadDialog();

      setTimeout(() => {
        downloadStarting.value = false;
        router.push('/projects');
      }, 500);
    } catch (err) {
      showError('Download Failed', `Failed to download "${clip.title}": ${err}`);
      downloadStarting.value = false;
      closeDownloadDialog();
    }
  }
</script>

<style scoped>
  /* ===== Page Container ===== */
  .streamvods {
    width: 100%;
    min-height: 100%;
  }

  .streamvods__content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    width: 100%;
    flex: 1;
  }

  .streamvods__content--empty {
    justify-content: center;
    align-items: center;
  }

  /* ===== Page Heading ===== */
  .streamvods__heading {
    margin-bottom: 0.5rem;
  }

  .streamvods__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .streamvods__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Actions Bar ===== */
  .streamvods-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* ===== Recent Searches Dropdown ===== */
  .streamvods-recent {
    position: relative;
  }

  .streamvods-recent__trigger {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    height: 32px;
    padding: 0 0.625rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    color: var(--sidebar-text);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .streamvods-recent__trigger:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .streamvods-recent__trigger-icon {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
  }

  .streamvods-recent__trigger-text {
    color: var(--sidebar-text);
  }

  .streamvods-recent__trigger-chevron {
    width: 12px;
    height: 12px;
    color: var(--sidebar-text-muted);
    transition: transform 150ms ease;
  }

  .streamvods-recent__trigger-chevron--open {
    transform: rotate(180deg);
  }

  .streamvods-recent__dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 280px;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    z-index: 9999;
    max-height: 400px;
    overflow-y: auto;
  }

  .streamvods-recent__header {
    padding: 0.75rem 1rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .streamvods-recent__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: background-color 150ms ease;
  }

  .streamvods-recent__item:hover {
    background-color: var(--sidebar-hover);
  }

  .streamvods-recent__avatar {
    position: relative;
    flex-shrink: 0;
  }

  .streamvods-recent__avatar-img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .streamvods-recent__avatar-img img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .streamvods-recent__avatar-fallback {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
  }

  .streamvods-recent__avatar-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--sidebar-surface);
  }

  .streamvods-recent__avatar-badge img {
    width: 10px;
    height: 10px;
    filter: brightness(0) invert(1);
  }

  .streamvods-recent__avatar-badge--pumpfun {
    background-color: #10b981;
  }

  .streamvods-recent__avatar-badge--kick {
    background-color: #53fc18;
  }

  .streamvods-recent__avatar-badge--kick img {
    filter: brightness(0);
  }

  .streamvods-recent__avatar-badge--twitch {
    background-color: #9146ff;
  }

  .streamvods-recent__avatar-badge--youtube {
    background-color: #dc2626;
  }

  .streamvods-recent__info {
    flex: 1;
    min-width: 0;
  }

  .streamvods-recent__name {
    display: block;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .streamvods-recent__detail {
    display: block;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .streamvods-recent__clear {
    display: block;
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #f87171;
    background: transparent;
    border: none;
    border-top: 1px solid var(--sidebar-border);
    cursor: pointer;
    text-align: left;
    transition: background-color 150ms ease;
  }

  .streamvods-recent__clear:hover {
    background-color: rgba(248, 113, 113, 0.1);
  }

  /* ===== Search Input ===== */
  .streamvods-search {
    position: relative;
    width: 280px;
  }

  .streamvods-search__icon {
    position: absolute;
    left: 0.625rem;
    top: 50%;
    transform: translateY(-50%);
    width: 15px;
    height: 15px;
    color: var(--sidebar-text-muted);
    pointer-events: none;
  }

  .streamvods-search__platform {
    position: absolute;
    left: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    width: 22px;
    height: 22px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
  }

  .streamvods-search__platform--pumpfun {
    background-color: #10b981;
  }

  .streamvods-search__platform--kick {
    background-color: #53fc18;
  }

  .streamvods-search__platform--twitch {
    background-color: #9146ff;
  }

  .streamvods-search__platform--youtube {
    background-color: #dc2626;
  }

  .streamvods-search__platform-icon {
    width: 12px;
    height: 12px;
    filter: brightness(0) invert(1);
  }

  .streamvods-search__platform-icon--dark {
    filter: brightness(0);
  }

  .streamvods-search__input {
    width: 100%;
    height: 32px;
    padding-left: 2rem;
    padding-right: 0.75rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.75rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .streamvods-search__input::placeholder {
    color: var(--sidebar-text-muted);
  }

  .streamvods-search__input:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .streamvods-search__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.1);
  }

  .streamvods-search-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    height: 32px;
    padding: 0 0.75rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .streamvods-search-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .streamvods-search-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .streamvods-search-btn__icon {
    width: 14px;
    height: 14px;
  }

  .streamvods-search-btn__icon--spin {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Section Header ===== */
  .streamvods__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .streamvods__section-header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .streamvods__section-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .streamvods__section-icon svg {
    width: 18px;
    height: 18px;
  }

  .streamvods__section-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .streamvods__section-subtitle {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* ===== VOD Cards Grid ===== */
  .streamvods__grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }

  @media (min-width: 640px) {
    .streamvods__grid {
      grid-template-columns: repeat(1, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .streamvods__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1400px) {
    .streamvods__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 1800px) {
    .streamvods__grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (min-width: 2200px) {
    .streamvods__grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  /* ===== VOD Card ===== */
  .vod-card {
    position: relative;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition: all 200ms ease;
    aspect-ratio: 16 / 9;
  }

  .vod-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    transform: scale(1.02);
  }

  .vod-card__thumbnail {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    z-index: 0;
  }

  .vod-card__vignette {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.3) 40%, transparent 50%);
    pointer-events: none;
  }

  .vod-card__badges {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    z-index: 15;
  }

  .vod-card__badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.4rem;
    backdrop-filter: blur(8px);
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 700;
    color: white;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .vod-card__badge--pumpfun {
    background-color: rgba(16, 185, 129, 0.95);
    border: 1px solid rgba(16, 185, 129, 0.5);
  }

  .vod-card__badge--kick {
    background-color: rgba(83, 252, 24, 0.9);
    border: 1px solid rgba(83, 252, 24, 0.5);
    color: #000;
  }

  .vod-card__badge--twitch {
    background-color: rgba(145, 70, 255, 0.95);
    border: 1px solid rgba(145, 70, 255, 0.5);
  }

  .vod-card__badge--youtube {
    background-color: rgba(220, 38, 38, 0.95);
    border: 1px solid rgba(220, 38, 38, 0.5);
  }

  .vod-card__badge--duration {
    background-color: rgba(139, 92, 246, 0.95);
    border: 1px solid rgba(139, 92, 246, 0.5);
  }

  .vod-card__badge-icon {
    width: 14px;
    height: 14px;
    filter: brightness(0) invert(1);
  }

  .vod-card__badge--kick .vod-card__badge-icon {
    filter: brightness(0);
  }

  .vod-card__badge-icon-svg {
    width: 11px;
    height: 11px;
  }

  .vod-card__actions {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background-color: rgba(0, 0, 0, 0.5);
    opacity: 0;
    transition: opacity 200ms ease;
    z-index: 10;
  }

  .vod-card:hover .vod-card__actions {
    opacity: 1;
  }

  .vod-card__action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background-color: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 9999px;
    color: #1f2937;
    cursor: pointer;
    transition: all 150ms ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  .vod-card__action-btn:hover {
    background-color: white;
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }

  .vod-card__action-icon {
    width: 20px;
    height: 20px;
  }

  .vod-card__bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 5;
    padding: 1rem;
    padding-top: 7rem;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.7) 50%, transparent 100%);
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .vod-card__name {
    font-size: 1rem;
    font-weight: 700;
    color: white;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
    line-height: 1.3;
    transition: color 150ms ease;
  }

  .vod-card:hover .vod-card__name {
    color: rgba(255, 255, 255, 0.9);
  }

  .vod-card__meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .vod-card__meta-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.4);
    flex-shrink: 0;
  }

  /* Skeleton Card */
  .vod-card--skeleton {
    pointer-events: none;
  }

  .vod-card__skeleton-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .vod-card__skeleton-title {
    height: 16px;
    width: 65%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.05) 25%,
      rgba(255, 255, 255, 0.1) 50%,
      rgba(255, 255, 255, 0.05) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .vod-card__skeleton-meta {
    height: 12px;
    width: 40%;
    margin-top: 0.25rem;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.03) 25%,
      rgba(255, 255, 255, 0.08) 50%,
      rgba(255, 255, 255, 0.03) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.15s;
    border-radius: 3px;
  }

  /* Stagger skeleton animation delays */
  .vod-card--skeleton:nth-child(1) .vod-card__skeleton-bg {
    animation-delay: 0s;
  }
  .vod-card--skeleton:nth-child(2) .vod-card__skeleton-bg {
    animation-delay: 0.1s;
  }
  .vod-card--skeleton:nth-child(3) .vod-card__skeleton-bg {
    animation-delay: 0.2s;
  }
  .vod-card--skeleton:nth-child(4) .vod-card__skeleton-bg {
    animation-delay: 0.3s;
  }
  .vod-card--skeleton:nth-child(5) .vod-card__skeleton-bg {
    animation-delay: 0.4s;
  }
  .vod-card--skeleton:nth-child(6) .vod-card__skeleton-bg {
    animation-delay: 0.5s;
  }

  /* ===== Results Count ===== */
  .streamvods__results-count {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-bottom: 1rem;
  }

  /* ===== Error State ===== */
  .streamvods__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    background-color: rgba(239, 68, 68, 0.05);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 10px;
  }

  .streamvods__error-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background-color: rgba(239, 68, 68, 0.15);
    border-radius: 16px;
    margin-bottom: 1.5rem;
    color: #f87171;
  }

  .streamvods__error-icon svg {
    width: 32px;
    height: 32px;
  }

  .streamvods__error-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #f87171;
    margin: 0 0 0.5rem;
  }

  .streamvods__error-message {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1.5rem;
    max-width: 320px;
    line-height: 1.5;
  }

  .streamvods__error-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .streamvods__error-btn:hover {
    background-color: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.4);
  }

  /* ===== Empty State ===== */
  .streamvods__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .streamvods__empty-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: var(--sidebar-hover);
    border-radius: 16px;
    margin-bottom: 1.5rem;
  }

  .streamvods__empty-icon {
    width: 36px;
    height: 36px;
    color: var(--sidebar-text-muted);
  }

  .streamvods__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .streamvods__empty-description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
  }

  /* ===== Download Modal ===== */
  .download-modal__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  .download-modal {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 520px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .download-modal__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  .download-modal__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .download-modal__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .download-modal__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .download-modal__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 0.875rem;
  }

  .download-modal__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .download-modal__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Modal Content ===== */
  .download-modal__content {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .download-modal__content::-webkit-scrollbar {
    width: 6px;
  }

  .download-modal__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .download-modal__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .download-modal__content::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.25);
  }

  /* ===== Preview Card ===== */
  .download-preview {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem 1rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
    transition: all 150ms ease;
  }

  .download-preview:hover {
    background-color: var(--sidebar-active);
  }

  .download-preview__thumb {
    width: 90px;
    aspect-ratio: 16 / 9;
    border-radius: 6px;
    overflow: hidden;
    background-color: var(--sidebar-surface);
    flex-shrink: 0;
  }

  .download-preview__thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .download-preview__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sidebar-text-muted);
    opacity: 0.5;
  }

  .download-preview__info {
    flex: 1;
    min-width: 0;
  }

  .download-preview__title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.4;
  }

  .download-preview__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .download-preview__duration {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .download-preview__sep {
    opacity: 0.4;
  }

  /* ===== Section Styling ===== */
  .download-section {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .download-section__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.25rem;
  }

  .download-section__label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sidebar-text-muted);
  }

  .download-section__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    padding: 0.25rem 0.5rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .download-section__badge--full {
    background-color: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.25);
    color: #34d399;
  }

  .download-section__badge--partial {
    background-color: rgba(6, 182, 212, 0.15);
    border-color: rgba(6, 182, 212, 0.25);
    color: var(--sidebar-accent);
  }

  .download-section__card {
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
  }

  .download-section__reset {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0 0.25rem;
    transition: color 150ms ease;
  }

  .download-section__reset:hover {
    color: var(--sidebar-text);
  }

  /* ===== Segment Options ===== */
  .download-segment {
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
  }

  .download-segment__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .download-segment__toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .download-segment__checkbox {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1px solid var(--sidebar-border);
    background-color: transparent;
    cursor: pointer;
    accent-color: var(--sidebar-accent);
  }

  .download-segment__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .download-segment__options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 0.875rem;
    border-top: 1px solid var(--sidebar-border);
    margin-top: 0.875rem;
  }

  .download-segment__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .download-segment__opt-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sidebar-text-muted);
  }

  .download-segment__opt-value {
    font-size: 0.75rem;
    font-weight: 500;
    background-color: var(--sidebar-surface);
    color: var(--sidebar-text);
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
  }

  .download-segment__slider {
    width: 100%;
    height: 6px;
    background-color: var(--sidebar-surface);
    border-radius: 3px;
    appearance: none;
    cursor: pointer;
    accent-color: var(--sidebar-accent);
  }

  .download-segment__marks {
    display: flex;
    justify-content: space-between;
    font-size: 0.625rem;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
    padding: 0 2px;
  }

  /* ===== Modal Footer ===== */
  .download-modal__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: rgba(255, 255, 255, 0.02);
    flex-shrink: 0;
  }

  .download-modal__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    font-size: 0.8125rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .download-modal__btn--secondary {
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    color: var(--sidebar-text);
  }

  .download-modal__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .download-modal__btn--primary {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    padding: 0.625rem 1.5rem;
  }

  .download-modal__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .download-modal__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .download-modal__btn-spinner {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Modal Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.2s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.15s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* ===== Scale Transition (for search icon) ===== */
  .scale-enter-active,
  .scale-leave-active {
    transition: all 0.2s ease;
  }

  .scale-enter-from,
  .scale-leave-to {
    opacity: 0;
    transform: scale(0.5);
  }

  /* ===== Animations ===== */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
</style>
