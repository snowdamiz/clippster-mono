import { Sparkles, Apple, Monitor } from 'lucide-react'
import { useOS } from '../hooks/useOS'

// TODO: Replace with actual download URLs
const DOWNLOAD_URLS = {
  mac: '#download-mac',
  windows: '#download-windows',
}

export function CTA() {
  const os = useOS()
  const primaryOS = os === 'windows' ? 'windows' : 'mac'
  const secondaryOS = primaryOS === 'mac' ? 'windows' : 'mac'

  return (
    <section className="py-16 sm:py-24 lg:py-32 relative">
      {/* Top line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="relative">
          {/* Background glow */}
          <div className="absolute inset-0 -m-4 sm:-m-8 bg-gradient-to-r from-blue-500/10 via-violet-500/10 to-pink-500/10 rounded-2xl sm:rounded-3xl blur-2xl" />
          
          <div className="relative rounded-xl sm:rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden">
            {/* Decorative gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.08] via-transparent to-pink-500/[0.08]" />
            
            {/* Content */}
            <div className="relative z-10 p-6 sm:p-10 md:p-16 text-center">
              {/* Headline */}
              <div className="mb-4 sm:mb-6">
                <div className="flex items-center justify-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div className="h-px w-8 sm:w-12 bg-gradient-to-r from-transparent to-white/20" />
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                  <div className="h-px w-8 sm:w-12 bg-gradient-to-l from-transparent to-white/20" />
                </div>
                <h2 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white">
                  Ready to go <span className="gradient-text">viral</span>?
                </h2>
              </div>
              
              {/* Subtext */}
              <p className="text-neutral-400 max-w-md mx-auto mb-8 sm:mb-10 text-sm sm:text-base md:text-lg">
                Join 50,000+ creators already using Clippster. Download free for Mac or Windows.
              </p>
              
              {/* Download Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
                <a
                  href={DOWNLOAD_URLS[primaryOS]}
                  className="group px-6 sm:px-8 py-3.5 sm:py-4 rounded-full bg-white text-black font-semibold hover:bg-neutral-100 transition-colors flex items-center justify-center gap-3 text-sm sm:text-base w-full sm:w-auto"
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
                  className="px-4 sm:px-6 py-3 sm:py-4 text-neutral-400 hover:text-white transition-colors font-medium flex items-center justify-center gap-2 text-sm w-full sm:w-auto"
                >
                  {secondaryOS === 'mac' ? (
                    <Apple className="w-4 h-4" />
                  ) : (
                    <Monitor className="w-4 h-4" />
                  )}
                  {secondaryOS === 'mac' ? 'Mac' : 'Windows'} version
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
