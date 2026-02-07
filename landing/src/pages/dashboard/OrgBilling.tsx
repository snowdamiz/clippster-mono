import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { Badge } from '@/components/ui/Badge'
import { BuyCreditsModal } from '@/components/organization/BuyCreditsModal'
import { CreditCard, Plus, Clock, Sparkles, Users, TrendingUp } from 'lucide-react'

export function OrgBilling() {
  const {
    loading, isAdmin, poolBalance, credits, members, subscription,
    transactions, transactionsLoading, transactionsTotal, transactionsPage,
    transactionsPerPage, totalTransactionPages, loadOrganization, loadTransactions,
    formatAllocation, hasActiveSubscription, totalSeats
  } = useOrganization()
  const [tab, setTab] = useState<'credits' | 'history' | 'subscription'>('credits')
  const [showBuyModal, setShowBuyModal] = useState(false)

  useEffect(() => { loadOrganization() }, [loadOrganization])
  useEffect(() => { if (tab === 'history' && isAdmin) loadTransactions() }, [tab, isAdmin, loadTransactions])

  if (loading) return <PageLayout icon={CreditCard} title="Billing"><div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div></PageLayout>

  return (
    <PageLayout icon={CreditCard} title="Billing & Credits" description="Manage credits, subscriptions, and payments" actions={isAdmin && <Button onClick={() => setShowBuyModal(true)}><Plus className="w-4 h-4" /> Buy Credits</Button>}>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-zinc-900/50 rounded-xl w-fit">
        {(['credits', 'history', 'subscription'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {t === 'credits' ? 'Credits' : t === 'history' ? 'History' : 'Subscription'}
          </button>
        ))}
      </div>

      {tab === 'credits' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-cyan-400" /><span className="text-xs text-cyan-400 uppercase tracking-wider">Pool Balance</span></div>
              <p className="text-3xl font-bold text-white">{poolBalance}</p>
              <p className="text-xs text-zinc-500">minutes remaining</p>
            </div>
            <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-zinc-500" /><span className="text-xs text-zinc-500 uppercase tracking-wider">Used</span></div>
              <p className="text-3xl font-bold text-white">{credits.hoursUsed}</p>
              <p className="text-xs text-zinc-500">minutes used</p>
            </div>
            <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-zinc-500" /><span className="text-xs text-zinc-500 uppercase tracking-wider">Allocations</span></div>
              <p className="text-3xl font-bold text-white">{members.filter(m => m.allocation).length}</p>
              <p className="text-xs text-zinc-500">members with credits</p>
            </div>
          </div>

          {/* Member allocations */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800"><h3 className="text-sm font-semibold text-white">Member Allocations</h3></div>
            <div className="divide-y divide-zinc-800">
              {members.map(member => (
                <div key={member.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-white">{member.user?.name || member.user?.email}</span>
                    <Badge variant={member.role === 'owner' ? 'owner' : member.role === 'admin' ? 'admin' : 'member'}>{member.role}</Badge>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-white">{formatAllocation(member.allocation?.hours_remaining)}</span>
                    <span className="text-xs text-zinc-600 ml-1">/ {formatAllocation(member.allocation?.hours_allocated)} min</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800"><h3 className="text-sm font-semibold text-white flex items-center gap-2"><Clock className="w-4 h-4" /> Transaction History</h3></div>
          {transactionsLoading ? (
            <div className="p-5 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-600">No transactions yet</div>
          ) : (
            <>
              <div className="divide-y divide-zinc-800">
                {transactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between px-5 py-4 hover:bg-zinc-800/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-white">{tx.description || tx.pack_type || 'Credit Purchase'}</p>
                      <p className="text-xs text-zinc-500">{new Date(tx.inserted_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      {tx.amount_usd && <p className="text-sm font-semibold text-white">${tx.amount_usd}</p>}
                      {tx.credits_added && <p className="text-xs font-medium text-cyan-400">+{tx.credits_added} min</p>}
                    </div>
                  </div>
                ))}
              </div>
              <Pagination page={transactionsPage} totalPages={totalTransactionPages} onPageChange={loadTransactions} total={transactionsTotal} perPage={transactionsPerPage} />
            </>
          )}
        </div>
      )}

      {tab === 'subscription' && (
        <div className="space-y-4">
          {hasActiveSubscription && subscription ? (
            <div className="p-5 bg-zinc-900/50 border border-emerald-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-3"><Badge variant="success">Active</Badge><span className="text-white font-semibold">{subscription.tier_name}</span></div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-zinc-500">Seats</p><p className="text-lg font-bold text-white">{subscription.current_members}/{totalSeats || '\u221E'}</p></div>
                <div><p className="text-xs text-zinc-500">Monthly Credits</p><p className="text-lg font-bold text-white">{subscription.total_monthly_credits} min</p></div>
                <div><p className="text-xs text-zinc-500">Days Remaining</p><p className="text-lg font-bold text-white">{subscription.days_remaining}</p></div>
                <div><p className="text-xs text-zinc-500">Renewal</p><p className="text-lg font-bold text-white capitalize">{subscription.renewal_method || 'Auto'}</p></div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <p className="text-sm text-zinc-500">No active subscription. Purchase credit packs or subscribe to a plan.</p>
              <Button className="mt-4" onClick={() => setShowBuyModal(true)}>Buy Credits</Button>
            </div>
          )}
        </div>
      )}

      <BuyCreditsModal open={showBuyModal} onClose={() => setShowBuyModal(false)} />
    </PageLayout>
  )
}
