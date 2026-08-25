export function canAccessAIVideo(user: any): boolean {
  return (
    user?.is_admin === true ||
    (user?.ai_editor_enabled === true && ['creator', 'pro'].includes(user?.subscription?.tier))
  );
}
