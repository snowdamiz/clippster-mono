import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AuthDialog, type AuthDialogView } from '@/components/auth/AuthDialog'

interface AuthDialogContextValue {
  open: boolean
  openAuthDialog: () => void
  closeAuthDialog: () => void
}

const AuthDialogContext = createContext<AuthDialogContextValue | null>(null)

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [initialView] = useState<AuthDialogView>('intro')

  const openAuthDialog = useCallback(() => {
    setOpen(true)
  }, [])

  const closeAuthDialog = useCallback(() => setOpen(false), [])

  const value = useMemo(
    () => ({ open, openAuthDialog, closeAuthDialog }),
    [open, openAuthDialog, closeAuthDialog],
  )

  return (
    <AuthDialogContext.Provider value={value}>
      {children}
      <AuthDialog open={open} onClose={closeAuthDialog} initialView={initialView} />
    </AuthDialogContext.Provider>
  )
}

export function useAuthDialog() {
  const ctx = useContext(AuthDialogContext)
  if (!ctx) throw new Error('useAuthDialog must be used within AuthDialogProvider')
  return ctx
}
