<template>
  <div class="liveclip">
    <PageLayout title="Live Clip" description="Real-time clip detection" :show-header="true" :icon="Radio">
      <template #actions>
        <div class="liveclip-actions">
          <div class="liveclip-search">
            <transition name="scale" mode="out-in">
              <div
                v-if="detectedPlatform === 'Youtube'"
                class="liveclip-search__platform liveclip-search__platform--youtube"
                key="yt"
              >
                <img src="/youtube.svg" class="liveclip-search__platform-icon" />
              </div>
              <div
                v-else-if="detectedPlatform === 'Twitch'"
                class="liveclip-search__platform liveclip-search__platform--twitch"
                key="tw"
              >
                <img src="/twitch.svg" class="liveclip-search__platform-icon" />
              </div>
              <div
                v-else-if="detectedPlatform === 'Kick'"
                class="liveclip-search__platform liveclip-search__platform--kick"
                key="kick"
              >
                <img src="/kick.svg" class="liveclip-search__platform-icon liveclip-search__platform-icon--dark" />
              </div>
              <div
                v-else-if="detectedPlatform === 'PumpFun'"
                class="liveclip-search__platform liveclip-search__platform--pumpfun"
                key="pf"
              >
                <img src="/capsule.svg" class="liveclip-search__platform-icon" />
              </div>
              <Search v-else class="liveclip-search__icon" key="search" />
            </transition>
            <Input
              v-model="inputValue"
              class="liveclip-search__input"
              placeholder="Paste stream link or Mint ID..."
              @keyup.enter="addStreamer"
              @input="detectPlatform"
            />
          </div>
          <Button size="sm" class="liveclip-add-btn" :disabled="!inputValue" @click="addStreamer">
            <Plus class="liveclip-add-btn__icon" />
            Track
          </Button>
        </div>
      </template>

      <div class="liveclip__content" :class="{ 'liveclip__content--empty': streamers.length === 0 }">
        <!-- Page Heading (hidden in empty state) -->
        <div v-if="streamers.length > 0" class="liveclip__heading">
          <h1 class="liveclip__title">Live Stream Monitor</h1>
          <p class="liveclip__subtitle">Track streams and detect clips in real-time with AI-powered analysis</p>
        </div>

        <!-- Main Grid -->
        <div
          v-if="streamers.length > 0"
          class="liveclip__grid"
          :class="{ 'liveclip__grid--with-logs': isDetectingAny && activityLogs.length > 0 }"
        >
          <!-- Streamers Column -->
          <div class="liveclip__streamers">
            <!-- Item Count -->
            <div class="liveclip__item-count">
              {{ streamers.length }} {{ streamers.length === 1 ? 'channel' : 'channels' }}
            </div>

            <!-- Streamer Cards -->
            <div class="liveclip__list">
              <transition-group name="list" tag="div" class="liveclip__list-inner">
                <div
                  v-for="streamer in sortedStreamers"
                  :key="streamer.id"
                  class="monitor-card"
                  :class="{
                    'monitor-card--active': streamer.isDetecting,
                    'monitor-card--live': !streamer.isDetecting && streamer.isLive,
                  }"
                >
                  <div class="monitor-card__content">
                    <!-- Header: Avatar + Info + Status -->
                    <div class="monitor-card__header">
                      <div class="monitor-card__avatar">
                        <img
                          v-if="streamer.profileImageUrl || streamer.streamThumbnailUrl"
                          :src="streamer.streamThumbnailUrl || streamer.profileImageUrl"
                          class="monitor-card__avatar-img"
                        />
                        <div
                          v-else
                          class="monitor-card__avatar-fallback"
                          :class="getPlatformBgClass(streamer.platform)"
                        >
                          <img
                            :src="getPlatformIcon(streamer.platform)"
                            class="monitor-card__avatar-icon"
                            :class="getPlatformIconClasses(streamer.platform)"
                          />
                        </div>
                      </div>

                      <div class="monitor-card__info">
                        <h3 class="monitor-card__name">{{ streamer.displayName }}</h3>
                        <div class="monitor-card__meta">
                          <span class="monitor-card__platform" :class="getPlatformTextClass(streamer.platform)">
                            {{ streamer.platform }}
                          </span>
                          <span class="monitor-card__divider"></span>
                          <!-- Status Badge -->
                          <div v-if="streamer.isDetecting" class="monitor-status monitor-status--active">
                            <span class="monitor-status__dot"></span>
                            {{ getStatusLabel(streamer) }}
                          </div>
                          <template v-else>
                            <div v-if="streamer.isCheckingLive" class="monitor-status monitor-status--checking">
                              <Loader2 class="monitor-status__spinner" />
                            </div>
                            <div v-else-if="streamer.isLive" class="monitor-status monitor-status--live">
                              <span class="monitor-status__dot"></span>
                              LIVE
                              <span v-if="streamer.viewerCount" class="monitor-status__viewers">
                                {{ formatViewerCount(streamer.viewerCount) }}
                              </span>
                              <span v-if="streamer.hasTempRecording" class="monitor-status__dvr">DVR</span>
                            </div>
                            <div v-else class="monitor-status monitor-status--offline">
                              <span class="monitor-status__dot"></span>
                              Offline
                            </div>
                          </template>
                        </div>
                      </div>

                      <!-- Quick Actions (top right) -->
                      <div class="monitor-card__quick-actions">
                        <button
                          v-if="!streamer.isDetecting"
                          @click.stop="refreshLiveStatus(streamer)"
                          class="monitor-card__icon-btn"
                          :class="{ 'monitor-card__icon-btn--spinning': streamer.isCheckingLive }"
                          :disabled="streamer.isCheckingLive"
                          title="Refresh status"
                        >
                          <RefreshCw class="monitor-card__icon-btn-icon" />
                        </button>
                        <button
                          v-if="!streamer.isDetecting"
                          @click.stop="removeStreamer(streamer.id)"
                          class="monitor-card__icon-btn monitor-card__icon-btn--danger"
                          title="Remove"
                        >
                          <Trash2 class="monitor-card__icon-btn-icon" />
                        </button>
                      </div>
                    </div>

                    <!-- Controls Row -->
                    <div class="monitor-card__controls">
                      <!-- Left: Settings -->
                      <div class="monitor-card__settings">
                        <DropdownMenu>
                          <DropdownMenuTrigger as-child>
                            <button
                              class="monitor-setting__dropdown-trigger"
                              :class="{ 'monitor-setting__dropdown-trigger--disabled': streamer.isDetecting }"
                              :disabled="streamer.isDetecting"
                            >
                              {{ streamer.segmentDurationMinutes }} min
                              <ChevronDown class="monitor-setting__dropdown-chevron" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" :side-offset="4" class="segment-dropdown">
                            <DropdownMenuItem
                              v-for="duration in [3, 5, 10, 15, 30]"
                              :key="duration"
                              class="segment-dropdown__item"
                              :class="{
                                'segment-dropdown__item--selected': streamer.segmentDurationMinutes === duration,
                              }"
                              @click="updateSegmentDuration(streamer, duration)"
                            >
                              {{ duration }} min
                              <Check
                                v-if="streamer.segmentDurationMinutes === duration"
                                class="segment-dropdown__check"
                              />
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <button
                          @click="updateAutoDvr(streamer, !streamer.autoDvr)"
                          :disabled="streamer.isDetecting && streamer.status === 'STOPPING'"
                          class="monitor-setting__toggle"
                          :class="{ 'monitor-setting__toggle--on': streamer.autoDvr }"
                          title="Auto DVR"
                        >
                          <Video class="monitor-setting__toggle-icon" />
                          DVR
                        </button>
                      </div>

                      <!-- Right: Action Buttons -->
                      <div class="monitor-card__actions">
                        <template v-if="!streamer.isDetecting">
                          <div v-if="streamer.status === 'STOPPING'" class="monitor-action monitor-action--stopping">
                            <Loader2 class="monitor-action__spinner" />
                            Stopping...
                          </div>
                          <template v-else>
                            <button
                              v-if="streamer.isLive"
                              @click="openWatchDialog(streamer)"
                              class="monitor-action monitor-action--watch"
                            >
                              <Eye class="monitor-action__icon" />
                              Watch
                            </button>
                            <div class="monitor-action-group">
                              <button @click="startStreamer(streamer, false)" class="monitor-action-group__btn">
                                <Video class="monitor-action__icon" />
                                Rec
                              </button>
                              <button
                                @click="startStreamer(streamer, true)"
                                class="monitor-action-group__btn monitor-action-group__btn--primary"
                              >
                                <Sparkles class="monitor-action__icon" />
                                Auto
                              </button>
                            </div>
                          </template>
                        </template>
                        <template v-else>
                          <!-- Watch button available even while detecting/recording -->
                          <button
                            v-if="streamer.isLive"
                            @click="openWatchDialog(streamer)"
                            class="monitor-action monitor-action--watch"
                          >
                            <Eye class="monitor-action__icon" />
                            Watch
                          </button>
                          <button class="monitor-action monitor-action--stop" @click="stopStreamer(streamer)">
                            <Square class="monitor-action__icon" />
                            Stop
                          </button>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </transition-group>
            </div>
          </div>

          <!-- Activity Log Column -->
          <div v-if="isDetectingAny && activityLogs.length > 0" class="liveclip__activity">
            <div class="liveclip__section-header">
              <div class="liveclip__section-header-left">
                <div class="liveclip__section-icon liveclip__section-icon--activity">
                  <Activity />
                </div>
                <div class="liveclip__section-text">
                  <h2 class="liveclip__section-title">Real-time Activity</h2>
                  <p class="liveclip__section-subtitle">Live feed</p>
                </div>
              </div>
              <span class="liveclip__live-badge">Live</span>
            </div>

            <div class="activity-log">
              <div class="activity-log__scroll" ref="logsContainer">
                <transition-group name="list">
                  <div v-for="log in activityLogs" :key="log.id" class="activity-log__item">
                    <span class="activity-log__time">{{ log.timestamp }}</span>
                    <div class="activity-log__content">
                      <div class="activity-log__header">
                        <div v-if="log.profileImageUrl || log.streamThumbnailUrl" class="activity-log__avatar">
                          <img :src="log.streamThumbnailUrl || log.profileImageUrl" />
                        </div>
                        <span v-else class="activity-log__dot" :class="getPlatformDotClass(log.platform)"></span>
                        <span class="activity-log__name">{{ log.streamerName }}</span>
                      </div>
                      <p class="activity-log__message">{{ log.message }}</p>
                    </div>
                    <div class="activity-log__status">
                      <Loader2 v-if="log.status === 'loading'" class="activity-log__spinner" />
                      <Check v-else-if="log.status === 'success'" class="activity-log__check" />
                    </div>
                  </div>
                </transition-group>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="streamers.length === 0" class="liveclip__empty">
          <div class="liveclip__empty-icon-wrapper">
            <Radio class="liveclip__empty-icon" />
          </div>
          <h3 class="liveclip__empty-title">No active monitors</h3>
          <p class="liveclip__empty-description">Add a stream link above to start detecting clips in real-time</p>
        </div>
      </div>

      <!-- Search Dialog -->
      <Dialog :open="showSearchDialog" @update:open="showSearchDialog = $event">
        <DialogContent class="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Token</DialogTitle>
            <DialogDescription>Multiple tokens found for your search. Please select one.</DialogDescription>
          </DialogHeader>
          <div class="grid gap-2 py-4 max-h-[60vh] overflow-y-auto">
            <div
              v-for="token in searchResults"
              :key="token.mint"
              class="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/50 hover:border-primary/30 cursor-pointer transition-colors"
              @click="selectSearchResult(token)"
            >
              <div
                class="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0"
              >
                <img v-if="token.image" :src="token.image" class="w-full h-full object-cover" />
                <span v-else class="text-xs font-bold">{{ token.symbol.slice(0, 2) }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="font-medium truncate text-sm">{{ token.name }}</h4>
                <p class="text-xs text-muted-foreground truncate">{{ token.symbol }}</p>
              </div>
              <div class="text-right flex flex-col items-end">
                <span class="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  {{ token.mint.slice(0, 4) }}...{{ token.mint.slice(-4) }}
                </span>
                <span v-if="token.marketCap" class="text-[10px] text-green-500 mt-1">
                  ${{ (token.marketCap / 1000).toFixed(0) }}k MC
                </span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <!-- Credit Warning Dialog -->
      <ConfirmationModal
        :show="showCreditWarningDialog"
        title="Low Credits Warning"
        message="You have less than 60 minutes of credits remaining. If you run out of credits, detection will automatically stop and only recording will continue."
        confirm-text="Continue"
        close-text="Cancel"
        :show-cannot-undone-text="false"
        @close="showCreditWarningDialog = false"
        @confirm="confirmCreditWarning"
      />

      <!-- Campaign Selection Dialog -->
      <CampaignSelectionDialog
        :is-open="showCampaignDialog"
        :campaigns="availableCampaigns"
        @select="handleCampaignSelect"
        @cancel="handleCampaignCancel"
      />
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import { invoke } from '@tauri-apps/api/core';
  import {
    Radio,
    Plus,
    Check,
    Square,
    Search,
    Trash2,
    Activity,
    Loader2,
    Video,
    Sparkles,
    RefreshCw,
    Eye,
    ChevronDown,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import CampaignSelectionDialog from '@/components/campaigns/CampaignSelectionDialog.vue';
  import { useLivestreamMonitoring, fetchLiveStatus } from '@/composables/useLivestreamMonitoring';
  import { getCampaignsByCreatorProfile, type Campaign } from '@/services/campaignApi';
  import { useLivestreamStore } from '@/stores/livestream';
  import {
    getAllMonitoredStreamers,
    createMonitoredStreamer,
    deleteMonitoredStreamer,
    updateMonitoredStreamer,
  } from '@/services/database';
  import {
    extractMintId,
    searchPumpFunTokens,
    fetchTokenMetadataFromServer,
    type TokenSearchResult,
  } from '@/services/pumpfun';
  import { extractChannelSlug, checkKickLivestream } from '@/services/kick';
  import type { MonitoredStreamer } from '@/types/livestream';
  import { useCreditBalance } from '@/composables/useCreditBalance';
  import { useSubscriptionGate } from '@/composables/useSubscriptionGate';

  type Platform = 'Youtube' | 'Twitch' | 'Kick' | 'PumpFun';

  const { gates, requireSubscription } = useSubscriptionGate();

  type ExtendedStreamer = MonitoredStreamer & {
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
  const inputValue = ref('');
  const detectedPlatform = ref<Platform | null>(null);
  const logsContainer = ref<HTMLElement | null>(null);

  const searchResults = ref<TokenSearchResult[]>([]);
  const showSearchDialog = ref(false);
  const isSearching = ref(false);

  const showCampaignDialog = ref(false);
  const availableCampaigns = ref<Campaign[]>([]);
  const pendingCampaignAction = ref<{ streamer: ExtendedStreamer; detectClips: boolean } | null>(null);
  const pendingWatchAction = ref<ExtendedStreamer | null>(null);
  const selectedCampaignForSession = ref<Campaign | null>(null);

  const livestreamStore = useLivestreamStore();

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
  } = useLivestreamMonitoring();

  const { hoursRemaining, fetchBalance } = useCreditBalance();

  const isDetectingAny = computed(() => monitoredStreamers.value.size > 0 || activeSessions.value.size > 0);

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

  const showCreditWarningDialog = ref(false);
  const pendingStreamerStart = ref<{ streamer: ExtendedStreamer; detectClips: boolean } | null>(null);

  const liveStatusInterval = ref<number | null>(null);

  onMounted(async () => {
    await loadStreamers();
    refreshStreamerMetadata();
    syncDetectionState();
    checkAllLiveStatuses(false); // Skip Kick - only check on manual refresh

    liveStatusInterval.value = window.setInterval(() => {
      checkAllLiveStatuses(false); // Skip Kick on interval to save API requests
    }, 60_000);

    window.addEventListener('livestream-clip-created', handleGlobalClipCreated as EventListener);
    window.addEventListener('monitored-streamers-updated', handleMonitoredStreamersUpdated);
  });

  async function checkAllLiveStatuses(includeKick: boolean = true) {
    const promises = streamers.value.map(async (streamer) => {
      if (streamer.isDetecting) return;
      // Skip Kick streamers on interval polling to save API requests
      // Kick status is only checked on app open and manual refresh
      if (!includeKick && streamer.platform === 'Kick') return;

      const index = streamers.value.findIndex((s) => s.id === streamer.id);
      if (index !== -1) {
        streamers.value[index] = { ...streamers.value[index], isCheckingLive: true };
      }

      try {
        const status = await fetchLiveStatus(streamer.mintId, streamer.platform);
        const idx = streamers.value.findIndex((s) => s.id === streamer.id);
        if (idx !== -1) {
          streamers.value[idx] = {
            ...streamers.value[idx],
            isLive: status.isLive,
            viewerCount: status.numParticipants,
            isCheckingLive: false,
          };
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

  async function refreshLiveStatus(streamer: ExtendedStreamer) {
    if (streamer.isDetecting) return;

    const index = streamers.value.findIndex((s) => s.id === streamer.id);
    if (index === -1) return;

    streamers.value[index] = { ...streamers.value[index], isCheckingLive: true };

    try {
      const status = await fetchLiveStatus(streamer.mintId, streamer.platform);
      streamers.value[index] = {
        ...streamers.value[index],
        isLive: status.isLive,
        viewerCount: status.numParticipants,
        isCheckingLive: false,
      };
    } catch (error) {
      console.error('[LiveClip] Failed to refresh live status for', streamer.mintId, error);
      streamers.value[index] = { ...streamers.value[index], isCheckingLive: false };
    }
  }

  async function refreshStreamerMetadata() {
    const needsUpdate = streamers.value.filter(
      (s) =>
        (s.platform === 'PumpFun' && (s.displayName === s.mintId || !s.profileImageUrl)) ||
        (s.platform === 'Kick' && (!s.profileImageUrl || s.displayName === s.mintId))
    );

    if (needsUpdate.length === 0) return;

    for (const streamer of needsUpdate) {
      try {
        if (streamer.platform === 'Kick') {
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
  }

  onUnmounted(async () => {
    if (liveStatusInterval.value) {
      clearInterval(liveStatusInterval.value);
      liveStatusInterval.value = null;
    }

    window.removeEventListener('livestream-clip-created', handleGlobalClipCreated as EventListener);
    window.removeEventListener('monitored-streamers-updated', handleMonitoredStreamersUpdated);
  });

  watch([activeSessions, monitoredStreamers, dvrSessions], () => syncDetectionState(), { deep: true });

  function syncDetectionState() {
    streamers.value = streamers.value.map((streamer) => {
      const monitored = monitoredStreamers.value.get(streamer.id);
      const session = activeSessions.value.get(streamer.id);
      const dvrSession = dvrSessions.value.get(streamer.id);

      return {
        ...streamer,
        isDetecting: !!monitored,
        mode: monitored ? (monitored.options.detectClips ? 'Auto-Detect' : 'Record Only') : null,
        status: session ? (session.isStopping ? 'STOPPING' : 'LIVE') : monitored ? 'WAITING' : 'IDLE',
        isLive: monitored ? (session ? true : streamer.isLive) : streamer.isLive,
        hasTempRecording: !!dvrSession,
      };
    });
  }

  async function handleMonitoredStreamersUpdated() {
    await loadStreamers();
    await refreshStreamerMetadata();
    await checkAllLiveStatuses(true); // Include Kick since this is a user-triggered update
  }

  function getStatusLabel(streamer: ExtendedStreamer) {
    if (streamer.status === 'STOPPING') return 'STOPPING...';
    if (!streamer.isDetecting) return 'IDLE';
    if (streamer.status === 'LIVE') return `LIVE (${streamer.mode === 'Auto-Detect' ? 'AUTO' : 'REC'})`;
    return `WAITING (${streamer.mode === 'Auto-Detect' ? 'AUTO' : 'REC'})`;
  }

  async function openWatchDialog(streamer: ExtendedStreamer) {
    if (!streamer.isLive) return;

    if (streamer.creatorProfileId) {
      try {
        const response = await getCampaignsByCreatorProfile(streamer.creatorProfileId);
        if (response.success && response.campaigns.length > 0) {
          availableCampaigns.value = response.campaigns;
          pendingWatchAction.value = streamer;
          showCampaignDialog.value = true;
          return;
        }
      } catch (error) {
        console.error('[LiveClip] Failed to check campaigns for watch:', error);
      }
    }

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

  async function loadStreamers() {
    try {
      const records = await getAllMonitoredStreamers();

      streamers.value = records.map((record) => {
        const monitored = monitoredStreamers.value.get(record.id);
        const session = activeSessions.value.get(record.id);

        const platformMap: Record<string, Platform> = {
          pumpfun: 'PumpFun',
          kick: 'Kick',
          twitch: 'Twitch',
          youtube: 'Youtube',
        };
        const platform = platformMap[record.platform?.toLowerCase() || 'pumpfun'] || 'PumpFun';

        return {
          id: record.id,
          mintId: record.mint_id,
          displayName: record.display_name,
          platform,
          lastCheckTimestamp: record.last_check_timestamp,
          isCurrentlyLive: Boolean(record.is_currently_live),
          currentSessionId: record.current_session_id,
          isDetecting: !!monitored,
          profileImageUrl: record.profile_image_url || undefined,
          streamThumbnailUrl: record.stream_thumbnail_url || undefined,
          segmentDurationMinutes: record.segment_duration_minutes ?? 5,
          mode: monitored ? (monitored.options.detectClips ? 'Auto-Detect' : 'Record Only') : null,
          status: session ? 'LIVE' : monitored ? 'WAITING' : 'IDLE',
          selected: false,
          autoDvr: Boolean(record.auto_dvr),
        };
      });
    } catch (error) {
      console.error('[LiveClip] Failed to load monitored streamers', error);
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
      detectedPlatform.value = 'Youtube';
    } else if (lowerVal.includes('twitch.tv')) {
      detectedPlatform.value = 'Twitch';
    } else if (lowerVal.includes('kick.com')) {
      detectedPlatform.value = 'Kick';
    } else {
      detectedPlatform.value = null;
    }
  }

  function getPlatformIcon(platform: Platform) {
    switch (platform) {
      case 'Youtube':
        return '/youtube.svg';
      case 'Twitch':
        return '/twitch.svg';
      case 'Kick':
        return '/kick.svg';
      case 'PumpFun':
        return '/capsule.svg';
      default:
        return '';
    }
  }

  function getPlatformBgClass(platform: Platform) {
    switch (platform) {
      case 'Youtube':
        return 'monitor-card__avatar-fallback--youtube';
      case 'Twitch':
        return 'monitor-card__avatar-fallback--twitch';
      case 'Kick':
        return 'monitor-card__avatar-fallback--kick';
      case 'PumpFun':
        return 'monitor-card__avatar-fallback--pumpfun';
      default:
        return '';
    }
  }

  function getPlatformIconClasses(platform: Platform) {
    switch (platform) {
      case 'Youtube':
      case 'Twitch':
      case 'PumpFun':
        return 'brightness-200';
      case 'Kick':
        return 'brightness-0';
      default:
        return '';
    }
  }

  function getPlatformTextClass(platform: Platform) {
    switch (platform) {
      case 'Youtube':
        return 'monitor-card__platform--youtube';
      case 'Twitch':
        return 'monitor-card__platform--twitch';
      case 'Kick':
        return 'monitor-card__platform--kick';
      case 'PumpFun':
        return 'monitor-card__platform--pumpfun';
      default:
        return '';
    }
  }

  function getPlatformDotClass(platform: Platform) {
    switch (platform) {
      case 'Youtube':
        return 'activity-log__dot--youtube';
      case 'Twitch':
        return 'activity-log__dot--twitch';
      case 'Kick':
        return 'activity-log__dot--kick';
      case 'PumpFun':
        return 'activity-log__dot--pumpfun';
      default:
        return '';
    }
  }

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

    if (detectedPlatform.value === 'Kick') {
      const channelSlug = extractChannelSlug(inputValue.value);
      if (channelSlug) {
        addActivityLog({
          streamerId: 'system',
          streamerName: 'System',
          platform: 'Kick',
          message: `Checking Kick channel "${channelSlug}"...`,
          status: 'loading',
        });

        try {
          const kickStatus = await checkKickLivestream(channelSlug);
          const displayName = kickStatus.username || channelSlug;
          const profileImage = kickStatus.profileImageUrl;

          addActivityLog({
            streamerId: 'system',
            streamerName: 'System',
            platform: 'Kick',
            message: kickStatus.isLive ? `Found ${displayName} - Currently LIVE!` : `Found ${displayName}`,
            status: 'success',
          });

          await confirmAddStreamer(channelSlug, displayName, profileImage, 'kick');
        } catch (error) {
          console.error('[LiveClip] Failed to fetch Kick channel info', error);
          await confirmAddStreamer(channelSlug, channelSlug, undefined, 'kick');
        }
        return;
      }
    }

    const mintId = extractMintId(inputValue.value);

    if (mintId) {
      addActivityLog({
        streamerId: 'system',
        streamerName: 'System',
        platform: 'PumpFun',
        message: `Fetching metadata for ${mintId.slice(0, 8)}...`,
        status: 'loading',
      });

      let displayName = extractIdentifier(inputValue.value);
      let profileImage = undefined;

      try {
        let match: TokenSearchResult | null = null;
        const results = await searchPumpFunTokens(mintId);
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
          displayName = match.symbol;
          profileImage = match.image;
          addActivityLog({
            streamerId: 'system',
            streamerName: 'System',
            platform: 'PumpFun',
            message: `Identified as ${match.name} (${match.symbol})`,
            status: 'success',
          });
        }
      } catch (e) {
        // Ignore errors, fallback to basic ID
      }

      await confirmAddStreamer(mintId, displayName, profileImage, 'pumpfun');
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

  async function confirmAddStreamer(
    platformId: string,
    displayName: string,
    profileImageUrl?: string,
    platform: string = 'pumpfun'
  ) {
    const platformDisplay = platform === 'kick' ? 'Kick' : 'PumpFun';
    try {
      await createMonitoredStreamer(platformId, displayName, profileImageUrl, 5, false, platform);
      await loadStreamers();
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
    } catch (error) {
      console.error('[LiveClip] Failed to add streamer', error);
      addActivityLog({
        streamerId: platformId,
        streamerName: displayName,
        platform: platformDisplay,
        message: 'Failed to add streamer. Ensure it is not already tracked.',
        status: 'info',
        mintId: platformId,
      });
    }
  }

  function selectSearchResult(token: TokenSearchResult) {
    confirmAddStreamer(token.mint, token.symbol, token.image);
  }

  async function removeStreamer(id: string) {
    try {
      const streamer = streamers.value.find((s) => s.id === id);

      if (streamer) {
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
    const mode = detectClips ? 'Auto-Detect' : 'Record';
    if (
      !(await requireSubscription({
        context: `${mode} mode for ${streamer.displayName}`,
        type: 'live',
      }))
    ) {
      return;
    }

    if (detectClips) {
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

    if (streamer.creatorProfileId) {
      try {
        const response = await getCampaignsByCreatorProfile(streamer.creatorProfileId);
        if (response.success && response.campaigns.length > 0) {
          availableCampaigns.value = response.campaigns;
          pendingCampaignAction.value = { streamer, detectClips };
          showCampaignDialog.value = true;
          return;
        }
      } catch (error) {
        console.error('[LiveClip] Failed to check campaigns:', error);
      }
    }

    await executeStartStreamer(streamer, detectClips);
  }

  function handleCampaignSelect(campaign: Campaign | null) {
    selectedCampaignForSession.value = campaign;
    showCampaignDialog.value = false;

    if (pendingCampaignAction.value) {
      const { streamer, detectClips } = pendingCampaignAction.value;
      pendingCampaignAction.value = null;

      if (campaign) {
        livestreamStore.setSessionCampaign(streamer.id, campaign);
      }

      executeStartStreamer(streamer, detectClips);
      return;
    }

    if (pendingWatchAction.value) {
      const streamer = pendingWatchAction.value;
      pendingWatchAction.value = null;

      if (campaign) {
        livestreamStore.setSessionCampaign(streamer.id, campaign);
      }

      livestreamStore.openWatchDialog(
        streamer.mintId,
        streamer.id,
        streamer.displayName,
        streamer.profileImageUrl,
        streamer.platform
      );
    }
  }

  function handleCampaignCancel() {
    showCampaignDialog.value = false;
    pendingCampaignAction.value = null;
    pendingWatchAction.value = null;
  }

  function confirmCreditWarning() {
    if (pendingStreamerStart.value) {
      executeStartStreamer(pendingStreamerStart.value.streamer, pendingStreamerStart.value.detectClips);
      pendingStreamerStart.value = null;
    }
    showCreditWarningDialog.value = false;
  }

  async function executeStartStreamer(streamer: ExtendedStreamer, detectClips: boolean) {
    if (!isDetectingAny.value) {
      clearLogs();
    }

    const mode = detectClips ? 'Auto Detect' : 'Record Only';
    addActivityLog({
      streamerId: streamer.id,
      streamerName: streamer.displayName || streamer.mintId.slice(0, 8),
      platform: 'PumpFun',
      mintId: streamer.mintId,
      message: `Started monitoring (${mode}). Waiting for stream to go live...`,
      status: 'loading',
      profileImageUrl: streamer.profileImageUrl,
    });

    await startMonitoring([streamer], { detectClips });

    const index = streamers.value.findIndex((s) => s.id === streamer.id);
    if (index > 0) {
      const [movedStreamer] = streamers.value.splice(index, 1);
      streamers.value.unshift(movedStreamer);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function stopStreamer(streamer: ExtendedStreamer) {
    try {
      await stopMonitoring([streamer.id]);
      resolvePendingLogs();
    } catch (error) {
      console.error('Failed to stop monitoring', error);
    }
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
  /* ===== Page Container ===== */
  .liveclip {
    width: 100%;
    min-height: 100%;
  }

  .liveclip__content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
    flex: 1;
  }

  .liveclip__content--empty {
    justify-content: center;
    align-items: center;
  }

  /* ===== Page Heading ===== */
  .liveclip__heading {
    margin-bottom: 0.5rem;
  }

  .liveclip__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.02em;
  }

  .liveclip__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Actions Bar ===== */
  .liveclip-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .liveclip-search {
    position: relative;
    width: 240px;
  }

  .liveclip-search__icon {
    position: absolute;
    left: 0.625rem;
    top: 50%;
    transform: translateY(-50%);
    width: 15px;
    height: 15px;
    color: var(--sidebar-text-muted);
    pointer-events: none;
  }

  .liveclip-search__platform {
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

  .liveclip-search__platform--youtube {
    background-color: #dc2626;
  }
  .liveclip-search__platform--twitch {
    background-color: #9146ff;
  }
  .liveclip-search__platform--kick {
    background-color: #53fc18;
  }
  .liveclip-search__platform--pumpfun {
    background-color: #10b981;
  }

  .liveclip-search__platform-icon {
    width: 12px;
    height: 12px;
    filter: brightness(0) invert(1);
  }

  .liveclip-search__platform-icon--dark {
    filter: brightness(0);
  }

  .liveclip-search__input {
    height: 32px;
    padding-left: 2rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.75rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .liveclip-search__input:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .liveclip-search__input:focus {
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.1);
  }

  .liveclip-add-btn {
    height: 32px;
    padding: 0 0.75rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    transition: all 150ms ease;
  }

  .liveclip-add-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .liveclip-add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .liveclip-add-btn__icon {
    width: 14px;
    height: 14px;
    margin-right: 0.25rem;
  }

  /* ===== Grid Layout ===== */
  .liveclip__grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .liveclip__grid--with-logs {
    grid-template-columns: 1fr 380px;
  }

  @media (max-width: 1200px) {
    .liveclip__grid--with-logs {
      grid-template-columns: 1fr;
    }
  }

  /* ===== Streamers Column ===== */
  .liveclip__streamers {
    min-width: 0; /* Prevent grid blowout */
  }

  /* ===== Activity Column ===== */
  .liveclip__activity {
    position: sticky;
    top: 1rem;
    align-self: start;
    max-height: calc(100vh - 200px);
  }

  @media (max-width: 1200px) {
    .liveclip__activity {
      position: static;
      max-height: none;
    }
  }

  /* ===== Section Header ===== */
  .liveclip__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .liveclip__section-header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .liveclip__section-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .liveclip__section-icon--activity {
    background-color: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
  }

  .liveclip__section-icon svg {
    width: 18px;
    height: 18px;
  }

  .liveclip__section-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .liveclip__section-subtitle {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .liveclip__live-badge {
    font-size: 0.625rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    border-radius: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* ===== Item Count ===== */
  .liveclip__item-count {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    font-weight: 500;
    margin-bottom: 1rem;
  }

  /* ===== Streamer List ===== */
  .liveclip__list-inner {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  /* When activity panel is present, use single column for streamer cards */
  .liveclip__grid--with-logs .liveclip__list-inner {
    grid-template-columns: 1fr;
  }

  /* On wider screens with activity panel, allow 2 columns again */
  @media (min-width: 1400px) {
    .liveclip__grid--with-logs .liveclip__list-inner {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 900px) {
    .liveclip__list-inner {
      grid-template-columns: 1fr;
    }
  }

  /* ===== Empty State ===== */
  .liveclip__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .liveclip__empty-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: var(--sidebar-hover);
    border-radius: 16px;
    margin-bottom: 1.5rem;
  }

  .liveclip__empty-icon {
    width: 36px;
    height: 36px;
    color: var(--sidebar-text-muted);
  }

  .liveclip__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .liveclip__empty-description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
  }

  /* ===== Monitor Card ===== */
  .monitor-card {
    background-color: var(--sidebar-surface);
    border-radius: 12px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .monitor-card:hover {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .monitor-card__content {
    padding: 1rem 1.25rem;
  }

  /* Card Header */
  .monitor-card__header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    margin-bottom: 1rem;
  }

  .monitor-card__avatar {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .monitor-card__avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .monitor-card__avatar-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .monitor-card__avatar-fallback--youtube {
    background-color: #dc2626;
  }
  .monitor-card__avatar-fallback--twitch {
    background-color: #9146ff;
  }
  .monitor-card__avatar-fallback--kick {
    background-color: #53fc18;
  }
  .monitor-card__avatar-fallback--pumpfun {
    background-color: #10b981;
  }

  .monitor-card__avatar-icon {
    width: 22px;
    height: 22px;
  }

  .monitor-card__info {
    flex: 1;
    min-width: 0;
  }

  .monitor-card__name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .monitor-card__meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .monitor-card__platform {
    font-size: 0.75rem;
    font-weight: 500;
  }

  .monitor-card__platform--youtube {
    color: #ef4444;
  }
  .monitor-card__platform--twitch {
    color: #a78bfa;
  }
  .monitor-card__platform--kick {
    color: #53fc18;
  }
  .monitor-card__platform--pumpfun {
    color: #34d399;
  }

  .monitor-card__divider {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background-color: var(--sidebar-text-muted);
    opacity: 0.4;
  }

  .monitor-card__quick-actions {
    display: flex;
    gap: 0.25rem;
  }

  .monitor-card__icon-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: transparent;
    border: none;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .monitor-card__icon-btn:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .monitor-card__icon-btn--danger:hover:not(:disabled) {
    background-color: rgba(239, 68, 68, 0.1);
    color: #f87171;
  }

  .monitor-card__icon-btn--spinning {
    animation: spin 0.8s linear infinite;
  }

  .monitor-card__icon-btn-icon {
    width: 14px;
    height: 14px;
  }

  /* Status Badges */
  .monitor-status {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.6875rem;
    font-weight: 600;
  }

  .monitor-status__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  .monitor-status__spinner {
    width: 12px;
    height: 12px;
    animation: spin 0.8s linear infinite;
  }

  .monitor-status--active {
    color: #34d399;
  }

  .monitor-status--active .monitor-status__dot {
    background-color: #34d399;
  }

  .monitor-status--live {
    color: #f87171;
  }

  .monitor-status--live .monitor-status__dot {
    background-color: #f87171;
  }

  .monitor-status__viewers {
    font-weight: 500;
    opacity: 0.8;
  }

  .monitor-status__dvr {
    font-size: 0.5625rem;
    padding: 0.125rem 0.25rem;
    background-color: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border-radius: 4px;
    margin-left: 0.25rem;
  }

  .monitor-status--offline {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .monitor-status--offline .monitor-status__dot {
    background-color: var(--sidebar-text-muted);
    animation: none;
  }

  .monitor-status--checking {
    color: var(--sidebar-text-muted);
  }

  /* Card Controls */
  .monitor-card__controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 0.875rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    gap: 0.75rem;
  }

  .monitor-card__settings {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .monitor-setting__dropdown-trigger {
    height: 30px;
    padding: 0 0.5rem 0 0.625rem;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 500;
    background-color: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .monitor-setting__dropdown-trigger:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
    color: var(--sidebar-text);
  }

  .monitor-setting__dropdown-trigger--disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .monitor-setting__dropdown-chevron {
    width: 12px;
    height: 12px;
    opacity: 0.6;
  }

  .monitor-setting__toggle {
    height: 30px;
    padding: 0 0.625rem;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.6875rem;
    font-weight: 500;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background-color: rgba(255, 255, 255, 0.04);
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .monitor-setting__toggle:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .monitor-setting__toggle--on {
    background-color: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.25);
    color: #34d399;
  }

  .monitor-setting__toggle--on:hover:not(:disabled) {
    background-color: rgba(16, 185, 129, 0.18);
  }

  .monitor-setting__toggle-icon {
    width: 12px;
    height: 12px;
    opacity: 0.7;
  }

  .monitor-setting__toggle--on .monitor-setting__toggle-icon {
    opacity: 1;
  }

  /* Card Actions */
  .monitor-card__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Segmented Button Group */
  .monitor-action-group {
    display: flex;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .monitor-action-group__btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4375rem 0.75rem;
    font-size: 0.6875rem;
    font-weight: 500;
    background-color: rgba(255, 255, 255, 0.04);
    color: var(--sidebar-text-muted);
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .monitor-action-group__btn:first-child {
    border-right: 1px solid rgba(255, 255, 255, 0.08);
  }

  .monitor-action-group__btn:hover {
    background-color: rgba(255, 255, 255, 0.08);
    color: var(--sidebar-text);
  }

  .monitor-action-group__btn--primary {
    background-color: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
  }

  .monitor-action-group__btn--primary:hover {
    background-color: rgba(139, 92, 246, 0.25);
    color: #c4b5fd;
  }

  /* Individual Actions */
  .monitor-action {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 500;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .monitor-action__icon {
    width: 13px;
    height: 13px;
  }

  .monitor-action__spinner {
    width: 13px;
    height: 13px;
    animation: spin 0.8s linear infinite;
  }

  .monitor-action--stopping {
    background-color: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
    border-color: rgba(245, 158, 11, 0.2);
  }

  .monitor-action--watch {
    background-color: rgba(239, 68, 68, 0.12);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.2);
  }

  .monitor-action--watch:hover {
    background-color: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .monitor-action--stop {
    background-color: rgba(239, 68, 68, 0.12);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.2);
  }

  .monitor-action--stop:hover {
    background-color: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  /* ===== Activity Log ===== */
  .activity-log {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
    max-height: calc(100vh - 280px);
    min-height: 300px;
  }

  .activity-log__scroll {
    height: 100%;
    overflow-y: auto;
    padding: 1rem;
  }

  .activity-log__item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.625rem;
    border-radius: 8px;
    transition: background-color 150ms ease;
  }

  .activity-log__item:hover {
    background-color: var(--sidebar-hover);
  }

  .activity-log__time {
    font-size: 0.625rem;
    font-family: monospace;
    color: var(--sidebar-text-muted);
    width: 52px;
    flex-shrink: 0;
    padding-top: 0.125rem;
  }

  .activity-log__content {
    flex: 1;
    min-width: 0;
  }

  .activity-log__header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.25rem;
  }

  .activity-log__avatar {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
  }

  .activity-log__avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .activity-log__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .activity-log__dot--youtube {
    background-color: #ef4444;
  }
  .activity-log__dot--twitch {
    background-color: #9146ff;
  }
  .activity-log__dot--kick {
    background-color: #53fc18;
  }
  .activity-log__dot--pumpfun {
    background-color: #10b981;
  }

  .activity-log__name {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .activity-log__message {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .activity-log__status {
    flex-shrink: 0;
    padding-top: 0.125rem;
  }

  .activity-log__spinner {
    width: 12px;
    height: 12px;
    color: var(--sidebar-accent);
    animation: spin 0.8s linear infinite;
  }

  .activity-log__check {
    width: 12px;
    height: 12px;
    color: #34d399;
  }

  /* ===== Animations ===== */
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .scale-enter-active,
  .scale-leave-active {
    transition: all 0.2s ease;
  }

  .scale-enter-from,
  .scale-leave-to {
    opacity: 0;
    transform: scale(0.5);
  }

  .list-move,
  .list-enter-active,
  .list-leave-active {
    transition: all 0.3s ease;
  }

  .list-enter-from,
  .list-leave-to {
    opacity: 0;
    transform: translateY(16px);
  }

  .list-leave-active {
    position: absolute;
    z-index: 0;
  }
</style>

<!-- Global styles for dropdown (rendered via portal outside component scope) -->
<style>
  /* Prevent button animation when dropdown opens */
  .monitor-setting__dropdown-trigger {
    transform: none !important;
    animation: none !important;
  }

  .monitor-setting__dropdown-trigger[data-state='open'] {
    transform: none !important;
  }

  .segment-dropdown {
    min-width: 100px !important;
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    z-index: 100 !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    /* Disable all slide/zoom animations, only fade */
    animation: segmentDropdownFade 100ms ease-out !important;
    --tw-enter-translate-x: 0 !important;
    --tw-enter-translate-y: 0 !important;
    --tw-enter-scale: 1 !important;
  }

  @keyframes segmentDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .segment-dropdown__item {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 0.75rem !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 5px !important;
    font-size: 0.75rem !important;
    color: var(--sidebar-text-muted) !important;
    cursor: pointer !important;
    transition: all 100ms ease !important;
  }

  .segment-dropdown__item:hover,
  .segment-dropdown__item:focus,
  .segment-dropdown__item[data-highlighted] {
    background-color: var(--sidebar-hover) !important;
    color: var(--sidebar-text) !important;
    outline: none !important;
  }

  .segment-dropdown__item--selected {
    color: var(--sidebar-text) !important;
  }

  .segment-dropdown__check {
    width: 14px;
    height: 14px;
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }
</style>
