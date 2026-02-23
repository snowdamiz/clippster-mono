import { Check, X, ArrowLeft, Apple, Monitor, Minus, Loader2, Sparkles, Zap, Crown, Building2, Plus, ChevronDown, Clock, Package, TrendingUp, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDownloads } from '../hooks/usePlatform'
import { useDownloadContext } from '../context/DownloadContext'
import { CTA } from '../components/CTA'
import { WaitlistModal } from '../components/WaitlistModal'
import { useState } from 'react'

// Subscription plans (actual pricing from server)
// 1 credit = 1 minute of video processing
const subscriptionPlans = [
  {
    name: 'Free',
    price: 0,
    period: 'forever',
    credits: 60,
    description: 'Try Clippster',
    icon: Package,
    features: [
      '60 one-time credits',
      '5 clip builds/day',
      '1 editor export/day',
      '2 VOD downloads/day',
    ],
    limitations: [
      'Admin watermark applied',
      'No social posting',
      'No AI Video Creator',
    ],
    cta: 'Get Started',
    highlight: false,
    accentColor: 'zinc'
  },
  {
    name: 'Starter',
    price: 29.99,
    period: 'month',
    credits: 600,
    description: 'Perfect for beginners',
    icon: Zap,
    features: [
      '600 credits/month (10 hours)',
      'Full AI clip detection',
      'HD export (1080p)',
      'Credits roll over',
    ],
    limitations: [],
    cta: 'Get Started',
    highlight: false,
    accentColor: 'blue'
  },
  {
    name: 'Creator',
    price: 54.99,
    period: 'month',
    credits: 1800,
    description: 'For growing creators',
    icon: Crown,
    popular: true,
    features: [
      '1,800 credits/month (30 hours)',
      'Full AI clip detection',
      'HD export (1080p)',
      'Credits roll over',
    ],
    limitations: [],
    cta: 'Start Creating',
    highlight: true,
    accentColor: 'violet'
  },
  {
    name: 'Pro',
    price: 204.99,
    period: 'month',
    credits: 9000,
    description: 'For power users & teams',
    icon: Building2,
    features: [
      '9,000 credits/month (150 hours)',
      'Full AI clip detection',
      'HD export (1080p)',
      'Credits roll over',
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
  { name: 'Medium Pack', credits: 600, price: 19.99, perCredit: '0.033', savings: null, popular: true, icon: TrendingUp, valueBar: 66 },
  { name: 'Large Pack', credits: 1800, price: 44.99, perCredit: '0.025', savings: '40%', icon: Crown, valueBar: 100 },
]

// Organization plans (base tiers only, no add-ons)
const organizationPlans = [
  {
    name: 'Solo',
    price: 149.99,
    period: 'month',
    seats: 0,
    credits: 0,
    description: 'For individual creators',
    icon: Package,
    features: [
      'No team seats (owner only)',
      'Team collaboration tools',
      'Shared assets & profiles',
      'Buy credits separately',
    ],
    cta: 'Get Started',
    highlight: false,
  },
  {
    name: 'Enterprise Base',
    price: 299.99,
    period: 'month',
    seats: 5,
    credits: 0,
    description: 'For small teams',
    icon: Building2,
    features: [
      '5 team seats',
      'Team collaboration tools',
      'Shared assets & profiles',
      'Buy credits separately',
    ],
    cta: 'Get Started',
    highlight: false,
  },
  {
    name: 'Enterprise AI',
    price: 499.99,
    period: 'month',
    seats: 5,
    credits: 20000,
    description: 'For AI-powered teams',
    icon: Sparkles,
    popular: true,
    features: [
      '5 team seats',
      '20,000 credits/month',
      'Team collaboration tools',
      'Shared assets & profiles',
    ],
    cta: 'Get Started',
    highlight: true,
  },
  {
    name: 'Enterprise Unlimited',
    price: 1899.99,
    period: 'month',
    seats: null,
    credits: 100000,
    description: 'For large organizations',
    icon: Trophy,
    features: [
      'Unlimited team seats',
      '100,000 credits/month',
      'Team collaboration tools',
      'Shared assets & profiles',
    ],
    cta: 'Get Started',
    highlight: false,
  },
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
      { name: 'Extra credits', clippster: 'Buy anytime', opus: 'Upgrade plan only', winner: 'clippster' },
      { name: 'Starting price', clippster: '$29.99/month', opus: '$15/month' },
      { name: 'Mid tier value', clippster: '1800 credits @ $54.99', opus: '~300 credits @ $29', winner: 'clippster' },
    ]
  },
  {
    category: 'AI & Clipping',
    features: [
      { name: 'AI highlight detection', clippster: 'yes', opus: 'yes', winner: 'tie' },
      { name: 'AI Video Creator', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Real-time live clipping', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Picture-in-Picture mode', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Manual clipping mode', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Hotkey clipping', clippster: 'yes', opus: 'no', winner: 'clippster' },
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
      { name: 'Text overlays & stickers', clippster: 'yes', opus: 'partial', winner: 'clippster' },
      { name: 'Watermark customization', clippster: 'yes', opus: 'limited', winner: 'clippster' },
      { name: 'Intro/outro templates', clippster: 'yes', opus: 'no', winner: 'clippster' },
    ]
  },
  {
    category: 'Captions & Audio',
    features: [
      { name: 'Auto-captions', clippster: 'yes', opus: 'yes', winner: 'tie' },
      { name: 'Languages', clippster: '40+', opus: '20+', winner: 'clippster' },
      { name: 'Caption styles', clippster: 'Customizable', opus: 'Templates', winner: 'clippster' },
      { name: 'Custom fonts', clippster: 'All plans', opus: 'Pro only', winner: 'clippster' },
      { name: 'Filler word removal', clippster: 'yes', opus: 'yes', winner: 'tie' },
    ]
  },
  {
    category: 'Platform & Export',
    features: [
      { name: 'App type', clippster: 'Desktop', opus: 'Web-based' },
      { name: 'Export quality', clippster: 'Up to 4K', opus: '1080p max', winner: 'clippster' },
      { name: 'Aspect ratios', clippster: 'All (any plan)', opus: 'Pro only', winner: 'clippster' },
      { name: 'Watermark-free', clippster: 'Paid plans', opus: 'Paid only', winner: 'tie' },
      { name: 'Direct publishing', clippster: 'yes', opus: 'yes', winner: 'tie' },
    ]
  },
  {
    category: 'Import Sources',
    features: [
      { name: 'YouTube', clippster: 'Coming Soon', opus: 'yes' },
      { name: 'Twitch', clippster: 'yes', opus: 'Pro only', winner: 'clippster' },
      { name: 'Kick', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'PumpFun', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Livestream DVR', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Local files', clippster: 'yes', opus: 'yes', winner: 'tie' },
      { name: 'File size limit', clippster: 'Unlimited', opus: '10-30GB', winner: 'clippster' },
    ]
  },
  {
    category: 'Teams & Organizations',
    features: [
      { name: 'Organization dashboard', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Campaign management', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Clipper recruitment', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Clipper profiles & leaderboards', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Performance-based payments', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Project organization', clippster: 'yes', opus: 'yes', winner: 'tie' },
      { name: 'Folders & tags', clippster: 'yes', opus: 'partial', winner: 'clippster' },
      { name: 'Team collaboration', clippster: 'yes', opus: 'Pro only', winner: 'tie' },
      { name: 'Asset sharing', clippster: 'yes', opus: 'Business only', winner: 'clippster' },
      { name: 'Shared credit pools', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Member credit allocation', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Social account management', clippster: 'yes', opus: 'no', winner: 'clippster' },
      { name: 'Team seats', clippster: 'Organization Accounts', opus: '2 (Pro)', winner: 'clippster' },
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
    q: 'Can I cancel anytime?',
    a: 'Yes! You can cancel your subscription at any time. Your remaining credits will stay in your account and never expire, so you can use them whenever you\'re ready.'
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit cards through Stripe, and cryptocurrency (SOL) through Phantom wallet integration.'
  },
]

function FeatureCell({ value, isWinner, isClippster }: { value: FeatureValue, isWinner?: boolean, isClippster?: boolean }) {
  const baseClasses = "flex items-center justify-center"
  
  const winnerBg = isClippster ? 'bg-cyan-500/20' : 'bg-zinc-800'
  const winnerText = isClippster ? 'text-cyan-400' : 'text-zinc-400'
  
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
    <span className={`text-sm ${isWinner && isClippster ? 'text-cyan-300 font-medium' : 'text-zinc-400'}`}>
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
        isOpen ? 'border-cyan-500/30' : 'border-zinc-800 hover:border-zinc-700'
      }`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <button 
        onClick={onClick}
        className="w-full flex items-center justify-between p-5 sm:p-6 text-left"
      >
        <h3 className="font-medium text-white pr-4 group-hover:text-zinc-100 transition-colors">{question}</h3>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
          isOpen ? 'bg-cyan-500/20' : 'bg-zinc-800 group-hover:bg-zinc-700'
        }`}>
          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${
            isOpen ? 'rotate-180 text-cyan-400' : 'text-zinc-500'
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
  const { downloadsEnabled, showWaitlistModal, setShowWaitlistModal, openWaitlistModal } = useDownloadContext()
  const [openFAQ, setOpenFAQ] = useState<number | null>(0)

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-zinc-800/50 backdrop-blur-md sticky top-0 z-50 bg-[#0a0a0b]/90">
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
          ) : !downloadsEnabled ? (
            <button
              onClick={openWaitlistModal}
              className="px-5 py-2.5 rounded-full bg-white/10 text-white/70 font-medium text-sm border border-white/20 flex items-center gap-2 cursor-pointer hover:bg-cyan-500/15 hover:border-cyan-500/30 transition-colors group"
            >
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline group-hover:text-cyan-400 transition-colors">Coming Soon</span>
            </button>
          ) : primaryDownload ? (
            <a
              href={primaryDownload.downloadUrl}
              className="group px-5 py-2.5 rounded-full bg-cyan-500 text-white font-medium text-sm hover:bg-cyan-600 transition-all duration-300 flex items-center gap-2 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30"
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
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.08)_0%,transparent_60%)]" />
            <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-cyan-500/[0.03] rounded-full blur-3xl" />
            <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-blue-500/[0.03] rounded-full blur-3xl" />
          </div>
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 mb-6 relative">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Pricing</span>
          </div>
          
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-5 relative tracking-tight">
            Simple,{' '}
            <span className="relative inline-block">
              <span className="gradient-text">flexible</span>
              <span className="absolute -bottom-1 left-0 right-0 h-3 bg-gradient-to-r from-cyan-500/20 via-blue-500/30 to-violet-500/20 blur-sm" />
            </span>
            {' '}pricing
          </h1>
          
          <p className="text-zinc-400 max-w-2xl mx-auto text-lg mb-10 relative leading-relaxed">
            Subscribe for monthly credits and top up with credit packs anytime. Credits never expire.
          </p>
        </div>

        {/* Subscription Plans */}
        <section className="mb-24">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-7xl mx-auto">
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
                      ? 'bg-gradient-to-b from-cyan-500 via-blue-500 to-violet-500 opacity-100' 
                      : 'bg-zinc-800 opacity-100 group-hover:opacity-0'
                  }`} />
                  {!plan.highlight && (
                    <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-zinc-600 via-zinc-700 to-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  )}
                  
                  {/* Subtle glow on hover */}
                  <div className={`absolute -inset-4 rounded-3xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 pointer-events-none hidden sm:block ${
                    plan.highlight ? 'bg-cyan-500/10' : 'bg-zinc-500/5'
                  }`} />
                  
                  {/* Popular badge */}
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 blur-md opacity-50" />
                        <div className="relative bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-[10px] font-bold tracking-wider uppercase px-4 py-1.5 rounded-full flex items-center gap-1.5">
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
                      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none" />
                    )}
                    
                    <div className="relative p-6">
                      {/* Icon and Plan name */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                          plan.highlight 
                            ? 'bg-gradient-to-br from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/20' 
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
                              ? 'bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent' 
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
                          ? 'bg-cyan-500/10 border border-cyan-500/20' 
                          : 'bg-zinc-800/50 border border-zinc-700/30'
                      }`}>
                        <div className="flex items-center gap-2">
                          <Sparkles className={`w-4 h-4 ${plan.highlight ? 'text-cyan-400' : 'text-zinc-500'}`} />
                          <span className={`font-semibold ${plan.highlight ? 'text-cyan-300' : 'text-zinc-300'}`}>
                            {plan.credits.toLocaleString()} credits/month
                          </span>
                        </div>
                      </div>
                      
                      {/* CTA Button */}
                      {!downloadsEnabled ? (
                        <button
                          onClick={openWaitlistModal}
                          className={`relative block w-full py-3.5 rounded-xl text-center font-medium text-sm transition-all duration-300 mb-5 overflow-hidden cursor-pointer ${
                            plan.highlight 
                              ? 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700/80 hover:border-zinc-600/50 hover:text-white' 
                              : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700/80 hover:border-zinc-600/50 hover:text-white'
                          }`}
                        >
                          <span className="relative flex items-center justify-center gap-2">
                            <Clock className="w-4 h-4" />
                            Coming Soon
                          </span>
                        </button>
                      ) : (
                        <a
                          href={primaryDownload?.downloadUrl || '#'}
                          className={`relative block w-full py-3.5 rounded-xl text-center font-medium text-sm transition-all duration-300 mb-5 overflow-hidden group/btn ${
                            plan.highlight 
                              ? 'text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-[1.02]' 
                              : 'bg-zinc-800 text-white hover:bg-zinc-700'
                          }`}
                        >
                          {plan.highlight && (
                            <>
                              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 via-blue-500 to-violet-500" />
                              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-400 to-violet-400 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                            </>
                          )}
                          <span className="relative">{plan.cta}</span>
                        </a>
                      )}
                      
                      {/* Divider */}
                      <div className={`h-px mb-5 ${plan.highlight ? 'bg-gradient-to-r from-transparent via-zinc-700 to-transparent' : 'bg-zinc-800'}`} />
                      
                      {/* Features list */}
                      <ul className="space-y-2.5">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2.5 text-sm">
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                              plan.highlight 
                                ? 'bg-cyan-500/20 text-cyan-400' 
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

        {/* Organization Plans */}
        <section className="mb-24 relative">
          <div className="section-divider absolute top-0 left-0 right-0" />
          <div className="pt-20">
            <div className="text-center mb-12">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 mb-6">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">For Organizations</span>
              </div>
              
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
                Team & Enterprise Plans
              </h2>
              <p className="text-zinc-500 max-w-lg mx-auto px-4 leading-relaxed">
                Powerful collaboration tools for teams of all sizes
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {organizationPlans.map((plan, index) => {
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
                        ? 'bg-gradient-to-b from-cyan-500 via-blue-500 to-violet-500 opacity-100' 
                        : 'bg-zinc-800 opacity-100 group-hover:opacity-0'
                    }`} />
                    {!plan.highlight && (
                      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-zinc-600 via-zinc-700 to-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    )}
                    
                    {/* Subtle glow on hover */}
                    <div className={`absolute -inset-4 rounded-3xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 pointer-events-none hidden sm:block ${
                      plan.highlight ? 'bg-cyan-500/10' : 'bg-zinc-500/5'
                    }`} />
                    
                    {/* Popular badge */}
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 blur-md opacity-50" />
                          <div className="relative bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-[10px] font-bold tracking-wider uppercase px-4 py-1.5 rounded-full flex items-center gap-1.5">
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
                        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none" />
                      )}
                      
                      <div className="relative p-6">
                        {/* Icon and Plan name */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                            plan.highlight 
                              ? 'bg-gradient-to-br from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/20' 
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
                                ? 'bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent' 
                                : 'text-white'
                            }`}>
                              ${plan.price}
                            </span>
                            <span className="text-zinc-500 text-sm">/{plan.period}</span>
                          </div>
                        </div>

                        {/* Seats & Credits highlight */}
                        <div className={`py-3 px-4 rounded-xl mb-5 ${
                          plan.highlight 
                            ? 'bg-cyan-500/10 border border-cyan-500/20' 
                            : 'bg-zinc-800/50 border border-zinc-700/30'
                        }`}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Building2 className={`w-4 h-4 ${plan.highlight ? 'text-cyan-400' : 'text-zinc-500'}`} />
                              <span className={`text-sm font-medium ${plan.highlight ? 'text-cyan-300' : 'text-zinc-300'}`}>
                                {plan.seats === null ? 'Unlimited seats' : plan.seats === 0 ? 'No team seats' : `${plan.seats} seats`}
                              </span>
                            </div>
                          </div>
                          {plan.credits > 0 && (
                            <div className="flex items-center gap-2">
                              <Sparkles className={`w-4 h-4 ${plan.highlight ? 'text-cyan-400' : 'text-zinc-500'}`} />
                              <span className={`text-sm font-medium ${plan.highlight ? 'text-cyan-300' : 'text-zinc-300'}`}>
                                {plan.credits.toLocaleString()} credits/month
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* CTA Button */}
                        {!downloadsEnabled ? (
                          <button
                            onClick={openWaitlistModal}
                            className={`relative block w-full py-3.5 rounded-xl text-center font-medium text-sm transition-all duration-300 mb-5 overflow-hidden cursor-pointer ${
                              plan.highlight 
                                ? 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700/80 hover:border-zinc-600/50 hover:text-white' 
                                : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700/80 hover:border-zinc-600/50 hover:text-white'
                            }`}
                          >
                            <span className="relative flex items-center justify-center gap-2">
                              <Clock className="w-4 h-4" />
                              Coming Soon
                            </span>
                          </button>
                        ) : (
                          <a
                            href={primaryDownload?.downloadUrl || '#'}
                            className={`relative block w-full py-3.5 rounded-xl text-center font-medium text-sm transition-all duration-300 mb-5 overflow-hidden group/btn ${
                              plan.highlight 
                                ? 'text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-[1.02]' 
                                : 'bg-zinc-800 text-white hover:bg-zinc-700'
                            }`}
                          >
                            {plan.highlight && (
                              <>
                                <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 via-blue-500 to-violet-500" />
                                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-400 to-violet-400 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                              </>
                            )}
                            <span className="relative">{plan.cta}</span>
                          </a>
                        )}
                        
                        {/* Divider */}
                        <div className={`h-px mb-5 ${plan.highlight ? 'bg-gradient-to-r from-transparent via-zinc-700 to-transparent' : 'bg-zinc-800'}`} />
                        
                        {/* Features list */}
                        <ul className="space-y-2.5">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2.5 text-sm">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                plan.highlight 
                                  ? 'bg-cyan-500/20 text-cyan-400' 
                                  : 'bg-zinc-800 text-zinc-500'
                              }`}>
                                <Check className="w-2.5 h-2.5" />
                              </div>
                              <span className="text-zinc-400 text-[13px] leading-relaxed">
                                {feature}
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
          </div>
        </section>

        {/* Comparison Section */}
        <section className="mb-24 relative">
          <div className="section-divider absolute top-0 left-0 right-0" />
          <div className="pt-20">
            <div className="text-center mb-12">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
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
                          <div className={`rounded-lg p-3 ${feature.winner === 'clippster' ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-zinc-800/50'}`}>
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
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30">
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
                          <td className={`text-center px-6 py-4 transition-colors ${feature.winner === 'clippster' ? 'bg-cyan-500/10' : ''}`}>
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

        {/* Credit Packs Section */}
        <section className="mb-24 relative">
          <div className="section-divider absolute top-0 left-0 right-0" />
          <div className="pt-20">
            <div className="text-center mb-12">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 mb-6">
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">One-time purchase</span>
              </div>
              
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
                Top up with{' '}
                <span className="relative inline-block">
                  <span className="text-cyan-400">Credit Packs</span>
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
                    className="group relative rounded-2xl transition-all duration-500 hover:-translate-y-1"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {/* Gradient border effect */}
                    <div className={`absolute -inset-[1px] rounded-2xl transition-opacity duration-300 ${
                      pack.popular 
                        ? 'bg-gradient-to-b from-cyan-400 via-cyan-500 to-blue-600 opacity-100' 
                        : 'bg-zinc-800 opacity-100 group-hover:opacity-0'
                    }`} />
                    {!pack.popular && (
                      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-zinc-600 via-zinc-700 to-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    )}
                    
                    {/* Subtle glow on hover */}
                    <div className={`absolute -inset-4 rounded-3xl opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 pointer-events-none hidden sm:block ${
                      pack.popular ? 'bg-cyan-500/15' : 'bg-zinc-500/5'
                    }`} />
                    
                    {/* Card content */}
                    <div className={`relative h-full rounded-2xl overflow-hidden ${
                      pack.popular 
                        ? 'bg-gradient-to-b from-zinc-900 to-zinc-950' 
                        : 'bg-zinc-900'
                    }`}>
                      {pack.popular && (
                        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none" />
                      )}
                      
                      {/* Top badge */}
                      {pack.popular && (
                        <div className="relative">
                          <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-r from-cyan-500 to-blue-500 opacity-20" />
                          <div className="relative bg-gradient-to-r from-cyan-500 to-blue-500 py-2">
                            <span className="text-[10px] font-bold tracking-wider uppercase text-white flex items-center justify-center gap-1.5">
                              <Trophy className="w-3 h-3" />
                              Best Value
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className={`relative p-6 ${pack.popular ? '' : 'pt-8'}`}>
                        {/* Icon and Pack name row */}
                        <div className="flex items-center gap-3 mb-5">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                            pack.popular 
                              ? 'bg-gradient-to-br from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/20' 
                              : 'bg-zinc-800 group-hover:bg-zinc-700'
                          }`}>
                            <PackIcon className={`w-5 h-5 ${pack.popular ? 'text-white' : 'text-zinc-400'}`} />
                          </div>
                          <div>
                            <div className="text-base font-semibold text-white">{pack.name}</div>
                            <div className="text-xs text-zinc-500">{Math.round(pack.credits / 60)} hours of video</div>
                          </div>
                        </div>
                        
                        {/* Credits highlight box */}
                        <div className={`py-3 px-4 rounded-xl mb-5 ${
                          pack.popular 
                            ? 'bg-cyan-500/10 border border-cyan-500/20' 
                            : 'bg-zinc-800/50 border border-zinc-700/30'
                        }`}>
                          <div className="flex items-baseline justify-between">
                            <div className="flex items-center gap-2">
                              <Sparkles className={`w-4 h-4 ${pack.popular ? 'text-cyan-400' : 'text-zinc-500'}`} />
                              <span className={`text-2xl font-bold ${pack.popular ? 'text-cyan-300' : 'text-white'}`}>
                                {pack.credits.toLocaleString()}
                              </span>
                              <span className={`text-sm ${pack.popular ? 'text-cyan-400/70' : 'text-zinc-500'}`}>credits</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Price section */}
                        <div className="mb-5">
                          <div className="flex items-baseline gap-1 mb-1">
                            <span className={`font-display text-3xl font-bold tracking-tight ${
                              pack.popular 
                                ? 'bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent' 
                                : 'text-white'
                            }`}>
                              ${pack.price}
                            </span>
                            <span className="text-zinc-500 text-sm">one-time</span>
                          </div>
                          <div className="text-xs text-zinc-600">${pack.perCredit} per credit</div>
                        </div>
                        
                        {/* Divider */}
                        <div className={`h-px mb-5 ${pack.popular ? 'bg-gradient-to-r from-transparent via-zinc-700 to-transparent' : 'bg-zinc-800'}`} />
                        
                        {/* Value indicator */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-zinc-500">Value rating</span>
                            <div className="flex items-center gap-1.5">
                              {[1, 2, 3].map((i) => (
                                <div 
                                  key={i} 
                                  className={`w-2 h-2 rounded-full transition-colors ${
                                    i <= (pack.valueBar === 100 ? 3 : pack.valueBar >= 66 ? 2 : 1)
                                      ? pack.popular ? 'bg-cyan-400' : 'bg-zinc-400'
                                      : 'bg-zinc-700'
                                  }`} 
                                />
                              ))}
                            </div>
                          </div>
                          
                          {/* Savings or starter badge */}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-zinc-500">Savings</span>
                            {pack.savings ? (
                              <span className={`font-semibold ${pack.popular ? 'text-cyan-400' : 'text-emerald-400'}`}>
                                {pack.savings} off
                              </span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-zinc-500">Never expires</span>
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                              pack.popular 
                                ? 'bg-cyan-500/20 text-cyan-400' 
                                : 'bg-zinc-800 text-zinc-500'
                            }`}>
                              <Check className="w-2.5 h-2.5" />
                            </div>
                          </div>
                        </div>
                      </div>
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
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    How credits work
                  </h3>
                </div>
                <div className="p-5 sm:p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {creditExamples.map((example, i) => (
                      <div 
                        key={example.action} 
                        className={`flex items-center justify-between text-sm p-3.5 rounded-xl gap-2 transition-colors ${
                          i === 0 ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-zinc-800/30 hover:bg-zinc-800/50'
                        }`}
                      >
                        <span className={`${i === 0 ? 'text-cyan-300' : 'text-zinc-400'}`}>{example.action}</span>
                        <span className={`font-medium whitespace-nowrap ${i === 0 ? 'text-cyan-300' : 'text-zinc-300'}`}>{example.credits}</span>
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
            <Link to="/privacy" className="hover:text-zinc-400 transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-zinc-400 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>

      {/* Waitlist Modal */}
      <WaitlistModal 
        isOpen={showWaitlistModal} 
        onClose={() => setShowWaitlistModal(false)} 
      />
    </div>
  )
}
