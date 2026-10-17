import type { AuthUser } from '@/types/auth'

import { needsPlanSelection } from '../../../packages/shared-types/src/access'
export { needsPlanSelection, bypassesPersonalPlanGate, subscriptionCoversAccess } from '../../../packages/shared-types/src/access'

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
  if (needsPlanSelection(user)) {
    return '/account/billing?new_user=true'
  }
  return '/account'
}
