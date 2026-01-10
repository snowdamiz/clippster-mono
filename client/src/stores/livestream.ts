import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SupportedLivestreamPlatform } from '@/types/livestream';
import type { Campaign } from '@/services/campaignApi';

export interface LivestreamWatchState {
  isOpen: boolean;
  mintId: string;
  streamerId: string;
  displayName: string;
  profileImageUrl?: string;
  platform: SupportedLivestreamPlatform;
  isInPipMode: boolean;
}

export interface SessionCampaignContext {
  campaign: Campaign;
  streamerId: string;
}

export const useLivestreamStore = defineStore('livestream', () => {
  // Watch dialog state
  const watchState = ref<LivestreamWatchState>({
    isOpen: false,
    mintId: '',
    streamerId: '',
    displayName: '',
    profileImageUrl: undefined,
    platform: 'PumpFun',
    isInPipMode: false,
  });

  // Campaign context for active sessions (streamerId -> Campaign)
  const sessionCampaigns = ref<Map<string, Campaign>>(new Map());

  
  // Computed getters
  const isWatching = computed(() => watchState.value.isOpen || watchState.value.isInPipMode);
  const isInPipMode = computed(() => watchState.value.isInPipMode);
  const currentStreamer = computed(() => ({
    mintId: watchState.value.mintId,
    streamerId: watchState.value.streamerId,
    displayName: watchState.value.displayName,
    profileImageUrl: watchState.value.profileImageUrl,
  }));

  // Actions
  function openWatchDialog(
    mintId: string,
    streamerId: string,
    displayName: string,
    profileImageUrl?: string,
    platform: SupportedLivestreamPlatform = 'PumpFun'
  ) {
    watchState.value = {
      isOpen: true,
      mintId,
      streamerId,
      displayName,
      profileImageUrl,
      platform,
      isInPipMode: false,
    };
  }

  function closeWatchDialog() {
    watchState.value.isOpen = false;
  }
  
  // Called when user explicitly closes everything (not just hiding for PIP)
  function fullyCloseWatchDialog() {
    if (!watchState.value.isInPipMode) {
      // If not in PIP, we can fully reset the state
      reset();
    } else {
      // If in PIP mode, just hide the dialog but keep state
      watchState.value.isOpen = false;
    }
  }

  function setDialogOpen(open: boolean) {
    watchState.value.isOpen = open;
  }

  function enterPipMode() {
    watchState.value.isInPipMode = true;
    watchState.value.isOpen = false;
  }

  function exitPipMode() {
    watchState.value.isInPipMode = false;
    // Reopen dialog when exiting PIP
    watchState.value.isOpen = true;
  }

  function reset() {
    watchState.value = {
      isOpen: false,
      mintId: '',
      streamerId: '',
      displayName: '',
      profileImageUrl: undefined,
      platform: 'PumpFun',
      isInPipMode: false,
    };
  }

  // Full close - force close everything including PIP
  function forceClose() {
    watchState.value.isOpen = false;
    watchState.value.isInPipMode = false;
  }

  // Campaign context management
  function setSessionCampaign(streamerId: string, campaign: Campaign) {
    sessionCampaigns.value.set(streamerId, campaign);
  }

  function getSessionCampaign(streamerId: string): Campaign | undefined {
    return sessionCampaigns.value.get(streamerId);
  }

  function clearSessionCampaign(streamerId: string) {
    sessionCampaigns.value.delete(streamerId);
  }

  return {
    // State
    watchState,
    sessionCampaigns,
    
    // Getters
    isWatching,
    isInPipMode,
    currentStreamer,
    
    // Actions
    openWatchDialog,
    closeWatchDialog,
    fullyCloseWatchDialog,
    setDialogOpen,
    enterPipMode,
    exitPipMode,
    reset,
    forceClose,
    setSessionCampaign,
    getSessionCampaign,
    clearSessionCampaign,
  };
});

