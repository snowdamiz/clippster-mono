import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getAllMonitoredStreamers, updateMonitoredStreamer, getAllCreatorProfiles } from '@/services/database';
import { invoke } from '@tauri-apps/api/core';
import { checkKickLivestream } from '@/services/kick';
import { checkTwitchLivestream } from '@/services/twitch';
import { getUserAssignedCreatorProfiles } from '@/services/organizationProfilesApi';
import { useAuthStore } from './auth';
import type { SupportedLivestreamPlatform } from '@/types/livestream';

interface LiveStatus {
  isLive: boolean;
  streamId?: string;
  streamStartTimestamp?: number;
  numParticipants?: number;
  profileImageUrl?: string;
  raw?: any;
}

interface CreatorProfile {
  id: string;
  name: string;
  platform_links: Array<{
    id: string;
    platform: string;
    platform_id: string;
    display_name?: string;
  }>;
}

export const useLiveStatusStore = defineStore('liveStatus', () => {
  // State for monitored streamers (Live tab)
  const liveCount = ref(0);
  const isPolling = ref(false);
  const lastPollTime = ref<number>(0);
  
  // State for creator profiles (Creators tab)
  const liveCreatorsCount = ref(0);
  const lastCreatorsPollTime = ref<number>(0);
  
  let pollingInterval: ReturnType<typeof setInterval> | null = null;

  // Helper function to check live status for different platforms
  async function fetchPlatformLiveStatus(
    platformId: string,
    platform: SupportedLivestreamPlatform
  ): Promise<LiveStatus> {
    try {
      switch (platform) {
        case 'Kick': {
          const kickStatus = await checkKickLivestream(platformId);
          return {
            isLive: kickStatus.isLive,
            streamId: kickStatus.channelId,
            streamStartTimestamp: kickStatus.startedAt
              ? new Date(kickStatus.startedAt).getTime()
              : undefined,
            numParticipants: kickStatus.viewerCount,
            profileImageUrl: kickStatus.profileImageUrl,
            raw: kickStatus,
          };
        }
        case 'Twitch': {
          const twitchStatus = await checkTwitchLivestream(platformId);
          return {
            isLive: twitchStatus.isLive,
            streamId: twitchStatus.channelId,
            streamStartTimestamp: twitchStatus.startedAt
              ? new Date(twitchStatus.startedAt).getTime()
              : undefined,
            numParticipants: twitchStatus.viewerCount,
            profileImageUrl: twitchStatus.profileImageUrl,
            raw: twitchStatus,
          };
        }
        case 'PumpFun':
        default: {
          const response = await invoke<string>('check_pumpfun_livestream', { mintId: platformId });
          if (!response) {
            return { isLive: false };
          }
          const data = JSON.parse(response);
          return {
            isLive: Boolean(data?.isLive),
            streamId: data?.id,
            streamStartTimestamp: data?.streamStartTimestamp,
            numParticipants: data?.numParticipants,
            raw: data,
          };
        }
      }
    } catch (error) {
      console.warn(`[LiveStatusStore] Failed to check live status for ${platform}:`, error);
      return { isLive: false };
    }
  }

  // Fetch live count for all monitored streamers
  async function fetchLiveCount(): Promise<number> {
    const now = Date.now();
    
    // Skip if polled recently (within 30 seconds)
    if (now - lastPollTime.value < 30000) {
      return liveCount.value;
    }

    try {
      const streamers = await getAllMonitoredStreamers();
      
      if (streamers.length === 0) {
        liveCount.value = 0;
        lastPollTime.value = now;
        return 0;
      }

      // Check live status for each streamer
      const statusChecks = streamers.map(async (streamer) => {
        const platform = streamer.platform.toLowerCase() as 'pumpfun' | 'kick' | 'twitch';
        const platformType: SupportedLivestreamPlatform = 
          platform === 'kick' ? 'Kick' : 
          platform === 'twitch' ? 'Twitch' : 
          'PumpFun';

        const status = await fetchPlatformLiveStatus(streamer.mint_id, platformType);

        // Update database with current live status
        await updateMonitoredStreamer(streamer.id, {
          is_currently_live: status.isLive ? 1 : 0,
          last_check_timestamp: Math.floor(now / 1000),
        });

        return status.isLive;
      });

      const results = await Promise.all(statusChecks);
      const count = results.filter(Boolean).length;

      liveCount.value = count;
      lastPollTime.value = now;

      return count;
    } catch (error) {
      console.error('[LiveStatusStore] Failed to fetch live count:', error);
      return liveCount.value;
    }
  }

  // Start polling for live status
  function startPolling() {
    if (isPolling.value) {
      return; // Already polling
    }

    isPolling.value = true;

    // Initial fetch
    fetchLiveCount();

    // Poll every 60 seconds
    pollingInterval = setInterval(() => {
      fetchLiveCount();
    }, 60000);
  }

  // Stop polling
  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    isPolling.value = false;
  }

  // Fetch live count for creator profiles
  async function fetchLiveCreatorsCount(): Promise<number> {
    const now = Date.now();
    
    // Skip if polled recently (within 30 seconds)
    if (now - lastCreatorsPollTime.value < 30000) {
      return liveCreatorsCount.value;
    }

    try {
      const authStore = useAuthStore();
      
      // Load local profiles
      const localProfiles = await getAllCreatorProfiles();
      const allProfiles: CreatorProfile[] = localProfiles.map(p => ({
        id: p.id,
        name: p.name,
        platform_links: p.platform_links
      }));

      // Load organization profiles if authenticated
      if (authStore.isAuthenticated) {
        try {
          const orgResponse = await getUserAssignedCreatorProfiles();
          if (orgResponse.success && orgResponse.profiles.length > 0) {
            const orgProfiles = orgResponse.profiles.map(p => ({
              id: `org-${p.id}`,
              name: p.name,
              platform_links: p.platform_links.map(link => ({
                id: `org-link-${link.id}`,
                platform: link.platform,
                platform_id: link.platform_id,
                display_name: link.display_name
              }))
            }));
            allProfiles.push(...orgProfiles);
          }
        } catch (error) {
          console.warn('[LiveStatusStore] Failed to fetch org profiles:', error);
        }
      }

      if (allProfiles.length === 0) {
        liveCreatorsCount.value = 0;
        lastCreatorsPollTime.value = now;
        return 0;
      }

      // Check live status for each creator's platform links
      const liveChecks = await Promise.all(
        allProfiles.map(async (creator) => {
          // Check if any of the creator's platform links are live
          const linkChecks = await Promise.all(
            creator.platform_links.map(async (link) => {
              const platform = link.platform.toLowerCase() as 'pumpfun' | 'kick' | 'twitch';
              const platformType: SupportedLivestreamPlatform = 
                platform === 'kick' ? 'Kick' : 
                platform === 'twitch' ? 'Twitch' : 
                'PumpFun';

              try {
                const status = await fetchPlatformLiveStatus(link.platform_id, platformType);
                return status.isLive;
              } catch (error) {
                return false;
              }
            })
          );

          // Creator is considered live if any of their links are live
          return linkChecks.some(Boolean);
        })
      );

      const count = liveChecks.filter(Boolean).length;
      liveCreatorsCount.value = count;
      lastCreatorsPollTime.value = now;

      return count;
    } catch (error) {
      console.error('[LiveStatusStore] Failed to fetch live creators count:', error);
      return liveCreatorsCount.value;
    }
  }

  // Start polling (polls both monitored streamers and creator profiles)
  function startPollingAll() {
    if (isPolling.value) {
      return; // Already polling
    }

    isPolling.value = true;

    // Initial fetch for both
    fetchLiveCount();
    fetchLiveCreatorsCount();

    // Poll every 60 seconds
    pollingInterval = setInterval(() => {
      fetchLiveCount();
      fetchLiveCreatorsCount();
    }, 60000);
  }

  // Force refresh (useful for when user navigates to Live page)
  async function refresh() {
    lastPollTime.value = 0; // Reset to force fetch
    return await fetchLiveCount();
  }

  // Force refresh creators
  async function refreshCreators() {
    lastCreatorsPollTime.value = 0; // Reset to force fetch
    return await fetchLiveCreatorsCount();
  }

  return {
    // State
    liveCount,
    liveCreatorsCount,
    isPolling,
    lastPollTime,
    lastCreatorsPollTime,
    
    // Actions
    fetchLiveCount,
    fetchLiveCreatorsCount,
    startPolling,
    startPollingAll,
    stopPolling,
    refresh,
    refreshCreators,
  };
});
