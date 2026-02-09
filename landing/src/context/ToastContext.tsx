import { createContext, useCallback, useState, type ReactNode } from 'react'

export interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  title: string
  message?: string
}

export interface ToastContextType {
  toasts: Toast[]
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
  dismiss: (id: number) => void
}

export const ToastContext = createContext<ToastContextType | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((type: Toast['type'], title: string, message?: string) => {
    const id = ++nextId
    setToasts(prev => [...prev, { id, type, title, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const success = useCallback((title: string, message?: string) => addToast('success', title, message), [addToast])
  const error = useCallback((title: string, message?: string) => addToast('error', title, message), [addToast])
  const info = useCallback((title: string, message?: string) => addToast('info', title, message), [addToast])
  const dismiss = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), [])

  return (
    <ToastContext.Provider value={{ toasts, success, error, info, dismiss }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm max-w-sm animate-in slide-in-from-right ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : toast.type === 'error'
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
            }`}
            onClick={() => dismiss(toast.id)}
          >
            <p className="text-sm font-medium">{toast.title}</p>
            {toast.message && <p className="text-xs opacity-80 mt-0.5">{toast.message}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
