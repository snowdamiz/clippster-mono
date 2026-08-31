import { Outlet, useParams, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { useOrganization } from '@/hooks/useOrganization'
import { OrganizationSetupDialog } from '@/components/organization/OrganizationSetupDialog'
import { AppTourOverlay } from '@/components/tour/AppTourOverlay'
import { useAppTour } from '@/hooks/useAppTour'
import { api } from '@/lib/api'
import './DashboardLayout.css'

export function DashboardLayout() {
  const { id } = useParams()
  const location = useLocation()
  const { subscription, error, isAdmin, organization, role, loadOrganization } = useOrganization()
  const [showSetupDialog, setShowSetupDialog] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const initDone = useRef(false)
  const { maybeStartLandingOrgTour, prefsLoaded } = useAppTour()

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const status = subscription?.status
  const isSubscriptionBlocked =
    !isAdmin && (error === 'subscription_required' || status === 'none' || status === 'expired')

  const needsSetup =
    organization &&
    !(organization as any)?.setup_completed &&
    role === 'owner' &&
    ((organization as any)?.admin_price_cents || 0) > 0

  useEffect(() => {
    if (!id || initDone.current) return
    initDone.current = true

    const run = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const returning = urlParams.get('setup') === 'complete'
      const sessionId = urlParams.get('session_id')

      if (returning) {
        window.history.replaceState({}, '', window.location.pathname)

        if (sessionId) {
          try {
            await api.post(`/organizations/${id}/payments/stripe/confirm-setup`, {
              session_id: sessionId,
            })
          } catch (err) {
            console.warn('[DashboardLayout] confirm-setup failed, webhook will handle it:', err)
          }
        }
      }

      await loadOrganization(returning)

      const org = organization
      const setupRequired =
        org &&
        !(org as any)?.setup_completed &&
        role === 'owner' &&
        ((org as any)?.admin_price_cents || 0) > 0

      if (setupRequired) setShowSetupDialog(true)
      setIsReady(true)
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!isReady) return
    if (needsSetup) setShowSetupDialog(true)
  }, [needsSetup, isReady])

  useEffect(() => {
    if (!isReady || showSetupDialog || isSubscriptionBlocked || !prefsLoaded) return
    maybeStartLandingOrgTour()
  }, [isReady, showSetupDialog, isSubscriptionBlocked, prefsLoaded, maybeStartLandingOrgTour])

  const handleSetupComplete = async () => {
    setShowSetupDialog(false)
    await loadOrganization(true)
  }

  if (isSubscriptionBlocked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0b] px-6">
        <div className="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-900/70 p-8 text-center">
          <h1 className="m-0 text-2xl font-bold text-white">Subscription Required</h1>
          <p className="mt-3 mb-0 text-zinc-300">
            Your organization needs an active subscription before members can access this dashboard.
          </p>
          <p className="mt-2 mb-0 text-sm text-zinc-400">
            Please ask an organization admin to purchase a plan in the Clippster desktop app.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#0a0a0b]">
      <header className="dashboard-mobile-header">
        <button
          className="dashboard-mobile-header__toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <img src="/logo-icon.svg" alt="Clippster" className="dashboard-mobile-header__logo" />
        <img src="/logo.svg" alt="Clippster" className="dashboard-mobile-header__wordmark" />
      </header>

      {mobileMenuOpen && (
        <div className="dashboard-mobile-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      <div className={`dashboard-sidebar-wrapper ${mobileMenuOpen ? 'dashboard-sidebar-wrapper--open' : ''}`}>
        <DashboardSidebar onNavigate={() => setMobileMenuOpen(false)} />
      </div>

      <main className="dashboard-main">{isReady && !showSetupDialog && <Outlet />}</main>

      <OrganizationSetupDialog
        show={showSetupDialog}
        organization={organization}
        onSetupComplete={handleSetupComplete}
      />

      <AppTourOverlay />
    </div>
  )
}
