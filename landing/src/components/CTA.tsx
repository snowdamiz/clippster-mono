import { Apple, Monitor, ChevronDown, Loader2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useDownloads, type PlatformDownload } from '../hooks/usePlatform'

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
    <section className="py-24 sm:py-32 relative">
      <div className="section-divider absolute top-0 left-0 right-0" />
      
      <div className="max-w-3xl mx-auto px-6 text-center">
        {/* Headline */}
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5">
          Ready to go <span className="gradient-text">viral</span>?
        </h2>
        
        {/* Subtext */}
        <p className="text-zinc-400 max-w-lg mx-auto mb-10 text-lg">
          Join 50,000+ creators already using Clippster. Download free for Mac or Windows.
        </p>
        
        {/* Download Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* Primary Download Button */}
          {isLoading ? (
            <div className="px-8 py-4 rounded-full bg-white/50 text-zinc-900 font-semibold flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading...
            </div>
          ) : primaryDownload ? (
            <a
              href={primaryDownload.downloadUrl}
              className="px-8 py-4 rounded-full bg-white text-zinc-900 font-semibold hover:bg-zinc-100 transition-colors flex items-center gap-3"
            >
              {getIcon(primaryDownload)}
              Download for {primaryDownload.label}
            </a>
          ) : null}
          
          {/* Other Versions Dropdown */}
          {otherDownloads.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="px-6 py-4 text-zinc-400 hover:text-white transition-colors font-medium flex items-center gap-2"
              >
                Other versions
                <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showDropdown && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 py-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl min-w-[200px] z-50">
                  {otherDownloads.map((download) => (
                    <a
                      key={`${download.platform.os}-${download.platform.arch}`}
                      href={download.downloadUrl}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors text-zinc-300 hover:text-white"
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
      </div>
    </section>
  )
}
