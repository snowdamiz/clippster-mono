import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  Handshake,
  Layers,
  Loader2,
  RefreshCw,
  Shield,
  User,
  Users,
  X,
} from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import {
  addUserCredits,
  cancelUserSubscription,
  changeUserSubscriptionTier,
  demoteUserFromModerator,
  extendUserSubscription,
  getUserSubscriptionHistory,
  grantUserSubscription,
  listAdminUsers,
  promoteUserToAdmin,
  promoteUserToModerator,
  type AdminUser,
} from '@/services/adminApi'
import { formatWalletAddress } from './adminFormat'
import { formatDateTime } from '@/utils/dateTimeUtils'
import './AdminUsersPage.css'

type Tier = 'starter' | 'creator' | 'pro'

interface SubscriptionHistoryRow {
  id: number
  tier: string | null
  status: string
  start_date: string | null
  end_date: string | null
  credits_granted: number | null
}

interface ConfirmationModalProps {
  show: boolean
  title: string
  message: string
  itemName?: string
  suffix?: string
  confirmText?: string
  variant?: 'default' | 'destructive'
  onClose: () => void
  onConfirm: () => void
}

const tierOptions: Array<{ label: string; value: Tier }> = [
  { label: 'Starter (600 credits)', value: 'starter' },
  { label: 'Creator (1800 credits)', value: 'creator' },
  { label: 'Pro (9000 credits)', value: 'pro' },
]

function normalizeTier(value: string): Tier {
  if (value === 'creator' || value === 'pro') return value
  return 'starter'
}

function getProviderIcon(provider: string | null | undefined) {
  switch ((provider || '').toLowerCase()) {
    case 'google':
      return '🔵'
    case 'email':
      return '✉️'
    case 'wallet':
      return '💳'
    default:
      return '👤'
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function getUserDisplayName(user: AdminUser) {
  if (user.email && (!user.wallet_address || user.provider !== 'wallet')) {
    return user.email
  }
  return formatWalletAddress(user.wallet_address)
}

function formatCredits(value: number | 'unlimited' | null | undefined) {
  if (value === 'unlimited') return '∞'
  if (!value || value === 0) return '0'
  return Math.round(value).toString()
}

function getSubscriptionStatusClass(status: string | null | undefined) {
  switch ((status || '').toLowerCase()) {
    case 'active':
      return 'admin-users__sub-status--active'
    case 'cancelled':
    case 'canceled':
      return 'admin-users__sub-status--cancelled'
    case 'expired':
      return 'admin-users__sub-status--expired'
    default:
      return 'admin-users__sub-status--none'
  }
}

function getSubscriptionStatusBadgeClass(status: string | null | undefined) {
  switch ((status || '').toLowerCase()) {
    case 'active':
      return 'admin-users__subscription-status-badge--active'
    case 'cancelled':
    case 'canceled':
      return 'admin-users__subscription-status-badge--cancelled'
    case 'expired':
      return 'admin-users__subscription-status-badge--expired'
    default:
      return 'admin-users__subscription-status-badge--none'
  }
}

function ConfirmationModal({
  show,
  title,
  message,
  itemName,
  suffix = '?',
  confirmText = 'Confirm',
  variant = 'default',
  onClose,
  onConfirm,
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!show) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [show, onClose])

  if (!show) return null

  return createPortal(
    <div className="confirm-dialog__overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="confirm-dialog" role="dialog" aria-modal="true">
        <div className={`confirm-dialog__accent ${variant === 'destructive' ? 'confirm-dialog__accent--destructive' : ''}`} />

        <div className="confirm-dialog__header">
          <button className="confirm-dialog__close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
          <div className={`confirm-dialog__icon ${variant === 'destructive' ? 'confirm-dialog__icon--destructive' : ''}`}>
            <AlertTriangle size={24} />
          </div>
          <h2 className="confirm-dialog__title">{title}</h2>
        </div>

        <div className="confirm-dialog__content">
          <p className="confirm-dialog__message">
            {message} {itemName ? <span className="confirm-dialog__item-name">"{itemName}"</span> : null} {suffix}
          </p>
          <p className="confirm-dialog__warning">This action cannot be undone.</p>
        </div>

        <div className="confirm-dialog__footer">
          <button className="confirm-dialog__btn confirm-dialog__btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`confirm-dialog__btn confirm-dialog__btn--primary ${variant === 'destructive' ? 'confirm-dialog__btn--destructive' : ''}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function AdminUsersPage() {
  const navigate = useNavigate()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<'id' | 'account' | 'role' | 'subscription'>('id')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const [promotingUserId, setPromotingUserId] = useState<number | null>(null)
  const [showPromoteDialog, setShowPromoteDialog] = useState(false)
  const [userToPromote, setUserToPromote] = useState<AdminUser | null>(null)

  const [promotingModUserId, setPromotingModUserId] = useState<number | null>(null)
  const [demotingModUserId, setDemotingModUserId] = useState<number | null>(null)
  const [showPromoteModDialog, setShowPromoteModDialog] = useState(false)
  const [showDemoteModDialog, setShowDemoteModDialog] = useState(false)
  const [userToPromoteMod, setUserToPromoteMod] = useState<AdminUser | null>(null)
  const [userToDemoteMod, setUserToDemoteMod] = useState<AdminUser | null>(null)

  const [showCreditDialog, setShowCreditDialog] = useState(false)
  const [userToEditCredits, setUserToEditCredits] = useState<AdminUser | null>(null)
  const [updatingCreditsUserId, setUpdatingCreditsUserId] = useState<number | null>(null)
  const [creditForm, setCreditForm] = useState({ hours_to_add: 0 })
  const [creditError, setCreditError] = useState<string | null>(null)

  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false)
  const [userToEditSubscription, setUserToEditSubscription] = useState<AdminUser | null>(null)
  const [updatingSubscriptionUserId, setUpdatingSubscriptionUserId] = useState<number | null>(null)
  const [subscriptionForm, setSubscriptionForm] = useState({
    grant_tier: 'starter' as Tier,
    grant_days: 30,
    grant_credits: false,
    extend_days: 30,
    extend_credits: false,
    change_tier: 'starter' as Tier,
    change_credits: false,
  })
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistoryRow[]>([])
  const [showCancelSubscriptionDialog, setShowCancelSubscriptionDialog] = useState(false)

  const [openUserActionMenuId, setOpenUserActionMenuId] = useState<number | null>(null)
  const userActionMenuRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const toggleSort = useCallback((column: 'id' | 'account' | 'role' | 'subscription') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }, [sortColumn, sortDirection])

  const rows = useMemo(() => {
    const sorted = [...users].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortColumn) {
        case 'id':
          aValue = a.id
          bValue = b.id
          break
        case 'account':
          aValue = (a.email || a.wallet_address || '').toLowerCase()
          bValue = (b.email || b.wallet_address || '').toLowerCase()
          break
        case 'role':
          aValue = a.is_admin ? 3 : a.is_moderator ? 2 : 1
          bValue = b.is_admin ? 3 : b.is_moderator ? 2 : 1
          break
        case 'subscription':
          aValue = a.subscription?.tier_name || ''
          bValue = b.subscription?.tier_name || ''
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [users, sortColumn, sortDirection])

  const refreshUsers = useCallback(async () => {
    const data = await listAdminUsers()
    setUsers(data)
    return data
  }, [])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await refreshUsers()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load users'))
    } finally {
      setLoading(false)
    }
  }, [refreshUsers])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-user-action-menu]')) {
        setOpenUserActionMenuId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const hasModalOpen =
    showPromoteDialog ||
    showPromoteModDialog ||
    showDemoteModDialog ||
    showCreditDialog ||
    showSubscriptionDialog ||
    showCancelSubscriptionDialog

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

  const fetchSubscriptionHistory = useCallback(async (userId: number) => {
    try {
      const rows = await getUserSubscriptionHistory(userId)
      setSubscriptionHistory(
        rows.map((row) => ({
          id: Number(row.id),
          tier: row.tier ?? null,
          status: row.status || 'none',
          start_date: row.start_date ?? null,
          end_date: row.end_date ?? null,
          credits_granted: row.credits_granted ?? 0,
        })),
      )
    } catch (err) {
      console.error('Error fetching subscription history:', err)
    }
  }, [])

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setError('Failed to copy to clipboard')
    }
  }

  function navigateToUserProfile(userId: number) {
    navigate(`/admin/users/${userId}`)
  }

  function setUserActionMenuRef(element: HTMLButtonElement | null, userId: number) {
    if (element) {
      userActionMenuRefs.current.set(userId, element)
    } else {
      userActionMenuRefs.current.delete(userId)
    }
  }

  function toggleUserActionMenu(userId: number) {
    setOpenUserActionMenuId((current) => (current === userId ? null : userId))
  }

  function closeUserActionMenu() {
    setOpenUserActionMenuId(null)
  }

  function getUserActionMenuPosition(userId: number): Record<string, string> {
    const button = userActionMenuRefs.current.get(userId)
    if (!button) return { top: '0px', left: '0px' }

    const rect = button.getBoundingClientRect()
    const menuWidth = 200
    const menuMaxHeight = 220
    const padding = 8

    let left = rect.right - menuWidth
    if (left < padding) left = padding

    const viewportWidth = window.innerWidth
    if (left + menuWidth > viewportWidth - padding) {
      left = viewportWidth - menuWidth - padding
    }

    let top = rect.bottom + 4
    const viewportHeight = window.innerHeight
    if (top + menuMaxHeight > viewportHeight - padding) {
      top = rect.top - menuMaxHeight - 4
      if (top < padding) top = padding
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
    }
  }

  function confirmPromoteUser(user: AdminUser) {
    setUserToPromote(user)
    setShowPromoteDialog(true)
  }

  function handlePromoteDialogClose() {
    setShowPromoteDialog(false)
    setUserToPromote(null)
  }

  async function promoteUserConfirmed() {
    if (!userToPromote) return

    setPromotingUserId(userToPromote.id)
    setError(null)

    try {
      await promoteUserToAdmin(userToPromote.id)
      await refreshUsers()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to promote user'))
    } finally {
      setPromotingUserId(null)
      handlePromoteDialogClose()
    }
  }

  function confirmPromoteToModerator(user: AdminUser) {
    setUserToPromoteMod(user)
    setShowPromoteModDialog(true)
  }

  function handlePromoteModDialogClose() {
    setShowPromoteModDialog(false)
    setUserToPromoteMod(null)
  }

  async function promoteToModeratorConfirmed() {
    if (!userToPromoteMod) return

    setPromotingModUserId(userToPromoteMod.id)
    setError(null)

    try {
      await promoteUserToModerator(userToPromoteMod.id)
      await refreshUsers()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to promote user to moderator'))
    } finally {
      setPromotingModUserId(null)
      handlePromoteModDialogClose()
    }
  }

  function confirmDemoteModerator(user: AdminUser) {
    setUserToDemoteMod(user)
    setShowDemoteModDialog(true)
  }

  function handleDemoteModDialogClose() {
    setShowDemoteModDialog(false)
    setUserToDemoteMod(null)
  }

  async function demoteModeratorConfirmed() {
    if (!userToDemoteMod) return

    setDemotingModUserId(userToDemoteMod.id)
    setError(null)

    try {
      await demoteUserFromModerator(userToDemoteMod.id)
      await refreshUsers()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to demote moderator'))
    } finally {
      setDemotingModUserId(null)
      handleDemoteModDialogClose()
    }
  }

  function openCreditDialog(user: AdminUser) {
    setUserToEditCredits(user)
    setCreditForm({ hours_to_add: 0 })
    setCreditError(null)
    setShowCreditDialog(true)
  }

  function handleCreditDialogClose() {
    setShowCreditDialog(false)
    setUserToEditCredits(null)
    setCreditForm({ hours_to_add: 0 })
    setCreditError(null)
  }

  async function updateUserCredits(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    if (!userToEditCredits) return
    if (!creditForm.hours_to_add || creditForm.hours_to_add <= 0) {
      setCreditError('Please provide a valid number of minutes.')
      return
    }

    setUpdatingCreditsUserId(userToEditCredits.id)
    setCreditError(null)

    try {
      await addUserCredits(userToEditCredits.id, creditForm.hours_to_add)
      await refreshUsers()
      handleCreditDialogClose()
    } catch (err) {
      setCreditError(getErrorMessage(err, 'Failed to update credits'))
    } finally {
      setUpdatingCreditsUserId(null)
    }
  }

  async function openSubscriptionDialog(user: AdminUser) {
    setUserToEditSubscription(user)
    setSubscriptionForm({
      grant_tier: 'starter',
      grant_days: 30,
      grant_credits: false,
      extend_days: 30,
      extend_credits: false,
      change_tier: 'starter',
      change_credits: false,
    })
    setSubscriptionError(null)
    setSubscriptionHistory([])

    if (user.subscription?.tier_name) {
      await fetchSubscriptionHistory(user.id)
    }

    setShowSubscriptionDialog(true)
  }

  function handleSubscriptionDialogClose() {
    setShowSubscriptionDialog(false)
    setUserToEditSubscription(null)
    setSubscriptionError(null)
    setSubscriptionHistory([])
    setShowCancelSubscriptionDialog(false)
  }

  async function grantSubscription() {
    if (!userToEditSubscription) return

    setUpdatingSubscriptionUserId(userToEditSubscription.id)
    setSubscriptionError(null)

    try {
      await grantUserSubscription(userToEditSubscription.id, {
        tier: subscriptionForm.grant_tier,
        days: subscriptionForm.grant_days,
        grant_credits: subscriptionForm.grant_credits,
      })

      const updatedUsers = await refreshUsers()
      const refreshedUser = updatedUsers.find((user) => user.id === userToEditSubscription.id)
      if (refreshedUser) {
        setUserToEditSubscription(refreshedUser)
        await fetchSubscriptionHistory(refreshedUser.id)
      }
    } catch (err) {
      setSubscriptionError(getErrorMessage(err, 'Failed to grant subscription'))
    } finally {
      setUpdatingSubscriptionUserId(null)
    }
  }

  async function extendSubscription() {
    if (!userToEditSubscription) return

    setUpdatingSubscriptionUserId(userToEditSubscription.id)
    setSubscriptionError(null)

    try {
      await extendUserSubscription(userToEditSubscription.id, {
        days: subscriptionForm.extend_days,
        grant_credits: subscriptionForm.extend_credits,
      })

      const updatedUsers = await refreshUsers()
      const refreshedUser = updatedUsers.find((user) => user.id === userToEditSubscription.id)
      if (refreshedUser) {
        setUserToEditSubscription(refreshedUser)
        await fetchSubscriptionHistory(refreshedUser.id)
      }
    } catch (err) {
      setSubscriptionError(getErrorMessage(err, 'Failed to extend subscription'))
    } finally {
      setUpdatingSubscriptionUserId(null)
    }
  }

  async function changeSubscriptionTier() {
    if (!userToEditSubscription) return

    setUpdatingSubscriptionUserId(userToEditSubscription.id)
    setSubscriptionError(null)

    try {
      await changeUserSubscriptionTier(userToEditSubscription.id, {
        tier: subscriptionForm.change_tier,
        grant_credits: subscriptionForm.change_credits,
      })

      const updatedUsers = await refreshUsers()
      const refreshedUser = updatedUsers.find((user) => user.id === userToEditSubscription.id)
      if (refreshedUser) {
        setUserToEditSubscription(refreshedUser)
        await fetchSubscriptionHistory(refreshedUser.id)
      }
    } catch (err) {
      setSubscriptionError(getErrorMessage(err, 'Failed to change subscription tier'))
    } finally {
      setUpdatingSubscriptionUserId(null)
    }
  }

  function confirmCancelSubscription() {
    setShowCancelSubscriptionDialog(true)
  }

  function handleCancelSubscriptionDialogClose() {
    setShowCancelSubscriptionDialog(false)
  }

  async function cancelSubscriptionConfirmed() {
    if (!userToEditSubscription) return

    setUpdatingSubscriptionUserId(userToEditSubscription.id)
    setSubscriptionError(null)

    try {
      await cancelUserSubscription(userToEditSubscription.id)

      const updatedUsers = await refreshUsers()
      const refreshedUser = updatedUsers.find((user) => user.id === userToEditSubscription.id)
      if (refreshedUser) {
        setUserToEditSubscription(refreshedUser)
        await fetchSubscriptionHistory(refreshedUser.id)
      }

      handleCancelSubscriptionDialogClose()
    } catch (err) {
      setSubscriptionError(getErrorMessage(err, 'Failed to cancel subscription'))
    } finally {
      setUpdatingSubscriptionUserId(null)
    }
  }

  return (
    <PageLayout
      icon={Users}
      title="User Management"
      actions={
        <button className="admin-users__action-btn" disabled={loading} onClick={fetchUsers}>
          {!loading ? (
            <RefreshCw className="admin-users__action-icon" />
          ) : (
            <Loader2 className="admin-users__action-icon admin-users__action-icon--spin" />
          )}
          Refresh Users
        </button>
      }
    >
      <div className="admin-users-page">
        <div className="admin-users">
          <div className="admin-users__heading">
            <h1 className="admin-users__title">User Management</h1>
            <p className="admin-users__subtitle">Manage user accounts, credits, and subscriptions</p>
          </div>

          {loading && !users.length ? (
            <div className="admin-users__loading">
              <Loader2 className="admin-users__loading-icon" />
              <p className="admin-users__loading-text">Loading users...</p>
            </div>
          ) : error ? (
            <div className="admin-users__error">
              <AlertTriangle className="admin-users__error-icon" />
              <p className="admin-users__error-title">Failed to load users</p>
              <p className="admin-users__error-message">{error}</p>
              <button className="admin-users__error-btn" onClick={fetchUsers}>
                Try Again
              </button>
            </div>
          ) : rows.length > 0 ? (
            <>
              <div className="admin-users__stats-header">
                <div className="admin-users__stats-info">
                  <div className="admin-users__stats-icon">
                    <Users className="admin-users__stats-icon-svg" />
                  </div>
                  <div>
                    <h2 className="admin-users__stats-title">User Management</h2>
                    <p className="admin-users__stats-desc">Manage user accounts, credits, and subscriptions</p>
                  </div>
                </div>
                <span className="admin-users__stats-count">
                  {rows.length} user{rows.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="admin-users__table-wrapper">
                <div className="admin-users__table-scroll">
                  <table className="admin-users__table">
                    <thead className="admin-users__thead">
                      <tr>
                        <th className="admin-users__th admin-users__th--sortable" onClick={() => toggleSort('id')}>
                          <div className="admin-users__th-content">
                            <span>ID</span>
                            <span className="admin-users__sort-indicator">
                              {sortColumn === 'id' && sortDirection === 'asc' && <ChevronUp size={14} />}
                              {sortColumn === 'id' && sortDirection === 'desc' && <ChevronDown size={14} />}
                            </span>
                          </div>
                        </th>
                        <th className="admin-users__th admin-users__th--sortable" onClick={() => toggleSort('account')}>
                          <div className="admin-users__th-content">
                            <span>Account</span>
                            <span className="admin-users__sort-indicator">
                              {sortColumn === 'account' && sortDirection === 'asc' && <ChevronUp size={14} />}
                              {sortColumn === 'account' && sortDirection === 'desc' && <ChevronDown size={14} />}
                            </span>
                          </div>
                        </th>
                        <th className="admin-users__th admin-users__th--sortable" onClick={() => toggleSort('role')}>
                          <div className="admin-users__th-content">
                            <span>Role</span>
                            <span className="admin-users__sort-indicator">
                              {sortColumn === 'role' && sortDirection === 'asc' && <ChevronUp size={14} />}
                              {sortColumn === 'role' && sortDirection === 'desc' && <ChevronDown size={14} />}
                            </span>
                          </div>
                        </th>
                        <th className="admin-users__th admin-users__th--sortable" onClick={() => toggleSort('subscription')}>
                          <div className="admin-users__th-content">
                            <span>Subscription</span>
                            <span className="admin-users__sort-indicator">
                              {sortColumn === 'subscription' && sortDirection === 'asc' && <ChevronUp size={14} />}
                              {sortColumn === 'subscription' && sortDirection === 'desc' && <ChevronDown size={14} />}
                            </span>
                          </div>
                        </th>
                        <th className="admin-users__th">Credits</th>
                        <th className="admin-users__th">Created</th>
                        <th className="admin-users__th">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="admin-users__tbody">
                      {rows.map((user) => {
                        const isAffiliate = Boolean(user.is_affiliate)
                        const affiliateStatus = (user.affiliate_status || 'active').toLowerCase()

                        return (
                          <tr
                            key={user.id}
                            className="admin-users__row admin-users__row--clickable"
                            onClick={() => navigateToUserProfile(user.id)}
                          >
                            <td className="admin-users__td">
                              <span className="admin-users__id">#{user.id}</span>
                            </td>

                            <td className="admin-users__td">
                              <div className="admin-users__account">
                                {user.email && (!user.wallet_address || user.provider !== 'wallet') ? (
                                  <>
                                    <span className="admin-users__email">
                                      <span className="admin-users__provider">{getProviderIcon(user.provider)}</span>
                                      {user.email}
                                    </span>
                                    <button
                                      className="admin-users__copy-btn"
                                      title={`Copy ${user.email}`}
                                      onClick={() => copyToClipboard(user.email || '')}
                                    >
                                      <Copy className="admin-users__copy-icon" />
                                    </button>
                                  </>
                                ) : user.wallet_address ? (
                                  <>
                                    <code className="admin-users__wallet">{formatWalletAddress(user.wallet_address)}</code>
                                    <button
                                      className="admin-users__copy-btn"
                                      title={`Copy ${user.wallet_address}`}
                                      onClick={() => copyToClipboard(user.wallet_address || '')}
                                    >
                                      <Copy className="admin-users__copy-icon" />
                                    </button>
                                  </>
                                ) : (
                                  <span className="admin-users__no-account">No account info</span>
                                )}
                              </div>
                            </td>

                            <td className="admin-users__td">
                              <div className="admin-users__role-container">
                                {user.is_admin ? (
                                  <span className="admin-users__role admin-users__role--admin">
                                    <Shield className="admin-users__role-icon" />
                                    Admin
                                  </span>
                                ) : user.is_moderator ? (
                                  <span className="admin-users__role admin-users__role--moderator">
                                    <Shield className="admin-users__role-icon" />
                                    Moderator
                                  </span>
                                ) : (
                                  <span className="admin-users__role admin-users__role--user">
                                    <User className="admin-users__role-icon" />
                                    User
                                  </span>
                                )}

                                {isAffiliate ? (
                                  <span className={`admin-users__affiliate-badge admin-users__affiliate-badge--${affiliateStatus}`}>
                                    <Handshake className="admin-users__affiliate-badge-icon" />
                                    Affiliate
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            <td className="admin-users__td">
                              <button
                                className={`admin-users__subscription ${user.is_admin ? 'admin-users__subscription--disabled' : ''}`}
                                disabled={user.is_admin}
                                onClick={() => {
                                  void openSubscriptionDialog(user)
                                }}
                              >
                                {user.subscription?.tier_name ? (
                                  <span className="admin-users__tier admin-users__tier--active">{user.subscription.tier_name}</span>
                                ) : (
                                  <span className="admin-users__tier admin-users__tier--none">None</span>
                                )}
                                <div className="admin-users__sub-status">
                                  <span className={getSubscriptionStatusClass(user.subscription?.status)}>
                                    {user.subscription?.status || 'None'}
                                  </span>
                                  {(user.subscription?.days_remaining || 0) > 0 ? (
                                    <span className="admin-users__sub-days">({user.subscription?.days_remaining}d)</span>
                                  ) : null}
                                </div>
                              </button>
                            </td>

                            <td className="admin-users__td">
                              <div className="admin-users__credits">
                                <div className="admin-users__credits-row">
                                  <CreditCard className="admin-users__credits-icon" />
                                  <span className="admin-users__credits-value">{formatCredits(user.credits?.hours_remaining || 0)}</span>
                                  <span className="admin-users__credits-unit">min</span>
                                </div>
                                <span className="admin-users__credits-used">{formatCredits(user.credits?.hours_used || 0)} used</span>
                              </div>
                            </td>

                            <td className="admin-users__td">
                              <span className="admin-users__date">{formatDateTime(user.created_at)}</span>
                            </td>

                            <td className="admin-users__td">
                              <div className="admin-users__actions">
                                {user.is_admin ? (
                                  <span className="admin-users__admin-badge">
                                    <Check className="admin-users__admin-badge-icon" />
                                    Admin
                                  </span>
                                ) : (
                                  <div className="admin-users__dropdown" data-user-action-menu>
                                    <button
                                      ref={(element) => setUserActionMenuRef(element, user.id)}
                                      className={`admin-users__dropdown-btn ${
                                        openUserActionMenuId === user.id ? 'admin-users__dropdown-btn--active' : ''
                                      }`}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        toggleUserActionMenu(user.id)
                                      }}
                                    >
                                      <span>Actions</span>
                                      <ChevronDown
                                        className={`admin-users__dropdown-chevron ${
                                          openUserActionMenuId === user.id ? 'admin-users__dropdown-chevron--open' : ''
                                        }`}
                                      />
                                    </button>

                                    {openUserActionMenuId === user.id
                                      ? createPortal(
                                          <div
                                            className="admin-users__dropdown-menu"
                                            style={getUserActionMenuPosition(user.id)}
                                            data-user-action-menu
                                            onClick={(event) => event.stopPropagation()}
                                          >
                                            {!user.is_moderator ? (
                                              <button
                                                className="admin-users__dropdown-item admin-users__dropdown-item--blue"
                                                disabled={promotingModUserId === user.id}
                                                onClick={(event) => {
                                                  event.stopPropagation()
                                                  confirmPromoteToModerator(user)
                                                  closeUserActionMenu()
                                                }}
                                              >
                                                {promotingModUserId === user.id ? (
                                                  <Loader2 className="admin-users__dropdown-item-icon admin-users__dropdown-item-icon--spin" />
                                                ) : (
                                                  <Shield className="admin-users__dropdown-item-icon" />
                                                )}
                                                <span>Promote to Moderator</span>
                                              </button>
                                            ) : null}

                                            {user.is_moderator ? (
                                              <button
                                                className="admin-users__dropdown-item admin-users__dropdown-item--orange"
                                                disabled={demotingModUserId === user.id}
                                                onClick={(event) => {
                                                  event.stopPropagation()
                                                  confirmDemoteModerator(user)
                                                  closeUserActionMenu()
                                                }}
                                              >
                                                {demotingModUserId === user.id ? (
                                                  <Loader2 className="admin-users__dropdown-item-icon admin-users__dropdown-item-icon--spin" />
                                                ) : (
                                                  <Shield className="admin-users__dropdown-item-icon" />
                                                )}
                                                <span>Demote Moderator</span>
                                              </button>
                                            ) : null}

                                            <button
                                              className="admin-users__dropdown-item admin-users__dropdown-item--purple"
                                              disabled={promotingUserId === user.id}
                                              onClick={(event) => {
                                                event.stopPropagation()
                                                confirmPromoteUser(user)
                                                closeUserActionMenu()
                                              }}
                                            >
                                              {promotingUserId === user.id ? (
                                                <Loader2 className="admin-users__dropdown-item-icon admin-users__dropdown-item-icon--spin" />
                                              ) : (
                                                <Shield className="admin-users__dropdown-item-icon" />
                                              )}
                                              <span>Promote to Admin</span>
                                            </button>

                                            <div className="admin-users__dropdown-divider" />

                                            <button
                                              className="admin-users__dropdown-item admin-users__dropdown-item--green"
                                              disabled={updatingCreditsUserId === user.id}
                                              onClick={(event) => {
                                                event.stopPropagation()
                                                openCreditDialog(user)
                                                closeUserActionMenu()
                                              }}
                                            >
                                              {updatingCreditsUserId === user.id ? (
                                                <Loader2 className="admin-users__dropdown-item-icon admin-users__dropdown-item-icon--spin" />
                                              ) : (
                                                <CreditCard className="admin-users__dropdown-item-icon" />
                                              )}
                                              <span>Add Credits</span>
                                            </button>

                                            <button
                                              className="admin-users__dropdown-item admin-users__dropdown-item--blue"
                                              disabled={updatingSubscriptionUserId === user.id}
                                              onClick={(event) => {
                                                event.stopPropagation()
                                                void openSubscriptionDialog(user)
                                                closeUserActionMenu()
                                              }}
                                            >
                                              {updatingSubscriptionUserId === user.id ? (
                                                <Loader2 className="admin-users__dropdown-item-icon admin-users__dropdown-item-icon--spin" />
                                              ) : (
                                                <Layers className="admin-users__dropdown-item-icon" />
                                              )}
                                              <span>Subscription</span>
                                            </button>
                                          </div>,
                                          document.body,
                                        )
                                      : null}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <ConfirmationModal
        show={showPromoteDialog}
        title="Promote User to Admin"
        message="Are you sure you want to promote"
        itemName={userToPromote ? getUserDisplayName(userToPromote) : ''}
        suffix="to admin?"
        confirmText="Promote"
        onClose={handlePromoteDialogClose}
        onConfirm={promoteUserConfirmed}
      />

      <ConfirmationModal
        show={showPromoteModDialog}
        title="Promote User to Moderator"
        message="Are you sure you want to promote"
        itemName={userToPromoteMod ? getUserDisplayName(userToPromoteMod) : ''}
        suffix="to moderator?"
        confirmText="Promote"
        onClose={handlePromoteModDialogClose}
        onConfirm={promoteToModeratorConfirmed}
      />

      <ConfirmationModal
        show={showDemoteModDialog}
        title="Demote Moderator"
        message="Are you sure you want to demote"
        itemName={userToDemoteMod ? getUserDisplayName(userToDemoteMod) : ''}
        suffix="from moderator?"
        confirmText="Demote"
        variant="destructive"
        onClose={handleDemoteModDialogClose}
        onConfirm={demoteModeratorConfirmed}
      />

      {showCreditDialog
        ? createPortal(
            <div className="admin-users__modal-backdrop" onClick={(event) => event.target === event.currentTarget && handleCreditDialogClose()}>
              <div className="admin-users__modal" role="dialog" aria-modal="true">
                <div className="admin-users__modal-accent" />

                <div className="admin-users__modal-header">
                  <button
                    className="admin-users__modal-close"
                    onClick={handleCreditDialogClose}
                    disabled={updatingCreditsUserId !== null}
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                  <div className="admin-users__modal-icon">
                    <CreditCard size={24} />
                  </div>
                  <h2 className="admin-users__modal-title">Add Credits</h2>
                  <p className="admin-users__modal-subtitle">{userToEditCredits ? getUserDisplayName(userToEditCredits) : ''}</p>
                </div>

                <div className="admin-users__modal-content">
                  <form className="admin-users__modal-form" onSubmit={updateUserCredits}>
                    {userToEditCredits?.credits ? (
                      <div className="admin-users__modal-balance">
                        <p className="admin-users__modal-balance-label">Current Balance</p>
                        <div className="admin-users__modal-balance-row">
                          <div>
                            <span className="admin-users__modal-balance-text">Remaining:</span>
                            <span className="admin-users__modal-balance-value">
                              {formatCredits(userToEditCredits.credits.hours_remaining)} min
                            </span>
                          </div>
                          <div>
                            <span className="admin-users__modal-balance-text">Used:</span>
                            <span className="admin-users__modal-balance-value admin-users__modal-balance-value--muted">
                              {formatCredits(userToEditCredits.credits.hours_used)} min
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="admin-users__modal-field">
                      <label htmlFor="hours_to_add" className="admin-users__modal-label">
                        Minutes to Add
                      </label>
                      <input
                        id="hours_to_add"
                        value={creditForm.hours_to_add}
                        onChange={(event) => setCreditForm({ hours_to_add: Number(event.target.value) || 0 })}
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        className="admin-users__modal-input"
                        placeholder="Enter minutes to add"
                      />
                    </div>

                    {creditForm.hours_to_add > 0 && userToEditCredits?.credits ? (
                      <div className="admin-users__modal-preview">
                        <span className="admin-users__modal-preview-label">New balance:</span>
                        <span className="admin-users__modal-preview-value">
                          {formatCredits(
                            (userToEditCredits.credits.hours_remaining === 'unlimited'
                              ? 0
                              : Number(userToEditCredits.credits.hours_remaining)) + creditForm.hours_to_add,
                          )}{' '}
                          min
                        </span>
                      </div>
                    ) : null}

                    {creditError ? (
                      <div className="admin-users__modal-alert admin-users__modal-alert--error">
                        <AlertCircle size={16} />
                        <p className="admin-users__modal-alert-text">{creditError}</p>
                      </div>
                    ) : null}
                  </form>
                </div>

                <div className="admin-users__modal-footer">
                  <button
                    type="button"
                    className="admin-users__modal-btn admin-users__modal-btn--secondary"
                    disabled={updatingCreditsUserId !== null}
                    onClick={handleCreditDialogClose}
                  >
                    Cancel
                  </button>
                  <button
                    className="admin-users__modal-btn admin-users__modal-btn--primary"
                    disabled={updatingCreditsUserId !== null || !creditForm.hours_to_add}
                    onClick={() => void updateUserCredits()}
                  >
                    {updatingCreditsUserId !== null ? <Loader2 size={16} className="admin-users__modal-spinner" /> : null}
                    {updatingCreditsUserId !== null ? 'Adding...' : 'Add Credits'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {showSubscriptionDialog
        ? createPortal(
            <div className="admin-users__modal-backdrop" onClick={(event) => event.target === event.currentTarget && handleSubscriptionDialogClose()}>
              <div className="admin-users__modal admin-users__modal--wide" role="dialog" aria-modal="true">
                <div className="admin-users__modal-accent" />

                <div className="admin-users__subscription-header">
                  <div className="admin-users__subscription-header-info">
                    <div className="admin-users__subscription-header-icon">
                      <Layers size={20} />
                    </div>
                    <div>
                      <h2 className="admin-users__subscription-header-title">Subscription Management</h2>
                      <p className="admin-users__subscription-header-subtitle">
                        {userToEditSubscription ? getUserDisplayName(userToEditSubscription) : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    className="admin-users__subscription-close"
                    disabled={updatingSubscriptionUserId !== null}
                    onClick={handleSubscriptionDialogClose}
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="admin-users__subscription-content">
                  {userToEditSubscription?.subscription ? (
                    <div className="admin-users__subscription-current">
                      <h3 className="admin-users__subscription-section-title">Current Subscription</h3>
                      <div className="admin-users__subscription-grid">
                        <div>
                          <p className="admin-users__subscription-label">Tier</p>
                          <p className="admin-users__subscription-value">{userToEditSubscription.subscription.tier_name || 'None'}</p>
                        </div>
                        <div>
                          <p className="admin-users__subscription-label">Status</p>
                          <span
                            className={`admin-users__subscription-status-badge ${getSubscriptionStatusBadgeClass(
                              userToEditSubscription.subscription.status,
                            )}`}
                          >
                            {userToEditSubscription.subscription.status || 'none'}
                          </span>
                        </div>
                        {(userToEditSubscription.subscription as { end_date?: string | null }).end_date ? (
                          <div>
                            <p className="admin-users__subscription-label">Ends</p>
                            <p className="admin-users__subscription-value">
                              {formatDateTime((userToEditSubscription.subscription as { end_date?: string | null }).end_date)}
                            </p>
                          </div>
                        ) : null}
                        <div>
                          <p className="admin-users__subscription-label">Days Remaining</p>
                          <p className="admin-users__subscription-value">{userToEditSubscription.subscription.days_remaining || 0}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {!userToEditSubscription?.subscription?.tier_name ? (
                    <div className="admin-users__subscription-section">
                      <h3 className="admin-users__subscription-section-title">Grant Subscription</h3>
                      <div className="admin-users__subscription-form-grid">
                        <div>
                          <label className="admin-users__subscription-form-label">Tier</label>
                          <select
                            value={subscriptionForm.grant_tier}
                            onChange={(event) =>
                              setSubscriptionForm((current) => ({ ...current, grant_tier: normalizeTier(event.target.value) }))
                            }
                            className="admin-users__subscription-input"
                          >
                            {tierOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="admin-users__subscription-form-label">Duration (days)</label>
                          <input
                            value={subscriptionForm.grant_days}
                            onChange={(event) =>
                              setSubscriptionForm((current) => ({ ...current, grant_days: Number(event.target.value) || 0 }))
                            }
                            type="number"
                            min="1"
                            className="admin-users__subscription-input"
                            placeholder="30"
                          />
                        </div>

                        <div className="admin-users__subscription-form-actions">
                          <label className="admin-users__subscription-checkbox">
                            <input
                              checked={subscriptionForm.grant_credits}
                              onChange={(event) =>
                                setSubscriptionForm((current) => ({ ...current, grant_credits: event.target.checked }))
                              }
                              type="checkbox"
                            />
                            Grant Credits
                          </label>
                          <button
                            className="admin-users__subscription-btn admin-users__subscription-btn--teal"
                            disabled={updatingSubscriptionUserId !== null}
                            onClick={() => void grantSubscription()}
                          >
                            {updatingSubscriptionUserId !== null ? <Loader2 size={16} className="admin-users__subscription-spinner" /> : null}
                            Grant
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {userToEditSubscription?.subscription?.tier_name ? (
                    <div className="admin-users__subscription-section">
                      <h3 className="admin-users__subscription-section-title">Extend Subscription</h3>
                      <div className="admin-users__subscription-form-grid admin-users__subscription-form-grid--half">
                        <div>
                          <label className="admin-users__subscription-form-label">Additional Days</label>
                          <input
                            value={subscriptionForm.extend_days}
                            onChange={(event) =>
                              setSubscriptionForm((current) => ({ ...current, extend_days: Number(event.target.value) || 0 }))
                            }
                            type="number"
                            min="1"
                            className="admin-users__subscription-input"
                            placeholder="30"
                          />
                        </div>
                        <div className="admin-users__subscription-form-actions">
                          <label className="admin-users__subscription-checkbox">
                            <input
                              checked={subscriptionForm.extend_credits}
                              onChange={(event) =>
                                setSubscriptionForm((current) => ({ ...current, extend_credits: event.target.checked }))
                              }
                              type="checkbox"
                            />
                            Grant Credits
                          </label>
                          <button
                            className="admin-users__subscription-btn admin-users__subscription-btn--teal"
                            disabled={updatingSubscriptionUserId !== null}
                            onClick={() => void extendSubscription()}
                          >
                            {updatingSubscriptionUserId !== null ? <Loader2 size={16} className="admin-users__subscription-spinner" /> : null}
                            Extend
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {userToEditSubscription?.subscription?.tier_name ? (
                    <div className="admin-users__subscription-section">
                      <h3 className="admin-users__subscription-section-title">Change Tier</h3>
                      <div className="admin-users__subscription-form-grid admin-users__subscription-form-grid--half">
                        <div>
                          <label className="admin-users__subscription-form-label">New Tier</label>
                          <select
                            value={subscriptionForm.change_tier}
                            onChange={(event) =>
                              setSubscriptionForm((current) => ({ ...current, change_tier: normalizeTier(event.target.value) }))
                            }
                            className="admin-users__subscription-input"
                          >
                            {tierOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="admin-users__subscription-form-actions">
                          <label className="admin-users__subscription-checkbox">
                            <input
                              checked={subscriptionForm.change_credits}
                              onChange={(event) =>
                                setSubscriptionForm((current) => ({ ...current, change_credits: event.target.checked }))
                              }
                              type="checkbox"
                            />
                            Grant Credits
                          </label>
                          <button
                            className="admin-users__subscription-btn admin-users__subscription-btn--teal"
                            disabled={updatingSubscriptionUserId !== null}
                            onClick={() => void changeSubscriptionTier()}
                          >
                            {updatingSubscriptionUserId !== null ? <Loader2 size={16} className="admin-users__subscription-spinner" /> : null}
                            Change
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {userToEditSubscription?.subscription?.tier_name ? (
                    <div className="admin-users__subscription-section admin-users__subscription-section--danger">
                      <h3 className="admin-users__subscription-section-title admin-users__subscription-section-title--danger">
                        Cancel Subscription
                      </h3>
                      <p className="admin-users__subscription-section-desc">
                        Cancellation will stop future renewals. The user will retain access until the current end date.
                      </p>
                      <button
                        className="admin-users__subscription-btn admin-users__subscription-btn--red"
                        disabled={updatingSubscriptionUserId !== null}
                        onClick={confirmCancelSubscription}
                      >
                        Cancel Subscription
                      </button>
                    </div>
                  ) : null}

                  {subscriptionHistory.length > 0 ? (
                    <div className="admin-users__subscription-section">
                      <h3 className="admin-users__subscription-section-title">Subscription History</h3>
                      <div className="admin-users__subscription-history-wrapper">
                        <table className="admin-users__subscription-history">
                          <thead>
                            <tr>
                              <th>Tier</th>
                              <th>Status</th>
                              <th>Start</th>
                              <th>End</th>
                              <th>Credits</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subscriptionHistory.map((subscription) => (
                              <tr key={subscription.id}>
                                <td className="admin-users__subscription-history-tier">{subscription.tier || 'none'}</td>
                                <td>
                                  <span
                                    className={`admin-users__subscription-status-badge ${getSubscriptionStatusBadgeClass(
                                      subscription.status,
                                    )}`}
                                  >
                                    {subscription.status}
                                  </span>
                                </td>
                                <td className="admin-users__subscription-history-date">{formatDateTime(subscription.start_date)}</td>
                                <td className="admin-users__subscription-history-date">{formatDateTime(subscription.end_date)}</td>
                                <td>{subscription.credits_granted || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {subscriptionError ? (
                    <div className="admin-users__modal-alert admin-users__modal-alert--error">
                      <AlertCircle size={16} />
                      <p className="admin-users__modal-alert-text">{subscriptionError}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <ConfirmationModal
        show={showCancelSubscriptionDialog}
        title="Cancel Subscription"
        message="Are you sure you want to cancel subscription for"
        itemName={userToEditSubscription ? getUserDisplayName(userToEditSubscription) : ''}
        suffix="?"
        confirmText="Cancel Subscription"
        variant="destructive"
        onClose={handleCancelSubscriptionDialogClose}
        onConfirm={cancelSubscriptionConfirmed}
      />
    </PageLayout>
  )
}
