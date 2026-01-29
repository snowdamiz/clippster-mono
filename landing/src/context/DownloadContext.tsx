/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'

interface DownloadContextType {
  downloadsEnabled: boolean
  showWaitlistModal: boolean
  setShowWaitlistModal: (show: boolean) => void
  openWaitlistModal: () => void
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined)

// Check access at module load time to avoid useEffect setState
function checkInitialAccess(): boolean {
  if (typeof window === 'undefined') return false
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('access') === 'beta'
}

export function DownloadProvider({ children }: { children: ReactNode }) {
  // Initialize state with computed values to avoid useEffect setState
  const initialAccess = useMemo(() => checkInitialAccess(), [])
  const [downloadsEnabled] = useState(initialAccess)
  const [showWaitlistModal, setShowWaitlistModal] = useState(false)

  useEffect(() => {
    // Check if user has already joined the waitlist
    const hasJoinedWaitlist = localStorage.getItem('clippster_waitlist_joined') === 'true'
    
    // Show waitlist modal on load if downloads are not enabled AND user hasn't already joined
    if (!downloadsEnabled && !hasJoinedWaitlist) {
      // Small delay for better UX
      const timer = setTimeout(() => {
        setShowWaitlistModal(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [downloadsEnabled])

  const openWaitlistModal = () => {
    setShowWaitlistModal(true)
  }

  return (
    <DownloadContext.Provider
      value={{
        downloadsEnabled,
        showWaitlistModal,
        setShowWaitlistModal,
        openWaitlistModal,
      }}
    >
      {children}
    </DownloadContext.Provider>
  )
}

export function useDownloadContext() {
  const context = useContext(DownloadContext)
  if (context === undefined) {
    throw new Error('useDownloadContext must be used within a DownloadProvider')
  }
  return context
}

