import { Brain, Clock, Shield, Zap, Share2, Wand2, PictureInPicture2, Building2, type LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
  stat?: { value: string; label: string }
  accentColor?: 'cyan' | 'purple' | 'pink' | 'green'
}

const features: Feature[] = [
  {
    icon: Brain,
    title: 'AI Highlight Detection',
    description: 'Realtime highlight detection on desktop flags peak moments during a live stream or on a VOD—then you review and edit before export.',
    stat: { value: 'Live', label: 'detect' },
    accentColor: 'cyan',
  },
  {
    icon: PictureInPicture2,
    title: 'Picture-in-Picture Mode',
    description: 'Watch live streams in a floating window while you work. Clip with hotkeys or let AI detect highlights automatically.',
    stat: { value: 'Always', label: 'on-top' },
    accentColor: 'purple',
  },
  {
    icon: Wand2,
    title: 'Auto-Captions',
    description: 'AI-generated captions with timing controls, styling presets, and verified multi-language support in the desktop editor.',
    stat: { value: '9', label: 'languages' },
    accentColor: 'pink',
  },
  {
    icon: Building2,
    title: 'Organization Tools',
    description: 'Run campaigns, recruit clippers, manage teams, and track submissions. Everything you need to scale content creation.',
    stat: { value: 'Full', label: 'dashboard' },
    accentColor: 'green',
  },
  {
    icon: Clock,
    title: 'Live Stream DVR & Clipping',
    description: 'Watch streams in Picture-in-Picture mode, record with DVR, and clip highlights in real-time with AI detection or hotkeys.',
    accentColor: 'cyan',
  },
  {
    icon: Share2,
    title: 'Multi-Platform Export',
    description: 'Schedule posts to Instagram, TikTok, X, and YouTube. Aspect ratios and formats tuned for short-form networks.',
    stat: { value: '4', label: 'publish targets' },
    accentColor: 'pink',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Desktop app with local processing. Your videos stay on your machine and are only uploaded when you choose to export or schedule posts.',
    accentColor: 'green',
  },
  {
    icon: Zap,
    title: 'Batch Processing',
    description: 'Process multiple videos simultaneously. Queue content and let the AI work in the background while you edit.',
    accentColor: 'cyan',
  },
]

const accentStyles = {
  cyan: {
    indicator: 'bg-gradient-to-b from-cyan-500 to-cyan-600',
    iconBg: 'bg-cyan-500/15',
    iconColor: 'text-cyan-500 group-hover:text-cyan-400',
    statColor: 'text-cyan-500',
  },
  purple: {
    indicator: 'bg-gradient-to-b from-violet-500 to-violet-600',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-500 group-hover:text-violet-400',
    statColor: 'text-violet-500',
  },
  pink: {
    indicator: 'bg-gradient-to-b from-pink-500 to-pink-600',
    iconBg: 'bg-pink-500/15',
    iconColor: 'text-pink-500 group-hover:text-pink-400',
    statColor: 'text-pink-500',
  },
  green: {
    indicator: 'bg-gradient-to-b from-emerald-500 to-emerald-600',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-500 group-hover:text-emerald-400',
    statColor: 'text-emerald-500',
  },
}

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon
  const accent = accentStyles[feature.accentColor || 'cyan']
  
  return (
    <div className="group relative rounded-[10px] border border-[#1f1f23] bg-[#141416] hover:border-[rgba(255,255,255,0.1)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition-all duration-200 overflow-hidden p-5 lg:p-6">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-[10px] ${accent.iconBg} flex items-center justify-center mb-4`}>
          <Icon className={`w-5 h-5 ${accent.iconColor} transition-colors`} />
        </div>
        
        {/* Title + Stat */}
        <div className="flex items-baseline justify-between gap-4 mb-2">
          <h3 className="text-base font-semibold text-white tracking-[-0.01em]">
            {feature.title}
          </h3>
          {feature.stat && (
            <div className="text-right shrink-0">
              <span className={`text-lg font-bold ${accent.statColor}`}>
                {feature.stat.value}
              </span>
              <span className="text-[11px] text-zinc-500 ml-1">{feature.stat.label}</span>
            </div>
          )}
        </div>
        
        {/* Description */}
        <p className="text-zinc-500 text-sm leading-relaxed group-hover:text-zinc-400 transition-colors">
          {feature.description}
        </p>
    </div>
  )
}

export function Features() {
  return (
    <section id="features" className="py-24 sm:py-32 relative">
      <div className="section-divider absolute top-0 left-0 right-0" />
      
      {/* Subtle background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-cyan-500/[0.03] to-cyan-600/[0.02] rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 lg:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1f1f23] bg-[#141416] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Features</span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 tracking-[-0.02em]">
            Everything you need to{' '}
            <span className="relative">
              <span className="relative z-10">go viral</span>
              <span className="absolute -bottom-1 left-0 right-0 h-3 bg-gradient-to-r from-cyan-500/20 via-cyan-400/20 to-cyan-500/20 blur-sm" />
            </span>
          </h2>
          
          <p className="text-zinc-400 max-w-xl mx-auto text-lg leading-relaxed">
            Powerful AI-driven features designed to maximize your content output and grow your audience.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {features.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </div>
        
        {/* Bottom accent */}
        <div className="mt-16 flex justify-center">
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <span className="w-8 h-px bg-gradient-to-r from-transparent to-zinc-700" />
            <span>More features coming soon</span>
            <span className="w-8 h-px bg-gradient-to-l from-transparent to-zinc-700" />
          </div>
        </div>
      </div>
    </section>
  )
}
