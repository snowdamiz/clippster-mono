import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Briefcase,
  Building2,
  CheckCircle2,
  Eye,
  Globe,
  Link,
  Loader2,
  TrendingUp,
  UserCircle,
  Users,
  Users2,
  Video,
} from 'lucide-react'
import { getOrgPublicProfile, getContentTypeLabel, type OrgPublicProfile } from '@/services/orgPublicApi'
import './OrgPublicProfilePage.css'

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
      rumble: '/rumble.svg',
      x: '/x.svg',
      twitter: '/x.svg',
      tiktok: '/tiktok.svg',
    }
    return icons[platform] || null
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
    x: 'X',
    twitter: 'X',
    instagram: 'Instagram',
    tiktok: 'TikTok',
  }

  const platformLabel = (platform: string | null) => {
    if (!platform) return 'Unknown'
    return platformTitles[platform] || platform
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
    <div className="profile-content org-profile-page">
      <div className="org-profile">
        <div className="org-hero">
          <div className="org-hero__banner" />
          <div className="org-hero__content">
            <div className="org-hero__avatar">
              {profile.logo_url ? <img src={profile.logo_url} className="org-hero__avatar-img" /> : <Building2 className="org-hero__avatar-fallback" />}
            </div>
            <div className="org-hero__info">
              <h1 className="org-hero__name">{profile.name}</h1>
              {profile.description && <p className="org-hero__tagline">{profile.description}</p>}
              {!!profile.content_type_tags?.length && (
                <div className="org-hero__tags">
                  {profile.content_type_tags.map((t) => <span key={t} className="org-hero__tag">{getContentTypeLabel(t)}</span>)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="org-stats-grid">
          <div className="org-stat-card"><div className="org-stat-card__icon org-stat-card__icon--cyan"><TrendingUp size={18} /></div><div className="org-stat-card__content"><span className="org-stat-card__value">{profile.stats.campaigns_running}</span><span className="org-stat-card__label">Active Campaigns</span></div></div>
          <div className="org-stat-card"><div className="org-stat-card__icon org-stat-card__icon--green"><CheckCircle2 size={18} /></div><div className="org-stat-card__content"><span className="org-stat-card__value">{profile.stats.campaigns_completed}</span><span className="org-stat-card__label">Completed</span></div></div>
          <div className="org-stat-card"><div className="org-stat-card__icon org-stat-card__icon--violet"><Video size={18} /></div><div className="org-stat-card__content"><span className="org-stat-card__value">{profile.stats.streamers_count}</span><span className="org-stat-card__label">Streamers</span></div></div>
          <div className="org-stat-card"><div className="org-stat-card__icon org-stat-card__icon--amber"><Users2 size={18} /></div><div className="org-stat-card__content"><span className="org-stat-card__value">{profile.stats.clippers_count}</span><span className="org-stat-card__label">Clippers</span></div></div>
          <div className="org-stat-card"><div className="org-stat-card__icon org-stat-card__icon--pink"><Eye size={18} /></div><div className="org-stat-card__content"><span className="org-stat-card__value">{(profile.stats.total_views ?? 0).toLocaleString()}</span><span className="org-stat-card__label">Total Views</span></div></div>
        </div>

        <div className="org-grid">
          <div className="org-main">
            {!!profile.bio && (
              <div className="org-card">
                <div className="org-card__header"><h2 className="org-card__title">About</h2></div>
                <div className="org-card__body"><p className="org-card__text">{profile.bio}</p></div>
              </div>
            )}

            {!!profile.streamers?.length && (
              <div className="org-card">
                <div className="org-card__header"><h2 className="org-card__title">Streamers</h2><span className="org-card__count">{profile.streamers.length}</span></div>
                <div className="org-card__body org-card__body--streamers">
                  {profile.streamers.map((s) => {
                    const href = streamerProfileUrl(s.platform, s.platform_id ?? null)
                    const cardClass = `creator-card ${href ? 'creator-card--link' : ''}`
                    return (
                      <a key={s.id} className={cardClass} href={href || undefined} target={href ? '_blank' : undefined} rel={href ? 'noopener noreferrer' : undefined}>
                        <div className="creator-card__banner" />
                        <div className="creator-card__content">
                          <div className="creator-card__avatar">
                            {s.profile_image_url ? <img src={s.profile_image_url} className="creator-card__avatar-img" /> : <UserCircle className="creator-card__avatar-fallback" />}
                          </div>
                          <span className="creator-card__name">{s.display_name || s.name || 'Streamer'}</span>
                          <div className="creator-card__platform" title={s.platform ? platformLabel(s.platform) : 'No platform linked'}>
                            {s.platform && getPlatformIcon(s.platform) ? <img src={getPlatformIcon(s.platform) || ''} className="creator-card__platform-icon" style={{ filter: getPlatformFilter(s.platform) }} /> : <Link className="creator-card__platform-empty" />}
                          </div>
                        </div>
                      </a>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <aside className="org-sidebar">
            {!!profile.social_accounts?.length && (
              <div className="org-card org-card--compact">
                <div className="org-card__header"><Users className="org-card__header-icon" /><h3 className="org-card__title">Connected</h3></div>
                <div className="org-card__body">
                  {profile.social_accounts.map((a) => (
                    <div key={a.id} className="org-account">
                      {a.profile_image_url ? <img src={a.profile_image_url} className="org-account__avatar" /> : <div className="org-account__avatar org-account__avatar--placeholder"><Users size={14} /></div>}
                      <div className="org-account__info">
                        <span className="org-account__name">{a.display_name || a.username || a.platform}</span>
                        <div className="org-account__platform-row">
                          <span className="org-account__platform-chip" title={a.platform ? platformLabel(a.platform) : 'No platform linked'}>
                            {a.platform && getPlatformIcon(a.platform) ? <img src={getPlatformIcon(a.platform) || ''} className="org-account__platform-icon" style={{ filter: getPlatformFilter(a.platform) }} /> : <Link className="org-account__platform-empty" />}
                          </span>
                          <span className="org-account__platform">{platformLabel(a.platform)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {publicContactRows.length > 0 && (
              <div className="org-card org-card--compact">
                <div className="org-card__header"><Globe className="org-card__header-icon" /><h3 className="org-card__title">Contact</h3></div>
                <div className="org-card__body">
                  {publicContactRows.map((row) => (
                    <div key={row.key} className="org-contact">
                      <span className="org-contact__label">{row.label}</span>
                      {row.href ? <a href={row.href} target={row.external ? '_blank' : undefined} rel={row.external ? 'noopener noreferrer' : undefined} className="org-contact__value org-contact__value--link">{row.text}</a> : <span className="org-contact__value">{row.text}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!!profile.hiring && (
              <div className="org-card org-card--compact org-card--hiring">
                <div className="org-card__header"><Briefcase className="org-card__header-icon" /><h3 className="org-card__title">Hiring</h3><span className="org-card__badge">{profile.hiring.status}</span></div>
                <div className="org-card__body">
                  <div className="org-hiring__title">{profile.hiring.title}</div>
                  {!!profile.hiring.description && <p className="org-hiring__desc">{profile.hiring.description}</p>}
                  <div className="org-hiring__meta">
                    <div className="org-hiring__row"><span>Slots</span><span>{profile.hiring.clipper_slots_filled} / {profile.hiring.clipper_slots ?? '∞'}</span></div>
                    <div className="org-hiring__row"><span>Experience</span><span>{profile.hiring.experience_level || 'Any'}</span></div>
                    <div className="org-hiring__row"><span>Payment</span><span>{profile.hiring.payment_type || 'Not specified'}</span></div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
