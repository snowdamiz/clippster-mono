import { useCallback, useEffect, useState } from 'react'
import { Activity, AlertTriangle, BarChart3, Loader2, RefreshCw } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { getAnalyticsStats, type AnalyticsStats } from '@/services/adminApi'
import { formatNumber, toTitleCase } from './adminFormat'

export function AdminAnalyticsPage() {
  const [stats, setStats] = useState<AnalyticsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAnalyticsStats()
      setStats(Object.keys(data).length ? data : null)
    } catch (err: any) {
      setError(err?.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const entries = stats ? Object.entries(stats) : []

  return (
    <PageLayout
      icon={BarChart3}
      title="Analytics"
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
          <h1 className="m-0 text-2xl font-bold text-white">Analytics</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">Track key user actions and events.</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading && !stats ? (
          <div className="py-12 flex items-center justify-center text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading analytics...
          </div>
        ) : entries.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {entries.map(([eventType, eventStats]) => (
              <article key={eventType} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-md bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-emerald-300" />
                  </div>
                  <h3 className="m-0 text-sm font-semibold text-white">{toTitleCase(eventType)}</h3>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md bg-zinc-800/60 p-2 text-center">
                    <p className="m-0 text-[10px] uppercase tracking-wide text-zinc-400">Today</p>
                    <p className="m-0 mt-1 text-lg font-bold text-zinc-100">{formatNumber(eventStats.today)}</p>
                  </div>
                  <div className="rounded-md bg-zinc-800/60 p-2 text-center">
                    <p className="m-0 text-[10px] uppercase tracking-wide text-zinc-400">This Week</p>
                    <p className="m-0 mt-1 text-lg font-bold text-zinc-100">{formatNumber(eventStats.this_week)}</p>
                  </div>
                  <div className="rounded-md bg-emerald-500/15 border border-emerald-500/20 p-2 text-center">
                    <p className="m-0 text-[10px] uppercase tracking-wide text-emerald-300">Total</p>
                    <p className="m-0 mt-1 text-lg font-bold text-emerald-300">{formatNumber(eventStats.total)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-zinc-400">No analytics data available.</div>
        )}
      </div>
    </PageLayout>
  )
}
