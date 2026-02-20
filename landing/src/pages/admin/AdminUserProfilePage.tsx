import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Crown,
  Loader2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  UserX,
} from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import {
  addUserCredits,
  applyUserDiscount,
  cancelUserSubscription,
  changeUserSubscriptionTier,
  deleteAdminUser,
  demoteUserFromModerator,
  disableModeratorDiscount,
  enableModeratorDiscount,
  extendUserSubscription,
  getAdminUserProfile,
  getUserSubscriptionHistory,
  grantUserFreeMonth,
  grantUserSubscription,
  promoteUserToModerator,
  resetUserPassword,
  restrictAdminUser,
  unrestrictAdminUser,
  type AdminUserProfile,
  type SubscriptionHistoryItem,
} from '@/services/adminApi'
import { formatDate, formatDateTime, formatHoursToMinutes } from './adminFormat'

export function AdminUserProfilePage() {
  const { id } = useParams<{ id: string }>()
  const userId = Number(id)

  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<AdminUserProfile | null>(null)
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistoryItem[]>([])

  const [restrictReason, setRestrictReason] = useState('')
  const [discountPercent, setDiscountPercent] = useState(50)
  const [discountMonths, setDiscountMonths] = useState(1)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const load = useCallback(async () => {
    if (!Number.isFinite(userId) || userId <= 0) {
      setError('Invalid user id')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [userData, historyData] = await Promise.all([
        getAdminUserProfile(userId),
        getUserSubscriptionHistory(userId).catch(() => []),
      ])
      setProfile(userData)
      setSubscriptionHistory(historyData)
    } catch (err: any) {
      setError(err?.message || 'Failed to load user profile')
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  async function runAction(key: string, action: () => Promise<unknown>) {
    setBusyAction(key)
    setError(null)
    try {
      await action()
      await load()
    } catch (err: any) {
      setError(err?.message || `Failed to run action: ${key}`)
    } finally {
      setBusyAction(null)
    }
  }

  async function handleResetPassword() {
    if (!newPassword || !confirmPassword) {
      setError('Enter and confirm the new password')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    await runAction('reset-password', () => resetUserPassword(userId, newPassword))
    setNewPassword('')
    setConfirmPassword('')
  }

  async function handleAddCredits() {
    const raw = window.prompt('Hours to add')
    if (!raw) return
    const value = Number(raw)
    if (!Number.isFinite(value) || value <= 0) return
    await runAction('add-credits', () => addUserCredits(userId, value))
  }

  async function handleGrantSubscription() {
    const tier = window.prompt('Tier: starter | creator | pro', 'creator')
    if (!tier || !['starter', 'creator', 'pro'].includes(tier)) return
    const daysRaw = window.prompt('Days', '30')
    const days = Number(daysRaw || '30')
    if (!Number.isFinite(days) || days <= 0) return

    await runAction('grant-subscription', () =>
      grantUserSubscription(userId, {
        tier: tier as 'starter' | 'creator' | 'pro',
        days,
        grant_credits: true,
      }),
    )
  }

  async function handleExtendSubscription() {
    const daysRaw = window.prompt('Days to extend', '30')
    const days = Number(daysRaw || '30')
    if (!Number.isFinite(days) || days <= 0) return

    await runAction('extend-subscription', () =>
      extendUserSubscription(userId, {
        days,
        grant_credits: true,
      }),
    )
  }

  async function handleChangeTier() {
    const tier = window.prompt('New tier: starter | creator | pro', 'creator')
    if (!tier || !['starter', 'creator', 'pro'].includes(tier)) return

    await runAction('change-tier', () =>
      changeUserSubscriptionTier(userId, {
        tier: tier as 'starter' | 'creator' | 'pro',
        grant_credits: true,
      }),
    )
  }

  async function handleDeleteUser() {
    const ok = window.confirm('Schedule this user for deletion?')
    if (!ok) return
    await runAction('delete-user', () => deleteAdminUser(userId))
  }

  return (
    <PageLayout
      icon={User}
      title={profile?.email || profile?.wallet_address || `User #${userId}`}
      actions={
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-zinc-200 border border-zinc-700 bg-transparent hover:bg-zinc-800 no-underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Link>
      }
    >
      <div className="p-6 space-y-4 max-w-[1500px] w-full mx-auto">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 flex items-center justify-center text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading user profile...
          </div>
        ) : !profile ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-zinc-400">User not found.</div>
        ) : (
          <>
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="m-0 text-2xl font-bold text-white">{profile.name || profile.email || profile.wallet_address}</h1>
                  <p className="m-0 mt-1 text-sm text-zinc-400">User #{profile.id} • {profile.provider || 'unknown provider'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {profile.is_admin && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border bg-violet-500/20 border-violet-500/30 text-violet-300">
                      <Crown className="w-3.5 h-3.5" />
                      Admin
                    </span>
                  )}
                  {profile.is_moderator && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border bg-amber-500/20 border-amber-500/30 text-amber-300">
                      <Shield className="w-3.5 h-3.5" />
                      Moderator
                    </span>
                  )}
                  {profile.is_restricted && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border bg-red-500/20 border-red-500/30 text-red-300">
                      <UserX className="w-3.5 h-3.5" />
                      Restricted
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-zinc-800 bg-[#0c0c0f] p-3">
                  <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Credits</p>
                  <p className="m-0 mt-1 text-lg font-semibold text-zinc-100">{formatHoursToMinutes(profile.credits.hours_remaining)}</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-[#0c0c0f] p-3">
                  <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Subscription</p>
                  <p className="m-0 mt-1 text-lg font-semibold text-zinc-100">{profile.subscription?.tier || 'Free'}</p>
                  <p className="m-0 mt-0.5 text-xs text-zinc-500">{profile.subscription?.status || 'none'}</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-[#0c0c0f] p-3">
                  <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Created</p>
                  <p className="m-0 mt-1 text-sm font-semibold text-zinc-100">{formatDate(profile.created_at)}</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-[#0c0c0f] p-3">
                  <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Last Active</p>
                  <p className="m-0 mt-1 text-sm font-semibold text-zinc-100">{formatDateTime(profile.last_active_at)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="m-0 text-sm font-semibold text-white">Role & Access</h2>
              <p className="m-0 mt-1 text-xs text-zinc-500">Moderator controls and restriction tools.</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {!profile.is_moderator ? (
                  <button
                    onClick={() => runAction('promote-moderator', () => promoteUserToModerator(userId))}
                    disabled={busyAction !== null}
                    className="px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/15 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
                  >
                    <ShieldCheck className="inline-block w-3.5 h-3.5 mr-1" />
                    Promote Moderator
                  </button>
                ) : (
                  <button
                    onClick={() => runAction('demote-moderator', () => demoteUserFromModerator(userId))}
                    disabled={busyAction !== null}
                    className="px-3 py-2 rounded-md border border-zinc-600 bg-zinc-700/50 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
                  >
                    Demote Moderator
                  </button>
                )}

                {!profile.is_restricted ? (
                  <button
                    onClick={() => runAction('restrict-user', () => restrictAdminUser(userId, restrictReason || 'No reason provided'))}
                    disabled={busyAction !== null}
                    className="px-3 py-2 rounded-md border border-red-500/30 bg-red-500/15 text-xs font-semibold text-red-300 hover:bg-red-500/25 disabled:opacity-50"
                  >
                    <ShieldAlert className="inline-block w-3.5 h-3.5 mr-1" />
                    Restrict User
                  </button>
                ) : (
                  <button
                    onClick={() => runAction('unrestrict-user', () => unrestrictAdminUser(userId))}
                    disabled={busyAction !== null}
                    className="px-3 py-2 rounded-md border border-emerald-500/30 bg-emerald-500/15 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    Unrestrict User
                  </button>
                )}

                {profile.is_moderator && !profile.discount?.mod_discount_enabled && (
                  <button
                    onClick={() => runAction('enable-mod-discount', () => enableModeratorDiscount(userId))}
                    disabled={busyAction !== null}
                    className="px-3 py-2 rounded-md border border-cyan-500/30 bg-cyan-500/15 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                  >
                    Enable Mod Discount
                  </button>
                )}

                {profile.is_moderator && profile.discount?.mod_discount_enabled && (
                  <button
                    onClick={() => runAction('disable-mod-discount', () => disableModeratorDiscount(userId))}
                    disabled={busyAction !== null}
                    className="px-3 py-2 rounded-md border border-cyan-500/30 bg-cyan-500/15 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                  >
                    Disable Mod Discount
                  </button>
                )}
              </div>

              {!profile.is_restricted && (
                <label className="block mt-3 text-xs text-zinc-400">
                  Restriction Reason
                  <input
                    value={restrictReason}
                    onChange={(e) => setRestrictReason(e.target.value)}
                    placeholder="Reason to store in moderation logs"
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>
              )}
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="m-0 text-sm font-semibold text-white">Subscription & Credits</h2>
              <p className="m-0 mt-1 text-xs text-zinc-500">Credits and manual subscription controls.</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={handleAddCredits}
                  disabled={busyAction !== null}
                  className="px-3 py-2 rounded-md border border-emerald-500/30 bg-emerald-500/15 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  Add Credits
                </button>
                <button
                  onClick={handleGrantSubscription}
                  disabled={busyAction !== null}
                  className="px-3 py-2 rounded-md border border-cyan-500/30 bg-cyan-500/15 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  Grant Subscription
                </button>
                <button
                  onClick={handleExtendSubscription}
                  disabled={busyAction !== null}
                  className="px-3 py-2 rounded-md border border-cyan-500/30 bg-cyan-500/15 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  Extend Subscription
                </button>
                <button
                  onClick={handleChangeTier}
                  disabled={busyAction !== null}
                  className="px-3 py-2 rounded-md border border-cyan-500/30 bg-cyan-500/15 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  Change Tier
                </button>
                <button
                  onClick={() => runAction('cancel-subscription', () => cancelUserSubscription(userId))}
                  disabled={busyAction !== null}
                  className="px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/15 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
                >
                  Cancel Subscription
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="m-0 text-sm font-semibold text-white">Discounts & Password</h2>
              <p className="m-0 mt-1 text-xs text-zinc-500">Grant promotional discounts and reset credentials.</p>

              <div className="mt-3 grid sm:grid-cols-3 gap-3">
                <label className="text-xs text-zinc-400">
                  Discount %
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  Months
                  <input
                    type="number"
                    min={1}
                    value={discountMonths}
                    onChange={(e) => setDiscountMonths(Number(e.target.value))}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => runAction('apply-discount', () => applyUserDiscount(userId, discountPercent, discountMonths))}
                    disabled={busyAction !== null}
                    className="h-9 px-3 rounded-md border border-violet-500/30 bg-violet-500/15 text-xs font-semibold text-violet-300 hover:bg-violet-500/25 disabled:opacity-50"
                  >
                    <Sparkles className="inline-block w-3.5 h-3.5 mr-1" />
                    Apply Discount
                  </button>
                  <button
                    onClick={() => runAction('free-month', () => grantUserFreeMonth(userId))}
                    disabled={busyAction !== null}
                    className="h-9 px-3 rounded-md border border-violet-500/30 bg-violet-500/15 text-xs font-semibold text-violet-300 hover:bg-violet-500/25 disabled:opacity-50"
                  >
                    Free Month
                  </button>
                </div>
              </div>

              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <label className="text-xs text-zinc-400">
                  New Password
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  Confirm Password
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleResetPassword}
                  disabled={busyAction !== null}
                  className="px-3 py-2 rounded-md border border-cyan-500/30 bg-cyan-500/15 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  Reset Password
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="m-0 text-sm font-semibold text-red-300">Danger Zone</h2>
              <p className="m-0 mt-1 text-xs text-zinc-500">
                Deleting a user schedules account removal; active subscriptions are respected until billing end.
              </p>

              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleDeleteUser}
                  disabled={busyAction !== null}
                  className="px-3 py-2 rounded-md border border-red-500/30 bg-red-500/15 text-xs font-semibold text-red-300 hover:bg-red-500/25 disabled:opacity-50"
                >
                  <Trash2 className="inline-block w-3.5 h-3.5 mr-1" />
                  Delete User
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h2 className="m-0 text-sm font-semibold text-white">Subscription History ({subscriptionHistory.length})</h2>
              </div>
              <div className="overflow-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-zinc-900/80">
                    <tr className="text-left text-zinc-400 text-xs uppercase tracking-wide">
                      <th className="px-3 py-2 border-b border-zinc-800">Tier</th>
                      <th className="px-3 py-2 border-b border-zinc-800">Status</th>
                      <th className="px-3 py-2 border-b border-zinc-800">Start</th>
                      <th className="px-3 py-2 border-b border-zinc-800">End</th>
                      <th className="px-3 py-2 border-b border-zinc-800">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptionHistory.map((entry) => (
                      <tr key={entry.id} className="border-b border-zinc-800/60">
                        <td className="px-3 py-2 text-zinc-200">{entry.tier || 'N/A'}</td>
                        <td className="px-3 py-2 text-zinc-300">{entry.status}</td>
                        <td className="px-3 py-2 text-zinc-500 text-xs">{formatDate(entry.start_date)}</td>
                        <td className="px-3 py-2 text-zinc-500 text-xs">{formatDate(entry.end_date)}</td>
                        <td className="px-3 py-2 text-zinc-300">{entry.amount_usd != null ? `$${entry.amount_usd.toFixed(2)}` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </PageLayout>
  )
}
