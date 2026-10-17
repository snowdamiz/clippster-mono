import { featureFlags } from '@/composables/featureFlagState';

export function canAccessAIVideo(
  user: any,
  globallyEnabled = featureFlags.isAIVideoEnabled.value
): boolean {
  return (
    globallyEnabled ||
    user?.is_admin === true ||
    (user?.ai_editor_enabled === true && ['creator', 'pro'].includes(user?.subscription?.tier))
  );
}
