<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-md" @click="$emit('close')"></div>
      <Transition name="dialog" appear>
        <div
          class="relative flex flex-col w-full max-w-sm sm:max-w-md lg:max-w-lg mx-3 sm:mx-4 overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-xl sm:rounded-2xl max-h-[92vh] sm:max-h-[90vh]"
        >
          <!-- Decorative top accent -->
          <div class="h-1 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 flex-shrink-0" />

          <!-- Header -->
          <div
            class="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-800 bg-zinc-900/50"
          >
            <div class="flex items-center gap-2 sm:gap-3">
              <div
                class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-cyan-500/30"
              >
                <Download class="h-4 w-4 sm:h-5 sm:w-5 text-cyan-400" />
              </div>
              <h2 class="text-base sm:text-lg font-semibold text-white">Download Latest VOD</h2>
            </div>
            <button
              @click="$emit('close')"
              class="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors border border-zinc-800"
            >
              <X class="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar" @click="showPlatformDropdown = false">
            <!-- Platform Selector (when multiple platforms) -->
            <div v-if="creator && creator.platform_links.length > 1" class="mb-4 sm:mb-6">
              <label class="block text-xs sm:text-sm font-medium text-muted-foreground mb-1.5 sm:mb-2">
                Select Platform
              </label>
              <div class="relative">
                <button
                  type="button"
                  @click.stop="showPlatformDropdown = !showPlatformDropdown"
                  class="w-full flex items-center gap-3 px-3 py-2.5 bg-muted border border-border rounded-lg text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                >
                  <div
                    class="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                    :style="{
                      backgroundColor: getPlatformColor(creator.platform_links[selectedPlatformIndex].platform),
                    }"
                  >
                    <img
                      :src="getPlatformIcon(creator.platform_links[selectedPlatformIndex].platform)"
                      class="w-4 h-4 brightness-200"
                    />
                  </div>
                  <div class="flex-1 text-left">
                    <span class="text-sm font-medium">
                      {{ getPlatformName(creator.platform_links[selectedPlatformIndex].platform) }}
                    </span>
                    <span class="text-xs text-muted-foreground ml-2">
                      {{
                        creator.platform_links[selectedPlatformIndex].display_name ||
                        truncateId(creator.platform_links[selectedPlatformIndex].platform_id)
                      }}
                    </span>
                  </div>
                  <ChevronDown
                    class="w-4 h-4 text-muted-foreground transition-transform"
                    :class="{ 'rotate-180': showPlatformDropdown }"
                  />
                </button>

                <!-- Platform Dropdown -->
                <div
                  v-if="showPlatformDropdown"
                  class="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden"
                  @click.stop
                >
                  <div class="p-1">
                    <button
                      v-for="(link, index) in creator.platform_links"
                      :key="link.id"
                      type="button"
                      @click="selectPlatform(index)"
                      class="w-full text-left px-3 py-2.5 rounded-md transition-colors flex items-center gap-3 hover:bg-muted/80 cursor-pointer"
                      :class="{ 'bg-muted': selectedPlatformIndex === index }"
                    >
                      <div
                        class="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                        :style="{ backgroundColor: getPlatformColor(link.platform) }"
                      >
                        <img :src="getPlatformIcon(link.platform)" class="w-4 h-4 brightness-200" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <span class="text-sm font-medium text-foreground">
                          {{ getPlatformName(link.platform) }}
                        </span>
                        <span class="text-xs text-muted-foreground ml-2 truncate">
                          {{ link.display_name || truncateId(link.platform_id) }}
                        </span>
                      </div>
                      <span
                        v-if="link.is_primary"
                        class="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded-full"
                      >
                        Primary
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="flex flex-col items-center justify-center py-12">
              <Loader2 class="w-8 h-8 animate-spin text-primary mb-4" />
              <p class="text-muted-foreground">Fetching latest VOD...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="text-center py-8">
              <AlertTriangle class="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h3 class="font-medium text-lg mb-2">No VOD Found</h3>
              <p class="text-muted-foreground text-sm">{{ error }}</p>
              <p v-if="currentPlatformLink" class="text-xs text-muted-foreground/70 mt-2 font-mono">
                Searched:
                {{
                  currentPlatformLink.platformId.length > 16
                    ? currentPlatformLink.platformId.slice(0, 8) + '...' + currentPlatformLink.platformId.slice(-4)
                    : currentPlatformLink.platformId
                }}
              </p>
              <Button variant="outline" class="mt-4" @click="fetchLatestVod">
                <RefreshCw class="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>

            <!-- VOD Found -->
            <div v-else-if="latestVod" class="space-y-6">
              <!-- VOD Preview -->
              <div class="flex gap-4 p-4 bg-muted/20 border border-border/50 rounded-lg">
                <div
                  class="relative flex-shrink-0 overflow-hidden rounded bg-black/40 w-32 aspect-video border border-border/50"
                >
                  <img v-if="latestVod.thumbnailUrl" :src="latestVod.thumbnailUrl" class="w-full h-full object-cover" />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <Video class="w-8 h-8 text-muted-foreground/50" />
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-sm line-clamp-2 mb-2">{{ latestVod.title }}</h3>
                  <div class="flex items-center gap-3 text-xs text-muted-foreground">
                    <span class="flex items-center gap-1">
                      <Clock class="w-3 h-3" />
                      {{ formatDuration(latestVod.duration) }}
                    </span>
                    <span v-if="latestVod.createdAt">
                      {{ formatRelativeTime(latestVod.createdAt) }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Time Range Selection -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <label class="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                    Select Range
                  </label>
                  <span
                    class="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                    :class="
                      isFullStreamSelected
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    "
                  >
                    {{ isFullStreamSelected ? 'Full Stream' : formatDuration(selectedDuration) }}
                  </span>
                </div>
                <div class="p-4 border shadow-sm bg-card border-border rounded-xl">
                  <TimeRangePicker v-model="selectedTimeRange" :total-duration="latestVod.duration || 0" />
                </div>
                <button
                  v-if="!isFullStreamSelected"
                  @click="resetToFullStream"
                  class="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw class="w-3 h-3" />
                  Reset to full stream
                </button>
              </div>

              <!-- Auto-Segment Option -->
              <div
                v-if="selectedDuration > 900"
                class="p-4 border border-border rounded-xl bg-card shadow-sm animate-in fade-in duration-200"
              >
                <div class="flex items-center justify-between mb-3">
                  <label class="text-sm font-medium text-foreground flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      v-model="autoSegment"
                      class="w-4 h-4 rounded border-muted-foreground text-purple-600 focus:ring-purple-500 bg-transparent"
                    />
                    <span>Auto-segment into parts</span>
                  </label>
                  <span
                    v-if="autoSegment"
                    class="text-[10px] font-medium bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/20"
                  >
                    ~{{ estimatedParts }} parts
                  </span>
                </div>
                <div v-if="autoSegment" class="space-y-3 pl-1 mt-4">
                  <div class="flex justify-between items-center">
                    <span class="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Part Duration
                    </span>
                    <span class="text-xs font-medium bg-muted text-foreground px-2 py-0.5 rounded-full">
                      {{ autoSegmentDuration }} min
                    </span>
                  </div>
                  <input
                    type="range"
                    v-model.number="autoSegmentDuration"
                    min="15"
                    max="60"
                    step="5"
                    class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div class="flex justify-between text-[10px] text-muted-foreground/70 px-0.5">
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
          <div
            v-if="latestVod"
            class="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/50"
          >
            <button
              @click="$emit('close')"
              :disabled="downloading"
              class="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              @click="handleStartDownload"
              :disabled="downloading || selectedTimeRange.endTime <= selectedTimeRange.startTime"
              class="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div
                class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
              />
              <span class="relative flex items-center gap-2">
                <Loader2 v-if="downloading" class="w-4 h-4 animate-spin" />
                {{ downloading ? 'Starting...' : 'Start Download' }}
              </span>
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { ref, watch, computed } from 'vue';
  import { useRouter } from 'vue-router';
  import { Button } from '@/components/ui/button';
  import TimeRangePicker from '@/components/TimeRangePicker.vue';
  import { type CreatorProfileWithLinks } from '@/services/database';
  import { usePlatformStore, type PlatformClip } from '@/stores/platform';
  import { useDownloads } from '@/composables/useDownloads';
  import { useToast } from '@/composables/useToast';
  import { platformConfigs } from '@/config/platforms';
  import {
    X,
    Loader2,
    AlertTriangle,
    RefreshCw,
    Video,
    Clock,
    Download,
    ChevronDown,
    RotateCcw,
  } from 'lucide-vue-next';

  interface Props {
    show: boolean;
    creator: CreatorProfileWithLinks | null;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<{
    (e: 'close'): void;
  }>();

  const router = useRouter();
  const platformStore = usePlatformStore();
  const { startDownload: startVodDownload } = useDownloads();
  const { success, error: showError } = useToast();

  // State
  const loading = ref(false);
  const error = ref('');
  const latestVod = ref<PlatformClip | null>(null);
  const selectedTimeRange = ref({ startTime: 0, endTime: 0 });
  const autoSegment = ref(false);
  const autoSegmentDuration = ref(30);
  const downloading = ref(false);
  const currentPlatformLink = ref<{ platform: string; platformId: string; displayName?: string } | null>(null);
  const selectedPlatformIndex = ref(0);
  const showPlatformDropdown = ref(false);

  // Computed properties for the unified download UI
  // Use a generous tolerance (5 seconds or 1% of duration) to account for slider precision
  const isFullStreamSelected = computed(() => {
    if (!latestVod.value?.duration) return true;
    const duration = latestVod.value.duration;
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
    if (latestVod.value?.duration) {
      selectedTimeRange.value = { startTime: 0, endTime: latestVod.value.duration };
    }
  }

  // Watch for dialog open
  watch(
    () => props.show,
    async (show) => {
      if (show && props.creator) {
        // Find the primary platform index, or default to first
        const primaryIndex = props.creator.platform_links.findIndex((l) => l.is_primary);
        selectedPlatformIndex.value = primaryIndex >= 0 ? primaryIndex : 0;
        showPlatformDropdown.value = false;
        await fetchLatestVod();
      } else {
        // Reset state
        latestVod.value = null;
        error.value = '';
        selectedTimeRange.value = { startTime: 0, endTime: 0 };
        autoSegment.value = false;
        selectedPlatformIndex.value = 0;
        showPlatformDropdown.value = false;
      }
    }
  );

  // Platform helpers
  function getPlatformIcon(platform: string): string {
    const icons: Record<string, string> = {
      pumpfun: '/capsule.svg',
      kick: '/kick.svg',
      twitch: '/twitch.svg',
      youtube: '/youtube.svg',
      rumble: '/rumble.svg',
      twitter: '/x.svg',
    };
    return icons[platform] || '/capsule.svg';
  }

  function getPlatformColor(platform: string): string {
    const colors: Record<string, string> = {
      pumpfun: '#10b981',
      kick: '#53FC18',
      twitch: '#9146FF',
      youtube: '#dc2626',
      rumble: '#85C742',
      twitter: '#000000',
    };
    return colors[platform] || '#6b7280';
  }

  function getPlatformName(platform: string): string {
    const names: Record<string, string> = {
      pumpfun: 'PumpFun',
      kick: 'Kick',
      twitch: 'Twitch',
      youtube: 'YouTube',
      rumble: 'Rumble',
      twitter: 'X (Twitter)',
    };
    return names[platform] || platform;
  }

  function truncateId(id: string): string {
    if (!id || id.length < 12) return id;
    return `${id.slice(0, 6)}...${id.slice(-4)}`;
  }

  async function selectPlatform(index: number) {
    selectedPlatformIndex.value = index;
    showPlatformDropdown.value = false;
    await fetchLatestVod();
  }

  async function fetchLatestVod() {
    if (!props.creator) return;

    loading.value = true;
    error.value = '';
    latestVod.value = null;

    try {
      // Get the selected platform link
      const selectedLink = props.creator.platform_links[selectedPlatformIndex.value];

      console.log('[CreatorDownload] Creator:', props.creator.name);
      console.log('[CreatorDownload] Platform links:', props.creator.platform_links);
      console.log('[CreatorDownload] Selected link:', selectedLink);

      if (!selectedLink) {
        error.value = 'No platform links configured for this creator';
        return;
      }

      // Check if platform is supported
      const config = platformConfigs[selectedLink.platform as keyof typeof platformConfigs];
      if (config?.isComingSoon) {
        error.value = `${config.name} VOD downloads are not yet available`;
        return;
      }

      // Validate the platform ID
      let validatedId = selectedLink.platform_id;

      if (selectedLink.platform === 'pumpfun') {
        const { extractMintId } = await import('@/services/pumpfun');
        const mintId = extractMintId(selectedLink.platform_id);
        if (!mintId) {
          console.error('[CreatorDownload] Invalid mint ID:', selectedLink.platform_id);
          error.value = `Invalid PumpFun mint ID stored for this creator. Please edit the creator and re-enter the mint ID.`;
          return;
        }
        validatedId = mintId;
      }

      currentPlatformLink.value = {
        platform: selectedLink.platform,
        platformId: validatedId,
        displayName: selectedLink.display_name || undefined,
      };

      console.log('[CreatorDownload] Searching for VODs with platform_id:', validatedId);

      // Set platform and search - request more clips to ensure we get one that passes the duration filter
      // The platform store filters out clips < 3 minutes, so we need to fetch more to find a valid one
      platformStore.setActivePlatform(selectedLink.platform as any);
      const result = await platformStore.searchClips(validatedId, 20);

      console.log('[CreatorDownload] Search result:', result);
      console.log('[CreatorDownload] Clips found:', platformStore.clips.length);

      if (result.success && platformStore.clips.length > 0) {
        // Get the first (most recent) clip that passed the duration filter
        latestVod.value = platformStore.clips[0];
        selectedTimeRange.value = { startTime: 0, endTime: latestVod.value.duration || 0 };
        autoSegment.value = false;
      } else {
        // Check if clips were returned but all filtered out
        if (result.success && result.total === 0) {
          error.value = 'No VODs longer than 3 minutes found. Check the VODs page for all available clips.';
        } else {
          error.value = result.error || 'No VODs found for this creator';
        }
      }
    } catch (err) {
      console.error('[CreatorDownload] Failed to fetch VOD:', err);
      error.value = err instanceof Error ? err.message : 'Failed to fetch VOD';
    } finally {
      loading.value = false;
    }
  }

  function formatDuration(duration?: number): string {
    if (!duration) return 'Unknown';
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  function formatRelativeTime(timestamp?: number | string | Date): string {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (secondsAgo < 60) return 'Just now';
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)} minutes ago`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)} hours ago`;
    if (secondsAgo < 604800) return `${Math.floor(secondsAgo / 86400)} days ago`;
    return `${Math.floor(secondsAgo / 604800)} weeks ago`;
  }

  async function handleStartDownload() {
    if (!latestVod.value || !currentPlatformLink.value) return;

    downloading.value = true;

    try {
      const vod = latestVod.value;
      const videoUrl = vod.mp4Url || vod.playlistUrl;

      if (!videoUrl) {
        throw new Error('No video URL available');
      }

      // Only pass segment range if user has trimmed the selection (not full stream)
      const segmentRange = !isFullStreamSelected.value
        ? { startTime: selectedTimeRange.value.startTime, endTime: selectedTimeRange.value.endTime }
        : undefined;

      // Auto-segment applies to the selected range (whether full or trimmed)
      const shouldAutoSegment = autoSegment.value && selectedDuration.value > 900;

      // Pass creator watermark settings if available
      const creatorWatermarkSettings =
        props.creator?.watermark_id && props.creator?.watermark_settings
          ? {
              watermarkId: props.creator.watermark_id,
              watermarkSettings: props.creator.watermark_settings,
            }
          : undefined;

      await startVodDownload(
        vod.title,
        videoUrl,
        currentPlatformLink.value.platformId,
        segmentRange,
        vod.clipId,
        vod.duration,
        {
          autoSegment: shouldAutoSegment,
          segmentDuration: autoSegmentDuration.value * 60,
          provider: currentPlatformLink.value.platform as
            | 'pumpfun'
            | 'kick'
            | 'twitch'
            | 'YouTube'
            | 'rumble'
            | 'twitter'
            | 'tokend',
          creatorWatermarkSettings,
        }
      );

      let message: string;

      if (shouldAutoSegment) {
        const parts = estimatedParts.value;
        const rangeLabel = isFullStreamSelected.value ? 'stream' : 'selection';
        message = `Splitting ${rangeLabel} into ~${parts} parts (~${autoSegmentDuration.value} min each).`;
      } else if (!isFullStreamSelected.value) {
        message = `Downloading ${formatDuration(selectedDuration.value)} segment of "${vod.title}".`;
      } else {
        message = `Downloading full stream "${vod.title}".`;
      }

      success('Download Started', message);
      emit('close');

      // Navigate to projects
      setTimeout(() => {
        router.push('/projects');
      }, 500);
    } catch (err) {
      console.error('Download failed:', err);
      showError('Download Failed', err instanceof Error ? err.message : 'Failed to start download');
    } finally {
      downloading.value = false;
    }
  }
</script>

<style scoped>
  /* Modal backdrop transition */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  /* Dialog transition */
  .dialog-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.2s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* Custom scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgb(63 63 70);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgb(82 82 91);
  }
</style>
