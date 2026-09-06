<template>
  <div class="liveclip">
    <PageLayout title="Live Clip" description="Real-time clip detection" :show-header="true" :icon="Radio">
      <template #actions>
        <div class="liveclip-actions" data-tour-id="tour-live-search">
          <div class="liveclip-search">
            <transition name="scale" mode="out-in">
              <div
                v-if="detectedPlatform === 'YouTube'"
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
                v-else-if="detectedPlatform === 'Rumble'"
                class="liveclip-search__platform liveclip-search__platform--rumble"
                key="rumble"
              >
                <img src="/rumble.svg" class="liveclip-search__platform-icon" />
              </div>
              <div
                v-else-if="detectedPlatform === 'Tokend'"
                class="liveclip-search__platform liveclip-search__platform--tokend"
                key="tokend"
              >
                <img
                  src="/tokend.png"
                  class="liveclip-search__platform-icon liveclip-search__platform-icon--tokend"
                />
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

      <div class="liveclip__content" :class="{ 'liveclip__content--empty': streamers.length === 0 && !mockStreamerActive }">
        <!-- Page Heading (hidden in empty state) -->
        <div v-if="streamers.length > 0 || mockStreamerActive" class="liveclip__heading">
          <h1 class="liveclip__title">Live Stream Monitor</h1>
          <p class="liveclip__subtitle">Watch and track Live streams and detect clips in real-time with AI-powered analysis</p>
        </div>

        <!-- Tour demo streamer (same card chrome as real monitored channels) -->
        <div v-if="mockStreamerActive" class="liveclip__platform-sections" style="margin-bottom: 1rem">
          <div class="liveclip__platform-section">
            <div class="liveclip__platform-header">
              <div class="liveclip__platform-title-wrapper">
                <h2 class="liveclip__platform-title">Tour Demo</h2>
              </div>
            </div>
            <div class="liveclip__list">
              <div class="liveclip__list-inner">
                <div class="monitor-card monitor-card--live" data-tour-id="tour-mock-streamer">
                  <div class="monitor-card__header">
                    <div class="monitor-card__avatar">
                      <div class="monitor-card__avatar-fallback monitor-card__avatar-fallback--twitch">
                        <span style="font-size: 0.75rem; font-weight: 700">DEMO</span>
                      </div>
                    </div>
                    <div class="monitor-card__info">
                      <div class="monitor-card__title-row">
                        <span class="monitor-card__title">Demo Streamer</span>
                        <div class="monitor-status monitor-status--live monitor-status--inline">
                          <span class="monitor-status__dot"></span>
                          LIVE
                        </div>
                      </div>
                      <div class="monitor-card__subtitle">
                        <span class="monitor-card__platform monitor-card__platform--twitch">Twitch</span>
                      </div>
                    </div>
                  </div>
                  <div class="monitor-card__stats">
                    <div class="monitor-card__actions">
                      <button
                        type="button"
                        class="monitor-action monitor-action--watch"
                        data-tour-id="tour-mock-watch"
                        @click.prevent
                      >
                        <Eye class="monitor-action__icon" />
                        Watch
                      </button>
                      <div class="monitor-action-group">
                        <button
                          type="button"
                          class="monitor-action-group__btn"
                          data-tour-id="tour-mock-rec"
                          @click.prevent
                        >
                          <Video class="monitor-action__icon" />
                          Rec
                        </button>
                        <button
                          type="button"
                          class="monitor-action-group__btn monitor-action-group__btn--primary"
                          data-tour-id="tour-mock-auto"
                          @click.prevent
                        >
                          <Sparkles class="monitor-action__icon" />
                          Auto
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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

            <!-- Platform Sections -->
            <div class="liveclip__platform-sections">
              <div
                v-for="platformGroup in streamersByPlatform"
                :key="platformGroup.platform"
                class="liveclip__platform-section"
              >
                <!-- Platform Header -->
                <div class="liveclip__platform-header">
                  <div class="liveclip__platform-title-wrapper">
                    <img
                      :src="getPlatformIcon(platformGroup.platform)"
                      :alt="platformGroup.platform"
                      class="liveclip__platform-icon"
                      :class="getPlatformIconClasses(platformGroup.platform)"
                    />
                    <h2 class="liveclip__platform-title">{{ platformGroup.platform }}</h2>
                  </div>
                  <div class="liveclip__platform-count">
                    {{ platformGroup.count }} {{ platformGroup.count === 1 ? 'channel' : 'channels' }}
                  </div>
                </div>

                <!-- Streamer Cards -->
                <div class="liveclip__list">
                  <transition-group name="list" tag="div" class="liveclip__list-inner">
                    <div
                      v-for="streamer in platformGroup.streamers"
                      :key="streamer.id"
                      class="monitor-card"
                  :class="{
                    'monitor-card--active': streamer.isDetecting,
                    'monitor-card--live': !streamer.isDetecting && streamer.isLive,
                  }"
                >
                  <!-- Card Header: Avatar + Info + Quick Actions -->
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
                      <div class="monitor-card__title-row">
                        <span class="monitor-card__title">{{ streamer.displayName }}</span>
                        <!-- Live Status Badge -->
                        <div v-if="streamer.isDetecting" class="monitor-status monitor-status--active monitor-status--inline">
                          <span class="monitor-status__dot"></span>
                          {{ getStatusLabel(streamer) }}
                        </div>
                        <template v-else>
                          <div v-if="streamer.isCheckingLive" class="monitor-status monitor-status--checking monitor-status--inline">
                            <Loader2 class="monitor-status__spinner" />
                          </div>
                          <div v-else-if="streamer.isLive" class="monitor-status monitor-status--live monitor-status--inline">
                            <span class="monitor-status__dot"></span>
                            LIVE
                            <span v-if="streamer.viewerCount" class="monitor-status__viewers">
                              {{ formatViewerCount(streamer.viewerCount) }}
                            </span>
                          </div>
                          <div v-else class="monitor-status monitor-status--offline monitor-status--inline">
                            <span class="monitor-status__dot"></span>
                            Offline
                          </div>
                        </template>
                      </div>
                      <div class="monitor-card__subtitle">
                        <span class="monitor-card__platform" :class="getPlatformTextClass(streamer.platform)">
                          {{ streamer.platform }}
                        </span>
                        <span v-if="streamer.hasTempRecording" class="monitor-status__dvr monitor-status__dvr--inline">DVR</span>
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

                  <!-- Stats Row: DVR + Actions -->
                  <div class="monitor-card__stats">

                    <!-- DVR Toggle -->
                    <span
                      v-if="streamer.platform === 'Tokend'"
                      class="monitor-card__capability-unavailable"
                    >
                      Playback, Watch, Rec, and DVR unavailable
                    </span>
                    <button
                      v-else
                      @click="updateAutoDvr(streamer, !streamer.autoDvr)"
                      :disabled="streamer.isDetecting && streamer.status === 'STOPPING'"
                      class="monitor-setting__toggle"
                      :class="{ 'monitor-setting__toggle--on': streamer.autoDvr }"
                      title="Auto DVR"
                    >
                      <Video class="monitor-setting__toggle-icon" />
                      DVR
                    </button>

                    <div class="monitor-card__divider"></div>

                    <!-- Action Buttons -->
                    <div v-if="streamer.platform !== 'Tokend'" class="monitor-card__actions">
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
                  </transition-group>
                </div>
              </div>
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

      <XBroadcastExplainerDialog
        :show="showTwitterExplainerDialog"
        @confirm="confirmTwitterBroadcastAdd"
        @cancel="cancelTwitterBroadcastAdd"
      />

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

      <!-- Real-Time Detection Dialog (Auto mode only) -->
      <RealtimeDetectionDialog
        v-if="pendingMode === 'auto'"
        v-model="showRealtimeDialog"
        :prompts="prompts"
        :creator-layout-eligible="creatorLayoutEligible"
        :creator-layout-creator-name="creatorLayoutCreatorName"
        :show-sixty-minute-cap="true"
        @confirm="handleRealtimeDetectionConfirm"
      />

      <!-- Segment & Prompt Selection Dialog (Record mode only) -->
      <Teleport to="body">
        <Transition name="modal">
          <div v-if="showSegmentDialog && pendingMode === 'record'" class="segment-dialog__overlay" @click.self="closeSegmentDialog">
            <Transition name="dialog" appear>
              <div v-if="showSegmentDialog && pendingMode === 'record'" class="segment-dialog" role="dialog" aria-modal="true">
                <!-- Accent bar -->
                <div class="segment-dialog__accent"></div>

                <!-- Header -->
                <div class="segment-dialog__header">
                  <button class="segment-dialog__close" @click="closeSegmentDialog" title="Close">
                    <X :size="18" />
                  </button>
                  <div class="segment-dialog__icon">
                    <Video :size="24" />
                  </div>
                  <h2 class="segment-dialog__title">
                    Record Settings
                  </h2>
                  <p class="segment-dialog__subtitle">
                    Record stream segments
                  </p>
                </div>

                <!-- Content -->
                <div class="segment-dialog__content">
                  <!-- Duration Selection -->
                  <div class="segment-dialog__field">
                    <label class="segment-dialog__label">Segment Duration</label>
                    <div class="segment-dialog__duration-grid">
                      <button
                        v-for="duration in availableDurationsRecord"
                        :key="duration"
                        class="segment-dialog__duration-btn"
                        :class="{ 'segment-dialog__duration-btn--selected': selectedDuration === duration }"
                        @click="selectDuration(duration)"
                      >
                        {{ duration === 0 ? 'Entire' : `${duration} min` }}
                      </button>
                    </div>
                  </div>

                  <!-- Creator clip defaults (only when a matching local profile has saved defaults) -->
                  <div v-if="creatorLayoutEligible" class="segment-dialog__field">
                    <label class="segment-dialog__label">Creator layout</label>
                    <label class="segment-dialog__checkbox-row">
                      <input
                        v-model="recordUseCreatorLayout"
                        type="checkbox"
                        class="segment-dialog__checkbox"
                      />
                      <span class="segment-dialog__checkbox-text">Use creator layout</span>
                    </label>
                    <p class="segment-dialog__hint">
                      Apply framing, overlays, and subtitle defaults from
                      <strong v-if="creatorLayoutCreatorName">{{ creatorLayoutCreatorName }}</strong
                      ><span v-else>this creator's</span>
                      profile to clips built from this recording session.
                    </p>
                  </div>
                </div>

                <!-- Footer -->
                <div class="segment-dialog__footer">
                  <button class="segment-dialog__btn segment-dialog__btn--secondary" @click="closeSegmentDialog">
                    Cancel
                  </button>
                  <button
                    class="segment-dialog__btn segment-dialog__btn--primary"
                    @click="handleConfirmSegmentDialog"
                  >
                    Start
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </Transition>
      </Teleport>

      <!-- Teleported Prompt Dropdown Menu -->
      <Teleport to="body">
        <div
          v-if="showPromptDropdown"
          class="segment-dialog__dropdown-menu"
          :style="dropdownMenuStyle"
        >
          <div v-if="loadingPrompts" class="segment-dialog__dropdown-loading">
            Loading prompts...
          </div>
          <div v-else-if="prompts.length === 0" class="segment-dialog__dropdown-empty">
            No prompts available
          </div>
          <button
            v-for="prompt in prompts"
            :key="prompt.id"
            class="segment-dialog__dropdown-item"
            :class="{ 'segment-dialog__dropdown-item--selected': selectedPromptId === prompt.id }"
            @click="selectPromptAndClose(prompt)"
          >
            {{ prompt.name }}
          </button>
        </div>
      </Teleport>

      <!-- Auto-Detection Limit Dialog -->
      <AutoDetectLimitDialog
        :show="showAutoDetectLimitDialog"
        :active-streamer-name="autoDetectLimitDialogData.activeStreamerName"
        :requested-streamer-name="autoDetectLimitDialogData.requestedStreamerName"
        @close="showAutoDetectLimitDialog = false"
      />
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import { invoke } from '@tauri-apps/api/core';
  import { useAppTour, useTourFlags } from '@/composables/useAppTour';
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
    X,
    ChevronDown,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

  function getStatusLabel(streamer: ExtendedStreamer) {
    if (streamer.status === 'STOPPING') return 'STOPPING...';
    if (!streamer.isDetecting) return 'IDLE';
    if (streamer.status === 'LIVE') return `LIVE (${streamer.mode === 'Auto-Detect' ? 'AUTO' : 'REC'})`;
    return `WAITING (${streamer.mode === 'Auto-Detect' ? 'AUTO' : 'REC'})`;
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
      lowerVal.includes('tokend.tv') ||
      lowerVal.includes('localhost:4100') ||
      lowerVal.includes('127.0.0.1:4100')
    ) {
      detectedPlatform.value = 'Tokend';
    } else {
      detectedPlatform.value = null;
    }
  }

  function getPlatformIcon(platform: Platform) {
    switch (platform) {
      case 'YouTube':
        return '/youtube.svg';
      case 'Twitch':
        return '/twitch.svg';
      case 'Kick':
        return '/kick.svg';
      case 'Rumble':
        return '/rumble.svg';
      case 'Twitter':
        return '/x.svg';
      case 'Tokend':
        return '/tokend.png';
      case 'PumpFun':
        return '/capsule.svg';
      default:
        return '';
    }
  }

  function getPlatformBgClass(platform: Platform) {
    switch (platform) {
      case 'YouTube':
        return 'monitor-card__avatar-fallback--youtube';
      case 'Twitch':
        return 'monitor-card__avatar-fallback--twitch';
      case 'Kick':
        return 'monitor-card__avatar-fallback--kick';
      case 'Rumble':
        return 'monitor-card__avatar-fallback--rumble';
      case 'Twitter':
        return 'monitor-card__avatar-fallback--twitter';
      case 'Tokend':
        return 'monitor-card__avatar-fallback--tokend';
      case 'PumpFun':
        return 'monitor-card__avatar-fallback--pumpfun';
      default:
        return '';
    }
  }

  function getPlatformIconClasses(platform: Platform) {
    switch (platform) {
      case 'YouTube':
      case 'Twitch':
      case 'Rumble':
      case 'PumpFun':
        return 'brightness-200';
      case 'Kick':
      case 'Twitter':
        return 'brightness-0';
      case 'Tokend':
        return 'monitor-card__avatar-icon--tokend';
      default:
        return '';
    }
  }

  function getPlatformTextClass(platform: Platform) {
    switch (platform) {
      case 'YouTube':
        return 'monitor-card__platform--youtube';
      case 'Twitch':
        return 'monitor-card__platform--twitch';
      case 'Kick':
        return 'monitor-card__platform--kick';
      case 'Rumble':
        return 'monitor-card__platform--rumble';
      case 'Twitter':
        return 'monitor-card__platform--twitter';
      case 'Tokend':
        return 'monitor-card__platform--tokend';
      case 'PumpFun':
        return 'monitor-card__platform--pumpfun';
      default:
        return '';
    }
  }

  function getPlatformDotClass(platform: Platform) {
    switch (platform) {
      case 'YouTube':
        return 'activity-log__dot--youtube';
      case 'Twitch':
        return 'activity-log__dot--twitch';
      case 'Kick':
        return 'activity-log__dot--kick';
      case 'Rumble':
        return 'activity-log__dot--rumble';
      case 'Twitter':
        return 'activity-log__dot--twitter';
      case 'Tokend':
        return 'activity-log__dot--tokend';
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
  .liveclip-search__platform--rumble {
    background-color: #85c742;
  }
  .liveclip-search__platform--tokend {
    background-color: #000000;
    padding: 0;
    overflow: hidden;
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

  .liveclip-search__platform-icon--tokend {
    width: 100%;
    height: 100%;
    filter: none;
    object-fit: cover;
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

  /* ===== Platform Sections ===== */
  .liveclip__platform-sections {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .liveclip__platform-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .liveclip__platform-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .liveclip__platform-title-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .liveclip__platform-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .liveclip__platform-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin: 0;
    letter-spacing: 0.01em;
    text-transform: uppercase;
  }

  .liveclip__platform-count {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    font-weight: 500;
  }

  /* ===== Streamer List ===== */
  .liveclip__list-inner {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  /* When activity panel is present, use 2 columns */
  .liveclip__grid--with-logs .liveclip__list-inner {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 768px) {
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
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.2s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .monitor-card:hover {
    border-color: var(--sidebar-accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  /* Card Header */
  .monitor-card__header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .monitor-card__header:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .monitor-card__avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    border: 1.5px solid var(--sidebar-border);
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
  .monitor-card__avatar-fallback--tokend {
    background-color: #000000;
    padding: 0;
    overflow: hidden;
  }
  .monitor-card__avatar-fallback--pumpfun {
    background-color: #10b981;
  }

  .monitor-card__avatar-icon {
    width: 22px;
    height: 22px;
  }

  .monitor-card__avatar-icon--tokend {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: none;
  }

  .monitor-card__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .monitor-card__title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .monitor-card__title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    flex-shrink: 0;
  }

  .monitor-card__subtitle {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .monitor-card__platform {
    font-size: 0.6875rem;
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
  .monitor-card__platform--tokend {
    color: #00e5ff;
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
    margin-left: auto;
  }

  .monitor-card__icon-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .monitor-card__icon-btn:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.5);
    border-color: rgba(255, 255, 255, 0.2);
    color: var(--sidebar-text);
    transform: scale(1.05);
  }

  .monitor-card__icon-btn--danger:hover:not(:disabled) {
    background-color: rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  .monitor-card__icon-btn--spinning {
    animation: spin 0.8s linear infinite;
  }

  .monitor-card__icon-btn-icon {
    width: 12px;
    height: 12px;
  }

  /* Status Badges */
  .monitor-status {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.625rem;
    font-weight: 600;
  }

  .monitor-status--inline {
    flex-shrink: 0;
  }

  .monitor-status__dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  .monitor-status__spinner {
    width: 10px;
    height: 10px;
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
    font-size: 0.5rem;
    padding: 0.125rem 0.25rem;
    background-color: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border-radius: 3px;
    margin-left: 0.25rem;
  }

  .monitor-status__dvr--inline {
    margin-left: 0;
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

  /* Stats Row */
  .monitor-card__stats {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    border-top: 1px solid var(--sidebar-border);
    background: rgba(0, 0, 0, 0.15);
  }

  .monitor-card__status-wrapper {
    display: flex;
    align-items: center;
  }

  .monitor-card__divider {
    width: 1px;
    height: 16px;
    background: var(--sidebar-border);
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
    height: 24px;
    padding: 0 0.5rem;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.625rem;
    font-weight: 500;
    border-radius: 5px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background-color: rgba(255, 255, 255, 0.04);
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .monitor-setting__toggle:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    color: var(--sidebar-text);
  }

  .monitor-setting__toggle--on {
    background-color: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.3);
    color: #34d399;
  }

  .monitor-setting__toggle--on:hover:not(:disabled) {
    background-color: rgba(16, 185, 129, 0.2);
  }

  .monitor-setting__toggle-icon {
    width: 11px;
    height: 11px;
    opacity: 0.7;
  }

  .monitor-setting__toggle--on .monitor-setting__toggle-icon {
    opacity: 1;
  }

  .monitor-card__actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-left: auto;
  }

  /* Segmented Button Group */
  .monitor-action-group {
    display: flex;
    border-radius: 5px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .monitor-action-group__btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.625rem;
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
    gap: 0.3rem;
    padding: 0.375rem 0.625rem;
    border-radius: 5px;
    font-size: 0.625rem;
    font-weight: 500;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .monitor-action__icon {
    width: 12px;
    height: 12px;
  }

  .monitor-action__spinner {
    width: 12px;
    height: 12px;
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
    display: flex;
    flex-direction: column;
    max-height: 500px;
    min-height: 300px;
  }

  .activity-log__scroll {
    flex: 1;
    min-height: 0;
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
  .activity-log__dot--tokend {
    background-color: #00e5ff;
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

<!-- Global styles for segment dialog (matching BugReportDialog design) -->
<style>
  /* ===== Overlay ===== */
  .segment-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  /* ===== Dialog Container ===== */
  .segment-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
    margin: 1rem;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Accent Bar ===== */
  .segment-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .segment-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .segment-dialog__close {
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

  .segment-dialog__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .segment-dialog__icon {
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

  .segment-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .segment-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .segment-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .segment-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .segment-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .segment-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Field ===== */
  .segment-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .segment-dialog__field:last-child {
    margin-bottom: 0;
  }

  .segment-dialog__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  /* ===== Creator-layout checkbox ===== */
  .segment-dialog__checkbox-row {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
  }

  .segment-dialog__checkbox {
    width: 16px;
    height: 16px;
    accent-color: var(--sidebar-accent);
    cursor: pointer;
    margin: 0;
  }

  .segment-dialog__checkbox-text {
    font-size: 0.875rem;
    color: var(--sidebar-text);
  }

  .segment-dialog__hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.4;
  }

  /* ===== Duration Grid ===== */
  .segment-dialog__duration-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .segment-dialog__duration-btn {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .segment-dialog__duration-btn:hover {
    border-color: rgba(255, 255, 255, 0.15);
    color: var(--sidebar-text);
  }

  .segment-dialog__duration-btn--selected {
    background-color: rgba(6, 182, 212, 0.15);
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
  }

  /* ===== Dropdown ===== */
  .segment-dialog__dropdown-wrapper {
    position: relative;
  }

  .segment-dialog__dropdown-trigger {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: left;
  }

  .segment-dialog__dropdown-trigger:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .segment-dialog__dropdown-trigger:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .segment-dialog__dropdown-value {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .segment-dialog__dropdown-value--placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .segment-dialog__dropdown-chevron {
    flex-shrink: 0;
    color: var(--sidebar-text-muted);
    transition: transform 150ms ease;
  }

  .segment-dialog__dropdown-chevron--open {
    transform: rotate(180deg);
  }

  .segment-dialog__dropdown-menu {
    position: fixed;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    max-height: 280px;
    overflow-y: auto;
    z-index: 10000;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  }

  .segment-dialog__dropdown-menu::-webkit-scrollbar {
    width: 6px;
  }

  .segment-dialog__dropdown-menu::-webkit-scrollbar-track {
    background: transparent;
  }

  .segment-dialog__dropdown-menu::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .segment-dialog__dropdown-loading,
  .segment-dialog__dropdown-empty {
    padding: 0.75rem 1rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .segment-dialog__dropdown-item {
    display: block;
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 100ms ease;
  }

  .segment-dialog__dropdown-item:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .segment-dialog__dropdown-item--selected {
    background-color: rgba(6, 182, 212, 0.1);
    color: var(--sidebar-accent);
  }

  /* ===== Footer ===== */
  .segment-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .monitor-card__capability-unavailable {
    color: #fbbf24;
    font-size: 0.6875rem;
    line-height: 1.35;
    text-align: center;
  }

  /* ===== Buttons ===== */
  .segment-dialog__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .segment-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .segment-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .segment-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .segment-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .segment-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  /* ===== Twitter Dialog Alert ===== */
  .twitter-dialog__alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 8px;
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }
</style>
