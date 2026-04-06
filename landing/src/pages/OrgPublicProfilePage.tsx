import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  Building2,
  Loader2,
  UserCircle,
  Link,
  FileText,
  TrendingUp,
  CheckCircle2,
  Video,
  Users2,
  Eye,
  type LucideIcon,
} from 'lucide-react'
import { getOrgPublicProfile, getContentTypeLabel, type OrgPublicProfile } from '@/services/orgPublicApi'

function ensureUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

function discordContactHref(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (/^https?:\/\//i.test(t)) return t
  if (t.includes('discord.gg/') || t.includes('discord.com/')) return ensureUrl(t)
  if (/^[a-zA-Z0-9_-]{2,40}$/.test(t)) return `https://discord.gg/${encodeURIComponent(t)}`
  return null
}

function telegramContactHref(raw: string): string {
  const t = raw.trim()
  if (/^https?:\/\//i.test(t)) return t
  const u = t.replace(/^@/, '').replace(/^https?:\/\/(www\.)?t\.me\//i, '')
  return `https://t.me/${u}`
}

type PublicContactRow = {
  key: string
  label: string
  text: string
  href: string | null
  external?: boolean
}

function buildPublicContactRows(p: OrgPublicProfile): PublicContactRow[] {
  const rows: PublicContactRow[] = []
  if (p.public_contact_email?.trim()) {
    const text = p.public_contact_email.trim()
    rows.push({ key: 'email', label: 'Email', text, href: `mailto:${text}` })
  }
  if (p.website_url?.trim()) {
    const text = p.website_url.trim()
    rows.push({ key: 'website', label: 'Website', text, href: ensureUrl(text), external: true })
  }
  if (p.public_discord?.trim()) {
    const text = p.public_discord.trim()
    const dh = discordContactHref(text)
    rows.push({ key: 'discord', label: 'Discord', text, href: dh, external: !!dh })
  }
  if (p.public_telegram?.trim()) {
    const text = p.public_telegram.trim()
    rows.push({ key: 'telegram', label: 'Telegram', text, href: telegramContactHref(text), external: true })
  }
  return rows
}

export function OrgPublicProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<OrgPublicProfile | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!slug) return
      try {
        const data = await getOrgPublicProfile(slug)
        if (data.success && data.profile) setProfile(data.profile)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  const publicContactRows = useMemo(() => {
    if (!profile) return []
    return buildPublicContactRows(profile)
  }, [profile])

  if (loading) return <div className="min-h-screen grid place-items-center text-zinc-500"><Loader2 className="w-8 h-8 animate-spin" /></div>
  if (!profile) return <div className="min-h-screen grid place-items-center text-zinc-500">Organization not found</div>

  const getPlatformIcon = (platform: string | null) => {
    if (!platform) return null
    const icons: Record<string, string> = {
      pumpfun: '/capsule.svg',
      kick: '/kick.svg',
      twitch: '/twitch.svg',
      youtube: '/youtube.svg',
    }
    return icons[platform] || '/capsule.svg'
  }

  const getPlatformFilter = (platform: string | null) => {
    if (!platform) return 'none'
    const filters: Record<string, string> = {
      pumpfun: 'brightness(0) saturate(100%) invert(67%) sepia(52%) saturate(559%) hue-rotate(109deg) brightness(93%) contrast(92%)',
      kick: 'brightness(0) saturate(100%) invert(83%) sepia(47%) saturate(1113%) hue-rotate(57deg) brightness(106%) contrast(98%)',
      twitch: 'brightness(0) saturate(100%) invert(37%) sepia(98%) saturate(1932%) hue-rotate(249deg) brightness(93%) contrast(109%)',
      youtube: 'brightness(0) saturate(100%) invert(22%) sepia(99%) saturate(3013%) hue-rotate(352deg) brightness(95%) contrast(91%)',
    }
    return filters[platform] || 'none'
  }

  const platformTitles: Record<string, string> = {
    kick: 'Kick',
    twitch: 'Twitch',
    youtube: 'YouTube',
    pumpfun: 'Pump.fun',
  }

  const streamerProfileUrl = (platform: string | null, platformId: string | null) => {
    if (!platform || !platformId?.trim()) return null
    const id = platformId.trim()
    switch (platform) {
      case 'kick':
        return `https://kick.com/${id}`
      case 'pumpfun':
        return `https://pump.fun/coin/${id}`
      case 'twitch':
        return `https://twitch.tv/${id}`
      case 'youtube':
        return `https://youtube.com/@${id}`
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white p-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden mb-6">
          <div className="absolute top-0 left-0 right-0 h-[120px] bg-gradient-to-br from-blue-500/15 to-blue-700/15 opacity-50" />
          <div className="relative p-8">
            <div className="flex items-start gap-6 mb-8">
              {profile.logo_url ? <img src={profile.logo_url} className="w-24 h-24 rounded-[20px] object-cover border-2 border-zinc-800" /> : <Building2 className="w-24 h-24 p-5 rounded-[20px] bg-zinc-800 text-zinc-500 border-2 border-zinc-800" />}
              <div className="min-w-0">
                <h1 className="text-[28px] font-bold tracking-[-0.03em]">{profile.name}</h1>
                {profile.description && <p className="text-zinc-400 mt-2 max-w-[680px] leading-relaxed">{profile.description}</p>}
                {!!profile.content_type_tags?.length && <div className="flex gap-2 flex-wrap mt-3">{profile.content_type_tags.map((t) => <span key={t} className="px-2.5 py-1.5 text-[11px] rounded-md bg-blue-500/15 text-blue-400 font-semibold">{getContentTypeLabel(t)}</span>)}</div>}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
              {(
                [
                  {
                    label: 'Active Campaigns',
                    value: profile.stats.campaigns_running,
                    Icon: TrendingUp,
                    box: 'bg-gradient-to-br from-sky-500/25 to-sky-600/10',
                    iconClass: 'text-sky-400',
                  },
                  {
                    label: 'Completed Campaigns',
                    value: profile.stats.campaigns_completed,
                    Icon: CheckCircle2,
                    box: 'bg-gradient-to-br from-emerald-500/25 to-emerald-600/10',
                    iconClass: 'text-emerald-400',
                  },
                  {
                    label: 'Streamers',
                    value: profile.stats.streamers_count,
                    Icon: Video,
                    box: 'bg-gradient-to-br from-violet-500/25 to-violet-600/10',
                    iconClass: 'text-violet-400',
                  },
                  {
                    label: 'Clippers',
                    value: profile.stats.clippers_count,
                    Icon: Users2,
                    box: 'bg-gradient-to-br from-amber-500/25 to-amber-600/10',
                    iconClass: 'text-amber-400',
                  },
                  {
                    label: 'Total Views',
                    value: profile.stats.total_views ?? 0,
                    Icon: Eye,
                    box: 'bg-gradient-to-br from-fuchsia-500/25 to-fuchsia-600/10',
                    iconClass: 'text-fuchsia-400',
                  },
                ] as const satisfies ReadonlyArray<{
                  label: string
                  value: number
                  Icon: LucideIcon
                  box: string
                  iconClass: string
                }>
              ).map(({ label, value, Icon, box, iconClass }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-800/60 px-2.5 py-2 min-w-0"
                >
                  <div
                    className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg ${box}`}
                  >
                    <Icon className={`h-[15px] w-[15px] ${iconClass}`} strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg sm:text-xl font-bold leading-none tabular-nums truncate">
                      {value.toLocaleString()}
                    </div>
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.04em] text-zinc-500 mt-0.5 whitespace-nowrap truncate">
                      {label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 px-2">
          <div className="flex flex-col gap-6">
            {!!profile.bio && (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-800 bg-gradient-to-b from-purple-500/5 to-transparent flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-purple-400" />
                  </div>
                  <h2 className="text-lg font-semibold">About</h2>
                </div>
                <div className="p-6">
                  <p className="text-zinc-400 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
                </div>
              </section>
            )}

            {!!profile.streamers?.length && (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-800 bg-gradient-to-b from-cyan-500/5 to-transparent">
                  <h2 className="text-lg font-semibold">Streamers</h2>
                </div>
                <div className="p-6">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
              {profile.streamers.map((s) => {
                const href = streamerProfileUrl(s.platform, s.platform_id ?? null)
                const CardTag = href ? 'a' : 'div'
                const linkProps = href
                  ? { href, target: '_blank' as const, rel: 'noopener noreferrer' as const }
                  : {}
                return (
                  <CardTag
                    key={s.id}
                    {...linkProps}
                    className={`relative flex flex-col overflow-hidden rounded-[16px] border border-zinc-800 bg-[linear-gradient(to_bottom,rgba(24,24,27,1)_0%,rgba(0,0,0,0.2)_100%)] transition-all duration-200 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-[0_12px_24px_rgba(0,0,0,0.3),0_0_0_1px_rgba(6,182,212,0.1)] ${href ? 'cursor-pointer text-inherit no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 focus-visible:outline-offset-2' : ''}`}
                  >
                    <div className="pointer-events-none absolute left-0 right-0 top-0 h-20 bg-[linear-gradient(135deg,rgba(6,182,212,0.1)_0%,rgba(14,165,233,0.05)_100%)] opacity-50" />

                    <div className="relative flex flex-col items-center gap-3.5 border-b border-zinc-800 px-5 pb-5 pt-6 text-center">
                      <div className="relative z-[1] h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-zinc-900 bg-zinc-800 shadow-[0_4px_12px_rgba(0,0,0,0.2),0_0_0_2px_rgba(6,182,212,0.2)]">
                        {s.profile_image_url ? (
                          <img src={s.profile_image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(6,182,212,0.15)_0%,rgba(39,39,42,1)_100%)]">
                            <UserCircle className="h-7 w-7 text-zinc-500 opacity-60" />
                          </div>
                        )}
                      </div>

                      <div className="flex w-full flex-col items-center gap-2">
                        <div className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-[1.125rem] font-bold leading-[1.3] tracking-[-0.02em] text-white">
                          {s.display_name || s.name || 'Streamer'}
                        </div>
                        <div className="mt-0.5 flex items-center justify-center gap-1.5">
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10"
                            title={s.platform ? platformTitles[s.platform] ?? s.platform : 'No platform linked'}
                          >
                            {s.platform ? (
                              <img
                                src={getPlatformIcon(s.platform) || ''}
                                alt=""
                                className="h-[18px] w-[18px]"
                                style={{ filter: getPlatformFilter(s.platform) }}
                              />
                            ) : (
                              <Link className="h-4 w-4 text-zinc-500" />
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardTag>
                )
              })}
            </div>
                </div>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-5">
            {!!profile.social_accounts?.length && (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-800 bg-gradient-to-b from-cyan-500/5 to-transparent">
                  <h3 className="text-base font-semibold">Connected Accounts</h3>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  {profile.social_accounts.map((a) => (
                    <div key={a.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-zinc-800 bg-zinc-800/60">
                      {a.profile_image_url ? <img src={a.profile_image_url} className="w-8 h-8 rounded-full object-cover" /> : <UserCircle className="w-8 h-8 text-zinc-500" />}
                      <div className="min-w-0">
                        <div className="text-sm text-zinc-100 truncate">{a.display_name || a.username || a.platform}</div>
                        <div className="text-[11px] text-zinc-500">{a.platform}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {publicContactRows.length > 0 && (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-800 bg-gradient-to-b from-cyan-500/5 to-transparent">
                  <h3 className="text-base font-semibold">Contact</h3>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  {publicContactRows.map((row) => (
                    <div
                      key={row.key}
                      className="flex flex-col gap-1 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/60 min-w-0"
                    >
                      <span className="text-[10px] uppercase tracking-[0.06em] text-zinc-500 font-semibold">{row.label}</span>
                      {row.href ? (
                        <a
                          href={row.href}
                          target={row.external ? '_blank' : undefined}
                          rel={row.external ? 'noopener noreferrer' : undefined}
                          className="text-sm text-zinc-100 no-underline hover:text-cyan-400 break-words leading-snug"
                        >
                          {row.text}
                        </a>
                      ) : (
                        <span className="text-sm text-zinc-100 break-words leading-snug">{row.text}</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
            {!!profile.hiring && (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-800 bg-gradient-to-b from-cyan-500/5 to-transparent flex items-center gap-3">
                  <h3 className="text-base font-semibold">Hiring</h3>
                  <span className="ml-auto px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-500/15 text-emerald-400 capitalize">{profile.hiring.status}</span>
                </div>
                <div className="p-4 flex flex-col gap-3">
                  <div className="font-semibold text-[15px] text-white">{profile.hiring.title}</div>
                  {!!profile.hiring.description && <p className="text-zinc-400 text-[13px] leading-relaxed m-0">{profile.hiring.description}</p>}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center p-2.5 rounded-lg border border-zinc-800 bg-zinc-800/60">
                      <span className="text-[11px] uppercase text-zinc-500 tracking-wide">Status</span>
                      <span className="text-[13px] font-medium text-zinc-100">{profile.hiring.status}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 rounded-lg border border-zinc-800 bg-zinc-800/60">
                      <span className="text-[11px] uppercase text-zinc-500 tracking-wide">Slots</span>
                      <span className="text-[13px] font-medium text-zinc-100">{profile.hiring.clipper_slots_filled} / {profile.hiring.clipper_slots ?? 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 rounded-lg border border-zinc-800 bg-zinc-800/60">
                      <span className="text-[11px] uppercase text-zinc-500 tracking-wide">Experience</span>
                      <span className="text-[13px] font-medium text-zinc-100">{profile.hiring.experience_level || 'Any'}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 rounded-lg border border-zinc-800 bg-zinc-800/60">
                      <span className="text-[11px] uppercase text-zinc-500 tracking-wide">Payment</span>
                      <span className="text-[13px] font-medium text-zinc-100">{profile.hiring.payment_type || 'Not specified'}</span>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
