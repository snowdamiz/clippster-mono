import { Star, Quote } from 'lucide-react'

const testimonials = [
  {
    name: 'Alex Chen',
    handle: '@phantomgaming',
    platform: 'Twitch',
    followers: '450K',
    initial: 'A',
    color: '#3b82f6',
    glowColor: 'blue',
    content: "Clippster changed my content game. I used to spend 4-5 hours editing. Now it's automatic. TikTok grew from 10K to 200K in three months.",
    featured: true,
  },
  {
    name: 'Sarah Martinez',
    handle: '@sarahcreates',
    platform: 'YouTube',
    followers: '1.2M',
    initial: 'S',
    color: '#8b5cf6',
    glowColor: 'violet',
    content: "The AI actually understands what makes a good clip. It catches moments I would have missed. Plus wallet auth means no security worries.",
    featured: true,
  },
  {
    name: 'Marcus Johnson',
    handle: '@marcusplays',
    platform: 'Kick',
    followers: '800K',
    initial: 'M',
    color: '#ec4899',
    glowColor: 'pink',
    content: "I've tried every clipping tool. Clippster's AI is actually smart. Real-time processing means I post highlights while still live.",
    featured: false,
  },
  {
    name: 'Emily Park',
    handle: '@emilyonkick',
    platform: 'TikTok',
    followers: '320K',
    initial: 'E',
    color: '#f59e0b',
    glowColor: 'amber',
    content: "The clip quality blew me away. I went from spending hours editing to having ready-to-post clips in minutes. Pure creator tools.",
    featured: false,
  },
]

const glowStyles: Record<string, string> = {
  blue: 'group-hover:shadow-blue-500/10',
  violet: 'group-hover:shadow-violet-500/10',
  pink: 'group-hover:shadow-pink-500/10',
  amber: 'group-hover:shadow-amber-500/10',
}

export function Testimonials() {
  return (
    <section id="testimonials" className="py-24 sm:py-32 relative overflow-hidden">
      <div className="section-divider absolute top-0 left-0 right-0" />
      
      {/* Subtle background accents */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-violet-500/[0.02] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-blue-500/[0.02] rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 lg:mb-20">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Testimonials</span>
          </div>
          
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 tracking-tight">
            Loved by{' '}
            <span className="relative inline-block">
              <span className="relative z-10">creators</span>
              <span className="absolute -bottom-1 left-0 right-0 h-3 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 blur-sm" />
            </span>
          </h2>
          
          <p className="text-zinc-400 max-w-xl mx-auto text-lg leading-relaxed">
            Join thousands of creators who've transformed their workflow.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className={`group relative p-6 sm:p-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm transition-all duration-300 hover:border-zinc-700/80 hover:shadow-2xl ${glowStyles[t.glowColor]}`}
            >
              {/* Subtle gradient overlay on hover */}
              <div 
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ 
                  background: `linear-gradient(135deg, ${t.color}08 0%, transparent 50%)` 
                }}
              />
              
              {/* Quote icon decoration */}
              <div className="absolute top-6 right-6 sm:top-8 sm:right-8">
                <Quote className="w-8 h-8 text-zinc-800 group-hover:text-zinc-700 transition-colors duration-300" />
              </div>
              
              <div className="relative">
                {/* Stars */}
                <div className="flex gap-1 mb-5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star 
                      key={i} 
                      className="w-4 h-4 text-amber-400 fill-amber-400 transition-transform duration-300" 
                      style={{ 
                        transitionDelay: `${i * 30}ms`,
                      }}
                    />
                  ))}
                </div>
                
                {/* Content */}
                <p className="text-zinc-300 mb-6 leading-relaxed pr-8 group-hover:text-zinc-200 transition-colors duration-300">
                  "{t.content}"
                </p>
                
                {/* Author */}
                <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
                  <div className="flex items-center gap-3">
                    {/* Avatar with ring */}
                    <div className="relative">
                      <div 
                        className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white transition-transform duration-300 group-hover:scale-105"
                        style={{ backgroundColor: t.color }}
                      >
                        {t.initial}
                      </div>
                      {/* Subtle ring on hover */}
                      <div 
                        className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{ 
                          boxShadow: `0 0 0 2px ${t.color}30`
                        }}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white group-hover:text-zinc-100 transition-colors">{t.name}</p>
                      <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
                        {t.handle} · <span className="text-zinc-400">{t.platform}</span>
                      </p>
                    </div>
                  </div>
                  
                  {/* Follower count */}
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{t.followers}</p>
                    <p className="text-xs text-zinc-500">followers</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
