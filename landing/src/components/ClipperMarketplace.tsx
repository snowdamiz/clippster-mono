import { Users, DollarSign, Trophy, Briefcase, TrendingUp, Star, Check, Clock, Play } from 'lucide-react'

// Clipper Profile Card - Clean HTML/CSS version
function ClipperProfileGraphic() {
  return (
    <div className="w-full bg-[#101012] rounded-xl overflow-hidden select-none">
      {/* Header */}
      <div className="bg-[#18181b] px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Avatar and info */}
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-violet-600 flex items-center justify-center">
                <span className="text-white font-semibold text-base">JD</span>
              </div>
              {/* Verified badge */}
              <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 bg-emerald-500 rounded-full flex items-center justify-center ring-2 ring-[#18181b]">
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              </div>
            </div>
            
            {/* Name and rank */}
            <div>
              <span className="text-white font-medium text-sm block">John Doe</span>
              <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded mt-1 inline-block">#12 Rank</span>
            </div>
          </div>
          
          {/* Availability status */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-medium text-emerald-500">Available</span>
          </div>
        </div>
      </div>
      
      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-[#1f1f23] border-b border-[#1f1f23]">
        <div className="py-3 text-center">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Campaigns</p>
          <p className="text-base font-semibold text-white mt-0.5">24</p>
        </div>
        <div className="py-3 text-center">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Clips</p>
          <p className="text-base font-semibold text-white mt-0.5">847</p>
        </div>
        <div className="py-3 text-center">
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Endorsements</p>
          <p className="text-base font-semibold text-emerald-500 mt-0.5">156</p>
        </div>
      </div>
      
      {/* Tags */}
      <div className="flex gap-1.5 px-4 py-3">
        <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-zinc-800 text-zinc-400">
          Gaming
        </span>
        <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-zinc-800 text-zinc-400">
          Twitch
        </span>
        <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-zinc-800 text-zinc-400">
          Shorts
        </span>
      </div>
      
      {/* View Profile button */}
      <div className="px-4 pb-4">
        <button className="w-full py-2 rounded-lg bg-violet-600 text-white text-xs font-medium">
          View Profile
        </button>
      </div>
    </div>
  )
}

// Campaign Card - Clean HTML/CSS version
function CampaignCardGraphic() {
  return (
    <div className="w-full bg-[#101012] rounded-xl overflow-hidden select-none">
      {/* Cover image area with video thumbnails */}
      <div className="relative bg-[#18181b] p-2.5">
        {/* Thumbnail grid */}
        <div className="grid grid-cols-4 gap-1.5">
          {[...Array(4)].map((_, i) => (
            <div 
              key={i} 
              className="aspect-video bg-zinc-800 rounded flex items-center justify-center"
            >
              <Play className="w-3 h-3 text-zinc-600" />
            </div>
          ))}
        </div>
        
        {/* CPM Badge */}
        <div className="absolute bottom-0 right-2.5 translate-y-1/2 px-2.5 py-1.5 rounded-md bg-emerald-600">
          <p className="text-white font-semibold text-xs leading-none">$3.50</p>
          <p className="text-emerald-200 text-[8px] leading-none mt-0.5">/1K views</p>
        </div>
      </div>
      
      {/* Campaign info */}
      <div className="px-4 pt-5 pb-3">
        <h4 className="text-white font-medium text-sm">Gaming Highlights Q1</h4>
        
        {/* Organization */}
        <div className="flex items-center gap-2 mt-1.5">
          <div className="w-4 h-4 rounded bg-violet-600 flex items-center justify-center">
            <span className="text-[8px] font-semibold text-white">G</span>
          </div>
          <span className="text-xs text-zinc-500">GameStream Pro</span>
        </div>
      </div>
      
      {/* Stats row */}
      <div className="mx-4 mb-3 flex items-center justify-between bg-[#18181b] rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Clippers</span>
          <span className="text-sm font-semibold text-white">45</span>
        </div>
        <div className="w-px h-3 bg-zinc-700" />
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Budget</span>
          <span className="text-sm font-semibold text-emerald-500">$5,000</span>
        </div>
      </div>
      
      {/* Bottom actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <button className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium">
          Join Campaign
        </button>
        <div className="px-2.5 py-2 rounded-lg bg-emerald-500/10">
          <span className="text-[10px] font-medium text-emerald-500">Active</span>
        </div>
        <div className="flex items-center gap-1 text-zinc-500">
          <Clock className="w-3 h-3" />
          <span className="text-[10px]">14 days</span>
        </div>
      </div>
    </div>
  )
}

const forClippers = [
  { icon: Trophy, text: 'Build your reputation with a public profile' },
  { icon: DollarSign, text: 'Earn money for views on your clips' },
  { icon: TrendingUp, text: 'Climb the leaderboard and get discovered' },
  { icon: Star, text: 'Collect endorsements from organizations' },
]

const forOrganizations = [
  { icon: Users, text: 'Recruit talented clippers for your campaigns' },
  { icon: Briefcase, text: 'Create campaigns with custom CPM rates' },
  { icon: Trophy, text: 'Review and approve clip submissions' },
  { icon: TrendingUp, text: 'Track campaign performance and ROI' },
]

export function ClipperMarketplace() {
  return (
    <section id="marketplace" className="py-24 sm:py-32 relative overflow-hidden">
      <div className="section-divider absolute top-0 left-0 right-0" />
      
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-violet-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-emerald-500/[0.03] rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 lg:mb-20">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1f1f23] bg-[#141416] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Marketplace</span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 tracking-[-0.02em]">
            Connect clippers with opportunities
          </h2>
          
          <p className="text-zinc-400 max-w-2xl mx-auto text-lg leading-relaxed">
            A two-sided marketplace where clippers build their reputation and organizations find talent for their campaigns.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* For Clippers */}
          <div className="group p-6 lg:p-8 rounded-xl border border-[#1f1f23] bg-[#141416]/80">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/15 text-xs font-medium text-violet-400 mb-6">
              <Users className="w-3.5 h-3.5" />
              For Clippers
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-4 tracking-[-0.02em]">
              Monetize your clipping skills
            </h3>
            
            <p className="text-zinc-400 leading-relaxed mb-6">
              Create a public profile showcasing your work, join campaigns from top creators and brands, and get paid for every view your clips generate.
            </p>
            
            {/* Profile card preview */}
            <div className="mb-6">
              <ClipperProfileGraphic />
            </div>
            
            {/* Features list */}
            <ul className="space-y-3">
              {forClippers.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-zinc-400">
                  <div className="w-8 h-8 rounded-[8px] bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
                    <item.icon className="w-4 h-4 text-violet-400" />
                  </div>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* For Organizations */}
          <div className="group p-6 lg:p-8 rounded-xl border border-[#1f1f23] bg-[#141416]/80">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 text-xs font-medium text-emerald-400 mb-6">
              <Briefcase className="w-3.5 h-3.5" />
              For Organizations
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-4 tracking-[-0.02em]">
              Scale your content with clippers
            </h3>
            
            <p className="text-zinc-400 leading-relaxed mb-6">
              Launch campaigns with custom budgets and CPM rates. Recruit vetted clippers, review submissions, and only pay for verified performance.
            </p>
            
            {/* Campaign card preview */}
            <div className="mb-6">
              <CampaignCardGraphic />
            </div>
            
            {/* Features list */}
            <ul className="space-y-3">
              {forOrganizations.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-zinc-400">
                  <div className="w-8 h-8 rounded-[8px] bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                    <item.icon className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom stats */}
        <div className="mt-16 flex flex-wrap justify-center gap-8 lg:gap-16">
          <div className="text-center">
            <p className="text-3xl sm:text-4xl font-bold text-white">0</p>
            <p className="text-sm text-zinc-500 mt-1">Active Clippers</p>
          </div>
          <div className="text-center">
            <p className="text-3xl sm:text-4xl font-bold text-white">0</p>
            <p className="text-sm text-zinc-500 mt-1">Paid to Clippers</p>
          </div>
          <div className="text-center">
            <p className="text-3xl sm:text-4xl font-bold text-white">0</p>
            <p className="text-sm text-zinc-500 mt-1">Active Campaigns</p>
          </div>
          <div className="text-center">
            <p className="text-3xl sm:text-4xl font-bold text-white">0</p>
            <p className="text-sm text-zinc-500 mt-1">Views Generated</p>
          </div>
        </div>
      </div>
    </section>
  )
}
