import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'

interface Organization {
  id: number
  name: string
  slug: string
  logo_url: string | null
  role: string
}

/**
 * Hook for managing organization selector state
 * Used by organization pages to conditionally show the selector dropdown
 */
export function useOrganizationSelector() {
  const { isAuthenticated } = useAuth()
  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(false)

  // Check if user has multiple organizations
  const hasMultipleOrgs = userOrganizations.length > 1

  // Load user's organizations
  const loadUserOrganizations = async () => {
    setLoading(true)
    try {
      const response = await api.get<{ success: boolean; organizations?: Organization[]; error?: string }>('/organizations')
      if (response.success && response.organizations) {
        setUserOrganizations(response.organizations)
      }
    } catch (error) {
      console.error('Failed to load user organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  // Auto-load on mount if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadUserOrganizations()
    }
  }, [isAuthenticated])

  return {
    userOrganizations,
    hasMultipleOrgs,
    loading,
    loadUserOrganizations,
  }
}
