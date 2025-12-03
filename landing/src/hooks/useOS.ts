import { useState, useEffect } from 'react'

export type OS = 'mac' | 'windows' | 'unknown'

export function useOS(): OS {
  const [os, setOS] = useState<OS>('unknown')

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase()
    const platform = navigator.platform.toLowerCase()
    
    if (platform.includes('mac') || userAgent.includes('mac')) {
      setOS('mac')
    } else if (platform.includes('win') || userAgent.includes('win')) {
      setOS('windows')
    }
  }, [])

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


