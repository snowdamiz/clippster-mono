import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
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
import { HubToolSection, type HubTool } from '@/components/dashboard/HubToolSection'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useAuth } from '@/hooks/useAuth'
import { getAdminUnreadSupportCount } from '@/services/adminApi'

function getAdminBasePath(pathname: string): '/admin' | '/dashboard/admin' {
  return pathname.startsWith('/dashboard/admin') ? '/dashboard/admin' : '/admin'
}

export function AdminHubPage() {
  const location = useLocation()
  const { user } = useAuth()
  const [supportUnread, setSupportUnread] = useState(0)
  const isAdmin = Boolean(user?.is_admin)
  const isModerator = Boolean(user?.is_moderator)
  const adminBasePath = getAdminBasePath(location.pathname)

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
          route: `${adminBasePath}/users`,
        },
        {
          id: 'organizations',
          title: 'Organizations',
          description: 'Manage organizations, subscriptions, and credits',
          icon: Building2,
          route: `${adminBasePath}/organizations`,
        },
      )
    }
    if (isAdmin || isModerator) {
      tools.push({
        id: 'org-applications',
        title: 'Org Applications',
        description: 'Review and process organization applications',
        icon: FileText,
        route: `${adminBasePath}/org-applications`,
      })
    }
    return tools
  }, [adminBasePath, isAdmin, isModerator])

  const contentTools = useMemo<HubTool[]>(
    () =>
      isAdmin || isModerator
        ? [
            {
              id: 'bug-reports',
              title: 'Bug Reports',
              description: 'Track and triage user-reported issues',
              icon: FileText,
              route: `${adminBasePath}/bug-reports`,
            },
            {
              id: 'ai-usage',
              title: 'AI Usage',
              description: 'Monitor AI token and provider usage',
              icon: Activity,
              route: `${adminBasePath}/ai-usage`,
            },
            {
              id: 'analytics',
              title: 'Analytics',
              description: 'Review platform-level event analytics',
              icon: BarChart3,
              route: `${adminBasePath}/analytics`,
            },
            {
              id: 'customer-service',
              title: 'Customer Service',
              description: 'Manage support conversations',
              icon: Headset,
              route: `${adminBasePath}/customer-service`,
              stat: supportUnread || undefined,
              statLabel: 'unread',
            },
            {
              id: 'staff-messages',
              title: 'Staff Messages',
              description: 'Internal moderator/admin messaging',
              icon: MessageSquare,
              route: `${adminBasePath}/staff-messages`,
            },
          ]
        : [],
    [adminBasePath, isAdmin, isModerator, supportUnread],
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
              route: `${adminBasePath}/affiliates`,
            },
          ]
        : [],
    [adminBasePath, isAdmin],
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
              route: `${adminBasePath}/beta-codes`,
            },
            {
              id: 'discount-codes',
              title: 'Discount Codes',
              description: 'Create and manage promo codes',
              icon: Percent,
              route: `${adminBasePath}/discount-codes`,
            },
            {
              id: 'waitlist',
              title: 'Waitlist',
              description: 'View waitlist signups and conversion status',
              icon: UserPlus,
              route: `${adminBasePath}/waitlist`,
            },
            {
              id: 'mod-logs',
              title: 'Moderator Logs',
              description: 'Audit moderator actions across the platform',
              icon: ScrollText,
              route: `${adminBasePath}/mod-logs`,
            },
            {
              id: 'settings',
              title: 'Settings',
              description: 'Feature flags and admin platform settings',
              icon: Settings,
              route: `${adminBasePath}/settings`,
            },
          ]
        : [],
    [adminBasePath, isAdmin],
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
      <div className="flex flex-col gap-6 p-6 max-w-[1400px] mx-auto w-full">
        <div>
          <h1 className="text-2xl font-bold text-white mb-[0.2rem] tracking-[-0.02em] m-0">Administration Dashboard</h1>
          <p className="text-sm text-zinc-500 leading-relaxed m-0">Manage users, organizations, and system operations</p>
        </div>

        <HubToolSection title="Users & Access" tools={usersTools} />
        <HubToolSection title="Content & Reports" tools={contentTools} />
        <HubToolSection title="Revenue" tools={revenueTools} />
        <HubToolSection title="System" tools={systemTools} />
      </div>
    </PageLayout>
  )
}
