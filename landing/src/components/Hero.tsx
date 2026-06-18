import { ChevronRight, Apple, Monitor, Loader2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDownloads } from '../hooks/usePlatform'

export function Hero() {
  const { primaryDownload, otherDownloads, isLoading } = useDownloads()
  const secondaryDownload = otherDownloads[0]

  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 lg:pt-48 lg:pb-32 overflow-hidden">
      {/* Enhanced background effects */}
      <div className="hero-glow" />
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradient orbs - cyan themed */}
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-cyan-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-96 h-96 bg-cyan-400/[0.03] rounded-full blur-3xl" />
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>
      
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Announcement badge - cyan themed */}
        <Link
          to="/pricing"
          className="group inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#1f1f23] bg-[#141416] backdrop-blur-sm hover:border-[rgba(255,255,255,0.1)] transition-all duration-300 mb-8"
        >
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/15 text-xs font-medium text-cyan-400">
            <Sparkles className="w-3 h-3" />
            New
          </span>
          <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">Flexible subscriptions + credit packs</span>
          <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
        </Link>

        {/* Main headline - enhanced */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-[-0.02em] text-white mb-6 leading-[1.1]">
          The all-in-one
          <br />
          <span className="relative inline-block">
            <span className="gradient-text">clipping studio</span>
            {/* Animated underline glow - cyan themed */}
            <span className="absolute -bottom-2 left-0 right-0 h-4 bg-gradient-to-r from-cyan-500/30 via-cyan-400/40 to-cyan-500/30 blur-lg" />
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Clip in real-time or let AI find the highlights. Edit with pro tools, add captions, 
          organize your library, and export everywhere—all from one powerful desktop app.
        </p>

        {/* Download Buttons - cyan themed */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
          {isLoading ? (
            <div className="px-8 py-4 rounded-lg bg-[#141416] border border-[#1f1f23] text-zinc-300 font-semibold flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
              Loading...
            </div>
          ) : primaryDownload ? (
            <>
              <a
                href={primaryDownload.downloadUrl}
                className="group relative px-8 py-4 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold text-base hover:from-cyan-400 hover:to-cyan-500 transition-all duration-200 flex items-center gap-3 shadow-xl shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-[1.02]"
              >
                {/* Subtle glow behind button */}
                <div className="absolute inset-0 rounded-lg bg-cyan-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative flex items-center gap-3">
                  {primaryDownload.platform.os === 'mac' ? (
                    <Apple className="w-5 h-5" />
                  ) : (
                    <Monitor className="w-5 h-5" />
                  )}
                  Download for {primaryDownload.label}
                </span>
              </a>
              {secondaryDownload && (
                <a
                  href={secondaryDownload.downloadUrl}
                  className="group px-6 py-4 text-zinc-400 hover:text-cyan-400 transition-colors font-medium flex items-center gap-2"
                >
                  {secondaryDownload.platform.os === 'mac' ? (
                    <Apple className="w-4 h-4" />
                  ) : (
                    <Monitor className="w-4 h-4" />
                  )}
                  <span>{secondaryDownload.label}</span>
                  <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </a>
              )}
            </>
          ) : null}
        </div>

        {/* Trust badges - cyan themed */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            <span>Live clipping + AI detection</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            <span>Pro editor with auto-captions</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            <span>macOS & Windows</span>
          </div>
        </div>
      </div>
    </section>
  )
}
