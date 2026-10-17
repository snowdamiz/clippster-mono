import { featureFlags } from '@/composables/featureFlagState';

export function canAccessTokend(
  user: any,
  globallyEnabled = featureFlags.isTokendEnabled.value
): boolean {
  return (
    globallyEnabled ||
    user?.is_admin === true ||
    (user?.tokend_enabled === true && ['creator', 'pro'].includes(user?.subscription?.tier))
  );
}
