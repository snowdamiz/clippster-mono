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
            :disabled="!inputValue || !detectedPlatform"
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
                    class="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden relative"
                  >
                    <!-- Solid Background Layer -->
                    <div class="absolute inset-0" :class="getPlatformSolidBg(streamer.platform)"></div>

                    <!-- Icon Layer -->
                    <img
                      :src="getPlatformIcon(streamer.platform)"
                      class="w-7 h-7 relative z-10"
                      :class="getPlatformIconClasses(streamer.platform)"
                    />
                  </div>

                  <!-- Text -->
                  <div class="flex flex-col min-w-0">
                    <h3 class="font-semibold text-lg truncate pr-4 text-foreground">
                      {{ streamer.identifier }}
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
  import { ref, computed, onUnmounted } from 'vue';
  import { Radio, Plus, Check, Play, Square, Search, Trash2, Activity, Loader2 } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';

  // Types
  type Platform = 'Youtube' | 'Twitch' | 'Kick' | 'PumpFun';

  interface Streamer {
    id: string;
    platform: Platform;
    identifier: string; // URL or Username
    selected: boolean;
    isDetecting: boolean;
  }

  interface ActivityLog {
    id: string;
    timestamp: string;
    streamerId: string;
    streamerName: string;
    platform: Platform;
    message: string;
    status: 'loading' | 'success' | 'info';
  }

  // State
  const streamers = ref<Streamer[]>([]);
  const inputValue = ref('');
  const detectedPlatform = ref<Platform | null>(null);
  const activityLogs = ref<ActivityLog[]>([]);
  const logsContainer = ref<HTMLElement | null>(null);
  let simulationInterval: number | null = null;

  // Computed
  const selectedStreamers = computed(() => streamers.value.filter((s) => s.selected));
  const allSelected = computed(() => streamers.value.length > 0 && streamers.value.every((s) => s.selected));
  const isDetectingAny = computed(() => selectedStreamers.value.some((s) => s.isDetecting));

  // Platform Detection Logic
  function detectPlatform() {
    const val = inputValue.value.toLowerCase();

    if (val.includes('youtube.com') || val.includes('youtu.be')) {
      detectedPlatform.value = 'Youtube';
    } else if (val.includes('twitch.tv')) {
      detectedPlatform.value = 'Twitch';
    } else if (val.includes('kick.com')) {
      detectedPlatform.value = 'Kick';
    } else if (val.includes('pump.fun')) {
      detectedPlatform.value = 'PumpFun';
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
    // Ensure icons are clearly visible on their solid colored backgrounds
    switch (platform) {
      case 'Youtube':
      case 'Twitch':
      case 'PumpFun':
        return 'brightness-200'; // White icon
      case 'Kick':
        return 'brightness-0 invert-0'; // Black icon for neon green background
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

  function extractIdentifier(input: string, platform: Platform | null): string {
    // Simple extraction for display purposes
    try {
      const url = new URL(input);
      if (platform === 'Youtube') {
        if (url.pathname.startsWith('/@')) return url.pathname.substring(1);
        if (url.pathname.startsWith('/channel/')) return 'Channel';
        if (url.searchParams.get('v')) return 'Video';
      }
      if (platform === 'Twitch' || platform === 'Kick') {
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length > 0) return parts[0];
      }
      if (platform === 'PumpFun') {
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length > 0) return parts[parts.length - 1].substring(0, 8) + '...';
      }
    } catch (e) {
      // Not a URL, return as is
    }
    return input;
  }

  function addStreamer() {
    if (!inputValue.value || !detectedPlatform.value) return;

    const identifier = extractIdentifier(inputValue.value, detectedPlatform.value);

    streamers.value.unshift({
      id: crypto.randomUUID(),
      platform: detectedPlatform.value,
      identifier: identifier,
      selected: true,
      isDetecting: false,
    });

    // Reset
    inputValue.value = '';
    detectedPlatform.value = null;
  }

  function removeStreamer(id: string) {
    streamers.value = streamers.value.filter((s) => s.id !== id);
  }

  function toggleSelection(id: string) {
    const streamer = streamers.value.find((s) => s.id === id);
    if (streamer) {
      streamer.selected = !streamer.selected;
    }
  }

  function selectAll() {
    const targetState = !allSelected.value;
    streamers.value.forEach((s) => (s.selected = targetState));
  }

  function toggleDetection() {
    const targetState = !isDetectingAny.value;
    streamers.value.forEach((s) => {
      if (s.selected) {
        s.isDetecting = targetState;
      }
    });

    if (targetState) {
      startSimulation();
    } else {
      stopSimulation();
    }
  }

  // --- Simulation Logic ---

  function startSimulation() {
    if (simulationInterval) return;

    // Initial logs for starting
    streamers.value.forEach((s) => {
      if (s.selected) {
        addLog(s, `Connecting to stream...`, 'loading');
      }
    });

    simulationInterval = window.setInterval(() => {
      const activeStreamers = streamers.value.filter((s) => s.isDetecting);
      if (activeStreamers.length === 0) {
        stopSimulation();
        return;
      }

      // Pick a random active streamer
      const streamer = activeStreamers[Math.floor(Math.random() * activeStreamers.length)];
      const actions = [
        { msg: `Downloading Segment ${Math.floor(Math.random() * 100)}`, status: 'loading' },
        { msg: `Transcribing audio from segment...`, status: 'loading' },
        { msg: `Analyzing transcript for keywords`, status: 'loading' },
        { msg: `Clip detected: "Funny moment" (0:30)`, status: 'success' },
        { msg: `Clip detected: "Epic win" (1:15)`, status: 'success' },
        { msg: `Starting next segment download`, status: 'info' },
      ];

      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      addLog(streamer, randomAction.msg, randomAction.status as any);
    }, 2500); // New log every 2.5s
  }

  function stopSimulation() {
    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }
    if (!isDetectingAny.value && activityLogs.value.length > 0) {
      // Add stopped logs
      activityLogs.value.push({
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString([], {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        streamerId: 'system',
        streamerName: 'System',
        platform: 'Youtube', // dummy
        message: 'Monitoring stopped for all channels.',
        status: 'info',
      });
    }
  }

  function addLog(streamer: Streamer, message: string, status: 'loading' | 'success' | 'info') {
    const log: ActivityLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toLocaleTimeString([], {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      streamerId: streamer.id,
      streamerName: streamer.identifier,
      platform: streamer.platform,
      message: message,
      status: status,
    };

    activityLogs.value.unshift(log); // Add to top

    // Keep log size manageable
    if (activityLogs.value.length > 50) {
      activityLogs.value.pop();
    }
  }

  onUnmounted(() => {
    stopSimulation();
  });
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
