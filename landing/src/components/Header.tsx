import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Apple, Building2, ChevronDown, Loader2, LogOut, Menu, Monitor, User, X } from 'lucide-react'
import { useDownloads } from '../hooks/usePlatform'
import { trackDownloadClick, trackLandingEvent } from '@/services/landingAnalytics'
import { getPagesByType } from '@/seo/content'
import { useAuth } from '@/hooks/useAuth'
import { useAuthDialog } from '@/context/AuthDialogContext'
import { getOrgDashboardPath } from '@/lib/accountRouting'

const navLinks: { href: string; label: string; isPage?: boolean }[] = [
  { href: '/', label: 'Home', isPage: true },
  { href: '/clipping-tool', label: 'Clipping Tool', isPage: true },
  { href: '/live-stream-clipping', label: 'Live Clipping', isPage: true },
  { href: '/video-editor', label: 'Editor', isPage: true },
  { href: '/clipping-campaigns', label: 'Campaigns', isPage: true },
  { href: '/vs/opus-clip', label: 'Compare', isPage: true },
  { href: '/guides/how-to-clip-twitch-streams', label: 'Guides', isPage: true },
  { href: '/pricing', label: 'Pricing', isPage: true },
]

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const { primaryDownload, otherDownloads, isLoading } = useDownloads()
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user, logout, authChecked } = useAuth()
  const { openAuthDialog } = useAuthDialog()

  const secondaryDownload = otherDownloads[0]
  const orgPath = getOrgDashboardPath(user)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!accountMenuRef.current?.contains(e.target as Node)) {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const handleNavClick = (href: string, isPage?: boolean) => {
    if (isPage) return
    if (location.pathname !== '/') {
      navigate('/' + href)
      return
    }
    const element = document.querySelector(href)
    if (element) element.scrollIntoView({ behavior: 'smooth' })
  }

  const trackNavClick = (href: string, label: string, source: string) => {
    trackLandingEvent(href === '/pricing' ? 'landing_pricing_click' : 'landing_nav_click', {
      source,
      button_label: label,
      path: href,
    })
  }

  const authButtons = (
    <>
      {authChecked && isAuthenticated && user ? (
        <div className="relative" ref={accountMenuRef}>
          <button
            type="button"
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1f1f23] bg-[#141416] text-sm text-zinc-200 hover:border-cyan-500/40"
          >
            <User className="w-4 h-4 text-cyan-400" />
            <span className="max-w-[120px] truncate">{user.name || user.email}</span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          </button>
          {accountMenuOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-lg border border-[#1f1f23] bg-[#141416] shadow-xl py-1 z-50">
              <Link
                to="/account"
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                onClick={() => setAccountMenuOpen(false)}
              >
                <User className="w-4 h-4" />
                Account
              </Link>
              {orgPath && (
                <Link
                  to={orgPath}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                  onClick={() => setAccountMenuOpen(false)}
                >
                  <Building2 className="w-4 h-4" />
                  Organization
                </Link>
              )}
              {primaryDownload && (
                <a
                  href={primaryDownload.downloadUrl}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
                  onClick={() => {
                    setAccountMenuOpen(false)
                    trackDownloadClick(primaryDownload, 'header_account_menu', 'Download app')
                  }}
                >
                  <Monitor className="w-4 h-4" />
                  Download app
                </a>
              )}
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/5"
                onClick={() => {
                  setAccountMenuOpen(false)
                  logout()
                  navigate('/')
                }}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            trackLandingEvent('landing_signin_click', { source: 'header' })
            openAuthDialog()
          }}
          className="px-3 py-2 text-sm rounded-lg border border-[#1f1f23] text-zinc-200 hover:border-cyan-500/40 hover:text-white transition-colors"
        >
          Sign in
        </button>
      )}
    </>
  )

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        isScrolled ? 'bg-[#0a0a0b]/80 backdrop-blur-lg border-b border-[#1f1f23]' : 'border-b border-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo-icon.svg" alt="Clippster" className="w-6 h-6" />
            <img src="/logo.svg" alt="Clippster" className="h-5 mt-1" />
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) =>
              link.isPage ? (
                <Link
                  key={link.href}
                  to={link.href}
                  className="px-3 py-2 text-zinc-400 hover:text-white transition-colors text-sm"
                  onClick={() => trackNavClick(link.href, link.label, 'header_desktop_nav')}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault()
                    trackNavClick(link.href, link.label, 'header_desktop_nav')
                    handleNavClick(link.href)
                  }}
                  className="px-3 py-2 text-zinc-400 hover:text-white transition-colors text-sm"
                >
                  {link.label}
                </a>
              ),
            )}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {authButtons}
            {isLoading ? (
              <div className="px-5 py-2.5 rounded-lg bg-[#141416] border border-[#1f1f23] text-zinc-300 font-medium text-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
              </div>
            ) : primaryDownload ? (
              <>
                {secondaryDownload && (
                  <a
                    href={secondaryDownload.downloadUrl}
                    className="p-2 text-zinc-400 hover:text-cyan-400 transition-colors"
                    title={`Download for ${secondaryDownload.label}`}
                    onClick={() =>
                      trackDownloadClick(secondaryDownload, 'header_desktop_secondary', secondaryDownload.label)
                    }
                  >
                    {secondaryDownload.platform.os === 'mac' ? (
                      <Apple className="w-4 h-4" />
                    ) : (
                      <Monitor className="w-4 h-4" />
                    )}
                  </a>
                )}
                <a
                  href={primaryDownload.downloadUrl}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium text-sm hover:from-cyan-400 hover:to-cyan-500 transition-all flex items-center gap-2"
                  onClick={() =>
                    trackDownloadClick(
                      primaryDownload,
                      'header_desktop_primary',
                      `Download for ${primaryDownload.label}`,
                    )
                  }
                >
                  {primaryDownload.platform.os === 'mac' ? (
                    <Apple className="w-4 h-4" />
                  ) : (
                    <Monitor className="w-4 h-4" />
                  )}
                  Download
                </a>
              </>
            ) : null}
            <button
              type="button"
              className="lg:hidden p-2 text-zinc-400"
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              aria-label="Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          <button
            type="button"
            className="md:hidden p-2 text-zinc-400"
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="border-t border-[#1f1f23] bg-[#0a0a0b] lg:hidden">
          <nav className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="px-4 py-3 text-zinc-300 hover:text-white hover:bg-[rgba(255,255,255,0.05)] rounded-lg transition-colors"
                onClick={() => {
                  trackNavClick(link.href, link.label, 'header_mobile_nav')
                  setIsMobileMenuOpen(false)
                }}
              >
                {link.label}
              </Link>
            ))}
            <div className="px-4 py-3 flex flex-col gap-2 border-t border-[#1f1f23] mt-2 pt-4">
              {authChecked && isAuthenticated && user ? (
                <>
                  <Link
                    to="/account"
                    className="px-4 py-2 rounded-lg bg-[#141416] text-zinc-200 text-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Account
                  </Link>
                  <button
                    type="button"
                    className="px-4 py-2 text-left text-sm text-red-400"
                    onClick={() => {
                      setIsMobileMenuOpen(false)
                      logout()
                      navigate('/')
                    }}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-[#1f1f23] text-sm text-zinc-200"
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    openAuthDialog()
                  }}
                >
                  Sign in
                </button>
              )}
            </div>
            {getPagesByType('platform')
              .slice(0, 3)
              .map((page) => (
                <Link
                  key={page.path}
                  to={page.path}
                  className="px-4 py-3 text-zinc-400 text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {page.title.split('|')[0].trim()}
                </Link>
              ))}
          </nav>
        </div>
      )}
    </header>
  )
}
