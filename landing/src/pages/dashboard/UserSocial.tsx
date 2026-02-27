import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { useOAuthPopup } from '@/hooks/useOAuthPopup'
import {
  listUserSocialAccounts,
  deleteUserSocialAccount,
  type UserSocialAccount,
} from '@/services/userSocialApi'
import {
  Globe,
  Instagram,
  Youtube,
  Plus,
  RefreshCw,
  Trash2,
  Loader2,
  Link2,
  Zap,
  Clock,
} from 'lucide-react'

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <defs>
        <linearGradient id="tiktok-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#25F4EE" />
          <stop offset="50%" stopColor="#FE2C55" />
          <stop offset="100%" stopColor="#FE2C55" />
        </linearGradient>
      </defs>
      <path fill="url(#tiktok-grad)" d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05A6.34 6.34 0 003.15 15.3a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.05a8.16 8.16 0 004.76 1.52V7.12a4.84 4.84 0 01-1-.43z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function getPlatformGradient(platform: string) {
  if (platform === 'instagram') return 'from-purple-500 to-pink-500'
  if (platform === 'tiktok') return 'from-zinc-900 to-zinc-700'
  if (platform === 'youtube') return 'from-red-500 to-red-600'
  if (platform === 'twitter' || platform === 'x') return 'from-zinc-800 to-zinc-900'
  return 'from-cyan-500 to-cyan-700'
}

function getPlatformIcon(platform: string) {
  if (platform === 'instagram') return Instagram
  if (platform === 'tiktok') return TikTokIcon
  if (platform === 'youtube') return Youtube
  if (platform === 'twitter' || platform === 'x') return XIcon
  return Globe
}

function getPlatformName(platform: string) {
  if (platform === 'instagram') return 'Instagram'
  if (platform === 'tiktok') return 'TikTok'
  if (platform === 'youtube') return 'YouTube'
  if (platform === 'twitter' || platform === 'x') return 'X (Twitter)'
  return platform
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 30) return `${diffDays}d ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

export function UserSocial() {
  const { token } = useAuth()
  const { openPfmUserOAuth } = useOAuthPopup()
  const toast = useToast()
  const [accounts, setAccounts] = useState<UserSocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const result = await listUserSocialAccounts()
      if (result.success) {
        setAccounts(result.social_accounts || [])
      }
    } catch {
      toast.error('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const connectPfm = (platform: 'instagram_business' | 'tiktok' | 'youtube', label: string) => {
    if (!token) return
    setConnecting(true)
    openPfmUserOAuth(platform, token, (result) => {
      setConnecting(false)
      if (result.success) {
        toast.success(`${label} account connected!`)
        loadAccounts()
      } else {
        toast.error(result.error || `Failed to connect ${label}`)
      }
    })
  }

  const handleDelete = async (account: UserSocialAccount) => {
    setDeletingId(account.id)
    try {
      const result = await deleteUserSocialAccount(account.id)
      if (result.success) {
        setAccounts((prev) => prev.filter((a) => a.id !== account.id))
        toast.success('Account disconnected')
      } else {
        toast.error(result.error || 'Failed to disconnect')
      }
    } catch {
      toast.error('Failed to disconnect account')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] p-6">
      <div className="w-full flex flex-col gap-8 max-w-[800px] mx-auto">
        {/* Page Heading */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-white tracking-[-0.02em] m-0 mb-1.5">My Social Accounts</h1>
          <p className="text-sm text-zinc-500 m-0 leading-relaxed">
            Connect your personal social media accounts for posting and analytics
          </p>
        </div>

        {/* Connect Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-amber-500/15 text-amber-500">
              <Zap className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-[1.0625rem] font-semibold text-white tracking-[-0.01em] m-0">Connect Platform</h2>
              <p className="text-xs text-zinc-500 mt-0.5 m-0">Link your social accounts</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 p-5 bg-zinc-900/50 border border-zinc-800 rounded-[10px]">
            {/* Instagram */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 bg-white/[0.02] border border-white/[0.06] rounded-[10px] transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04]">
              <div className="flex items-center gap-4">
                <div
                  className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0"
                  style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}
                >
                  <Instagram className="w-[22px] h-[22px] text-white" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[0.9375rem] font-semibold text-white m-0">Instagram</h3>
                  <p className="text-[0.8125rem] text-zinc-500 m-0 leading-[1.4]">Connect your Instagram account</p>
                </div>
              </div>
              <button
                className="flex items-center gap-2 h-10 px-5 bg-gradient-to-br from-cyan-400 to-cyan-600 text-black border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 shrink-0 hover:opacity-90 hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                onClick={() => connectPfm('instagram_business', 'Instagram')}
                disabled={connecting}
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>

            {/* TikTok */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 bg-white/[0.02] border border-white/[0.06] rounded-[10px] transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04]">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-black">
                  <TikTokIcon className="w-6 h-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[0.9375rem] font-semibold text-white m-0">TikTok</h3>
                  <p className="text-[0.8125rem] text-zinc-500 m-0 leading-[1.4]">Connect your TikTok account</p>
                </div>
              </div>
              <button
                className="flex items-center gap-2 h-10 px-5 bg-gradient-to-br from-cyan-400 to-cyan-600 text-black border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 shrink-0 hover:opacity-90 hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                onClick={() => connectPfm('tiktok', 'TikTok')}
                disabled={connecting}
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>

            {/* YouTube */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 bg-white/[0.02] border border-white/[0.06] rounded-[10px] transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04]">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-gradient-to-br from-red-500 to-red-700">
                  <Youtube className="w-[22px] h-[22px] text-white" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[0.9375rem] font-semibold text-white m-0">YouTube</h3>
                  <p className="text-[0.8125rem] text-zinc-500 m-0 leading-[1.4]">Connect your YouTube channel</p>
                </div>
              </div>
              <button
                className="flex items-center gap-2 h-10 px-5 bg-gradient-to-br from-cyan-400 to-cyan-600 text-black border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 shrink-0 hover:opacity-90 hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                onClick={() => connectPfm('youtube', 'YouTube')}
                disabled={connecting}
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>

            {/* X (Twitter) — Desktop only */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 bg-white/[0.02] border border-white/[0.06] rounded-[10px] opacity-50">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-black">
                  <XIcon className="w-[22px] h-[22px] text-white" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[0.9375rem] font-semibold text-white m-0 flex items-center gap-2">
                    X (Twitter)
                    <span className="text-[0.625rem] font-bold uppercase tracking-[0.05em] px-2 py-[3px] bg-purple-500/15 text-purple-400 rounded">
                      Desktop App Only
                    </span>
                  </h3>
                  <p className="text-[0.8125rem] text-zinc-500 m-0 leading-[1.4]">Post your clips to X</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Connected Accounts */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5 flex-wrap">
            <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-purple-500/15 text-purple-500">
              <Link2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <h2 className="text-[1.0625rem] font-semibold text-white tracking-[-0.01em] m-0">Connected Accounts</h2>
              <p className="text-xs text-zinc-500 mt-0.5 m-0">Your linked social media platforms</p>
            </div>
            <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 text-xs font-semibold text-purple-500 bg-purple-500/15 rounded-full">
              {accounts.length}
            </span>
            <button
              className="flex items-center gap-2 h-9 px-4 bg-zinc-800 text-white border border-zinc-800 rounded-lg text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 ml-auto hover:bg-zinc-700 hover:border-white/[0.15] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={loadAccounts}
              disabled={loading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {loading && accounts.length === 0 ? (
            <div className="flex flex-col gap-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-[72px] bg-zinc-900/50 border border-zinc-800 rounded-[10px] animate-pulse" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-zinc-900/30 border border-zinc-800/50 rounded-[10px]">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-800/50 text-zinc-600 mb-4">
                <Link2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-semibold text-white m-0 mb-2">No accounts connected</h3>
              <p className="text-sm text-zinc-500 m-0 mb-6 max-w-[340px] text-center">
                Connect your social media accounts above to start posting
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {accounts.map((account) => {
                const Icon = getPlatformIcon(account.platform)
                return (
                  <div
                    key={account.id}
                    className="flex items-center gap-4 px-5 py-4 bg-zinc-900/50 border border-zinc-800 rounded-[10px] transition-all duration-200 hover:border-white/[0.1]"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${getPlatformGradient(account.platform)} shrink-0`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate">
                          @{account.username}
                        </span>
                        <span className="text-[0.6875rem] text-zinc-500">
                          {getPlatformName(account.platform)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[0.6875rem] text-zinc-500">
                          <Clock className="w-3 h-3" />
                          Connected {formatRelativeTime(account.connected_at || account.inserted_at)}
                        </span>
                        {account.is_active ? (
                          <span className="text-[0.625rem] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            Active
                          </span>
                        ) : (
                          <span className="text-[0.625rem] font-medium text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="flex items-center justify-center w-8 h-8 bg-transparent border border-zinc-800 rounded-lg text-zinc-500 cursor-pointer transition-all duration-150 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 disabled:opacity-50"
                      onClick={() => handleDelete(account)}
                      disabled={deletingId === account.id}
                      title="Disconnect"
                    >
                      {deletingId === account.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
