import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { api } from '@/lib/api'
import { listOrganizationCreatorProfiles, listOrganizationAssets, uploadOrganizationLogo } from '@/services/organizationApi'
import type {
  Organization,
  OrganizationMember,
  OrganizationInvitation,
  OrganizationCredits,
  OrganizationSubscription,
  ServerOrganizationCreatorProfile,
  ServerOrganizationAsset,
} from '@/types/organization'

const CACHE_DURATION_MS = 2 * 60 * 1000

interface OrgState {
  loading: boolean
  error: string
  organization: Organization | null
  members: OrganizationMember[]
  invitations: OrganizationInvitation[]
  credits: OrganizationCredits
  myAllocation: any
  role: string
  orgLoaded: boolean
  lastFetchTime: number | null
  subscription: OrganizationSubscription | null
  subscriptionLoading: boolean
  creatorProfiles: ServerOrganizationCreatorProfile[]
  profilesLoading: boolean
  profilesLoaded: boolean
  orgAssets: ServerOrganizationAsset[]
  assetsLoading: boolean
  assetsLoaded: boolean
  transactions: any[]
  transactionsLoading: boolean
  transactionsTotal: number
  transactionsPage: number
  transactionsLoaded: boolean
}

function createInitialState(): OrgState {
  return {
    loading: false,
    error: '',
    organization: null,
    members: [],
    invitations: [],
    credits: { hoursRemaining: '0', hoursUsed: '0' },
    myAllocation: null,
    role: '',
    orgLoaded: false,
    lastFetchTime: null,
    subscription: null,
    subscriptionLoading: false,
    creatorProfiles: [],
    profilesLoading: false,
    profilesLoaded: false,
    orgAssets: [],
    assetsLoading: false,
    assetsLoaded: false,
    transactions: [],
    transactionsLoading: false,
    transactionsTotal: 0,
    transactionsPage: 1,
    transactionsLoaded: false,
  }
}

// Module-level cache
const stateCache = new Map<string, OrgState>()
const listeners = new Map<string, Set<() => void>>()

function getOrCreateState(orgId: string): OrgState {
  if (!stateCache.has(orgId)) {
    stateCache.set(orgId, createInitialState())
  }
  return stateCache.get(orgId)!
}

function notifyListeners(orgId: string) {
  listeners.get(orgId)?.forEach(fn => fn())
}

function updateState(orgId: string, patch: Partial<OrgState>) {
  const current = getOrCreateState(orgId)
  stateCache.set(orgId, { ...current, ...patch })
  notifyListeners(orgId)
}

const TRANSACTIONS_PER_PAGE = 20

export function useOrganization() {
  const { id } = useParams<{ id: string }>()
  const orgId = id || ''
  const auth = useAuth()
  const toast = useToast()
  const prevOrgId = useRef(orgId)

  // Subscribe to state changes
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!orgId) return () => {}
      if (!listeners.has(orgId)) listeners.set(orgId, new Set())
      listeners.get(orgId)!.add(callback)
      return () => { listeners.get(orgId)?.delete(callback) }
    },
    [orgId]
  )

  const getSnapshot = useCallback(() => {
    if (!orgId) return createInitialState()
    return getOrCreateState(orgId)
  }, [orgId])

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  // Computed
  console.log('[useOrganization] Computing isAdmin:', { role: state.role, isAdmin: state.role === 'owner' || state.role === 'admin' || auth.user?.is_admin === true })
  const isAdmin = state.role === 'owner' || state.role === 'admin' || auth.user?.is_admin === true
  const isOwner = state.role === 'owner'
  const poolBalance = useMemo(() => {
    const val = parseFloat(state.credits.hoursRemaining)
    return isNaN(val) ? 0 : val
  }, [state.credits.hoursRemaining])
  const hasActiveSubscription = state.subscription?.has_subscription || false
  const totalSeats = state.subscription?.total_seats || null
  const currentMembers = state.subscription?.current_members || state.members.length
  const seatsRemaining = state.subscription?.seats_remaining ?? null
  const canAddMembers = !hasActiveSubscription || seatsRemaining === null || seatsRemaining > 0
  const totalTransactionPages = Math.ceil(state.transactionsTotal / TRANSACTIONS_PER_PAGE)

  // Load organization
  const loadOrganization = useCallback(async (force = false) => {
    if (!orgId) return

    const current = getOrCreateState(orgId)
    const now = Date.now()
    const isFresh = current.lastFetchTime && now - current.lastFetchTime < CACHE_DURATION_MS

    if (!force && current.orgLoaded && isFresh) return

    const isBackgroundRefresh = current.orgLoaded && !force
    if (!isBackgroundRefresh) {
      updateState(orgId, { loading: true })
    }
    updateState(orgId, { error: '' })

    try {
      const orgResult = await auth.getOrganization(Number(orgId))
      console.log('[useOrganization] getOrganization response:', { orgId, role: orgResult.role, success: orgResult.success })
      if (orgResult.success) {
        updateState(orgId, { organization: orgResult.organization, role: orgResult.role ?? '' })
        console.log('[useOrganization] State updated with role:', orgResult.role)
      } else {
        throw new Error(orgResult.error)
      }

      const membersResult = await auth.getOrganizationMembers(Number(orgId))
      if (membersResult.success) {
        updateState(orgId, { members: membersResult.members ?? [] })
      }

      const currentState = getOrCreateState(orgId)
      if (currentState.role === 'owner' || currentState.role === 'admin') {
        const invitesResult = await auth.getOrganizationInvitations(Number(orgId))
        if (invitesResult.success) {
          updateState(orgId, { invitations: invitesResult.invitations ?? [] })
        }
      }

      const creditsResult = await auth.getOrganizationCredits(Number(orgId))
      if (creditsResult.success) {
        updateState(orgId, {
          credits: {
            hoursRemaining: creditsResult.org_credits?.hours_remaining ?? '0',
            hoursUsed: creditsResult.org_credits?.hours_used ?? '0',
          },
          myAllocation: creditsResult.my_allocation,
        })
      }

      // Load subscription
      try {
        updateState(orgId, { subscriptionLoading: true })
        const subResponse = await api.get<any>(`/organizations/${orgId}/subscription`)
        if (subResponse.success) {
          updateState(orgId, { subscription: subResponse.subscription })
        }
      } catch {
        // ignore
      } finally {
        updateState(orgId, { subscriptionLoading: false })
      }

      updateState(orgId, { orgLoaded: true, lastFetchTime: Date.now() })
    } catch (err: any) {
      updateState(orgId, { error: err.message || 'Failed to load organization' })
    } finally {
      updateState(orgId, { loading: false })
    }
  }, [orgId, auth])

  const loadSubscription = useCallback(async () => {
    if (!orgId) return
    updateState(orgId, { subscriptionLoading: true })
    try {
      const response = await api.get<any>(`/organizations/${orgId}/subscription`)
      if (response.success) {
        updateState(orgId, { subscription: response.subscription })
      }
    } catch { /* ignore */ } finally {
      updateState(orgId, { subscriptionLoading: false })
    }
  }, [orgId])

  const loadCreatorProfiles = useCallback(async () => {
    if (!orgId) return
    updateState(orgId, { profilesLoading: true })
    try {
      const response = await listOrganizationCreatorProfiles(Number(orgId))
      if (response.success) {
        updateState(orgId, { creatorProfiles: response.profiles, profilesLoaded: true })
      }
    } catch { /* ignore */ } finally {
      updateState(orgId, { profilesLoading: false })
    }
  }, [orgId])

  const loadOrgAssets = useCallback(async () => {
    if (!orgId) return
    const current = getOrCreateState(orgId)
    if (current.assetsLoaded) return
    updateState(orgId, { assetsLoading: true })
    try {
      const response = await listOrganizationAssets(Number(orgId))
      if (response.success) {
        updateState(orgId, { orgAssets: response.assets, assetsLoaded: true })
      }
    } catch { /* ignore */ } finally {
      updateState(orgId, { assetsLoading: false })
    }
  }, [orgId])

  const loadTransactions = useCallback(async (page = 1) => {
    if (!orgId) return
    const current = getOrCreateState(orgId)
    if (current.role !== 'owner' && current.role !== 'admin') return
    updateState(orgId, { transactionsLoading: true })
    try {
      const offset = (page - 1) * TRANSACTIONS_PER_PAGE
      const result = await auth.getOrganizationTransactions(Number(orgId), { limit: TRANSACTIONS_PER_PAGE, offset })
      if (result.success) {
        updateState(orgId, {
          transactions: result.transactions ?? [],
          transactionsTotal: result.total ?? 0,
          transactionsPage: page,
          transactionsLoaded: true,
        })
      }
    } catch { /* ignore */ } finally {
      updateState(orgId, { transactionsLoading: false })
    }
  }, [orgId, auth])

  // Mutation methods
  const updateOrg = useCallback(async (data: Record<string, any>) => {
    if (!orgId) return { success: false, error: 'No organization ID' }
    try {
      const result = await auth.updateOrganization(Number(orgId), data)
      if (result.success) {
        updateState(orgId, { organization: result.organization })
        toast.success('Settings saved', 'Organization settings updated successfully')
      }
      return result
    } catch (err: any) {
      toast.error('Save failed', err.message)
      return { success: false, error: err.message }
    }
  }, [orgId, auth, toast])

  const cancelInvitation = useCallback(async (invitationId: number) => {
    if (!orgId) return
    try {
      await auth.cancelOrganizationInvitation(Number(orgId), invitationId)
      const current = getOrCreateState(orgId)
      updateState(orgId, { invitations: current.invitations.filter(i => i.id !== invitationId) })
      toast.success('Invitation cancelled')
    } catch {
      toast.error('Failed to cancel invitation')
    }
  }, [orgId, auth, toast])

  const resendInvitation = useCallback(async (invitation: OrganizationInvitation) => {
    if (!orgId) return { success: false }
    try {
      const result = await auth.resendOrganizationInvitation(Number(orgId), invitation.id)
      if (result.success) {
        toast.success('Invitation resent', `Invitation email resent to ${invitation.email}`)
        await loadOrganization()
      } else {
        toast.error('Failed to resend', result.error || 'Could not resend invitation')
      }
      return result
    } catch (err: any) {
      toast.error('Failed to resend', err.message)
      return { success: false, error: err.message }
    }
  }, [orgId, auth, toast, loadOrganization])

  const removeMember = useCallback(async (member: OrganizationMember) => {
    if (!orgId) return { success: false }
    try {
      await auth.removeOrganizationMember(Number(orgId), member.user_id)
      const current = getOrCreateState(orgId)
      updateState(orgId, { members: current.members.filter(m => m.id !== member.id) })
      toast.success('Member removed', `${member.user?.email} has been removed`)
      return { success: true }
    } catch (err: any) {
      toast.error('Failed to remove member', err.message)
      return { success: false, error: err.message }
    }
  }, [orgId, auth, toast])

  const updateMemberRole = useCallback(async (member: OrganizationMember, newRole: string) => {
    if (!orgId) return { success: false }
    try {
      await auth.updateOrganizationMemberRole(Number(orgId), member.user_id, newRole)
      toast.success('Role updated', `${member.user?.email} is now a ${newRole}`)
      await loadOrganization()
      return { success: true }
    } catch (err: any) {
      toast.error('Failed to update role', err.message)
      return { success: false, error: err.message }
    }
  }, [orgId, auth, toast, loadOrganization])

  const updateMemberAccount = useCallback(async (member: OrganizationMember, updates: { name?: string; email?: string; password?: string }) => {
    if (!orgId) return { success: false }
    try {
      const result = await auth.updateOrganizationMemberAccount(Number(orgId), member.user_id, updates)
      if (result.success) {
        toast.success('Member updated', 'Member account has been updated successfully')
        await loadOrganization()
      } else {
        toast.error('Update failed', result.error || 'Failed to update member account')
      }
      return result
    } catch (err: any) {
      toast.error('Update failed', err.message)
      return { success: false, error: err.message }
    }
  }, [orgId, auth, toast, loadOrganization])

  const allocateCredits = useCallback(async (userId: number, minutes: number) => {
    if (!orgId) return { success: false }
    if (!minutes || minutes <= 0) {
      toast.error('Invalid amount', 'Please enter a positive number of minutes')
      return { success: false }
    }
    const currentPool = parseFloat(getOrCreateState(orgId).credits.hoursRemaining)
    if (minutes > currentPool) {
      toast.error('Insufficient pool credits', `You can only allocate up to ${currentPool} minutes`)
      return { success: false }
    }
    try {
      const result = await auth.allocateOrganizationCredits(Number(orgId), userId, minutes)
      if (result.success) {
        toast.success('Credits allocated', `${minutes} minutes allocated successfully`)
        await loadOrganization()
      } else {
        toast.error('Allocation failed', result.error || 'Failed to allocate credits')
      }
      return result
    } catch (err: any) {
      toast.error('Allocation failed', err.message)
      return { success: false, error: err.message }
    }
  }, [orgId, auth, toast, loadOrganization])

  const deleteOrg = useCallback(async () => {
    if (!orgId) return { success: false }
    try {
      await auth.deleteOrganization(Number(orgId))
      return { success: true }
    } catch (err: any) {
      toast.error('Delete failed', err.message)
      return { success: false, error: err.message }
    }
  }, [orgId, auth, toast])

  const uploadLogo = useCallback(async (file: File) => {
    if (!orgId) return { success: false, error: 'No organization ID' }
    try {
      const result = await uploadOrganizationLogo(Number(orgId), file)
      if (result.success && result.logo_url) {
        const current = getOrCreateState(orgId)
        if (current.organization) {
          updateState(orgId, { organization: { ...current.organization, logo_url: result.logo_url } })
        }
        toast.success('Logo uploaded', 'Organization logo updated successfully')
      } else {
        toast.error('Upload failed', result.error || 'Failed to upload logo')
      }
      return result
    } catch (err: any) {
      toast.error('Upload failed', err.message)
      return { success: false, error: err.message }
    }
  }, [orgId, toast])

  const fetchPricing = useCallback(async () => {
    try {
      const response = await api.get<any>('/pricing')
      if (response.success) {
        return { success: true, packs: response.packs, solUsdRate: response.sol_usd_rate, companyWallet: response.company_wallet_address }
      }
      return { success: false }
    } catch {
      return { success: false }
    }
  }, [])

  // Utility functions
  const formatDate = useCallback((dateStr: string) => new Date(dateStr).toLocaleDateString(), [])
  const formatAllocation = useCallback((value: string | undefined): string => {
    if (!value) return '0'
    const num = parseFloat(value)
    return isNaN(num) ? '0' : Math.round(num).toString()
  }, [])
  const isOrgCreatedUser = useCallback((member: OrganizationMember) => {
    return member.user?.created_by_organization_id === Number(orgId)
  }, [orgId])

  // Force refresh when org ID changes
  useEffect(() => {
    if (orgId && orgId !== prevOrgId.current) {
      prevOrgId.current = orgId
      loadOrganization(true)
    }
  }, [orgId, loadOrganization])

  return {
    // State
    loading: state.loading,
    error: state.error,
    organization: state.organization,
    members: state.members,
    invitations: state.invitations,
    credits: state.credits,
    myAllocation: state.myAllocation,
    role: state.role,
    organizationId: orgId,
    orgLoaded: state.orgLoaded,

    // Subscription
    subscription: state.subscription,
    subscriptionLoading: state.subscriptionLoading,

    // Creator profiles
    creatorProfiles: state.creatorProfiles,
    profilesLoading: state.profilesLoading,
    profilesLoaded: state.profilesLoaded,

    // Assets
    orgAssets: state.orgAssets,
    assetsLoading: state.assetsLoading,
    assetsLoaded: state.assetsLoaded,

    // Transactions
    transactions: state.transactions,
    transactionsLoading: state.transactionsLoading,
    transactionsTotal: state.transactionsTotal,
    transactionsPage: state.transactionsPage,
    transactionsPerPage: TRANSACTIONS_PER_PAGE,
    transactionsLoaded: state.transactionsLoaded,
    totalTransactionPages,

    // Computed
    isAdmin,
    isOwner,
    poolBalance,
    hasActiveSubscription,
    totalSeats,
    currentMembers,
    seatsRemaining,
    canAddMembers,

    // Functions
    loadOrganization,
    loadSubscription,
    loadCreatorProfiles,
    loadOrgAssets,
    loadTransactions,
    updateOrganization: updateOrg,
    cancelInvitation,
    resendInvitation,
    removeMember,
    updateMemberRole,
    updateMemberAccount,
    allocateCredits,
    deleteOrganization: deleteOrg,
    uploadLogo,
    fetchPricing,
    isOrgCreatedUser,

    // Utility
    formatDate,
    formatAllocation,
  }
}
