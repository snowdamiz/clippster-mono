import { useEffect, useState, useRef } from 'react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'

import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { listExternalPosts, syncOrgAnalytics } from '@/services/schedulingApi'
import { listPostSubmissions, getAnalyticsSummary } from '@/services/socialAccountsApi'
import { listOrganizationCampaignSubmissions } from '@/services/campaignApi'
import { useToast } from '@/hooks/useToast'
import { formatRelativeTime } from '@/utils/dateTimeUtils'
import {
  FileText,
  Eye,
  Heart,
  MessageSquare,
  RefreshCw,
  ExternalLink,
  Instagram,
  Globe,
  TrendingUp,
  Clock,
  User,
  ChevronDown,
  Video,
  Filter,
  BarChart3
} from 'lucide-react'

interface UnifiedPost {
  id: number
  type: 'scheduled' | 'external' | 'campaign'
  platform: string
  status: string
  post_url: string | null
  caption: string | null
  view_count: number
  like_count: number
  comment_count: number
  creator_profile: { id: number; name: string } | null
  campaign: { id: number; name: string } | null
  social_account: { id: number; username: string; platform: string } | null
  submitted_by: { id: number; name?: string; email: string } | null
  author_username: string | null
  author_name: string | null
  author_profile_image: string | null
  inserted_at: string
}

interface AnalyticsSummary {
  total_posts: number
  total_views: number
  total_likes: number
  total_reach: number
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

function getStatusIndicatorColor(status: string): string {
  const colors: Record<string, string> = {
    published: 'from-emerald-500 to-emerald-600',
    pending: 'from-amber-500 to-amber-600',
    publishing: 'from-blue-500 to-blue-600',
    failed: 'from-red-500 to-red-600',
    approved: 'from-emerald-500 to-emerald-600',
    rejected: 'from-red-500 to-red-600',
    verified: 'from-cyan-400 to-cyan-500',
    paid: 'from-emerald-500 to-emerald-600'
  }
  return colors[status] || 'from-zinc-600 to-zinc-700'
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function getPlatformIcon(platform: string) {
  if (platform === 'instagram') return Instagram
  if (platform === 'twitter' || platform === 'x') return XIcon
  return Globe
}

function getPlatformBgClass(platform: string): string {
  if (platform === 'instagram') return 'bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888]'
  if (platform === 'twitter' || platform === 'x') return 'bg-zinc-900'
  if (platform === 'tiktok') return 'bg-black'
  if (platform === 'youtube') return 'bg-red-600'
  return 'bg-zinc-700'
}

function FilterDropdown({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: { value: string; label: string; dot?: string }[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between gap-2 min-w-[130px] h-9 px-3 bg-white/[0.04] text-white border border-white/[0.08] rounded-md text-[13px] font-medium hover:bg-white/[0.08] hover:border-white/[0.12] transition-all"
      >
        <span>{selected?.label || label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-[160px] bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-[13px] transition-colors ${value === opt.value ? 'bg-cyan-500/10 text-cyan-400' : 'text-zinc-300 hover:bg-zinc-700 hover:text-white'}`}
            >
              {opt.dot && <span className={`w-2 h-2 rounded-full ${opt.dot}`} />}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const statCards = [
  { key: 'total_posts', label: 'Total Posts', desc: 'Published content', color: 'cyan', icon: Video },
  { key: 'total_views', label: 'Total Views', desc: 'Content impressions', color: 'violet', icon: Eye },
  { key: 'total_likes', label: 'Total Likes', desc: 'Audience engagement', color: 'pink', icon: Heart },
  { key: 'total_reach', label: 'Total Reach', desc: 'Unique viewers', color: 'emerald', icon: TrendingUp }
] as const

const statColorMap: Record<string, { indicator: string; iconBg: string; iconColor: string; valueColor: string }> = {
  cyan: {
    indicator: 'from-cyan-500 to-cyan-600',
    iconBg: 'bg-cyan-500/15',
    iconColor: 'text-cyan-500',
    valueColor: 'text-cyan-500'
  },
  violet: {
    indicator: 'from-violet-500 to-violet-600',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-500',
    valueColor: 'text-violet-500'
  },
  pink: {
    indicator: 'from-pink-500 to-pink-600',
    iconBg: 'bg-pink-500/15',
    iconColor: 'text-pink-500',
    valueColor: 'text-pink-500'
  },
  emerald: {
    indicator: 'from-emerald-500 to-emerald-600',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-500',
    valueColor: 'text-emerald-500'
  }
}

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'published', label: 'Published', dot: 'bg-emerald-500' },
  { value: 'pending', label: 'Pending', dot: 'bg-amber-500' },
  { value: 'publishing', label: 'Publishing', dot: 'bg-blue-500' },
  { value: 'failed', label: 'Failed', dot: 'bg-red-500' }
]

const platformOptions = [
  { value: '', label: 'All Platforms' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' }
]

export function OrgPosts() {
  const { loadOrganization, organizationId, loadCreatorProfiles, profilesLoaded } = useOrganization()
  const [posts, setPosts] = useState<UnifiedPost[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [summary, setSummary] = useState<AnalyticsSummary>({
    total_posts: 0,
    total_views: 0,
    total_likes: 0,
    total_reach: 0
  })
  const toast = useToast()
  const perPage = 20

  useEffect(() => {
    loadOrganization()
    if (!profilesLoaded) loadCreatorProfiles()
  }, [loadOrganization])

  // Sync analytics on mount
  useEffect(() => {
    if (!organizationId) return
    syncOrgAnalytics(organizationId)
      .then(() => {
        setTimeout(() => {
          loadPosts()
          loadSummary()
        }, 2000)
      })
      .catch(() => {})
  }, [organizationId])

  const loadPosts = async (p = 1) => {
    if (!organizationId) return
    setLoading(true)
    try {
      const filterOpts = {
        status: statusFilter || undefined,
        platform: platformFilter || undefined,
        limit: perPage,
        offset: (p - 1) * perPage
      }

      const [scheduledRes, externalRes, campaignRes] = await Promise.all([
        listPostSubmissions(organizationId, filterOpts),
        listExternalPosts(organizationId, {
          status: statusFilter || undefined,
          limit: perPage,
          offset: (p - 1) * perPage
        }),
        listOrganizationCampaignSubmissions(organizationId, {
          status: statusFilter || undefined,
          platform: platformFilter || undefined,
          limit: perPage,
          offset: (p - 1) * perPage
        })
      ])

      const unified: UnifiedPost[] = []

      if (scheduledRes.success) {
        for (const post of scheduledRes.posts) {
          unified.push({
            id: post.id,
            type: 'scheduled',
            platform: post.platform,
            status: post.status,
            post_url: post.post_url,
            caption: post.caption,
            view_count: post.analytics?.view_count || 0,
            like_count: post.analytics?.like_count || 0,
            comment_count: post.analytics?.comment_count || 0,
            creator_profile: post.creator_profile
              ? { id: post.creator_profile.id, name: post.creator_profile.name }
              : null,
            campaign: null,
            social_account: post.social_account,
            submitted_by: post.submitted_by
              ? { id: post.submitted_by.id, email: post.submitted_by.email, name: post.submitted_by.name }
              : null,
            author_username: null,
            author_name: null,
            author_profile_image: null,
            inserted_at: post.inserted_at
          })
        }
      }

      if (externalRes.success) {
        for (const post of externalRes.submissions) {
          unified.push({
            id: post.id,
            type: 'external',
            platform: post.platform,
            status: 'published',
            post_url: post.post_url,
            caption: post.caption,
            view_count: post.analytics?.view_count || 0,
            like_count: post.analytics?.like_count || 0,
            comment_count: post.analytics?.comment_count || 0,
            creator_profile: post.creator_profile
              ? { id: post.creator_profile.id, name: post.creator_profile.name }
              : null,
            campaign: post.campaign,
            social_account: null,
            submitted_by: post.submitted_by
              ? { id: post.submitted_by.id, email: post.submitted_by.email, name: post.submitted_by.name }
              : null,
            author_username: post.author_username,
            author_name: post.author_name,
            author_profile_image: post.author_profile_image,
            inserted_at: post.inserted_at
          })
        }
      }

      if (campaignRes.success) {
        for (const sub of campaignRes.submissions) {
          unified.push({
            id: sub.id,
            type: 'campaign',
            platform: sub.platform,
            status: sub.status === 'verified' || sub.status === 'paid' ? 'published' : sub.status,
            post_url: sub.clip_url || sub.post_url || null,
            caption: sub.caption || null,
            view_count: sub.view_count || 0,
            like_count: sub.like_count || 0,
            comment_count: sub.comment_count || 0,
            creator_profile: sub.creator_profile
              ? { id: sub.creator_profile.id, name: sub.creator_profile.name }
              : null,
            campaign: sub.campaign ? { id: sub.campaign.id, name: sub.campaign.title || sub.campaign.name } : null,
            social_account: null,
            submitted_by: sub.user
              ? { id: sub.user.id, email: sub.user.email, name: sub.user.display_name || sub.user.name }
              : null,
            author_username: sub.author_username || null,
            author_name: sub.author_name || null,
            author_profile_image: sub.author_profile_image || null,
            inserted_at: sub.inserted_at
          })
        }
      }

      unified.sort((a, b) => new Date(b.inserted_at).getTime() - new Date(a.inserted_at).getTime())
      setPosts(unified)
      setTotal((scheduledRes.total || 0) + (externalRes.total || 0) + (campaignRes.total || 0))
      setPage(p)
    } finally {
      setLoading(false)
    }
  }

  const loadSummary = async () => {
    if (!organizationId) return
    try {
      const [schedRes, extRes, campRes] = await Promise.all([
        getAnalyticsSummary(organizationId),
        listExternalPosts(organizationId, { limit: 1000 }),
        listOrganizationCampaignSubmissions(organizationId, { limit: 1000 })
      ])

      let tp = 0,
        tv = 0,
        tl = 0,
        tr = 0
      if (schedRes.success && schedRes.summary) {
        tp = schedRes.summary.total_posts || 0
        tv = schedRes.summary.total_views || 0
        tl = schedRes.summary.total_likes || 0
        tr = schedRes.summary.total_reach || 0
      }
      if (extRes.success && extRes.submissions) {
        tp += extRes.submissions.length
        for (const p of extRes.submissions) {
          tv += p.analytics?.view_count || 0
          tl += p.analytics?.like_count || 0
        }
      }
      if (campRes.success && campRes.submissions) {
        tp += campRes.submissions.length
        for (const s of campRes.submissions) {
          tv += s.view_count || 0
        }
      }
      setSummary({ total_posts: tp, total_views: tv, total_likes: tl, total_reach: tr })
    } catch {}
  }

  useEffect(() => {
    loadPosts()
    loadSummary()
  }, [organizationId, statusFilter, platformFilter])

  const handleRefresh = async () => {
    if (!organizationId) return
    setSyncing(true)
    try {
      await syncOrgAnalytics(organizationId)
      await new Promise((r) => setTimeout(r, 2000))
      await loadPosts(page)
      await loadSummary()
      toast.success('Analytics refreshed')
    } catch {
      toast.error('Failed to refresh analytics')
    } finally {
      setSyncing(false)
    }
  }

  if (loading && posts.length === 0)
    return (
      <PageLayout icon={FileText} title="Post Analytics">
        <div className="p-6 flex flex-col gap-8 max-w-[1400px] mx-auto w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-[10px]" />
            ))}
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-[10px]" />
            ))}
          </div>
        </div>
      </PageLayout>
    )

  return (
    <PageLayout
      icon={FileText}
      title="Post Analytics"
      actions={
        <button
          onClick={handleRefresh}
          disabled={syncing}
          className="flex items-center gap-2 h-8 px-3.5 text-xs font-semibold rounded-md bg-cyan-400 text-[#0a0a0b] border-none cursor-pointer transition-opacity duration-150 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      }
    >
      <div className="p-6 flex flex-col gap-8 max-w-[1400px] mx-auto w-full">
        {/* Page Heading */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-white tracking-[-0.02em] mb-1.5">Post Analytics</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Track performance metrics and engagement for your social media posts
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => {
            const colors = statColorMap[card.color]
            const Icon = card.icon
            const val = summary[card.key]
            return (
              <div
                key={card.key}
                className="flex bg-zinc-900/50 border border-zinc-800 rounded-[10px] overflow-hidden hover:border-zinc-700 transition-all hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
              >
                <div className={`w-1 shrink-0 bg-gradient-to-b ${colors.indicator}`} />
                <div className="flex items-center gap-3.5 flex-1 py-4 px-5">
                  <div
                    className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${colors.iconBg}`}
                  >
                    <Icon className={`w-5 h-5 ${colors.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white tracking-[-0.01em]">{card.label}</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{card.desc}</p>
                  </div>
                  <span
                    className={`text-[1.75rem] font-bold tabular-nums leading-none tracking-[-0.02em] ${colors.valueColor}`}
                  >
                    {formatNumber(val)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Filters Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-cyan-500/15">
              <Filter className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <h2 className="text-[1.0625rem] font-semibold text-white tracking-[-0.01em]">Filters</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Refine your post analytics view</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 py-4 px-5 bg-zinc-900/50 border border-zinc-800 rounded-[10px]">
            <FilterDropdown
              label="All Status"
              value={statusFilter}
              options={statusOptions}
              onChange={(v) => setStatusFilter(v)}
            />
            <FilterDropdown
              label="All Platforms"
              value={platformFilter}
              options={platformOptions}
              onChange={(v) => setPlatformFilter(v)}
            />
            <div className="flex-1" />
            <Badge variant="default">{total} posts</Badge>
          </div>
        </section>

        {/* Post Performance Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-violet-500/15">
              <BarChart3 className="w-5 h-5 text-violet-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-[1.0625rem] font-semibold text-white tracking-[-0.01em]">Post Performance</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Individual post analytics and metrics</p>
            </div>
            <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-semibold text-violet-500 bg-violet-500/15 rounded-full">
              {total}
            </span>
          </div>
          {posts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No Posts"
              description={
                statusFilter || platformFilter
                  ? 'No posts match these filters'
                  : 'Posts published to social media will appear here with analytics'
              }
            />
          ) : (
            <div className="space-y-2">
              {posts.map((post) => {
                const PlatformIcon = getPlatformIcon(post.platform)
                return (
                  <div
                    key={`${post.type}-${post.id}`}
                    className="flex bg-zinc-900/50 border border-zinc-800 rounded-[10px] overflow-hidden hover:border-white/[0.12] transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.15)]"
                  >
                    {/* Status indicator bar */}
                    <div className={`w-[3px] shrink-0 bg-gradient-to-b ${getStatusIndicatorColor(post.status)}`} />

                    <div className="flex items-center gap-4 flex-1 py-3.5 px-4">
                      {/* Platform badge */}
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${getPlatformBgClass(post.platform)}`}
                      >
                        {post.platform === 'twitter' || post.platform === 'x' ? (
                          <span className="text-white text-lg font-bold">𝕏</span>
                        ) : (
                          <PlatformIcon className="w-5 h-5 text-white" />
                        )}
                      </div>

                      {/* Post info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {post.author_profile_image && (
                            <img src={post.author_profile_image} alt="" className="w-6 h-6 rounded-full object-cover" />
                          )}
                          {post.author_username ? (
                            <span className="text-sm font-semibold text-white">@{post.author_username}</span>
                          ) : post.social_account ? (
                            <span className="text-sm font-semibold text-white">@{post.social_account.username}</span>
                          ) : null}
                          {post.creator_profile && (
                            <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              <span className="text-amber-400/60 text-[9px] uppercase mr-0.5">Creator:</span>
                              {post.creator_profile.name}
                            </span>
                          )}
                          {post.campaign && (
                            <span className="text-[11px] font-medium text-violet-400 bg-violet-500/15 px-1.5 py-0.5 rounded">
                              {post.campaign.name}
                            </span>
                          )}
                          {post.type === 'campaign' && (
                            <span className="text-[10px] font-semibold uppercase text-cyan-400 bg-cyan-500/15 px-1.5 py-0.5 rounded tracking-wide">
                              Campaign Submission
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                          {post.submitted_by && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" /> {post.submitted_by.name || post.submitted_by.email}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatRelativeTime(post.inserted_at)}
                          </span>
                        </div>
                      </div>

                      {/* Analytics */}
                      <div className="hidden md:flex items-center gap-6 pl-4 border-l border-zinc-800 shrink-0">
                        <div className="flex flex-col items-center min-w-[56px]">
                          <Eye className="w-4 h-4 text-zinc-500 mb-0.5" />
                          <span className="text-base font-bold text-white tabular-nums">
                            {formatNumber(post.view_count)}
                          </span>
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Views</span>
                        </div>
                        <div className="flex flex-col items-center min-w-[56px]">
                          <Heart className="w-4 h-4 text-zinc-500 mb-0.5" />
                          <span className="text-base font-bold text-white tabular-nums">
                            {formatNumber(post.like_count)}
                          </span>
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Likes</span>
                        </div>
                        <div className="flex flex-col items-center min-w-[56px]">
                          <MessageSquare className="w-4 h-4 text-zinc-500 mb-0.5" />
                          <span className="text-base font-bold text-white tabular-nums">
                            {formatNumber(post.comment_count)}
                          </span>
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Comments</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {post.post_url && (
                          <a
                            href={post.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-center w-8 h-8 rounded-lg border border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-white hover:border-zinc-700 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              <Pagination
                page={page}
                totalPages={Math.ceil(total / perPage)}
                onPageChange={loadPosts}
                total={total}
                perPage={perPage}
              />
            </div>
          )}
        </section>
      </div>
    </PageLayout>
  )
}
