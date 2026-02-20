import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface AdminRouteProps {
  children: ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const hasAdminAccess = Boolean(user?.is_admin || user?.is_moderator)
  if (!hasAdminAccess) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
