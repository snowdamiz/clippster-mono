import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Building2,
  CreditCard,
  FileText,
  Globe,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  User,
  X,
  Video,
  Download,
  Users,
  Megaphone,
  CalendarDays,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { DesktopRequiredBanner } from '@/components/account/DesktopRequiredBanner'
import { useAuth } from '@/hooks/useAuth'
import { getOrgDashboardPath, needsPlanSelection } from '@/lib/accountRouting'
import { api } from '@/lib/api'

interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  end?: boolean
  section?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/account', icon: Home, end: true },
  { label: 'My Creators', path: '/account/creators', icon: Users, section: 'Browse' },
  { label: 'Download Video', path: '/account/downloads', icon: Download, section: 'Browse' },
  { label: 'Messages', path: '/account/messages', icon: MessageSquare, section: 'Browse' },
  { label: 'Campaigns', path: '/account/campaigns', icon: Megaphone, section: 'Browse' },
  { label: 'Video Library', path: '/account/videos', icon: Video, section: 'Library' },
  { label: 'Prompts', path: '/account/prompts', icon: MessageSquare, section: 'Manage' },
  { label: 'Calendar', path: '/account/calendar', icon: CalendarDays, section: 'Manage' },
  { label: 'Profile', path: '/account/profile', icon: User, section: 'Manage' },
  { label: 'Social', path: '/account/social', icon: Globe, section: 'Manage' },
  { label: 'Posts', path: '/account/posts', icon: FileText, section: 'Manage' },
  { label: 'Settings', path: '/account/settings', icon: Settings, section: 'Manage' },
  { label: 'Billing', path: '/account/billing', icon: CreditCard, section: 'Manage' },
]

export function AccountLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const gateMode = needsPlanSelection(user)
  const onBilling = location.pathname.startsWith('/account/billing')
  const orgPath = getOrgDashboardPath(user)
  const [featureAccess, setFeatureAccess] = useState({ campaigns: false, restricted: false, prompts: true, loaded: false })
  useEffect(() => {
    let disposed = false
    setFeatureAccess({ campaigns: false, restricted: false, prompts: true, loaded: false })
    Promise.all([api.get('/app-settings/feature-flags'), api.get('/user/restrictions')]).then(([flags, permissions]) => {
      if (!disposed && flags.success && permissions.success) setFeatureAccess({ campaigns: !!flags.feature_flags?.campaigns_enabled, restricted: !!permissions.restricted, prompts: permissions.restrictions?.allow_custom_prompts !== false, loaded: true })
    }).catch(() => {})
    return () => { disposed = true }
  }, [user?.id])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (gateMode && !onBilling) {
      navigate('/account/billing?new_user=true', { replace: true })
    }
  }, [gateMode, onBilling, navigate])

  if (gateMode && !onBilling) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    )
  }

  async function handleSignOut() {
    await fetch('/workspace/api/auth/logout', { method: 'POST', signal: AbortSignal.timeout(5000) }).catch(() => {})
    logout()
    navigate('/')
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium no-underline transition-colors ${
      isActive
        ? 'bg-cyan-500/15 text-cyan-400'
        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
    }`

  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.path === '/account/campaigns' && !(featureAccess.campaigns || user?.is_admin || user?.campaigns_enabled)) return false
    return !(['/account/creators', '/account/calendar', '/account/prompts'].includes(item.path) && (!featureAccess.loaded || featureAccess.restricted && !(item.path === '/account/prompts' && featureAccess.prompts)))
  })
  const sidebar = (
    <aside className="flex flex-col h-full w-60 shrink-0 border-r border-zinc-800 bg-[#0a0a0b]">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-zinc-800">
        <Link to="/account" className="flex items-center gap-2.5 no-underline">
          <img src="/logo-icon.svg" alt="Clippster" className="w-8 h-8 rounded-lg" />
          <img src="/logo.svg" alt="Clippster" className="h-4" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-0.5">
        {visibleItems.map((item, index) => {
          const Icon = item.icon
          if (gateMode && item.path !== '/account/billing') {
            return (
              <span
                key={item.path}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-zinc-600 cursor-not-allowed"
                title="Choose a plan to continue"
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </span>
            )
          }
          return (
            <div key={item.path}>
            {item.section && item.section !== visibleItems[index - 1]?.section && <p className="px-3 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{item.section}</p>}
            <NavLink to={item.path} end={item.end} className={navLinkClass}>
              <Icon className="w-4 h-4" />
              {item.label}
            </NavLink>
            </div>
          )
        })}
      </nav>

      <div className="p-3 border-t border-zinc-800">
        {user && (
          <div className="px-3 mb-2">
            <p className="text-sm text-white font-medium truncate m-0">{user.name || 'Account'}</p>
            <p className="text-xs text-zinc-500 truncate m-0">{user.email}</p>
          </div>
        )}
        {orgPath && (
          <Link
            to={orgPath}
            className="flex items-center gap-2.5 w-full px-3 py-2 mb-1 rounded-lg text-sm font-medium text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800/60 no-underline transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Organization
          </Link>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border-none bg-transparent cursor-pointer transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen bg-[#0a0a0b]">
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-[100] h-14 flex items-center gap-3 px-4 border-b border-zinc-800 bg-[#0a0a0b]">
        <button
          type="button"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="flex items-center justify-center w-10 h-10 rounded-lg border-none bg-transparent text-white cursor-pointer hover:bg-zinc-800"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <img src="/logo-icon.svg" alt="Clippster" className="w-8 h-8 rounded-lg" />
        <img src="/logo.svg" alt="Clippster" className="h-4" />
      </header>

      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-[199] bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="hidden md:flex h-full">{sidebar}</div>

      <div
        className={`md:hidden fixed inset-y-0 left-0 z-[200] transition-transform duration-200 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </div>

      <main className="flex-1 flex flex-col min-h-0 min-w-0 pt-14 md:pt-0">
        <DesktopRequiredBanner />
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
