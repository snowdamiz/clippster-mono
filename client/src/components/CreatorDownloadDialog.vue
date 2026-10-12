<template>
  <Modal
    :open="show"
    title="Download latest VOD"
    :description="creator ? `Grab the most recent stream from ${creator.name}.` : undefined"
    :icon="Download"
    size="md"
    @close="$emit('close')"
  >
    <div class="flex flex-col gap-4">
      <!-- Platform selector (when the creator has several platforms) -->
      <Field v-if="creator && creator.platform_links.length > 1" label="Platform">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="flex h-[var(--control-lg)] w-full min-w-0 items-center gap-2.5 rounded-[var(--radius-control)] border border-line bg-surface-raised px-2 text-left text-sm text-fg transition-colors hover:border-line-strong data-[state=open]:border-line-strong"
            >
              <PlatformLogo :platform="creator.platform_links[selectedPlatformIndex].platform" size="md" />
              <span class="min-w-0 flex-1 truncate">
                <span class="font-medium">{{ getPlatformName(creator.platform_links[selectedPlatformIndex].platform) }}</span>
                <span class="ml-2 text-xs text-fg-muted">
                  {{
                    creator.platform_links[selectedPlatformIndex].display_name ||
                    truncateId(creator.platform_links[selectedPlatformIndex].platform_id)
                  }}
                </span>
              </span>
              <ChevronDown class="size-3.5 shrink-0 text-fg-subtle" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-[var(--reka-dropdown-menu-trigger-width)]">
            <DropdownMenuItem
              v-for="(link, index) in creator.platform_links"
              :key="link.id"
              @select="selectPlatform(index)"
            >
              <PlatformLogo :platform="link.platform" size="sm" />
              <span class="min-w-0 flex-1 truncate">
                {{ getPlatformName(link.platform) }}
                <span class="ml-1.5 text-xs text-fg-muted">{{ link.display_name || truncateId(link.platform_id) }}</span>
              </span>
              <Badge v-if="link.is_primary" variant="brand">Primary</Badge>
              <Check v-if="selectedPlatformIndex === index" class="!text-brand" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Field>

      <!-- Loading -->
      <div v-if="loading" class="skeleton-group flex flex-col items-center justify-center gap-3 py-10 text-sm text-fg-muted">
        <Loader2 class="size-6 animate-spin text-fg-subtle" />
        Fetching latest VOD…
      </div>

      <!-- Error -->
      <EmptyState
        v-else-if="error"
        :icon="AlertTriangle"
        tone="warning"
        size="sm"
        title="No VOD found"
        :description="error"
      >
        <p v-if="currentPlatformLink" class="w-full font-mono text-2xs text-fg-subtle">
          Searched:
          {{
            currentPlatformLink.platformId.length > 16
              ? currentPlatformLink.platformId.slice(0, 8) + '...' + currentPlatformLink.platformId.slice(-4)
              : currentPlatformLink.platformId
          }}
        </p>
        <Button variant="secondary" size="sm" @click="fetchLatestVod"><RefreshCw /> Try again</Button>
      </EmptyState>

      <!-- VOD found -->
      <div v-else-if="latestVod" class="flex animate-enter flex-col gap-4">
        <div class="flex gap-3 border-b border-line-subtle pb-4">
          <div class="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
            <img v-if="latestVod.thumbnailUrl" :src="latestVod.thumbnailUrl" alt="" class="size-full object-cover" />
            <div v-else class="grid size-full place-items-center">
              <Video class="size-6 text-fg-disabled" />
            </div>
          </div>
          <div class="min-w-0 flex-1 py-0.5">
            <h3 class="line-clamp-2 text-sm font-medium text-fg">{{ latestVod.title }}</h3>
            <div class="mt-1.5 flex items-center gap-3 text-xs text-fg-muted">
              <span class="tabular flex items-center gap-1"><Clock class="size-3" />{{ formatDuration(latestVod.duration) }}</span>
              <span v-if="latestVod.createdAt">{{ formatRelativeTime(latestVod.createdAt) }}</span>
            </div>
          </div>
        </div>

        <Field label="Range">
          <template #label-end>
            <Badge :variant="isFullStreamSelected ? 'success' : 'neutral'">
              {{ isFullStreamSelected ? 'Full stream' : formatDuration(selectedDuration) }}
            </Badge>
          </template>
          <TimeRangePicker v-model="selectedTimeRange" :total-duration="latestVod.duration || 0" />
          <Button v-if="!isFullStreamSelected" variant="ghost" size="xs" class="self-start" @click="resetToFullStream">
            <RotateCcw /> Reset to full stream
          </Button>
        </Field>

        <div v-if="selectedDuration > 900" class="flex flex-col gap-3 border-t border-line-subtle pt-4">
          <label class="flex cursor-pointer items-center justify-between gap-3">
            <span class="flex flex-col">
              <span class="text-sm font-medium text-fg">Auto-segment into parts</span>
              <span class="text-xs text-fg-muted">Split long ranges into separate downloads.</span>
            </span>
            <span class="flex items-center gap-2">
              <Badge v-if="autoSegment">~{{ estimatedParts }} parts</Badge>
              <Switch v-model="autoSegment" />
            </span>
          </label>
          <template v-if="autoSegment">
            <RangeField
              v-model="autoSegmentDuration"
              label="Part length"
              :min="15"
              :max="60"
              :step="5"
              suffix=" min"
            />
          </template>
        </div>
      </div>
    </div>

    <template v-if="latestVod" #footer>
      <Button variant="ghost" :disabled="downloading" @click="$emit('close')">Cancel</Button>
      <Button
        variant="primary"
        :loading="downloading"
        :disabled="selectedTimeRange.endTime <= selectedTimeRange.startTime"
        @click="handleStartDownload"
      >
        {{ downloading ? 'Starting…' : 'Start download' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, watch, computed } from 'vue';
  import { useRouter } from 'vue-router';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Modal } from '@/components/ui/modal';
  import { PlatformLogo, platformLabel } from '@/components/ui/platform-logo';
  import { Switch } from '@/components/ui/switch';
  import RangeField from '@/components/branding/RangeField.vue';
  import TimeRangePicker from '@/components/TimeRangePicker.vue';
  import { type CreatorProfileWithLinks } from '@/services/database';
  import { usePlatformStore, type PlatformClip } from '@/stores/platform';
  import { useDownloads } from '@/composables/useDownloads';
  import { useToast } from '@/composables/useToast';
  import { platformConfigs } from '@/config/platforms';
  import {
    Check,
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

  function getPlatformName(platform: string): string {
    return platformLabel(platform);
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
