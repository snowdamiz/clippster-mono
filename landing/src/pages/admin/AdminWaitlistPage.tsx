import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Copy, Loader2, RefreshCw, UserPlus, Users } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { listWaitlist, type WaitlistEntry, type WaitlistStats } from '@/services/adminApi'
import { formatDateTime } from './adminFormat'

export function AdminWaitlistPage() {
  const [rows, setRows] = useState<WaitlistEntry[]>([])
  const [stats, setStats] = useState<WaitlistStats>({ total: 0, today: 0, this_week: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listWaitlist()
      setRows(data.entries)
      setStats(data.stats)
    } catch (err: any) {
      setError(err?.message || 'Failed to load waitlist')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email)
    } catch {
      setError('Failed to copy email')
    }
  }

  async function copyAllEmails() {
    if (!rows.length) {
      setError('No waitlist emails to copy')
      return
    }
    try {
      await navigator.clipboard.writeText(rows.map((x) => x.email).join('\n'))
    } catch {
      setError('Failed to copy all emails')
    }
  }

  return (
    <PageLayout
      icon={UserPlus}
      title="Waitlist"
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
      <div className="p-6 space-y-4 max-w-[1400px] w-full mx-auto">
        <div>
          <h1 className="m-0 text-2xl font-bold text-white">Waitlist</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">Users who signed up for early access.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Total Signups</p>
            <p className="m-0 mt-2 text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Today</p>
            <p className="m-0 mt-2 text-2xl font-bold text-emerald-300">{stats.today}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">This Week</p>
            <p className="m-0 mt-2 text-2xl font-bold text-cyan-300">{stats.this_week}</p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 flex items-center gap-3">
          <div className="flex items-center gap-2 text-zinc-300 text-sm">
            <Users className="w-4 h-4" />
            {rows.length} email{rows.length === 1 ? '' : 's'}
          </div>
          {rows.length > 0 && (
            <button
              onClick={copyAllEmails}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-zinc-100 border border-zinc-700 hover:bg-zinc-800"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy All Emails
            </button>
          )}
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
            Loading waitlist...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-zinc-400">No waitlist signups yet.</div>
        ) : (
          <div className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full min-w-[900px] text-sm border-collapse">
              <thead className="bg-zinc-900/80">
                <tr className="text-left text-zinc-400">
                  <th className="px-3 py-2 border-b border-zinc-800">ID</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Email</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Signed Up</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-800/70">
                    <td className="px-3 py-2 text-zinc-300">#{row.id}</td>
                    <td className="px-3 py-2 text-zinc-200 font-medium">{row.email}</td>
                    <td className="px-3 py-2 text-zinc-500 text-xs">{formatDateTime(row.created_at)}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => copyEmail(row.email)}
                        className="px-2 py-1 rounded border border-zinc-700 text-zinc-200 text-xs hover:bg-zinc-800"
                      >
                        <Copy className="inline-block w-3 h-3 mr-1" />
                        Copy
                      </button>
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
