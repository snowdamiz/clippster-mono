import { Check, X, ArrowLeft, Apple, Monitor, Minus, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDownloads } from '../hooks/usePlatform'
import { CTA } from '../components/CTA'

// Clippster pricing
const clippsterPlans = [
  { 
    name: 'Starter', 
    hours: 4, 
    price: 10, 
    pricePerHour: '2.50',
    description: 'Perfect for trying out',
    features: ['4 hours of processing', 'Full AI detection', 'All export formats', 'HD quality (1080p)']
  },
  { 
    name: 'Creator', 
    hours: 12, 
    price: 20, 
    pricePerHour: '1.67', 
    popular: true,
    description: 'Best for most creators',
    features: ['12 hours of processing', 'Full AI detection', 'All export formats', 'HD quality (1080p)', 'Priority processing']
  },
  { 
    name: 'Pro', 
    hours: 40, 
    price: 50, 
    pricePerHour: '1.25',
    description: 'For power users',
    features: ['40 hours of processing', 'Full AI detection', 'All export formats', '4K quality', 'Priority processing']
  },
  { 
    name: 'Studio', 
    hours: 200, 
    price: 200, 
    pricePerHour: '1.00',
    description: 'Best rate available',
    features: ['200 hours of processing', 'Full AI detection', 'All export formats', '4K quality', 'Priority processing', 'Bulk discount rate']
  },
]

// Feature comparison data
type FeatureValue = 'yes' | 'no' | 'partial' | string

interface ComparisonFeature {
  name: string
  clippster: FeatureValue
  opus: FeatureValue
  winner?: 'clippster' | 'opus' | 'tie'
}

interface ComparisonCategory {
  category: string
  features: ComparisonFeature[]
}

const comparisonFeatures: ComparisonCategory[] = [
  {
    category: 'Pricing & Value',
    features: [
      { name: 'Pricing model', clippster: 'One-time purchase', opus: 'Monthly subscription', winner: 'clippster' },
      { name: 'Credits expiration', clippster: 'Never expire', opus: 'Reset monthly', winner: 'clippster' },
      { name: 'Starting price', clippster: '$10 one-time', opus: '$15/month', winner: 'clippster' },
      { name: 'Free tier', clippster: 'no', opus: '60 credits/mo' },
    ]
  },
  {
    category: 'AI & Clipping',
    features: [
      { name: 'AI highlight detection', clippster: 'yes', opus: 'yes', winner: 'tie' },
      { name: 'Real-time live clipping', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Manual clipping mode', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Virality score', clippster: 'yes', opus: 'yes', winner: 'tie' },
      { name: 'Processing speed', clippster: 'Real-time', opus: 'Queue-based', winner: 'clippster' },
    ]
  },
  {
    category: 'Video Editor',
    features: [
      { name: 'Timeline editor', clippster: 'Advanced', opus: 'Basic', winner: 'clippster' },
      { name: 'Multi-track editing', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Drag & drop segments', clippster: 'yes', opus: 'partial' },
      { name: 'Cut/split/merge tools', clippster: 'Full suite', opus: 'Basic', winner: 'clippster' },
      { name: 'Keyboard shortcuts', clippster: 'Comprehensive', opus: 'Limited', winner: 'clippster' },
      { name: 'Zoom controls', clippster: 'Up to 10x', opus: 'Basic', winner: 'clippster' },
    ]
  },
  {
    category: 'Captions & Audio',
    features: [
      { name: 'Auto-captions', clippster: 'yes', opus: 'yes', winner: 'tie' },
      { name: 'Languages', clippster: '40+', opus: '20+', winner: 'clippster' },
      { name: 'Caption styles', clippster: 'Multiple', opus: 'Templates' },
      { name: 'Custom fonts', clippster: 'All plans', opus: 'Pro only', winner: 'clippster' },
      { name: 'Filler word removal', clippster: 'yes', opus: 'yes', winner: 'tie' },
    ]
  },
  {
    category: 'Platform & Export',
    features: [
      { name: 'App type', clippster: 'Desktop', opus: 'Web-based' },
      { name: 'Works offline', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Export quality', clippster: 'Up to 4K', opus: '1080p max', winner: 'clippster' },
      { name: 'Aspect ratios', clippster: 'All (any plan)', opus: 'Pro only', winner: 'clippster' },
      { name: 'Watermark-free', clippster: 'All plans', opus: 'Paid only', winner: 'clippster' },
      { name: 'Direct publishing', clippster: 'Coming soon', opus: 'yes' },
    ]
  },
  {
    category: 'Import Sources',
    features: [
      { name: 'YouTube', clippster: 'yes', opus: 'yes', winner: 'tie' },
      { name: 'Twitch', clippster: 'yes', opus: 'Pro only', winner: 'clippster' },
      { name: 'Kick', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Local files', clippster: 'yes', opus: 'yes', winner: 'tie' },
      { name: 'File size limit', clippster: 'Unlimited', opus: '10-30GB', winner: 'clippster' },
    ]
  },
  {
    category: 'Teams & Organization',
    features: [
      { name: 'Project organization', clippster: 'yes', opus: 'yes', winner: 'tie' },
      { name: 'Folders & tags', clippster: 'yes', opus: 'partial' },
      { name: 'Team collaboration', clippster: 'All plans', opus: 'Pro only', winner: 'clippster' },
      { name: 'Asset sharing', clippster: 'yes', opus: 'Business only', winner: 'clippster' },
      { name: 'Team seats', clippster: 'Unlimited', opus: '2 (Pro)', winner: 'clippster' },
    ]
  },
  {
    category: 'Security & Privacy',
    features: [
      { name: 'Data storage', clippster: 'Local-first', opus: 'Cloud only', winner: 'clippster' },
      { name: 'Authentication', clippster: 'Wallet (Solana)', opus: 'Email/OAuth' },
      { name: 'Third-party data sharing', clippster: 'None', opus: 'Unknown', winner: 'clippster' },
      { name: 'Crypto payments', clippster: 'yes', opus: 'no', winner: 'clippster' },
    ]
  },
]

function FeatureCell({ value, isWinner, isClippster }: { value: FeatureValue, isWinner?: boolean, isClippster?: boolean }) {
  const baseClasses = "flex items-center justify-center"
  
  // Use violet/pink for Clippster highlights
  const winnerBg = isClippster ? 'bg-violet-500/20' : 'bg-zinc-800'
  const winnerText = isClippster ? 'text-violet-400' : 'text-zinc-400'
  
  if (value === 'yes') {
    return (
      <div className={baseClasses}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isWinner && isClippster ? winnerBg : 'bg-zinc-800'}`}>
          <Check className={`w-4 h-4 ${isWinner && isClippster ? winnerText : 'text-zinc-400'}`} />
        </div>
      </div>
    )
  }
  
  if (value === 'no') {
    return (
      <div className={baseClasses}>
        <div className="w-6 h-6 rounded-full bg-zinc-800/50 flex items-center justify-center">
          <X className="w-4 h-4 text-zinc-600" />
        </div>
      </div>
    )
  }
  
  if (value === 'partial') {
    return (
      <div className={baseClasses}>
        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center">
          <Minus className="w-4 h-4 text-zinc-500" />
        </div>
      </div>
    )
  }
  
  // String value
  return (
    <span className={`text-sm ${isWinner && isClippster ? 'text-violet-300 font-medium' : 'text-zinc-400'}`}>
      {value}
    </span>
  )
}

export function PricingPage() {
  const { primaryDownload, isLoading } = useDownloads()

  return (
    <div className="min-h-screen bg-[#09090b]">
      {/* Header */}
      <header className="border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-3">
              <img src="/logo-icon.svg" alt="Clippster" className="w-8 h-8" />
              <img src="/logo.svg" alt="Clippster" className="h-5" />
            </Link>
            <Link 
              to="/" 
              className="hidden sm:flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to home
            </Link>
          </div>
          {isLoading ? (
            <div className="px-5 py-2.5 rounded-full bg-white/50 text-zinc-900 font-medium text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : primaryDownload ? (
            <a
              href={primaryDownload.downloadUrl}
              className="px-5 py-2.5 rounded-full bg-white text-zinc-900 font-medium text-sm hover:bg-zinc-100 transition-colors flex items-center gap-2"
            >
              {primaryDownload.platform.os === 'mac' ? <Apple className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              <span className="hidden sm:inline">Download</span>
            </a>
          ) : null}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 sm:py-16">
        {/* Page Header */}
        <div className="text-center mb-16">
          <p className="text-violet-400 text-sm font-medium tracking-wide uppercase mb-4">
            Pricing
          </p>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-5">
            Pay once, own forever
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto text-lg">
            No subscriptions. No monthly fees. Buy processing hours when you need them — they never expire.
          </p>
        </div>

        {/* Clippster Plans */}
        <section className="mb-24 pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {clippsterPlans.map((plan, index) => (
              <div
                key={plan.name}
                className="group relative rounded-2xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Gradient border effect */}
                <div className={`absolute -inset-[1px] rounded-2xl transition-opacity duration-300 ${
                  plan.popular 
                    ? 'bg-gradient-to-b from-violet-500 via-fuchsia-500 to-pink-500 opacity-100' 
                    : 'bg-zinc-800 opacity-100 group-hover:opacity-0'
                }`} />
                {!plan.popular && (
                  <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-zinc-600 via-zinc-700 to-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                )}
                
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-pink-500 blur-md opacity-50" />
                      <div className="relative bg-gradient-to-r from-violet-500 to-pink-500 text-white text-[10px] font-bold tracking-wider uppercase px-4 py-1 rounded-full">
                        Most Popular
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Card content */}
                <div className={`relative h-full rounded-2xl overflow-hidden ${
                  plan.popular 
                    ? 'bg-gradient-to-b from-zinc-900 to-zinc-950' 
                    : 'bg-zinc-900'
                }`}>
                  {/* Subtle inner glow for popular */}
                  {plan.popular && (
                    <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-transparent to-pink-500/5 pointer-events-none" />
                  )}
                  
                  <div className="relative p-6">
                    {/* Plan name and description */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-zinc-300">
                          {plan.name}
                        </h3>
                        {index === 3 && (
                          <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                            Best Value
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-600">{plan.description}</p>
                    </div>
                    
                    {/* Hours display */}
                    <div className="mb-1">
                      <span className={`font-display text-4xl font-bold tracking-tight ${
                        plan.popular 
                          ? 'bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent' 
                          : 'text-white'
                      }`}>
                        {plan.hours}
                      </span>
                      <span className="text-zinc-500 ml-1.5 text-base">hours</span>
                    </div>
                    
                    {/* Price */}
                    <div className="mb-6 flex items-baseline gap-1.5">
                      <span className="text-xl font-bold text-white">
                        ${plan.price}
                      </span>
                      <span className="text-zinc-600 text-xs">
                        ${plan.pricePerHour}/hr
                      </span>
                    </div>
                    
                    {/* CTA Button */}
                    <a
                      href={primaryDownload?.downloadUrl || '#'}
                      className={`relative block w-full py-2.5 rounded-lg text-center font-medium text-sm transition-all duration-300 mb-6 overflow-hidden ${
                        plan.popular 
                          ? 'text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30' 
                          : 'bg-zinc-800 text-white hover:bg-zinc-700'
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500" />
                      )}
                      <span className="relative">Get Started</span>
                    </a>
                    
                    {/* Divider */}
                    <div className={`h-px mb-5 ${plan.popular ? 'bg-gradient-to-r from-transparent via-zinc-700 to-transparent' : 'bg-zinc-800'}`} />
                    
                    {/* Features list */}
                    <ul className="space-y-2.5">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5 text-sm">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            plan.popular 
                              ? 'bg-violet-500/20 text-violet-400' 
                              : 'bg-zinc-800 text-zinc-500'
                          }`}>
                            <Check className="w-2.5 h-2.5" />
                          </div>
                          <span className="text-zinc-400 text-[13px]">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-zinc-500">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-violet-400" />
              Pay with SOL
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-violet-400" />
              Credits never expire
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-violet-400" />
              No subscriptions
            </span>
          </div>
        </section>

        {/* Comparison Section */}
        <section className="mb-24">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
              Clippster vs Opus Clip
            </h2>
            <p className="text-zinc-500 max-w-lg mx-auto">
              See how we compare to the leading cloud-based clipping tool
            </p>
          </div>

          {/* Comparison Table */}
          <div className="rounded-2xl border border-zinc-800 overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800">
                  <th className="text-left text-sm font-medium text-zinc-500 px-6 py-4 w-1/2">Feature</th>
                  <th className="text-center px-6 py-4 w-1/4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/30">
                      <img src="/logo-icon.svg" alt="" className="w-5 h-5" />
                      <span className="text-sm font-semibold text-white">Clippster</span>
                    </div>
                  </th>
                  <th className="text-center px-6 py-4 w-1/4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800 border border-zinc-700">
                      <span className="text-sm font-medium text-zinc-400">Opus Clip</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((category) => (
                  <>
                    {/* Category Header */}
                    <tr key={`cat-${category.category}`} className="bg-zinc-900/70 border-y border-zinc-800">
                      <td colSpan={3} className="px-6 py-3">
                        <span className="text-sm font-semibold text-white">{category.category}</span>
                      </td>
                    </tr>
                    
                    {/* Category Features */}
                    {category.features.map((feature, idx) => (
                      <tr 
                        key={feature.name}
                        className={`${idx !== category.features.length - 1 ? 'border-b border-zinc-800/30' : ''} hover:bg-zinc-900/30 transition-colors`}
                      >
                        <td className="text-sm text-zinc-400 px-6 py-3.5">{feature.name}</td>
                        <td className={`text-center px-6 py-3.5 ${feature.winner === 'clippster' ? 'bg-violet-500/10' : ''}`}>
                          <FeatureCell value={feature.clippster} isWinner={feature.winner === 'clippster'} isClippster={true} />
                        </td>
                        <td className="text-center px-6 py-3.5">
                          <FeatureCell value={feature.opus} isWinner={feature.winner === 'opus'} isClippster={false} />
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Opus Pricing Note */}
          <div className="mt-6 text-center">
            <p className="text-xs text-zinc-600">
              * Opus Clip pricing as of December 2024: Free ($0, 60 credits/mo) · Starter ($15/mo) · Pro ($29/mo). Credits reset monthly.
            </p>
          </div>
        </section>
      </main>

      {/* CTA Section - Reusing the component from main page */}
      <CTA />

      {/* Footer */}
      <footer className="border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo-icon.svg" alt="Clippster" className="w-6 h-6 opacity-50" />
            <p className="text-xs text-zinc-600">
              © {new Date().getFullYear()} Clippster. All rights reserved.
            </p>
          </div>
          <div className="flex items-center gap-6 text-xs text-zinc-600">
            <Link to="/" className="hover:text-zinc-400 transition-colors">Home</Link>
            <a href="#" className="hover:text-zinc-400 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-400 transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
