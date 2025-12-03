import { Link2, Sparkles, Scissors, Upload } from 'lucide-react'

const steps = [
  {
    number: '01',
    title: 'Connect',
    description: 'Link your Twitch, YouTube, or Kick account with secure OAuth. No passwords stored, just one click.',
    icon: Link2,
    color: 'blue',
    details: ['Twitch', 'YouTube', 'Kick', 'Facebook'],
  },
  {
    number: '02',
    title: 'Analyze',
    description: 'Our AI watches your stream in real-time, identifying clutch plays, funny moments, and viral-worthy highlights.',
    icon: Sparkles,
    color: 'violet',
    details: ['95% accuracy', '38 clips avg', '<30s latency'],
  },
  {
    number: '03',
    title: 'Edit',
    description: 'Auto-crop to vertical, add styled captions, apply effects. One-click presets or full manual control.',
    icon: Scissors,
    color: 'pink',
    details: ['9:16', '1:1', '16:9', '4:5'],
  },
  {
    number: '04',
    title: 'Export',
    description: 'Publish simultaneously to TikTok, Shorts, Reels, X, and more. Each clip optimized for its platform.',
    icon: Upload,
    color: 'emerald',
    details: ['TikTok', 'Shorts', 'Reels', 'X'],
  },
]

const colorMap = {
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    glow: 'bg-blue-500/20',
  },
  violet: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    text: 'text-violet-400',
    glow: 'bg-violet-500/20',
  },
  pink: {
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    text: 'text-pink-400',
    glow: 'bg-pink-500/20',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    glow: 'bg-emerald-500/20',
  },
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 sm:py-24 lg:py-32 relative">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-violet-500/[0.03] rounded-full blur-[150px]" />
      </div>
      
      <div className="max-w-6xl mx-auto px-6 relative">
        {/* Header */}
        <div className="mb-10 sm:mb-16 lg:mb-20">
          <p className="text-blue-400 text-xs sm:text-sm font-medium tracking-wide uppercase mb-3 sm:mb-4">
            How it works
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
            Stream to viral
            <br />
            <span className="text-neutral-500">in four steps</span>
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {steps.map((step) => {
            const Icon = step.icon
            const colors = colorMap[step.color as keyof typeof colorMap]
            
            return (
              <div 
                key={step.number}
                className="group relative p-5 sm:p-8 rounded-xl sm:rounded-2xl border border-white/[0.08] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/15 transition-all duration-300"
              >
                {/* Step number watermark */}
                <span className="absolute top-4 sm:top-6 right-4 sm:right-6 font-display text-4xl sm:text-6xl font-bold text-white/[0.03] select-none group-hover:text-white/[0.06] transition-colors">
                  {step.number}
                </span>
                
                {/* Icon */}
                <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl ${colors.bg} border ${colors.border} flex items-center justify-center mb-4 sm:mb-6`}>
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${colors.text}`} />
                </div>
                
                {/* Content */}
                <h3 className="font-display text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">
                  {step.title}
                </h3>
                <p className="text-sm sm:text-base text-neutral-400 leading-relaxed mb-4 sm:mb-6">
                  {step.description}
                </p>
                
                {/* Details */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {step.details.map((detail) => (
                    <span 
                      key={detail}
                      className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium ${colors.bg} border ${colors.border} ${colors.text}`}
                    >
                      {detail}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
