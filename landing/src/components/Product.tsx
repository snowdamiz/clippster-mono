import { Users, Sparkles, Zap } from 'lucide-react'

// Custom SVG illustrations for each feature
function TeamCollaborationGraphic() {
  return (
    <svg viewBox="0 0 400 240" fill="none" className="w-full h-auto">
      <defs>
        <pattern id="grid3" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
        </pattern>
        <linearGradient id="avatarGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa"/>
          <stop offset="100%" stopColor="#3b82f6"/>
        </linearGradient>
        <linearGradient id="avatarGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa"/>
          <stop offset="100%" stopColor="#8b5cf6"/>
        </linearGradient>
        <linearGradient id="avatarGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399"/>
          <stop offset="100%" stopColor="#10b981"/>
        </linearGradient>
      </defs>
      
      {/* Background grid */}
      <rect width="400" height="240" fill="url(#grid3)"/>
      
      {/* Main panel */}
      <rect x="24" y="16" width="352" height="208" rx="12" fill="#18181b" stroke="#27272a" strokeWidth="1"/>
      
      {/* Header bar */}
      <rect x="24" y="16" width="352" height="40" rx="12" fill="#1f1f23"/>
      <rect x="24" y="44" width="352" height="12" fill="#1f1f23"/>
      <circle cx="44" cy="36" r="4" fill="#ef4444" opacity="0.8"/>
      <circle cx="58" cy="36" r="4" fill="#eab308" opacity="0.8"/>
      <circle cx="72" cy="36" r="4" fill="#22c55e" opacity="0.8"/>
      <text x="200" y="40" fill="#52525b" fontSize="11" textAnchor="middle" fontFamily="system-ui">Shared Assets</text>
      
      {/* Asset grid - 3 cards */}
      <rect x="40" y="68" width="100" height="72" rx="8" fill="#27272a"/>
      <rect x="48" y="76" width="84" height="44" rx="4" fill="#3f3f46"/>
      <rect x="48" y="128" width="52" height="6" rx="3" fill="#52525b"/>
      
      <rect x="150" y="68" width="100" height="72" rx="8" fill="#27272a"/>
      <rect x="158" y="76" width="84" height="44" rx="4" fill="#3f3f46"/>
      <rect x="158" y="128" width="60" height="6" rx="3" fill="#52525b"/>
      
      <rect x="260" y="68" width="100" height="72" rx="8" fill="#27272a"/>
      <rect x="268" y="76" width="84" height="44" rx="4" fill="#3f3f46"/>
      <rect x="268" y="128" width="44" height="6" rx="3" fill="#52525b"/>
      
      {/* Team bar */}
      <rect x="40" y="152" width="320" height="60" rx="10" fill="#27272a"/>
      
      {/* User avatars */}
      <circle cx="76" cy="182" r="17" fill="url(#avatarGrad1)"/>
      <text x="76" y="187" fill="white" fontSize="12" textAnchor="middle" fontWeight="600">A</text>
      
      <circle cx="112" cy="182" r="17" fill="url(#avatarGrad2)"/>
      <text x="112" y="187" fill="white" fontSize="12" textAnchor="middle" fontWeight="600">M</text>
      
      <circle cx="148" cy="182" r="17" fill="url(#avatarGrad3)"/>
      <text x="148" y="187" fill="white" fontSize="12" textAnchor="middle" fontWeight="600">S</text>
      
      {/* Add member button */}
      <circle cx="184" cy="182" r="17" fill="transparent" stroke="#3f3f46" strokeWidth="2" strokeDasharray="4 3"/>
      <text x="184" y="187" fill="#52525b" fontSize="14" textAnchor="middle">+</text>
      
      {/* Info text */}
      <text x="216" y="178" fill="#71717a" fontSize="10">3 team members</text>
      <text x="216" y="192" fill="#a1a1aa" fontSize="11" fontWeight="500">Project shared</text>
      
      {/* Share button */}
      <rect x="304" y="168" width="48" height="28" rx="6" fill="#10b981"/>
      <text x="328" y="186" fill="white" fontSize="10" textAnchor="middle" fontWeight="500">Share</text>
    </svg>
  )
}

function VideoEditorGraphic() {
  return (
    <svg viewBox="0 0 400 240" fill="none" className="w-full h-auto">
      <defs>
        <pattern id="grid2" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
        </pattern>
        <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6"/>
          <stop offset="100%" stopColor="#8b5cf6"/>
        </linearGradient>
      </defs>
      
      {/* Background grid */}
      <rect width="400" height="240" fill="url(#grid2)"/>
      
      {/* Main editor panel */}
      <rect x="24" y="16" width="352" height="208" rx="12" fill="#18181b" stroke="#27272a" strokeWidth="1"/>
      
      {/* Preview area */}
      <rect x="36" y="28" width="220" height="124" rx="8" fill="#0f0f12"/>
      
      {/* Video preview */}
      <rect x="44" y="36" width="204" height="100" rx="4" fill="#1a1a1f"/>
      
      {/* Play button */}
      <circle cx="146" cy="86" r="18" fill="rgba(255,255,255,0.08)"/>
      <path d="M141 78 L141 94 L155 86 Z" fill="rgba(255,255,255,0.5)"/>
      
      {/* Aspect ratio toggle */}
      <rect x="44" y="142" width="36" height="10" rx="5" fill="#3b82f6"/>
      <text x="62" y="150" fill="white" fontSize="7" textAnchor="middle" fontWeight="500">16:9</text>
      <rect x="84" y="142" width="32" height="10" rx="5" fill="#27272a"/>
      <text x="100" y="150" fill="#71717a" fontSize="7" textAnchor="middle">9:16</text>
      <rect x="120" y="142" width="26" height="10" rx="5" fill="#27272a"/>
      <text x="133" y="150" fill="#71717a" fontSize="7" textAnchor="middle">1:1</text>
      
      {/* Tools panel */}
      <rect x="264" y="28" width="100" height="124" rx="8" fill="#1f1f23"/>
      
      <rect x="274" y="40" width="80" height="22" rx="5" fill="#27272a"/>
      <text x="314" y="55" fill="#a1a1aa" fontSize="9" textAnchor="middle">Captions</text>
      
      <rect x="274" y="68" width="80" height="22" rx="5" fill="#27272a"/>
      <text x="314" y="83" fill="#a1a1aa" fontSize="9" textAnchor="middle">Effects</text>
      
      <rect x="274" y="96" width="80" height="22" rx="5" fill="#27272a"/>
      <text x="314" y="111" fill="#a1a1aa" fontSize="9" textAnchor="middle">Audio</text>
      
      <rect x="274" y="124" width="80" height="22" rx="5" fill="#3b82f6"/>
      <text x="314" y="139" fill="white" fontSize="9" textAnchor="middle" fontWeight="500">Export</text>
      
      {/* Timeline */}
      <rect x="36" y="160" width="328" height="56" rx="8" fill="#1f1f23"/>
      
      {/* Time markers */}
      <line x1="48" y1="172" x2="352" y2="172" stroke="#27272a" strokeWidth="1"/>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <line x1={64 + i * 52} y1="168" x2={64 + i * 52} y2="176" stroke="#3f3f46" strokeWidth="1"/>
          <text x={64 + i * 52} y="166" fill="#52525b" fontSize="7" textAnchor="middle">{i}:00</text>
        </g>
      ))}
      
      {/* Waveform track */}
      <rect x="48" y="180" width="304" height="12" rx="3" fill="#27272a"/>
      <path d="M48 186 Q68 182 88 186 T128 186 T168 186 T208 186 T248 186 T288 186 T328 186 T352 186" stroke="url(#waveGrad)" strokeWidth="1.5" fill="none" opacity="0.7"/>
      
      {/* Clip segments */}
      <rect x="48" y="196" width="96" height="10" rx="3" fill="#3b82f6" opacity="0.5"/>
      <rect x="152" y="196" width="72" height="10" rx="3" fill="#8b5cf6" opacity="0.5"/>
      <rect x="232" y="196" width="120" height="10" rx="3" fill="#6366f1" opacity="0.5"/>
      
      {/* Playhead */}
      <line x1="190" y1="168" x2="190" y2="208" stroke="#f8fafc" strokeWidth="1.5"/>
      <circle cx="190" cy="168" r="3" fill="#f8fafc"/>
    </svg>
  )
}

function RealtimeClippingGraphic() {
  return (
    <svg viewBox="0 0 400 240" fill="none" className="w-full h-auto">
      <defs>
        <pattern id="grid1" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
        </pattern>
        <linearGradient id="liveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ef4444"/>
          <stop offset="100%" stopColor="#dc2626"/>
        </linearGradient>
      </defs>
      
      {/* Background grid */}
      <rect width="400" height="240" fill="url(#grid1)"/>
      
      {/* Main panel */}
      <rect x="24" y="16" width="352" height="208" rx="12" fill="#18181b" stroke="#27272a" strokeWidth="1"/>
      
      {/* Live stream preview */}
      <rect x="36" y="28" width="200" height="120" rx="8" fill="#0f0f12"/>
      <rect x="44" y="36" width="184" height="96" rx="4" fill="#1a1a1f"/>
      
      {/* Live badge - positioned well inside preview */}
      <rect x="54" y="46" width="62" height="20" rx="5" fill="url(#liveGrad)"/>
      <circle cx="68" cy="56" r="4" fill="white">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/>
      </circle>
      <text x="85" y="60" fill="white" fontSize="9" fontWeight="600">LIVE</text>
      
      {/* Mode toggle */}
      <rect x="36" y="156" width="200" height="32" rx="8" fill="#1f1f23"/>
      <rect x="40" y="160" width="96" height="24" rx="6" fill="#8b5cf6"/>
      <text x="88" y="176" fill="white" fontSize="9" textAnchor="middle" fontWeight="500">AI Auto</text>
      <text x="184" y="176" fill="#71717a" fontSize="9" textAnchor="middle">Manual</text>
      
      {/* AI status bar */}
      <rect x="36" y="196" width="200" height="20" rx="5" fill="#8b5cf6" opacity="0.1"/>
      <text x="56" y="210" fill="#c4b5fd" fontSize="8" fontWeight="500">✦ AI analyzing</text>
      <circle cx="192" cy="206" r="2" fill="#a78bfa">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" repeatCount="indefinite"/>
      </circle>
      <circle cx="202" cy="206" r="2" fill="#a78bfa">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" begin="0.2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="212" cy="206" r="2" fill="#a78bfa">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" begin="0.4s" repeatCount="indefinite"/>
      </circle>
      
      {/* Clips panel */}
      <rect x="244" y="28" width="120" height="188" rx="8" fill="#1f1f23"/>
      
      {/* Panel header */}
      <text x="256" y="48" fill="#a1a1aa" fontSize="10" fontWeight="500">Clips</text>
      <rect x="328" y="36" width="28" height="16" rx="4" fill="#22c55e" opacity="0.15"/>
      <text x="342" y="48" fill="#22c55e" fontSize="9" textAnchor="middle">12</text>
      
      {/* Clip card 1 - highlighted */}
      <rect x="252" y="58" width="104" height="48" rx="6" fill="#27272a" stroke="#8b5cf6" strokeWidth="1"/>
      <rect x="258" y="64" width="92" height="24" rx="3" fill="#3f3f46"/>
      <text x="304" y="80" fill="#e4e4e7" fontSize="8" textAnchor="middle">Epic Play</text>
      <rect x="258" y="94" width="26" height="8" rx="2" fill="#22c55e" opacity="0.25"/>
      <text x="271" y="100" fill="#22c55e" fontSize="7" textAnchor="middle">98%</text>
      <text x="348" y="100" fill="#71717a" fontSize="7" textAnchor="end">0:12</text>
      
      {/* Clip card 2 */}
      <rect x="252" y="112" width="104" height="48" rx="6" fill="#27272a"/>
      <rect x="258" y="118" width="92" height="24" rx="3" fill="#3f3f46"/>
      <text x="304" y="134" fill="#a1a1aa" fontSize="8" textAnchor="middle">Funny Moment</text>
      <rect x="258" y="148" width="26" height="8" rx="2" fill="#22c55e" opacity="0.25"/>
      <text x="271" y="154" fill="#22c55e" fontSize="7" textAnchor="middle">94%</text>
      <text x="348" y="154" fill="#71717a" fontSize="7" textAnchor="end">0:08</text>
      
      {/* Clip card 3 */}
      <rect x="252" y="166" width="104" height="48" rx="6" fill="#27272a"/>
      <rect x="258" y="172" width="92" height="24" rx="3" fill="#3f3f46"/>
      <text x="304" y="188" fill="#a1a1aa" fontSize="8" textAnchor="middle">Clutch Win</text>
      <rect x="258" y="202" width="26" height="8" rx="2" fill="#22c55e" opacity="0.25"/>
      <text x="271" y="208" fill="#22c55e" fontSize="7" textAnchor="middle">91%</text>
      <text x="348" y="208" fill="#71717a" fontSize="7" textAnchor="end">0:15</text>
    </svg>
  )
}

const capabilities = [
  {
    title: 'Real-Time Clipping',
    subtitle: 'AI or Manual Control',
    description: 'Watch your stream and let AI automatically detect viral moments, or mark clips manually with a single click. Perfect clips, zero delay.',
    graphic: RealtimeClippingGraphic,
    badge: { icon: Sparkles, text: 'AI-Powered', color: 'violet' },
    accentColor: 'violet',
  },
  {
    title: 'Advanced Video Editor',
    subtitle: 'Professional Tools',
    description: 'Full-featured timeline editor with multi-track support, auto-captions in 40+ languages, effects, transitions, and one-click aspect ratio conversion.',
    graphic: VideoEditorGraphic,
    badge: { icon: Zap, text: 'Pro Editor', color: 'blue' },
    accentColor: 'blue',
  },
  {
    title: 'Team Collaboration',
    subtitle: 'Built for Teams',
    description: 'Organize projects with folders and tags. Share assets with team members, manage permissions, and collaborate on content in real-time.',
    graphic: TeamCollaborationGraphic,
    badge: { icon: Users, text: 'Teams', color: 'emerald' },
    accentColor: 'emerald',
  },
]

const accentStyles: Record<string, { border: string; glow: string; badge: string }> = {
  violet: { 
    border: 'group-hover:border-violet-500/30', 
    glow: 'group-hover:shadow-violet-500/10',
    badge: 'bg-violet-500/10 border-violet-500/30 text-violet-300'
  },
  blue: { 
    border: 'group-hover:border-blue-500/30', 
    glow: 'group-hover:shadow-blue-500/10',
    badge: 'bg-blue-500/10 border-blue-500/30 text-blue-300'
  },
  emerald: { 
    border: 'group-hover:border-emerald-500/30', 
    glow: 'group-hover:shadow-emerald-500/10',
    badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
  },
}

export function Product() {
  return (
    <section className="py-24 sm:py-32 relative overflow-hidden">
      <div className="section-divider absolute top-0 left-0 right-0" />
      
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-violet-500/[0.02] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-blue-500/[0.02] rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 lg:mb-20">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Platform</span>
          </div>
          
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 tracking-tight">
            One app for{' '}
            <span className="relative inline-block">
              <span className="relative z-10">everything</span>
              <span className="absolute -bottom-1 left-0 right-0 h-3 bg-gradient-to-r from-violet-500/20 via-blue-500/20 to-violet-500/20 blur-sm" />
            </span>
          </h2>
          
          <p className="text-zinc-400 max-w-xl mx-auto text-lg leading-relaxed">
            From live stream to published content. Clip, edit, and share—all in one powerful desktop app.
          </p>
        </div>

        {/* Capabilities */}
        <div className="space-y-6">
          {capabilities.map((cap, index) => {
            const Graphic = cap.graphic
            const isReversed = index % 2 === 1
            const styles = accentStyles[cap.accentColor]
            
            return (
              <div 
                key={cap.title}
                className={`group flex flex-col ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-8 lg:gap-12 items-center p-4 lg:p-6 rounded-3xl border border-zinc-800/50 bg-zinc-900/20 backdrop-blur-sm transition-all duration-300 hover:border-zinc-700/50 hover:bg-zinc-900/40 hover:shadow-2xl ${styles.glow}`}
              >
                {/* Graphic */}
                <div className="flex-1 w-full">
                  <div className={`rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-3 sm:p-4 overflow-hidden transition-all duration-300 ${styles.border}`}>
                    <Graphic />
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex-1 w-full lg:max-w-md">
                  {cap.badge && (
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium mb-4 ${styles.badge}`}>
                      <cap.badge.icon className="w-3.5 h-3.5" />
                      {cap.badge.text}
                    </div>
                  )}
                  <p className="text-sm text-zinc-500 font-medium mb-2 uppercase tracking-wide">{cap.subtitle}</p>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-white mb-4 tracking-tight group-hover:text-zinc-100 transition-colors">
                    {cap.title}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
                    {cap.description}
                  </p>
                  
                  {/* Feature highlights */}
                  <div className="mt-6 flex flex-wrap gap-2">
                    {index === 0 && (
                      <>
                        <span className="px-2.5 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-400">Live Detection</span>
                        <span className="px-2.5 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-400">95% Accuracy</span>
                        <span className="px-2.5 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-400">Instant Export</span>
                      </>
                    )}
                    {index === 1 && (
                      <>
                        <span className="px-2.5 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-400">Timeline Editor</span>
                        <span className="px-2.5 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-400">40+ Languages</span>
                        <span className="px-2.5 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-400">Auto-Captions</span>
                      </>
                    )}
                    {index === 2 && (
                      <>
                        <span className="px-2.5 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-400">Shared Assets</span>
                        <span className="px-2.5 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-400">Permissions</span>
                        <span className="px-2.5 py-1 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-400">Real-time Sync</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Bottom decoration */}
        <div className="mt-16 flex justify-center">
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span className="w-12 h-px bg-gradient-to-r from-transparent to-zinc-700" />
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500/50" />
              Available on macOS & Windows
            </span>
            <span className="w-12 h-px bg-gradient-to-l from-transparent to-zinc-700" />
          </div>
        </div>
      </div>
    </section>
  )
}
