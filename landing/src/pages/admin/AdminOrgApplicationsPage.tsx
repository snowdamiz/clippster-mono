import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import {
  approveOrgApplication,
  deleteOrgApplication,
  listOrgApplications,
  rejectOrgApplication,
  type OrgApplication,
} from '@/services/adminApi'
import { formatDateTime, formatWalletAddress } from './adminFormat'

const statusOptions: Array<{ label: string; value: '' | OrgApplication['status'] }> = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
]

function statusClass(status: OrgApplication['status']) {
  if (status === 'approved') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  if (status === 'rejected') return 'bg-red-500/20 text-red-300 border-red-500/30'
  return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
}

export function AdminOrgApplicationsPage() {
  const [rows, setRows] = useState<OrgApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'' | OrgApplication['status']>('')
  const [selected, setSelected] = useState<OrgApplication | null>(null)
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState<'approve' | 'reject' | 'delete' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listOrgApplications(statusFilter || undefined)
      setRows(data)
      if (selected) {
        const fresh = data.find((x) => x.id === selected.id) || null
        setSelected(fresh)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load organization applications')
    } finally {
      setLoading(false)
    }
  }, [selected, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  function openDetails(app: OrgApplication) {
    setSelected(app)
    setNotes(app.admin_notes || '')
  }

  async function handleApprove() {
    if (!selected) return
    setProcessing('approve')
    try {
      await approveOrgApplication(selected.id, notes)
      await load()
      setSelected(null)
    } catch (err: any) {
      setError(err?.message || 'Failed to approve application')
    } finally {
      setProcessing(null)
    }
  }

  async function handleReject() {
    if (!selected) return
    setProcessing('reject')
    try {
      await rejectOrgApplication(selected.id, notes)
      await load()
      setSelected(null)
    } catch (err: any) {
      setError(err?.message || 'Failed to reject application')
    } finally {
      setProcessing(null)
    }
  }

  async function handleDelete(app: OrgApplication) {
    const ok = window.confirm(`Delete application from ${app.name}?`)
    if (!ok) return

    setProcessing('delete')
    try {
      await deleteOrgApplication(app.id)
      if (selected?.id === app.id) setSelected(null)
      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to delete application')
    } finally {
      setProcessing(null)
    }
  }

  return (
    <PageLayout
      icon={FileText}
      title="Organization Applications"
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
      <div className="p-6 space-y-4 max-w-[1500px] w-full mx-auto">
        <div>
          <h1 className="m-0 text-2xl font-bold text-white">Organization Applications</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">Review and process organization account requests.</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | OrgApplication['status'])}
            className="h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
          >
            {statusOptions.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button onClick={load} className="h-9 px-3 rounded-md border border-zinc-700 text-xs font-semibold text-zinc-200 hover:bg-zinc-800">
            Apply
          </button>
          <span className="ml-auto text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {rows.length} application{rows.length === 1 ? '' : 's'}
          </span>
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
            Loading applications...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-zinc-400">No applications found.</div>
        ) : (
          <div className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full min-w-[1200px] text-sm border-collapse">
              <thead className="bg-zinc-900/80">
                <tr className="text-left text-zinc-400">
                  <th className="px-3 py-2 border-b border-zinc-800">Organization</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Applicant</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Team Size</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Status</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Submitted</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((app) => (
                  <tr key={app.id} className="border-b border-zinc-800/70">
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        <div className="w-9 h-9 rounded-md bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-cyan-300" />
                        </div>
                        <div>
                          <p className="m-0 text-zinc-100 font-medium">{app.name}</p>
                          <p className="m-0 mt-0.5 text-xs text-zinc-500 line-clamp-1">{app.description}</p>
                          {app.website && (
                            <a
                              href={app.website}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 mt-1 text-xs text-cyan-300 hover:text-cyan-200"
                            >
                              Website
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-zinc-300 text-xs">
                      <p className="m-0">{app.user?.email || app.contact_email || 'N/A'}</p>
                      <p className="m-0 mt-0.5 font-mono text-zinc-500">{formatWalletAddress(app.user?.wallet_address)}</p>
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{app.team_size || 'N/A'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${statusClass(app.status)}`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-500 text-xs">{formatDateTime(app.inserted_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openDetails(app)}
                          className="px-2 py-1 rounded border border-zinc-700 text-xs text-zinc-200 hover:bg-zinc-800"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => handleDelete(app)}
                          disabled={processing === 'delete'}
                          className="px-2 py-1 rounded border border-red-500/30 bg-red-500/15 text-xs text-red-300 hover:bg-red-500/25 disabled:opacity-50"
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

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-4xl rounded-xl border border-zinc-700 bg-[#111113] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="m-0 text-lg font-semibold text-white">{selected.name}</h2>
                <p className="m-0 mt-1 text-xs text-zinc-500">Application #{selected.id}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-zinc-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <h3 className="m-0 text-sm font-semibold text-white">Organization Info</h3>
                <p className="m-0 mt-2 text-sm text-zinc-300">{selected.description}</p>
                <p className="m-0 mt-2 text-xs text-zinc-500">Team size: {selected.team_size || 'N/A'}</p>
                <p className="m-0 mt-1 text-xs text-zinc-500">Use case: {selected.use_case || 'N/A'}</p>
                {selected.website && (
                  <a href={selected.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-cyan-300">
                    Visit website
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <h3 className="m-0 text-sm font-semibold text-white">Applicant</h3>
                <p className="m-0 mt-2 text-sm text-zinc-300">{selected.user?.email || selected.contact_email || 'N/A'}</p>
                <p className="m-0 mt-1 text-xs text-zinc-500">{formatWalletAddress(selected.user?.wallet_address)}</p>
                <p className="m-0 mt-2 text-xs text-zinc-500">Submitted: {formatDateTime(selected.inserted_at)}</p>
                {selected.reviewed_by && (
                  <p className="m-0 mt-1 text-xs text-zinc-500">
                    Reviewed by {selected.reviewed_by.email || 'Unknown'} on {formatDateTime(selected.reviewed_at)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs text-zinc-400">
                Admin Notes
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                />
              </label>
            </div>

            {selected.status === 'pending' && (
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={handleReject}
                  disabled={processing !== null}
                  className="px-3 py-2 rounded-md border border-red-500/30 bg-red-500/15 text-xs font-semibold text-red-300 hover:bg-red-500/25 disabled:opacity-50"
                >
                  {processing === 'reject' ? <Loader2 className="inline-block w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  disabled={processing !== null}
                  className="px-3 py-2 rounded-md border border-emerald-500/30 bg-emerald-500/15 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  {processing === 'approve' ? <Loader2 className="inline-block w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="inline-block w-3.5 h-3.5 mr-1" />}
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
