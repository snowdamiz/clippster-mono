import { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import {
  UserCircle,
  CheckCircle,
  Star,
  MessageCircle,
  Video,
  Play,
  Loader2,
  Award,
  Building2,
  Sparkles,
  Globe,
  Share2,
  Handshake,
  Eye,
  Users,
  Megaphone,
  X,
} from 'lucide-react';
import { getClipperBySlug, type ClipperProfile } from '../services/clipperApi';
import { AuthContext } from '../context/AuthContext';
import { API_BASE } from '../lib/apiBase';

export function ClipperPublicProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const authContext = useContext(AuthContext);
  const user = authContext?.user || null;
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ClipperProfile | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [selectedClip, setSelectedClip] = useState<any>(null);
  const [videoPlaybackUrl, setVideoPlaybackUrl] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!slug) return;

    const loadProfile = async () => {
      setLoading(true);
      try {
        const data = await getClipperBySlug(slug);
        if (data.success && data.profile) {
          setProfile(data.profile);
          
          if (data.profile.portfolio_clips && data.profile.portfolio_clips.length > 0) {
            const thumbnails: Record<number, string> = {};
            await Promise.all(
              data.profile.portfolio_clips.map(async (clip) => {
                try {
                  const response = await fetch(`${API_BASE}/clippers/${slug}/portfolio-clips/${clip.id}/thumbnail-presigned-url`);
                  const thumbData = await response.json();
                  if (thumbData.success && thumbData.url) {
                    thumbnails[clip.id] = thumbData.url;
                  }
                } catch (error) {
                  console.error(`Failed to load thumbnail for clip ${clip.id}:`, error);
                }
              })
            );
            setThumbnailUrls(thumbnails);
          }
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [slug]);

  const copyProfileLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  const formatViews = (views: number): string => {
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
  };

  const getAccountUrl = (account: any): string | null => {
    if (account.profile_url) return account.profile_url;
    
    if (!account.username) return null;
    
    const username = account.username.replace('@', '');
    switch (account.platform.toLowerCase()) {
      case 'instagram':
        return `https://instagram.com/${username}`;
      case 'tiktok':
        return `https://tiktok.com/@${username}`;
      case 'twitter':
      case 'x':
        return `https://twitter.com/${username}`;
      case 'youtube':
        return `https://youtube.com/@${username}`;
      case 'twitch':
        return `https://twitch.tv/${username}`;
      case 'kick':
        return `https://kick.com/${username}`;
      default:
        return null;
    }
  };

  const playClip = async (clip: any) => {
    setSelectedClip(clip);
    setShowVideoPlayer(true);
    setLoadingVideo(true);
    
    try {
      const response = await fetch(`${API_BASE}/clippers/${slug}/portfolio-clips/${clip.id}/presigned-url`);
      const data = await response.json();
      if (data.success && data.url) {
        setVideoPlaybackUrl(data.url);
      }
    } catch (error) {
      console.error('Failed to load video:', error);
    } finally {
      setLoadingVideo(false);
    }
  };

  const closeVideoPlayer = () => {
    setShowVideoPlayer(false);
    setSelectedClip(null);
    setVideoPlaybackUrl(null);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 style={{ width: '40px', height: '40px', color: '#0ea5e9', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', background: '#141416', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <UserCircle style={{ width: '36px', height: '36px', color: '#71717a' }} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fafafa', margin: '0 0 8px' }}>Profile not found</h3>
          <p style={{ fontSize: '14px', color: '#71717a', margin: 0, maxWidth: '320px', lineHeight: 1.5 }}>This clipper profile doesn't exist or is private</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0b', width: '100%' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        {/* Profile Header Card */}
        <div style={{ position: 'relative', background: '#141416', border: '1px solid #1f1f23', borderRadius: '16px', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '120px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%)', opacity: 0.5 }} />
          
          <div style={{ position: 'relative', padding: '32px' }}>
            {/* Header Actions */}
            <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {user && (
                <>
                  <button
                    onClick={() => alert('Messaging coming soon!')}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '32px', padding: '0 14px', background: '#0ea5e9', color: '#0a0a0b', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 150ms' }}
                  >
                    <MessageCircle style={{ width: '14px', height: '14px' }} />
                    Message
                  </button>
                  <button 
                    onClick={() => alert('Endorsements coming soon!')}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '32px', padding: '0 14px', background: 'transparent', color: '#fafafa', border: '1px solid #1f1f23', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 150ms' }}
                  >
                    <Star style={{ width: '14px', height: '14px' }} />
                    Endorse
                  </button>
                </>
              )}
              <button
                onClick={copyProfileLink}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '32px', padding: '0 14px', background: 'transparent', color: '#fafafa', border: '1px solid #1f1f23', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 150ms' }}
              >
                <Share2 style={{ width: '14px', height: '14px' }} />
                Share
              </button>
            </div>

            {/* Profile Info */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px', marginBottom: '32px' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ position: 'relative', width: '96px', height: '96px', borderRadius: '20px', background: '#1f1f23', overflow: 'hidden', border: '3px solid #141416', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}>
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.display_name || 'Profile'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <UserCircle style={{ width: '48px', height: '48px', color: '#71717a' }} />
                    </div>
                  )}
                  {profile.is_verified && (
                    <div style={{ position: 'absolute', bottom: '-3px', right: '-3px', width: '28px', height: '28px', background: 'linear-gradient(135deg, #0ea5e9 0%, #0891b2 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #141416', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)' }}>
                      <CheckCircle style={{ width: '14px', height: '14px', color: 'white' }} />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#fafafa', margin: 0, letterSpacing: '-0.03em', lineHeight: 1.2 }}>{profile.display_name || 'Unnamed Clipper'}</h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {profile.looking_for_work && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', borderRadius: '6px' }}>
                        <span style={{ width: '6px', height: '6px', background: 'currentColor', borderRadius: '50%', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                        Looking for Work
                      </span>
                    )}
                    {profile.is_affiliate && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', borderRadius: '6px' }}>
                        <Handshake style={{ width: '12px', height: '12px' }} />
                        Affiliate
                      </span>
                    )}
                  </div>
                </div>

                {profile.bio && <p style={{ fontSize: '15px', color: '#71717a', margin: '0 0 14px', lineHeight: 1.6, maxWidth: '600px' }}>{profile.bio}</p>}

                {profile.specialty_tags && profile.specialty_tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {profile.specialty_tags.slice(0, 6).map((tag) => (
                      <span key={tag} style={{ padding: '6px 10px', background: 'rgba(59, 130, 246, 0.12)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: '#3b82f6', transition: 'all 150ms' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid #1f1f23', borderRadius: '12px', transition: 'all 200ms' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%)', flexShrink: 0 }}>
                  <Megaphone style={{ width: '22px', height: '22px', color: '#3b82f6' }} />
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#fafafa', letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{profile.total_campaigns_completed || 0}</div>
                  <div style={{ fontSize: '12px', color: '#71717a', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Campaigns</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid #1f1f23', borderRadius: '12px', transition: 'all 200ms' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%)', flexShrink: 0 }}>
                  <Video style={{ width: '22px', height: '22px', color: '#3b82f6' }} />
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#fafafa', letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{profile.total_clips_delivered || 0}</div>
                  <div style={{ fontSize: '12px', color: '#71717a', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Clips Delivered</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid #1f1f23', borderRadius: '12px', transition: 'all 200ms' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(251, 191, 36, 0.2) 100%)', flexShrink: 0 }}>
                  <Award style={{ width: '22px', height: '22px', color: '#fbbf24' }} />
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#fafafa', letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{profile.total_endorsements || 0}</div>
                  <div style={{ fontSize: '12px', color: '#71717a', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Endorsements</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid #1f1f23', borderRadius: '12px', transition: 'all 200ms' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%)', flexShrink: 0 }}>
                  <Eye style={{ width: '22px', height: '22px', color: '#10b981' }} />
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#fafafa', letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{formatViews(profile.total_views || 0)}</div>
                  <div style={{ fontSize: '12px', color: '#71717a', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Total Views</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '32px', alignItems: 'start', padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
          {/* Main Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Portfolio Section */}
            {profile.portfolio_clips && profile.portfolio_clips.length > 0 && (
              <div style={{ background: '#141416', border: '1px solid #1f1f23', borderRadius: '12px', padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', borderBottom: '1px solid #1f1f23', background: 'linear-gradient(to bottom, rgba(6, 182, 212, 0.03), transparent)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', flexShrink: 0 }}>
                    <Video style={{ width: '22px', height: '22px' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fafafa', margin: 0, letterSpacing: '-0.01em' }}>Portfolio</h2>
                    <p style={{ fontSize: '14px', color: '#71717a', margin: '2px 0 0' }}>{profile.portfolio_clips.length} clips</p>
                  </div>
                </div>
                <div style={{ padding: '24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    {profile.portfolio_clips.map((clip) => (
                      <div
                        key={clip.id}
                        onClick={() => playClip(clip)}
                        style={{ position: 'relative', aspectRatio: '16/9', background: '#1f1f23', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer' }}
                      >
                        {thumbnailUrls[clip.id] ? (
                          <img src={thumbnailUrls[clip.id]} alt={clip.title || 'Portfolio clip'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Video style={{ width: '32px', height: '32px', color: '#71717a' }} />
                          </div>
                        )}
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.5)', opacity: 0, transition: 'opacity 150ms', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="hover-overlay">
                          <Play style={{ width: '48px', height: '48px', color: 'white' }} />
                        </div>
                        {clip.title && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)', padding: '12px' }}>
                            <p style={{ fontSize: '14px', color: 'white', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clip.title}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Endorsements Section */}
            {profile.endorsements && profile.endorsements.length > 0 && (
              <div style={{ background: '#141416', border: '1px solid #1f1f23', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', borderBottom: '1px solid #1f1f23', background: 'linear-gradient(to bottom, rgba(6, 182, 212, 0.03), transparent)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
                    <Award style={{ width: '22px', height: '22px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#fafafa', margin: 0 }}>Endorsements</h2>
                    <p style={{ fontSize: '14px', color: '#71717a', margin: '2px 0 0' }}>{profile.endorsements.length} reviews</p>
                  </div>
                </div>
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {profile.endorsements.map((endorsement) => (
                    <div key={endorsement.id} style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', padding: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Building2 style={{ width: '16px', height: '16px', color: '#71717a' }} />
                          <span style={{ color: '#fafafa', fontWeight: 500 }}>{endorsement.organization?.name || 'Organization'}</span>
                        </div>
                        {endorsement.rating && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {Array.from({ length: endorsement.rating }).map((_, i) => (
                              <Star key={i} style={{ width: '16px', height: '16px', color: '#fbbf24', fill: '#fbbf24' }} />
                            ))}
                          </div>
                        )}
                      </div>
                      {endorsement.content && <p style={{ color: '#71717a', fontStyle: 'italic', margin: 0 }}>"{endorsement.content}"</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Content Style */}
            {profile.content_style_tags && profile.content_style_tags.length > 0 && (
              <div style={{ background: '#141416', border: '1px solid #1f1f23', borderRadius: '12px', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Sparkles style={{ width: '20px', height: '20px', color: '#06b6d4' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fafafa', margin: 0 }}>Content Style</h3>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {profile.content_style_tags.map((tag) => (
                    <span key={tag} style={{ padding: '6px 12px', background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', fontSize: '13px', fontWeight: 600, borderRadius: '9999px', border: '1px solid rgba(14, 165, 233, 0.25)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Connected Accounts */}
            {profile.social_accounts && profile.social_accounts.length > 0 && (
              <div style={{ background: '#141416', border: '1px solid #1f1f23', borderRadius: '12px', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Users style={{ width: '20px', height: '20px', color: '#06b6d4' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fafafa', margin: 0 }}>Connected Accounts</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {profile.social_accounts.map((account, idx) => {
                    const accountUrl = getAccountUrl(account);
                    return (
                      <a
                        key={idx}
                        href={accountUrl || undefined}
                        target={accountUrl ? "_blank" : undefined}
                        rel={accountUrl ? "noopener noreferrer" : undefined}
                        onClick={(e) => {
                          if (!accountUrl) {
                            e.preventDefault();
                          }
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', textDecoration: 'none', transition: 'background 150ms', cursor: accountUrl ? 'pointer' : 'default', opacity: accountUrl ? 1 : 0.6 }}
                      >
                      {account.profile_image_url ? (
                        <img src={account.profile_image_url} alt={account.username} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                      ) : (
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#1f1f23', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <UserCircle style={{ width: '24px', height: '24px', color: '#71717a' }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ color: '#fafafa', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{account.username}</span>
                          {account.is_verified && <CheckCircle style={{ width: '16px', height: '16px', color: '#06b6d4', flexShrink: 0 }} />}
                        </div>
                        <div style={{ fontSize: '14px', color: '#71717a' }}>{account.platform}</div>
                      </div>
                    </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Languages */}
            {profile.languages && profile.languages.length > 0 && (
              <div style={{ background: '#141416', border: '1px solid #1f1f23', borderRadius: '12px', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Globe style={{ width: '20px', height: '20px', color: '#06b6d4' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fafafa', margin: 0 }}>Languages</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {profile.languages.map((lang) => (
                    <div key={lang} style={{ color: '#71717a' }}>{lang}</div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Video Player Modal */}
      {showVideoPlayer && selectedClip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }} onClick={closeVideoPlayer}>
          <div style={{ background: '#141416', borderRadius: '12px', maxWidth: '1280px', width: '100%', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #1f1f23' }}>
              <span style={{ color: '#fafafa', fontWeight: 500 }}>{selectedClip.title || 'Untitled'}</span>
              <button onClick={closeVideoPlayer} style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>
            <div style={{ position: 'relative', background: 'black', aspectRatio: '16/9' }}>
              {loadingVideo ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 style={{ width: '32px', height: '32px', color: '#0ea5e9', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : videoPlaybackUrl ? (
                <video
                  src={videoPlaybackUrl}
                  controls
                  autoPlay
                  controlsList="nodownload"
                  disablePictureInPicture
                  onContextMenu={(e) => e.preventDefault()}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .hover-overlay:hover {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
