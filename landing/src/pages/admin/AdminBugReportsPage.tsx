import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, FileText, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { deleteBugReport, listBugReports, updateBugReportStatus, type BugReport } from '@/services/adminApi'
import { formatDateTime, formatWalletAddress, toTitleCase } from './adminFormat'

const statusOptions: Array<{ label: string; value: '' | BugReport['status'] }> = [
  { label: 'All Statuses', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
]

const severityOptions: Array<{ label: string; value: '' | BugReport['severity'] }> = [
  { label: 'All Severities', value: '' },
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' },
]

function badgeClass(value: string, type: 'status' | 'severity') {
  if (type === 'status') {
    if (value === 'open') return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    if (value === 'in_progress') return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    if (value === 'resolved') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    if (value === 'closed') return 'bg-zinc-700/70 text-zinc-300 border-zinc-600'
    return 'bg-zinc-700/70 text-zinc-300 border-zinc-600'
  }

  if (value === 'critical') return 'bg-red-500/20 text-red-300 border-red-500/30'
  if (value === 'high') return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
  if (value === 'medium') return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  if (value === 'low') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  return 'bg-zinc-700/70 text-zinc-300 border-zinc-600'
}

export function AdminBugReportsPage() {
  const [rows, setRows] = useState<BugReport[]>([])
  const [status, setStatus] = useState<'' | BugReport['status']>('')
  const [severity, setSeverity] = useState<'' | BugReport['severity']>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listBugReports({
        status: status || undefined,
        severity: severity || undefined,
      })
      setRows(data)
    } catch (err: any) {
      setError(err?.message || 'Failed to load bug reports')
    } finally {
      setLoading(false)
    }
  }, [severity, status])

  useEffect(() => {
    load()
  }, [load])

  const countLabel = useMemo(() => `${rows.length} report${rows.length === 1 ? '' : 's'}`, [rows.length])

  async function handleResolveToggle(row: BugReport) {
    setBusyId(row.id)
    try {
      await updateBugReportStatus(row.id, row.status === 'resolved' ? 'in_progress' : 'resolved')
      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to update bug report')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(row: BugReport) {
    const ok = window.confirm(`Delete bug report #${row.id}: ${row.title}?`)
    if (!ok) return

    setBusyId(row.id)
    try {
      await deleteBugReport(row.id)
      setRows((prev) => prev.filter((x) => x.id !== row.id))
    } catch (err: any) {
      setError(err?.message || 'Failed to delete bug report')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageLayout
      icon={FileText}
      title="Bug Reports"
      actions={
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-zinc-200 border border-zinc-700 bg-transparent hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      }
    >
      <div className="p-6 space-y-4 max-w-[1600px] w-full mx-auto">
        <div>
          <h1 className="m-0 text-2xl font-bold text-white">Bug Reports</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">Track and manage reported issues.</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 flex flex-wrap items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as '' | BugReport['status'])}
            className="h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
          >
            {statusOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as '' | BugReport['severity'])}
            className="h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
          >
            {severityOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <span className="ml-auto text-xs font-semibold uppercase tracking-wide text-zinc-400">{countLabel}</span>
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
            Loading bug reports...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-zinc-400">No bug reports found.</div>
        ) : (
          <div className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full min-w-[1080px] text-sm border-collapse">
              <thead className="bg-zinc-900/80">
                <tr className="text-left text-zinc-400">
                  <th className="px-3 py-2 border-b border-zinc-800">ID</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Title</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Severity</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Status</th>
                  <th className="px-3 py-2 border-b border-zinc-800">User</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Created</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-800/70 align-top">
                    <td className="px-3 py-2 text-zinc-300">#{row.id}</td>
                    <td className="px-3 py-2">
                      <p className="m-0 text-zinc-100 font-medium">{row.title}</p>
                      <p className="m-0 mt-1 text-xs text-zinc-500 line-clamp-2">{row.description}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${badgeClass(row.severity, 'severity')}`}>
                        {toTitleCase(row.severity)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${badgeClass(row.status, 'status')}`}>
                        {toTitleCase(row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-300 font-mono text-xs">{formatWalletAddress(row.user_wallet_address)}</td>
                    <td className="px-3 py-2 text-zinc-500 text-xs">{formatDateTime(row.inserted_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap">
                        <button
                          disabled={busyId === row.id}
                          onClick={() => handleResolveToggle(row)}
                          className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 text-xs hover:bg-emerald-500/25 disabled:opacity-50"
                        >
                          <Check className="inline-block w-3 h-3 mr-1" />
                          {row.status === 'resolved' ? 'Reopen' : 'Resolve'}
                        </button>
                        <button
                          disabled={busyId === row.id}
                          onClick={() => handleDelete(row)}
                          className="px-2 py-1 rounded border border-red-500/30 bg-red-500/15 text-red-300 text-xs hover:bg-red-500/25 disabled:opacity-50"
                        >
                          <Trash2 className="inline-block w-3 h-3 mr-1" />
                          Delete
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
    </PageLayout>
  )
}
