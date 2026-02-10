import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/hooks/useToast'
import {
  listClippers, getLeaderboard,
  type ClipperProfile, type LeaderboardEntry, type DirectoryFilters,
  EXPERIENCE_LEVELS, SPECIALTY_TAGS, CONTENT_STYLE_TAGS, PREFERRED_PLATFORMS, LANGUAGES,
  getExperienceLevelLabel, getSpecialtyTagLabel, getLanguageName, getLanguageFlag,
  formatResponseTime, formatViews,
} from '@/services/clipperApi'
import { listOrganizationCampaigns } from '@/services/campaignApi'
import type { Campaign } from '@/types/organization'
import {
  Scissors, Users, Trophy, CheckCircle, ChevronDown, X, Check, Clock, Star,
  Video, MessageCircle, Send, Briefcase, Play, User, Loader2, Eye
} from 'lucide-react'

function getPlatformIconClass(platform: string) {
  return { tiktok: 'cl-platform-icon--tiktok', instagram: 'cl-platform-icon--instagram', youtube: 'cl-platform-icon--youtube', x: 'cl-platform-icon--x', facebook: 'cl-platform-icon--facebook', snapchat: 'cl-platform-icon--snapchat' }[platform] || ''
}
function getPlatformLetter(platform: string) {
  return { tiktok: 'T', instagram: 'I', youtube: 'Y', x: 'X', facebook: 'F', snapchat: 'S' }[platform] || platform.charAt(0).toUpperCase()
}

export function OrgClippers() {
  const { organizationId } = useOrganization()
  const toast = useToast()

  // View toggle
  const [activeView, setActiveView] = useState<'directory' | 'leaderboard'>('directory')

  // Directory state
  const [clippers, setClippers] = useState<ClipperProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<DirectoryFilters>({})

  // Leaderboard state
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([])
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true)
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'weekly' | 'monthly'>('weekly')

  // Filter dropdowns
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const filterBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // Campaign invite dialog
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [selectedClipperForInvite, setSelectedClipperForInvite] = useState<ClipperProfile | null>(null)
  const [organizationCampaigns, setOrganizationCampaigns] = useState<Campaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null)
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)

  const loadClippers = useCallback(async (currentFilters?: DirectoryFilters) => {
    setLoading(true)
    try {
      const f = currentFilters || filters
      const result = await listClippers(f)
      if (result.success) setClippers(result.profiles || [])
    } finally { setLoading(false) }
  }, [filters])

  const loadLeaderboard = useCallback(async (period?: 'weekly' | 'monthly') => {
    setLoadingLeaderboard(true)
    try {
      const result = await getLeaderboard(period || leaderboardPeriod)
      if (result.success) {
        setLeaderboardEntries((result.entries || []).map((e: any, i: number) => ({ ...e, total_views: e.total_views || 0, rank: i + 1 })))
      }
    } finally { setLoadingLeaderboard(false) }
  }, [leaderboardPeriod])

  useEffect(() => { loadClippers() }, [])
  useEffect(() => { loadLeaderboard() }, [])

  // Close filter dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (openFilter) {
        const btn = filterBtnRefs.current.get(openFilter)
        if (btn && btn.contains(e.target as Node)) return
        setOpenFilter(null)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openFilter])

  function getFilterDropdownPosition(key: string): React.CSSProperties {
    const btn = filterBtnRefs.current.get(key)
    if (!btn) return { top: 0, left: 0 }
    const rect = btn.getBoundingClientRect()
    const pad = 4
    let top = rect.bottom + pad
    let left = rect.left
    if (top + 320 > window.innerHeight - pad) top = rect.top - 320 - pad
    if (left + 200 > window.innerWidth - pad) left = window.innerWidth - 200 - pad
    return { top, left }
  }

  function updateFilters(patch: Partial<DirectoryFilters>) {
    const next = { ...filters, ...patch }
    setFilters(next)
    loadClippers(next)
  }
  function toggleArrayFilter(field: 'specialty_tags' | 'content_style_tags' | 'preferred_platforms' | 'languages', value: string) {
    const arr = filters[field] || []
    const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
    updateFilters({ [field]: next })
  }
  function clearFilters() {
    const empty: DirectoryFilters = {}
    setFilters(empty)
    loadClippers(empty)
  }

  const hasActiveFilters = useMemo(() => {
    return !!(filters.looking_for_work || filters.verified_only || (filters.experience_level && filters.experience_level !== 'any') || (filters.specialty_tags?.length) || (filters.content_style_tags?.length) || (filters.preferred_platforms?.length) || (filters.languages?.length))
  }, [filters])

  // Filter label helpers
  function getExperienceFilterLabel() {
    if (!filters.experience_level || filters.experience_level === 'any') return 'Any Experience'
    return EXPERIENCE_LEVELS.find(l => l.value === filters.experience_level)?.label || 'Any Experience'
  }
  function getSpecialtiesFilterLabel() {
    if (!filters.specialty_tags?.length) return 'All Specialties'
    if (filters.specialty_tags.length === 1) return SPECIALTY_TAGS.find(t => t.value === filters.specialty_tags![0])?.label || 'Specialties'
    return `${filters.specialty_tags.length} Specialties`
  }
  function getContentStyleFilterLabel() {
    if (!filters.content_style_tags?.length) return 'All Styles'
    if (filters.content_style_tags.length === 1) return CONTENT_STYLE_TAGS.find(t => t.value === filters.content_style_tags![0])?.label || 'Content Style'
    return `${filters.content_style_tags.length} Styles`
  }
  function getPlatformsFilterLabel() {
    if (!filters.preferred_platforms?.length) return 'All Platforms'
    if (filters.preferred_platforms.length === 1) return PREFERRED_PLATFORMS.find(p => p.value === filters.preferred_platforms![0])?.label || 'Platforms'
    return `${filters.preferred_platforms.length} Platforms`
  }
  function getLanguagesFilterLabel() {
    if (!filters.languages?.length) return 'All Languages'
    if (filters.languages.length === 1) return LANGUAGES.find(l => l.code === filters.languages![0])?.name || 'Languages'
    return `${filters.languages.length} Languages`
  }

  function switchLeaderboardPeriod(period: 'weekly' | 'monthly') {
    if (period !== leaderboardPeriod) {
      setLeaderboardPeriod(period)
      loadLeaderboard(period)
    }
  }

  // Campaign invite
  async function openInviteDialog(clipper: ClipperProfile) {
    setSelectedClipperForInvite(clipper)
    setSelectedCampaignId(null)
    setShowInviteDialog(true)
    if (organizationId) {
      setLoadingCampaigns(true)
      try {
        const result = await listOrganizationCampaigns(Number(organizationId), 'active')
        if (result.success) setOrganizationCampaigns(result.campaigns || [])
      } finally { setLoadingCampaigns(false) }
    }
  }
  function sendCampaignInvite() {
    if (!selectedClipperForInvite || !selectedCampaignId) return
    const campaign = organizationCampaigns.find(c => c.id === selectedCampaignId)
    toast.success(`Invitation sent to ${selectedClipperForInvite.display_name} for "${campaign?.title}"`)
    setShowInviteDialog(false)
  }

  // Render filter dropdown
  function renderFilterDropdown(key: string, items: { value: string; label?: string; name?: string; code?: string }[], field: 'specialty_tags' | 'content_style_tags' | 'preferred_platforms' | 'languages') {
    if (openFilter !== key) return null
    const selectedArr = filters[field] || []
    return createPortal(
      <div className="cl-filter-dropdown" style={getFilterDropdownPosition(key)} onClick={e => e.stopPropagation()}>
        {items.map(item => {
          const val = 'code' in item ? item.code! : item.value!
          const label = item.label || item.name || val
          const isSelected = selectedArr.includes(val)
          return (
            <button key={val} className={`cl-filter-dropdown__item ${isSelected ? 'cl-filter-dropdown__item--active' : ''}`} onClick={() => toggleArrayFilter(field, val)}>
              <span className={`cl-filter-dropdown__check ${isSelected ? 'cl-filter-dropdown__check--active' : ''}`}>{isSelected && <Check className="w-[10px] h-[10px] text-white" />}</span>
              {label}
            </button>
          )
        })}
      </div>, document.body
    )
  }

  function renderExperienceDropdown() {
    if (openFilter !== 'experience') return null
    return createPortal(
      <div className="cl-filter-dropdown" style={getFilterDropdownPosition('experience')} onClick={e => e.stopPropagation()}>
        <button className={`cl-filter-dropdown__item ${(!filters.experience_level || filters.experience_level === 'any') ? 'cl-filter-dropdown__item--active' : ''}`} onClick={() => { updateFilters({ experience_level: 'any' }); setOpenFilter(null) }}>Any Experience</button>
        <div className="cl-filter-dropdown__divider" />
        {EXPERIENCE_LEVELS.map(level => (
          <button key={level.value} className={`cl-filter-dropdown__item ${filters.experience_level === level.value ? 'cl-filter-dropdown__item--active' : ''}`} onClick={() => { updateFilters({ experience_level: level.value }); setOpenFilter(null) }}>{level.label}</button>
        ))}
      </div>, document.body
    )
  }

  if (loading && activeView === 'directory') {
    return <PageLayout icon={Scissors} title="Clippers"><div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}</div></PageLayout>
  }

  return (
    <PageLayout icon={Scissors} title="Clippers" description="Discover and recruit talented clippers" actions={
      <div className="cl-view-toggle">
        <button onClick={() => setActiveView('directory')} className={`cl-view-toggle__btn ${activeView === 'directory' ? 'cl-view-toggle__btn--active' : ''}`}><Users className="w-3.5 h-3.5" />Directory</button>
        <button onClick={() => setActiveView('leaderboard')} className={`cl-view-toggle__btn ${activeView === 'leaderboard' ? 'cl-view-toggle__btn--active' : ''}`}><Trophy className="w-3.5 h-3.5" />Leaderboard</button>
      </div>
    }>
      <div className="cl">
        <div className="cl-heading">
          <h1 className="cl-heading__title">{activeView === 'leaderboard' ? 'Top Clippers' : 'Clipper Directory'}</h1>
          <p className="cl-heading__subtitle">{activeView === 'leaderboard' ? 'See top performing clippers ranked by clips delivered and engagement' : 'Browse and connect with talented clippers for your campaigns'}</p>
        </div>

        {/* ===== Leaderboard View ===== */}
        {activeView === 'leaderboard' && (
          <>
            <div className="cl-toolbar">
              <div className="cl-period-toggle">
                <button onClick={() => switchLeaderboardPeriod('weekly')} className={`cl-period-toggle__btn ${leaderboardPeriod === 'weekly' ? 'cl-period-toggle__btn--active' : ''}`}>Weekly</button>
                <button onClick={() => switchLeaderboardPeriod('monthly')} className={`cl-period-toggle__btn ${leaderboardPeriod === 'monthly' ? 'cl-period-toggle__btn--active' : ''}`}>Monthly</button>
              </div>
            </div>

            {loadingLeaderboard ? (
              <div className="cl-leaderboard-list">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
            ) : leaderboardEntries.length === 0 ? (
              <div className="oc-empty">
                <div className="oc-empty__icon-wrapper"><Trophy className="w-7 h-7 text-cyan-400" /></div>
                <h3 className="oc-empty__title">No leaderboard data yet</h3>
                <p className="oc-empty__text">Clipper rankings will appear here once data is available</p>
              </div>
            ) : (
              <div className="cl-leaderboard-list">
                {leaderboardEntries.map((entry, index) => (
                  <div key={entry.id} className={`cl-leaderboard-card ${index === 0 ? 'cl-leaderboard-card--gold' : index === 1 ? 'cl-leaderboard-card--silver' : index === 2 ? 'cl-leaderboard-card--bronze' : ''}`}>
                    <div className={`cl-leaderboard-card__indicator ${index === 0 ? 'cl-leaderboard-card__indicator--gold' : index === 1 ? 'cl-leaderboard-card__indicator--silver' : index === 2 ? 'cl-leaderboard-card__indicator--bronze' : ''}`} />
                    <div className="cl-leaderboard-card__content">
                      <div className={`cl-leaderboard-card__rank ${index === 0 ? 'cl-leaderboard-card__rank--gold' : index === 1 ? 'cl-leaderboard-card__rank--silver' : index === 2 ? 'cl-leaderboard-card__rank--bronze' : ''}`}>{index + 1}</div>
                      <div className="cl-leaderboard-card__avatar">
                        {entry.clipper_profile?.avatar_url ? <img src={entry.clipper_profile.avatar_url} className="cl-leaderboard-card__avatar-img" /> : <User className="w-6 h-6 text-zinc-500" />}
                      </div>
                      <div className="cl-leaderboard-card__info">
                        <div className="cl-leaderboard-card__name">{entry.clipper_profile?.display_name || 'Anonymous Clipper'}{entry.clipper_profile?.is_verified && <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}</div>
                        <div className="cl-leaderboard-card__meta">{entry.clips_delivered} clips delivered</div>
                      </div>
                      <div className="cl-leaderboard-card__stats">
                        <span className="cl-leaderboard-card__value">{formatViews(entry.total_views || 0)}</span>
                        <span className="cl-leaderboard-card__label">views</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ===== Directory View ===== */}
        {activeView === 'directory' && (
          <>
            {/* Filters Toolbar */}
            <div className="cl-toolbar">
              <label className="cl-filter-toggle">
                <input type="checkbox" className="cl-filter-toggle__input" checked={!!filters.looking_for_work} onChange={e => updateFilters({ looking_for_work: e.target.checked || undefined })} />
                <span className="cl-filter-toggle__switch"><span className="cl-filter-toggle__handle" /></span>
                <span className="cl-filter-toggle__label">Available for work</span>
              </label>
              <label className="cl-filter-toggle">
                <input type="checkbox" className="cl-filter-toggle__input" checked={!!filters.verified_only} onChange={e => updateFilters({ verified_only: e.target.checked || undefined })} />
                <span className="cl-filter-toggle__switch"><span className="cl-filter-toggle__handle" /></span>
                <span className="cl-filter-toggle__label">Verified only</span>
              </label>

              {/* Experience Level */}
              <button ref={el => { if (el) filterBtnRefs.current.set('experience', el); else filterBtnRefs.current.delete('experience') }} className={`cl-filter-btn ${openFilter === 'experience' ? 'cl-filter-btn--open' : ''}`} onClick={e => { e.stopPropagation(); setOpenFilter(openFilter === 'experience' ? null : 'experience') }}>
                <span>{getExperienceFilterLabel()}</span><ChevronDown className={`cl-filter-btn__chevron ${openFilter === 'experience' ? 'cl-filter-btn__chevron--open' : ''}`} />
              </button>
              {renderExperienceDropdown()}

              {/* Specialties */}
              <button ref={el => { if (el) filterBtnRefs.current.set('specialties', el); else filterBtnRefs.current.delete('specialties') }} className={`cl-filter-btn cl-filter-btn--wide ${openFilter === 'specialties' ? 'cl-filter-btn--open' : ''}`} onClick={e => { e.stopPropagation(); setOpenFilter(openFilter === 'specialties' ? null : 'specialties') }}>
                <span>{getSpecialtiesFilterLabel()}</span><ChevronDown className={`cl-filter-btn__chevron ${openFilter === 'specialties' ? 'cl-filter-btn__chevron--open' : ''}`} />
              </button>
              {renderFilterDropdown('specialties', SPECIALTY_TAGS, 'specialty_tags')}

              {/* Content Style */}
              <button ref={el => { if (el) filterBtnRefs.current.set('content_style', el); else filterBtnRefs.current.delete('content_style') }} className={`cl-filter-btn cl-filter-btn--wide ${openFilter === 'content_style' ? 'cl-filter-btn--open' : ''}`} onClick={e => { e.stopPropagation(); setOpenFilter(openFilter === 'content_style' ? null : 'content_style') }}>
                <span>{getContentStyleFilterLabel()}</span><ChevronDown className={`cl-filter-btn__chevron ${openFilter === 'content_style' ? 'cl-filter-btn__chevron--open' : ''}`} />
              </button>
              {renderFilterDropdown('content_style', CONTENT_STYLE_TAGS, 'content_style_tags')}

              {/* Platforms */}
              <button ref={el => { if (el) filterBtnRefs.current.set('platforms', el); else filterBtnRefs.current.delete('platforms') }} className={`cl-filter-btn ${openFilter === 'platforms' ? 'cl-filter-btn--open' : ''}`} onClick={e => { e.stopPropagation(); setOpenFilter(openFilter === 'platforms' ? null : 'platforms') }}>
                <span>{getPlatformsFilterLabel()}</span><ChevronDown className={`cl-filter-btn__chevron ${openFilter === 'platforms' ? 'cl-filter-btn__chevron--open' : ''}`} />
              </button>
              {renderFilterDropdown('platforms', PREFERRED_PLATFORMS, 'preferred_platforms')}

              {/* Languages */}
              <button ref={el => { if (el) filterBtnRefs.current.set('languages', el); else filterBtnRefs.current.delete('languages') }} className={`cl-filter-btn ${openFilter === 'languages' ? 'cl-filter-btn--open' : ''}`} onClick={e => { e.stopPropagation(); setOpenFilter(openFilter === 'languages' ? null : 'languages') }}>
                <span>{getLanguagesFilterLabel()}</span><ChevronDown className={`cl-filter-btn__chevron ${openFilter === 'languages' ? 'cl-filter-btn__chevron--open' : ''}`} />
              </button>
              {renderFilterDropdown('languages', LANGUAGES as any, 'languages')}

              <div className="cl-toolbar__spacer" />
              <button className="cl-clear-btn" onClick={clearFilters} disabled={!hasActiveFilters}><X className="w-3 h-3" />Clear</button>
            </div>

            {/* Clippers Grid */}
            {loading ? (
              <div className="cl-grid">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>
            ) : clippers.length === 0 ? (
              <div className="oc-empty">
                <div className="oc-empty__icon-wrapper"><Users className="w-7 h-7 text-cyan-400" /></div>
                <h3 className="oc-empty__title">No clippers found</h3>
                <p className="oc-empty__text">Try adjusting your filters to find more clippers</p>
              </div>
            ) : (
              <div className="cl-grid">
                {clippers.map(clipper => (
                  <div key={clipper.id} className="cl-card">
                    {/* Status Bar */}
                    <div className="cl-card__status-bar">
                      <div className={`cl-card__availability ${clipper.looking_for_work ? 'cl-card__availability--available' : ''}`}>
                        {clipper.looking_for_work ? <CheckCircle className="w-3 h-3" /> : <Briefcase className="w-3 h-3" />}
                        {clipper.looking_for_work ? 'Available' : 'Busy'}
                      </div>
                      {clipper.response_time_hours != null && (
                        <div className="cl-card__response-time"><Clock className="w-[11px] h-[11px]" />{formatResponseTime(clipper.response_time_hours)}</div>
                      )}
                    </div>

                    {/* Main Content */}
                    <div className="cl-card__main">
                      {/* Header */}
                      <div className="cl-card__header">
                        <div className="cl-card__avatar">
                          {clipper.avatar_url ? <img src={clipper.avatar_url} className="cl-card__avatar-img" /> : <div className="cl-card__avatar-fallback"><User className="w-[26px] h-[26px] text-zinc-500 opacity-60" /></div>}
                        </div>
                        <div className="cl-card__info">
                          <div className="cl-card__name">
                            {clipper.display_name || 'Unnamed'}
                            {clipper.is_verified && <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
                          </div>
                          {clipper.experience_level && <div className="cl-card__level">{getExperienceLevelLabel(clipper.experience_level)}</div>}
                          <p className={`cl-card__bio ${!clipper.bio ? 'cl-card__bio--empty' : ''}`}>{clipper.bio || 'No bio provided'}</p>
                        </div>
                        {/* Platform Icons */}
                        {clipper.preferred_platforms?.length > 0 && (
                          <div className="cl-card__platforms">
                            {clipper.preferred_platforms.slice(0, 5).map(p => (
                              <span key={p} className={`cl-platform-icon ${getPlatformIconClass(p)}`} title={p}>{getPlatformLetter(p)}</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Stats Row */}
                      <div className="cl-card__stats-row">
                        <div className="cl-card__stat"><Video className="w-[13px] h-[13px] text-zinc-500 opacity-70" /><span className="cl-card__stat-value">{clipper.total_clips_delivered || 0}</span><span className="cl-card__stat-label">clips</span></div>
                        <div className="cl-card__stat"><Star className="w-[13px] h-[13px] text-amber-500" /><span className="cl-card__stat-value">{clipper.total_endorsements || 0}</span><span className="cl-card__stat-label">reviews</span></div>
                        <div className="cl-card__stat"><Trophy className="w-[13px] h-[13px] text-cyan-400" /><span className="cl-card__stat-value">{clipper.total_campaigns_completed || 0}</span><span className="cl-card__stat-label">campaigns</span></div>
                      </div>

                      {/* Portfolio Preview */}
                      {clipper.portfolio_clips && clipper.portfolio_clips.length > 0 && (
                        <div className="cl-card__portfolio">
                          {clipper.portfolio_clips.slice(0, 2).map(clip => (
                            <div key={clip.id} className="cl-card__portfolio-thumb">
                              {clip.thumbnail_url ? <img src={clip.thumbnail_url} className="cl-card__portfolio-img" /> : <div className="cl-card__portfolio-placeholder"><Play className="w-4 h-4 text-zinc-500 opacity-50" /></div>}
                            </div>
                          ))}
                          {clipper.portfolio_clips.length > 2 && <span className="cl-card__portfolio-more">+{clipper.portfolio_clips.length - 2} more</span>}
                        </div>
                      )}

                      {/* Tags + Languages */}
                      <div className="cl-card__tags-row">
                        <div className="cl-card__tags">
                          {clipper.specialty_tags?.slice(0, 2).map(tag => <span key={tag} className="cl-card__tag">{getSpecialtyTagLabel(tag)}</span>)}
                          {clipper.specialty_tags?.length > 2 && <span className="cl-card__tag-more">+{clipper.specialty_tags.length - 2}</span>}
                        </div>
                        {clipper.languages?.length > 0 && (
                          <div className="cl-card__languages">
                            {clipper.languages.slice(0, 3).map(lang => <span key={lang} className="cl-card__lang-badge" title={getLanguageName(lang)}>{getLanguageFlag(lang)}</span>)}
                            {clipper.languages.length > 3 && <span className="cl-card__lang-more">+{clipper.languages.length - 3}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="cl-card__actions">
                      <a href={`/dashboard/org/${organizationId}/messages?to=${clipper.user_id}`} className="cl-card__action-btn cl-card__action-btn--message" style={{ textDecoration: 'none' }}><MessageCircle className="w-3.5 h-3.5" />Message</a>
                      <button className="cl-card__action-btn cl-card__action-btn--invite" onClick={() => openInviteDialog(clipper)}><Send className="w-3.5 h-3.5" />Invite</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== Campaign Invite Dialog ===== */}
      {showInviteDialog && createPortal(
        <div className="om-dialog__overlay" onClick={e => { if (e.target === e.currentTarget) setShowInviteDialog(false) }}>
          <div className="om-dialog om-dialog--cyan" style={{ maxWidth: 420 }}>
            <div className="om-dialog__accent om-dialog__accent--cyan" />
            <div className="om-dialog__header">
              <button className="om-dialog__close" onClick={() => setShowInviteDialog(false)}><X size={18} /></button>
              <div className="om-dialog__icon om-dialog__icon--cyan"><Send size={24} /></div>
              <h2 className="om-dialog__title">Invite to Campaign</h2>
              <p className="om-dialog__subtitle">Select a campaign to invite {selectedClipperForInvite?.display_name} to</p>
            </div>
            <div className="om-dialog__content">
              {loadingCampaigns ? (
                <div className="oc-dialog__loading"><div className="oc-dialog__loading-spinner" /><span>Loading campaigns...</span></div>
              ) : organizationCampaigns.length === 0 ? (
                <div className="cl-invite__no-campaigns">
                  <p>No active campaigns available.</p>
                  <p className="cl-invite__hint">Create a campaign first to invite clippers.</p>
                </div>
              ) : (
                <div className="cl-invite__campaign-list">
                  {organizationCampaigns.map(campaign => (
                    <button key={campaign.id} className={`cl-invite__campaign-option ${selectedCampaignId === campaign.id ? 'cl-invite__campaign-option--selected' : ''}`} onClick={() => setSelectedCampaignId(campaign.id)}>
                      <div className="cl-invite__campaign-info">
                        <span className="cl-invite__campaign-title">{campaign.title}</span>
                        <span className="cl-invite__campaign-meta">{campaign.participants_count || 0} participants</span>
                      </div>
                      {selectedCampaignId === campaign.id && <CheckCircle className="w-[18px] h-[18px] text-cyan-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="om-dialog__footer">
              <button className="om-dialog__btn om-dialog__btn--secondary" onClick={() => setShowInviteDialog(false)}>Cancel</button>
              <button className="om-dialog__btn om-dialog__btn--primary" disabled={!selectedCampaignId || organizationCampaigns.length === 0} onClick={sendCampaignInvite}><Send className="w-4 h-4" />Send Invite</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </PageLayout>
  )
}
