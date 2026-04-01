import { useState, useEffect } from 'react'
import { CreditCard, Loader2, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import type { Organization } from '@/types/organization'

interface OrganizationSetupDialogProps {
  show: boolean
  organization: Organization | null
  onSetupComplete: () => void
}

export function OrganizationSetupDialog({
  show,
  organization,
  onSetupComplete,
}: OrganizationSetupDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleProceed = async () => {
    if (!organization?.id || loading) return

    setLoading(true)
    setError(null)

    try {
      const response = await api.post(`/organizations/${organization.id}/payments/stripe/setup`)

      if (response.data.success) {
        if (response.data.url) {
          // Redirect to Stripe checkout
          window.location.href = response.data.url
        } else if (response.data.redirect_to) {
          // Free org case - reload to refresh data
          await new Promise((resolve) => setTimeout(resolve, 500))
          onSetupComplete()
        }
      } else {
        throw new Error(response.data.error || 'Failed to create payment session')
      }
    } catch (err) {
      console.error('Failed to open Stripe setup:', err)
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.'
      )
      setLoading(false)
    }
  }

  // Reset error when dialog visibility changes
  useEffect(() => {
    if (show) {
      setError(null)
    }
  }, [show])

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[10000] animate-in fade-in duration-250">
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-[520px] mx-4 max-h-[90vh] flex flex-col overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.6)] animate-in zoom-in-95 slide-in-from-bottom-5 duration-250"
        role="dialog"
        aria-modal="true"
      >
        {/* Accent bar */}
        <div className="h-1 bg-gradient-to-r from-cyan-400 to-cyan-400/50 flex-shrink-0" />

        {/* Header */}
        <div className="flex flex-col items-center px-8 pt-8 pb-6 text-center">
          <div className="flex items-center justify-center w-[68px] h-[68px] rounded-full bg-gradient-to-br from-cyan-500/15 to-cyan-500/5 border border-cyan-500/30 text-cyan-400 mb-5">
            <CreditCard size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
            Complete Your Organization Setup
          </h2>
          <p className="text-[15px] text-zinc-400 leading-relaxed max-w-[420px]">
            Your organization has been created with custom billing. Please complete the payment
            setup to activate your subscription.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 flex flex-col gap-6">
          {/* Plan Details */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex justify-between items-center px-4 py-3.5 bg-zinc-800/60 border border-zinc-700/60 rounded-[10px]">
              <span className="text-sm text-zinc-500 font-medium">Plan:</span>
              <span className="text-sm text-white font-semibold">
                {organization?.subscription_tier === 'custom'
                  ? 'Custom'
                  : organization?.subscription_tier || 'Standard'}
              </span>
            </div>
            <div className="flex justify-between items-center px-4 py-3.5 bg-zinc-800/60 border border-zinc-700/60 rounded-[10px]">
              <span className="text-sm text-zinc-500 font-medium">Monthly Price:</span>
              <span className="text-sm text-white font-semibold">
                ${organization?.admin_price_cents ? (organization.admin_price_cents / 100).toFixed(2) : '0.00'}/mo
              </span>
            </div>
            <div className="flex justify-between items-center px-4 py-3.5 bg-zinc-800/60 border border-zinc-700/60 rounded-[10px]">
              <span className="text-sm text-zinc-500 font-medium">Seats:</span>
              <span className="text-sm text-white font-semibold">
                {organization?.max_seats || 'Unlimited'}
              </span>
            </div>
            <div className="flex justify-between items-center px-4 py-3.5 bg-zinc-800/60 border border-zinc-700/60 rounded-[10px]">
              <span className="text-sm text-zinc-500 font-medium">AI Credits:</span>
              <span className="text-sm text-white font-semibold">
                {organization?.monthly_credits || 0}/mo
              </span>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-[10px] bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <p className="text-[13px] leading-relaxed m-0">{error}</p>
            </div>
          )}

          <p className="text-[13px] text-zinc-500 text-center m-0">
            {loading
              ? 'Complete payment in the Stripe tab, then return here.'
              : 'You'll be redirected to Stripe to set up recurring billing.'}
          </p>
        </div>

        {/* Footer */}
        <div className="flex px-8 py-6 border-t border-zinc-800">
          <button
            onClick={handleProceed}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 text-[15px] font-semibold rounded-[10px] border-none cursor-pointer bg-gradient-to-r from-cyan-400 to-cyan-500 text-white transition-all duration-150 hover:opacity-90 hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Waiting for payment...' : 'Pay Now & Activate'}
          </button>
        </div>
      </div>
    </div>
  )
}
