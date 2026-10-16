<template>
  <div class="streamvods">
    <PageLayout
      title="Search VODs"
      description="Download VODs from your favorite streaming platforms"
      :show-header="true"
      :icon="Video"
    >
      <template #actions>
        <div class="streamvods-actions">
          <!-- Recent Searches Dropdown -->
          <div class="streamvods-recent">
            <button
              @click="showRecentDropdown = !showRecentDropdown"
              class="streamvods-recent__trigger"
              title="Recent searches"
            >
              <Clock class="streamvods-recent__trigger-icon" />
              <span class="streamvods-recent__trigger-text">Recent</span>
              <ChevronDown
                class="streamvods-recent__trigger-chevron"
                :class="{ 'streamvods-recent__trigger-chevron--open': showRecentDropdown }"
              />
            </button>
            <div v-if="showRecentDropdown" class="streamvods-recent__dropdown" @click.stop>
              <div class="streamvods-recent__header">Recent Searches</div>
              <div v-if="!platformStore.getRecentSearches.length" class="streamvods-recent__header">No recent searches yet</div>
              <div
                v-for="search in platformStore.getRecentSearches.slice(0, 15)"
                :key="`${search.platform}-${search.id}`"
                class="streamvods-recent__item"
                @click="
                  handleRecentSearchClick(search);
                  showRecentDropdown = false;
                "
              >
                <div class="streamvods-recent__avatar">
                  <div class="streamvods-recent__avatar-img">
                    <img v-if="search.imageUrl" :src="search.imageUrl" />
                    <component
                      v-else
                      :is="getPlatformFallbackIcon(search.platform)"
                      class="streamvods-recent__avatar-fallback"
                    />
                  </div>
                  <div
                    class="streamvods-recent__avatar-badge"
                    :class="`streamvods-recent__avatar-badge--${search.platform}`"
                  >
                    <img :src="getPlatformIcon(search.platform)" />
                  </div>
                </div>
                <div class="streamvods-recent__info">
                  <span class="streamvods-recent__name">
                    <template v-if="search.symbol">{{ search.symbol }}</template>
                    <template v-else-if="search.label">{{ search.label }}</template>
                    <template v-else>{{ getCleanChannelName(search.id, search.platform) }}</template>
                  </span>
                  <span class="streamvods-recent__detail">
                    <template v-if="search.name">{{ search.name }}</template>
                    <template v-else>{{ search.displayText }}</template>
                  </span>
                </div>
              </div>
              <button
                v-if="platformStore.getRecentSearches.length"
                @click="
                  platformStore.clearRecentSearches();
                  showRecentDropdown = false;
                "
                class="streamvods-recent__clear"
              >
                Clear All
              </button>
            </div>
          </div>

          <!-- Search Input with Auto-Detection -->
          <div class="streamvods-search-group" data-tour-id="tour-vod-search">
            <div class="streamvods-search">
            <transition name="scale" mode="out-in">
              <div
                v-if="detectedPlatform === 'pumpfun'"
                class="streamvods-search__platform streamvods-search__platform--pumpfun"
                key="pf"
              >
                <img :src="assetBase + '/capsule.svg'" class="streamvods-search__platform-icon" />
              </div>
              <div
                v-else-if="detectedPlatform === 'kick'"
                class="streamvods-search__platform streamvods-search__platform--kick"
                key="kick"
              >
                <img :src="assetBase + '/kick.svg'" class="streamvods-search__platform-icon streamvods-search__platform-icon--dark" />
              </div>
              <div
                v-else-if="detectedPlatform === 'twitch'"
                class="streamvods-search__platform streamvods-search__platform--twitch"
                key="tw"
              >
                <img :src="assetBase + '/twitch.svg'" class="streamvods-search__platform-icon" />
              </div>
              <div
                v-else-if="detectedPlatform === 'YouTube'"
                class="streamvods-search__platform streamvods-search__platform--youtube"
                key="yt"
              >
                <img :src="assetBase + '/youtube.svg'" class="streamvods-search__platform-icon" />
              </div>
              <div
                v-else-if="detectedPlatform === 'rumble'"
                class="streamvods-search__platform streamvods-search__platform--rumble"
                key="rumble"
              >
                <img :src="assetBase + '/rumble.svg'" class="streamvods-search__platform-icon" />
              </div>
              <div
                v-else-if="detectedPlatform === 'twitter'"
                class="streamvods-search__platform streamvods-search__platform--twitter"
                key="twitter"
              >
                <img :src="assetBase + '/x.svg'" class="streamvods-search__platform-icon" />
              </div>
              <div
                v-else-if="detectedPlatform === 'tokend'"
                class="streamvods-search__platform streamvods-search__platform--tokend"
                key="tokend"
              >
                <img
                  :src="assetBase + '/tokend.png'"
                  class="streamvods-search__platform-icon streamvods-search__platform-icon--tokend"
                />
              </div>
              <Search v-else class="streamvods-search__icon" key="search" />
            </transition>
            <input
              v-model="searchInput"
              class="streamvods-search__input"
              placeholder="Paste stream link, mint ID, or username..."
              :disabled="platformStore.loading"
              @input="detectPlatform"
              @keyup.enter="handleSearch"
            />
          </div>
          <button class="streamvods-search-btn" :disabled="!searchInput || platformStore.loading" @click="handleSearch">
            <Loader2
              v-if="platformStore.loading"
              class="streamvods-search-btn__icon streamvods-search-btn__icon--spin"
            />
            <Search v-else class="streamvods-search-btn__icon" />
            Search
          </button>
          </div>
        </div>
      </template>

      <div
        class="streamvods__content"
        data-tour-id="tour-vod-page"
        :class="{ 'streamvods__content--empty': platformStore.clips.length === 0 && !platformStore.loading }"
      >
        <!-- YouTube Tabs -->
        <div v-if="detectedPlatform === 'YouTube' && (platformStore.clips.length > 0 || platformStore.loading)" class="streamvods__youtube-tabs">
          <button
            :class="['streamvods__youtube-tab', { 'streamvods__youtube-tab--active': youtubeTab === 'streams' }]"
            @click="switchYouTubeTab('streams')"
            :disabled="platformStore.loading"
          >
            Live Streams
          </button>
          <button
            :class="['streamvods__youtube-tab', { 'streamvods__youtube-tab--active': youtubeTab === 'videos' }]"
            @click="switchYouTubeTab('videos')"
            :disabled="platformStore.loading"
          >
            Videos
          </button>
        </div>

        <!-- Rumble Tabs -->
        <div v-if="detectedPlatform === 'rumble' && (platformStore.clips.length > 0 || platformStore.loading)" class="streamvods__youtube-tabs">
          <button
            :class="['streamvods__youtube-tab', { 'streamvods__youtube-tab--active': rumbleTab === 'streams' }]"
            @click="switchRumbleTab('streams')"
            :disabled="platformStore.loading"
          >
            Live Streams
          </button>
          <button
            :class="['streamvods__youtube-tab', { 'streamvods__youtube-tab--active': rumbleTab === 'videos' }]"
            @click="switchRumbleTab('videos')"
            :disabled="platformStore.loading"
          >
            Videos
          </button>
        </div>

        <!-- Tokend Tabs -->
        <div
          v-if="detectedPlatform === 'tokend' && (platformStore.clips.length > 0 || platformStore.loading)"
          class="streamvods__youtube-tabs"
        >
          <button
            type="button"
            :class="['streamvods__youtube-tab', { 'streamvods__youtube-tab--active': tokendTab === 'streams' }]"
            :disabled="platformStore.loading"
            @click="switchTokendTab('streams')"
          >
            Streams
          </button>
          <button
            type="button"
            :class="['streamvods__youtube-tab', { 'streamvods__youtube-tab--active': tokendTab === 'videos' }]"
            :disabled="platformStore.loading"
            @click="switchTokendTab('videos')"
          >
            Videos
          </button>
        </div>

        <div
          v-if="detectedPlatform === 'tokend' && platformStore.tokendCatalogMetadata"
          class="streamvods__capability-notice"
        >
          <strong>{{ tokendModeLabel }}</strong>
          <span>{{ platformStore.tokendCatalogMetadata.note || 'Public creator catalog read.' }}</span>
          <span>Tokend media download grants are not available.</span>
        </div>

        <!-- Page Heading -->
        <div v-if="platformStore.clips.length > 0 || platformStore.loading" class="streamvods__heading">
          <h1 class="streamvods__title">Stream VOD Library</h1>
          <p class="streamvods__subtitle">Search and download VODs from your favorite streaming platforms</p>
        </div>

        <!-- Loading State -->
        <div v-if="platformStore.loading" class="streamvods__loading">
          <div class="streamvods__section-header">
            <div class="streamvods__section-header-left">
              <div class="streamvods__section-icon">
                <Video />
              </div>
              <div class="streamvods__section-text">
                <h2 class="streamvods__section-title">Loading VODs</h2>
                <p class="streamvods__section-subtitle">Fetching available streams...</p>
              </div>
            </div>
          </div>
          <div class="streamvods__grid">
            <div v-for="i in 6" :key="i" class="vod-card vod-card--skeleton">
              <div class="vod-card__skeleton-bg"></div>
              <div class="vod-card__bottom">
                <div class="vod-card__skeleton-title"></div>
                <div class="vod-card__skeleton-meta"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="platformStore.error" class="streamvods__error">
          <div class="streamvods__error-icon">
            <AlertTriangle />
          </div>
          <h3 class="streamvods__error-title">Error</h3>
          <p class="streamvods__error-message">{{ platformStore.error }}</p>
          <button @click="handleSearch" class="streamvods__error-btn">Try Again</button>
        </div>

        <!-- VODs Grid -->
        <div v-else-if="platformStore.clips.length > 0" class="streamvods__results">
          <!-- Results Count -->
          <div class="streamvods__results-count">
            {{ paginatedClips.length }} {{ paginatedClips.length === 1 ? 'item' : 'items' }}
            <span v-if="displayTotalPages > 1">(Page {{ currentPage }} of {{ displayTotalPages }})</span>
          </div>

          <!-- Bulk Actions Bar -->
          <div v-if="selectedVodIds.size > 0 && detectedPlatform !== 'tokend'" class="streamvods__bulk-actions">
            <span class="streamvods__bulk-count">{{ selectedVodIds.size }} selected</span>
            <div class="streamvods__bulk-buttons">
              <button @click="clearSelection" class="streamvods__bulk-btn streamvods__bulk-btn--secondary">
                Clear Selection
              </button>
              <button @click="downloadSelectedVods" class="streamvods__bulk-btn streamvods__bulk-btn--primary">
                <Download :size="14" />
                Download Selected
              </button>
            </div>
          </div>

          <!-- VOD Cards Grid -->
          <div class="streamvods__grid">
            <div 
              v-for="clip in paginatedClips" 
              :key="clip.clipId" 
              class="vod-card" 
              :class="{ 
                'vod-card--selected': selectedVodIds.has(clip.clipId),
                'vod-card--downloaded': isVodAlreadyDownloaded(clip.clipId)
              }" 
              @click="handleClipClick(clip)"
            >
              <!-- Selection Checkbox -->
              <div
                v-if="detectedPlatform !== 'tokend'"
                class="vod-card__checkbox"
                :class="{ 'vod-card__checkbox--visible': selectedVodIds.has(clip.clipId) }"
                @click.stop="toggleVodSelection(clip)"
              >
                <div
                  class="vod-card__checkbox-inner"
                  :class="{ 'vod-card__checkbox-inner--checked': selectedVodIds.has(clip.clipId) }"
                >
                  <Check v-if="selectedVodIds.has(clip.clipId)" class="vod-card__checkbox-icon" />
                </div>
              </div>
              
              <!-- Thumbnail Background -->
              <div
                v-if="clip.thumbnailUrl"
                class="vod-card__thumbnail"
                :style="{ backgroundImage: `url(${clip.thumbnailUrl})` }"
              ></div>

              <!-- Vignette Overlay -->
              <div class="vod-card__vignette"></div>

              <!-- Platform Badge -->
              <div class="vod-card__badges">
                <span v-if="detectedPlatform" class="vod-card__badge" :class="`vod-card__badge--${detectedPlatform}`">
                  <img :src="getPlatformIcon(detectedPlatform)" class="vod-card__badge-icon" />
                </span>
                <span v-if="clip.duration !== undefined && clip.duration > 0" class="vod-card__badge vod-card__badge--duration">
                  <Clock class="vod-card__badge-icon-svg" />
                  {{ formatDuration(clip.duration) }}
                </span>
                <!-- Downloaded Badge -->
                <span v-if="isVodAlreadyDownloaded(clip.clipId)" class="vod-card__badge vod-card__badge--downloaded">
                  <Check class="vod-card__badge-icon-svg" />
                  Downloaded
                </span>
              </div>

              <!-- Hover Actions -->
              <div class="vod-card__actions">
                <button
                  class="vod-card__action-btn"
                  :disabled="detectedPlatform === 'tokend'"
                  :title="detectedPlatform === 'tokend' ? 'Tokend downloads are unavailable' : 'Download'"
                  @click.stop="handleDownloadClip(clip)"
                >
                  <Download class="vod-card__action-icon" />
                </button>
              </div>

              <!-- Bottom Info Overlay -->
              <div class="vod-card__bottom">
                <h3 class="vod-card__name" :title="clip.title">{{ clip.title }}</h3>
                <div class="vod-card__meta">
                  <template v-if="clip.uploader">
                    <span>{{ clip.uploader }}</span>
                    <span class="vod-card__meta-dot"></span>
                  </template>
                  <span>{{ clip.createdAt ? formatAbsoluteDate(clip.createdAt) : 'No timestamp' }}</span>
                  <template v-if="clip.createdAt">
                    <span class="vod-card__meta-dot"></span>
                    <span>{{ formatRelativeTime(clip.createdAt) }}</span>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="streamvods__empty">
          <div class="streamvods__empty-icon-wrapper">
            <Video class="streamvods__empty-icon" />
          </div>
          <h3 class="streamvods__empty-title">Search for VODs</h3>
          <p class="streamvods__empty-description">Paste a stream link, mint ID, or channel username to find VODs</p>
        </div>
      </div>

      <template #footer>
      <!-- Pagination Footer -->
      <PaginationFooter
        v-if="platformStore.clips.length > 0"
        :current-page="currentPage"
        :total-pages="displayTotalPages"
        :total-items="platformStore.clips.length"
        item-label="VOD"
        mode="static"
        @go-to-page="goToPage"
        @previous="previousPage"
        @next="nextPage"
      />
      </template>
    </PageLayout>

    <!-- Download Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDownloadDialog" class="download-modal__overlay" @click.self="closeDownloadDialog()">
          <Transition name="dialog" appear>
            <div class="download-modal" role="dialog" aria-modal="true" aria-label="Download Options">
              <!-- Accent Bar -->
              <div class="download-modal__accent"></div>

              <!-- Header -->
              <div class="download-modal__header">
                <button class="download-modal__close" @click="closeDownloadDialog()" title="Close">
                  <X :size="18" />
                </button>
                <div class="download-modal__icon">
                  <Download :size="24" />
                </div>
                <h2 class="download-modal__title">
                  {{ isProcessingQueue ? `Download Options (${currentQueueIndex + 1}/${downloadQueue.length})` : 'Download Options' }}
                </h2>
                <p class="download-modal__subtitle">Configure your download settings</p>
              </div>

              <!-- Content -->
              <div class="download-modal__content">
                <!-- VOD Preview Card -->
                <div class="download-preview">
                  <div class="download-preview__thumb">
                    <img v-if="clipToDownload?.thumbnailUrl" :src="clipToDownload.thumbnailUrl" />
                    <div v-else class="download-preview__placeholder">
                      <Video :size="28" />
                    </div>
                  </div>
                  <div class="download-preview__info">
                    <h3 class="download-preview__title">{{ clipToDownload?.title }}</h3>
                    <div class="download-preview__meta">
                      <span class="download-preview__duration">
                        <Clock :size="10" />
                        {{ formatDuration(clipToDownload?.duration) }}
                      </span>
                      <span class="download-preview__sep">·</span>
                      <span>
                        {{
                          clipToDownload?.createdAt
                            ? formatAbsoluteDate(clipToDownload?.createdAt, true)
                            : 'No timestamp'
                        }}
                      </span>
                      <template v-if="clipToDownload?.createdAt">
                        <span class="download-preview__sep">·</span>
                        <span>{{ formatRelativeTime(clipToDownload?.createdAt) }}</span>
                      </template>
                    </div>
                  </div>
                </div>

                <!-- Time Range Section -->
                <div class="download-section">
                  <div class="download-section__header">
                    <span class="download-section__label">Select Range</span>
                    <span
                      class="download-section__badge"
                      :class="
                        isFullStreamSelected ? 'download-section__badge--full' : 'download-section__badge--partial'
                      "
                    >
                      {{ isFullStreamSelected ? 'Full Stream' : formatDuration(selectedDuration) }}
                    </span>
                  </div>
                  <div class="download-section__card">
                    <TimeRangePicker
                      v-model="selectedTimeRange"
                      :total-duration="clipToDownload?.duration || 0"
                      @change="handleTimeRangeChange"
                    />
                  </div>
                  <button v-if="!isFullStreamSelected" @click="resetToFullStream" class="download-section__reset">
                    <RotateCcw :size="12" />
                    Reset to full stream
                  </button>
                </div>

                <!-- Auto-Segment Section -->
                <div v-if="selectedDuration > 900" class="download-section">
                  <div class="download-segment">
                    <div class="download-segment__header">
                      <label class="download-segment__toggle">
                        <input type="checkbox" v-model="autoSegment" class="download-segment__checkbox" />
                        <span class="download-segment__label">Auto-segment into parts</span>
                      </label>
                      <span v-if="autoSegment" class="download-section__badge download-section__badge--partial">
                        ~{{ estimatedParts }} parts
                      </span>
                    </div>
                    <div v-if="autoSegment" class="download-segment__options">
                      <div class="download-segment__row">
                        <span class="download-segment__opt-label">Part Duration</span>
                        <span class="download-segment__opt-value">{{ autoSegmentDuration }} min</span>
                      </div>
                      <input
                        type="range"
                        v-model.number="autoSegmentDuration"
                        min="15"
                        max="60"
                        step="5"
                        class="download-segment__slider"
                      />
                      <div class="download-segment__marks">
                        <span>15m</span>
                        <span>30m</span>
                        <span>45m</span>
                        <span>60m</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Creator clip defaults (local user profiles only; eligibility set when dialog opens) -->
                <div v-if="clipDefaultsEligible" class="download-section download-section--creator-layout">
                  <div class="download-section__header">
                    <span class="download-section__label">Creator layout</span>
                  </div>
                  <label class="download-creator-layout">
                    <input
                      v-model="useCreatorLayout"
                      type="checkbox"
                      class="download-creator-layout__checkbox"
                    />
                    <span class="download-creator-layout__text">Use creator layout</span>
                  </label>
                  <p class="download-creator-layout__hint">
                    Apply framing, overlays, and subtitle defaults from this creator's profile for this VOD.
                  </p>
                </div>
              </div>

              <!-- Footer -->
              <div class="download-modal__footer">
                <button
                  class="download-modal__btn download-modal__btn--secondary"
                  @click="closeDownloadDialog()"
                  :disabled="downloadStarting"
                >
                  Cancel
                </button>
                <button
                  class="download-modal__btn download-modal__btn--primary"
                  @click="downloadClipConfirmed"
                  :disabled="downloadStarting || selectedTimeRange.endTime <= selectedTimeRange.startTime"
                >
                  <Loader2 v-if="downloadStarting" :size="14" class="download-modal__btn-spinner" />
                  <span>{{ downloadStarting ? 'Starting...' : 'Start Download' }}</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Auth Modal -->
    <slot name="auth" />
  </div>
</template>
<script lang="ts">
import { defineComponent, markRaw, type PropType } from 'vue';
import PageLayout from '@/components/PageLayout.vue';
import TimeRangePicker from '@/components/TimeRangePicker.vue';
import PaginationFooter from '@/components/PaginationFooter.vue';
import { Clock, ChevronDown, X, AlertTriangle, Download, Video, Search, Loader2, RotateCcw, Check } from 'lucide-vue-next';
export default defineComponent({
 components: { PageLayout, TimeRangePicker, PaginationFooter, Clock, ChevronDown, X, AlertTriangle, Download, Video, Search, Loader2, RotateCcw, Check },
 props: { model: { type: Object as PropType<Record<string, any>>, required: true } },
 setup(props) { props.model.Video = markRaw(Video); props.model.assetBase ??= ''; return props.model; }
});
</script>
<style scoped src="@/styles/streamVods.css"></style>
