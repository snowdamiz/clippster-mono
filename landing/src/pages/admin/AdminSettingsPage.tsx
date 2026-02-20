import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Loader2, Radio, RefreshCw, Settings } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import {
  getAdminSettings,
  getFreeTierBranding,
  saveFreeTierBranding,
  updateAdminSetting,
  type FeatureFlags,
  type FreeTierBranding,
} from '@/services/adminApi'
import { toTitleCase } from './adminFormat'

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function normalizeBranding(data: FreeTierBranding): FreeTierBranding {
  return {
    watermark_url: data.watermark_url || '',
    intro_url: data.intro_url || '',
    outro_url: data.outro_url || '',
  }
}

export function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [savingFlagKey, setSavingFlagKey] = useState<string | null>(null)
  const [savingBranding, setSavingBranding] = useState(false)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({})
  const [branding, setBranding] = useState<FreeTierBranding>({
    watermark_url: '',
    intro_url: '',
    outro_url: '',
  })
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [settingsData, brandingData] = await Promise.all([getAdminSettings(), getFreeTierBranding()])
      setSettings(settingsData.settings)
      setFeatureFlags(settingsData.feature_flags)
      setBranding(normalizeBranding(brandingData))
    } catch (err: any) {
      setError(err?.message || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const flagEntries = useMemo(() => {
    return Object.entries(featureFlags).filter(([, value]) => asBoolean(value) !== null)
  }, [featureFlags])

  const otherSettingsEntries = useMemo(() => {
    return Object.entries(settings).sort((a, b) => a[0].localeCompare(b[0]))
  }, [settings])

  async function toggleFlag(key: string, current: unknown) {
    const parsed = asBoolean(current)
    if (parsed === null) return

    setSavingFlagKey(key)
    setError(null)
    try {
      await updateAdminSetting(key, !parsed)
      setFeatureFlags((prev) => ({ ...prev, [key]: !parsed }))
    } catch (err: any) {
      setError(err?.message || `Failed to update ${key}`)
    } finally {
      setSavingFlagKey(null)
    }
  }

  async function saveBranding() {
    setSavingBranding(true)
    setError(null)
    try {
      await saveFreeTierBranding(branding)
    } catch (err: any) {
      setError(err?.message || 'Failed to save free-tier branding')
    } finally {
      setSavingBranding(false)
    }
  }

  const brandingConfigured = Boolean(branding.watermark_url || branding.intro_url || branding.outro_url)

  return (
    <PageLayout
      icon={Settings}
      title="Settings"
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
      <div className="p-6 space-y-4 max-w-[1300px] w-full mx-auto">
        <div>
          <h1 className="m-0 text-2xl font-bold text-white">Settings</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">Feature flags and UI configuration.</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 flex items-center justify-center text-zinc-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading settings...
          </div>
        ) : (
          <>
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
              <div>
                <h2 className="m-0 text-sm font-semibold text-white">Feature Flags</h2>
                <p className="m-0 mt-1 text-xs text-zinc-500">Toggle platform feature visibility.</p>
              </div>

              {flagEntries.length === 0 ? (
                <p className="m-0 text-sm text-zinc-400">No boolean feature flags found.</p>
              ) : (
                <div className="space-y-2">
                  {flagEntries.map(([key, value]) => {
                    const enabled = asBoolean(value) === true
                    return (
                      <div key={key} className="rounded-lg border border-zinc-800 bg-[#0c0c0f] px-3 py-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="m-0 text-sm font-medium text-zinc-200">{toTitleCase(key)}</p>
                          <p className="m-0 mt-0.5 text-xs text-zinc-500">{key}</p>
                        </div>
                        <button
                          onClick={() => toggleFlag(key, value)}
                          disabled={savingFlagKey === key}
                          className={`h-8 px-3 rounded-md text-xs font-semibold border disabled:opacity-50 ${
                            enabled
                              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                          }`}
                        >
                          {savingFlagKey === key ? (
                            <Loader2 className="inline-block w-3.5 h-3.5 animate-spin mr-1" />
                          ) : enabled ? (
                            <Check className="inline-block w-3.5 h-3.5 mr-1" />
                          ) : (
                            <Radio className="inline-block w-3.5 h-3.5 mr-1" />
                          )}
                          {enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="m-0 text-sm font-semibold text-white">Free Tier Branding</h2>
                  <p className="m-0 mt-1 text-xs text-zinc-500">Global branding enforced for free-tier users.</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                    brandingConfigured
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}
                >
                  {brandingConfigured ? 'Configured' : 'Not Set'}
                </span>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <label className="text-xs text-zinc-400">
                  Watermark URL
                  <input
                    value={branding.watermark_url}
                    onChange={(e) => setBranding((prev) => ({ ...prev, watermark_url: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  Intro URL
                  <input
                    value={branding.intro_url}
                    onChange={(e) => setBranding((prev) => ({ ...prev, intro_url: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>
                <label className="text-xs text-zinc-400">
                  Outro URL
                  <input
                    value={branding.outro_url}
                    onChange={(e) => setBranding((prev) => ({ ...prev, outro_url: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={saveBranding}
                  disabled={savingBranding}
                  className="px-3 py-2 rounded-md text-xs font-semibold text-black bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50"
                >
                  {savingBranding ? <Loader2 className="inline-block w-3.5 h-3.5 animate-spin mr-1" /> : null}
                  Save Branding
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
              <div>
                <h2 className="m-0 text-sm font-semibold text-white">Raw Settings</h2>
                <p className="m-0 mt-1 text-xs text-zinc-500">Read-only key/value snapshot from the app settings store.</p>
              </div>

              {otherSettingsEntries.length === 0 ? (
                <p className="m-0 text-sm text-zinc-400">No settings found.</p>
              ) : (
                <div className="overflow-auto rounded-lg border border-zinc-800">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead className="bg-zinc-900/80">
                      <tr className="text-left text-zinc-400 text-xs uppercase tracking-wide">
                        <th className="px-3 py-2 border-b border-zinc-800">Key</th>
                        <th className="px-3 py-2 border-b border-zinc-800">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otherSettingsEntries.map(([key, value]) => (
                        <tr key={key} className="border-b border-zinc-800/60">
                          <td className="px-3 py-2 text-zinc-300 font-mono text-xs">{key}</td>
                          <td className="px-3 py-2 text-zinc-200 text-xs break-all">{String(value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PageLayout>
  )
}
