<template>
  <PageLayout title="Live Clip" description="Real-time clip detection" :show-header="true" :icon="Radio">
    <template #actions>
      <div class="relative w-[380px] shadow-sm group">
        <div
          class="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 pointer-events-none z-10"
        >
          <transition name="scale" mode="out-in">
            <div
              v-if="detectedPlatform === 'Youtube'"
              class="w-6 h-6 bg-red-600 rounded-md flex items-center justify-center shadow-sm border-border/80"
              key="yt"
            >
              <img src="/youtube.svg" class="w-3.5 h-3.5 invert brightness-200" />
            </div>
            <div
              v-else-if="detectedPlatform === 'Twitch'"
              class="w-6 h-6 bg-[#9146FF] rounded-md flex items-center justify-center shadow-sm border-border/80"
              key="tw"
            >
              <img src="/twitch.svg" class="w-3.5 h-3.5 invert brightness-200" />
            </div>
            <div
              v-else-if="detectedPlatform === 'Kick'"
              class="w-6 h-6 bg-[#53FC18] rounded-md flex items-center justify-center shadow-sm border-border/80"
              key="kick"
            >
              <img src="/kick.svg" class="w-3.5 h-3.5" />
            </div>
            <div
              v-else-if="detectedPlatform === 'PumpFun'"
              class="w-6 h-6 bg-emerald-500 rounded-md flex items-center justify-center shadow-sm border-border/80"
              key="pf"
            >
              <img src="/capsule.svg" class="w-3.5 h-3.5 brightness-200" />
            </div>
            <Search v-else class="w-4 h-4 text-muted-foreground" key="search" />
          </transition>
        </div>

        <Input
          v-model="inputValue"
          class="h-14 pl-11 pr-30 text-sm bg-background border-border/70 rounded-lg focus-visible:ring-primary/20 transition-all hover:border-primary/30 focus:border-primary/50 shadow-sm w-full"
          placeholder="Paste stream link or Mint ID..."
          @keyup.enter="addStreamer"
          @input="detectPlatform"
        />

        <div class="absolute right-2.5 top-1/2 -translate-y-1/2">
          <Button
            size="sm"
            class="h-8 px-4 rounded-sm font-medium transition-all text-xs"
            :disabled="!inputValue"
            @click="addStreamer"
          >
            <Plus class="w-3.5 h-3.5" />
            Track
          </Button>
        </div>
      </div>
    </template>

    <div
      class="mx-auto pt-2 relative transition-all duration-500 ease-in-out"
      :class="[isDetectingAny && activityLogs.length > 0 ? 'max-w-7xl' : 'max-w-full', 'pb-12']"
    >
      <div :class="{ 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-start': isDetectingAny && activityLogs.length > 0 }">
        <!-- Streamers List Column -->
        <div class="w-full">
          <div
            v-if="streamers.length > 0"
            class="flex items-center justify-between px-4 text-sm text-muted-foreground font-medium mb-3"
          >
            <span>Monitored Channels</span>
            <span>{{ streamers.length }} total</span>
          </div>

          <div class="relative">
            <transition-group name="list" tag="div" class="space-y-2">
              <div
                v-for="streamer in sortedStreamers"
                :key="streamer.id"
                class="group bg-card border border-border/50 rounded-xl transition-all duration-200 hover:border-primary/30 hover:bg-accent/5 shadow-sm overflow-hidden"
                :class="{
                  'border-green-500/30 bg-green-500/5': streamer.isDetecting,
                  'border-red-500/20 bg-red-500/5': !streamer.isDetecting && streamer.isLive,
                }"
              >
                <!-- Row 1: Streamer Identity -->
                <div class="flex items-center gap-3 px-4 py-3">
                  <!-- Avatar -->
                  <div
                    class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden relative bg-muted"
                  >
                    <img
                      v-if="streamer.profileImageUrl || streamer.streamThumbnailUrl"
                      :src="streamer.streamThumbnailUrl || streamer.profileImageUrl"
                      class="w-full h-full object-cover absolute inset-0 z-20 rounded-xl border border-border"
                    />
                    <div v-else class="absolute inset-0" :class="getPlatformSolidBg(streamer.platform)"></div>
                    <img
                      v-if="!streamer.profileImageUrl && !streamer.streamThumbnailUrl"
                      :src="getPlatformIcon(streamer.platform)"
                      class="w-6 h-6 relative z-10"
                      :class="getPlatformIconClasses(streamer.platform)"
                    />
                  </div>

                  <!-- Streamer Info -->
                  <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-base text-foreground truncate">
                      {{ streamer.displayName }}
                    </h3>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="text-sm text-muted-foreground">{{ streamer.platform }}</span>
                      <span class="text-muted-foreground/30">•</span>
                      <!-- Status -->
                      <span
                        v-if="streamer.isDetecting"
                        class="text-green-500 flex items-center gap-1.5 text-sm font-medium"
                      >
                        <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        {{ getStatusLabel(streamer) }}
                      </span>
                      <template v-else>
                        <span v-if="streamer.isCheckingLive" class="text-muted-foreground flex items-center gap-1.5">
                          <Loader2 class="w-3.5 h-3.5 animate-spin" />
                        </span>
                        <span
                          v-else-if="streamer.isLive"
                          class="text-red-500 flex items-center gap-1.5 text-sm font-medium"
                        >
                          <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                          LIVE
                          <span v-if="streamer.viewerCount" class="text-muted-foreground font-normal">
                            ({{ formatViewerCount(streamer.viewerCount) }} viewers)
                          </span>
                          <!-- DVR Ready indicator -->
                          <span
                            v-if="streamer.hasTempRecording"
                            class="text-[10px] bg-green-500/20 text-green-400 px-1 py-0.5 rounded border border-green-500/30 font-normal"
                            title="DVR recording active - rewind available"
                          >
                            DVR
                          </span>
                        </span>
                        <span v-else class="text-muted-foreground/60 flex items-center gap-1.5 text-sm">
                          <span class="w-2 h-2 rounded-full bg-muted-foreground/40"></span>
                          Offline
                        </span>
                      </template>
                    </div>
                  </div>

                  <!-- Delete Button (top right) -->
                  <button
                    v-if="!streamer.isDetecting"
                    @click.stop="removeStreamer(streamer.id)"
                    class="p-2 rounded-lg text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Remove streamer"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>

                <!-- Row 2: Actions -->
                <div class="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/20 border-t border-border/30">
                  <!-- Left: Segment Duration -->
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-muted-foreground">Segment:</span>
                    <Select
                      :model-value="String(streamer.segmentDurationMinutes)"
                      @update:model-value="updateSegmentDuration(streamer, Number($event))"
                      :disabled="streamer.isDetecting"
                    >
                      <SelectTrigger
                        class="h-8 w-[90px] bg-background border-border/50 text-sm"
                        :class="{ 'opacity-50': streamer.isDetecting }"
                      >
                        <SelectValue :placeholder="`${streamer.segmentDurationMinutes} min`" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 min</SelectItem>
                        <SelectItem value="5">5 min</SelectItem>
                        <SelectItem value="10">10 min</SelectItem>
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <!-- Right: Action Buttons -->
                  <div class="flex items-center gap-2">
                    <template v-if="!streamer.isDetecting">
                      <div
                        v-if="streamer.status === 'STOPPING'"
                        class="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/20"
                      >
                        <Loader2 class="w-4 h-4 animate-spin" />
                        <span class="text-sm font-medium">Stopping...</span>
                      </div>
                      <template v-else>
                        <button
                          @click.stop="refreshLiveStatus(streamer)"
                          class="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          :class="{ 'animate-spin': streamer.isCheckingLive }"
                          :disabled="streamer.isCheckingLive"
                          title="Refresh live status"
                        >
                          <RefreshCw class="w-4 h-4" />
                        </button>
                        <!-- Watch Button (only when live) -->
                        <button
                          v-if="streamer.isLive"
                          @click="openWatchDialog(streamer)"
                          class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30"
                          :title="streamer.hasTempRecording ? 'Watch Live (DVR Ready)' : 'Watch Live'"
                        >
                          <Eye class="w-4 h-4" />
                          Watch
                          <!-- DVR Ready indicator -->
                          <span
                            v-if="streamer.hasTempRecording"
                            class="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full border border-green-500/30"
                          >
                            DVR
                          </span>
                        </button>
                        <button
                          @click="startStreamer(streamer, false)"
                          class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-muted/50 hover:bg-muted text-foreground border border-border/50"
                          title="Start Recording Only"
                        >
                          <Video class="w-4 h-4" />
                          Rec
                        </button>
                        <button
                          @click="startStreamer(streamer, true)"
                          class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30"
                          title="Start Auto-Detect"
                        >
                          <Sparkles class="w-4 h-4" />
                          Auto Detect
                        </button>
                      </template>
                    </template>

                    <!-- Stop Button when Active -->
                    <template v-else>
                      <Button
                        size="sm"
                        variant="destructive"
                        class="h-9 px-5 rounded-lg text-sm font-semibold shadow-sm"
                        @click="stopStreamer(streamer)"
                      >
                        <Square class="w-4 h-4 mr-2 fill-current" />
                        Stop
                      </Button>
                    </template>
                  </div>
                </div>
              </div>
            </transition-group>
          </div>

          <!-- Empty State -->
          <EmptyState
            v-if="streamers.length === 0"
            title="No active monitors"
            description="Add a stream link above to start detecting clips in real-time."
          >
            <template #icon>
              <Radio class="h-16 w-16 text-muted-foreground" />
            </template>
          </EmptyState>
        </div>

        <!-- Activity Log Column -->
        <div v-if="isDetectingAny && activityLogs.length > 0" class="w-full mt-8 lg:mt-0">
          <div class="flex items-center justify-between px-4 text-sm text-muted-foreground font-medium mb-3">
            <span class="flex items-center gap-2">
              <Activity class="w-4 h-4" />
              Real-time Activity
            </span>
            <span class="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Live</span>
          </div>

          <div class="bg-card border border-border/50 rounded-lg overflow-hidden shadow-sm h-[500px] flex flex-col">
            <div class="flex-1 overflow-y-auto p-4 space-y-1 scroll-smooth" ref="logsContainer">
              <transition-group name="list">
                <div
                  v-for="log in activityLogs"
                  :key="log.id"
                  class="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors text-sm group"
                >
                  <span class="text-muted-foreground text-xs font-mono w-16 pt-0.5">{{ log.timestamp }}</span>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                      <!-- Avatar or Platform Dot -->
                      <div
                        v-if="log.profileImageUrl || log.streamThumbnailUrl"
                        class="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-muted border border-border/50"
                      >
                        <img :src="log.streamThumbnailUrl || log.profileImageUrl" class="w-full h-full object-cover" />
                      </div>
                      <span v-else class="w-2 h-2 rounded-full" :class="getPlatformDotColor(log.platform)"></span>

                      <span class="font-medium text-foreground">{{ log.streamerName }}</span>
                    </div>
                    <p class="text-muted-foreground group-hover:text-foreground transition-colors truncate">
                      {{ log.message }}
                    </p>
                  </div>

                  <div v-if="log.status === 'loading'" class="pt-0.5">
                    <Loader2 class="w-3.5 h-3.5 animate-spin text-primary" />
                  </div>
                  <div v-else-if="log.status === 'success'" class="pt-0.5">
                    <Check class="w-3.5 h-3.5 text-green-500" />
                  </div>
                </div>
              </transition-group>
            </div>
          </div>
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
        message="You have less than 1 hour of credits remaining. If you run out of credits, detection will automatically stop and only recording will continue."
        confirm-text="Continue"
        close-text="Cancel"
        :show-cannot-undone-text="false"
        @close="showCreditWarningDialog = false"
        @confirm="confirmCreditWarning"
      />

      <!-- Livestream Watch Dialog -->
      <LivestreamWatchDialog
        v-if="watchingStreamer"
        v-model="showWatchDialog"
        :mint-id="watchingStreamer.mintId"
        :streamer-id="watchingStreamer.id"
        :display-name="watchingStreamer.displayName"
        :profile-image-url="watchingStreamer.profileImageUrl"
        @clip-created="handleClipCreated"
      />
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
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
    Clock,
    Eye,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import LivestreamWatchDialog from '@/components/LivestreamWatchDialog.vue';
  // import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
  import { useLivestreamMonitoring, fetchLiveStatus } from '@/composables/useLivestreamMonitoring';
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
  import type { MonitoredStreamer } from '@/types/livestream';
  import { useCreditBalance } from '@/composables/useCreditBalance';

  type Platform = 'Youtube' | 'Twitch' | 'Kick' | 'PumpFun';

  type ExtendedStreamer = MonitoredStreamer & {
    isDetecting: boolean;
    mode?: 'Auto-Detect' | 'Record Only' | null;
    status?: 'LIVE' | 'WAITING' | 'IDLE' | 'STOPPING';
    // Live status (checked independently of monitoring)
    isLive?: boolean;
    viewerCount?: number;
    isCheckingLive?: boolean;
    // Per-streamer segment duration
    segmentDurationMinutes: number;
    // Temp recording status (for watch-only DVR)
    hasTempRecording?: boolean;
  };

  const streamers = ref<ExtendedStreamer[]>([]);
  const inputValue = ref('');
  const detectedPlatform = ref<Platform | null>(null);
  const logsContainer = ref<HTMLElement | null>(null);

  // Search state
  const searchResults = ref<TokenSearchResult[]>([]);
  const showSearchDialog = ref(false);
  const isSearching = ref(false);

  // Watch dialog state
  const showWatchDialog = ref(false);
  const watchingStreamer = ref<ExtendedStreamer | null>(null);

  const {
    activeSessions,
    monitoredStreamers,
    startMonitoring,
    stopMonitoring,
    activityLogs,
    addActivityLog,
    clearLogs,
    tempRecordingSessions,
    hasTempRecording,
  } = useLivestreamMonitoring();

  const { hoursRemaining, fetchBalance } = useCreditBalance();

  const isDetectingAny = computed(() => monitoredStreamers.value.size > 0 || activeSessions.value.size > 0);

  // Sorted streamers: Detecting/Recording first, then Live, then Offline (each group alphabetically)
  const sortedStreamers = computed(() => {
    return [...streamers.value].sort((a, b) => {
      // Priority: 1 = Detecting/Recording, 2 = Live (not detecting), 3 = Offline
      const getPriority = (s: ExtendedStreamer) => {
        if (s.isDetecting) return 1; // Actively recording or auto-detecting (highest priority)
        if (s.isLive) return 2; // Live but not being monitored
        return 3; // Offline
      };

      const aPriority = getPriority(a);
      const bPriority = getPriority(b);

      if (aPriority !== bPriority) return aPriority - bPriority;

      // Then sort alphabetically by display name (case-insensitive)
      const aName = (a.displayName || a.mintId).toLowerCase();
      const bName = (b.displayName || b.mintId).toLowerCase();
      return aName.localeCompare(bName);
    });
  });

  // Credit warning state
  const showCreditWarningDialog = ref(false);
  const pendingStreamerStart = ref<{ streamer: ExtendedStreamer; detectClips: boolean } | null>(null);

  const liveStatusInterval = ref<number | null>(null);

  onMounted(async () => {
    await loadStreamers();
    // Refresh metadata for streamers that might be missing names or images
    refreshStreamerMetadata();
    syncDetectionState(); // Initial sync
    // Check live status for all streamers
    checkAllLiveStatuses();

    // Refresh live status every 60 seconds
    liveStatusInterval.value = window.setInterval(() => {
      checkAllLiveStatuses();
    }, 60_000);
  });

  async function checkAllLiveStatuses() {
    // Check live status for all streamers in parallel
    const promises = streamers.value.map(async (streamer) => {
      // Skip if already being monitored (we already know the status)
      if (streamer.isDetecting) return;

      // Set checking state
      const index = streamers.value.findIndex((s) => s.id === streamer.id);
      if (index !== -1) {
        streamers.value[index] = { ...streamers.value[index], isCheckingLive: true };
      }

      try {
        const status = await fetchLiveStatus(streamer.mintId);
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

  // Refresh live status for a single streamer
  async function refreshLiveStatus(streamer: ExtendedStreamer) {
    if (streamer.isDetecting) return;

    const index = streamers.value.findIndex((s) => s.id === streamer.id);
    if (index === -1) return;

    streamers.value[index] = { ...streamers.value[index], isCheckingLive: true };

    try {
      const status = await fetchLiveStatus(streamer.mintId);
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
      (s) => s.platform === 'PumpFun' && (s.displayName === s.mintId || !s.profileImageUrl)
    );

    if (needsUpdate.length === 0) return;

    // Process sequentially to avoid rate limits
    for (const streamer of needsUpdate) {
      try {
        // Use search to find token metadata
        let match: TokenSearchResult | null = null;

        // 1. Try DexScreener search first
        const results = await searchPumpFunTokens(streamer.mintId);
        if (results && results.length > 0) {
          // Find exact match if possible, or take first
          match = results.find((r) => r.mint === streamer.mintId) || results[0];
        }

        // 2. Fallback to server (Metaplex) if no match or missing image
        if (!match || !match.image) {
          const serverMeta = await fetchTokenMetadataFromServer(streamer.mintId);
          if (serverMeta) {
            // Use server metadata, potentially overriding DexScreener partial result
            match = serverMeta;
          }
        }

        if (match) {
          const updates: any = {};
          if (streamer.displayName === streamer.mintId) {
            updates.display_name = match.symbol; // Use symbol as display name
          }
          if (!streamer.profileImageUrl && match.image) {
            updates.profile_image_url = match.image;
          }

          if (Object.keys(updates).length > 0) {
            await updateMonitoredStreamer(streamer.id, updates);
            // Update local state
            if (updates.display_name) streamer.displayName = updates.display_name;
            if (updates.profile_image_url) streamer.profileImageUrl = updates.profile_image_url;
          }
        }
      } catch (e) {
        console.error('Failed to refresh metadata for', streamer.mintId, e);
      }
    }
  }

  onUnmounted(async () => {
    // Do not stop monitoring on unmount to allow background processing

    // Clean up live status polling interval
    if (liveStatusInterval.value) {
      clearInterval(liveStatusInterval.value);
      liveStatusInterval.value = null;
    }
  });

  watch([activeSessions, monitoredStreamers, tempRecordingSessions], () => syncDetectionState(), { deep: true });

  function syncDetectionState() {
    streamers.value = streamers.value.map((streamer) => {
      const monitored = monitoredStreamers.value.get(streamer.id);
      const session = activeSessions.value.get(streamer.id);
      const tempSession = tempRecordingSessions.value.get(streamer.id);

      return {
        ...streamer,
        isDetecting: !!monitored,
        mode: monitored ? (monitored.options.detectClips ? 'Auto-Detect' : 'Record Only') : null,
        status: session ? (session.isStopping ? 'STOPPING' : 'LIVE') : monitored ? 'WAITING' : 'IDLE',
        // When actively monitoring, derive live status from session state
        isLive: monitored ? (session ? true : streamer.isLive) : streamer.isLive,
        // Track temp recording status for DVR availability
        hasTempRecording: !!tempSession,
      };
    });
  }

  function getStatusLabel(streamer: ExtendedStreamer) {
    if (streamer.status === 'STOPPING') return 'STOPPING...';
    if (!streamer.isDetecting) return 'IDLE';
    if (streamer.status === 'LIVE') return `LIVE (${streamer.mode === 'Auto-Detect' ? 'AUTO' : 'REC'})`;
    return `WAITING (${streamer.mode === 'Auto-Detect' ? 'AUTO' : 'REC'})`;
  }

  // Open watch dialog for a live streamer
  function openWatchDialog(streamer: ExtendedStreamer) {
    if (!streamer.isLive) return;
    watchingStreamer.value = streamer;
    showWatchDialog.value = true;
  }

  // Handle clip created from watch dialog
  function handleClipCreated(clipPath: string) {
    addActivityLog({
      streamerId: watchingStreamer.value?.id || 'system',
      streamerName: watchingStreamer.value?.displayName || 'System',
      platform: 'PumpFun',
      message: `Clip created: ${clipPath.split(/[\\/]/).pop()}`,
      status: 'success',
      mintId: watchingStreamer.value?.mintId,
      profileImageUrl: watchingStreamer.value?.profileImageUrl,
    });
  }

  async function loadStreamers() {
    try {
      const records = await getAllMonitoredStreamers();

      streamers.value = records.map((record) => {
        const monitored = monitoredStreamers.value.get(record.id);
        const session = activeSessions.value.get(record.id);

        return {
          id: record.id,
          mintId: record.mint_id,
          displayName: record.display_name,
          platform: 'PumpFun',
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
        };
      });
    } catch (error) {
      console.error('[LiveClip] Failed to load monitored streamers', error);
    }
  }

  function detectPlatform() {
    const val = inputValue.value;

    // Check PumpFun using the robust extractor first (handles URLs and Mint IDs)
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

  function getPlatformSolidBg(platform: Platform) {
    switch (platform) {
      case 'Youtube':
        return 'bg-red-600';
      case 'Twitch':
        return 'bg-[#9146FF]';
      case 'Kick':
        return 'bg-[#53FC18]';
      case 'PumpFun':
        return 'bg-emerald-500';
      default:
        return 'bg-muted';
    }
  }

  function getPlatformIconClasses(platform: Platform) {
    switch (platform) {
      case 'Youtube':
      case 'Twitch':
      case 'PumpFun':
        return 'brightness-200';
      case 'Kick':
        return 'brightness-0 invert-0';
      default:
        return '';
    }
  }

  function getPlatformDotColor(platform: Platform) {
    switch (platform) {
      case 'Youtube':
        return 'bg-red-500';
      case 'Twitch':
        return 'bg-[#9146FF]';
      case 'Kick':
        return 'bg-[#53FC18]';
      case 'PumpFun':
        return 'bg-emerald-500';
      default:
        return 'bg-slate-500';
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

    // Check if it's a valid mint ID or URL first
    const mintId = extractMintId(inputValue.value);

    if (mintId) {
      // Even if we have a mint ID, try to fetch metadata first for better UX
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
        // 1. Try DexScreener search first
        const results = await searchPumpFunTokens(mintId);
        if (results && results.length > 0) {
          match = results.find((r) => r.mint === mintId) || results[0];
        }

        // 2. Fallback to server (Metaplex) if no match or missing image
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

      await confirmAddStreamer(mintId, displayName, profileImage);
      return;
    }

    // If not a mint ID, try searching
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
        // Try to see if input value is a Mint ID but regex didn't catch it initially (unlikely if logic is correct but good fallback)
        // OR if the user pasted a mint ID that DexScreener doesn't know yet.
        // We can try to fetch metadata assuming it is a mint ID
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
        // Multiple results
        searchResults.value = results;
        showSearchDialog.value = true;
      }
    }
  }

  async function confirmAddStreamer(mintId: string, displayName: string, profileImageUrl?: string) {
    try {
      await createMonitoredStreamer(mintId, displayName, profileImageUrl);
      await loadStreamers();
      inputValue.value = '';
      detectedPlatform.value = null;
      showSearchDialog.value = false;

      addActivityLog({
        streamerId: mintId,
        streamerName: displayName,
        platform: 'PumpFun',
        message: 'Added to monitored list.',
        status: 'success',
        mintId,
        profileImageUrl,
      });
    } catch (error) {
      console.error('[LiveClip] Failed to add streamer', error);
      addActivityLog({
        streamerId: mintId,
        streamerName: displayName,
        platform: 'PumpFun',
        message: 'Failed to add streamer. Ensure it is not already tracked.',
        status: 'info',
        mintId,
      });
    }
  }

  function selectSearchResult(token: TokenSearchResult) {
    confirmAddStreamer(token.mint, token.symbol, token.image);
  }

  async function removeStreamer(id: string) {
    try {
      await deleteMonitoredStreamer(id);
      streamers.value = streamers.value.filter((s) => s.id !== id);
    } catch (error) {
      console.error('[LiveClip] Failed to remove streamer', error);
    }
  }

  async function startStreamer(streamer: ExtendedStreamer, detectClips: boolean) {
    if (detectClips) {
      await fetchBalance();
      const balance = hoursRemaining.value;

      // Check if balance is low (under 1 hour) and not unlimited
      if (balance !== 'unlimited' && typeof balance === 'number' && balance < 1) {
        pendingStreamerStart.value = { streamer, detectClips };
        showCreditWarningDialog.value = true;
        return;
      }
    }

    await executeStartStreamer(streamer, detectClips);
  }

  function confirmCreditWarning() {
    if (pendingStreamerStart.value) {
      executeStartStreamer(pendingStreamerStart.value.streamer, pendingStreamerStart.value.detectClips);
      pendingStreamerStart.value = null;
    }
    showCreditWarningDialog.value = false;
  }

  async function executeStartStreamer(streamer: ExtendedStreamer, detectClips: boolean) {
    // Clear logs if we are starting detection for the first time on this page view
    // and nothing else is currently running.
    if (!isDetectingAny.value) {
      clearLogs();
    }

    // Add initial activity log
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

    // Move to top of the list
    const index = streamers.value.findIndex((s) => s.id === streamer.id);
    if (index > 0) {
      const [movedStreamer] = streamers.value.splice(index, 1);
      streamers.value.unshift(movedStreamer);
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function stopStreamer(streamer: ExtendedStreamer) {
    try {
      await stopMonitoring([streamer.id]);

      // Resolve pending logs
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
      // Update local state
      const index = streamers.value.findIndex((s) => s.id === streamer.id);
      if (index !== -1) {
        streamers.value[index] = { ...streamers.value[index], segmentDurationMinutes: duration };
      }
    } catch (error) {
      console.error('[LiveClip] Failed to update segment duration', error);
    }
  }
</script>

<style scoped>
  /* Custom Transitions */
  .list-move,
  .list-enter-active,
  .list-leave-active {
    transition: all 0.4s ease;
  }

  .list-enter-from,
  .list-leave-to {
    opacity: 0;
    transform: translateY(20px);
  }

  .list-leave-active {
    position: absolute;
    width: 100%;
    z-index: 0; /* Keep leaving items behind entering items */
  }

  /* Container specific overrides to prevent scrollbar jump */
  .relative {
    position: relative;
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

  .slide-up-enter-active,
  .slide-up-leave-active {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .slide-up-enter-from,
  .slide-up-leave-to {
    transform: translate(-50%, 100%);
    opacity: 0;
  }
</style>
