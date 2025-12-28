import { Link2, Sparkles, Scissors, Upload } from 'lucide-react'

const steps = [
  {
    number: '1',
    title: 'Connect',
    description: 'Link your Twitch, YouTube, or Kick account with secure OAuth authentication.',
    icon: Link2,
  },
  {
    number: '2',
    title: 'Analyze',
    description: 'Our AI watches your stream in real-time, identifying viral-worthy moments automatically.',
    icon: Sparkles,
  },
  {
    number: '3',
    title: 'Edit',
    description: 'Auto-crop to vertical, add styled captions, and apply effects with one-click presets.',
    icon: Scissors,
  },
  {
    number: '4',
    title: 'Export',
    description: 'Publish to TikTok, Shorts, Reels, and X simultaneously with platform optimization.',
    icon: Upload,
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 sm:py-32 relative">
      <div className="section-divider absolute top-0 left-0 right-0" />
      
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-blue-400 text-sm font-medium tracking-wide uppercase mb-4">
            How it works
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5">
            Stream to viral in four steps
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto text-lg">
            From live stream to published content in minutes, not hours.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <div key={step.number} className="relative">
                {/* Connector line for desktop */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+24px)] w-[calc(100%-48px)] h-px bg-zinc-800" />
                )}
                
                <div className="text-center">
                  {/* Number badge with icon */}
                  <div className="relative inline-flex mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <Icon className="w-7 h-7 text-zinc-400" />
                    </div>
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">
                      {step.number}
                    </span>
                  </div>
                  
                  <h3 className="font-display text-xl font-semibold text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    {step.description}
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
