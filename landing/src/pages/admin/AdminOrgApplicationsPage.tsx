import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Building2, Check, ChevronDown, Eye, FileText, Loader2, Trash2, X } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { listOrgApplications, approveOrgApplication, rejectOrgApplication, type OrgApplication } from '@/services/adminApi'
import { formatDateTime as formatDate } from './adminFormat'
import './AdminOrgApplicationsPage.css'

interface ConfirmationModalProps {
  show: boolean
  title: string
  message: string
  itemName?: string
  suffix?: string
  confirmText?: string
  onClose: () => void
  onConfirm: () => void
}

function ConfirmationModal({
  show,
  title,
  message,
  itemName,
  suffix = '?',
  confirmText = 'Delete',
  onClose,
  onConfirm,
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!show) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [show, onClose])

  if (!show) return null

  return createPortal(
    <div className="admin-apps-confirm__overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="admin-apps-confirm" role="dialog" aria-modal="true">
        <div className="admin-apps-confirm__accent" />
        <div className="admin-apps-confirm__header">
          <button className="admin-apps-confirm__close" onClick={onClose}>
            <X size={18} />
          </button>
          <div className="admin-apps-confirm__icon">
            <AlertCircle size={24} />
          </div>
          <h2 className="admin-apps-confirm__title">{title}</h2>
        </div>
        <div className="admin-apps-confirm__content">
          <p className="admin-apps-confirm__message">
            {message} {itemName ? <span className="admin-apps-confirm__item">"{itemName}"</span> : null}
            {suffix}
          </p>
          <p className="admin-apps-confirm__warning">This action cannot be undone.</p>
        </div>
        <div className="admin-apps-confirm__footer">
          <button className="admin-apps-confirm__btn admin-apps-confirm__btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="admin-apps-confirm__btn admin-apps-confirm__btn--danger" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function formatWalletAddress(address: string | null) {
  if (!address) return 'N/A'
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function getStatusClass(status: OrgApplication['status']) {
  switch (status) {
    case 'pending':
      return 'admin-apps__status--pending'
    case 'approved':
      return 'admin-apps__status--approved'
    case 'rejected':
      return 'admin-apps__status--rejected'
    default:
      return ''
  }
}

const statusOptions: Array<{ label: string; value: '' | OrgApplication['status'] }> = [
  { label: 'All Status', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
]

export function AdminOrgApplicationsPage() {
  const [applications, setApplications] = useState<OrgApplication[]>([])
  const [statusFilter, setStatusFilter] = useState<'' | OrgApplication['status']>('')
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const statusFilterMenuRef = useRef<HTMLDivElement | null>(null)

  const [deletingAppId, setDeletingAppId] = useState<number | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [appToDelete, setAppToDelete] = useState<OrgApplication | null>(null)

  const [selectedApp, setSelectedApp] = useState<OrgApplication | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const selectedStatusLabel = useMemo(() => {
    const currentOption = statusOptions.find((option) => option.value === statusFilter)
    return currentOption?.label || 'All Status'
  }, [statusFilter])

  useEffect(() => {
    if (!showStatusMenu) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (statusFilterMenuRef.current && !statusFilterMenuRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowStatusMenu(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showStatusMenu])

  const fetchApplications = useCallback(async () => {
    try {
      const data = await listOrgApplications(statusFilter || undefined)
      setApplications(data)
    } catch (error) {
      console.error('Failed to fetch applications:', error)
    }
  }, [statusFilter])

  useEffect(() => {
    void fetchApplications()
  }, [fetchApplications])

  const viewApplication = (app: OrgApplication) => {
    setSelectedApp(app)
    setAdminNotes('')
    setActionError(null)
  }

  const approveApplication = async () => {
    if (!selectedApp || processing) return

    setProcessing(true)
    setActionType('approve')
    setActionError(null)

    try {
      await approveOrgApplication(selectedApp.id, adminNotes.trim() || null)
      await fetchApplications()
      setSelectedApp(null)
      setAdminNotes('')
    } catch (error: any) {
      console.error('Failed to approve application:', error)
      setActionError(error?.response?.data?.error || error?.message || 'An error occurred while approving the application')
    } finally {
      setProcessing(false)
      setActionType(null)
    }
  }

  const rejectApplication = async () => {
    if (!selectedApp || processing) return

    setProcessing(true)
    setActionType('reject')
    setActionError(null)

    try {
      await rejectOrgApplication(selectedApp.id, adminNotes.trim() || null)
      await fetchApplications()
      setSelectedApp(null)
      setAdminNotes('')
    } catch (error: any) {
      console.error('Failed to reject application:', error)
      setActionError(error?.response?.data?.error || error?.message || 'An error occurred while rejecting the application')
    } finally {
      setProcessing(false)
      setActionType(null)
    }
  }

  const confirmDeleteApplication = (app: OrgApplication) => {
    setAppToDelete(app)
    setShowDeleteDialog(true)
  }

  const handleDeleteDialogClose = () => {
    setShowDeleteDialog(false)
    setAppToDelete(null)
  }

  const deleteApplicationConfirmed = async () => {
    if (!appToDelete) return

    setDeletingAppId(appToDelete.id)

    try {
      await deleteOrgApplication(appToDelete.id)
      await fetchApplications()
    } catch (error) {
      console.error('Failed to delete application:', error)
    } finally {
      setDeletingAppId(null)
      setShowDeleteDialog(false)
      setAppToDelete(null)
    }
  }

  return (
    <PageLayout
      icon={FileText}
      title="Organization Applications"
      actions={
        <div className="admin-apps__filter-dropdown" ref={statusFilterMenuRef}>
          <button
            type="button"
            className={`admin-apps__dropdown-trigger ${showStatusMenu ? 'admin-apps__dropdown-trigger--active' : ''}`}
            aria-haspopup="menu"
            aria-expanded={showStatusMenu}
            onClick={() => setShowStatusMenu((previous) => !previous)}
          >
            <span>{selectedStatusLabel}</span>
            <ChevronDown
              className={`admin-apps__dropdown-chevron ${showStatusMenu ? 'admin-apps__dropdown-chevron--open' : ''}`}
            />
          </button>

          {showStatusMenu ? (
            <div className="admin-apps__dropdown-menu" role="menu" aria-label="Filter applications by status">
              {statusOptions.map((option) => (
                <button
                  key={option.value || 'all'}
                  type="button"
                  role="menuitemradio"
                  aria-checked={statusFilter === option.value}
                  className={`admin-apps__dropdown-item ${statusFilter === option.value ? 'admin-apps__dropdown-item--active' : ''}`}
                  onClick={() => {
                    setStatusFilter(option.value)
                    setShowStatusMenu(false)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      }
    >
      <div className="admin-apps-page">
        <div className="admin-apps">
          <div className="admin-apps__heading">
            <h1 className="admin-apps__title">Organization Applications</h1>
            <p className="admin-apps__subtitle">Review and approve organization account requests</p>
          </div>

          {applications.length > 0 ? (
            <div className="admin-apps__table-wrapper">
              <div className="admin-apps__table-scroll">
                <table className="admin-apps__table">
                  <thead className="admin-apps__thead">
                    <tr>
                      <th className="admin-apps__th">ID</th>
                      <th className="admin-apps__th">Organization Name</th>
                      <th className="admin-apps__th">User</th>
                      <th className="admin-apps__th">Team Size</th>
                      <th className="admin-apps__th">Status</th>
                      <th className="admin-apps__th">Submitted</th>
                      <th className="admin-apps__th">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="admin-apps__tbody">
                    {applications.map((app) => (
                      <tr key={app.id} className="admin-apps__row">
                        <td className="admin-apps__td">
                          <span className="admin-apps__id">#{app.id}</span>
                        </td>
                        <td className="admin-apps__td">
                          <div className="admin-apps__org-cell">
                            <p className="admin-apps__org-name">{app.name}</p>
                            <p className="admin-apps__org-desc">{app.description}</p>
                          </div>
                        </td>
                        <td className="admin-apps__td">
                          <div className="admin-apps__user-cell">
                            <p className="admin-apps__user-email">{app.user?.email || 'N/A'}</p>
                            {app.contact_email !== app.user?.email ? (
                              <p className="admin-apps__user-contact">{app.contact_email}</p>
                            ) : null}
                          </div>
                        </td>
                        <td className="admin-apps__td">
                          <span className="admin-apps__team-size">{app.team_size}</span>
                        </td>
                        <td className="admin-apps__td">
                          <span className={`admin-apps__status ${getStatusClass(app.status)}`}>{app.status.toUpperCase()}</span>
                        </td>
                        <td className="admin-apps__td">
                          <span className="admin-apps__date">{formatDate(app.inserted_at)}</span>
                        </td>
                        <td className="admin-apps__td">
                          <div className="admin-apps__actions">
                            {app.status === 'pending' ? (
                              <button className="admin-apps__btn admin-apps__btn--view" onClick={() => viewApplication(app)}>
                                <Eye className="admin-apps__btn-icon" />
                                View
                              </button>
                            ) : null}
                            <button
                              className="admin-apps__btn admin-apps__btn--delete"
                              disabled={deletingAppId === app.id}
                              onClick={() => confirmDeleteApplication(app)}
                            >
                              {deletingAppId === app.id ? (
                                <Loader2 className="admin-apps__btn-icon admin-apps__btn-icon--spin" />
                              ) : (
                                <Trash2 className="admin-apps__btn-icon" />
                              )}
                              Delete
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
            <div className="admin-apps__empty">
              <div className="admin-apps__empty-icon">
                <FileText className="admin-apps__empty-icon-svg" />
              </div>
              <p className="admin-apps__empty-text">No applications found</p>
            </div>
          )}
        </div>
      </div>

      {selectedApp
        ? createPortal(
            <div className="admin-apps__modal-overlay" onClick={(event) => event.target === event.currentTarget && setSelectedApp(null)}>
              <div className="admin-apps__modal" role="dialog" aria-modal="true">
                <div className="admin-apps__modal-accent" />

                <div className="admin-apps__modal-header">
                  <button
                    className="admin-apps__modal-close"
                    onClick={() => setSelectedApp(null)}
                    disabled={processing}
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="admin-apps__modal-content">
                  <div className="admin-apps__modal-header-card">
                    {selectedApp.logo_url ? (
                      <div className="admin-apps__modal-logo">
                        <img src={selectedApp.logo_url} alt={selectedApp.name} className="admin-apps__modal-logo-img" />
                      </div>
                    ) : (
                      <div className="admin-apps__modal-logo admin-apps__modal-logo--fallback">
                        <Building2 size={32} />
                      </div>
                    )}
                    <div className="admin-apps__modal-header-info">
                      <h2 className="admin-apps__modal-title">{selectedApp.name}</h2>
                      <span
                        className={[
                          'admin-apps__modal-status',
                          selectedApp.status === 'pending'
                            ? 'admin-apps__modal-status--pending'
                            : selectedApp.status === 'approved'
                              ? 'admin-apps__modal-status--approved'
                              : 'admin-apps__modal-status--rejected',
                        ].join(' ')}
                      >
                        {selectedApp.status}
                      </span>
                    </div>
                  </div>

                  <div className="admin-apps__modal-section">
                    <h3 className="admin-apps__modal-section-title">Organization Details</h3>
                    <div className="admin-apps__modal-grid">
                      <div className="admin-apps__modal-grid-item">
                        <span className="admin-apps__modal-label">Description</span>
                        <p className="admin-apps__modal-value">{selectedApp.description}</p>
                      </div>
                      {selectedApp.website ? (
                        <div className="admin-apps__modal-grid-item">
                          <span className="admin-apps__modal-label">Website</span>
                          <a href={selectedApp.website} target="_blank" rel="noreferrer" className="admin-apps__modal-link">
                            {selectedApp.website}
                          </a>
                        </div>
                      ) : null}
                      <div className="admin-apps__modal-grid-item">
                        <span className="admin-apps__modal-label">Team Size</span>
                        <span className="admin-apps__modal-value">{selectedApp.team_size} members</span>
                      </div>
                    </div>
                  </div>

                  <div className="admin-apps__modal-section">
                    <h3 className="admin-apps__modal-section-title">Use Case</h3>
                    <div className="admin-apps__modal-use-case">
                      <p className="admin-apps__modal-text">{selectedApp.use_case}</p>
                    </div>
                  </div>

                  <div className="admin-apps__modal-section">
                    <h3 className="admin-apps__modal-section-title">Applicant Information</h3>
                    <div className="admin-apps__modal-grid">
                      <div className="admin-apps__modal-grid-item">
                        <span className="admin-apps__modal-label">User Email</span>
                        <span className="admin-apps__modal-value">{selectedApp.user?.email || 'N/A'}</span>
                      </div>
                      <div className="admin-apps__modal-grid-item">
                        <span className="admin-apps__modal-label">Contact Email</span>
                        <span className="admin-apps__modal-value">{selectedApp.contact_email}</span>
                      </div>
                      {selectedApp.user?.wallet_address ? (
                        <div className="admin-apps__modal-grid-item">
                          <span className="admin-apps__modal-label">Wallet Address</span>
                          <code className="admin-apps__modal-code">{formatWalletAddress(selectedApp.user.wallet_address)}</code>
                        </div>
                      ) : null}
                      <div className="admin-apps__modal-grid-item">
                        <span className="admin-apps__modal-label">Submitted</span>
                        <span className="admin-apps__modal-value">{formatDate(selectedApp.inserted_at)}</span>
                      </div>
                    </div>
                  </div>

                  {selectedApp.status === 'pending' ? (
                    <div className="admin-apps__modal-section">
                      <h3 className="admin-apps__modal-section-title">Admin Notes (Optional)</h3>
                      <textarea
                        value={adminNotes}
                        onChange={(event) => setAdminNotes(event.target.value)}
                        rows={3}
                        placeholder="Add notes about this decision (visible to the applicant)..."
                        className="admin-apps__modal-textarea"
                      />
                    </div>
                  ) : null}

                  {selectedApp.admin_notes ? (
                    <div className="admin-apps__modal-section">
                      <h3 className="admin-apps__modal-section-title">Review Notes</h3>
                      <div className="admin-apps__modal-review-box">
                        <p className="admin-apps__modal-text">{selectedApp.admin_notes}</p>
                        {selectedApp.reviewed_by ? (
                          <div className="admin-apps__modal-meta">
                            Reviewed by {selectedApp.reviewed_by.email} on {formatDate(selectedApp.reviewed_at)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {actionError ? (
                    <div className="admin-apps__modal-alert admin-apps__modal-alert--error">
                      <AlertCircle size={16} />
                      <p className="admin-apps__modal-alert-text">{actionError}</p>
                    </div>
                  ) : null}
                </div>

                {selectedApp.status === 'pending' ? (
                  <div className="admin-apps__modal-footer">
                    <button onClick={rejectApplication} disabled={processing} className="admin-apps__modal-btn admin-apps__modal-btn--secondary">
                      {processing && actionType === 'reject' ? <Loader2 size={16} className="admin-apps__spinner" /> : <X size={16} />}
                      Reject
                    </button>
                    <button onClick={approveApplication} disabled={processing} className="admin-apps__modal-btn admin-apps__modal-btn--primary">
                      {processing && actionType === 'approve' ? (
                        <Loader2 size={16} className="admin-apps__spinner" />
                      ) : (
                        <Check size={16} />
                      )}
                      Approve &amp; Create Organization
                    </button>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}

      <ConfirmationModal
        show={showDeleteDialog}
        title="Delete Application"
        message="Are you sure you want to delete the application for"
        itemName={appToDelete?.name || ''}
        suffix="?"
        confirmText="Delete"
        onClose={handleDeleteDialogClose}
        onConfirm={deleteApplicationConfirmed}
      />
    </PageLayout>
  )
}
