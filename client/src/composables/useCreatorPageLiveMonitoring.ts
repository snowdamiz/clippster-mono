import { ref } from 'vue';
import {
  createMonitoredStreamer,
  getMonitoredStreamer,
  getMonitoredStreamerByMint,
  updateMonitoredStreamer,
  updatePlatformLink,
  getCreatorProfileByPlatformId,
  getAllPrompts,
} from '@/services/database';
import { useLivestreamMonitoring } from '@/composables/useLivestreamMonitoring';
import { useRealtimeClipDetection } from '@/composables/useRealtimeClipDetection';
import { parseCreatorClipBuildDefaults } from '@/composables/useCreatorClipDefaults';
import { useToast } from '@/composables/useToast';
import { useSubscriptionGate } from '@/composables/useSubscriptionGate';
import type { CreatorProfileWithLinks, CreatorPlatformLink } from '@/services/database/types';
import type { MonitoredStreamer } from '@/types/livestream';

export interface CreatorPageProfile extends CreatorProfileWithLinks {
  isOrgProfile?: boolean;
  organization_id?: number | null;
  server_id?: number;
}

export interface PersistentLiveSettings {
  persistentAutoDetect: boolean;
  persistentRecord: boolean;
}

function getMonitorableLink(creator: CreatorPageProfile): CreatorPlatformLink | undefined {
  return creator.platform_links.find(
    (l) => l.platform === 'pumpfun' || l.platform === 'kick' || l.platform === 'twitch'
  );
}

function platformDisplayForLink(platform: string): string {
  if (platform === 'kick') return 'kick';
  if (platform === 'twitch') return 'twitch';
  return 'pumpfun';
}

function monitoredPlatformToCreatorLinkPlatform(
  platform: string
): 'pumpfun' | 'kick' | 'twitch' | null {
  const p = platform.toLowerCase();
  if (p === 'pumpfun') return 'pumpfun';
  if (p === 'kick') return 'kick';
  if (p === 'twitch') return 'twitch';
  return null;
}

export function useCreatorPageLiveMonitoring() {
  const { success, error: showError } = useToast();
  const { requireSubscription } = useSubscriptionGate();
  const { startMonitoring, stopMonitoring, monitoredStreamers, activeSessions } =
    useLivestreamMonitoring();
  const realtimeDetection = useRealtimeClipDetection();

  const persistentLiveTracker = ref<Map<string, PersistentLiveSettings>>(new Map());

  const showRealtimeDialog = ref(false);
  const showSegmentDialog = ref(false);
  const showAutoDetectLimitDialog = ref(false);
  const autoDetectLimitDialogData = ref({ activeStreamerName: '', requestedStreamerName: '' });
  const pendingCreator = ref<CreatorPageProfile | null>(null);
  const prompts = ref<{ id: string; name: string; content: string }[]>([]);
  const loadingPrompts = ref(false);
  const creatorLayoutEligible = ref(false);
  const creatorLayoutCreatorName = ref<string | null>(null);
  const pendingCreatorProfileId = ref<string | null>(null);
  const selectedDuration = ref(5);
  const recordUseCreatorLayout = ref(false);

  const availableDurationsRecord = [5, 10, 15, 30, 0];

  function getMonitoredStreamerId(creator: CreatorPageProfile): string | null {
    for (const link of creator.platform_links) {
      if (link.monitored_streamer_id) return link.monitored_streamer_id;
    }
    return null;
  }

  function getPersistentSettings(streamerId: string): PersistentLiveSettings {
    return (
      persistentLiveTracker.value.get(streamerId) ?? {
        persistentAutoDetect: false,
        persistentRecord: false,
      }
    );
  }

  function isCreatorPersistentAutoDetect(creator: CreatorPageProfile): boolean {
    const streamerId = getMonitoredStreamerId(creator);
    if (!streamerId) return false;
    return getPersistentSettings(streamerId).persistentAutoDetect;
  }

  function isCreatorPersistentRecord(creator: CreatorPageProfile): boolean {
    const streamerId = getMonitoredStreamerId(creator);
    if (!streamerId) return false;
    return getPersistentSettings(streamerId).persistentRecord;
  }

  async function persistMonitoredStreamerLink(
    creator: CreatorPageProfile,
    link: CreatorPlatformLink
  ): Promise<string> {
    let streamerId = link.monitored_streamer_id;

    if (!streamerId) {
      const existingByMint = await getMonitoredStreamerByMint(link.platform_id);
      if (existingByMint) {
        streamerId = existingByMint.id;
      } else {
        streamerId = await createMonitoredStreamer(
          link.platform_id,
          link.display_name || creator.name,
          link.profile_image_url || undefined,
          5,
          false,
          platformDisplayForLink(link.platform)
        );
      }

      if (!creator.isOrgProfile) {
        await updatePlatformLink(link.id, { monitored_streamer_id: streamerId });
      }
      link.monitored_streamer_id = streamerId;
      window.dispatchEvent(new CustomEvent('monitored-streamers-updated'));
    }

    return streamerId;
  }

  async function resolveMonitoredStreamer(creator: CreatorPageProfile): Promise<{
    streamerId: string;
    link: CreatorPlatformLink;
  } | null> {
    const link = getMonitorableLink(creator);
    if (!link?.platform_id) {
      showError('No Supported Platforms', 'Live monitoring requires PumpFun, Kick, or Twitch.');
      return null;
    }
    const streamerId = await persistMonitoredStreamerLink(creator, link);
    return { streamerId, link };
  }

  async function loadPersistentSettingsForProfiles(profiles: CreatorPageProfile[]) {
    for (const profile of profiles) {
      for (const link of profile.platform_links) {
        if (!link.monitored_streamer_id) continue;
        try {
          const streamer = await getMonitoredStreamer(link.monitored_streamer_id);
          if (streamer) {
            persistentLiveTracker.value.set(link.monitored_streamer_id, {
              persistentAutoDetect: Boolean(streamer.persistent_auto_detect),
              persistentRecord: Boolean(streamer.persistent_record),
            });
          }
        } catch (err) {
          console.warn('[CreatorProfiles] Failed to load persistent live settings:', err);
        }
      }
    }
  }

  async function resolveCreatorLayout(creator: CreatorPageProfile, link: CreatorPlatformLink) {
    creatorLayoutEligible.value = false;
    creatorLayoutCreatorName.value = null;
    pendingCreatorProfileId.value = null;

    if (creator.isOrgProfile) return;

    const linkPlatform = monitoredPlatformToCreatorLinkPlatform(link.platform);
    if (!linkPlatform || !link.platform_id) return;

    try {
      const profile = await getCreatorProfileByPlatformId(linkPlatform, link.platform_id);
      if (profile && parseCreatorClipBuildDefaults(profile.clip_build_defaults ?? null)) {
        creatorLayoutEligible.value = true;
        creatorLayoutCreatorName.value = profile.name || null;
        pendingCreatorProfileId.value = profile.id;
      }
    } catch (err) {
      console.warn('[CreatorProfiles] Failed to resolve creator layout:', err);
    }
  }

  async function loadPrompts() {
    try {
      loadingPrompts.value = true;
      const list = await getAllPrompts();
      prompts.value = list || [];
    } catch (e) {
      console.error('[CreatorProfiles] Failed to load prompts', e);
    } finally {
      loadingPrompts.value = false;
    }
  }

  async function buildStreamerForMonitoring(
    streamerId: string,
    link: CreatorPlatformLink,
    creator: CreatorPageProfile
  ): Promise<MonitoredStreamer | null> {
    const streamer = await getMonitoredStreamer(streamerId);
    if (!streamer) return null;

    const platformDisplay =
      link.platform === 'kick' ? 'Kick' : link.platform === 'twitch' ? 'Twitch' : 'PumpFun';

    return {
      id: streamer.id,
      mintId: streamer.mint_id,
      displayName: streamer.display_name || link.display_name || creator.name,
      platform: platformDisplay,
      lastCheckTimestamp: streamer.last_check_timestamp,
      isCurrentlyLive: Boolean(streamer.is_currently_live),
      currentSessionId: streamer.current_session_id,
      selected: false,
      isDetecting: false,
      profileImageUrl: streamer.profile_image_url || link.profile_image_url || undefined,
      streamThumbnailUrl: streamer.stream_thumbnail_url || undefined,
      segmentDurationMinutes: streamer.segment_duration_minutes ?? 5,
      autoDvr: Boolean(streamer.auto_dvr),
    };
  }

  async function startLiveSessionIfNeeded(
    streamerId: string,
    link: CreatorPlatformLink,
    creator: CreatorPageProfile,
    mode: 'realtime-detect' | 'record',
    extras: {
      promptId?: string;
      promptContent?: string;
      applyCreatorClipLayout?: boolean;
      creatorProfileId?: string;
      segmentDurationMinutes?: number;
    } = {}
  ) {
    if (monitoredStreamers.value.has(streamerId) || activeSessions.value.has(streamerId)) return;

    const streamerRecord = await getMonitoredStreamer(streamerId);
    if (!streamerRecord?.is_currently_live) return;

    const streamer = await buildStreamerForMonitoring(streamerId, link, creator);
    if (!streamer) return;

    if (mode === 'realtime-detect') {
      if (realtimeDetection.isActive.value) return;
      await startMonitoring([streamer], {
        mode: 'realtime-detect',
        segmentDurationMinutes: 1,
        promptId: extras.promptId,
        promptContent: extras.promptContent,
        creatorProfileId: extras.creatorProfileId,
        applyCreatorClipLayout: extras.applyCreatorClipLayout,
        maxDetectionMinutes: 60,
        fromCreatorPage: true,
      });
    } else {
      await startMonitoring([streamer], {
        mode: 'record',
        segmentDurationMinutes: extras.segmentDurationMinutes ?? 5,
        creatorProfileId: extras.creatorProfileId,
        applyCreatorClipLayout: extras.applyCreatorClipLayout,
        fromCreatorPage: true,
      });
    }
  }

  async function disablePersistentAutoDetect(streamerId: string, creatorName: string) {
    await updateMonitoredStreamer(streamerId, {
      persistent_auto_detect: 0,
      auto_detect_prompt_id: null,
      auto_detect_prompt_content: null,
      auto_detect_use_creator_layout: 0,
      auto_detect_creator_profile_id: null,
    });
    const current = getPersistentSettings(streamerId);
    persistentLiveTracker.value.set(streamerId, {
      ...current,
      persistentAutoDetect: false,
    });
    success('Auto Detect Off', `"${creatorName}" will no longer auto-detect when live.`);
  }

  async function disablePersistentRecord(streamerId: string, creatorName: string) {
    await updateMonitoredStreamer(streamerId, {
      persistent_record: 0,
      record_use_creator_layout: 0,
      record_creator_profile_id: null,
    });
    const current = getPersistentSettings(streamerId);
    persistentLiveTracker.value.set(streamerId, {
      ...current,
      persistentRecord: false,
    });
    success('Record Off', `"${creatorName}" will no longer auto-record when live.`);
  }

  async function onCreatorAutoDetectClick(creator: CreatorPageProfile) {
    const resolved = await resolveMonitoredStreamer(creator);
    if (!resolved) return;

    const { streamerId, link } = resolved;

    if (isCreatorPersistentAutoDetect(creator)) {
      await disablePersistentAutoDetect(streamerId, creator.name);
      if (monitoredStreamers.value.has(streamerId)) {
        await stopMonitoring([streamerId]);
      }
      return;
    }

    pendingCreator.value = creator;
    await resolveCreatorLayout(creator, link);
    if (prompts.value.length === 0) {
      await loadPrompts();
    }
    showRealtimeDialog.value = true;
  }

  async function onCreatorRecordClick(creator: CreatorPageProfile) {
    const resolved = await resolveMonitoredStreamer(creator);
    if (!resolved) return;

    const { streamerId, link } = resolved;

    if (isCreatorPersistentRecord(creator)) {
      await disablePersistentRecord(streamerId, creator.name);
      if (monitoredStreamers.value.has(streamerId)) {
        await stopMonitoring([streamerId]);
      }
      return;
    }

    pendingCreator.value = creator;
    selectedDuration.value = 5;
    recordUseCreatorLayout.value = false;
    await resolveCreatorLayout(creator, link);
    showSegmentDialog.value = true;
  }

  async function handleRealtimeDetectionConfirm(data: {
    promptId: string;
    promptContent: string;
    useCreatorLayout: boolean;
  }) {
    const creator = pendingCreator.value;
    if (!creator) return;

    const resolved = await resolveMonitoredStreamer(creator);
    if (!resolved) return;

    const { streamerId, link } = resolved;

    if (realtimeDetection.isActive.value) {
      autoDetectLimitDialogData.value = {
        activeStreamerName: 'another stream',
        requestedStreamerName: creator.name,
      };
      showAutoDetectLimitDialog.value = true;
      return;
    }

    if (
      !(await requireSubscription({
        context: `Auto-detect when live for ${creator.name}`,
        type: 'live',
      }))
    ) {
      return;
    }

    const applyLayout =
      data.useCreatorLayout && creatorLayoutEligible.value && !!pendingCreatorProfileId.value;
    const creatorProfileId = applyLayout ? pendingCreatorProfileId.value! : undefined;

    await updateMonitoredStreamer(streamerId, {
      persistent_auto_detect: 1,
      persistent_record: 0,
      auto_detect_prompt_id: data.promptId || null,
      auto_detect_prompt_content: data.promptContent || null,
      auto_detect_use_creator_layout: applyLayout ? 1 : 0,
      auto_detect_creator_profile_id: creatorProfileId ?? null,
    });

    persistentLiveTracker.value.set(streamerId, {
      persistentAutoDetect: true,
      persistentRecord: false,
    });

    showRealtimeDialog.value = false;
    pendingCreator.value = null;

    success(
      'Auto Detect Enabled',
      `"${creator.name}" will auto-detect for the first 60 minutes each time they go live. Use Live Clip Auto for another 60 minutes on the same stream.`
    );

    await startLiveSessionIfNeeded(streamerId, link, creator, 'realtime-detect', {
      promptId: data.promptId || undefined,
      promptContent: data.promptContent || undefined,
      applyCreatorClipLayout: applyLayout,
      creatorProfileId,
    });
  }

  async function handleRecordDialogConfirm() {
    const creator = pendingCreator.value;
    if (!creator) return;

    const resolved = await resolveMonitoredStreamer(creator);
    if (!resolved) return;

    const { streamerId, link } = resolved;

    if (
      !(await requireSubscription({
        context: `Record when live for ${creator.name}`,
        type: 'live',
      }))
    ) {
      return;
    }

    const applyLayout =
      recordUseCreatorLayout.value &&
      creatorLayoutEligible.value &&
      !!pendingCreatorProfileId.value;
    const creatorProfileId = applyLayout ? pendingCreatorProfileId.value! : undefined;
    const segmentDuration =
      selectedDuration.value === 0 ? 0 : selectedDuration.value;

    await updateMonitoredStreamer(streamerId, {
      persistent_record: 1,
      persistent_auto_detect: 0,
      segment_duration_minutes: segmentDuration > 0 ? segmentDuration : 5,
      record_use_creator_layout: applyLayout ? 1 : 0,
      record_creator_profile_id: creatorProfileId ?? null,
    });

    persistentLiveTracker.value.set(streamerId, {
      persistentAutoDetect: false,
      persistentRecord: true,
    });

    showSegmentDialog.value = false;
    pendingCreator.value = null;

    success('Record Enabled', `"${creator.name}" will auto-record when they go live.`);

    await startLiveSessionIfNeeded(streamerId, link, creator, 'record', {
      segmentDurationMinutes: segmentDuration > 0 ? segmentDuration : 5,
      applyCreatorClipLayout: applyLayout,
      creatorProfileId,
    });
  }

  function closeRealtimeDialog() {
    showRealtimeDialog.value = false;
    pendingCreator.value = null;
  }

  function closeSegmentDialog() {
    showSegmentDialog.value = false;
    pendingCreator.value = null;
  }

  return {
    persistentLiveTracker,
    showRealtimeDialog,
    showSegmentDialog,
    showAutoDetectLimitDialog,
    autoDetectLimitDialogData,
    prompts,
    loadingPrompts,
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
  };
}
