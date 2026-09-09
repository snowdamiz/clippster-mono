import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'

interface SocialAccount {
  id: number
  platform: string
  username: string
  display_name?: string | null
  profile_image_url?: string | null
  is_active?: boolean
}

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'x', label: 'X (Twitter)' },
] as const

type PlatformId = (typeof PLATFORMS)[number]['id']

function platformLabel(platform: string): string {
  const found = PLATFORMS.find((p) => p.id === platform || (platform === 'twitter' && p.id === 'x'))
  return found?.label || platform
}

export function AccountSocial() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<PlatformId | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    try {
      const res = await api.get<{
        success: boolean
        social_accounts?: SocialAccount[]
        accounts?: SocialAccount[]
        error?: string
      }>('/user/social-accounts')
      if (res.success) {
        setAccounts(res.social_accounts || res.accounts || [])
      }
    } catch {
      setError('Failed to load social accounts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  async function connect(platform: PlatformId) {
    setConnecting(platform)
    setError(null)
    try {
      const res = await api.post<{
        success: boolean
        auth_url?: string
        connection_id?: string
        error?: string
      }>('/user/social/connect-url', {
        platform,
        return_mode: 'web',
        return_url: `${window.location.origin}/oauth/callback`,
        return_context: 'web',
      })

      if (!res.success || !res.auth_url) {
        throw new Error(res.error || 'Failed to start OAuth')
      }

      // useOAuthPopup is org-scoped; use a simple popup + poll for personal accounts
      const width = 600
      const height = 720
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      const popup = window.open(
        res.auth_url,
        `oauth-${platform}`,
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`,
      )

      if (!popup || !res.connection_id) {
        // Popup blocked — full redirect fallback
        window.location.href = res.auth_url
        return
      }

      const connectionId = res.connection_id
      const startedAt = Date.now()
      let popupClosedAt: number | null = null

      while (true) {
        if (popup.closed) {
          popupClosedAt = popupClosedAt || Date.now()
        } else {
          popupClosedAt = null
        }

        const status = await api.get<{
          success: boolean
          status?: string
          error?: string
        }>('/user/social/connect-status', {
          params: { connection_id: connectionId },
        })

        if (!status.success) throw new Error(status.error || 'Status check failed')

        if (status.status === 'synced') {
          await api.post('/user/social/complete-connect', {
            connection_id: connectionId,
            platform,
          })
          if (!popup.closed) popup.close()
          await loadAccounts()
          break
        }

        if (status.status === 'failed' || status.status === 'expired') {
          throw new Error(status.error || 'Connection failed')
        }

        if (popupClosedAt && Date.now() - popupClosedAt > 5000) {
          throw new Error('Authentication window was closed')
        }

        if (Date.now() - startedAt > 180000) {
          throw new Error('Timed out waiting for social connection')
        }

        await new Promise((r) => setTimeout(r, 1500))
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect account')
    } finally {
      setConnecting(null)
    }
  }

  async function disconnect(id: number) {
    try {
      await api.delete(`/user/social-accounts/${id}`)
      setAccounts((prev) => prev.filter((a) => a.id !== id))
    } catch {
      setError('Failed to disconnect account')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white m-0 mb-2">Social accounts</h1>
        <p className="text-sm text-zinc-500 m-0">
          Connect platforms for posting from the Clippster desktop app.
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-sm m-0">{error}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={connecting !== null}
            onClick={() => connect(p.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-sm font-medium border-none cursor-pointer hover:bg-zinc-700 disabled:opacity-50"
          >
            {connecting === p.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Connect {p.label}
          </button>
        ))}
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-6 py-12 text-center">
          <p className="text-sm text-zinc-500 m-0">No social accounts connected yet.</p>
        </div>
      ) : (
        <ul className="list-none p-0 m-0 space-y-2">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
            >
              {account.profile_image_url ? (
                <img
                  src={account.profile_image_url}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-800" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white m-0 truncate">
                  {account.display_name || account.username}
                </p>
                <p className="text-xs text-zinc-500 m-0">
                  {platformLabel(account.platform)} · @{account.username}
                </p>
              </div>
              <button
                type="button"
                onClick={() => disconnect(account.id)}
                className="p-2 rounded-lg border-none bg-transparent text-zinc-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                aria-label="Disconnect"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
