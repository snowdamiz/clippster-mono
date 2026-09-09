import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/**
 * Legacy /dashboard entry: route personal users to /account and org-linked users to their org.
 * Organization applications live at /org/apply.
 */
export function DashboardIndex() {
  const navigate = useNavigate()
  const { user, authChecked } = useAuth()

  useEffect(() => {
    if (!authChecked) return

    if (user?.owned_organization_id) {
      navigate(`/dashboard/org/${user.owned_organization_id}`, { replace: true })
      return
    }

    if (user?.created_by_organization_id) {
      navigate(`/dashboard/org/${user.created_by_organization_id}`, { replace: true })
      return
    }

    navigate('/account', { replace: true })
  }, [user, authChecked, navigate])

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
    </div>
  )
}
