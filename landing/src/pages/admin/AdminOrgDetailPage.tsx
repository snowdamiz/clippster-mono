import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CreditCard,
  Loader2,
  Shield,
  Trash2,
  User,
  Users,
} from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import {
  addOrganizationCredits,
  cancelOrganizationSubscription,
  deleteOrganization,
  getAdminOrganizationDetails,
  grantOrganizationSubscription,
  setOrganizationSeats,
  setOrganizationCredits,
  updateOrganizationSubscription,
  type AdminOrgDetails,
} from '@/services/adminApi'
import { formatDate, formatHoursToMinutes } from './adminFormat'

export function AdminOrgDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const orgId = Number(id)

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [org, setOrg] = useState<AdminOrgDetails | null>(null)

  const load = useCallback(async () => {
    if (!Number.isFinite(orgId) || orgId <= 0) {
      setError('Invalid organization id')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await getAdminOrganizationDetails(orgId)
      setOrg(result)
    } catch (err: any) {
      setError(err?.message || 'Failed to load organization details')
      setOrg(null)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    load()
  }, [load])

  async function runAction(key: string, fn: () => Promise<unknown>) {
    setBusy(key)
    setError(null)
    try {
      await fn()
      await load()
    } catch (err: any) {
      setError(err?.message || `Failed to run action: ${key}`)
    } finally {
      setBusy(null)
    }
  }

  async function handleAddCredits() {
    const raw = window.prompt('Hours to add', '25')
    if (!raw) return
    const value = Number(raw)
    if (!Number.isFinite(value) || value < 0) return
    await runAction('add-credits', () => addOrganizationCredits(orgId, value))
  }

  async function handleSetCredits() {
    const raw = window.prompt('Set hours remaining', '100')
    if (!raw) return
    const value = Number(raw)
    if (!Number.isFinite(value) || value < 0) return
    await runAction('set-credits', () => setOrganizationCredits(orgId, value))
  }

  async function handleGrantSubscription() {
    const tier = window.prompt('Tier: solo | enterprise_base | enterprise_ai | enterprise_unlimited', org?.subscription?.tier || 'enterprise_base')
    if (!tier) return
    const daysRaw = window.prompt('Days', '30')
    const days = Number(daysRaw || '30')
    if (!Number.isFinite(days) || days <= 0) return

    await runAction('grant-subscription', () =>
      grantOrganizationSubscription(orgId, {
        tier,
        days,
        grant_credits: true,
      }),
    )
  }

  async function handleUpdateSubscription() {
    const seatsRaw = window.prompt('Max seats (0 for unlimited)', String(org?.subscription?.max_seats || 0))
    const creditsRaw = window.prompt('Monthly credits', String(org?.subscription?.monthly_credits || 0))
    const priceRaw = window.prompt('Admin price cents', String(org?.subscription?.admin_price_cents || 0))
    const tier = window.prompt('Tier (leave blank to keep current)', org?.subscription?.tier || '')

    const maxSeats = Number(seatsRaw || '0')
    const monthlyCredits = Number(creditsRaw || '0')
    const adminPriceCents = Number(priceRaw || '0')

    if (!Number.isFinite(maxSeats) || !Number.isFinite(monthlyCredits) || !Number.isFinite(adminPriceCents)) return

    await runAction('update-subscription', () =>
      updateOrganizationSubscription(orgId, {
        max_seats: maxSeats,
        monthly_credits: monthlyCredits,
        admin_price_cents: adminPriceCents,
        tier: tier || undefined,
        immediate: true,
      }),
    )
  }

  async function handleSetSeats() {
    const seatsRaw = window.prompt('Set max seats (0 for unlimited)', '0')
    if (!seatsRaw) return
    const seats = Number(seatsRaw)
    if (!Number.isFinite(seats) || seats < 0) return
    await runAction('set-seats', () => setOrganizationSeats(orgId, seats === 0 ? null : seats))
  }

  async function handleCancelSubscription() {
    const ok = window.confirm('Cancel organization subscription?')
    if (!ok) return
    await runAction('cancel-subscription', () => cancelOrganizationSubscription(orgId))
  }

  async function handleDeleteOrganization() {
    const ok = window.confirm('Delete this organization? Active subscriptions must be cancelled first.')
    if (!ok) return
    await runAction('delete-org', () => deleteOrganization(orgId))
  }

  return (
    <PageLayout
      icon={Building2}
      title={org?.name || 'Organization Detail'}
      actions={
        <Link
          to="/admin/organizations"
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
            Loading organization...
          </div>
        ) : !org ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-zinc-400">Organization not found.</div>
        ) : (
          <>
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="m-0 text-2xl font-bold text-white">{org.name}</h1>
                  <p className="m-0 mt-1 text-sm text-zinc-400">{org.description || 'No description'}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex px-2 py-1 rounded text-xs font-semibold border ${
                      org.subscription?.status === 'active'
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                        : 'bg-zinc-700/70 border-zinc-600 text-zinc-300'
                    }`}
                  >
                    {org.subscription?.status || 'none'}
                  </span>

                  {org.owner && (
                    <button
                      onClick={() => navigate(`/admin/users/${org.owner!.id}`)}
                      className="px-3 py-1.5 rounded-md border border-zinc-700 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
                    >
                      View Owner
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-zinc-800 bg-[#0c0c0f] p-3">
                  <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Members</p>
                  <p className="m-0 mt-1 text-lg font-semibold text-zinc-100">{org.member_count}</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-[#0c0c0f] p-3">
                  <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Tier</p>
                  <p className="m-0 mt-1 text-lg font-semibold text-zinc-100">{org.subscription?.tier || 'none'}</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-[#0c0c0f] p-3">
                  <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Credits</p>
                  <p className="m-0 mt-1 text-lg font-semibold text-zinc-100">
                    {formatHoursToMinutes(org.credits?.hours_remaining || 0)}
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-[#0c0c0f] p-3">
                  <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Created</p>
                  <p className="m-0 mt-1 text-sm font-semibold text-zinc-100">{formatDate(org.created_at)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="m-0 text-sm font-semibold text-white">Admin Actions</h2>
              <p className="m-0 mt-1 text-xs text-zinc-500">Credits, subscription, and seat controls.</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={handleAddCredits}
                  disabled={busy !== null}
                  className="px-3 py-2 rounded-md border border-emerald-500/30 bg-emerald-500/15 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  <CreditCard className="inline-block w-3.5 h-3.5 mr-1" />
                  Add Credits
                </button>
                <button
                  onClick={handleSetCredits}
                  disabled={busy !== null}
                  className="px-3 py-2 rounded-md border border-cyan-500/30 bg-cyan-500/15 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  Set Credits
                </button>
                <button
                  onClick={handleGrantSubscription}
                  disabled={busy !== null}
                  className="px-3 py-2 rounded-md border border-cyan-500/30 bg-cyan-500/15 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  Grant Subscription
                </button>
                <button
                  onClick={handleUpdateSubscription}
                  disabled={busy !== null}
                  className="px-3 py-2 rounded-md border border-cyan-500/30 bg-cyan-500/15 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  Update Subscription
                </button>
                <button
                  onClick={handleSetSeats}
                  disabled={busy !== null}
                  className="px-3 py-2 rounded-md border border-zinc-600 bg-zinc-700/50 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
                >
                  <Users className="inline-block w-3.5 h-3.5 mr-1" />
                  Set Seats
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={busy !== null}
                  className="px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/15 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
                >
                  Cancel Subscription
                </button>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleDeleteOrganization}
                  disabled={busy !== null}
                  className="px-3 py-2 rounded-md border border-red-500/30 bg-red-500/15 text-xs font-semibold text-red-300 hover:bg-red-500/25 disabled:opacity-50"
                >
                  <Trash2 className="inline-block w-3.5 h-3.5 mr-1" />
                  Delete Organization
                </button>
              </div>
            </section>

            {org.owner && (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <h2 className="m-0 text-sm font-semibold text-white">Owner</h2>
                <div className="mt-3 rounded-lg border border-zinc-800 bg-[#0c0c0f] p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
                      <User className="w-4 h-4 text-cyan-300" />
                    </div>
                    <div>
                      <p className="m-0 text-zinc-100 font-medium">{org.owner.name || 'Unnamed'}</p>
                      <p className="m-0 mt-0.5 text-xs text-zinc-500">{org.owner.email || `User #${org.owner.id}`}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/admin/users/${org.owner!.id}`)}
                    className="px-3 py-1.5 rounded-md border border-zinc-700 text-xs font-semibold text-zinc-200 hover:bg-zinc-800"
                  >
                    Open Profile
                  </button>
                </div>
              </section>
            )}

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="m-0 text-sm font-semibold text-white">Members ({org.members.length})</h2>
              </div>
              <div className="overflow-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-zinc-900/80">
                    <tr className="text-left text-zinc-400 text-xs uppercase tracking-wide">
                      <th className="px-3 py-2 border-b border-zinc-800">User</th>
                      <th className="px-3 py-2 border-b border-zinc-800">Role</th>
                      <th className="px-3 py-2 border-b border-zinc-800">Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {org.members.map((member) => (
                      <tr key={member.id} className="border-b border-zinc-800/60">
                        <td className="px-3 py-2 text-zinc-300">{member.user?.email || member.user?.name || `User #${member.user_id}`}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${
                              member.role === 'owner' || member.role === 'admin'
                                ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                                : 'bg-zinc-700/70 border-zinc-600 text-zinc-300'
                            }`}
                          >
                            {member.role === 'owner' || member.role === 'admin' ? <Shield className="w-3.5 h-3.5" /> : null}
                            {member.role}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {member.user ? (
                            <button
                              onClick={() => navigate(`/admin/users/${member.user!.id}`)}
                              className="px-2 py-1 rounded border border-zinc-700 text-xs text-zinc-200 hover:bg-zinc-800"
                            >
                              Open User
                            </button>
                          ) : (
                            <span className="text-xs text-zinc-500">N/A</span>
                          )}
                        </td>
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
