import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { HubToolSection, type HubTool } from '@/components/dashboard/HubToolSection'
import { useOrganization } from '@/hooks/useOrganization'
import { OrganizationSelector } from '@/components/dashboard/OrganizationSelector'
import { useOrganizationSelector } from '@/hooks/useOrganizationSelector'
import {
  Building2,
  Users,
  UserCircle,
  UserPlus,
  Target,
  Search,
  Share2,
  Link2,
  Send,
  Package,
  CreditCard,
  Settings,
  Loader2,
  AlertTriangle,
  Briefcase,
} from 'lucide-react'
import { getTotalUnread } from '@/services/messagingApi'
import { api } from '@/lib/api'

function SkeletonCard() {
  return (
    <div className="flex rounded-[10px] border border-zinc-800 bg-zinc-900/60 overflow-hidden pointer-events-none">
      <div className="flex flex-1 items-center gap-3.5 px-[1.125rem] py-4">
        <div className="w-10 h-10 rounded-[10px] bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%] animate-shimmer shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="w-[100px] h-3.5 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%] animate-shimmer rounded" />
          <div className="w-[160px] h-3 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%] animate-shimmer rounded" />
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full">
      {/* Heading skeleton */}
      <div>
        <div className="w-[220px] h-7 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%] animate-shimmer rounded-md mb-2" />
        <div className="w-[360px] max-w-full h-4 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%] animate-shimmer rounded" />
      </div>
      {/* Section skeletons */}
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex flex-col gap-3">
          <div className="w-[60px] h-3 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%] animate-shimmer rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 min-[1400px]:grid-cols-4 min-[1800px]:grid-cols-5 gap-3.5">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function OrgHub() {
  const { id } = useParams()
  const {
    loading,
    error,
    organization,
    members,
    credits,
    role,
    isAdmin,
    loadOrganization,
    formatAllocation,
    creatorProfiles,
    profilesLoaded,
    loadCreatorProfiles,
    orgAssets,
    assetsLoaded,
    loadOrgAssets,
  } = useOrganization()
  const { hasMultipleOrgs } = useOrganizationSelector()
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [setupLoading, setSetupLoading] = useState(false)

  // Open Stripe setup for org payment
  const openStripeSetup = async () => {
    if (!id || !organization) return
    setSetupLoading(true)
    try {
      const response = await api.post(`/organizations/${id}/payments/stripe/setup`)
      if (response.data.success && response.data.url) {
        window.location.href = response.data.url
      } else {
        throw new Error(response.data.error || 'Failed to create payment session')
      }
    } catch (err) {
      console.error('Failed to open Stripe setup:', err)
      // TODO: Show error to user
    } finally {
      setSetupLoading(false)
    }
  }

  useEffect(() => {
    loadOrganization()
  }, [loadOrganization])

  useEffect(() => {
    getTotalUnread().then(setUnreadMessages).catch(() => {})
  }, [])

  useEffect(() => {
    if (!profilesLoaded) loadCreatorProfiles()
    if (!assetsLoaded) loadOrgAssets()
  }, [profilesLoaded, assetsLoaded, loadCreatorProfiles, loadOrgAssets])

  const teamTools: HubTool[] = [
    {
      id: 'members',
      title: 'Members',
      description: 'Manage team, assign roles, and allocate credits',
      icon: Users,
      route: `/dashboard/org/${id}/members`,
      stat: members.length,
      statLabel: 'active',
    },
    {
      id: 'creators',
      title: 'Creators',
      description: 'Manage creator profiles and platform links',
      icon: UserCircle,
      route: `/dashboard/org/${id}/creators`,
      stat: creatorProfiles.length,
      statLabel: 'profiles',
    },
    {
      id: 'hiring',
      title: 'Hiring',
      description: 'Create a hiring post to recruit clippers',
      icon: Briefcase,
      route: `/dashboard/org/${id}/hiring`,
    },
    {
      id: 'messages',
      title: 'Messages',
      description: 'Team messaging and direct conversations',
      icon: Send,
      route: `/dashboard/org/${id}/messages`,
      stat: unreadMessages || undefined,
      statLabel: 'unread',
    },
  ]

  const contentTools: HubTool[] = [
    {
      id: 'campaigns',
      title: 'Campaigns',
      description: 'Run and track clipping campaigns',
      icon: Target,
      route: `/dashboard/org/${id}/campaigns`,
    },
    {
      id: 'clippers',
      title: 'Find Clippers',
      description: 'Discover and recruit talented clippers',
      icon: Search,
      route: `/dashboard/org/${id}/clippers`,
    },
    {
      id: 'shared',
      title: 'Shared Clips',
      description: 'Distribute clips to team members',
      icon: Share2,
      route: `/dashboard/org/${id}/shared`,
    },
    {
      id: 'social',
      title: 'Social Accounts',
      description: 'Manage connected social platforms',
      icon: Link2,
      route: `/dashboard/org/${id}/social`,
    },
    {
      id: 'posts',
      title: 'Post Submissions',
      description: 'Review and approve member posts',
      icon: Send,
      route: `/dashboard/org/${id}/posts`,
    },
  ]

  const managementTools: HubTool[] = [
    {
      id: 'assets',
      title: 'Assets',
      description: 'Intros, outros, watermarks, and media',
      icon: Package,
      route: `/dashboard/org/${id}/assets`,
      stat: orgAssets.length,
      statLabel: 'files',
    },
    {
      id: 'billing',
      title: 'Billing',
      description: 'Billing, Credits, and Subscriptions',
      icon: CreditCard,
      route: `/dashboard/org/${id}/billing`,
      stat: formatAllocation(credits.hoursRemaining),
      statLabel: 'min',
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'Organization profile and preferences',
      icon: Settings,
      route: `/dashboard/org/${id}/settings`,
    },
  ]

  const roleBadge = loading ? (
    <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded bg-zinc-800 text-zinc-500 text-[0.625rem] font-bold uppercase tracking-[0.04em] shrink-0">
      <Loader2 className="w-2.5 h-2.5 animate-spin" />
    </span>
  ) : role ? (
    <span
      className={`inline-flex items-center gap-1 px-2 py-[3px] rounded text-[0.625rem] font-bold uppercase tracking-[0.04em] shrink-0 ${
        role === 'owner'
          ? 'bg-amber-500/15 text-amber-400'
          : role === 'admin'
            ? 'bg-cyan-500/15 text-cyan-400'
            : 'bg-zinc-800 text-zinc-500'
      }`}
    >
      {role}
    </span>
  ) : null

  const headerActions = isAdmin ? (
    <button
      className="flex items-center gap-2 h-8 px-3.5 text-xs font-semibold rounded-md bg-cyan-400 text-[#0a0a0b] border-none cursor-pointer transition-opacity duration-150 hover:opacity-90"
    >
      <UserPlus className="w-3.5 h-3.5" />
      Add Member
    </button>
  ) : null

  return (
    <PageLayout
      icon={Building2}
      title={!hasMultipleOrgs ? (organization?.name || 'Organization') : undefined}
      titleComponent={hasMultipleOrgs ? <OrganizationSelector /> : undefined}
      badge={roleBadge}
      actions={headerActions}
    >
      {/* Error State */}
      {error ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6">
          <div className="flex items-center justify-center w-[72px] h-[72px] bg-red-500/10 rounded-2xl mb-6">
            <AlertTriangle className="w-9 h-9 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Failed to load organization</h2>
          <p className="text-zinc-500 text-sm max-w-[320px] leading-relaxed mb-6">{error}</p>
          <button
            onClick={() => loadOrganization(true)}
            className="px-4 py-2 rounded-md bg-cyan-400 text-[#0a0a0b] text-sm font-semibold border-none cursor-pointer hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      ) : loading && !organization ? (
        <LoadingSkeleton />
      ) : (
        <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full">
          {/* Payment Setup Gate */}
          {!(organization as any)?.setup_completed && role === 'owner' ? (
            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 rounded-xl p-8 text-center max-w-[600px] mx-auto mb-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <CreditCard size={48} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Complete Your Organization Setup</h2>
              <p className="text-zinc-400 leading-relaxed mb-8">
                Your organization has been created with custom billing. Please complete the payment setup to activate your subscription.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-left">
                <div className="flex justify-between items-center p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                  <span className="text-zinc-500 text-sm font-medium">Plan:</span>
                  <span className="text-white text-sm font-semibold">
                    {(organization as any)?.subscription_tier === 'custom' ? 'Custom' : (organization as any)?.subscription_tier || 'Standard'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                  <span className="text-zinc-500 text-sm font-medium">Monthly Price:</span>
                  <span className="text-white text-sm font-semibold">
                    ${(organization as any)?.admin_price_cents ? ((organization as any).admin_price_cents / 100).toFixed(2) : '0.00'}/mo
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                  <span className="text-zinc-500 text-sm font-medium">Seats:</span>
                  <span className="text-white text-sm font-semibold">{(organization as any)?.max_seats || 'Unlimited'}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
                  <span className="text-zinc-500 text-sm font-medium">AI Credits:</span>
                  <span className="text-white text-sm font-semibold">{(organization as any)?.monthly_credits || 0}/mo</span>
                </div>
              </div>
              <button
                className="inline-flex items-center gap-2 h-11 px-6 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-400 to-cyan-500 text-[#0a0a0b] border-none cursor-pointer transition-all duration-150 hover:opacity-90 hover:translate-y-[-1px] disabled:opacity-60 disabled:cursor-not-allowed mb-4"
                onClick={openStripeSetup}
                disabled={setupLoading}
              >
                {setupLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {setupLoading ? 'Redirecting...' : 'Pay Now & Activate'}
              </button>
              <p className="text-zinc-500 text-xs m-0">You'll be redirected to Stripe to set up recurring billing.</p>
            </div>
          ) : (
            /* Page Heading */
            <div>
              <h1 className="text-2xl font-bold text-white mb-[0.2rem] tracking-[-0.02em]">
                Manage Your Organization
              </h1>
              <p className="text-sm text-zinc-500 leading-relaxed m-0">
                {organization?.description || 'Access team tools, content management, and settings'}
              </p>
            </div>
          )}

          <HubToolSection title="Team" tools={teamTools} />
          <HubToolSection title="Content" tools={contentTools} />
          <HubToolSection title="Management" tools={managementTools} />
        </div>
      )}
    </PageLayout>
  )
}
