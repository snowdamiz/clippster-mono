import { useCallback, useContext, useEffect, useState } from 'react'
import { useParams, Link as RouterLink } from 'react-router-dom'
import {
  Award,
  CheckCircle,
  ExternalLink,
  Briefcase,
  Handshake,
  Instagram,
  Link2,
  Loader2,
  Music2,
  Play,
  Send,
  Share2,
  Globe,
  Star,
  Twitch,
  Twitter,
  UserCircle,
  Video,
  X,
  Youtube
} from 'lucide-react'
import {
  createEndorsement,
  getClipperBySlug,
  getBadgeLabel,
  getContentStyleTagLabel,
  getExperienceLevelLabel,
  getLanguageName,
  getPlatformLabel,
  getSpecialtyTagLabel,
  formatViews,
  type ClipperProfile
} from '../services/clipperApi'
import { AuthContext } from '../context/AuthContext'
import { ToastContext } from '../context/ToastContext'
import '../../../packages/profile-design/profile.css'
import { publicPortfolio } from '../../../packages/profile-design/portfolio'
import { API_BASE } from '../lib/apiBase'
import { formatTimezoneForDisplay } from '../utils/formatTimezone'
import { SeoHead } from '../seo/SeoHead'
import { DEFAULT_OG_IMAGE, absoluteUrl, clipperProfileJsonLd } from '../seo/catalog'

function PlatformGlyph({ platform, className }: { platform: string; className?: string }) {
  const p = platform.toLowerCase()
  const cn = className ?? ''
  if (p === 'instagram') return <Instagram className={cn} />
  if (p === 'youtube') return <Youtube className={cn} />
  if (p === 'twitch') return <Twitch className={cn} />
  if (p === 'tiktok' || p === 'kick') return <Music2 className={cn} />
  if (p === 'x' || p === 'twitter') return <Twitter className={cn} />
  return <Link2 className={cn} />
}

export function ClipperPublicProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const authContext = useContext(AuthContext)
  const toastContext = useContext(ToastContext)
  const user = authContext?.user || null

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ClipperProfile | null>(null)
  const [showVideoPlayer, setShowVideoPlayer] = useState(false)
  const [selectedClip, setSelectedClip] = useState<{
    id: number
    title?: string
    thumbnail_url?: string | null
  } | null>(null)
  const [videoPlaybackUrl, setVideoPlaybackUrl] = useState<string | null>(null)
  const [loadingVideo, setLoadingVideo] = useState(false)
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({})

  const [showEndorsementDialog, setShowEndorsementDialog] = useState(false)
  const [endorsementContent, setEndorsementContent] = useState('')
  const [endorsementRating, setEndorsementRating] = useState(0)
  const [submittingEndorsement, setSubmittingEndorsement] = useState(false)
  const [endorsementError, setEndorsementError] = useState('')

  const [activeTab, setActiveTab] = useState<'Work' | 'Endorsements'>('Work')

  const canDownloadClips = !!user?.owned_organization_id

  const loadProfile = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    try {
      const data = await getClipperBySlug(slug)
      if (data.success && data.profile) {
        setProfile(data.profile)
        if (data.profile.portfolio_clips?.length) {
          const thumbnails: Record<number, string> = {}
          await Promise.all(
            data.profile.portfolio_clips.map(async (clip) => {
              try {
                const response = await fetch(
                  `${API_BASE}/clippers/${slug}/portfolio-clips/${clip.id}/thumbnail-presigned-url`
                )
                const thumbData = await response.json()
                if (thumbData.success && thumbData.url) {
                  thumbnails[clip.id] = thumbData.url
                }
              } catch (e) {
                console.error(`Failed to load thumbnail for clip ${clip.id}:`, e)
              }
            })
          )
          setThumbnailUrls(thumbnails)
        }
      }
    } catch (e) {
      console.error('Failed to load profile:', e)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const openEndorsementDialog = () => {
    setEndorsementContent('')
    setEndorsementRating(0)
    setEndorsementError('')
    setShowEndorsementDialog(true)
  }

  const submitEndorsement = async () => {
    if (!profile?.slug || endorsementRating === 0) return
    if (!user?.owned_organization_id) {
      setEndorsementError('You must own an organization to endorse clippers.')
      return
    }
    setSubmittingEndorsement(true)
    setEndorsementError('')
    try {
      const res = await createEndorsement(profile.slug, user.owned_organization_id, {
        content: endorsementContent || undefined,
        rating: endorsementRating
      })
      if (res.success) {
        toastContext?.success('Endorsement submitted', "Your endorsement has been added to this clipper's profile.")
        setShowEndorsementDialog(false)
        loadProfile()
      } else {
        setEndorsementError((res as { error?: string }).error || 'Failed to submit endorsement.')
      }
    } catch (err: unknown) {
      console.error(err)
      setEndorsementError('Failed to submit endorsement. Please try again.')
    } finally {
      setSubmittingEndorsement(false)
    }
  }

  const getAccountUrl = (account: {
    profile_url: string | null
    username: string | null
    platform: string
  }): string | null => {
    if (account.profile_url) return account.profile_url
    if (!account.username) return null
    const username = account.username.replace('@', '')
    switch (account.platform.toLowerCase()) {
      case 'instagram':
        return `https://instagram.com/${username}`
      case 'tiktok':
        return `https://tiktok.com/@${username}`
      case 'twitter':
      case 'x':
        return `https://twitter.com/${username}`
      case 'youtube':
        return `https://youtube.com/@${username}`
      case 'twitch':
        return `https://twitch.tv/${username}`
      case 'kick':
        return `https://kick.com/${username}`
      default:
        return null
    }
  }

  const playClip = async (clip: { id: number; title?: string }) => {
    if (!slug) return
    setSelectedClip(clip)
    setShowVideoPlayer(true)
    setLoadingVideo(true)
    setVideoPlaybackUrl(null)
    try {
      const response = await fetch(`${API_BASE}/clippers/${slug}/portfolio-clips/${clip.id}/presigned-url`)
      const data = await response.json()
      if (data.success && data.url) {
        setVideoPlaybackUrl(data.url)
      }
    } catch (e) {
      console.error('Failed to load video:', e)
    } finally {
      setLoadingVideo(false)
    }
  }

  const closeVideoPlayer = () => {
    setShowVideoPlayer(false)
    setSelectedClip(null)
    setVideoPlaybackUrl(null)
  }

  if (loading) {
    return (
      <div className="clipper-public-profile-page">
        <SeoHead
          title="Clipper profile | Clippster"
          description="Loading a public clipper profile on Clippster."
          robots="noindex, follow"
        />
        <div className="profile-content profile-content--loading">
          <div className="loading-spinner">
            <Loader2 className="loading-spinner__icon" />
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="clipper-public-profile-page">
        <SeoHead
          title="Clipper not found | Clippster"
          description="This clipper profile does not exist or is private."
          robots="noindex, nofollow"
        />
        <div className="profile-content profile-content--empty">
          <div className="empty-state">
            <div className="empty-state__icon-wrapper">
              <UserCircle className="empty-state__icon" />
            </div>
            <h3 className="empty-state__title">Profile not found</h3>
            <p className="empty-state__description">This clipper profile doesn&apos;t exist or is private</p>
          </div>
        </div>
      </div>
    )
  }

  const portfolioClips = publicPortfolio(profile.portfolio_clips)
  const professionalRows = [
    profile.experience_level && { label: 'Experience', value: getExperienceLevelLabel(profile.experience_level) },
    profile.timezone && { label: 'Timezone', value: formatTimezoneForDisplay(profile.timezone) },
    profile.response_time_hours != null && {
      label: 'Response time',
      value: '~' + profile.response_time_hours + ' hours'
    },
    !!profile.languages?.length && { label: 'Languages', value: profile.languages.map(getLanguageName).join(', ') }
  ].filter((row): row is { label: string; value: string } => !!row)
  const stats = [
    { label: 'Campaigns', value: profile.total_campaigns_completed },
    { label: 'Clips delivered', value: profile.total_clips_delivered },
    { label: 'Endorsements', value: profile.total_endorsements },
    ...(profile.total_views ? [{ label: 'Total views', value: formatViews(profile.total_views) }] : [])
  ]
  const socialContact = profile.social_accounts?.map(getAccountUrl).find(Boolean) || profile.channel_links?.[0]?.url
  const contactUrl = user?.owned_organization_id
    ? '/dashboard/org/' + user.owned_organization_id + '/messages?to=' + profile.user_id
    : socialContact
  const shareProfile = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + '/clippers/' + profile.slug)
      toastContext?.success('Link copied', 'Profile link copied to clipboard.')
    } catch {
      toastContext?.error('Could not copy link', 'Copy the profile URL from your address bar.')
    }
  }
  const displayName = profile.display_name || 'Unnamed Clipper'
  const profileDescription =
    profile.bio?.trim() || `${displayName} is a clipper on Clippster. View campaigns, clips delivered, and specialties.`
  return (
    <div className="clipper-public-profile-page">
      <SeoHead
        title={`${displayName} | Clipper on Clippster`}
        description={profileDescription.slice(0, 160)}
        canonical={absoluteUrl(`/clippers/${profile.slug || slug}`)}
        image={profile.avatar_url || DEFAULT_OG_IMAGE}
        jsonLd={clipperProfileJsonLd({
          name: displayName,
          description: profileDescription,
          slug: profile.slug || slug || '',
          image: profile.avatar_url
        })}
      />
      <header className="cp-site-header">
        <RouterLink to="/" className="cp-brand">
          <img src="/logo-icon.svg" alt="" />
          Clippster
        </RouterLink>
        <RouterLink to="/clippers">Discover clippers</RouterLink>
        <RouterLink to="/account" className="cp-button">
          Open app <ExternalLink size={15} />
        </RouterLink>
      </header>
      <main className="cp-profile">
        <div className="cp-frame">
          <div className="cp-cover" aria-hidden="true">
            {portfolioClips.map((clip) =>
              thumbnailUrls[clip.id] || clip.thumbnail_url ? (
                <img key={clip.id} src={thumbnailUrls[clip.id] || clip.thumbnail_url || ''} alt="" />
              ) : null
            )}
          </div>
          <header className="cp-identity">
            <div className="cp-avatar">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : <UserCircle />}
            </div>
            <div className="cp-summary">
              <div className="cp-name">
                <h1>{displayName}</h1>
                {profile.is_verified && <CheckCircle size={20} aria-label="Verified" />}
                {profile.looking_for_work && <span className="cp-tag cp-available">Available for work</span>}
                {profile.is_affiliate && (
                  <span className="cp-tag">
                    <Handshake />
                    Affiliate
                  </span>
                )}
                {profile.badges?.map((badge) => (
                  <span className="cp-tag" key={badge.id}>
                    {getBadgeLabel(badge.badge_type)}
                  </span>
                ))}
              </div>
              {profile.slug && <p className="cp-handle">@{profile.slug}</p>}
              {profile.bio?.trim() && <p className="cp-bio">{profile.bio}</p>}
              <div className="cp-tags">
                {profile.specialty_tags?.map((tag) => (
                  <span className="cp-tag" key={tag}>
                    {getSpecialtyTagLabel(tag)}
                  </span>
                ))}
              </div>
            </div>
            <div className="cp-actions">
              {contactUrl && user?.id !== profile.user_id && (
                <a
                  className="cp-button cp-primary"
                  href={contactUrl}
                  target={user?.owned_organization_id ? undefined : '_blank'}
                  rel={user?.owned_organization_id ? undefined : 'noopener noreferrer'}
                >
                  <Send />
                  Contact
                </a>
              )}
              {user?.owned_organization_id && (
                <button className="cp-button" type="button" onClick={openEndorsementDialog}>
                  <Star />
                  Endorse
                </button>
              )}
              {profile.slug && (
                <button className="cp-button" type="button" onClick={shareProfile}>
                  <Share2 />
                  Share
                </button>
              )}
            </div>
          </header>
          <div className="cp-columns">
            <div className="cp-main">
              <dl className="cp-stats">
                {stats.map((stat) => (
                  <div className="cp-stat" key={stat.label}>
                    <dd>{stat.value}</dd>
                    <dt>{stat.label}</dt>
                  </div>
                ))}
              </dl>
              <nav className="cp-tabs" aria-label="Profile sections">
                {(['Work', 'Endorsements'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className="cp-tab"
                    aria-pressed={activeTab === tab}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
              {activeTab === 'Work' && (
                <section aria-label="Portfolio">
                  {portfolioClips.length ? (
                    <div className="cp-work">
                      {portfolioClips.map((clip, index) => (
                        <button
                          key={clip.id}
                          className="cp-clip"
                          type="button"
                          aria-label={'Play ' + (clip.title || 'Untitled clip')}
                          onClick={() => playClip(clip)}
                        >
                          {thumbnailUrls[clip.id] || clip.thumbnail_url ? (
                            <img src={thumbnailUrls[clip.id] || clip.thumbnail_url || ''} alt="" />
                          ) : (
                            <Video className="cp-placeholder" />
                          )}
                          {index === 0 && <span className="cp-featured">Featured</span>}
                          <span className="cp-play">
                            <Play />
                          </span>
                          <span className="cp-caption">{clip.title || 'Untitled clip'}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="cp-empty">
                      <strong>No portfolio clips yet</strong>This clipper hasn't added work to their portfolio.
                    </div>
                  )}
                </section>
              )}
              {activeTab === 'Endorsements' && (
                <section aria-label="Endorsements">
                  {profile.endorsements?.length ? (
                    profile.endorsements.map((endorsement) => (
                      <article key={endorsement.id} className="cp-review">
                        <header>
                          <strong>{endorsement.organization?.name || 'Organization'}</strong>
                          {!!endorsement.rating && (
                            <span className="cp-rating" aria-label={endorsement.rating + ' out of 5 stars'}>
                              {Array.from({ length: endorsement.rating }, (_, i) => (
                                <Star key={i} />
                              ))}
                            </span>
                          )}
                        </header>
                        {endorsement.endorsed_by?.name && <p>By {endorsement.endorsed_by.name}</p>}
                        {endorsement.content && <p>“{endorsement.content}”</p>}
                      </article>
                    ))
                  ) : (
                    <div className="cp-empty">
                      <strong>No endorsements yet</strong>Endorsements from organizations will appear here.
                    </div>
                  )}
                </section>
              )}
            </div>
            <aside className="cp-aside" aria-label="Profile details">
              <div className="cp-section">
                <h2>About {displayName}</h2>
                <p>{profile.bio?.trim() || 'This clipper has not added a bio yet.'}</p>
              </div>
              {!!professionalRows.length && (
                <div className="cp-section">
                  <dl className="cp-details">
                    {professionalRows.map((row) => (
                      <div className="cp-detail" key={row.label}>
                        {row.label === 'Timezone' ? <Globe /> : <Briefcase />}
                        <div>
                          <dt>{row.label}</dt>
                          <dd>{row.value}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {!!profile.content_style_tags?.length && (
                <div className="cp-section">
                  <h3>Content styles</h3>
                  <div className="cp-tags">
                    {profile.content_style_tags.map((tag) => (
                      <span className="cp-tag" key={tag}>
                        {getContentStyleTagLabel(tag)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {!!profile.social_accounts?.length && (
                <div className="cp-section">
                  <h3>Connected accounts</h3>
                  <div className="cp-links">
                    {profile.social_accounts.map((account, index) => (
                      <a
                        className="cp-link"
                        key={index}
                        href={getAccountUrl(account) || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {account.profile_image_url ? (
                          <img src={account.profile_image_url} alt="" />
                        ) : (
                          <PlatformGlyph platform={account.platform} />
                        )}
                        <span>
                          {account.username
                            ? '@' + account.username.replace(/^@/, '')
                            : getPlatformLabel(account.platform)}
                          {account.is_verified && <CheckCircle size={12} aria-label="Verified" />}
                        </span>
                        {getAccountUrl(account) && <ExternalLink />}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {!profile.social_accounts?.length && !!profile.preferred_platforms?.length && (
                <div className="cp-section">
                  <h3>Platforms</h3>
                  <div className="cp-tags">
                    {profile.preferred_platforms.map((platform) => (
                      <span className="cp-tag" key={platform}>
                        <PlatformGlyph platform={platform} />
                        {getPlatformLabel(platform)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {!!profile.channel_links?.length && (
                <div className="cp-section">
                  <h3>Social channels</h3>
                  <div className="cp-links">
                    {profile.channel_links.map((link) => (
                      <a key={link.id} className="cp-link" href={link.url} target="_blank" rel="noopener noreferrer">
                        <PlatformGlyph platform={link.platform} />
                        <span>{link.username || getPlatformLabel(link.platform)}</span>
                        <ExternalLink />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>

      {showVideoPlayer && selectedClip && (
        <div className="video-modal__overlay" onClick={closeVideoPlayer} role="presentation">
          <div className="video-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="video-modal__header">
              <span className="video-modal__title">{selectedClip.title || 'Untitled'}</span>
              <button type="button" className="video-modal__close" onClick={closeVideoPlayer} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="video-modal__body">
              {loadingVideo ? (
                <div className="video-modal__loading">
                  <div className="video-modal__spinner" />
                </div>
              ) : videoPlaybackUrl ? (
                <video
                  src={videoPlaybackUrl}
                  controls
                  autoPlay
                  className="video-modal__video"
                  controlsList={canDownloadClips ? undefined : 'nodownload'}
                  disablePictureInPicture={!canDownloadClips}
                  onContextMenu={canDownloadClips ? undefined : (e) => e.preventDefault()}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {showEndorsementDialog && (
        <div
          className="endorse-dialog__overlay"
          onClick={() => !submittingEndorsement && setShowEndorsementDialog(false)}
          role="presentation"
        >
          <div className="endorse-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="endorse-dialog__accent" />
            <div className="endorse-dialog__header">
              <button
                type="button"
                className="endorse-dialog__close"
                onClick={() => setShowEndorsementDialog(false)}
                disabled={submittingEndorsement}
                aria-label="Close"
              >
                <X size={18} />
              </button>
              <div className="endorse-dialog__icon">
                <Award size={24} />
              </div>
              <h2 className="endorse-dialog__title">Endorse {profile.display_name}</h2>
              <p className="endorse-dialog__subtitle">Leave a public endorsement for this clipper</p>
            </div>
            <div className="endorse-dialog__content">
              <div className="endorse-dialog__field">
                <label className="endorse-dialog__label">Rating</label>
                <div className="endorse-dialog__stars">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button
                      key={i}
                      type="button"
                      className="endorse-dialog__star-btn"
                      onClick={() => setEndorsementRating(i)}
                      aria-label={`${i} stars`}
                    >
                      <Star
                        size={28}
                        fill={i <= endorsementRating ? 'currentColor' : 'none'}
                        className={
                          i <= endorsementRating ? 'endorse-dialog__star--filled' : 'endorse-dialog__star--empty'
                        }
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="endorse-dialog__field">
                <label className="endorse-dialog__label">
                  Endorsement <span className="endorse-dialog__optional">(optional)</span>
                </label>
                <textarea
                  className="endorse-dialog__textarea"
                  placeholder="Great clipper! Delivered high-quality content on time..."
                  rows={3}
                  maxLength={300}
                  value={endorsementContent}
                  onChange={(e) => setEndorsementContent(e.target.value)}
                />
                <p className="endorse-dialog__char-count">{endorsementContent.length}/300</p>
              </div>
              {endorsementError && (
                <div className="endorse-dialog__alert endorse-dialog__alert--error">
                  <p style={{ margin: 0, fontSize: '0.75rem' }}>{endorsementError}</p>
                </div>
              )}
            </div>
            <div className="endorse-dialog__footer">
              <button
                type="button"
                className="endorse-dialog__btn endorse-dialog__btn--secondary"
                onClick={() => setShowEndorsementDialog(false)}
                disabled={submittingEndorsement}
              >
                Cancel
              </button>
              <button
                type="button"
                className="endorse-dialog__btn endorse-dialog__btn--primary"
                onClick={submitEndorsement}
                disabled={submittingEndorsement || endorsementRating === 0 || !user?.owned_organization_id}
              >
                {submittingEndorsement ? <Loader2 size={16} className="endorse-dialog__spinner" /> : null}
                {submittingEndorsement ? 'Submitting...' : 'Submit endorsement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
