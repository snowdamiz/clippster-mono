import { useState, useEffect } from 'react'
import { X, Mail, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface WaitlistModalProps {
  isOpen: boolean
  onClose: () => void
}

const API_URL = 'https://clippster-server.fly.dev/api/waitlist'

export function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'exists'>('idle')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !email.includes('@')) {
      setStatus('error')
      setErrorMessage('Please enter a valid email address')
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
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setStatus('success')
        // Save to localStorage so we don't show the modal again
        localStorage.setItem('clippster_waitlist_joined', 'true')
      } else if (response.status === 409 || data.code === 'already_exists') {
        setStatus('exists')
        // Also save for "already exists" case
        localStorage.setItem('clippster_waitlist_joined', 'true')
      } else {
        setStatus('error')
        setErrorMessage(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setStatus('error')
      setErrorMessage('Unable to connect. Please try again later.')
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
      <div className="relative w-full max-w-md bg-gradient-to-b from-neutral-900 to-neutral-950 rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8">
          {status === 'success' ? (
            // Success state
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">You're on the list!</h2>
              <p className="text-neutral-400 mb-6">
                We'll notify you as soon as Clippster is ready. Check your inbox for a confirmation email.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white text-black font-semibold rounded-full hover:bg-neutral-100 transition-colors"
              >
                Got it
              </button>
            </div>
          ) : status === 'exists' ? (
            // Already exists state
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">You're already signed up!</h2>
              <p className="text-neutral-400 mb-6">
                This email is already on our waitlist. We'll let you know when Clippster launches!
              </p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white text-black font-semibold rounded-full hover:bg-neutral-100 transition-colors"
              >
                Got it
              </button>
            </div>
          ) : (
            // Form state
            <>
              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-7 h-7 text-violet-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Join the Waitlist</h2>
                <p className="text-neutral-400">
                  Be the first to know when Clippster launches. Get early access and exclusive updates.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (status === 'error') setStatus('idle')
                    }}
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                    disabled={status === 'loading'}
                    autoFocus
                  />
                  {status === 'error' && errorMessage && (
                    <div className="flex items-center gap-2 mt-2 text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={status === 'loading' || !email}
                  className="w-full py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    'Join Waitlist'
                  )}
                </button>
              </form>

              {/* Footer */}
              <p className="text-center text-neutral-500 text-xs mt-6">
                We respect your privacy. No spam, ever.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

