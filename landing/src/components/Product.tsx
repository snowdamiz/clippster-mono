import { Users, Sparkles } from 'lucide-react'

// Custom SVG illustrations for each feature
function TeamCollaborationGraphic() {
  return (
    <svg viewBox="0 0 400 240" fill="none" className="w-full h-auto">
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
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
          <stop offset="0%" stopColor="#f472b6"/>
          <stop offset="100%" stopColor="#ec4899"/>
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill="url(#grid)"/>
      
      {/* Main panel */}
      <rect x="40" y="30" width="320" height="180" rx="12" fill="#18181b" stroke="#27272a" strokeWidth="1"/>
      
      {/* Header */}
      <rect x="40" y="30" width="320" height="36" rx="12" fill="#1f1f23"/>
      <rect x="40" y="54" width="320" height="12" fill="#1f1f23"/>
      <circle cx="58" cy="48" r="5" fill="#ef4444"/>
      <circle cx="74" cy="48" r="5" fill="#eab308"/>
      <circle cx="90" cy="48" r="5" fill="#22c55e"/>
      <text x="200" y="52" fill="#71717a" fontSize="10" textAnchor="middle" fontFamily="system-ui">Team Assets</text>
      
      {/* Asset cards */}
      <rect x="56" y="78" width="90" height="60" rx="6" fill="#27272a"/>
      <rect x="62" y="84" width="78" height="36" rx="4" fill="#3f3f46"/>
      <rect x="62" y="126" width="50" height="6" rx="2" fill="#52525b"/>
      
      <rect x="155" y="78" width="90" height="60" rx="6" fill="#27272a"/>
      <rect x="161" y="84" width="78" height="36" rx="4" fill="#3f3f46"/>
      <rect x="161" y="126" width="50" height="6" rx="2" fill="#52525b"/>
      
      <rect x="254" y="78" width="90" height="60" rx="6" fill="#27272a"/>
      <rect x="260" y="84" width="78" height="36" rx="4" fill="#3f3f46"/>
      <rect x="260" y="126" width="50" height="6" rx="2" fill="#52525b"/>
      
      {/* Sharing indicator */}
      <rect x="56" y="150" width="288" height="48" rx="8" fill="#27272a" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 2"/>
      
      {/* User avatars with gradients */}
      <circle cx="82" cy="174" r="14" fill="url(#avatarGrad1)"/>
      <text x="82" y="178" fill="white" fontSize="10" textAnchor="middle" fontWeight="600">A</text>
      
      <circle cx="108" cy="174" r="14" fill="url(#avatarGrad2)"/>
      <text x="108" y="178" fill="white" fontSize="10" textAnchor="middle" fontWeight="600">M</text>
      
      <circle cx="134" cy="174" r="14" fill="url(#avatarGrad3)"/>
      <text x="134" y="178" fill="white" fontSize="10" textAnchor="middle" fontWeight="600">S</text>
      
      {/* Pulsing invite circle - subtle animation */}
      <circle cx="160" cy="174" r="14" fill="#27272a" stroke="#52525b" strokeWidth="1" strokeDasharray="2 2"/>
      <circle cx="160" cy="174" r="16" fill="none" stroke="#52525b" strokeWidth="1" opacity="0.5">
        <animate attributeName="r" values="14;18;14" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/>
      </circle>
      <text x="160" y="178" fill="#71717a" fontSize="10" textAnchor="middle">+</text>
      
      <text x="200" y="170" fill="#71717a" fontSize="9" textAnchor="start">3 team members</text>
      <text x="200" y="182" fill="#a1a1aa" fontSize="10" textAnchor="start">Shared project assets</text>
      
      {/* Share button */}
      <rect x="296" y="162" width="36" height="24" rx="6" fill="#3b82f6"/>
      <text x="314" y="178" fill="white" fontSize="9" textAnchor="middle" fontWeight="500">Share</text>
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
          <stop offset="0%" stopColor="#8b5cf6"/>
          <stop offset="50%" stopColor="#ec4899"/>
          <stop offset="100%" stopColor="#f59e0b"/>
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill="url(#grid2)"/>
      
      {/* Main editor panel */}
      <rect x="40" y="20" width="320" height="200" rx="12" fill="#18181b" stroke="#27272a" strokeWidth="1"/>
      
      {/* Preview area */}
      <rect x="52" y="32" width="200" height="112" rx="8" fill="#0c0c0f"/>
      
      {/* Video content */}
      <rect x="60" y="40" width="184" height="88" rx="4" fill="#1f1f23"/>
      <circle cx="152" cy="84" r="16" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="2"/>
      <path d="M148 78 L148 90 L160 84 Z" fill="rgba(255,255,255,0.6)"/>
      
      {/* Aspect ratio buttons */}
      <rect x="60" y="132" width="32" height="10" rx="3" fill="#3b82f6"/>
      <text x="76" y="140" fill="white" fontSize="6" textAnchor="middle">16:9</text>
      <rect x="96" y="132" width="26" height="10" rx="3" fill="#27272a"/>
      <text x="109" y="140" fill="#71717a" fontSize="6" textAnchor="middle">9:16</text>
      <rect x="126" y="132" width="22" height="10" rx="3" fill="#27272a"/>
      <text x="137" y="140" fill="#71717a" fontSize="6" textAnchor="middle">1:1</text>
      
      {/* Right panel - tools */}
      <rect x="260" y="32" width="88" height="112" rx="8" fill="#1f1f23"/>
      
      {/* Tool buttons */}
      <rect x="268" y="42" width="72" height="20" rx="4" fill="#27272a"/>
      <text x="304" y="56" fill="#a1a1aa" fontSize="8" textAnchor="middle">Captions</text>
      
      <rect x="268" y="68" width="72" height="20" rx="4" fill="#27272a"/>
      <text x="304" y="82" fill="#a1a1aa" fontSize="8" textAnchor="middle">Effects</text>
      
      <rect x="268" y="94" width="72" height="20" rx="4" fill="#27272a"/>
      <text x="304" y="108" fill="#a1a1aa" fontSize="8" textAnchor="middle">Audio</text>
      
      <rect x="268" y="120" width="72" height="18" rx="4" fill="#8b5cf6"/>
      <text x="304" y="132" fill="white" fontSize="8" textAnchor="middle" fontWeight="500">Export</text>
      
      {/* Timeline */}
      <rect x="52" y="152" width="296" height="56" rx="8" fill="#1f1f23"/>
      
      {/* Timeline ruler */}
      <line x1="60" y1="162" x2="340" y2="162" stroke="#3f3f46" strokeWidth="1"/>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <g key={i}>
          <line x1={68 + i * 34} y1="158" x2={68 + i * 34} y2="166" stroke="#52525b" strokeWidth="1"/>
          <text x={68 + i * 34} y="156" fill="#52525b" fontSize="6" textAnchor="middle">{i}:00</text>
        </g>
      ))}
      
      {/* Waveform */}
      <rect x="60" y="170" width="280" height="16" rx="2" fill="#27272a"/>
      <path d="M60 178 Q80 172 100 178 T140 178 T180 178 T220 178 T260 178 T300 178 T340 178" stroke="url(#waveGrad)" strokeWidth="2" fill="none"/>
      
      {/* Clip segments */}
      <rect x="60" y="190" width="80" height="12" rx="2" fill="#3b82f6" opacity="0.6"/>
      <rect x="150" y="190" width="60" height="12" rx="2" fill="#8b5cf6" opacity="0.6"/>
      <rect x="220" y="190" width="100" height="12" rx="2" fill="#ec4899" opacity="0.6"/>
      
      {/* Animated playhead - subtle sliding animation */}
      <g>
        <line x1="160" y1="158" x2="160" y2="206" stroke="white" strokeWidth="2">
          <animate attributeName="x1" values="100;280;100" dur="6s" repeatCount="indefinite"/>
          <animate attributeName="x2" values="100;280;100" dur="6s" repeatCount="indefinite"/>
        </line>
        <polygon points="156,156 164,156 160,160" fill="white">
          <animate attributeName="points" values="96,156 104,156 100,160;276,156 284,156 280,160;96,156 104,156 100,160" dur="6s" repeatCount="indefinite"/>
        </polygon>
      </g>
    </svg>
  )
}

function RealtimeClippingGraphic() {
  return (
    <svg viewBox="0 0 400 240" fill="none" className="w-full h-auto">
      <defs>
        <pattern id="grid3" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
        </pattern>
        <linearGradient id="liveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ef4444"/>
          <stop offset="100%" stopColor="#f97316"/>
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill="url(#grid3)"/>
      
      {/* Main panel */}
      <rect x="40" y="20" width="320" height="200" rx="12" fill="#18181b" stroke="#27272a" strokeWidth="1"/>
      
      {/* Live stream preview */}
      <rect x="52" y="32" width="180" height="100" rx="8" fill="#0c0c0f"/>
      
      {/* Stream content */}
      <rect x="52" y="32" width="180" height="100" rx="8" fill="#1a1a2e"/>
      <rect x="60" y="40" width="164" height="76" rx="4" fill="#0f172a"/>
      
      {/* Live indicator with pulsing dot */}
      <rect x="60" y="44" width="36" height="14" rx="4" fill="url(#liveGrad)"/>
      <circle cx="68" cy="51" r="3" fill="white">
        <animate attributeName="opacity" values="1;0.4;1" dur="1s" repeatCount="indefinite"/>
      </circle>
      <text x="82" y="54" fill="white" fontSize="7" fontWeight="600">LIVE</text>
      
      {/* Viewer count */}
      <rect x="180" y="44" width="40" height="14" rx="4" fill="rgba(0,0,0,0.5)"/>
      <text x="200" y="54" fill="#a1a1aa" fontSize="7" textAnchor="middle">1.2K</text>
      
      {/* Mode toggle */}
      <rect x="52" y="140" width="180" height="28" rx="6" fill="#1f1f23"/>
      <rect x="56" y="144" width="84" height="20" rx="4" fill="#3b82f6"/>
      <text x="98" y="158" fill="white" fontSize="8" textAnchor="middle" fontWeight="500">AI Auto</text>
      <text x="180" y="158" fill="#71717a" fontSize="8" textAnchor="middle">Manual</text>
      
      {/* Clips panel */}
      <rect x="240" y="32" width="108" height="168" rx="8" fill="#1f1f23"/>
      
      {/* Panel header */}
      <text x="252" y="50" fill="#a1a1aa" fontSize="9" fontWeight="500">Detected Clips</text>
      <rect x="320" y="40" width="20" height="14" rx="4" fill="#22c55e" opacity="0.2"/>
      <text x="330" y="50" fill="#22c55e" fontSize="8" textAnchor="middle">12</text>
      
      {/* Clip cards */}
      <rect x="248" y="60" width="92" height="42" rx="4" fill="#27272a" stroke="#3b82f6" strokeWidth="1"/>
      <rect x="254" y="66" width="80" height="20" rx="2" fill="#3f3f46"/>
      <text x="294" y="79" fill="#a1a1aa" fontSize="7" textAnchor="middle">Epic Play</text>
      <rect x="254" y="90" width="24" height="8" rx="2" fill="#22c55e" opacity="0.3"/>
      <text x="266" y="96" fill="#22c55e" fontSize="6" textAnchor="middle">98%</text>
      <text x="320" y="96" fill="#71717a" fontSize="6" textAnchor="end">0:12</text>
      
      <rect x="248" y="106" width="92" height="42" rx="4" fill="#27272a"/>
      <rect x="254" y="112" width="80" height="20" rx="2" fill="#3f3f46"/>
      <text x="294" y="125" fill="#a1a1aa" fontSize="7" textAnchor="middle">Funny Moment</text>
      <rect x="254" y="136" width="24" height="8" rx="2" fill="#22c55e" opacity="0.3"/>
      <text x="266" y="142" fill="#22c55e" fontSize="6" textAnchor="middle">94%</text>
      <text x="320" y="142" fill="#71717a" fontSize="6" textAnchor="end">0:08</text>
      
      <rect x="248" y="152" width="92" height="42" rx="4" fill="#27272a"/>
      <rect x="254" y="158" width="80" height="20" rx="2" fill="#3f3f46"/>
      <text x="294" y="171" fill="#a1a1aa" fontSize="7" textAnchor="middle">Clutch Win</text>
      <rect x="254" y="182" width="24" height="8" rx="2" fill="#22c55e" opacity="0.3"/>
      <text x="266" y="188" fill="#22c55e" fontSize="6" textAnchor="middle">91%</text>
      <text x="320" y="188" fill="#71717a" fontSize="6" textAnchor="end">0:15</text>
      
      {/* AI badge */}
      <g transform="translate(52, 176)">
        <rect width="180" height="32" rx="6" fill="#8b5cf6" opacity="0.1" stroke="#8b5cf6" strokeWidth="1"/>
        <circle cx="20" cy="16" r="10" fill="#8b5cf6" opacity="0.2"/>
        <text x="20" y="20" fill="#8b5cf6" fontSize="10" textAnchor="middle">✦</text>
        <text x="40" y="14" fill="#c4b5fd" fontSize="8" fontWeight="500">AI is analyzing your stream</text>
        <text x="40" y="24" fill="#8b5cf6" fontSize="7">12 clips detected • 2 pending review</text>
        
        {/* Subtle processing indicator dots */}
        <circle cx="160" cy="16" r="2" fill="#8b5cf6">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="168" cy="16" r="2" fill="#8b5cf6">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" begin="0.2s"/>
        </circle>
        <circle cx="176" cy="16" r="2" fill="#8b5cf6">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" begin="0.4s"/>
        </circle>
      </g>
    </svg>
  )
}

const capabilities = [
  {
    title: 'Real-Time Clipping',
    subtitle: 'AI or Manual Control',
    description: 'Watch your stream and let AI automatically detect viral moments, or mark clips manually with a single click. Perfect clips, zero delay.',
    graphic: RealtimeClippingGraphic,
    badge: { icon: Sparkles, text: 'AI-Powered' },
  },
  {
    title: 'Advanced Video Editor',
    subtitle: 'Professional Tools',
    description: 'Full-featured timeline editor with multi-track support, auto-captions in 40+ languages, effects, transitions, and one-click aspect ratio conversion.',
    graphic: VideoEditorGraphic,
    badge: null,
  },
  {
    title: 'Team Collaboration',
    subtitle: 'Built for Teams',
    description: 'Organize projects with folders and tags. Share assets with team members, manage permissions, and collaborate on content in real-time.',
    graphic: TeamCollaborationGraphic,
    badge: { icon: Users, text: 'Teams' },
  },
]

export function Product() {
  return (
    <section className="py-24 sm:py-32 relative">
      <div className="section-divider absolute top-0 left-0 right-0" />
      
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-blue-400 text-sm font-medium tracking-wide uppercase mb-4">
            Platform
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5">
            One app for everything
          </h2>
          <p className="text-zinc-400 max-w-xl mx-auto text-lg">
            From live stream to published content. Clip, edit, and share—all in one powerful desktop app.
          </p>
        </div>

        {/* Capabilities */}
        <div className="space-y-8">
          {capabilities.map((cap, index) => {
            const Graphic = cap.graphic
            const isReversed = index % 2 === 1
            
            return (
              <div 
                key={cap.title}
                className={`flex flex-col ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-8 lg:gap-12 items-center`}
              >
                {/* Graphic */}
                <div className="flex-1 w-full">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 overflow-hidden">
                    <Graphic />
                  </div>
                </div>
                
                {/* Content */}
                <div className="flex-1 w-full lg:max-w-md">
                  {cap.badge && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 mb-4">
                      <cap.badge.icon className="w-3.5 h-3.5 text-blue-400" />
                      {cap.badge.text}
                    </div>
                  )}
                  <p className="text-sm text-blue-400 font-medium mb-2">{cap.subtitle}</p>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-white mb-4">
                    {cap.title}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed">
                    {cap.description}
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

