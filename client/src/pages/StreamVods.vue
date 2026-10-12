<template>
  <PageLayout
    title="Download video"
    description="Download VODs from your favorite streaming platforms"
    :icon="Video"
  >
    <template #actions>
      <RecentSearchesMenu
        v-if="platformStore.getRecentSearches.length > 0"
        :searches="platformStore.getRecentSearches"
        :format-name="recentSearchName"
        @select="handleRecentSearchClick"
        @clear="platformStore.clearRecentSearches()"
      />
    </template>

    <template #toolbar>
      <div class="flex min-w-0 flex-1 items-center gap-2" data-tour-id="tour-vod-search">
        <StreamLinkInput
          v-model="searchInput"
          :platform="detectedPlatform"
          placeholder="Paste a stream link, mint ID or username…"
          :disabled="platformStore.loading"
          class="max-w-[520px] flex-1"
          @input="detectPlatform"
          @submit="handleSearch"
        />
        <Button variant="primary" :disabled="!searchInput || platformStore.loading" @click="handleSearch">
          <Loader2 v-if="platformStore.loading" class="animate-spin" />
          <Search v-else />
          Search
        </Button>
      </div>
      <SegmentedControl
        v-if="sourceTabs"
        :model-value="sourceTabs.value"
        :options="sourceTabs.options"
        @update:model-value="sourceTabs.select"
      />
    </template>

    <div class="flex flex-1 flex-col gap-4 px-5 py-4" data-tour-id="tour-vod-page">
      <Alert v-if="detectedPlatform === 'tokend' && platformStore.tokendCatalogMetadata">
        <Info />
        <div>
          <AlertTitle class="text-sm">{{ tokendModeLabel }}</AlertTitle>
          <AlertDescription class="text-xs text-fg-muted">
            {{ platformStore.tokendCatalogMetadata.note || 'Public creator catalog read.' }}
            Tokend media download grants are not available.
          </AlertDescription>
        </div>
      </Alert>

      <!-- First load only: tab switches and "load more" keep the current results -->
      <div
        v-if="platformStore.loading && platformStore.clips.length === 0"
        class="card-grid"
        aria-busy="true"
      >
        <VodCard v-for="i in 8" :key="i" skeleton />
      </div>

      <!-- Error -->
      <EmptyState
        v-else-if="platformStore.error"
        :icon="AlertTriangle"
        tone="danger"
        title="Couldn't load VODs"
        :description="platformStore.error"
      >
        <Button variant="secondary" @click="handleSearch">
          <RotateCcw />
          Try again
        </Button>
      </EmptyState>

      <!-- Results -->
      <section v-else-if="platformStore.clips.length > 0" class="flex flex-col gap-3">
        <SectionHeader
          title="Results"
          :count="platformStore.clips.length"
          :description="displayTotalPages > 1 ? `Page ${currentPage} of ${displayTotalPages}` : undefined"
        >
          <template v-if="selectedVodIds.size > 0 && detectedPlatform !== 'tokend'">
            <span class="tabular mr-1 text-xs text-fg-muted">{{ selectedVodIds.size }} selected</span>
            <Button variant="ghost" size="sm" @click="clearSelection">Clear</Button>
            <Button variant="secondary" size="sm" @click="downloadSelectedVods">
              <Download />
              Download selected
            </Button>
          </template>
        </SectionHeader>

        <!-- Keyed by the first result so a new search, tab or page eases in -->
        <div
          :key="paginatedClips[0]?.clipId"
          class="card-grid animate-fade-in"
        >
          <VodCard
            v-for="clip in paginatedClips"
            :key="clip.clipId"
            :title="clip.title"
            :thumbnail-url="clip.thumbnailUrl"
            :platform="detectedPlatform"
            :duration="clip.duration !== undefined && clip.duration > 0 ? formatDuration(clip.duration) : null"
            :meta="[clip.uploader, clip.createdAt ? formatRelativeTime(clip.createdAt) : 'No timestamp']"
            :meta-title="clip.createdAt ? formatAbsoluteDate(clip.createdAt, true) : undefined"
            :selectable="detectedPlatform !== 'tokend'"
            :selected="selectedVodIds.has(clip.clipId)"
            :downloaded="isVodAlreadyDownloaded(clip.clipId)"
            :download-disabled="detectedPlatform === 'tokend'"
            :download-label="detectedPlatform === 'tokend' ? 'Tokend downloads are unavailable' : 'Download'"
            @click="handleClipClick(clip)"
            @toggle-select="toggleVodSelection(clip)"
            @download="handleDownloadClip(clip)"
          />
        </div>
      </section>

      <!-- Empty -->
      <EmptyState
        v-else
        :icon="Video"
        title="Find VODs to download"
        description="Paste a stream link, mint ID or channel name above to browse past broadcasts."
      >
        <div class="flex items-center gap-1.5" aria-label="Supported platforms">
          <PlatformLogo v-for="platform in supportedVodPlatforms" :key="platform" :platform="platform" size="md" />
        </div>
      </EmptyState>
    </div>

    <!-- Pagination -->
    <PaginationFooter
      v-if="platformStore.clips.length > 0"
      :current-page="currentPage"
      :total-pages="displayTotalPages"
      :total-items="platformStore.clips.length"
      item-label="VOD"
      @go-to-page="goToPage"
      @previous="previousPage"
      @next="nextPage"
    />

    <!-- Download options -->
    <Modal
      :open="showDownloadDialog"
      :title="
        isProcessingQueue ? `Download options (${currentQueueIndex + 1}/${downloadQueue.length})` : 'Download options'
      "
      description="Choose which part of the VOD to download."
      :icon="Download"
      size="lg"
      :dismissible="!downloadStarting"
      :hide-close="downloadStarting"
      @close="closeDownloadDialog()"
    >
      <div class="flex flex-col gap-5">
        <!-- VOD preview -->
        <div class="flex items-center gap-3">
          <div class="grid aspect-video w-28 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-sunken">
            <img v-if="clipToDownload?.thumbnailUrl" :src="clipToDownload.thumbnailUrl" alt="" class="size-full object-cover" />
            <Video v-else class="size-6 text-fg-disabled" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="line-clamp-2 text-sm font-medium text-fg">{{ clipToDownload?.title }}</h3>
            <p class="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-fg-muted">
              <span class="tabular inline-flex items-center gap-1">
                <Clock class="size-3" />
                {{ formatDuration(clipToDownload?.duration) }}
              </span>
              <span class="text-fg-disabled">·</span>
              <span>
                {{ clipToDownload?.createdAt ? formatAbsoluteDate(clipToDownload?.createdAt, true) : 'No timestamp' }}
              </span>
              <template v-if="clipToDownload?.createdAt">
                <span class="text-fg-disabled">·</span>
                <span>{{ formatRelativeTime(clipToDownload?.createdAt) }}</span>
              </template>
            </p>
          </div>
        </div>

        <!-- Time range -->
        <Field label="Range">
          <template #label-end>
            <Badge :variant="isFullStreamSelected ? 'brand' : 'neutral'" class="tabular">
              {{ isFullStreamSelected ? 'Full stream' : formatDuration(selectedDuration) }}
            </Badge>
          </template>
          <TimeRangePicker
            v-model="selectedTimeRange"
            :total-duration="clipToDownload?.duration || 0"
            @change="handleTimeRangeChange"
          />
          <Button v-if="!isFullStreamSelected" variant="link" size="xs" class="self-start" @click="resetToFullStream">
            <RotateCcw />
            Reset to full stream
          </Button>
        </Field>

        <!-- Auto-segment -->
        <div v-if="selectedDuration > 900" class="flex flex-col gap-3 border-t border-line-subtle pt-4">
          <div class="flex items-center justify-between gap-3">
            <label class="flex cursor-pointer items-center gap-2 text-sm text-fg">
              <Checkbox v-model="autoSegment" />
              Auto-segment into parts
            </label>
            <Badge v-if="autoSegment" variant="brand" class="tabular">~{{ estimatedParts }} parts</Badge>
          </div>
          <div v-if="autoSegment" class="flex flex-col gap-1 pl-6">
            <div class="flex items-center justify-between text-xs">
              <span class="text-fg-muted">Part duration</span>
              <span class="tabular font-medium text-fg">{{ autoSegmentDuration }} min</span>
            </div>
            <input v-model.number="autoSegmentDuration" type="range" min="15" max="60" step="5" class="w-full" />
            <div class="tabular flex justify-between text-2xs text-fg-subtle">
              <span>15m</span>
              <span>30m</span>
              <span>45m</span>
              <span>60m</span>
            </div>
          </div>
        </div>

        <!-- Creator clip defaults (local user profiles only; eligibility set when dialog opens) -->
        <Field v-if="clipDefaultsEligible" label="Creator layout">
          <label class="flex cursor-pointer items-center gap-2 text-sm text-fg">
            <Checkbox v-model="useCreatorLayout" />
            Use creator layout
          </label>
          <p class="text-xs text-fg-subtle">
            Apply framing, overlays, and subtitle defaults from this creator's profile for this VOD.
          </p>
        </Field>
      </div>

      <template #footer>
        <Button variant="ghost" :disabled="downloadStarting" @click="closeDownloadDialog()">Cancel</Button>
        <Button
          variant="primary"
          :loading="downloadStarting"
          :disabled="selectedTimeRange.endTime <= selectedTimeRange.startTime"
          @click="downloadClipConfirmed"
        >
          <Download v-if="!downloadStarting" />
          {{ downloadStarting ? 'Starting…' : 'Start download' }}
        </Button>
      </template>
    </Modal>

    <!-- Auth Modal -->
    <AuthModal v-model="showAuthModal" />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { formatDate, formatDateTime } from '@/utils/dateTimeUtils';
  import PageLayout from '@/components/PageLayout.vue';
  import TimeRangePicker from '@/components/TimeRangePicker.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import { usePlatformStore, type PlatformClip, type RecentSearch } from '@/stores/platform';
  import { platformConfigs, type PlatformId } from '@/config/platforms';
  import { extractMintId } from '@/services/pumpfun';
  import { extractChannelSlug } from '@/services/kick';
  import { extractRumbleChannel } from '@/services/rumble';
  import { extractYouTubeChannel } from '@/services/youtube';
  import { useToast } from '@/composables/useToast';
  import { useDownloads } from '@/composables/useDownloads';
  import { getNextSegmentNumber, getDownloadedVodIds } from '@/services/database';
  import { Clock, AlertTriangle, Download, Video, Search, Loader2, RotateCcw, Info } from 'lucide-vue-next';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Modal } from '@/components/ui/modal';
  import { PlatformLogo } from '@/components/ui/platform-logo';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import RecentSearchesMenu from '@/components/streams/RecentSearchesMenu.vue';
  import StreamLinkInput from '@/components/streams/StreamLinkInput.vue';
  import VodCard from '@/components/streams/VodCard.vue';
  import {
    getCreatorProfileByPlatformId,
    type CreatorProfileWithLinks,
  } from '@/services/database';
  import { parseCreatorClipBuildDefaults } from '@/composables/useCreatorClipDefaults';
  import { useSubscriptionGate } from '@/composables/useSubscriptionGate';
  import { useAppTour } from '@/composables/useAppTour';
  import { useAuthStore } from '@/stores/auth';
  import { fetchTokendCapabilities, TOKEND_UNAVAILABLE_MESSAGES } from '@/services/tokend';
  import { canAccessTokend } from '@/utils/tokendAccess';

  const router = useRouter();
  const { gates } = useSubscriptionGate();
  const { maybeStartPageTour } = useAppTour();
  const route = useRoute();
  const { success, error: showError, warning } = useToast();
  const { startDownload } = useDownloads();
  const platformStore = usePlatformStore();
  const authStore = useAuthStore();

  /** Map `?platform=` query values to PlatformId (handles org/API `youtube` vs app `YouTube`). */
  function normalizeVodRoutePlatform(raw: string): PlatformId | null {
    const key = raw.trim().toLowerCase();
    const map: Record<string, PlatformId> = {
      pumpfun: 'pumpfun',
      kick: 'kick',
      twitch: 'twitch',
      youtube: 'YouTube',
      rumble: 'rumble',
      twitter: 'twitter',
      tokend: 'tokend',
    };
    const platform = map[key] ?? null;
    if (platform === 'tokend' && !canAccessTokend(authStore.user)) return null;
    return platform;
  }

  /** Read deep-link search from route so first paint already shows creator + loading. */
  function readPendingRouteSearch(): { platform: PlatformId; search: string } | null {
    const rawPlatform = route.query.platform;
    const queryPlatform = (
      Array.isArray(rawPlatform) ? rawPlatform[0] : rawPlatform
    ) as string | undefined;
    const rawSearch = route.query.search ?? route.query.id;
    const querySearch = (Array.isArray(rawSearch) ? rawSearch[0] : rawSearch) as string | undefined;

    if (!queryPlatform || !querySearch) return null;
    const platform = normalizeVodRoutePlatform(queryPlatform);
    if (!platform) return null;
    return { platform, search: querySearch };
  }

  const pendingRouteSearch = readPendingRouteSearch();

  // Component state — seed from route query so View VODs isn't a blank page
  const searchInput = ref(pendingRouteSearch?.search ?? '');
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
  const loadingNextYouTubePage = ref(false);
  const showAuthModal = ref(false);

  /** Local creator profile has saved clip_build_defaults (user-side SQLite only). */
  const clipDefaultsEligible = ref(false);
  /** User opted in to seed active_vod_preset_config from that profile on this download. */
  const useCreatorLayout = ref(false);

  // Multi-selection state
  const selectedVodIds = ref<Set<string>>(new Set());
  const downloadQueue = ref<PlatformClip[]>([]);
  const currentQueueIndex = ref(0);
  const isProcessingQueue = ref(false);

  // Downloaded VODs tracking
  const downloadedVodIds = ref<Set<string>>(new Set());

  // Auto-detected platform from input
  const detectedPlatform = ref<PlatformId | null>(pendingRouteSearch?.platform ?? null);
  const currentPlatformConfig = computed(() => platformConfigs[detectedPlatform.value || platformStore.activePlatform]);
  const tokendModeLabel = computed(() => {
    const mode = platformStore.tokendCatalogMetadata?.mode;
    if (mode === 'mock') return 'Mock fixture catalog';
    if (mode === 'local') return 'Local Tokend catalog';
    return 'Tokend live public catalog';
  });

  // Show searching UI immediately when arriving via creator "View VODs"
  if (pendingRouteSearch) {
    platformStore.setLoading(true);
  }
  
  // YouTube tab state (Live Streams vs Videos)
  const youtubeTab = ref<'streams' | 'videos'>('streams');
  
  // Rumble tab state (Live Streams vs Videos)
  const rumbleTab = ref<'streams' | 'videos'>('streams');

  // Tokend tab state (Streams vs Videos)
  const tokendTab = ref<'streams' | 'videos'>('streams');

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
      detectedPlatform.value = 'YouTube';
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

    // Check for Rumble
    if (lowerVal.includes('rumble.com')) {
      detectedPlatform.value = 'rumble';
      return;
    }

    // Check for Tokend creator URLs (tokend.tv or local web :4100)
    if (
      canAccessTokend(authStore.user) &&
      (lowerVal.includes('tokend.tv') ||
        lowerVal.includes('localhost:4100') ||
        lowerVal.includes('127.0.0.1:4100'))
    ) {
      detectedPlatform.value = 'tokend';
      return;
    }

    // Check for X/Twitter (timeline post, broadcast, or space URL)
    if (
      (lowerVal.includes('twitter.com') || lowerVal.includes('x.com')) &&
      (lowerVal.includes('/i/broadcasts/') ||
        lowerVal.includes('/i/spaces/') ||
        /\/status(?:es)?\/\d+/i.test(lowerVal))
    ) {
      detectedPlatform.value = 'twitter';
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

  // Load downloaded VOD IDs
  async function loadDownloadedVodIds() {
    try {
      downloadedVodIds.value = await getDownloadedVodIds();
    } catch (error) {
      console.error('[StreamVods] Failed to load downloaded VOD IDs:', error);
    }
  }

  // Check if a VOD is downloaded
  function isVodAlreadyDownloaded(clipId: string): boolean {
    return downloadedVodIds.value.has(clipId);
  }

  // Reload downloaded VODs when window regains focus (user returns from Projects page)
  function handleWindowFocus() {
    loadDownloadedVodIds();
  }

  // Initialize
  onMounted(async () => {
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('focus', handleWindowFocus);
    
    // Clean up any audio platform searches (YouTube/Twitter) from VOD recent searches
    // These were incorrectly added before the fix
    platformStore.cleanupAudioSearchesFromVodList();

    // Deep-linked search (View VODs): start immediately — don't wait on metadata refresh
    if (pendingRouteSearch) {
      // Clear query params from URL to prevent re-search on navigation
      router.replace({ path: route.path, query: {} });

      void platformStore.refreshRecentSearchMetadata();
      void loadDownloadedVodIds();
      await handleSearch();
      maybeStartPageTour('page_vods');
      return;
    }

    await platformStore.refreshRecentSearchMetadata();
    await loadDownloadedVodIds();
    detectPlatform();
    maybeStartPageTour('page_vods');

    // Restore platform state if clips are already loaded (e.g., returning from another page)
    if (platformStore.clips.length > 0) {
      detectedPlatform.value = platformStore.activePlatform;
      // Restore the search input to show what's currently loaded
      if (platformStore.currentSearchId) {
        // Clean up the display for Rumble and YouTube
        let displayValue = platformStore.currentSearchId;
        if (platformStore.activePlatform === 'rumble') {
          displayValue = displayValue.replace(/^(c\/|user\/)/, '');
        } else if (platformStore.activePlatform === 'YouTube') {
          displayValue = displayValue.replace(/^@/, '');
        }
        searchInput.value = displayValue;
      }
    }
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('focus', handleWindowFocus);
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

  const supportedVodPlatforms = ['pumpfun', 'kick', 'twitch', 'YouTube', 'rumble', 'twitter'];

  /** Primary label for a recent search row. */
  function recentSearchName(search: RecentSearch): string {
    return search.symbol || search.label || getCleanChannelName(search.id, search.platform);
  }

  type SourceTab = 'streams' | 'videos';
  /** Live streams / Videos switch for platforms that split their catalog (YouTube, Rumble, Tokend). */
  const sourceTabs = computed(() => {
    if (!(platformStore.clips.length > 0 || platformStore.loading)) return null;
    const disabled = platformStore.loading;
    const tabs = (streamsLabel: string): SegmentedOption<SourceTab>[] => [
      { value: 'streams', label: streamsLabel, disabled },
      { value: 'videos', label: 'Videos', disabled },
    ];
    if (detectedPlatform.value === 'YouTube') {
      return { value: youtubeTab.value, options: tabs('Live streams'), select: switchYouTubeTab };
    }
    if (detectedPlatform.value === 'rumble') {
      return { value: rumbleTab.value, options: tabs('Live streams'), select: switchRumbleTab };
    }
    if (detectedPlatform.value === 'tokend') {
      return { value: tokendTab.value, options: tabs('Streams'), select: switchTokendTab };
    }
    return null;
  });

  function getCleanChannelName(id: string, platform: PlatformId): string {
    // Clean up channel names for display
    if (platform === 'rumble') {
      // Remove 'c/' or 'user/' prefix from Rumble channels
      if (id.startsWith('c/')) {
        return id.substring(2);
      }
      if (id.startsWith('user/')) {
        return id.substring(5);
      }
    }
    if (platform === 'YouTube') {
      // Remove '@' prefix from YouTube handles if present
      if (id.startsWith('@')) {
        return id.substring(1);
      }
    }
    return truncateId(id);
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
    return includeTime ? formatDateTime(date) : formatDate(date);
  }

  // Pagination
  const totalPages = computed(() => Math.ceil(platformStore.clips.length / clipsPerPage));
  const canLoadMoreYouTubePages = computed(() => {
    return detectedPlatform.value === 'YouTube' && platformStore.hasMore;
  });
  const displayTotalPages = computed(() => {
    return totalPages.value + (canLoadMoreYouTubePages.value ? 1 : 0);
  });
  const paginatedClips = computed(() => {
    const start = (currentPage.value - 1) * clipsPerPage;
    return platformStore.clips.slice(start, start + clipsPerPage);
  });

  function goToPage(page: number) {
    if (page < 1 || page > displayTotalPages.value) return;

    if (page <= totalPages.value) {
      currentPage.value = page;
      return;
    }

    void loadNextYouTubePage();
  }
  async function nextPage() {
    if (currentPage.value < totalPages.value) {
      currentPage.value++;
      return;
    }

    if (canLoadMoreYouTubePages.value) {
      await loadNextYouTubePage();
    }
  }
  function previousPage() {
    if (currentPage.value > 1) currentPage.value--;
  }

  async function loadNextYouTubePage() {
    if (
      loadingNextYouTubePage.value ||
      platformStore.loading ||
      detectedPlatform.value !== 'YouTube' ||
      !platformStore.hasMore ||
      !platformStore.currentSearchId
    ) {
      return;
    }

    loadingNextYouTubePage.value = true;

    try {
      const result = await platformStore.loadMoreYouTubeClips(platformStore.currentSearchId, clipsPerPage, youtubeTab.value);

      if (result.success) {
        if (result.added > 0) {
          currentPage.value = totalPages.value;
          await loadDownloadedVodIds();
          success('More VODs Loaded', `Loaded ${result.added} more VOD${result.added !== 1 ? 's' : ''}`);
        } else {
          platformStore.hasMore = false;
          success('End of Videos', 'No more YouTube videos found for this channel');
        }
      } else {
        showError('Search Failed', result.error || 'Failed to fetch more YouTube videos');
      }
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      loadingNextYouTubePage.value = false;
    }
  }

  watch(
    () => platformStore.clips,
    (newClips, oldClips) => {
      const isAppendingClips =
        oldClips.length > 0 &&
        newClips.length > oldClips.length &&
        oldClips.every((clip, index) => clip.clipId === newClips[index]?.clipId);

      if (isAppendingClips) return;

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

  // Switch YouTube tab and refetch content
  async function switchYouTubeTab(tab: 'streams' | 'videos') {
    if (youtubeTab.value === tab || platformStore.loading) return;
    
    console.log('[StreamVods] Switching YouTube tab to:', tab);
    youtubeTab.value = tab;
    
    // Refetch with the new tab
    const input = searchInput.value.trim();
    if (input && detectedPlatform.value === 'YouTube') {
      // Ensure platform is set before searching
      platformStore.setActivePlatform('YouTube');
      
      try {
        console.log('[StreamVods] Calling searchClips with tab:', youtubeTab.value);
        const result = await platformStore.searchClips(input, 20, youtubeTab.value);
        if (result.success) {
          await loadDownloadedVodIds();
          if (result.total === 0) {
            showError('No Content Found', `No ${tab === 'streams' ? 'live streams' : 'videos'} found for this channel`);
          } else if ('fallbackUsed' in result && result.fallbackUsed && result.actualTab) {
            success('Content Found', `No ${tab} found, showing ${result.actualTab} instead (${result.total} found)`);
          }
        } else {
          showError('Search Failed', result.error || 'Failed to fetch content');
        }
      } catch (err) {
        showError('Error', err instanceof Error ? err.message : 'An unexpected error occurred');
      }
    }
  }

  // Switch Rumble tab and refetch content
  async function switchRumbleTab(tab: 'streams' | 'videos') {
    if (rumbleTab.value === tab || platformStore.loading) return;
    
    console.log('[StreamVods] Switching Rumble tab to:', tab);
    rumbleTab.value = tab;
    
    // Refetch with the new tab
    const input = searchInput.value.trim();
    if (input && detectedPlatform.value === 'rumble') {
      // Ensure platform is set before searching
      platformStore.setActivePlatform('rumble');
      
      try {
        console.log('[StreamVods] Calling searchClips with tab:', rumbleTab.value);
        const result = await platformStore.searchClips(input, 20, rumbleTab.value);
        if (result.success) {
          await loadDownloadedVodIds();
          if (result.total === 0) {
            showError('No Content Found', `No ${tab === 'streams' ? 'live streams' : 'videos'} found for this channel`);
          } else if ('fallbackUsed' in result && result.fallbackUsed && result.actualTab) {
            success('Content Found', `No ${tab} found, showing ${result.actualTab} instead (${result.total} found)`);
          }
        } else {
          showError('Search Failed', result.error || 'Failed to fetch content');
        }
      } catch (err) {
        showError('Error', err instanceof Error ? err.message : 'An unexpected error occurred');
      }
    }
  }

  async function switchTokendTab(tab: 'streams' | 'videos') {
    if (tokendTab.value === tab || platformStore.loading) return;
    tokendTab.value = tab;
    const input = searchInput.value.trim();
    if (!input || detectedPlatform.value !== 'tokend') return;
    platformStore.setActivePlatform('tokend');
    try {
      const result = await platformStore.searchClips(input, 20, tokendTab.value);
      if (result.success) {
        await loadDownloadedVodIds();
        if (result.total === 0) {
          showError('No Content Found', `No ${tab} found for this Tokend creator`);
        } else if ('fallbackUsed' in result && result.fallbackUsed && result.actualTab) {
          success('Content Found', `No ${tab} found, showing ${result.actualTab} instead (${result.total} found)`);
        }
      } else {
        showError('Search Failed', result.error || 'Failed to fetch Tokend catalog');
      }
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }

  async function handleSearch() {
    const input = searchInput.value.trim();
    if (!input) {
      platformStore.setLoading(false);
      showError('Invalid Input', 'Please enter a stream link, mint ID, or username');
      return;
    }

    // Check if user is authenticated
    if (!authStore.isAuthenticated) {
      platformStore.setLoading(false);
      showAuthModal.value = true;
      return;
    }

    // Only auto-detect platform if not already explicitly set (e.g., from query params or recent search)
    if (!detectedPlatform.value) {
      detectPlatform();
    }

    if (!detectedPlatform.value) {
      platformStore.setLoading(false);
      showError(
        'Unknown Platform',
        'Could not detect the platform. Please enter a valid link or username from PumpFun, Kick, Twitch, YouTube, Rumble, or X/Twitter (post, broadcast, or space URL).'
      );
      return;
    }

    // Check if platform is coming soon
    const config = platformConfigs[detectedPlatform.value];
    if (config.isComingSoon) {
      platformStore.setLoading(false);
      showError(
        `${config.name} Coming Soon`,
        config.comingSoonMessage || `${config.name} integration is not yet available.`
      );
      return;
    }

    // Reset Rumble / Tokend tabs to streams (default) when doing a new search
    if (detectedPlatform.value === 'rumble') {
      rumbleTab.value = 'streams';
    }
    if (detectedPlatform.value === 'tokend') {
      tokendTab.value = 'streams';
    }

    // Set the active platform in the store
    platformStore.setActivePlatform(detectedPlatform.value);

    try {
      // Pass tab parameter for YouTube, Rumble, and Tokend
      const tabParam = detectedPlatform.value === 'YouTube' ? youtubeTab.value 
                     : detectedPlatform.value === 'rumble' ? rumbleTab.value
                     : detectedPlatform.value === 'tokend' ? tokendTab.value
                     : undefined;
      const result = await platformStore.searchClips(input, 20, tabParam);
      if (result.success) {
        // Reload downloaded VOD IDs after search to ensure we have latest data
        await loadDownloadedVodIds();
        
        if (result.total === 0) {
          showError('No VODs Found', 'No available VODs found for this search');
        } else if ('fallbackUsed' in result && result.fallbackUsed && result.actualTab && tabParam) {
          success('Content Found', `No ${tabParam} found, showing ${result.actualTab} instead (${result.total} found)`);
        } else if ('warning' in result && result.warning && typeof result.warning === 'string') {
          // Show warning for partial success (e.g., Twitter metadata fetch failed)
          warning('VOD Available', result.warning);
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
    if (detectedPlatform.value === 'tokend') {
      const capabilities = await fetchTokendCapabilities().catch(() => null);
      if (!capabilities?.download) {
        showError('Tokend Download Unavailable', TOKEND_UNAVAILABLE_MESSAGES.download);
        return;
      }
    }

    clipToDownload.value = clip;
    selectedTimeRange.value = { startTime: 0, endTime: clip.duration || 0 };
    // Default auto-segment off, user can enable if they want to split
    autoSegment.value = false;
    useCreatorLayout.value = false;
    clipDefaultsEligible.value = false;
    if (detectedPlatform.value && platformStore.currentSearchId) {
      try {
        const lp = await getCreatorProfileByPlatformId(
          detectedPlatform.value as any,
          platformStore.currentSearchId
        );
        clipDefaultsEligible.value = !!parseCreatorClipBuildDefaults(lp?.clip_build_defaults ?? null);
      } catch {
        clipDefaultsEligible.value = false;
      }
    }
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

  function toggleVodSelection(clip: PlatformClip) {
    if (selectedVodIds.value.has(clip.clipId)) {
      selectedVodIds.value.delete(clip.clipId);
    } else {
      selectedVodIds.value.add(clip.clipId);
    }
    // Force reactivity update
    selectedVodIds.value = new Set(selectedVodIds.value);
  }

  function clearSelection() {
    selectedVodIds.value.clear();
  }

  async function downloadSelectedVods() {
    if (detectedPlatform.value === 'tokend') {
      const capabilities = await fetchTokendCapabilities().catch(() => null);
      if (!capabilities?.download) {
        showError('Tokend Download Unavailable', TOKEND_UNAVAILABLE_MESSAGES.download);
        return;
      }
    }

    const selectedClips = platformStore.clips.filter(clip => selectedVodIds.value.has(clip.clipId));
    if (selectedClips.length === 0) return;
    
    downloadQueue.value = selectedClips;
    currentQueueIndex.value = 0;
    isProcessingQueue.value = true;
    
    // Start with first VOD in queue
    await handleDownloadClip(downloadQueue.value[0]);
  }

  async function downloadClipConfirmed() {
    if (!clipToDownload.value || !currentPlatformConfig.value) return;
    if (detectedPlatform.value === 'tokend') {
      const capabilities = await fetchTokendCapabilities().catch(() => null);
      if (!capabilities?.download) {
        showError('Tokend Download Unavailable', TOKEND_UNAVAILABLE_MESSAGES.download);
        closeDownloadDialog();
        return;
      }
    }

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
      let localCreatorProfile: CreatorProfileWithLinks | null = null;
      if (detectedPlatform.value && platformStore.currentSearchId) {
        console.log('[StreamVods] Looking up creator watermark for:', {
          platform: detectedPlatform.value,
          platformId: platformStore.currentSearchId,
        });

        try {
          const {
            isOrgSuppliedAccount,
            resolveOrgBuildBranding,
            profileToDownloadWatermarkSettings,
          } = await import('@/composables/useBrandingProfileSelection');

          const platformLabel =
            detectedPlatform.value === 'kick'
              ? 'Kick'
              : detectedPlatform.value === 'twitch'
                ? 'Twitch'
                : detectedPlatform.value === 'YouTube'
                  ? 'YouTube'
                  : detectedPlatform.value === 'pumpfun'
                    ? 'PumpFun'
                    : detectedPlatform.value === 'rumble'
                      ? 'Rumble'
                      : detectedPlatform.value === 'twitter'
                        ? 'Twitter'
                        : detectedPlatform.value;

          if (isOrgSuppliedAccount()) {
            const orgId = authStore.user?.created_by_organization_id;
            if (orgId != null) {
              const orgProfile = await resolveOrgBuildBranding(Number(orgId), '', {
                platform: platformLabel,
                platformId: platformStore.currentSearchId,
              });
              if (orgProfile) {
                creatorWatermarkSettings = profileToDownloadWatermarkSettings(orgProfile);
                console.log('[StreamVods] Org-supplied account watermark:', orgProfile.name);
              }
            }
          } else {
            localCreatorProfile = await getCreatorProfileByPlatformId(
              detectedPlatform.value as any,
              platformStore.currentSearchId
            );
            if (localCreatorProfile?.watermark_id && localCreatorProfile?.watermark_settings) {
              console.log('[StreamVods] Found local creator profile with watermark:', localCreatorProfile.name);
              creatorWatermarkSettings = {
                watermarkId: localCreatorProfile.watermark_id,
                watermarkSettings: localCreatorProfile.watermark_settings,
              };
            }
          }
        } catch (err) {
          console.log('[StreamVods] Could not fetch creator profile for watermark:', err);
        }
      }

      const clipDefaultsParsed = parseCreatorClipBuildDefaults(localCreatorProfile?.clip_build_defaults ?? null);
      const applyLayout =
        useCreatorLayout.value && !!clipDefaultsParsed && !!localCreatorProfile?.id;

      await startDownload(
        clip.title,
        videoUrl,
        platformStore.currentSearchId,
        selectedTimeRange.value.startTime > 0 || selectedTimeRange.value.endTime < clip.duration!
          ? {
              startTime: selectedTimeRange.value.startTime,
              endTime: selectedTimeRange.value.endTime,
            }
          : undefined,
        clip.clipId,
        clip.duration,
        {
          autoSegment: autoSegment.value,
          segmentDuration: autoSegmentDuration.value * 60,
          provider: detectedPlatform.value === 'kick' ? 'kick' : detectedPlatform.value === 'twitch' ? 'twitch' : detectedPlatform.value === 'YouTube' ? 'YouTube' : detectedPlatform.value === 'rumble' ? 'rumble' : detectedPlatform.value === 'twitter' ? 'twitter' : 'pumpfun',
          creatorWatermarkSettings,
          creatorProfileId: applyLayout ? localCreatorProfile!.id : undefined,
          applyCreatorClipLayout: applyLayout,
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

      // Check if we're processing a queue
      if (isProcessingQueue.value && downloadQueue.value.length > 0) {
        currentQueueIndex.value++;
        
        // If there are more VODs in queue, show next dialog
        if (currentQueueIndex.value < downloadQueue.value.length) {
          setTimeout(() => {
            downloadStarting.value = false;
            handleDownloadClip(downloadQueue.value[currentQueueIndex.value]);
          }, 500);
        } else {
          // Queue complete - navigate to projects and cleanup
          setTimeout(() => {
            downloadStarting.value = false;
            isProcessingQueue.value = false;
            downloadQueue.value = [];
            currentQueueIndex.value = 0;
            clearSelection();
            router.push('/projects');
          }, 500);
        }
      } else {
        // Single download - navigate immediately
        setTimeout(() => {
          downloadStarting.value = false;
          router.push('/projects');
        }, 500);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      // Check if this is a free tier limit error
      if (errorMessage.includes('Daily download limit reached')) {
        // Show subscription gate instead of error toast
        gates.download(`Download "${clip.title}"`);
      } else {
        showError('Download Failed', `Failed to download "${clip.title}": ${errorMessage}`);
      }
      
      downloadStarting.value = false;
      closeDownloadDialog();
      
      // If queue processing failed, cleanup
      if (isProcessingQueue.value) {
        isProcessingQueue.value = false;
        downloadQueue.value = [];
        currentQueueIndex.value = 0;
      }
    }
  }
</script>
