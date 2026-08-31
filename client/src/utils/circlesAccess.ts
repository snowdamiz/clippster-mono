export function canAccessCircles(user: any): boolean {
  return (
    user?.is_admin === true ||
    (user?.circles_enabled === true && ['creator', 'pro'].includes(user?.subscription?.tier))
  );
}
