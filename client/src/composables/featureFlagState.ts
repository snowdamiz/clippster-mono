import { ref } from 'vue';

export const featureFlags = {
  isLiveClipEnabled: ref(true),
  isBetaModeEnabled: ref(false),
  isAIVideoEnabled: ref(false),
  isImageEditorEnabled: ref(false),
  isTokendEnabled: ref(false),
  isCampaignsEnabled: ref(false),
  isLoading: ref(false),
  error: ref<string | null>(null),
};
