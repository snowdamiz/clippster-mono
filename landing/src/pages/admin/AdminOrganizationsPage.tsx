import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Building2,
  CreditCard,
  Crown,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import {
  cancelOrganizationSubscription,
  createOrganizationAccount,
  deleteOrganization,
  grantOrganizationSubscription,
  listAdminOrganizations,
  resetUserPassword,
  setOrganizationCredits,
  updateOrganizationSubscription,
  type AdminOrganization,
} from '@/services/adminApi'
import './AdminOrganizationsPage.css'

interface CreateOrgForm {
  org_name: string
  email: string
  password: string
  tier: string
  max_seats: number
  monthly_credits: number
  price_dollars: number
}

interface GrantSubForm {
  tier: string
  days: number
  grant_credits: boolean
}

interface EditSubForm {
  tier: string
  max_seats: number
  monthly_credits: number
  price_dollars: number
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCredits(credits: number | null | undefined) {
  if (!credits || credits === 0) return '0'
  return Math.round(credits).toString()
}

function getStatusBadgeClass(status: string | null | undefined) {
  switch ((status || '').toLowerCase()) {
    case 'active':
      return 'admin-orgs__status-badge--active'
    case 'cancelled':
    case 'canceled':
      return 'admin-orgs__status-badge--cancelled'
    case 'expired':
      return 'admin-orgs__status-badge--expired'
    default:
      return 'admin-orgs__status-badge--none'
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

const availableTiers = [
  { value: 'solo', label: 'Solo' },
  { value: 'enterprise_base', label: 'Enterprise Base' },
  { value: 'enterprise_ai', label: 'Enterprise AI' },
  { value: 'enterprise_unlimited', label: 'Enterprise Unlimited' },
]

const createTierOptions = [
  { value: 'solo', label: 'Solo ($149.99)' },
  { value: 'enterprise_base', label: 'Enterprise Base ($300)' },
  { value: 'enterprise_ai', label: 'Enterprise AI ($500)' },
  { value: 'enterprise_unlimited', label: 'Enterprise Unlimited ($1800)' },
]

export function AdminOrganizationsPage() {
  const navigate = useNavigate()

  const [organizations, setOrganizations] = useState<AdminOrganization[]>([])
  const [loading, setLoading] = useState(false)

  const [showOrgCreditDialog, setShowOrgCreditDialog] = useState(false)
  const [orgToEditCredits, setOrgToEditCredits] = useState<AdminOrganization | null>(null)
  const [updatingOrgCreditsId, setUpdatingOrgCreditsId] = useState<number | null>(null)
  const [orgCreditForm, setOrgCreditForm] = useState({ hours_remaining: 0, hours_used: 0 })
  const [orgCreditError, setOrgCreditError] = useState<string | null>(null)

  const [showCreateOrgDialog, setShowCreateOrgDialog] = useState(false)
  const [creatingOrg, setCreatingOrg] = useState(false)
  const [createOrgError, setCreateOrgError] = useState<string | null>(null)
  const [createOrgForm, setCreateOrgForm] = useState<CreateOrgForm>({
    org_name: '',
    email: '',
    password: '',
    tier: 'enterprise_base',
    max_seats: 5,
    monthly_credits: 0,
    price_dollars: 0,
  })

  const [showGrantSubDialog, setShowGrantSubDialog] = useState(false)
  const [grantSubOrg, setGrantSubOrg] = useState<AdminOrganization | null>(null)
  const [grantingSubId, setGrantingSubId] = useState<number | null>(null)
  const [grantSubError, setGrantSubError] = useState<string | null>(null)
  const [grantSubForm, setGrantSubForm] = useState<GrantSubForm>({
    tier: 'enterprise_base',
    days: 30,
    grant_credits: false,
  })

  const [showEditSubDialog, setShowEditSubDialog] = useState(false)
  const [editSubOrg, setEditSubOrg] = useState<AdminOrganization | null>(null)
  const [editingSubId, setEditingSubId] = useState<number | null>(null)
  const [editSubError, setEditSubError] = useState<string | null>(null)
  const [editSubForm, setEditSubForm] = useState<EditSubForm>({
    tier: 'enterprise_base',
    max_seats: 0,
    monthly_credits: 0,
    price_dollars: 0,
  })

  const [showResetPwDialog, setShowResetPwDialog] = useState(false)
  const [resetPwOrg, setResetPwOrg] = useState<AdminOrganization | null>(null)
  const [resettingPw, setResettingPw] = useState(false)
  const [resetPwError, setResetPwError] = useState<string | null>(null)
  const [resetPwSuccess, setResetPwSuccess] = useState<string | null>(null)
  const [resetPwForm, setResetPwForm] = useState({ new_password: '' })

  const [showDeleteOrgDialog, setShowDeleteOrgDialog] = useState(false)
  const [deleteOrgTarget, setDeleteOrgTarget] = useState<AdminOrganization | null>(null)
  const [deletingOrg, setDeletingOrg] = useState(false)
  const [deleteOrgError, setDeleteOrgError] = useState<string | null>(null)
  const [deleteOrgConfirmName, setDeleteOrgConfirmName] = useState('')

  const [showCancelSubDialog, setShowCancelSubDialog] = useState(false)
  const [cancelSubOrg, setCancelSubOrg] = useState<AdminOrganization | null>(null)
  const [cancellingSubId, setCancellingSubId] = useState<number | null>(null)
  const [cancelSubError, setCancelSubError] = useState<string | null>(null)

  const hasModalOpen =
    showOrgCreditDialog ||
    showCreateOrgDialog ||
    showGrantSubDialog ||
    showEditSubDialog ||
    showResetPwDialog ||
    showDeleteOrgDialog ||
    showCancelSubDialog

  useEffect(() => {
    if (hasModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [hasModalOpen])

  const fetchOrganizations = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAdminOrganizations()
      setOrganizations(data)
    } catch (error) {
      console.error('Error fetching organizations:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchOrganizations()
  }, [fetchOrganizations])

  const organizationRows = useMemo(() => organizations, [organizations])

  const navigateToOrgDetail = (orgId: number) => {
    navigate(`/admin/organizations/${orgId}`)
  }

  const openOrgCreditDialog = (org: AdminOrganization) => {
    setOrgToEditCredits(org)
    setOrgCreditForm({
      hours_remaining: Number(org.credits?.hours_remaining || 0),
      hours_used: Number(org.credits?.hours_used || 0),
    })
    setOrgCreditError(null)
    setShowOrgCreditDialog(true)
  }

  const handleOrgCreditDialogClose = () => {
    setShowOrgCreditDialog(false)
    setOrgToEditCredits(null)
    setOrgCreditForm({ hours_remaining: 0, hours_used: 0 })
    setOrgCreditError(null)
  }

  const updateOrgCredits = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (!orgToEditCredits) return

    setUpdatingOrgCreditsId(orgToEditCredits.id)
    setOrgCreditError(null)

    try {
      await setOrganizationCredits(orgToEditCredits.id, orgCreditForm.hours_remaining, orgCreditForm.hours_used)
      await fetchOrganizations()
      handleOrgCreditDialogClose()
    } catch (error) {
      setOrgCreditError(getErrorMessage(error, 'Failed to update credits'))
    } finally {
      setUpdatingOrgCreditsId(null)
    }
  }

  const createOrgAccount = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()

    setCreatingOrg(true)
    setCreateOrgError(null)

    try {
      await createOrganizationAccount({
        org_name: createOrgForm.org_name,
        email: createOrgForm.email,
        password: createOrgForm.password,
        tier: createOrgForm.tier,
        max_seats: createOrgForm.max_seats,
        monthly_credits: createOrgForm.monthly_credits,
        price_cents: Math.round(createOrgForm.price_dollars * 100),
        days: 30,
      })

      setShowCreateOrgDialog(false)
      setCreateOrgForm({
        org_name: '',
        email: '',
        password: '',
        tier: 'enterprise_base',
        max_seats: 5,
        monthly_credits: 0,
        price_dollars: 0,
      })
      await fetchOrganizations()
    } catch (error) {
      setCreateOrgError(getErrorMessage(error, 'Failed to create organization account'))
    } finally {
      setCreatingOrg(false)
    }
  }

  const openGrantSubDialog = (org: AdminOrganization) => {
    setGrantSubOrg(org)
    setGrantSubForm({
      tier: org.subscription_tier || 'enterprise_base',
      days: 30,
      grant_credits: false,
    })
    setGrantSubError(null)
    setShowGrantSubDialog(true)
  }

  const grantSubscription = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (!grantSubOrg) return

    setGrantingSubId(grantSubOrg.id)
    setGrantSubError(null)

    try {
      await grantOrganizationSubscription(grantSubOrg.id, {
        tier: grantSubForm.tier,
        days: grantSubForm.days,
        grant_credits: grantSubForm.grant_credits,
      })
      setShowGrantSubDialog(false)
      await fetchOrganizations()
    } catch (error) {
      setGrantSubError(getErrorMessage(error, 'Failed to grant subscription'))
    } finally {
      setGrantingSubId(null)
    }
  }

  const openEditSubDialog = (org: AdminOrganization) => {
    setEditSubOrg(org)
    setEditSubForm({
      tier: org.subscription_tier || 'enterprise_base',
      max_seats: org.max_seats || 0,
      monthly_credits: org.monthly_credits || 0,
      price_dollars: typeof org.admin_price_cents === 'number' ? org.admin_price_cents / 100 : 0,
    })
    setEditSubError(null)
    setShowEditSubDialog(true)
  }

  const updateOrgSub = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (!editSubOrg) return

    setEditingSubId(editSubOrg.id)
    setEditSubError(null)

    try {
      await updateOrganizationSubscription(editSubOrg.id, {
        tier: editSubForm.tier,
        max_seats: editSubForm.max_seats,
        monthly_credits: editSubForm.monthly_credits,
        admin_price_cents: Math.round(editSubForm.price_dollars * 100),
      })
      setShowEditSubDialog(false)
      await fetchOrganizations()
    } catch (error) {
      setEditSubError(getErrorMessage(error, 'Failed to update subscription'))
    } finally {
      setEditingSubId(null)
    }
  }

  const openResetPwDialog = (org: AdminOrganization) => {
    setResetPwOrg(org)
    setResetPwForm({ new_password: '' })
    setResetPwError(null)
    setResetPwSuccess(null)
    setShowResetPwDialog(true)
  }

  const closeResetPwDialog = () => {
    setShowResetPwDialog(false)
    setResetPwOrg(null)
    setResetPwForm({ new_password: '' })
    setResetPwError(null)
    setResetPwSuccess(null)
  }

  const submitResetPw = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    if (!resetPwOrg) return

    if (!resetPwOrg.owner_id) {
      setResetPwError('This organization has no owner on record.')
      return
    }

    setResettingPw(true)
    setResetPwError(null)
    setResetPwSuccess(null)

    try {
      await resetUserPassword(resetPwOrg.owner_id, resetPwForm.new_password)
      setResetPwSuccess('Password reset successfully.')
      setResetPwForm({ new_password: '' })
    } catch (error) {
      setResetPwError(getErrorMessage(error, 'Failed to reset password'))
    } finally {
      setResettingPw(false)
    }
  }

  const openDeleteOrgDialog = (org: AdminOrganization) => {
    setDeleteOrgTarget(org)
    setDeleteOrgConfirmName('')
    setDeleteOrgError(null)
    setShowDeleteOrgDialog(true)
  }

  const closeDeleteOrgDialog = () => {
    setShowDeleteOrgDialog(false)
    setDeleteOrgTarget(null)
    setDeleteOrgConfirmName('')
    setDeleteOrgError(null)
  }

  const submitDeleteOrg = async () => {
    if (!deleteOrgTarget) return
    if (deleteOrgConfirmName !== deleteOrgTarget.name) return

    setDeletingOrg(true)
    setDeleteOrgError(null)

    try {
      await deleteOrganization(deleteOrgTarget.id)
      setOrganizations((current) => current.filter((org) => org.id !== deleteOrgTarget.id))
      closeDeleteOrgDialog()
    } catch (error) {
      setDeleteOrgError(getErrorMessage(error, 'Failed to delete organization'))
    } finally {
      setDeletingOrg(false)
    }
  }

  const cancelOrgSub = (org: AdminOrganization) => {
    setCancelSubOrg(org)
    setCancelSubError(null)
    setShowCancelSubDialog(true)
  }

  const closeCancelSubDialog = () => {
    setShowCancelSubDialog(false)
    setCancelSubOrg(null)
    setCancelSubError(null)
  }

  const confirmCancelOrgSub = async () => {
    if (!cancelSubOrg) return

    setCancellingSubId(cancelSubOrg.id)
    setCancelSubError(null)

    try {
      await cancelOrganizationSubscription(cancelSubOrg.id)
      closeCancelSubDialog()
      await fetchOrganizations()
    } catch (error) {
      setCancelSubError(getErrorMessage(error, 'Failed to cancel subscription'))
    } finally {
      setCancellingSubId(null)
    }
  }

  return (
    <PageLayout
      icon={Building2}
      title="Organization Management"
      actions={
        <>
          <button className="admin-orgs__action-btn admin-orgs__action-btn--create" onClick={() => setShowCreateOrgDialog(true)}>
            <Plus className="admin-orgs__action-icon" />
            Create Org Account
          </button>
          <button className="admin-orgs__action-btn" disabled={loading} onClick={fetchOrganizations}>
            {!loading ? (
              <RefreshCw className="admin-orgs__action-icon" />
            ) : (
              <Loader2 className="admin-orgs__action-icon admin-orgs__action-icon--spin" />
            )}
            Refresh
          </button>
        </>
      }
    >
      <div className="admin-orgs-page">
        <div className="admin-orgs">
          <div className="admin-orgs__heading">
            <h1 className="admin-orgs__title">Organization Management</h1>
            <p className="admin-orgs__subtitle">Manage organizations and their credits</p>
          </div>

          {loading && !organizationRows.length ? (
            <div className="admin-orgs__loading">
              <Loader2 className="admin-orgs__loading-icon" />
              <p className="admin-orgs__loading-text">Loading organizations...</p>
            </div>
          ) : organizationRows.length > 0 ? (
            <>
              <div className="admin-orgs__stats-header">
                <div className="admin-orgs__stats-info">
                  <div className="admin-orgs__stats-icon">
                    <Building2 className="admin-orgs__stats-icon-svg" />
                  </div>
                  <div>
                    <h2 className="admin-orgs__stats-title">Organization Management</h2>
                    <p className="admin-orgs__stats-desc">Manage organizations and their credits</p>
                  </div>
                </div>
                <span className="admin-orgs__stats-count">
                  {organizationRows.length} organization{organizationRows.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="admin-orgs__table-wrapper">
                <div className="admin-orgs__table-scroll">
                  <table className="admin-orgs__table">
                    <thead className="admin-orgs__thead">
                      <tr>
                        <th className="admin-orgs__th">ID</th>
                        <th className="admin-orgs__th">Name</th>
                        <th className="admin-orgs__th">Subscription</th>
                        <th className="admin-orgs__th">Seats</th>
                        <th className="admin-orgs__th">Credits</th>
                        <th className="admin-orgs__th">Created</th>
                        <th className="admin-orgs__th">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="admin-orgs__tbody">
                      {organizationRows.map((org) => (
                        <tr
                          key={org.id}
                          className="admin-orgs__row admin-orgs__row--clickable"
                          onClick={() => navigateToOrgDetail(org.id)}
                        >
                          <td className="admin-orgs__td">
                            <span className="admin-orgs__id">#{org.id}</span>
                          </td>
                          <td className="admin-orgs__td">
                            <div className="admin-orgs__name-cell">
                              <span className="admin-orgs__name">{org.name}</span>
                              {org.description ? <span className="admin-orgs__description">{org.description}</span> : null}
                              {org.created_by_admin ? (
                                <span className="admin-orgs__badge admin-orgs__badge--admin">Admin Created</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="admin-orgs__td">
                            <div className="admin-orgs__sub-cell">
                              <span className={`admin-orgs__status-badge ${getStatusBadgeClass(org.subscription_status)}`}>
                                {org.subscription_status || 'none'}
                              </span>
                              {org.subscription_tier ? <span className="admin-orgs__tier-label">{org.subscription_tier}</span> : null}
                              {org.admin_price_cents != null ? (
                                <span className="admin-orgs__price-label">${(org.admin_price_cents / 100).toFixed(2)}/mo</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="admin-orgs__td">
                            <span className="admin-orgs__members">
                              <Users className="admin-orgs__members-icon" />
                              {org.member_count}
                              {org.max_seats ? `/${org.max_seats}` : ''}
                            </span>
                          </td>
                          <td className="admin-orgs__td">
                            <div className="admin-orgs__credits">
                              <div className="admin-orgs__credits-row">
                                <CreditCard className="admin-orgs__credits-icon" />
                                <span className="admin-orgs__credits-value">{formatCredits(org.credits.hours_remaining)}</span>
                                <span className="admin-orgs__credits-unit">min</span>
                              </div>
                              {org.monthly_credits ? <span className="admin-orgs__credits-used">{org.monthly_credits}/mo</span> : null}
                            </div>
                          </td>
                          <td className="admin-orgs__td">
                            <span className="admin-orgs__date">{formatDateTime(org.created_at)}</span>
                          </td>
                          <td className="admin-orgs__td" onClick={(event) => event.stopPropagation()}>
                            <div className="admin-orgs__actions-cell">
                              <button className="admin-orgs__set-credits-btn" onClick={() => openOrgCreditDialog(org)}>
                                <CreditCard className="admin-orgs__btn-icon" /> Credits
                              </button>
                              <button
                                className="admin-orgs__set-credits-btn admin-orgs__set-credits-btn--sub"
                                onClick={() => openGrantSubDialog(org)}
                              >
                                <Crown className="admin-orgs__btn-icon" /> Sub
                              </button>
                              {org.subscription_status === 'active' ? (
                                <button
                                  className="admin-orgs__set-credits-btn admin-orgs__set-credits-btn--edit"
                                  onClick={() => openEditSubDialog(org)}
                                >
                                  <Settings className="admin-orgs__btn-icon" /> Edit
                                </button>
                              ) : null}
                              {org.subscription_status === 'active' ? (
                                <button
                                  className="admin-orgs__set-credits-btn admin-orgs__set-credits-btn--cancel"
                                  onClick={() => cancelOrgSub(org)}
                                >
                                  <XCircle className="admin-orgs__btn-icon" />
                                </button>
                              ) : null}
                              <button
                                className="admin-orgs__set-credits-btn admin-orgs__set-credits-btn--pw"
                                onClick={() => openResetPwDialog(org)}
                                title="Reset owner password"
                              >
                                <KeyRound className="admin-orgs__btn-icon" />
                              </button>
                              {org.subscription_status !== 'active' ? (
                                <button
                                  className="admin-orgs__set-credits-btn admin-orgs__set-credits-btn--delete"
                                  onClick={() => openDeleteOrgDialog(org)}
                                  title="Delete organization"
                                >
                                  <Trash2 className="admin-orgs__btn-icon" />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="admin-orgs__empty">
              <div className="admin-orgs__empty-icon">
                <Building2 className="admin-orgs__empty-icon-svg" />
              </div>
              <p className="admin-orgs__empty-text">No organizations found</p>
              <button className="admin-orgs__empty-btn" onClick={fetchOrganizations}>
                Refresh Organizations
              </button>
            </div>
          )}
        </div>
      </div>

      {showCreateOrgDialog
        ? createPortal(
            <div className="admin-orgs__modal-backdrop" onClick={(event) => event.target === event.currentTarget && setShowCreateOrgDialog(false)}>
              <div className="admin-orgs__modal" role="dialog" aria-modal="true">
                <div className="admin-orgs__modal-accent" />
                <div className="admin-orgs__modal-header">
                  <button className="admin-orgs__modal-close" onClick={() => setShowCreateOrgDialog(false)}>
                    <X size={18} />
                  </button>
                  <div className="admin-orgs__modal-icon">
                    <Building2 size={24} />
                  </div>
                  <h2 className="admin-orgs__modal-title">Create Organization Account</h2>
                  <p className="admin-orgs__modal-subtitle">Admin-managed org with custom billing</p>
                </div>
                <div className="admin-orgs__modal-content">
                  <form className="admin-orgs__modal-form" onSubmit={createOrgAccount}>
                    <div className="admin-orgs__modal-field">
                      <label className="admin-orgs__modal-label">Organization Name *</label>
                      <input
                        value={createOrgForm.org_name}
                        onChange={(event) => setCreateOrgForm((current) => ({ ...current, org_name: event.target.value }))}
                        type="text"
                        required
                        className="admin-orgs__modal-input"
                        placeholder="Acme Corp"
                      />
                    </div>

                    <div className="admin-orgs__modal-field">
                      <label className="admin-orgs__modal-label">Owner Email *</label>
                      <input
                        value={createOrgForm.email}
                        onChange={(event) => setCreateOrgForm((current) => ({ ...current, email: event.target.value }))}
                        type="email"
                        required
                        className="admin-orgs__modal-input"
                        placeholder="owner@example.com"
                      />
                    </div>

                    <div className="admin-orgs__modal-field">
                      <label className="admin-orgs__modal-label">Owner Password *</label>
                      <input
                        value={createOrgForm.password}
                        onChange={(event) => setCreateOrgForm((current) => ({ ...current, password: event.target.value }))}
                        type="text"
                        required
                        className="admin-orgs__modal-input"
                        placeholder="Temporary password"
                      />
                    </div>

                    <div className="admin-orgs__modal-field">
                      <label className="admin-orgs__modal-label">Tier</label>
                      <select
                        value={createOrgForm.tier}
                        onChange={(event) => setCreateOrgForm((current) => ({ ...current, tier: event.target.value }))}
                        className="admin-orgs__modal-input"
                      >
                        {createTierOptions.map((tier) => (
                          <option key={tier.value} value={tier.value}>
                            {tier.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="admin-orgs__modal-grid">
                      <div className="admin-orgs__modal-field">
                        <label className="admin-orgs__modal-label">Max Seats</label>
                        <input
                          value={createOrgForm.max_seats}
                          onChange={(event) =>
                            setCreateOrgForm((current) => ({ ...current, max_seats: Number(event.target.value) || 0 }))
                          }
                          type="number"
                          min="0"
                          className="admin-orgs__modal-input"
                          placeholder="0 = unlimited"
                        />
                      </div>
                      <div className="admin-orgs__modal-field">
                        <label className="admin-orgs__modal-label">AI Credits/mo</label>
                        <input
                          value={createOrgForm.monthly_credits}
                          onChange={(event) =>
                            setCreateOrgForm((current) => ({ ...current, monthly_credits: Number(event.target.value) || 0 }))
                          }
                          type="number"
                          min="0"
                          className="admin-orgs__modal-input"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="admin-orgs__modal-field">
                      <label className="admin-orgs__modal-label">Price ($/month)</label>
                      <input
                        value={createOrgForm.price_dollars}
                        onChange={(event) =>
                          setCreateOrgForm((current) => ({ ...current, price_dollars: Number(event.target.value) || 0 }))
                        }
                        type="number"
                        step="0.01"
                        min="0"
                        className="admin-orgs__modal-input"
                        placeholder="0 = free"
                      />
                    </div>

                    {createOrgError ? (
                      <div className="admin-orgs__modal-error">
                        <AlertCircle size={16} />
                        <p className="admin-orgs__modal-error-text">{createOrgError}</p>
                      </div>
                    ) : null}
                  </form>
                </div>
                <div className="admin-orgs__modal-footer">
                  <button type="button" className="admin-orgs__modal-btn admin-orgs__modal-btn--secondary" onClick={() => setShowCreateOrgDialog(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="admin-orgs__modal-btn admin-orgs__modal-btn--primary" disabled={creatingOrg} onClick={() => void createOrgAccount()}>
                    {creatingOrg ? <Loader2 size={16} className="admin-orgs__modal-spinner" /> : null}
                    {creatingOrg ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {showGrantSubDialog
        ? createPortal(
            <div className="admin-orgs__modal-backdrop" onClick={(event) => event.target === event.currentTarget && setShowGrantSubDialog(false)}>
              <div className="admin-orgs__modal" role="dialog" aria-modal="true">
                <div className="admin-orgs__modal-accent" />
                <div className="admin-orgs__modal-header">
                  <button className="admin-orgs__modal-close" onClick={() => setShowGrantSubDialog(false)}>
                    <X size={18} />
                  </button>
                  <div className="admin-orgs__modal-icon">
                    <Crown size={24} />
                  </div>
                  <h2 className="admin-orgs__modal-title">Grant Subscription</h2>
                  <p className="admin-orgs__modal-subtitle">{grantSubOrg?.name}</p>
                </div>
                <div className="admin-orgs__modal-content">
                  <form className="admin-orgs__modal-form" onSubmit={grantSubscription}>
                    <div className="admin-orgs__modal-field">
                      <label className="admin-orgs__modal-label">Tier</label>
                      <select
                        value={grantSubForm.tier}
                        onChange={(event) => setGrantSubForm((current) => ({ ...current, tier: event.target.value }))}
                        className="admin-orgs__modal-input"
                      >
                        {availableTiers.map((tier) => (
                          <option key={tier.value} value={tier.value}>
                            {tier.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="admin-orgs__modal-field">
                      <label className="admin-orgs__modal-label">Days</label>
                      <input
                        value={grantSubForm.days}
                        onChange={(event) => setGrantSubForm((current) => ({ ...current, days: Number(event.target.value) || 1 }))}
                        type="number"
                        min="1"
                        className="admin-orgs__modal-input"
                      />
                    </div>

                    <label className="admin-orgs__modal-checkbox">
                      <input
                        type="checkbox"
                        checked={grantSubForm.grant_credits}
                        onChange={(event) =>
                          setGrantSubForm((current) => ({ ...current, grant_credits: event.target.checked }))
                        }
                      />
                      Grant AI Credits
                    </label>

                    {grantSubError ? (
                      <div className="admin-orgs__modal-error">
                        <AlertCircle size={16} />
                        <p className="admin-orgs__modal-error-text">{grantSubError}</p>
                      </div>
                    ) : null}
                  </form>
                </div>
                <div className="admin-orgs__modal-footer">
                  <button type="button" className="admin-orgs__modal-btn admin-orgs__modal-btn--secondary" onClick={() => setShowGrantSubDialog(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-orgs__modal-btn admin-orgs__modal-btn--primary"
                    disabled={grantingSubId !== null}
                    onClick={() => void grantSubscription()}
                  >
                    {grantingSubId !== null ? <Loader2 size={16} className="admin-orgs__modal-spinner" /> : null}
                    {grantingSubId !== null ? 'Granting...' : 'Grant Subscription'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {showEditSubDialog
        ? createPortal(
            <div className="admin-orgs__modal-backdrop" onClick={(event) => event.target === event.currentTarget && setShowEditSubDialog(false)}>
              <div className="admin-orgs__modal" role="dialog" aria-modal="true">
                <div className="admin-orgs__modal-accent" />
                <div className="admin-orgs__modal-header">
                  <button className="admin-orgs__modal-close" onClick={() => setShowEditSubDialog(false)}>
                    <X size={18} />
                  </button>
                  <div className="admin-orgs__modal-icon">
                    <Settings size={24} />
                  </div>
                  <h2 className="admin-orgs__modal-title">Edit Subscription</h2>
                  <p className="admin-orgs__modal-subtitle">{editSubOrg?.name}</p>
                </div>
                <div className="admin-orgs__modal-content">
                  <form className="admin-orgs__modal-form" onSubmit={updateOrgSub}>
                    <div className="admin-orgs__modal-field">
                      <label className="admin-orgs__modal-label">Tier</label>
                      <select
                        value={editSubForm.tier}
                        onChange={(event) => setEditSubForm((current) => ({ ...current, tier: event.target.value }))}
                        className="admin-orgs__modal-input"
                      >
                        {availableTiers.map((tier) => (
                          <option key={tier.value} value={tier.value}>
                            {tier.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="admin-orgs__modal-grid">
                      <div className="admin-orgs__modal-field">
                        <label className="admin-orgs__modal-label">Max Seats</label>
                        <input
                          value={editSubForm.max_seats}
                          onChange={(event) =>
                            setEditSubForm((current) => ({ ...current, max_seats: Number(event.target.value) || 0 }))
                          }
                          type="number"
                          min="0"
                          className="admin-orgs__modal-input"
                          placeholder="0 = unlimited"
                        />
                      </div>

                      <div className="admin-orgs__modal-field">
                        <label className="admin-orgs__modal-label">AI Credits/mo</label>
                        <input
                          value={editSubForm.monthly_credits}
                          onChange={(event) =>
                            setEditSubForm((current) => ({ ...current, monthly_credits: Number(event.target.value) || 0 }))
                          }
                          type="number"
                          min="0"
                          className="admin-orgs__modal-input"
                        />
                      </div>
                    </div>

                    <div className="admin-orgs__modal-field">
                      <label className="admin-orgs__modal-label">Price ($/month)</label>
                      <input
                        value={editSubForm.price_dollars}
                        onChange={(event) =>
                          setEditSubForm((current) => ({ ...current, price_dollars: Number(event.target.value) || 0 }))
                        }
                        type="number"
                        step="0.01"
                        min="0"
                        className="admin-orgs__modal-input"
                      />
                    </div>

                    {editSubError ? (
                      <div className="admin-orgs__modal-error">
                        <AlertCircle size={16} />
                        <p className="admin-orgs__modal-error-text">{editSubError}</p>
                      </div>
                    ) : null}
                  </form>
                </div>
                <div className="admin-orgs__modal-footer">
                  <button type="button" className="admin-orgs__modal-btn admin-orgs__modal-btn--secondary" onClick={() => setShowEditSubDialog(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-orgs__modal-btn admin-orgs__modal-btn--primary"
                    disabled={editingSubId !== null}
                    onClick={() => void updateOrgSub()}
                  >
                    {editingSubId !== null ? <Loader2 size={16} className="admin-orgs__modal-spinner" /> : null}
                    {editingSubId !== null ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {showResetPwDialog
        ? createPortal(
            <div className="admin-orgs__modal-backdrop" onClick={(event) => event.target === event.currentTarget && closeResetPwDialog()}>
              <div className="admin-orgs__modal" role="dialog" aria-modal="true">
                <div className="admin-orgs__modal-accent" />
                <div className="admin-orgs__modal-header">
                  <button className="admin-orgs__modal-close" onClick={closeResetPwDialog}>
                    <X size={18} />
                  </button>
                  <div className="admin-orgs__modal-icon">
                    <KeyRound size={24} />
                  </div>
                  <h2 className="admin-orgs__modal-title">Reset Owner Password</h2>
                  <p className="admin-orgs__modal-subtitle">{resetPwOrg?.name}</p>
                </div>
                <div className="admin-orgs__modal-content">
                  <form className="admin-orgs__modal-form" onSubmit={submitResetPw}>
                    <div className="admin-orgs__modal-field">
                      <label className="admin-orgs__modal-label">New Password *</label>
                      <input
                        value={resetPwForm.new_password}
                        onChange={(event) => setResetPwForm({ new_password: event.target.value })}
                        type="text"
                        required
                        className="admin-orgs__modal-input"
                        placeholder="Enter new password"
                      />
                    </div>

                    {resetPwError ? (
                      <div className="admin-orgs__modal-error">
                        <AlertCircle size={16} />
                        <p className="admin-orgs__modal-error-text">{resetPwError}</p>
                      </div>
                    ) : null}

                    {resetPwSuccess ? (
                      <div className="admin-orgs__modal-success">
                        <p className="admin-orgs__modal-success-text">{resetPwSuccess}</p>
                      </div>
                    ) : null}
                  </form>
                </div>
                <div className="admin-orgs__modal-footer">
                  <button type="button" className="admin-orgs__modal-btn admin-orgs__modal-btn--secondary" onClick={closeResetPwDialog}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-orgs__modal-btn admin-orgs__modal-btn--primary"
                    disabled={resettingPw}
                    onClick={() => void submitResetPw()}
                  >
                    {resettingPw ? <Loader2 size={16} className="admin-orgs__modal-spinner" /> : null}
                    {resettingPw ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {showDeleteOrgDialog
        ? createPortal(
            <div className="admin-orgs__modal-backdrop" onClick={(event) => event.target === event.currentTarget && closeDeleteOrgDialog()}>
              <div className="admin-orgs__modal" role="dialog" aria-modal="true">
                <div className="admin-orgs__modal-accent admin-orgs__modal-accent--danger" />
                <div className="admin-orgs__modal-header">
                  <button className="admin-orgs__modal-close" onClick={closeDeleteOrgDialog}>
                    <X size={18} />
                  </button>
                  <div className="admin-orgs__modal-icon admin-orgs__modal-icon--danger">
                    <Trash2 size={24} />
                  </div>
                  <h2 className="admin-orgs__modal-title">Delete Organization</h2>
                  <p className="admin-orgs__modal-subtitle">{deleteOrgTarget?.name}</p>
                </div>
                <div className="admin-orgs__modal-content">
                  <div className="admin-orgs__modal-form">
                    <div className="admin-orgs__modal-warning">
                      <AlertCircle size={16} className="admin-orgs__modal-warning-icon" />
                      <p className="admin-orgs__modal-warning-text">
                        This action cannot be undone. All organization data will be permanently deleted.
                      </p>
                    </div>

                    <div className="admin-orgs__modal-field">
                      <label className="admin-orgs__modal-label">
                        Type <strong className="admin-orgs__modal-org-name">{deleteOrgTarget?.name}</strong> to confirm
                      </label>
                      <input
                        value={deleteOrgConfirmName}
                        onChange={(event) => setDeleteOrgConfirmName(event.target.value)}
                        type="text"
                        className="admin-orgs__modal-input"
                        placeholder="Organization name"
                      />
                    </div>

                    {deleteOrgError ? (
                      <div className="admin-orgs__modal-error">
                        <AlertCircle size={16} />
                        <p className="admin-orgs__modal-error-text">{deleteOrgError}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="admin-orgs__modal-footer">
                  <button type="button" className="admin-orgs__modal-btn admin-orgs__modal-btn--secondary" onClick={closeDeleteOrgDialog}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="admin-orgs__modal-btn admin-orgs__modal-btn--danger"
                    disabled={deletingOrg || deleteOrgConfirmName !== deleteOrgTarget?.name}
                    onClick={() => void submitDeleteOrg()}
                  >
                    {deletingOrg ? <Loader2 size={16} className="admin-orgs__modal-spinner" /> : null}
                    {deletingOrg ? 'Deleting...' : 'Delete Organization'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {showCancelSubDialog
        ? createPortal(
            <div className="admin-orgs__modal-backdrop" onClick={(event) => event.target === event.currentTarget && closeCancelSubDialog()}>
              <div className="admin-orgs__modal" role="dialog" aria-modal="true">
                <div className="admin-orgs__modal-accent admin-orgs__modal-accent--danger" />
                <div className="admin-orgs__modal-header">
                  <button className="admin-orgs__modal-close" onClick={closeCancelSubDialog}>
                    <X size={18} />
                  </button>
                  <div className="admin-orgs__modal-icon admin-orgs__modal-icon--danger">
                    <XCircle size={24} />
                  </div>
                  <h2 className="admin-orgs__modal-title">Cancel Subscription</h2>
                  <p className="admin-orgs__modal-subtitle">{cancelSubOrg?.name}</p>
                </div>
                <div className="admin-orgs__modal-content">
                  <div className="admin-orgs__modal-form">
                    <div className="admin-orgs__modal-warning">
                      <AlertCircle size={16} className="admin-orgs__modal-warning-icon" />
                      <p className="admin-orgs__modal-warning-text">
                        This will immediately cancel the organization's subscription. This action cannot be undone.
                      </p>
                    </div>

                    {cancelSubError ? (
                      <div className="admin-orgs__modal-error">
                        <AlertCircle size={16} />
                        <p className="admin-orgs__modal-error-text">{cancelSubError}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="admin-orgs__modal-footer">
                  <button
                    type="button"
                    className="admin-orgs__modal-btn admin-orgs__modal-btn--secondary"
                    disabled={cancellingSubId !== null}
                    onClick={closeCancelSubDialog}
                  >
                    Keep Subscription
                  </button>
                  <button
                    type="button"
                    className="admin-orgs__modal-btn admin-orgs__modal-btn--danger"
                    disabled={cancellingSubId !== null}
                    onClick={() => void confirmCancelOrgSub()}
                  >
                    {cancellingSubId !== null ? <Loader2 size={16} className="admin-orgs__modal-spinner" /> : null}
                    {cancellingSubId !== null ? 'Cancelling...' : 'Cancel Subscription'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {showOrgCreditDialog
        ? createPortal(
            <div className="admin-orgs__modal-backdrop" onClick={(event) => event.target === event.currentTarget && handleOrgCreditDialogClose()}>
              <div className="admin-orgs__modal" role="dialog" aria-modal="true">
                <div className="admin-orgs__modal-accent" />

                <div className="admin-orgs__modal-header">
                  <button
                    className="admin-orgs__modal-close"
                    onClick={handleOrgCreditDialogClose}
                    disabled={updatingOrgCreditsId !== null}
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                  <div className="admin-orgs__modal-icon">
                    <CreditCard size={24} />
                  </div>
                  <h2 className="admin-orgs__modal-title">Set Organization Credits</h2>
                  <p className="admin-orgs__modal-subtitle">{orgToEditCredits?.name}</p>
                </div>

                <div className="admin-orgs__modal-content">
                  <form className="admin-orgs__modal-form" onSubmit={updateOrgCredits}>
                    {orgToEditCredits?.credits ? (
                      <div className="admin-orgs__modal-balance">
                        <p className="admin-orgs__modal-balance-label">Current Balance</p>
                        <div className="admin-orgs__modal-balance-row">
                          <div>
                            <span className="admin-orgs__modal-balance-text">Remaining:</span>
                            <span className="admin-orgs__modal-balance-value">
                              {formatCredits(orgToEditCredits.credits.hours_remaining)} min
                            </span>
                          </div>
                          <div>
                            <span className="admin-orgs__modal-balance-text">Used:</span>
                            <span className="admin-orgs__modal-balance-value admin-orgs__modal-balance-value--muted">
                              {formatCredits(orgToEditCredits.credits.hours_used)} min
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="admin-orgs__modal-field">
                      <label htmlFor="hours_remaining" className="admin-orgs__modal-label">
                        New Remaining Credits
                      </label>
                      <input
                        id="hours_remaining"
                        value={orgCreditForm.hours_remaining}
                        onChange={(event) =>
                          setOrgCreditForm((current) => ({ ...current, hours_remaining: Number(event.target.value) || 0 }))
                        }
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        className="admin-orgs__modal-input"
                        placeholder="Enter new remaining credits"
                      />
                    </div>

                    <div className="admin-orgs__modal-field">
                      <label htmlFor="hours_used" className="admin-orgs__modal-label">
                        Hours Used
                      </label>
                      <input
                        id="hours_used"
                        value={orgCreditForm.hours_used}
                        onChange={(event) =>
                          setOrgCreditForm((current) => ({ ...current, hours_used: Number(event.target.value) || 0 }))
                        }
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        className="admin-orgs__modal-input"
                        placeholder="Enter hours used"
                      />
                    </div>

                    {orgCreditError ? (
                      <div className="admin-orgs__modal-error">
                        <AlertCircle size={16} />
                        <p className="admin-orgs__modal-error-text">{orgCreditError}</p>
                      </div>
                    ) : null}
                  </form>
                </div>

                <div className="admin-orgs__modal-footer">
                  <button
                    type="button"
                    className="admin-orgs__modal-btn admin-orgs__modal-btn--secondary"
                    disabled={updatingOrgCreditsId !== null}
                    onClick={handleOrgCreditDialogClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-orgs__modal-btn admin-orgs__modal-btn--primary"
                    disabled={updatingOrgCreditsId !== null}
                    onClick={() => void updateOrgCredits()}
                  >
                    {updatingOrgCreditsId !== null ? <Loader2 size={16} className="admin-orgs__modal-spinner" /> : null}
                    {updatingOrgCreditsId !== null ? 'Saving...' : 'Save Credits'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </PageLayout>
  )
}
