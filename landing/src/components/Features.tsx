import { Brain, Clock, Shield, Zap, Share2, Wand2 } from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'AI Highlight Detection',
    description: 'Neural networks analyze your content in real-time, identifying peak moments, clutch plays, and viral-worthy reactions with 95% accuracy.',
    gradient: 'from-violet-500/20 to-fuchsia-500/20',
    iconGradient: 'from-violet-500 to-fuchsia-500',
    size: 'large',
  },
  {
    icon: Clock,
    title: 'Real-Time Processing',
    description: 'Clips are generated live as you stream. Post highlights before the stream ends with under 30 seconds of latency.',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    iconGradient: 'from-blue-500 to-cyan-500',
    size: 'large',
  },
  {
    icon: Wand2,
    title: 'Auto-Captions',
    description: 'AI-generated captions with perfect timing. Support for 40+ languages with multiple styles and animations.',
    gradient: 'from-amber-500/20 to-orange-500/20',
    iconGradient: 'from-amber-500 to-orange-500',
    size: 'small',
  },
  {
    icon: Share2,
    title: 'Multi-Platform Export',
    description: 'One click to publish everywhere. Each clip is automatically optimized for TikTok, YouTube Shorts, Reels, and more.',
    gradient: 'from-emerald-500/20 to-teal-500/20',
    iconGradient: 'from-emerald-500 to-teal-500',
    size: 'small',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Wallet authentication keeps your account safe. Your content stays yours with no data sharing to third parties.',
    gradient: 'from-rose-500/20 to-pink-500/20',
    iconGradient: 'from-rose-500 to-pink-500',
    size: 'small',
  },
  {
    icon: Zap,
    title: 'Batch Processing',
    description: 'Process multiple streams at once. Queue up your content and let the AI work while you focus on creating.',
    gradient: 'from-indigo-500/20 to-blue-500/20',
    iconGradient: 'from-indigo-500 to-blue-500',
    size: 'small',
  },
]

export function Features() {
  const largeFeatures = features.filter(f => f.size === 'large')
  const smallFeatures = features.filter(f => f.size === 'small')

  return (
    <section id="features" className="py-24 sm:py-32 relative">
      <div className="section-divider absolute top-0 left-0 right-0" />
      
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-blue-400 text-sm font-medium tracking-wide uppercase mb-4">
            Features
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5">
            Everything you need to go viral
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto text-lg">
            Powerful AI-driven features designed to maximize your content output and grow your audience.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Large Feature Cards */}
          {largeFeatures.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="group relative p-8 rounded-3xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-colors overflow-hidden"
              >
                {/* Subtle gradient background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                
                {/* Decorative corner accent */}
                <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-gradient-to-br from-white/[0.02] to-transparent" />
                
                <div className="relative">
                  {/* Icon with gradient background */}
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.iconGradient} flex items-center justify-center mb-6 shadow-lg`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  
                  <h3 className="font-display text-xl sm:text-2xl font-semibold text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed max-w-md">
                    {feature.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Small Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {smallFeatures.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="group relative p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 transition-colors overflow-hidden"
              >
                {/* Subtle gradient background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                
                <div className="relative">
                  {/* Icon with gradient ring */}
                  <div className="relative w-11 h-11 mb-5">
                    <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${feature.iconGradient} opacity-20`} />
                    <div className="absolute inset-[2px] rounded-[10px] bg-zinc-900 flex items-center justify-center">
                      <Icon className={`w-5 h-5 bg-gradient-to-br ${feature.iconGradient} bg-clip-text`} style={{ color: 'transparent', background: `linear-gradient(to bottom right, var(--tw-gradient-from), var(--tw-gradient-to))`, WebkitBackgroundClip: 'text' }} />
                    </div>
                    {/* Fallback colored icon */}
                    <div className="absolute inset-[2px] rounded-[10px] bg-zinc-900 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-zinc-300 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                  
                  <h3 className="font-display text-base font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
