import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Building2, CreditCard, Loader2, RefreshCw, Users } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import {
  addOrganizationCredits,
  listAdminOrganizations,
  setOrganizationCredits,
  type AdminOrganization,
} from '@/services/adminApi'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

function toMinutes(hours: number) {
  return Math.round(hours * 60)
}

export function AdminOrganizationsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orgs, setOrgs] = useState<AdminOrganization[]>([])
  const [busyId, setBusyId] = useState<number | null>(null)

  const fetchOrgs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAdminOrganizations()
      setOrgs(data)
    } catch (err: any) {
      setError(err?.message || 'Failed to load organizations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrgs()
  }, [fetchOrgs])

  async function handleAddCredits(orgId: number) {
    const raw = window.prompt('Hours to add (example: 25)')
    if (!raw) return
    const hours = Number(raw)
    if (!Number.isFinite(hours) || hours < 0) return
    setBusyId(orgId)
    try {
      await addOrganizationCredits(orgId, hours)
      await fetchOrgs()
    } finally {
      setBusyId(null)
    }
  }

  async function handleSetCredits(orgId: number) {
    const raw = window.prompt('Set total hours remaining')
    if (!raw) return
    const hours = Number(raw)
    if (!Number.isFinite(hours) || hours < 0) return
    setBusyId(orgId)
    try {
      await setOrganizationCredits(orgId, hours)
      await fetchOrgs()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageLayout
      icon={Building2}
      title="Organization Management"
      actions={
        <button
          onClick={fetchOrgs}
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
          <h1 className="m-0 text-xl font-semibold text-white">Organization Management</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">Manage organizations, subscription state, and credit pools</p>
        </div>

        {loading && !orgs.length ? (
          <div className="py-12 flex items-center justify-center text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading organizations...
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
                  <th className="px-3 py-2 border-b border-zinc-800">Name</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Subscription</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Seats</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Credits</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Created</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr
                    key={org.id}
                    className="border-b border-zinc-800/80 hover:bg-zinc-800/35 cursor-pointer"
                    onClick={() => navigate(`/admin/organizations/${org.id}`)}
                  >
                    <td className="px-3 py-2 text-zinc-300">#{org.id}</td>
                    <td className="px-3 py-2">
                      <p className="m-0 text-zinc-200 font-medium">{org.name}</p>
                      {org.description && <p className="m-0 mt-1 text-xs text-zinc-500">{org.description}</p>}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      {org.subscription_status || 'none'} {org.subscription_tier ? `(${org.subscription_tier})` : ''}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {org.member_count}
                        {org.max_seats ? ` / ${org.max_seats}` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-300">
                      <span className="inline-flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5" />
                        {toMinutes(org.credits.hours_remaining)} min
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{formatDate(org.created_at)}</td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1">
                        <button
                          disabled={busyId === org.id}
                          onClick={() => handleAddCredits(org.id)}
                          className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 text-xs border border-emerald-500/25 hover:bg-emerald-500/25 disabled:opacity-50"
                        >
                          Add Credits
                        </button>
                        <button
                          disabled={busyId === org.id}
                          onClick={() => handleSetCredits(org.id)}
                          className="px-2 py-1 rounded bg-cyan-500/15 text-cyan-300 text-xs border border-cyan-500/25 hover:bg-cyan-500/25 disabled:opacity-50"
                        >
                          Set Credits
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
