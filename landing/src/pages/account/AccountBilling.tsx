import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Check, Loader2, Zap } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { needsPlanSelection, subscriptionCoversAccess } from '@/lib/accountRouting'
import { PERSONAL_PLAN_ORDER, PLAN_PRESENTATION, personalPlanQuote } from '../../../../packages/shared-types/src/pricingPresentation'

interface SubscriptionTier {
  id: string
  name: string
  monthly_credits: number
  price_usd: number
}

type BillingInterval = 'monthly' | 'yearly'

const FREE_FEATURES = [
  'Web workspace access',
  'Mobile app access',
  '5 clip builds/day',
  '1 editor export/day',
  '2 VOD downloads/day',
  '60 free minutes every 30 days (free balance capped at 60)',
  'Watermark applied · No social posting',
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
  const hasActiveSubscription = subscriptionCoversAccess(user?.subscription)
  const availableMinutes = user?.credits?.minutes_remaining ?? user?.credits?.hours_remaining

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
    () => PERSONAL_PLAN_ORDER.flatMap(id => tiers.filter(t => t.id === id)),
    [tiers],
  )

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
        <h1 className="text-2xl font-bold text-white m-0 mb-2">Subscription & usage</h1>
        <p className="text-sm text-zinc-500 m-0">
          {hasActiveSubscription
            ? `Current plan: ${user?.subscription?.tier_name || currentTier}`
            : 'Choose the plan that works for you'}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div><p className="m-0 text-xs text-zinc-500">Current plan</p><p className="m-0 mt-1 font-semibold text-white">{user?.subscription?.tier_name || 'Free'}</p>
          {user?.subscription?.end_date && <p className="m-0 mt-1 text-xs text-zinc-400">{user.subscription.status === 'cancelled' ? 'Access until' : 'Current period ends'} {new Date(user.subscription.end_date).toLocaleDateString()}</p>}
        </div>
        <div><p className="m-0 text-xs text-zinc-500">Available processing balance</p><p className="m-0 mt-1 font-semibold text-white">{availableMinutes === undefined ? 'Unavailable' : availableMinutes === 'unlimited' ? 'Unlimited' : `${Number(availableMinutes).toLocaleString()} min`}</p></div>
        {!gateMode && <button type="button" onClick={() => navigate(user?.owned_organization_id ? `/dashboard/org/${user.owned_organization_id}/billing` : '/pricing?audience=business')} className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700">Business plans</button>}
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
          {apiTiers.map((tier) => (
            <TierCard key={tier.id} tier={tier} billingInterval={billingInterval}
              isCurrent={isCurrent(tier.id)} busy={busyTier === tier.id}
              onSelect={() => checkout(tier.id)} />
          ))}
          {basicTier && (
            <div className="sm:col-span-2 lg:col-span-3">
              <TierCard tier={basicTier} billingInterval={billingInterval}
                isCurrent={isCurrent('basic')} busy={busyTier === 'basic'} onSelect={() => checkout('basic')} compact />
            </div>
          )}
          {/* Free */}
          <div
            className={`sm:col-span-2 lg:col-span-3 rounded-xl border p-5 flex flex-col ${
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
              60 free minutes every 30 days · Free balance capped at 60
            </div>
            <ul className="mt-4 mb-6 grid gap-2 sm:grid-cols-2 flex-1 list-none p-0">
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

          <p className="sm:col-span-2 lg:col-span-3 text-xs text-zinc-500">1 credit = 1 processing minute. AI Video Creator usage is separate. Paid minutes roll over; downgrading to Basic resets your balance.</p>
        </div>
      )}
    </div>
  )
}

function TierCard({
  tier,
  billingInterval,
  isCurrent,
  busy,
  onSelect,
  compact = false,
}: {
  tier: SubscriptionTier
  billingInterval: BillingInterval
  isCurrent: boolean
  busy: boolean
  onSelect: () => void
  compact?: boolean
}) {
  const quote = personalPlanQuote(tier.price_usd, tier.monthly_credits, billingInterval === 'yearly')
  const presentation = PLAN_PRESENTATION[tier.id]
  return (
    <div
      className={`rounded-xl border p-5 flex flex-col ${
        isCurrent || tier.id === 'creator' ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-zinc-800 bg-zinc-900/40'
      }`}
    >
      {isCurrent && (
        <span className="inline-flex items-center gap-1 self-start mb-3 px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 text-[11px] font-semibold">
          <Check className="w-3 h-3" /> Current
        </span>
      )}
      <h3 className="text-lg font-semibold text-white m-0">{tier.name}</h3>
      {tier.id === 'creator' && !isCurrent && <span className="text-xs font-semibold text-cyan-400">Recommended</span>}
      <p className="text-xs text-zinc-400 mt-2">{presentation?.description}</p>
      <p className="text-3xl font-bold text-white m-0 mt-2">
        ${quote.monthlyPrice}
        <span className="text-sm font-medium text-zinc-500">
          /mo
        </span>
      </p>
      <p className="text-xs text-zinc-500 m-0 mt-1">${quote.billedPrice} {quote.billingLabel}</p>
      <div className="flex items-center gap-1.5 mt-3 text-sm text-zinc-400">
        <Zap className="w-4 h-4 text-cyan-400" />
        {quote.minutes.toLocaleString()} {quote.allowanceLabel}
      </div>
      <ul className={`mt-4 list-none p-0 text-sm text-zinc-400 ${compact ? 'grid gap-2 sm:grid-cols-2' : 'space-y-2'}`}>
        {presentation?.features.map(feature => <li key={feature} className="flex gap-2"><Check className="w-4 h-4 shrink-0 mt-0.5" />{feature}</li>)}
      </ul>
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
