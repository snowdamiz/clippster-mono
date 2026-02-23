/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'

interface DownloadContextType {
  downloadsEnabled: boolean
  enableDownloads: () => void
  showBetaCodeModal: boolean
  setShowBetaCodeModal: (show: boolean) => void
  openBetaCodeModal: () => void
  verifyBetaCode: (code: string) => Promise<boolean>
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined)

const API_URL = `${import.meta.env.VITE_API_URL || 'https://clippster-server.fly.dev'}/api/beta/verify-code`

// Check if beta code exists in localStorage
function checkInitialAccess(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('clippster_beta_code') !== null
}

export function DownloadProvider({ children }: { children: ReactNode }) {
  // Initialize state with computed values to avoid useEffect setState
  const initialAccess = useMemo(() => checkInitialAccess(), [])
  const [downloadsEnabled, setDownloadsEnabled] = useState(initialAccess)
  const [showBetaCodeModal, setShowBetaCodeModal] = useState(false)

  useEffect(() => {
    // Show beta code modal on load if downloads are not enabled
    if (!downloadsEnabled) {
      const timer = setTimeout(() => {
        setShowBetaCodeModal(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [downloadsEnabled])

  const openBetaCodeModal = () => {
    setShowBetaCodeModal(true)
  }

  const enableDownloads = () => {
    setDownloadsEnabled(true)
  }

  const verifyBetaCode = async (code: string): Promise<boolean> => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      })

      const data = await response.json()

      if (data.valid) {
        localStorage.setItem('clippster_beta_code', code.trim().toUpperCase())
        setDownloadsEnabled(true)
        return true
      }
      return false
    } catch (error) {
      console.error('Beta code verification failed:', error)
      return false
    }
  }

  return (
    <DownloadContext.Provider
      value={{
        downloadsEnabled,
        enableDownloads,
        showBetaCodeModal,
        setShowBetaCodeModal,
        openBetaCodeModal,
        verifyBetaCode,
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

