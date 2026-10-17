<template>
  <PageLayout
    title="Members"
    description="Manage your team, assign roles, and allocate credits to members"
    :icon="Users"
    :breadcrumbs="[{ label: 'Organization' }, { label: 'Members' }]"
  >
    <template #firstBreadcrumb>
      <OrganizationBreadcrumb />
    </template>
    <template #badge>
      <Badge
        v-if="isAdmin && hasActiveSubscription && seatsRemaining != null"
        :variant="seatsRemaining === 0 ? 'danger' : seatsRemaining <= 2 ? 'warning' : 'neutral'"
        :title="totalSeats ? `${currentMembers} of ${totalSeats} seats used` : undefined"
      >
        {{ seatsRemaining }} {{ seatsRemaining === 1 ? 'seat' : 'seats' }} left
      </Badge>
    </template>
    <template #actions>
      <Button
        v-if="isAdmin"
        variant="primary"
        size="sm"
        :title="!canAddMembers ? 'Seat limit reached' : 'Add a new member'"
        @click="handleAddMemberClick"
      >
        <UserPlus />
        Add member
      </Button>
    </template>

    <div class="flex flex-col gap-6 px-5 py-4">
      <!-- Stats -->
      <StatGrid :count="3">
        <StatCard
          label="Members"
          :value="members.length"
          :hint="hasActiveSubscription && totalSeats ? `${members.length} of ${totalSeats} seats used` : 'Currently in organization'"
          :icon="Users"
        />
        <StatCard label="Invitations" :value="invitations.length" hint="Awaiting response" :icon="Mail" />
        <StatCard
          label="Restricted"
          :value="restrictedMembersCount"
          hint="Members with limited access"
          :icon="ShieldOff"
          :tone="restrictedMembersCount > 0 ? 'warning' : 'neutral'"
        />
      </StatGrid>

      <!-- Pending invitations -->
      <section v-if="isAdmin && invitations.length > 0" class="flex flex-col gap-2.5">
        <SectionHeader title="Pending invitations" :count="invitations.length" />
        <ul class="overflow-hidden rounded-xl border border-line-subtle bg-surface">
          <li
            v-for="invitation in invitations"
            :key="invitation.id"
            class="flex items-center gap-2.5 border-b border-line-subtle px-4 py-2 last:border-b-0"
          >
            <Avatar :icon="Mail" size="sm" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-fg">{{ invitation.email }}</p>
              <p class="flex items-center gap-1 text-xs text-fg-subtle">
                <Clock class="size-3" />
                Expires {{ formatDate(invitation.expires_at) }}
              </p>
            </div>
            <OrgRoleBadge :role="invitation.role" />
            <div class="flex shrink-0 items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                title="Resend invitation"
                aria-label="Resend invitation"
                :disabled="resendingInvitationId === invitation.id"
                @click="handleResendInvitation(invitation)"
              >
                <RefreshCw :class="{ 'animate-spin': resendingInvitationId === invitation.id }" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Cancel invitation"
                aria-label="Cancel invitation"
                class="hover:bg-danger-soft hover:text-danger"
                @click="handleCancelInvitation(invitation.id)"
              >
                <X />
              </Button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Members -->
      <section class="flex flex-col gap-2.5">
        <SectionHeader title="Members" :count="members.length" />

        <div v-if="members.length > 0" class="@container overflow-hidden rounded-xl border border-line-subtle bg-surface">
          <div
            class="eyebrow hidden grid-cols-[minmax(0,1fr)_8rem_9.5rem_1.75rem] items-center gap-3 border-b border-line-subtle px-4 py-2 @[36rem]:grid"
          >
            <span>Member</span>
            <span>Credits</span>
            <span>Role</span>
            <span />
          </div>
          <div
            v-for="member in members"
            :key="member.id"
            class="grid grid-cols-[minmax(0,1fr)_auto_1.75rem] items-center gap-3 border-b border-line-subtle px-4 py-2 last:border-b-0 @[36rem]:grid-cols-[minmax(0,1fr)_8rem_9.5rem_1.75rem]"
          >
            <OrgUserCell :user="member.user" />

            <div class="hidden min-w-0 @[36rem]:block">
              <p class="tabular truncate text-sm font-medium text-fg">
                {{ formatAllocation(member.allocation?.hours_remaining) }}
                <span class="text-xs font-normal text-fg-muted">min left</span>
              </p>
              <p class="tabular text-2xs text-fg-subtle">{{ formatAllocation(member.allocation?.hours_used) }} used</p>
            </div>

            <div class="flex min-w-0 flex-wrap items-center gap-1.5">
              <OrgRoleBadge :role="member.role" />
              <Badge v-if="member.is_restricted" variant="warning" title="This member has restricted access">
                <Lock />
                Restricted
              </Badge>
            </div>

            <DropdownMenu v-if="isAdmin && member.role !== 'owner'">
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon-sm" title="Member actions" aria-label="Member actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-52">
                <DropdownMenuItem v-if="isOrgCreatedUser(member)" @select="openEditMemberDialog(member)">
                  <Pencil />
                  Edit member
                </DropdownMenuItem>
                <DropdownMenuItem @select="openRoleDialog(member)">
                  <Shield />
                  Change role
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  :disabled="togglingRestrictionId === member.user_id"
                  @select.prevent="toggleMemberRestriction(member)"
                >
                  <Lock />
                  <span class="flex-1">Restricted</span>
                  <Switch :model-value="!!member.is_restricted" class="pointer-events-none" tabindex="-1" />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  class="text-danger focus:bg-danger-soft [&>svg]:!text-danger"
                  @select="confirmRemoveMember(member)"
                >
                  <Trash2 />
                  Remove member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span v-else />
          </div>
        </div>

        <!-- Empty -->
        <EmptyState
          v-else
          :icon="Users"
          size="sm"
          title="No members yet"
          description="Invite your team to start collaborating."
        >
          <Button v-if="isAdmin" variant="secondary" size="sm" @click="showInviteDialog = true">
            <UserPlus />
            Invite first member
          </Button>
        </EmptyState>
      </section>
    </div>

    <!-- Dialogs -->
    <InviteMemberDialog
      v-model="showInviteDialog"
      :organization-id="organizationId ?? ''"
      @member-added="() => loadOrganization(true)"
    />

    <!-- Seat limit reached -->
    <Modal
      :open="showSeatLimitDialog"
      title="Seat limit reached"
      description="Upgrade your subscription to add more members."
      :icon="Users"
      tone="warning"
      size="sm"
      @close="showSeatLimitDialog = false"
    >
      <p class="text-sm text-fg-muted">
        Your organization is using
        <span class="font-medium text-fg">{{ currentMembers }} of {{ totalSeats }}</span>
        available seats. To add more team members, upgrade your plan or purchase a seat add-on.
      </p>
      <template #footer>
        <Button variant="ghost" @click="showSeatLimitDialog = false">Close</Button>
        <router-link
          :to="`/organization/${organizationId}/billing`"
          :class="buttonVariants({ variant: 'primary' })"
          @click="showSeatLimitDialog = false"
        >
          View plans
        </router-link>
      </template>
    </Modal>

    <!-- Change role -->
    <Modal
      :open="showRoleDialog"
      title="Change member role"
      :description="`Update the role for ${roleDialogMember?.user?.name || roleDialogMember?.user?.email || 'this member'}.`"
      :icon="Shield"
      size="sm"
      @close="closeRoleDialog"
    >
      <div class="flex items-center gap-3">
        <div class="flex flex-1 flex-col items-start gap-1">
          <span class="text-2xs text-fg-subtle">Current role</span>
          <OrgRoleBadge :role="roleDialogMember?.role" size="md" />
        </div>
        <ArrowRight class="size-4 shrink-0 text-fg-subtle" />
        <div class="flex flex-1 flex-col items-start gap-1">
          <span class="text-2xs text-fg-subtle">New role</span>
          <OrgRoleBadge :role="roleDialogNewRole" size="md" />
        </div>
      </div>
      <template #footer>
        <Button variant="ghost" @click="closeRoleDialog">Cancel</Button>
        <Button variant="primary" @click="confirmRoleChange">Change role</Button>
      </template>
    </Modal>

    <!-- Edit member -->
    <Modal
      :open="showEditMemberDialog"
      title="Edit member"
      :description="`Update account details for ${editMemberData.member?.user?.email || 'this member'}.`"
      :icon="Pencil"
      :dismissible="!editMemberSaving"
      @close="closeEditMemberDialog"
    >
      <form id="org-edit-member-form" class="flex flex-col gap-4" @submit.prevent="saveEditMember">
        <Field label="Name" for="org-edit-member-name">
          <Input id="org-edit-member-name" v-model="editMemberData.name" type="text" placeholder="Enter name" />
        </Field>
        <Field label="Email" for="org-edit-member-email">
          <Input id="org-edit-member-email" v-model="editMemberData.email" type="email" placeholder="Enter email" />
        </Field>
        <Field
          label="New password"
          for="org-edit-member-password"
          hint="Leave empty to keep the current password."
          :error="editMemberData.password && editMemberData.password.length < 8 ? 'Password must be at least 8 characters' : null"
        >
          <div class="relative">
            <Input
              id="org-edit-member-password"
              v-model="editMemberData.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Enter new password"
              class="pr-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              class="absolute right-1.5 top-1/2 -translate-y-1/2"
              :title="showPassword ? 'Hide password' : 'Show password'"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" />
              <Eye v-else />
            </Button>
          </div>
        </Field>
      </form>
      <template #footer>
        <Button variant="ghost" :disabled="editMemberSaving" @click="closeEditMemberDialog">Cancel</Button>
        <Button
          type="submit"
          form="org-edit-member-form"
          variant="primary"
          :loading="editMemberSaving"
          :disabled="editMemberSaving || !!(editMemberData.password && editMemberData.password.length < 8)"
        >
          {{ editMemberSaving ? 'Saving…' : 'Save changes' }}
        </Button>
      </template>
    </Modal>

    <!-- Remove member -->
    <Modal
      :open="showRemoveMemberDialog"
      title="Remove member"
      description="They will lose access to all organization resources."
      :icon="Trash2"
      tone="danger"
      size="sm"
      :dismissible="!removeMemberProcessing"
      @close="closeRemoveMemberDialog"
    >
      <div class="flex items-center gap-3">
        <OrgUserCell :user="removeMemberDialogMember?.user" class="flex-1" />
        <OrgRoleBadge :role="removeMemberDialogMember?.role" />
      </div>
      <p class="mt-3 text-sm text-fg-muted">
        Are you sure you want to remove
        <span class="font-medium text-fg">
          {{ removeMemberDialogMember?.user?.name || removeMemberDialogMember?.user?.email }}
        </span>
        from the organization? This action cannot be undone.
      </p>
      <template #footer>
        <Button variant="ghost" :disabled="removeMemberProcessing" @click="closeRemoveMemberDialog">Cancel</Button>
        <Button variant="destructive" :loading="removeMemberProcessing" @click="executeRemoveMember">
          {{ removeMemberProcessing ? 'Removing…' : 'Remove member' }}
        </Button>
      </template>
    </Modal>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue';
  import {
    Users,
    UserPlus,
    Mail,
    RefreshCw,
    X,
    MoreHorizontal,
    Pencil,
    Shield,
    Trash2,
    ArrowRight,
    Eye,
    EyeOff,
    Clock,
    Lock,
    ShieldOff,
  } from 'lucide-vue-next';
  import api from '@/services/api';
  import PageLayout from '@/components/PageLayout.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button, buttonVariants } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Avatar } from '@/components/ui/avatar';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import { StatCard, StatGrid } from '@/components/ui/stat-card';
  import { Switch } from '@/components/ui/switch';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import OrgRoleBadge from './components/OrgRoleBadge.vue';
  import OrgUserCell from './components/OrgUserCell.vue';
  import InviteMemberDialog from '@/components/InviteMemberDialog.vue';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import { useOrganization, type OrganizationMember, type OrganizationInvitation } from '@/composables/useOrganization';

  const {
    organizationId,
    members,
    invitations,
    isAdmin,
    subscription,
    hasActiveSubscription,
    totalSeats,
    currentMembers,
    seatsRemaining,
    canAddMembers,
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

  // Computed properties
  const restrictedMembersCount = computed(() => members.value.filter((m) => m.is_restricted).length);

  // Local state
  const showInviteDialog = ref(false);
  const showSeatLimitDialog = ref(false);
  const resendingInvitationId = ref<number | null>(null);

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

  // Restriction toggle state
  const togglingRestrictionId = ref<number | null>(null);

  function handleAddMemberClick() {
    if (!canAddMembers.value) {
      showSeatLimitDialog.value = true;
    } else {
      showInviteDialog.value = true;
    }
  }

  async function handleResendInvitation(invitation: OrganizationInvitation) {
    resendingInvitationId.value = invitation.id;
    await resendInvitation(invitation);
    resendingInvitationId.value = null;
  }

  async function handleCancelInvitation(invitationId: number) {
    await cancelInvitation(invitationId);
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

  // Restriction toggle function
  async function toggleMemberRestriction(member: OrganizationMember) {
    if (!organizationId.value) return;
    
    togglingRestrictionId.value = member.user_id;
    const newIsRestricted = !member.is_restricted;
    
    try {
      const response = await api.put(
        `/organizations/${organizationId.value}/members/${member.user_id}/restrictions`,
        { is_restricted: newIsRestricted }
      );
      
      if (response.data.success) {
        // Reload organization to refresh member data
        await loadOrganization(true);
      } else {
        console.error('Failed to toggle restriction:', response.data.error);
      }
    } catch (error) {
      console.error('Error toggling restriction:', error);
    } finally {
      togglingRestrictionId.value = null;
    }
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
</script>

