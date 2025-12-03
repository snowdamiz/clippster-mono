import { Sparkles, Zap, Shield, Share2, Brain, Clock } from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'AI Highlight Detection',
    description: 'Neural networks analyze your stream in real-time, identifying peak moments, clutch plays, and viral-worthy reactions.',
    stat: '95%',
    statLabel: 'Accuracy',
    large: true,
  },
  {
    icon: Clock,
    title: 'Real-Time Processing',
    description: 'Clips generated live as you stream. Post highlights before the stream ends.',
    stat: '<30s',
    statLabel: 'Latency',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Wallet authentication. Your content stays yours. No data sharing with third parties.',
    stat: '100%',
    statLabel: 'Yours',
  },
  {
    icon: Zap,
    title: 'Auto-Captions',
    description: 'AI-generated captions with perfect timing. Multiple styles and animations available.',
    stat: '40+',
    statLabel: 'Languages',
  },
  {
    icon: Share2,
    title: 'Multi-Platform Export',
    description: 'One click to publish everywhere. Each clip optimized for its destination platform.',
    stat: '6+',
    statLabel: 'Platforms',
  },
]

const platforms = ['TikTok', 'YouTube Shorts', 'Instagram Reels', 'X/Twitter', 'Twitch Clips', 'Kick']

export function Features() {
  return (
    <section id="features" className="py-16 sm:py-24 lg:py-32 relative">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-500/[0.03] rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-500/[0.02] rounded-full blur-[150px]" />
      </div>
      
      <div className="max-w-7xl mx-auto px-6 relative">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16 lg:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs text-neutral-400 font-medium mb-4 sm:mb-6">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Features
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 sm:mb-5">
            Everything you need
          </h2>
          <p className="text-neutral-500 max-w-lg mx-auto text-base sm:text-lg px-4 sm:px-0">
            Powerful AI-driven features designed to maximize your content output.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className={`group relative rounded-xl sm:rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 lg:p-8 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300 ${
                  feature.large ? 'md:col-span-2 md:row-span-2' : ''
                }`}
              >
                <div className="relative z-10">
                  <div className={`flex items-start justify-between ${feature.large ? 'mb-6 sm:mb-8' : 'mb-4 sm:mb-5'}`}>
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center group-hover:bg-white/[0.08] group-hover:border-white/[0.12] transition-all">
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-neutral-400 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-right">
                      <div className={`font-display font-bold text-white ${feature.large ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>
                        {feature.stat}
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-neutral-600 uppercase tracking-wider">
                        {feature.statLabel}
                      </div>
                    </div>
                  </div>
                  
                  <h3 className={`font-display font-bold text-white mb-2 sm:mb-3 ${feature.large ? 'text-xl sm:text-2xl lg:text-3xl' : 'text-base sm:text-lg'}`}>
                    {feature.title}
                  </h3>
                  <p className={`text-neutral-500 leading-relaxed ${feature.large ? 'text-sm sm:text-base max-w-md' : 'text-xs sm:text-sm'}`}>
                    {feature.description}
                  </p>
                  
                  {feature.large && (
                    <div className="mt-6 sm:mt-10 pt-6 sm:pt-8 border-t border-white/[0.06]">
                      <div className="flex items-center gap-3 mb-4 sm:mb-5">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                          <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-400" />
                        </div>
                        <span className="text-xs sm:text-sm text-neutral-400 font-medium">Powered by advanced ML models</span>
                      </div>
                      <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 sm:gap-3">
                        {['Emotion Detection', 'Audio Peaks', 'Chat Analysis'].map((item) => (
                          <div key={item} className="px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-white/[0.02] border border-white/[0.06]">
                            <span className="text-[11px] sm:text-xs text-neutral-500">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Platforms section */}
        <div className="mt-12 sm:mt-16 pt-12 sm:pt-16 border-t border-white/[0.06]">
          <div className="text-center mb-6 sm:mb-8">
            <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Export to all major platforms</h3>
            <p className="text-xs sm:text-sm text-neutral-600">Automatically optimized for each destination</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {platforms.map((platform) => (
              <span 
                key={platform} 
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/[0.02] border border-white/[0.06] text-xs sm:text-sm text-neutral-400 hover:bg-white/[0.04] hover:border-white/[0.1] hover:text-neutral-300 transition-all cursor-default"
              >
                {platform}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
