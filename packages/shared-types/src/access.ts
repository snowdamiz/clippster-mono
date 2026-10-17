/** Account access rules shared by the website, desktop and browser workspace. */
export interface PlanAccount {
  is_admin?: boolean
  account_type?: string
  owned_organization_id?: number | string | null
  created_by_organization_id?: number | null
  has_selected_plan?: boolean
  subscription?: { tier?: string | null; status?: string; end_date?: string | null; days_remaining?: number } | null
}

export const FREE_TIER_LIMITS = { clip_build: 5, editor_export: 1, vod_download: 2 } as const
export type FreeTierAction = keyof typeof FREE_TIER_LIMITS
/** Match the desktop's daily quota reset in US Eastern time. */
export function freeUsageDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now)
}

export function bypassesPersonalPlanGate(user?: PlanAccount | null): boolean {
  return !!user && !!(user.is_admin || user.account_type === 'organization' ||
    user.owned_organization_id || user.created_by_organization_id)
}

export function subscriptionCoversAccess(subscription?: PlanAccount['subscription']): boolean {
  if (!subscription || !['active', 'cancelled'].includes(subscription.status || '')) return false
  if (subscription.end_date) return new Date(subscription.end_date).getTime() > Date.now()
  return subscription.status === 'active' || (subscription.days_remaining ?? 0) > 0
}

export function needsPlanSelection(user?: PlanAccount | null): boolean {
  return !!user && !bypassesPersonalPlanGate(user) && !user.has_selected_plan &&
    !subscriptionCoversAccess(user.subscription)
}

export function isFreePlan(user?: PlanAccount | null): boolean {
  return !bypassesPersonalPlanGate(user) && !subscriptionCoversAccess(user?.subscription)
}

export function hasCreatorToolsAccess(user?: PlanAccount | null): boolean {
  return bypassesPersonalPlanGate(user) || (subscriptionCoversAccess(user?.subscription) &&
    ['creator', 'pro'].includes(user?.subscription?.tier || ''))
}
