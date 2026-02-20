import { Link, useLocation } from 'react-router-dom'
import {
  BarChart3,
  Building2,
  FileText,
  Handshake,
  KeyRound,
  LayoutGrid,
  ListChecks,
  MessageSquare,
  Percent,
  Settings,
  Shield,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface AdminNavItem {
  label: string
  path: string
  icon: LucideIcon
  adminOnly?: boolean
}

const navItems: AdminNavItem[] = [
  { label: 'Hub', path: '/admin', icon: LayoutGrid },
  { label: 'Users', path: '/admin/users', icon: Users, adminOnly: true },
  { label: 'Organizations', path: '/admin/organizations', icon: Building2, adminOnly: true },
  { label: 'Org Applications', path: '/admin/org-applications', icon: FileText },
  { label: 'Bug Reports', path: '/admin/bug-reports', icon: ListChecks },
  { label: 'AI Usage', path: '/admin/ai-usage', icon: BarChart3 },
  { label: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
  { label: 'Beta Codes', path: '/admin/beta-codes', icon: KeyRound, adminOnly: true },
  { label: 'Discount Codes', path: '/admin/discount-codes', icon: Percent, adminOnly: true },
  { label: 'Waitlist', path: '/admin/waitlist', icon: Users, adminOnly: true },
  { label: 'Affiliates', path: '/admin/affiliates', icon: Handshake, adminOnly: true },
  { label: 'Customer Service', path: '/admin/customer-service', icon: MessageSquare },
  { label: 'Staff Messages', path: '/admin/staff-messages', icon: MessageSquare },
  { label: 'Mod Logs', path: '/admin/mod-logs', icon: Shield, adminOnly: true },
  { label: 'Settings', path: '/admin/settings', icon: Settings, adminOnly: true },
]

export function AdminSidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const isAdmin = Boolean(user?.is_admin)

  return (
    <aside className="w-64 shrink-0 h-screen border-r border-zinc-800 bg-[#0a0a0b] flex flex-col">
      <div className="p-3 border-b border-zinc-800">
        <Link to="/admin" className="no-underline flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800/60">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
            <Shield className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <p className="m-0 text-sm text-white font-semibold leading-tight">Admin</p>
            <p className="m-0 text-[11px] text-zinc-500 leading-tight">Clippster Control</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="m-0 p-0 list-none flex flex-col gap-1">
          {navItems
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => {
              const active =
                location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(`${item.path}/`))
              const Icon = item.icon
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`no-underline flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      active ? 'bg-cyan-500/10 text-cyan-400' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
        </ul>
      </nav>

      <div className="border-t border-zinc-800 p-3">
        <p className="m-0 text-xs text-zinc-500 truncate">{user?.email ?? 'Unknown user'}</p>
        <button
          onClick={logout}
          className="mt-2 w-full border border-zinc-700 bg-transparent text-zinc-300 text-xs rounded-md px-2 py-1.5 cursor-pointer hover:bg-zinc-800"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
