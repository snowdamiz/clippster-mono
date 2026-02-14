import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { BuyCreditsModal } from '@/components/organization/BuyCreditsModal'
import { SubscribeDialog } from '@/components/organization/SubscribeDialog'
import { api } from '@/lib/api'
import {
  Wallet,
  Coins,
  TrendingUp,
  User,
  Users,
  Receipt,
  CreditCard,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Clock,
  Download,
  Zap,
  Crown,
  AlertCircle,
  CalendarCheck,
  Sparkles,
  Star,
  Check,
  Package,
  AlertTriangle
} from 'lucide-react'

type Tab = 'allocations' | 'history' | 'subscriptions'

interface SubscriptionTier {
  id: string
  name: string
  usd: number
  seats: number | null
  monthly_credits: number
  requires_ai?: boolean
}

export function OrgBilling() {
  const {
    loading,
    isAdmin,
    poolBalance,
    credits,
    members,
    myAllocation,
    subscription,
    transactions,
    transactionsLoading,
    transactionsTotal,
    transactionsPage,
    transactionsLoaded,
    totalTransactionPages,
    loadOrganization,
    loadTransactions,
    formatAllocation,
    formatDate,
    hasActiveSubscription,
    organizationId,
    organization,
    allocateCredits
  } = useOrganization()
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('allocations')
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [allocations, setAllocations] = useState<Record<number, number>>({})
  const [failedAvatars, setFailedAvatars] = useState<Set<number>>(new Set())

  // Subscription state
  const [baseTiers, setBaseTiers] = useState<SubscriptionTier[]>([])
  const [addonTiers, setAddonTiers] = useState<SubscriptionTier[]>([])
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<{
    id: string
    name: string
    price_usd: number
    monthly_credits: number
    seats: number | null
  } | null>(null)
  const [selectedType, setSelectedType] = useState<'base' | 'addon'>('base')

  // Change Plan state
  const [showChangePlanDialog, setShowChangePlanDialog] = useState(false)
  const [changePlanTier, setChangePlanTier] = useState<string | null>(null)
  const [changePlanLoading, setChangePlanLoading] = useState(false)
  const [prorationPreview, setProrationPreview] = useState<any>(null)
  const [prorationLoading, setProrationLoading] = useState(false)

  useEffect(() => {
    loadOrganization()
  }, [loadOrganization])

  useEffect(() => {
    if (organizationId) {
      api
        .get<any>(`/organizations/${organizationId}/subscription/tiers`)
        .then((res) => {
          if (res.success) {
            setBaseTiers(res.base_tiers || [])
            setAddonTiers(res.addon_tiers || [])
          }
        })
        .catch(() => {})
    }
  }, [organizationId])

  const sortedBaseTiers = [...baseTiers].sort((a, b) => a.usd - b.usd)

  const availableAddons = (() => {
    if (!subscription) return []
    const hasAiPlan = subscription.tier === 'enterprise_ai'
    return addonTiers.filter((addon) => hasAiPlan || !addon.requires_ai)
  })()

  function getMemberInitials(member: any): string {
    const name = member.user?.name || member.user?.email || ''
    if (!name) return '??'
    const parts = name.split(/[\s@]/)
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
  }

  async function handleAllocateCredits(userId: number) {
    const minutes = allocations[userId]
    const result = await allocateCredits(userId, minutes)
    if (result.success) {
      setAllocations((prev) => ({ ...prev, [userId]: 0 }))
    }
  }

  function handleCreditsSuccess() {
    setShowBuyModal(false)
    loadOrganization()
  }

  function selectSubscription(plan: SubscriptionTier, type: 'base' | 'addon') {
    setSelectedPlan({
      id: plan.id,
      name: plan.name,
      price_usd: plan.usd,
      monthly_credits: plan.monthly_credits,
      seats: plan.seats
    })
    setSelectedType(type)
    setShowSubscriptionModal(true)
  }

  function handleSubscribeSuccess() {
    setShowSubscriptionModal(false)
    setSelectedPlan(null)
    loadOrganization()
  }

  async function fetchProrationPreview(tier: string) {
    if (!organizationId) return
    setProrationLoading(true)
    try {
      const result = await api.get<any>(`/organizations/${organizationId}/subscription/proration-preview?tier=${tier}`)
      if (result.success) {
        setProrationPreview(result.preview)
      }
    } catch { /* ignore */ }
    finally { setProrationLoading(false) }
  }

  async function handleChangePlan() {
    if (!organizationId || !changePlanTier) return
    setChangePlanLoading(true)
    try {
      const result = await api.put<any>(`/organizations/${organizationId}/subscription/tier`, { tier: changePlanTier })
      if (result.success) {
        toast.success('Plan changed', result.message || 'Subscription tier updated')
        setShowChangePlanDialog(false)
        setChangePlanTier(null)
        setProrationPreview(null)
        await loadOrganization()
      } else {
        toast.error('Failed', result.error)
      }
    } catch (err: any) {
      toast.error('Failed', err.message || 'An error occurred')
    } finally {
      setChangePlanLoading(false)
    }
  }

  async function cancelSubscription() {
    if (!organizationId) return
    setCancelLoading(true)
    try {
      const result = await api.post<any>(`/organizations/${organizationId}/subscription/cancel`)
      if (result.success) {
        toast.success('Subscription cancelled', result.message)
        setShowCancelDialog(false)
        await loadOrganization()
      } else {
        toast.error('Failed to cancel', result.error)
      }
    } catch (err: any) {
      toast.error('Failed to cancel', err.message || 'An error occurred')
    } finally {
      setCancelLoading(false)
    }
  }

  function formatTransactionDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function getPackLabel(packType: string) {
    const labels: Record<string, string> = {
      small: 'Small Pack',
      medium: 'Medium Pack',
      large: 'Large Pack',
      xl: 'XL Pack'
    }
    return labels[packType] || packType || 'Credit Purchase'
  }

  function getPaymentMethodLabel(method: string) {
    return method === 'stripe' ? 'Card Payment' : method === 'crypto' ? 'Crypto Payment' : method || 'Payment'
  }

  if (loading) {
    return (
      <PageLayout
        icon={Wallet}
        title="Billing & Credits"
        description="Manage your organization's credits and view payment history"
      >
        <div className="w-full max-w-[1200px] mx-auto p-6 space-y-6">
          <Skeleton className="h-6 w-64 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      icon={Wallet}
      title="Billing & Credits"
      description="Manage your organization's credits and view payment history"
      actions={
        isAdmin && (
          <button
            onClick={() => setShowBuyModal(true)}
            className="flex items-center gap-2 h-8 px-3.5 text-xs font-semibold rounded-md bg-cyan-400 text-[#0a0a0b] border-none cursor-pointer transition-opacity duration-150 hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" /> Buy Credits
          </button>
        )
      }
    >
      <div className="w-full max-w-[1200px] mx-auto p-6 flex flex-col gap-10">
        {/* Page Heading */}
        <div className="-mb-1">
          <h1 className="text-2xl font-bold text-white tracking-tight m-0 mb-1.5">
            Billing, credits, and subscriptions
          </h1>
          <p className="text-sm text-zinc-500 m-0 leading-relaxed">
            Monitor your credit pool, allocate to team members, and track payment history
          </p>
        </div>

        {/* Tab Navigation (Admin Only) */}
        {isAdmin && (
          <nav className="flex gap-1 border-b border-zinc-800 -mb-1">
            {[
              { id: 'allocations' as Tab, label: 'Credits', icon: Users },
              { id: 'history' as Tab, label: 'History', icon: Clock },
              { id: 'subscriptions' as Tab, label: 'Subscriptions', icon: Crown }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-[7px] px-3.5 py-2.5 bg-transparent border-none border-b-2 -mb-px text-xs font-medium cursor-pointer transition-all duration-150 ${
                  tab === t.id ? 'text-white border-b-cyan-500' : 'text-zinc-500 border-b-transparent hover:text-white'
                }`}
              >
                <t.icon className="w-[15px] h-[15px]" />
                {t.label}
              </button>
            ))}
          </nav>
        )}

        {/* ===== CREDITS TAB ===== */}
        {isAdmin && tab === 'allocations' && (
          <section className="flex flex-col gap-5">
            {/* Credit Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 -mt-2 mb-[3px]">
              {/* Pool Balance Card */}
              <div className="relative flex bg-zinc-900/50 border border-zinc-800 rounded-[10px] overflow-hidden hover:border-white/10 hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-200">
                <div className="w-1 shrink-0 bg-emerald-500" />
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-3.5 px-5 py-4 border-b border-zinc-800">
                    <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-emerald-500/15 text-emerald-500 shrink-0">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[0.9375rem] font-semibold text-white m-0 tracking-tight">Pool Balance</h3>
                      <p className="text-xs text-zinc-500 m-0 mt-0.5">Available for allocation</p>
                    </div>
                  </div>
                  <div className="px-5 py-5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[2rem] font-bold text-emerald-500 tracking-tight leading-none tabular-nums">
                        {credits.hoursRemaining}
                      </span>
                      <span className="text-sm text-zinc-500 font-medium">min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Used Card */}
              <div className="relative flex bg-zinc-900/50 border border-zinc-800 rounded-[10px] overflow-hidden hover:border-white/10 hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-200">
                <div className="w-1 shrink-0 bg-zinc-800" />
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-3.5 px-5 py-4 border-b border-zinc-800">
                    <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-zinc-800/50 text-zinc-500 shrink-0">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[0.9375rem] font-semibold text-white m-0 tracking-tight">Total Used</h3>
                      <p className="text-xs text-zinc-500 m-0 mt-0.5">All time usage</p>
                    </div>
                  </div>
                  <div className="px-5 py-5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[2rem] font-bold text-white tracking-tight leading-none tabular-nums">
                        {credits.hoursUsed}
                      </span>
                      <span className="text-sm text-zinc-500 font-medium">min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* My Allocation Card */}
              <div className="relative flex bg-zinc-900/50 border border-zinc-800 rounded-[10px] overflow-hidden hover:border-white/10 hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-200">
                <div className="w-1 shrink-0 bg-cyan-500" />
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-3.5 px-5 py-4 border-b border-zinc-800">
                    <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-cyan-500/15 text-cyan-400 shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[0.9375rem] font-semibold text-white m-0 tracking-tight">My Allocation</h3>
                      <p className="text-xs text-zinc-500 m-0 mt-0.5">Your remaining credits</p>
                    </div>
                  </div>
                  <div className="px-5 py-5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[2rem] font-bold text-cyan-400 tracking-tight leading-none tabular-nums">
                        {formatAllocation(myAllocation?.hours_remaining)}
                      </span>
                      <span className="text-sm text-zinc-500 font-medium">min</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section Header */}
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-[10px] flex items-center justify-center bg-zinc-800/50 text-zinc-500 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white m-0 tracking-tight">Member Allocations</h2>
                <p className="text-[0.8125rem] text-zinc-500 m-0 mt-0.5">
                  Distribute credits to {members.length} team members
                </p>
              </div>
            </div>

            {/* Members Table */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full border-collapse table-fixed">
                <thead>
                  <tr className="bg-black/20 border-b border-zinc-800">
                    <th className="w-[30%] px-5 py-3.5 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-zinc-500">
                      Member
                    </th>
                    <th className="w-[13%] px-5 py-3.5 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-zinc-500">
                      Allocated
                    </th>
                    <th className="w-[13%] px-5 py-3.5 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-zinc-500">
                      Used
                    </th>
                    <th className="w-[13%] px-5 py-3.5 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-zinc-500">
                      Remaining
                    </th>
                    <th className="w-[31%] px-5 py-3.5 text-right text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-zinc-500">
                      Add Credits
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr
                      key={member.id}
                      className="border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/30 transition-colors duration-150"
                    >
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center text-[0.6875rem] font-bold shrink-0 overflow-hidden ${
                              member.user?.avatar_url && !failedAvatars.has(member.user_id)
                                ? 'bg-transparent'
                                : 'bg-gradient-to-br from-cyan-500 to-cyan-500/60 text-[#0a0a0b]'
                            }`}
                          >
                            {member.user?.avatar_url && !failedAvatars.has(member.user_id) ? (
                              <img
                                src={member.user.avatar_url}
                                alt={member.user?.name || member.user?.email || 'User'}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                onError={() => setFailedAvatars((prev) => new Set(prev).add(member.user_id))}
                              />
                            ) : (
                              <span>{getMemberInitials(member)}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="block text-sm font-medium text-white truncate">
                              {member.user?.name || member.user?.email}
                            </span>
                            {member.user?.name && member.user?.email && (
                              <span className="block text-[0.6875rem] text-zinc-500 truncate mt-0.5">
                                {member.user.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle text-right">
                        <span className="text-sm font-semibold text-white tabular-nums">
                          {formatAllocation(member.allocation?.hours_allocated)}
                          <span className="text-[0.6875rem] font-medium text-zinc-500 ml-1">min</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 align-middle text-right">
                        <span className="text-sm font-semibold text-zinc-500 tabular-nums">
                          {formatAllocation(member.allocation?.hours_used)}
                          <span className="text-[0.6875rem] font-medium text-zinc-500 ml-1">min</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 align-middle text-right">
                        <span className="text-sm font-semibold text-cyan-400 tabular-nums">
                          {formatAllocation(member.allocation?.hours_remaining)}
                          <span className="text-[0.6875rem] font-medium text-zinc-500 ml-1">min</span>
                        </span>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={allocations[member.user_id] || ''}
                              onChange={(e) =>
                                setAllocations((prev) => ({
                                  ...prev,
                                  [member.user_id]: parseFloat(e.target.value) || 0
                                }))
                              }
                              min={0}
                              max={poolBalance}
                              step={0.5}
                              placeholder="0"
                              disabled={poolBalance === 0}
                              className="w-[72px] text-right text-[0.8125rem] tabular-nums bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-colors disabled:opacity-40"
                            />
                            <span className="text-[0.6875rem] text-zinc-500">min</span>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleAllocateCredits(member.user_id)}
                            disabled={
                              poolBalance === 0 ||
                              !allocations[member.user_id] ||
                              allocations[member.user_id] <= 0 ||
                              allocations[member.user_id] > poolBalance
                            }
                            className="text-xs gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ===== HISTORY TAB ===== */}
        {isAdmin && tab === 'history' && (
          <section className="flex flex-col gap-5">
            {/* Section Header */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-[10px] flex items-center justify-center bg-zinc-800/50 text-zinc-500 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white m-0 tracking-tight">Payment History</h2>
                  <p className="text-[0.8125rem] text-zinc-500 m-0 mt-0.5">
                    {transactionsTotal > 0
                      ? `${transactionsTotal} transactions recorded`
                      : 'Track all credit purchases'}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                {!transactionsLoaded ? (
                  <button
                    onClick={() => loadTransactions(1)}
                    disabled={transactionsLoading}
                    className="flex items-center gap-2 px-4 py-2 text-[0.8125rem] font-medium text-white bg-zinc-800/50 border border-zinc-800 rounded-lg cursor-pointer transition-all duration-150 hover:bg-zinc-800 hover:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {transactionsLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>{transactionsLoading ? 'Loading...' : 'Load History'}</span>
                  </button>
                ) : transactions.length > 0 ? (
                  <button
                    onClick={() => loadTransactions(transactionsPage)}
                    disabled={transactionsLoading}
                    className="flex items-center gap-2 px-4 py-2 text-[0.8125rem] font-medium text-white bg-zinc-800/50 border border-zinc-800 rounded-lg cursor-pointer transition-all duration-150 hover:bg-zinc-800 hover:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-4 h-4 ${transactionsLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                ) : null}
              </div>
            </div>

            {/* Not Loaded Yet */}
            {!transactionsLoaded && !transactionsLoading && (
              <div className="flex flex-col items-center justify-center py-16 px-8 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-zinc-800/50 mb-5">
                  <Receipt className="w-7 h-7 text-cyan-400" />
                </div>
                <h3 className="text-base font-semibold text-white m-0 mb-1.5">No history loaded</h3>
                <p className="text-sm text-zinc-500 m-0 max-w-[300px]">
                  Click "Load History" to view your payment records
                </p>
              </div>
            )}

            {/* Loading Skeleton */}
            {transactionsLoading && transactions.length === 0 && (
              <div className="flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-5 border-b border-zinc-800 last:border-b-0">
                    <Skeleton className="w-11 h-11 rounded-[10px]" />
                    <div className="flex-1 flex flex-col gap-2">
                      <Skeleton className="h-3.5 w-[120px] rounded" />
                      <Skeleton className="h-3 w-[200px] rounded" />
                    </div>
                    <Skeleton className="w-[70px] h-10 rounded-md" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {transactionsLoaded && transactions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-8 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-zinc-800/50 mb-5">
                  <Receipt className="w-7 h-7 text-cyan-400" />
                </div>
                <h3 className="text-base font-semibold text-white m-0 mb-1.5">No payment history</h3>
                <p className="text-sm text-zinc-500 m-0 max-w-[300px]">
                  Transactions will appear here after purchasing credits
                </p>
              </div>
            )}

            {/* Transaction List */}
            {transactionsLoaded && transactions.length > 0 && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="max-h-[440px] overflow-y-auto">
                  {transactions.map((tx: any) => (
                    <div
                      key={tx.id}
                      className="flex items-center gap-4 px-5 py-[1.125rem] border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/30 transition-colors duration-150"
                    >
                      <div
                        className={`w-11 h-11 rounded-[10px] flex items-center justify-center shrink-0 ${
                          tx.payment_method === 'stripe'
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'bg-violet-500/10 text-violet-400'
                        }`}
                      >
                        {tx.payment_method === 'stripe' ? (
                          <CreditCard className="w-5 h-5" />
                        ) : (
                          <Wallet className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[0.9375rem] font-medium text-white">{getPackLabel(tx.pack_type)}</span>
                          <span className="text-[0.625rem] font-semibold uppercase tracking-[0.04em] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">
                            {tx.status}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500 mt-1 flex items-center flex-wrap gap-1.5">
                          <span>{formatTransactionDate(tx.purchased_at)}</span>
                          <span className="opacity-40">&bull;</span>
                          <span>{getPaymentMethodLabel(tx.payment_method)}</span>
                          {tx.purchased_by && (
                            <>
                              <span className="opacity-40">&bull;</span>
                              <span>{tx.purchased_by.name || tx.purchased_by.email}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="block text-[0.9375rem] font-semibold text-white">
                          ${parseFloat(tx.amount_usd).toFixed(2)}
                        </span>
                        <span className="block text-xs font-semibold text-cyan-400 mt-0.5">
                          +{parseFloat(tx.hours_purchased).toFixed(0)} min
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalTransactionPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-800 bg-black/15">
                    <span className="text-xs text-zinc-500">
                      Page {transactionsPage} of {totalTransactionPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadTransactions(transactionsPage - 1)}
                        disabled={transactionsPage <= 1 || transactionsLoading}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-zinc-800/50 border-none rounded-md text-zinc-500 cursor-pointer transition-all duration-150 hover:bg-zinc-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Previous
                      </button>
                      <button
                        onClick={() => loadTransactions(transactionsPage + 1)}
                        disabled={transactionsPage >= totalTransactionPages || transactionsLoading}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-zinc-800/50 border-none rounded-md text-zinc-500 cursor-pointer transition-all duration-150 hover:bg-zinc-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ===== SUBSCRIPTIONS TAB ===== */}
        {isAdmin && tab === 'subscriptions' && (
          <section className="flex flex-col gap-5">
            {/* Subscription Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 -mt-2 mb-[3px]">
              {/* Current Plan Card */}
              <div
                className={`relative flex bg-zinc-900/50 border rounded-[10px] overflow-hidden hover:border-white/10 hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-200 ${hasActiveSubscription ? 'border-zinc-800' : 'border-zinc-800'}`}
              >
                <div
                  className={`w-1 shrink-0 ${
                    hasActiveSubscription && subscription?.status === 'active'
                      ? 'bg-emerald-500'
                      : subscription?.status === 'cancelled'
                        ? 'bg-amber-400'
                        : 'bg-zinc-800'
                  }`}
                />
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-3.5 px-5 py-4 border-b border-zinc-800">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-[10px] shrink-0 ${
                        hasActiveSubscription ? 'bg-emerald-500/15 text-emerald-500' : 'bg-zinc-800/50 text-zinc-500'
                      }`}
                    >
                      {hasActiveSubscription ? <Crown className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[0.9375rem] font-semibold text-white m-0 tracking-tight">Current Plan</h3>
                      <p className="text-xs text-zinc-500 m-0 mt-0.5">
                        {hasActiveSubscription ? subscription?.tier_name || 'Active' : 'No subscription'}
                      </p>
                    </div>
                  </div>
                  <div className="px-5 py-5">
                    {hasActiveSubscription ? (
                      <span
                        className={`inline-block px-4 py-2 rounded-md text-sm font-semibold uppercase tracking-[0.05em] ${
                          subscription?.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-amber-400/15 text-amber-400'
                        }`}
                      >
                        {subscription?.status === 'active' ? 'Active' : 'Cancelled'}
                      </span>
                    ) : (
                      <span className="text-xl font-bold text-white">No active plan</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Seats Usage Card */}
              <div className="relative flex bg-zinc-900/50 border border-zinc-800 rounded-[10px] overflow-hidden hover:border-white/10 hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-200">
                <div className="w-1 shrink-0 bg-zinc-800" />
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-3.5 px-5 py-4 border-b border-zinc-800">
                    <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-zinc-800/50 text-zinc-500 shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[0.9375rem] font-semibold text-white m-0 tracking-tight">Team Seats</h3>
                      <p className="text-xs text-zinc-500 m-0 mt-0.5">Members in organization</p>
                    </div>
                  </div>
                  <div className="px-5 py-5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[2rem] font-bold text-white tracking-tight leading-none tabular-nums">
                        {subscription?.current_members || members.length || 0}
                      </span>
                      <span className="text-sm text-zinc-500 font-medium"> / </span>
                      <span className="text-[2rem] font-bold text-zinc-600 tracking-tight leading-none tabular-nums">
                        {subscription?.total_seats || '\u221E'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Credits Card */}
              <div className="relative flex bg-zinc-900/50 border border-zinc-800 rounded-[10px] overflow-hidden hover:border-white/10 hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-200">
                <div className="w-1 shrink-0 bg-cyan-500" />
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-3.5 px-5 py-4 border-b border-zinc-800">
                    <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-cyan-500/15 text-cyan-400 shrink-0">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[0.9375rem] font-semibold text-white m-0 tracking-tight">Monthly Credits</h3>
                      <p className="text-xs text-zinc-500 m-0 mt-0.5">From subscription</p>
                    </div>
                  </div>
                  <div className="px-5 py-5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[2rem] font-bold text-cyan-400 tracking-tight leading-none tabular-nums">
                        {subscription?.total_monthly_credits?.toLocaleString() || 0}
                      </span>
                      <span className="text-sm text-zinc-500 font-medium">min</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription Overview Card (if subscribed) */}
            {hasActiveSubscription && subscription && (
              <div className="relative flex bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden mb-8">
                <div
                  className={`w-1 shrink-0 ${subscription.status === 'active' ? 'bg-emerald-500' : 'bg-amber-400'}`}
                />
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-4 px-6 py-5 border-b border-zinc-800">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-500/15 text-emerald-500">
                      {subscription.status === 'active' ? (
                        <Crown className="w-6 h-6" />
                      ) : (
                        <AlertCircle className="w-6 h-6" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white m-0">{subscription.tier_name || 'Subscription'}</h3>
                      <p className="text-[0.8125rem] text-zinc-500 m-0 mt-1">
                        {subscription.status === 'active' ? 'Active' : 'Cancelled'}
                      </p>
                    </div>
                    {subscription.status === 'active' && isAdmin && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowChangePlanDialog(true)}
                          className="px-4 py-2 text-xs font-medium text-cyan-400 bg-transparent border border-cyan-500/30 rounded-md cursor-pointer transition-all duration-150 hover:bg-cyan-500/10"
                        >
                          Change Plan
                        </button>
                        <button
                          onClick={() => setShowCancelDialog(true)}
                          className="px-4 py-2 text-xs font-medium text-zinc-500 bg-transparent border border-zinc-800 rounded-md cursor-pointer transition-all duration-150 hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/10"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-3 p-4 bg-zinc-800/30 rounded-lg">
                        <Users className="w-5 h-5 text-cyan-400" />
                        <div className="flex flex-col">
                          <span className="text-lg font-bold text-white">
                            {subscription.current_members || 0} / {subscription.total_seats || '\u221E'}
                          </span>
                          <span className="text-[0.6875rem] text-zinc-500 uppercase tracking-[0.05em]">Seats Used</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-zinc-800/30 rounded-lg">
                        <Zap className="w-5 h-5 text-cyan-400" />
                        <div className="flex flex-col">
                          <span className="text-lg font-bold text-white">
                            {subscription.total_monthly_credits?.toLocaleString() || 0}
                          </span>
                          <span className="text-[0.6875rem] text-zinc-500 uppercase tracking-[0.05em]">
                            Credits/Month
                          </span>
                        </div>
                      </div>
                    </div>
                    {subscription.pending_subscription_tier && (
                      <div className="flex items-center gap-2 text-[0.8125rem] text-amber-400 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Downgrading to {subscription.pending_subscription_tier} at end of billing period</span>
                      </div>
                    )}
                    {subscription.end_date && (
                      <div className="flex items-center gap-2 text-[0.8125rem] text-zinc-500">
                        <CalendarCheck className="w-3.5 h-3.5" />
                        {subscription.status === 'active' ? (
                          <span>
                            Renews {formatDate(subscription.end_date)} ({subscription.days_remaining} days)
                          </span>
                        ) : (
                          <span className="text-amber-400">Access until {formatDate(subscription.end_date)}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Plan Selection (if not subscribed) */}
            {!hasActiveSubscription && (
              <div className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-11 h-11 rounded-[10px] flex items-center justify-center bg-zinc-800/50 text-zinc-500 shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white m-0 tracking-tight">Choose Your Plan</h2>
                    <p className="text-[0.8125rem] text-zinc-500 m-0 mt-0.5">
                      Select a base subscription to get started
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
                  {sortedBaseTiers.map((tier) => (
                    <div
                      key={tier.id}
                      className={`relative flex flex-col bg-zinc-900/50 border rounded-xl overflow-hidden transition-all duration-200 hover:border-white/10 hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 ${
                        tier.id === 'enterprise_ai' ? 'border-cyan-500/40' : 'border-zinc-800'
                      }`}
                    >
                      <div className="relative flex flex-col flex-1 p-6">
                        {tier.monthly_credits > 0 && (
                          <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-br from-cyan-500 to-cyan-500/80 text-[#0a0a0b] text-[0.625rem] font-bold uppercase tracking-[0.03em] rounded shadow-[0_2px_8px_rgba(6,182,212,0.3)]">
                            <Star className="w-[11px] h-[11px]" />
                            <span>Includes AI</span>
                          </div>
                        )}
                        <h3 className="text-lg font-bold text-white m-0 mb-2">{tier.name}</h3>
                        <div className="flex items-baseline mb-6">
                          <span className="text-xl font-semibold text-white">$</span>
                          <span className="text-[2.5rem] font-bold text-white tracking-tight">{tier.usd}</span>
                          <span className="text-sm text-zinc-500 ml-1">/mo</span>
                        </div>
                        <ul className="list-none m-0 mb-6 p-0 flex flex-col gap-3">
                          <li className="flex items-center gap-2.5 text-[0.8125rem] text-zinc-500">
                            <Check className="w-[15px] h-[15px] text-emerald-400 shrink-0" />
                            <span>{tier.seats === null ? 'Unlimited team seats' : `${tier.seats} team seats`}</span>
                          </li>
                          {tier.monthly_credits > 0 && (
                            <li className="flex items-center gap-2.5 text-[0.8125rem] text-zinc-500">
                              <Check className="w-[15px] h-[15px] text-emerald-400 shrink-0" />
                              <span>{tier.monthly_credits.toLocaleString()} credits/month</span>
                            </li>
                          )}
                          <li className="flex items-center gap-2.5 text-[0.8125rem] text-zinc-500">
                            <Check className="w-[15px] h-[15px] text-emerald-400 shrink-0" />
                            <span>Team collaboration tools</span>
                          </li>
                          <li className="flex items-center gap-2.5 text-[0.8125rem] text-zinc-500">
                            <Check className="w-[15px] h-[15px] text-emerald-400 shrink-0" />
                            <span>Shared assets & profiles</span>
                          </li>
                        </ul>
                        <Button
                          onClick={() => selectSubscription(tier, 'base')}
                          className={`w-full mt-auto ${tier.id === 'enterprise_ai' ? '' : ''}`}
                          variant={tier.id === 'enterprise_ai' ? 'primary' : 'secondary'}
                        >
                          Get Started
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add-ons Section (only if has base subscription) */}
            {hasActiveSubscription && (
              <div className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-11 h-11 rounded-[10px] flex items-center justify-center bg-zinc-800/50 text-zinc-500 shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white m-0 tracking-tight">Add-ons</h2>
                    <p className="text-[0.8125rem] text-zinc-500 m-0 mt-0.5">Expand your organization's capacity</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {availableAddons.map((addon) => (
                    <div
                      key={addon.id}
                      className="relative p-5 bg-zinc-900/50 border border-zinc-800 rounded-[10px] overflow-hidden transition-all duration-150 hover:border-white/10 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
                    >
                      {addon.requires_ai && (
                        <div className="absolute top-3 right-3 flex items-center gap-[5px] px-3 py-[7px] bg-gradient-to-br from-cyan-500 to-cyan-500/80 text-[#0a0a0b] text-[0.625rem] font-bold uppercase tracking-[0.05em] rounded-[5px] shadow-[0_2px_6px_rgba(6,182,212,0.25)]">
                          <Star className="w-[11px] h-[11px]" />
                          <span>Includes AI Credits</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[0.9375rem] font-semibold text-white">{addon.name}</span>
                      </div>
                      <div className="text-2xl font-bold text-white mb-4">${addon.usd}/mo</div>
                      <ul className="list-none m-0 mb-4 p-0 flex flex-col gap-2">
                        <li className="flex items-center gap-2 text-[0.8125rem] text-zinc-500">
                          <Plus className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{addon.seats} seats</span>
                        </li>
                        {addon.monthly_credits > 0 && (
                          <li className="flex items-center gap-2 text-[0.8125rem] text-zinc-500">
                            <Plus className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{addon.monthly_credits.toLocaleString()} credits/mo</span>
                          </li>
                        )}
                      </ul>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => selectSubscription(addon, 'addon')}
                        className="w-full"
                      >
                        Add to Plan
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Non-Admin View */}
        {!isAdmin && (
          <div className="flex flex-col items-center justify-center py-16 px-8 bg-gradient-to-br from-cyan-500/[0.08] to-transparent border border-cyan-500/20 rounded-xl text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-cyan-500/15 mb-5">
              <Zap className="w-7 h-7 text-cyan-400" />
            </div>
            <h3 className="text-base font-semibold text-white m-0 mb-1.5">Your allocation is displayed above</h3>
            <p className="text-sm text-zinc-500 m-0 max-w-[360px] leading-relaxed">
              Contact your organization admin if you need additional credits allocated to your account
            </p>
          </div>
        )}
      </div>

      {/* Buy Credits Modal */}
      <BuyCreditsModal open={showBuyModal} onClose={handleCreditsSuccess} />

      {/* Subscribe Dialog */}
      {selectedPlan && organizationId && (
        <SubscribeDialog
          open={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
          plan={selectedPlan}
          type={selectedType}
          organizationId={organizationId}
          organizationName={organization?.name}
          onSuccess={handleSubscribeSuccess}
        />
      )}

      {/* Change Plan Dialog */}
      {showChangePlanDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setShowChangePlanDialog(false); setChangePlanTier(null); setProrationPreview(null) }} />
          <div className="relative w-full max-w-[520px] bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            <div className="p-7">
              <div className="flex flex-col items-center mb-6">
                <div className="w-14 h-14 rounded-[14px] flex items-center justify-center bg-cyan-500/15 text-cyan-400 mb-3.5">
                  <Crown className="w-[26px] h-[26px]" />
                </div>
                <h2 className="text-[1.1875rem] font-bold text-white m-0">Change Plan</h2>
                <p className="text-[0.8125rem] text-zinc-500 m-0 mt-1">Current: {subscription?.tier_name}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {sortedBaseTiers.filter(t => t.id !== subscription?.tier).map(tier => (
                  <button
                    key={tier.id}
                    onClick={() => { setChangePlanTier(tier.id); fetchProrationPreview(tier.id) }}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      changePlanTier === tier.id
                        ? 'border-cyan-500/60 bg-cyan-500/10'
                        : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600'
                    }`}
                  >
                    <h4 className="text-sm font-bold text-white m-0 mb-1">{tier.name}</h4>
                    <p className="text-lg font-bold text-white m-0">${tier.usd}<span className="text-xs font-normal text-zinc-500">/mo</span></p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-zinc-500">
                      <Users className="w-3 h-3" /> {tier.seats === null ? '∞' : tier.seats} seats
                      {tier.monthly_credits > 0 && <><span className="mx-1">·</span><Zap className="w-3 h-3" /> {tier.monthly_credits.toLocaleString()}/mo</>}
                    </div>
                  </button>
                ))}
              </div>

              {prorationLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                </div>
              )}

              {prorationPreview && !prorationLoading && (
                <div className="p-4 bg-zinc-800/30 rounded-lg mb-6 text-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-zinc-500">Type</span>
                    <span className={prorationPreview.change_type === 'upgrade' ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                      {prorationPreview.change_type === 'upgrade' ? 'Upgrade' : 'Downgrade'}
                    </span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-zinc-500">New price</span>
                    <span className="text-white font-semibold">${prorationPreview.new_price}/mo</span>
                  </div>
                  {prorationPreview.change_type === 'upgrade' && prorationPreview.proration_amount > 0 && (
                    <div className="flex justify-between mb-2">
                      <span className="text-zinc-500">Prorated charge now</span>
                      <span className="text-white font-semibold">${prorationPreview.proration_amount}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Effective</span>
                    <span className="text-white">{prorationPreview.effective_date === 'immediate' ? 'Immediately' : formatDate(prorationPreview.effective_date)}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handleChangePlan}
                  disabled={!changePlanTier || changePlanLoading}
                  className="flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold rounded-lg border-none cursor-pointer transition-all duration-150 bg-cyan-500 text-[#0a0a0b] hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changePlanLoading && <Loader2 className="w-[18px] h-[18px] animate-spin" />}
                  {changePlanLoading ? 'Changing...' : 'Confirm Change'}
                </button>
                <button
                  onClick={() => { setShowChangePlanDialog(false); setChangePlanTier(null); setProrationPreview(null) }}
                  className="flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold rounded-lg border border-zinc-800 cursor-pointer transition-all duration-150 bg-zinc-800/50 text-white hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Subscription Confirmation */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCancelDialog(false)} />
          <div className="relative w-full max-w-[420px] bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            <div className="p-7">
              <div className="flex flex-col items-center mb-6">
                <div className="w-14 h-14 rounded-[14px] flex items-center justify-center bg-red-500/15 text-red-400 mb-3.5">
                  <AlertTriangle className="w-[26px] h-[26px]" />
                </div>
                <h2 className="text-[1.1875rem] font-bold text-white m-0">Cancel Subscription?</h2>
                <p className="text-[0.8125rem] text-zinc-500 m-0 mt-1">
                  Your organization will lose access after the current period ends
                </p>
              </div>
              <div className="flex flex-col gap-5">
                <div className="p-[1.125rem] bg-zinc-800/30 rounded-lg text-[0.8125rem] text-zinc-500 leading-relaxed">
                  <p className="m-0 mb-2">
                    Your subscription will remain active until{' '}
                    <strong className="text-white">{formatDate(subscription?.end_date || '')}</strong>. After that, your
                    organization will lose access to subscription features.
                  </p>
                  <p className="m-0 opacity-70">Your credits will remain in your organization pool.</p>
                </div>
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={cancelSubscription}
                    disabled={cancelLoading}
                    className="flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold rounded-lg border-none cursor-pointer transition-all duration-150 bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancelLoading && <Loader2 className="w-[18px] h-[18px] animate-spin" />}
                    Yes, Cancel Subscription
                  </button>
                  <button
                    onClick={() => setShowCancelDialog(false)}
                    className="flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold rounded-lg border border-zinc-800 cursor-pointer transition-all duration-150 bg-zinc-800/50 text-white hover:bg-zinc-800"
                  >
                    Keep Subscription
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
