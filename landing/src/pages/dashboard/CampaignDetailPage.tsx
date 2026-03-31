import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
  Megaphone, 
  Building2, 
  Users, 
  FileVideo, 
  CheckCircle, 
  Wallet, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Globe,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { api } from '@/lib/api'
import type { Campaign } from '@/types/organization'
import { Breadcrumbs } from '@/components/dashboard/Breadcrumbs'

interface CampaignStats {
  participants_count: number
  submissions_count: number
  verified_count: number
  total_views: number
  total_paid: string
}

export default function CampaignDetailPage() {
  const { orgId, campaignId } = useParams<{ orgId: string; campaignId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [stats] = useState<CampaignStats>({
    participants_count: 0,
    submissions_count: 0,
    verified_count: 0,
    total_views: 0,
    total_paid: '0',
  })
  const [activeTab, setActiveTab] = useState('overview')

  const breadcrumbItems = useMemo(() => [
    { label: 'Dashboard', to: '/dashboard' },
    { label: campaign?.organization?.name || 'Organization', to: `/dashboard/org/${orgId}` },
    { label: 'Campaigns', to: `/dashboard/org/${orgId}/campaigns` },
    { label: campaign?.title || 'Campaign' }
  ], [campaign, orgId])

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Megaphone, count: undefined },
    { id: 'submissions', label: 'Submissions', icon: FileVideo, count: stats.submissions_count },
    { id: 'participants', label: 'Participants', icon: Users, count: stats.participants_count },
    { id: 'payments', label: 'Payments', icon: DollarSign, count: undefined },
  ]

  const formatBudget = (budget: string | number) => {
    const value = typeof budget === 'string' ? parseFloat(budget) : budget
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`
    }
    return value.toFixed(0)
  }

  const formatCpm = (cpm: string | number) => {
    const value = typeof cpm === 'string' ? parseFloat(cpm) : cpm
    return value.toFixed(2)
  }

  const formatViews = (views: number) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`
    }
    if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`
    }
    return views.toString()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getBudgetPercentage = () => {
    if (!campaign) return 0
    const spent = parseFloat(campaign.spent_budget || '0')
    const budget = parseFloat(campaign.budget || '0')
    if (budget === 0) return 0
    return Math.min((spent / budget) * 100, 100)
  }

  const getRemainingBudget = () => {
    if (!campaign) return 0
    const spent = parseFloat(campaign.spent_budget || '0')
    const budget = parseFloat(campaign.budget || '0')
    return Math.max(budget - spent, 0)
  }

  const getPlatformDisplayName = (platform: string): string => {
    const names: Record<string, string> = { 
      tiktok: 'TikTok', 
      instagram: 'Instagram', 
      x: 'X (Twitter)', 
      youtube: 'YouTube' 
    }
    return names[platform] || platform
  }

  useEffect(() => {
    const loadCampaign = async () => {
      try {
        setLoading(true)
        const response = await api.get<{ success: boolean; campaign?: Campaign }>(`/campaigns/${campaignId}`)
        if (response.success && response.campaign) {
          setCampaign(response.campaign)
        }
      } catch (error) {
        console.error('Failed to load campaign:', error)
      } finally {
        setLoading(false)
      }
    }

    if (campaignId) {
      loadCampaign()
    }
  }, [campaignId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-gray-400">
        <AlertCircle size={48} />
        <h3 className="text-xl font-semibold text-white">Campaign not found</h3>
        <p>The campaign you're looking for doesn't exist or you don't have access to it.</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 mt-4 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700"
        >
          Go Back
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Breadcrumbs items={breadcrumbItems} />
        {/* Header Card */}
        <div className="relative bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-xl opacity-30" />
          
          <div className="relative p-8 space-y-6">
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="w-24 h-24 bg-gray-800 border-4 border-gray-900 rounded-2xl flex items-center justify-center">
                  {campaign.cover_image_url ? (
                    <img src={campaign.cover_image_url} alt={campaign.title} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <Megaphone className="w-12 h-12 text-gray-600" />
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl font-bold">{campaign.title}</h1>
                  <div className="flex gap-2">
                    <span className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase ${
                      campaign.status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                      campaign.status === 'draft' ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30' :
                      campaign.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                      'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      {campaign.status}
                    </span>
                    <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                      {campaign.payment_model === 'per_clip' ? (
                        <><DollarSign className="inline w-3 h-3" /> Per Clip</>
                      ) : (
                        <><TrendingUp className="inline w-3 h-3" /> CPM</>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-400">
                  {campaign.organization && (
                    <Link
                      to={campaign.organization.slug ? `/orgs/${campaign.organization.slug}` : '#'}
                      className="flex items-center gap-2 no-underline text-inherit"
                    >
                      <Building2 size={14} />
                      {campaign.organization.name}
                    </Link>
                  )}
                  {campaign.starts_at && (
                    <span className="flex items-center gap-2">
                      <Calendar size={14} />
                      {formatDate(campaign.starts_at)} - {campaign.ends_at ? formatDate(campaign.ends_at) : 'Ongoing'}
                    </span>
                  )}
                </div>

                <p className="text-gray-400">{campaign.description || 'No description provided'}</p>

                {campaign.allowed_platforms && campaign.allowed_platforms.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {campaign.allowed_platforms.map((platform) => (
                      <span key={platform} className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs font-medium">
                        {getPlatformDisplayName(platform)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Users size={18} className="text-purple-400" />
                </div>
                <div>
                  <div className="text-xl font-bold">{stats.participants_count || 0}</div>
                  <div className="text-xs text-gray-400 uppercase">Participants</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
                <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                  <FileVideo size={18} className="text-cyan-400" />
                </div>
                <div>
                  <div className="text-xl font-bold">{stats.submissions_count || 0}</div>
                  <div className="text-xs text-gray-400 uppercase">Submissions</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <CheckCircle size={18} className="text-green-400" />
                </div>
                <div>
                  <div className="text-xl font-bold">{stats.verified_count || 0}</div>
                  <div className="text-xs text-gray-400 uppercase">Verified</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <Wallet size={18} className="text-orange-400" />
                </div>
                <div>
                  <div className="text-xl font-bold">${formatBudget(campaign.spent_budget || 0)}</div>
                  <div className="text-xs text-gray-400 uppercase">Spent</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Budget Progress */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <Wallet size={18} />
              <span>Budget Usage</span>
            </div>
            <span className="text-sm font-semibold">
              ${formatBudget(campaign.spent_budget || 0)} / ${formatBudget(campaign.budget)}
            </span>
          </div>

          <div className="w-full h-2 bg-gray-800 rounded-full border border-gray-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                getBudgetPercentage() < 50 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                getBudgetPercentage() < 80 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                'bg-gradient-to-r from-red-500 to-red-600'
              }`}
              style={{ width: `${getBudgetPercentage()}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>${formatBudget(getRemainingBudget())} remaining</span>
            <span>{getBudgetPercentage().toFixed(1)}% used</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-2">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                }`}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    activeTab === tab.id ? 'bg-gray-900' : 'bg-gray-800'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-semibold mb-6">Campaign Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <div className="text-xs text-gray-400 uppercase mb-2">Payment Model</div>
                    <div className="font-semibold">{campaign.payment_model === 'per_clip' ? 'Pay Per Clip' : 'CPM (Cost Per Mille)'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 uppercase mb-2">{campaign.payment_model === 'per_clip' ? 'Amount Per Clip' : 'CPM Rate'}</div>
                    <div className="font-semibold">${campaign.payment_model === 'per_clip' ? formatBudget(campaign.per_clip_amount || 0) : formatCpm(campaign.cpm)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 uppercase mb-2">Min Views for Payment</div>
                    <div className="font-semibold">{formatViews(campaign.min_views_for_payment)}</div>
                  </div>
                  {campaign.max_views && (
                    <div>
                      <div className="text-xs text-gray-400 uppercase mb-2">Max Views Cap</div>
                      <div className="font-semibold">{formatViews(campaign.max_views)}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-gray-400 uppercase mb-2">Join Type</div>
                    <div className="font-semibold">{campaign.join_type === 'open' ? 'Open to All' : 'Application Required'}</div>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-6">Streamers to Clip</h2>
                {!campaign.creator_profile_id && (!campaign.assigned_streamer_ids || campaign.assigned_streamer_ids.length === 0) ? (
                  <div className="flex items-start gap-4 p-6 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Globe size={24} className="text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Any Streamers Qualify</h3>
                      <p className="text-sm text-gray-400">
                        This campaign uses global branding. Clippers can create clips from any streamer, and the organization's branding will be applied automatically.
                      </p>
                    </div>
                  </div>
                ) : campaign.creator_profile_id ? (
                  <div>
                    <p className="text-sm text-gray-400 mb-4">This campaign is assigned to a specific creator profile:</p>
                    {campaign.creator_profile ? (
                      <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          {campaign.creator_profile.profile_image_url && (
                            <img src={campaign.creator_profile.profile_image_url} alt={campaign.creator_profile.name} className="w-12 h-12 rounded-full" />
                          )}
                          <div>
                            <div className="font-semibold">{campaign.creator_profile.name}</div>
                            <div className="text-sm text-gray-400">Creator Profile</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg text-center text-gray-400 text-sm">
                        Creator profile assigned
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-400 mb-4">Clippers can only create clips from the following streamers:</p>
                    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg text-center text-gray-400 text-sm">
                      {campaign.assigned_streamer_ids.length} streamer(s) assigned
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'submissions' && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FileVideo size={48} />
              <p className="mt-4">Submissions management coming soon</p>
            </div>
          )}

          {activeTab === 'participants' && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Users size={48} />
              <p className="mt-4">Participants list coming soon</p>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <DollarSign size={48} />
              <p className="mt-4">Payments management coming soon</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
