import { featureFlags } from '@/composables/featureFlagState';

function hasIndividualEditorAccess(user: any): boolean {
  return user?.ai_editor_enabled === true && ['creator', 'pro'].includes(user?.subscription?.tier);
}

export function canAccessImageEditor(
  user: any,
  globallyEnabled = featureFlags.isImageEditorEnabled.value
): boolean {
  return globallyEnabled || user?.is_admin === true || hasIndividualEditorAccess(user);
}

export function canAccessCampaigns(
  user: any,
  globallyEnabled = featureFlags.isCampaignsEnabled.value
): boolean {
  return globallyEnabled || user?.is_admin === true || user?.campaigns_enabled === true;
}
