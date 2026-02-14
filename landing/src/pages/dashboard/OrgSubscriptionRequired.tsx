import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Crown, CreditCard, Wallet, Users, Zap, Tag, Loader2 } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useOrganization } from '@/hooks/useOrganization'
import { api } from '@/lib/api'

interface TierInfo {
  id: string
  name: string
  seats: number | null
  monthly_credits: number
  usd: number
}

export function OrgSubscriptionRequired() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { organization, subscription, loadSubscription } = useOrganization()
  const [tiers, setTiers] = useState<TierInfo[]>([])
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoValidating, setPromoValidating] = useState(false)
  const [promoResult, setPromoResult] = useState<{ valid: boolean; discount_percent?: number; message?: string } | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const fetchTiers = async () => {
      try {
        const result = await api.get<any>(`/organizations/${id}/subscription/tiers`)
        if (result.success) {
          setTiers(result.base_tiers || [])
          if (result.base_tiers?.length > 0) {
            setSelectedTier(result.base_tiers[0].id)
          }
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    fetchTiers()
  }, [id])

  // If subscription becomes active, redirect to hub
  useEffect(() => {
    if (subscription?.status === 'active' || subscription?.status === 'cancelled') {
      navigate(`/dashboard/org/${id}/hub`, { replace: true })
    }
  }, [subscription, id, navigate])

  const handleValidatePromo = async () => {
    if (!promoCode.trim() || !selectedTier || !id) return
    setPromoValidating(true)
    try {
      const result = await api.post<any>(`/organizations/${id}/subscription/promo/validate`, {
        code: promoCode,
        tier: selectedTier,
      })
      setPromoResult(result)
    } catch {
      setPromoResult({ valid: false, message: 'Failed to validate promo code' })
    } finally {
      setPromoValidating(false)
    }
  }

  const handleCheckout = async () => {
    if (!selectedTier || !id) return
    setCheckoutLoading(true)
    try {
      const result = await api.post<any>(`/organizations/${id}/subscription/checkout`, {
        tier: selectedTier,
        payment_method: 'stripe',
        promo_code: promoResult?.valid ? promoCode : undefined,
      })
      if (result.url) {
        window.open(result.url, '_blank')
      } else if (result.success) {
        loadSubscription()
      }
    } catch { /* handled by api layer */ }
    finally {
      setCheckoutLoading(false)
    }
  }

  const selectedTierInfo = tiers.find(t => t.id === selectedTier)
  const finalPrice = promoResult?.valid && promoResult.discount_percent && selectedTierInfo
    ? selectedTierInfo.usd * (1 - promoResult.discount_percent / 100)
    : selectedTierInfo?.usd || 0

  if (loading) {
    return (
      <PageLayout title="Subscribe">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Subscription Required">
      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 flex items-center justify-center mx-auto mb-4 border border-cyan-500/30">
            <Crown className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Choose a Plan for {organization?.name || 'Your Organization'}</h1>
          <p className="text-zinc-400 text-sm">An active subscription is required to access the organization dashboard.</p>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {tiers.map(tier => (
            <button
              key={tier.id}
              onClick={() => setSelectedTier(tier.id)}
              className={`p-5 rounded-xl border text-left transition-all ${
                selectedTier === tier.id
                  ? 'border-cyan-500/60 bg-cyan-500/10 ring-1 ring-cyan-500/30'
                  : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600'
              }`}
            >
              <h3 className="text-base font-bold text-white mb-1">{tier.name}</h3>
              <p className="text-2xl font-bold text-white mb-3">
                ${tier.usd}<span className="text-sm font-normal text-zinc-500">/mo</span>
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Users className="w-3.5 h-3.5" />
                  <span>{tier.seats === null ? 'Unlimited' : tier.seats} seats</span>
                </div>
                {tier.monthly_credits > 0 && (
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Zap className="w-3.5 h-3.5" />
                    <span>{tier.monthly_credits.toLocaleString()} credits/mo</span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Promo Code */}
        <div className="mb-6">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Promo code"
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value); setPromoResult(null) }}
                className="!py-2.5"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={handleValidatePromo} loading={promoValidating} disabled={!promoCode.trim()}>
              <Tag className="w-3.5 h-3.5" /> Apply
            </Button>
          </div>
          {promoResult && (
            <p className={`text-xs mt-1.5 ${promoResult.valid ? 'text-emerald-400' : 'text-red-400'}`}>
              {promoResult.valid ? `${promoResult.discount_percent}% discount applied` : promoResult.message || 'Invalid code'}
            </p>
          )}
        </div>

        {/* Price Summary */}
        {selectedTierInfo && (
          <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">Total</span>
              <span className="text-white font-bold text-lg">
                {promoResult?.valid && promoResult.discount_percent ? (
                  <>
                    <span className="line-through text-zinc-600 text-sm mr-2">${selectedTierInfo.usd}</span>
                    ${finalPrice.toFixed(2)}/mo
                  </>
                ) : (
                  <>${selectedTierInfo.usd}/mo</>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Payment Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={handleCheckout} loading={checkoutLoading} disabled={!selectedTier} className="w-full">
            <CreditCard className="w-4 h-4" /> Pay with Card
          </Button>
          <Button variant="secondary" className="w-full" disabled>
            <Wallet className="w-4 h-4" /> Crypto (Soon)
          </Button>
        </div>
      </div>
    </PageLayout>
  )
}
