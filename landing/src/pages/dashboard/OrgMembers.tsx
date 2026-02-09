import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'

import { Skeleton } from '@/components/ui/Skeleton'
import { InviteMemberDialog } from '@/components/organization/InviteMemberDialog'
import { api } from '@/lib/api'
import {
  Users, UserPlus, User, UserCheck, Mail, RefreshCw, X, MoreVertical,
  Pencil, Shield, Trash2, ArrowDown, Eye, EyeOff, Loader2, Clock,
  Crown, Zap, TrendingUp, Lock, ShieldOff
} from 'lucide-react'
import type { OrganizationMember, OrganizationInvitation } from '@/types/organization'

export function OrgMembers() {
  const {
    loading, members, invitations, isAdmin, loadOrganization,
    removeMember, updateMemberRole, updateMemberAccount, cancelInvitation, resendInvitation,
    formatDate, formatAllocation, canAddMembers, isOrgCreatedUser,
    hasActiveSubscription, totalSeats, currentMembers, seatsRemaining, organizationId,
  } = useOrganization()

  const [showInviteDialog, setShowInviteDialog] = useState(false)

  // Seat limit dialog
  const [showSeatLimitDialog, setShowSeatLimitDialog] = useState(false)

  // Member menu state
  const [openMemberMenuId, setOpenMemberMenuId] = useState<number | null>(null)
  const memberMenuButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  // Role dialog state
  const [showRoleDialog, setShowRoleDialog] = useState(false)
  const [roleDialogMember, setRoleDialogMember] = useState<OrganizationMember | null>(null)
  const [roleDialogNewRole, setRoleDialogNewRole] = useState('')

  // Edit member dialog state
  const [showEditMemberDialog, setShowEditMemberDialog] = useState(false)
  const [editMemberData, setEditMemberData] = useState<{ member: OrganizationMember | null; name: string; email: string; password: string }>({ member: null, name: '', email: '', password: '' })
  const [editMemberSaving, setEditMemberSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Remove member dialog state
  const [showRemoveMemberDialog, setShowRemoveMemberDialog] = useState(false)
  const [removeMemberDialogMember, setRemoveMemberDialogMember] = useState<OrganizationMember | null>(null)
  const [removeMemberProcessing, setRemoveMemberProcessing] = useState(false)

  // Avatar error tracking
  const [failedAvatars, setFailedAvatars] = useState<Set<number>>(new Set())

  // Resending invitation
  const [resendingInvitationId, setResendingInvitationId] = useState<number | null>(null)

  // Restriction toggle
  const [togglingRestrictionId, setTogglingRestrictionId] = useState<number | null>(null)

  useEffect(() => { loadOrganization() }, [loadOrganization])

  // Close member menu on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (openMemberMenuId !== null) {
        const button = memberMenuButtonRefs.current.get(openMemberMenuId)
        if (button && button.contains(e.target as Node)) return
        setOpenMemberMenuId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [openMemberMenuId])

  const restrictedMembersCount = members.filter(m => m.is_restricted).length

  function handleAddMemberClick() {
    if (!canAddMembers) {
      setShowSeatLimitDialog(true)
    } else {
      setShowInviteDialog(true)
    }
  }

  function handleAvatarError(userId: number) {
    setFailedAvatars(prev => new Set(prev).add(userId))
  }

  async function handleResendInvitation(invitation: OrganizationInvitation) {
    setResendingInvitationId(invitation.id)
    await resendInvitation(invitation)
    setResendingInvitationId(null)
  }

  function getMemberMenuPosition(userId: number): React.CSSProperties {
    const button = memberMenuButtonRefs.current.get(userId)
    if (!button) return { top: 0, left: 0 }
    const rect = button.getBoundingClientRect()
    const menuWidth = 180
    const menuMaxHeight = 220
    const padding = 8
    let top = rect.bottom + padding
    let left = rect.right - menuWidth
    if (top + menuMaxHeight > window.innerHeight - padding) top = rect.top - menuMaxHeight - padding
    if (left < padding) left = padding
    if (left + menuWidth > window.innerWidth - padding) left = window.innerWidth - menuWidth - padding
    return { top, left }
  }

  // Role dialog
  function openRoleDialogFor(member: OrganizationMember) {
    setRoleDialogMember(member)
    setRoleDialogNewRole(member.role === 'admin' ? 'member' : 'admin')
    setShowRoleDialog(true)
  }

  async function confirmRoleChange() {
    if (!roleDialogMember || !roleDialogNewRole) return
    const member = roleDialogMember
    const newRole = roleDialogNewRole
    setShowRoleDialog(false)
    setRoleDialogMember(null)
    await updateMemberRole(member, newRole)
  }

  // Restriction toggle
  async function toggleMemberRestriction(member: OrganizationMember) {
    if (!organizationId) return
    setTogglingRestrictionId(member.user_id)
    try {
      const response = await api.put<any>(`/organizations/${organizationId}/members/${member.user_id}/restrictions`, { is_restricted: !member.is_restricted })
      if (response.success) await loadOrganization(true)
    } catch (err) {
      console.error('Error toggling restriction:', err)
    } finally {
      setTogglingRestrictionId(null)
    }
  }

  // Edit member dialog
  function openEditMemberDialogFor(member: OrganizationMember) {
    setEditMemberData({ member, name: member.user?.name || '', email: member.user?.email || '', password: '' })
    setShowPassword(false)
    setShowEditMemberDialog(true)
  }

  async function saveEditMember() {
    if (!editMemberData.member) return
    setEditMemberSaving(true)
    const updates: Record<string, string> = {}
    if (editMemberData.name !== (editMemberData.member.user?.name || '')) updates.name = editMemberData.name
    if (editMemberData.email !== (editMemberData.member.user?.email || '')) updates.email = editMemberData.email
    if (editMemberData.password) updates.password = editMemberData.password
    if (Object.keys(updates).length === 0) { setEditMemberSaving(false); return }
    const result = await updateMemberAccount(editMemberData.member, updates)
    setEditMemberSaving(false)
    if (result.success) {
      setShowEditMemberDialog(false)
      setEditMemberData({ member: null, name: '', email: '', password: '' })
    }
  }

  // Remove member dialog
  function confirmRemoveMemberFor(member: OrganizationMember) {
    setRemoveMemberDialogMember(member)
    setShowRemoveMemberDialog(true)
  }

  async function executeRemoveMember() {
    if (!removeMemberDialogMember) return
    setRemoveMemberProcessing(true)
    const result = await removeMember(removeMemberDialogMember)
    if (result.success) {
      setShowRemoveMemberDialog(false)
      setRemoveMemberDialogMember(null)
      setRemoveMemberProcessing(false)
    } else {
      setRemoveMemberProcessing(false)
    }
  }

  if (loading && members.length === 0) {
    return (
      <PageLayout icon={Users} title="Members">
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout icon={Users} title="Members" description="Manage team members and invitations" actions={
      isAdmin && (
        <div className="flex items-center gap-3">
          {hasActiveSubscription && seatsRemaining != null && (
            <span className={`inline-flex items-center px-3 py-1.5 text-[0.6875rem] font-semibold rounded-md uppercase tracking-wider ${
              seatsRemaining === 0 ? 'bg-red-500/15 text-red-400' : seatsRemaining <= 2 ? 'bg-amber-500/15 text-amber-400' : 'bg-cyan-500/15 text-cyan-400'
            }`}>
              {seatsRemaining} {seatsRemaining === 1 ? 'seat' : 'seats'} remaining
            </span>
          )}
          <button onClick={handleAddMemberClick} disabled={!canAddMembers} className="flex items-center gap-2 h-8 px-3.5 text-xs font-semibold rounded-md bg-cyan-400 text-[#0a0a0b] border-none cursor-pointer transition-opacity duration-150 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"><UserPlus className="w-3.5 h-3.5" /> Add Member</button>
        </div>
      )
    }>
      <div className="om">
        {/* Page Heading */}
        <div className="om-heading">
          <h1 className="om-heading__title">Team Management</h1>
          <p className="om-heading__subtitle">Invite team members, manage roles, and allocate resources to your organization</p>
        </div>

        {/* Stats Overview */}
        <div className="om-stats">
          <div className="om-stats__card">
            <div className="om-stats__indicator om-stats__indicator--blue" />
            <div className="om-stats__inner">
              <div className="om-stats__icon om-stats__icon--blue"><Users className="w-5 h-5" /></div>
              <div className="om-stats__text">
                <h3 className="om-stats__title">Active Members</h3>
                <p className="om-stats__desc">
                  {hasActiveSubscription && totalSeats ? `${members.length} of ${totalSeats} seats used` : 'Currently in organization'}
                </p>
              </div>
              <div className="om-stats__value om-stats__value--blue">{members.length}</div>
            </div>
          </div>
          <div className="om-stats__card">
            <div className="om-stats__indicator om-stats__indicator--amber" />
            <div className="om-stats__inner">
              <div className="om-stats__icon om-stats__icon--amber"><Mail className="w-5 h-5" /></div>
              <div className="om-stats__text">
                <h3 className="om-stats__title">Pending Invitations</h3>
                <p className="om-stats__desc">Awaiting response</p>
              </div>
              <div className="om-stats__value om-stats__value--amber">{invitations.length}</div>
            </div>
          </div>
          <div className="om-stats__card">
            <div className="om-stats__indicator om-stats__indicator--red" />
            <div className="om-stats__inner">
              <div className="om-stats__icon om-stats__icon--red"><ShieldOff className="w-5 h-5" /></div>
              <div className="om-stats__text">
                <h3 className="om-stats__title">Restricted Users</h3>
                <p className="om-stats__desc">Limited access</p>
              </div>
              <div className="om-stats__value om-stats__value--red">{restrictedMembersCount}</div>
            </div>
          </div>
        </div>

        {/* Pending Invitations Section */}
        {isAdmin && invitations.length > 0 && (
          <section className="om-section">
            <div className="om-section__header">
              <div className="om-section__header-icon om-section__header-icon--amber"><Clock className="w-5 h-5" /></div>
              <div className="om-section__header-text">
                <h2 className="om-section__title">Pending Invitations</h2>
                <p className="om-section__subtitle">Members who haven't accepted yet</p>
              </div>
              <span className="om-section__badge om-section__badge--amber">{invitations.length}</span>
            </div>
            <div className="om-invitations-grid">
              {invitations.map(inv => (
                <div key={inv.id} className="om-invitation">
                  <div className="om-invitation__inner">
                    <div className="om-invitation__icon"><Mail className="w-[18px] h-[18px] text-amber-500" /></div>
                    <div className="om-invitation__info">
                      <div className="om-invitation__email">{inv.email}</div>
                      <div className="om-invitation__meta">
                        <span className={`om-invitation__role ${inv.role === 'admin' ? 'om-invitation__role--admin' : ''}`}>{inv.role}</span>
                        <span className="om-invitation__dot" />
                        <span className="om-invitation__expires"><Clock className="w-3 h-3" />{formatDate(inv.expires_at)}</span>
                      </div>
                    </div>
                    <div className="om-invitation__actions">
                      <button onClick={() => handleResendInvitation(inv)} disabled={resendingInvitationId === inv.id} title="Resend invitation" className="om-invitation__action">
                        <RefreshCw className={`w-3.5 h-3.5 ${resendingInvitationId === inv.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button onClick={() => cancelInvitation(inv.id)} title="Cancel invitation" className="om-invitation__action om-invitation__action--danger">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Active Members Section */}
        <section className="om-section">
          <div className="om-section__header">
            <div className="om-section__header-icon om-section__header-icon--blue"><UserCheck className="w-5 h-5" /></div>
            <div className="om-section__header-text">
              <h2 className="om-section__title">Active Members</h2>
              <p className="om-section__subtitle">Team members with organization access</p>
            </div>
            <span className="om-section__badge om-section__badge--blue">{members.length}</span>
          </div>

          {members.length > 0 ? (
            <div className="om-members-list">
              {members.map(member => (
                <div key={member.id} className={`om-member ${member.role === 'owner' ? 'om-member--owner' : member.role === 'admin' ? 'om-member--admin' : ''}`}>
                  <div className="om-member__content">
                    <div className="om-member__row">
                      {/* Avatar */}
                      <div className="om-member__avatar">
                        {member.user?.avatar_url && !failedAvatars.has(member.user_id) ? (
                          <img src={member.user.avatar_url} alt={member.user.name || member.user.email} className="om-member__avatar-img" referrerPolicy="no-referrer" onError={() => handleAvatarError(member.user_id)} />
                        ) : (
                          <div className="om-member__avatar-fallback"><User className="w-5 h-5 text-zinc-500 opacity-60" /></div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="om-member__info">
                        <div className="om-member__name">{member.user?.name || member.user?.email || 'Unknown User'}</div>
                        <div className="om-member__email">{member.user?.email}</div>
                      </div>

                      {/* Credits */}
                      <div className="om-member__credits">
                        <div className="om-member__credit">
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="om-member__credit-value">{formatAllocation(member.allocation?.hours_remaining)}</span>
                          <span className="om-member__credit-unit">min</span>
                        </div>
                        <div className="om-member__credit om-member__credit--muted">
                          <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="om-member__credit-value om-member__credit-value--muted">{formatAllocation(member.allocation?.hours_used)}</span>
                          <span className="om-member__credit-unit">used</span>
                        </div>
                      </div>

                      {/* Role Badge */}
                      <span className={`om-member__role ${member.role === 'owner' ? 'om-member__role--owner' : member.role === 'admin' ? 'om-member__role--admin' : ''}`}>
                        {member.role === 'owner' && <Crown className="w-[11px] h-[11px]" />}
                        {member.role === 'admin' && <Shield className="w-[11px] h-[11px]" />}
                        {member.role === 'member' && <User className="w-[11px] h-[11px]" />}
                        {member.role}
                      </span>

                      {/* Restricted Badge */}
                      {member.is_restricted && (
                        <span className="om-member__restricted" title="This member has restricted access">
                          <Lock className="w-3 h-3" />Restricted
                        </span>
                      )}

                      {/* Actions Menu */}
                      {isAdmin && member.role !== 'owner' && (
                        <div className="om-member__actions">
                          <button
                            ref={el => { if (el) memberMenuButtonRefs.current.set(member.user_id, el); else memberMenuButtonRefs.current.delete(member.user_id) }}
                            className={`om-member__menu-btn ${openMemberMenuId === member.user_id ? 'om-member__menu-btn--active' : ''}`}
                            title="Member actions"
                            onClick={e => { e.stopPropagation(); setOpenMemberMenuId(openMemberMenuId === member.user_id ? null : member.user_id) }}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openMemberMenuId === member.user_id && createPortal(
                            <div className="om-dropdown" style={getMemberMenuPosition(member.user_id)} onClick={e => e.stopPropagation()}>
                              {isOrgCreatedUser(member) && (
                                <button className="om-dropdown__item om-dropdown__item--edit" onClick={() => { openEditMemberDialogFor(member); setOpenMemberMenuId(null) }}>
                                  <Pencil className="w-4 h-4" /><span>Edit Member</span>
                                </button>
                              )}
                              <button className="om-dropdown__item" onClick={() => { openRoleDialogFor(member); setOpenMemberMenuId(null) }}>
                                <Shield className="w-4 h-4" /><span>Change Role</span>
                              </button>
                              <div className="om-dropdown__divider" />
                              <div className="om-dropdown__toggle-item">
                                <div className="om-dropdown__toggle-label"><Lock className="w-4 h-4" /><span>Restricted</span></div>
                                <button
                                  type="button"
                                  className={`om-dropdown__toggle ${member.is_restricted ? 'om-dropdown__toggle--active' : ''}`}
                                  disabled={togglingRestrictionId === member.user_id}
                                  onClick={e => { e.stopPropagation(); toggleMemberRestriction(member) }}
                                >
                                  <span className="om-dropdown__toggle-handle" />
                                </button>
                              </div>
                              <div className="om-dropdown__divider" />
                              <button className="om-dropdown__item om-dropdown__item--danger" onClick={() => { confirmRemoveMemberFor(member); setOpenMemberMenuId(null) }}>
                                <Trash2 className="w-4 h-4" /><span>Remove Member</span>
                              </button>
                            </div>,
                            document.body
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="om-empty">
              <div className="om-empty__icon-wrapper"><Users className="w-8 h-8 text-cyan-400" /></div>
              <h3 className="om-empty__title">No members yet</h3>
              <p className="om-empty__text">Invite your team to get started collaborating!</p>
              {isAdmin && <button onClick={() => setShowInviteDialog(true)} className="om-empty__btn"><UserPlus className="w-[18px] h-[18px]" />Invite First Member</button>}
            </div>
          )}
        </section>
      </div>

      {/* Invite Member Dialog */}
      <InviteMemberDialog open={showInviteDialog} onClose={() => setShowInviteDialog(false)} onSuccess={() => loadOrganization(true)} />

      {/* Seat Limit Dialog */}
      {showSeatLimitDialog && createPortal(
        <div className="om-dialog__overlay" onClick={e => { if (e.target === e.currentTarget) setShowSeatLimitDialog(false) }}>
          <div className="om-dialog om-dialog--warning">
            <div className="om-dialog__accent om-dialog__accent--warning" />
            <div className="om-dialog__header">
              <button className="om-dialog__close" onClick={() => setShowSeatLimitDialog(false)}><X size={18} /></button>
              <div className="om-dialog__icon om-dialog__icon--warning"><Users size={24} /></div>
              <h2 className="om-dialog__title">Seat Limit Reached</h2>
              <p className="om-dialog__subtitle">Upgrade your subscription to add more members</p>
            </div>
            <div className="om-dialog__content">
              <div className="om-dialog__warning-box">
                <p className="om-dialog__warning-text">
                  Your organization is currently using <strong>{currentMembers} of {totalSeats}</strong> available seats. To add more team members, please upgrade your subscription or purchase an add-on.
                </p>
              </div>
            </div>
            <div className="om-dialog__footer">
              <button className="om-dialog__btn om-dialog__btn--primary" onClick={() => setShowSeatLimitDialog(false)}>View Subscription Plans</button>
              <button className="om-dialog__btn om-dialog__btn--secondary" onClick={() => setShowSeatLimitDialog(false)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Change Role Dialog */}
      {showRoleDialog && createPortal(
        <div className="om-dialog__overlay" onClick={e => { if (e.target === e.currentTarget) { setShowRoleDialog(false); setRoleDialogMember(null) } }}>
          <div className="om-dialog om-dialog--cyan">
            <div className="om-dialog__accent om-dialog__accent--cyan" />
            <div className="om-dialog__header">
              <button className="om-dialog__close" onClick={() => { setShowRoleDialog(false); setRoleDialogMember(null) }}><X size={18} /></button>
              <div className="om-dialog__icon om-dialog__icon--cyan"><Shield size={24} /></div>
              <h2 className="om-dialog__title">Change Member Role</h2>
              <p className="om-dialog__subtitle">Update role for {roleDialogMember?.user?.email}</p>
            </div>
            <div className="om-dialog__content">
              <div className="om-dialog__role-change">
                <div className="om-dialog__role-item">
                  <span className="om-dialog__role-label">Current Role</span>
                  <span className={`om-dialog__role-value ${roleDialogMember?.role === 'admin' ? 'om-dialog__role-value--admin' : ''}`}>{roleDialogMember?.role}</span>
                </div>
                <div className="om-dialog__role-arrow"><ArrowDown size={18} /></div>
                <div className="om-dialog__role-item">
                  <span className="om-dialog__role-label">New Role</span>
                  <span className={`om-dialog__role-value ${roleDialogNewRole === 'admin' ? 'om-dialog__role-value--admin' : ''}`}>{roleDialogNewRole}</span>
                </div>
              </div>
            </div>
            <div className="om-dialog__footer">
              <button className="om-dialog__btn om-dialog__btn--secondary" onClick={() => { setShowRoleDialog(false); setRoleDialogMember(null) }}>Cancel</button>
              <button className="om-dialog__btn om-dialog__btn--primary" onClick={confirmRoleChange}>Confirm Change</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Member Dialog */}
      {showEditMemberDialog && createPortal(
        <div className="om-dialog__overlay" onClick={e => { if (e.target === e.currentTarget && !editMemberSaving) { setShowEditMemberDialog(false); setEditMemberData({ member: null, name: '', email: '', password: '' }) } }}>
          <div className="om-dialog om-dialog--cyan">
            <div className="om-dialog__accent om-dialog__accent--cyan" />
            <div className="om-dialog__header">
              <button className="om-dialog__close" onClick={() => { setShowEditMemberDialog(false); setEditMemberData({ member: null, name: '', email: '', password: '' }) }} disabled={editMemberSaving}><X size={18} /></button>
              <div className="om-dialog__icon om-dialog__icon--cyan"><Pencil size={24} /></div>
              <h2 className="om-dialog__title">Edit Member</h2>
              <p className="om-dialog__subtitle">Update account details for {editMemberData.member?.user?.email}</p>
            </div>
            <form onSubmit={e => { e.preventDefault(); saveEditMember() }} className="om-dialog__form">
              <div className="om-dialog__content">
                <div className="om-dialog__field">
                  <label className="om-dialog__label">Name</label>
                  <input value={editMemberData.name} onChange={e => setEditMemberData(d => ({ ...d, name: e.target.value }))} type="text" placeholder="Enter name" className="om-dialog__input" />
                </div>
                <div className="om-dialog__field">
                  <label className="om-dialog__label">Email</label>
                  <input value={editMemberData.email} onChange={e => setEditMemberData(d => ({ ...d, email: e.target.value }))} type="email" placeholder="Enter email" className="om-dialog__input" />
                </div>
                <div className="om-dialog__field">
                  <label className="om-dialog__label">New Password <span className="om-dialog__label-hint">(leave empty to keep current)</span></label>
                  <div className="om-dialog__input-group">
                    <input value={editMemberData.password} onChange={e => setEditMemberData(d => ({ ...d, password: e.target.value }))} type={showPassword ? 'text' : 'password'} placeholder="Enter new password" className="om-dialog__input" />
                    <button type="button" onClick={() => setShowPassword(p => !p)} className="om-dialog__input-toggle">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {editMemberData.password && editMemberData.password.length < 8 && (
                    <p className="om-dialog__field-error">Password must be at least 8 characters</p>
                  )}
                </div>
              </div>
              <div className="om-dialog__footer">
                <button type="button" className="om-dialog__btn om-dialog__btn--secondary" onClick={() => { setShowEditMemberDialog(false); setEditMemberData({ member: null, name: '', email: '', password: '' }) }} disabled={editMemberSaving}>Cancel</button>
                <button type="submit" className="om-dialog__btn om-dialog__btn--primary" disabled={editMemberSaving || !!(editMemberData.password && editMemberData.password.length < 8)}>
                  {editMemberSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editMemberSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Remove Member Dialog */}
      {showRemoveMemberDialog && createPortal(
        <div className="om-dialog__overlay" onClick={e => { if (e.target === e.currentTarget && !removeMemberProcessing) { setShowRemoveMemberDialog(false); setRemoveMemberDialogMember(null) } }}>
          <div className="om-dialog om-dialog--red">
            <div className="om-dialog__accent om-dialog__accent--red" />
            <div className="om-dialog__header">
              <button className="om-dialog__close" onClick={() => { setShowRemoveMemberDialog(false); setRemoveMemberDialogMember(null) }} disabled={removeMemberProcessing}><X size={18} /></button>
              <div className="om-dialog__icon om-dialog__icon--red"><Trash2 size={24} /></div>
              <h2 className="om-dialog__title">Remove Member</h2>
              <p className="om-dialog__subtitle">This action cannot be undone</p>
            </div>
            <div className="om-dialog__content">
              <div className="om-dialog__member-card">
                <div className="om-dialog__member-avatar">
                  {removeMemberDialogMember?.user?.avatar_url ? (
                    <img src={removeMemberDialogMember.user.avatar_url} alt={removeMemberDialogMember.user.name || removeMemberDialogMember.user.email} className="om-dialog__member-avatar-img" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={20} className="text-zinc-500" />
                  )}
                </div>
                <div className="om-dialog__member-info">
                  <div className="om-dialog__member-name">{removeMemberDialogMember?.user?.name || removeMemberDialogMember?.user?.email}</div>
                  <div className="om-dialog__member-email">{removeMemberDialogMember?.user?.email}</div>
                </div>
                <span className={`om-dialog__role-value ${removeMemberDialogMember?.role === 'admin' ? 'om-dialog__role-value--admin' : ''}`}>{removeMemberDialogMember?.role}</span>
              </div>
              <div className="om-dialog__warning-box">
                <p className="om-dialog__warning-text">
                  Are you sure you want to remove <strong>{removeMemberDialogMember?.user?.name || removeMemberDialogMember?.user?.email}</strong> from the organization? They will lose access to all organization resources.
                </p>
              </div>
            </div>
            <div className="om-dialog__footer">
              <button className="om-dialog__btn om-dialog__btn--secondary" onClick={() => { setShowRemoveMemberDialog(false); setRemoveMemberDialogMember(null) }} disabled={removeMemberProcessing}>Cancel</button>
              <button className="om-dialog__btn om-dialog__btn--danger" onClick={executeRemoveMember} disabled={removeMemberProcessing}>
                {removeMemberProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                {removeMemberProcessing ? 'Removing...' : 'Remove Member'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </PageLayout>
  )
}
