import { useEffect, useState, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { formatRelativeTime } from '@/utils/dateTimeUtils'
import { Skeleton } from '@/components/ui/Skeleton'
import { ProfileDialog } from '@/components/organization/ProfileDialog'
import { deleteOrganizationCreatorProfile, assignProfile, unassignProfile, toggleCreatorProfileDisabled } from '@/services/organizationApi'
import { useToast } from '@/hooks/useToast'
import type { ServerOrganizationCreatorProfile } from '@/types/organization'
import {
  UserCircle,
  Plus,
  Users,
  Pencil,
  Trash2,
  Link2,
  MoreVertical,
  Layers,
  X,
  Loader2,
  Play,
  SkipForward,
  Image as ImageIcon,
  Check,
  User,
  Paintbrush,
  Eye,
  EyeOff
} from 'lucide-react'

function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    pumpfun: '/capsule.svg',
    kick: '/kick.svg',
    twitch: '/twitch.svg',
    youtube: '/youtube.svg'
  }
  return icons[platform] || '/capsule.svg'
}

function getPlatformFilter(platform: string): string {
  const filters: Record<string, string> = {
    pumpfun:
      'brightness(0) saturate(100%) invert(67%) sepia(52%) saturate(559%) hue-rotate(109deg) brightness(93%) contrast(92%)',
    kick: 'brightness(0) saturate(100%) invert(83%) sepia(47%) saturate(1113%) hue-rotate(57deg) brightness(106%) contrast(98%)',
    twitch:
      'brightness(0) saturate(100%) invert(37%) sepia(98%) saturate(1932%) hue-rotate(249deg) brightness(93%) contrast(109%)',
    youtube:
      'brightness(0) saturate(100%) invert(22%) sepia(99%) saturate(3013%) hue-rotate(352deg) brightness(95%) contrast(91%)',
    rumble:
      'brightness(0) saturate(100%) invert(73%) sepia(21%) saturate(1015%) hue-rotate(45deg) brightness(95%) contrast(87%)'
  }
  return filters[platform] || 'none'
}

export function OrgCreators() {
  const { creatorProfiles, profilesLoading, loadCreatorProfiles, organizationId, isAdmin, members, loadOrganization } =
    useOrganization()
  const toast = useToast()

  // Profile dialog
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [editProfile, setEditProfile] = useState<ServerOrganizationCreatorProfile | null>(null)
  const [profileDialogScope, setProfileDialogScope] = useState<'streamer' | 'global'>('streamer')

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteDialogProfile, setDeleteDialogProfile] = useState<ServerOrganizationCreatorProfile | null>(null)
  const [deleteProcessing, setDeleteProcessing] = useState(false)

  // Assignment dialog
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false)
  const [assignmentProfile, setAssignmentProfile] = useState<ServerOrganizationCreatorProfile | null>(null)
  const [assignmentLoading, setAssignmentLoading] = useState(false)
  const [assignmentSaving, setAssignmentSaving] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [originalAssignedIds, setOriginalAssignedIds] = useState<number[]>([])

  // Profile menu
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const menuButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  useEffect(() => {
    loadCreatorProfiles()
  }, [loadCreatorProfiles])

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (openMenuId !== null) {
        const btn = menuButtonRefs.current.get(openMenuId)
        if (btn && btn.contains(e.target as Node)) return
        setOpenMenuId(null)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openMenuId])

  // Computed stats
  const totalPlatformLinks = useMemo(
    () => creatorProfiles.reduce((sum, p) => sum + (p.platform_links?.length || 0), 0),
    [creatorProfiles]
  )
  const totalAssignedMembers = useMemo(
    () => creatorProfiles.reduce((sum, p) => sum + (p.assigned_count || p.assignments?.length || 0), 0),
    [creatorProfiles]
  )

  function getMenuPosition(profileId: number): React.CSSProperties {
    const btn = menuButtonRefs.current.get(profileId)
    if (!btn) return { top: 0, left: 0 }
    const rect = btn.getBoundingClientRect()
    const menuWidth = 200
    const menuMaxHeight = 160
    const padding = 8
    let top = rect.bottom + padding
    let left = rect.right - menuWidth
    if (top + menuMaxHeight > window.innerHeight - padding) top = rect.top - menuMaxHeight - padding
    if (left < padding) left = padding
    if (left + menuWidth > window.innerWidth - padding) left = window.innerWidth - menuWidth - padding
    return { top, left }
  }

  // Delete
  async function executeDelete() {
    if (!deleteDialogProfile || !organizationId) return
    setDeleteProcessing(true)
    try {
      const result = await deleteOrganizationCreatorProfile(Number(organizationId), deleteDialogProfile.id)
      if (result.success) {
        toast.success('Profile deleted', `"${deleteDialogProfile.name}" has been deleted`)
        loadCreatorProfiles()
        setShowDeleteDialog(false)
        setDeleteDialogProfile(null)
      } else {
        toast.error('Delete failed', result.error)
      }
    } catch (err: any) {
      toast.error('Delete failed', err.message)
    } finally {
      setDeleteProcessing(false)
    }
  }

  // Assignment dialog
  async function openAssignmentDialogFor(profile: ServerOrganizationCreatorProfile) {
    setAssignmentProfile(profile)
    setShowAssignmentDialog(true)
    setAssignmentLoading(true)
    try {
      await loadOrganization()
      const assigned = profile.assignments?.map((a) => a.user_id) || []
      setOriginalAssignedIds(assigned)
      setSelectedUserIds([...assigned])
    } finally {
      setAssignmentLoading(false)
    }
  }

  function toggleAssignment(userId: number) {
    setSelectedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }

  async function saveAssignments() {
    if (!assignmentProfile || !organizationId) return
    setAssignmentSaving(true)
    try {
      const toAdd = selectedUserIds.filter((id) => !originalAssignedIds.includes(id))
      const toRemove = originalAssignedIds.filter((id) => !selectedUserIds.includes(id))
      for (const userId of toAdd) {
        await assignProfile(Number(organizationId), assignmentProfile.id, userId)
      }
      for (const userId of toRemove) {
        await unassignProfile(Number(organizationId), assignmentProfile.id, userId)
      }
      const changeCount = toAdd.length + toRemove.length
      if (changeCount > 0) toast.success('Assignments updated', `${toAdd.length} added, ${toRemove.length} removed`)
      loadCreatorProfiles()
      setShowAssignmentDialog(false)
      setAssignmentProfile(null)
    } catch (err: any) {
      toast.error('Save failed', err.message)
    } finally {
      setAssignmentSaving(false)
    }
  }

  async function toggleProfileDisabled(profile: ServerOrganizationCreatorProfile) {
    if (!organizationId) return
    try {
      const result = await toggleCreatorProfileDisabled(Number(organizationId), profile.id)
      if (result.success && result.profile) {
        const action = result.profile.disabled ? 'disabled' : 'enabled'
        toast.success('Profile updated', `"${profile.name}" has been ${action}`)
        loadCreatorProfiles()
        setOpenMenuId(null)
      } else {
        toast.error('Toggle failed', result.error)
      }
    } catch (err: any) {
      toast.error('Toggle failed', err.message)
    }
  }

  if (profilesLoading && creatorProfiles.length === 0) {
    return (
      <PageLayout icon={UserCircle} title="Creator Profiles">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      icon={UserCircle}
      title="Creator Profiles"
      description="Manage creator profiles and assign them to team members"
      actions={
        isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditProfile(null)
                setProfileDialogScope('global')
                setShowProfileDialog(true)
              }}
              className="flex items-center gap-2 h-8 px-3.5 text-xs font-semibold rounded-md bg-[#1f1f23] text-[#fafafa] border border-[#27272a] cursor-pointer transition-all duration-150 hover:bg-[#27272a]"
            >
              <Paintbrush className="w-3.5 h-3.5" /> Global Branding
            </button>
            <button
              onClick={() => {
                setEditProfile(null)
                setProfileDialogScope('streamer')
                setShowProfileDialog(true)
              }}
              className="flex items-center gap-2 h-8 px-3.5 text-xs font-semibold rounded-md bg-cyan-400 text-[#0a0a0b] border-none cursor-pointer transition-opacity duration-150 hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" /> Add Profile
            </button>
          </div>
        )
      }
    >
      <div className="oc">
        {/* Page Heading */}
        <div className="oc-heading">
          <h1 className="oc-heading__title">Creator Profile Management</h1>
          <p className="oc-heading__subtitle">
            Create and manage creator profiles with platform links, intros, outros, and watermarks
          </p>
        </div>

        {/* Stats Overview */}
        <div className="oc-stats">
          <div className="oc-stats__card">
            <div className="oc-stats__indicator oc-stats__indicator--green" />
            <div className="oc-stats__inner">
              <div className="oc-stats__icon oc-stats__icon--green">
                <UserCircle className="w-5 h-5" />
              </div>
              <div className="oc-stats__text">
                <h3 className="oc-stats__title">Total Profiles</h3>
                <p className="oc-stats__desc">Created in organization</p>
              </div>
              <div className="oc-stats__value oc-stats__value--green">{creatorProfiles.length}</div>
            </div>
          </div>
          <div className="oc-stats__card">
            <div className="oc-stats__indicator oc-stats__indicator--purple" />
            <div className="oc-stats__inner">
              <div className="oc-stats__icon oc-stats__icon--purple">
                <Link2 className="w-5 h-5" />
              </div>
              <div className="oc-stats__text">
                <h3 className="oc-stats__title">Platform Links</h3>
                <p className="oc-stats__desc">Connected accounts</p>
              </div>
              <div className="oc-stats__value oc-stats__value--purple">{totalPlatformLinks}</div>
            </div>
          </div>
          <div className="oc-stats__card">
            <div className="oc-stats__indicator oc-stats__indicator--amber" />
            <div className="oc-stats__inner">
              <div className="oc-stats__icon oc-stats__icon--amber">
                <Users className="w-5 h-5" />
              </div>
              <div className="oc-stats__text">
                <h3 className="oc-stats__title">Assigned Members</h3>
                <p className="oc-stats__desc">Using profiles</p>
              </div>
              <div className="oc-stats__value oc-stats__value--amber">{totalAssignedMembers}</div>
            </div>
          </div>
        </div>

        {/* Profiles Section */}
        <section className="oc-section">
          <div className="oc-section__header">
            <div className="oc-section__header-icon">
              <Layers className="w-5 h-5" />
            </div>
            <div className="oc-section__header-text">
              <h2 className="oc-section__title">Creator Profiles</h2>
              <p className="oc-section__subtitle">Profiles with branding and platform connections</p>
            </div>
            <span className="oc-section__badge">{creatorProfiles.length}</span>
          </div>

          {creatorProfiles.length > 0 ? (
            <div className="oc-grid">
              {creatorProfiles.map((profile) => (
                <div key={profile.id} className="oc-card">
                  {/* Card Header */}
                  <div className="oc-card__header">
                    <div className="oc-card__avatar">
                      {profile.profile_image_url ? (
                        <img src={profile.profile_image_url} alt={profile.name} className="oc-card__avatar-img" />
                      ) : (
                        <div className="oc-card__avatar-fallback">
                          <UserCircle className="w-6 h-6 text-zinc-500 opacity-60" />
                        </div>
                      )}
                    </div>
                    <div className="oc-card__info">
                      <div className="oc-card__name" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {profile.name}
                        {(profile as any).scope === 'global' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.125rem 0.5rem',
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                              borderRadius: '9999px',
                              backgroundColor: 'rgba(139,92,246,0.15)',
                              color: '#a78bfa',
                              flexShrink: 0
                            }}
                          >
                            Global
                          </span>
                        )}
                      </div>
                      <div className="oc-card__desc">{profile.description || 'No description'}</div>
                    </div>
                    {isAdmin && (
                      <div className="oc-card__actions">
                        <button
                          ref={(el) => {
                            if (el) menuButtonRefs.current.set(profile.id, el)
                            else menuButtonRefs.current.delete(profile.id)
                          }}
                          className={`oc-card__menu-btn ${openMenuId === profile.id ? 'oc-card__menu-btn--active' : ''}`}
                          title="Profile actions"
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuId(openMenuId === profile.id ? null : profile.id)
                          }}
                        >
                          <MoreVertical className="w-[18px] h-[18px]" />
                        </button>
                        {openMenuId === profile.id &&
                          createPortal(
                            <div
                              className="oc-dropdown"
                              style={getMenuPosition(profile.id)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="oc-dropdown__item"
                                onClick={() => {
                                  openAssignmentDialogFor(profile)
                                  setOpenMenuId(null)
                                }}
                              >
                                <Users className="w-4 h-4" />
                                <span>Manage Assignments</span>
                              </button>
                              <button
                                className="oc-dropdown__item oc-dropdown__item--edit"
                                onClick={() => {
                                  setEditProfile(profile)
                                  setProfileDialogScope(((profile as any).scope as 'streamer' | 'global') || 'streamer')
                                  setShowProfileDialog(true)
                                  setOpenMenuId(null)
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                                <span>Edit Profile</span>
                              </button>
                              <div className="oc-dropdown__divider" />
                              <button
                                className="oc-dropdown__item"
                                onClick={() => toggleProfileDisabled(profile)}
                              >
                                {(profile as any).disabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                <span>{(profile as any).disabled ? 'Enable' : 'Disable'} Profile</span>
                              </button>
                              <div className="oc-dropdown__divider" />
                              <button
                                className="oc-dropdown__item oc-dropdown__item--danger"
                                onClick={() => {
                                  setDeleteDialogProfile(profile)
                                  setShowDeleteDialog(true)
                                  setOpenMenuId(null)
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete Profile</span>
                              </button>
                            </div>,
                            document.body
                          )}
                      </div>
                    )}
                  </div>

                  {/* Stats Row */}
                  <div className="oc-card__stats-row">
                    {/* Platform Icons */}
                    <div className="oc-card__platforms">
                      {profile.platform_links && profile.platform_links.length > 0 ? (
                        <>
                          {profile.platform_links.slice(0, 4).map((link) => (
                            <div
                              key={link.id}
                              className="oc-card__platform-icon-wrapper"
                              title={link.display_name || link.platform}
                            >
                              <img
                                src={getPlatformIcon(link.platform)}
                                alt={link.platform}
                                className="oc-card__platform-icon"
                                style={{ filter: getPlatformFilter(link.platform) }}
                              />
                            </div>
                          ))}
                          {profile.platform_links.length > 4 && (
                            <span className="oc-card__more-badge">+{profile.platform_links.length - 4}</span>
                          )}
                        </>
                      ) : (
                        <span className="oc-card__empty-indicator">
                          <Link2 className="w-4 h-4 text-zinc-500" />
                        </span>
                      )}
                    </div>

                    <div className="oc-card__divider" />

                    {/* Branding Icons */}
                    <div className="oc-card__branding">
                      <div
                        className={`oc-card__branding-icon ${profile.intro_id ? 'oc-card__branding-icon--active' : ''}`}
                        title={profile.intro_id ? 'Intro configured' : 'No intro'}
                      >
                        <Play className="w-3.5 h-3.5" />
                      </div>
                      <div
                        className={`oc-card__branding-icon ${profile.outro_id ? 'oc-card__branding-icon--active' : ''}`}
                        title={profile.outro_id ? 'Outro configured' : 'No outro'}
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </div>
                      <div
                        className={`oc-card__branding-icon ${profile.watermark_id ? 'oc-card__branding-icon--active' : ''}`}
                        title={profile.watermark_id ? 'Watermark configured' : 'No watermark'}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <div className="oc-card__divider" />

                    {/* Members Avatar Stack */}
                    <div className="oc-card__members">
                      {profile.assignments && profile.assignments.length > 0 ? (
                        <>
                          <div className="oc-card__avatar-stack">
                            {profile.assignments.slice(0, 3).map((assignment, idx) => (
                              <div
                                key={assignment.id}
                                className="oc-card__stack-avatar"
                                style={{ zIndex: 3 - idx }}
                                title={assignment.user?.name || assignment.user?.email || 'Member'}
                              >
                                {assignment.user?.avatar_url ? (
                                  <img
                                    src={assignment.user.avatar_url}
                                    alt={assignment.user?.name || 'Member'}
                                    className="oc-card__stack-avatar-img"
                                  />
                                ) : (
                                  <UserCircle className="w-full h-full text-zinc-500" />
                                )}
                              </div>
                            ))}
                          </div>
                          {(profile.assigned_count || profile.assignments.length) > 3 && (
                            <span className="oc-card__more-badge">
                              +{(profile.assigned_count || profile.assignments.length) - 3}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="oc-card__empty-indicator">
                          <Users className="w-4 h-4 text-zinc-500" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="oc-card__footer">
                    <span className="oc-card__updated">{formatRelativeTime(profile.updated_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="oc-empty">
              <div className="oc-empty__icon-wrapper">
                <UserCircle className="w-8 h-8 text-cyan-400" />
              </div>
              <h3 className="oc-empty__title">No creator profiles yet</h3>
              <p className="oc-empty__text">
                Create profiles with platform links, intros, outros, and watermarks to assign to your team members.
              </p>
              {isAdmin && (
                <button
                  onClick={() => {
                    setProfileDialogScope('streamer')
                    setShowProfileDialog(true)
                  }}
                  className="oc-empty__btn"
                >
                  <Plus className="w-[18px] h-[18px]" />
                  Create First Profile
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Profile Dialog */}
      <ProfileDialog
        open={showProfileDialog}
        onClose={() => setShowProfileDialog(false)}
        onSuccess={loadCreatorProfiles}
        profile={editProfile}
        scope={profileDialogScope}
      />

      {/* Delete Profile Dialog */}
      {showDeleteDialog &&
        createPortal(
          <div
            className="om-dialog__overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget && !deleteProcessing) {
                setShowDeleteDialog(false)
                setDeleteDialogProfile(null)
              }
            }}
          >
            <div className="om-dialog om-dialog--red">
              <div className="om-dialog__accent om-dialog__accent--red" />
              <div className="om-dialog__header">
                <button
                  className="om-dialog__close"
                  onClick={() => {
                    setShowDeleteDialog(false)
                    setDeleteDialogProfile(null)
                  }}
                  disabled={deleteProcessing}
                >
                  <X size={18} />
                </button>
                <div className="om-dialog__icon om-dialog__icon--red">
                  <Trash2 size={24} />
                </div>
                <h2 className="om-dialog__title">Delete Profile</h2>
                <p className="om-dialog__subtitle">This action cannot be undone</p>
              </div>
              <div className="om-dialog__content">
                <div className="oc-dialog__profile-card">
                  <div className="oc-dialog__profile-avatar">
                    {deleteDialogProfile?.profile_image_url ? (
                      <img
                        src={deleteDialogProfile.profile_image_url}
                        alt={deleteDialogProfile.name}
                        className="oc-dialog__profile-avatar-img"
                      />
                    ) : (
                      <UserCircle size={20} className="text-zinc-500" />
                    )}
                  </div>
                  <div className="oc-dialog__profile-info">
                    <div className="oc-dialog__profile-name">{deleteDialogProfile?.name}</div>
                    <div className="oc-dialog__profile-desc">
                      {deleteDialogProfile?.description || 'No description'}
                    </div>
                  </div>
                  {(deleteDialogProfile?.assigned_count || 0) > 0 && (
                    <span className="oc-dialog__profile-badge">{deleteDialogProfile?.assigned_count} assigned</span>
                  )}
                </div>
                <div className="om-dialog__warning-box">
                  <p className="om-dialog__warning-text">
                    Are you sure you want to delete <strong>"{deleteDialogProfile?.name}"</strong>?
                    {(deleteDialogProfile?.assigned_count || 0) > 0 &&
                      ` This will unassign ${deleteDialogProfile?.assigned_count} ${deleteDialogProfile?.assigned_count === 1 ? 'member' : 'members'}.`}
                  </p>
                </div>
              </div>
              <div className="om-dialog__footer">
                <button
                  className="om-dialog__btn om-dialog__btn--secondary"
                  onClick={() => {
                    setShowDeleteDialog(false)
                    setDeleteDialogProfile(null)
                  }}
                  disabled={deleteProcessing}
                >
                  Cancel
                </button>
                <button
                  className="om-dialog__btn om-dialog__btn--danger"
                  onClick={executeDelete}
                  disabled={deleteProcessing}
                >
                  {deleteProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {deleteProcessing ? 'Deleting...' : 'Delete Profile'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Assignment Dialog */}
      {showAssignmentDialog &&
        createPortal(
          <div
            className="om-dialog__overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget && !assignmentSaving) {
                setShowAssignmentDialog(false)
                setAssignmentProfile(null)
              }
            }}
          >
            <div className="om-dialog om-dialog--cyan">
              <div className="om-dialog__accent om-dialog__accent--cyan" />
              <div className="om-dialog__header">
                <button
                  className="om-dialog__close"
                  onClick={() => {
                    setShowAssignmentDialog(false)
                    setAssignmentProfile(null)
                  }}
                  disabled={assignmentSaving}
                >
                  <X size={18} />
                </button>
                <div className="om-dialog__icon om-dialog__icon--cyan">
                  <Users size={24} />
                </div>
                <h2 className="om-dialog__title">Manage Assignments</h2>
                <p className="om-dialog__subtitle">Assign "{assignmentProfile?.name}" to team members</p>
              </div>
              <div className="om-dialog__content">
                {assignmentLoading ? (
                  <div className="oc-dialog__loading">
                    <div className="oc-dialog__loading-spinner" />
                    <span>Loading members...</span>
                  </div>
                ) : (
                  <div className="oc-dialog__member-list">
                    {members.length > 0 ? (
                      members.map((member) => (
                        <div
                          key={member.user_id}
                          className={`oc-dialog__member-row ${selectedUserIds.includes(member.user_id) ? 'oc-dialog__member-row--selected' : ''}`}
                          onClick={() => toggleAssignment(member.user_id)}
                        >
                          <div
                            className={`oc-dialog__checkbox ${selectedUserIds.includes(member.user_id) ? 'oc-dialog__checkbox--checked' : ''}`}
                          >
                            {selectedUserIds.includes(member.user_id) && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="oc-dialog__member-avatar">
                            {member.user?.avatar_url ? (
                              <img
                                src={member.user.avatar_url}
                                alt={member.user.name || member.user.email}
                                className="oc-dialog__member-avatar-img"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <User className="w-4 h-4 text-zinc-500" />
                            )}
                          </div>
                          <div className="oc-dialog__member-info">
                            <p className="oc-dialog__member-name">{member.user?.name || member.user?.email}</p>
                            {member.user?.name && <p className="oc-dialog__member-email">{member.user.email}</p>}
                          </div>
                          <span
                            className={`oc-dialog__role-badge ${member.role === 'owner' ? 'oc-dialog__role-badge--owner' : member.role === 'admin' ? 'oc-dialog__role-badge--admin' : ''}`}
                          >
                            {member.role}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="oc-dialog__empty-members">
                        <div className="oc-dialog__empty-members-icon">
                          <Users className="w-6 h-6" />
                        </div>
                        <p className="text-sm text-zinc-500">No members in this organization</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {!assignmentLoading && members.length > 0 && (
                <div className="oc-dialog__summary">
                  <div className="oc-dialog__summary-row">
                    <span className="oc-dialog__summary-text">
                      {selectedUserIds.length} of {members.length} members selected
                    </span>
                    <div className="oc-dialog__summary-actions">
                      <button
                        type="button"
                        onClick={() => setSelectedUserIds(members.map((m) => m.user_id))}
                        className="oc-dialog__summary-link"
                      >
                        Select All
                      </button>
                      <span className="oc-dialog__summary-divider">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedUserIds([])}
                        className="oc-dialog__summary-link oc-dialog__summary-link--muted"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="om-dialog__footer" style={{ marginTop: 0 }}>
                <button
                  className="om-dialog__btn om-dialog__btn--secondary"
                  onClick={() => {
                    setShowAssignmentDialog(false)
                    setAssignmentProfile(null)
                  }}
                  disabled={assignmentSaving}
                >
                  Cancel
                </button>
                <button
                  className="om-dialog__btn om-dialog__btn--primary"
                  onClick={saveAssignments}
                  disabled={assignmentSaving}
                >
                  {assignmentSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {assignmentSaving ? 'Saving...' : 'Save Assignments'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </PageLayout>
  )
}
