import { Star, ChevronRight, Apple, Monitor, Loader2 } from 'lucide-react'
import { useDownloads } from '../hooks/usePlatform'

export function Hero() {
  const { primaryDownload, otherDownloads, isLoading } = useDownloads()
  const secondaryDownload = otherDownloads[0]

  return (
    <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 lg:pt-48 lg:pb-32 overflow-hidden">
      {/* Subtle background glow */}
      <div className="hero-glow" />
      
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Announcement badge */}
        <a
          href="#"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-colors mb-8"
        >
          <span className="text-xs font-medium text-blue-400">New</span>
          <span className="text-sm text-zinc-400">AI-powered clip detection is here</span>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </a>

        {/* Main headline */}
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
          Turn your streams into
          <br />
          <span className="gradient-text">viral content</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          AI finds your best moments, edits them automatically, and exports to every platform. 
          Create a week of content in minutes, not hours.
        </p>

        {/* Download Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          {isLoading ? (
            <div className="px-8 py-4 rounded-full bg-white/50 text-zinc-900 font-semibold flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading...
            </div>
          ) : primaryDownload ? (
            <>
              <a
                href={primaryDownload.downloadUrl}
                className="px-8 py-4 rounded-full bg-white text-zinc-900 font-semibold text-base hover:bg-zinc-100 transition-colors flex items-center gap-3 shadow-lg shadow-white/10"
              >
                {primaryDownload.platform.os === 'mac' ? (
                  <Apple className="w-5 h-5" />
                ) : (
                  <Monitor className="w-5 h-5" />
                )}
                Download for {primaryDownload.label}
              </a>
              {secondaryDownload && (
                <a
                  href={secondaryDownload.downloadUrl}
                  className="px-6 py-4 text-zinc-400 hover:text-white transition-colors font-medium flex items-center gap-2"
                >
                  {secondaryDownload.platform.os === 'mac' ? (
                    <Apple className="w-4 h-4" />
                  ) : (
                    <Monitor className="w-4 h-4" />
                  )}
                  {secondaryDownload.label}
                </a>
              )}
            </>
          ) : null}
        </div>

        {/* Social proof */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12">
          {/* Users */}
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
                  className="w-8 h-8 rounded-full border-2 border-[#09090b] overflow-hidden"
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">50,000+</p>
              <p className="text-xs text-zinc-500">creators</p>
            </div>
          </div>

          <div className="hidden sm:block w-px h-10 bg-zinc-800" />

          {/* Rating */}
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
              ))}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">4.9/5</p>
              <p className="text-xs text-zinc-500">2,400+ reviews</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
