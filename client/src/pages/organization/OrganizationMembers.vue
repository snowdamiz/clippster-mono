<template>
  <PageLayout
    title="Team Members"
    description="Manage your team, assign roles, and allocate credits to members"
    :show-header="true"
    :icon="Users"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Team Members' }]"
  >
    <template #actions>
      <button v-if="isAdmin" class="org-members__action-btn" @click="showInviteDialog = true">
        <UserPlus class="org-members__action-icon" />
        Add Member
      </button>
    </template>

    <div class="org-members">
      <!-- Page Heading -->
      <div class="org-members__heading">
        <h1 class="org-members__title">Team Management</h1>
        <p class="org-members__subtitle">
          Invite team members, manage roles, and allocate resources to your organization
        </p>
      </div>

      <!-- Stats Overview -->
      <div class="org-members__stats">
        <div class="org-members__stat-card">
          <div class="org-members__stat-indicator org-members__stat-indicator--members"></div>
          <div class="org-members__stat-inner">
            <div class="org-members__stat-icon org-members__stat-icon--members">
              <Users />
            </div>
            <div class="org-members__stat-text">
              <h3 class="org-members__stat-title">Active Members</h3>
              <p class="org-members__stat-desc">Currently in organization</p>
            </div>
            <div class="org-members__stat-value">{{ members.length }}</div>
          </div>
        </div>

        <div class="org-members__stat-card">
          <div class="org-members__stat-indicator org-members__stat-indicator--invitations"></div>
          <div class="org-members__stat-inner">
            <div class="org-members__stat-icon org-members__stat-icon--invitations">
              <Mail />
            </div>
            <div class="org-members__stat-text">
              <h3 class="org-members__stat-title">Pending Invitations</h3>
              <p class="org-members__stat-desc">Awaiting response</p>
            </div>
            <div class="org-members__stat-value org-members__stat-value--pending">{{ invitations.length }}</div>
          </div>
        </div>
      </div>

      <!-- Pending Invitations Section -->
      <section v-if="isAdmin && invitations.length > 0" class="org-members__section">
        <div class="org-members__section-header">
          <div class="org-members__section-header-icon">
            <Clock />
          </div>
          <div class="org-members__section-header-text">
            <h2 class="org-members__section-title">Pending Invitations</h2>
            <p class="org-members__section-subtitle">Members who haven't accepted yet</p>
          </div>
          <span class="org-members__section-badge">{{ invitations.length }}</span>
        </div>

        <div class="org-members__invitations-grid">
          <div v-for="invitation in invitations" :key="invitation.id" class="org-members__invitation-card">
            <div class="org-members__invitation-inner">
              <div class="org-members__invitation-icon">
                <Mail class="org-members__invitation-icon-svg" />
              </div>
              <div class="org-members__invitation-info">
                <div class="org-members__invitation-email">{{ invitation.email }}</div>
                <div class="org-members__invitation-meta">
                  <span
                    class="org-members__invitation-role"
                    :class="{ 'org-members__invitation-role--admin': invitation.role === 'admin' }"
                  >
                    {{ invitation.role }}
                  </span>
                  <span class="org-members__invitation-dot"></span>
                  <span class="org-members__invitation-expires">
                    <Clock class="org-members__invitation-expires-icon" />
                    {{ formatDate(invitation.expires_at) }}
                  </span>
                </div>
              </div>
              <div class="org-members__invitation-actions">
                <button
                  @click="handleResendInvitation(invitation)"
                  title="Resend invitation"
                  :disabled="resendingInvitationId === invitation.id"
                  class="org-members__invitation-action"
                >
                  <RefreshCw
                    class="org-members__invitation-action-icon"
                    :class="{ 'org-members__invitation-action-icon--spin': resendingInvitationId === invitation.id }"
                  />
                </button>
                <button
                  @click="handleCancelInvitation(invitation.id)"
                  title="Cancel invitation"
                  class="org-members__invitation-action org-members__invitation-action--danger"
                >
                  <X class="org-members__invitation-action-icon" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Active Members Section -->
      <section class="org-members__section">
        <div class="org-members__section-header">
          <div class="org-members__section-header-icon org-members__section-header-icon--members">
            <UserCheck />
          </div>
          <div class="org-members__section-header-text">
            <h2 class="org-members__section-title">Active Members</h2>
            <p class="org-members__section-subtitle">Team members with organization access</p>
          </div>
          <span class="org-members__section-badge org-members__section-badge--active">{{ members.length }}</span>
        </div>

        <div v-if="members.length > 0" class="org-members__grid">
          <div
            v-for="member in members"
            :key="member.id"
            class="org-members__card"
            :class="{
              'org-members__card--owner': member.role === 'owner',
              'org-members__card--admin': member.role === 'admin',
            }"
          >
            <div
              class="org-members__card-indicator"
              :class="{
                'org-members__card-indicator--owner': member.role === 'owner',
                'org-members__card-indicator--admin': member.role === 'admin',
              }"
            ></div>

            <div class="org-members__card-content">
              <!-- Main Row: Avatar, Info, Credits, Role, Actions -->
              <div class="org-members__card-row">
                <div class="org-members__avatar">
                  <img
                    v-if="member.user?.avatar_url && !failedAvatars.has(member.user_id)"
                    :src="member.user.avatar_url"
                    :alt="member.user.name || member.user.email"
                    class="org-members__avatar-img"
                    referrerpolicy="no-referrer"
                    @error="handleAvatarError($event, member.user_id)"
                  />
                  <div v-else class="org-members__avatar-fallback">
                    <User class="org-members__avatar-icon" />
                  </div>
                </div>

                <div class="org-members__info">
                  <div class="org-members__name">
                    {{ member.user?.name || member.user?.email || 'Unknown User' }}
                  </div>
                  <div class="org-members__email">{{ member.user?.email }}</div>
                </div>

                <!-- Credits -->
                <div class="org-members__credits">
                  <div class="org-members__credit">
                    <Zap class="org-members__credit-icon" />
                    <span class="org-members__credit-value">
                      {{ formatAllocation(member.allocation?.hours_remaining) }}
                    </span>
                    <span class="org-members__credit-unit">min</span>
                  </div>
                  <div class="org-members__credit org-members__credit--muted">
                    <TrendingUp class="org-members__credit-icon" />
                    <span class="org-members__credit-value">{{ formatAllocation(member.allocation?.hours_used) }}</span>
                    <span class="org-members__credit-unit">used</span>
                  </div>
                </div>

                <!-- Role Badge -->
                <span
                  class="org-members__role"
                  :class="{
                    'org-members__role--owner': member.role === 'owner',
                    'org-members__role--admin': member.role === 'admin',
                  }"
                >
                  <Crown v-if="member.role === 'owner'" class="org-members__role-icon" />
                  <Shield v-else-if="member.role === 'admin'" class="org-members__role-icon" />
                  <User v-else class="org-members__role-icon" />
                  {{ member.role }}
                </span>

                <!-- Actions Menu -->
                <div v-if="isAdmin && member.role !== 'owner'" class="org-members__actions">
                  <button
                    :ref="(el) => setMemberMenuButtonRef(el, member.user_id)"
                    class="org-members__menu-btn"
                    :class="{ 'org-members__menu-btn--active': openMemberMenuId === member.user_id }"
                    title="Member actions"
                    @click.stop="toggleMemberMenu(member.user_id)"
                  >
                    <MoreVertical class="org-members__menu-icon" />
                  </button>

                  <Teleport to="body">
                    <div
                      v-if="openMemberMenuId === member.user_id"
                      class="org-members__dropdown"
                      :style="getMemberMenuPosition(member.user_id)"
                      @click.stop
                    >
                      <button
                        v-if="isOrgCreatedUser(member)"
                        class="org-members__dropdown-item org-members__dropdown-item--edit"
                        @click.stop="
                          openEditMemberDialog(member);
                          closeMemberMenu();
                        "
                      >
                        <Pencil class="org-members__dropdown-icon" />
                        <span>Edit Member</span>
                      </button>
                      <button
                        class="org-members__dropdown-item"
                        @click.stop="
                          openRoleDialog(member);
                          closeMemberMenu();
                        "
                      >
                        <Shield class="org-members__dropdown-icon" />
                        <span>Change Role</span>
                      </button>
                      <div class="org-members__dropdown-divider"></div>
                      <button
                        class="org-members__dropdown-item org-members__dropdown-item--danger"
                        @click.stop="
                          confirmRemoveMember(member);
                          closeMemberMenu();
                        "
                      >
                        <Trash2 class="org-members__dropdown-icon" />
                        <span>Remove Member</span>
                      </button>
                    </div>
                  </Teleport>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="org-members__empty">
          <div class="org-members__empty-icon-wrapper">
            <Users class="org-members__empty-icon" />
          </div>
          <h3 class="org-members__empty-title">No members yet</h3>
          <p class="org-members__empty-text">Invite your team to get started collaborating!</p>
          <button v-if="isAdmin" @click="showInviteDialog = true" class="org-members__empty-btn">
            <UserPlus class="org-members__empty-btn-icon" />
            Invite First Member
          </button>
        </div>
      </section>
    </div>

    <!-- Dialogs -->
    <InviteMemberDialog
      v-model="showInviteDialog"
      :organization-id="organizationId ?? ''"
      @member-added="loadOrganization"
    />

    <!-- Change Role Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showRoleDialog" class="org-dialog__overlay" @click.self="closeRoleDialog">
          <Transition name="dialog" appear>
            <div class="org-dialog org-dialog--cyan">
              <div class="org-dialog__accent org-dialog__accent--cyan"></div>
              <div class="org-dialog__header">
                <button class="org-dialog__close" @click="closeRoleDialog" title="Close">
                  <X :size="18" />
                </button>
                <div class="org-dialog__icon org-dialog__icon--cyan">
                  <Shield :size="24" />
                </div>
                <h2 class="org-dialog__title">Change Member Role</h2>
                <p class="org-dialog__subtitle">Update role for {{ roleDialogMember?.user?.email }}</p>
              </div>

              <div class="org-dialog__content">
                <div class="org-dialog__role-change">
                  <div class="org-dialog__role-item">
                    <span class="org-dialog__role-label">Current Role</span>
                    <span
                      class="org-dialog__role-value"
                      :class="roleDialogMember?.role === 'admin' ? 'org-dialog__role-value--admin' : ''"
                    >
                      {{ roleDialogMember?.role }}
                    </span>
                  </div>
                  <div class="org-dialog__role-arrow">
                    <ArrowDown :size="18" />
                  </div>
                  <div class="org-dialog__role-item">
                    <span class="org-dialog__role-label">New Role</span>
                    <span
                      class="org-dialog__role-value"
                      :class="roleDialogNewRole === 'admin' ? 'org-dialog__role-value--admin' : ''"
                    >
                      {{ roleDialogNewRole }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="org-dialog__footer">
                <button class="org-dialog__btn org-dialog__btn--secondary" @click="closeRoleDialog">Cancel</button>
                <button class="org-dialog__btn org-dialog__btn--primary" @click="confirmRoleChange">
                  Confirm Change
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Edit Member Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showEditMemberDialog" class="org-dialog__overlay" @click.self="closeEditMemberDialog">
          <Transition name="dialog" appear>
            <div class="org-dialog org-dialog--cyan">
              <div class="org-dialog__accent org-dialog__accent--cyan"></div>
              <div class="org-dialog__header">
                <button
                  class="org-dialog__close"
                  @click="closeEditMemberDialog"
                  title="Close"
                  :disabled="editMemberSaving"
                >
                  <X :size="18" />
                </button>
                <div class="org-dialog__icon org-dialog__icon--cyan">
                  <Pencil :size="24" />
                </div>
                <h2 class="org-dialog__title">Edit Member</h2>
                <p class="org-dialog__subtitle">Update account details for {{ editMemberData.member?.user?.email }}</p>
              </div>

              <form @submit.prevent="saveEditMember" class="org-dialog__form">
                <div class="org-dialog__content">
                  <div class="org-dialog__field">
                    <label class="org-dialog__label">Name</label>
                    <input
                      v-model="editMemberData.name"
                      type="text"
                      placeholder="Enter name"
                      class="org-dialog__input"
                    />
                  </div>
                  <div class="org-dialog__field">
                    <label class="org-dialog__label">Email</label>
                    <input
                      v-model="editMemberData.email"
                      type="email"
                      placeholder="Enter email"
                      class="org-dialog__input"
                    />
                  </div>
                  <div class="org-dialog__field">
                    <label class="org-dialog__label">
                      New Password
                      <span class="org-dialog__label-hint">(leave empty to keep current)</span>
                    </label>
                    <div class="org-dialog__input-group">
                      <input
                        v-model="editMemberData.password"
                        :type="showPassword ? 'text' : 'password'"
                        placeholder="Enter new password"
                        class="org-dialog__input"
                      />
                      <button type="button" @click="showPassword = !showPassword" class="org-dialog__input-toggle">
                        <EyeOff v-if="showPassword" :size="16" />
                        <Eye v-else :size="16" />
                      </button>
                    </div>
                    <p
                      v-if="editMemberData.password && editMemberData.password.length < 8"
                      class="org-dialog__field-error"
                    >
                      Password must be at least 8 characters
                    </p>
                  </div>
                </div>

                <div class="org-dialog__footer">
                  <button
                    type="button"
                    class="org-dialog__btn org-dialog__btn--secondary"
                    @click="closeEditMemberDialog"
                    :disabled="editMemberSaving"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="org-dialog__btn org-dialog__btn--primary"
                    :disabled="editMemberSaving || !!(editMemberData.password && editMemberData.password.length < 8)"
                  >
                    <Loader2 v-if="editMemberSaving" class="org-dialog__btn-spinner" />
                    {{ editMemberSaving ? 'Saving...' : 'Save Changes' }}
                  </button>
                </div>
              </form>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Remove Member Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showRemoveMemberDialog" class="org-dialog__overlay" @click.self="closeRemoveMemberDialog">
          <Transition name="dialog" appear>
            <div class="org-dialog org-dialog--red">
              <div class="org-dialog__accent org-dialog__accent--red"></div>
              <div class="org-dialog__header">
                <button
                  class="org-dialog__close"
                  @click="closeRemoveMemberDialog"
                  title="Close"
                  :disabled="removeMemberProcessing"
                >
                  <X :size="18" />
                </button>
                <div class="org-dialog__icon org-dialog__icon--red">
                  <Trash2 :size="24" />
                </div>
                <h2 class="org-dialog__title">Remove Member</h2>
                <p class="org-dialog__subtitle">This action cannot be undone</p>
              </div>

              <div class="org-dialog__content">
                <div class="org-dialog__member-card">
                  <div class="org-dialog__member-avatar">
                    <img
                      v-if="removeMemberDialogMember?.user?.avatar_url"
                      :src="removeMemberDialogMember.user.avatar_url"
                      :alt="removeMemberDialogMember.user.name || removeMemberDialogMember.user.email"
                      class="org-dialog__member-avatar-img"
                      referrerpolicy="no-referrer"
                    />
                    <User v-else :size="20" class="org-dialog__member-avatar-icon" />
                  </div>
                  <div class="org-dialog__member-info">
                    <div class="org-dialog__member-name">
                      {{ removeMemberDialogMember?.user?.name || removeMemberDialogMember?.user?.email }}
                    </div>
                    <div class="org-dialog__member-email">{{ removeMemberDialogMember?.user?.email }}</div>
                  </div>
                  <span
                    class="org-dialog__role-value"
                    :class="removeMemberDialogMember?.role === 'admin' ? 'org-dialog__role-value--admin' : ''"
                  >
                    {{ removeMemberDialogMember?.role }}
                  </span>
                </div>

                <div class="org-dialog__warning">
                  <p class="org-dialog__warning-text">
                    Are you sure you want to remove
                    <strong>{{ removeMemberDialogMember?.user?.name || removeMemberDialogMember?.user?.email }}</strong>
                    from the organization? They will lose access to all organization resources.
                  </p>
                </div>
              </div>

              <div class="org-dialog__footer">
                <button
                  class="org-dialog__btn org-dialog__btn--secondary"
                  @click="closeRemoveMemberDialog"
                  :disabled="removeMemberProcessing"
                >
                  Cancel
                </button>
                <button
                  class="org-dialog__btn org-dialog__btn--danger"
                  @click="executeRemoveMember"
                  :disabled="removeMemberProcessing"
                >
                  <Loader2 v-if="removeMemberProcessing" class="org-dialog__btn-spinner" />
                  {{ removeMemberProcessing ? 'Removing...' : 'Remove Member' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue';
  import {
    Users,
    UserPlus,
    User,
    UserCheck,
    Mail,
    RefreshCw,
    X,
    MoreVertical,
    Pencil,
    Shield,
    Trash2,
    ArrowDown,
    Eye,
    EyeOff,
    Loader2,
    Clock,
    Crown,
    Zap,
    TrendingUp,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import InviteMemberDialog from '@/components/InviteMemberDialog.vue';
  import { useOrganization, type OrganizationMember, type OrganizationInvitation } from '@/composables/useOrganization';

  const {
    organizationId,
    members,
    invitations,
    isAdmin,
    loadOrganization,
    formatDate,
    formatAllocation,
    cancelInvitation,
    resendInvitation,
    removeMember,
    updateMemberRole,
    updateMemberAccount,
    isOrgCreatedUser,
  } = useOrganization();

  // Local state
  const showInviteDialog = ref(false);
  const failedAvatars = ref<Set<number>>(new Set());
  const resendingInvitationId = ref<number | null>(null);

  // Member menu state
  const openMemberMenuId = ref<number | null>(null);
  const memberMenuButtonRefs = ref<Map<number, HTMLElement>>(new Map());

  // Role dialog state
  const showRoleDialog = ref(false);
  const roleDialogMember = ref<OrganizationMember | null>(null);
  const roleDialogNewRole = ref<string>('');

  // Edit member dialog state
  const showEditMemberDialog = ref(false);
  const editMemberData = ref<{ member: OrganizationMember | null; name: string; email: string; password: string }>({
    member: null,
    name: '',
    email: '',
    password: '',
  });
  const editMemberSaving = ref(false);
  const showPassword = ref(false);

  // Remove member dialog state
  const showRemoveMemberDialog = ref(false);
  const removeMemberDialogMember = ref<OrganizationMember | null>(null);
  const removeMemberProcessing = ref(false);

  function handleAvatarError(event: Event, userId: number) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    failedAvatars.value.add(userId);
  }

  function formatJoinDate(dateString: string | null): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  async function handleResendInvitation(invitation: OrganizationInvitation) {
    resendingInvitationId.value = invitation.id;
    await resendInvitation(invitation);
    resendingInvitationId.value = null;
  }

  async function handleCancelInvitation(invitationId: number) {
    await cancelInvitation(invitationId);
  }

  // Member menu functions
  function setMemberMenuButtonRef(el: any, userId: number) {
    if (el) {
      memberMenuButtonRefs.value.set(userId, el);
    } else {
      memberMenuButtonRefs.value.delete(userId);
    }
  }

  function toggleMemberMenu(userId: number) {
    openMemberMenuId.value = openMemberMenuId.value === userId ? null : userId;
  }

  function closeMemberMenu() {
    openMemberMenuId.value = null;
  }

  function getMemberMenuPosition(userId: number): Record<string, string> {
    const button = memberMenuButtonRefs.value.get(userId);
    if (!button) return { top: '0px', left: '0px' };

    const rect = button.getBoundingClientRect();
    const menuWidth = 180;
    const menuMaxHeight = 120;
    const padding = 8;

    let top = rect.bottom + padding;
    let left = rect.right - menuWidth;

    if (top + menuMaxHeight > window.innerHeight - padding) {
      top = rect.top - menuMaxHeight - padding;
    }
    if (left < padding) left = padding;
    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }

    return { top: `${top}px`, left: `${left}px` };
  }

  function handleMemberMenuClickOutside(event: MouseEvent) {
    if (openMemberMenuId.value !== null) {
      const button = memberMenuButtonRefs.value.get(openMemberMenuId.value);
      if (button && button.contains(event.target as Node)) return;
      openMemberMenuId.value = null;
    }
  }

  // Role dialog functions
  function openRoleDialog(member: OrganizationMember) {
    roleDialogMember.value = member;
    roleDialogNewRole.value = member.role === 'admin' ? 'member' : 'admin';
    showRoleDialog.value = true;
  }

  function closeRoleDialog() {
    showRoleDialog.value = false;
    roleDialogMember.value = null;
    roleDialogNewRole.value = '';
  }

  async function confirmRoleChange() {
    if (!roleDialogMember.value || !roleDialogNewRole.value) return;
    const member = roleDialogMember.value;
    const newRole = roleDialogNewRole.value;
    closeRoleDialog();
    await updateMemberRole(member, newRole);
  }

  // Edit member dialog functions
  function openEditMemberDialog(member: OrganizationMember) {
    editMemberData.value = {
      member,
      name: member.user?.name || '',
      email: member.user?.email || '',
      password: '',
    };
    showPassword.value = false;
    showEditMemberDialog.value = true;
  }

  function closeEditMemberDialog() {
    showEditMemberDialog.value = false;
    editMemberData.value = { member: null, name: '', email: '', password: '' };
    showPassword.value = false;
  }

  async function saveEditMember() {
    if (!editMemberData.value.member) return;

    editMemberSaving.value = true;
    const updates: Record<string, string> = {};

    if (editMemberData.value.name !== (editMemberData.value.member.user?.name || '')) {
      updates.name = editMemberData.value.name;
    }
    if (editMemberData.value.email !== (editMemberData.value.member.user?.email || '')) {
      updates.email = editMemberData.value.email;
    }
    if (editMemberData.value.password) {
      updates.password = editMemberData.value.password;
    }

    if (Object.keys(updates).length === 0) {
      editMemberSaving.value = false;
      return;
    }

    const result = await updateMemberAccount(editMemberData.value.member, updates);
    editMemberSaving.value = false;
    if (result.success) {
      closeEditMemberDialog();
    }
  }

  // Remove member dialog functions
  function confirmRemoveMember(member: OrganizationMember) {
    removeMemberDialogMember.value = member;
    showRemoveMemberDialog.value = true;
  }

  function closeRemoveMemberDialog() {
    showRemoveMemberDialog.value = false;
    removeMemberDialogMember.value = null;
    removeMemberProcessing.value = false;
  }

  async function executeRemoveMember() {
    if (!removeMemberDialogMember.value) return;
    removeMemberProcessing.value = true;
    const result = await removeMember(removeMemberDialogMember.value);
    if (result.success) {
      closeRemoveMemberDialog();
    } else {
      removeMemberProcessing.value = false;
    }
  }

  onMounted(() => {
    document.addEventListener('click', handleMemberMenuClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleMemberMenuClickOutside);
  });
</script>

<style scoped>
  /* ===== Page Container ===== */
  .org-members {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  /* ===== Action Button ===== */
  .org-members__action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-members__action-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-members__action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-members__action-icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Page Heading ===== */
  .org-members__heading {
    margin-bottom: 0.5rem;
  }

  .org-members__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.02em;
  }

  .org-members__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Stats Overview ===== */
  .org-members__stats {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .org-members__stats {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .org-members__stat-card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .org-members__stat-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .org-members__stat-indicator {
    width: 4px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .org-members__stat-indicator--members {
    background: linear-gradient(to bottom, #10b981 0%, #059669 100%);
  }

  .org-members__stat-indicator--invitations {
    background: linear-gradient(to bottom, #f59e0b 0%, #d97706 100%);
  }

  .org-members__stat-inner {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem 1.25rem;
  }

  .org-members__stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .org-members__stat-icon svg {
    width: 20px;
    height: 20px;
  }

  .org-members__stat-icon--members {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .org-members__stat-icon--invitations {
    background-color: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .org-members__stat-text {
    flex: 1;
    min-width: 0;
  }

  .org-members__stat-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .org-members__stat-desc {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .org-members__stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: #10b981;
    letter-spacing: -0.02em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .org-members__stat-value--pending {
    color: #f59e0b;
  }

  /* ===== Section ===== */
  .org-members__section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .org-members__section-header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .org-members__section-header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .org-members__section-header-icon svg {
    width: 20px;
    height: 20px;
  }

  .org-members__section-header-icon--members {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .org-members__section-header-text {
    flex: 1;
  }

  .org-members__section-title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .org-members__section-subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .org-members__section-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #f59e0b;
    background-color: rgba(245, 158, 11, 0.15);
    border-radius: 9999px;
  }

  .org-members__section-badge--active {
    color: #10b981;
    background-color: rgba(16, 185, 129, 0.15);
  }

  /* ===== Invitations Grid ===== */
  .org-members__invitations-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 0.75rem;
  }

  @media (min-width: 768px) {
    .org-members__invitations-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .org-members__invitation-card {
    background-color: var(--sidebar-surface);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 10px;
    transition: all 200ms ease;
  }

  .org-members__invitation-card:hover {
    border-color: rgba(245, 158, 11, 0.35);
    background-color: rgba(245, 158, 11, 0.03);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  }

  .org-members__invitation-inner {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem 1.25rem;
  }

  .org-members__invitation-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(245, 158, 11, 0.12);
    flex-shrink: 0;
  }

  .org-members__invitation-icon-svg {
    width: 18px;
    height: 18px;
    color: #f59e0b;
  }

  .org-members__invitation-info {
    flex: 1;
    min-width: 0;
  }

  .org-members__invitation-email {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .org-members__invitation-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.375rem;
  }

  .org-members__invitation-dot {
    width: 3px;
    height: 3px;
    background-color: var(--sidebar-border);
    border-radius: 50%;
  }

  .org-members__invitation-expires {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .org-members__invitation-expires-icon {
    width: 12px;
    height: 12px;
  }

  .org-members__invitation-role {
    display: inline-flex;
    padding: 0.25rem 0.5rem;
    border-radius: 5px;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
  }

  .org-members__invitation-role--admin {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .org-members__invitation-actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .org-members__invitation-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-members__invitation-action:hover {
    background-color: rgba(6, 182, 212, 0.1);
    border-color: rgba(6, 182, 212, 0.3);
    color: var(--sidebar-accent);
  }

  .org-members__invitation-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-members__invitation-action--danger:hover {
    background-color: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  .org-members__invitation-action-icon {
    width: 14px;
    height: 14px;
  }

  .org-members__invitation-action-icon--spin {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Members Grid ===== */
  .org-members__grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ===== Member Card ===== */
  .org-members__card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .org-members__card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .org-members__card-indicator {
    width: 3px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .org-members__card-indicator--owner {
    background: linear-gradient(to bottom, #f59e0b 0%, #d97706 100%);
  }

  .org-members__card-indicator--admin {
    background: linear-gradient(to bottom, #06b6d4 0%, #0891b2 100%);
  }

  .org-members__card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0.875rem 1rem;
  }

  .org-members__card-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .org-members__avatar {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    flex-shrink: 0;
    overflow: hidden;
    background-color: var(--sidebar-hover);
    border: 2px solid var(--sidebar-border);
  }

  .org-members__avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-members__avatar-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, var(--sidebar-hover) 100%);
  }

  .org-members__avatar-icon {
    width: 20px;
    height: 20px;
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .org-members__info {
    flex: 1;
    min-width: 0;
  }

  .org-members__name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .org-members__email {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 0.25rem;
  }

  .org-members__actions {
    flex-shrink: 0;
  }

  .org-members__menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-members__menu-btn:hover,
  .org-members__menu-btn--active {
    background-color: var(--sidebar-hover);
    border-color: var(--sidebar-border);
    color: var(--sidebar-text);
  }

  .org-members__menu-icon {
    width: 16px;
    height: 16px;
  }

  /* ===== Credits (inline) ===== */
  .org-members__credits {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0 1rem;
    border-left: 1px solid var(--sidebar-border);
    border-right: 1px solid var(--sidebar-border);
    margin-left: auto;
  }

  @media (max-width: 640px) {
    .org-members__credits {
      display: none;
    }
  }

  .org-members__credit {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .org-members__credit-icon {
    width: 14px;
    height: 14px;
    color: var(--sidebar-accent);
  }

  .org-members__credit--muted .org-members__credit-icon {
    color: var(--sidebar-text-muted);
  }

  .org-members__credit-value {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--sidebar-accent);
    font-variant-numeric: tabular-nums;
  }

  .org-members__credit--muted .org-members__credit-value {
    font-weight: 500;
    color: var(--sidebar-text-muted);
  }

  .org-members__credit-unit {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  /* ===== Role Badge ===== */
  .org-members__role {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.3125rem 0.625rem;
    border-radius: 6px;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .org-members__role-icon {
    width: 11px;
    height: 11px;
  }

  .org-members__role--owner {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .org-members__role--admin {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  /* ===== Dropdown Menu ===== */
  .org-members__dropdown {
    position: fixed;
    z-index: 9999;
    width: 180px;
    background-color: var(--sidebar-surface);
    backdrop-filter: blur(12px);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    padding: 0.5rem;
  }

  .org-members__dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .org-members__dropdown-item:hover {
    background-color: rgba(6, 182, 212, 0.1);
    color: var(--sidebar-accent);
  }

  .org-members__dropdown-item--edit:hover {
    background-color: rgba(59, 130, 246, 0.1);
    color: #60a5fa;
  }

  .org-members__dropdown-item--danger {
    color: #f87171;
  }

  .org-members__dropdown-item--danger:hover {
    background-color: rgba(239, 68, 68, 0.1);
    color: #f87171;
  }

  .org-members__dropdown-icon {
    width: 16px;
    height: 16px;
  }

  .org-members__dropdown-divider {
    margin: 0.5rem 0;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Empty State ===== */
  .org-members__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1rem;
    text-align: center;
    background-color: var(--sidebar-surface);
    border: 1px dashed var(--sidebar-border);
    border-radius: 12px;
  }

  .org-members__empty-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, var(--sidebar-hover) 100%);
    border-radius: 20px;
    margin-bottom: 1.5rem;
  }

  .org-members__empty-icon {
    width: 32px;
    height: 32px;
    color: var(--sidebar-accent);
  }

  .org-members__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .org-members__empty-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1.5rem;
    max-width: 300px;
  }

  .org-members__empty-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-members__empty-btn:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }

  .org-members__empty-btn-icon {
    width: 18px;
    height: 18px;
  }

  /* ===== Dialog Overlay ===== */
  .org-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  /* ===== Dialog Container ===== */
  .org-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Dialog Accent Bar ===== */
  .org-dialog__accent {
    height: 3px;
    flex-shrink: 0;
  }

  .org-dialog__accent--cyan {
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  }

  .org-dialog__accent--red {
    background: linear-gradient(90deg, #ef4444, rgba(239, 68, 68, 0.5));
  }

  /* ===== Dialog Header ===== */
  .org-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .org-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .org-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    margin-bottom: 0.875rem;
  }

  .org-dialog__icon--cyan {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .org-dialog__icon--red {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .org-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .org-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Dialog Content ===== */
  .org-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0 1.5rem;
  }

  .org-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .org-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .org-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Dialog Form ===== */
  .org-dialog__form {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .org-dialog__form .org-dialog__content {
    padding-bottom: 0;
  }

  /* ===== Dialog Footer ===== */
  .org-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
    margin-top: 1rem;
  }

  /* ===== Dialog Buttons ===== */
  .org-dialog__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .org-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .org-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .org-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-dialog__btn--danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
  }

  .org-dialog__btn--danger:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-dialog__btn-spinner {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Role Change Styles ===== */
  .org-dialog__role-change {
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
  }

  .org-dialog__role-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.625rem 0.75rem;
    background-color: var(--sidebar-surface);
    border-radius: 6px;
  }

  .org-dialog__role-label {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
  }

  .org-dialog__role-value {
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .org-dialog__role-value--admin {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .org-dialog__role-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0;
    color: var(--sidebar-text-muted);
    opacity: 0.5;
  }

  /* ===== Form Field Styles ===== */
  .org-dialog__field {
    margin-bottom: 1rem;
  }

  .org-dialog__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin-bottom: 0.5rem;
  }

  .org-dialog__label-hint {
    color: var(--sidebar-text-muted);
    font-weight: 400;
    font-size: 0.8125rem;
  }

  .org-dialog__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .org-dialog__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .org-dialog__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .org-dialog__input-group {
    position: relative;
  }

  .org-dialog__input-group .org-dialog__input {
    padding-right: 3rem;
  }

  .org-dialog__input-toggle {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    padding: 0.25rem;
    transition: color 150ms ease;
  }

  .org-dialog__input-toggle:hover {
    color: var(--sidebar-text);
  }

  .org-dialog__field-error {
    font-size: 0.75rem;
    color: #fbbf24;
    margin: 0.375rem 0 0;
  }

  /* ===== Member Card (Remove Dialog) ===== */
  .org-dialog__member-card {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .org-dialog__member-avatar {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background-color: var(--sidebar-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .org-dialog__member-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-dialog__member-avatar-icon {
    color: var(--sidebar-text-muted);
  }

  .org-dialog__member-info {
    flex: 1;
    min-width: 0;
  }

  .org-dialog__member-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .org-dialog__member-email {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 0.125rem;
  }

  /* ===== Warning Box ===== */
  .org-dialog__warning {
    padding: 1rem;
    background-color: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.15);
    border-radius: 8px;
  }

  .org-dialog__warning-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    line-height: 1.6;
    margin: 0;
  }

  .org-dialog__warning-text strong {
    color: var(--sidebar-text);
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
