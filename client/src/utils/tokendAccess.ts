export function canAccessTokend(user: any): boolean {
  return (
    user?.is_admin === true ||
    (user?.tokend_enabled === true && ['creator', 'pro'].includes(user?.subscription?.tier))
  );
}
