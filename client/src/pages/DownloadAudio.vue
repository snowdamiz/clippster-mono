<template>
  <div class="streamvods">
    <PageLayout
      title="Download Audio"
      description="Download audio from YouTube"
      :show-header="true"
      :icon="Headphones"
    >
      <template #actions>
        <div class="streamvods-actions">
          <!-- Recent Searches Dropdown -->
          <div class="streamvods-recent" v-if="platformStore.getAudioRecentSearches?.length > 0">
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
                v-for="search in platformStore.getAudioRecentSearches.slice(0, 15)"
                :key="`${search.platform}-${search.id}`"
                class="streamvods-recent__item"
                @click="handleRecentSearchClick(search); showRecentDropdown = false;"
              >
                <div class="streamvods-recent__avatar">
                  <div class="streamvods-recent__avatar-img">
                    <img v-if="search.imageUrl" :src="search.imageUrl" />
                    <Clock v-else class="streamvods-recent__avatar-fallback" />
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
                    <template v-else>{{ getCleanChannelName(search.id, search.platform) }}</template>
                  </span>
                  <span class="streamvods-recent__detail">
                    <template v-if="search.name">{{ search.name }}</template>
                    <template v-else>{{ search.displayText }}</template>
                  </span>
                </div>
              </div>
              <button
                @click="platformStore.clearAudioRecentSearches(); showRecentDropdown = false;"
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
                v-if="detectedPlatform === 'YouTube'"
                class="streamvods-search__platform streamvods-search__platform--youtube"
                key="yt"
              >
                <img src="/youtube.svg" class="streamvods-search__platform-icon" />
              </div>
              <!-- X Spaces download temporarily disabled
              <div
                v-else-if="detectedPlatform === 'twitter'"
                class="streamvods-search__platform streamvods-search__platform--twitter"
                key="twitter"
              >
                <img src="/x.svg" class="streamvods-search__platform-icon" />
              </div>
              -->
              <Search v-else class="streamvods-search__icon" key="search" />
            </transition>
            <input
              v-model="searchInput"
              class="streamvods-search__input"
              placeholder="Paste a YouTube URL..."
              :disabled="isSearching"
              @input="detectPlatform"
              @keyup.enter="handleSearch"
            />
          </div>
          <button class="streamvods-search-btn" :disabled="!searchInput || isSearching" @click="handleSearch">
            <Loader2
              v-if="isSearching"
              class="streamvods-search-btn__icon streamvods-search-btn__icon--spin"
            />
            <Search v-else class="streamvods-search-btn__icon" />
            Search
          </button>
        </div>
      </template>

      <div
        class="streamvods__content"
        :class="{ 'streamvods__content--empty': clips.length === 0 && !isSearching }"
      >
        <!-- Page Heading -->
        <div v-if="clips.length > 0 || isSearching" class="streamvods__heading">
          <h1 class="streamvods__title">Download Audio</h1>
          <p class="streamvods__subtitle">Download MP3 audio from YouTube</p>
        </div>

        <!-- Loading State -->
        <div v-if="isSearching" class="streamvods__loading">
          <div class="streamvods__section-header">
            <div class="streamvods__section-header-left">
              <div class="streamvods__section-icon">
                <Headphones />
              </div>
              <div class="streamvods__section-text">
                <h2 class="streamvods__section-title">Loading Audio</h2>
                <p class="streamvods__section-subtitle">Fetching audio content...</p>
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
        <div v-else-if="searchError" class="streamvods__error">
          <div class="streamvods__error-icon">
            <AlertTriangle />
          </div>
          <h3 class="streamvods__error-title">Error</h3>
          <p class="streamvods__error-message">{{ searchError }}</p>
          <button @click="handleSearch" class="streamvods__error-btn">Try Again</button>
        </div>

        <!-- Results Grid -->
        <div v-else-if="clips.length > 0" class="streamvods__results">
          <div class="streamvods__results-count">
            {{ clips.length }} {{ clips.length === 1 ? 'item' : 'items' }}
          </div>

          <!-- Bulk Actions Bar -->
          <div v-if="selectedIds.size > 0" class="streamvods__bulk-actions">
            <span class="streamvods__bulk-count">{{ selectedIds.size }} selected</span>
            <div class="streamvods__bulk-buttons">
              <button @click="clearSelection" class="streamvods__bulk-btn streamvods__bulk-btn--secondary">
                Clear Selection
              </button>
              <button @click="downloadSelected" class="streamvods__bulk-btn streamvods__bulk-btn--primary">
                <Download :size="14" />
                Download Selected
              </button>
            </div>
          </div>

          <div class="streamvods__grid">
            <div
              v-for="clip in clips"
              :key="clip.clipId"
              class="vod-card"
              :class="{ 'vod-card--selected': selectedIds.has(clip.clipId) }"
              @click="handleClipClick(clip)"
            >
              <!-- Selection Checkbox -->
              <div
                class="vod-card__checkbox"
                :class="{ 'vod-card__checkbox--visible': selectedIds.has(clip.clipId) }"
                @click.stop="toggleSelection(clip)"
              >
                <div
                  class="vod-card__checkbox-inner"
                  :class="{ 'vod-card__checkbox-inner--checked': selectedIds.has(clip.clipId) }"
                >
                  <Check v-if="selectedIds.has(clip.clipId)" class="vod-card__checkbox-icon" />
                </div>
              </div>

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
                <span v-if="clip.duration && clip.duration > 0" class="vod-card__badge vod-card__badge--duration">
                  <Clock class="vod-card__badge-icon-svg" />
                  {{ formatDuration(clip.duration) }}
                </span>
              </div>

              <!-- Hover Actions -->
              <div class="vod-card__actions">
                <button class="vod-card__action-btn" title="Download Audio" @click.stop="handleDownloadClip(clip)">
                  <Download class="vod-card__action-icon" />
                </button>
              </div>

              <!-- Bottom Info Overlay -->
              <div class="vod-card__bottom">
                <h3 class="vod-card__name" :title="clip.title">{{ clip.title }}</h3>
                <div class="vod-card__meta">
                  <template v-if="clip.uploader">
                    <span>{{ clip.uploader }}</span>
                    <span class="vod-card__meta-dot"></span>
                  </template>
                  <span>{{ clip.createdAt ? formatAbsoluteDate(clip.createdAt) : 'No timestamp' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="streamvods__empty">
          <div class="streamvods__empty-icon-wrapper">
            <Headphones class="streamvods__empty-icon" />
          </div>
          <h3 class="streamvods__empty-title">Download Audio</h3>
          <p class="streamvods__empty-description">Paste a YouTube URL above to download audio</p>
        </div>
      </div>
    </PageLayout>

    <!-- Download Confirm Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDownloadDialog" class="download-modal__overlay" @click.self="showDownloadDialog = false">
          <Transition name="dialog" appear>
            <div class="download-modal">
              <div class="download-modal__accent"></div>
              <div class="download-modal__header">
                <button class="download-modal__close" @click="showDownloadDialog = false" title="Close">
                  <X :size="18" />
                </button>
                <div class="download-modal__icon">
                  <Download :size="24" />
                </div>
                <h2 class="download-modal__title">Download Audio</h2>
                <p class="download-modal__subtitle">Download as MP3 audio file</p>
              </div>
              <div class="download-modal__content">
                <div class="download-preview">
                  <div class="download-preview__thumb">
                    <img v-if="clipToDownload?.thumbnailUrl" :src="clipToDownload.thumbnailUrl" />
                    <div v-else class="download-preview__placeholder">
                      <Headphones :size="28" />
                    </div>
                  </div>
                  <div class="download-preview__info">
                    <h3 class="download-preview__title">{{ clipToDownload?.title }}</h3>
                    <div class="download-preview__meta">
                      <span v-if="clipToDownload?.duration" class="download-preview__duration">
                        <Clock :size="10" />
                        {{ formatDuration(clipToDownload?.duration) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="download-modal__footer">
                <button
                  class="download-modal__btn download-modal__btn--secondary"
                  @click="showDownloadDialog = false"
                  :disabled="downloadStarting"
                >
                  Cancel
                </button>
                <button
                  class="download-modal__btn download-modal__btn--primary"
                  @click="confirmDownload"
                  :disabled="downloadStarting"
                >
                  <Loader2 v-if="downloadStarting" :size="14" class="download-modal__btn-spinner" />
                  <span>{{ downloadStarting ? 'Starting...' : 'Download MP3' }}</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { formatDate } from '@/utils/dateTimeUtils';
  import PageLayout from '@/components/PageLayout.vue';
  import { usePlatformStore, type PlatformClip } from '@/stores/platform';
  import { useToast } from '@/composables/useToast';
  import { useAudioDownloads } from '@/composables/useAudioDownloads';
  import { Clock, ChevronDown, X, AlertTriangle, Download, Headphones, Search, Loader2, Check } from 'lucide-vue-next';
  import { type PlatformId } from '@/config/platforms';

  const route = useRoute();
  const router = useRouter();
  const { success, error: showError } = useToast();
  const { startYouTubeAudioDownload } = useAudioDownloads();
  const platformStore = usePlatformStore();

  // State
  const searchInput = ref('');
  const showRecentDropdown = ref(false);
  const isSearching = ref(false);
  const searchError = ref<string | null>(null);
  const clips = ref<PlatformClip[]>([]);
  const selectedIds = ref<Set<string>>(new Set());
  const showDownloadDialog = ref(false);
  const clipToDownload = ref<PlatformClip | null>(null);
  const downloadStarting = ref(false);
  const detectedPlatform = ref<'YouTube' | null>(null);

  function detectPlatform() {
    const val = searchInput.value?.trim().toLowerCase();
    if (!val) { detectedPlatform.value = null; return; }
    if (val.includes('youtube.com') || val.includes('youtu.be')) {
      detectedPlatform.value = 'YouTube';
      return;
    }
    // X Spaces (twitter/x.com) temporarily disabled — re-enable detection when shipping again
    detectedPlatform.value = null;
  }

  async function handleSearch() {
    const val = searchInput.value.trim();
    if (!val) { showError('Invalid Input', 'Please enter a YouTube URL'); return; }
    detectPlatform();
    if (!detectedPlatform.value) {
      const hint =
        /twitter\.com|x\.com/i.test(val)
          ? 'X Spaces downloads are temporarily unavailable. Use a YouTube URL.'
          : 'Please enter a valid YouTube URL';
      showError('Unknown Platform', hint);
      return;
    }
    isSearching.value = true;
    searchError.value = null;
    clips.value = [];
    try {
      // Use platformStore to search via yt-dlp
      platformStore.setActivePlatform(detectedPlatform.value as PlatformId);
      const result = await platformStore.searchClips(val, 20, undefined, true);
      if (result.success && platformStore.clips.length > 0) {
        clips.value = [...platformStore.clips];
        success('Found', `Found ${platformStore.clips.length} item${platformStore.clips.length !== 1 ? 's' : ''}`);
        
        // Add to audio recent searches (not regular recent searches)
        platformStore.addToAudioRecentSearches(
          platformStore.currentSearchId || val,
          val,
          detectedPlatform.value as PlatformId
        );
      } else if (result.success && platformStore.clips.length === 0) {
        searchError.value = 'No audio found for this URL';
      } else {
        searchError.value = result.error || 'Failed to fetch audio';
      }
    } catch (err) {
      searchError.value = err instanceof Error ? err.message : 'An unexpected error occurred';
    } finally {
      isSearching.value = false;
    }
  }

  function handleRecentSearchClick(search: { id: string; displayText: string; platform: PlatformId }) {
    searchInput.value = search.displayText;
    detectedPlatform.value = search.platform === 'YouTube' ? search.platform : null;
    handleSearch();
  }

  function handleClipClick(_clip: PlatformClip) {}

  function handleDownloadClip(clip: PlatformClip) {
    clipToDownload.value = clip;
    showDownloadDialog.value = true;
  }

  async function confirmDownload() {
    if (!clipToDownload.value) return;
    const clip = clipToDownload.value;
    downloadStarting.value = true;
    try {
      const downloadId = `audio-${Date.now()}`;
      const videoUrl = clip.mp4Url || clip.playlistUrl || clip.clipId;
      if (detectedPlatform.value !== 'YouTube') {
        showError('Not Available', 'X Spaces downloads are temporarily unavailable.');
        return;
      }
      await startYouTubeAudioDownload(downloadId, clip.title, videoUrl, platformStore.currentSearchId || 'unknown');
      success('Download Started', `Downloading audio: "${clip.title}"`);
      showDownloadDialog.value = false;
      setTimeout(() => router.push('/audio-library'), 500);
    } catch (err) {
      showError('Download Failed', err instanceof Error ? err.message : String(err));
    } finally {
      downloadStarting.value = false;
    }
  }

  function toggleSelection(clip: PlatformClip) {
    if (selectedIds.value.has(clip.clipId)) {
      selectedIds.value.delete(clip.clipId);
    } else {
      selectedIds.value.add(clip.clipId);
    }
    selectedIds.value = new Set(selectedIds.value);
  }

  function clearSelection() { selectedIds.value = new Set(); }

  async function downloadSelected() {
    const selected = clips.value.filter(c => selectedIds.value.has(c.clipId));
    for (const clip of selected) {
      await handleDownloadClip(clip);
    }
  }

  function getPlatformIcon(platform: string): string {
    const icons: Record<string, string> = {
      YouTube: '/youtube.svg', twitter: '/x.svg',
      pumpfun: '/capsule.svg', kick: '/kick.svg',
      twitch: '/twitch.svg', rumble: '/rumble.svg',
    };
    return icons[platform] || '/capsule.svg';
  }

  function getCleanChannelName(id: string, _platform: string): string {
    return id.split('/').pop() || id;
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

  function formatAbsoluteDate(timestamp?: number | string | Date) {
    if (!timestamp) return 'No timestamp';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Invalid date';
    return formatDate(date);
  }

  function handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.streamvods-recent')) {
      showRecentDropdown.value = false;
    }
  }

  onMounted(async () => {
    document.addEventListener('click', handleClickOutside);
    await platformStore.refreshRecentSearchMetadata();

    const rawUrl = route.query.url ?? route.query.search;
    const queryUrl = (Array.isArray(rawUrl) ? rawUrl[0] : rawUrl) as string | undefined;

    if (queryUrl) {
      searchInput.value = queryUrl;
      detectPlatform();
      await handleSearch();
      router.replace({ path: route.path, query: {} });
    }
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });
</script>

<style>
  /* ===== Page Container ===== */
  .streamvods {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .streamvods__content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    width: 100%;
    flex: 1;
    min-height: 0;
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

  .streamvods-recent__avatar-badge--YouTube {
    background-color: #dc2626;
  }

  .streamvods-recent__avatar-badge--twitter {
    background-color: #000000;
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

  .streamvods-search__platform--youtube {
    background-color: #dc2626;
  }

  .streamvods-search__platform--twitter {
    background-color: #000000;
  }

  .streamvods-search__platform-icon {
    width: 12px;
    height: 12px;
    filter: brightness(0) invert(1);
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
    .streamvods__grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (min-width: 1024px) {
    .streamvods__grid { grid-template-columns: repeat(3, 1fr); }
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
    gap: 0.25rem;
    padding: 0.3125rem 0.5rem;
    backdrop-filter: blur(8px);
    border-radius: 5px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .vod-card__badge--YouTube {
    background-color: rgba(220, 38, 38, 0.3);
    color: #fca5a5;
  }

  .vod-card__badge--twitter {
    background-color: rgba(0, 0, 0, 0.5);
    color: #e2e8f0;
  }

  .vod-card__badge--duration {
    background-color: rgba(14, 165, 233, 0.3);
    color: #7dd3fc;
  }

  .vod-card__badge-icon {
    width: 10px;
    height: 10px;
    filter: brightness(0) invert(1);
  }

  .vod-card__badge-icon-svg {
    width: 10px;
    height: 10px;
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

  /* Checkbox */
  .vod-card__checkbox {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 20;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .vod-card:hover .vod-card__checkbox,
  .vod-card__checkbox--visible {
    opacity: 1;
  }

  .vod-card__checkbox-inner {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    border: 2px solid rgba(255, 255, 255, 0.6);
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  }

  .vod-card__checkbox-inner--checked {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
  }

  .vod-card__checkbox-icon {
    width: 12px;
    height: 12px;
    color: white;
  }

  /* Skeleton */
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
    background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .vod-card__skeleton-meta {
    height: 12px;
    width: 40%;
    margin-top: 0.25rem;
    background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.15s;
    border-radius: 3px;
  }

  /* ===== Results ===== */
  .streamvods__results-count {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-bottom: 1rem;
  }

  .streamvods__bulk-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.2);
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .streamvods__bulk-count {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-accent);
  }

  .streamvods__bulk-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .streamvods__bulk-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
  }

  .streamvods__bulk-btn--primary {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
  }

  .streamvods__bulk-btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
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

  .streamvods__error-icon svg { width: 32px; height: 32px; }

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

  .download-modal__content {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 1.5rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .download-modal__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .download-modal__btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 150ms ease;
  }

  .download-modal__btn--primary {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
  }

  .download-modal__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .download-modal__btn--primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .download-modal__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .download-modal__btn--secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .download-modal__btn-spinner {
    animation: spin 0.8s linear infinite;
  }

  .download-preview {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem 1rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
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

  .download-preview__info { flex: 1; min-width: 0; }

  .download-preview__title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.4;
  }

  .download-preview__meta {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .download-preview__duration {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  /* ===== Animations ===== */
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  /* ===== Transitions ===== */
  .modal-enter-active, .modal-leave-active { transition: opacity 200ms ease; }
  .modal-enter-from, .modal-leave-to { opacity: 0; }
  .dialog-enter-active { transition: all 200ms ease; }
  .dialog-enter-from { opacity: 0; transform: scale(0.95) translateY(-8px); }
  .scale-enter-active, .scale-leave-active { transition: all 150ms ease; }
  .scale-enter-from, .scale-leave-to { opacity: 0; transform: scale(0.8); }
</style>
