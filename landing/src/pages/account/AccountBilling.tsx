import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Check, Loader2, Zap } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { needsPlanSelection } from '@/lib/accountRouting'

interface SubscriptionTier {
  id: string
  name: string
  monthly_credits: number
  price_usd: number
}

type BillingInterval = 'monthly' | 'yearly'

const FREE_FEATURES = [
  'Mobile app access',
  '5 clip builds/day',
  '1 editor export/day',
  '2 VOD downloads/day',
  '60 one-time credits',
]

export function AccountBilling() {
  const { user, refreshUserData } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tiers, setTiers] = useState<SubscriptionTier[]>([])
  const [loading, setLoading] = useState(true)
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly')
  const [busyTier, setBusyTier] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isNewUserFlow = searchParams.get('new_user') === 'true'
  const gateMode = isNewUserFlow || needsPlanSelection(user)
  const currentTier = user?.subscription?.tier || null
  const hasActiveSubscription =
    user?.subscription?.status === 'active' ||
    (user?.subscription?.status === 'cancelled' && (user.subscription.days_remaining ?? 0) > 0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await api.get<{ success: boolean; tiers?: SubscriptionTier[]; error?: string }>(
          '/subscription/tiers',
        )
        if (!cancelled && res.success && res.tiers) {
          setTiers(res.tiers)
        }
      } catch {
        if (!cancelled) setError('Failed to load subscription plans')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const basicTier = useMemo(() => tiers.find((t) => t.id === 'basic'), [tiers])
  const apiTiers = useMemo(
    () => tiers.filter((t) => ['starter', 'creator', 'pro'].includes(t.id)),
    [tiers],
  )

  function displayPrice(tier: SubscriptionTier): string {
    if (billingInterval === 'yearly') {
      return (tier.price_usd * 11).toFixed(2)
    }
    return tier.price_usd.toFixed(2)
  }

  function effectiveMonthly(tier: SubscriptionTier): string {
    if (billingInterval === 'yearly') {
      return ((tier.price_usd * 11) / 12).toFixed(2)
    }
    return tier.price_usd.toFixed(2)
  }

  async function selectFree() {
    setBusyTier('free')
    setError(null)
    try {
      const res = await api.post<{ success: boolean; error?: string }>('/subscription/select-free')
      if (!res.success) throw new Error(res.error || 'Failed to select free plan')
      await refreshUserData()
      navigate('/account', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to select free plan')
    } finally {
      setBusyTier(null)
    }
  }

  async function checkout(tierId: string) {
    setBusyTier(tierId)
    setError(null)
    try {
      const res = await api.post<{ success: boolean; url?: string; error?: string }>(
        '/subscription/checkout',
        {
          tier: tierId,
          billing_interval: billingInterval,
          return_context: 'web',
        },
      )
      if (!res.success || !res.url) {
        throw new Error(res.error || 'Failed to create checkout session')
      }
      window.location.href = res.url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setBusyTier(null)
    }
  }

  function isCurrent(tierId: string) {
    return currentTier === tierId && hasActiveSubscription
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {gateMode && (
        <div className="mb-6 flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-amber-200 m-0 mb-1">Choose a plan to continue</h2>
            <p className="text-sm text-amber-200/80 m-0 leading-relaxed">
              Select Free or a paid plan to unlock your account dashboard. You can only leave this page by
              signing out.
            </p>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white m-0 mb-2">Billing</h1>
        <p className="text-sm text-zinc-500 m-0">
          {hasActiveSubscription
            ? `Current plan: ${user?.subscription?.tier_name || currentTier}`
            : 'Choose the plan that works for you'}
        </p>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800 w-fit mb-6">
        <button
          type="button"
          onClick={() => setBillingInterval('monthly')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium border-none cursor-pointer transition-colors ${
            billingInterval === 'monthly'
              ? 'bg-zinc-700 text-white'
              : 'bg-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setBillingInterval('yearly')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium border-none cursor-pointer transition-colors ${
            billingInterval === 'yearly'
              ? 'bg-zinc-700 text-white'
              : 'bg-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Yearly
          <span className="ml-1.5 text-[10px] text-cyan-400 font-semibold">Save 1 mo</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-sm m-0">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Free */}
          <div
            className={`rounded-xl border p-5 flex flex-col ${
              !hasActiveSubscription ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-zinc-800 bg-zinc-900/40'
            }`}
          >
            {!hasActiveSubscription && (
              <span className="inline-flex items-center gap-1 self-start mb-3 px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 text-[11px] font-semibold">
                <Check className="w-3 h-3" /> Current
              </span>
            )}
            <h3 className="text-lg font-semibold text-white m-0">Free</h3>
            <p className="text-3xl font-bold text-white m-0 mt-2">
              $0<span className="text-sm font-medium text-zinc-500">/mo</span>
            </p>
            <div className="flex items-center gap-1.5 mt-3 text-sm text-zinc-400">
              <Zap className="w-4 h-4 text-cyan-400" />
              60 one-time credits
            </div>
            <ul className="mt-4 mb-6 space-y-2 flex-1 list-none p-0">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
                  <Check className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={!gateMode || busyTier === 'free'}
              onClick={selectFree}
              className="w-full py-2.5 rounded-lg text-sm font-semibold border-none cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed bg-zinc-800 text-white hover:bg-zinc-700"
            >
              {busyTier === 'free' ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : gateMode ? (
                'Continue with Free'
              ) : !hasActiveSubscription ? (
                'Current Plan'
              ) : (
                'Manage in desktop app'
              )}
            </button>
          </div>

          {/* Basic */}
          {basicTier && (
            <TierCard
              tier={basicTier}
              billingInterval={billingInterval}
              displayPrice={displayPrice(basicTier)}
              effectiveMonthly={effectiveMonthly(basicTier)}
              isCurrent={isCurrent('basic')}
              busy={busyTier === 'basic'}
              onSelect={() => checkout('basic')}
            />
          )}

          {/* API tiers */}
          {apiTiers.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              billingInterval={billingInterval}
              displayPrice={displayPrice(tier)}
              effectiveMonthly={effectiveMonthly(tier)}
              isCurrent={isCurrent(tier.id)}
              busy={busyTier === tier.id}
              onSelect={() => checkout(tier.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TierCard({
  tier,
  billingInterval,
  displayPrice,
  effectiveMonthly,
  isCurrent,
  busy,
  onSelect,
}: {
  tier: SubscriptionTier
  billingInterval: BillingInterval
  displayPrice: string
  effectiveMonthly: string
  isCurrent: boolean
  busy: boolean
  onSelect: () => void
}) {
  return (
    <div
      className={`rounded-xl border p-5 flex flex-col ${
        isCurrent ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-zinc-800 bg-zinc-900/40'
      }`}
    >
      {isCurrent && (
        <span className="inline-flex items-center gap-1 self-start mb-3 px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 text-[11px] font-semibold">
          <Check className="w-3 h-3" /> Current
        </span>
      )}
      <h3 className="text-lg font-semibold text-white m-0">{tier.name}</h3>
      <p className="text-3xl font-bold text-white m-0 mt-2">
        ${displayPrice}
        <span className="text-sm font-medium text-zinc-500">
          /{billingInterval === 'yearly' ? 'yr' : 'mo'}
        </span>
      </p>
      {billingInterval === 'yearly' && (
        <p className="text-xs text-zinc-500 m-0 mt-1">${effectiveMonthly}/mo effective</p>
      )}
      <div className="flex items-center gap-1.5 mt-3 text-sm text-zinc-400">
        <Zap className="w-4 h-4 text-cyan-400" />
        {tier.monthly_credits} credits/month
      </div>
      <div className="flex-1" />
      <button
        type="button"
        disabled={isCurrent || busy}
        onClick={onSelect}
        className="mt-6 w-full py-2.5 rounded-lg text-sm font-semibold border-none cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed bg-cyan-400 text-[#0a0a0b] hover:opacity-90"
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
        ) : isCurrent ? (
          'Current Plan'
        ) : (
          'Subscribe'
        )}
      </button>
    </div>
  )
}
