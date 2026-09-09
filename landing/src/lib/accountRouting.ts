import type { AuthUser } from '@/types/auth'

export function bypassesPersonalPlanGate(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  if (user.is_admin) return true
  if (user.account_type === 'organization') return true
  if (user.owned_organization_id) return true
  if (user.created_by_organization_id) return true
  return false
}

export function subscriptionCoversAccess(
  subscription?: AuthUser['subscription'] | null,
): boolean {
  if (!subscription?.status) return false
  if (subscription.status === 'active') {
    if (subscription.end_date) return new Date(subscription.end_date).getTime() > Date.now()
    return true
  }
  if (subscription.status === 'cancelled') {
    if (subscription.end_date) return new Date(subscription.end_date).getTime() > Date.now()
    return (subscription.days_remaining ?? 0) > 0
  }
  return false
}

export function needsPlanSelection(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  if (bypassesPersonalPlanGate(user)) return false
  if (user.has_selected_plan) return false
  if (subscriptionCoversAccess(user.subscription)) return false
  return true
}

export function getOrgDashboardPath(user: AuthUser | null | undefined): string | null {
  if (!user) return null
  if (user.owned_organization_id) return `/dashboard/org/${user.owned_organization_id}`
  if (user.created_by_organization_id) return `/dashboard/org/${user.created_by_organization_id}`
  return null
}

export function hasOrganizationAccess(user: AuthUser | null | undefined): boolean {
  return getOrgDashboardPath(user) !== null
}

/** Destination after successful auth on the landing site. */
export function getPostAuthPath(user: AuthUser | null | undefined): string {
  if (!user) return '/account'
  const orgPath = getOrgDashboardPath(user)
  if (orgPath) return orgPath
  if (needsPlanSelection(user)) {
    return '/account/billing?new_user=true'
  }
  return '/account'
}
