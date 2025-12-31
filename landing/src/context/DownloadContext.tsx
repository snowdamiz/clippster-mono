import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface DownloadContextType {
  downloadsEnabled: boolean
  showWaitlistModal: boolean
  setShowWaitlistModal: (show: boolean) => void
  openWaitlistModal: () => void
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined)

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [downloadsEnabled, setDownloadsEnabled] = useState(false)
  const [showWaitlistModal, setShowWaitlistModal] = useState(false)
  const [hasCheckedBypass, setHasCheckedBypass] = useState(false)

  useEffect(() => {
    // Check for bypass query parameter
    const urlParams = new URLSearchParams(window.location.search)
    const hasAccess = urlParams.get('access') === 'beta'
    
    setDownloadsEnabled(hasAccess)
    setHasCheckedBypass(true)
    
    // Show waitlist modal on load if downloads are not enabled
    if (!hasAccess) {
      // Small delay for better UX
      const timer = setTimeout(() => {
        setShowWaitlistModal(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [])

  const openWaitlistModal = () => {
    setShowWaitlistModal(true)
  }

  // Don't render until we've checked the bypass parameter
  if (!hasCheckedBypass) {
    return null
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

