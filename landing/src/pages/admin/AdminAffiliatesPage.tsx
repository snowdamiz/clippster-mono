import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Handshake,
  Loader2,
  Plus,
  RefreshCw,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import {
  createAffiliate,
  getAdminAffiliatesOverview,
  listAdminUsers,
  listAffiliates,
  type AdminOverview,
  type AdminUser,
  type Affiliate,
} from '@/services/adminApi'
import { formatDate, formatNumber } from './adminFormat'

function emptyOverview(): AdminOverview {
  return {
    total_affiliates: 0,
    active_affiliates: 0,
    total_referrals: 0,
    total_commission: 0,
    total_pending: 0,
    total_paid: 0,
  }
}

export function AdminAffiliatesPage() {
  const [rows, setRows] = useState<Affiliate[]>([])
  const [overview, setOverview] = useState<AdminOverview>(emptyOverview)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const [selectedUserId, setSelectedUserId] = useState<number>(0)
  const [referralCode, setReferralCode] = useState('')
  const [signupPct, setSignupPct] = useState(20)
  const [recurringPct, setRecurringPct] = useState(10)
  const [creditPackEnabled, setCreditPackEnabled] = useState(false)
  const [creditPackPct, setCreditPackPct] = useState(5)
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [affiliates, stats, allUsers] = await Promise.all([listAffiliates(), getAdminAffiliatesOverview(), listAdminUsers()])
      setRows(affiliates)
      setOverview(stats)
      setUsers(allUsers)
    } catch (err: any) {
      setError(err?.message || 'Failed to load affiliates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const availableUsers = useMemo(() => users.filter((u) => !u.is_affiliate), [users])

  function resetCreateForm() {
    setSelectedUserId(0)
    setReferralCode('')
    setSignupPct(20)
    setRecurringPct(10)
    setCreditPackEnabled(false)
    setCreditPackPct(5)
    setNotes('')
  }

  async function handleCreate() {
    if (!selectedUserId || !referralCode.trim()) {
      setError('User and referral code are required')
      return
    }

    setCreating(true)
    setError(null)
    try {
      await createAffiliate({
        user_id: selectedUserId,
        referral_code: referralCode.trim().toUpperCase(),
        signup_commission_pct: signupPct,
        recurring_commission_pct: recurringPct,
        credit_pack_commission_enabled: creditPackEnabled,
        credit_pack_commission_pct: creditPackEnabled ? creditPackPct : undefined,
        notes: notes.trim() || undefined,
      })
      setShowCreate(false)
      resetCreateForm()
      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to create affiliate')
    } finally {
      setCreating(false)
    }
  }

  return (
    <PageLayout
      icon={Handshake}
      title="Affiliates"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-zinc-200 border border-zinc-700 bg-transparent hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-black bg-cyan-400 hover:bg-cyan-300"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Affiliate
          </button>
        </div>
      }
    >
      <div className="p-6 space-y-4 max-w-[1500px] w-full mx-auto">
        <div>
          <h1 className="m-0 text-2xl font-bold text-white">Affiliate Management</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">Manage affiliate accounts, commissions, and payouts.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Total Affiliates</p>
            <p className="m-0 mt-2 text-2xl font-bold text-white">{formatNumber(overview.total_affiliates)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Active</p>
            <p className="m-0 mt-2 text-2xl font-bold text-emerald-300">{formatNumber(overview.active_affiliates)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Total Commission</p>
            <p className="m-0 mt-2 text-2xl font-bold text-amber-300">${overview.total_commission.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Pending Payout</p>
            <p className="m-0 mt-2 text-2xl font-bold text-violet-300">${overview.total_pending.toFixed(2)}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading && rows.length === 0 ? (
          <div className="py-12 flex items-center justify-center text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading affiliates...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
            <Handshake className="w-7 h-7 text-zinc-500 mx-auto mb-3" />
            <h3 className="m-0 text-sm font-semibold text-zinc-200">No affiliates yet</h3>
            <p className="m-0 mt-1 text-xs text-zinc-500">Create your first affiliate to start tracking referrals.</p>
          </div>
        ) : (
          <div className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full min-w-[1150px] text-sm border-collapse">
              <thead className="bg-zinc-900/80">
                <tr className="text-left text-zinc-400">
                  <th className="px-3 py-2 border-b border-zinc-800">Affiliate</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Referral Code</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Commission Rates</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Performance</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Status</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Created</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((aff) => (
                  <tr key={aff.id} className="border-b border-zinc-800/70">
                    <td className="px-3 py-2">
                      <p className="m-0 text-zinc-100 font-medium">{aff.user?.name || aff.user?.email || `User #${aff.user?.id}`}</p>
                      <p className="m-0 mt-0.5 text-xs text-zinc-500">{aff.user?.email || aff.user?.wallet_address || '-'}</p>
                    </td>
                    <td className="px-3 py-2">
                      <code className="inline-block bg-zinc-800 px-2 py-1 rounded text-xs text-cyan-200">{aff.referral_code}</code>
                    </td>
                    <td className="px-3 py-2 text-zinc-300 text-xs">
                      <p className="m-0">Signup: {aff.signup_commission_pct}%</p>
                      <p className="m-0 mt-0.5">Recurring: {aff.recurring_commission_pct}%</p>
                      {aff.credit_pack_commission_enabled && (
                        <p className="m-0 mt-0.5 text-amber-300">Credit Packs: {aff.credit_pack_commission_pct}%</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-300 text-xs">
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-zinc-500" />
                        {formatNumber(aff.stats?.total_referrals || 0)} referrals
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
                        ${Number(aff.stats?.total_earned || 0).toFixed(2)} earned
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${
                          aff.status === 'active'
                            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                            : 'bg-zinc-700/70 border-zinc-600 text-zinc-300'
                        }`}
                      >
                        {aff.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-500 text-xs">{formatDate(aff.inserted_at)}</td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/admin/affiliates/${aff.id}`}
                        className="inline-flex items-center gap-1 text-xs text-cyan-300 hover:text-cyan-200"
                      >
                        Open
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-[#111113] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="m-0 text-lg font-semibold text-white">Create Affiliate</h2>
                <p className="m-0 mt-1 text-xs text-zinc-500">Set up referral tracking and payout rates.</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-zinc-200">Close</button>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <label className="text-xs text-zinc-400 sm:col-span-2">
                User Account
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(Number(e.target.value))}
                  className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                >
                  <option value={0}>Select user</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email || user.wallet_address || `User #${user.id}`} (#{user.id})
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-zinc-400 sm:col-span-2">
                Referral Code
                <input
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="STREAMER_NAME"
                  className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                />
              </label>

              <label className="text-xs text-zinc-400">
                Signup %
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={signupPct}
                  onChange={(e) => setSignupPct(Number(e.target.value))}
                  className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                />
              </label>

              <label className="text-xs text-zinc-400">
                Recurring %
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={recurringPct}
                  onChange={(e) => setRecurringPct(Number(e.target.value))}
                  className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                />
              </label>

              <label className="text-xs text-zinc-400 sm:col-span-2 flex items-center gap-2">
                <input type="checkbox" checked={creditPackEnabled} onChange={(e) => setCreditPackEnabled(e.target.checked)} />
                Enable credit-pack commission
              </label>

              {creditPackEnabled && (
                <label className="text-xs text-zinc-400 sm:col-span-2">
                  Credit-Pack %
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    value={creditPackPct}
                    onChange={(e) => setCreditPackPct(Number(e.target.value))}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>
              )}

              <label className="text-xs text-zinc-400 sm:col-span-2">
                Notes
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-2 rounded-md border border-zinc-700 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-3 py-2 rounded-md text-xs font-semibold text-black bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50"
              >
                {creating ? <Loader2 className="inline-block w-3.5 h-3.5 animate-spin mr-1" /> : <UserPlus className="inline-block w-3.5 h-3.5 mr-1" />}
                Create Affiliate
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
