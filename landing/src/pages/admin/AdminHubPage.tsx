import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  FileText,
  Handshake,
  Headset,
  KeyRound,
  MessageSquare,
  Percent,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  UserPlus,
  Users,
  Building2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useAuth } from '@/hooks/useAuth'
import { getAdminUnreadSupportCount } from '@/services/adminApi'

interface HubTool {
  id: string
  title: string
  description: string
  icon: LucideIcon
  route: string
  badge?: number
}

function ToolGrid({ title, tools }: { title: string; tools: HubTool[] }) {
  if (!tools.length) return null
  return (
    <section>
      <h2 className="m-0 mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {tools.map((tool) => {
          const Icon = tool.icon
          return (
            <Link
              key={tool.id}
              to={tool.route}
              className="no-underline border border-zinc-800 rounded-xl bg-zinc-900/40 hover:bg-zinc-900/70 hover:border-zinc-700 transition-colors p-4 flex items-start gap-3"
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 text-cyan-400 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                {tool.badge && tool.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {tool.badge > 99 ? '99+' : tool.badge}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="m-0 text-sm font-semibold text-white">{tool.title}</h3>
                <p className="m-0 mt-1 text-xs text-zinc-400 leading-relaxed">{tool.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export function AdminHubPage() {
  const { user } = useAuth()
  const [supportUnread, setSupportUnread] = useState(0)
  const isAdmin = Boolean(user?.is_admin)
  const isModerator = Boolean(user?.is_moderator)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const count = await getAdminUnreadSupportCount()
        if (!cancelled) setSupportUnread(count)
      } catch {
        if (!cancelled) setSupportUnread(0)
      }
    }
    load()
    const interval = window.setInterval(load, 30000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const usersTools = useMemo<HubTool[]>(() => {
    const tools: HubTool[] = []
    if (isAdmin) {
      tools.push(
        {
          id: 'users',
          title: 'Users',
          description: 'Manage user accounts, roles, credits, and subscriptions',
          icon: Users,
          route: '/admin/users',
        },
        {
          id: 'organizations',
          title: 'Organizations',
          description: 'Manage organizations, subscriptions, and credits',
          icon: Building2,
          route: '/admin/organizations',
        },
      )
    }
    if (isAdmin || isModerator) {
      tools.push({
        id: 'org-applications',
        title: 'Org Applications',
        description: 'Review and process organization applications',
        icon: FileText,
        route: '/admin/org-applications',
      })
    }
    return tools
  }, [isAdmin, isModerator])

  const contentTools = useMemo<HubTool[]>(
    () =>
      isAdmin || isModerator
        ? [
            {
              id: 'bug-reports',
              title: 'Bug Reports',
              description: 'Track and triage user-reported issues',
              icon: FileText,
              route: '/admin/bug-reports',
            },
            {
              id: 'ai-usage',
              title: 'AI Usage',
              description: 'Monitor AI token and provider usage',
              icon: Activity,
              route: '/admin/ai-usage',
            },
            {
              id: 'analytics',
              title: 'Analytics',
              description: 'Review platform-level event analytics',
              icon: BarChart3,
              route: '/admin/analytics',
            },
            {
              id: 'customer-service',
              title: 'Customer Service',
              description: 'Manage support conversations',
              icon: Headset,
              route: '/admin/customer-service',
              badge: supportUnread || undefined,
            },
            {
              id: 'staff-messages',
              title: 'Staff Messages',
              description: 'Internal moderator/admin messaging',
              icon: MessageSquare,
              route: '/admin/staff-messages',
            },
          ]
        : [],
    [isAdmin, isModerator, supportUnread],
  )

  const revenueTools = useMemo<HubTool[]>(
    () =>
      isAdmin
        ? [
            {
              id: 'affiliates',
              title: 'Affiliates',
              description: 'Manage affiliates, referrals, and payouts',
              icon: Handshake,
              route: '/admin/affiliates',
            },
          ]
        : [],
    [isAdmin],
  )

  const systemTools = useMemo<HubTool[]>(
    () =>
      isAdmin
        ? [
            {
              id: 'beta-codes',
              title: 'Beta Codes',
              description: 'Generate and manage beta access codes',
              icon: KeyRound,
              route: '/admin/beta-codes',
            },
            {
              id: 'discount-codes',
              title: 'Discount Codes',
              description: 'Create and manage promo codes',
              icon: Percent,
              route: '/admin/discount-codes',
            },
            {
              id: 'waitlist',
              title: 'Waitlist',
              description: 'View waitlist signups and conversion status',
              icon: UserPlus,
              route: '/admin/waitlist',
            },
            {
              id: 'mod-logs',
              title: 'Moderator Logs',
              description: 'Audit moderator actions across the platform',
              icon: ScrollText,
              route: '/admin/mod-logs',
            },
            {
              id: 'settings',
              title: 'Settings',
              description: 'Feature flags and admin platform settings',
              icon: Settings,
              route: '/admin/settings',
            },
          ]
        : [],
    [isAdmin],
  )

  return (
    <PageLayout
      icon={ShieldCheck}
      title="Admin Panel"
      badge={
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
            isModerator && !isAdmin ? 'bg-amber-500/15 text-amber-300' : 'bg-violet-500/15 text-violet-300'
          }`}
        >
          <Shield className="inline-block w-3 h-3 mr-1" />
          {isModerator && !isAdmin ? 'Moderator' : 'Admin'}
        </span>
      }
    >
      <div className="p-6 max-w-[1400px] w-full mx-auto space-y-6">
        <div>
          <h1 className="m-0 text-2xl font-bold text-white">Administration Dashboard</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">Manage users, organizations, and system operations</p>
        </div>

        <ToolGrid title="Users & Access" tools={usersTools} />
        <ToolGrid title="Content & Reports" tools={contentTools} />
        <ToolGrid title="Revenue" tools={revenueTools} />
        <ToolGrid title="System" tools={systemTools} />
      </div>
    </PageLayout>
  )
}
