<template>
  <div class="creators">
    <PageLayout
      title="Creator Profiles"
      description="Manage your content creators and their streaming configurations"
      :show-header="true"
      :icon="Users"
    >
      <template #actions>
        <div class="creators-actions">
          <div class="creators-search">
            <Search class="creators-search__icon" />
            <Input v-model="searchQuery" class="creators-search__input" placeholder="Search creators..." />
          </div>
          <Button size="sm" class="creators-add-btn" @click="openCreateDialog">
            <Plus class="creators-add-btn__icon" />
            Add Creator
          </Button>
        </div>
      </template>

      <div class="creators__wrapper" :class="{ 'creators__wrapper--empty': !loading && creators.length === 0 }">
        <!-- Not Authenticated -->
        <div v-if="!authStore.isAuthenticated && creators.length === 0" class="creators__empty">
          <div class="creators__empty-icon-wrapper">
            <Users class="creators__empty-icon" />
          </div>
          <h3 class="creators__empty-title">Sign in to manage creators</h3>
          <p class="creators__empty-description">Access your creator profiles and streaming configurations</p>
        </div>

        <div v-else class="creators__content">
          <!-- Page Heading (hidden in empty state) -->
          <div v-if="creators.length > 0 || loading" class="creators__heading">
            <h1 class="creators__title">Manage Your Creators</h1>
            <p class="creators__subtitle">View your creator profiles, monitor live streams, and manage recordings</p>
          </div>

          <!-- Stats Summary Cards (hidden in empty state) -->
          <div v-if="creators.length > 0 || loading" class="creators__stats">
            <!-- Total Creators Card -->
            <div class="creators-stat">
              <div class="creators-stat__indicator"></div>
              <div class="creators-stat__inner">
                <div class="creators-stat__icon">
                  <Users />
                </div>
                <div class="creators-stat__info">
                  <span class="creators-stat__label">Total Creators</span>
                  <span class="creators-stat__value">
                    <template v-if="loading">
                      <span class="creators-stat__loading"></span>
                    </template>
                    <template v-else>{{ creators.length }}</template>
                  </span>
                </div>
              </div>
            </div>

            <!-- Live Now Card -->
            <div class="creators-stat creators-stat--live">
              <div class="creators-stat__indicator creators-stat__indicator--live"></div>
              <div class="creators-stat__inner">
                <div class="creators-stat__icon creators-stat__icon--live">
                  <Radio />
                </div>
                <div class="creators-stat__info">
                  <span class="creators-stat__label">Live Now</span>
                  <span class="creators-stat__value creators-stat__value--live">
                    <template v-if="loading">
                      <span class="creators-stat__loading"></span>
                    </template>
                    <template v-else>{{ liveCreatorsCount }}</template>
                  </span>
                </div>
              </div>
            </div>

            <!-- Monitoring Card -->
            <div class="creators-stat creators-stat--monitoring">
              <div class="creators-stat__indicator creators-stat__indicator--monitoring"></div>
              <div class="creators-stat__inner">
                <div class="creators-stat__icon creators-stat__icon--monitoring">
                  <Activity />
                </div>
                <div class="creators-stat__info">
                  <span class="creators-stat__label">Monitoring</span>
                  <span class="creators-stat__value creators-stat__value--monitoring">
                    <template v-if="loading">
                      <span class="creators-stat__loading"></span>
                    </template>
                    <template v-else>{{ monitoringCreatorsCount }}</template>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="loading" class="creators__loading">
            <div v-for="i in 4" :key="i" class="creator-skeleton">
              <div class="creator-skeleton__inner">
                <div class="creator-skeleton__header">
                  <div class="creator-skeleton__avatar"></div>
                  <div class="creator-skeleton__info">
                    <div class="creator-skeleton__line creator-skeleton__line--name"></div>
                    <div class="creator-skeleton__line creator-skeleton__line--desc"></div>
                    <div class="creator-skeleton__badges">
                      <div class="creator-skeleton__badge"></div>
                      <div class="creator-skeleton__badge"></div>
                    </div>
                  </div>
                </div>
                <div class="creator-skeleton__footer">
                  <div class="creator-skeleton__status"></div>
                  <div class="creator-skeleton__actions">
                    <div class="creator-skeleton__btn"></div>
                    <div class="creator-skeleton__btn"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Main Content Area -->
          <div v-else-if="creators.length > 0" class="creators__list-section">
            <!-- Item Count -->
            <div class="creators__item-count">
              {{ filteredCreators.length }} {{ filteredCreators.length === 1 ? 'profile' : 'profiles' }}
            </div>

            <!-- Creator List -->
            <div class="creators__list">
              <transition-group name="list" tag="div" class="creators__list-inner">
                <div v-for="creator in sortedCreators" :key="creator.id" class="creator-card">
                  <div class="creator-card__inner">
                    <!-- Header Row: Avatar + Info + Platform Badges -->
                    <div class="creator-card__header">
                      <!-- Avatar with status indicator -->
                      <div class="creator-card__avatar-wrapper">
                        <div class="creator-card__avatar">
                          <img
                            v-if="getCreatorProfileImage(creator)"
                            :src="getCreatorProfileImage(creator)"
                            class="creator-card__avatar-img"
                            @error="handleImageError($event, creator)"
                          />
                          <div v-else class="creator-card__avatar-fallback">
                            <Users class="creator-card__avatar-icon" />
                          </div>
                        </div>
                        <!-- Live/Monitoring indicator dot -->
                        <div
                          v-if="isCreatorMonitored(creator) || isCreatorLive(creator)"
                          class="creator-card__status-dot"
                          :class="{
                            'creator-card__status-dot--monitoring': isCreatorMonitored(creator),
                            'creator-card__status-dot--live': !isCreatorMonitored(creator) && isCreatorLive(creator),
                          }"
                        >
                          <span class="creator-card__status-dot-inner"></span>
                        </div>
                      </div>

                      <!-- Creator Info -->
                      <div class="creator-card__info">
                        <div class="creator-card__name-row">
                          <h3 class="creator-card__name">{{ creator.name }}</h3>
                          <!-- Organization Badge -->
                          <div
                            v-if="creator.isOrgProfile"
                            class="creator-card__org-badge"
                            :title="`Managed by ${creator.organization_name}`"
                          >
                            <Building2 class="creator-card__org-badge-icon" />
                            {{ creator.organization_name }}
                          </div>
                        </div>
                        <!-- Description -->
                        <p v-if="creator.description" class="creator-card__description">
                          {{ creator.description }}
                        </p>
                        <!-- Platform Badges -->
                        <div class="creator-card__platforms">
                          <div v-for="link in creator.platform_links" :key="link.id" class="creator-card__platform">
                            <img :src="getPlatformIcon(link.platform)" class="creator-card__platform-icon" />
                            <span class="creator-card__platform-name">
                              {{ link.display_name || truncateId(link.platform_id) }}
                            </span>
                          </div>
                        </div>
                      </div>

                      <!-- Asset Indicators -->
                      <div
                        v-if="creator.intro_id || creator.outro_id || creator.watermark_id"
                        class="creator-card__assets"
                      >
                        <div
                          v-if="creator.intro_id"
                          class="creator-card__asset creator-card__asset--intro"
                          title="Has intro configured"
                        >
                          <Play class="creator-card__asset-icon" />
                        </div>
                        <div
                          v-if="creator.outro_id"
                          class="creator-card__asset creator-card__asset--outro"
                          title="Has outro configured"
                        >
                          <SkipForward class="creator-card__asset-icon" />
                        </div>
                        <div
                          v-if="creator.watermark_id"
                          class="creator-card__asset creator-card__asset--watermark"
                          title="Has watermark configured"
                        >
                          <ImageIcon class="creator-card__asset-icon" />
                        </div>
                      </div>
                    </div>

                    <!-- Footer Row: Status + Actions -->
                    <div class="creator-card__footer">
                      <!-- Left: Status -->
                      <div class="creator-card__status">
                        <!-- Monitoring status -->
                        <div
                          v-if="isLiveClipEnabled && isCreatorMonitored(creator)"
                          class="creator-status creator-status--monitoring"
                        >
                          <span class="creator-status__dot"></span>
                          {{ getCreatorStatusLabel(creator) }}
                        </div>
                        <!-- Live status for monitorable creators -->
                        <template v-else-if="isLiveClipEnabled && hasMonitorableLink(creator)">
                          <div v-if="isCreatorCheckingLive(creator)" class="creator-status creator-status--checking">
                            <Loader2 class="creator-status__spinner" />
                            Checking...
                          </div>
                          <div v-else-if="isCreatorLive(creator)" class="creator-status creator-status--live">
                            <span class="creator-status__dot"></span>
                            LIVE
                            <span v-if="getCreatorViewerCount(creator)" class="creator-status__viewers">
                              {{ formatViewerCount(getCreatorViewerCount(creator)!) }} viewers
                            </span>
                          </div>
                          <div v-else class="creator-status creator-status--offline">
                            <span class="creator-status__dot"></span>
                            Offline
                          </div>
                        </template>
                        <!-- Platform count -->
                        <span v-else class="creator-card__platform-count">
                          {{ creator.platform_links.length }} platform{{
                            creator.platform_links.length !== 1 ? 's' : ''
                          }}
                          linked
                        </span>
                      </div>

                      <!-- Right: Actions -->
                      <div class="creator-card__actions">
                        <!-- Live Clip Controls (Primary Actions) -->
                        <template v-if="isLiveClipEnabled && hasMonitorableLink(creator)">
                          <template v-if="!isCreatorMonitored(creator)">
                            <div class="creator-action-group">
                              <button
                                @click.stop="startCreatorMonitoring(creator, false)"
                                class="creator-action-group__btn"
                                title="Record Only"
                              >
                                <span class="creator-action-group__rec-dot"></span>
                                Rec
                              </button>
                              <button
                                @click.stop="startCreatorMonitoring(creator, true)"
                                class="creator-action-group__btn creator-action-group__btn--primary"
                                title="Auto-Detect Clips"
                              >
                                <Sparkles class="creator-btn__icon" />
                                Auto
                              </button>
                            </div>
                          </template>
                          <template v-else>
                            <button
                              @click.stop="stopCreatorMonitoring(creator)"
                              class="creator-btn creator-btn--stop"
                              title="Stop Monitoring"
                            >
                              <Square class="creator-btn__icon" />
                              Stop
                            </button>
                          </template>
                          <button
                            @click.stop="watchCreator(creator)"
                            :disabled="!canWatchCreator(creator)"
                            class="creator-btn creator-btn--watch"
                            :class="{ 'creator-btn--watch-disabled': !canWatchCreator(creator) }"
                            :title="
                              canWatchCreator(creator)
                                ? 'Watch Live'
                                : 'Watch becomes available when the creator is monitored and live'
                            "
                          >
                            <Eye class="creator-btn__icon" />
                            Watch
                          </button>
                        </template>

                        <!-- More Actions Dropdown -->
                        <DropdownMenu>
                          <DropdownMenuTrigger as-child>
                            <button class="creator-btn creator-btn--more" title="More actions">
                              <MoreHorizontal class="creator-btn__icon" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" :side-offset="4" class="creator-dropdown">
                            <DropdownMenuItem class="creator-dropdown__item" @click="viewCreatorVods(creator)">
                              <Video class="creator-dropdown__item-icon" />
                              View VODs
                            </DropdownMenuItem>
                            <DropdownMenuItem class="creator-dropdown__item" @click="openDownloadDialog(creator)">
                              <Download class="creator-dropdown__item-icon" />
                              Download VOD
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              v-if="!creator.isOrgProfile"
                              class="creator-dropdown__item"
                              @click="openEditDialog(creator)"
                            >
                              <Edit class="creator-dropdown__item-icon" />
                              Edit Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              v-if="creator.isOrgProfile && creator.organization_id"
                              class="creator-dropdown__item"
                              @click="openPostSubmitDialog(creator)"
                            >
                              <Link class="creator-dropdown__item-icon" />
                              Submit Post Link
                            </DropdownMenuItem>
                            <template v-if="isLiveClipEnabled && hasMonitorableLink(creator)">
                              <DropdownMenuSeparator class="creator-dropdown__separator" />
                              <DropdownMenuItem class="creator-dropdown__item" @click="toggleCreatorAutoDvr(creator)">
                                <HardDrive class="creator-dropdown__item-icon" />
                                Auto DVR {{ isCreatorAutoDvrEnabled(creator) ? 'On' : 'Off' }}
                                <span
                                  class="creator-dropdown__item-badge"
                                  :class="{ 'creator-dropdown__item-badge--active': isCreatorAutoDvrEnabled(creator) }"
                                >
                                  {{ isCreatorAutoDvrEnabled(creator) ? 'ON' : 'OFF' }}
                                </span>
                              </DropdownMenuItem>
                            </template>
                            <template v-if="!creator.isOrgProfile">
                              <DropdownMenuSeparator class="creator-dropdown__separator" />
                              <DropdownMenuItem
                                class="creator-dropdown__item creator-dropdown__item--danger"
                                @click="confirmDeleteCreator(creator)"
                              >
                                <Trash2 class="creator-dropdown__item-icon" />
                                Delete Creator
                              </DropdownMenuItem>
                            </template>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              </transition-group>

              <!-- No results from search -->
              <div v-if="filteredCreators.length === 0 && searchQuery" class="creators__no-results">
                <Search class="creators__no-results-icon" />
                <p class="creators__no-results-title">No creators found</p>
                <p class="creators__no-results-text">No results for "{{ searchQuery }}"</p>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="creators__empty">
            <div class="creators__empty-icon-wrapper">
              <Users class="creators__empty-icon" />
            </div>
            <h3 class="creators__empty-title">No creators yet</h3>
            <p class="creators__empty-description">
              Add your first content creator to start managing their VODs, assets, and live monitoring.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>

    <!-- Creator Profile Dialog -->
    <ProfileDialog
      :show="showProfileDialog"
      mode="local"
      :creator="creatorToEdit"
      @close="closeProfileDialog"
      @saved="handleCreatorSaved"
    />

    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteDialog"
      title="Delete Creator"
      message="Are you sure you want to delete"
      :item-name="creatorToDelete?.name"
      suffix="? This will remove all platform links but not the associated VODs or clips."
      confirm-text="Delete"
      @close="showDeleteDialog = false"
      @confirm="deleteCreatorConfirmed"
    />

    <!-- Download Dialog -->
    <CreatorDownloadDialog
      :show="showDownloadDialog"
      :creator="creatorToDownload"
      @close="showDownloadDialog = false"
    />

    <!-- Auth Modal -->
    <AuthModal v-model="showAuthModal" />

    <!-- External Post Submit Dialog -->
    <ExternalPostSubmitDialog
      :open="showPostSubmitDialog"
      :organization-id="creatorForPostSubmit?.organization_id || 0"
      :creator-profiles="creatorForPostSubmit ? [{ id: creatorForPostSubmit.server_id!, name: creatorForPostSubmit.name }] : []"
      :campaigns="[]"
      :preselected-creator-profile-id="creatorForPostSubmit?.server_id"
      @close="showPostSubmitDialog = false"
      @submitted="handlePostSubmitted"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed } from 'vue';
  import { useRouter } from 'vue-router';
  import PageLayout from '@/components/PageLayout.vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import ProfileDialog from '@/components/ProfileDialog.vue';
  import CreatorDownloadDialog from '@/components/CreatorDownloadDialog.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import ExternalPostSubmitDialog from '@/components/organization/ExternalPostSubmitDialog.vue';
  import {
    getAllCreatorProfiles,
    deleteCreatorProfile,
    getMonitoredStreamer,
    getMonitoredStreamerByMint,
    updateMonitoredStreamer,
    createMonitoredStreamer,
    updatePlatformLink,
    type CreatorProfileWithLinks,
  } from '@/services/database';
  import {
    getUserAssignedCreatorProfiles,
    updatePlatformLink as updateOrgPlatformLink,
    type ServerOrganizationCreatorProfile,
  } from '@/services/organizationProfilesApi';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';
  import { useLivestreamMonitoring, fetchLiveStatus } from '@/composables/useLivestreamMonitoring';
  import { checkKickLivestream } from '@/services/kick';
  import { checkTwitchLivestream } from '@/services/twitch';
  import { type PlatformId } from '@/config/platforms';
  import {
    Users,
    Plus,
    Edit,
    Video,
    Download,
    Trash2,
    Play,
    SkipForward,
    Image as ImageIcon,
    Search,
    Sparkles,
    Square,
    Loader2,
    Building2,
    Eye,
    MoreHorizontal,
    Radio,
    Activity,
    HardDrive,
    Link,
  } from 'lucide-vue-next';
  import { useFeatureFlags } from '@/composables/useFeatureFlags';
  import { useLivestreamStore } from '@/stores/livestream';

  // Extended type that can represent both local and org profiles
  interface DisplayCreatorProfile extends CreatorProfileWithLinks {
    isOrgProfile?: boolean;
    organization_id?: number;
    organization_name?: string;
    server_id?: number;
  }

  function getMonitoredStreamerId(creator: DisplayCreatorProfile): string | null {
    for (const link of creator.platform_links) {
      if (link.monitored_streamer_id) {
        return link.monitored_streamer_id;
      }
    }
    return null;
  }

  function isCreatorAutoDvrEnabled(creator: DisplayCreatorProfile): boolean {
    const streamerId = getMonitoredStreamerId(creator);
    if (!streamerId) return false;
    if (autoDvrTracker.value.has(streamerId)) {
      return autoDvrTracker.value.get(streamerId)!;
    }
    const entry = monitoredStreamers.value.get(streamerId);
    return Boolean(entry?.streamer?.autoDvr);
  }

  function hasCreatorDvr(creator: DisplayCreatorProfile): boolean {
    const streamerId = getMonitoredStreamerId(creator);
    if (!streamerId) return false;
    return hasDvrRecording(streamerId);
  }

  function canWatchCreator(creator: DisplayCreatorProfile): boolean {
    if (!isCreatorLive(creator)) return false;
    const monitorableLink = creator.platform_links.find(
      (l) => l.platform === 'pumpfun' || l.platform === 'kick' || l.platform === 'twitch'
    );
    return Boolean(monitorableLink?.platform_id);
  }

  async function watchCreator(creator: DisplayCreatorProfile) {
    const monitorableLink = creator.platform_links.find(
      (l) => l.platform === 'pumpfun' || l.platform === 'kick' || l.platform === 'twitch'
    );
    if (!monitorableLink || !monitorableLink.platform_id) {
      showError('Cannot Watch', 'No PumpFun, Kick, or Twitch platform link found for this creator.');
      return;
    }

    try {
      let streamerId = monitorableLink.monitored_streamer_id;

      if (!streamerId) {
        const existingByMint = await getMonitoredStreamerByMint(monitorableLink.platform_id);
        if (existingByMint) {
          streamerId = existingByMint.id;
          await updatePlatformLink(monitorableLink.id, { monitored_streamer_id: streamerId });
          monitorableLink.monitored_streamer_id = streamerId;
        } else {
          const platformDisplay =
            monitorableLink.platform === 'kick' ? 'kick' : monitorableLink.platform === 'twitch' ? 'twitch' : 'pumpfun';
          streamerId = await createMonitoredStreamer(
            monitorableLink.platform_id,
            monitorableLink.display_name || creator.name,
            monitorableLink.profile_image_url || undefined,
            5,
            false,
            platformDisplay
          );
          await updatePlatformLink(monitorableLink.id, { monitored_streamer_id: streamerId });
          monitorableLink.monitored_streamer_id = streamerId;
        }
        window.dispatchEvent(new CustomEvent('monitored-streamers-updated'));
      }

      const entry = monitoredStreamers.value.get(streamerId)?.streamer;
      const displayName = entry?.displayName || monitorableLink.display_name || creator.name;
      const profileImage =
        entry?.profileImageUrl || monitorableLink.profile_image_url || getCreatorProfileImage(creator);

      const platform =
        monitorableLink.platform === 'kick' ? 'Kick' : monitorableLink.platform === 'twitch' ? 'Twitch' : 'PumpFun';
      livestreamStore.openWatchDialog(monitorableLink.platform_id, streamerId, displayName, profileImage, platform);
    } catch (error) {
      console.error('[CreatorProfiles] Failed to open watch dialog:', error);
      showError('Watch Failed', 'Could not open the stream viewer.');
    }
  }

  async function toggleCreatorAutoDvr(creator: DisplayCreatorProfile) {
    const monitorableLink = creator.platform_links.find(
      (l) => l.platform === 'pumpfun' || l.platform === 'kick' || l.platform === 'twitch'
    );
    if (!monitorableLink || !monitorableLink.platform_id) {
      showError('Auto DVR Unavailable', 'No PumpFun, Kick, or Twitch platform link found for this creator.');
      return;
    }

    try {
      let streamerId = monitorableLink.monitored_streamer_id;

      if (!streamerId) {
        const existingByMint = await getMonitoredStreamerByMint(monitorableLink.platform_id);
        if (existingByMint) {
          streamerId = existingByMint.id;
          await updatePlatformLink(monitorableLink.id, { monitored_streamer_id: streamerId });
          monitorableLink.monitored_streamer_id = streamerId;
        } else {
          const platformDisplay = monitorableLink.platform === 'kick' ? 'kick' : 'pumpfun';
          streamerId = await createMonitoredStreamer(
            monitorableLink.platform_id,
            monitorableLink.display_name || creator.name,
            monitorableLink.profile_image_url || undefined,
            5,
            false,
            platformDisplay
          );
          await updatePlatformLink(monitorableLink.id, { monitored_streamer_id: streamerId });
          monitorableLink.monitored_streamer_id = streamerId;
        }
      }

      let currentAutoDvr = false;
      if (autoDvrTracker.value.has(streamerId)) {
        currentAutoDvr = autoDvrTracker.value.get(streamerId)!;
      } else {
        const currentEntry = monitoredStreamers.value.get(streamerId);
        if (currentEntry) {
          currentAutoDvr = Boolean(currentEntry.streamer?.autoDvr);
        } else {
          const streamerRecord = await getMonitoredStreamer(streamerId);
          currentAutoDvr = Boolean(streamerRecord?.auto_dvr);
        }
      }

      const newValue = !currentAutoDvr;

      await updateMonitoredStreamer(streamerId, { auto_dvr: newValue ? 1 : 0 });
      autoDvrTracker.value.set(streamerId, newValue);

      const currentEntry = monitoredStreamers.value.get(streamerId);
      if (currentEntry) {
        currentEntry.streamer.autoDvr = newValue;
      }

      window.dispatchEvent(new CustomEvent('monitored-streamers-updated'));

      success(
        newValue ? 'Auto DVR Enabled' : 'Auto DVR Disabled',
        newValue ? `"${creator.name}" will auto record when live.` : `Auto DVR turned off for "${creator.name}".`
      );
    } catch (error) {
      console.error('[CreatorProfiles] Failed to update Auto DVR', error);
      showError('Update Failed', 'Could not update Auto DVR settings.');
    }
  }

  const router = useRouter();
  const authStore = useAuthStore();
  const { success, error: showError } = useToast();
  const { activeSessions, monitoredStreamers, startMonitoring, stopMonitoring, hasDvrRecording } =
    useLivestreamMonitoring();
  const { isLiveClipEnabled } = useFeatureFlags();
  const livestreamStore = useLivestreamStore();

  // State
  const loading = ref(true);
  const creators = ref<DisplayCreatorProfile[]>([]);
  const searchQuery = ref('');
  const showProfileDialog = ref(false);
  const creatorToEdit = ref<DisplayCreatorProfile | null>(null);
  const showDeleteDialog = ref(false);
  const creatorToDelete = ref<DisplayCreatorProfile | null>(null);
  const showDownloadDialog = ref(false);
  const creatorToDownload = ref<DisplayCreatorProfile | null>(null);
  const showAuthModal = ref(false);
  const showPostSubmitDialog = ref(false);
  const creatorForPostSubmit = ref<DisplayCreatorProfile | null>(null);

  // Live status tracking
  const liveStatusMap = ref<
    Map<string, { isLive: boolean; viewerCount?: number; profileImageUrl?: string; isChecking: boolean }>
  >(new Map());
  const liveStatusInterval = ref<number | null>(null);

  // Auto DVR status tracking
  const autoDvrTracker = ref<Map<string, boolean>>(new Map());

  // Computed: Stats
  const liveCreatorsCount = computed(() => {
    return creators.value.filter((c) => isCreatorLive(c)).length;
  });

  const monitoringCreatorsCount = computed(() => {
    return creators.value.filter((c) => isCreatorMonitored(c)).length;
  });

  // Filtered creators based on search
  const filteredCreators = computed(() => {
    if (!searchQuery.value.trim()) return creators.value;
    const query = searchQuery.value.toLowerCase();
    return creators.value.filter((creator) => {
      if (creator.name.toLowerCase().includes(query)) return true;
      return creator.platform_links.some(
        (link) => link.display_name?.toLowerCase().includes(query) || link.platform_id.toLowerCase().includes(query)
      );
    });
  });

  // Sorted creators: alphabetically A-Z by name
  const sortedCreators = computed(() => {
    return [...filteredCreators.value].sort((a, b) => {
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  });

  // Load creators on mount
  onMounted(async () => {
    await loadCreators();
    checkAllLiveStatuses(true); // Include Kick on initial load
    liveStatusInterval.value = window.setInterval(() => {
      checkAllLiveStatuses(false); // Skip Kick on interval to save API requests
    }, 60_000);
  });

  onUnmounted(() => {
    if (liveStatusInterval.value) {
      clearInterval(liveStatusInterval.value);
      liveStatusInterval.value = null;
    }
  });

  async function checkAllLiveStatuses(includeKick: boolean = true) {
    const pumpfunLinksToCheck: { platformId: string; mintId: string }[] = [];
    const kickLinksToCheck: {
      linkId: string;
      platformId: string;
      channelSlug: string;
      hasProfileImage: boolean;
      isOrgLink: boolean;
      organizationId?: number;
      profileId?: number;
    }[] = [];
    const twitchLinksToCheck: {
      linkId: string;
      platformId: string;
      channelName: string;
      hasProfileImage: boolean;
      isOrgLink: boolean;
      organizationId?: number;
      profileId?: number;
    }[] = [];

    for (const creator of creators.value) {
      for (const link of creator.platform_links) {
        if (link.monitored_streamer_id && monitoredStreamers.value.has(link.monitored_streamer_id)) {
          continue;
        }

        if (link.platform === 'pumpfun') {
          pumpfunLinksToCheck.push({ platformId: link.platform_id, mintId: link.platform_id });
        } else if (link.platform === 'kick' && includeKick) {
          // Only check Kick on initial load or manual refresh to save API requests
          const isOrgLink = link.id.startsWith('org-link-');
          kickLinksToCheck.push({
            linkId: link.id,
            platformId: link.platform_id,
            channelSlug: link.platform_id,
            hasProfileImage: Boolean(link.profile_image_url),
            isOrgLink,
            organizationId: isOrgLink ? creator.organization_id : undefined,
            profileId: isOrgLink ? creator.server_id : undefined,
          });
        } else if (link.platform === 'twitch') {
          const isOrgLink = link.id.startsWith('org-link-');
          twitchLinksToCheck.push({
            linkId: link.id,
            platformId: link.platform_id,
            channelName: link.platform_id,
            hasProfileImage: Boolean(link.profile_image_url),
            isOrgLink,
            organizationId: isOrgLink ? creator.organization_id : undefined,
            profileId: isOrgLink ? creator.server_id : undefined,
          });
        }
      }
    }

    const pumpfunPromises = pumpfunLinksToCheck.map(async ({ platformId, mintId }) => {
      liveStatusMap.value.set(platformId, {
        ...liveStatusMap.value.get(platformId),
        isLive: liveStatusMap.value.get(platformId)?.isLive ?? false,
        isChecking: true,
      });

      try {
        const status = await fetchLiveStatus(mintId);
        liveStatusMap.value.set(platformId, {
          isLive: status.isLive,
          viewerCount: status.numParticipants,
          isChecking: false,
        });
      } catch (error) {
        console.error('[CreatorProfiles] Failed to check PumpFun live status for', mintId, error);
        liveStatusMap.value.set(platformId, {
          ...liveStatusMap.value.get(platformId),
          isLive: false,
          isChecking: false,
        });
      }
    });

    const kickPromises = kickLinksToCheck.map(
      async ({ linkId, platformId, channelSlug, hasProfileImage, isOrgLink, organizationId, profileId }) => {
        liveStatusMap.value.set(platformId, {
          ...liveStatusMap.value.get(platformId),
          isLive: liveStatusMap.value.get(platformId)?.isLive ?? false,
          isChecking: true,
        });

        try {
          const status = await checkKickLivestream(channelSlug);
          liveStatusMap.value.set(platformId, {
            isLive: status.isLive,
            viewerCount: status.viewerCount,
            profileImageUrl: status.profileImageUrl,
            isChecking: false,
          });

          // Persist profile image if we got one and don't have one stored
          if (status.profileImageUrl && !hasProfileImage) {
            try {
              if (isOrgLink && organizationId && profileId) {
                // Update org platform link via server API
                const serverLinkId = parseInt(linkId.replace('org-link-', ''), 10);
                await updateOrgPlatformLink(organizationId, profileId, serverLinkId, {
                  profile_image_url: status.profileImageUrl,
                });
              } else {
                // Update local platform link
                await updatePlatformLink(linkId, { profile_image_url: status.profileImageUrl });
              }
              // Update local state
              for (const creator of creators.value) {
                const link = creator.platform_links.find((l) => l.id === linkId);
                if (link) {
                  link.profile_image_url = status.profileImageUrl;
                  break;
                }
              }
            } catch (updateError) {
              console.warn('[CreatorProfiles] Failed to persist Kick profile image:', updateError);
            }
          }
        } catch (error) {
          console.error('[CreatorProfiles] Failed to check Kick live status for', channelSlug, error);
          liveStatusMap.value.set(platformId, {
            ...liveStatusMap.value.get(platformId),
            isLive: false,
            isChecking: false,
          });
        }
      }
    );

    const twitchPromises = twitchLinksToCheck.map(
      async ({ linkId, platformId, channelName, hasProfileImage, isOrgLink, organizationId, profileId }) => {
        liveStatusMap.value.set(platformId, {
          ...liveStatusMap.value.get(platformId),
          isLive: liveStatusMap.value.get(platformId)?.isLive ?? false,
          isChecking: true,
        });

        try {
          const status = await checkTwitchLivestream(channelName);
          liveStatusMap.value.set(platformId, {
            isLive: status.isLive,
            viewerCount: status.viewerCount,
            profileImageUrl: status.profileImageUrl,
            isChecking: false,
          });

          // Persist profile image if we got one and don't have one stored
          if (status.profileImageUrl && !hasProfileImage) {
            try {
              if (isOrgLink && organizationId && profileId) {
                // Update org platform link via server API
                const serverLinkId = parseInt(linkId.replace('org-link-', ''), 10);
                await updateOrgPlatformLink(organizationId, profileId, serverLinkId, {
                  profile_image_url: status.profileImageUrl,
                });
              } else {
                // Update local platform link
                await updatePlatformLink(linkId, { profile_image_url: status.profileImageUrl });
              }
              // Update local state
              for (const creator of creators.value) {
                const link = creator.platform_links.find((l) => l.id === linkId);
                if (link) {
                  link.profile_image_url = status.profileImageUrl;
                  break;
                }
              }
            } catch (updateError) {
              console.warn('[CreatorProfiles] Failed to persist Twitch profile image:', updateError);
            }
          }
        } catch (error) {
          console.error('[CreatorProfiles] Failed to check Twitch live status for', channelName, error);
          liveStatusMap.value.set(platformId, {
            ...liveStatusMap.value.get(platformId),
            isLive: false,
            isChecking: false,
          });
        }
      }
    );

    await Promise.all([...pumpfunPromises, ...kickPromises, ...twitchPromises]);
  }

  async function loadCreators() {
    loading.value = true;
    try {
      const localProfiles = await getAllCreatorProfiles();
      console.log(
        '[CreatorProfiles] Loaded local profiles:',
        localProfiles.map((p) => ({
          name: p.name,
          links: p.platform_links.map((l) => ({
            platform: l.platform,
            hasImage: !!l.profile_image_url,
            url: l.profile_image_url,
          })),
        }))
      );

      const displayProfiles: DisplayCreatorProfile[] = localProfiles.map((p) => ({
        ...p,
        isOrgProfile: false,
      }));

      if (authStore.isAuthenticated) {
        const orgResponse = await getUserAssignedCreatorProfiles();
        if (orgResponse.success && orgResponse.profiles.length > 0) {
          const orgDisplayProfiles = convertOrgProfilesToDisplay(orgResponse.profiles);
          displayProfiles.push(...orgDisplayProfiles);
        }
      }

      creators.value = displayProfiles;
      await initializeAutoDvrTracker(displayProfiles);
    } catch (err) {
      console.error('Failed to load creators:', err);
      showError('Load Failed', 'Failed to load creator profiles');
    } finally {
      loading.value = false;
    }
  }

  async function initializeAutoDvrTracker(profiles: DisplayCreatorProfile[]) {
    const streamerIds: string[] = [];
    for (const profile of profiles) {
      for (const link of profile.platform_links) {
        if (link.monitored_streamer_id && !autoDvrTracker.value.has(link.monitored_streamer_id)) {
          streamerIds.push(link.monitored_streamer_id);
        }
      }
    }

    for (const streamerId of streamerIds) {
      try {
        const streamer = await getMonitoredStreamer(streamerId);
        if (streamer) {
          autoDvrTracker.value.set(streamerId, Boolean(streamer.auto_dvr));
        }
      } catch (err) {
        console.error(`[CreatorProfiles] Failed to fetch auto_dvr for ${streamerId}:`, err);
      }
    }
  }

  function convertOrgProfilesToDisplay(orgProfiles: ServerOrganizationCreatorProfile[]): DisplayCreatorProfile[] {
    return orgProfiles.map((profile) => ({
      id: `org-${profile.id}`,
      name: profile.name,
      description: profile.description,
      profile_image_path: profile.profile_image_url,
      intro_id: profile.intro_id ? `org-asset-${profile.intro_id}` : null,
      outro_id: profile.outro_id ? `org-asset-${profile.outro_id}` : null,
      watermark_id: profile.watermark_id ? `org-asset-${profile.watermark_id}` : null,
      watermark_settings: profile.watermark_settings ? JSON.stringify(profile.watermark_settings) : null,
      created_at: new Date(profile.inserted_at).getTime(),
      updated_at: new Date(profile.updated_at).getTime(),
      user_id: null,
      platform_links: profile.platform_links.map((link) => ({
        id: `org-link-${link.id}`,
        creator_profile_id: `org-${profile.id}`,
        platform: link.platform as PlatformId,
        platform_id: link.platform_id,
        display_name: link.display_name,
        profile_image_url: link.profile_image_url,
        is_primary: link.is_primary,
        created_at: new Date(link.inserted_at).getTime(),
        monitored_streamer_id: null,
      })),
      isOrgProfile: true,
      organization_id: profile.organization_id,
      organization_name: profile.organization_name,
      server_id: profile.id,
    }));
  }

  function getCreatorProfileImage(creator: DisplayCreatorProfile): string | undefined {
    if (creator.isOrgProfile && creator.profile_image_path) {
      return creator.profile_image_path;
    }

    const primaryLink = creator.platform_links.find((l) => l.is_primary) || creator.platform_links[0];
    if (primaryLink?.profile_image_url) {
      return primaryLink.profile_image_url;
    }

    for (const link of creator.platform_links) {
      if (link.profile_image_url) {
        return link.profile_image_url;
      }
    }

    for (const link of creator.platform_links) {
      const liveStatus = liveStatusMap.value.get(link.platform_id);
      if (liveStatus?.profileImageUrl) {
        return liveStatus.profileImageUrl;
      }
    }

    return undefined;
  }

  function handleImageError(event: Event, _creator: DisplayCreatorProfile) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  function getPlatformIcon(platform: PlatformId): string {
    const icons: Record<PlatformId, string> = {
      pumpfun: '/capsule.svg',
      kick: '/kick.svg',
      twitch: '/twitch.svg',
      youtube: '/youtube.svg',
    };
    return icons[platform] || '/capsule.svg';
  }

  function truncateId(id: string): string {
    if (!id || id.length < 8) return id;
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
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

  function hasPumpfunLink(creator: DisplayCreatorProfile): boolean {
    return creator.platform_links.some((l) => l.platform === 'pumpfun');
  }

  function hasKickLink(creator: DisplayCreatorProfile): boolean {
    return creator.platform_links.some((l) => l.platform === 'kick');
  }

  function hasTwitchLink(creator: DisplayCreatorProfile): boolean {
    return creator.platform_links.some((l) => l.platform === 'twitch');
  }

  function hasMonitorableLink(creator: DisplayCreatorProfile): boolean {
    return hasPumpfunLink(creator) || hasKickLink(creator) || hasTwitchLink(creator);
  }

  function isCreatorMonitored(creator: DisplayCreatorProfile): boolean {
    for (const link of creator.platform_links) {
      if (link.monitored_streamer_id && monitoredStreamers.value.has(link.monitored_streamer_id)) {
        return true;
      }
    }
    return false;
  }

  function isCreatorLive(creator: DisplayCreatorProfile): boolean {
    for (const link of creator.platform_links) {
      if (link.monitored_streamer_id) {
        const session = activeSessions.value.get(link.monitored_streamer_id);
        if (session && !session.isStopping) {
          return true;
        }
      }
      if (link.platform === 'pumpfun' || link.platform === 'kick' || link.platform === 'twitch') {
        const status = liveStatusMap.value.get(link.platform_id);
        if (status?.isLive) {
          return true;
        }
      }
    }
    return false;
  }

  function isCreatorCheckingLive(creator: DisplayCreatorProfile): boolean {
    for (const link of creator.platform_links) {
      if (link.platform === 'pumpfun' || link.platform === 'kick' || link.platform === 'twitch') {
        const status = liveStatusMap.value.get(link.platform_id);
        if (status?.isChecking) {
          return true;
        }
      }
    }
    return false;
  }

  function getCreatorViewerCount(creator: DisplayCreatorProfile): number | undefined {
    for (const link of creator.platform_links) {
      if (link.platform === 'pumpfun' || link.platform === 'kick' || link.platform === 'twitch') {
        const status = liveStatusMap.value.get(link.platform_id);
        if (status?.isLive && status.viewerCount) {
          return status.viewerCount;
        }
      }
    }
    return undefined;
  }

  function getCreatorStatusLabel(creator: DisplayCreatorProfile): string {
    for (const link of creator.platform_links) {
      if (link.monitored_streamer_id) {
        const session = activeSessions.value.get(link.monitored_streamer_id);
        const monitored = monitoredStreamers.value.get(link.monitored_streamer_id);
        if (monitored) {
          const isLive = session && !session.isStopping;
          const mode = monitored.options.detectClips ? 'AUTO' : 'REC';
          if (isLive) {
            return `LIVE (${mode})`;
          }
          return `WAITING (${mode})`;
        }
      }
    }
    return 'IDLE';
  }

  function openCreateDialog() {
    if (!authStore.isAuthenticated) {
      showAuthModal.value = true;
      return;
    }
    creatorToEdit.value = null;
    showProfileDialog.value = true;
  }

  function openEditDialog(creator: DisplayCreatorProfile) {
    creatorToEdit.value = creator;
    showProfileDialog.value = true;
  }

  function closeProfileDialog() {
    showProfileDialog.value = false;
    creatorToEdit.value = null;
  }

  function handleCreatorSaved() {
    closeProfileDialog();
    loadCreators();
  }

  function confirmDeleteCreator(creator: DisplayCreatorProfile) {
    creatorToDelete.value = creator;
    showDeleteDialog.value = true;
  }

  async function deleteCreatorConfirmed() {
    if (!creatorToDelete.value) return;

    try {
      await deleteCreatorProfile(creatorToDelete.value.id);
      success('Creator Deleted', `"${creatorToDelete.value.name}" has been removed`);
      await loadCreators();
    } catch (err) {
      console.error('Failed to delete creator:', err);
      showError('Delete Failed', 'Failed to delete creator profile');
    } finally {
      showDeleteDialog.value = false;
      creatorToDelete.value = null;
    }
  }

  function viewCreatorVods(creator: DisplayCreatorProfile) {
    const primaryLink = creator.platform_links.find((l) => l.is_primary) || creator.platform_links[0];
    if (!primaryLink) {
      showError('No Platform', 'This creator has no platform links configured');
      return;
    }

    router.push({
      path: '/vods',
      query: {
        platform: primaryLink.platform,
        search: primaryLink.platform_id,
      },
    });
  }

  function openDownloadDialog(creator: DisplayCreatorProfile) {
    creatorToDownload.value = creator;
    showDownloadDialog.value = true;
  }

  function openPostSubmitDialog(creator: DisplayCreatorProfile) {
    creatorForPostSubmit.value = creator;
    showPostSubmitDialog.value = true;
  }

  function handlePostSubmitted() {
    showPostSubmitDialog.value = false;
    creatorForPostSubmit.value = null;
    success('Post Submitted', 'Your post link has been submitted for review.');
  }

  async function startCreatorMonitoring(creator: DisplayCreatorProfile, detectClips: boolean) {
    const monitorableLink = creator.platform_links.find(
      (l) => l.platform === 'pumpfun' || l.platform === 'kick' || l.platform === 'twitch'
    );
    if (!monitorableLink) {
      showError('No Supported Platforms', 'Live monitoring is currently only available for PumpFun, Kick, and Twitch streams');
      return;
    }
    if (!monitorableLink.platform_id) {
      showError('Missing Platform ID', 'Add the platform ID on this creator before starting monitoring.');
      return;
    }

    const platformDisplay =
      monitorableLink.platform === 'kick' ? 'Kick' : monitorableLink.platform === 'twitch' ? 'Twitch' : 'PumpFun';

    try {
      let streamerId = monitorableLink.monitored_streamer_id;

      if (!streamerId) {
        const existingByMint = await getMonitoredStreamerByMint(monitorableLink.platform_id);
        if (existingByMint) {
          const { updatePlatformLink } = await import('@/services/database');
          streamerId = existingByMint.id;
          await updatePlatformLink(monitorableLink.id, { monitored_streamer_id: streamerId });
          monitorableLink.monitored_streamer_id = streamerId;
        }
      }

      if (!streamerId) {
        const { createMonitoredStreamer, updatePlatformLink } = await import('@/services/database');
        streamerId = await createMonitoredStreamer(
          monitorableLink.platform_id,
          monitorableLink.display_name || creator.name,
          monitorableLink.profile_image_url || undefined,
          5,
          false,
          monitorableLink.platform
        );
        await updatePlatformLink(monitorableLink.id, { monitored_streamer_id: streamerId });
        monitorableLink.monitored_streamer_id = streamerId;
      }

      const streamer = await getMonitoredStreamer(streamerId);

      if (streamer) {
        await startMonitoring(
          [
            {
              id: streamer.id,
              mintId: streamer.mint_id,
              displayName: streamer.display_name,
              platform: platformDisplay,
              lastCheckTimestamp: streamer.last_check_timestamp,
              isCurrentlyLive: Boolean(streamer.is_currently_live),
              currentSessionId: streamer.current_session_id,
              selected: false,
              isDetecting: false,
              profileImageUrl: streamer.profile_image_url || undefined,
              streamThumbnailUrl: streamer.stream_thumbnail_url || undefined,
              segmentDurationMinutes: streamer.segment_duration_minutes ?? 5,
              autoDvr: Boolean(streamer.auto_dvr),
            },
          ],
          { detectClips }
        );
      }

      const mode = detectClips ? 'Auto Detect' : 'Record Only';
      success('Monitoring Started', `Now monitoring "${creator.name}" (${mode})`);
    } catch (err) {
      console.error('Failed to start monitoring:', err);
      const message = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to start monitoring';
      showError('Monitoring Failed', message);
    }
  }

  async function stopCreatorMonitoring(creator: DisplayCreatorProfile) {
    try {
      const streamerIds: string[] = [];

      for (const link of creator.platform_links) {
        if (link.monitored_streamer_id && monitoredStreamers.value.has(link.monitored_streamer_id)) {
          streamerIds.push(link.monitored_streamer_id);
        }
      }

      if (streamerIds.length > 0) {
        await stopMonitoring(streamerIds);
        success('Monitoring Stopped', `Stopped monitoring "${creator.name}"`);
      }
    } catch (err) {
      console.error('Failed to stop monitoring:', err);
      showError('Stop Failed', 'Failed to stop monitoring');
    }
  }
</script>

<style scoped>
  /* ===== Page Container ===== */
  .creators {
    width: 100%;
    min-height: 100%;
  }

  /* ===== Content Wrapper ===== */
  .creators__wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .creators__wrapper--empty {
    justify-content: center;
    align-items: center;
  }

  .creators__content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  /* ===== Empty State ===== */
  .creators__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .creators__empty-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: var(--sidebar-hover);
    border-radius: 16px;
    margin-bottom: 1.5rem;
  }

  .creators__empty-icon {
    width: 36px;
    height: 36px;
    color: var(--sidebar-text-muted);
  }

  .creators__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .creators__empty-description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 300px;
  }

  /* ===== Page Heading ===== */
  .creators__heading {
    margin-bottom: 0.5rem;
  }

  .creators__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.02em;
  }

  .creators__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Actions Bar ===== */
  .creators-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .creators-search {
    position: relative;
    width: 200px;
  }

  .creators-search__icon {
    position: absolute;
    left: 0.625rem;
    top: 50%;
    transform: translateY(-50%);
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    pointer-events: none;
  }

  .creators-search__input {
    width: 100%;
    height: 32px;
    padding-left: 2rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.75rem;
    color: var(--sidebar-text);
  }

  .creators-search__input:focus {
    border-color: var(--sidebar-accent);
    outline: none;
  }

  .creators-add-btn {
    height: 32px;
    padding: 0 0.75rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    transition: all 150ms ease;
  }

  .creators-add-btn:hover {
    opacity: 0.9;
  }

  .creators-add-btn__icon {
    width: 14px;
    height: 14px;
    margin-right: 0.25rem;
  }

  /* ===== Stats Summary ===== */
  .creators__stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  @media (max-width: 768px) {
    .creators__stats {
      grid-template-columns: 1fr;
    }
  }

  .creators-stat {
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .creators-stat:hover {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .creators-stat__indicator {
    width: 4px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .creators-stat__indicator--live {
    background-color: #ef4444;
  }

  .creators-stat__indicator--monitoring {
    background-color: #10b981;
  }

  .creators-stat__inner {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem 1.25rem;
  }

  .creators-stat__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .creators-stat__icon svg {
    width: 20px;
    height: 20px;
  }

  .creators-stat__icon--live {
    background-color: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .creators-stat__icon--monitoring {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .creators-stat__info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .creators-stat__label {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .creators-stat__value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .creators-stat__value--live {
    color: #ef4444;
  }

  .creators-stat__value--monitoring {
    color: #10b981;
  }

  .creators-stat__loading {
    display: inline-block;
    width: 32px;
    height: 24px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  /* ===== Item Count ===== */
  .creators__item-count {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    font-weight: 500;
  }

  /* ===== Creator List ===== */
  .creators__list {
    margin-top: 1rem;
  }

  .creators__list-inner {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* ===== Creator Card ===== */
  .creator-card {
    display: flex;
    background-color: var(--sidebar-surface);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .creator-card:hover {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .creator-card__inner {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  /* Card Header */
  .creator-card__header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.25rem;
  }

  .creator-card__avatar-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .creator-card__avatar {
    width: 52px;
    height: 52px;
    border-radius: 10px;
    overflow: hidden;
    background-color: var(--sidebar-hover);
  }

  .creator-card__avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .creator-card__avatar-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--sidebar-hover) 0%, var(--sidebar-surface) 100%);
  }

  .creator-card__avatar-icon {
    width: 24px;
    height: 24px;
    color: var(--sidebar-text-muted);
    opacity: 0.5;
  }

  .creator-card__status-dot {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid var(--sidebar-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--sidebar-border);
  }

  .creator-card__status-dot--monitoring {
    background-color: #10b981;
  }

  .creator-card__status-dot--live {
    background-color: #ef4444;
  }

  .creator-card__status-dot-inner {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.8);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .creator-card__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .creator-card__name-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
  }

  .creator-card__name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .creator-card__org-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    background-color: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
    font-size: 0.6875rem;
    font-weight: 600;
    border-radius: 5px;
  }

  .creator-card__org-badge-icon {
    width: 12px;
    height: 12px;
  }

  .creator-card__description {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .creator-card__platforms {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .creator-card__platform {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    background-color: var(--sidebar-hover);
    border-radius: 6px;
    font-size: 0.75rem;
  }

  .creator-card__platform-icon {
    width: 14px;
    height: 14px;
    opacity: 0.7;
    filter: brightness(0) invert(1);
  }

  .creator-card__platform-name {
    color: var(--sidebar-text-muted);
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .creator-card__assets {
    display: flex;
    gap: 0.375rem;
    flex-shrink: 0;
    margin-left: auto;
  }

  .creator-card__asset {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
  }

  .creator-card__asset--intro {
    background-color: rgba(59, 130, 246, 0.15);
  }

  .creator-card__asset--intro .creator-card__asset-icon {
    color: #60a5fa;
  }

  .creator-card__asset--outro {
    background-color: rgba(139, 92, 246, 0.15);
  }

  .creator-card__asset--outro .creator-card__asset-icon {
    color: #a78bfa;
  }

  .creator-card__asset--watermark {
    background-color: rgba(245, 158, 11, 0.15);
  }

  .creator-card__asset--watermark .creator-card__asset-icon {
    color: #fbbf24;
  }

  .creator-card__asset-icon {
    width: 14px;
    height: 14px;
  }

  /* Card Footer */
  .creator-card__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.875rem 1.25rem;
    background-color: rgba(0, 0, 0, 0.15);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .creator-card__status {
    display: flex;
    align-items: center;
  }

  .creator-card__platform-count {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  /* Status Badges */
  .creator-status {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .creator-status__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  .creator-status__spinner {
    width: 12px;
    height: 12px;
    animation: spin 0.8s linear infinite;
  }

  .creator-status--monitoring {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .creator-status--monitoring .creator-status__dot {
    background-color: #34d399;
  }

  .creator-status--live {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .creator-status--live .creator-status__dot {
    background-color: #f87171;
  }

  .creator-status__viewers {
    color: rgba(248, 113, 113, 0.7);
    font-weight: 500;
    margin-left: 0.25rem;
  }

  .creator-status--offline {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
  }

  .creator-status--offline .creator-status__dot {
    background-color: var(--sidebar-text-muted);
    opacity: 0.5;
    animation: none;
  }

  .creator-status--checking {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
  }

  /* Actions */
  .creator-card__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Segmented Button Group */
  .creator-action-group {
    display: flex;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .creator-action-group__btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    background-color: rgba(255, 255, 255, 0.04);
    color: var(--sidebar-text-muted);
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .creator-action-group__btn:first-child {
    border-right: 1px solid rgba(255, 255, 255, 0.08);
  }

  .creator-action-group__btn:hover {
    background-color: rgba(255, 255, 255, 0.08);
    color: var(--sidebar-text);
  }

  .creator-action-group__btn--primary {
    background-color: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
  }

  .creator-action-group__btn--primary:hover {
    background-color: rgba(139, 92, 246, 0.25);
    color: #c4b5fd;
  }

  .creator-action-group__rec-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #ef4444;
  }

  /* Individual Buttons */
  .creator-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .creator-btn__icon {
    width: 13px;
    height: 13px;
  }

  .creator-btn--stop {
    background-color: rgba(239, 68, 68, 0.12);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.2);
  }

  .creator-btn--stop:hover {
    background-color: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .creator-btn--watch {
    background-color: rgba(239, 68, 68, 0.12);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.2);
  }

  .creator-btn--watch:hover:not(:disabled) {
    background-color: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .creator-btn--watch-disabled {
    background-color: rgba(255, 255, 255, 0.04);
    color: var(--sidebar-text-muted);
    border-color: rgba(255, 255, 255, 0.08);
    cursor: not-allowed;
    opacity: 0.5;
  }

  .creator-btn--more {
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.04);
    color: var(--sidebar-text-muted);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
  }

  .creator-btn--more:hover {
    background-color: rgba(255, 255, 255, 0.08);
    color: var(--sidebar-text);
  }

  /* ===== No Results ===== */
  .creators__no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
  }

  .creators__no-results-icon {
    width: 48px;
    height: 48px;
    color: var(--sidebar-text-muted);
    opacity: 0.5;
    margin-bottom: 1rem;
  }

  .creators__no-results-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
  }

  .creators__no-results-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* ===== Loading Skeleton ===== */
  .creators__loading {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .creator-skeleton {
    display: flex;
    background-color: var(--sidebar-surface);
    border-radius: 10px;
    overflow: hidden;
  }

  .creator-skeleton__inner {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .creator-skeleton__header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.25rem;
  }

  .creator-skeleton__avatar {
    width: 52px;
    height: 52px;
    border-radius: 10px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .creator-skeleton__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .creator-skeleton__line {
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .creator-skeleton__line--name {
    height: 16px;
    width: 140px;
  }

  .creator-skeleton__line--desc {
    height: 14px;
    width: 220px;
  }

  .creator-skeleton__badges {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .creator-skeleton__badge {
    height: 26px;
    width: 80px;
    border-radius: 6px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .creator-skeleton__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1.25rem;
    background-color: rgba(0, 0, 0, 0.15);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .creator-skeleton__status {
    height: 28px;
    width: 80px;
    border-radius: 6px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .creator-skeleton__actions {
    display: flex;
    gap: 0.5rem;
  }

  .creator-skeleton__btn {
    height: 36px;
    width: 70px;
    border-radius: 6px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  /* ===== Animations ===== */
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* List Transitions */
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
    width: calc(100% - 2.5rem);
    z-index: 0;
  }
</style>

<!-- Global styles for dropdown (rendered via portal outside component scope) -->
<style>
  /* Prevent button animation when dropdown opens */
  .creator-btn--more {
    transform: none !important;
    animation: none !important;
  }

  .creator-btn--more[data-state='open'] {
    transform: none !important;
  }

  .creator-dropdown {
    min-width: 180px !important;
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    z-index: 100 !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    /* Disable all slide/zoom animations, only fade */
    animation: creatorDropdownFade 100ms ease-out !important;
    --tw-enter-translate-x: 0 !important;
    --tw-enter-translate-y: 0 !important;
    --tw-enter-scale: 1 !important;
  }

  @keyframes creatorDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .creator-dropdown__item {
    display: flex !important;
    align-items: center !important;
    gap: 0.625rem !important;
    padding: 0.625rem 0.75rem !important;
    border-radius: 5px !important;
    font-size: 0.8125rem !important;
    color: var(--sidebar-text) !important;
    cursor: pointer !important;
  }

  .creator-dropdown__item:hover,
  .creator-dropdown__item:focus,
  .creator-dropdown__item[data-highlighted] {
    background-color: var(--sidebar-hover) !important;
    outline: none !important;
  }

  .creator-dropdown__item-icon {
    width: 15px;
    height: 15px;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .creator-dropdown__item-badge {
    margin-left: auto;
    padding: 0.1875rem 0.375rem;
    font-size: 0.5625rem;
    font-weight: 700;
    border-radius: 4px;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
  }

  .creator-dropdown__item-badge--active {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .creator-dropdown__item--danger {
    color: #f87171 !important;
  }

  .creator-dropdown__item--danger:hover,
  .creator-dropdown__item--danger:focus,
  .creator-dropdown__item--danger[data-highlighted] {
    background-color: rgba(248, 113, 113, 0.1) !important;
    color: #f87171 !important;
  }

  .creator-dropdown__item--danger .creator-dropdown__item-icon {
    color: #f87171;
  }

  .creator-dropdown__separator {
    height: 1px !important;
    margin: 0.25rem 0 !important;
    background-color: var(--sidebar-border) !important;
  }
</style>
