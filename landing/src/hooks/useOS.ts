import { useMemo } from 'react'

export type OS = 'mac' | 'windows' | 'unknown'

export function useOS(): OS {
  // Use useMemo to compute OS once on mount instead of useEffect + setState
  const os = useMemo(() => getOSFromNavigator(), [])
  return os
}

export function getOSFromNavigator(): OS {
  if (typeof navigator === 'undefined') return 'unknown'
  
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()
  
  if (platform.includes('mac') || userAgent.includes('mac')) {
    return 'mac'
  } else if (platform.includes('win') || userAgent.includes('win')) {
    return 'windows'
  }
  
  return 'unknown'
}


