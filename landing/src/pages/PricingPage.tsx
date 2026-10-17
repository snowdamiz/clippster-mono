import {ProductComparison} from '@/components/marketing/ProductComparison'
import {Header} from '@/components/Header';
import {Footer} from '@/components/Footer';
import { Check, X, Sparkles, Zap, Crown, Building2, Plus, ChevronDown, Package, TrendingUp, Trophy, Clock } from 'lucide-react'
import { useDownloads } from '../hooks/usePlatform'
import { CTA } from '../components/CTA'
import { useState } from 'react'
import { trackDownloadClick, trackLandingEvent } from '@/services/landingAnalytics'

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
      '60 credits/month',
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
    name: 'Basic',
    price: 12.99,
    period: 'month',
    credits: 0,
    description: 'Essential features',
    icon: Zap,
    features: [
      'Unlimited clip builds',
      'Social posting & scheduling',
      'Campaign participation',
      'Custom watermark',
    ],
    limitations: [
      'No AI clip detection',
      'No AI Video Creator',
      'No organization features',
      'Large credit pack only (1,800 @ $39.99)',
    ],
    cta: 'Get Started',
    highlight: false,
    accentColor: 'sky'
  },
  {
    name: 'Starter',
    price: 24.99,
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
    price: 49.99,
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
    price: 199.99,
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
  { name: 'Small Pack', credits: 240, price: 10, perCredit: '0.042', icon: Package },
  { name: 'Medium Pack', credits: 600, price: 20, perCredit: '0.033', popular: true, icon: TrendingUp },
  { name: 'Large Pack', credits: 1800, price: 39.99, perCredit: '0.022', icon: Crown },
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
      'Owner only (no team seats)',
      'Team collaboration tools',
      'Shared assets & profiles',
      'Unlimited marketing campaigns',
      'Browse clipper talent directory',
      'Post job listings for clippers & video editors',
    ],
    cta: 'Get Started',
    highlight: false,
  },
  {
    name: 'Enterprise Base',
    price: 349.99,
    period: 'month',
    seats: 5,
    credits: 0,
    description: 'For small teams',
    icon: Building2,
    features: [
      '5 team seats',
      'Team collaboration tools',
      'Shared assets & profiles',
      'Unlimited marketing campaigns',
      'Browse clipper talent directory',
      'Post job listings for clippers & video editors',
    ],
    cta: 'Get Started',
    highlight: false,
  },
  {
    name: 'Enterprise AI',
    price: 549.99,
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
      'Unlimited marketing campaigns',
      'Browse clipper talent directory',
      'Post job listings for clippers & video editors',
    ],
    cta: 'Get Started',
    highlight: true,
  },
  {
    name: 'Enterprise Unlimited',
    price: 2199.99,
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
      'Unlimited marketing campaigns',
      'Browse clipper talent directory',
      'Post job listings for clippers & video editors',
    ],
    cta: 'Get Started',
    highlight: false,
  },
]

// Credit usage examples (1 credit = 1 minute of video)
const creditExamples = [
  { action: 'Video processing', credits: '1 credit per minute' },
  { action: 'AI clip detection', credits: 'Included in processing' },
  
  
  { action: 'Credits rollover', credits: 'Paid credits roll over; downgrade rules apply' },
]

// FAQ data
const faqs = [
  {
    q: 'How do credits work?',
    a: '1 credit = 1 minute of video processing. When you process a 10-minute video, it uses 10 credits. Feature access and daily limits depend on your plan.'
  },
  {
    q: 'What happens if I run out of credits?',
    a: 'You can purchase additional credit packs at any time. Available packs depend on your plan. Downgrading to Basic resets your credit balance.'
  },
  {
    q: 'Do unused credits roll over?',
    a: 'Unused paid credits roll over. Downgrading to Basic resets your balance; Free monthly credits are capped.'
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes! You can cancel your subscription at any time. Feature access changes with your plan. Downgrading to Basic resets your credit balance.'
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit cards through Stripe.'
  },
]

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
  const { primaryDownload } = useDownloads()
  const [openFAQ, setOpenFAQ] = useState<number | null>(0)

  const trackPricingDownload = (source: string, label: string) => {
    if (primaryDownload) {
      trackDownloadClick(primaryDownload, source, label)
      return
    }

    trackLandingEvent('landing_cta_click', { source, button_label: label })
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <Header />

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
            Subscribe for monthly credits and top up with credit packs anytime. Paid credits roll over; plan-change rules apply.
          </p>
        </div>

        {/* Subscription Plans */}
        <section className="mb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
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
                      <a
                        href={primaryDownload?.downloadUrl || '#'}
                        className={`relative block w-full py-3.5 rounded-xl text-center font-medium text-sm transition-all duration-300 mb-5 overflow-hidden group/btn ${
                          plan.highlight 
                            ? 'text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-[1.02]' 
                            : 'bg-zinc-800 text-white hover:bg-zinc-700'
                        }`}
                        onClick={() => trackPricingDownload(`pricing_user_plan_${plan.name.toLowerCase().replaceAll(' ', '_')}`, plan.cta)}
                      >
                        {plan.highlight && (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 via-blue-500 to-violet-500" />
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-400 to-violet-400 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
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
              
              {/* 0% Campaign Fees Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 mt-4">
                <span className="text-sm font-semibold text-emerald-400">0% Campaign Fees</span>
                <span className="text-xs text-emerald-300/70">•</span>
                <span className="text-xs text-zinc-400">Organization plans for campaign workflows</span>
              </div>
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
                        <a
                          href={primaryDownload?.downloadUrl || '#'}
                          className={`relative block w-full py-3.5 rounded-xl text-center font-medium text-sm transition-all duration-300 mb-5 overflow-hidden group/btn ${
                            plan.highlight 
                              ? 'text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-[1.02]' 
                              : 'bg-zinc-800 text-white hover:bg-zinc-700'
                          }`}
                          onClick={() => trackPricingDownload(`pricing_org_plan_${plan.name.toLowerCase().replaceAll(' ', '_')}`, plan.cta)}
                        >
                          {plan.highlight && (
                            <>
                              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 via-blue-500 to-violet-500" />
                              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-blue-400 to-violet-400 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
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

        <ProductComparison />

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
                Buy extra credits whenever you need them. Credits stack with your subscription; plan changes can affect your balance.
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
                              Popular
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
                        
                        <p className="text-xs text-zinc-500 leading-relaxed">Adds to your credit balance. Available packs and credit retention depend on your plan.</p>
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
                    <span>Example: Processing 30 minutes of video uses 30 credits. Feature access depends on your plan.</span>
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
      <Footer />

    </div>
  )
}
