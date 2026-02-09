import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
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
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Tool {
  id: string
  title: string
  description: string
  icon: LucideIcon
  route: string
  stat?: number | string
  statLabel?: string
}

function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon
  return (
    <Link
      to={tool.route}
      className="group relative flex overflow-hidden rounded-[10px] border border-zinc-800 bg-zinc-900/60 no-underline transition-all duration-[180ms] ease-out hover:-translate-y-0.5 hover:border-white/10 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] active:translate-y-0 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-cyan-400 before:opacity-0 before:transition-opacity before:duration-[180ms] hover:before:opacity-100"
    >
      <div className="flex flex-1 items-center gap-3.5 px-[1.125rem] py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.04] transition-all duration-[180ms] group-hover:bg-white/[0.08] group-hover:scale-105">
          <Icon className="h-5 w-5 text-zinc-500 transition-colors duration-[180ms] group-hover:text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-200 mb-1 m-0 transition-colors duration-[180ms] group-hover:text-white">
            {tool.title}
          </h3>
          <p className="text-xs text-zinc-500 m-0 leading-[1.4] line-clamp-1">{tool.description}</p>
        </div>
        {tool.stat !== undefined && (
          <div className="flex flex-col items-end shrink-0 ml-auto pl-3 min-w-[48px]">
            <span className="text-lg font-bold text-zinc-200 tabular-nums leading-none transition-colors duration-[180ms] group-hover:text-cyan-400">
              {tool.stat}
            </span>
            <span className="text-[0.5625rem] text-zinc-500 uppercase tracking-[0.05em] mt-[3px]">
              {tool.statLabel}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}

function ToolSection({ title, tools }: { title: string; tools: Tool[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[0.6875rem] font-semibold text-zinc-500 m-0 tracking-[0.05em] uppercase">
        {title}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 min-[1400px]:grid-cols-4 min-[1800px]:grid-cols-5 gap-3.5">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </section>
  )
}

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

  useEffect(() => {
    loadOrganization()
  }, [loadOrganization])

  useEffect(() => {
    if (!profilesLoaded) loadCreatorProfiles()
    if (!assetsLoaded) loadOrgAssets()
  }, [profilesLoaded, assetsLoaded, loadCreatorProfiles, loadOrgAssets])

  const teamTools: Tool[] = [
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
  ]

  const contentTools: Tool[] = [
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

  const managementTools: Tool[] = [
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
      title={organization?.name || 'Organization'}
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
          {/* Page Heading */}
          <div>
            <h1 className="text-2xl font-bold text-white mb-[0.2rem] tracking-[-0.02em]">
              Manage Your Organization
            </h1>
            <p className="text-sm text-zinc-500 leading-relaxed m-0">
              {organization?.description || 'Access team tools, content management, and settings'}
            </p>
          </div>

          <ToolSection title="Team" tools={teamTools} />
          <ToolSection title="Content" tools={contentTools} />
          <ToolSection title="Management" tools={managementTools} />
        </div>
      )}
    </PageLayout>
  )
}
