<template>
  <div class="creators">
    <CreatorProfilesView :model="viewModel" />

    <!-- Creator Profile Dialog -->
    <ProfileDialog
      :show="showProfileDialog"
      mode="local"
      :creator="creatorToEdit"
      :scope="profileDialogScope"
      @close="closeProfileDialog"
      @saved="handleCreatorSaved"
    />

    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteDialog"
      title="Delete creator"
      message="Are you sure you want to delete"
      :item-name="creatorToDelete?.name"
      suffix="? This will remove all platform links but not the associated VODs or clips."
      confirm-text="Delete"
      variant="destructive"
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

    <!-- Personal Post Dialog (for non-org creators) -->
    <AddPostDialog v-model="showPersonalPostDialog" @submitted="handlePersonalPostSubmitted" />

    <!-- External Post Submit Dialog -->
    <ExternalPostSubmitDialog
      :open="showPostSubmitDialog"
      :organization-id="creatorForPostSubmit?.organization_id || 0"
      :creator-profiles="
        creatorForPostSubmit ? [{ id: creatorForPostSubmit.server_id!, name: creatorForPostSubmit.name }] : []
      "
      :campaigns="[]"
      :preselected-creator-profile-id="creatorForPostSubmit?.server_id"
      @close="showPostSubmitDialog = false"
      @submitted="handlePostSubmitted"
    />

    <RealtimeDetectionDialog
      :model-value="showRealtimeDialog"
      :prompts="prompts"
      :creator-layout-eligible="creatorLayoutEligible"
      :creator-layout-creator-name="creatorLayoutCreatorName"
      :show-sixty-minute-cap="true"
      @update:model-value="
        (open) => {
          showRealtimeDialog = open;
          if (!open) closeRealtimeDialog();
        }
      "
      @confirm="handleRealtimeDetectionConfirm"
    />

    <AutoDetectLimitDialog
      :show="showAutoDetectLimitDialog"
      :active-streamer-name="autoDetectLimitDialogData.activeStreamerName"
      :requested-streamer-name="autoDetectLimitDialogData.requestedStreamerName"
      @close="showAutoDetectLimitDialog = false"
    />

    <!-- Record-when-live settings -->
    <Modal
      :open="showSegmentDialog"
      title="Record when live"
      description="Automatically record when this creator goes live."
      :icon="Video"
      size="sm"
      @close="closeSegmentDialog"
    >
      <div class="flex flex-col gap-4">
        <Field label="Segment duration">
          <SegmentedControl v-model="selectedDuration" :options="durationOptions" block />
        </Field>
        <Field
          v-if="creatorLayoutEligible"
          label="Use creator layout"
          hint="Apply this creator's saved framing and subtitle defaults."
          inline
        >
          <Switch v-model="recordUseCreatorLayout" />
        </Field>
      </div>
      <template #footer>
        <Button variant="ghost" @click="closeSegmentDialog">Cancel</Button>
        <Button variant="primary" @click="handleRecordDialogConfirm">Enable record</Button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed, reactive } from 'vue';
  import { useRouter } from 'vue-router';
  import PageLayout from '@/components/PageLayout.vue';
  import AssignedCampaignCard from '@/components/creators/AssignedCampaignCard.vue';
  import CreatorProfilesView from '@/components/CreatorProfilesView.vue';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Modal } from '@/components/ui/modal';
  import { SearchField } from '@/components/ui/search-field';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import { Switch } from '@/components/ui/switch';
  import { getPlatformIcon, getPlatformFilter } from '@/lib/creatorProfilePresentation';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import ProfileDialog from '@/components/ProfileDialog.vue';
  import RealtimeDetectionDialog from '@/components/RealtimeDetectionDialog.vue';
  import AutoDetectLimitDialog from '@/components/AutoDetectLimitDialog.vue';
  import CreatorDownloadDialog from '@/components/CreatorDownloadDialog.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import AddPostDialog from '@/components/AddPostDialog.vue';
  import ExternalPostSubmitDialog from '@/components/organization/ExternalPostSubmitDialog.vue';
  import {
    getAllCreatorProfiles,
    deleteCreatorProfile,
    toggleLocalProfileDisabled,
    getMonitoredStreamer,
    getMonitoredStreamerByMint,
    updateMonitoredStreamer,
    createMonitoredStreamer,
    updatePlatformLink,
    getAllGlobalProfiles,
    getAllStreamerProfiles,
    type CreatorProfileWithLinks,
  } from '@/services/database';
  import {
    getUserAssignedCreatorProfiles,
    updatePlatformLink as updateOrgPlatformLink,
    toggleCreatorProfileDisabled,
    type ServerOrganizationCreatorProfile,
  } from '@/services/organizationProfilesApi';
  import { listMyCampaigns, type Campaign, type CampaignCreatorProfile } from '@/services/campaignApi';
  import { useProfileContext } from '@/composables/useProfileContext';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';
  import { syncPersonalBranding } from '@/services/personalBrandingSync';
  import { useSubscriptionGate } from '@/composables/useSubscriptionGate';
  import { useAppTour } from '@/composables/useAppTour';
  import { useLivestreamMonitoring, fetchLiveStatus } from '@/composables/useLivestreamMonitoring';
  import { useCreatorPageLiveMonitoring } from '@/composables/useCreatorPageLiveMonitoring';
  import { checkKickLivestream } from '@/services/kick';
  import { checkTwitchLivestream } from '@/services/twitch';
  import { getYouTubeChannelInfo } from '@/services/youtube';
  import { getRumbleChannelInfo } from '@/services/rumble';
  import { type PlatformId } from '@/config/platforms';
  import { Activity, Building2, Cloud, Paintbrush, Plus, Search, Trophy, Users, Video } from 'lucide-vue-next';
  import { useFeatureFlags } from '@/composables/useFeatureFlags';
  import { useLivestreamStore } from '@/stores/livestream';

  import {
    convertCampaignsToGroupedDisplay,
    type DisplayCreatorProfile,
    type DisplayCampaign,
  } from '@/lib/creatorCampaignPresentation';

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
  const { maybeStartPageTour } = useAppTour();
  const { success, error: showError } = useToast();
  const { showGate, requireSubscription } = useSubscriptionGate();
  const { activeSessions, monitoredStreamers, stopMonitoring, hasDvrRecording } = useLivestreamMonitoring();
  const {
    showRealtimeDialog,
    showSegmentDialog,
    showAutoDetectLimitDialog,
    autoDetectLimitDialogData,
    prompts,
    creatorLayoutEligible,
    creatorLayoutCreatorName,
    selectedDuration,
    recordUseCreatorLayout,
    availableDurationsRecord,
    isCreatorPersistentAutoDetect,
    isCreatorPersistentRecord,
    loadPersistentSettingsForProfiles,
    onCreatorAutoDetectClick,
    onCreatorRecordClick,
    handleRealtimeDetectionConfirm,
    handleRecordDialogConfirm,
    closeRealtimeDialog,
    closeSegmentDialog,
  } = useCreatorPageLiveMonitoring();
  const { isLiveClipEnabled } = useFeatureFlags();
  const livestreamStore = useLivestreamStore();

  // State
  const loading = ref(true);
  const creators = ref<DisplayCreatorProfile[]>([]);
  const campaigns = ref<DisplayCampaign[]>([]);
  const expandedCampaigns = ref<Set<number>>(new Set());
  const searchQuery = ref('');
  const syncingPersonal = ref(false);
  const showProfileDialog = ref(false);
  const creatorToEdit = ref<DisplayCreatorProfile | null>(null);
  const showDeleteDialog = ref(false);
  const creatorToDelete = ref<DisplayCreatorProfile | null>(null);
  const showDownloadDialog = ref(false);
  const creatorToDownload = ref<DisplayCreatorProfile | null>(null);
  const showAuthModal = ref(false);
  const showPostSubmitDialog = ref(false);
  const creatorForPostSubmit = ref<DisplayCreatorProfile | null>(null);
  const showPersonalPostDialog = ref(false);
  const personalPostCreator = ref<DisplayCreatorProfile | null>(null);

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

  // Filtered creators based on active tab scope and search
  const filteredCreators = computed(() => {
    // First filter by scope (activeTab)
    let result = creators.value.filter((creator) => {
      if (activeTab.value === 'streamer') {
        const scope = creator.scope || 'streamer';
        return scope === 'streamer' || scope === 'personal_studio';
      }
      return (creator.scope || 'streamer') === activeTab.value;
    });

    // Then filter by search query
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase();
      result = result.filter((creator) => {
        if (creator.name.toLowerCase().includes(query)) return true;
        return creator.platform_links.some(
          (link) => link.display_name?.toLowerCase().includes(query) || link.platform_id.toLowerCase().includes(query)
        );
      });
    }

    return result;
  });

  // Sorted creators: alphabetically A-Z by name
  const sortedCreators = computed(() => {
    return [...filteredCreators.value].sort((a, b) => {
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  });

  // Profile type filters
  const organizationProfiles = computed(() => {
    return sortedCreators.value.filter((c) => c.isOrgProfile && !c.campaign_id);
  });

  const userProfiles = computed(() => {
    return sortedCreators.value.filter((c) => !c.isOrgProfile && !c.campaign_id);
  });

  async function syncPersonalToCloud() {
    if (syncingPersonal.value) return;
    syncingPersonal.value = true;
    try {
      const result = await syncPersonalBranding();
      success(
        `Personal branding synced — ${result.upsertedProfiles} profiles, ${result.uploadedAssets} uploaded, ${result.downloadedAssets} downloaded`
      );
      await loadCreators();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Personal branding sync failed');
    } finally {
      syncingPersonal.value = false;
    }
  }

  // Load creators on mount
  onMounted(async () => {
    await loadCreators();
    checkAllLiveStatuses(true); // Include Kick on initial load
    liveStatusInterval.value = window.setInterval(() => {
      checkAllLiveStatuses(false); // Skip Kick on interval to save API requests
    }, 60_000);
    maybeStartPageTour('page_creators');
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
    const youtubeLinksToCheck: {
      linkId: string;
      platformId: string;
      channelId: string;
      hasProfileImage: boolean;
      isOrgLink: boolean;
      organizationId?: number;
      profileId?: number;
    }[] = [];
    const rumbleLinksToCheck: {
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
            organizationId: isOrgLink ? (creator.organization_id ?? undefined) : undefined,
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
            organizationId: isOrgLink ? (creator.organization_id ?? undefined) : undefined,
            profileId: isOrgLink ? creator.server_id : undefined,
          });
        } else if (link.platform === 'YouTube') {
          const isOrgLink = link.id.startsWith('org-link-');
          youtubeLinksToCheck.push({
            linkId: link.id,
            platformId: link.platform_id,
            channelId: link.platform_id,
            hasProfileImage: Boolean(link.profile_image_url),
            isOrgLink,
            organizationId: isOrgLink ? (creator.organization_id ?? undefined) : undefined,
            profileId: isOrgLink ? creator.server_id : undefined,
          });
        } else if (link.platform === 'rumble') {
          const isOrgLink = link.id.startsWith('org-link-');
          rumbleLinksToCheck.push({
            linkId: link.id,
            platformId: link.platform_id,
            channelName: link.platform_id,
            hasProfileImage: Boolean(link.profile_image_url),
            isOrgLink,
            organizationId: isOrgLink ? (creator.organization_id ?? undefined) : undefined,
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
        const previousStatus = liveStatusMap.value.get(platformId);
        const wasLive = previousStatus?.isLive ?? false;

        const status = await fetchLiveStatus(mintId);
        liveStatusMap.value.set(platformId, {
          isLive: status.isLive,
          viewerCount: status.numParticipants,
          isChecking: false,
        });

        // Note: Toast notifications are handled by global polling system to avoid duplicates
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
          const previousStatus = liveStatusMap.value.get(platformId);
          const wasLive = previousStatus?.isLive ?? false;

          const status = await checkKickLivestream(channelSlug);
          liveStatusMap.value.set(platformId, {
            isLive: status.isLive,
            viewerCount: status.viewerCount,
            profileImageUrl: status.profileImageUrl,
            isChecking: false,
          });

          // Note: Toast notifications are handled by global polling system to avoid duplicates

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
          const previousStatus = liveStatusMap.value.get(platformId);
          const wasLive = previousStatus?.isLive ?? false;

          const status = await checkTwitchLivestream(channelName);
          liveStatusMap.value.set(platformId, {
            isLive: status.isLive,
            viewerCount: status.viewerCount,
            profileImageUrl: status.profileImageUrl,
            isChecking: false,
          });

          // Note: Toast notifications are handled by global polling system to avoid duplicates

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

    const youtubePromises = youtubeLinksToCheck.map(
      async ({ linkId, platformId, channelId, hasProfileImage, isOrgLink, organizationId, profileId }) => {
        // Only fetch profile image if we don't have one
        if (hasProfileImage) return;

        try {
          const channelInfo = await getYouTubeChannelInfo(channelId);
          if (channelInfo?.profileImageUrl) {
            try {
              if (isOrgLink && organizationId && profileId) {
                const serverLinkId = parseInt(linkId.replace('org-link-', ''), 10);
                await updateOrgPlatformLink(organizationId, profileId, serverLinkId, {
                  profile_image_url: channelInfo.profileImageUrl,
                });
              } else {
                await updatePlatformLink(linkId, { profile_image_url: channelInfo.profileImageUrl });
              }
              // Update local state
              for (const creator of creators.value) {
                const link = creator.platform_links.find((l) => l.id === linkId);
                if (link) {
                  link.profile_image_url = channelInfo.profileImageUrl;
                  break;
                }
              }
            } catch (updateError) {
              console.warn('[CreatorProfiles] Failed to persist YouTube profile image:', updateError);
            }
          }
        } catch (error) {
          console.error('[CreatorProfiles] Failed to fetch YouTube channel info for', channelId, error);
        }
      }
    );

    const rumblePromises = rumbleLinksToCheck.map(
      async ({ linkId, platformId, channelName, hasProfileImage, isOrgLink, organizationId, profileId }) => {
        // Only fetch profile image if we don't have one
        if (hasProfileImage) return;

        try {
          const channelInfo = await getRumbleChannelInfo(channelName);
          if (channelInfo?.profileImageUrl) {
            try {
              if (isOrgLink && organizationId && profileId) {
                const serverLinkId = parseInt(linkId.replace('org-link-', ''), 10);
                await updateOrgPlatformLink(organizationId, profileId, serverLinkId, {
                  profile_image_url: channelInfo.profileImageUrl,
                });
              } else {
                await updatePlatformLink(linkId, { profile_image_url: channelInfo.profileImageUrl });
              }
              // Update local state
              for (const creator of creators.value) {
                const link = creator.platform_links.find((l) => l.id === linkId);
                if (link) {
                  link.profile_image_url = channelInfo.profileImageUrl;
                  break;
                }
              }
            } catch (updateError) {
              console.warn('[CreatorProfiles] Failed to persist Rumble profile image:', updateError);
            }
          }
        } catch (error) {
          console.error('[CreatorProfiles] Failed to fetch Rumble channel info for', channelName, error);
        }
      }
    );

    await Promise.all([...pumpfunPromises, ...kickPromises, ...twitchPromises, ...youtubePromises, ...rumblePromises]);
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
        disabled: p.disabled ? true : false,
        isOrgProfile: false,
      }));

      if (authStore.isAuthenticated) {
        const orgResponse = await getUserAssignedCreatorProfiles();
        if (orgResponse.success && orgResponse.profiles.length > 0) {
          const orgDisplayProfiles = convertOrgProfilesToDisplay(orgResponse.profiles);
          displayProfiles.push(...orgDisplayProfiles);
        }

        // Fetch campaign profiles
        try {
          const campaignsResponse = await listMyCampaigns();
          if (campaignsResponse.success && campaignsResponse.campaigns.length > 0) {
            campaigns.value = convertCampaignsToGroupedDisplay(campaignsResponse.campaigns);
          }
        } catch (err) {
          console.warn('[CreatorProfiles] Failed to load campaign profiles:', err);
        }
      }

      await linkMonitoredStreamersForOrgProfiles(displayProfiles);
      creators.value = displayProfiles;
      await initializeAutoDvrTracker(displayProfiles);
      await loadPersistentSettingsForProfiles(displayProfiles);
    } catch (err) {
      console.error('Failed to load creators:', err);
      showError('Load Failed', 'Failed to load creator profiles');
    } finally {
      loading.value = false;
    }
  }

  /** Org profile platform links are not in local SQLite — re-attach monitored_streamer by mint. */
  async function linkMonitoredStreamersForOrgProfiles(profiles: DisplayCreatorProfile[]) {
    for (const profile of profiles) {
      if (!profile.isOrgProfile) continue;
      for (const link of profile.platform_links) {
        if (link.monitored_streamer_id || !link.platform_id) continue;
        if (link.platform !== 'pumpfun' && link.platform !== 'kick' && link.platform !== 'twitch') {
          continue;
        }
        try {
          const existing = await getMonitoredStreamerByMint(link.platform_id);
          if (existing) {
            link.monitored_streamer_id = existing.id;
          }
        } catch (err) {
          console.warn('[CreatorProfiles] Failed to link org monitored streamer:', err);
        }
      }
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
      description: profile.description ?? null,
      profile_image_path: profile.profile_image_url ?? null,
      intro_id: profile.intro_id ? `org-asset-${profile.intro_id}` : null,
      outro_id: profile.outro_id ? `org-asset-${profile.outro_id}` : null,
      watermark_id: profile.watermark_id ? `org-asset-${profile.watermark_id}` : null,
      watermark_settings: profile.watermark_settings ? JSON.stringify(profile.watermark_settings) : null,
      layout_overlays: profile.layout_overlays ? JSON.stringify(profile.layout_overlays) : null,
      intro_outro_settings: (profile as any).intro_outro_settings
        ? JSON.stringify((profile as any).intro_outro_settings)
        : null,
      intro_ratio_settings: (profile as any).intro_ratio_settings
        ? JSON.stringify((profile as any).intro_ratio_settings)
        : null,
      outro_ratio_settings: (profile as any).outro_ratio_settings
        ? JSON.stringify((profile as any).outro_ratio_settings)
        : null,
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
      scope: ((profile as any).scope as 'streamer' | 'global') || 'streamer',
      isOrgProfile: true,
      organization_id: profile.organization_id,
      organization_name: profile.organization_name,
      server_id: profile.id,
      context_type: 'organization',
    }));
  }

  function toggleCampaignExpansion(campaignId: number) {
    if (expandedCampaigns.value.has(campaignId)) {
      expandedCampaigns.value.delete(campaignId);
    } else {
      expandedCampaigns.value.add(campaignId);
    }
  }

  function isCampaignExpanded(campaignId: number): boolean {
    return expandedCampaigns.value.has(campaignId);
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
          const mode = monitored.options.mode === 'realtime-detect' ? 'AUTO' : 'REC';
          if (isLive) {
            return `LIVE (${mode})`;
          }
          return `WAITING (${mode})`;
        }
      }
    }
    return 'IDLE';
  }

  const activeTab = ref<'streamer' | 'global'>('streamer');

  const durationOptions = computed<SegmentedOption<number>[]>(() =>
    availableDurationsRecord.map((duration) => ({
      value: duration,
      label: duration === 0 ? 'Entire' : `${duration} min`,
    }))
  );

  /** Organization-managed profiles first, then the user's own profiles. */

  const profileDialogScope = ref<'streamer' | 'global'>('streamer');

  async function openCreateDialog() {
    if (!authStore.isAuthenticated) {
      showAuthModal.value = true;
      return;
    }

    const context = activeTab.value === 'global' ? 'Add Global Profile' : 'Add Creator';
    const hasAccess = await requireSubscription({ context, type: 'general' });
    if (!hasAccess) return;

    creatorToEdit.value = null;
    profileDialogScope.value = activeTab.value;
    showProfileDialog.value = true;
  }

  function openCreateGlobalDialog() {
    if (!authStore.isAuthenticated) {
      showAuthModal.value = true;
      return;
    }
    creatorToEdit.value = null;
    profileDialogScope.value = 'global';
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

  async function toggleProfileDisabled(creator: DisplayCreatorProfile) {
    try {
      if (!creator.isOrgProfile) {
        // User-created local profile — toggle via SQLite
        const nowDisabled = await toggleLocalProfileDisabled(creator.id);
        const action = nowDisabled ? 'disabled' : 'enabled';
        success('Profile Updated', `"${creator.name}" has been ${action}`);
        await loadCreators();
      } else if (creator.organization_id && creator.server_id) {
        // Org-assigned profile — toggle via server API
        const response = await toggleCreatorProfileDisabled(creator.organization_id, creator.server_id);
        if (response.success && response.profile) {
          const action = response.profile.disabled ? 'disabled' : 'enabled';
          success('Profile Updated', `"${creator.name}" has been ${action}`);
          await loadCreators();
        } else {
          showError('Toggle Failed', response.error || 'Failed to toggle profile');
        }
      } else {
        showError('Toggle Failed', 'This profile cannot be toggled');
      }
    } catch (err) {
      console.error('Failed to toggle profile:', err);
      showError('Toggle Failed', 'Failed to toggle profile disabled state');
    }
  }

  function viewCreatorVods(creator: DisplayCreatorProfile) {
    const primaryLink = creator.platform_links.find((l) => l.is_primary) || creator.platform_links[0];
    if (!primaryLink) {
      showError('No Platform', 'This creator has no platform links configured');
      return;
    }

    // Navigate immediately — tracking shouldn't delay the VOD search UI
    const { trackProfileUsage } = useProfileContext();
    void trackProfileUsage(creator);

    router.push({
      path: '/vods',
      query: {
        platform: primaryLink.platform,
        id: primaryLink.platform_id,
      },
    });
  }

  async function openDownloadDialog(creator: DisplayCreatorProfile) {
    // Track profile usage context
    const { trackProfileUsage } = useProfileContext();
    await trackProfileUsage(creator);

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

  function openPersonalPostDialog(creator: DisplayCreatorProfile) {
    personalPostCreator.value = creator;
    showPersonalPostDialog.value = true;
  }

  function handlePersonalPostSubmitted() {
    showPersonalPostDialog.value = false;
    personalPostCreator.value = null;
    success('Post Added', 'Your post link has been tracked successfully.');
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
  const viewModel = reactive({
    Paintbrush,
    Users,
    activeTab,
    authStore,
    campaigns,
    canWatchCreator,
    confirmDeleteCreator,
    creators,
    filteredCreators,
    getCreatorProfileImage,
    getCreatorStatusLabel,
    getPlatformFilter,
    getPlatformIcon,
    handleImageError,
    hasMonitorableLink,
    isCampaignExpanded,
    isCreatorAutoDvrEnabled,
    isCreatorCheckingLive,
    isCreatorLive,
    isCreatorMonitored,
    isCreatorPersistentAutoDetect,
    isCreatorPersistentRecord,
    isLiveClipEnabled,
    liveCreatorsCount,
    loading,
    monitoringCreatorsCount,
    onCreatorAutoDetectClick,
    onCreatorRecordClick,
    openCreateDialog,
    openDownloadDialog,
    openEditDialog,
    openPersonalPostDialog,
    openPostSubmitDialog,
    organizationProfiles,
    searchQuery,
    stopCreatorMonitoring,
    syncPersonalToCloud,
    syncingPersonal,
    toggleCampaignExpansion,
    toggleCreatorAutoDvr,
    toggleProfileDisabled,
    userProfiles,
    viewCreatorVods,
    watchCreator,
    syncPersonalLabel: 'Sync personal to cloud',
  });
</script>
