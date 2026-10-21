import { it, expect, vi } from 'vitest'
import { isFreePlan } from '@clippster/shared-types'
vi.mock('../src/api', () => ({ workspaceClient: { get: vi.fn(async () => ({ success: true, balance: { hours_remaining: 60, hours_used: 0 }, organization_allocations: [] })) } }))
import { setWorkspaceAccount } from '../src/workspaceAccount'
import { useCreditBalance } from '../src/workspaceCredits'
it('admin access overrides a stored Free subscription and finite balance', async () => {
  const user: import('@clippster/shared-types').AuthUser = { id: 1, email: 'admin@example.com', is_admin: true, subscription: { status: 'none', tier: null, tier_name: null, start_date: null, end_date: null, renewal_method: null, needs_subscription: false, days_remaining: 0 } }
  setWorkspaceAccount(user)
  const credits = useCreditBalance(); await credits.fetchBalance()
  expect(credits.hoursRemaining.value).toBe('unlimited'); expect(isFreePlan(user)).toBe(false)
  setWorkspaceAccount({ ...user, is_admin: false })
  expect(credits.hoursRemaining.value).toBe(60); expect(isFreePlan({ ...user, is_admin: false })).toBe(true)
  setWorkspaceAccount(null)
})
