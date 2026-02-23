import { useState, useEffect } from 'react'
import { X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface BetaCodeModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onOpenWaitlist: () => void
}

const API_URL = import.meta.env.DEV 
  ? 'http://localhost:4000/api/beta/verify-code'
  : 'https://clippster-server.fly.dev/api/beta/verify-code'

export function BetaCodeModal({ isOpen, onClose, onSuccess, onOpenWaitlist }: BetaCodeModalProps) {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCode('')
      setStatus('idle')
      setErrorMessage('')
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!code || code.trim().length !== 8) {
      setStatus('error')
      setErrorMessage('Please enter a valid 8-character beta code.')
      return
    }

    setStatus('loading')
    setErrorMessage('')

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
        setStatus('success')
        // Store code in localStorage
        localStorage.setItem('clippster_beta_code', code.trim().toUpperCase())
        
        // Auto-close after 2 seconds and trigger success callback
        setTimeout(() => {
          onSuccess()
          onClose()
          
          // Scroll to download section
          setTimeout(() => {
            document.getElementById('download-section')?.scrollIntoView({ 
              behavior: 'smooth' 
            })
          }, 100)
        }, 2000)
      } else {
        setStatus('error')
        setErrorMessage('This beta code is invalid. Please check for typos.')
      }
    } catch (error) {
      setStatus('error')
      setErrorMessage('Unable to verify code. Please check your connection and try again.')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-gradient-to-b from-zinc-900 to-black border border-zinc-800 rounded-2xl shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
          aria-label="Close modal"
        >
          <X size={24} />
        </button>

        {/* Content */}
        <div className="p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            Enter Beta Code
          </h2>
          <p className="text-zinc-400 text-center mb-6">
            Enter your unique beta code to unlock downloads
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX"
                maxLength={8}
                className="w-full px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg text-white text-center text-lg font-mono tracking-wider placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                disabled={status === 'loading' || status === 'success'}
              />
            </div>

            {/* Error message */}
            {status === 'error' && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-400">{errorMessage}</p>
              </div>
            )}

            {/* Success message */}
            {status === 'success' && (
              <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-400">Beta access unlocked! Redirecting...</p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={status === 'loading' || status === 'success'}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : status === 'success' ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Verified!
                </>
              ) : (
                'Verify Code'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <p className="text-sm text-zinc-400 text-center">
              Don't have a code?{' '}
              <button
                onClick={() => {
                  onClose()
                  onOpenWaitlist()
                }}
                className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
              >
                Join the waitlist
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
