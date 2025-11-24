<template>
  <PageLayout
    title="PumpFun"
    description="Download streams directly from PumpFun"
    :show-header="true"
    icon="/capsule.svg"
  >
    <template #actions>
      <div class="flex items-center gap-3">
        <!-- Recent Searches Dropdown -->
        <div class="relative" v-if="pumpFunStore.getRecentSearches.length > 0">
          <button
            @click="showRecentDropdown = !showRecentDropdown"
            class="px-3 py-2.5 bg-muted border border-border rounded-md text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all flex items-center gap-2"
            title="Recent searches"
          >
            <Clock class="h-4 w-4" />
            <span class="text-sm">Recent</span>
            <ChevronDown class="h-3 w-3 transition-transform" :class="{ 'rotate-180': showRecentDropdown }" />
          </button>
          <!-- Dropdown Menu -->
          <div
            v-if="showRecentDropdown"
            class="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-md shadow-lg z-[9999] max-h-64 overflow-y-auto"
            @click.stop
          >
            <div class="p-2">
              <div class="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">Recent Searches</div>
              <div v-for="search in pumpFunStore.getRecentSearches.slice(0, 10)" :key="search.mintId" class="group">
                <div
                  @click="
                    handleRecentSearchClick(search);
                    showRecentDropdown = false;
                  "
                  class="w-full text-left px-3 py-2 rounded-md hover:bg-muted/80 transition-colors flex items-center gap-3 cursor-pointer"
                  :title="`Search: ${search.displayText}${search.label ? ` (${search.label})` : ''}`"
                >
                  <!-- Icon/Image -->
                  <div
                    class="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0 border border-border/50 flex items-center justify-center"
                  >
                    <img v-if="search.imageUrl" :src="search.imageUrl" class="w-full h-full object-cover" />
                    <Clock v-else class="h-4 w-4 text-muted-foreground group-hover:text-purple-400" />
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <div class="font-medium text-sm text-foreground truncate">
                        <template v-if="search.symbol">{{ search.symbol }}</template>
                        <template v-else-if="search.label">{{ search.label }}</template>
                        <template v-else>{{ truncateMint(search.mintId) }}</template>
                      </div>
                    </div>
                    <div class="text-xs text-muted-foreground truncate">
                      <template v-if="search.name">{{ search.name }}</template>
                      <template v-else-if="search.symbol || search.label">{{ truncateMint(search.mintId) }}</template>
                    </div>
                  </div>
                </div>
              </div>
              <button
                @click="
                  pumpFunStore.clearRecentSearches();
                  showRecentDropdown = false;
                "
                class="w-full text-left px-3 py-2 rounded-md hover:bg-red-500/10 text-red-400 text-xs transition-colors mt-1"
                title="Clear all recent searches"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
        <div class="relative flex-1 max-w-md shadow-sm group">
          <div
            class="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 pointer-events-none z-10"
          >
            <Search class="w-4 h-4 text-muted-foreground" />
          </div>
          <Input
            v-model="mintId"
            class="h-12 pl-11 pr-28 text-sm bg-background border-border/70 rounded-lg focus-visible:ring-primary/20 transition-all hover:border-primary/30 focus:border-primary/50 shadow-sm w-full"
            placeholder="Mint ID or PumpFun URL"
            :disabled="pumpFunStore.loading"
            @keyup.enter="handleSearch"
          />
          <div class="absolute right-2 top-1/2 -translate-y-1/2">
            <Button
              size="sm"
              class="h-8 px-4 rounded-sm font-medium transition-all text-xs"
              :disabled="!mintId || pumpFunStore.loading"
              @click="handleSearch"
            >
              <Loader2 v-if="pumpFunStore.loading" class="w-3.5 h-3.5 animate-spin" />
              <Search v-else class="w-3.5 h-3.5" />
              Search
            </Button>
          </div>
        </div>
      </div>
    </template>
    <!-- Loading State -->
    <div v-if="pumpFunStore.loading" class="space-y-6">
      <!-- Skeleton Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <!-- Show 6 skeleton cards during loading -->
        <div v-for="i in 6" :key="i" class="relative bg-card rounded-md overflow-hidden aspect-video animate-pulse">
          <!-- Thumbnail background skeleton -->
          <div class="absolute inset-0 z-0 bg-muted/40">
            <div class="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/20"></div>
          </div>

          <!-- Top right time badge skeleton -->
          <div class="absolute top-4 right-4 z-5">
            <div class="h-5 w-12 bg-muted/70 rounded-md"></div>
          </div>

          <!-- Bottom left title and description skeleton -->
          <div class="absolute bottom-2 left-2 right-2 z-5 bg-black/40 backdrop-blur-sm p-2 rounded-md">
            <div class="h-5 bg-muted/70 rounded mb-1 w-3/4"></div>
            <div class="h-3 bg-muted/70 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    </div>
    <!-- Error State -->
    <div v-else-if="pumpFunStore.error" class="bg-red-500/10 border border-red-500/50 rounded-md p-6 text-center">
      <AlertTriangle class="h-12 w-12 text-red-500 mx-auto mb-3" />
      <h3 class="text-lg font-semibold text-red-400 mb-2">Error</h3>

      <p class="text-muted-foreground">{{ pumpFunStore.error }}</p>
      <button
        @click="handleSearch"
        class="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-md transition-all"
      >
        Try Again
      </button>
    </div>
    <!-- VODs Grid -->
    <div v-else-if="pumpFunStore.clips.length > 0" class="space-y-6">
      <!-- Filter Notice -->
      <div class="bg-blue-500/10 border border-blue-500/50 rounded-md p-4 flex items-center gap-3">
        <AlertTriangle class="h-5 w-5 text-blue-400 flex-shrink-0" />
        <div class="flex-1">
          <p class="text-sm text-blue-400">
            Showing videos
            <span class="font-semibold">3 minutes and longer</span>
            . Shorter videos have been filtered out for better quality.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          v-for="clip in paginatedClips"
          :key="clip.clipId"
          class="relative bg-card rounded-md overflow-hidden hover:border-foreground/20 cursor-pointer group aspect-video hover:scale-102 transition-all"
          @click="handleClipClick(clip)"
        >
          <!-- Thumbnail background with vignette -->
          <div
            v-if="clip.thumbnailUrl"
            class="absolute inset-0 z-0"
            :style="{
              backgroundImage: `url(${clip.thumbnailUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }"
          >
            <!-- Dark vignette overlay -->
            <div class="absolute inset-0 bg-gradient-to-br from-black/50 via-black/20 to-black/60"></div>
          </div>
          <!-- Top right duration -->
          <div class="absolute top-4 right-4 z-5">
            <span
              :class="[
                'text-xs px-2 py-1 rounded-md',
                clip.thumbnailUrl ? 'text-white/70 bg-muted/20 backdrop-blur-sm' : 'text-muted-foreground bg-muted',
              ]"
            >
              {{ formatDuration(clip.duration) }}
            </span>
          </div>
          <!-- Bottom left title and description -->
          <div class="absolute bottom-2 left-2 right-2 z-5 bg-black/40 backdrop-blur-sm p-2 rounded-md">
            <h3
              :class="[
                'text-md font-semibold mb-0.5 group-hover:transition-colors line-clamp-2',
                clip.thumbnailUrl
                  ? 'text-white group-hover:text-white/80'
                  : 'text-foreground group-hover:text-foreground/80',
              ]"
            >
              {{ clip.title }}
            </h3>

            <p :class="['text-xs line-clamp-2', clip.thumbnailUrl ? 'text-white/80' : 'text-muted-foreground']">
              {{ clip.createdAt ? formatRelativeTime(clip.createdAt) : 'No timestamp available' }}
            </p>
          </div>
          <!-- Hover Overlay Buttons -->
          <div
            v-if="clip.thumbnailUrl"
            class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-5 flex items-center justify-center gap-4"
          >
            <button
              class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
              title="Download"
              @click.stop="handleDownloadClip(clip)"
            >
              <Download class="h-6 w-6" />
            </button>
          </div>
          <!-- Bottom Action Bar (for cards without thumbnails) -->
          <div
            v-if="!clip.thumbnailUrl"
            :class="['flex items-center justify-between px-4 py-2 border-t border-border bg-[#141414]']"
          >
            <span class="text-sm font-medium text-muted-foreground">{{ clip.clipId }}</span>
            <div class="flex items-center gap-1">
              <button
                class="p-2 rounded-md transition-colors hover:bg-muted"
                title="Download"
                @click.stop="handleDownloadClip(clip)"
              >
                <Download class="h-4 w-4 transition-colors text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <EmptyState
      v-if="pumpFunStore.clips.length === 0 && !pumpFunStore.loading && !pumpFunStore.error"
      title="Search for VODs"
      description="Search for VODs by Mint ID or PumpFun URL."
    >
      <template #icon>
        <Video class="h-16 w-16 text-muted-foreground" />
      </template>
    </EmptyState>

    <!-- Download Confirmation Modal -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="showDownloadDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          @click="closeDownloadDialog()"
        ></div>

        <!-- Modal Panel -->
        <div
          class="relative flex flex-col w-full max-w-lg overflow-hidden transition-all transform bg-card border border-border shadow-2xl rounded-xl max-h-[90vh]"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-3 py-1 border-b border-border/60 bg-black/30">
            <div>
              <h2 class="text-md font-semibold text-foreground">Download Options</h2>
            </div>
            <button
              @click="closeDownloadDialog()"
              class="p-2 transition-colors rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 p-6 overflow-y-auto custom-scrollbar">
            <!-- Video Info Card -->
            <div class="flex gap-4 p-4 mb-6 border rounded-lg bg-muted/20 border-border/50">
              <div
                class="relative flex-shrink-0 overflow-hidden rounded bg-black/40 w-28 aspect-video border border-border/50"
              >
                <img
                  v-if="clipToDownload?.thumbnailUrl"
                  :src="clipToDownload.thumbnailUrl"
                  class="object-cover w-full h-full"
                />
                <div v-else class="flex items-center justify-center w-full h-full text-muted-foreground">
                  <Video class="w-8 h-8 opacity-50" />
                </div>
              </div>
              <div class="flex flex-col justify-center flex-1 min-w-0">
                <h3
                  class="mb-1.5 text-sm font-medium leading-snug text-foreground line-clamp-2"
                  :title="clipToDownload?.title"
                >
                  {{ clipToDownload?.title }}
                </h3>
                <div class="flex items-center gap-3 text-xs text-muted-foreground">
                  <span class="flex items-center gap-1">
                    <Clock class="w-3 h-3" />
                    {{ formatDuration(clipToDownload?.duration) }}
                  </span>
                  <span class="text-border">|</span>
                  <span>{{ formatRelativeTime(clipToDownload?.createdAt) }}</span>
                </div>
              </div>
            </div>

            <!-- Download Format Selection -->
            <div class="mb-6 space-y-3">
              <label class="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Download Format
              </label>
              <div class="grid grid-cols-2 gap-4 mt-2">
                <!-- Full Stream Option -->
                <button
                  type="button"
                  @click="useSegmentDownload = false"
                  class="relative flex flex-col items-center gap-3 p-4 text-center transition-all duration-200 border-2 rounded-xl group"
                  :class="[
                    !useSegmentDownload
                      ? 'border-purple-500 bg-purple-500/5 ring-1 ring-purple-500/20'
                      : 'border-border bg-card hover:border-purple-500/30 hover:bg-muted/30',
                  ]"
                >
                  <div
                    class="p-2.5 rounded-full transition-colors duration-200"
                    :class="
                      !useSegmentDownload
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-muted text-muted-foreground group-hover:bg-purple-500/10 group-hover:text-purple-400'
                    "
                  >
                    <Download class="w-5 h-5" />
                  </div>
                  <div>
                    <div
                      class="text-sm font-medium"
                      :class="!useSegmentDownload ? 'text-purple-400' : 'text-foreground'"
                    >
                      Full Stream
                    </div>
                    <div class="text-[10px] text-muted-foreground mt-0.5">Download entire video</div>
                  </div>

                  <!-- Active Indicator -->
                  <div v-if="!useSegmentDownload" class="absolute top-3 right-3">
                    <div class="bg-purple-500 rounded-full p-0.5 shadow-sm">
                      <Check class="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                </button>

                <!-- Segment Option -->
                <button
                  type="button"
                  @click="useSegmentDownload = true"
                  class="relative flex flex-col items-center gap-3 p-4 text-center transition-all duration-200 border-2 rounded-xl group"
                  :class="[
                    useSegmentDownload
                      ? 'border-purple-500 bg-purple-500/5 ring-1 ring-purple-500/20'
                      : 'border-border bg-card hover:border-purple-500/30 hover:bg-muted/30',
                  ]"
                >
                  <div
                    class="p-2.5 rounded-full transition-colors duration-200"
                    :class="
                      useSegmentDownload
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-muted text-muted-foreground group-hover:bg-purple-500/10 group-hover:text-purple-400'
                    "
                  >
                    <Scissors class="w-5 h-5" />
                  </div>
                  <div>
                    <div
                      class="text-sm font-medium"
                      :class="useSegmentDownload ? 'text-purple-400' : 'text-foreground'"
                    >
                      Segment
                    </div>
                    <div class="text-[10px] text-muted-foreground mt-0.5">Trim and download</div>
                  </div>

                  <!-- Active Indicator -->
                  <div v-if="useSegmentDownload" class="absolute top-3 right-3">
                    <div class="bg-purple-500 rounded-full p-0.5 shadow-sm">
                      <Check class="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <!-- Time Range Picker -->
            <div v-if="useSegmentDownload" class="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div class="flex items-center justify-between">
                <label class="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Trim Segment</label>
                <span
                  class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20"
                >
                  Segment {{ nextSegmentNumber }}
                </span>
              </div>
              <div class="p-4 border shadow-sm bg-card border-border rounded-xl">
                <TimeRangePicker
                  v-model="selectedTimeRange"
                  :total-duration="clipToDownload?.duration || 0"
                  @change="handleTimeRangeChange"
                />
              </div>
            </div>

            <!-- Download Estimation & Options -->
            <div v-else class="space-y-4 animate-in fade-in duration-200">
              <!-- Auto Segmentation Options -->
              <div
                v-if="clipToDownload?.duration && clipToDownload.duration > 900"
                class="p-4 border border-border rounded-xl bg-card shadow-sm"
              >
                <div class="flex items-center justify-between mb-3">
                  <label class="text-sm font-medium text-foreground flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      v-model="autoSegment"
                      class="w-4 h-4 rounded border-muted-foreground text-purple-600 focus:ring-purple-500 bg-transparent"
                    />
                    <span>Auto-segment stream</span>
                  </label>
                </div>

                <div v-if="autoSegment" class="space-y-3 pl-1">
                  <div class="flex justify-between items-center">
                    <span class="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      Segment Duration
                    </span>
                    <span
                      class="text-xs font-medium bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/20"
                    >
                      {{ autoSegmentDuration }} min
                    </span>
                  </div>
                  <input
                    type="range"
                    v-model.number="autoSegmentDuration"
                    min="15"
                    max="60"
                    step="5"
                    class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                  <div class="flex justify-between text-[10px] text-muted-foreground/70 px-0.5">
                    <span>15m</span>
                    <span>30m</span>
                    <span>45m</span>
                    <span>60m</span>
                  </div>
                  <p class="text-[10px] text-muted-foreground mt-1">
                    Split into ~{{ Math.ceil((clipToDownload.duration || 0) / (autoSegmentDuration * 60)) }} parts
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t bg-muted/30 border-border">
            <button
              class="px-4 py-2 text-sm font-medium transition-colors rounded-lg text-foreground hover:bg-muted"
              @click="closeDownloadDialog()"
              :disabled="downloadStarting"
            >
              Cancel
            </button>
            <button
              class="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white transition-all shadow-md rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-purple-500/20"
              @click="downloadClipConfirmed"
              :disabled="
                downloadStarting || (useSegmentDownload && selectedTimeRange.endTime <= selectedTimeRange.startTime)
              "
            >
              <Loader2 v-if="downloadStarting" class="w-4 h-4 animate-spin" />
              <span>{{ downloadStarting ? 'Starting...' : 'Start Download' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
    <!-- Pagination Footer -->
    <PaginationFooter
      v-if="pumpFunStore.clips.length > 0"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total-items="pumpFunStore.clips.length"
      item-label="VOD"
      @go-to-page="goToPage"
      @previous="previousPage"
      @next="nextPage"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
  import { useRouter } from 'vue-router';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import TimeRangePicker from '@/components/TimeRangePicker.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import { type PumpFunClip } from '@/services/pumpfun';
  import { useToast } from '@/composables/useToast';
  import { useDownloads } from '@/composables/useDownloads';
  import { usePumpFunStore } from '@/stores/pumpfun';
  import { getNextSegmentNumber } from '@/services/database';
  import {
    Clock,
    ChevronDown,
    Edit,
    Tag,
    Check,
    X,
    AlertTriangle,
    Download,
    Video,
    Search,
    Loader2,
    Scissors,
    Info,
  } from 'lucide-vue-next';

  const { success, error: showError } = useToast();
  const { startDownload } = useDownloads();
  const router = useRouter();
  const pumpFunStore = usePumpFunStore();

  // Initialize component
  onMounted(() => {
    // Add click outside listener to close dropdown
    document.addEventListener('click', handleClickOutside);
    // Refresh metadata for recent searches
    pumpFunStore.refreshRecentSearchesMetadata();
  });

  function truncateMint(mint: string) {
    if (!mint || mint.length < 8) return mint;
    return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
  }

  // Clean up event listener
  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  // Handle click outside to close dropdowns
  function handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      showRecentDropdown.value = false;
      showEmptyRecentDropdown.value = false;
    }
  }

  const mintId = ref(pumpFunStore.currentMintId);
  const showDownloadDialog = ref(false);
  const clipToDownload = ref<PumpFunClip | null>(null);
  const downloadStarting = ref(false);
  const showRecentDropdown = ref(false);
  const showEmptyRecentDropdown = ref(false);

  // Label editing state
  const editingLabel = ref<string | null>(null);
  const labelInput = ref('');
  const labelInputRef = ref<HTMLInputElement | null>(null);

  // Time range selection
  const useSegmentDownload = ref(false);
  const selectedTimeRange = ref({ startTime: 0, endTime: 0 });
  const nextSegmentNumber = ref(1); // Default to 1

  // Auto-segmentation options
  const autoSegment = ref(true);
  const autoSegmentDuration = ref(60); // Minutes

  // Pagination state
  const currentPage = ref(1);
  const clipsPerPage = 20;

  // Computed properties for dialog
  const formatDuration = (duration?: number) => {
    if (!duration) return 'Unknown';
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const estimatedDownloadTime = computed(() => {
    const duration = useSegmentDownload.value
      ? selectedTimeRange.value.endTime - selectedTimeRange.value.startTime
      : clipToDownload.value?.duration;

    if (!duration) return 'Unknown';

    // Estimate based on 1 GB per hour of video content
    const estimatedSizeGB = (duration / 3600) * 1;
    // Assume average download speed of 50 Mbps
    const avgDownloadSpeedMbps = 50;
    // Convert GB to Mb and calculate download time in seconds
    const downloadTimeSeconds = (estimatedSizeGB * 8000) / avgDownloadSpeedMbps;

    return formatDuration(downloadTimeSeconds);
  });

  // Pagination computed properties
  const totalPages = computed(() => Math.ceil(pumpFunStore.clips.length / clipsPerPage));
  const paginatedClips = computed(() => {
    const startIndex = (currentPage.value - 1) * clipsPerPage;
    const endIndex = startIndex + clipsPerPage;
    const paginated = pumpFunStore.clips.slice(startIndex, endIndex);
    return paginated;
  });

  // Pagination functions
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page;
    }
  }

  function nextPage() {
    if (currentPage.value < totalPages.value) {
      currentPage.value++;
    }
  }

  function previousPage() {
    if (currentPage.value > 1) {
      currentPage.value--;
    }
  }

  // Reset to first page when clips change
  watch(
    () => pumpFunStore.clips,
    () => {
      currentPage.value = 1;
    }
  );

  // Format relative time for stream dates
  function formatRelativeTime(timestamp?: number | string | Date) {
    if (!timestamp) return 'Streamed recently';

    const date = new Date(timestamp);
    const now = new Date();
    const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (secondsAgo < 60) return 'Streamed just now';
    if (secondsAgo < 3600) return `Streamed ${Math.floor(secondsAgo / 60)} minutes ago`;
    if (secondsAgo < 86400) return `Streamed ${Math.floor(secondsAgo / 3600)} hours ago`;
    if (secondsAgo < 604800) return `Streamed ${Math.floor(secondsAgo / 86400)} days ago`;

    return `Streamed ${Math.floor(secondsAgo / 604800)} weeks ago`;
  }

  function handleRecentSearchClick(search: { mintId: string; displayText: string; label?: string }) {
    mintId.value = search.displayText;
    handleSearch();
  }

  // Label editing functions
  function startEditingLabel(mintId: string, currentLabel?: string) {
    editingLabel.value = mintId;
    labelInput.value = currentLabel || '';

    // Focus the input field after it's rendered
    nextTick(() => {
      labelInputRef.value?.focus();
      labelInputRef.value?.select();
    });
  }

  function saveLabel(mintId: string) {
    pumpFunStore.updateRecentSearchLabel(mintId, labelInput.value);
    editingLabel.value = null;
    labelInput.value = '';
  }

  function cancelEditingLabel() {
    editingLabel.value = null;
    labelInput.value = '';
  }

  function handleLabelKeydown(event: KeyboardEvent, mintId: string) {
    if (event.key === 'Enter') {
      saveLabel(mintId);
    } else if (event.key === 'Escape') {
      cancelEditingLabel();
    }
  }

  function handleTimeRangeChange(range: { startTime: number; endTime: number }) {
    selectedTimeRange.value = range;
  }

  // Function to close download dialog
  async function closeDownloadDialog() {
    showDownloadDialog.value = false;
    clipToDownload.value = null;
  }

  async function handleSearch() {
    const input = mintId.value.trim();

    if (!input) {
      showError('Invalid Input', 'Please enter a mint ID or PumpFun URL');
      return;
    }

    // Only update the input field to show the extracted mint ID if it's different from current
    // and we're not dealing with a recent search selection
    const isRecentSearchSelection = pumpFunStore.getRecentSearches.some((search) => search.displayText === input);

    if (!isRecentSearchSelection && input !== pumpFunStore.currentMintId && pumpFunStore.currentMintId) {
      mintId.value = pumpFunStore.currentMintId;
    }

    try {
      const result = await pumpFunStore.searchClips(input, 20);

      if (result.success) {
        if (result.total === 0) {
          showError('No VODs Found', 'This mint ID has no available VODs');
        } else {
          success('VODs Loaded', `Found ${result.total} VOD${result.total !== 1 ? 's' : ''}`);
          // Metadata fetch is handled automatically in the store
        }
      } else {
        showError('Search Failed', result.error || 'Failed to fetch VODs');
      }
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }

  function handleClipClick(clip: PumpFunClip) {
    console.log('Clicked clip:', clip);
    // TODO: Implement clip playback or details view
  }

  function handleDownloadClip(clip: PumpFunClip) {
    clipToDownload.value = clip;
    // Reset segment download state
    useSegmentDownload.value = false;
    selectedTimeRange.value = { startTime: 0, endTime: clip.duration || 0 };

    // Calculate the next segment number for this clip
    calculateNextSegmentNumber(clip.clipId);

    showDownloadDialog.value = true;
  }

  // Calculate the next segment number for a given clip
  async function calculateNextSegmentNumber(clipId: string) {
    try {
      nextSegmentNumber.value = await getNextSegmentNumber(clipId);
    } catch (error) {
      // Fallback to 1 if migration hasn't run or there's an error
      nextSegmentNumber.value = 1;
    }
  }

  async function downloadClipConfirmed() {
    if (!clipToDownload.value) return;

    const clip = clipToDownload.value; // Store reference for error handling
    downloadStarting.value = true;

    try {
      // Get the best available video URL
      const videoUrl = clip.mp4Url || clip.playlistUrl;
      if (!videoUrl) {
        throw new Error('No video URL available for this VOD');
      }

      // Determine download parameters
      const segmentRange = useSegmentDownload.value
        ? { startTime: selectedTimeRange.value.startTime, endTime: selectedTimeRange.value.endTime }
        : undefined;

      // Start the download
      await startDownload(clip.title, videoUrl, pumpFunStore.currentMintId, segmentRange, clip.clipId, clip.duration, {
        autoSegment: autoSegment.value,
        segmentDuration: autoSegmentDuration.value * 60,
      });

      // Show success toast
      let downloadType = useSegmentDownload.value ? 'segment' : 'full stream';
      let downloadMessage = `Downloading ${downloadType} of "${clip.title}". You'll be notified when it completes.`;

      // Check if auto-segmentation will be applied
      if (
        !useSegmentDownload.value &&
        clip.duration &&
        autoSegment.value &&
        clip.duration > autoSegmentDuration.value * 60
      ) {
        const durationSeconds = autoSegmentDuration.value * 60;
        const numberOfSegments = Math.ceil(clip.duration / durationSeconds);
        const actualSegmentDuration = Math.round(clip.duration / numberOfSegments / 60);
        downloadType = 'auto-segmented stream';
        downloadMessage = `Splitting "${clip.title}" into ${numberOfSegments} equal parts (~${actualSegmentDuration} min each). Downloads will process one at a time.`;
      }

      success('Download Started', downloadMessage);

      // Close dialog immediately
      await closeDownloadDialog();

      // Small delay to show loading state briefly, then navigate
      setTimeout(() => {
        downloadStarting.value = false;
        // Navigate to Videos page to see progress
        router.push('/projects');
      }, 500);
    } catch (err) {
      showError('Download Failed', `Failed to download "${clip.title}": ${err}`);
      // Reset loading state on error
      downloadStarting.value = false;
      await closeDownloadDialog();
    }
  }
</script>
