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
  LogOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

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
      { label: 'Shared Clips', icon: Share2, path: 'shared' },
      { label: 'Social Accounts', icon: Globe, path: 'social' },
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
  return user.email.slice(0, 2).toUpperCase()
}

export function DashboardSidebar() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  function isActive(path: string): boolean {
    const fullPath = `/dashboard/org/${id}/${path}`
    // Hub is also active for the index route
    if (path === 'hub') {
      return location.pathname === `/dashboard/org/${id}` || location.pathname === fullPath || location.pathname.startsWith(fullPath + '/')
    }
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/')
  }

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <aside className="flex flex-col w-60 border-r border-zinc-800 bg-[#0a0a0b] shrink-0">
      {/* Logo */}
      <div className="p-3">
        <Link
          to="/"
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors no-underline"
        >
          <img src="/logo-icon.svg" alt="Clippster" className="w-8 h-8 rounded-lg shrink-0" />
          <img src="/logo.svg" alt="Clippster" className="h-4" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col p-3 gap-4">
          {navGroups.map((group, groupIndex) => (
            <div key={group.header} className="flex flex-col gap-1">
              {/* Group Label */}
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500/70 pt-2 px-3 pb-1">
                {group.header}
              </div>

              {/* Navigation Items */}
              <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.path)
                  const Icon = item.icon
                  return (
                    <li key={item.path}>
                      <Link
                        to={`/dashboard/org/${id}/${item.path}`}
                        className={`flex items-center gap-3 w-full py-2 px-3 rounded-md text-sm no-underline transition-all duration-150 cursor-pointer ${
                          active
                            ? 'bg-cyan-500/[0.08] text-cyan-400'
                            : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200'
                        }`}
                      >
                        <Icon className="w-[18px] h-[18px] shrink-0" />
                        <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer: User Profile */}
      <div className="border-t border-zinc-800 p-[0.3rem]">
        {user && (
          <div className="flex items-center gap-2 w-full py-2 px-2 rounded-md">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name || user.email}
                className="w-7 h-7 rounded-[20px] object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-[20px] bg-cyan-400 flex items-center justify-center shrink-0">
                <span className="text-xs font-extrabold text-[#0a0a0b] uppercase">
                  {getInitials(user)}
                </span>
              </div>
            )}
            <span className="flex-1 text-xs text-left whitespace-nowrap overflow-hidden text-ellipsis text-zinc-500" title={user.email}>
              {user.email}
            </span>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer border-none bg-transparent"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
