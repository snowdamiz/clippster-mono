import { useCallback, useEffect, useState } from 'react'
import { Activity, AlertTriangle, Layers, Loader2, RefreshCw } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { getAiUsageStats, type AiUsageResponse } from '@/services/adminApi'
import { formatDateTime, formatDurationSeconds, formatNumber, formatWalletAddress, toTitleCase } from './adminFormat'

export function AdminAiUsagePage() {
  const [data, setData] = useState<AiUsageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const stats = await getAiUsageStats()
      setData(stats)
    } catch (err: any) {
      setError(err?.message || 'Failed to load AI usage stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <PageLayout
      icon={Activity}
      title="AI Usage"
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
          <h1 className="m-0 text-2xl font-bold text-white">AI Usage Stats</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">Monitor AI service consumption and performance.</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="py-12 flex items-center justify-center text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading AI usage stats...
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Total Tokens</p>
                <p className="m-0 mt-2 text-2xl font-bold text-white">{formatNumber(data.stats.total_tokens)}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Total Duration</p>
                <p className="m-0 mt-2 text-2xl font-bold text-white">{formatDurationSeconds(data.stats.total_duration)}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Active Providers</p>
                <p className="m-0 mt-2 text-2xl font-bold text-white">{data.stats.provider_stats.length}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <h3 className="m-0 text-sm font-semibold text-white">Usage by Model</h3>
                </div>
                <div className="overflow-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="text-left text-zinc-400 text-xs uppercase tracking-wide">
                        <th className="px-3 py-2 border-b border-zinc-800">Model</th>
                        <th className="px-3 py-2 border-b border-zinc-800 text-right">Requests</th>
                        <th className="px-3 py-2 border-b border-zinc-800 text-right">Tokens</th>
                        <th className="px-3 py-2 border-b border-zinc-800 text-right">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.stats.model_stats.map((row) => (
                        <tr key={`${row.provider}:${row.model}`} className="border-b border-zinc-800/60">
                          <td className="px-3 py-2">
                            <p className="m-0 text-zinc-100">{row.model}</p>
                            <p className="m-0 mt-0.5 text-xs text-zinc-500">{row.provider}</p>
                          </td>
                          <td className="px-3 py-2 text-right text-zinc-300">{formatNumber(row.count)}</td>
                          <td className="px-3 py-2 text-right text-zinc-300">{formatNumber(row.total_tokens)}</td>
                          <td className="px-3 py-2 text-right text-zinc-300">{formatDurationSeconds(row.total_duration)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h3 className="m-0 text-sm font-semibold text-white">Usage by Operation</h3>
                </div>
                <div className="overflow-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="text-left text-zinc-400 text-xs uppercase tracking-wide">
                        <th className="px-3 py-2 border-b border-zinc-800">Operation</th>
                        <th className="px-3 py-2 border-b border-zinc-800 text-right">Requests</th>
                        <th className="px-3 py-2 border-b border-zinc-800 text-right">Tokens</th>
                        <th className="px-3 py-2 border-b border-zinc-800 text-right">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.stats.operation_stats.map((row) => (
                        <tr key={row.operation} className="border-b border-zinc-800/60">
                          <td className="px-3 py-2 text-zinc-100">{toTitleCase(row.operation)}</td>
                          <td className="px-3 py-2 text-right text-zinc-300">{formatNumber(row.count)}</td>
                          <td className="px-3 py-2 text-right text-zinc-300">{formatNumber(row.total_tokens)}</td>
                          <td className="px-3 py-2 text-right text-zinc-300">{formatDurationSeconds(row.total_duration)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <h3 className="m-0 text-sm font-semibold text-white">Recent Activity</h3>
              </div>
              <div className="overflow-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="text-left text-zinc-400 text-xs uppercase tracking-wide">
                      <th className="px-3 py-2 border-b border-zinc-800">Time</th>
                      <th className="px-3 py-2 border-b border-zinc-800">User</th>
                      <th className="px-3 py-2 border-b border-zinc-800">Operation</th>
                      <th className="px-3 py-2 border-b border-zinc-800">Provider / Model</th>
                      <th className="px-3 py-2 border-b border-zinc-800">Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_logs.map((log) => (
                      <tr key={log.id} className="border-b border-zinc-800/60">
                        <td className="px-3 py-2 text-zinc-500">{formatDateTime(log.created_at)}</td>
                        <td className="px-3 py-2 text-zinc-300 font-mono text-xs">{formatWalletAddress(log.user_wallet)}</td>
                        <td className="px-3 py-2 text-zinc-200">{toTitleCase(log.operation)}</td>
                        <td className="px-3 py-2">
                          <p className="m-0 text-zinc-200">{log.provider}</p>
                          <p className="m-0 mt-0.5 text-xs text-zinc-500">{log.model}</p>
                        </td>
                        <td className="px-3 py-2 text-zinc-300">
                          <p className="m-0">{formatNumber(log.tokens)} tokens</p>
                          <p className="m-0 mt-0.5 text-xs text-zinc-500">{formatDurationSeconds(log.duration)}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </PageLayout>
  )
}
