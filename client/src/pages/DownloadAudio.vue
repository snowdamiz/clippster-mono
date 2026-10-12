<template>
  <PageLayout title="Download audio" description="Download audio from YouTube" :icon="Headphones">
    <template #actions>
      <RecentSearchesMenu
        v-if="platformStore.getAudioRecentSearches?.length > 0"
        :searches="platformStore.getAudioRecentSearches"
        :format-name="recentSearchName"
        @select="handleRecentSearchClick"
        @clear="platformStore.clearAudioRecentSearches()"
      />
    </template>

    <template #toolbar>
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <StreamLinkInput
          v-model="searchInput"
          :platform="detectedPlatform"
          placeholder="Paste a YouTube URL…"
          :disabled="isSearching"
          class="max-w-[520px] flex-1"
          @input="detectPlatform"
          @submit="handleSearch"
        />
        <Button variant="primary" :disabled="!searchInput || isSearching" @click="handleSearch">
          <Loader2 v-if="isSearching" class="animate-spin" />
          <Search v-else />
          Search
        </Button>
      </div>
    </template>

    <div class="flex flex-1 flex-col gap-4 px-5 py-4">
      <!-- Loading -->
      <section v-if="isSearching" class="skeleton-group flex flex-col gap-3" aria-busy="true">
        <SectionHeader title="Loading audio…" />
        <div class="card-grid">
          <VodCard v-for="i in 8" :key="i" skeleton />
        </div>
      </section>

      <!-- Error -->
      <EmptyState
        v-else-if="searchError"
        :icon="AlertTriangle"
        tone="danger"
        title="Couldn't load audio"
        :description="searchError"
      >
        <Button variant="secondary" @click="handleSearch">
          <RotateCcw />
          Try again
        </Button>
      </EmptyState>

      <!-- Results -->
      <section v-else-if="clips.length > 0" class="flex animate-enter flex-col gap-3">
        <SectionHeader title="Results" :count="clips.length">
          <template v-if="selectedIds.size > 0">
            <span class="tabular mr-1 text-xs text-fg-muted">{{ selectedIds.size }} selected</span>
            <Button variant="ghost" size="sm" @click="clearSelection">Clear</Button>
            <Button variant="secondary" size="sm" @click="downloadSelected">
              <Download />
              Download selected
            </Button>
          </template>
        </SectionHeader>

        <div class="card-grid">
          <VodCard
            v-for="clip in clips"
            :key="clip.clipId"
            :title="clip.title"
            :thumbnail-url="clip.thumbnailUrl"
            :platform="detectedPlatform"
            :duration="clip.duration && clip.duration > 0 ? formatDuration(clip.duration) : null"
            :meta="[clip.uploader, clip.createdAt ? formatAbsoluteDate(clip.createdAt) : 'No timestamp']"
            :selected="selectedIds.has(clip.clipId)"
            :placeholder-icon="Headphones"
            download-label="Download audio"
            @click="handleClipClick(clip)"
            @toggle-select="toggleSelection(clip)"
            @download="handleDownloadClip(clip)"
          />
        </div>
      </section>

      <!-- Empty -->
      <EmptyState
        v-else
        :icon="Headphones"
        title="Download audio from YouTube"
        description="Paste a YouTube video or channel URL above to save its audio as MP3."
      >
        <PlatformLogo platform="youtube" size="md" />
      </EmptyState>
    </div>

    <!-- Download confirm -->
    <Modal
      :open="showDownloadDialog"
      title="Download audio"
      description="Save the audio as an MP3 file."
      :icon="Download"
      size="md"
      :dismissible="!downloadStarting"
      :hide-close="downloadStarting"
      @update:open="showDownloadDialog = $event"
    >
      <div class="flex items-center gap-3">
        <div class="grid aspect-video w-28 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-sunken">
          <img v-if="clipToDownload?.thumbnailUrl" :src="clipToDownload.thumbnailUrl" alt="" class="size-full object-cover" />
          <Headphones v-else class="size-6 text-fg-disabled" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="line-clamp-2 text-sm font-medium text-fg">{{ clipToDownload?.title }}</h3>
          <p v-if="clipToDownload?.duration" class="tabular mt-1 inline-flex items-center gap-1 text-xs text-fg-muted">
            <Clock class="size-3" />
            {{ formatDuration(clipToDownload?.duration) }}
          </p>
        </div>
      </div>

      <template #footer>
        <Button variant="ghost" :disabled="downloadStarting" @click="showDownloadDialog = false">Cancel</Button>
        <Button variant="primary" :loading="downloadStarting" @click="confirmDownload">
          <Download v-if="!downloadStarting" />
          {{ downloadStarting ? 'Starting…' : 'Download MP3' }}
        </Button>
      </template>
    </Modal>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { formatDate } from '@/utils/dateTimeUtils';
  import PageLayout from '@/components/PageLayout.vue';
  import { usePlatformStore, type PlatformClip, type RecentSearch } from '@/stores/platform';
  import { useToast } from '@/composables/useToast';
  import { useAudioDownloads } from '@/composables/useAudioDownloads';
  import { Clock, AlertTriangle, Download, Headphones, Search, Loader2, RotateCcw } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Modal } from '@/components/ui/modal';
  import { PlatformLogo } from '@/components/ui/platform-logo';
  import { SectionHeader } from '@/components/ui/section-header';
  import RecentSearchesMenu from '@/components/streams/RecentSearchesMenu.vue';
  import StreamLinkInput from '@/components/streams/StreamLinkInput.vue';
  import VodCard from '@/components/streams/VodCard.vue';
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
    if (!val) {
      detectedPlatform.value = null;
      return;
    }
    if (val.includes('youtube.com') || val.includes('youtu.be')) {
      detectedPlatform.value = 'YouTube';
      return;
    }
    detectedPlatform.value = null;
  }

  async function handleSearch() {
    const val = searchInput.value.trim();
    if (!val) {
      showError('Invalid Input', 'Please enter a YouTube URL');
      return;
    }
    detectPlatform();
    if (!detectedPlatform.value) {
      showError('Unknown Platform', 'Please enter a valid YouTube URL');
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
        showError('Not Available', 'Only YouTube audio downloads are supported.');
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

  function clearSelection() {
    selectedIds.value = new Set();
  }

  async function downloadSelected() {
    const selected = clips.value.filter((c) => selectedIds.value.has(c.clipId));
    for (const clip of selected) {
      await handleDownloadClip(clip);
    }
  }

  /** Primary label for a recent search row. */
  function recentSearchName(search: RecentSearch): string {
    return search.symbol || search.label || getCleanChannelName(search.id, search.platform);
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
