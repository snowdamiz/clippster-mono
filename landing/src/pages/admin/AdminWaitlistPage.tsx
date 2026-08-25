import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Copy, Download, Loader2, RefreshCw, UserPlus, Users, ChevronDown, ChevronRight } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { listWaitlist, inviteWaitlist, inviteWaitlistEntry, addWaitlistEntry, type WaitlistEntry, type WaitlistStats, type InviteConfig } from '@/services/adminApi'
import { downloadEmailsCsv } from '@/utils/downloadEmailsCsv'
import { formatDateTime } from './adminFormat'

export function AdminWaitlistPage() {
  const [rows, setRows] = useState<WaitlistEntry[]>([])
  const [stats, setStats] = useState<WaitlistStats>({ total: 0, today: 0, this_week: 0, invited: 0, uninvited: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showAddUserDialog, setShowAddUserDialog] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [config, setConfig] = useState<InviteConfig>({
    percent_off: 30,
    duration_months: 1,
    allowed_tiers: ['creator']
  })

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

  function exportEmailsCsv() {
    const emails = rows.map((row) => row.email).filter(Boolean)
    if (!emails.length) {
      setError('No waitlist emails to export')
      return
    }
    downloadEmailsCsv(emails, 'waitlist-emails.csv')
  }

  async function handleInviteEntry(id: number) {
    setInviting(true)
    setError(null)
    try {
      await inviteWaitlistEntry(id, config)
      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  async function handleInviteAll() {
    setShowConfirm(false)
    setInviting(true)
    setError(null)
    try {
      const result = await inviteWaitlist(config)
      await load()
      alert(`Successfully invited ${result.invited_count} users. Skipped: ${result.skipped_count}. Errors: ${result.errors.length}`)
    } catch (err: any) {
      setError(err?.message || 'Failed to send invites')
    } finally {
      setInviting(false)
    }
  }

  async function handleAddUser() {
    if (!newUserEmail.trim()) return
    setAdding(true)
    setError(null)
    try {
      await addWaitlistEntry(newUserEmail.trim())
      setShowAddUserDialog(false)
      setNewUserEmail('')
      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to add user to waitlist')
    } finally {
      setAdding(false)
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Total Signups</p>
            <p className="m-0 mt-2 text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Invited</p>
            <p className="m-0 mt-2 text-2xl font-bold text-emerald-300">{stats.invited}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Pending</p>
            <p className="m-0 mt-2 text-2xl font-bold text-amber-300">{stats.uninvited}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">This Week</p>
            <p className="m-0 mt-2 text-2xl font-bold text-cyan-300">{stats.this_week}</p>
          </div>
        </div>

        {stats.uninvited > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="flex items-center gap-2 text-sm font-semibold text-white mb-3"
            >
              {showConfig ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Invite Settings
            </button>
            {showConfig && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Discount Percent</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.percent_off}
                    onChange={(e) => setConfig({ ...config, percent_off: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Duration (months)</label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={config.duration_months}
                    onChange={(e) => setConfig({ ...config, duration_months: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Allowed Tier</label>
                  <select
                    value={config.allowed_tiers[0]}
                    onChange={(e) => setConfig({ ...config, allowed_tiers: [e.target.value] })}
                    className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm"
                  >
                    <option value="starter">Starter</option>
                    <option value="creator">Creator</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-zinc-300 text-sm">
            <Users className="w-4 h-4" />
            {rows.length} email{rows.length === 1 ? '' : 's'}
          </div>
          <button
            onClick={() => setShowAddUserDialog(true)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add User
          </button>
          {stats.uninvited > 0 && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={inviting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Invite All Pending ({stats.uninvited})
            </button>
          )}
          {rows.length > 0 && (
            <>
              <button
                onClick={copyAllEmails}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-zinc-100 border border-zinc-700 hover:bg-zinc-800"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy All Emails
              </button>
              <button
                onClick={exportEmailsCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-zinc-100 border border-zinc-700 hover:bg-zinc-800"
              >
                <Download className="w-3.5 h-3.5" />
                Export Emails CSV
              </button>
            </>
          )}
        </div>

        {showAddUserDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowAddUserDialog(false)}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white mb-2">Add User to Waitlist</h3>
              <p className="text-sm text-zinc-400 mb-4">Enter the email address to add to the waitlist</p>
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
                placeholder="user@example.com"
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddUserDialog(false)}
                  disabled={adding}
                  className="flex-1 px-4 py-2 rounded-md text-sm font-semibold text-zinc-300 border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser}
                  disabled={!newUserEmail.trim() || adding}
                  className="flex-1 px-4 py-2 rounded-md text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Add User'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setShowConfirm(false)}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white mb-2">Confirm Bulk Invite</h3>
              <p className="text-sm text-zinc-400 mb-2">Send invites to {stats.uninvited} pending users?</p>
              <p className="text-xs text-zinc-500 mb-4">
                {config.percent_off}% off for {config.duration_months} month(s) - {config.allowed_tiers[0]} tier
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 px-4 py-2 rounded-md text-sm font-semibold text-zinc-300 border border-zinc-700 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInviteAll}
                  className="flex-1 px-4 py-2 rounded-md text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700"
                >
                  Send Invites
                </button>
              </div>
            </div>
          </div>
        )}

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
            <table className="w-full min-w-[1200px] text-sm border-collapse">
              <thead className="bg-zinc-900/80">
                <tr className="text-left text-zinc-400">
                  <th className="px-3 py-2 border-b border-zinc-800">ID</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Email</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Signed Up</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Status</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Beta Code</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Discount Code</th>
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
                      {row.invited_at ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-emerald-400 text-xs">✓ Invited {formatDateTime(row.invited_at)}</span>
                          {row.email_delivery_error && (
                            <span className="text-red-400 text-xs" title={row.email_delivery_error}>⚠ Email Failed</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-amber-400 text-xs">Pending</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.beta_code ? (
                        <code className="text-cyan-400 text-xs font-mono">{row.beta_code}</code>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.discount_code ? (
                        <code className="text-green-400 text-xs font-mono">{row.discount_code}</code>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {!row.invited_at ? (
                        <button
                          onClick={() => handleInviteEntry(row.id)}
                          disabled={inviting}
                          className="px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-700 text-white text-xs disabled:opacity-50"
                        >
                          <UserPlus className="inline-block w-3 h-3 mr-1" />
                          Invite
                        </button>
                      ) : (
                        <button
                          onClick={() => copyEmail(row.email)}
                          className="px-2 py-1 rounded border border-zinc-700 text-zinc-200 text-xs hover:bg-zinc-800"
                        >
                          <Copy className="inline-block w-3 h-3 mr-1" />
                          Copy
                        </button>
                      )}
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
