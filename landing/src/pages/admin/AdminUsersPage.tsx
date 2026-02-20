import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Loader2, RefreshCw, Shield, User, Users } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import {
  addUserCredits,
  demoteUserFromModerator,
  listAdminUsers,
  promoteUserToAdmin,
  promoteUserToModerator,
  type AdminUser,
} from '@/services/adminApi'

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function formatCredits(value: number | 'unlimited' | undefined) {
  if (value === 'unlimited') return 'Unlimited'
  if (typeof value !== 'number') return '0'
  return Math.round(value * 60).toString()
}

export function AdminUsersPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAdminUsers()
      setUsers(data)
    } catch (err: any) {
      setError(err?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const rows = useMemo(() => users, [users])

  async function handlePromoteAdmin(userId: number) {
    setBusyId(userId)
    try {
      await promoteUserToAdmin(userId)
      await fetchUsers()
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleModerator(user: AdminUser) {
    setBusyId(user.id)
    try {
      if (user.is_moderator) await demoteUserFromModerator(user.id)
      else await promoteUserToModerator(user.id)
      await fetchUsers()
    } finally {
      setBusyId(null)
    }
  }

  async function handleAddCredits(userId: number) {
    const raw = window.prompt('Hours to add (example: 2.5)')
    if (!raw) return
    const value = Number(raw)
    if (!Number.isFinite(value) || value <= 0) return

    setBusyId(userId)
    try {
      await addUserCredits(userId, value)
      await fetchUsers()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageLayout
      icon={Users}
      title="User Management"
      actions={
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-zinc-200 border border-zinc-700 bg-transparent hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      }
    >
      <div className="p-6">
        <div className="mb-4">
          <h1 className="m-0 text-xl font-semibold text-white">User Management</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">Manage roles, credits, and subscription access</p>
        </div>

        {loading && !users.length ? (
          <div className="py-12 flex items-center justify-center text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading users...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        ) : (
          <div className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full min-w-[980px] text-sm border-collapse">
              <thead className="bg-zinc-900/80">
                <tr className="text-left text-zinc-400">
                  <th className="px-3 py-2 border-b border-zinc-800">ID</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Account</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Role</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Subscription</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Credits</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Created</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const role = u.is_admin ? 'Admin' : u.is_moderator ? 'Moderator' : 'User'
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-zinc-800/80 hover:bg-zinc-800/35 cursor-pointer"
                      onClick={() => navigate(`/admin/users/${u.id}`)}
                    >
                      <td className="px-3 py-2 text-zinc-300">#{u.id}</td>
                      <td className="px-3 py-2 text-zinc-200">{u.email || u.wallet_address || 'N/A'}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                            u.is_admin
                              ? 'bg-violet-500/15 text-violet-300'
                              : u.is_moderator
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-zinc-700/50 text-zinc-300'
                          }`}
                        >
                          {u.is_admin || u.is_moderator ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          {role}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-300">
                        {u.subscription?.tier_name || 'None'} / {u.subscription?.status || 'none'}
                      </td>
                      <td className="px-3 py-2 text-zinc-300">{formatCredits(u.credits?.hours_remaining)} min</td>
                      <td className="px-3 py-2 text-zinc-500">{formatDate(u.created_at)}</td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1">
                          {!u.is_admin && (
                            <button
                              disabled={busyId === u.id}
                              onClick={() => handlePromoteAdmin(u.id)}
                              className="px-2 py-1 rounded bg-violet-500/15 text-violet-300 text-xs border border-violet-500/25 hover:bg-violet-500/25 disabled:opacity-50"
                            >
                              Promote Admin
                            </button>
                          )}
                          {!u.is_admin && (
                            <button
                              disabled={busyId === u.id}
                              onClick={() => handleToggleModerator(u)}
                              className="px-2 py-1 rounded bg-amber-500/15 text-amber-300 text-xs border border-amber-500/25 hover:bg-amber-500/25 disabled:opacity-50"
                            >
                              {u.is_moderator ? 'Demote Mod' : 'Promote Mod'}
                            </button>
                          )}
                          {!u.is_admin && (
                            <button
                              disabled={busyId === u.id}
                              onClick={() => handleAddCredits(u.id)}
                              className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 text-xs border border-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                              Add Credits
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
