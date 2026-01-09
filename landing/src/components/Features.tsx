import { Brain, Clock, Shield, Zap, Share2, Wand2, type LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
  stat?: { value: string; label: string }
}

const features: Feature[] = [
  {
    icon: Brain,
    title: 'AI Highlight Detection',
    description: 'Neural networks analyze your content in real-time, identifying peak moments, clutch plays, and viral-worthy reactions automatically.',
    stat: { value: '95%', label: 'accuracy' },
  },
  {
    icon: Clock,
    title: 'Real-Time Processing',
    description: 'Clips are generated live as you stream. Post highlights before the stream ends with minimal latency.',
    stat: { value: '<30s', label: 'latency' },
  },
  {
    icon: Wand2,
    title: 'Auto-Captions',
    description: 'AI-generated captions with perfect timing. Multiple styling presets and language support built in.',
    stat: { value: '40+', label: 'languages' },
  },
  {
    icon: Share2,
    title: 'Multi-Platform Export',
    description: 'One click to publish everywhere. Auto-optimized aspect ratios and formats for each platform.',
    stat: { value: '5+', label: 'platforms' },
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Wallet authentication keeps your account safe. Your content stays on your machine.',
  },
  {
    icon: Zap,
    title: 'Batch Processing',
    description: 'Process multiple streams at once. Queue content and let the AI work in the background.',
  },
]

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon
  
  return (
    <div className="group relative p-6 lg:p-8 rounded-2xl border border-zinc-800/60 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-zinc-700/60 transition-all duration-300">
      {/* Icon */}
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-zinc-800 flex items-center justify-center mb-5 group-hover:border-zinc-700 transition-colors">
        <Icon className="w-5 h-5 text-zinc-400 group-hover:text-zinc-300 transition-colors" />
      </div>
      
      {/* Title + Stat */}
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h3 className="font-display text-lg font-semibold text-white tracking-tight">
          {feature.title}
        </h3>
        {feature.stat && (
          <div className="text-right shrink-0">
            <span className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              {feature.stat.value}
            </span>
            <span className="text-xs text-zinc-600 ml-1">{feature.stat.label}</span>
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
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-blue-500/[0.03] to-violet-500/[0.02] rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 lg:mb-20">
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
