import { Outlet } from 'react-router-dom'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { useOrganization } from '@/hooks/useOrganization'

export function DashboardLayout() {
  const { subscription, error, isAdmin } = useOrganization()
  const status = subscription?.status
  const isSubscriptionBlocked =
    !isAdmin && (error === 'subscription_required' || status === 'none' || status === 'expired')

  if (isSubscriptionBlocked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0b] px-6">
        <div className="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-900/70 p-8 text-center">
          <h1 className="m-0 text-2xl font-bold text-white">Subscription Required</h1>
          <p className="mt-3 mb-0 text-zinc-300">
            Your organization needs an active subscription before members can access this dashboard.
          </p>
          <p className="mt-2 mb-0 text-sm text-zinc-400">
            Please ask an organization admin to purchase a plan in the Clippster desktop app (Tauri).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#0a0a0b]">
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </main>
    </div>
  )
}
