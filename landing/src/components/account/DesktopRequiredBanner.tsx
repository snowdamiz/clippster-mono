import { Download, Loader2, Monitor } from 'lucide-react'
import { useDownloads } from '@/hooks/usePlatform'
import { trackDownloadClick } from '@/services/landingAnalytics'

export function DesktopRequiredBanner() {
  const { primaryDownload, isLoading } = useDownloads()

  return (
    <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900/60">
      <p className="text-sm text-zinc-300 m-0 leading-relaxed">
        This is your online account dashboard. Download Clippster to clip, edit, and publish.
      </p>
      {isLoading ? (
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-400 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </span>
      ) : primaryDownload ? (
        <a
          href={primaryDownload.downloadUrl}
          onClick={() =>
            trackDownloadClick(
              primaryDownload,
              'account_desktop_banner',
              `Download for ${primaryDownload.label}`,
            )
          }
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 text-[#0a0a0b] text-sm font-semibold no-underline hover:opacity-90 transition-opacity shrink-0"
        >
          {primaryDownload.platform.os === 'mac' ? (
            <Download className="w-4 h-4" />
          ) : (
            <Monitor className="w-4 h-4" />
          )}
          Download {primaryDownload.label}
        </a>
      ) : null}
    </div>
  )
}
