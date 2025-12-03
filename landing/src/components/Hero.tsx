import { Play, Star, ChevronRight, Sparkles, TrendingUp, Clock, Scissors, Plus, ChevronsLeft, ChevronsRight, Search, Volume2, SkipBack, RefreshCw, Apple, Monitor } from 'lucide-react'
import { useOS } from '../hooks/useOS'

// TODO: Replace with actual download URLs
const DOWNLOAD_URLS = {
  mac: '#download-mac',
  windows: '#download-windows',
}

// Clip card component matching the app design
function ClipCard({ 
  index, 
  title, 
  viralScore, 
  duration, 
  description, 
  timeRange,
}: { 
  index: number
  title: string
  viralScore: number
  duration: string
  description: string
  timeRange: string
}) {
  return (
    <div className="w-full p-2 rounded-md bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors cursor-pointer">
      <div className="flex items-start gap-1.5 mb-1">
        <span className="text-[8px] text-neutral-600 shrink-0">#{index}</span>
        <span className="text-[9px] font-semibold text-white flex-1 leading-tight truncate">{title}</span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-500/20 text-[7px] font-semibold text-rose-400 shrink-0">
          <TrendingUp className="w-2 h-2" />
          {viralScore}%
        </span>
        <span className="inline-flex items-center gap-0.5 text-[8px] text-neutral-500 shrink-0">
          <Clock className="w-2 h-2" />
          {duration}
        </span>
      </div>
      <p className="text-[7px] text-neutral-500 leading-tight line-clamp-1 mb-1 italic truncate">"{description}"</p>
      <div className="flex items-center justify-between">
        <span className="text-[7px] text-neutral-600">{timeRange}</span>
        <span className="inline-flex items-center gap-0.5 text-[7px] text-emerald-500 shrink-0">
          <span className="w-1 h-1 rounded-full bg-emerald-500" />
          Run 5
        </span>
      </div>
    </div>
  )
}

export function Hero() {
  const os = useOS()
  const primaryOS = os === 'windows' ? 'windows' : 'mac'
  const secondaryOS = primaryOS === 'mac' ? 'windows' : 'mac'

  // Waveform data simulation - more realistic looking
  const waveformData = Array.from({ length: 200 }, (_, i) => {
    const base = Math.sin(i * 0.1) * 0.3 + 0.5
    const noise = Math.random() * 0.4
    return Math.min(1, Math.max(0.1, base + noise))
  })

  return (
    <section className="relative flex items-center justify-center overflow-hidden pt-24 pb-12 sm:pt-28 sm:pb-20 lg:pt-60 lg:pb-50">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 grid-lines opacity-30" />
        <div 
          className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.10) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.3)_50%,black_100%)]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text content */}
          <div className="flex flex-col items-start text-left">
            {/* Announcement badge */}
            <a
              href="#"
              className="group inline-flex items-center gap-2 sm:gap-2.5 px-1.5 py-1.5 pr-3 sm:pr-4 rounded-full border border-white/10 bg-gradient-to-r from-white/[0.07] to-white/[0.02] hover:from-white/[0.1] hover:to-white/[0.04] transition-all duration-300 mb-6 sm:mb-8 backdrop-blur-sm"
            >
              <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-blue-300 bg-blue-500/20 px-2 sm:px-2.5 py-1 rounded-full border border-blue-400/20">
                <Sparkles className="w-3 h-3" />
                v2.0
              </span>
              <span className="text-xs sm:text-sm text-neutral-300 font-medium">
                AI-powered clip detection
              </span>
              <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:translate-x-0.5 group-hover:text-neutral-400 transition-all" />
            </a>

            {/* Main headline */}
            <div className="mb-4 sm:mb-6">
              <h1 className="font-display text-4xl xs:text-5xl sm:text-6xl lg:text-7xl xl:text-[5.5rem] font-bold tracking-tight leading-[0.95]">
                <span className="inline-block text-white">Turn streams</span>
                <br />
                <span className="inline-block text-white">into </span>
                <span className="inline-block relative">
                  <span className="gradient-text">viral clips</span>
                  <span className="absolute -bottom-1.5 sm:-bottom-2 left-0 h-0.5 sm:h-1 w-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500" />
                </span>
              </h1>
            </div>

            {/* Subheadline */}
            <p className="text-base sm:text-lg md:text-xl text-neutral-400 max-w-lg mb-8 sm:mb-10 leading-relaxed">
              AI finds your best moments, edits them perfectly, and exports to 
              every platform.{' '}
              <span className="text-neutral-300 font-medium">Create a week of content in minutes.</span>
            </p>

            {/* Download Buttons */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-10 sm:mb-12 w-full sm:w-auto">
              <a
                href={DOWNLOAD_URLS[primaryOS]}
                className="group relative px-6 sm:px-8 py-3.5 sm:py-4 rounded-full bg-white text-black font-semibold text-sm overflow-hidden transition-all duration-300 flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_50px_rgba(255,255,255,0.2)] w-full sm:w-auto"
              >
                {primaryOS === 'mac' ? (
                  <Apple className="w-5 h-5" />
                ) : (
                  <Monitor className="w-5 h-5" />
                )}
                <span>Download for {primaryOS === 'mac' ? 'Mac' : 'Windows'}</span>
              </a>
              <a
                href={DOWNLOAD_URLS[secondaryOS]}
                className="group px-4 sm:px-6 py-3 sm:py-4 text-neutral-400 hover:text-white transition-colors font-medium text-sm flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                {secondaryOS === 'mac' ? (
                  <Apple className="w-4 h-4" />
                ) : (
                  <Monitor className="w-4 h-4" />
                )}
                <span>{secondaryOS === 'mac' ? 'Mac' : 'Windows'} version</span>
              </a>
            </div>

            {/* Stats row */}
            <div className="flex flex-col xs:flex-row flex-wrap items-start xs:items-center gap-5 sm:gap-10 w-full">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {[
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop',
                    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop',
                    'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=80&h=80&fit=crop',
                    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop',
                  ].map((src, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-black overflow-hidden ring-1 ring-white/10"
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-black bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white ring-1 ring-white/10">
                    +50K
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-semibold text-xs sm:text-sm">50,000+ creators</span>
                  <span className="text-neutral-500 text-[10px] sm:text-xs">trust Clippster</span>
                </div>
              </div>

              <div className="hidden sm:block w-px h-10 bg-gradient-to-b from-transparent via-white/20 to-transparent" />

              <div className="flex items-center gap-2.5">
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map((i) => (
                    <Star key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-semibold text-xs sm:text-sm">4.9/5</span>
                  <span className="text-neutral-500 text-[10px] sm:text-xs">2,400+ reviews</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: App preview - taller layout */}
          <div className="relative hidden lg:block">
            {/* Glow behind */}
            <div className="absolute -inset-10 bg-gradient-to-br from-violet-500/25 via-pink-500/15 to-blue-500/20 rounded-[40px] blur-3xl opacity-70" />
            
            {/* Main app window */}
            <div className="relative rounded-xl border border-white/[0.08] bg-[#0a0a0b] overflow-hidden shadow-2xl shadow-black/60">
              {/* App title bar */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#0f0f10] border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <img src="/logo-icon.svg" alt="Clippster" className="w-4 h-4" />
                  <span className="text-[10px] font-semibold text-white">Clippster</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                </div>
              </div>

              {/* Segment title bar */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#0c0c0d] border-b border-white/[0.04]">
                <span className="text-[9px] text-neutral-300">Gaming Stream Segment 2</span>
                <button className="text-neutral-500 hover:text-white text-xs leading-none w-4 h-4 flex items-center justify-center rounded hover:bg-white/10">×</button>
              </div>
              
              {/* Main content area */}
              <div className="flex">
                {/* Left: Video preview */}
                <div className="flex-1 flex flex-col p-3 min-w-0">
                  {/* Aspect ratio buttons */}
                  <div className="flex gap-1.5 mb-2">
                    {['16:9', '9:16', '1:1', '4:5'].map((ratio, i) => (
                      <button
                        key={ratio}
                        className={`px-2 py-0.5 rounded text-[9px] font-medium transition-colors ${
                          i === 0 
                            ? 'bg-white/10 text-white border border-white/20' 
                            : 'bg-transparent text-neutral-500 hover:text-neutral-300'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>

                  {/* Video player - fixed height */}
                  <div className="relative h-[200px] rounded-lg bg-[#0d0d0e] border border-white/[0.04] overflow-hidden mb-2">
                    {/* Fake video content - gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-900/30 via-neutral-900 to-neutral-950" />
                    
                    {/* Video pattern overlay */}
                    <div className="absolute inset-0 opacity-20" style={{
                      backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(255,200,100,0.3) 0%, transparent 50%)',
                    }} />

                    {/* Focal indicator */}
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[8px] text-neutral-300 backdrop-blur-sm border border-white/10">
                      Focal: 50%, 50%
                    </div>
                  </div>

                  {/* Video controls */}
                  <div className="flex items-center gap-2">
                    <button className="text-neutral-400 hover:text-white transition-colors">
                      <SkipBack className="w-3 h-3" />
                    </button>
                    <button className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors border border-white/10">
                      <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                    </button>
                    <span className="text-[9px] text-neutral-400 font-mono tabular-nums">0:00 / 4:55</span>
                    <div className="flex-1" />
                    <Volume2 className="w-3 h-3 text-neutral-400" />
                    <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full relative w-[70%]">
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-md" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Clips panel */}
                <div className="w-40 bg-[#0a0a0b] border-l border-white/[0.04] flex flex-col">
                  {/* Tabs */}
                  <div className="flex border-b border-white/[0.04]">
                    {['Clips', 'Audio', 'Transcript'].map((tab, i) => (
                      <button
                        key={tab}
                        className={`flex-1 py-1.5 text-[8px] font-medium transition-colors whitespace-nowrap ${
                          i === 0 
                            ? 'text-white border-b border-violet-500' 
                            : 'text-neutral-600 hover:text-neutral-400'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Clips header */}
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/[0.04]">
                    <div>
                      <span className="text-[10px] font-semibold text-white">38 Clips</span>
                      <span className="text-[7px] text-neutral-500 block">Click to preview</span>
                    </div>
                    <button className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.04] text-[8px] text-neutral-400 hover:bg-white/[0.08] hover:text-white transition-all border border-white/[0.06]">
                      <RefreshCw className="w-2 h-2" />
                      Detect
                    </button>
                  </div>

                  {/* Clips list */}
                  <div className="flex-1 p-1.5 space-y-1.5 overflow-hidden w-full">
                    <ClipCard
                      index={1}
                      title="Epic Clutch Victory"
                      viralScore={98}
                      duration="0:12"
                      description="Insane 1v4 clutch with perfect timing"
                      timeRange="4:34 - 4:46"
                    />
                    <ClipCard
                      index={2}
                      title="Hilarious Fail"
                      viralScore={95}
                      duration="0:08"
                      description="Unexpected fail that had chat dying"
                      timeRange="2:15 - 2:23"
                    />
                  </div>
                </div>
              </div>

              {/* Timeline section */}
              <div className="border-t border-white/[0.06] bg-[#0c0c0d]">
                {/* Timeline toolbar */}
                <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/[0.04]">
                  <div className="flex items-center gap-0.5">
                    <button className="w-5 h-5 rounded bg-white/[0.04] text-neutral-500 hover:bg-white/[0.08] hover:text-white transition-colors flex items-center justify-center">
                      <Plus className="w-3 h-3" />
                    </button>
                    <button className="w-5 h-5 rounded bg-white/[0.04] text-neutral-500 hover:bg-white/[0.08] hover:text-white transition-colors flex items-center justify-center">
                      <Scissors className="w-3 h-3" />
                    </button>
                    <button className="w-5 h-5 rounded bg-white/[0.04] text-neutral-500 hover:bg-white/[0.08] hover:text-white transition-colors flex items-center justify-center text-[9px] font-bold">
                      /
                    </button>
                    <button className="w-5 h-5 rounded bg-white/[0.04] text-neutral-500 hover:bg-white/[0.08] hover:text-white transition-colors flex items-center justify-center">
                      <ChevronsLeft className="w-3 h-3" />
                    </button>
                    <button className="w-5 h-5 rounded bg-white/[0.04] text-neutral-500 hover:bg-white/[0.08] hover:text-white transition-colors flex items-center justify-center">
                      <ChevronsRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2">
                    <Search className="w-3 h-3 text-neutral-600" />
                    <div className="w-14 h-1 rounded-full bg-white/10 relative">
                      <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-white/30 rounded-full" />
                      <div className="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white/80" />
                    </div>
                    <span className="text-[8px] text-neutral-500">100%</span>
                  </div>
                  <div className="flex-1" />
                  <span className="text-[8px] text-neutral-400">38 clips</span>
                </div>

                {/* Timeline tracks */}
                <div className="px-2 py-2">
                  {/* Time markers */}
                  <div className="flex items-center mb-1">
                    <span className="text-[7px] text-neutral-600 w-9">Time</span>
                    <div className="flex-1 flex">
                      {['0:00', '0:30', '1:00', '1:30', '2:00', '2:30', '3:00', '3:30', '4:00', '4:30'].map((time) => (
                        <span key={time} className="text-[6px] text-neutral-600 flex-1">{time}</span>
                      ))}
                    </div>
                  </div>

                  {/* Main video track with waveform */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-9">
                      <span className="text-[7px] text-neutral-500 block leading-tight">Main</span>
                      <span className="text-[7px] text-neutral-600 block leading-tight">Video</span>
                    </div>
                    <div className="flex-1 h-6 rounded bg-[#111112] border border-white/[0.04] overflow-hidden relative">
                      {/* Waveform visualization */}
                      <div className="absolute inset-0 flex items-center gap-[1px] px-0.5">
                        {waveformData.map((height, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-gradient-to-t from-violet-600/80 via-pink-500/60 to-pink-400/40 rounded-[1px]"
                            style={{ height: `${height * 100}%` }}
                          />
                        ))}
                      </div>
                      {/* Playhead */}
                      <div className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)] z-10 left-[8%]" />
                    </div>
                  </div>

                  {/* Clip tracks */}
                  {['Clip 1', 'Clip 2', 'Clip 3', 'Clip 4'].map((track, trackIndex) => (
                    <div key={track} className="flex items-center gap-1.5 mb-1">
                      <span className="text-[7px] text-neutral-600 w-9">{track}</span>
                      <div className="flex-1 h-4 rounded bg-[#0e0e0f] relative border border-white/[0.02]">
                        {trackIndex === 0 && (
                          <div className="absolute top-0.5 bottom-0.5 left-[88%] w-3 rounded-sm bg-blue-500/70 border border-blue-400/50" />
                        )}
                        {trackIndex === 1 && (
                          <div className="absolute top-0.5 bottom-0.5 left-[8%] w-7 rounded-sm bg-pink-500/70 border border-pink-400/50 flex items-center justify-center overflow-hidden">
                            <span className="text-[6px] text-white/90 font-medium">Los...</span>
                          </div>
                        )}
                        {trackIndex === 2 && (
                          <div className="absolute top-0.5 bottom-0.5 left-[35%] w-5 rounded-sm bg-emerald-500/70 border border-emerald-400/50 flex items-center justify-center overflow-hidden">
                            <span className="text-[6px] text-white/90 font-medium">Fe...</span>
                          </div>
                        )}
                        {trackIndex === 3 && (
                          <div className="absolute top-0.5 bottom-0.5 left-[52%] w-4 rounded-sm bg-amber-500/70 border border-amber-400/50 flex items-center justify-center overflow-hidden">
                            <span className="text-[6px] text-white/90 font-medium">E</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Floating notification - Clip exported */}
            <div className="absolute -right-2 top-14 px-2.5 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-md shadow-xl">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-500/30 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <span className="text-[9px] text-emerald-300 font-semibold block">Clip exported!</span>
                  <span className="text-[7px] text-emerald-400/60">Ready for TikTok</span>
                </div>
              </div>
            </div>
            
            {/* Floating notification - AI detection */}
            <div className="absolute -left-2 top-24 px-2.5 py-2 rounded-lg bg-violet-500/20 border border-violet-500/30 backdrop-blur-md shadow-xl">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <div>
                  <span className="text-[9px] text-violet-300 font-semibold block">AI detected 38 clips</span>
                  <span className="text-[7px] text-violet-400/60">Processing complete</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none" />
    </section>
  )
}
