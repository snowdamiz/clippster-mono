import { Apple, Monitor, ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDownloads, type PlatformDownload } from '../hooks/usePlatform'
import { trackDownloadClick, trackLandingEvent } from '@/services/landingAnalytics'

export function CTA() {
  const { primaryDownload, otherDownloads, isLoading } = useDownloads()
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
      
      {/* Background effects - cyan themed */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Central glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-r from-cyan-500/[0.05] via-cyan-400/[0.08] to-cyan-500/[0.05] rounded-full blur-3xl" />
        {/* Decorative orbs */}
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-cyan-500/[0.03] rounded-full blur-2xl" />
        <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-cyan-400/[0.03] rounded-full blur-2xl" />
      </div>
      
      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        {/* Icon decoration - cyan themed */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-[12px] bg-cyan-500/15 border border-[#1f1f23] mb-8">
          <Sparkles className="w-7 h-7 text-cyan-400" />
        </div>
        
        {/* Headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-9 tracking-[-0.02em]">
          Ready to go{' '}
          <span className="relative inline-block">
            <span className="gradient-text">viral</span>
            <span className="absolute -bottom-1 left-0 right-0 h-3 bg-gradient-to-r from-cyan-500/30 via-cyan-400/30 to-cyan-500/30 blur-sm" />
          </span>
          ?
        </h2>
        
        {/* Download Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* Primary Download Button */}
          {isLoading ? (
            <div className="px-8 py-4 rounded-lg bg-[#141416] border border-[#1f1f23] text-zinc-300 font-semibold flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
              Loading...
            </div>
          ) : primaryDownload ? (
            <a
              href={primaryDownload.downloadUrl}
              className="group relative px-8 py-4 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold hover:from-cyan-400 hover:to-cyan-500 transition-all duration-200 flex items-center gap-3 shadow-xl shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:scale-[1.02]"
              onClick={() => trackDownloadClick(primaryDownload, 'cta_primary', `Download for ${primaryDownload.label}`)}
            >
              {/* Subtle glow behind button */}
              <div className="absolute inset-0 rounded-lg bg-cyan-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative flex items-center gap-3">
                {getIcon(primaryDownload)}
                Download for {primaryDownload.label}
              </span>
            </a>
          ) : null}
          
          {otherDownloads.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="px-6 py-4 text-zinc-400 hover:text-cyan-400 transition-colors font-medium flex items-center gap-2"
              >
                Other versions
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showDropdown && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 py-2 bg-[#141416] backdrop-blur-sm border border-[#1f1f23] rounded-[10px] shadow-2xl min-w-[200px] z-50">
                  {otherDownloads.map((download) => (
                    <a
                      key={`${download.platform.os}-${download.platform.arch}`}
                      href={download.downloadUrl}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[rgba(6,182,212,0.1)] transition-colors text-zinc-300 hover:text-cyan-400"
                      onClick={() => {
                        trackDownloadClick(download, 'cta_other_versions', download.label)
                        setShowDropdown(false)
                      }}
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
            className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-cyan-400 transition-colors group"
            onClick={() => trackLandingEvent('landing_pricing_click', { source: 'cta_pricing_link', button_label: 'View pricing plans' })}
          >
            View pricing plans 
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
