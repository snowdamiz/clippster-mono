import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Database, Loader2, RefreshCw } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { api } from '@/lib/api'

interface AdminJsonInspectorPageProps {
  title: string
  endpoint: string
  description: string
}

export function AdminJsonInspectorPage({ title, endpoint, description }: AdminJsonInspectorPageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.get(endpoint)
      setData(result)
    } catch (err: any) {
      setError(err?.message || `Failed to load ${endpoint}`)
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    load()
  }, [load])

  return (
    <PageLayout
      icon={Database}
      title={title}
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
      <div className="p-6">
        <div className="mb-4">
          <h1 className="m-0 text-xl font-semibold text-white">{title}</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">{description}</p>
        </div>
        {loading ? (
          <div className="py-12 flex items-center justify-center text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        ) : (
          <pre className="m-0 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 text-xs text-zinc-300 overflow-auto max-h-[70vh]">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </PageLayout>
  )
}
