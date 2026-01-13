import { Users, DollarSign, Trophy, Briefcase, TrendingUp, Star, ChevronRight } from 'lucide-react'

// Clipper Profile Card SVG
function ClipperProfileGraphic() {
  return (
    <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
      <defs>
        <linearGradient id="clipperGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6"/>
          <stop offset="100%" stopColor="#7c3aed"/>
        </linearGradient>
        <linearGradient id="rankGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fbbf24"/>
          <stop offset="100%" stopColor="#f59e0b"/>
        </linearGradient>
      </defs>
      
      {/* Card background */}
      <rect width="280" height="200" rx="12" fill="#141416" stroke="#1f1f23" strokeWidth="1"/>
      
      {/* Profile header */}
      <rect x="0" y="0" width="280" height="60" rx="12" fill="#1f1f23"/>
      <rect x="0" y="48" width="280" height="12" fill="#1f1f23"/>
      
      {/* Avatar */}
      <circle cx="40" cy="50" r="28" fill="url(#clipperGrad)"/>
      <text x="40" y="56" fill="white" fontSize="18" textAnchor="middle" fontWeight="700">JD</text>
      
      {/* Verified badge */}
      <circle cx="58" cy="68" r="9" fill="#10b981"/>
      <path d="M54 68 L57 71 L63 65" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      
      {/* Name and rank */}
      <text x="80" y="42" fill="#e4e4e7" fontSize="13" fontWeight="600">John Doe</text>
      <rect x="80" y="48" width="52" height="16" rx="4" fill="url(#rankGrad)"/>
      <text x="106" y="60" fill="#422006" fontSize="9" textAnchor="middle" fontWeight="700">#12 Rank</text>
      
      {/* Available badge */}
      <rect x="190" y="36" width="74" height="22" rx="6" fill="#10b981" opacity="0.15"/>
      <circle cx="206" cy="47" r="4" fill="#10b981">
        <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite"/>
      </circle>
      <text x="240" y="51" fill="#10b981" fontSize="9" fontWeight="500" textAnchor="middle">Available</text>
      
      {/* Stats row */}
      <rect x="16" y="84" width="248" height="50" rx="8" fill="#0a0a0b"/>
      
      {/* Stat items */}
      <g>
        <text x="56" y="104" fill="#71717a" fontSize="9" textAnchor="middle">Campaigns</text>
        <text x="56" y="122" fill="#e4e4e7" fontSize="16" textAnchor="middle" fontWeight="700">24</text>
      </g>
      
      <line x1="98" y1="92" x2="98" y2="126" stroke="#1f1f23" strokeWidth="1"/>
      
      <g>
        <text x="140" y="104" fill="#71717a" fontSize="9" textAnchor="middle">Clips</text>
        <text x="140" y="122" fill="#e4e4e7" fontSize="16" textAnchor="middle" fontWeight="700">847</text>
      </g>
      
      <line x1="182" y1="92" x2="182" y2="126" stroke="#1f1f23" strokeWidth="1"/>
      
      <g>
        <text x="224" y="104" fill="#71717a" fontSize="9" textAnchor="middle">Endorsements</text>
        <text x="224" y="122" fill="#10b981" fontSize="16" textAnchor="middle" fontWeight="700">156</text>
      </g>
      
      {/* Tags */}
      <rect x="16" y="142" width="56" height="20" rx="5" fill="#8b5cf6" opacity="0.15"/>
      <text x="44" y="156" fill="#a78bfa" fontSize="8" textAnchor="middle" fontWeight="500">Gaming</text>
      
      <rect x="78" y="142" width="50" height="20" rx="5" fill="#06b6d4" opacity="0.15"/>
      <text x="103" y="156" fill="#06b6d4" fontSize="8" textAnchor="middle" fontWeight="500">Twitch</text>
      
      <rect x="134" y="142" width="46" height="20" rx="5" fill="#10b981" opacity="0.15"/>
      <text x="157" y="156" fill="#34d399" fontSize="8" textAnchor="middle" fontWeight="500">Shorts</text>
      
      {/* Hire button */}
      <rect x="16" y="170" width="248" height="24" rx="6" fill="url(#clipperGrad)"/>
      <text x="140" y="186" fill="white" fontSize="11" textAnchor="middle" fontWeight="600">View Profile</text>
    </svg>
  )
}

// Campaign Card SVG
function CampaignCardGraphic() {
  return (
    <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
      <defs>
        <linearGradient id="campaignGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981"/>
          <stop offset="100%" stopColor="#059669"/>
        </linearGradient>
      </defs>
      
      {/* Card background */}
      <rect width="280" height="200" rx="12" fill="#141416" stroke="#1f1f23" strokeWidth="1"/>
      
      {/* Cover image area */}
      <rect x="0" y="0" width="280" height="70" rx="12" fill="#1f1f23"/>
      <rect x="0" y="58" width="280" height="12" fill="#1f1f23"/>
      
      {/* Decorative pattern */}
      <rect x="12" y="12" width="256" height="46" rx="6" fill="#27272a"/>
      <rect x="20" y="20" width="60" height="30" rx="4" fill="#3f3f46"/>
      <rect x="88" y="20" width="60" height="30" rx="4" fill="#3f3f46"/>
      <rect x="156" y="20" width="60" height="30" rx="4" fill="#3f3f46"/>
      <rect x="224" y="20" width="36" height="30" rx="4" fill="#3f3f46"/>
      
      {/* CPM badge */}
      <rect x="200" y="58" width="68" height="28" rx="6" fill="url(#campaignGrad)"/>
      <text x="234" y="70" fill="white" fontSize="11" textAnchor="middle" fontWeight="700">$3.50</text>
      <text x="234" y="81" fill="rgba(255,255,255,0.8)" fontSize="8" textAnchor="middle">/1K views</text>
      
      {/* Campaign title */}
      <text x="16" y="102" fill="#e4e4e7" fontSize="13" fontWeight="600">Gaming Highlights Q1</text>
      
      {/* Organization */}
      <rect x="16" y="110" width="20" height="20" rx="5" fill="#8b5cf6"/>
      <text x="26" y="124" fill="white" fontSize="10" textAnchor="middle" fontWeight="600">G</text>
      <text x="42" y="124" fill="#71717a" fontSize="10">GameStream Pro</text>
      
      {/* Stats */}
      <rect x="16" y="138" width="248" height="28" rx="6" fill="#0a0a0b"/>
      
      <text x="54" y="156" fill="#71717a" fontSize="9" textAnchor="middle">Clippers</text>
      <text x="98" y="156" fill="#e4e4e7" fontSize="11" textAnchor="middle" fontWeight="600">45</text>
      
      <line x1="130" y1="144" x2="130" y2="160" stroke="#1f1f23" strokeWidth="1"/>
      
      <text x="166" y="156" fill="#71717a" fontSize="9" textAnchor="middle">Budget</text>
      <text x="208" y="156" fill="#10b981" fontSize="11" textAnchor="middle" fontWeight="600">$5,000</text>
      
      {/* Join button */}
      <rect x="16" y="174" width="120" height="22" rx="6" fill="url(#campaignGrad)"/>
      <text x="76" y="189" fill="white" fontSize="10" textAnchor="middle" fontWeight="600">Join Campaign</text>
      
      {/* Status badge */}
      <rect x="144" y="174" width="60" height="22" rx="6" fill="#22c55e" opacity="0.15"/>
      <text x="174" y="189" fill="#22c55e" fontSize="9" textAnchor="middle" fontWeight="500">Active</text>
      
      {/* Time remaining */}
      <text x="256" y="189" fill="#71717a" fontSize="9" textAnchor="end">14 days left</text>
    </svg>
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
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Marketplace</span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 tracking-[-0.02em]">
            Connect clippers with{' '}
            <span className="relative inline-block">
              <span className="relative z-10">opportunities</span>
              <span className="absolute -bottom-1 left-0 right-0 h-3 bg-gradient-to-r from-violet-500/20 via-emerald-500/20 to-violet-500/20 blur-sm" />
            </span>
          </h2>
          
          <p className="text-zinc-400 max-w-2xl mx-auto text-lg leading-relaxed">
            A two-sided marketplace where clippers build their reputation and organizations find talent for their campaigns.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* For Clippers */}
          <div className="group p-6 lg:p-8 rounded-[12px] border border-[#1f1f23] bg-[#141416]/50 backdrop-blur-sm transition-all duration-200 hover:border-violet-500/30 hover:bg-[#141416]/80 hover:shadow-2xl hover:shadow-violet-500/5">
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
            <div className="rounded-[10px] border border-[#1f1f23] bg-[#141416] p-3 mb-6 overflow-hidden transition-all duration-200 group-hover:border-violet-500/20">
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
            
            {/* CTA */}
            <div className="mt-8 flex items-center gap-2 text-sm font-medium text-violet-400 group/link cursor-pointer">
              <span>Create your clipper profile</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1" />
            </div>
          </div>

          {/* For Organizations */}
          <div className="group p-6 lg:p-8 rounded-[12px] border border-[#1f1f23] bg-[#141416]/50 backdrop-blur-sm transition-all duration-200 hover:border-emerald-500/30 hover:bg-[#141416]/80 hover:shadow-2xl hover:shadow-emerald-500/5">
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
            <div className="rounded-[10px] border border-[#1f1f23] bg-[#141416] p-3 mb-6 overflow-hidden transition-all duration-200 group-hover:border-emerald-500/20">
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
            
            {/* CTA */}
            <div className="mt-8 flex items-center gap-2 text-sm font-medium text-emerald-400 group/link cursor-pointer">
              <span>Create your organization</span>
              <ChevronRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1" />
            </div>
          </div>
        </div>

        {/* Bottom stats */}
        <div className="mt-16 flex flex-wrap justify-center gap-8 lg:gap-16">
          <div className="text-center">
            <p className="text-3xl sm:text-4xl font-bold text-white">2,400+</p>
            <p className="text-sm text-zinc-500 mt-1">Active Clippers</p>
          </div>
          <div className="text-center">
            <p className="text-3xl sm:text-4xl font-bold text-white">$120K+</p>
            <p className="text-sm text-zinc-500 mt-1">Paid to Clippers</p>
          </div>
          <div className="text-center">
            <p className="text-3xl sm:text-4xl font-bold text-white">50+</p>
            <p className="text-sm text-zinc-500 mt-1">Active Campaigns</p>
          </div>
          <div className="text-center">
            <p className="text-3xl sm:text-4xl font-bold text-white">15M+</p>
            <p className="text-sm text-zinc-500 mt-1">Views Generated</p>
          </div>
        </div>
      </div>
    </section>
  )
}
