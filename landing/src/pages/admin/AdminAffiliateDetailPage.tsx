import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Handshake,
  Loader2,
  Save,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import {
  activateAffiliate,
  deactivateAffiliate,
  getAffiliateDetails,
  recordAffiliatePayout,
  updateAffiliate,
  type Affiliate,
  type AffiliatePayout,
  type AffiliateReferral,
} from '@/services/adminApi'
import { formatDate, formatDateTime, formatNumber, toTitleCase } from './adminFormat'

interface EditFormState {
  signup_commission_pct: number
  recurring_commission_pct: number
  credit_pack_commission_enabled: boolean
  credit_pack_commission_pct: number
  payout_method: string
  solana_usdc_address: string
  paypal_email: string
  notes: string
}

interface PayoutFormState {
  period_month: number
  period_year: number
  manual_amount: string
  transaction_id: string
  payout_method: string
  notes: string
  screenshot: File | null
}

function createEditForm(affiliate: Affiliate): EditFormState {
  return {
    signup_commission_pct: affiliate.signup_commission_pct,
    recurring_commission_pct: affiliate.recurring_commission_pct,
    credit_pack_commission_enabled: affiliate.credit_pack_commission_enabled,
    credit_pack_commission_pct: affiliate.credit_pack_commission_pct,
    payout_method: affiliate.payout_method || 'crypto',
    solana_usdc_address: affiliate.solana_usdc_address || '',
    paypal_email: affiliate.paypal_email || '',
    notes: affiliate.notes || '',
  }
}

function createPayoutForm(): PayoutFormState {
  const now = new Date()
  return {
    period_month: now.getMonth() + 1,
    period_year: now.getFullYear(),
    manual_amount: '',
    transaction_id: '',
    payout_method: 'crypto',
    notes: '',
    screenshot: null,
  }
}

export function AdminAffiliateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const affiliateId = Number(id)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [payingOut, setPayingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null)
  const [referrals, setReferrals] = useState<AffiliateReferral[]>([])
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([])
  const [editForm, setEditForm] = useState<EditFormState | null>(null)
  const [payoutForm, setPayoutForm] = useState<PayoutFormState>(createPayoutForm)

  const load = useCallback(async () => {
    if (!Number.isFinite(affiliateId) || affiliateId <= 0) {
      setError('Invalid affiliate id')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await getAffiliateDetails(affiliateId)
      if (!result.affiliate) {
        setError('Affiliate not found')
        setAffiliate(null)
        return
      }

      setAffiliate(result.affiliate)
      setReferrals(result.referrals)
      setPayouts(result.payouts)
      setEditForm(createEditForm(result.affiliate))
    } catch (err: any) {
      setError(err?.message || 'Failed to load affiliate')
    } finally {
      setLoading(false)
    }
  }, [affiliateId])

  useEffect(() => {
    load()
  }, [load])

  const totalCommission = useMemo(
    () => referrals.reduce((acc, row) => acc + (row.commission_usd || 0), 0),
    [referrals],
  )

  async function handleSave() {
    if (!affiliate || !editForm) return
    setSaving(true)
    setError(null)
    try {
      await updateAffiliate(affiliate.id, {
        signup_commission_pct: editForm.signup_commission_pct,
        recurring_commission_pct: editForm.recurring_commission_pct,
        credit_pack_commission_enabled: editForm.credit_pack_commission_enabled,
        credit_pack_commission_pct: editForm.credit_pack_commission_pct,
        payout_method: editForm.payout_method,
        solana_usdc_address: editForm.solana_usdc_address || undefined,
        paypal_email: editForm.paypal_email || undefined,
        notes: editForm.notes || undefined,
      })
      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to save affiliate settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate() {
    if (!affiliate) return
    const ok = window.confirm('Deactivate this affiliate?')
    if (!ok) return

    setSaving(true)
    setError(null)
    try {
      await deactivateAffiliate(affiliate.id)
      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to deactivate affiliate')
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate() {
    if (!affiliate) return

    setSaving(true)
    setError(null)
    try {
      await activateAffiliate(affiliate.id)
      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to activate affiliate')
    } finally {
      setSaving(false)
    }
  }

  async function handleRecordPayout() {
    if (!affiliate) return

    setPayingOut(true)
    setError(null)
    try {
      await recordAffiliatePayout(affiliate.id, {
        period_month: payoutForm.period_month,
        period_year: payoutForm.period_year,
        manual_amount: payoutForm.manual_amount ? Number(payoutForm.manual_amount) : undefined,
        transaction_id: payoutForm.transaction_id || undefined,
        payout_method: payoutForm.payout_method || undefined,
        notes: payoutForm.notes || undefined,
        screenshot: payoutForm.screenshot || undefined,
      })

      setPayoutForm(createPayoutForm())
      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to record payout')
    } finally {
      setPayingOut(false)
    }
  }

  return (
    <PageLayout
      icon={Handshake}
      title={affiliate ? `Affiliate: ${affiliate.referral_code}` : 'Affiliate Detail'}
      actions={
        <button
          onClick={() => navigate('/admin/affiliates')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-zinc-200 border border-zinc-700 bg-transparent hover:bg-zinc-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      }
    >
      <div className="p-6 space-y-4 max-w-[1500px] w-full mx-auto">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 flex items-center justify-center text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading affiliate...
          </div>
        ) : !affiliate || !editForm ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-zinc-400">Affiliate not found.</div>
        ) : (
          <>
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="m-0 text-2xl font-bold text-white">{affiliate.referral_code}</h1>
                  <p className="m-0 mt-1 text-sm text-zinc-400">
                    {affiliate.user?.name || affiliate.user?.email || `User #${affiliate.user?.id}`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex px-2 py-1 rounded text-xs font-semibold border ${
                      affiliate.status === 'active'
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                        : 'bg-zinc-700/70 border-zinc-600 text-zinc-300'
                    }`}
                  >
                    {affiliate.status}
                  </span>

                  {affiliate.status === 'active' ? (
                    <button
                      onClick={handleDeactivate}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold border border-amber-500/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
                    >
                      <ShieldAlert className="inline-block w-3.5 h-3.5 mr-1" />
                      Deactivate
                    </button>
                  ) : (
                    <button
                      onClick={handleActivate}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      <ShieldCheck className="inline-block w-3.5 h-3.5 mr-1" />
                      Activate
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-zinc-800 bg-[#0c0c0f] p-3">
                  <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Referrals</p>
                  <p className="m-0 mt-1 text-xl font-semibold text-zinc-100">{formatNumber(referrals.length)}</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-[#0c0c0f] p-3">
                  <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Commission</p>
                  <p className="m-0 mt-1 text-xl font-semibold text-amber-300">${totalCommission.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-[#0c0c0f] p-3">
                  <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Payouts</p>
                  <p className="m-0 mt-1 text-xl font-semibold text-violet-300">{formatNumber(payouts.length)}</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-[#0c0c0f] p-3">
                  <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Created</p>
                  <p className="m-0 mt-1 text-sm font-semibold text-zinc-200">{formatDate(affiliate.inserted_at)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="m-0 text-sm font-semibold text-white">Affiliate Settings</h2>
              <p className="m-0 mt-1 text-xs text-zinc-500">Configure commission rates and payout destination.</p>

              <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="text-xs text-zinc-400">
                  Signup Commission %
                  <input
                    type="number"
                    value={editForm.signup_commission_pct}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, signup_commission_pct: Number(e.target.value) } : prev))}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>

                <label className="text-xs text-zinc-400">
                  Recurring Commission %
                  <input
                    type="number"
                    value={editForm.recurring_commission_pct}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, recurring_commission_pct: Number(e.target.value) } : prev))}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>

                <label className="text-xs text-zinc-400">
                  Payout Method
                  <select
                    value={editForm.payout_method}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, payout_method: e.target.value } : prev))}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  >
                    <option value="crypto">Crypto</option>
                    <option value="paypal">PayPal</option>
                  </select>
                </label>

                <label className="text-xs text-zinc-400 flex items-end">
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editForm.credit_pack_commission_enabled}
                      onChange={(e) =>
                        setEditForm((prev) =>
                          prev ? { ...prev, credit_pack_commission_enabled: e.target.checked } : prev,
                        )
                      }
                    />
                    Enable Credit-Pack Commission
                  </span>
                </label>

                {editForm.credit_pack_commission_enabled && (
                  <label className="text-xs text-zinc-400">
                    Credit-Pack Commission %
                    <input
                      type="number"
                      value={editForm.credit_pack_commission_pct}
                      onChange={(e) =>
                        setEditForm((prev) =>
                          prev ? { ...prev, credit_pack_commission_pct: Number(e.target.value) } : prev,
                        )
                      }
                      className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                    />
                  </label>
                )}

                {editForm.payout_method === 'crypto' ? (
                  <label className="text-xs text-zinc-400 sm:col-span-2">
                    Solana USDC Address
                    <div className="relative mt-1">
                      <Wallet className="absolute left-2.5 top-2.5 w-4 h-4 text-zinc-500" />
                      <input
                        value={editForm.solana_usdc_address}
                        onChange={(e) => setEditForm((prev) => (prev ? { ...prev, solana_usdc_address: e.target.value } : prev))}
                        className="w-full h-9 pl-8 pr-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                      />
                    </div>
                  </label>
                ) : (
                  <label className="text-xs text-zinc-400 sm:col-span-2">
                    PayPal Email
                    <input
                      value={editForm.paypal_email}
                      onChange={(e) => setEditForm((prev) => (prev ? { ...prev, paypal_email: e.target.value } : prev))}
                      className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                    />
                  </label>
                )}

                <label className="text-xs text-zinc-400 sm:col-span-2">
                  Notes
                  <textarea
                    rows={3}
                    value={editForm.notes}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                    className="mt-1 w-full px-3 py-2 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-2 rounded-md text-xs font-semibold text-black bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="inline-block w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="inline-block w-3.5 h-3.5 mr-1" />}
                  Save Settings
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="m-0 text-sm font-semibold text-white">Record Payout</h2>
              <p className="m-0 mt-1 text-xs text-zinc-500">Record manual payout details and attach proof.</p>

              <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <label className="text-xs text-zinc-400">
                  Month
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={payoutForm.period_month}
                    onChange={(e) => setPayoutForm((prev) => ({ ...prev, period_month: Number(e.target.value) }))}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>

                <label className="text-xs text-zinc-400">
                  Year
                  <input
                    type="number"
                    min={2025}
                    value={payoutForm.period_year}
                    onChange={(e) => setPayoutForm((prev) => ({ ...prev, period_year: Number(e.target.value) }))}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>

                <label className="text-xs text-zinc-400">
                  Manual Amount (USD)
                  <input
                    value={payoutForm.manual_amount}
                    onChange={(e) => setPayoutForm((prev) => ({ ...prev, manual_amount: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>

                <label className="text-xs text-zinc-400">
                  Payout Method
                  <select
                    value={payoutForm.payout_method}
                    onChange={(e) => setPayoutForm((prev) => ({ ...prev, payout_method: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  >
                    <option value="crypto">Crypto</option>
                    <option value="paypal">PayPal</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>

                <label className="text-xs text-zinc-400 sm:col-span-2">
                  Transaction ID
                  <input
                    value={payoutForm.transaction_id}
                    onChange={(e) => setPayoutForm((prev) => ({ ...prev, transaction_id: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>

                <label className="text-xs text-zinc-400 sm:col-span-3">
                  Screenshot Proof
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setPayoutForm((prev) => ({ ...prev, screenshot: e.target.files?.[0] || null }))
                    }
                    className="mt-1 w-full text-xs text-zinc-300"
                  />
                </label>

                <label className="text-xs text-zinc-400 sm:col-span-3">
                  Notes
                  <textarea
                    rows={2}
                    value={payoutForm.notes}
                    onChange={(e) => setPayoutForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleRecordPayout}
                  disabled={payingOut}
                  className="px-3 py-2 rounded-md text-xs font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50"
                >
                  {payingOut ? <Loader2 className="inline-block w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="inline-block w-3.5 h-3.5 mr-1" />}
                  Record Payout
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h2 className="m-0 text-sm font-semibold text-white">Referrals ({referrals.length})</h2>
              </div>
              <div className="overflow-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-zinc-900/80">
                    <tr className="text-left text-zinc-400 text-xs uppercase tracking-wide">
                      <th className="px-3 py-2 border-b border-zinc-800">Event</th>
                      <th className="px-3 py-2 border-b border-zinc-800">User</th>
                      <th className="px-3 py-2 border-b border-zinc-800">Commission</th>
                      <th className="px-3 py-2 border-b border-zinc-800">Status</th>
                      <th className="px-3 py-2 border-b border-zinc-800">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((row) => (
                      <tr key={row.id} className="border-b border-zinc-800/60">
                        <td className="px-3 py-2 text-zinc-200">{toTitleCase(row.event_type)}</td>
                        <td className="px-3 py-2 text-zinc-300 text-xs">{row.referred_user?.email || `User #${row.referred_user?.id || 'N/A'}`}</td>
                        <td className="px-3 py-2 text-zinc-300">${row.commission_usd.toFixed(2)}</td>
                        <td className="px-3 py-2 text-zinc-300">{row.status}</td>
                        <td className="px-3 py-2 text-zinc-500 text-xs">{formatDateTime(row.inserted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h2 className="m-0 text-sm font-semibold text-white">Payout History ({payouts.length})</h2>
              </div>
              <div className="overflow-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-zinc-900/80">
                    <tr className="text-left text-zinc-400 text-xs uppercase tracking-wide">
                      <th className="px-3 py-2 border-b border-zinc-800">Period</th>
                      <th className="px-3 py-2 border-b border-zinc-800">Amount</th>
                      <th className="px-3 py-2 border-b border-zinc-800">Method</th>
                      <th className="px-3 py-2 border-b border-zinc-800">Status</th>
                      <th className="px-3 py-2 border-b border-zinc-800">Paid At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((row) => (
                      <tr key={row.id} className="border-b border-zinc-800/60">
                        <td className="px-3 py-2 text-zinc-300">{row.period_month}/{row.period_year}</td>
                        <td className="px-3 py-2 text-zinc-200">${row.amount_usd.toFixed(2)}</td>
                        <td className="px-3 py-2 text-zinc-300">{row.payout_method}</td>
                        <td className="px-3 py-2 text-zinc-300">{row.status}</td>
                        <td className="px-3 py-2 text-zinc-500 text-xs">{formatDateTime(row.paid_at || row.inserted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </PageLayout>
  )
}
