import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/SearchInput'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { api } from '@/lib/api'
import { Scissors, Trophy, Star } from 'lucide-react'

interface ClipperProfile {
  id: number
  display_name: string | null
  avatar_url: string | null
  slug: string | null
  bio: string | null
  is_verified: boolean
  specialty_tags: string[]
  total_clips_delivered: number
  total_endorsements: number
}

export function OrgClippers() {
  const { loadOrganization, organizationId } = useOrganization()
  const [clippers, setClippers] = useState<ClipperProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { loadOrganization() }, [loadOrganization])
  useEffect(() => {
    if (!organizationId) return
    setLoading(true)
    api.get<any>(`/organizations/${organizationId}/clipper-profiles`).then(result => {
      if (result.success) setClippers(result.profiles || [])
    }).finally(() => setLoading(false))
  }, [organizationId])

  const filtered = clippers.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (c.display_name || '').toLowerCase().includes(q) || (c.bio || '').toLowerCase().includes(q)
  })

  if (loading) return <PageLayout icon={Scissors} title="Clippers"><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div></PageLayout>

  return (
    <PageLayout icon={Scissors} title="Clippers" description="Clipper directory and leaderboard">
      <SearchInput value={search} onChange={setSearch} placeholder="Search clippers..." className="mb-6 max-w-sm" />
      {filtered.length === 0 ? (
        <EmptyState icon={Scissors} title="No Clippers" description={search ? 'No clippers match your search' : 'No clipper profiles available'} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(clipper => (
            <div key={clipper.id} className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <div className="flex items-start gap-3">
                <Avatar src={clipper.avatar_url} name={clipper.display_name} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{clipper.display_name || 'Anonymous'}</h3>
                    {clipper.is_verified && <Badge variant="success">Verified</Badge>}
                  </div>
                  {clipper.bio && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{clipper.bio}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-zinc-600 flex items-center gap-1"><Trophy className="w-3 h-3" /> {clipper.total_clips_delivered} clips</span>
                    <span className="text-xs text-zinc-600 flex items-center gap-1"><Star className="w-3 h-3" /> {clipper.total_endorsements}</span>
                  </div>
                  {clipper.specialty_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">{clipper.specialty_tags.slice(0, 3).map(tag => <Badge key={tag} variant="default">{tag}</Badge>)}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  )
}
