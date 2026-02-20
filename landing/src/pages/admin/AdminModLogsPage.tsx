import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Filter,
  Loader2,
  RefreshCw,
  ScrollText,
  User,
} from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { listAdminUsers, listModeratorLogs, type ModLog } from '@/services/adminApi'
import { formatDate, formatDateTime, toTitleCase } from './adminFormat'

const actionTypeOptions = [
  { label: 'All Actions', value: '' },
  { label: 'Approve Org Application', value: 'approve_org_application' },
  { label: 'Reject Org Application', value: 'reject_org_application' },
  { label: 'Update Bug Report', value: 'update_bug_report' },
  { label: 'Respond to Support', value: 'respond_to_support' },
  { label: 'Archive Support', value: 'archive_support_conversation' },
]

function actionClass(action: string) {
  if (action.includes('approve')) return 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
  if (action.includes('reject') || action.includes('delete')) return 'bg-red-500/20 border-red-500/30 text-red-300'
  if (action.includes('archive')) return 'bg-amber-500/20 border-amber-500/30 text-amber-300'
  return 'bg-zinc-700/70 border-zinc-600 text-zinc-300'
}

export function AdminModLogsPage() {
  const [rows, setRows] = useState<ModLog[]>([])
  const [moderators, setModerators] = useState<Array<{ id: number; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [moderatorId, setModeratorId] = useState<number>(0)
  const [actionType, setActionType] = useState('')
  const [page, setPage] = useState(1)
  const [perPage] = useState(50)
  const [total, setTotal] = useState(0)

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const loadModerators = useCallback(async () => {
    try {
      const users = await listAdminUsers()
      const mods = users
        .filter((u) => u.is_moderator)
        .map((u) => ({ id: u.id, name: u.name || u.email || `User #${u.id}` }))
      setModerators(mods)
    } catch {
      setModerators([])
    }
  }, [])

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await listModeratorLogs({
        page,
        per_page: perPage,
        moderator_id: moderatorId || undefined,
      })
      setRows(result.logs)
      setTotal(result.total)
    } catch (err: any) {
      setError(err?.message || 'Failed to load moderator logs')
    } finally {
      setLoading(false)
    }
  }, [moderatorId, page, perPage])

  useEffect(() => {
    loadModerators()
  }, [loadModerators])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const filteredRows = useMemo(
    () => (actionType ? rows.filter((x) => x.action_type === actionType) : rows),
    [actionType, rows],
  )

  function detailsEntries(log: ModLog) {
    if (!log.details) return []
    return Object.entries(log.details)
  }

  return (
    <PageLayout
      icon={ScrollText}
      title="Moderator Logs"
      actions={
        <button
          onClick={loadLogs}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-zinc-200 border border-zinc-700 bg-transparent hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      }
    >
      <div className="p-6 space-y-4 max-w-[1500px] w-full mx-auto">
        <div>
          <h1 className="m-0 text-2xl font-bold text-white">Moderator Logs</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">Track moderator actions and platform enforcement history.</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 flex flex-wrap items-end gap-2">
          <label className="text-xs text-zinc-400">
            Moderator
            <select
              value={moderatorId}
              onChange={(e) => {
                setPage(1)
                setModeratorId(Number(e.target.value))
              }}
              className="mt-1 h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
            >
              <option value={0}>All Moderators</option>
              {moderators.map((mod) => (
                <option key={mod.id} value={mod.id}>
                  {mod.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-zinc-400">
            Action Type
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="mt-1 h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
            >
              {actionTypeOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={loadLogs}
            className="h-9 px-3 rounded-md border border-zinc-700 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
          >
            <Filter className="inline-block w-3.5 h-3.5 mr-1" />
            Apply
          </button>

          <span className="ml-auto text-xs font-semibold uppercase tracking-wide text-zinc-400">{filteredRows.length} log(s)</span>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 flex items-center justify-center text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading moderator logs...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-zinc-400">No logs match current filters.</div>
        ) : (
          <div className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full min-w-[1200px] text-sm border-collapse">
              <thead className="bg-zinc-900/80">
                <tr className="text-left text-zinc-400">
                  <th className="px-3 py-2 border-b border-zinc-800">Timestamp</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Moderator</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Action</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Target</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((log) => (
                  <tr key={log.id} className="border-b border-zinc-800/70 align-top">
                    <td className="px-3 py-2 text-zinc-300 text-xs">
                      <p className="m-0">{formatDate(log.created_at)}</p>
                      <p className="m-0 mt-0.5 text-zinc-500">{formatDateTime(log.created_at)}</p>
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-zinc-500" />
                        {log.moderator?.name || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${actionClass(log.action_type)}`}>
                        {toTitleCase(log.action_type)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-300 text-xs">
                      {toTitleCase(log.target_type)} #{log.target_id}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400">
                      {detailsEntries(log).length === 0 ? (
                        <span className="text-zinc-500">—</span>
                      ) : (
                        detailsEntries(log).map(([key, value]) => (
                          <p key={key} className="m-0">
                            <span className="text-zinc-500">{key}:</span> {String(value)}
                          </p>
                        ))
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="h-8 px-3 rounded-md border border-zinc-700 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-500">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="h-8 px-3 rounded-md border border-zinc-700 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </PageLayout>
  )
}
