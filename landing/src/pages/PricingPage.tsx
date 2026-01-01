import { Check, X, ArrowLeft, Apple, Monitor, Minus, Loader2, Sparkles, Zap, Crown, Building2, Plus, ChevronDown, Star, Clock, Package, TrendingUp, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDownloads } from '../hooks/usePlatform'
import { CTA } from '../components/CTA'
import { useState } from 'react'

// Subscription plans (actual pricing from server)
// 1 credit = 1 minute of video processing
const subscriptionPlans = [
  {
    name: 'Starter',
    price: 20,
    period: 'month',
    credits: 600,
    description: 'Perfect for beginners',
    icon: Zap,
    features: [
      '600 credits/month (10 hours)',
      'Full AI clip detection',
      'HD export (1080p)',
      'YouTube, Twitch & Kick import',
      'Auto-captions (40+ languages)',
      'Credits roll over',
      'Email support'
    ],
    limitations: [],
    cta: 'Get Started',
    highlight: false,
    accentColor: 'blue'
  },
  {
    name: 'Creator',
    price: 50,
    period: 'month',
    credits: 1800,
    description: 'For growing creators',
    icon: Crown,
    popular: true,
    features: [
      '1,800 credits/month (30 hours)',
      'Full AI clip detection',
      'HD & 4K export',
      'All platforms supported',
      'Auto-captions (40+ languages)',
      'Credits roll over',
      'Priority support'
    ],
    limitations: [],
    cta: 'Start Creating',
    highlight: true,
    accentColor: 'violet'
  },
  {
    name: 'Pro',
    price: 200,
    period: 'month',
    credits: 9000,
    description: 'For power users & teams',
    icon: Building2,
    features: [
      '9,000 credits/month (150 hours)',
      'Full AI clip detection',
      '4K export',
      'All platforms supported',
      'Auto-captions (40+ languages)',
      'Credits roll over',
      'Priority processing',
      'Team collaboration',
      'Dedicated support'
    ],
    limitations: [],
    cta: 'Go Pro',
    highlight: false,
    accentColor: 'emerald'
  },
]

// Credit packs (one-time purchases - actual pricing from server)
// 1 credit = 1 minute of video processing
const creditPacks = [
  { name: 'Small Pack', credits: 240, price: 10, perCredit: '0.042', savings: null, icon: Package, valueBar: 33 },
  { name: 'Medium Pack', credits: 600, price: 20, perCredit: '0.033', savings: '21%', popular: true, icon: TrendingUp, valueBar: 66 },
  { name: 'Large Pack', credits: 1800, price: 50, perCredit: '0.028', savings: '33%', icon: Crown, valueBar: 100 },
]

// Credit usage examples (1 credit = 1 minute of video)
const creditExamples = [
  { action: 'Video processing', credits: '1 credit per minute' },
  { action: 'AI clip detection', credits: 'Included in processing' },
  { action: 'Auto-captions generation', credits: 'Included in processing' },
  { action: 'HD/4K export', credits: 'Included in processing' },
  { action: 'Credits rollover', credits: 'Yes - never expire' },
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
      { name: 'Pricing model', clippster: 'Sub + credit packs', opus: 'Monthly subscription', winner: 'clippster' },
      { name: 'Free on signup', clippster: '60 credits (1 hr)', opus: '60 credits/mo', winner: 'tie' },
      { name: 'Extra credits', clippster: 'Buy anytime', opus: 'Upgrade plan only', winner: 'clippster' },
      { name: 'Starting paid price', clippster: '$20/month', opus: '$15/month' },
      { name: 'Mid tier value', clippster: '1800 credits @ $50', opus: '~300 credits @ $29', winner: 'clippster' },
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
      { name: 'Team collaboration', clippster: 'Pro plan', opus: 'Pro only', winner: 'tie' },
      { name: 'Asset sharing', clippster: 'yes', opus: 'Business only', winner: 'clippster' },
      { name: 'Team seats', clippster: 'Included in Pro', opus: '2 (Pro)', winner: 'clippster' },
    ]
  },
]

// FAQ data
const faqs = [
  {
    q: 'How do credits work?',
    a: '1 credit = 1 minute of video processing. When you process a 10-minute video, it uses 10 credits. This covers AI detection, captioning, and export all in one.'
  },
  {
    q: 'What happens if I run out of credits?',
    a: 'You can purchase additional credit packs at any time. Credit pack purchases stack with your subscription and never expire.'
  },
  {
    q: 'Do unused credits roll over?',
    a: 'Yes! All credits roll over and never expire. Whether from subscription or credit packs, your credits stay in your account until you use them.'
  },
  {
    q: 'Do I get any free credits to try?',
    a: 'Yes! New users receive 60 free credits (1 hour of video) when signing up. No credit card required to start.'
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit cards through Stripe, and cryptocurrency (SOL) through Phantom wallet integration.'
  },
]

function FeatureCell({ value, isWinner, isClippster }: { value: FeatureValue, isWinner?: boolean, isClippster?: boolean }) {
  const baseClasses = "flex items-center justify-center"
  
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
  
  return (
    <span className={`text-sm ${isWinner && isClippster ? 'text-violet-300 font-medium' : 'text-zinc-400'}`}>
      {value}
    </span>
  )
}

// Interactive FAQ Accordion Item
function FAQItem({ question, answer, isOpen, onClick, index }: { 
  question: string
  answer: string
  isOpen: boolean
  onClick: () => void
  index: number
}) {
  return (
    <div 
      className={`group rounded-xl border bg-zinc-900/40 backdrop-blur-sm overflow-hidden transition-all duration-300 ${
        isOpen ? 'border-zinc-700' : 'border-zinc-800 hover:border-zinc-700'
      }`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <button 
        onClick={onClick}
        className="w-full flex items-center justify-between p-5 sm:p-6 text-left"
      >
        <h3 className="font-medium text-white pr-4 group-hover:text-zinc-100 transition-colors">{question}</h3>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
          isOpen ? 'bg-violet-500/20' : 'bg-zinc-800 group-hover:bg-zinc-700'
        }`}>
          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${
            isOpen ? 'rotate-180 text-violet-400' : 'text-zinc-500'
          }`} />
        </div>
      </button>
      <div className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <p className="text-sm text-zinc-400 leading-relaxed px-5 sm:px-6 pb-5 sm:pb-6">{answer}</p>
        </div>
      </div>
    </div>
  )
}

export function PricingPage() {
  const { primaryDownload, isLoading } = useDownloads()
  const [openFAQ, setOpenFAQ] = useState<number | null>(0)

  return (
    <div className="min-h-screen bg-[#09090b] overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-zinc-800/50 backdrop-blur-md sticky top-0 z-50 bg-[#09090b]/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link to="/" className="flex items-center gap-2 sm:gap-3">
              <img src="/logo-icon.svg" alt="Clippster" className="w-7 h-7 sm:w-8 sm:h-8" />
              <img src="/logo.svg" alt="Clippster" className="h-4 sm:h-5" />
            </Link>
            <Link 
              to="/" 
              className="hidden sm:flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Back to home
            </Link>
          </div>
          {isLoading ? (
            <div className="px-5 py-2.5 rounded-full bg-zinc-800 text-zinc-400 font-medium text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : primaryDownload ? (
            <a
              href={primaryDownload.downloadUrl}
              className="group px-5 py-2.5 rounded-full bg-white text-zinc-900 font-medium text-sm hover:bg-zinc-100 transition-all duration-300 flex items-center gap-2 shadow-lg shadow-white/5 hover:shadow-white/10"
            >
              {primaryDownload.platform.os === 'mac' ? <Apple className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              <span className="hidden sm:inline">Download</span>
            </a>
          ) : null}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Page Header */}
        <div className="text-center mb-16 relative overflow-visible">
          {/* Background effects */}
          <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[500px] pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.08)_0%,transparent_60%)]" />
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/[0.03] rounded-full blur-3xl" />
            <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-violet-500/[0.03] rounded-full blur-3xl" />
          </div>
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 mb-6 relative">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Pricing</span>
          </div>
          
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-5 relative tracking-tight">
            Simple,{' '}
            <span className="relative inline-block">
              <span className="gradient-text">flexible</span>
              <span className="absolute -bottom-1 left-0 right-0 h-3 bg-gradient-to-r from-blue-500/20 via-violet-500/30 to-pink-500/20 blur-sm" />
            </span>
            {' '}pricing
          </h1>
          
          <p className="text-zinc-400 max-w-2xl mx-auto text-lg mb-10 relative leading-relaxed">
            Start with 60 free credits, then subscribe for monthly credits. Top up with credit packs anytime.
          </p>

          {/* Trust signal */}
          <div className="inline-flex items-center gap-4 px-5 py-3 rounded-xl border border-zinc-800/50 bg-zinc-900/30 backdrop-blur-sm relative">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
              ))}
            </div>
            <span className="text-sm text-zinc-400">4.9/5 from 2,400+ creators</span>
          </div>
        </div>

        {/* Subscription Plans */}
        <section className="mb-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {subscriptionPlans.map((plan, index) => {
              const Icon = plan.icon
              
              return (
                <div
                  key={plan.name}
                  className="group relative rounded-2xl transition-all duration-500 hover:-translate-y-1"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Gradient border effect */}
                  <div className={`absolute -inset-[1px] rounded-2xl transition-opacity duration-300 ${
                    plan.highlight 
                      ? 'bg-gradient-to-b from-violet-500 via-fuchsia-500 to-pink-500 opacity-100' 
                      : 'bg-zinc-800 opacity-100 group-hover:opacity-0'
                  }`} />
                  {!plan.highlight && (
                    <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-zinc-600 via-zinc-700 to-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  )}
                  
                  {/* Subtle glow on hover */}
                  <div className={`absolute -inset-4 rounded-3xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 pointer-events-none hidden sm:block ${
                    plan.highlight ? 'bg-violet-500/10' : 'bg-zinc-500/5'
                  }`} />
                  
                  {/* Popular badge */}
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-pink-500 blur-md opacity-50" />
                        <div className="relative bg-gradient-to-r from-violet-500 to-pink-500 text-white text-[10px] font-bold tracking-wider uppercase px-4 py-1.5 rounded-full flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3" />
                          Most Popular
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Card content */}
                  <div className={`relative h-full rounded-2xl overflow-hidden ${
                    plan.highlight 
                      ? 'bg-gradient-to-b from-zinc-900 to-zinc-950' 
                      : 'bg-zinc-900'
                  }`}>
                    {plan.highlight && (
                      <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-transparent to-pink-500/5 pointer-events-none" />
                    )}
                    
                    <div className="relative p-6">
                      {/* Icon and Plan name */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                          plan.highlight 
                            ? 'bg-gradient-to-br from-violet-500 to-pink-500 shadow-lg shadow-violet-500/20' 
                            : 'bg-zinc-800 group-hover:bg-zinc-700'
                        }`}>
                          <Icon className={`w-5 h-5 ${plan.highlight ? 'text-white' : 'text-zinc-400'}`} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                          <p className="text-xs text-zinc-500">{plan.description}</p>
                        </div>
                      </div>
                      
                      {/* Price */}
                      <div className="mb-4">
                        <div className="flex items-baseline gap-1">
                          <span className={`font-display text-4xl font-bold tracking-tight ${
                            plan.highlight 
                              ? 'bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent' 
                              : 'text-white'
                          }`}>
                            ${plan.price}
                          </span>
                          {plan.period !== 'forever' && (
                            <span className="text-zinc-500 text-sm">/{plan.period}</span>
                          )}
                        </div>
                      </div>

                      {/* Credits highlight */}
                      <div className={`py-3 px-4 rounded-xl mb-5 ${
                        plan.highlight 
                          ? 'bg-violet-500/10 border border-violet-500/20' 
                          : 'bg-zinc-800/50 border border-zinc-700/30'
                      }`}>
                        <div className="flex items-center gap-2">
                          <Sparkles className={`w-4 h-4 ${plan.highlight ? 'text-violet-400' : 'text-zinc-500'}`} />
                          <span className={`font-semibold ${plan.highlight ? 'text-violet-300' : 'text-zinc-300'}`}>
                            {plan.credits.toLocaleString()} credits/month
                          </span>
                        </div>
                      </div>
                      
                      {/* CTA Button */}
                      <a
                        href={primaryDownload?.downloadUrl || '#'}
                        className={`relative block w-full py-3.5 rounded-xl text-center font-medium text-sm transition-all duration-300 mb-5 overflow-hidden group/btn ${
                          plan.highlight 
                            ? 'text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 hover:scale-[1.02]' 
                            : 'bg-zinc-800 text-white hover:bg-zinc-700'
                        }`}
                      >
                        {plan.highlight && (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500" />
                            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-fuchsia-400 to-pink-400 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                          </>
                        )}
                        <span className="relative">{plan.cta}</span>
                      </a>
                      
                      {/* Divider */}
                      <div className={`h-px mb-5 ${plan.highlight ? 'bg-gradient-to-r from-transparent via-zinc-700 to-transparent' : 'bg-zinc-800'}`} />
                      
                      {/* Features list */}
                      <ul className="space-y-2.5">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2.5 text-sm">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              plan.highlight 
                                ? 'bg-violet-500/20 text-violet-400' 
                                : 'bg-zinc-800 text-zinc-500'
                            }`}>
                              <Check className="w-2.5 h-2.5" />
                            </div>
                            <span className="text-zinc-400 text-[13px] leading-relaxed">
                              {feature}
                            </span>
                          </li>
                        ))}
                        {plan.limitations.map((limitation) => (
                          <li key={limitation} className="flex items-start gap-2.5 text-sm">
                            <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-zinc-800/50 text-zinc-600">
                              <X className="w-2.5 h-2.5" />
                            </div>
                            <span className="text-zinc-600 text-[13px]">
                              {limitation}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Credit Packs Section */}
        <section className="mb-24 relative">
          <div className="section-divider absolute top-0 left-0 right-0" />
          <div className="pt-20">
            <div className="text-center mb-12">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 mb-6">
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">One-time purchase</span>
              </div>
              
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
                Top up with{' '}
                <span className="relative inline-block">
                  <span className="text-emerald-400">Credit Packs</span>
                </span>
              </h2>
              <p className="text-zinc-500 max-w-lg mx-auto leading-relaxed">
                Buy extra credits whenever you need them. Credits never expire and stack with your subscription.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {creditPacks.map((pack, index) => {
                const PackIcon = pack.icon
                return (
                  <div
                    key={pack.credits}
                    className={`relative group rounded-2xl border overflow-hidden transition-all duration-300 hover:-translate-y-2 ${
                      pack.popular 
                        ? 'border-emerald-500/50 bg-gradient-to-b from-emerald-500/10 to-emerald-500/5' 
                        : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                    }`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {/* Glow effect on hover */}
                    <div className={`absolute -inset-4 rounded-3xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 pointer-events-none hidden sm:block ${
                      pack.popular ? 'bg-emerald-500/10' : 'bg-violet-500/5'
                    }`} />
                    
                    {/* Top badge */}
                    {pack.popular && (
                      <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-emerald-500 to-teal-500 py-1.5">
                        <span className="text-[10px] font-bold tracking-wider uppercase text-white flex items-center justify-center gap-1.5">
                          <Trophy className="w-3 h-3" />
                          Best Value
                        </span>
                      </div>
                    )}
                    
                    <div className={`relative p-6 ${pack.popular ? 'pt-10' : ''}`}>
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                        pack.popular 
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20' 
                          : 'bg-zinc-800 group-hover:bg-zinc-700'
                      }`}>
                        <PackIcon className={`w-6 h-6 ${pack.popular ? 'text-white' : 'text-zinc-400'}`} />
                      </div>
                      
                      {/* Pack name */}
                      <div className="text-sm font-medium text-zinc-400 mb-3 text-center">{pack.name}</div>
                      
                      {/* Credits */}
                      <div className={`text-4xl font-bold mb-1 text-center transition-transform duration-300 group-hover:scale-105 ${
                        pack.popular ? 'text-emerald-400' : 'text-white'
                      }`}>
                        {pack.credits.toLocaleString()}
                      </div>
                      <div className="text-xs text-zinc-500 mb-5 text-center">credits ({Math.round(pack.credits / 60)} hours of video)</div>
                      
                      {/* Value bar */}
                      <div className="mb-5">
                        <div className="flex justify-between text-[10px] text-zinc-500 mb-1.5">
                          <span>Value</span>
                          <span className={pack.popular ? 'text-emerald-400' : 'text-zinc-400'}>{pack.valueBar}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              pack.popular 
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                                : 'bg-zinc-600'
                            }`}
                            style={{ width: `${pack.valueBar}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Price */}
                      <div className="text-center mb-4">
                        <div className="text-3xl font-bold text-white">${pack.price}</div>
                        <div className="text-xs text-zinc-600">${pack.perCredit}/credit</div>
                      </div>
                      
                      {/* Savings badge */}
                      {pack.savings ? (
                        <div className="flex justify-center">
                          <div className="inline-flex px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                            Save {pack.savings}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <div className="inline-flex px-3 py-1.5 rounded-full bg-zinc-800 text-zinc-500 text-xs border border-zinc-700/50">
                            Starter pack
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Credit Usage Examples */}
            <div className="mt-12 max-w-3xl mx-auto">
              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/60">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    How credits work
                  </h3>
                </div>
                <div className="p-5 sm:p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {creditExamples.map((example, i) => (
                      <div 
                        key={example.action} 
                        className={`flex items-center justify-between text-sm p-3.5 rounded-xl gap-2 transition-colors ${
                          i === 0 ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-zinc-800/30 hover:bg-zinc-800/50'
                        }`}
                      >
                        <span className={`${i === 0 ? 'text-violet-300' : 'text-zinc-400'}`}>{example.action}</span>
                        <span className={`font-medium whitespace-nowrap ${i === 0 ? 'text-violet-300' : 'text-zinc-300'}`}>{example.credits}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 pt-5 border-t border-zinc-800/50 flex items-start sm:items-center gap-2.5 text-xs text-zinc-500">
                    <div className="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <span>Example: A 30-minute YouTube video uses 30 credits to process, caption, and export</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Section */}
        <section className="mb-24 relative">
          <div className="section-divider absolute top-0 left-0 right-0" />
          <div className="pt-20">
            <div className="text-center mb-12">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Comparison</span>
              </div>
              
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
                Clippster vs <span className="text-zinc-500">Opus Clip</span>
              </h2>
              <p className="text-zinc-500 max-w-lg mx-auto px-4 leading-relaxed">
                See how we compare to the leading cloud-based clipping tool
              </p>
            </div>

            {/* Mobile Comparison Cards */}
            <div className="md:hidden space-y-4">
              {comparisonFeatures.map((category) => (
                <div key={category.category} className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/40">
                  <div className="bg-zinc-900/80 px-4 py-3 border-b border-zinc-800">
                    <span className="text-sm font-semibold text-white">{category.category}</span>
                  </div>
                  <div className="divide-y divide-zinc-800/50">
                    {category.features.map((feature) => (
                      <div key={feature.name} className="p-4">
                        <div className="text-sm text-zinc-300 mb-3">{feature.name}</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className={`rounded-lg p-3 ${feature.winner === 'clippster' ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-zinc-800/50'}`}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <img src="/logo-icon.svg" alt="" className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-medium text-zinc-400">Clippster</span>
                            </div>
                            <div className="flex items-center">
                              <FeatureCell value={feature.clippster} isWinner={feature.winner === 'clippster'} isClippster={true} />
                            </div>
                          </div>
                          <div className={`rounded-lg p-3 ${feature.winner === 'opus' ? 'bg-zinc-700/50' : 'bg-zinc-800/50'}`}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-[10px] font-medium text-zinc-500">Opus Clip</span>
                            </div>
                            <div className="flex items-center">
                              <FeatureCell value={feature.opus} isWinner={feature.winner === 'opus'} isClippster={false} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Comparison Table */}
            <div className="hidden md:block rounded-2xl border border-zinc-800 overflow-hidden bg-zinc-900/40 backdrop-blur-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-900/80 border-b border-zinc-800">
                    <th className="text-left text-sm font-medium text-zinc-500 px-6 py-5 w-1/2">Feature</th>
                    <th className="text-center px-6 py-5 w-1/4">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/30">
                        <img src="/logo-icon.svg" alt="" className="w-5 h-5" />
                        <span className="text-sm font-semibold text-white">Clippster</span>
                      </div>
                    </th>
                    <th className="text-center px-6 py-5 w-1/4">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800 border border-zinc-700">
                        <span className="text-sm font-medium text-zinc-400">Opus Clip</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((category, catIndex) => (
                    <>
                      {/* Category Header */}
                      <tr key={`cat-${category.category}`} className="bg-zinc-900/60 border-y border-zinc-800">
                        <td colSpan={3} className="px-6 py-3.5">
                          <span className="text-sm font-semibold text-white">{category.category}</span>
                        </td>
                      </tr>
                      
                      {/* Category Features */}
                      {category.features.map((feature, idx) => (
                        <tr 
                          key={`${catIndex}-${feature.name}`}
                          className={`${idx !== category.features.length - 1 ? 'border-b border-zinc-800/30' : ''} hover:bg-zinc-800/30 transition-colors`}
                        >
                          <td className="text-sm text-zinc-400 px-6 py-4">{feature.name}</td>
                          <td className={`text-center px-6 py-4 transition-colors ${feature.winner === 'clippster' ? 'bg-violet-500/10' : ''}`}>
                            <FeatureCell value={feature.clippster} isWinner={feature.winner === 'clippster'} isClippster={true} />
                          </td>
                          <td className="text-center px-6 py-4">
                            <FeatureCell value={feature.opus} isWinner={feature.winner === 'opus'} isClippster={false} />
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Note */}
            <div className="mt-6 text-center">
              <p className="text-xs text-zinc-600 px-4">
                * Opus Clip pricing as of December 2024. Clippster uses a minute-based credit system (1 credit = 1 minute).
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mb-24 relative">
          <div className="section-divider absolute top-0 left-0 right-0" />
          <div className="pt-20">
            <div className="text-center mb-12">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">FAQ</span>
              </div>
              
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
                Common questions
              </h2>
              <p className="text-zinc-500 leading-relaxed">
                Everything you need to know about credits and billing
              </p>
            </div>

            <div className="max-w-3xl mx-auto space-y-3">
              {faqs.map((faq, i) => (
                <FAQItem
                  key={i}
                  question={faq.q}
                  answer={faq.a}
                  isOpen={openFAQ === i}
                  onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                  index={i}
                />
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* CTA Section */}
      <CTA />

      {/* Footer */}
      <footer className="border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
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
