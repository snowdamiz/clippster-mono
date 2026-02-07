import { useState, useEffect } from 'react'
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutGrid,
  Users,
  UserCircle,
  Megaphone,
  Scissors,
  Share2,
  Globe,
  FileText,
  FolderOpen,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { OrgSelector } from '@/components/dashboard/OrgSelector'

const STORAGE_KEY = 'sidebar_collapsed'

interface NavItem {
  label: string
  icon: LucideIcon
  path: string
}

interface NavGroup {
  header: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    header: 'Team',
    items: [
      { label: 'Hub', icon: LayoutGrid, path: 'hub' },
      { label: 'Members', icon: Users, path: 'members' },
      { label: 'Creators', icon: UserCircle, path: 'creators' },
    ],
  },
  {
    header: 'Content',
    items: [
      { label: 'Campaigns', icon: Megaphone, path: 'campaigns' },
      { label: 'Clippers', icon: Scissors, path: 'clippers' },
      { label: 'Shared Clips', icon: Share2, path: 'shared-clips' },
      { label: 'Social Accounts', icon: Globe, path: 'social-accounts' },
      { label: 'Posts', icon: FileText, path: 'posts' },
    ],
  },
  {
    header: 'Management',
    items: [
      { label: 'Assets', icon: FolderOpen, path: 'assets' },
      { label: 'Billing', icon: CreditCard, path: 'billing' },
      { label: 'Settings', icon: Settings, path: 'settings' },
    ],
  },
]

function getInitials(user: { name?: string; email: string }): string {
  if (user.name) {
    return user.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  return user.email.charAt(0).toUpperCase()
}

export function DashboardSidebar() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed))
    } catch {
      // ignore
    }
  }, [collapsed])

  function isActive(path: string): boolean {
    const fullPath = `/dashboard/org/${id}/${path}`
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/')
  }

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <aside
      className={`flex flex-col border-r border-zinc-800 bg-zinc-900/50 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-[260px]'
      }`}
    >
      {/* Logo + Org Selector */}
      <div className="p-3 space-y-3">
        <Link
          to="/"
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-white">C</span>
          </div>
          {!collapsed && <span className="text-base font-semibold text-white">Clippster</span>}
        </Link>
        <OrgSelector collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
        {navGroups.map((group) => (
          <div key={group.header}>
            {!collapsed && (
              <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {group.header}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.path)
                const Icon = item.icon
                return (
                  <Link
                    key={item.path}
                    to={`/dashboard/org/${id}/${item.path}`}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                      active
                        ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-400'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50 border-l-2 border-transparent'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: User + Collapse */}
      <div className="border-t border-zinc-800 p-3 space-y-2">
        {/* User Section */}
        {user && (
          <div
            className={`flex items-center gap-2.5 px-2 py-2 rounded-lg ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name || user.email}
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                <span className="text-xs font-medium text-zinc-300">
                  {getInitials(user)}
                </span>
              </div>
            )}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                {user.name && (
                  <p className="text-sm font-medium text-white truncate">{user.name}</p>
                )}
                <p className="text-xs text-zinc-500 truncate">{user.email}</p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={handleLogout}
                title="Log out"
                className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={`flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-sm text-zinc-500 hover:text-white hover:bg-zinc-800/50 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
