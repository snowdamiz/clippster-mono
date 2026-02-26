import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { CreditCard, Wallet, Crown, Users, Zap, Tag } from 'lucide-react'

interface Plan {
  id: string
  name: string
  price_usd: number
  monthly_credits: number
  seats: number | null
}

interface Props {
  open: boolean
  onClose: () => void
  plan: Plan
  type: 'base' | 'addon'
  organizationId: string
  organizationName?: string
  onSuccess: () => void
}

export function SubscribeDialog({ open, onClose, plan, type, organizationId, organizationName, onSuccess }: Props) {
  const [promoCode, setPromoCode] = useState('')
  const [promoValidating, setPromoValidating] = useState(false)
  const [promoResult, setPromoResult] = useState<{
    valid: boolean
    discount_percent?: number
    message?: string
  } | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return
    setPromoValidating(true)
    try {
      const result = await api.post<any>(`/organizations/${organizationId}/subscription/promo/validate`, {
        code: promoCode
      })
      setPromoResult(result)
    } catch {
      setPromoResult({ valid: false, message: 'Failed to validate promo code' })
    } finally {
      setPromoValidating(false)
    }
  }

  const handleStripeCheckout = async () => {
    setCheckoutLoading(true)
    try {
      const endpoint =
        type === 'addon'
          ? `/organizations/${organizationId}/subscription/addons/checkout`
          : `/organizations/${organizationId}/subscription/checkout`

      const payload = {
        ...(type === 'addon' ? { addon_tier: plan.id } : { tier: plan.id }),
        payment_method: 'stripe',
        promo_code: promoResult?.valid ? promoCode : undefined,
      }

      const result = await api.post<any>(endpoint, {
        ...payload,
      })

      const checkoutUrl = result.checkout_url || result.url

      if (checkoutUrl) {
        window.open(checkoutUrl, '_blank')
        onSuccess()
      } else if (result.success) {
        onSuccess()
      }
    } catch {
      // handled by api layer
    } finally {
      setCheckoutLoading(false)
    }
  }

  const finalPrice =
    promoResult?.valid && promoResult.discount_percent
      ? plan.price_usd * (1 - promoResult.discount_percent / 100)
      : plan.price_usd

  return (
    <Dialog open={open} onClose={onClose} title={type === 'addon' ? 'Add to Plan' : 'Subscribe'} maxWidth="max-w-md">
      <div className="space-y-5">
        {/* Plan summary */}
        <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <Crown className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{plan.name}</h3>
              {organizationName && <p className="text-xs text-zinc-500">for {organizationName}</p>}
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Seats
              </span>
              <span className="text-white font-medium">{plan.seats === null ? 'Unlimited' : plan.seats}</span>
            </div>
            {plan.monthly_credits > 0 && (
              <div className="flex justify-between">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Credits/month
                </span>
                <span className="text-cyan-400 font-medium">{plan.monthly_credits.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-zinc-700">
              <span className="text-zinc-400">Monthly</span>
              <span className="text-white font-bold text-base">
                {promoResult?.valid && promoResult.discount_percent ? (
                  <>
                    <span className="line-through text-zinc-600 text-xs mr-1.5">${plan.price_usd}</span>$
                    {finalPrice.toFixed(2)}
                  </>
                ) : (
                  <>${plan.price_usd}/mo</>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Promo code */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Promo code"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value)
                setPromoResult(null)
              }}
              className="!py-2.5"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleValidatePromo}
            loading={promoValidating}
            disabled={!promoCode.trim()}
          >
            <Tag className="w-3.5 h-3.5" /> Apply
          </Button>
        </div>
        {promoResult && (
          <p className={`text-xs ${promoResult.valid ? 'text-emerald-400' : 'text-red-400'}`}>
            {promoResult.valid
              ? `${promoResult.discount_percent}% discount applied`
              : promoResult.message || 'Invalid code'}
          </p>
        )}

        {/* Payment buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handleStripeCheckout} loading={checkoutLoading} className="w-full">
            <CreditCard className="w-4 h-4" /> Pay with Card
          </Button>
          <Button variant="secondary" className="w-full" disabled>
            <Wallet className="w-4 h-4" /> Crypto (Soon)
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
