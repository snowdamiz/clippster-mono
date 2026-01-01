import { Brain, Clock, Shield, Zap, Share2, Wand2 } from 'lucide-react'

interface Feature {
  icon: typeof Brain
  title: string
  description: string
  gradient: string
  iconGradient: string
  glowColor: string
  size: 'large' | 'small'
}

const features: Feature[] = [
  {
    icon: Brain,
    title: 'AI Highlight Detection',
    description: 'Neural networks analyze your content in real-time, identifying peak moments, clutch plays, and viral-worthy reactions with 95% accuracy.',
    gradient: 'from-violet-500/10 via-fuchsia-500/5 to-transparent',
    iconGradient: 'from-violet-500 to-fuchsia-500',
    glowColor: 'violet',
    size: 'large',
  },
  {
    icon: Clock,
    title: 'Real-Time Processing',
    description: 'Clips are generated live as you stream. Post highlights before the stream ends with under 30 seconds of latency.',
    gradient: 'from-blue-500/10 via-cyan-500/5 to-transparent',
    iconGradient: 'from-blue-500 to-cyan-500',
    glowColor: 'blue',
    size: 'large',
  },
  {
    icon: Wand2,
    title: 'Auto-Captions',
    description: 'AI-generated captions with perfect timing. Support for 40+ languages with multiple styles.',
    gradient: 'from-amber-500/10 via-orange-500/5 to-transparent',
    iconGradient: 'from-amber-500 to-orange-500',
    glowColor: 'amber',
    size: 'small',
  },
  {
    icon: Share2,
    title: 'Multi-Platform Export',
    description: 'One click to publish everywhere. Auto-optimized for TikTok, Shorts, Reels, and more.',
    gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
    iconGradient: 'from-emerald-500 to-teal-500',
    glowColor: 'emerald',
    size: 'small',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Wallet authentication keeps your account safe. Your content stays yours.',
    gradient: 'from-rose-500/10 via-pink-500/5 to-transparent',
    iconGradient: 'from-rose-500 to-pink-500',
    glowColor: 'rose',
    size: 'small',
  },
  {
    icon: Zap,
    title: 'Batch Processing',
    description: 'Process multiple streams at once. Queue content and let the AI work.',
    gradient: 'from-indigo-500/10 via-blue-500/5 to-transparent',
    iconGradient: 'from-indigo-500 to-blue-500',
    glowColor: 'indigo',
    size: 'small',
  },
]

function FeatureCard({ feature, isLarge }: { feature: Feature; isLarge: boolean }) {
  const Icon = feature.icon
  
  const glowStyles: Record<string, string> = {
    violet: 'group-hover:shadow-violet-500/20',
    blue: 'group-hover:shadow-blue-500/20',
    amber: 'group-hover:shadow-amber-500/20',
    emerald: 'group-hover:shadow-emerald-500/20',
    rose: 'group-hover:shadow-rose-500/20',
    indigo: 'group-hover:shadow-indigo-500/20',
  }

  const iconBorderStyles: Record<string, string> = {
    violet: 'group-hover:border-violet-500/30',
    blue: 'group-hover:border-blue-500/30',
    amber: 'group-hover:border-amber-500/30',
    emerald: 'group-hover:border-emerald-500/30',
    rose: 'group-hover:border-rose-500/30',
    indigo: 'group-hover:border-indigo-500/30',
  }

  if (isLarge) {
    return (
      <div
        className={`group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm transition-all duration-300 hover:border-zinc-700/80 hover:shadow-2xl ${glowStyles[feature.glowColor]}`}
      >
        {/* Background gradient on hover */}
        <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
        
        {/* Decorative corner glow */}
        <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-gradient-to-br from-white/[0.02] to-transparent blur-2xl" />
        
        {/* Content */}
        <div className="relative p-8 lg:p-10">
          {/* Icon container with gradient border */}
          <div className={`relative w-14 h-14 mb-6 rounded-xl border border-zinc-700/50 bg-zinc-800/50 flex items-center justify-center transition-all duration-300 ${iconBorderStyles[feature.glowColor]}`}>
            <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${feature.iconGradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
            <Icon className="w-7 h-7 text-zinc-300 group-hover:text-white transition-colors duration-300" />
          </div>
          
          <h3 className="font-display text-xl lg:text-2xl font-semibold text-white mb-3 tracking-tight">
            {feature.title}
          </h3>
          
          <p className="text-zinc-400 leading-relaxed max-w-sm group-hover:text-zinc-300 transition-colors duration-300">
            {feature.description}
          </p>
          
          {/* Subtle bottom accent line */}
          <div className={`absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm transition-all duration-300 hover:border-zinc-700/80 hover:shadow-xl ${glowStyles[feature.glowColor]}`}
    >
      {/* Background gradient on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      
      {/* Content */}
      <div className="relative p-6">
        {/* Icon with subtle glow */}
        <div className={`relative w-10 h-10 mb-4 rounded-lg border border-zinc-700/50 bg-zinc-800/50 flex items-center justify-center transition-all duration-300 ${iconBorderStyles[feature.glowColor]}`}>
          <div className={`absolute inset-0 rounded-lg bg-gradient-to-br ${feature.iconGradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
          <Icon className="w-5 h-5 text-zinc-400 group-hover:text-zinc-200 transition-colors duration-300" />
        </div>
        
        <h3 className="font-display text-base font-semibold text-white mb-2 tracking-tight">
          {feature.title}
        </h3>
        
        <p className="text-zinc-500 text-sm leading-relaxed group-hover:text-zinc-400 transition-colors duration-300">
          {feature.description}
        </p>
      </div>
    </div>
  )
}

export function Features() {
  const largeFeatures = features.filter(f => f.size === 'large')
  const smallFeatures = features.filter(f => f.size === 'small')

  return (
    <section id="features" className="py-24 sm:py-32 relative">
      <div className="section-divider absolute top-0 left-0 right-0" />
      
      {/* Subtle background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/[0.02] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/[0.02] rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 lg:mb-20">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Features</span>
          </div>
          
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 tracking-tight">
            Everything you need to{' '}
            <span className="relative">
              <span className="relative z-10">go viral</span>
              <span className="absolute -bottom-1 left-0 right-0 h-3 bg-gradient-to-r from-blue-500/20 via-violet-500/20 to-blue-500/20 blur-sm" />
            </span>
          </h2>
          
          <p className="text-zinc-400 max-w-xl mx-auto text-lg leading-relaxed">
            Powerful AI-driven features designed to maximize your content output and grow your audience.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="space-y-4">
          {/* Large Feature Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {largeFeatures.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} isLarge={true} />
            ))}
          </div>

          {/* Small Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {smallFeatures.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} isLarge={false} />
            ))}
          </div>
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
