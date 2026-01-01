import { Link2, Sparkles, Scissors, Upload } from 'lucide-react'

const steps = [
  {
    number: '1',
    title: 'Connect',
    description: 'Link your Twitch, YouTube, or Kick account with secure OAuth authentication.',
    icon: Link2,
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    number: '2',
    title: 'Analyze',
    description: 'Our AI watches your stream in real-time, identifying viral-worthy moments automatically.',
    icon: Sparkles,
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    number: '3',
    title: 'Edit',
    description: 'Auto-crop to vertical, add styled captions, and apply effects with one-click presets.',
    icon: Scissors,
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    number: '4',
    title: 'Export',
    description: 'Publish to TikTok, Shorts, Reels, and X simultaneously with platform optimization.',
    icon: Upload,
    gradient: 'from-emerald-500 to-teal-500',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 sm:py-32 relative overflow-hidden">
      <div className="section-divider absolute top-0 left-0 right-0" />
      
      {/* Subtle background accents */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/[0.02] rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 lg:mb-20">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">How it works</span>
          </div>
          
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 tracking-tight">
            Stream to viral in{' '}
            <span className="relative inline-block">
              <span className="relative z-10">four steps</span>
              <span className="absolute -bottom-1 left-0 right-0 h-3 bg-gradient-to-r from-blue-500/20 via-violet-500/20 to-blue-500/20 blur-sm" />
            </span>
          </h2>
          
          <p className="text-zinc-400 max-w-xl mx-auto text-lg leading-relaxed">
            From live stream to published content in minutes, not hours.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Desktop connector line */}
          <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px">
            <div className="w-full h-full bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />
            {/* Animated dots on the line */}
            <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-zinc-600" />
            <div className="absolute top-1/2 left-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-zinc-600" />
            <div className="absolute top-1/2 left-3/4 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-zinc-600" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map((step) => {
              const Icon = step.icon
              return (
                <div key={step.number} className="group relative">
                  <div className="text-center">
                    {/* Number badge with icon */}
                    <div className="relative inline-flex mb-6">
                      {/* Icon container */}
                      <div className="relative w-20 h-20 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center transition-all duration-300 group-hover:border-zinc-700 group-hover:bg-zinc-800/80">
                        {/* Subtle gradient overlay on hover */}
                        <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${step.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                        <Icon className="w-8 h-8 text-zinc-400 group-hover:text-zinc-200 transition-colors duration-300 relative z-10" />
                      </div>
                      
                      {/* Number badge */}
                      <span className={`absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br ${step.gradient} text-white text-sm font-bold flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                        {step.number}
                      </span>
                    </div>
                    
                    <h3 className="font-display text-xl font-semibold text-white mb-3 tracking-tight group-hover:text-zinc-100 transition-colors">
                      {step.title}
                    </h3>
                    
                    <p className="text-zinc-500 text-sm leading-relaxed max-w-[200px] mx-auto group-hover:text-zinc-400 transition-colors duration-300">
                      {step.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
