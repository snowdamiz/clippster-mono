import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Edit,
  Eye,
  Loader2,
  Percent,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  Tag,
  Users,
  X,
  XCircle,
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
import './AdminDiscountCodesPage.css'

type PromoCodeWithRedemptions = PromoCode & { redemptions?: PromoRedemption[] }

type PromoDuration = 'once' | 'repeating' | 'forever'

interface PromoFormData {
  code: string
  name: string
  promo_type: 'percent' | 'bundle'
  percent_off: number
  fixed_price_usd: number | null
  access_months: number
  total_credits: number
  duration_kind: PromoDuration
  duration_months: number
  allowed_tiers: string[]
  allowed_org_tiers: string[]
  allowed_credit_packs: string[]
  max_redemptions: number | null
  redeem_by: string
  notes: string
}

const initialFormData: PromoFormData = {
  code: '',
  name: '',
  promo_type: 'percent',
  percent_off: 10,
  fixed_price_usd: null,
  access_months: 12,
  total_credits: 0,
  duration_kind: 'repeating',
  duration_months: 3,
  allowed_tiers: [],
  allowed_org_tiers: [],
  allowed_credit_packs: [],
  max_redemptions: null,
  redeem_by: '',
  notes: '',
}

const userTiers = ['starter', 'creator', 'pro'] as const
const orgTiers = ['enterprise', 'enterprise_ai', 'addon_5_seats', 'addon_5_seats_ai', 'addon_10_seats', 'addon_10_seats_ai'] as const
const creditPacks = ['starter', 'creator', 'pro', 'enterprise'] as const

function calculateStats(codes: PromoCode[]) {
  return {
    total: codes.length,
    active: codes.filter((code) => code.is_active).length,
    redemptions: codes.reduce((sum, code) => sum + code.redemption_count, 0),
  }
}

function formatDiscount(promo: PromoCode): string {
  if (promo.promo_type === 'bundle') {
    const dollars = promo.fixed_price_cents ? (promo.fixed_price_cents / 100).toFixed(2) : '0.00'
    return `$${dollars} bundle`
  }
  return `${promo.percent_off ?? 0}%`
}

function formatDuration(promo: PromoCode): string {
  if (promo.promo_type === 'bundle') {
    const months = promo.access_months ?? 0
    const credits = promo.total_credits ?? 0
    return `${months} mo access · ${credits.toLocaleString()} credits`
  }
  if (promo.duration_kind === 'forever') return 'Forever'
  if (promo.duration_kind === 'once') return 'One-time'
  return `${promo.duration_months} month${(promo.duration_months || 0) > 1 ? 's' : ''}`
}

function getStatusClass(promo: PromoCode): string {
  return promo.is_active ? 'admin-promo__status--active' : 'admin-promo__status--inactive'
}

function getUsageClass(promo: PromoCode): string {
  if (!promo.max_redemptions) return 'admin-promo__usage--unlimited'
  if (promo.redemption_count >= promo.max_redemptions) return 'admin-promo__usage--exhausted'
  if (promo.redemption_count / promo.max_redemptions > 0.8) return 'admin-promo__usage--warning'
  return 'admin-promo__usage--good'
}

function getRedemptionStatusClass(redemption: PromoRedemption): string {
  switch (redemption.status) {
    case 'active':
      return 'promo-dialog__redemption-badge--active'
    case 'cancelled':
      return 'promo-dialog__redemption-badge--cancelled'
    case 'ended':
      return 'promo-dialog__redemption-badge--ended'
    default:
      return ''
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return 'Invalid date'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function humanizeTier(value: string) {
  return value
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function AdminDiscountCodesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
  const [stats, setStats] = useState({ total: 0, active: 0, redemptions: 0 })

  const [filters, setFilters] = useState({
    search: '',
    is_active: null as boolean | null,
    tier: null as string | null,
    expired: false,
  })

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null)
  const [viewingPromo, setViewingPromo] = useState<PromoCodeWithRedemptions | null>(null)

  const [formData, setFormData] = useState<PromoFormData>(initialFormData)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const filteredPromoCodes = useMemo(() => {
    let codes = promoCodes

    if (filters.search) {
      const search = filters.search.toLowerCase()
      codes = codes.filter(
        (code) => code.code.toLowerCase().includes(search) || (code.name && code.name.toLowerCase().includes(search)),
      )
    }

    if (filters.is_active !== null) {
      codes = codes.filter((code) => code.is_active === filters.is_active)
    }

    if (filters.tier) {
      codes = codes.filter((code) => code.allowed_tiers.includes(filters.tier as string))
    }

    if (filters.expired) {
      const now = new Date()
      codes = codes.filter((code) => {
        if (!code.redeem_by) return false
        return new Date(code.redeem_by) < now
      })
    }

    return codes
  }, [filters.expired, filters.is_active, filters.search, filters.tier, promoCodes])

  async function fetchPromoCodes() {
    setLoading(true)
    setError('')

    try {
      const apiFilters: { search?: string; is_active?: boolean; tier?: string } = {}

      if (filters.search) {
        apiFilters.search = filters.search
      }

      if (filters.is_active !== null) {
        apiFilters.is_active = filters.is_active
      }

      if (filters.tier) {
        apiFilters.tier = filters.tier
      }

      const promos = await listPromoCodes(apiFilters)
      setPromoCodes(promos)
      setStats(calculateStats(promos))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      setError('Unable to copy code to clipboard')
    }
  }

  function generateRandomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''

    for (let i = 0; i < 8; i += 1) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    setFormData((prev) => ({ ...prev, code }))
  }

  function toggleTier(tier: string) {
    setFormData((prev) => ({
      ...prev,
      allowed_tiers: prev.allowed_tiers.includes(tier)
        ? prev.allowed_tiers.filter((item) => item !== tier)
        : [...prev.allowed_tiers, tier],
    }))
  }

  function toggleOrgTier(tier: string) {
    setFormData((prev) => ({
      ...prev,
      allowed_org_tiers: prev.allowed_org_tiers.includes(tier)
        ? prev.allowed_org_tiers.filter((item) => item !== tier)
        : [...prev.allowed_org_tiers, tier],
    }))
  }

  function toggleCreditPack(pack: string) {
    setFormData((prev) => ({
      ...prev,
      allowed_credit_packs: prev.allowed_credit_packs.includes(pack)
        ? prev.allowed_credit_packs.filter((item) => item !== pack)
        : [...prev.allowed_credit_packs, pack],
    }))
  }

  function editPromo(promo: PromoCode) {
    setEditingPromo(promo)
    setFormData({
      code: promo.code,
      name: promo.name || '',
      promo_type: promo.promo_type || 'percent',
      percent_off: promo.percent_off ?? 10,
      fixed_price_usd: promo.fixed_price_cents ? promo.fixed_price_cents / 100 : null,
      access_months: promo.access_months ?? 12,
      total_credits: promo.total_credits ?? 0,
      duration_kind: promo.duration_kind,
      duration_months: promo.duration_months || 3,
      allowed_tiers: [...promo.allowed_tiers],
      allowed_org_tiers: [...(promo.allowed_org_tiers || [])],
      allowed_credit_packs: [...(promo.allowed_credit_packs || [])],
      max_redemptions: promo.max_redemptions,
      redeem_by: promo.redeem_by ? promo.redeem_by.slice(0, 16) : '',
      notes: promo.notes || '',
    })
    setErrors({})
    setShowCreateModal(true)
  }

  async function viewPromo(promo: PromoCode) {
    try {
      const response = await getPromoCode(promo.id)

      if (response.promo) {
        setViewingPromo({
          ...response.promo,
          redemptions: response.redemptions,
        })
      } else {
        setError('Could not load promo code details')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load promo code details')
    }
  }

  function resetForm() {
    setFormData(initialFormData)
    setErrors({})
  }

  function closeCreateModal() {
    setShowCreateModal(false)
    setEditingPromo(null)
    resetForm()
  }

  async function savePromoCode() {
    setErrors({})
    setSaving(true)

    if (!formData.code.trim()) {
      setErrors({ code: 'Code is required' })
      setSaving(false)
      return
    }

    if (formData.promo_type === 'bundle') {
      if (!formData.allowed_tiers.length) {
        setErrors({ allowed_tiers: 'Bundle deals require at least one user subscription tier' })
        setSaving(false)
        return
      }
      if (!formData.fixed_price_usd || formData.fixed_price_usd <= 0) {
        setErrors({ fixed_price_usd: 'Fixed price is required' })
        setSaving(false)
        return
      }
    } else if (!formData.allowed_tiers.length && !formData.allowed_org_tiers.length && !formData.allowed_credit_packs.length) {
      setErrors({ allowed_tiers: 'At least one tier, organization tier, or credit pack must be selected' })
      setSaving(false)
      return
    }

    try {
      if (editingPromo) {
        await updatePromoCode(editingPromo.id, {
          name: formData.name || undefined,
          max_redemptions: formData.max_redemptions || undefined,
          redeem_by: formData.redeem_by || undefined,
          notes: formData.notes || undefined,
        })
      } else {
        const payload: Parameters<typeof createPromoCode>[0] = {
          code: formData.code.toUpperCase().trim(),
          name: formData.name || undefined,
          promo_type: formData.promo_type,
          allowed_tiers: formData.allowed_tiers,
          max_redemptions: formData.max_redemptions || undefined,
          redeem_by: formData.redeem_by || undefined,
          notes: formData.notes || undefined,
        }

        if (formData.promo_type === 'bundle') {
          payload.fixed_price_cents = Math.round((formData.fixed_price_usd || 0) * 100)
          payload.access_months = formData.access_months
          payload.total_credits = formData.total_credits
        } else {
          payload.percent_off = formData.percent_off
          payload.duration_kind = formData.duration_kind
          payload.duration_months = formData.duration_kind === 'repeating' ? formData.duration_months : undefined
          payload.allowed_org_tiers = formData.allowed_org_tiers
          payload.allowed_credit_packs = formData.allowed_credit_packs
        }

        await createPromoCode(payload)
      }

      closeCreateModal()
      await fetchPromoCodes()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save discount code')
    } finally {
      setSaving(false)
    }
  }

  async function togglePromo(promo: PromoCode) {
    try {
      await togglePromoCode(promo.id, !promo.is_active)
      await fetchPromoCodes()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not toggle discount code status')
    }
  }

  useEffect(() => {
    void fetchPromoCodes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <PageLayout
      title="Discount Codes"
      icon={Percent}
      actions={
        <div className="promo-header-actions">
          <div className="promo-header__search">
            <Search className="promo-header__search-icon" />
            <input
              value={filters.search}
              type="text"
              placeholder="Search codes..."
              className="promo-header__search-input"
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
          </div>

          <div className="promo-header__filter">
            <select
              className="promo-header__select"
              value={filters.is_active === null ? 'all' : filters.is_active ? 'active' : 'inactive'}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  is_active: event.target.value === 'all' ? null : event.target.value === 'active',
                }))
              }
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="promo-header__filter">
            <select
              className="promo-header__select"
              value={filters.tier ?? 'all'}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  tier: event.target.value === 'all' ? null : event.target.value,
                }))
              }
            >
              <option value="all">All Tiers</option>
              <option value="starter">Starter</option>
              <option value="creator">Creator</option>
              <option value="pro">Pro</option>
            </select>
          </div>

          <button className="promo-header__action-btn" disabled={loading} onClick={() => void fetchPromoCodes()}>
            {!loading ? (
              <RefreshCw className="promo-header__action-icon" />
            ) : (
              <Loader2 className="promo-header__action-icon promo-header__action-icon--spin" />
            )}
            Refresh Codes
          </button>

          <button
            className="promo-header__action-btn promo-header__action-btn--primary"
            onClick={() => {
              resetForm()
              setShowCreateModal(true)
            }}
          >
            <Plus className="promo-header__action-icon" />
            New Code
          </button>
        </div>
      }
    >
      <div className="admin-promo-page">
        <div className="admin-promo">
          <div className="admin-promo__heading">
            <h1 className="admin-promo__title">Discount Codes</h1>
            <p className="admin-promo__subtitle">Create and manage promotional discount codes</p>
          </div>

          <div className="admin-promo__cards">
            <div className="admin-promo__card">
              <div className="admin-promo__card-header">
                <div className="admin-promo__card-icon admin-promo__card-icon--cyan">
                  <Tag className="admin-promo__card-icon-svg" />
                </div>
                <h3 className="admin-promo__card-label">Total Codes</h3>
              </div>
              <p className="admin-promo__card-value">{stats.total}</p>
            </div>

            <div className="admin-promo__card">
              <div className="admin-promo__card-header">
                <div className="admin-promo__card-icon admin-promo__card-icon--green">
                  <CheckCircle className="admin-promo__card-icon-svg" />
                </div>
                <h3 className="admin-promo__card-label">Active</h3>
              </div>
              <p className="admin-promo__card-value admin-promo__card-value--green">{stats.active}</p>
            </div>

            <div className="admin-promo__card">
              <div className="admin-promo__card-header">
                <div className="admin-promo__card-icon admin-promo__card-icon--amber">
                  <Users className="admin-promo__card-icon-svg" />
                </div>
                <h3 className="admin-promo__card-label">Redemptions</h3>
              </div>
              <p className="admin-promo__card-value admin-promo__card-value--amber">{stats.redemptions}</p>
            </div>
          </div>

          {error ? (
            <div className="admin-promo__error">
              <AlertTriangle className="admin-promo__error-icon" />
              <p className="admin-promo__error-text">{error}</p>
            </div>
          ) : null}

          {loading && !promoCodes.length ? (
            <div className="admin-promo__loading">
              <Loader2 className="admin-promo__loading-icon" />
              <p className="admin-promo__loading-text">Loading discount codes...</p>
            </div>
          ) : promoCodes.length > 0 ? (
            <div className="admin-promo__table-wrapper">
              <div className="admin-promo__table-scroll">
                <table className="admin-promo__table">
                  <thead className="admin-promo__thead">
                    <tr>
                      <th className="admin-promo__th">Code</th>
                      <th className="admin-promo__th">Discount</th>
                      <th className="admin-promo__th">Duration</th>
                      <th className="admin-promo__th">Tiers</th>
                      <th className="admin-promo__th">Usage</th>
                      <th className="admin-promo__th">Status</th>
                      <th className="admin-promo__th">Created</th>
                      <th className="admin-promo__th">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="admin-promo__tbody">
                    {filteredPromoCodes.map((promo) => (
                      <tr key={promo.id} className="admin-promo__row">
                        <td className="admin-promo__td">
                          <div className="admin-promo__code-cell">
                            <code className="admin-promo__code">{promo.code}</code>
                            {promo.name ? <span className="admin-promo__code-name">{promo.name}</span> : null}
                          </div>
                        </td>
                        <td className="admin-promo__td">
                          <span className="admin-promo__discount-badge">{formatDiscount(promo)}</span>
                        </td>
                        <td className="admin-promo__td">
                          <span className="admin-promo__duration">{formatDuration(promo)}</span>
                        </td>
                        <td className="admin-promo__td">
                          <div className="admin-promo__tiers">
                            {promo.allowed_tiers?.length ? <span className="admin-promo__tier-section">User:</span> : null}
                            {promo.allowed_tiers.map((tier) => (
                              <span key={`user-${promo.id}-${tier}`} className="admin-promo__tier-badge admin-promo__tier-badge--user">
                                {tier}
                              </span>
                            ))}

                            {promo.allowed_org_tiers?.length ? <span className="admin-promo__tier-section">Org:</span> : null}
                            {(promo.allowed_org_tiers || []).map((tier) => (
                              <span key={`org-${promo.id}-${tier}`} className="admin-promo__tier-badge admin-promo__tier-badge--org">
                                {tier.replace(/_/g, ' ')}
                              </span>
                            ))}

                            {promo.allowed_credit_packs?.length ? <span className="admin-promo__tier-section">Packs:</span> : null}
                            {(promo.allowed_credit_packs || []).map((pack) => (
                              <span key={`pack-${promo.id}-${pack}`} className="admin-promo__tier-badge admin-promo__tier-badge--pack">
                                {pack}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="admin-promo__td">
                          <span className={getUsageClass(promo)}>
                            {promo.redemption_count}
                            {promo.max_redemptions ? `/${promo.max_redemptions}` : ''}
                          </span>
                        </td>
                        <td className="admin-promo__td">
                          <span className={`admin-promo__status ${getStatusClass(promo)}`}>
                            {promo.is_active ? (
                              <CheckCircle className="admin-promo__status-icon" />
                            ) : (
                              <XCircle className="admin-promo__status-icon" />
                            )}
                            {promo.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="admin-promo__td">
                          <span className="admin-promo__date">{formatDate(promo.created_at)}</span>
                        </td>
                        <td className="admin-promo__td">
                          <div className="admin-promo__actions">
                            <button className="admin-promo__action-btn-small" title="Copy code" onClick={() => void copyCode(promo.code)}>
                              <Copy className="admin-promo__action-btn-icon-small" />
                            </button>
                            <button className="admin-promo__action-btn-small" title="View details" onClick={() => void viewPromo(promo)}>
                              <Eye className="admin-promo__action-btn-icon-small" />
                            </button>
                            <button className="admin-promo__action-btn-small" title="Edit" onClick={() => editPromo(promo)}>
                              <Edit className="admin-promo__action-btn-icon-small" />
                            </button>
                            <button
                              className={`admin-promo__action-btn-small ${
                                promo.is_active
                                  ? 'admin-promo__action-btn-small--danger'
                                  : 'admin-promo__action-btn-small--success'
                              }`}
                              title={promo.is_active ? 'Deactivate' : 'Activate'}
                              onClick={() => void togglePromo(promo)}
                            >
                              {promo.is_active ? (
                                <Power className="admin-promo__action-btn-icon-small" />
                              ) : (
                                <PowerOff className="admin-promo__action-btn-icon-small" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="admin-promo__empty">
              <div className="admin-promo__empty-icon">
                <Percent className="admin-promo__empty-icon-svg" />
              </div>
              <p className="admin-promo__empty-text">No discount codes yet</p>
              <button
                className="admin-promo__empty-btn"
                onClick={() => {
                  resetForm()
                  setShowCreateModal(true)
                }}
              >
                Create Your First Code
              </button>
            </div>
          )}
        </div>
      </div>

      {showCreateModal ? (
        <div className="promo-dialog__overlay" onClick={(event) => event.target === event.currentTarget && closeCreateModal()}>
          <div className="promo-dialog" role="dialog" aria-modal="true">
            <div className="promo-dialog__accent" />

            <div className="promo-dialog__header">
              <button className="promo-dialog__close" disabled={saving} title="Close" onClick={closeCreateModal}>
                <X size={18} />
              </button>
              <div className="promo-dialog__icon">
                <Percent size={24} />
              </div>
              <h2 className="promo-dialog__title">{editingPromo ? 'Edit Discount Code' : 'Create Discount Code'}</h2>
              <p className="promo-dialog__subtitle">
                {editingPromo ? 'Modify existing promotional code settings' : 'Generate a new promotional code'}
              </p>
            </div>

            <div className="promo-dialog__content">
              <div className="promo-dialog__form">
                <div className="promo-dialog__field">
                  <label className="promo-dialog__label">Code *</label>
                  <div className="promo-dialog__input-row">
                    <input
                      value={formData.code}
                      type="text"
                      placeholder="DISCOUNT2025"
                      disabled={Boolean(editingPromo)}
                      className={`promo-dialog__input ${errors.code ? 'promo-dialog__input--error' : ''}`}
                      onChange={(event) => {
                        setFormData((prev) => ({ ...prev, code: event.target.value }))
                        setErrors((prev) => ({ ...prev, code: '' }))
                      }}
                    />
                    {!editingPromo ? (
                      <button type="button" className="promo-dialog__generate-btn" title="Generate random code" onClick={generateRandomCode}>
                        <RefreshCw size={16} />
                      </button>
                    ) : null}
                  </div>
                  {errors.code ? <span className="promo-dialog__error">{errors.code}</span> : null}
                </div>

                <div className="promo-dialog__field">
                  <label className="promo-dialog__label">
                    Name
                    <span className="promo-dialog__label-hint">(optional)</span>
                  </label>
                  <input
                    value={formData.name}
                    type="text"
                    placeholder="Summer Sale 2025"
                    className={`promo-dialog__input ${errors.name ? 'promo-dialog__input--error' : ''}`}
                    onChange={(event) => {
                      setFormData((prev) => ({ ...prev, name: event.target.value }))
                      setErrors((prev) => ({ ...prev, name: '' }))
                    }}
                  />
                  {errors.name ? <span className="promo-dialog__error">{errors.name}</span> : null}
                </div>

                {!editingPromo ? (
                  <div className="promo-dialog__field">
                    <label className="promo-dialog__label">Code Type *</label>
                    <div className="promo-dialog__segmented">
                      <button
                        type="button"
                        className={`promo-dialog__segment ${formData.promo_type === 'percent' ? 'promo-dialog__segment--active' : ''}`}
                        onClick={() => setFormData((prev) => ({ ...prev, promo_type: 'percent' }))}
                      >
                        Percentage Discount
                      </button>
                      <button
                        type="button"
                        className={`promo-dialog__segment ${formData.promo_type === 'bundle' ? 'promo-dialog__segment--active' : ''}`}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            promo_type: 'bundle',
                            allowed_org_tiers: [],
                            allowed_credit_packs: [],
                          }))
                        }
                      >
                        Bundle Deal
                      </button>
                    </div>
                  </div>
                ) : null}

                {formData.promo_type === 'percent' ? (
                <div className="promo-dialog__field">
                  <label className="promo-dialog__label">Discount Percentage *</label>
                  <div className="promo-dialog__range-row">
                    <input
                      value={formData.percent_off}
                      type="range"
                      min={1}
                      max={100}
                      className="promo-dialog__range"
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          percent_off: Number(event.target.value),
                        }))
                      }
                    />
                    <div className="promo-dialog__range-value">{formData.percent_off}%</div>
                  </div>
                </div>
                ) : null}

                {formData.promo_type === 'percent' ? (
                <div className="promo-dialog__field">
                  <label className="promo-dialog__label">Duration Type *</label>
                  <div className="promo-dialog__segmented">
                    {(['once', 'repeating', 'forever'] as const).map((duration) => (
                      <button
                        key={duration}
                        type="button"
                        className={`promo-dialog__segment ${formData.duration_kind === duration ? 'promo-dialog__segment--active' : ''}`}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            duration_kind: duration,
                          }))
                        }
                      >
                        {duration.charAt(0).toUpperCase() + duration.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                ) : null}

                {formData.promo_type === 'percent' && formData.duration_kind === 'repeating' ? (
                  <div className="promo-dialog__field">
                    <label className="promo-dialog__label">Discount Duration (Months) *</label>
                    <input
                      value={formData.duration_months}
                      type="number"
                      min={1}
                      max={120}
                      placeholder="3"
                      className={`promo-dialog__input promo-dialog__input--sm ${errors.duration_months ? 'promo-dialog__input--error' : ''}`}
                      onChange={(event) => {
                        setFormData((prev) => ({
                          ...prev,
                          duration_months: Number(event.target.value),
                        }))
                        setErrors((prev) => ({ ...prev, duration_months: '' }))
                      }}
                    />
                    {errors.duration_months ? <span className="promo-dialog__error">{errors.duration_months}</span> : null}
                  </div>
                ) : null}

                {formData.promo_type === 'bundle' ? (
                  <>
                    <div className="promo-dialog__row">
                      <div className="promo-dialog__field">
                        <label className="promo-dialog__label">Fixed Price (USD) *</label>
                        <input
                          value={formData.fixed_price_usd ?? ''}
                          type="number"
                          min={1}
                          step={0.01}
                          placeholder="175.00"
                          className={`promo-dialog__input ${errors.fixed_price_usd ? 'promo-dialog__input--error' : ''}`}
                          onChange={(event) => {
                            setFormData((prev) => ({
                              ...prev,
                              fixed_price_usd: event.target.value ? Number(event.target.value) : null,
                            }))
                            setErrors((prev) => ({ ...prev, fixed_price_usd: '' }))
                          }}
                        />
                      </div>
                      <div className="promo-dialog__field">
                        <label className="promo-dialog__label">Months of Access *</label>
                        <input
                          value={formData.access_months}
                          type="number"
                          min={1}
                          max={120}
                          placeholder="12"
                          className="promo-dialog__input"
                          onChange={(event) =>
                            setFormData((prev) => ({
                              ...prev,
                              access_months: Number(event.target.value),
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="promo-dialog__field">
                      <label className="promo-dialog__label">Total Credits *</label>
                      <input
                        value={formData.total_credits}
                        type="number"
                        min={0}
                        placeholder="18000"
                        className="promo-dialog__input"
                        onChange={(event) =>
                          setFormData((prev) => ({
                            ...prev,
                            total_credits: Number(event.target.value),
                          }))
                        }
                      />
                    </div>
                  </>
                ) : null}

                <div className="promo-dialog__field">
                  <label className="promo-dialog__label">
                    User Subscription Tiers
                    <span className="promo-dialog__label-hint">(personal accounts)</span>
                  </label>
                  <div className="promo-dialog__chips">
                    {userTiers.map((tier) => {
                      const isActive = formData.allowed_tiers.includes(tier)
                      return (
                        <button
                          key={tier}
                          type="button"
                          className={`promo-dialog__chip ${isActive ? 'promo-dialog__chip--active' : ''}`}
                          onClick={() => toggleTier(tier)}
                        >
                          {isActive ? <CheckCircle size={14} /> : null}
                          {tier.charAt(0).toUpperCase() + tier.slice(1)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {formData.promo_type === 'percent' ? (
                <>
                <div className="promo-dialog__field">
                  <label className="promo-dialog__label">
                    Organization Subscription Tiers
                    <span className="promo-dialog__label-hint">(organization plans)</span>
                  </label>
                  <div className="promo-dialog__chips">
                    {orgTiers.map((tier) => {
                      const isActive = formData.allowed_org_tiers.includes(tier)
                      return (
                        <button
                          key={tier}
                          type="button"
                          className={`promo-dialog__chip ${isActive ? 'promo-dialog__chip--active' : ''}`}
                          onClick={() => toggleOrgTier(tier)}
                        >
                          {isActive ? <CheckCircle size={14} /> : null}
                          {humanizeTier(tier)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="promo-dialog__field">
                  <label className="promo-dialog__label">
                    Credit Packs
                    <span className="promo-dialog__label-hint">(one-time purchases)</span>
                  </label>
                  <div className="promo-dialog__chips">
                    {creditPacks.map((pack) => {
                      const isActive = formData.allowed_credit_packs.includes(pack)
                      return (
                        <button
                          key={pack}
                          type="button"
                          className={`promo-dialog__chip ${isActive ? 'promo-dialog__chip--active' : ''}`}
                          onClick={() => toggleCreditPack(pack)}
                        >
                          {isActive ? <CheckCircle size={14} /> : null}
                          {pack.charAt(0).toUpperCase() + pack.slice(1)}
                        </button>
                      )
                    })}
                  </div>
                </div>
                </>
                ) : null}

                {errors.allowed_tiers ? (
                  <div className="promo-dialog__alert promo-dialog__alert--error">
                    <AlertTriangle size={16} />
                    <p className="promo-dialog__alert-text">{errors.allowed_tiers}</p>
                  </div>
                ) : null}

                <div className="promo-dialog__row">
                  <div className="promo-dialog__field">
                    <label className="promo-dialog__label">
                      Max Redemptions
                      <span className="promo-dialog__label-hint">(optional)</span>
                    </label>
                    <input
                      value={formData.max_redemptions ?? ''}
                      type="number"
                      min={1}
                      placeholder="Unlimited"
                      className={`promo-dialog__input ${errors.max_redemptions ? 'promo-dialog__input--error' : ''}`}
                      onChange={(event) => {
                        setFormData((prev) => ({
                          ...prev,
                          max_redemptions: event.target.value ? Number(event.target.value) : null,
                        }))
                        setErrors((prev) => ({ ...prev, max_redemptions: '' }))
                      }}
                    />
                  </div>

                  <div className="promo-dialog__field">
                    <label className="promo-dialog__label">
                      Expiration Date
                      <span className="promo-dialog__label-hint">(optional)</span>
                    </label>
                    <input
                      value={formData.redeem_by}
                      type="datetime-local"
                      className={`promo-dialog__input ${errors.redeem_by ? 'promo-dialog__input--error' : ''}`}
                      onChange={(event) => {
                        setFormData((prev) => ({ ...prev, redeem_by: event.target.value }))
                        setErrors((prev) => ({ ...prev, redeem_by: '' }))
                      }}
                    />
                  </div>
                </div>

                <div className="promo-dialog__field">
                  <label className="promo-dialog__label">
                    Notes
                    <span className="promo-dialog__label-hint">(optional)</span>
                  </label>
                  <textarea
                    value={formData.notes}
                    placeholder="Internal notes about this discount code..."
                    rows={2}
                    className="promo-dialog__input promo-dialog__textarea"
                    onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </div>

                {error ? (
                  <div className="promo-dialog__alert promo-dialog__alert--error">
                    <AlertTriangle size={16} />
                    <p className="promo-dialog__alert-text">{error}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="promo-dialog__footer">
              <button className="promo-dialog__btn promo-dialog__btn--secondary" disabled={saving} onClick={closeCreateModal}>
                Cancel
              </button>
              <button className="promo-dialog__btn promo-dialog__btn--primary" disabled={saving} onClick={() => void savePromoCode()}>
                {saving ? <Loader2 size={16} className="promo-dialog__spinner" /> : null}
                {saving ? 'Saving...' : editingPromo ? 'Save Changes' : 'Create Code'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewingPromo ? (
        <div className="promo-dialog__overlay" onClick={(event) => event.target === event.currentTarget && setViewingPromo(null)}>
          <div className="promo-dialog" role="dialog" aria-modal="true">
            <div className="promo-dialog__accent" />

            <div className="promo-dialog__header">
              <button className="promo-dialog__close" title="Close" onClick={() => setViewingPromo(null)}>
                <X size={18} />
              </button>
              <div className="promo-dialog__icon">
                <Eye size={24} />
              </div>
              <h2 className="promo-dialog__title">Discount Code Details</h2>
              <p className="promo-dialog__subtitle">View promotional code information</p>
            </div>

            <div className="promo-dialog__content">
              <div className="promo-dialog__code-display">
                <code className="promo-dialog__code-value">{viewingPromo.code}</code>
                <button className="promo-dialog__code-copy" onClick={() => void copyCode(viewingPromo.code)}>
                  <Copy size={16} />
                </button>
              </div>
              {viewingPromo.name ? <p className="promo-dialog__code-name">{viewingPromo.name}</p> : null}

              <div className="promo-dialog__stats">
                <div className="promo-dialog__stat">
                  <span className="promo-dialog__stat-label">Discount</span>
                  <span className="promo-dialog__stat-value promo-dialog__stat-value--highlight">{formatDiscount(viewingPromo)}</span>
                </div>
                <div className="promo-dialog__stat">
                  <span className="promo-dialog__stat-label">Duration</span>
                  <span className="promo-dialog__stat-value">{formatDuration(viewingPromo)}</span>
                </div>
                <div className="promo-dialog__stat">
                  <span className="promo-dialog__stat-label">Status</span>
                  <span className={`promo-dialog__stat-badge ${viewingPromo.is_active ? 'promo-dialog__stat-badge--active' : 'promo-dialog__stat-badge--inactive'}`}>
                    {viewingPromo.is_active ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {viewingPromo.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="promo-dialog__stat">
                  <span className="promo-dialog__stat-label">Usage</span>
                  <span className="promo-dialog__stat-value">
                    {viewingPromo.redemption_count}
                    {viewingPromo.max_redemptions ? `/${viewingPromo.max_redemptions}` : ''}
                  </span>
                </div>
              </div>

              {viewingPromo.allowed_tiers?.length ? (
                <div className="promo-dialog__section">
                  <h3 className="promo-dialog__section-title">User Subscription Tiers</h3>
                  <div className="promo-dialog__tier-list">
                    {viewingPromo.allowed_tiers.map((tier) => (
                      <span key={tier} className="promo-dialog__tier promo-dialog__tier--user">
                        {tier.charAt(0).toUpperCase() + tier.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {viewingPromo.allowed_org_tiers?.length ? (
                <div className="promo-dialog__section">
                  <h3 className="promo-dialog__section-title">Organization Subscription Tiers</h3>
                  <div className="promo-dialog__tier-list">
                    {viewingPromo.allowed_org_tiers.map((tier) => (
                      <span key={tier} className="promo-dialog__tier promo-dialog__tier--org">
                        {humanizeTier(tier)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {viewingPromo.allowed_credit_packs?.length ? (
                <div className="promo-dialog__section">
                  <h3 className="promo-dialog__section-title">Credit Packs</h3>
                  <div className="promo-dialog__tier-list">
                    {viewingPromo.allowed_credit_packs.map((pack) => (
                      <span key={pack} className="promo-dialog__tier promo-dialog__tier--pack">
                        {pack.charAt(0).toUpperCase() + pack.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {viewingPromo.max_redemptions || viewingPromo.redeem_by || viewingPromo.notes ? (
                <div className="promo-dialog__section">
                  <h3 className="promo-dialog__section-title">Additional Info</h3>
                  <div className="promo-dialog__info-grid">
                    {viewingPromo.max_redemptions ? (
                      <div className="promo-dialog__info-item">
                        <span className="promo-dialog__info-label">Max Redemptions</span>
                        <span className="promo-dialog__info-value">{viewingPromo.max_redemptions}</span>
                      </div>
                    ) : null}
                    {viewingPromo.redeem_by ? (
                      <div className="promo-dialog__info-item">
                        <span className="promo-dialog__info-label">Expires</span>
                        <span className="promo-dialog__info-value">{formatDate(viewingPromo.redeem_by)}</span>
                      </div>
                    ) : null}
                  </div>

                  {viewingPromo.notes ? (
                    <div className="promo-dialog__notes">
                      <span className="promo-dialog__info-label">Notes</span>
                      <p className="promo-dialog__notes-text">{viewingPromo.notes}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {viewingPromo.redemptions && viewingPromo.redemptions.length > 0 ? (
                <div className="promo-dialog__section">
                  <h3 className="promo-dialog__section-title">
                    Redemptions
                    <span className="promo-dialog__section-count">{viewingPromo.redemptions.length}</span>
                  </h3>

                  <div className="promo-dialog__redemption-list">
                    {viewingPromo.redemptions.map((redemption) => (
                      <div key={redemption.id} className="promo-dialog__redemption-item">
                        <div className="promo-dialog__redemption-row">
                          <code className="promo-dialog__redemption-wallet">{redemption.user.wallet_address || 'N/A'}</code>
                          <span className={`promo-dialog__redemption-badge ${getRedemptionStatusClass(redemption)}`}>
                            {redemption.status}
                          </span>
                        </div>
                        <p className="promo-dialog__redemption-date">{formatDate(redemption.redeemed_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="promo-dialog__footer promo-dialog__footer--single">
              <button className="promo-dialog__btn promo-dialog__btn--secondary" onClick={() => setViewingPromo(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageLayout>
  )
}
