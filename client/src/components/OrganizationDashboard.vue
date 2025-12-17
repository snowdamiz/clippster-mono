<template>
  <div class="w-full">
    <!-- Page Header - Always Visible -->
    <div class="mb-8 -mt-2">
      <div class="relative rounded-lg bg-card border border-border p-3 shadow-sm">
        <div class="absolute inset-0 bg-gradient-to-r from-primary/3 to-primary/1 pointer-events-none rounded-lg"></div>

        <div class="relative flex items-center justify-between">
          <div class="flex items-center gap-4">
            <!-- Organization Logo -->
            <div
              class="p-3 bg-background/80 backdrop-blur-sm rounded-lg border border-border/50 shadow-sm flex-shrink-0"
            >
              <Building2 class="h-6 w-6 text-primary" />
            </div>

            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-xl font-bold text-foreground tracking-tight">
                  {{ organization?.name || 'Organization' }}
                </h1>
                <!-- Role Badge with Loading State -->
                <span
                  v-if="loading"
                  class="px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground flex items-center gap-1.5"
                >
                  <Loader2 class="h-3 w-3 animate-spin" />
                </span>
                <span
                  v-else-if="role"
                  :class="[
                    'px-2 py-0.5 rounded-md text-xs font-medium',
                    role === 'owner'
                      ? 'bg-amber-500/20 text-amber-500'
                      : role === 'admin'
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground',
                  ]"
                >
                  {{ role }}
                </span>
              </div>
              <p class="text-sm text-muted-foreground mt-0.5">
                {{ organization?.description || 'Manage your team and organization settings' }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 mr-1">
            <Button v-if="!loading && isAdmin" size="sm" @click="showInviteDialog = true">
              <UserPlus class="h-4 w-4 mr-1.5" />
              Add Member
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="text-center py-20 bg-card border border-border rounded-xl">
      <AlertTriangle class="h-12 w-12 text-destructive mx-auto mb-4" />
      <h2 class="text-xl font-bold text-foreground mb-2">Failed to load organization</h2>
      <p class="text-muted-foreground mb-4">{{ error }}</p>
      <Button @click="loadOrganization">Try Again</Button>
    </div>

    <!-- Tabs - Always Visible -->
    <template v-else>
      <div class="flex gap-1 mb-6 bg-muted/50 p-1 rounded-lg w-fit border border-border/50">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :disabled="loading"
          :class="[
            'px-4 py-2 rounded-md text-sm font-medium transition-all',
            activeTab === tab.id
              ? 'bg-background text-foreground shadow-sm border border-border/50'
              : 'text-muted-foreground hover:text-foreground',
            loading ? 'opacity-70 cursor-not-allowed' : '',
          ]"
        >
          <span class="flex items-center gap-2">
            <component :is="tab.icon" class="h-4 w-4" />
            {{ tab.label }}
          </span>
        </button>
      </div>

      <!-- Tab Content -->
      <div class="bg-card border border-border rounded-xl shadow-sm">
        <!-- Loading Skeleton for Tab Content -->
        <div v-if="loading" class="p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="h-5 w-32 bg-muted/50 rounded animate-pulse"></div>
            <div class="h-4 w-16 bg-muted/50 rounded animate-pulse"></div>
          </div>
          <div class="space-y-2">
            <div
              v-for="i in 3"
              :key="i"
              class="flex items-center gap-4 p-4 bg-muted/20 border border-border/30 rounded-lg animate-pulse"
            >
              <div class="w-10 h-10 rounded-full bg-muted/50"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 w-40 bg-muted/50 rounded"></div>
                <div class="h-3 w-56 bg-muted/50 rounded"></div>
              </div>
              <div class="h-6 w-16 bg-muted/50 rounded"></div>
            </div>
          </div>
        </div>
        <!-- Members Tab -->
        <div v-else-if="activeTab === 'members'" class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-foreground">Team Members</h2>
            <span class="text-sm text-muted-foreground">{{ members.length }} total</span>
          </div>

          <div class="space-y-2">
            <div
              v-for="member in members"
              :key="member.id"
              class="flex items-center gap-4 p-4 bg-muted/30 border border-border/50 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden relative">
                <img
                  v-if="member.user?.avatar_url && !failedAvatars.has(member.user_id)"
                  :src="member.user.avatar_url"
                  :alt="member.user.name || member.user.email"
                  class="w-full h-full object-cover absolute inset-0 z-20"
                  referrerpolicy="no-referrer"
                  @error="handleAvatarError($event, member.user_id)"
                />
                <div v-else class="absolute inset-0 bg-gradient-to-br from-primary/20 via-muted/30 to-primary/10"></div>
                <User
                  v-if="!member.user?.avatar_url || failedAvatars.has(member.user_id)"
                  class="h-5 w-5 text-muted-foreground relative z-10"
                />
              </div>

              <div class="flex-1 min-w-0">
                <div class="font-medium text-foreground">
                  {{ member.user?.name || member.user?.email || 'Unknown User' }}
                </div>
                <div class="text-sm text-muted-foreground">{{ member.user?.email }}</div>
              </div>

              <span
                :class="[
                  'px-2.5 py-1 rounded-md text-xs font-medium',
                  member.role === 'owner'
                    ? 'bg-amber-500/20 text-amber-500'
                    : member.role === 'admin'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground',
                ]"
              >
                {{ member.role }}
              </span>

              <div v-if="isAdmin && member.role !== 'owner'" class="flex gap-1">
                <Button variant="ghost" size="icon" @click="openRoleDialog(member)" title="Change role">
                  <Shield class="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  @click="confirmRemoveMember(member)"
                  title="Remove member"
                  class="text-destructive hover:text-destructive"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div v-if="members.length === 0" class="text-center py-12 text-muted-foreground">
              <Users class="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No members yet. Invite your team to get started!</p>
            </div>
          </div>
        </div>

        <!-- Invitations Tab -->
        <div v-if="activeTab === 'invitations'" class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-foreground">Pending Invitations</h2>
            <span class="text-sm text-muted-foreground">{{ invitations.length }} pending</span>
          </div>

          <div class="space-y-2">
            <div
              v-for="invitation in invitations"
              :key="invitation.id"
              class="flex items-center gap-4 p-4 bg-muted/30 border border-border/50 rounded-lg"
            >
              <div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Mail class="h-5 w-5 text-muted-foreground" />
              </div>

              <div class="flex-1 min-w-0">
                <div class="font-medium text-foreground">{{ invitation.email }}</div>
                <div class="text-sm text-muted-foreground">Expires {{ formatDate(invitation.expires_at) }}</div>
              </div>

              <span
                :class="[
                  'px-2.5 py-1 rounded-md text-xs font-medium',
                  invitation.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                ]"
              >
                {{ invitation.role }}
              </span>

              <Button
                variant="ghost"
                size="icon"
                @click="cancelInvitation(invitation.id)"
                title="Cancel invitation"
                class="text-destructive hover:text-destructive"
              >
                <X class="h-4 w-4" />
              </Button>
            </div>

            <div v-if="invitations.length === 0" class="text-center py-12 text-muted-foreground">
              <Mail class="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No pending invitations</p>
            </div>
          </div>
        </div>

        <!-- Credits Tab -->
        <div v-if="activeTab === 'credits'" class="p-6">
          <h2 class="text-base font-semibold text-foreground mb-4">Organization Credits</h2>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div class="bg-muted/30 border border-border/50 rounded-lg p-4">
              <div class="text-sm text-muted-foreground mb-1">Pool Balance</div>
              <div class="text-2xl font-bold text-foreground">{{ credits.hoursRemaining }} hrs</div>
            </div>
            <div class="bg-muted/30 border border-border/50 rounded-lg p-4">
              <div class="text-sm text-muted-foreground mb-1">Used</div>
              <div class="text-2xl font-bold text-foreground">{{ credits.hoursUsed }} hrs</div>
            </div>
            <div class="bg-muted/30 border border-border/50 rounded-lg p-4">
              <div class="text-sm text-muted-foreground mb-1">My Allocation</div>
              <div class="text-2xl font-bold text-foreground">
                {{ myAllocation ? myAllocation.hoursRemaining : '0' }} hrs
              </div>
            </div>
          </div>

          <div v-if="isAdmin">
            <h3 class="text-sm font-semibold text-foreground mb-4">Member Allocations</h3>
            <div class="space-y-2">
              <div
                v-for="member in members"
                :key="member.id"
                class="flex items-center gap-4 p-4 bg-muted/30 border border-border/50 rounded-lg"
              >
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-foreground">
                    {{ member.user?.name || member.user?.email }}
                  </div>
                </div>
                <Input
                  type="number"
                  v-model="allocations[member.user_id]"
                  min="0"
                  step="0.5"
                  placeholder="0"
                  class="w-24 text-right"
                />
                <span class="text-muted-foreground text-sm">hrs</span>
                <Button size="sm" @click="allocateCredits(member.user_id)">Allocate</Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Settings Tab -->
        <div v-if="activeTab === 'settings'" class="p-6 space-y-6">
          <!-- General Settings Section -->
          <div class="space-y-4">
            <div class="flex items-center gap-3 mb-4">
              <div class="p-2 bg-primary/10 rounded-lg">
                <Settings class="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 class="text-base font-semibold text-foreground">General Settings</h2>
                <p class="text-xs text-muted-foreground">Manage your organization's basic information</p>
              </div>
            </div>

            <form @submit.prevent="updateOrganization" class="space-y-5">
              <!-- Organization Name -->
              <div class="space-y-2">
                <label class="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Type class="h-3.5 w-3.5 text-muted-foreground" />
                  Organization Name
                </label>
                <Input v-model="editData.name" placeholder="Enter organization name" class="max-w-md" />
                <p class="text-xs text-muted-foreground">This is the name displayed to all team members</p>
              </div>

              <!-- Description -->
              <div class="space-y-2">
                <label class="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FileText class="h-3.5 w-3.5 text-muted-foreground" />
                  Description
                </label>
                <textarea
                  v-model="editData.description"
                  rows="3"
                  placeholder="What does your organization do?"
                  class="flex w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
                <p class="text-xs text-muted-foreground">
                  A brief description to help team members understand your organization's purpose
                </p>
              </div>

              <!-- Save Button -->
              <div class="flex items-center gap-3 pt-2">
                <Button type="submit" :disabled="saving || !hasChanges">
                  <Loader2 v-if="saving" class="h-4 w-4 mr-2 animate-spin" />
                  <Save v-else class="h-4 w-4 mr-2" />
                  {{ saving ? 'Saving...' : 'Save Changes' }}
                </Button>
                <Transition name="fade">
                  <span v-if="saveSuccess" class="text-sm text-green-500 flex items-center gap-1.5">
                    <CheckCircle class="h-4 w-4" />
                    Changes saved
                  </span>
                </Transition>
              </div>
            </form>
          </div>

          <!-- Danger Zone -->
          <div v-if="role === 'owner'" class="pt-6 border-t border-border">
            <div class="bg-destructive/5 border border-destructive/20 rounded-lg p-5">
              <div class="flex items-start gap-4">
                <div class="p-2 bg-destructive/10 rounded-lg flex-shrink-0">
                  <AlertTriangle class="h-5 w-5 text-destructive" />
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="text-sm font-semibold text-destructive mb-1">Danger Zone</h3>
                  <p class="text-sm text-muted-foreground mb-4">
                    Once you delete an organization, there is no going back. All members will be removed and this action
                    cannot be undone.
                  </p>
                  <Button variant="destructive" size="sm" @click="confirmDeleteOrg">
                    <Trash2 class="h-4 w-4 mr-2" />
                    Delete Organization
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Invite Member Dialog -->
    <InviteMemberDialog v-model="showInviteDialog" :organization-id="organizationId" @member-added="loadOrganization" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import {
    Building2,
    Users,
    Mail,
    CreditCard,
    Settings,
    UserPlus,
    User,
    Shield,
    Trash2,
    X,
    Loader2,
    AlertTriangle,
    Type,
    FileText,
    Save,
    CheckCircle,
  } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import InviteMemberDialog from './InviteMemberDialog.vue';

  const route = useRoute();
  const router = useRouter();
  const authStore = useAuthStore();

  // Track failed avatar images to show fallback
  const failedAvatars = ref<Set<number>>(new Set());

  function handleAvatarError(event: Event, userId: number) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    failedAvatars.value.add(userId);
  }

  const organizationId = computed(() => (route.params.id as string) || authStore.user?.owned_organization_id);

  const loading = ref(true);
  const error = ref('');
  const saving = ref(false);
  const saveSuccess = ref(false);

  const organization = ref<any>(null);
  const members = ref<any[]>([]);
  const invitations = ref<any[]>([]);
  const credits = ref({ hoursRemaining: '0', hoursUsed: '0' });
  const myAllocation = ref<any>(null);
  const role = ref<string>('');
  const allocations = ref<Record<number, number>>({});

  const activeTab = ref('members');
  const showInviteDialog = ref(false);

  const editData = ref({
    name: '',
    description: '',
  });

  const tabs = [
    { id: 'members', label: 'Members', icon: Users },
    { id: 'invitations', label: 'Invitations', icon: Mail },
    { id: 'credits', label: 'Credits', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const isAdmin = computed(() => role.value === 'owner' || role.value === 'admin');

  const hasChanges = computed(() => {
    if (!organization.value) return false;
    return (
      editData.value.name !== organization.value.name ||
      editData.value.description !== (organization.value.description || '')
    );
  });

  onMounted(() => {
    loadOrganization();
  });

  watch(organizationId, () => {
    if (organizationId.value) {
      loadOrganization();
    }
  });

  async function loadOrganization() {
    if (!organizationId.value) {
      error.value = 'No organization found';
      loading.value = false;
      return;
    }

    loading.value = true;
    error.value = '';

    try {
      // Load organization details
      const orgResult = await authStore.getOrganization(organizationId.value);
      if (orgResult.success) {
        organization.value = orgResult.organization;
        role.value = orgResult.role;
        editData.value = {
          name: orgResult.organization.name,
          description: orgResult.organization.description || '',
        };
      } else {
        throw new Error(orgResult.error);
      }

      // Load members
      const membersResult = await authStore.getOrganizationMembers(organizationId.value);
      if (membersResult.success) {
        members.value = membersResult.members;
      }

      // Load invitations (if admin)
      if (isAdmin.value) {
        const invitesResult = await authStore.getOrganizationInvitations(organizationId.value);
        if (invitesResult.success) {
          invitations.value = invitesResult.invitations;
        }
      }

      // Load credits
      const creditsResult = await authStore.getOrganizationCredits(organizationId.value);
      if (creditsResult.success) {
        credits.value = {
          hoursRemaining: creditsResult.org_credits.hours_remaining,
          hoursUsed: creditsResult.org_credits.hours_used,
        };
        myAllocation.value = creditsResult.my_allocation;
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to load organization';
    } finally {
      loading.value = false;
    }
  }

  async function updateOrganization() {
    if (!organizationId.value) return;

    saving.value = true;
    saveSuccess.value = false;

    try {
      const result = await authStore.updateOrganization(organizationId.value, editData.value);
      if (result.success) {
        organization.value = result.organization;
        saveSuccess.value = true;
        // Hide success message after 3 seconds
        setTimeout(() => {
          saveSuccess.value = false;
        }, 3000);
      }
    } catch (err: any) {
      console.error('Failed to update organization:', err);
    } finally {
      saving.value = false;
    }
  }

  async function cancelInvitation(invitationId: number) {
    try {
      await authStore.cancelOrganizationInvitation(organizationId.value, invitationId);
      invitations.value = invitations.value.filter((i) => i.id !== invitationId);
    } catch (err) {
      console.error('Failed to cancel invitation:', err);
    }
  }

  async function confirmRemoveMember(member: any) {
    if (confirm(`Remove ${member.user?.email} from the organization?`)) {
      try {
        await authStore.removeOrganizationMember(organizationId.value, member.user_id);
        members.value = members.value.filter((m) => m.id !== member.id);
      } catch (err) {
        console.error('Failed to remove member:', err);
      }
    }
  }

  function openRoleDialog(member: any) {
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    if (confirm(`Change ${member.user?.email}'s role to ${newRole}?`)) {
      authStore
        .updateOrganizationMemberRole(organizationId.value, member.user_id, newRole)
        .then(() => loadOrganization());
    }
  }

  async function allocateCredits(userId: number) {
    const hours = allocations.value[userId];
    if (!hours || hours <= 0) return;

    try {
      await authStore.allocateOrganizationCredits(organizationId.value, userId, hours);
      allocations.value[userId] = 0;
      loadOrganization();
    } catch (err) {
      console.error('Failed to allocate credits:', err);
    }
  }

  async function confirmDeleteOrg() {
    if (
      confirm(
        'Are you sure you want to delete this organization? This action cannot be undone and will remove all members.'
      )
    ) {
      try {
        await authStore.deleteOrganization(organizationId.value);
        router.push('/projects');
      } catch (err) {
        console.error('Failed to delete organization:', err);
      }
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString();
  }
</script>

<style scoped>
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
</style>
