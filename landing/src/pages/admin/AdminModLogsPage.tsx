import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Filter, Loader2, RefreshCw, ScrollText, User } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { listAdminUsers, listModeratorLogs, type ModLog } from '@/services/adminApi'
import './AdminModLogsPage.css'

const actionTypeOptions = [
  { label: 'All Actions', value: '' },
  { label: 'Approve Org Application', value: 'approve_org_application' },
  { label: 'Reject Org Application', value: 'reject_org_application' },
  { label: 'Update Bug Report', value: 'update_bug_report' },
  { label: 'Respond to Support', value: 'respond_to_support' },
  { label: 'Archive Support', value: 'archive_support_conversation' },
]

interface FiltersState {
  moderatorId: string
  actionType: string
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatActionType(actionType: string): string {
  return actionType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatTargetType(targetType: string): string {
  return targetType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getActionColor(actionType: string): 'success' | 'danger' | 'warning' | 'default' {
  if (actionType.includes('approve')) return 'success'
  if (actionType.includes('reject') || actionType.includes('delete')) return 'danger'
  if (actionType.includes('archive')) return 'warning'
  return 'default'
}

export function AdminModLogsPage() {
  const [logs, setLogs] = useState<ModLog[]>([])
  const [moderators, setModerators] = useState<Array<{ id: number; label: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [perPage] = useState(50)
  const [total, setTotal] = useState(0)

  const [filters, setFilters] = useState<FiltersState>({
    moderatorId: '',
    actionType: '',
  })

  const moderatorOptions = useMemo(
    () => [{ label: 'All Moderators', value: '' }, ...moderators.map((mod) => ({ label: mod.label, value: String(mod.id) }))],
    [moderators],
  )

  const totalPages = useMemo(() => Math.ceil(total / perPage), [total, perPage])

  async function loadLogs(pageOverride?: number) {
    const currentPage = pageOverride ?? page

    setLoading(true)
    setError(null)

    try {
      let result: { logs: ModLog[]; total: number }

      if (filters.moderatorId) {
        result = await listModeratorLogs({
          page: currentPage,
          per_page: perPage,
          moderator_id: Number(filters.moderatorId),
        })
      } else {
        result = await listModeratorLogs({
          page: currentPage,
          per_page: perPage,
        })
      }

      let nextLogs = result.logs || []

      if (filters.actionType) {
        nextLogs = nextLogs.filter((log) => log.action_type === filters.actionType)
      }

      setLogs(nextLogs)
      setTotal(result.total || 0)
    } catch (err: any) {
      setError(err?.message || 'Failed to load moderator logs')
      console.error('Failed to load logs:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadModerators() {
    try {
      const users = await listAdminUsers()
      const mods = users
        .filter((user) => user.is_moderator)
        .map((user) => ({
          id: user.id,
          label: user.name || user.email || `User #${user.id}`,
        }))
      setModerators(mods)
    } catch (err) {
      console.error('Failed to load moderators:', err)
      setModerators([])
    }
  }

  function applyFilters() {
    void loadLogs()
  }

  function prevPage() {
    if (page > 1) {
      const nextPage = page - 1
      setPage(nextPage)
      void loadLogs(nextPage)
    }
  }

  function nextPage() {
    if (page < totalPages) {
      const nextPage = page + 1
      setPage(nextPage)
      void loadLogs(nextPage)
    }
  }

  useEffect(() => {
    void loadLogs()
    void loadModerators()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="admin-mod-logs-page">
      <PageLayout
        icon={ScrollText}
        title="Moderator Logs"
        actions={
          <button className="admin-mod-logs__action-btn" disabled={loading} onClick={() => void loadLogs()}>
            {!loading ? (
              <RefreshCw className="admin-mod-logs__action-icon" />
            ) : (
              <Loader2 className="admin-mod-logs__action-icon admin-mod-logs__action-icon--spin" />
            )}
            Refresh Logs
          </button>
        }
      >
        <div className="admin-mod-logs">
          <div className="admin-mod-logs__heading">
            <h1 className="admin-mod-logs__title">Moderator Logs</h1>
            <p className="admin-mod-logs__subtitle">View all moderator actions and activity</p>
          </div>

          <div className="admin-mod-logs__stats-header">
            <div className="admin-mod-logs__stats-info">
              <div className="admin-mod-logs__stats-icon">
                <ScrollText className="admin-mod-logs__stats-icon-svg" />
              </div>
              <div>
                <h2 className="admin-mod-logs__stats-title">Moderation Activity</h2>
                <p className="admin-mod-logs__stats-desc">Track moderator actions and decisions</p>
              </div>
            </div>
            {logs.length > 0 ? (
              <span className="admin-mod-logs__stats-count">
                {logs.length} log{logs.length !== 1 ? 's' : ''}
              </span>
            ) : null}
          </div>

          <div className="admin-mod-logs__filters">
            <div className="admin-mod-logs__filter">
              <label htmlFor="mod-logs-moderator">Moderator</label>
              <select
                id="mod-logs-moderator"
                value={filters.moderatorId}
                onChange={(event) => setFilters((previous) => ({ ...previous, moderatorId: event.target.value }))}
                className="admin-mod-logs__dropdown-trigger"
              >
                {moderatorOptions.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-mod-logs__filter">
              <label htmlFor="mod-logs-action">Action Type</label>
              <select
                id="mod-logs-action"
                value={filters.actionType}
                onChange={(event) => setFilters((previous) => ({ ...previous, actionType: event.target.value }))}
                className="admin-mod-logs__dropdown-trigger"
              >
                {actionTypeOptions.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button className="admin-mod-logs__apply-btn" onClick={applyFilters}>
              <Filter className="admin-mod-logs__button-icon" />
              Apply Filters
            </button>
          </div>

          {loading ? (
            <div className="admin-mod-logs__loading">
              <Loader2 className="admin-mod-logs__spinner" />
              <p>Loading moderator logs...</p>
            </div>
          ) : error ? (
            <div className="admin-mod-logs__error">
              <AlertTriangle className="admin-mod-logs__error-icon" />
              <h3>Failed to load logs</h3>
              <p>{error}</p>
              <button className="admin-mod-logs__retry-btn" onClick={() => void loadLogs()}>
                Try Again
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="admin-mod-logs__empty">
              <ScrollText className="admin-mod-logs__empty-icon" />
              <h3>No logs found</h3>
              <p>No moderator actions match the current filters</p>
            </div>
          ) : (
            <div className="admin-mod-logs__table-container">
              <table className="admin-mod-logs__table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Moderator</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div className="admin-mod-logs__timestamp">
                          <span className="admin-mod-logs__date">{formatDate(log.created_at)}</span>
                          <span className="admin-mod-logs__time">{formatTime(log.created_at)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-mod-logs__moderator">
                          <User className="admin-mod-logs__moderator-icon" />
                          <span>{log.moderator?.name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`admin-mod-logs__action-badge admin-mod-logs__action-badge--${getActionColor(log.action_type)}`}
                        >
                          {formatActionType(log.action_type)}
                        </span>
                      </td>
                      <td>
                        <div className="admin-mod-logs__target">
                          <span className="admin-mod-logs__target-type">{formatTargetType(log.target_type)}</span>
                          <span className="admin-mod-logs__target-id">#{log.target_id}</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-mod-logs__details">
                          {log.details && Object.keys(log.details).length > 0 ? (
                            Object.entries(log.details).map(([key, value]) => (
                              <div key={key} className="admin-mod-logs__detail-item">
                                <span className="admin-mod-logs__detail-key">{key}:</span>
                                <span className="admin-mod-logs__detail-value">{String(value)}</span>
                              </div>
                            ))
                          ) : (
                            <span className="admin-mod-logs__no-details">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="admin-mod-logs__pagination">
                <button
                  onClick={prevPage}
                  disabled={page === 1}
                  className="admin-mod-logs__pagination-btn"
                >
                  Previous
                </button>
                <span className="admin-mod-logs__page-info">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={nextPage}
                  disabled={page >= totalPages}
                  className="admin-mod-logs__pagination-btn"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </PageLayout>
    </div>
  )
}
