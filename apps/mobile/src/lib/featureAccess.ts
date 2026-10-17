import type { AuthUser } from '@clippster/shared-types';

export function canAccessCampaigns(user: AuthUser | null, globallyEnabled: boolean): boolean {
  return globallyEnabled || user?.is_admin === true || user?.campaigns_enabled === true;
}
