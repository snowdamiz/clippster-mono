import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { Avatar } from '@/components/ui/Avatar'
import { listExternalPosts, approveExternalPost, rejectExternalPost, formatRelativeTime } from '@/services/schedulingApi'
import { useToast } from '@/hooks/useToast'
import type { ExternalPostSubmission } from '@/types/organization'
import { FileText, Check, X, ExternalLink, Eye, Heart, MessageSquare, RefreshCw } from 'lucide-react'

const statusVariants: Record<string, 'success' | 'warning' | 'danger' | 'default'> = { approved: 'success', pending: 'warning', rejected: 'danger', published: 'success' }

export function OrgPosts() {
  const { loadOrganization, organizationId, isAdmin } = useOrganization()
  const [submissions, setSubmissions] = useState<ExternalPostSubmission[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const toast = useToast()
  const perPage = 20

  const loadPosts = async (p = 1) => {
    if (!organizationId) return
    setLoading(true)
    try {
      const result = await listExternalPosts(organizationId, { status: filter || undefined, limit: perPage, offset: (p - 1) * perPage })
      if (result.success) { setSubmissions(result.submissions); setTotal(result.total); setPage(p) }
    } finally { setLoading(false) }
  }

  useEffect(() => { loadOrganization() }, [loadOrganization])
  useEffect(() => { loadPosts() }, [organizationId, filter])

  const handleApprove = async (id: number) => {
    if (!organizationId) return
    const result = await approveExternalPost(organizationId, id)
    if (result.success) { toast.success('Post approved'); loadPosts(page) }
  }

  const handleReject = async (id: number) => {
    if (!organizationId) return
    const result = await rejectExternalPost(organizationId, id)
    if (result.success) { toast.success('Post rejected'); loadPosts(page) }
  }

  if (loading && submissions.length === 0) return <PageLayout icon={FileText} title="Posts"><div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div></PageLayout>

  return (
    <PageLayout icon={FileText} title="Posts" description="Review post submissions and track analytics" actions={<Button variant="secondary" onClick={() => loadPosts(page)}><RefreshCw className="w-4 h-4" /> Refresh</Button>}>
      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {['', 'pending', 'approved', 'rejected'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {f || 'All'}
          </button>
        ))}
      </div>

      {submissions.length === 0 ? (
        <EmptyState icon={FileText} title="No Posts" description={filter ? 'No posts match this filter' : 'No post submissions yet'} />
      ) : (
        <div className="space-y-3">
          {submissions.map(post => (
            <div key={post.id} className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {post.author_profile_image && <Avatar src={post.author_profile_image} size="sm" />}
                  <span className="text-sm font-medium text-white">@{post.author_username || 'unknown'}</span>
                  <Badge variant="default">{post.platform}</Badge>
                  <Badge variant={statusVariants[post.status] || 'default'}>{post.status}</Badge>
                </div>
                {post.caption && <p className="text-xs text-zinc-500 line-clamp-1">{post.caption}</p>}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-zinc-600 flex items-center gap-1"><Eye className="w-3 h-3" /> {post.analytics.view_count}</span>
                  <span className="text-xs text-zinc-600 flex items-center gap-1"><Heart className="w-3 h-3" /> {post.analytics.like_count}</span>
                  <span className="text-xs text-zinc-600 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {post.analytics.comment_count}</span>
                  <span className="text-xs text-zinc-600">{formatRelativeTime(post.inserted_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {post.post_url && (
                  <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                {isAdmin && post.status === 'pending' && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => handleApprove(post.id)}><Check className="w-4 h-4 text-emerald-400" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleReject(post.id)}><X className="w-4 h-4 text-red-400" /></Button>
                  </>
                )}
              </div>
            </div>
          ))}
          <Pagination page={page} totalPages={Math.ceil(total / perPage)} onPageChange={loadPosts} total={total} perPage={perPage} />
        </div>
      )}
    </PageLayout>
  )
}
