import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { ClipperProfile } from '@/services/clipperApi'
export function useClipperProfile() {
  const [profile, setProfile] = useState<ClipperProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      setError('')
      const result = await api.get<{ success: boolean; profile?: ClipperProfile; error?: string }>('/user/clipper-profile')
      if (!result.success) throw new Error(result.error || 'Unable to load your profile.')
      setProfile(result.profile || null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load your profile.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load();const refresh=()=>{void load()};window.addEventListener('clippster-profile-updated',refresh);return()=>window.removeEventListener('clippster-profile-updated',refresh) }, [load])
  return { profile, loading, error, load }
}
