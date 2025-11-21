<template>
  <PageLayout title="Live Clip" description="Real-time clip detection" :show-header="true" :icon="Radio">
    <template #actions>
      <div class="relative w-[380px] shadow-sm group mr-2">
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
          class="h-14 pl-11 pr-30 text-sm bg-background border-border/70 rounded-xl focus-visible:ring-primary/20 transition-all hover:border-primary/30 focus:border-primary/50 shadow-sm w-full"
          placeholder="Paste stream link..."
          @keyup.enter="addStreamer"
          @input="detectPlatform"
        />

        <div class="absolute right-2.5 top-1/2 -translate-y-1/2">
          <Button
            size="sm"
            class="h-8 px-4 rounded-lg font-medium transition-all text-xs"
            :disabled="!inputValue"
            @click="addStreamer"
          >
            <Plus class="w-3.5 h-3.5 mr-1.5" />
            Track
          </Button>
        </div>
      </div>
    </template>

    <div
      class="mx-auto pt-2 relative transition-all duration-500 ease-in-out"
      :class="isDetectingAny && activityLogs.length > 0 ? 'max-w-7xl' : 'max-w-full'"
    >
      <div :class="{ 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-start': isDetectingAny && activityLogs.length > 0 }">
        <!-- Streamers List Column -->
        <div class="w-full">
          <div
            v-if="streamers.length > 0"
            class="flex items-center justify-between px-4 text-sm text-muted-foreground font-medium mb-3"
          >
            <span>Monitored Channels</span>
            <span>{{ streamers.length }} active</span>
          </div>

          <div class="relative">
            <transition-group name="list" tag="div" class="space-y-4">
              <div
                v-for="streamer in streamers"
                :key="streamer.id"
                class="group relative flex items-center justify-between p-4 bg-card border border-border/50 rounded-xl transition-all duration-200 cursor-pointer hover:border-primary/30 hover:bg-accent/5"
                :class="{
                  'border-primary/30 bg-primary/3': streamer.selected,
                  'shadow-sm': !streamer.selected,
                }"
                @click="toggleSelection(streamer.id)"
              >
                <!-- Left: Identity -->
                <div class="flex items-center gap-4 min-w-0">
                  <!-- Checkbox (Visual) -->
                  <div
                    class="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                    :class="
                      streamer.selected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/20 group-hover:border-primary/50'
                    "
                  >
                    <Check v-if="streamer.selected" class="w-3.5 h-3.5" />
                  </div>

                  <!-- Icon -->
                  <div
                    class="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden relative bg-muted"
                  >
                    <!-- Image Layer (Profile or Stream Thumbnail) -->
                    <img
                      v-if="streamer.profileImageUrl || streamer.streamThumbnailUrl"
                      :src="streamer.streamThumbnailUrl || streamer.profileImageUrl"
                      class="w-full h-full object-cover absolute inset-0 z-20"
                    />

                    <!-- Solid Background Layer (Fallback) -->
                    <div class="absolute inset-0" :class="getPlatformSolidBg(streamer.platform)"></div>

                    <!-- Icon Layer (Fallback) -->
                    <img
                      v-if="!streamer.profileImageUrl && !streamer.streamThumbnailUrl"
                      :src="getPlatformIcon(streamer.platform)"
                      class="w-7 h-7 relative z-10"
                      :class="getPlatformIconClasses(streamer.platform)"
                    />
                  </div>

                  <!-- Text -->
                  <div class="flex flex-col min-w-0">
                    <h3 class="font-semibold text-lg truncate pr-4 text-foreground">
                      {{ streamer.displayName }}
                    </h3>
                    <span class="text-sm text-muted-foreground flex items-center gap-1">
                      {{ streamer.platform }}
                      <span v-if="streamer.isDetecting" class="text-green-500 flex items-center gap-1 ml-2">
                        <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Live Monitoring
                      </span>
                    </span>
                  </div>
                </div>

                <!-- Right: Actions -->
                <div class="flex items-center gap-5">
                  <!-- Status Pill -->
                  <div
                    class="hidden sm:flex px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors"
                    :class="
                      streamer.isDetecting
                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                        : 'bg-muted/50 text-muted-foreground border-transparent'
                    "
                  >
                    {{ streamer.isDetecting ? 'ACTIVE' : 'IDLE' }}
                  </div>

                  <!-- Delete Button -->
                  <button
                    @click.stop="removeStreamer(streamer.id)"
                    class="p-2.5 rounded-xl text-muted-foreground hover:text-destructive transition-colors"
                    title="Remove streamer"
                  >
                    <Trash2 class="w-5 h-5" />
                  </button>
                </div>
              </div>
            </transition-group>
          </div>

          <!-- Empty State -->
          <div
            v-if="streamers.length === 0"
            class="flex flex-col items-center justify-center py-20 text-center opacity-50 border-2 border-dashed border-border/30 rounded-[2.5rem]"
          >
            <div class="w-24 h-24 bg-muted/20 rounded-full flex items-center justify-center mb-6">
              <Radio class="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 class="text-xl font-medium">No active monitors</h3>
            <p class="text-base text-muted-foreground max-w-sm mx-auto mt-2">
              Add a stream link above to start detecting clips in real-time.
            </p>
          </div>
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

          <div class="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm h-[500px] flex flex-col">
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
                      <!-- Platform Dot -->
                      <span class="w-2 h-2 rounded-full" :class="getPlatformDotColor(log.platform)"></span>
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

      <!-- Floating Control Bar -->
      <transition name="slide-up">
        <div
          v-if="selectedStreamers.length > 0"
          class="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50"
        >
          <div
            class="bg-popover text-popover-foreground rounded-4xl shadow-2xl border border-border px-4 py-3 flex items-center justify-between backdrop-blur-xl"
          >
            <div class="flex items-center gap-4 pl-2">
              <div class="flex flex-col">
                <span class="text-sm font-semibold">{{ selectedStreamers.length }} selected</span>
                <button
                  @click="selectAll"
                  class="text-xs text-muted-foreground hover:text-foreground text-left transition-colors"
                >
                  {{ allSelected ? 'Deselect All' : 'Select All' }}
                </button>
              </div>
            </div>

            <Button
              size="sm"
              :variant="isDetectingAny ? 'destructive' : 'default'"
              class="rounded-xl px-6 font-semibold shadow-lg transition-all"
              :class="{ 'opacity-100 hover:bg-destructive/90 text-white': isDetectingAny }"
              @click="toggleDetection"
            >
              <component :is="isDetectingAny ? Square : Play" class="w-4 h-4 mr-2 fill-current" />
              {{ isDetectingAny ? 'Stop Detection' : 'Start Detection' }}
            </Button>
          </div>
        </div>
      </transition>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { Radio, Plus, Check, Play, Square, Search, Trash2, Activity, Loader2 } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
  import { useLivestreamMonitoring } from '@/composables/useLivestreamMonitoring';
  import { useLivestreamSegmentProcessing } from '@/composables/useLivestreamSegmentProcessing';
  import {
    getAllMonitoredStreamers,
    createMonitoredStreamer,
    deleteMonitoredStreamer,
    updateMonitoredStreamer,
  } from '@/services/database';
  import { extractMintId, searchPumpFunTokens, type TokenSearchResult } from '@/services/pumpfun';
  import type { MonitoredStreamer, SegmentEventPayload } from '@/types/livestream';

  type Platform = 'Youtube' | 'Twitch' | 'Kick' | 'PumpFun';

  interface ActivityLog {
    id: string;
    timestamp: string;
    streamerId: string;
    streamerName: string;
    platform: Platform;
    message: string;
    status: 'loading' | 'success' | 'info';
    mintId?: string;
  }

  const streamers = ref<MonitoredStreamer[]>([]);
  const inputValue = ref('');
  const detectedPlatform = ref<Platform | null>(null);
  const activityLogs = ref<ActivityLog[]>([]);
  const logsContainer = ref<HTMLElement | null>(null);

  // Search state
  const searchResults = ref<TokenSearchResult[]>([]);
  const showSearchDialog = ref(false);
  const isSearching = ref(false);

  const { activeSessions, startMonitoring, stopMonitoring, isMonitoring } = useLivestreamMonitoring();
  const { handleSegmentReady } = useLivestreamSegmentProcessing();

  const selectedStreamers = computed(() => streamers.value.filter((s) => s.selected));
  const allSelected = computed(() => streamers.value.length > 0 && streamers.value.every((s) => s.selected));
  const isDetectingAny = computed(() => activeSessions.value.size > 0 || isMonitoring.value === true);

  let segmentUnlisten: UnlistenFn | null = null;
  let streamEndedUnlisten: UnlistenFn | null = null;
  let recorderLogUnlisten: UnlistenFn | null = null;

  onMounted(async () => {
    await loadStreamers();
    await attachEventListeners();
    // Refresh metadata for streamers that might be missing names or images
    refreshStreamerMetadata();
  });

  async function refreshStreamerMetadata() {
    const needsUpdate = streamers.value.filter(
      (s) => s.platform === 'PumpFun' && (s.displayName === s.mintId || !s.profileImageUrl)
    );

    if (needsUpdate.length === 0) return;

    // Process sequentially to avoid rate limits
    for (const streamer of needsUpdate) {
      try {
        // Use search to find token metadata
        const results = await searchPumpFunTokens(streamer.mintId);
        if (results && results.length > 0) {
          // Find exact match if possible, or take first
          const match = results.find((r) => r.mint === streamer.mintId) || results[0];

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
        }
      } catch (e) {
        console.error('Failed to refresh metadata for', streamer.mintId, e);
      }
    }
  }

  onUnmounted(async () => {
    if (segmentUnlisten) {
      await segmentUnlisten();
      segmentUnlisten = null;
    }
    if (streamEndedUnlisten) {
      await streamEndedUnlisten();
      streamEndedUnlisten = null;
    }
    if (recorderLogUnlisten) {
      await recorderLogUnlisten();
      recorderLogUnlisten = null;
    }
    await stopMonitoring();
  });

  watch(
    () => activeSessions.value.size,
    () => syncDetectionState()
  );

  function syncDetectionState() {
    const activeIds = new Set(activeSessions.value.keys());
    streamers.value = streamers.value.map((streamer) => ({
      ...streamer,
      isDetecting: activeIds.has(streamer.id),
    }));
  }

  const segmentLogIds = new Map<number, string>();

  async function attachEventListeners() {
    segmentUnlisten = await listen<SegmentEventPayload>('segment-ready', async (event) => {
      const payload = event.payload;

      // 1. Update previous segment log to success if it exists (and wasn't already updated)
      // Note: Usually segment-ready for X means X is done.
      // So payload.segment IS the finished segment.

      // Find the log for THIS segment that was "starting"
      const startingLogId = segmentLogIds.get(payload.segment);
      if (startingLogId) {
        updateActivityLog(startingLogId, {
          message: `Segment ${payload.segment} finished recording`,
          status: 'success',
        });
        segmentLogIds.delete(payload.segment);
      } else {
        // Fallback if missed start event or first segment logic handling
        addActivityLog({
          streamerId: payload.streamerId,
          streamerName: getStreamerName(payload.streamerId),
          platform: 'PumpFun',
          mintId: payload.mintId,
          message: `Segment ${payload.segment} finished recording`,
          status: 'success',
        });
      }

      // 2. Log next segment starting
      if (activeSessions.value.has(payload.streamerId)) {
        const nextSegment = payload.segment + 1;
        const id = addActivityLog({
          streamerId: payload.streamerId,
          streamerName: getStreamerName(payload.streamerId),
          platform: 'PumpFun',
          mintId: payload.mintId,
          message: `Segment ${nextSegment} starting recording`,
          status: 'loading',
        });
        segmentLogIds.set(nextSegment, id);
      }

      // 3. Create log for processing status
      const processingLogId = addActivityLog({
        streamerId: payload.streamerId,
        streamerName: getStreamerName(payload.streamerId),
        platform: 'PumpFun',
        mintId: payload.mintId,
        message: `Processing Segment ${payload.segment}...`,
        status: 'loading',
      });

      await handleSegmentReady(payload.sessionId, payload, (status) => {
        const isSuccess = status.includes('Found');
        const isError = status.toLowerCase().includes('error') || status.toLowerCase().includes('failed');

        updateActivityLog(processingLogId, {
          message: status,
          status: isSuccess ? 'success' : isError ? 'info' : 'loading', // info for error to not be too alarming or add error status support
        });
      });
    });

    streamEndedUnlisten = await listen<{ streamerId: string; mintId: string }>('stream-ended', (event) => {
      activeSessions.value.delete(event.payload.streamerId);
      syncDetectionState();
      addActivityLog({
        streamerId: event.payload.streamerId,
        streamerName: getStreamerName(event.payload.streamerId),
        platform: 'PumpFun',
        mintId: event.payload.mintId,
        message: 'Stream ended. Finishing final segments...',
        status: 'info',
      });
    });

    recorderLogUnlisten = await listen<{ streamerId: string; mintId: string; message: string; level: string }>(
      'recorder-log',
      (event) => {
        // Filter out overly verbose messages if needed
        const { streamerId, mintId, message } = event.payload;

        // Don't show "Encoder waiting for media" as it spams
        if (message.includes('Encoder waiting for media')) return;

        // Ignore resolution changes in logs as users don't need to see it
        if (message.includes('Resolution changed')) return;

        addActivityLog({
          streamerId,
          streamerName: getStreamerName(streamerId),
          platform: 'PumpFun',
          mintId,
          message: message,
          status: 'info',
        });
      }
    );
  }

  async function loadStreamers() {
    try {
      const records = await getAllMonitoredStreamers();
      const activeIds = new Set(activeSessions.value.keys());
      streamers.value = records.map((record) => ({
        id: record.id,
        mintId: record.mint_id,
        displayName: record.display_name,
        platform: 'PumpFun',
        lastCheckTimestamp: record.last_check_timestamp,
        isCurrentlyLive: Boolean(record.is_currently_live),
        currentSessionId: record.current_session_id,
        selected: false,
        isDetecting: activeIds.has(record.id),
        profileImageUrl: record.profile_image_url || undefined,
        streamThumbnailUrl: record.stream_thumbnail_url || undefined,
      }));
    } catch (error) {
      console.error('[LiveClip] Failed to load monitored streamers', error);
    }
  }

  function detectPlatform() {
    const val = inputValue.value.toLowerCase();
    if (val.includes('pump.fun') || /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(val)) {
      detectedPlatform.value = 'PumpFun';
      return;
    }

    if (val.includes('youtube.com') || val.includes('youtu.be')) {
      detectedPlatform.value = 'Youtube';
    } else if (val.includes('twitch.tv')) {
      detectedPlatform.value = 'Twitch';
    } else if (val.includes('kick.com')) {
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
        const results = await searchPumpFunTokens(mintId);
        const match = results.find((r) => r.mint === mintId) || results[0];
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

  function toggleSelection(id: string) {
    const streamer = streamers.value.find((s) => s.id === id);
    if (streamer) {
      streamer.selected = !streamer.selected;
    }
  }

  function selectAll() {
    const targetState = !allSelected.value;
    streamers.value = streamers.value.map((streamer) => ({
      ...streamer,
      selected: targetState,
    }));
  }

  async function toggleDetection() {
    if (isDetectingAny.value) {
      await stopMonitoring();
      addActivityLog({
        streamerId: 'system',
        streamerName: 'System',
        platform: 'PumpFun',
        message: 'Stopped monitoring.',
        status: 'info',
      });
      return;
    }

    const selected = selectedStreamers.value;
    if (selected.length === 0) return;

    await startMonitoring(selected);
    selected.forEach((streamer) => {
      addActivityLog({
        streamerId: streamer.id,
        streamerName: streamer.displayName,
        platform: streamer.platform,
        message: 'Monitoring started.',
        status: 'success',
        mintId: streamer.mintId,
      });

      // Initial segment start log
      const id = addActivityLog({
        streamerId: streamer.id,
        streamerName: streamer.displayName,
        platform: streamer.platform,
        message: 'Segment 1 starting recording',
        status: 'loading',
        mintId: streamer.mintId,
      });
      segmentLogIds.set(1, id);
    });
  }

  function getStreamerName(streamerId: string) {
    return streamers.value.find((s) => s.id === streamerId)?.displayName || 'Unknown';
  }

  function addActivityLog(
    log: Omit<ActivityLog, 'id' | 'timestamp'> & Partial<Pick<ActivityLog, 'id' | 'timestamp'>>
  ): string {
    const id = log.id ?? crypto.randomUUID();
    const entry: ActivityLog = {
      id,
      timestamp:
        log.timestamp ??
        new Date().toLocaleTimeString([], {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      streamerId: log.streamerId,
      streamerName: log.streamerName,
      platform: log.platform,
      message: log.message,
      status: log.status,
      mintId: log.mintId,
    };

    activityLogs.value.unshift(entry);
    if (activityLogs.value.length > 100) {
      activityLogs.value.pop();
    }
    return id;
  }

  function updateActivityLog(id: string, updates: Partial<ActivityLog>) {
    const index = activityLogs.value.findIndex((log) => log.id === id);
    if (index !== -1) {
      activityLogs.value[index] = { ...activityLogs.value[index], ...updates };
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
