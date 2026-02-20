import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, FileText, Loader2, RefreshCw, Trash2, X } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { deleteBugReport, listBugReports, updateBugReportStatus, type BugReport } from '@/services/adminApi'
import './AdminBugReportsPage.css'

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

const statusOptions: Array<{ label: string; value: '' | BugReport['status'] }> = [
  { label: 'All Status', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
]

const severityOptions: Array<{ label: string; value: '' | BugReport['severity'] }> = [
  { label: 'All Severity', value: '' },
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' },
]

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
    <div className="admin-bugs-confirm__overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="admin-bugs-confirm" role="dialog" aria-modal="true">
        <div
          className={`admin-bugs-confirm__accent ${variant === 'destructive' ? 'admin-bugs-confirm__accent--destructive' : ''}`}
        />

        <div className="admin-bugs-confirm__header">
          <button className="admin-bugs-confirm__close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
          <div className={`admin-bugs-confirm__icon ${variant === 'destructive' ? 'admin-bugs-confirm__icon--destructive' : ''}`}>
            <AlertTriangle size={24} />
          </div>
          <h2 className="admin-bugs-confirm__title">{title}</h2>
        </div>

        <div className="admin-bugs-confirm__content">
          <p className="admin-bugs-confirm__message">
            {message} {itemName ? <span className="admin-bugs-confirm__item-name">&quot;{itemName}&quot;</span> : null} {suffix}
          </p>
          <p className="admin-bugs-confirm__warning">This action cannot be undone.</p>
        </div>

        <div className="admin-bugs-confirm__footer">
          <button className="admin-bugs-confirm__btn admin-bugs-confirm__btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`admin-bugs-confirm__btn admin-bugs-confirm__btn--primary ${variant === 'destructive' ? 'admin-bugs-confirm__btn--destructive' : ''}`}
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

function formatWalletAddress(address: string) {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatDate(value: string) {
  if (!value) return 'N/A'

  try {
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Invalid date'
  }
}

function getSeverityClass(severity: string) {
  switch (severity) {
    case 'low':
      return 'admin-bugs__severity--low'
    case 'medium':
      return 'admin-bugs__severity--medium'
    case 'high':
      return 'admin-bugs__severity--high'
    case 'critical':
      return 'admin-bugs__severity--critical'
    default:
      return ''
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case 'open':
      return 'admin-bugs__status--open'
    case 'in_progress':
      return 'admin-bugs__status--in-progress'
    case 'resolved':
      return 'admin-bugs__status--resolved'
    case 'closed':
      return 'admin-bugs__status--closed'
    default:
      return ''
  }
}

export function AdminBugReportsPage() {
  const [bugReports, setBugReports] = useState<BugReport[]>([])
  const [bugReportFilters, setBugReportFilters] = useState<{
    status: '' | BugReport['status']
    severity: '' | BugReport['severity']
  }>({ status: '', severity: '' })
  const [updatingBugReportId, setUpdatingBugReportId] = useState<number | null>(null)
  const [deletingBugReportId, setDeletingBugReportId] = useState<number | null>(null)
  const [showDeleteBugReportDialog, setShowDeleteBugReportDialog] = useState(false)
  const [bugReportToDelete, setBugReportToDelete] = useState<BugReport | null>(null)

  const fetchBugReports = useCallback(async () => {
    try {
      const data = await listBugReports({
        status: bugReportFilters.status || undefined,
        severity: bugReportFilters.severity || undefined,
      })
      setBugReports(data)
    } catch (error) {
      console.error('Error fetching bug reports:', error)
    }
  }, [bugReportFilters.severity, bugReportFilters.status])

  useEffect(() => {
    void fetchBugReports()
  }, [fetchBugReports])

  const countLabel = useMemo(
    () => `${bugReports.length} report${bugReports.length !== 1 ? 's' : ''}`,
    [bugReports.length],
  )

  const updateBugReport = async (bugReportId: number, status: BugReport['status']) => {
    setUpdatingBugReportId(bugReportId)

    try {
      const data = await updateBugReportStatus(bugReportId, status)

      if (data.bug_report) {
        setBugReports((prev) =>
          prev.map((bugReport) =>
            bugReport.id === bugReportId
              ? {
                  ...bugReport,
                  status: data.bug_report?.status || status,
                  updated_at: data.bug_report?.updated_at || bugReport.updated_at,
                }
              : bugReport,
          ),
        )
        return
      }

      setBugReports((prev) =>
        prev.map((bugReport) =>
          bugReport.id === bugReportId
            ? {
                ...bugReport,
                status,
              }
            : bugReport,
        ),
      )
    } catch (error) {
      console.error('Error updating bug report:', error)
    } finally {
      setUpdatingBugReportId(null)
    }
  }

  const confirmDeleteBugReport = (bugReport: BugReport) => {
    setBugReportToDelete(bugReport)
    setShowDeleteBugReportDialog(true)
  }

  const handleDeleteBugReportDialogClose = () => {
    setShowDeleteBugReportDialog(false)
    setBugReportToDelete(null)
  }

  const deleteBugReportConfirmed = async () => {
    if (!bugReportToDelete) return

    setDeletingBugReportId(bugReportToDelete.id)

    try {
      await deleteBugReport(bugReportToDelete.id)
      setBugReports((prev) => prev.filter((bugReport) => bugReport.id !== bugReportToDelete.id))
    } catch (error) {
      console.error('Error deleting bug report:', error)
    } finally {
      setDeletingBugReportId(null)
      setShowDeleteBugReportDialog(false)
      setBugReportToDelete(null)
    }
  }

  return (
    <PageLayout
      title="Bug Reports"
      icon={FileText}
      actions={
        <button className="admin-bugs__action-btn" onClick={() => void fetchBugReports()}>
          <RefreshCw className="admin-bugs__action-icon" />
          Refresh Bugs
        </button>
      }
    >
      <div className="admin-bugs-page">
        <div className="admin-bugs">
          <div className="admin-bugs__heading">
            <h1 className="admin-bugs__title">Bug Reports</h1>
            <p className="admin-bugs__subtitle">Track and manage reported issues</p>
          </div>

          <div className="admin-bugs__stats-header">
            <div className="admin-bugs__stats-info">
              <div className="admin-bugs__stats-icon">
                <FileText className="admin-bugs__stats-icon-svg" />
              </div>
              <div>
                <h2 className="admin-bugs__stats-title">Bug Reports</h2>
                <p className="admin-bugs__stats-desc">Track and manage reported issues</p>
              </div>
            </div>

            <div className="admin-bugs__filters">
              <select
                value={bugReportFilters.status}
                onChange={(event) =>
                  setBugReportFilters((prev) => ({
                    ...prev,
                    status: event.target.value as '' | BugReport['status'],
                  }))
                }
                className="admin-bugs__dropdown-trigger"
                aria-label="Filter by status"
              >
                {statusOptions.map((option) => (
                  <option key={option.value || 'all-status'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={bugReportFilters.severity}
                onChange={(event) =>
                  setBugReportFilters((prev) => ({
                    ...prev,
                    severity: event.target.value as '' | BugReport['severity'],
                  }))
                }
                className="admin-bugs__dropdown-trigger"
                aria-label="Filter by severity"
              >
                {severityOptions.map((option) => (
                  <option key={option.value || 'all-severity'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <span className="admin-bugs__stats-count">{countLabel}</span>
            </div>
          </div>

          {bugReports.length > 0 ? (
            <div className="admin-bugs__table-wrapper">
              <div className="admin-bugs__table-scroll">
                <table className="admin-bugs__table">
                  <thead className="admin-bugs__thead">
                    <tr>
                      <th className="admin-bugs__th">ID</th>
                      <th className="admin-bugs__th">Title</th>
                      <th className="admin-bugs__th">Severity</th>
                      <th className="admin-bugs__th">Status</th>
                      <th className="admin-bugs__th">User</th>
                      <th className="admin-bugs__th">Created</th>
                      <th className="admin-bugs__th">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="admin-bugs__tbody">
                    {bugReports.map((bugReport) => (
                      <tr key={bugReport.id} className="admin-bugs__row">
                        <td className="admin-bugs__td">
                          <span className="admin-bugs__id">#{bugReport.id}</span>
                        </td>
                        <td className="admin-bugs__td">
                          <div className="admin-bugs__title-cell">
                            <p className="admin-bugs__report-title">{bugReport.title}</p>
                            <p className="admin-bugs__report-desc">{bugReport.description}</p>
                          </div>
                        </td>
                        <td className="admin-bugs__td">
                          <span className={`admin-bugs__severity ${getSeverityClass(bugReport.severity)}`}>
                            {bugReport.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="admin-bugs__td">
                          <span className={`admin-bugs__status ${getStatusClass(bugReport.status)}`}>
                            {bugReport.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="admin-bugs__td">
                          <code className="admin-bugs__wallet">{formatWalletAddress(bugReport.user_wallet_address)}</code>
                        </td>
                        <td className="admin-bugs__td">
                          <span className="admin-bugs__date">{formatDate(bugReport.inserted_at)}</span>
                        </td>
                        <td className="admin-bugs__td">
                          <div className="admin-bugs__actions">
                            {bugReport.status !== 'resolved' ? (
                              <button
                                className="admin-bugs__btn admin-bugs__btn--resolve"
                                disabled={updatingBugReportId === bugReport.id}
                                onClick={() => void updateBugReport(bugReport.id, 'resolved')}
                              >
                                {updatingBugReportId === bugReport.id ? (
                                  <Loader2 className="admin-bugs__btn-icon admin-bugs__btn-icon--spin" />
                                ) : (
                                  <Check className="admin-bugs__btn-icon" />
                                )}
                                Resolve
                              </button>
                            ) : (
                              <button
                                className="admin-bugs__btn admin-bugs__btn--reopen"
                                disabled={updatingBugReportId === bugReport.id}
                                onClick={() => void updateBugReport(bugReport.id, 'in_progress')}
                              >
                                {updatingBugReportId === bugReport.id ? (
                                  <Loader2 className="admin-bugs__btn-icon admin-bugs__btn-icon--spin" />
                                ) : null}
                                Reopen
                              </button>
                            )}

                            <button
                              className="admin-bugs__btn admin-bugs__btn--delete"
                              disabled={deletingBugReportId === bugReport.id}
                              onClick={() => confirmDeleteBugReport(bugReport)}
                            >
                              {deletingBugReportId === bugReport.id ? (
                                <Loader2 className="admin-bugs__btn-icon admin-bugs__btn-icon--spin" />
                              ) : (
                                <Trash2 className="admin-bugs__btn-icon" />
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
            <div className="admin-bugs__empty">
              <div className="admin-bugs__empty-icon">
                <FileText className="admin-bugs__empty-icon-svg" />
              </div>
              <p className="admin-bugs__empty-text">No bug reports found</p>
              <button className="admin-bugs__empty-btn" onClick={() => void fetchBugReports()}>
                Refresh Bug Reports
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        show={showDeleteBugReportDialog}
        title="Delete Bug Report"
        message="Are you sure you want to delete the bug report"
        itemName={bugReportToDelete?.title || ''}
        suffix="?"
        confirmText="Delete"
        variant="destructive"
        onClose={handleDeleteBugReportDialogClose}
        onConfirm={() => void deleteBugReportConfirmed()}
      />
    </PageLayout>
  )
}
