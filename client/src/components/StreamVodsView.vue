<template>
  <PageLayout title="Download video" description="Download VODs from your favorite streaming platforms" :icon="Video">
    <template #actions>
      <RecentSearchesMenu
        v-if="platformStore.getRecentSearches.length > 0"
        :searches="platformStore.getRecentSearches"
        :format-name="recentSearchName"
        @select="handleRecentSearchClick"
        @clear="platformStore.clearRecentSearches()"
      />
    </template>

    <template #toolbar>
      <div class="flex min-w-0 flex-1 items-center gap-2" data-tour-id="tour-vod-search">
        <StreamLinkInput
          v-model="searchInput"
          :platform="detectedPlatform"
          placeholder="Paste a stream link, mint ID or username…"
          :disabled="platformStore.loading"
          class="max-w-[520px] flex-1"
          @input="detectPlatform"
          @submit="handleSearch"
        />
        <Button variant="primary" :disabled="!searchInput || platformStore.loading" @click="handleSearch">
          <Loader2 v-if="platformStore.loading" class="animate-spin" />
          <Search v-else />
          Search
        </Button>
      </div>
      <SegmentedControl
        v-if="sourceTabs"
        :model-value="sourceTabs.value"
        :options="sourceTabs.options"
        @update:model-value="sourceTabs.select"
      />
    </template>

    <div class="flex flex-1 flex-col gap-4 px-5 py-4" data-tour-id="tour-vod-page">
      <Alert v-if="detectedPlatform === 'tokend' && platformStore.tokendCatalogMetadata">
        <Info />
        <div>
          <AlertTitle class="text-sm">{{ tokendModeLabel }}</AlertTitle>
          <AlertDescription class="text-xs text-fg-muted">
            {{ platformStore.tokendCatalogMetadata.note || 'Public creator catalog read.' }}
            Tokend media download grants are not available.
          </AlertDescription>
        </div>
      </Alert>

      <!-- First load only: tab switches and "load more" keep the current results -->
      <div v-if="platformStore.loading && platformStore.clips.length === 0" class="card-grid" aria-busy="true">
        <VodCard v-for="i in 8" :key="i" skeleton />
      </div>

      <!-- Error -->
      <EmptyState
        v-else-if="platformStore.error"
        :icon="AlertTriangle"
        tone="danger"
        title="Couldn't load VODs"
        :description="platformStore.error"
      >
        <Button variant="secondary" @click="handleSearch">
          <RotateCcw />
          Try again
        </Button>
      </EmptyState>

      <!-- Results -->
      <section v-else-if="platformStore.clips.length > 0" class="flex flex-col gap-3">
        <SectionHeader
          title="Results"
          :count="platformStore.clips.length"
          :description="displayTotalPages > 1 ? `Page ${currentPage} of ${displayTotalPages}` : undefined"
        >
          <template v-if="selectedVodIds.size > 0 && detectedPlatform !== 'tokend'">
            <span class="tabular mr-1 text-xs text-fg-muted">{{ selectedVodIds.size }} selected</span>
            <Button variant="ghost" size="sm" @click="clearSelection">Clear</Button>
            <Button variant="secondary" size="sm" @click="downloadSelectedVods">
              <Download />
              Download selected
            </Button>
          </template>
        </SectionHeader>

        <!-- Keyed by the first result so a new search, tab or page eases in -->
        <div :key="paginatedClips[0]?.clipId" class="card-grid animate-fade-in">
          <VodCard
            v-for="clip in paginatedClips"
            :key="clip.clipId"
            :title="clip.title"
            :thumbnail-url="clip.thumbnailUrl"
            :platform="detectedPlatform"
            :duration="clip.duration !== undefined && clip.duration > 0 ? formatDuration(clip.duration) : null"
            :meta="[clip.uploader, clip.createdAt ? formatRelativeTime(clip.createdAt) : 'No timestamp']"
            :meta-title="clip.createdAt ? formatAbsoluteDate(clip.createdAt, true) : undefined"
            :selectable="detectedPlatform !== 'tokend'"
            :selected="selectedVodIds.has(clip.clipId)"
            :downloaded="isVodAlreadyDownloaded(clip.clipId)"
            :download-disabled="detectedPlatform === 'tokend'"
            :download-label="detectedPlatform === 'tokend' ? 'Tokend downloads are unavailable' : 'Download'"
            @click="handleClipClick(clip)"
            @toggle-select="toggleVodSelection(clip)"
            @download="handleDownloadClip(clip)"
          />
        </div>
      </section>

      <!-- Empty -->
      <EmptyState
        v-else
        :icon="Video"
        title="Find VODs to download"
        description="Paste a stream link, mint ID or channel name above to browse past broadcasts."
      >
        <div class="flex items-center gap-1.5" aria-label="Supported platforms">
          <PlatformLogo v-for="platform in supportedVodPlatforms" :key="platform" :platform="platform" size="md" />
        </div>
      </EmptyState>
    </div>

    <!-- Pagination -->
    <PaginationFooter
      v-if="platformStore.clips.length > 0"
      :current-page="currentPage"
      :total-pages="displayTotalPages"
      :total-items="platformStore.clips.length"
      item-label="VOD"
      @go-to-page="goToPage"
      @previous="previousPage"
      @next="nextPage"
    />

    <!-- Download options -->
    <Modal
      :open="showDownloadDialog"
      :title="
        isProcessingQueue ? `Download options (${currentQueueIndex + 1}/${downloadQueue.length})` : 'Download options'
      "
      description="Choose which part of the VOD to download."
      :icon="Download"
      size="lg"
      :dismissible="!downloadStarting"
      :hide-close="downloadStarting"
      @close="closeDownloadDialog()"
    >
      <div class="flex flex-col gap-5">
        <!-- VOD preview -->
        <div class="flex items-center gap-3">
          <div class="grid aspect-video w-28 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-sunken">
            <img
              v-if="clipToDownload?.thumbnailUrl"
              :src="clipToDownload.thumbnailUrl"
              alt=""
              class="size-full object-cover"
            />
            <Video v-else class="size-6 text-fg-disabled" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="line-clamp-2 text-sm font-medium text-fg">{{ clipToDownload?.title }}</h3>
            <p class="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-fg-muted">
              <span class="tabular inline-flex items-center gap-1">
                <Clock class="size-3" />
                {{ formatDuration(clipToDownload?.duration) }}
              </span>
              <span class="text-fg-disabled">·</span>
              <span>
                {{ clipToDownload?.createdAt ? formatAbsoluteDate(clipToDownload?.createdAt, true) : 'No timestamp' }}
              </span>
              <template v-if="clipToDownload?.createdAt">
                <span class="text-fg-disabled">·</span>
                <span>{{ formatRelativeTime(clipToDownload?.createdAt) }}</span>
              </template>
            </p>
          </div>
        </div>

        <!-- Time range -->
        <Field label="Range">
          <template #label-end>
            <Badge :variant="isFullStreamSelected ? 'brand' : 'neutral'" class="tabular">
              {{ isFullStreamSelected ? 'Full stream' : formatDuration(selectedDuration) }}
            </Badge>
          </template>
          <TimeRangePicker
            v-model="selectedTimeRange"
            :total-duration="clipToDownload?.duration || 0"
            @change="handleTimeRangeChange"
          />
          <Button v-if="!isFullStreamSelected" variant="link" size="xs" class="self-start" @click="resetToFullStream">
            <RotateCcw />
            Reset to full stream
          </Button>
        </Field>

        <!-- Auto-segment -->
        <div v-if="selectedDuration > 900" class="flex flex-col gap-3 border-t border-line-subtle pt-4">
          <div class="flex items-center justify-between gap-3">
            <label class="flex cursor-pointer items-center gap-2 text-sm text-fg">
              <Checkbox v-model="autoSegment" />
              Auto-segment into parts
            </label>
            <Badge v-if="autoSegment" variant="brand" class="tabular">~{{ estimatedParts }} parts</Badge>
          </div>
          <div v-if="autoSegment" class="flex flex-col gap-1 pl-6">
            <div class="flex items-center justify-between text-xs">
              <span class="text-fg-muted">Part duration</span>
              <span class="tabular font-medium text-fg">{{ autoSegmentDuration }} min</span>
            </div>
            <input v-model.number="autoSegmentDuration" type="range" min="15" max="60" step="5" class="w-full" />
            <div class="tabular flex justify-between text-2xs text-fg-subtle">
              <span>15m</span>
              <span>30m</span>
              <span>45m</span>
              <span>60m</span>
            </div>
          </div>
        </div>

        <!-- Creator clip defaults (local user profiles only; eligibility set when dialog opens) -->
        <Field v-if="clipDefaultsEligible" label="Creator layout">
          <label class="flex cursor-pointer items-center gap-2 text-sm text-fg">
            <Checkbox v-model="useCreatorLayout" />
            Use creator layout
          </label>
          <p class="text-xs text-fg-subtle">
            Apply framing, overlays, and subtitle defaults from this creator's profile for this VOD.
          </p>
        </Field>
      </div>

      <template #footer>
        <Button variant="ghost" :disabled="downloadStarting" @click="closeDownloadDialog()">Cancel</Button>
        <Button
          variant="primary"
          :loading="downloadStarting"
          :disabled="selectedTimeRange.endTime <= selectedTimeRange.startTime"
          @click="downloadClipConfirmed"
        >
          <Download v-if="!downloadStarting" />
          {{ downloadStarting ? 'Starting…' : 'Start download' }}
        </Button>
      </template>
    </Modal>

    <!-- Auth Modal -->
    <slot name="auth" />
  </PageLayout>
</template>
<script lang="ts">
  import { defineComponent, markRaw } from 'vue';
  import { streamVodsPresentation } from '@/lib/sharedViewPresentation';
  import PageLayout from '@/components/PageLayout.vue';
  import TimeRangePicker from '@/components/TimeRangePicker.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import { Clock, AlertTriangle, Download, Video, Search, Loader2, RotateCcw, Info } from 'lucide-vue-next';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Modal } from '@/components/ui/modal';
  import { PlatformLogo } from '@/components/ui/platform-logo';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import RecentSearchesMenu from '@/components/streams/RecentSearchesMenu.vue';
  import StreamLinkInput from '@/components/streams/StreamLinkInput.vue';
  import VodCard from '@/components/streams/VodCard.vue';
  export default defineComponent({
    components: {
      PageLayout,
      TimeRangePicker,
      PaginationFooter,
      Clock,
      AlertTriangle,
      Download,
      Video,
      Search,
      Loader2,
      RotateCcw,
      Info,
      Alert,
      AlertDescription,
      AlertTitle,
      Badge,
      Button,
      Checkbox,
      EmptyState,
      Field,
      Modal,
      PlatformLogo,
      SectionHeader,
      SegmentedControl,
      RecentSearchesMenu,
      StreamLinkInput,
      VodCard,
    },
    props: { model: { type: Object, required: true } },
    setup(props): Record<string, any> {
      return Object.assign(props.model, streamVodsPresentation(props.model), {
        PageLayout: markRaw(PageLayout),
        TimeRangePicker: markRaw(TimeRangePicker),
        PaginationFooter: markRaw(PaginationFooter),
        Clock: markRaw(Clock),
        AlertTriangle: markRaw(AlertTriangle),
        Download: markRaw(Download),
        Video: markRaw(Video),
        Search: markRaw(Search),
        Loader2: markRaw(Loader2),
        RotateCcw: markRaw(RotateCcw),
        Info: markRaw(Info),
        Alert: markRaw(Alert),
        AlertDescription: markRaw(AlertDescription),
        AlertTitle: markRaw(AlertTitle),
        Badge: markRaw(Badge),
        Button: markRaw(Button),
        Checkbox: markRaw(Checkbox),
        EmptyState: markRaw(EmptyState),
        Field: markRaw(Field),
        Modal: markRaw(Modal),
        PlatformLogo: markRaw(PlatformLogo),
        SectionHeader: markRaw(SectionHeader),
        SegmentedControl: markRaw(SegmentedControl),
        RecentSearchesMenu: markRaw(RecentSearchesMenu),
        StreamLinkInput: markRaw(StreamLinkInput),
        VodCard: markRaw(VodCard),
      });
    },
  });
</script>
