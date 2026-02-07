import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { Skeleton } from '@/components/ui/Skeleton'
import { LayoutGrid, Users, UserCircle, FolderOpen, CreditCard, Settings, Globe, Share2, Megaphone, Scissors, FileText, ArrowRight } from 'lucide-react'

const navGroups = [
  {
    title: 'Team',
    color: 'cyan',
    items: [
      { icon: Users, label: 'Members', path: 'members', desc: 'Manage team members and invitations' },
      { icon: UserCircle, label: 'Creators', path: 'creators', desc: 'Creator profiles and platform links' },
    ],
  },
  {
    title: 'Content',
    color: 'purple',
    items: [
      { icon: Megaphone, label: 'Campaigns', path: 'campaigns', desc: 'Manage marketing campaigns' },
      { icon: Scissors, label: 'Clippers', path: 'clippers', desc: 'Clipper directory and leaderboard' },
      { icon: Share2, label: 'Shared Clips', path: 'shared', desc: 'Share clips with your team' },
      { icon: Globe, label: 'Social Accounts', path: 'social', desc: 'Connected social media accounts' },
      { icon: FileText, label: 'Posts', path: 'posts', desc: 'Post submissions and scheduling' },
    ],
  },
  {
    title: 'Management',
    color: 'green',
    items: [
      { icon: FolderOpen, label: 'Assets', path: 'assets', desc: 'Intros, outros, watermarks' },
      { icon: CreditCard, label: 'Billing', path: 'billing', desc: 'Credits and subscription' },
      { icon: Settings, label: 'Settings', path: 'settings', desc: 'Organization settings' },
    ],
  },
]

const colorMap: Record<string, { bg: string; border: string; icon: string }> = {
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: 'text-cyan-400' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'text-purple-400' },
  green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
}

export function OrgHub() {
  const { id } = useParams()
  const { loading, organization, members, loadOrganization, poolBalance } = useOrganization()

  useEffect(() => { loadOrganization() }, [loadOrganization])

  if (loading && !organization) {
    return (
      <PageLayout icon={LayoutGrid} title="Organization Hub">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout icon={LayoutGrid} title={organization?.name || 'Organization Hub'} description="Manage your organization">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Members', value: members.length },
          { label: 'Pool Credits', value: `${poolBalance} min` },
          { label: 'AI Enabled', value: organization?.settings?.allow_ai ? 'Yes' : 'No' },
          { label: 'Status', value: 'Active' },
        ].map(stat => (
          <div key={stat.label} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">{stat.label}</p>
            <p className="text-xl font-bold text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Nav groups */}
      {navGroups.map(group => {
        const colors = colorMap[group.color]
        return (
          <div key={group.title} className="mb-8">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">{group.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.items.map(item => (
                <Link
                  key={item.path}
                  to={`/dashboard/org/${id}/${item.path}`}
                  className="group flex items-start gap-3 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all"
                >
                  <div className={`w-10 h-10 rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center shrink-0`}>
                    <item.icon className={`w-5 h-5 ${colors.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{item.label}</span>
                      <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </PageLayout>
  )
}
