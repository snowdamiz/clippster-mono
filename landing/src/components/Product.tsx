import { Sparkles, Zap, PictureInPicture2, Building2 } from 'lucide-react'

// Custom SVG illustrations for each feature
function PipModeGraphic() {
  return (
    <svg viewBox="0 0 400 240" fill="none" className="w-full h-auto">
      <defs>
        <pattern id="gridPip" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
        </pattern>
        <linearGradient id="pipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ec4899"/>
          <stop offset="100%" stopColor="#db2777"/>
        </linearGradient>
        <linearGradient id="pipLiveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ef4444"/>
          <stop offset="100%" stopColor="#dc2626"/>
        </linearGradient>
      </defs>
      
      {/* Background grid */}
      <rect width="400" height="240" fill="url(#gridPip)"/>
      
      {/* Main desktop window (representing other work) */}
      <rect x="24" y="16" width="352" height="208" rx="12" fill="#141416" stroke="#1f1f23" strokeWidth="1"/>
      
      {/* Desktop header bar */}
      <rect x="24" y="16" width="352" height="32" rx="12" fill="#1f1f23"/>
      <rect x="24" y="36" width="352" height="12" fill="#1f1f23"/>
      <circle cx="44" cy="32" r="4" fill="#ef4444" opacity="0.8"/>
      <circle cx="58" cy="32" r="4" fill="#eab308" opacity="0.8"/>
      <circle cx="72" cy="32" r="4" fill="#22c55e" opacity="0.8"/>
      <text x="200" y="36" fill="#52525b" fontSize="10" textAnchor="middle" fontFamily="system-ui">Video Editor - Project.mp4</text>
      
      {/* Main work area (timeline/editor representation) */}
      <rect x="36" y="56" width="240" height="100" rx="6" fill="#0a0a0b"/>
      <rect x="44" y="64" width="224" height="60" rx="4" fill="#141416"/>
      
      {/* Timeline tracks */}
      <rect x="52" y="72" width="208" height="10" rx="2" fill="#1f1f23"/>
      <rect x="60" y="74" width="60" height="6" rx="1" fill="#06b6d4" opacity="0.6"/>
      <rect x="128" y="74" width="45" height="6" rx="1" fill="#8b5cf6" opacity="0.6"/>
      <rect x="181" y="74" width="70" height="6" rx="1" fill="#06b6d4" opacity="0.6"/>
      
      <rect x="52" y="88" width="208" height="10" rx="2" fill="#1f1f23"/>
      <rect x="60" y="90" width="120" height="6" rx="1" fill="#10b981" opacity="0.4"/>
      
      <rect x="52" y="104" width="208" height="10" rx="2" fill="#1f1f23"/>
      <rect x="60" y="106" width="80" height="6" rx="1" fill="#ec4899" opacity="0.4"/>
      <rect x="148" y="106" width="60" height="6" rx="1" fill="#ec4899" opacity="0.4"/>
      
      {/* Playhead */}
      <line x1="140" y1="68" x2="140" y2="118" stroke="#f8fafc" strokeWidth="1"/>
      <circle cx="140" cy="68" r="2" fill="#f8fafc"/>
      
      {/* Tool panel on right */}
      <rect x="284" y="56" width="80" height="100" rx="6" fill="#1f1f23"/>
      <rect x="292" y="64" width="64" height="20" rx="4" fill="#27272a"/>
      <rect x="292" y="90" width="64" height="20" rx="4" fill="#27272a"/>
      <rect x="292" y="116" width="64" height="20" rx="4" fill="#27272a"/>
      
      {/* PIP Window - floating overlay */}
      <g filter="url(#pipShadow)">
        <rect x="240" y="120" width="128" height="96" rx="10" fill="#0a0a0b" stroke="url(#pipGrad)" strokeWidth="2"/>
      </g>
      
      {/* PIP video content */}
      <rect x="248" y="128" width="112" height="63" rx="4" fill="#141416"/>
      
      {/* LIVE badge in PIP */}
      <rect x="254" y="134" width="48" height="14" rx="4" fill="url(#pipLiveGrad)"/>
      <circle cx="266" cy="141" r="3" fill="white">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/>
      </circle>
      <text x="286" y="145" fill="white" fontSize="7" fontWeight="600" textAnchor="middle">LIVE</text>
      
      {/* PIP controls bar */}
      <rect x="248" y="196" width="112" height="16" rx="4" fill="#1f1f23"/>
      
      {/* Play/pause button */}
      <circle cx="262" cy="204" r="6" fill="#27272a"/>
      <path d="M260 201 L260 207 L265 204 Z" fill="#a1a1aa"/>
      
      {/* Volume icon */}
      <rect x="276" y="200" width="20" height="8" rx="2" fill="#27272a"/>
      
      {/* Clip button in PIP - highlighted */}
      <rect x="302" y="198" width="52" height="12" rx="4" fill="url(#pipGrad)"/>
      <text x="328" y="207" fill="white" fontSize="7" textAnchor="middle" fontWeight="600">✂ CLIP</text>
      
      {/* Keyboard shortcut indicator */}
      <rect x="36" y="168" width="100" height="44" rx="8" fill="#1f1f23"/>
      <text x="86" y="182" fill="#71717a" fontSize="8" textAnchor="middle">Press</text>
      
      {/* Keyboard keys container */}
      <rect x="48" y="188" width="76" height="18" rx="4" fill="#27272a" stroke="#3f3f46" strokeWidth="1"/>
      
      {/* Command key */}
      <rect x="54" y="191" width="24" height="12" rx="3" fill="#3f3f46"/>
      <text x="66" y="200" fill="#ec4899" fontSize="8" textAnchor="middle" fontWeight="600">⌘</text>
      
      {/* Plus sign */}
      <text x="86" y="200" fill="#52525b" fontSize="8" textAnchor="middle">+</text>
      
      {/* C key */}
      <rect x="94" y="191" width="24" height="12" rx="3" fill="#3f3f46"/>
      <text x="106" y="200" fill="#ec4899" fontSize="8" textAnchor="middle" fontWeight="600">C</text>
      
      {/* Shadow filter for PIP */}
      <defs>
        <filter id="pipShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.5"/>
        </filter>
      </defs>
    </svg>
  )
}

function OrganizationDashboardGraphic() {
  return (
    <svg viewBox="0 0 400 240" fill="none" className="w-full h-auto">
      <defs>
        <pattern id="grid3" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
        </pattern>
        <linearGradient id="avatarGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4"/>
          <stop offset="100%" stopColor="#0891b2"/>
        </linearGradient>
        <linearGradient id="avatarGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6"/>
          <stop offset="100%" stopColor="#7c3aed"/>
        </linearGradient>
        <linearGradient id="avatarGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981"/>
          <stop offset="100%" stopColor="#059669"/>
        </linearGradient>
        <linearGradient id="orgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981"/>
          <stop offset="100%" stopColor="#059669"/>
        </linearGradient>
      </defs>
      
      {/* Background grid */}
      <rect width="400" height="240" fill="url(#grid3)"/>
      
      {/* Main panel */}
      <rect x="24" y="16" width="352" height="208" rx="12" fill="#141416" stroke="#1f1f23" strokeWidth="1"/>
      
      {/* Header bar */}
      <rect x="24" y="16" width="352" height="36" rx="12" fill="#1f1f23"/>
      <rect x="24" y="40" width="352" height="12" fill="#1f1f23"/>
      <circle cx="44" cy="34" r="4" fill="#ef4444" opacity="0.8"/>
      <circle cx="58" cy="34" r="4" fill="#eab308" opacity="0.8"/>
      <circle cx="72" cy="34" r="4" fill="#22c55e" opacity="0.8"/>
      <text x="200" y="38" fill="#52525b" fontSize="10" textAnchor="middle" fontFamily="system-ui">Manage Your Organization</text>
      
      {/* Sidebar menu */}
      <rect x="36" y="60" width="90" height="152" rx="8" fill="#1f1f23"/>
      
      {/* TEAM section label */}
      <text x="46" y="76" fill="#52525b" fontSize="7" fontWeight="600" letterSpacing="0.5">TEAM</text>
      
      {/* Menu items - TEAM */}
      <rect x="42" y="82" width="78" height="20" rx="4" fill="#27272a"/>
      <text x="54" y="95" fill="#a1a1aa" fontSize="8">Members</text>
      <rect x="98" y="86" width="16" height="12" rx="3" fill="#06b6d4" opacity="0.2"/>
      <text x="106" y="95" fill="#06b6d4" fontSize="7" textAnchor="middle">3</text>
      
      <rect x="42" y="106" width="78" height="20" rx="4" fill="transparent"/>
      <text x="54" y="119" fill="#71717a" fontSize="8">Creator Profiles</text>
      
      <rect x="42" y="130" width="78" height="20" rx="4" fill="transparent"/>
      <text x="54" y="143" fill="#71717a" fontSize="8">Messages</text>
      
      {/* CONTENT section label */}
      <text x="46" y="162" fill="#52525b" fontSize="7" fontWeight="600" letterSpacing="0.5">CONTENT</text>
      
      <rect x="42" y="168" width="78" height="20" rx="4" fill="#10b981" opacity="0.15"/>
      <text x="54" y="181" fill="#10b981" fontSize="8" fontWeight="500">Campaigns</text>
      
      <rect x="42" y="192" width="78" height="20" rx="4" fill="transparent"/>
      <text x="54" y="205" fill="#71717a" fontSize="8">Find Clippers</text>
      
      {/* Main content area - Campaigns view */}
      <rect x="134" y="60" width="230" height="152" rx="8" fill="#0a0a0b"/>
      
      {/* Section header */}
      <text x="148" y="78" fill="#e4e4e7" fontSize="11" fontWeight="600">Active Campaigns</text>
      <rect x="320" y="66" width="36" height="18" rx="5" fill="url(#orgGrad)"/>
      <text x="338" y="79" fill="white" fontSize="8" textAnchor="middle" fontWeight="500">+ New</text>
      
      {/* Campaign cards */}
      <rect x="144" y="88" width="104" height="56" rx="6" fill="#1f1f23"/>
      <rect x="152" y="96" width="88" height="24" rx="3" fill="#27272a"/>
      <text x="196" y="112" fill="#e4e4e7" fontSize="8" textAnchor="middle">Gaming Stream</text>
      <rect x="152" y="126" width="32" height="10" rx="3" fill="#10b981" opacity="0.2"/>
      <text x="168" y="134" fill="#10b981" fontSize="7" textAnchor="middle">$2/1K</text>
      <text x="232" y="134" fill="#71717a" fontSize="7" textAnchor="end">12 clippers</text>
      
      <rect x="254" y="88" width="104" height="56" rx="6" fill="#1f1f23"/>
      <rect x="262" y="96" width="88" height="24" rx="3" fill="#27272a"/>
      <text x="306" y="112" fill="#e4e4e7" fontSize="8" textAnchor="middle">Product Launch</text>
      <rect x="262" y="126" width="32" height="10" rx="3" fill="#10b981" opacity="0.2"/>
      <text x="278" y="134" fill="#10b981" fontSize="7" textAnchor="middle">$5/1K</text>
      <text x="342" y="134" fill="#71717a" fontSize="7" textAnchor="end">8 clippers</text>
      
      {/* Stats row at bottom */}
      <rect x="144" y="152" width="210" height="52" rx="6" fill="#1f1f23"/>
      
      {/* Stat items */}
      <rect x="154" y="162" width="60" height="32" rx="4" fill="#27272a"/>
      <text x="184" y="176" fill="#a1a1aa" fontSize="8" textAnchor="middle">Clippers</text>
      <text x="184" y="190" fill="#e4e4e7" fontSize="12" textAnchor="middle" fontWeight="600">24</text>
      
      <rect x="220" y="162" width="60" height="32" rx="4" fill="#27272a"/>
      <text x="250" y="176" fill="#a1a1aa" fontSize="8" textAnchor="middle">Clips</text>
      <text x="250" y="190" fill="#e4e4e7" fontSize="12" textAnchor="middle" fontWeight="600">156</text>
      
      <rect x="286" y="162" width="60" height="32" rx="4" fill="#27272a"/>
      <text x="316" y="176" fill="#a1a1aa" fontSize="8" textAnchor="middle">Budget</text>
      <text x="316" y="190" fill="#10b981" fontSize="12" textAnchor="middle" fontWeight="600">$2.4K</text>
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
          <stop offset="0%" stopColor="#06b6d4"/>
          <stop offset="100%" stopColor="#8b5cf6"/>
        </linearGradient>
        <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4"/>
          <stop offset="100%" stopColor="#0891b2"/>
        </linearGradient>
      </defs>
      
      {/* Background grid */}
      <rect width="400" height="240" fill="url(#grid2)"/>
      
      {/* Main editor panel */}
      <rect x="24" y="16" width="352" height="208" rx="12" fill="#141416" stroke="#1f1f23" strokeWidth="1"/>
      
      {/* Preview area */}
      <rect x="36" y="28" width="220" height="124" rx="8" fill="#0a0a0b"/>
      
      {/* Video preview */}
      <rect x="44" y="36" width="204" height="100" rx="4" fill="#141416"/>
      
      {/* Play button */}
      <circle cx="146" cy="86" r="18" fill="rgba(6,182,212,0.15)"/>
      <path d="M141 78 L141 94 L155 86 Z" fill="rgba(6,182,212,0.7)"/>
      
      {/* Aspect ratio toggle */}
      <rect x="44" y="142" width="36" height="10" rx="5" fill="#06b6d4"/>
      <text x="62" y="150" fill="white" fontSize="7" textAnchor="middle" fontWeight="500">16:9</text>
      <rect x="84" y="142" width="32" height="10" rx="5" fill="#1f1f23"/>
      <text x="100" y="150" fill="#71717a" fontSize="7" textAnchor="middle">9:16</text>
      <rect x="120" y="142" width="26" height="10" rx="5" fill="#1f1f23"/>
      <text x="133" y="150" fill="#71717a" fontSize="7" textAnchor="middle">1:1</text>
      
      {/* Tools panel */}
      <rect x="264" y="28" width="100" height="124" rx="8" fill="#1f1f23"/>
      
      <rect x="274" y="40" width="80" height="22" rx="5" fill="#27272a"/>
      <text x="314" y="55" fill="#a1a1aa" fontSize="9" textAnchor="middle">Captions</text>
      
      <rect x="274" y="68" width="80" height="22" rx="5" fill="#27272a"/>
      <text x="314" y="83" fill="#a1a1aa" fontSize="9" textAnchor="middle">Effects</text>
      
      <rect x="274" y="96" width="80" height="22" rx="5" fill="#27272a"/>
      <text x="314" y="111" fill="#a1a1aa" fontSize="9" textAnchor="middle">Audio</text>
      
      <rect x="274" y="124" width="80" height="22" rx="5" fill="url(#cyanGrad)"/>
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
      <rect x="48" y="196" width="96" height="10" rx="3" fill="#06b6d4" opacity="0.5"/>
      <rect x="152" y="196" width="72" height="10" rx="3" fill="#8b5cf6" opacity="0.5"/>
      <rect x="232" y="196" width="120" height="10" rx="3" fill="#06b6d4" opacity="0.5"/>
      
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
        <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6"/>
          <stop offset="100%" stopColor="#7c3aed"/>
        </linearGradient>
      </defs>
      
      {/* Background grid */}
      <rect width="400" height="240" fill="url(#grid1)"/>
      
      {/* Main panel */}
      <rect x="24" y="16" width="352" height="208" rx="12" fill="#141416" stroke="#1f1f23" strokeWidth="1"/>
      
      {/* Live stream preview */}
      <rect x="36" y="28" width="200" height="120" rx="8" fill="#0a0a0b"/>
      <rect x="44" y="36" width="184" height="96" rx="4" fill="#141416"/>
      
      {/* Live badge - positioned well inside preview */}
      <rect x="54" y="46" width="62" height="20" rx="5" fill="url(#liveGrad)"/>
      <circle cx="68" cy="56" r="4" fill="white">
        <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/>
      </circle>
      <text x="85" y="60" fill="white" fontSize="9" fontWeight="600">LIVE</text>
      
      {/* Mode toggle */}
      <rect x="36" y="156" width="200" height="32" rx="8" fill="#1f1f23"/>
      <rect x="40" y="160" width="96" height="24" rx="6" fill="url(#purpleGrad)"/>
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
      <rect x="328" y="36" width="28" height="16" rx="4" fill="#06b6d4" opacity="0.15"/>
      <text x="342" y="48" fill="#06b6d4" fontSize="9" textAnchor="middle">12</text>
      
      {/* Clip card 1 - highlighted */}
      <rect x="252" y="58" width="104" height="48" rx="6" fill="#27272a" stroke="#8b5cf6" strokeWidth="1"/>
      <rect x="258" y="64" width="92" height="24" rx="3" fill="#3f3f46"/>
      <text x="304" y="80" fill="#e4e4e7" fontSize="8" textAnchor="middle">Epic Play</text>
      <rect x="258" y="94" width="26" height="8" rx="2" fill="#10b981" opacity="0.25"/>
      <text x="271" y="100" fill="#10b981" fontSize="7" textAnchor="middle">98%</text>
      <text x="348" y="100" fill="#71717a" fontSize="7" textAnchor="end">0:12</text>
      
      {/* Clip card 2 */}
      <rect x="252" y="112" width="104" height="48" rx="6" fill="#27272a"/>
      <rect x="258" y="118" width="92" height="24" rx="3" fill="#3f3f46"/>
      <text x="304" y="134" fill="#a1a1aa" fontSize="8" textAnchor="middle">Funny Moment</text>
      <rect x="258" y="148" width="26" height="8" rx="2" fill="#10b981" opacity="0.25"/>
      <text x="271" y="154" fill="#10b981" fontSize="7" textAnchor="middle">94%</text>
      <text x="348" y="154" fill="#71717a" fontSize="7" textAnchor="end">0:08</text>
      
      {/* Clip card 3 */}
      <rect x="252" y="166" width="104" height="48" rx="6" fill="#27272a"/>
      <rect x="258" y="172" width="92" height="24" rx="3" fill="#3f3f46"/>
      <text x="304" y="188" fill="#a1a1aa" fontSize="8" textAnchor="middle">Clutch Win</text>
      <rect x="258" y="202" width="26" height="8" rx="2" fill="#10b981" opacity="0.25"/>
      <text x="271" y="208" fill="#10b981" fontSize="7" textAnchor="middle">91%</text>
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
    badge: { icon: Sparkles, text: 'AI-Powered', color: 'purple' },
    accentColor: 'purple',
    highlights: ['Live Detection', '95% Accuracy', 'Instant Export'],
  },
  {
    title: 'Picture-in-Picture Mode',
    subtitle: 'Multitask While Watching',
    description: 'Watch live streams in a floating, always-on-top window while editing or working. Clip with keyboard shortcuts or let AI auto-detect highlights in real-time.',
    graphic: PipModeGraphic,
    badge: { icon: PictureInPicture2, text: 'PIP Mode', color: 'pink' },
    accentColor: 'pink',
    highlights: ['Always-on-Top', 'Hotkey Clipping', 'Real-time AI'],
  },
  {
    title: 'Advanced Video Editor',
    subtitle: 'Professional Tools',
    description: 'Full-featured timeline editor with multi-track support, auto-captions in 40+ languages, effects, transitions, and one-click aspect ratio conversion.',
    graphic: VideoEditorGraphic,
    badge: { icon: Zap, text: 'Pro Editor', color: 'cyan' },
    accentColor: 'cyan',
    highlights: ['Timeline Editor', '40+ Languages', 'Auto-Captions'],
  },
  {
    title: 'Organization Tools',
    subtitle: 'Built for Teams & Creators',
    description: 'Manage your team with member roles and creator profiles. Run clipping campaigns, recruit clippers, share assets, and track submissions—all from one dashboard.',
    graphic: OrganizationDashboardGraphic,
    badge: { icon: Building2, text: 'Organizations', color: 'green' },
    accentColor: 'green',
    highlights: ['Campaign Management', 'Clipper Recruitment', 'Shared Assets'],
  },
]

const accentStyles: Record<string, { border: string; glow: string; badge: string }> = {
  purple: { 
    border: 'group-hover:border-violet-500/30', 
    glow: 'group-hover:shadow-violet-500/10',
    badge: 'bg-violet-500/15 border-violet-500/30 text-violet-400'
  },
  pink: { 
    border: 'group-hover:border-pink-500/30', 
    glow: 'group-hover:shadow-pink-500/10',
    badge: 'bg-pink-500/15 border-pink-500/30 text-pink-400'
  },
  cyan: { 
    border: 'group-hover:border-cyan-500/30', 
    glow: 'group-hover:shadow-cyan-500/10',
    badge: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
  },
  green: { 
    border: 'group-hover:border-emerald-500/30', 
    glow: 'group-hover:shadow-emerald-500/10',
    badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
  },
}

export function Product() {
  return (
    <section id="product" className="py-24 sm:py-32 relative overflow-hidden">
      <div className="section-divider absolute top-0 left-0 right-0" />
      
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-cyan-500/[0.02] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-violet-500/[0.02] rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 lg:mb-20">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1f1f23] bg-[#141416] mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Platform</span>
          </div>
          
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 tracking-[-0.02em]">
            One app for{' '}
            <span className="relative inline-block">
              <span className="relative z-10">everything</span>
              <span className="absolute -bottom-1 left-0 right-0 h-3 bg-gradient-to-r from-cyan-500/20 via-cyan-400/20 to-cyan-500/20 blur-sm" />
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
                className={`group flex flex-col ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-8 lg:gap-12 items-center p-4 lg:p-6 rounded-[12px] border border-[#1f1f23] bg-[#141416]/50 backdrop-blur-sm transition-all duration-200 hover:border-[rgba(255,255,255,0.1)] hover:bg-[#141416]/80 hover:shadow-2xl ${styles.glow}`}
              >
                {/* Graphic */}
                <div className="flex-1 w-full">
                  <div className={`rounded-[10px] border border-[#1f1f23] bg-[#141416] p-3 sm:p-4 overflow-hidden transition-all duration-200 ${styles.border}`}>
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
                  <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4 tracking-[-0.02em] group-hover:text-zinc-100 transition-colors">
                    {cap.title}
                  </h3>
                  <p className="text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
                    {cap.description}
                  </p>
                  
                  {/* Feature highlights */}
                  <div className="mt-6 flex flex-wrap gap-2">
                    {cap.highlights?.map((highlight) => (
                      <span key={highlight} className="px-2.5 py-1 rounded-lg bg-[#1f1f23] border border-[rgba(255,255,255,0.05)] text-xs text-zinc-400">{highlight}</span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Bottom decoration */}
        <div className="mt-16 flex justify-center">
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span className="w-12 h-px bg-gradient-to-r from-transparent to-[#1f1f23]" />
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500/50" />
              Available on macOS & Windows
            </span>
            <span className="w-12 h-px bg-gradient-to-l from-transparent to-[#1f1f23]" />
          </div>
        </div>
      </div>
    </section>
  )
}
