import { Star, ChevronRight, Apple, Monitor, Loader2, Clock, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDownloads } from '../hooks/usePlatform'
import { useDownloadContext } from '../context/DownloadContext'

export function Hero() {
  const { primaryDownload, otherDownloads, isLoading } = useDownloads()
  const { downloadsEnabled, openWaitlistModal } = useDownloadContext()
  const secondaryDownload = otherDownloads[0]

  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 lg:pt-48 lg:pb-32 overflow-hidden">
      {/* Enhanced background effects */}
      <div className="hero-glow" />
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-blue-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-96 h-96 bg-violet-500/[0.03] rounded-full blur-3xl" />
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
        {/* Announcement badge - enhanced */}
        <Link
          to="/pricing"
          className="group inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm hover:border-zinc-700 hover:bg-zinc-800/80 transition-all duration-300 mb-8"
        >
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-xs font-medium text-blue-400">
            <Sparkles className="w-3 h-3" />
            New
          </span>
          <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">Flexible subscriptions + credit packs</span>
          <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
        </Link>

        {/* Main headline - enhanced */}
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
          Turn your streams into
          <br />
          <span className="relative inline-block">
            <span className="gradient-text">viral content</span>
            {/* Animated underline glow */}
            <span className="absolute -bottom-2 left-0 right-0 h-4 bg-gradient-to-r from-blue-500/30 via-violet-500/40 to-pink-500/30 blur-lg" />
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          AI finds your best moments, edits them automatically, and exports to every platform. 
          Create a week of content in minutes, not hours.
        </p>

        {/* Download Buttons - enhanced */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
          {isLoading ? (
            <div className="px-8 py-4 rounded-full bg-zinc-800/80 text-zinc-300 font-semibold flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading...
            </div>
          ) : !downloadsEnabled ? (
            <button
              onClick={openWaitlistModal}
              className="group relative px-8 py-4 rounded-full bg-zinc-800/80 text-zinc-300 font-semibold text-base border border-zinc-700/50 flex items-center gap-3 cursor-pointer hover:bg-zinc-700/80 hover:border-zinc-600/50 hover:text-white transition-all duration-300 shadow-lg shadow-black/20"
            >
              <Clock className="w-5 h-5 group-hover:text-blue-400 transition-colors" />
              Coming Soon
            </button>
          ) : primaryDownload ? (
            <>
              <a
                href={primaryDownload.downloadUrl}
                className="group relative px-8 py-4 rounded-full bg-white text-zinc-900 font-semibold text-base hover:bg-zinc-100 transition-all duration-300 flex items-center gap-3 shadow-xl shadow-white/10 hover:shadow-white/20 hover:scale-[1.02]"
              >
                {/* Subtle glow behind button */}
                <div className="absolute inset-0 rounded-full bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
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
                  className="group px-6 py-4 text-zinc-400 hover:text-white transition-colors font-medium flex items-center gap-2"
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

        {/* Social proof - enhanced */}
        <div className="inline-flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-0 px-6 py-4 rounded-2xl border border-zinc-800/50 bg-zinc-900/30 backdrop-blur-sm">
          {/* Users */}
          <div className="flex items-center gap-3 sm:pr-6 sm:border-r sm:border-zinc-800">
            <div className="flex -space-x-2.5">
              {[
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop',
                'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop',
                'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=80&h=80&fit=crop',
                'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop',
              ].map((src, i) => (
                <div
                  key={i}
                  className="w-9 h-9 rounded-full border-2 border-zinc-900 overflow-hidden ring-1 ring-zinc-800"
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
              {/* Plus more indicator */}
              <div className="w-9 h-9 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center ring-1 ring-zinc-700">
                <span className="text-xs text-zinc-400 font-medium">+</span>
              </div>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">50,000+</p>
              <p className="text-xs text-zinc-500">creators</p>
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-3 sm:pl-6">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
              ))}
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-white">4.9/5</p>
              <p className="text-xs text-zinc-500">2,400+ reviews</p>
            </div>
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
            <span>Works with Twitch, YouTube, Kick</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
            <span>macOS & Windows</span>
          </div>
        </div>
      </div>
    </section>
  )
}
