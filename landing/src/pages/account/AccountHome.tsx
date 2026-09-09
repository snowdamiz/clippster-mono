import { Link } from 'react-router-dom'
import { Download, Globe, Loader2, MessageSquare, Monitor, User, Zap } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useDownloads } from '@/hooks/usePlatform'
import { trackDownloadClick } from '@/services/landingAnalytics'

export function AccountHome() {
  const { user } = useAuth()
  const { primaryDownload, isLoading } = useDownloads()

  const planName =
    user?.subscription?.tier_name ||
    (user?.subscription?.tier
      ? user.subscription.tier.charAt(0).toUpperCase() + user.subscription.tier.slice(1)
      : 'Free')
  const planStatus = user?.subscription?.status || 'none'
  const credits = user?.credits?.hours_remaining ?? user?.credits?.minutes_remaining
  const creditsLabel =
    credits === undefined || credits === null
      ? '—'
      : typeof credits === 'string'
        ? credits
        : `${Math.round(Number(credits))} min`

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white m-0 mb-2">
          Welcome{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="text-sm text-zinc-500 m-0 leading-relaxed">
          Manage your personal Clippster account online. Download the desktop app to clip, edit, and
          publish.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide m-0 mb-2">Plan</p>
          <p className="text-lg font-semibold text-white m-0">{planName}</p>
          <p className="text-xs text-zinc-500 m-0 mt-1 capitalize">{planStatus}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide m-0 mb-2 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            Credits
          </p>
          <p className="text-lg font-semibold text-white m-0">{creditsLabel}</p>
          <p className="text-xs text-zinc-500 m-0 mt-1">Processing time remaining</p>
        </div>
      </div>

      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-6 mb-8">
        <h2 className="text-lg font-semibold text-white m-0 mb-2">Get the desktop app</h2>
        <p className="text-sm text-zinc-400 m-0 mb-4 leading-relaxed">
          Clipping, editing, and publishing happen in Clippster Desktop. This web dashboard is for
          account management.
        </p>
        {isLoading ? (
          <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-800 text-zinc-400 text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading download…
          </span>
        ) : primaryDownload ? (
          <a
            href={primaryDownload.downloadUrl}
            onClick={() =>
              trackDownloadClick(
                primaryDownload,
                'account_home_cta',
                `Download for ${primaryDownload.label}`,
              )
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-400 text-[#0a0a0b] text-sm font-semibold no-underline hover:opacity-90 transition-opacity"
          >
            {primaryDownload.platform.os === 'mac' ? (
              <Download className="w-4 h-4" />
            ) : (
              <Monitor className="w-4 h-4" />
            )}
            Download for {primaryDownload.label}
          </a>
        ) : null}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide m-0 mb-3">
          Quick links
        </h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { to: '/account/profile', label: 'Profile', icon: User, desc: 'Public clipper profile' },
            { to: '/account/social', label: 'Social', icon: Globe, desc: 'Connected accounts' },
            { to: '/account/messages', label: 'Messages', icon: MessageSquare, desc: 'Conversations' },
          ].map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 no-underline hover:border-zinc-700 transition-colors"
              >
                <Icon className="w-5 h-5 text-cyan-400" />
                <span className="text-sm font-medium text-white">{item.label}</span>
                <span className="text-xs text-zinc-500">{item.desc}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
