import { Apple, Monitor, ChevronDown, Loader2, Clock, Sparkles } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDownloads, type PlatformDownload } from '../hooks/usePlatform'
import { useDownloadContext } from '../context/DownloadContext'

export function CTA() {
  const { primaryDownload, otherDownloads, isLoading } = useDownloads()
  const { downloadsEnabled, openWaitlistModal } = useDownloadContext()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getIcon = (download: PlatformDownload, size: 'sm' | 'md' = 'md') => {
    const className = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
    return download.platform.os === 'mac' 
      ? <Apple className={className} />
      : <Monitor className={className} />
  }

  return (
    <section className="py-24 sm:py-32 relative overflow-hidden">
      <div className="section-divider absolute top-0 left-0 right-0" />
      
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Central glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-r from-blue-500/[0.05] via-violet-500/[0.08] to-blue-500/[0.05] rounded-full blur-3xl" />
        {/* Decorative orbs */}
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/[0.03] rounded-full blur-2xl" />
        <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-violet-500/[0.03] rounded-full blur-2xl" />
      </div>
      
      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        {/* Icon decoration */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/[0.08] mb-8">
          <Sparkles className="w-7 h-7 text-blue-400" />
        </div>
        
        {/* Headline */}
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 tracking-tight">
          Ready to go{' '}
          <span className="relative inline-block">
            <span className="gradient-text">viral</span>
            <span className="absolute -bottom-1 left-0 right-0 h-3 bg-gradient-to-r from-blue-500/30 via-violet-500/30 to-pink-500/30 blur-sm" />
          </span>
          ?
        </h2>
        
        {/* Subtext */}
        <p className="text-zinc-400 max-w-lg mx-auto mb-10 text-lg leading-relaxed">
          Join 50,000+ creators already using Clippster. Start free with 50 credits/month.
        </p>
        
        {/* Download Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* Primary Download Button */}
          {isLoading ? (
            <div className="px-8 py-4 rounded-full bg-white/50 text-zinc-900 font-semibold flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading...
            </div>
          ) : !downloadsEnabled ? (
            <button
              onClick={openWaitlistModal}
              className="group px-8 py-4 rounded-full bg-zinc-800/80 text-zinc-300 font-semibold border border-zinc-700/50 flex items-center gap-3 cursor-pointer hover:bg-zinc-700/80 hover:border-zinc-600/50 hover:text-white transition-all duration-300 shadow-lg shadow-black/20"
            >
              <Clock className="w-5 h-5 group-hover:text-blue-400 transition-colors" />
              Coming Soon
            </button>
          ) : primaryDownload ? (
            <a
              href={primaryDownload.downloadUrl}
              className="group relative px-8 py-4 rounded-full bg-white text-zinc-900 font-semibold hover:bg-zinc-100 transition-all duration-300 flex items-center gap-3 shadow-xl shadow-white/10 hover:shadow-white/20 hover:scale-[1.02]"
            >
              {/* Subtle glow behind button */}
              <div className="absolute inset-0 rounded-full bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative flex items-center gap-3">
                {getIcon(primaryDownload)}
                Download for {primaryDownload.label}
              </span>
            </a>
          ) : null}
          
          {/* Other Versions Dropdown - only show when downloads are enabled */}
          {downloadsEnabled && otherDownloads.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="px-6 py-4 text-zinc-400 hover:text-white transition-colors font-medium flex items-center gap-2"
              >
                Other versions
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showDropdown && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 py-2 bg-zinc-900/95 backdrop-blur-sm border border-zinc-800 rounded-xl shadow-2xl min-w-[200px] z-50">
                  {otherDownloads.map((download) => (
                    <a
                      key={`${download.platform.os}-${download.platform.arch}`}
                      href={download.downloadUrl}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/80 transition-colors text-zinc-300 hover:text-white"
                      onClick={() => setShowDropdown(false)}
                    >
                      {getIcon(download, 'sm')}
                      <span className="text-sm font-medium">{download.label}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pricing link */}
        <div className="mt-10">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors group"
          >
            View pricing plans 
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        </div>
        
        {/* Trust indicators */}
        <div className="mt-12 pt-8 border-t border-zinc-800/50">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-zinc-500">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>50 free credits/month</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
