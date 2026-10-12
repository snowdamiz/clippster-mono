<template>
  <PageLayout title="Live streams" description="Real-time clip detection" :icon="Radio">
    <template #badge>
      <Badge v-if="liveChannelCount > 0" variant="live">
        <span class="size-1.5 animate-pulse rounded-full bg-white" />
        {{ liveChannelCount }} live
      </Badge>
    </template>

    <template #toolbar>
      <div class="flex min-w-0 flex-1 items-center gap-2" data-tour-id="tour-live-search">
        <StreamLinkInput
          v-model="inputValue"
          :platform="detectedPlatform"
          placeholder="Paste a stream link or mint ID…"
          class="max-w-[520px] flex-1"
          @input="detectPlatform"
          @submit="addStreamer"
        />
        <Button variant="primary" :disabled="!inputValue" @click="addStreamer">
          <Plus />
          Track
        </Button>
      </div>
      <span v-if="streamers.length > 0" class="tabular hidden shrink-0 text-xs text-fg-subtle min-[880px]:inline">
        {{ streamers.length }} {{ streamers.length === 1 ? 'channel' : 'channels' }}
      </span>
    </template>

    <div class="flex flex-1 flex-col gap-6 px-5 py-4">
      <!-- Tour demo streamer (same card chrome as real monitored channels) -->
      <section v-if="mockStreamerActive" class="flex flex-col gap-2">
        <SectionHeader title="Tour demo" />
        <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
          <StreamerMonitorCard name="Demo Streamer" platform="Twitch" data-tour-id="tour-mock-streamer">
            <template #status>
              <Badge variant="live">
                <span class="size-1.5 animate-pulse rounded-full bg-white" />
                Live
              </Badge>
            </template>
            <template #footer-start>
              <span class="text-xs text-fg-subtle">Sample channel</span>
            </template>
            <template #footer-end>
              <Button variant="ghost" size="sm" data-tour-id="tour-mock-watch" @click.prevent>
                <Eye />
                Watch
              </Button>
              <div class="flex items-center">
                <Button variant="secondary" size="sm" class="rounded-r-none" data-tour-id="tour-mock-rec" @click.prevent>
                  <Video />
                  Rec
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  class="-ml-px rounded-l-none"
                  data-tour-id="tour-mock-auto"
                  @click.prevent
                >
                  <Sparkles class="text-ai" />
                  Auto
                </Button>
              </div>
            </template>
          </StreamerMonitorCard>
        </div>
      </section>

      <!-- Monitored channels + activity -->
      <div
        v-if="streamers.length > 0"
        class="grid animate-enter items-start gap-5"
        :class="showActivity ? 'grid-cols-[minmax(0,1fr)_300px] max-[1080px]:grid-cols-1' : 'grid-cols-1'"
      >
        <div class="flex min-w-0 flex-col gap-6">
          <section v-for="platformGroup in streamersByPlatform" :key="platformGroup.platform" class="flex flex-col gap-2">
            <SectionHeader
              :title="platformLabel(platformGroup.platform)"
              :count="platformGroup.count"
              :icon="platformHeaderIcon(platformGroup.platform)"
            />

            <TransitionGroup
              name="list"
              tag="div"
              class="relative grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3"
            >
              <StreamerMonitorCard
                v-for="streamer in platformGroup.streamers"
                :key="streamer.id"
                :name="streamer.displayName"
                :platform="streamer.platform"
                :avatar-url="streamer.streamThumbnailUrl || streamer.profileImageUrl || null"
                :active="streamer.isDetecting"
              >
                <template v-if="streamer.hasTempRecording" #meta>
                  <span class="text-fg-disabled">·</span>
                  <span class="font-medium text-success" title="A DVR buffer is available">DVR</span>
                </template>

                <template #status>
                  <Badge v-if="streamer.isDetecting" :variant="sessionBadge(streamer).variant">
                    <Loader2 v-if="streamer.status === 'STOPPING'" class="animate-spin" />
                    <span v-else class="size-1.5 animate-pulse rounded-full bg-current" />
                    {{ sessionBadge(streamer).label }}
                  </Badge>
                  <Badge v-else-if="streamer.isCheckingLive" variant="neutral">
                    <Loader2 class="animate-spin" />
                    Checking
                  </Badge>
                  <Badge v-else-if="streamer.isLive" variant="live">
                    <span class="size-1.5 animate-pulse rounded-full bg-white" />
                    Live
                    <span v-if="streamer.viewerCount" class="tabular font-normal normal-case opacity-85">
                      {{ formatViewerCount(streamer.viewerCount) }}
                    </span>
                  </Badge>
                  <Badge v-else variant="neutral">
                    <span class="size-1.5 rounded-full bg-fg-subtle" />
                    Offline
                  </Badge>
                </template>

                <template v-if="!streamer.isDetecting" #menu>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="icon-sm" class="-mr-1.5" title="More actions" aria-label="More actions">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="min-w-44">
                      <DropdownMenuItem :disabled="streamer.isCheckingLive" @select="refreshLiveStatus(streamer)">
                        <RefreshCw />
                        Refresh status
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        class="text-danger focus:bg-danger-soft [&>svg]:text-danger"
                        @select="removeStreamer(streamer.id)"
                      >
                        <Trash2 />
                        Remove channel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </template>

                <template #footer-start>
                  <span v-if="streamer.platform === 'Tokend'" class="truncate text-xs text-fg-subtle">
                    Playback, watch, rec and DVR unavailable
                  </span>
                  <label
                    v-else
                    class="flex cursor-pointer items-center gap-2 text-xs text-fg-muted"
                    title="Keep a rolling DVR buffer whenever this channel is live"
                  >
                    <Switch
                      :model-value="!!streamer.autoDvr"
                      :disabled="streamer.isDetecting && streamer.status === 'STOPPING'"
                      @update:model-value="(value: boolean) => updateAutoDvr(streamer, value)"
                    />
                    Auto DVR
                  </label>
                </template>

                <template v-if="streamer.platform !== 'Tokend'" #footer-end>
                  <template v-if="!streamer.isDetecting">
                    <span
                      v-if="streamer.status === 'STOPPING'"
                      class="flex items-center gap-1.5 text-xs text-fg-muted"
                    >
                      <Loader2 class="size-3.5 animate-spin" />
                      Stopping…
                    </span>
                    <template v-else>
                      <Button v-if="streamer.isLive" variant="ghost" size="sm" @click="openWatchDialog(streamer)">
                        <Eye />
                        Watch
                      </Button>
                      <div class="flex items-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          class="rounded-r-none"
                          title="Record the stream in segments"
                          @click="startStreamer(streamer, false)"
                        >
                          <Video />
                          Rec
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          class="-ml-px rounded-l-none"
                          title="Record and detect clips with AI in real time"
                          @click="startStreamer(streamer, true)"
                        >
                          <Sparkles class="text-ai" />
                          Auto
                        </Button>
                      </div>
                    </template>
                  </template>
                  <template v-else>
                    <Button v-if="streamer.isLive" variant="ghost" size="sm" @click="openWatchDialog(streamer)">
                      <Eye />
                      Watch
                    </Button>
                    <Button variant="destructive-soft" size="sm" @click="stopStreamer(streamer)">
                      <Square class="fill-current" />
                      Stop
                    </Button>
                  </template>
                </template>
              </StreamerMonitorCard>
            </TransitionGroup>
          </section>
        </div>

        <!-- Real-time activity -->
        <aside
          v-if="showActivity"
          class="flex max-h-[calc(100vh-13rem)] min-h-[240px] min-w-0 flex-col overflow-hidden rounded-xl border border-line-subtle bg-surface min-[1081px]:sticky min-[1081px]:top-0"
        >
          <SectionHeader title="Real-time activity" :icon="Activity" class="border-b border-line-subtle px-3.5 py-2">
            <Badge variant="live">Live</Badge>
          </SectionHeader>
          <div ref="logsContainer" class="min-h-0 flex-1 overflow-y-auto p-1.5">
            <TransitionGroup name="list" tag="div" class="relative">
              <div
                v-for="log in activityLogs"
                :key="log.id"
                class="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-hover"
              >
                <img
                  v-if="log.streamThumbnailUrl || log.profileImageUrl"
                  :src="log.streamThumbnailUrl || log.profileImageUrl"
                  alt=""
                  class="mt-0.5 size-5 shrink-0 rounded-full object-cover"
                />
                <PlatformLogo v-else :platform="log.platform" size="sm" shape="circle" class="mt-0.5" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-baseline gap-2">
                    <span class="truncate text-xs font-medium text-fg">{{ log.streamerName }}</span>
                    <span class="tabular ml-auto shrink-0 text-2xs text-fg-subtle">{{ log.timestamp }}</span>
                  </div>
                  <p class="mt-0.5 text-xs break-words text-fg-muted">{{ log.message }}</p>
                </div>
                <Loader2 v-if="log.status === 'loading'" class="mt-0.5 size-3.5 shrink-0 animate-spin text-brand" />
                <Check v-else-if="log.status === 'success'" class="mt-0.5 size-3.5 shrink-0 text-success" />
              </div>
            </TransitionGroup>
          </div>
        </aside>
      </div>

      <!-- Empty state -->
      <EmptyState
        v-if="streamersLoaded && streamers.length === 0"
        :icon="Radio"
        title="No channels tracked yet"
        description="Paste a stream link or mint ID above to watch a channel, record it and detect clips in real time."
      >
        <div class="flex items-center gap-1.5" aria-label="Supported platforms">
          <PlatformLogo v-for="platform in supportedLivePlatforms" :key="platform" :platform="platform" size="md" />
        </div>
      </EmptyState>
    </div>

    <!-- Token picker (multiple PumpFun matches) -->
    <Modal
      :open="showSearchDialog"
      title="Select token"
      description="Multiple tokens match your search. Pick the one to track."
      size="sm"
      @update:open="showSearchDialog = $event"
    >
      <div class="-mx-1 flex flex-col gap-0.5">
        <button
          v-for="token in searchResults"
          :key="token.mint"
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-hover focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
          @click="selectSearchResult(token)"
        >
          <span
            class="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-sunken text-2xs font-semibold text-fg-muted"
          >
            <img v-if="token.image" :src="token.image" alt="" class="size-full object-cover" />
            <template v-else>{{ token.symbol.slice(0, 2) }}</template>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-fg">{{ token.name }}</span>
            <span class="block truncate text-xs text-fg-muted">{{ token.symbol }}</span>
          </span>
          <span class="flex shrink-0 flex-col items-end gap-1">
            <code class="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-2xs text-fg-muted">
              {{ token.mint.slice(0, 4) }}…{{ token.mint.slice(-4) }}
            </code>
            <span v-if="token.marketCap" class="tabular text-2xs text-fg-subtle">
              ${{ (token.marketCap / 1000).toFixed(0) }}k MC
            </span>
          </span>
        </button>
      </div>
    </Modal>

    <XBroadcastExplainerDialog
      :show="showTwitterExplainerDialog"
      @confirm="confirmTwitterBroadcastAdd"
      @cancel="cancelTwitterBroadcastAdd"
    />

    <!-- Credit warning -->
    <ConfirmationModal
      :show="showCreditWarningDialog"
      title="Low credits"
      message="You have less than 60 minutes of credits remaining. If you run out of credits, detection will automatically stop and only recording will continue."
      confirm-text="Continue"
      close-text="Cancel"
      :show-cannot-undone-text="false"
      @close="showCreditWarningDialog = false"
      @confirm="confirmCreditWarning"
    />

    <!-- Real-time detection settings (Auto mode only) -->
    <RealtimeDetectionDialog
      v-if="pendingMode === 'auto'"
      v-model="showRealtimeDialog"
      :prompts="prompts"
      :creator-layout-eligible="creatorLayoutEligible"
      :creator-layout-creator-name="creatorLayoutCreatorName"
      :show-sixty-minute-cap="true"
      @confirm="handleRealtimeDetectionConfirm"
    />

    <!-- Record settings (Record mode only) -->
    <Modal
      :open="showSegmentDialog && pendingMode === 'record'"
      title="Record settings"
      description="Record the stream in fixed-length segments."
      :icon="Video"
      size="md"
      @close="closeSegmentDialog"
    >
      <div class="flex flex-col gap-4">
        <Field label="Segment duration">
          <SegmentedControl
            :model-value="selectedDuration"
            :options="recordDurationOptions"
            block
            @update:model-value="selectDuration"
          />
        </Field>

        <!-- Creator clip defaults (only when a matching local profile has saved defaults) -->
        <Field v-if="creatorLayoutEligible" label="Creator layout">
          <label class="flex cursor-pointer items-center gap-2 text-sm text-fg">
            <Checkbox v-model="recordUseCreatorLayout" />
            Use creator layout
          </label>
          <p class="text-xs text-fg-subtle">
            Apply framing, overlays, and subtitle defaults from
            <strong v-if="creatorLayoutCreatorName" class="font-medium text-fg-muted">{{ creatorLayoutCreatorName }}</strong
            ><span v-else>this creator's</span>
            profile to clips built from this recording session.
          </p>
        </Field>
      </div>

      <template #footer>
        <Button variant="ghost" @click="closeSegmentDialog">Cancel</Button>
        <Button variant="primary" @click="handleConfirmSegmentDialog">Start recording</Button>
      </template>
    </Modal>

    <!-- Auto-detection limit -->
    <AutoDetectLimitDialog
      :show="showAutoDetectLimitDialog"
      :active-streamer-name="autoDetectLimitDialogData.activeStreamerName"
      :requested-streamer-name="autoDetectLimitDialogData.requestedStreamerName"
      @close="showAutoDetectLimitDialog = false"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, h, defineComponent, type Component } from 'vue';
  import { invoke } from '@tauri-apps/api/core';
  import { useAppTour, useTourFlags } from '@/composables/useAppTour';
  import {
    Radio,
    Plus,
    Check,
    Square,
    Trash2,
    Activity,
    Loader2,
    Video,
    Sparkles,
    RefreshCw,
    Eye,
    MoreHorizontal,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Button } from '@/components/ui/button';
  import { Badge, type BadgeVariants } from '@/components/ui/badge';
  import { Checkbox } from '@/components/ui/checkbox';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Modal } from '@/components/ui/modal';
  import { PlatformLogo, platformLabel } from '@/components/ui/platform-logo';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import { Switch } from '@/components/ui/switch';
  import StreamLinkInput from '@/components/streams/StreamLinkInput.vue';
  import StreamerMonitorCard from '@/components/streams/StreamerMonitorCard.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import RealtimeDetectionDialog from '@/components/RealtimeDetectionDialog.vue';
  import AutoDetectLimitDialog from '@/components/AutoDetectLimitDialog.vue';
  import { useLivestreamMonitoring, fetchLiveStatus } from '@/composables/useLivestreamMonitoring';
  import { useLivestreamStore } from '@/stores/livestream';
  import { useToast } from '@/composables/useToast';
  import { useRealtimeClipDetection } from '@/composables/useRealtimeClipDetection';
  import {
    getAllMonitoredStreamers,
    createMonitoredStreamer,
    deleteMonitoredStreamer,
    updateMonitoredStreamer,
    getCreatorProfileByPlatformId,
    type CreatorProfileWithLinks,
  } from '@/services/database';
  import { parseCreatorClipBuildDefaults } from '@/composables/useCreatorClipDefaults';
  import { extractMintId, searchPumpFunTokens, fetchTokenMetadataFromServer, type TokenSearchResult } from '@/services/pumpfun';
  import { extractChannelSlug, checkKickLivestream } from '@/services/kick';
  import { extractChannelName, checkTwitchLivestream } from '@/services/twitch';
  import { extractYouTubeChannel, getYouTubeChannelInfo } from '@/services/youtube';
  import { extractRumbleChannel, getRumbleChannelInfo } from '@/services/rumble';
  import {
    extractTwitterBroadcastId,
    getTwitterBroadcastInfo,
    isDirectTwitterLiveUrl,
    isTwitterProfileOrHandleInput,
    normalizeTwitterUrl,
    validateTwitterUrl,
  } from '@/services/twitter';
  import {
    extractTokendChannel,
    checkTokendLivestream,
    fetchTokendCapabilities,
    TOKEND_UNAVAILABLE_MESSAGES,
  } from '@/services/tokend';
  import { canAccessTokend } from '@/utils/tokendAccess';
  import { useAuthStore } from '@/stores/auth';
  import XBroadcastExplainerDialog from '@/components/XBroadcastExplainerDialog.vue';
  import type { MonitoredStreamer } from '@/types/livestream';
  import { useCreditBalance } from '@/composables/useCreditBalance';
  import { useSubscriptionGate } from '@/composables/useSubscriptionGate';

  type Platform = 'YouTube' | 'Twitch' | 'Kick' | 'Rumble' | 'Twitter' | 'PumpFun' | 'Tokend';

  interface PendingMetadataFetch {
    streamerId: string;
    platform: Platform;
    identifier: string;
  }

  const { gates, requireSubscription } = useSubscriptionGate();
  const { success, error: showError } = useToast();
  const authStore = useAuthStore();

  type ExtendedStreamer = Omit<MonitoredStreamer, 'platform'> & {
    platform: Platform;
    isDetecting: boolean;
    mode?: 'Auto-Detect' | 'Record Only' | null;
    status?: 'LIVE' | 'WAITING' | 'IDLE' | 'STOPPING';
    isLive?: boolean;
    viewerCount?: number;
    isCheckingLive?: boolean;
    segmentDurationMinutes: number;
    hasTempRecording?: boolean;
    autoDvr?: boolean;
  };

  const streamers = ref<ExtendedStreamer[]>([]);
  /** False until the first database read finishes, so the empty state never flashes on open. */
  const streamersLoaded = ref(false);
  const inputValue = ref('');
  const detectedPlatform = ref<Platform | null>(null);
  const logsContainer = ref<HTMLElement | null>(null);

  const searchResults = ref<TokenSearchResult[]>([]);
  const showSearchDialog = ref(false);
  const isSearching = ref(false);
  const showTwitterExplainerDialog = ref(false);
  const pendingTwitterBroadcast = ref<{
    url: string;
    displayName: string;
    profileImageUrl?: string;
  } | null>(null);

  // Segment & prompt selection dialog state
  const showSegmentDialog = ref(false);
  const showRealtimeDialog = ref(false);
  const pendingMode = ref<'auto' | 'record' | null>(null);
  const pendingStreamerSelection = ref<ExtendedStreamer | null>(null);
  // Creator-layout opt-in for the auto-detect / record dialogs. Resolved from
  // a local creator profile that matches the streamer's platform + platformId
  // and has saved `clip_build_defaults`. Eligibility is shared between dialogs;
  // the record dialog binds its own checkbox via `recordUseCreatorLayout`,
  // while the realtime dialog manages its checkbox internally.
  const pendingCreatorProfile = ref<CreatorProfileWithLinks | null>(null);
  const creatorLayoutEligible = ref(false);
  const creatorLayoutCreatorName = ref<string | null>(null);
  const recordUseCreatorLayout = ref(false);
  const selectedDuration = ref<number>(5);
  const availableDurationsAuto = [3, 5, 10, 15, 30];
  const availableDurationsRecord = [3, 5, 10, 15, 30, 60, 0]; // 0 => Entire stream

  const prompts = ref<{ id: string; name: string; content: string }[]>([]);
  const loadingPrompts = ref(false);
  const selectedPromptId = ref<string>('');
  const selectedPromptName = ref<string>('');
  const selectedPromptContent = ref<string>('');
  const showPromptDropdown = ref(false);
  const dropdownTriggerRef = ref<HTMLElement | null>(null);
  const dropdownMenuStyle = ref<{ top: string; left: string; width: string }>({ top: '0px', left: '0px', width: '300px' });

  const livestreamStore = useLivestreamStore();
  const realtimeDetection = useRealtimeClipDetection();

  const {
    activeSessions,
    monitoredStreamers,
    startMonitoring,
    stopMonitoring,
    activityLogs,
    addActivityLog,
    clearLogs,
    dvrSessions,
    hasDvrRecording,
    twitterDvrSessions,
    kickDvrSessions,
    twitchDvrSessions,
    youtubeDvrSessions,
    rumbleDvrSessions,
    initAutoDvrPolling,
    cleanupStreamerDvr,
    tryRemoveEndedTwitterBroadcastById,
  } = useLivestreamMonitoring();

  const { hoursRemaining, fetchBalance } = useCreditBalance();

  const isDetectingAny = computed(() => monitoredStreamers.value.size > 0 || activeSessions.value.size > 0);
  const showActivity = computed(() => isDetectingAny.value && activityLogs.value.length > 0);
  const liveChannelCount = computed(() => streamers.value.filter((s) => s.isLive).length);
  const recordDurationOptions = computed(() =>
    availableDurationsRecord.map((duration) => ({
      value: duration,
      label: duration === 0 ? 'Entire' : `${duration}m`,
      title: duration === 0 ? 'Entire stream' : `${duration} minutes`,
    }))
  );

  const sortedStreamers = computed(() => {
    return [...streamers.value].sort((a, b) => {
      const getPriority = (s: ExtendedStreamer) => {
        if (s.isDetecting) return 1;
        if (s.isLive) return 2;
        return 3;
      };

      const aPriority = getPriority(a);
      const bPriority = getPriority(b);

      if (aPriority !== bPriority) return aPriority - bPriority;

      const aName = (a.displayName || a.mintId).toLowerCase();
      const bName = (b.displayName || b.mintId).toLowerCase();
      return aName.localeCompare(bName);
    });
  });

  // Group streamers by platform
  const streamersByPlatform = computed(() => {
    const grouped: Record<Platform, ExtendedStreamer[]> = {
      Kick: [],
      Twitch: [],
      PumpFun: [],
      YouTube: [],
      Rumble: [],
      Twitter: [],
      Tokend: [],
    };

    sortedStreamers.value.forEach(streamer => {
      if (grouped[streamer.platform]) {
        grouped[streamer.platform].push(streamer);
      }
    });

    // Get all platforms that have streamers and sort alphabetically
    const platformsWithStreamers = Object.keys(grouped)
      .filter(platform => grouped[platform as Platform].length > 0)
      .sort() as Platform[];

    return platformsWithStreamers.map(platform => ({
      platform,
      streamers: grouped[platform],
      count: grouped[platform].length,
    }));
  });

  const showCreditWarningDialog = ref(false);
  const pendingStreamerStart = ref<{ streamer: ExtendedStreamer; detectClips: boolean } | null>(null);
  const showAutoDetectLimitDialog = ref(false);
  const autoDetectLimitDialogData = ref<{ activeStreamerName: string; requestedStreamerName: string }>({ activeStreamerName: '', requestedStreamerName: '' });

  const liveStatusInterval = ref<number | null>(null);
  const { maybeStartPageTour } = useAppTour();
  const { mockStreamerActive } = useTourFlags();

  onMounted(async () => {
    await loadStreamers();
    refreshStreamerMetadata();
    syncDetectionState();
    checkAllLiveStatuses();

    // Initialize Auto DVR polling for streamers with auto_dvr enabled
    initAutoDvrPolling();

    liveStatusInterval.value = window.setInterval(() => {
      checkAllLiveStatuses();
    }, 60_000);

    window.addEventListener('livestream-clip-created', handleGlobalClipCreated as EventListener);
    window.addEventListener('realtime-clip-detected', handleRealtimeClipDetected as EventListener);
    window.addEventListener('realtime-detection-stopped', handleRealtimeDetectionStopped as EventListener);
    window.addEventListener('monitored-streamers-updated', handleMonitoredStreamersUpdated as EventListener);
    maybeStartPageTour('page_live_clip');
  });

  async function maybeRemoveEndedTwitterBroadcast(streamer: ExtendedStreamer, isLive: boolean) {
    if (
      streamer.platform !== 'Twitter' ||
      !isDirectTwitterLiveUrl(streamer.mintId) ||
      isLive ||
      streamer.isDetecting
    ) {
      return;
    }
    await tryRemoveEndedTwitterBroadcastById(streamer.id, 'stream-offline');
  }

  async function checkAllLiveStatuses() {
    const promises = streamers.value.map(async (streamer) => {
      if (streamer.isDetecting) return;

      const index = streamers.value.findIndex((s) => s.id === streamer.id);
      if (index !== -1) {
        streamers.value[index] = { ...streamers.value[index], isCheckingLive: true };
      }

      try {
        // Use persisted database value to detect actual state changes
        const wasLive = streamer.isCurrentlyLive;
        
        const status = await fetchLiveStatus(streamer.mintId, streamer.platform);
        const idx = streamers.value.findIndex((s) => s.id === streamer.id);
        if (idx !== -1) {
          streamers.value[idx] = {
            ...streamers.value[idx],
            isLive: status.isLive,
            isCurrentlyLive: status.isLive,
            viewerCount: status.numParticipants,
            isCheckingLive: false,
          };
          
          // Persist live status to database
          await updateMonitoredStreamer(streamer.id, {
            is_currently_live: status.isLive,
            last_check_timestamp: Date.now(),
          });

          await maybeRemoveEndedTwitterBroadcast(streamer, status.isLive);
          
          // Note: No "went live" toast on the Live page — status is already visible in the UI.
          // The global monitoring composable handles toasts for other pages.
        }
      } catch (error) {
        console.error('[LiveClip] Failed to check live status for', streamer.mintId, error);
        const idx = streamers.value.findIndex((s) => s.id === streamer.id);
        if (idx !== -1) {
          streamers.value[idx] = { ...streamers.value[idx], isCheckingLive: false };
        }
      }
    });

    await Promise.all(promises);
  }

  async function checkSingleLiveStatus(streamer: ExtendedStreamer, showSpinner: boolean = false) {
    if (streamer.isDetecting) return;

    const index = streamers.value.findIndex((s) => s.id === streamer.id);
    if (index === -1) return;

    if (showSpinner) {
      streamers.value[index] = { ...streamers.value[index], isCheckingLive: true };
    }

    try {
      const wasLive = streamer.isCurrentlyLive;
      const status = await fetchLiveStatus(streamer.mintId, streamer.platform);
      
      const updatedStreamer: Record<string, any> = {
        ...streamers.value[index],
        isLive: status.isLive,
        isCurrentlyLive: status.isLive,
        viewerCount: status.numParticipants,
        isCheckingLive: false,
      };
      // Update profile image if we got one and the streamer doesn't have one yet
      if (status.profileImageUrl && !streamer.profileImageUrl) {
        updatedStreamer.profileImageUrl = status.profileImageUrl;
      }
      streamers.value[index] = updatedStreamer as ExtendedStreamer;
      
      // Persist live status to database
      const dbUpdates: Record<string, any> = {
        is_currently_live: status.isLive,
        last_check_timestamp: Date.now(),
      };
      if (status.profileImageUrl && !streamer.profileImageUrl) {
        dbUpdates.profile_image_url = status.profileImageUrl;
      }
      await updateMonitoredStreamer(streamer.id, dbUpdates);

      await maybeRemoveEndedTwitterBroadcast(streamer, status.isLive);
      
      // Note: No "went live" toast on the Live page — status is already visible in the UI.
      // The global monitoring composable handles toasts for other pages.
    } catch (error) {
      console.error('[LiveClip] Failed to check live status for', streamer.mintId, error);
      if (showSpinner) {
        streamers.value[index] = { ...streamers.value[index], isCheckingLive: false };
      }
    }
  }

  async function refreshLiveStatus(streamer: ExtendedStreamer) {
    await checkSingleLiveStatus(streamer, true);
  }

  async function refreshSingleStreamerMetadata(streamer: ExtendedStreamer) {
    const needsUpdate = 
      (streamer.platform === 'PumpFun' && (streamer.displayName === streamer.mintId || !streamer.profileImageUrl)) ||
      (streamer.platform === 'Kick' && (!streamer.profileImageUrl || streamer.displayName === streamer.mintId)) ||
      (streamer.platform === 'Twitch' && (!streamer.profileImageUrl || streamer.displayName === streamer.mintId)) ||
      (streamer.platform === 'YouTube' && !streamer.profileImageUrl) ||
      (streamer.platform === 'Rumble' && !streamer.profileImageUrl) ||
      (streamer.platform === 'Twitter' &&
        (streamer.mintId.includes('/i/broadcasts/') ||
          streamer.mintId.includes('/i/spaces/') ||
          streamer.mintId.includes('/i/events/')));

    if (!needsUpdate) return;

    try {
      if (streamer.platform === 'YouTube') {
        const channelInfo = await getYouTubeChannelInfo(streamer.mintId);
        if (channelInfo?.profileImageUrl) {
          const updates: any = {
            profile_image_url: channelInfo.profileImageUrl,
          };
          if (channelInfo.displayName && streamer.displayName === streamer.mintId) {
            updates.display_name = channelInfo.displayName;
          }
          await updateMonitoredStreamer(streamer.id, updates);
          streamer.profileImageUrl = channelInfo.profileImageUrl;
          if (updates.display_name) streamer.displayName = updates.display_name;
        }
      } else if (streamer.platform === 'Rumble') {
        const channelInfo = await getRumbleChannelInfo(streamer.mintId);
        if (channelInfo?.profileImageUrl) {
          const updates: any = {
            profile_image_url: channelInfo.profileImageUrl,
          };
          if (channelInfo.displayName && streamer.displayName === streamer.mintId) {
            updates.display_name = channelInfo.displayName;
          }
          await updateMonitoredStreamer(streamer.id, updates);
          streamer.profileImageUrl = channelInfo.profileImageUrl;
          if (updates.display_name) streamer.displayName = updates.display_name;
        }
      } else if (streamer.platform === 'Kick') {
        const status = await checkKickLivestream(streamer.mintId);
        const updates: any = {};

        if (streamer.displayName === streamer.mintId && status.username) {
          updates.display_name = status.username;
        }
        if (!streamer.profileImageUrl && status.profileImageUrl) {
          updates.profile_image_url = status.profileImageUrl;
        }

        if (Object.keys(updates).length > 0) {
          await updateMonitoredStreamer(streamer.id, updates);
          if (updates.display_name) streamer.displayName = updates.display_name;
          if (updates.profile_image_url) streamer.profileImageUrl = updates.profile_image_url;
        }
      } else if (streamer.platform === 'Twitch') {
        const status = await checkTwitchLivestream(streamer.mintId);
        const updates: any = {};

        if (streamer.displayName === streamer.mintId && status.displayName) {
          updates.display_name = status.displayName;
        }
        if (!streamer.profileImageUrl && status.profileImageUrl) {
          updates.profile_image_url = status.profileImageUrl;
        }

        if (Object.keys(updates).length > 0) {
          await updateMonitoredStreamer(streamer.id, updates);
          if (updates.display_name) streamer.displayName = updates.display_name;
          if (updates.profile_image_url) streamer.profileImageUrl = updates.profile_image_url;
        }
      } else if (streamer.platform === 'Twitter') {
        // For Twitter broadcasts/spaces, fetch metadata to get username
        if (
          streamer.mintId.includes('/i/broadcasts/') ||
          streamer.mintId.includes('/i/spaces/') ||
          streamer.mintId.includes('/i/events/')
        ) {
          const metadata = await getTwitterBroadcastInfo(streamer.mintId);
          const updates: any = {};

          // Extract username from metadata
          const username = metadata.username || metadata.uploader;
          if (username) {
            updates.display_name = username.replace('@', '');
          }
          if (!streamer.profileImageUrl && metadata.avatarUrl) {
            updates.profile_image_url = metadata.avatarUrl;
          }
          if (!streamer.streamThumbnailUrl && metadata.thumbnail) {
            updates.stream_thumbnail_url = metadata.thumbnail;
          }

          if (Object.keys(updates).length > 0) {
            await updateMonitoredStreamer(streamer.id, updates);
            if (updates.display_name) streamer.displayName = updates.display_name;
            if (updates.profile_image_url) streamer.profileImageUrl = updates.profile_image_url;
            if (updates.stream_thumbnail_url) streamer.streamThumbnailUrl = updates.stream_thumbnail_url;
          }
        }
      } else {
        let match: TokenSearchResult | null = null;

        const results = await searchPumpFunTokens(streamer.mintId);
        if (results && results.length > 0) {
          match = results.find((r) => r.mint === streamer.mintId) || results[0];
        }

        if (!match || !match.image) {
          const serverMeta = await fetchTokenMetadataFromServer(streamer.mintId);
          if (serverMeta) {
            match = serverMeta;
          }
        }

        if (match) {
          const updates: any = {};
          if (streamer.displayName === streamer.mintId) {
            updates.display_name = match.symbol;
          }
          if (!streamer.profileImageUrl && match.image) {
            updates.profile_image_url = match.image;
          }

          if (Object.keys(updates).length > 0) {
            await updateMonitoredStreamer(streamer.id, updates);
            if (updates.display_name) streamer.displayName = updates.display_name;
            if (updates.profile_image_url) streamer.profileImageUrl = updates.profile_image_url;
          }
        }
      }
    } catch (e) {
      console.error('Failed to refresh metadata for', streamer.mintId, e);
    }
  }

  async function refreshStreamerMetadata() {
    const needsUpdate = streamers.value.filter(
      (s) =>
        (s.platform === 'PumpFun' && (s.displayName === s.mintId || !s.profileImageUrl)) ||
        (s.platform === 'Kick' && (!s.profileImageUrl || s.displayName === s.mintId)) ||
        (s.platform === 'Twitch' && (!s.profileImageUrl || s.displayName === s.mintId)) ||
        (s.platform === 'YouTube' && !s.profileImageUrl) ||
        (s.platform === 'Rumble' && !s.profileImageUrl) ||
        (s.platform === 'Twitter' &&
          (s.mintId.includes('/i/broadcasts/') ||
            s.mintId.includes('/i/spaces/') ||
            s.mintId.includes('/i/events/')))
    );

    if (needsUpdate.length === 0) return;

    for (const streamer of needsUpdate) {
      await refreshSingleStreamerMetadata(streamer);
    }
  }

  onUnmounted(() => {
    if (liveStatusInterval.value) {
      clearInterval(liveStatusInterval.value);
      liveStatusInterval.value = null;
    }

    // Detection state, timers, and Tauri listeners live at module scope in
    // useRealtimeClipDetection, so navigation away from /live-clip does NOT
    // stop detection. It continues running until: user clicks Stop, recorder
    // exits (stream offline), stream-ended event fires, credits run out, or
    // the stale-buffer guard trips. Credits are billed per Whisper batch in
    // useRealtimeTranscription.chargeForAudioSent — there is no wall-clock
    // interval to leak. Re-mounting the page picks up the live state via
    // syncDetectionState and the reactive `realtimeDetection.isActive` ref.
    window.removeEventListener('livestream-clip-created', handleGlobalClipCreated as EventListener);
    window.removeEventListener('realtime-clip-detected', handleRealtimeClipDetected as EventListener);
    window.removeEventListener('realtime-detection-stopped', handleRealtimeDetectionStopped as EventListener);
    window.removeEventListener('monitored-streamers-updated', handleMonitoredStreamersUpdated as EventListener);
  });

  async function handleMonitoredStreamersUpdated(event: Event) {
    const detail = (event as CustomEvent<{ action?: string; streamerId?: string }>).detail;
    if (detail?.action === 'deleted' && detail.streamerId) {
      streamers.value = streamers.value.filter((s) => s.id !== detail.streamerId);
      return;
    }

    await loadStreamers();
  }

  function streamerHasTempRecording(streamerId: string): boolean {
    return (
      hasDvrRecording(streamerId) ||
      twitterDvrSessions.value.has(streamerId) ||
      kickDvrSessions.value.has(streamerId) ||
      twitchDvrSessions.value.has(streamerId) ||
      youtubeDvrSessions.value.has(streamerId) ||
      rumbleDvrSessions.value.has(streamerId)
    );
  }

  watch(
    [activeSessions, monitoredStreamers, dvrSessions, twitterDvrSessions, kickDvrSessions, twitchDvrSessions, youtubeDvrSessions, rumbleDvrSessions],
    () => syncDetectionState(),
    { deep: true }
  );

  function syncDetectionState() {
    streamers.value = streamers.value.map((streamer) => {
      const monitored = monitoredStreamers.value.get(streamer.id);
      const session = activeSessions.value.get(streamer.id);

      return {
        ...streamer,
        isDetecting: !!monitored,
        mode: monitored ? (monitored.options.mode === 'realtime-detect' ? 'Auto-Detect' : 'Record Only') : null,
        status: session ? (session.isStopping ? 'STOPPING' : 'LIVE') : monitored ? 'WAITING' : 'IDLE',
        isLive: monitored ? (session ? true : streamer.isLive) : streamer.isLive,
        hasTempRecording: streamerHasTempRecording(streamer.id),
      };
    });
  }

  /** Badge for a channel with an active Rec / Auto session. */
  function sessionBadge(streamer: ExtendedStreamer): { label: string; variant: BadgeVariants['variant'] } {
    const auto = streamer.mode === 'Auto-Detect';
    if (streamer.status === 'STOPPING') return { label: 'Stopping', variant: 'neutral' };
    if (streamer.status === 'LIVE') return { label: auto ? 'Detecting' : 'Recording', variant: auto ? 'ai' : 'brand' };
    return { label: auto ? 'Waiting · Auto' : 'Waiting · Rec', variant: 'neutral' };
  }

  async function openWatchDialog(streamer: ExtendedStreamer) {
    if (streamer.platform === 'Tokend') {
      const capabilities = await fetchTokendCapabilities().catch(() => null);
      if (!capabilities?.watch) {
        showError('Tokend Playback Unavailable', TOKEND_UNAVAILABLE_MESSAGES.playback);
        return;
      }
    }
    if (!streamer.isLive) return;

    livestreamStore.openWatchDialog(
      streamer.mintId,
      streamer.id,
      streamer.displayName,
      streamer.profileImageUrl,
      streamer.platform
    );
  }

  function handleGlobalClipCreated(event: CustomEvent<{ clipPath: string; projectId: string }>) {
    const { clipPath } = event.detail;
    const currentStreamer = livestreamStore.currentStreamer;
    addActivityLog({
      streamerId: currentStreamer.streamerId || 'system',
      streamerName: currentStreamer.displayName || 'System',
      platform: 'PumpFun',
      message: `Clip created: ${clipPath.split(/[\\/]/).pop()}`,
      status: 'success',
      mintId: currentStreamer.mintId,
      profileImageUrl: currentStreamer.profileImageUrl,
    });
  }

  function handleRealtimeClipDetected(event: CustomEvent<{ 
    clipId: string; 
    projectId: string; 
    title: string; 
    startTime: number; 
    duration: number;
    viralityScore: number;
    detectionReason: string;
  }>) {
    const { title, startTime, duration, viralityScore, detectionReason } = event.detail;
    
    // Find the streamer that's currently running real-time detection
    const activeStreamer = streamers.value.find(s => s.isDetecting && realtimeDetection.isActive.value);
    
    if (activeStreamer) {
      const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      };

      addActivityLog({
        streamerId: activeStreamer.id,
        streamerName: activeStreamer.displayName,
        platform: activeStreamer.platform,
        mintId: activeStreamer.mintId,
        message: `Viral clip detected: "${title}" (${formatTime(startTime)} - ${Math.floor(duration)}s, ${Math.round(viralityScore)}% viral)`,
        status: 'success',
        profileImageUrl: activeStreamer.profileImageUrl,
      });
    }
  }

  function handleRealtimeDetectionStopped(event: CustomEvent<{
    reason: 'recorder_exit' | 'stream_ended' | 'out_of_credits' | string;
    sessionId?: string;
    streamerId?: string;
  }>) {
    const { reason, streamerId } = event.detail || ({} as any);

    const streamer = streamerId
      ? streamers.value.find((s) => s.id === streamerId)
      : streamers.value.find((s) => s.isDetecting);

    const messageByReason: Record<string, string> = {
      recorder_exit: 'Real-time detection stopped — stream ended',
      stream_ended: 'Real-time detection stopped — stream ended',
      out_of_credits: 'Real-time detection stopped — out of credits',
    };
    const message = messageByReason[reason] || `Real-time detection stopped (${reason})`;

    if (streamer) {
      addActivityLog({
        streamerId: streamer.id,
        streamerName: streamer.displayName,
        platform: streamer.platform,
        mintId: streamer.mintId,
        message,
        status: 'info',
        profileImageUrl: streamer.profileImageUrl,
      });
    } else {
      console.log('[LiveClip] realtime-detection-stopped:', reason, '(no matching streamer)');
    }
  }

  async function loadStreamers() {
    try {
      const records = await getAllMonitoredStreamers();
      console.log('[LiveClip] Loaded streamers from database:', records.length, records);

      streamers.value = records.map((record) => {
        const monitored = monitoredStreamers.value.get(record.id);
        const session = activeSessions.value.get(record.id);

        const platformMap: Record<string, Platform> = {
          pumpfun: 'PumpFun',
          kick: 'Kick',
          twitch: 'Twitch',
          youtube: 'YouTube',
          rumble: 'Rumble',
          twitter: 'Twitter',
          tokend: 'Tokend',
        };
        const platform = platformMap[record.platform?.toLowerCase() || 'pumpfun'] || 'PumpFun';

        // Clean display name for Rumble channels (remove c/ or user/ prefix)
        let displayName = record.display_name;
        if (platform === 'Rumble' && displayName) {
          displayName = displayName.replace(/^(c\/|user\/)/, '');
        }

        const streamer = {
          id: record.id,
          mintId: record.mint_id,
          displayName: displayName,
          platform,
          lastCheckTimestamp: record.last_check_timestamp,
          isCurrentlyLive: Boolean(record.is_currently_live),
          currentSessionId: record.current_session_id,
          isDetecting: !!monitored,
          profileImageUrl: record.profile_image_url || undefined,
          streamThumbnailUrl: record.stream_thumbnail_url || undefined,
          segmentDurationMinutes: record.segment_duration_minutes ?? 5,
          mode: (monitored ? (monitored.options.mode === 'realtime-detect' ? 'Auto-Detect' : 'Record Only') : null) as 'Auto-Detect' | 'Record Only' | null,
          status: (session ? 'LIVE' : monitored ? 'WAITING' : 'IDLE') as 'LIVE' | 'WAITING' | 'IDLE' | 'STOPPING',
          selected: false,
          autoDvr: Boolean(record.auto_dvr),
        };
        
        console.log('[LiveClip] Mapped streamer:', streamer);
        return streamer;
      });
      
      console.log('[LiveClip] Final streamers array:', streamers.value);
    } catch (error) {
      console.error('[LiveClip] Failed to load monitored streamers', error);
    } finally {
      streamersLoaded.value = true;
    }
  }

  function detectPlatform() {
    const val = inputValue.value;

    if (extractMintId(val)) {
      detectedPlatform.value = 'PumpFun';
      return;
    }

    const lowerVal = val.toLowerCase();
    if (lowerVal.includes('youtube.com') || lowerVal.includes('youtu.be')) {
      detectedPlatform.value = 'YouTube';
    } else if (lowerVal.includes('twitch.tv')) {
      detectedPlatform.value = 'Twitch';
    } else if (lowerVal.includes('kick.com')) {
      detectedPlatform.value = 'Kick';
    } else if (lowerVal.includes('rumble.com')) {
      detectedPlatform.value = 'Rumble';
    } else if (lowerVal.includes('twitter.com') || lowerVal.includes('x.com')) {
      detectedPlatform.value = 'Twitter';
    } else if (
      canAccessTokend(authStore.user) &&
      (lowerVal.includes('tokend.tv') ||
        lowerVal.includes('localhost:4100') ||
        lowerVal.includes('127.0.0.1:4100'))
    ) {
      detectedPlatform.value = 'Tokend';
    } else {
      detectedPlatform.value = null;
    }
  }

  // Platform logos for section headers (SectionHeader takes an icon component).
  const platformHeaderIcons = new Map<string, Component>();
  function platformHeaderIcon(platform: string): Component {
    let icon = platformHeaderIcons.get(platform);
    if (!icon) {
      icon = defineComponent({
        inheritAttrs: false,
        setup: (_props, { attrs }) => () => h(PlatformLogo, { class: attrs.class as string, platform, size: 'xs' }),
      });
      platformHeaderIcons.set(platform, icon);
    }
    return icon;
  }

  const supportedLivePlatforms = ['Kick', 'Twitch', 'YouTube', 'Rumble', 'Twitter', 'PumpFun'];

  function formatViewerCount(count: number): string {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return count.toString();
  }

  function extractIdentifier(input: string): string {
    try {
      const url = new URL(input);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        return parts[parts.length - 1];
      }
    } catch {
      // plain mint or text
    }
    return input.slice(0, 16);
  }

  async function addStreamer() {
    if (!inputValue.value) return;

    // Handle YouTube
    if (detectedPlatform.value === 'YouTube') {
      const channelId = extractYouTubeChannel(inputValue.value);
      if (channelId) {
        addActivityLog({
          streamerId: 'system',
          streamerName: 'System',
          platform: 'YouTube',
          message: `Adding YouTube channel "${channelId}"...`,
          status: 'loading',
        });

        await confirmAddStreamer(channelId, channelId, undefined, 'youtube');
        return;
      }
    }

    // Handle Rumble
    if (detectedPlatform.value === 'Rumble') {
      const channelName = extractRumbleChannel(inputValue.value);
      if (channelName) {
        // Clean display name by removing c/ or user/ prefix
        const displayName = channelName.replace(/^(c\/|user\/)/, '');
        
        addActivityLog({
          streamerId: 'system',
          streamerName: 'System',
          platform: 'Rumble',
          message: `Adding Rumble channel "${displayName}"...`,
          status: 'loading',
        });

        await confirmAddStreamer(channelName, displayName, undefined, 'rumble');
        return;
      } else {
        addActivityLog({
          streamerId: 'system',
          streamerName: 'System',
          platform: 'Rumble',
          message: `Could not extract a Rumble channel from "${inputValue.value}". Please use a channel URL like rumble.com/c/ChannelName.`,
          status: 'info',
        });
        return;
      }
    }

    // Handle Twitter — direct broadcast/Space/event URLs only
    if (detectedPlatform.value === 'Twitter') {
      const rawInput = inputValue.value.trim();
      if (isTwitterProfileOrHandleInput(rawInput)) {
        addActivityLog({
          streamerId: 'system',
          streamerName: 'System',
          platform: 'Twitter',
          message:
            'Paste the link to the current live broadcast (e.g. x.com/i/broadcasts/… or x.com/i/spaces/…). X assigns a new URL each time they go live — profile links cannot be monitored.',
          status: 'info',
        });
        return;
      }

      let broadcastUrl = rawInput;
      if (!isDirectTwitterLiveUrl(broadcastUrl)) {
        addActivityLog({
          streamerId: 'system',
          streamerName: 'System',
          platform: 'Twitter',
          message:
            'Invalid X URL. Use a direct broadcast, Space, or event link (x.com/i/broadcasts/…, x.com/i/spaces/…, or x.com/i/events/…).',
          status: 'info',
        });
        return;
      }

      try {
        broadcastUrl = await validateTwitterUrl(broadcastUrl);
      } catch {
        broadcastUrl = normalizeTwitterUrl(broadcastUrl);
      }

      let displayName = extractTwitterBroadcastId(broadcastUrl) || 'X Broadcast';
      let profileImageUrl: string | undefined;
      try {
        const metadata = await getTwitterBroadcastInfo(broadcastUrl);
        if (metadata.title) displayName = metadata.title;
        if (metadata.thumbnail) profileImageUrl = metadata.thumbnail;
        if (metadata.username) {
          displayName = metadata.title ? metadata.title : `@${metadata.username} live`;
        }
      } catch (e) {
        console.warn('[LiveClip] Twitter metadata fetch failed, using defaults:', e);
      }

      pendingTwitterBroadcast.value = { url: broadcastUrl, displayName, profileImageUrl };
      showTwitterExplainerDialog.value = true;
      return;
    }

    // Handle Twitch
    if (detectedPlatform.value === 'Twitch') {
      const channelName = extractChannelName(inputValue.value);
      if (channelName) {
        addActivityLog({
          streamerId: 'system',
          streamerName: 'System',
          platform: 'Twitch',
          message: `Adding Twitch channel "${channelName}"...`,
          status: 'loading',
        });

        // Add immediately with basic info, fetch metadata in background
        await confirmAddStreamer(channelName, channelName, undefined, 'twitch');
        return;
      }
    }

    // Handle Kick
    if (detectedPlatform.value === 'Kick') {
      const channelSlug = extractChannelSlug(inputValue.value);
      if (channelSlug) {
        addActivityLog({
          streamerId: 'system',
          streamerName: 'System',
          platform: 'Kick',
          message: `Adding Kick channel "${channelSlug}"...`,
          status: 'loading',
        });

        // Add immediately with basic info, fetch metadata in background
        await confirmAddStreamer(channelSlug, channelSlug, undefined, 'kick');
        return;
      }
    }

    // Handle PumpFun mint ID
    const mintId = extractMintId(inputValue.value);
    if (mintId) {
      addActivityLog({
        streamerId: 'system',
        streamerName: 'System',
        platform: 'PumpFun',
        message: `Adding token ${mintId.slice(0, 8)}...`,
        status: 'loading',
      });

      const displayName = extractIdentifier(inputValue.value);
      // Add immediately with basic info, fetch metadata in background
      await confirmAddStreamer(mintId, displayName, undefined, 'pumpfun');
      return;
    }

    // Handle Tokend creator URL
    if (detectedPlatform.value === 'Tokend') {
      const slug = extractTokendChannel(inputValue.value) || inputValue.value.trim().replace(/^@/, '');
      if (!slug) {
        addActivityLog({
          streamerId: 'system',
          streamerName: 'System',
          platform: 'Tokend',
          message: 'Invalid Tokend creator URL.',
          status: 'info',
        });
        return;
      }

      addActivityLog({
        streamerId: 'system',
        streamerName: 'System',
        platform: 'Tokend',
        message: `Adding Tokend creator "${slug}"...`,
        status: 'loading',
      });

      let displayName = slug;
      let profileImageUrl: string | undefined;
      try {
        const status = await checkTokendLivestream(slug);
        if (status.displayName) displayName = status.displayName;
        if (status.profileImageUrl) profileImageUrl = status.profileImageUrl;
      } catch {
        // mock status optional at add time
      }

      await confirmAddStreamer(slug, displayName, profileImageUrl, 'tokend');
      return;
    }

    if (detectedPlatform.value === 'PumpFun' || !detectedPlatform.value) {
      isSearching.value = true;
      addActivityLog({
        streamerId: 'system',
        streamerName: 'System',
        platform: 'PumpFun',
        message: `Searching for "${inputValue.value}"...`,
        status: 'loading',
      });

      const results = await searchPumpFunTokens(inputValue.value);
      isSearching.value = false;

      if (results.length === 0) {
        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(inputValue.value)) {
          const serverMeta = await fetchTokenMetadataFromServer(inputValue.value);
          if (serverMeta) {
            addActivityLog({
              streamerId: 'system',
              streamerName: 'System',
              platform: 'PumpFun',
              message: `Found ${serverMeta.name} (${serverMeta.symbol}).`,
              status: 'success',
            });
            await confirmAddStreamer(serverMeta.mint, serverMeta.symbol, serverMeta.image);
            return;
          }
        }

        addActivityLog({
          streamerId: 'system',
          streamerName: 'System',
          platform: 'PumpFun',
          message: `No tokens found for "${inputValue.value}".`,
          status: 'info',
        });
        return;
      }

      if (results.length === 1) {
        const token = results[0];
        addActivityLog({
          streamerId: 'system',
          streamerName: 'System',
          platform: 'PumpFun',
          message: `Found ${token.name} (${token.symbol}).`,
          status: 'success',
        });
        await confirmAddStreamer(token.mint, token.symbol, token.image);
      } else {
        searchResults.value = results;
        showSearchDialog.value = true;
      }
    }
  }

  function cancelTwitterBroadcastAdd() {
    showTwitterExplainerDialog.value = false;
    pendingTwitterBroadcast.value = null;
  }

  async function confirmTwitterBroadcastAdd() {
    const pending = pendingTwitterBroadcast.value;
    if (!pending) {
      cancelTwitterBroadcastAdd();
      return;
    }

    showTwitterExplainerDialog.value = false;
    pendingTwitterBroadcast.value = null;

    addActivityLog({
      streamerId: 'system',
      streamerName: 'System',
      platform: 'Twitter',
      message: `Adding X broadcast "${pending.displayName}"...`,
      status: 'loading',
    });

    await confirmAddStreamer(pending.url, pending.displayName, pending.profileImageUrl, 'twitter');
  }

  async function confirmAddStreamer(
    platformId: string,
    displayName: string,
    profileImageUrl?: string,
    platform: string = 'pumpfun'
  ) {
    const platformDisplay = 
      platform === 'youtube' ? 'YouTube' : 
      platform === 'rumble' ? 'Rumble' :
      platform === 'twitter' ? 'Twitter' :
      platform === 'tokend' ? 'Tokend' :
      platform === 'kick' ? 'Kick' : 
      platform === 'twitch' ? 'Twitch' : 
      'PumpFun';
    try {
      // Check if streamer already exists
      const existingStreamer = streamers.value.find(s => s.mintId === platformId && s.platform === platformDisplay);
      if (existingStreamer) {
        addActivityLog({
          streamerId: platformId,
          streamerName: displayName,
          platform: platformDisplay,
          message: `${displayName} is already being tracked.`,
          status: 'info',
          mintId: platformId,
          profileImageUrl,
        });
        inputValue.value = '';
        detectedPlatform.value = null;
        showSearchDialog.value = false;
        return;
      }

      const newStreamerId = await createMonitoredStreamer(platformId, displayName, profileImageUrl, 5, false, platform);
      
      // Reload streamers from database
      await loadStreamers();
      
      // Clear input immediately
      inputValue.value = '';
      detectedPlatform.value = null;
      showSearchDialog.value = false;

      addActivityLog({
        streamerId: platformId,
        streamerName: displayName,
        platform: platformDisplay,
        message: 'Added to monitored list.',
        status: 'success',
        mintId: platformId,
        profileImageUrl,
      });
      
      // Find the newly added streamer and fetch metadata in background (non-blocking)
      const newStreamer = streamers.value.find(s => s.id === newStreamerId);
      if (newStreamer) {
        // Fire and forget - don't await these operations
        Promise.allSettled([
          refreshSingleStreamerMetadata(newStreamer),
          checkSingleLiveStatus(newStreamer)
        ]).then(() => {
          console.log('[LiveClip] Background metadata fetch completed for', platformId);
        });
      }
    } catch (error: any) {
      console.error('[LiveClip] Failed to add streamer', error);
      
      // Check if it's a duplicate error
      const isDuplicate = error?.message?.includes('UNIQUE constraint') || error?.toString()?.includes('UNIQUE constraint');
      
      addActivityLog({
        streamerId: platformId,
        streamerName: displayName,
        platform: platformDisplay,
        message: isDuplicate 
          ? `${displayName} is already being tracked.`
          : 'Failed to add streamer. Please try again.',
        status: 'info',
        mintId: platformId,
      });
      
      // Clear input on error
      inputValue.value = '';
      detectedPlatform.value = null;
      showSearchDialog.value = false;
    }
  }

  function selectSearchResult(token: TokenSearchResult) {
    confirmAddStreamer(token.mint, token.symbol, token.image);
  }

  async function removeStreamer(id: string) {
    try {
      const streamer = streamers.value.find((s) => s.id === id);

      if (streamer) {
        // Clean up DVR files (Kick/Twitch/PumpFun)
        try {
          await cleanupStreamerDvr(id, streamer.mintId);
          console.log('[LiveClip] Cleaned up DVR for', streamer.mintId);
        } catch (dvrError) {
          console.warn('[LiveClip] DVR cleanup warning:', dvrError);
        }

        // Clean up HLS recordings (legacy)
        try {
          await invoke('cleanup_hls_recordings', { mintId: streamer.mintId });
          console.log('[LiveClip] Cleaned up HLS recordings for', streamer.mintId);
        } catch (hlsError) {
          console.warn('[LiveClip] HLS cleanup warning:', hlsError);
        }
      }

      await deleteMonitoredStreamer(id);
      streamers.value = streamers.value.filter((s) => s.id !== id);
    } catch (error) {
      console.error('[LiveClip] Failed to remove streamer', error);
    }
  }

  async function startStreamer(streamer: ExtendedStreamer, detectClips: boolean) {
    if (streamer.platform === 'Tokend') {
      // Partner watch does not unlock Kick-style Rec/DVR sessions yet.
      showError('Tokend Recording Unavailable', TOKEND_UNAVAILABLE_MESSAGES.playback);
      return;
    }

    // Open selection dialog instead of immediate start
    pendingMode.value = detectClips ? 'auto' : 'record';
    pendingStreamerSelection.value = streamer;
    selectedDuration.value = streamer.segmentDurationMinutes || 5;
    selectedPromptId.value = '';
    selectedPromptName.value = '';
    selectedPromptContent.value = '';
    recordUseCreatorLayout.value = false;

    // Resolve creator-layout eligibility for whichever dialog is about to open.
    // Mirrors the StreamVods download flow: only local creator profiles with
    // saved `clip_build_defaults` are eligible.
    await resolveCreatorLayoutForStreamer(streamer);

    if (detectClips) {
      // Load prompts for real-time detection
      if (prompts.value.length === 0) {
        await loadPrompts();
      }
      showRealtimeDialog.value = true;
    } else {
      // Show segment dialog for recording
      showSegmentDialog.value = true;
    }
  }

  /**
   * Look up a local creator profile that matches the streamer's platform +
   * platformId and has saved `clip_build_defaults`, and stash it (plus
   * eligibility flags) so the auto-detect and record dialogs can offer
   * "Use creator layout" parity with the VOD download flow.
   */
  async function resolveCreatorLayoutForStreamer(streamer: ExtendedStreamer) {
    pendingCreatorProfile.value = null;
    creatorLayoutEligible.value = false;
    creatorLayoutCreatorName.value = null;
    try {
      const linkPlatform = monitoredPlatformToCreatorLinkPlatform(streamer.platform);
      if (linkPlatform && streamer.mintId) {
        const profile = await getCreatorProfileByPlatformId(linkPlatform, streamer.mintId);
        if (profile && parseCreatorClipBuildDefaults(profile.clip_build_defaults ?? null)) {
          pendingCreatorProfile.value = profile;
          creatorLayoutEligible.value = true;
          creatorLayoutCreatorName.value = profile.name || null;
        }
      }
    } catch (err) {
      console.warn('[LiveClip] Failed to look up creator layout for streamer:', err);
    }
  }

  /**
   * Map the title-cased `SupportedLivestreamPlatform` used by the live-stream
   * monitor to the lower-cased `CreatorPlatformLink['platform']` enum.
   */
  function monitoredPlatformToCreatorLinkPlatform(
    platform: Platform
  ): 'pumpfun' | 'kick' | 'twitch' | 'YouTube' | 'rumble' | 'twitter' | null {
    switch (platform) {
      case 'PumpFun':
        return 'pumpfun';
      case 'Kick':
        return 'kick';
      case 'Twitch':
        return 'twitch';
      case 'YouTube':
        return 'YouTube';
      case 'Rumble':
        return 'rumble';
      case 'Twitter':
        return 'twitter';
      default:
        return null;
    }
  }

  async function handleRealtimeDetectionConfirm(data: {
    promptId: string;
    promptContent: string;
    useCreatorLayout: boolean;
  }) {
    if (!pendingStreamerSelection.value) return;

    const streamer = pendingStreamerSelection.value;
    selectedPromptId.value = data.promptId;
    selectedPromptContent.value = data.promptContent;

    // Check if auto-detection is already active on another stream
    if (realtimeDetection.isActive.value) {
      // Find the currently detecting streamer
      const detectingStreamer = streamers.value.find(s => s.isDetecting && s.mode === 'Auto-Detect');
      if (detectingStreamer) {
        autoDetectLimitDialogData.value = {
          activeStreamerName: detectingStreamer.displayName,
          requestedStreamerName: streamer.displayName,
        };
        showAutoDetectLimitDialog.value = true;
        return;
      }
    }

    // Realtime detection owns AI decisions. Monitoring only records and feeds
    // short segments into the 30s transcript detector.
    await updateSegmentDuration(streamer, 1);

    // Only seed creator layout if the dialog confirmed opt-in AND we resolved
    // a profile for this streamer. The dialog already gates the flag on
    // eligibility, but defensively double-check so a stale ref can't leak in.
    const applyCreatorLayout =
      data.useCreatorLayout &&
      creatorLayoutEligible.value &&
      !!pendingCreatorProfile.value?.id;
    const creatorProfileId = applyCreatorLayout ? pendingCreatorProfile.value!.id : undefined;

    await startMonitoring([streamer], {
      mode: 'realtime-detect',
      segmentDurationMinutes: 1,
      promptId: data.promptId || undefined,
      promptContent: data.promptContent || undefined,
      creatorProfileId,
      applyCreatorClipLayout: applyCreatorLayout,
      maxDetectionMinutes: 60,
    });

    // Move streamer to top of list
    const index = streamers.value.findIndex((s) => s.id === streamer.id);
    if (index > 0) {
      const [movedStreamer] = streamers.value.splice(index, 1);
      streamers.value.unshift(movedStreamer);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }


  function confirmCreditWarning() {
    if (pendingStreamerStart.value) {
      executeStartStreamer(pendingStreamerStart.value.streamer, pendingStreamerStart.value.detectClips, selectedDuration.value, {
        promptId: selectedPromptId.value || undefined,
        promptContent: selectedPromptContent.value || undefined,
      });
      pendingStreamerStart.value = null;
    }
    showCreditWarningDialog.value = false;
  }

  async function executeStartStreamer(
    streamer: ExtendedStreamer,
    detectClips: boolean,
    durationOverride?: number,
    prompt?: { promptId?: string; promptContent?: string },
    creatorLayout?: { creatorProfileId?: string; applyCreatorClipLayout?: boolean }
  ) {
    if (!isDetectingAny.value) {
      clearLogs();
    }

    const segmentDurationMinutes =
      typeof durationOverride === 'number' ? durationOverride : streamer.segmentDurationMinutes;

    if (typeof segmentDurationMinutes === 'number' && segmentDurationMinutes > 0) {
      await updateSegmentDuration(streamer, segmentDurationMinutes);
    }

    await startMonitoring([streamer], {
      mode: detectClips ? 'realtime-detect' : 'record',
      segmentDurationMinutes: detectClips
        ? 1
        : (segmentDurationMinutes ?? streamer.segmentDurationMinutes ?? 5),
      promptId: prompt?.promptId,
      promptContent: prompt?.promptContent,
      creatorProfileId: creatorLayout?.creatorProfileId,
      applyCreatorClipLayout: creatorLayout?.applyCreatorClipLayout,
      maxDetectionMinutes: detectClips ? 60 : undefined,
    });

    const index = streamers.value.findIndex((s) => s.id === streamer.id);
    if (index > 0) {
      const [movedStreamer] = streamers.value.splice(index, 1);
      streamers.value.unshift(movedStreamer);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function stopStreamer(streamer: ExtendedStreamer) {
    try {
      // Stop real-time detection if active
      if (realtimeDetection.isActive.value) {
        const creditsUsed = realtimeDetection.creditsUsed.value;
        const durationMinutes = realtimeDetection.detectionDurationMinutes.value;
        
        realtimeDetection.stopDetection();
        
        addActivityLog({
          streamerId: streamer.id,
          streamerName: streamer.displayName,
          platform: streamer.platform,
          mintId: streamer.mintId,
          message: `Real-time detection stopped (${durationMinutes} min, ${creditsUsed} credits used)`,
          status: 'success',
          profileImageUrl: streamer.profileImageUrl,
        });
      }

      await stopMonitoring([streamer.id]);
      resolvePendingLogs();
      
      if (!realtimeDetection.isActive.value) {
        addActivityLog({
          streamerId: streamer.id,
          streamerName: streamer.displayName,
          platform: streamer.platform,
          mintId: streamer.mintId,
          message: `${streamer.isDetecting ? 'Detection' : 'Recording'} stopped by user`,
          status: 'success',
          profileImageUrl: streamer.profileImageUrl,
        });
      }
    } catch (error) {
      console.error('Failed to stop monitoring', error);
    }
  }

  async function loadPrompts() {
    try {
      loadingPrompts.value = true;
      const { getAllPrompts } = await import('@/services/database');
      const list = await getAllPrompts();
      prompts.value = list || [];

      // Auto-select default prompt if none selected
      if (prompts.value.length > 0 && !selectedPromptId.value) {
        const defaultPrompt = prompts.value.find((p) => p.name === 'Default Clip Detector');
        const promptToSelect = defaultPrompt || prompts.value[0];
        selectedPromptId.value = promptToSelect.id;
        selectedPromptName.value = promptToSelect.name;
        selectedPromptContent.value = promptToSelect.content;
      }
    } catch (e) {
      console.error('[LiveClip] Failed to load prompts', e);
    } finally {
      loadingPrompts.value = false;
    }
  }

  function openSegmentDialogFor(streamer: ExtendedStreamer, mode: 'auto' | 'record') {
    pendingMode.value = mode;
    pendingStreamerSelection.value = streamer;
    selectedDuration.value = streamer.segmentDurationMinutes || 5;
    showSegmentDialog.value = true;
  }

  function handleConfirmSegmentDialog() {
    if (!pendingStreamerSelection.value || !pendingMode.value) return;
    const detectClips = pendingMode.value === 'auto';

    // Validate prompt for auto
    if (detectClips && !selectedPromptId.value) {
      return;
    }

    const streamer = pendingStreamerSelection.value;
    showSegmentDialog.value = false;

    // Existing gating/credits flow reused
    proceedStartWithGuards(streamer, detectClips);
  }

  async function proceedStartWithGuards(streamer: ExtendedStreamer, detectClips: boolean) {
    const modeLabel = detectClips ? 'Auto-Detect' : 'Record';
    if (
      !(await requireSubscription({
        context: `${modeLabel} mode for ${streamer.displayName}`,
        type: 'live',
      }))
    ) {
      return;
    }

    if (detectClips) {
      // Check if auto-detection is already active on another stream
      if (realtimeDetection.isActive.value) {
        // Find the currently detecting streamer
        const detectingStreamer = streamers.value.find(s => s.isDetecting && s.mode === 'Auto-Detect');
        if (detectingStreamer) {
          autoDetectLimitDialogData.value = {
            activeStreamerName: detectingStreamer.displayName,
            requestedStreamerName: streamer.displayName,
          };
          showAutoDetectLimitDialog.value = true;
          return;
        }
      }

      if (!(await gates.aiDetection(`Use AI clip detection for ${streamer.displayName}`))) {
        return;
      }

      await fetchBalance();
      const balance = hoursRemaining.value;

      if (balance !== 'unlimited' && typeof balance === 'number' && balance < 1) {
        pendingStreamerStart.value = { streamer, detectClips };
        showCreditWarningDialog.value = true;
        return;
      }
    }

    // For record mode the inline dialog binds `recordUseCreatorLayout` directly.
    // Defensively re-check eligibility so a stale ref can't leak in. Auto-detect
    // mode has its own checkbox inside RealtimeDetectionDialog and follows a
    // different code path, so we only honor the record opt-in here.
    const applyCreatorLayout =
      !detectClips &&
      recordUseCreatorLayout.value &&
      creatorLayoutEligible.value &&
      !!pendingCreatorProfile.value?.id;
    const creatorProfileId = applyCreatorLayout ? pendingCreatorProfile.value!.id : undefined;

    await executeStartStreamer(
      streamer,
      detectClips,
      selectedDuration.value,
      {
        promptId: selectedPromptId.value || undefined,
        promptContent: selectedPromptContent.value || undefined,
      },
      {
        creatorProfileId,
        applyCreatorClipLayout: applyCreatorLayout,
      }
    );
  }

  function closeSegmentDialog() {
    showSegmentDialog.value = false;
    showPromptDropdown.value = false;
    pendingMode.value = null;
    pendingStreamerSelection.value = null;
  }

  function selectDuration(duration: number) {
    selectedDuration.value = duration;
  }

  function selectPrompt(prompt: { id: string; name: string; content: string }) {
    selectedPromptId.value = prompt.id;
    selectedPromptName.value = prompt.name;
    selectedPromptContent.value = prompt.content;
  }

  function selectPromptAndClose(prompt: { id: string; name: string; content: string }) {
    selectPrompt(prompt);
    showPromptDropdown.value = false;
  }

  function togglePromptDropdown() {
    if (!showPromptDropdown.value && dropdownTriggerRef.value) {
      const rect = dropdownTriggerRef.value.getBoundingClientRect();
      dropdownMenuStyle.value = {
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
      };
    }
    showPromptDropdown.value = !showPromptDropdown.value;
  }

  function resolvePendingLogs() {
    activityLogs.value.forEach((log) => {
      if (log.status === 'loading') {
        log.status = 'info';
      }
    });
  }

  async function updateSegmentDuration(streamer: ExtendedStreamer, duration: number) {
    try {
      await updateMonitoredStreamer(streamer.id, { segment_duration_minutes: duration });
      const index = streamers.value.findIndex((s) => s.id === streamer.id);
      if (index !== -1) {
        streamers.value[index] = { ...streamers.value[index], segmentDurationMinutes: duration };
      }
    } catch (error) {
      console.error('[LiveClip] Failed to update segment duration', error);
    }
  }

  async function updateAutoDvr(streamer: ExtendedStreamer, enabled: boolean) {
    try {
      await updateMonitoredStreamer(streamer.id, { auto_dvr: enabled ? 1 : 0 });
      const index = streamers.value.findIndex((s) => s.id === streamer.id);
      if (index !== -1) {
        streamers.value[index] = { ...streamers.value[index], autoDvr: enabled };
      }
    } catch (error) {
      console.error('[LiveClip] Failed to update auto DVR', error);
    }
  }
</script>

<style scoped>
  /* Channels / activity rows added or removed after the first render. */
  .list-move,
  .list-enter-active,
  .list-leave-active {
    transition:
      opacity var(--duration-base) var(--ease-out),
      transform var(--duration-base) var(--ease-out);
  }
  .list-enter-from,
  .list-leave-to {
    opacity: 0;
    transform: translateY(4px);
  }
  .list-leave-active {
    position: absolute;
    z-index: 0;
  }
</style>
