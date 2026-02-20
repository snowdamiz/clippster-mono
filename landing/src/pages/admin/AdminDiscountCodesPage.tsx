import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Calendar,
  ChevronRight,
  Copy,
  Eye,
  Loader2,
  Percent,
  Plus,
  RefreshCw,
  Save,
} from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import {
  createPromoCode,
  getPromoCode,
  listPromoCodes,
  togglePromoCode,
  updatePromoCode,
  type PromoCode,
  type PromoRedemption,
} from '@/services/adminApi'
import { formatDate, formatDateTime, formatNumber } from './adminFormat'

interface PromoFormState {
  code: string
  name: string
  percent_off: number
  duration_kind: 'once' | 'repeating' | 'forever'
  duration_months: number
  allowed_tiers: string[]
  allowed_org_tiers: string[]
  allowed_credit_packs: string[]
  max_redemptions: number
  redeem_by: string
  notes: string
}

const consumerTiers = ['starter', 'creator', 'pro'] as const
const orgTiers = ['solo', 'enterprise_base', 'enterprise_ai', 'enterprise_unlimited'] as const
const creditPacks = ['20', '60', '120'] as const

function defaultForm(): PromoFormState {
  return {
    code: '',
    name: '',
    percent_off: 20,
    duration_kind: 'once',
    duration_months: 1,
    allowed_tiers: ['starter', 'creator', 'pro'],
    allowed_org_tiers: [],
    allowed_credit_packs: [],
    max_redemptions: 0,
    redeem_by: '',
    notes: '',
  }
}

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 8; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function durationLabel(code: PromoCode): string {
  if (code.duration_kind === 'forever') return 'Forever'
  if (code.duration_kind === 'once') return 'One-time'
  return `${code.duration_months || 0} months`
}

export function AdminDiscountCodesPage() {
  const [rows, setRows] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [showEditor, setShowEditor] = useState(false)
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null)
  const [form, setForm] = useState<PromoFormState>(defaultForm)

  const [showDetail, setShowDetail] = useState(false)
  const [detailPromo, setDetailPromo] = useState<PromoCode | null>(null)
  const [detailRedemptions, setDetailRedemptions] = useState<PromoRedemption[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listPromoCodes({
        is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
        search: search || undefined,
      })
      setRows(data)
    } catch (err: any) {
      setError(err?.message || 'Failed to load discount codes')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const total = rows.length
    const active = rows.filter((x) => x.is_active).length
    const redemptions = rows.reduce((acc, x) => acc + x.redemption_count, 0)
    return { total, active, redemptions }
  }, [rows])

  function resetEditor(promo?: PromoCode) {
    if (!promo) {
      setEditingPromo(null)
      setForm({ ...defaultForm(), code: randomCode() })
      return
    }

    setEditingPromo(promo)
    setForm({
      code: promo.code,
      name: promo.name || '',
      percent_off: promo.percent_off,
      duration_kind: promo.duration_kind,
      duration_months: promo.duration_months || 1,
      allowed_tiers: promo.allowed_tiers || [],
      allowed_org_tiers: promo.allowed_org_tiers || [],
      allowed_credit_packs: promo.allowed_credit_packs || [],
      max_redemptions: promo.max_redemptions || 0,
      redeem_by: promo.redeem_by ? promo.redeem_by.slice(0, 10) : '',
      notes: promo.notes || '',
    })
  }

  function toggleString(items: string[], value: string) {
    return items.includes(value) ? items.filter((x) => x !== value) : [...items, value]
  }

  async function handleSave() {
    if (!form.code.trim()) {
      setError('Code is required')
      return
    }

    if (!form.allowed_tiers.length && !form.allowed_org_tiers.length && !form.allowed_credit_packs.length) {
      setError('At least one target tier is required')
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (editingPromo) {
        await updatePromoCode(editingPromo.id, {
          name: form.name || undefined,
          max_redemptions: form.max_redemptions > 0 ? form.max_redemptions : undefined,
          redeem_by: form.redeem_by || undefined,
          notes: form.notes || undefined,
        })
      } else {
        await createPromoCode({
          code: form.code.toUpperCase(),
          name: form.name || undefined,
          percent_off: form.percent_off,
          duration_kind: form.duration_kind,
          duration_months: form.duration_kind === 'repeating' ? form.duration_months : undefined,
          allowed_tiers: form.allowed_tiers,
          allowed_org_tiers: form.allowed_org_tiers,
          allowed_credit_packs: form.allowed_credit_packs,
          max_redemptions: form.max_redemptions > 0 ? form.max_redemptions : undefined,
          redeem_by: form.redeem_by || undefined,
          notes: form.notes || undefined,
        })
      }

      setShowEditor(false)
      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to save discount code')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(promo: PromoCode) {
    setBusyId(promo.id)
    try {
      await togglePromoCode(promo.id, !promo.is_active)
      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to toggle discount code')
    } finally {
      setBusyId(null)
    }
  }

  async function openDetail(promo: PromoCode) {
    setLoadingDetail(true)
    setShowDetail(true)
    setDetailPromo(promo)
    setDetailRedemptions([])

    try {
      const result = await getPromoCode(promo.id)
      if (result.promo) setDetailPromo(result.promo)
      setDetailRedemptions(result.redemptions)
    } catch (err: any) {
      setError(err?.message || 'Failed to load promo details')
    } finally {
      setLoadingDetail(false)
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      setError('Failed to copy to clipboard')
    }
  }

  return (
    <PageLayout
      icon={Percent}
      title="Discount Codes"
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
            onClick={() => {
              resetEditor()
              setShowEditor(true)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-black bg-cyan-400 hover:bg-cyan-300"
          >
            <Plus className="w-3.5 h-3.5" />
            New Code
          </button>
        </div>
      }
    >
      <div className="p-6 space-y-4 max-w-[1500px] w-full mx-auto">
        <div>
          <h1 className="m-0 text-2xl font-bold text-white">Discount Codes</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">Create, activate, and manage promo campaigns.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Total Codes</p>
            <p className="m-0 mt-2 text-2xl font-bold text-white">{formatNumber(stats.total)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Active</p>
            <p className="m-0 mt-2 text-2xl font-bold text-emerald-300">{formatNumber(stats.active)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Redemptions</p>
            <p className="m-0 mt-2 text-2xl font-bold text-cyan-300">{formatNumber(stats.redemptions)}</p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code or name"
            className="h-9 px-3 min-w-[240px] rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            onClick={load}
            className="h-9 px-3 rounded-md border border-zinc-700 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
          >
            Apply
          </button>
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
            Loading discount codes...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-zinc-400">No discount codes found.</div>
        ) : (
          <div className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full min-w-[1200px] text-sm border-collapse">
              <thead className="bg-zinc-900/80">
                <tr className="text-left text-zinc-400">
                  <th className="px-3 py-2 border-b border-zinc-800">Code</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Discount</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Duration</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Scope</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Usage</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Status</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Created</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((promo) => (
                  <tr key={promo.id} className="border-b border-zinc-800/70">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <code className="text-cyan-200 bg-zinc-800 px-2 py-1 rounded text-xs">{promo.code}</code>
                        <button onClick={() => copyText(promo.code)} className="text-zinc-400 hover:text-zinc-200">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {promo.name && <p className="m-0 mt-1 text-xs text-zinc-500">{promo.name}</p>}
                    </td>
                    <td className="px-3 py-2 text-zinc-100 font-semibold">{promo.percent_off}% off</td>
                    <td className="px-3 py-2 text-zinc-300">{durationLabel(promo)}</td>
                    <td className="px-3 py-2 text-zinc-400 text-xs">
                      {[
                        ...(promo.allowed_tiers || []),
                        ...(promo.allowed_org_tiers || []),
                        ...(promo.allowed_credit_packs || []),
                      ].join(', ') || 'All'}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {formatNumber(promo.redemption_count)}
                      {promo.max_redemptions ? ` / ${formatNumber(promo.max_redemptions)}` : ''}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${
                          promo.is_active
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-zinc-700/70 text-zinc-300 border-zinc-600'
                        }`}
                      >
                        {promo.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-500 text-xs">{formatDate(promo.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            resetEditor(promo)
                            setShowEditor(true)
                          }}
                          className="px-2 py-1 rounded border border-zinc-700 text-xs text-zinc-200 hover:bg-zinc-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openDetail(promo)}
                          className="px-2 py-1 rounded border border-zinc-700 text-xs text-zinc-200 hover:bg-zinc-800"
                        >
                          <Eye className="inline-block w-3 h-3 mr-1" />
                          View
                        </button>
                        <button
                          onClick={() => handleToggle(promo)}
                          disabled={busyId === promo.id}
                          className={`px-2 py-1 rounded border text-xs disabled:opacity-50 ${
                            promo.is_active
                              ? 'border-amber-500/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                              : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                          }`}
                        >
                          {promo.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEditor && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowEditor(false)}>
          <div className="w-full max-w-3xl rounded-xl border border-zinc-700 bg-[#111113] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="m-0 text-lg font-semibold text-white">{editingPromo ? 'Edit Discount Code' : 'Create Discount Code'}</h2>
                <p className="m-0 mt-1 text-xs text-zinc-500">Configure duration, tiers, and redemption rules.</p>
              </div>
              <button onClick={() => setShowEditor(false)} className="text-zinc-500 hover:text-zinc-200">Close</button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <label className="text-xs text-zinc-400">
                Code
                <div className="flex items-center gap-2 mt-1">
                  <input
                    disabled={Boolean(editingPromo)}
                    value={form.code}
                    onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200 disabled:opacity-60"
                  />
                  {!editingPromo && (
                    <button
                      onClick={() => setForm((prev) => ({ ...prev, code: randomCode() }))}
                      className="h-9 px-2 rounded-md border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      Random
                    </button>
                  )}
                </div>
              </label>

              <label className="text-xs text-zinc-400">
                Name
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                />
              </label>

              {!editingPromo && (
                <>
                  <label className="text-xs text-zinc-400">
                    Percent Off
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={form.percent_off}
                      onChange={(e) => setForm((prev) => ({ ...prev, percent_off: Number(e.target.value) }))}
                      className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                    />
                  </label>

                  <label className="text-xs text-zinc-400">
                    Duration
                    <select
                      value={form.duration_kind}
                      onChange={(e) => setForm((prev) => ({ ...prev, duration_kind: e.target.value as PromoFormState['duration_kind'] }))}
                      className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                    >
                      <option value="once">Once</option>
                      <option value="repeating">Repeating</option>
                      <option value="forever">Forever</option>
                    </select>
                  </label>

                  {form.duration_kind === 'repeating' && (
                    <label className="text-xs text-zinc-400">
                      Duration Months
                      <input
                        type="number"
                        min={1}
                        value={form.duration_months}
                        onChange={(e) => setForm((prev) => ({ ...prev, duration_months: Number(e.target.value) }))}
                        className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                      />
                    </label>
                  )}
                </>
              )}

              <label className="text-xs text-zinc-400">
                Max Redemptions (0 = unlimited)
                <input
                  type="number"
                  min={0}
                  value={form.max_redemptions}
                  onChange={(e) => setForm((prev) => ({ ...prev, max_redemptions: Number(e.target.value) }))}
                  className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                />
              </label>

              <label className="text-xs text-zinc-400">
                Redeem By
                <div className="relative mt-1">
                  <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-zinc-500" />
                  <input
                    type="date"
                    value={form.redeem_by}
                    onChange={(e) => setForm((prev) => ({ ...prev, redeem_by: e.target.value }))}
                    className="w-full h-9 pl-8 pr-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </div>
              </label>
            </div>

            {!editingPromo && (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Consumer Tiers</p>
                  <div className="flex flex-wrap gap-2">
                    {consumerTiers.map((tier) => (
                      <button
                        key={tier}
                        onClick={() => setForm((prev) => ({ ...prev, allowed_tiers: toggleString(prev.allowed_tiers, tier) }))}
                        className={`px-2 py-1 rounded text-xs border ${
                          form.allowed_tiers.includes(tier)
                            ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Organization Tiers</p>
                  <div className="flex flex-wrap gap-2">
                    {orgTiers.map((tier) => (
                      <button
                        key={tier}
                        onClick={() =>
                          setForm((prev) => ({ ...prev, allowed_org_tiers: toggleString(prev.allowed_org_tiers, tier) }))
                        }
                        className={`px-2 py-1 rounded text-xs border ${
                          form.allowed_org_tiers.includes(tier)
                            ? 'bg-violet-500/20 border-violet-500/30 text-violet-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Credit Packs</p>
                  <div className="flex flex-wrap gap-2">
                    {creditPacks.map((pack) => (
                      <button
                        key={pack}
                        onClick={() =>
                          setForm((prev) => ({ ...prev, allowed_credit_packs: toggleString(prev.allowed_credit_packs, pack) }))
                        }
                        className={`px-2 py-1 rounded text-xs border ${
                          form.allowed_credit_packs.includes(pack)
                            ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        }`}
                      >
                        {pack} credits
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <label className="block mt-4 text-xs text-zinc-400">
              Notes
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="mt-1 w-full px-3 py-2 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowEditor(false)}
                className="px-3 py-2 rounded-md border border-zinc-700 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-2 rounded-md text-xs font-semibold text-black bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50"
              >
                {saving ? <Loader2 className="inline-block w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="inline-block w-3.5 h-3.5 mr-1" />}
                {editingPromo ? 'Save Changes' : 'Create Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetail && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDetail(false)}>
          <div className="w-full max-w-3xl rounded-xl border border-zinc-700 bg-[#111113] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="m-0 text-lg font-semibold text-white">Promo Details</h2>
                <p className="m-0 mt-1 text-xs text-zinc-500">Detailed code usage and redemptions.</p>
              </div>
              <button onClick={() => setShowDetail(false)} className="text-zinc-500 hover:text-zinc-200">Close</button>
            </div>

            {loadingDetail ? (
              <div className="py-10 text-center text-zinc-400">
                <Loader2 className="inline-block w-5 h-5 animate-spin mr-2" />
                Loading details...
              </div>
            ) : detailPromo ? (
              <>
                <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
                  <div className="flex items-center gap-2">
                    <code className="text-cyan-200 bg-zinc-800 px-2 py-1 rounded text-xs">{detailPromo.code}</code>
                    <ChevronRight className="w-4 h-4 text-zinc-600" />
                    <span className="text-sm text-zinc-300">{detailPromo.percent_off}% off</span>
                    <span className="text-xs text-zinc-500">{durationLabel(detailPromo)}</span>
                  </div>
                  <p className="m-0 mt-2 text-xs text-zinc-500">Created: {formatDateTime(detailPromo.created_at)}</p>
                </div>

                <div className="mt-4 rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                    <h3 className="m-0 text-sm font-semibold text-white">Redemptions ({detailRedemptions.length})</h3>
                  </div>
                  <div className="max-h-[360px] overflow-auto">
                    {detailRedemptions.length === 0 ? (
                      <div className="p-6 text-sm text-zinc-400">No redemptions yet.</div>
                    ) : (
                      <table className="w-full min-w-[720px] text-sm">
                        <thead className="text-left text-zinc-400 text-xs uppercase tracking-wide">
                          <tr>
                            <th className="px-3 py-2 border-b border-zinc-800">User</th>
                            <th className="px-3 py-2 border-b border-zinc-800">Status</th>
                            <th className="px-3 py-2 border-b border-zinc-800">Redeemed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailRedemptions.map((redemption) => (
                            <tr key={redemption.id} className="border-b border-zinc-800/60">
                              <td className="px-3 py-2 text-zinc-300">{redemption.user.email || redemption.user.wallet_address || `User #${redemption.user.id}`}</td>
                              <td className="px-3 py-2 text-zinc-300">{redemption.status}</td>
                              <td className="px-3 py-2 text-zinc-500">{formatDateTime(redemption.redeemed_at || redemption.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="py-10 text-center text-zinc-400">Promo details unavailable.</div>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
