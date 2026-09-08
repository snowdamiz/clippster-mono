import { useCallback, useContext, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Award,
  Building2,
  CheckCircle,
  ExternalLink,
  Briefcase,
  Handshake,
  Instagram,
  Link,
  Link2,
  Loader2,
  Megaphone,
  Monitor,
  Music2,
  Play,
  Sparkles,
  Star,
  Twitch,
  Twitter,
  UserCircle,
  Video,
  X,
  Youtube,
  Eye,
  Users,
} from 'lucide-react'
import {
  createEndorsement,
  getClipperBySlug,
  getBadgeLabel,
  getBadgeModifier,
  getContentStyleTagLabel,
  getExperienceLevelLabel,
  getLanguageName,
  getPlatformLabel,
  getSpecialtyTagLabel,
  formatViews,
  type ClipperProfile,
} from '../services/clipperApi'
import { AuthContext } from '../context/AuthContext'
import { ToastContext } from '../context/ToastContext'
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
  const [selectedClip, setSelectedClip] = useState<{ id: number; title?: string; thumbnail_url?: string | null } | null>(null)
  const [videoPlaybackUrl, setVideoPlaybackUrl] = useState<string | null>(null)
  const [loadingVideo, setLoadingVideo] = useState(false)
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({})

  const [showEndorsementDialog, setShowEndorsementDialog] = useState(false)
  const [endorsementContent, setEndorsementContent] = useState('')
  const [endorsementRating, setEndorsementRating] = useState(0)
  const [submittingEndorsement, setSubmittingEndorsement] = useState(false)
  const [endorsementError, setEndorsementError] = useState('')

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
            data.profile.portfolio_clips.map(async clip => {
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
        rating: endorsementRating,
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

  const showBio = !!profile.bio?.trim()
  const showProfileLocaleCard = !!(
    profile.experience_level ||
    profile.timezone ||
    profile.response_time_hours != null ||
    (profile.languages?.length ?? 0) > 0
  )
  const statsFour = !!profile.total_views
  const displayName = profile.display_name || 'Unnamed Clipper'
  const profileDescription =
    profile.bio?.trim() ||
    `${displayName} is a clipper on Clippster. View campaigns, clips delivered, and specialties.`
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
          image: profile.avatar_url,
        })}
      />
      <div className="org-profile">
        {user?.owned_organization_id && (
          <div className="clipper-toolbar">
            <div className="profile-header-actions">
              <button type="button" className="profile-action-btn profile-action-btn--outline" onClick={openEndorsementDialog}>
                <Star className="profile-action-btn__icon" />
                Endorse
              </button>
            </div>
          </div>
        )}

        <div className="org-hero">
          <div className="org-hero__banner" />
          <div className="org-hero__content">
            <div className="org-hero__avatar">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="org-hero__avatar-img" />
              ) : (
                <UserCircle className="org-hero__avatar-fallback" />
              )}
              {profile.is_verified && (
                <div className="profile-avatar__verified">
                  <CheckCircle />
                </div>
              )}
            </div>
            <div className="org-hero__info">
              <div className="profile-name-row">
                <h1 className="org-hero__name">{profile.display_name || 'Unnamed Clipper'}</h1>
                <div className="profile-badges">
                  {profile.looking_for_work && (
                    <span className="status-badge status-badge--available">
                      <span className="status-badge__dot" />
                      Looking for Work
                    </span>
                  )}
                  {profile.is_affiliate && (
                    <span className="status-badge status-badge--affiliate">
                      <Handshake size={12} />
                      Affiliate
                    </span>
                  )}
                  {profile.badges?.map(badge => (
                    <span key={badge.id} className={`profile-badge-pill ${getBadgeModifier(badge.badge_type)}`}>
                      {getBadgeLabel(badge.badge_type)}
                    </span>
                  ))}
                </div>
              </div>
              {!!profile.specialty_tags?.length && (
                <div className="org-hero__tags">
                  {profile.specialty_tags.slice(0, 6).map(tag => (
                    <span key={tag} className="org-hero__tag">
                      {getSpecialtyTagLabel(tag)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={`org-stats-grid${statsFour ? ' org-stats-grid--four' : ''}`}>
          <div className="org-stat-card">
            <div className="org-stat-card__icon org-stat-card__icon--violet">
              <Megaphone size={18} />
            </div>
            <div className="org-stat-card__content">
              <span className="org-stat-card__value">{profile.total_campaigns_completed}</span>
              <span className="org-stat-card__label">Campaigns</span>
            </div>
          </div>
          <div className="org-stat-card">
            <div className="org-stat-card__icon org-stat-card__icon--cyan">
              <Video size={18} />
            </div>
            <div className="org-stat-card__content">
              <span className="org-stat-card__value">{profile.total_clips_delivered}</span>
              <span className="org-stat-card__label">Clips Delivered</span>
            </div>
          </div>
          <div className="org-stat-card">
            <div className="org-stat-card__icon org-stat-card__icon--amber">
              <Award size={18} />
            </div>
            <div className="org-stat-card__content">
              <span className="org-stat-card__value">{profile.total_endorsements}</span>
              <span className="org-stat-card__label">Endorsements</span>
            </div>
          </div>
          {statsFour && (
            <div className="org-stat-card">
              <div className="org-stat-card__icon org-stat-card__icon--green">
                <Eye size={18} />
              </div>
              <div className="org-stat-card__content">
                <span className="org-stat-card__value">{formatViews(profile.total_views!)}</span>
                <span className="org-stat-card__label">Total Views</span>
              </div>
            </div>
          )}
        </div>

        <div className="org-grid">
          <div className="org-main">
            {showBio && (
              <div className="org-card org-card--about">
                <div className="org-card__header">
                  <h2 className="org-card__title">About</h2>
                </div>
                <div className="org-card__body">
                  <p className="org-card__text">{profile.bio}</p>
                </div>
              </div>
            )}

            {!!profile.portfolio_clips?.length && (
              <div className="org-card">
                <div className="org-card__header">
                  <Video className="org-card__header-icon" />
                  <h2 className="org-card__title">Portfolio</h2>
                  <span className="org-card__count">{profile.portfolio_clips.length}</span>
                </div>
                <div className="org-card__body org-card__body--flush">
                  <div className="portfolio-grid">
                  {profile.portfolio_clips.map(clip => (
                    <div key={clip.id} className="portfolio-item">
                      <div className="portfolio-item__thumbnail">
                        {thumbnailUrls[clip.id] || clip.thumbnail_url ? (
                          <img
                            src={thumbnailUrls[clip.id] || clip.thumbnail_url || ''}
                            alt=""
                            className="portfolio-item__thumbnail-img"
                          />
                        ) : (
                          <div className="portfolio-item__thumbnail-placeholder">
                            <Video className="portfolio-item__thumbnail-icon" />
                          </div>
                        )}
                        <button type="button" className="portfolio-item__overlay" onClick={() => playClip(clip)}>
                          <div className="portfolio-item__play">
                            <Play className="portfolio-item__play-icon" />
                          </div>
                        </button>
                      </div>
                      <div className="portfolio-item__info">
                        <div className="portfolio-item__title">{clip.title || 'Untitled'}</div>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            )}

            {!!profile.endorsements?.length && (
              <div className="org-card">
                <div className="org-card__header">
                  <Award className="org-card__header-icon" />
                  <h2 className="org-card__title">Endorsements</h2>
                  <span className="org-card__count">{profile.endorsements.length}</span>
                </div>
                <div className="org-card__body org-card__body--flush">
                  <div className="endorsements-list">
                  {profile.endorsements.map(endorsement => (
                    <div key={endorsement.id} className="endorsement-card">
                      <div className="endorsement-card__header">
                        <div className="endorsement-card__org">
                          <div className="endorsement-card__org-logo">
                            <Building2 />
                          </div>
                          <div className="endorsement-card__org-info">
                            <div className="endorsement-card__org-name">
                              {endorsement.organization?.name || 'Organization'}
                            </div>
                            {endorsement.endorsed_by?.name && (
                              <div className="endorsement-card__org-by">by {endorsement.endorsed_by.name}</div>
                            )}
                          </div>
                        </div>
                        {endorsement.rating ? (
                          <div className="endorsement-card__rating">
                            {Array.from({ length: endorsement.rating }).map((_, i) => (
                              <Star key={i} className="endorsement-card__rating-star" />
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {endorsement.content && (
                        <p className="endorsement-card__content">&ldquo;{endorsement.content}&rdquo;</p>
                      )}
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="org-sidebar">
            {!!profile.content_style_tags?.length && (
              <div className="org-card org-card--compact">
                <div className="org-card__header">
                  <Sparkles className="org-card__header-icon" />
                  <h3 className="org-card__title">Content Style</h3>
                </div>
                <div className="org-card__body">
                  <div className="tag-list">
                    {profile.content_style_tags.map(tag => (
                      <span key={tag} className="tag tag--style">
                        {getContentStyleTagLabel(tag)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!!profile.social_accounts?.length && (
              <div className="org-card org-card--compact">
                <div className="org-card__header">
                  <Users className="org-card__header-icon" />
                  <h3 className="org-card__title">Connected Accounts</h3>
                </div>
                <div className="org-card__body">
                  <div className="connected-accounts-list">
                    {profile.social_accounts.map((account, idx) => {
                      const href = getAccountUrl(account)
                      return (
                        <a
                          key={idx}
                          href={href || undefined}
                          target={href ? '_blank' : undefined}
                          rel={href ? 'noopener noreferrer' : undefined}
                          className={`connected-account${href ? '' : ' connected-account--no-link'}`}
                          onClick={e => {
                            if (!href) e.preventDefault()
                          }}
                        >
                          <div className="connected-account__left">
                            {account.profile_image_url ? (
                              <img src={account.profile_image_url} alt="" className="connected-account__avatar" />
                            ) : (
                              <div className="connected-account__avatar-fallback">
                                <PlatformGlyph platform={account.platform} className="connected-account__avatar-icon" />
                              </div>
                            )}
                            <div className="connected-account__info">
                              <div className="connected-account__username">
                                {account.username ? `@${account.username.replace('@', '')}` : getPlatformLabel(account.platform)}
                                {account.is_verified && <CheckCircle className="connected-account__verified" />}
                              </div>
                              <div className="connected-account__platform">{getPlatformLabel(account.platform)}</div>
                            </div>
                          </div>
                          <div className="connected-account__right">
                            {href ? <ExternalLink className="connected-account__link-icon" /> : null}
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {!profile.social_accounts?.length && !!profile.preferred_platforms?.length && (
              <div className="org-card org-card--compact">
                <div className="org-card__header">
                  <Monitor className="org-card__header-icon" />
                  <h3 className="org-card__title">Platforms</h3>
                </div>
                <div className="org-card__body">
                  <div className="platform-list">
                    {profile.preferred_platforms.map(platform => (
                      <div key={platform} className="platform-item">
                        <PlatformGlyph platform={platform} className="platform-item__icon" />
                        <span className="platform-item__name">{getPlatformLabel(platform)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!!profile.channel_links?.length && (
              <div className="org-card org-card--compact">
                <div className="org-card__header">
                  <Link className="org-card__header-icon" />
                  <h3 className="org-card__title">Social Channels</h3>
                </div>
                <div className="org-card__body">
                  <div className="channel-list">
                    {profile.channel_links.map(link => (
                      <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="channel-item">
                        <PlatformGlyph platform={link.platform} className="channel-item__icon" />
                        <span className="channel-item__username">
                          {link.username || getPlatformLabel(link.platform)}
                        </span>
                        <ExternalLink className="channel-item__external" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {showProfileLocaleCard && (
              <div className="org-card org-card--compact">
                <div className="org-card__header">
                  <Briefcase className="org-card__header-icon" />
                  <h3 className="org-card__title">Professional</h3>
                </div>
                <div className="org-card__body">
                  <div className="clipper-profile-locale">
                    {profile.experience_level && (
                      <div className="clipper-profile-locale__row">
                        <span className="clipper-profile-locale__label">Experience</span>
                        <span className="clipper-profile-locale__value">{getExperienceLevelLabel(profile.experience_level)}</span>
                      </div>
                    )}
                    {profile.timezone && (
                      <div className="clipper-profile-locale__row">
                        <span className="clipper-profile-locale__label">Timezone</span>
                        <span className="clipper-profile-locale__value">{formatTimezoneForDisplay(profile.timezone)}</span>
                      </div>
                    )}
                    {profile.response_time_hours != null && (
                      <div className="clipper-profile-locale__row">
                        <span className="clipper-profile-locale__label">Response time</span>
                        <span className="clipper-profile-locale__value">~{profile.response_time_hours} hours</span>
                      </div>
                    )}
                    {profile.languages?.map((lang, i) => (
                      <div key={lang} className="clipper-profile-locale__row">
                        <span
                          className={
                            i === 0 ? 'clipper-profile-locale__label' : 'clipper-profile-locale__label clipper-profile-locale__label--continued'
                          }
                        >
                          {i === 0 ? 'Languages' : '\u00a0'}
                        </span>
                        <span className="clipper-profile-locale__value">{getLanguageName(lang)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {showVideoPlayer && selectedClip && (
        <div className="video-modal__overlay" onClick={closeVideoPlayer} role="presentation">
          <div className="video-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
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
                  onContextMenu={canDownloadClips ? undefined : e => e.preventDefault()}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      {showEndorsementDialog && (
        <div className="endorse-dialog__overlay" onClick={() => !submittingEndorsement && setShowEndorsementDialog(false)} role="presentation">
          <div className="endorse-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
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
                  {[1, 2, 3, 4, 5].map(i => (
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
                        className={i <= endorsementRating ? 'endorse-dialog__star--filled' : 'endorse-dialog__star--empty'}
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
                  onChange={e => setEndorsementContent(e.target.value)}
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
