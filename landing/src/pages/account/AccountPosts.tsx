import { useCallback, useEffect, useState } from 'react'
import {
  Eye,
  FileVideo,
  Heart,
  RefreshCw,
  TrendingUp,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useDownloads } from '@/hooks/usePlatform'
import { trackDownloadClick } from '@/services/landingAnalytics'

interface UserPost {
  id: number
  platform?: string
  status?: string
  caption?: string | null
  thumbnail_url?: string | null
  media_url?: string | null
  post_url?: string | null
  view_count?: number | null
  like_count?: number | null
  published_at?: string | null
  inserted_at?: string
  created_at?: string
}

interface PostsAnalytics {
  total_posts?: number
  total_views?: number
  total_likes?: number
  total_reach?: number
}

function formatViews(n?: number | null): string {
  const value = n ?? 0
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(value)
}

function normalizePlatform(platform?: string): string {
  const p = (platform || '').toLowerCase()
  if (p === 'twitter') return 'x'
  if (p === 'tiktok_business') return 'tiktok'
  return p || 'unknown'
}

function platformLabel(platform?: string): string {
  switch (normalizePlatform(platform)) {
    case 'instagram':
      return 'Instagram'
    case 'tiktok':
      return 'TikTok'
    case 'youtube':
      return 'YouTube'
    case 'x':
      return 'X'
    default:
      return platform || 'Platform'
  }
}

function platformIconClass(platform?: string): string {
  switch (normalizePlatform(platform)) {
    case 'instagram':
      return 'bg-gradient-to-br from-purple-500/30 to-pink-500/30 text-pink-300'
    case 'tiktok':
      return 'bg-zinc-800 text-white'
    case 'youtube':
      return 'bg-red-500/20 text-red-400'
    case 'x':
      return 'bg-zinc-800 text-zinc-100'
    default:
      return 'bg-zinc-800 text-zinc-400'
  }
}

function statusClass(status?: string): string {
  if (status === 'published') return 'bg-emerald-500/15 text-emerald-400'
  if (status === 'failed') return 'bg-red-500/15 text-red-400'
  if (status === 'scheduled') return 'bg-amber-500/15 text-amber-400'
  return 'bg-zinc-800 text-zinc-400'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '—'
  }
}

function PlatformGlyph({ platform }: { platform?: string }) {
  const p = normalizePlatform(platform)
  if (p === 'x') {
    return (
      <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" aria-hidden>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.745l7.73-8.835L1.254 2.25H8.08l4.713 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
      </svg>
    )
  }
  if (p === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" aria-hidden>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    )
  }
  if (p === 'youtube') {
    return (
      <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" aria-hidden>
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    )
  }
  if (p === 'tiktok') {
    return (
      <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" aria-hidden>
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .55.04.81.1v-3.5a6.37 6.37 0 00-.81-.05A6.35 6.35 0 003.15 15.28a6.35 6.35 0 0010.99 4.35V9.79a8.25 8.25 0 004.84 1.55V7.9a4.85 4.85 0 01-.39-.21z" />
      </svg>
    )
  }
  return <FileVideo className="w-3 h-3" />
}

export function AccountPosts() {
  const [posts, setPosts] = useState<UserPost[]>([])
  const [analytics, setAnalytics] = useState<PostsAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { primaryDownload, isLoading: downloadLoading } = useDownloads()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      try {
        await api.post('/user/posts/sync-analytics')
      } catch {
        // Sync is best-effort; still load list/summary
      }

      const [analyticsRes, postsRes] = await Promise.all([
        api.get<{ success?: boolean; summary?: PostsAnalytics; error?: string }>(
          '/user/posts/analytics?days=30',
        ),
        api.get<{ success?: boolean; posts?: UserPost[]; data?: UserPost[]; error?: string }>(
          '/user/posts',
        ),
      ])

      if (analyticsRes.summary) setAnalytics(analyticsRes.summary)
      setPosts(postsRes.posts || postsRes.data || [])
    } catch {
      setError('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white m-0 mb-2">Posts</h1>
          <p className="text-sm text-zinc-500 m-0">Posts published to your social media accounts</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-sm text-zinc-200 hover:border-cyan-500/40 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats strip — matches Tauri Posts tab */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: 'Total Posts',
            value: String(analytics?.total_posts ?? posts.length ?? 0),
            icon: FileVideo,
            color: 'bg-cyan-500/15 text-cyan-400',
          },
          {
            label: 'Total Views',
            value: formatViews(analytics?.total_views),
            icon: Eye,
            color: 'bg-violet-500/15 text-violet-400',
          },
          {
            label: 'Total Likes',
            value: formatViews(analytics?.total_likes),
            icon: Heart,
            color: 'bg-pink-500/15 text-pink-400',
          },
          {
            label: 'Total Reach',
            value: formatViews(analytics?.total_reach),
            icon: TrendingUp,
            color: 'bg-emerald-500/15 text-emerald-400',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="flex items-center gap-4 px-4 py-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-colors"
          >
            <div className={`w-11 h-11 rounded-[10px] flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-[22px] h-[22px]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white m-0 tabular-nums leading-tight tracking-tight">
                {value}
              </p>
              <p className="text-xs text-zinc-500 m-0 font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-sm m-0">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden animate-pulse"
            >
              <div className="aspect-video bg-zinc-800/80" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-24 bg-zinc-800 rounded" />
                <div className="h-3 w-full bg-zinc-800 rounded" />
                <div className="h-3 w-2/3 bg-zinc-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-6 py-14 text-center">
          <FileVideo className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white m-0 mb-2">No posts yet</h2>
          <p className="text-sm text-zinc-500 m-0 mb-5 max-w-sm mx-auto leading-relaxed">
            Publish your first video from the Clippster desktop app to see it here.
          </p>
          {!downloadLoading && primaryDownload && (
            <a
              href={primaryDownload.downloadUrl}
              onClick={() =>
                trackDownloadClick(primaryDownload, 'account_posts_empty', 'Download Clippster')
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-400 text-[#0a0a0b] text-sm font-semibold no-underline hover:opacity-90"
            >
              Download Clippster
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {posts.map((post) => (
            <article
              key={post.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden hover:border-zinc-700 hover:shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-all"
            >
              <div className="relative aspect-video bg-zinc-950">
                {post.thumbnail_url ? (
                  <img
                    src={post.thumbnail_url}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
                    <FileVideo className="w-10 h-10" />
                  </div>
                )}
              </div>

              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${statusClass(post.status)}`}
                    >
                      {post.status || 'unknown'}
                    </span>
                    <span
                      title={platformLabel(post.platform)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${platformIconClass(post.platform)}`}
                    >
                      <PlatformGlyph platform={post.platform} />
                    </span>
                  </div>
                  {post.post_url && (
                    <a
                      href={post.post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300 no-underline shrink-0"
                    >
                      View on {platformLabel(post.platform)}
                    </a>
                  )}
                </div>

                {post.caption && (
                  <p className="text-sm text-zinc-300 m-0 leading-relaxed">
                    {post.caption.length > 100
                      ? `${post.caption.slice(0, 100)}...`
                      : post.caption}
                  </p>
                )}

                <div className="flex items-center gap-4 pt-2 border-t border-zinc-800">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Eye className="w-3.5 h-3.5" />
                    <span className="text-xs tabular-nums font-medium">
                      {formatViews(post.view_count)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <Heart className="w-3.5 h-3.5" />
                    <span className="text-xs tabular-nums font-medium">
                      {formatViews(post.like_count)}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-zinc-500">
                  {formatDate(post.published_at || post.inserted_at || post.created_at)}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
