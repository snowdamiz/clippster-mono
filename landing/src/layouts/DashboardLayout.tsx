import { useEffect } from 'react'
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { useOrganization } from '@/hooks/useOrganization'

export function DashboardLayout() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { subscription, subscriptionLoading, orgLoaded } = useOrganization()

  useEffect(() => {
    if (!id || subscriptionLoading || !orgLoaded) return

    // Exempt billing and subscribe pages from the gate
    const isBillingPage = location.pathname.endsWith('/billing')
    const isSubscribePage = location.pathname.endsWith('/subscribe')
    if (isBillingPage || isSubscribePage) return

    const status = subscription?.status
    if (status === 'none' || status === 'expired') {
      navigate(`/dashboard/org/${id}/subscribe`, { replace: true })
    }
  }, [id, subscription, subscriptionLoading, orgLoaded, location.pathname, navigate])

  return (
    <div className="flex h-screen bg-[#0a0a0b]">
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </main>
    </div>
  )
}
