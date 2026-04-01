import { Outlet, useParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { useOrganization } from '@/hooks/useOrganization'
import { OrganizationSetupDialog } from '@/components/organization/OrganizationSetupDialog'
import { api } from '@/lib/api'

export function DashboardLayout() {
  const { id } = useParams()
  const { subscription, error, isAdmin, organization, role, loadOrganization } = useOrganization()
  const [showSetupDialog, setShowSetupDialog] = useState(false)
  // isReady starts false on every mount so the hub never renders before we've
  // confirmed whether setup is still required.
  const [isReady, setIsReady] = useState(false)
  const initDone = useRef(false)

  const status = subscription?.status
  const isSubscriptionBlocked =
    !isAdmin && (error === 'subscription_required' || status === 'none' || status === 'expired')

  const needsSetup =
    organization &&
    !(organization as any)?.setup_completed &&
    role === 'owner' &&
    ((organization as any)?.admin_price_cents || 0) > 0

  // Initialise: handle Stripe return or plain first-load
  useEffect(() => {
    if (!id || initDone.current) return
    initDone.current = true

    const run = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const returning = urlParams.get('setup') === 'complete'
      const sessionId = urlParams.get('session_id')

      if (returning) {
        window.history.replaceState({}, '', window.location.pathname)

        // Confirm payment server-side using the Stripe session ID so
        // setup_completed is written to the DB immediately, without waiting
        // for the webhook (which requires a forwarding tunnel in dev).
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

      // After load, evaluate setup requirement before allowing hub to render
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

  // Keep dialog in sync if org data updates reactively after load
  useEffect(() => {
    if (!isReady) return
    if (needsSetup) setShowSetupDialog(true)
  }, [needsSetup, isReady])

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
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-h-0">
        {/* Hub only mounts once we've confirmed setup status for this navigation */}
        {isReady && !showSetupDialog && <Outlet />}
      </main>

      {/* Organization Setup Dialog — blocks all dashboard content until paid */}
      <OrganizationSetupDialog
        show={showSetupDialog}
        organization={organization}
        onSetupComplete={handleSetupComplete}
      />
    </div>
  )
}
