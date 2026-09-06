import { Link } from 'react-router-dom'
import { MonitorPlay, Sparkles, Scissors, Upload } from 'lucide-react'

const steps = [
  {
    number: '1',
    title: 'Connect',
    description: 'Watch Kick/Twitch streams live with Picture-in-Picture, download VODs, or upload local files—no account linking required.',
    icon: MonitorPlay,
    gradient: 'from-cyan-500 to-cyan-600',
    iconBg: 'bg-cyan-500/15',
    iconColor: 'text-cyan-500 group-hover:text-cyan-400',
  },
  {
    number: '2',
    title: 'Analyze',
    description: 'Our AI analyzes content in real-time as you watch, identifying viral-worthy moments automatically. Clip with hotkeys or let AI do it.',
    icon: Sparkles,
    gradient: 'from-violet-500 to-violet-600',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-500 group-hover:text-violet-400',
  },
  {
    number: '3',
    title: 'Edit',
    description: 'Auto-crop to vertical, add styled captions, and apply effects with one-click presets.',
    icon: Scissors,
    gradient: 'from-pink-500 to-pink-600',
    iconBg: 'bg-pink-500/15',
    iconColor: 'text-pink-500 group-hover:text-pink-400',
  },
  {
    number: '4',
    title: 'Export',
    description: 'Schedule posts to Instagram and Twitter with platform-optimized formats and aspect ratios.',
    icon: Upload,
    gradient: 'from-emerald-500 to-emerald-600',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-500 group-hover:text-emerald-400',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 sm:py-32 relative overflow-hidden">
      <div className="section-divider absolute top-0 left-0 right-0" />
      
      {/* Subtle background accents - cyan themed */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/[0.02] rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 lg:mb-20">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1f1f23] bg-[#141416] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">How it works</span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 tracking-[-0.02em]">
            Stream to viral in{' '}
            <span className="relative inline-block">
              <span className="relative z-10">four steps</span>
              <span className="absolute -bottom-1 left-0 right-0 h-3 bg-gradient-to-r from-cyan-500/20 via-cyan-400/20 to-cyan-500/20 blur-sm" />
            </span>
          </h2>
          
          <p className="text-zinc-400 max-w-xl mx-auto text-lg leading-relaxed">
            From live stream to published content in minutes, not hours. See how the{' '}
            <Link to="/clipping-tool" className="text-cyan-400 hover:text-cyan-300">
              AI clipping tool
            </Link>{' '}
            works end to end.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Desktop connector line */}
          <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px">
            <div className="w-full h-full bg-gradient-to-r from-transparent via-[#1f1f23] to-transparent" />
            {/* Dots on the line */}
            <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-500/50" />
            <div className="absolute top-1/2 left-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-violet-500/50" />
            <div className="absolute top-1/2 left-3/4 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-pink-500/50" />
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
                      <div className={`relative w-20 h-20 rounded-[12px] ${step.iconBg} border border-[#1f1f23] flex items-center justify-center transition-all duration-200 group-hover:border-[rgba(255,255,255,0.1)]`}>
                        <Icon className={`w-8 h-8 ${step.iconColor} transition-colors duration-200 relative z-10`} />
                      </div>
                      
                      {/* Number badge */}
                      <span className={`absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br ${step.gradient} text-white text-sm font-bold flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-110`}>
                        {step.number}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-semibold text-white mb-3 tracking-[-0.01em] group-hover:text-zinc-100 transition-colors">
                      {step.title}
                    </h3>
                    
                    <p className="text-zinc-500 text-sm leading-relaxed max-w-[200px] mx-auto group-hover:text-zinc-400 transition-colors duration-200">
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
