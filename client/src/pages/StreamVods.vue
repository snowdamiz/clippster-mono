<template>
  <PageLayout
    title="Stream VODs"
    description="Download VODs from your favorite streaming platforms"
    :show-header="true"
    :icon="Video"
  >
    <template #actions>
      <div class="flex items-center gap-3">
        <!-- Recent Searches Dropdown -->
        <div class="relative" v-if="platformStore.getRecentSearches.length > 0">
          <button
            @click="showRecentDropdown = !showRecentDropdown"
            class="px-3 py-2.5 bg-muted border border-border rounded-md text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all flex items-center gap-2"
            title="Recent searches"
          >
            <Clock class="h-4 w-4" />
            <span class="text-sm">Recent</span>
            <ChevronDown class="h-3 w-3 transition-transform" :class="{ 'rotate-180': showRecentDropdown }" />
          </button>
          <div
            v-if="showRecentDropdown"
            class="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-md shadow-lg z-[9999] max-h-80 overflow-y-auto"
            @click.stop
          >
            <div class="p-2">
              <div class="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">Recent Searches</div>
              <div
                v-for="search in platformStore.getRecentSearches.slice(0, 15)"
                :key="`${search.platform}-${search.id}`"
                class="group"
              >
                <div
                  @click="
                    handleRecentSearchClick(search);
                    showRecentDropdown = false;
                  "
                  class="w-full text-left px-3 py-2 rounded-md hover:bg-muted/80 transition-colors flex items-center gap-3 cursor-pointer"
                >
                  <!-- Platform Badge + Image -->
                  <div class="relative flex-shrink-0">
                    <div
                      class="w-9 h-9 rounded-full overflow-hidden bg-muted border border-border/50 flex items-center justify-center"
                    >
                      <img v-if="search.imageUrl" :src="search.imageUrl" class="w-full h-full object-cover" />
                      <component
                        v-else
                        :is="getPlatformFallbackIcon(search.platform)"
                        class="h-4 w-4 text-muted-foreground"
                      />
                    </div>
                    <!-- Platform indicator badge -->
                    <div
                      class="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
                      :style="{ backgroundColor: getPlatformColor(search.platform), border: '2px solid var(--card)' }"
                    >
                      <img :src="getPlatformIcon(search.platform)" class="w-3 h-3" />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-sm text-foreground truncate">
                        <template v-if="search.symbol">{{ search.symbol }}</template>
                        <template v-else-if="search.label">{{ search.label }}</template>
                        <template v-else>{{ truncateId(search.id) }}</template>
                      </span>
                    </div>
                    <div class="text-xs text-muted-foreground truncate">
                      <template v-if="search.name">{{ search.name }}</template>
                      <template v-else>{{ search.displayText }}</template>
                    </div>
                  </div>
                </div>
              </div>
              <button
                @click="
                  platformStore.clearRecentSearches();
                  showRecentDropdown = false;
                "
                class="w-full text-left px-3 py-2 rounded-md hover:bg-red-500/10 text-red-400 text-xs transition-colors mt-1"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>

        <!-- Search Input with Auto-Detection -->
        <div class="relative w-[420px] shadow-sm group">
          <div
            class="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 pointer-events-none z-10"
          >
            <transition name="scale" mode="out-in">
              <div
                v-if="detectedPlatform === 'pumpfun'"
                class="w-6 h-6 bg-emerald-500 rounded-md flex items-center justify-center shadow-sm border-border/80"
                key="pf"
              >
                <img src="/capsule.svg" class="w-3.5 h-3.5 brightness-200" />
              </div>
              <div
                v-else-if="detectedPlatform === 'kick'"
                class="w-6 h-6 bg-[#53FC18] rounded-md flex items-center justify-center shadow-sm border-border/80"
                key="kick"
              >
                <img src="/kick.svg" class="w-3.5 h-3.5" />
              </div>
              <div
                v-else-if="detectedPlatform === 'twitch'"
                class="w-6 h-6 bg-[#9146FF] rounded-md flex items-center justify-center shadow-sm border-border/80"
                key="tw"
              >
                <img src="/twitch.svg" class="w-3.5 h-3.5 invert brightness-200" />
              </div>
              <div
                v-else-if="detectedPlatform === 'youtube'"
                class="w-6 h-6 bg-red-600 rounded-md flex items-center justify-center shadow-sm border-border/80"
                key="yt"
              >
                <img src="/youtube.svg" class="w-3.5 h-3.5 invert brightness-200" />
              </div>
              <Search v-else class="w-4 h-4 text-muted-foreground" key="search" />
            </transition>
          </div>
          <Input
            v-model="searchInput"
            class="h-11 pl-11 pr-28 text-sm bg-background border-border/70 rounded-lg focus-visible:ring-primary/20 transition-all hover:border-primary/30 focus:border-primary/50 shadow-sm w-full"
            placeholder="Paste stream link, mint ID, or username..."
            :disabled="platformStore.loading"
            @input="detectPlatform"
            @keyup.enter="handleSearch"
          />
          <div class="absolute right-1.5 top-1/2 -translate-y-1/2">
            <Button
              size="sm"
              class="h-8 px-4 rounded-sm font-medium transition-all text-xs"
              :disabled="!searchInput || platformStore.loading"
              @click="handleSearch"
            >
              <Loader2 v-if="platformStore.loading" class="w-3.5 h-3.5 animate-spin" />
              <Search v-else class="w-3.5 h-3.5" />
              Search
            </Button>
          </div>
        </div>
      </div>
    </template>

    <!-- Loading State -->
    <div v-if="platformStore.loading" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="i in 6" :key="i" class="relative bg-card rounded-md overflow-hidden aspect-video animate-pulse">
          <div class="absolute inset-0 z-0 bg-muted/40">
            <div class="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/20"></div>
          </div>
          <div class="absolute top-4 right-4 z-5">
            <div class="h-5 w-12 bg-muted/70 rounded-md"></div>
          </div>
          <div class="absolute bottom-2 left-2 right-2 z-5 bg-black/40 backdrop-blur-sm p-2 rounded-md">
            <div class="h-5 bg-muted/70 rounded mb-1 w-3/4"></div>
            <div class="h-3 bg-muted/70 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="platformStore.error" class="bg-red-500/10 border border-red-500/50 rounded-md p-6 text-center">
      <AlertTriangle class="h-12 w-12 text-red-500 mx-auto mb-3" />
      <h3 class="text-lg font-semibold text-red-400 mb-2">Error</h3>
      <p class="text-muted-foreground">{{ platformStore.error }}</p>
      <button
        @click="handleSearch"
        class="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-md transition-all"
      >
        Try Again
      </button>
    </div>

    <!-- VODs Grid -->
    <div v-else-if="platformStore.clips.length > 0" class="space-y-6">
      <!-- Filter Notice -->
      <div
        v-if="currentPlatformConfig?.showFilterNotice"
        class="bg-blue-500/10 border border-blue-500/50 rounded-md p-4 flex items-center gap-3"
      >
        <AlertTriangle class="h-5 w-5 text-blue-400 flex-shrink-0" />
        <p class="text-sm text-blue-400">{{ currentPlatformConfig.filterNoticeText }}</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          v-for="clip in paginatedClips"
          :key="clip.clipId"
          class="relative bg-card rounded-md overflow-hidden hover:border-foreground/20 cursor-pointer group aspect-video hover:scale-102 transition-all"
          @click="handleClipClick(clip)"
        >
          <div
            v-if="clip.thumbnailUrl"
            class="absolute inset-0 z-0"
            :style="{
              backgroundImage: `url(${clip.thumbnailUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }"
          >
            <div class="absolute inset-0 bg-black/10"></div>
          </div>
          <div
            class="absolute bottom-0 left-0 right-0 z-5 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-28 flex flex-col gap-1.5"
          >
            <h3
              class="text-base font-bold text-white leading-tight line-clamp-1 group-hover:text-white/90 transition-colors"
            >
              {{ clip.title }}
            </h3>
            <div class="flex items-center gap-2 text-xs text-white/70 font-medium">
              <span>{{ formatDuration(clip.duration) }}</span>
              <span class="w-0.5 h-0.5 rounded-full bg-white/40"></span>
              <span class="truncate">{{ clip.createdAt ? formatRelativeTime(clip.createdAt) : 'No timestamp' }}</span>
            </div>
          </div>
          <div
            v-if="clip.thumbnailUrl"
            class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-5 flex items-center justify-center gap-3"
          >
            <button
              class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
              title="Download"
              @click.stop="handleDownloadClip(clip)"
            >
              <Download class="h-5 w-5" />
            </button>
          </div>
          <div
            v-if="!clip.thumbnailUrl"
            class="flex items-center justify-between px-4 py-2 border-t border-border bg-[#141414]"
          >
            <span class="text-sm font-medium text-muted-foreground">{{ clip.clipId }}</span>
            <button
              class="p-2 rounded-md transition-colors hover:bg-muted"
              title="Download"
              @click.stop="handleDownloadClip(clip)"
            >
              <Download class="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-if="platformStore.clips.length === 0 && !platformStore.loading && !platformStore.error"
      title="Search for VODs"
      description="Paste a stream link, mint ID, or channel username to find VODs. Supports PumpFun and Kick."
    >
      <template #icon>
        <Video class="h-16 w-16 text-muted-foreground" />
      </template>
      <template #default>
        <div class="mt-6 flex flex-wrap justify-center gap-3">
          <div class="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-full text-xs text-muted-foreground">
            <img src="/capsule.svg" class="w-4 h-4" />
            PumpFun Links & Mint IDs
          </div>
          <div class="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-full text-xs text-muted-foreground">
            <img src="/kick.svg" class="w-4 h-4" />
            Kick Links & Usernames
          </div>
          <div
            class="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-full text-xs text-muted-foreground border border-amber-500/20"
          >
            <img src="/twitch.svg" class="w-4 h-4 opacity-50" />
            Twitch
            <span class="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">Soon</span>
          </div>
          <div
            class="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-full text-xs text-muted-foreground border border-amber-500/20"
          >
            <img src="/youtube.svg" class="w-4 h-4 opacity-50" />
            YouTube
            <span class="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">Soon</span>
          </div>
        </div>
      </template>
    </EmptyState>

    <!-- Download Modal -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="showDownloadDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="closeDownloadDialog()"></div>
        <div
          class="relative flex flex-col w-full max-w-lg overflow-hidden bg-card border border-border shadow-2xl rounded-xl max-h-[90vh]"
        >
          <div class="flex items-center justify-between px-3 py-1 border-b border-border/60 bg-black/30">
            <h2 class="text-md font-semibold text-foreground">Download Options</h2>
            <button
              @click="closeDownloadDialog()"
              class="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
          <div class="flex-1 p-6 overflow-y-auto custom-scrollbar">
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
                <h3 class="mb-1.5 text-sm font-medium leading-snug text-foreground line-clamp-2">
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
            <div class="mb-6 space-y-3">
              <label class="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Download Format
              </label>
              <div class="grid grid-cols-2 gap-4 mt-2">
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
                    class="p-2.5 rounded-full"
                    :class="!useSegmentDownload ? 'bg-purple-500/20 text-purple-400' : 'bg-muted text-muted-foreground'"
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
                  <div v-if="!useSegmentDownload" class="absolute top-3 right-3">
                    <div class="bg-purple-500 rounded-full p-0.5 shadow-sm">
                      <Check class="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                </button>
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
                    class="p-2.5 rounded-full"
                    :class="useSegmentDownload ? 'bg-purple-500/20 text-purple-400' : 'bg-muted text-muted-foreground'"
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
                  <div v-if="useSegmentDownload" class="absolute top-3 right-3">
                    <div class="bg-purple-500 rounded-full p-0.5 shadow-sm">
                      <Check class="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                </button>
              </div>
            </div>
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
            <div v-else class="space-y-4 animate-in fade-in duration-200">
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
                    class="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-500"
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
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t bg-muted/30 border-border">
            <button
              class="px-4 py-2 text-sm font-medium rounded-lg text-foreground hover:bg-muted"
              @click="closeDownloadDialog()"
              :disabled="downloadStarting"
            >
              Cancel
            </button>
            <button
              class="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

    <!-- Pagination -->
    <PaginationFooter
      v-if="platformStore.clips.length > 0"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total-items="platformStore.clips.length"
      item-label="VOD"
      @go-to-page="goToPage"
      @previous="previousPage"
      @next="nextPage"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import TimeRangePicker from '@/components/TimeRangePicker.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import { usePlatformStore, type PlatformClip } from '@/stores/platform';
  import { platformConfigs, type PlatformId } from '@/config/platforms';
  import { extractMintId } from '@/services/pumpfun';
  import { useToast } from '@/composables/useToast';
  import { useDownloads } from '@/composables/useDownloads';
  import { getNextSegmentNumber } from '@/services/database';
  import {
    Clock,
    ChevronDown,
    Check,
    X,
    AlertTriangle,
    Download,
    Video,
    Search,
    Loader2,
    Scissors,
  } from 'lucide-vue-next';

  const router = useRouter();
  const route = useRoute();
  const { success, error: showError } = useToast();
  const { startDownload } = useDownloads();
  const platformStore = usePlatformStore();

  // Auto-detected platform from input
  const detectedPlatform = ref<PlatformId | null>(null);
  const currentPlatformConfig = computed(() =>
    detectedPlatform.value ? platformConfigs[detectedPlatform.value] : null
  );

  // Detect platform from input (similar to LiveClip.vue)
  function detectPlatform() {
    const val = searchInput.value.trim();

    if (!val) {
      detectedPlatform.value = null;
      return;
    }

    // Check PumpFun using the robust extractor (handles URLs and Mint IDs)
    if (extractMintId(val)) {
      detectedPlatform.value = 'pumpfun';
      return;
    }

    const lowerVal = val.toLowerCase();

    // Check for YouTube
    if (lowerVal.includes('youtube.com') || lowerVal.includes('youtu.be')) {
      detectedPlatform.value = 'youtube';
      return;
    }

    // Check for Twitch
    if (lowerVal.includes('twitch.tv')) {
      detectedPlatform.value = 'twitch';
      return;
    }

    // Check for Kick URLs
    if (lowerVal.includes('kick.com')) {
      detectedPlatform.value = 'kick';
      return;
    }

    // Check if it could be a Kick username (alphanumeric with underscores/hyphens, 3+ chars)
    // This is a fallback - if it's not a URL and not a mint ID, assume Kick username
    if (/^[a-zA-Z0-9_-]{3,}$/.test(val) && !extractMintId(val)) {
      detectedPlatform.value = 'kick';
      return;
    }

    detectedPlatform.value = null;
  }

  // Initialize
  onMounted(async () => {
    document.addEventListener('click', handleClickOutside);
    platformStore.refreshRecentSearchesMetadata();

    // Check for query params (from Creator Profiles navigation)
    const queryPlatform = route.query.platform as string | undefined;
    const querySearch = route.query.search as string | undefined;

    if (queryPlatform && querySearch) {
      // Set the platform and search from query params
      const validPlatforms = ['pumpfun', 'kick', 'twitch', 'youtube'] as const;
      if (validPlatforms.includes(queryPlatform as any)) {
        detectedPlatform.value = queryPlatform as PlatformId;
        searchInput.value = querySearch;

        // Clear query params from URL to prevent re-search on navigation
        router.replace({ path: route.path, query: {} });

        // Trigger search
        await handleSearch();
        return;
      }
    }

    // Restore platform state if clips are already loaded (e.g., returning from another page)
    if (platformStore.clips.length > 0) {
      detectedPlatform.value = platformStore.activePlatform;
      // Restore the search input to show what's currently loaded
      if (platformStore.currentSearchId) {
        searchInput.value = platformStore.currentSearchId;
      }
    }
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  function handleClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.relative')) {
      showRecentDropdown.value = false;
    }
  }

  // Component state
  const searchInput = ref('');
  const showDownloadDialog = ref(false);
  const clipToDownload = ref<PlatformClip | null>(null);
  const downloadStarting = ref(false);
  const showRecentDropdown = ref(false);
  const useSegmentDownload = ref(false);
  const selectedTimeRange = ref({ startTime: 0, endTime: 0 });
  const nextSegmentNumber = ref(1);
  const autoSegment = ref(true);
  const autoSegmentDuration = ref(60);
  const currentPage = ref(1);
  const clipsPerPage = 20;

  // Utility functions
  function truncateId(id: string) {
    if (!id || id.length < 8) return id;
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
  }

  // Platform helper functions for recent searches dropdown
  function getPlatformIcon(platform: PlatformId): string {
    const icons: Record<PlatformId, string> = {
      pumpfun: '/capsule.svg',
      kick: '/kick.svg',
      twitch: '/twitch.svg',
      youtube: '/youtube.svg',
    };
    return icons[platform] || '/capsule.svg';
  }

  function getPlatformColor(platform: PlatformId): string {
    const colors: Record<PlatformId, string> = {
      pumpfun: '#10b981', // emerald-500
      kick: '#53FC18',
      twitch: '#9146FF',
      youtube: '#dc2626', // red-600
    };
    return colors[platform] || '#6b7280';
  }

  function getPlatformFallbackIcon(_platform: PlatformId) {
    // Return a component or default to Clock
    return Clock;
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

  // Pagination
  const totalPages = computed(() => Math.ceil(platformStore.clips.length / clipsPerPage));
  const paginatedClips = computed(() => {
    const start = (currentPage.value - 1) * clipsPerPage;
    return platformStore.clips.slice(start, start + clipsPerPage);
  });

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages.value) currentPage.value = page;
  }
  function nextPage() {
    if (currentPage.value < totalPages.value) currentPage.value++;
  }
  function previousPage() {
    if (currentPage.value > 1) currentPage.value--;
  }

  watch(
    () => platformStore.clips,
    () => {
      currentPage.value = 1;
    }
  );

  // Search handlers
  function handleRecentSearchClick(search: { id: string; displayText: string; platform: PlatformId }) {
    searchInput.value = search.displayText;
    // Set the detected platform from the search instead of auto-detecting
    detectedPlatform.value = search.platform;
    handleSearch();
  }

  async function handleSearch() {
    const input = searchInput.value.trim();
    if (!input) {
      showError('Invalid Input', 'Please enter a stream link, mint ID, or username');
      return;
    }

    // Re-detect platform to ensure it's current
    detectPlatform();

    if (!detectedPlatform.value) {
      showError(
        'Unknown Platform',
        'Could not detect the platform. Please enter a valid PumpFun link/mint ID or Kick link/username.'
      );
      return;
    }

    // Check if platform is coming soon
    const config = platformConfigs[detectedPlatform.value];
    if (config.isComingSoon) {
      showError(
        `${config.name} Coming Soon`,
        config.comingSoonMessage || `${config.name} integration is not yet available.`
      );
      return;
    }

    // Set the active platform in the store
    platformStore.setActivePlatform(detectedPlatform.value);

    try {
      const result = await platformStore.searchClips(input, 20);
      if (result.success) {
        if (result.total === 0) {
          showError('No VODs Found', 'No available VODs found for this search');
        } else {
          success('VODs Loaded', `Found ${result.total} VOD${result.total !== 1 ? 's' : ''}`);
        }
      } else {
        showError('Search Failed', result.error || 'Failed to fetch VODs');
      }
    } catch (err) {
      showError('Error', err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }

  // Clip handlers
  function handleClipClick(clip: PlatformClip) {
    console.log('Clicked clip:', clip);
  }

  function handleDownloadClip(clip: PlatformClip) {
    clipToDownload.value = clip;
    useSegmentDownload.value = false;
    selectedTimeRange.value = { startTime: 0, endTime: clip.duration || 0 };
    calculateNextSegmentNumber(clip.clipId);
    showDownloadDialog.value = true;
  }

  async function calculateNextSegmentNumber(clipId: string) {
    try {
      nextSegmentNumber.value = await getNextSegmentNumber(clipId);
    } catch {
      nextSegmentNumber.value = 1;
    }
  }

  function handleTimeRangeChange(range: { startTime: number; endTime: number }) {
    selectedTimeRange.value = range;
  }

  function closeDownloadDialog() {
    showDownloadDialog.value = false;
    clipToDownload.value = null;
  }

  async function downloadClipConfirmed() {
    if (!clipToDownload.value || !currentPlatformConfig.value) return;

    const clip = clipToDownload.value;
    downloadStarting.value = true;

    try {
      const videoUrl = clip.mp4Url || clip.playlistUrl;
      if (!videoUrl) throw new Error('No video URL available for this VOD');

      const segmentRange = useSegmentDownload.value
        ? { startTime: selectedTimeRange.value.startTime, endTime: selectedTimeRange.value.endTime }
        : undefined;

      await startDownload(
        clip.title,
        videoUrl,
        platformStore.currentSearchId,
        segmentRange,
        clip.clipId,
        clip.duration,
        {
          autoSegment: autoSegment.value,
          segmentDuration: autoSegmentDuration.value * 60,
          provider: currentPlatformConfig.value.provider as 'pumpfun' | 'kick',
        }
      );

      let downloadType = useSegmentDownload.value ? 'segment' : 'full stream';
      let downloadMessage = `Downloading ${downloadType} of "${clip.title}". You'll be notified when it completes.`;

      if (
        !useSegmentDownload.value &&
        clip.duration &&
        autoSegment.value &&
        clip.duration > autoSegmentDuration.value * 60
      ) {
        const numberOfSegments = Math.ceil(clip.duration / (autoSegmentDuration.value * 60));
        const actualSegmentDuration = Math.round(clip.duration / numberOfSegments / 60);
        downloadMessage = `Splitting "${clip.title}" into ${numberOfSegments} equal parts (~${actualSegmentDuration} min each).`;
      }

      success('Download Started', downloadMessage);
      closeDownloadDialog();

      setTimeout(() => {
        downloadStarting.value = false;
        router.push('/projects');
      }, 500);
    } catch (err) {
      showError('Download Failed', `Failed to download "${clip.title}": ${err}`);
      downloadStarting.value = false;
      closeDownloadDialog();
    }
  }
</script>

<style scoped>
  .scale-enter-active,
  .scale-leave-active {
    transition: all 0.2s ease;
  }

  .scale-enter-from,
  .scale-leave-to {
    opacity: 0;
    transform: scale(0.5);
  }
</style>
