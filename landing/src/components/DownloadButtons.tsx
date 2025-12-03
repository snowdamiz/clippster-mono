import { useOS } from '../hooks/useOS'
import { Apple, Monitor, Download } from 'lucide-react'

// TODO: Replace with actual download URLs
const DOWNLOAD_URLS = {
  mac: '#download-mac',
  windows: '#download-windows',
}

interface DownloadButtonsProps {
  variant?: 'default' | 'hero' | 'compact'
  className?: string
}

export function DownloadButtons({ variant = 'default', className = '' }: DownloadButtonsProps) {
  const os = useOS()
  
  const primaryOS = os === 'windows' ? 'windows' : 'mac'
  const secondaryOS = primaryOS === 'mac' ? 'windows' : 'mac'

  if (variant === 'hero') {
    return (
      <div className={`flex flex-col sm:flex-row items-start gap-3 ${className}`}>
        {/* Primary download button */}
        <a
          href={DOWNLOAD_URLS[primaryOS]}
          className="group relative px-8 py-4 rounded-full bg-white text-black font-semibold text-sm overflow-hidden transition-all duration-300 flex items-center gap-3 shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_50px_rgba(255,255,255,0.2)]"
        >
          {primaryOS === 'mac' ? (
            <Apple className="w-5 h-5" />
          ) : (
            <Monitor className="w-5 h-5" />
          )}
          <span>Download for {primaryOS === 'mac' ? 'Mac' : 'Windows'}</span>
        </a>
        
        {/* Secondary download link */}
        <a
          href={DOWNLOAD_URLS[secondaryOS]}
          className="group px-6 py-4 text-neutral-400 hover:text-white transition-colors font-medium text-sm flex items-center gap-2"
        >
          {secondaryOS === 'mac' ? (
            <Apple className="w-4 h-4" />
          ) : (
            <Monitor className="w-4 h-4" />
          )}
          <span>{secondaryOS === 'mac' ? 'Mac' : 'Windows'} version</span>
        </a>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <a
          href={DOWNLOAD_URLS[primaryOS]}
          className="px-5 py-2 rounded-full bg-white text-black font-medium text-sm hover:bg-neutral-100 transition-colors flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download
        </a>
        <a
          href={DOWNLOAD_URLS[secondaryOS]}
          className="px-4 py-2 text-neutral-400 hover:text-white transition-colors text-sm flex items-center gap-1.5"
        >
          {secondaryOS === 'mac' ? (
            <Apple className="w-3.5 h-3.5" />
          ) : (
            <Monitor className="w-3.5 h-3.5" />
          )}
        </a>
      </div>
    )
  }

  // Default variant
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <a
        href={DOWNLOAD_URLS[primaryOS]}
        className="group px-8 py-4 rounded-full bg-white text-black font-semibold hover:bg-neutral-100 transition-colors flex items-center gap-2 text-base"
      >
        {primaryOS === 'mac' ? (
          <Apple className="w-5 h-5" />
        ) : (
          <Monitor className="w-5 h-5" />
        )}
        Download for {primaryOS === 'mac' ? 'Mac' : 'Windows'}
      </a>
      <a
        href={DOWNLOAD_URLS[secondaryOS]}
        className="px-6 py-4 text-neutral-400 hover:text-white transition-colors font-medium flex items-center gap-2"
      >
        {secondaryOS === 'mac' ? (
          <Apple className="w-4 h-4" />
        ) : (
          <Monitor className="w-4 h-4" />
        )}
        {secondaryOS === 'mac' ? 'Mac' : 'Windows'}
      </a>
    </div>
  )
}

export function DownloadButtonsHeader() {
  const os = useOS()
  const primaryOS = os === 'windows' ? 'windows' : 'mac'
  const secondaryOS = primaryOS === 'mac' ? 'windows' : 'mac'

  return (
    <div className="flex items-center gap-2">
      <a
        href={DOWNLOAD_URLS[secondaryOS]}
        className="p-2 text-neutral-400 hover:text-white transition-colors"
        title={`Download for ${secondaryOS === 'mac' ? 'Mac' : 'Windows'}`}
      >
        {secondaryOS === 'mac' ? (
          <Apple className="w-4 h-4" />
        ) : (
          <Monitor className="w-4 h-4" />
        )}
      </a>
      <a
        href={DOWNLOAD_URLS[primaryOS]}
        className="px-4 py-2 rounded-full bg-white text-black font-medium text-sm hover:bg-neutral-100 transition-colors flex items-center gap-2"
      >
        {primaryOS === 'mac' ? (
          <Apple className="w-4 h-4" />
        ) : (
          <Monitor className="w-4 h-4" />
        )}
        Download
      </a>
    </div>
  )
}


