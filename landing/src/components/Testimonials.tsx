import { Star, Quote } from 'lucide-react'

const testimonials = [
  {
    name: 'Alex Chen',
    handle: '@phantomgaming',
    followers: '450K',
    initial: 'A',
    color: '#3b82f6',
    content: "Clippster changed my content game. I used to spend 4-5 hours editing. Now it's automatic. TikTok grew from 10K to 200K in three months.",
    platform: 'Twitch',
  },
  {
    name: 'Sarah Martinez',
    handle: '@sarahcreates',
    followers: '1.2M',
    initial: 'S',
    color: '#8b5cf6',
    content: "The AI actually understands what makes a good clip. It catches moments I would have missed. Plus wallet auth means no security worries.",
    platform: 'YouTube',
  },
  {
    name: 'Marcus Johnson',
    handle: '@marcusplays',
    followers: '800K',
    initial: 'M',
    color: '#ec4899',
    content: "I've tried every clipping tool. Clippster's AI is actually smart. Real-time processing means I post highlights while still live.",
    platform: 'Kick',
  },
  {
    name: 'Emily Park',
    handle: '@emilyonkick',
    followers: '320K',
    initial: 'E',
    color: '#f59e0b',
    content: "What sold me was the Solana integration. Sign in with wallet, pay with crypto. No corporate BS. Just pure creator tools.",
    platform: 'TikTok',
  },
]

export function Testimonials() {
  return (
    <section id="testimonials" className="py-16 sm:py-24 lg:py-32 relative">
      {/* Background */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-pink-500/[0.03] rounded-full blur-[150px]" />
      </div>
      
      <div className="max-w-6xl mx-auto px-6 relative">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-xs text-pink-400 font-medium mb-4 sm:mb-6">
            <Star className="w-3.5 h-3.5 fill-current" />
            Testimonials
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            Loved by creators
          </h2>
          <p className="text-neutral-500 max-w-md mx-auto text-sm sm:text-base">
            Join thousands who've transformed their workflow.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="group relative p-5 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.02] hover:border-white/[0.1] transition-all duration-300"
            >
              {/* Quote icon */}
              <div className="absolute top-5 sm:top-6 right-5 sm:right-6 opacity-[0.06] group-hover:opacity-[0.1] transition-opacity">
                <Quote className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
              </div>
              
              {/* Platform badge */}
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-[10px] sm:text-xs text-neutral-400 mb-4 sm:mb-5">
                <span 
                  className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                {t.platform} Creator
              </div>
              
              {/* Stars */}
              <div className="flex gap-0.5 sm:gap-1 mb-4 sm:mb-5">
                {[1,2,3,4,5].map((i) => (
                  <Star key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              
              {/* Content */}
              <p className="text-neutral-300 mb-6 sm:mb-8 leading-relaxed text-[13px] sm:text-[15px] relative z-10">
                "{t.content}"
              </p>
              
              {/* Author */}
              <div className="flex items-center gap-3 sm:gap-4">
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-base sm:text-lg font-bold text-white shrink-0"
                  style={{ backgroundColor: t.color }}
                >
                  {t.initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-white truncate">{t.name}</div>
                  <div className="text-[10px] sm:text-xs text-neutral-500 truncate">{t.handle}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs sm:text-sm font-semibold text-white">{t.followers}</div>
                  <div className="text-[9px] sm:text-[10px] text-neutral-500 uppercase tracking-wide">followers</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
