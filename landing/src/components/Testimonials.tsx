import { Star } from 'lucide-react'

const testimonials = [
  {
    name: 'Alex Chen',
    handle: '@phantomgaming',
    platform: 'Twitch',
    followers: '450K',
    initial: 'A',
    color: '#3b82f6',
    content: "Clippster changed my content game. I used to spend 4-5 hours editing. Now it's automatic. TikTok grew from 10K to 200K in three months.",
  },
  {
    name: 'Sarah Martinez',
    handle: '@sarahcreates',
    platform: 'YouTube',
    followers: '1.2M',
    initial: 'S',
    color: '#8b5cf6',
    content: "The AI actually understands what makes a good clip. It catches moments I would have missed. Plus wallet auth means no security worries.",
  },
  {
    name: 'Marcus Johnson',
    handle: '@marcusplays',
    platform: 'Kick',
    followers: '800K',
    initial: 'M',
    color: '#ec4899',
    content: "I've tried every clipping tool. Clippster's AI is actually smart. Real-time processing means I post highlights while still live.",
  },
  {
    name: 'Emily Park',
    handle: '@emilyonkick',
    platform: 'TikTok',
    followers: '320K',
    initial: 'E',
    color: '#f59e0b',
    content: "What sold me was the Solana integration. Sign in with wallet, pay with crypto. No corporate BS. Just pure creator tools.",
  },
]

export function Testimonials() {
  return (
    <section id="testimonials" className="py-24 sm:py-32 relative">
      <div className="section-divider absolute top-0 left-0 right-0" />
      
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-blue-400 text-sm font-medium tracking-wide uppercase mb-4">
            Testimonials
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5">
            Loved by creators
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto text-lg">
            Join thousands of creators who've transformed their workflow.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="p-6 sm:p-8 rounded-2xl border border-zinc-800 bg-zinc-900/50"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              
              {/* Content */}
              <p className="text-zinc-300 mb-6 leading-relaxed">
                "{t.content}"
              </p>
              
              {/* Author */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.initial}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{t.name}</p>
                    <p className="text-xs text-zinc-500">{t.handle} · {t.platform}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{t.followers}</p>
                  <p className="text-xs text-zinc-500">followers</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
