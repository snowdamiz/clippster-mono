import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, Copy, KeyRound, Loader2, Plus, RefreshCw, XCircle } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { generateBetaCodes, listBetaCodes, type BetaCode, type BetaCodeStats } from '@/services/adminApi'
import { formatDateTime, formatWalletAddress } from './adminFormat'

export function AdminBetaCodesPage() {
  const [rows, setRows] = useState<BetaCode[]>([])
  const [stats, setStats] = useState<BetaCodeStats>({ total: 0, used: 0, available: 0 })
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [count, setCount] = useState(10)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const availableCodes = useMemo(() => rows.filter((x) => !x.used), [rows])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listBetaCodes()
      setRows(data.codes)
      setStats(data.stats)
    } catch (err: any) {
      setError(err?.message || 'Failed to load beta codes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleGenerate() {
    if (!Number.isFinite(count) || count < 1 || count > 100) {
      setError('Count must be between 1 and 100')
      return
    }

    setGenerating(true)
    setError(null)
    try {
      await generateBetaCodes(count)
      await load()
    } catch (err: any) {
      setError(err?.message || 'Failed to generate beta codes')
    } finally {
      setGenerating(false)
    }
  }

  async function copyCode(code: string, id: number) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId(null), 1600)
    } catch {
      setError('Failed to copy code to clipboard')
    }
  }

  async function copyAllAvailable() {
    const content = availableCodes.map((x) => x.code).join('\n')
    if (!content) {
      setError('No available beta codes to copy')
      return
    }
    try {
      await navigator.clipboard.writeText(content)
    } catch {
      setError('Failed to copy available codes')
    }
  }

  return (
    <PageLayout
      icon={KeyRound}
      title="Beta Codes"
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
          <h1 className="m-0 text-2xl font-bold text-white">Beta Codes</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">Generate and manage beta access codes.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Total Codes</p>
            <p className="m-0 mt-2 text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Available</p>
            <p className="m-0 mt-2 text-2xl font-bold text-emerald-300">{stats.available}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Used</p>
            <p className="m-0 mt-2 text-2xl font-bold text-amber-300">{stats.used}</p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 flex flex-wrap items-center gap-3">
          <div>
            <p className="m-0 text-sm font-semibold text-white">Generate Beta Codes</p>
            <p className="m-0 mt-0.5 text-xs text-zinc-500">Create new codes for beta testers.</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <input
              type="number"
              value={count}
              min={1}
              max={100}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-20 h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
            />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Generate
            </button>
            {availableCodes.length > 0 && (
              <button
                onClick={copyAllAvailable}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-zinc-100 border border-zinc-700 hover:bg-zinc-800"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy All
              </button>
            )}
          </div>
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
            Loading beta codes...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-zinc-400">No beta codes generated yet.</div>
        ) : (
          <div className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
            <table className="w-full min-w-[980px] text-sm border-collapse">
              <thead className="bg-zinc-900/80">
                <tr className="text-left text-zinc-400">
                  <th className="px-3 py-2 border-b border-zinc-800">Code</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Status</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Used By</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Created</th>
                  <th className="px-3 py-2 border-b border-zinc-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-800/70">
                    <td className="px-3 py-2">
                      <code className="inline-block text-amber-200 bg-zinc-800 px-2 py-1 rounded text-xs">{row.code}</code>
                    </td>
                    <td className="px-3 py-2">
                      {row.used ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border bg-amber-500/20 text-amber-300 border-amber-500/30">
                          <XCircle className="w-3 h-3" />
                          Used
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Available
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-300 text-xs">
                      {row.used_by?.email || formatWalletAddress(row.used_by?.wallet_address) || '-'}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 text-xs">{formatDateTime(row.created_at)}</td>
                    <td className="px-3 py-2">
                      {!row.used ? (
                        <button
                          onClick={() => copyCode(row.code, row.id)}
                          className="px-2 py-1 rounded border border-zinc-700 text-zinc-200 text-xs hover:bg-zinc-800"
                        >
                          {copiedId === row.id ? (
                            <>
                              <Check className="inline-block w-3 h-3 mr-1 text-emerald-300" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="inline-block w-3 h-3 mr-1" />
                              Copy
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-500">{row.used_at ? `Used ${formatDateTime(row.used_at)}` : 'Used'}</span>
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
