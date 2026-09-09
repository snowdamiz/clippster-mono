import type { AuthUser } from '@clippster/shared-types';

export function canAccessTokend(user: AuthUser | null | undefined): boolean {
  return (
    user?.is_admin === true ||
    (user?.tokend_enabled === true &&
      ['creator', 'pro'].includes(user?.subscription?.tier ?? ''))
  );
}
