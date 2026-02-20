import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'

export function OrgSubscriptionRequired() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin } = useOrganization()

  useEffect(() => {
    if (isAdmin && id) {
      navigate(`/dashboard/org/${id}/hub`, { replace: true })
    }
  }, [isAdmin, id, navigate])

  if (isAdmin) {
    return null
  }

  return (
    <PageLayout title="Subscription Required">
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
          <h1 className="m-0 text-2xl font-bold text-white">Subscription Required</h1>
          <p className="mt-3 mb-0 text-zinc-300">
            Your organization needs an active subscription to continue using this dashboard.
          </p>
          <p className="mt-2 mb-0 text-sm text-zinc-400">
            Please purchase a subscription from within the Clippster desktop app (Tauri).
          </p>
        </div>
      </div>
    </PageLayout>
  )
}
