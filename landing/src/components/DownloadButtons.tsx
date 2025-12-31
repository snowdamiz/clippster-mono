import { Apple, Monitor, Download, Loader2, Clock } from 'lucide-react'
import { useDownloads, type PlatformDownload } from '../hooks/usePlatform'

interface DownloadButtonsProps {
  variant?: 'default' | 'hero' | 'compact'
  className?: string
  disabled?: boolean
  onDisabledClick?: () => void
}

export function DownloadButtons({ variant = 'default', className = '', disabled = false, onDisabledClick }: DownloadButtonsProps) {
  const { primaryDownload, otherDownloads, isLoading } = useDownloads()
  
  // Get the first "other" download for the secondary button
  const secondaryDownload = otherDownloads[0]

  const getIcon = (download: PlatformDownload | null, size: 'sm' | 'md' | 'lg' = 'md') => {
    if (!download) return null
    const sizeMap = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5' }
    const className = sizeMap[size]
    return download.platform.os === 'mac' 
      ? <Apple className={className} />
      : <Monitor className={className} />
  }

  const handleDisabledClick = (e: React.MouseEvent) => {
    e.preventDefault()
    onDisabledClick?.()
  }

  if (isLoading) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="px-8 py-4 rounded-full bg-white/50 text-black font-semibold flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading...
        </div>
      </div>
    )
  }

  if (!primaryDownload) return null

  // Coming Soon state
  if (disabled) {
    if (variant === 'hero') {
      return (
        <div className={`flex flex-col sm:flex-row items-start gap-3 ${className}`}>
          <button
            onClick={handleDisabledClick}
            className="group relative px-8 py-4 rounded-full bg-white/10 text-white/70 font-semibold text-sm overflow-hidden transition-all duration-300 flex items-center gap-3 border border-white/20 cursor-pointer hover:bg-white/15 hover:border-white/30"
          >
            <Clock className="w-5 h-5" />
            <span>Coming Soon</span>
          </button>
        </div>
      )
    }

    if (variant === 'compact') {
      return (
        <div className={`flex items-center gap-2 ${className}`}>
          <button
            onClick={handleDisabledClick}
            className="px-5 py-2 rounded-full bg-white/10 text-white/70 font-medium text-sm border border-white/20 flex items-center gap-2 cursor-pointer hover:bg-white/15 hover:border-white/30 transition-colors"
          >
            <Clock className="w-4 h-4" />
            Coming Soon
          </button>
        </div>
      )
    }

    // Default variant
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <button
          onClick={handleDisabledClick}
          className="group px-8 py-4 rounded-full bg-white/10 text-white/70 font-semibold border border-white/20 flex items-center gap-2 text-base cursor-pointer hover:bg-white/15 hover:border-white/30 transition-colors"
        >
          <Clock className="w-5 h-5" />
          Coming Soon
        </button>
      </div>
    )
  }

  if (variant === 'hero') {
    return (
      <div className={`flex flex-col sm:flex-row items-start gap-3 ${className}`}>
        {/* Primary download button */}
        <a
          href={primaryDownload.downloadUrl}
          className="group relative px-8 py-4 rounded-full bg-white text-black font-semibold text-sm overflow-hidden transition-all duration-300 flex items-center gap-3 shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_50px_rgba(255,255,255,0.2)]"
        >
          {getIcon(primaryDownload, 'lg')}
          <span>Download for {primaryDownload.label}</span>
        </a>
        
        {/* Secondary download link */}
        {secondaryDownload && (
          <a
            href={secondaryDownload.downloadUrl}
            className="group px-6 py-4 text-neutral-400 hover:text-white transition-colors font-medium text-sm flex items-center gap-2"
          >
            {getIcon(secondaryDownload, 'md')}
            <span>{secondaryDownload.label}</span>
          </a>
        )}
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <a
          href={primaryDownload.downloadUrl}
          className="px-5 py-2 rounded-full bg-white text-black font-medium text-sm hover:bg-neutral-100 transition-colors flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download
        </a>
        {secondaryDownload && (
          <a
            href={secondaryDownload.downloadUrl}
            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors text-sm flex items-center gap-1.5"
            title={`Download for ${secondaryDownload.label}`}
          >
            {getIcon(secondaryDownload, 'sm')}
          </a>
        )}
      </div>
    )
  }

  // Default variant
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <a
        href={primaryDownload.downloadUrl}
        className="group px-8 py-4 rounded-full bg-white text-black font-semibold hover:bg-neutral-100 transition-colors flex items-center gap-2 text-base"
      >
        {getIcon(primaryDownload, 'lg')}
        Download for {primaryDownload.label}
      </a>
      {secondaryDownload && (
        <a
          href={secondaryDownload.downloadUrl}
          className="px-6 py-4 text-neutral-400 hover:text-white transition-colors font-medium flex items-center gap-2"
        >
          {getIcon(secondaryDownload, 'md')}
          {secondaryDownload.label}
        </a>
      )}
    </div>
  )
}

interface DownloadButtonsHeaderProps {
  disabled?: boolean
  onDisabledClick?: () => void
}

export function DownloadButtonsHeader({ disabled = false, onDisabledClick }: DownloadButtonsHeaderProps) {
  const { primaryDownload, otherDownloads, isLoading } = useDownloads()
  const secondaryDownload = otherDownloads[0]

  const handleDisabledClick = (e: React.MouseEvent) => {
    e.preventDefault()
    onDisabledClick?.()
  }

  if (isLoading || !primaryDownload) {
    return (
      <div className="flex items-center gap-2">
        <div className="px-4 py-2 rounded-full bg-white/50 text-black font-medium text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      </div>
    )
  }

  // Coming Soon state
  if (disabled) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleDisabledClick}
          className="px-4 py-2 rounded-full bg-white/10 text-white/70 font-medium text-sm border border-white/20 flex items-center gap-2 cursor-pointer hover:bg-white/15 hover:border-white/30 transition-colors"
        >
          <Clock className="w-4 h-4" />
          Coming Soon
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {secondaryDownload && (
        <a
          href={secondaryDownload.downloadUrl}
          className="p-2 text-neutral-400 hover:text-white transition-colors"
          title={`Download for ${secondaryDownload.label}`}
        >
          {secondaryDownload.platform.os === 'mac' ? (
            <Apple className="w-4 h-4" />
          ) : (
            <Monitor className="w-4 h-4" />
          )}
        </a>
      )}
      <a
        href={primaryDownload.downloadUrl}
        className="px-4 py-2 rounded-full bg-white text-black font-medium text-sm hover:bg-neutral-100 transition-colors flex items-center gap-2"
      >
        {primaryDownload.platform.os === 'mac' ? (
          <Apple className="w-4 h-4" />
        ) : (
          <Monitor className="w-4 h-4" />
        )}
        Download
      </a>
    </div>
  )
}
