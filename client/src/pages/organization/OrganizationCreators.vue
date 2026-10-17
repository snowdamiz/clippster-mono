<template>
  <PageLayout
    title="Creator profiles"
    description="Manage creator profiles and assign them to team members"
    :icon="UserCircle"
    :breadcrumbs="[{ label: 'Organization' }, { label: 'Creator profiles' }]"
  >
    <template #firstBreadcrumb>
      <OrganizationBreadcrumb />
    </template>
    <template #actions>
      <template v-if="isAdmin">
        <Button
          variant="secondary"
          size="sm"
          title="Add global branding profile"
          aria-label="Add global branding profile"
          @click="openProfileDialog(undefined, 'global')"
        >
          <Paintbrush />
          <span class="hidden lg:inline">Global branding</span>
        </Button>
        <Button variant="primary" size="sm" @click="openProfileDialog()">
          <Plus />
          Add profile
        </Button>
      </template>
    </template>

    <div class="flex flex-col gap-6 px-5 py-4">
      <!-- Stats -->
      <StatGrid :count="3">
        <StatCard
          label="Profiles"
          :value="creatorProfiles.length"
          :loading="initialLoading"
          hint="Created in organization"
          :icon="UserCircle"
        />
        <StatCard
          label="Platform links"
          :value="totalPlatformLinks"
          :loading="initialLoading"
          hint="Connected channels"
          :icon="Link2"
        />
        <StatCard
          label="Assigned"
          :value="totalAssignedMembers"
          :loading="initialLoading"
          hint="Using these profiles"
          :icon="Users"
        />
      </StatGrid>

      <section class="flex flex-col gap-2.5">
        <SectionHeader title="Profiles" :count="initialLoading ? undefined : creatorProfiles.length" />

        <!-- Loading -->
        <div v-if="initialLoading" class="skeleton-group grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          <div v-for="i in 4" :key="i" class="rounded-xl border border-line-subtle bg-surface p-3.5">
            <div class="flex items-center gap-3">
              <div class="skeleton size-10 shrink-0 rounded-lg" />
              <div class="flex flex-1 flex-col gap-1.5">
                <div class="skeleton h-3.5 w-2/3" />
                <div class="skeleton h-3 w-1/2" />
              </div>
            </div>
            <div class="mt-4 flex gap-1.5">
              <div v-for="j in 4" :key="j" class="skeleton size-5" />
            </div>
          </div>
        </div>

        <!-- Profiles -->
        <div
          v-else-if="creatorProfiles.length > 0"
          class="grid animate-fade-in grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3"
        >
          <article
            v-for="profile in creatorProfiles"
            :key="profile.id"
            class="flex min-w-0 flex-col rounded-xl border border-line-subtle bg-surface"
          >
            <!-- Identity -->
            <div class="flex items-start gap-3 p-3.5 pb-3">
              <span
                class="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-surface-hover text-fg-subtle"
              >
                <img
                  v-if="profile.profile_image_url"
                  :src="profile.profile_image_url"
                  :alt="profile.name"
                  class="size-full object-cover"
                />
                <Paintbrush v-else-if="profile.scope === 'global'" class="size-5" />
                <UserCircle v-else class="size-5" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex min-w-0 items-center gap-1.5">
                  <h3 class="truncate text-sm font-semibold text-fg">{{ profile.name }}</h3>
                  <Badge v-if="profile.scope === 'global'" variant="brand">Global</Badge>
                </div>
                <p class="truncate text-xs" :class="profile.description ? 'text-fg-muted' : 'text-fg-subtle'">
                  {{ profile.description || 'No description' }}
                </p>
              </div>
              <DropdownMenu v-if="isAdmin">
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon-sm" class="-mr-1.5 -mt-0.5" title="Profile actions" aria-label="Profile actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-52">
                  <DropdownMenuItem @select="openAssignmentDialog(profile)">
                    <Users />
                    Manage assignments
                  </DropdownMenuItem>
                  <DropdownMenuItem @select="openProfileDialog(profile)">
                    <Pencil />
                    Edit profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    class="text-danger focus:bg-danger-soft [&>svg]:!text-danger"
                    @select="confirmDeleteProfile(profile)"
                  >
                    <Trash2 />
                    Delete profile
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <!-- Platforms · branding · members -->
            <div class="flex min-h-9 items-center gap-2.5 px-3.5 pb-3">
              <div class="flex min-w-0 items-center gap-1">
                <template v-if="profile.platform_links.length > 0">
                  <PlatformLogo
                    v-for="link in profile.platform_links.slice(0, 4)"
                    :key="link.id"
                    :platform="link.platform"
                    size="sm"
                    :title="link.display_name || link.platform"
                  />
                  <span v-if="profile.platform_links.length > 4" class="tabular pl-0.5 text-2xs text-fg-subtle">
                    +{{ profile.platform_links.length - 4 }}
                  </span>
                </template>
                <span v-else class="text-2xs text-fg-subtle" title="No platform links">No links</span>
              </div>

              <span class="h-4 w-px shrink-0 bg-line" />

              <div class="flex items-center gap-1">
                <span
                  v-for="item in brandingItems(profile)"
                  :key="item.key"
                  class="grid size-5 place-items-center rounded-md [&_svg]:size-3"
                  :class="item.active ? 'bg-brand-soft text-brand' : 'bg-surface-hover text-fg-disabled'"
                  :title="item.title"
                >
                  <component :is="item.icon" />
                </span>
              </div>

              <div class="ml-auto flex shrink-0 items-center">
                <template v-if="profile.assignments && profile.assignments.length > 0">
                  <div class="flex -space-x-1.5">
                    <Avatar
                      v-for="assignment in profile.assignments.slice(0, 3)"
                      :key="assignment.id"
                      :src="assignment.user?.avatar_url"
                      :name="assignment.user?.name || assignment.user?.email"
                      size="xs"
                      class="ring-2 ring-[var(--surface)]"
                      :title="assignment.user?.name || assignment.user?.email || 'Member'"
                    />
                  </div>
                  <span v-if="profile.assigned_count > 3" class="tabular pl-1 text-2xs text-fg-subtle">
                    +{{ profile.assigned_count - 3 }}
                  </span>
                </template>
                <span v-else class="text-2xs text-fg-subtle">Unassigned</span>
              </div>
            </div>

            <!-- Footer -->
            <div class="mt-auto flex items-center justify-between gap-2 border-t border-line-subtle px-3.5 py-2 text-2xs text-fg-subtle">
              <span>Updated {{ formatUpdatedAt(profile.updated_at) }}</span>
              <span class="tabular">
                {{ profile.assigned_count }} {{ profile.assigned_count === 1 ? 'member' : 'members' }}
              </span>
            </div>
          </article>
        </div>

        <!-- Empty -->
        <EmptyState
          v-else
          :icon="UserCircle"
          size="sm"
          title="No creator profiles yet"
          description="Create profiles with platform links, intros, outros and watermarks to assign to your team."
        >
          <Button v-if="isAdmin" variant="secondary" size="sm" @click="openProfileDialog()">
            <Plus />
            Add profile
          </Button>
        </EmptyState>
      </section>
    </div>

    <!-- Profile Dialog -->
    <ProfileDialog
      :show="showProfileDialog"
      mode="organization"
      :organization-id="organizationId ?? ''"
      :profile="profileToEdit"
      :scope="profileDialogScope"
      @close="closeProfileDialog"
      @saved="handleProfileSaved"
    />

    <!-- Profile Assignment Dialog -->
    <ProfileAssignmentDialog
      :show="showAssignmentDialog"
      :organization-id="organizationId ?? ''"
      :profile="profileToAssign"
      @close="closeAssignmentDialog"
      @saved="handleAssignmentSaved"
    />

    <!-- Delete Profile Dialog -->
    <Modal
      :open="showDeleteDialog"
      title="Delete profile"
      description="This action cannot be undone."
      :icon="Trash2"
      tone="danger"
      size="sm"
      :dismissible="!deleteProcessing"
      @close="closeDeleteDialog"
    >
      <div class="flex items-center gap-3">
        <span class="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-hover text-fg-subtle">
          <img
            v-if="deleteDialogProfile?.profile_image_url"
            :src="deleteDialogProfile.profile_image_url"
            :alt="deleteDialogProfile.name"
            class="size-full object-cover"
          />
          <UserCircle v-else class="size-4" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-fg">{{ deleteDialogProfile?.name }}</p>
          <p class="truncate text-xs text-fg-muted">{{ deleteDialogProfile?.description || 'No description' }}</p>
        </div>
        <Badge v-if="deleteDialogProfile?.assigned_count">{{ deleteDialogProfile.assigned_count }} assigned</Badge>
      </div>
      <p class="mt-3 text-sm text-fg-muted">
        Are you sure you want to delete
        <span class="font-medium text-fg">"{{ deleteDialogProfile?.name }}"</span>?
        <span v-if="deleteDialogProfile?.assigned_count">
          This will unassign {{ deleteDialogProfile.assigned_count }}
          {{ deleteDialogProfile.assigned_count === 1 ? 'member' : 'members' }}.
        </span>
      </p>
      <template #footer>
        <Button variant="ghost" :disabled="deleteProcessing" @click="closeDeleteDialog">Cancel</Button>
        <Button variant="destructive" :loading="deleteProcessing" @click="executeDeleteProfile">
          {{ deleteProcessing ? 'Deleting…' : 'Delete profile' }}
        </Button>
      </template>
    </Modal>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import {
    UserCircle,
    Users,
    Pencil,
    Trash2,
    Play,
    SkipForward,
    Image as ImageIcon,
    Link2,
    MoreHorizontal,
    Paintbrush,
    Plus,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Avatar } from '@/components/ui/avatar';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Modal } from '@/components/ui/modal';
  import { PlatformLogo } from '@/components/ui/platform-logo';
  import { SectionHeader } from '@/components/ui/section-header';
  import { StatCard, StatGrid } from '@/components/ui/stat-card';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import ProfileDialog from '@/components/ProfileDialog.vue';
  import ProfileAssignmentDialog from '@/components/ProfileAssignmentDialog.vue';
  import {
    deleteOrganizationCreatorProfile,
    type ServerOrganizationCreatorProfile,
  } from '@/services/organizationProfilesApi';
  import { useToast } from '@/composables/useToast';
  import { useOrganization } from '@/composables/useOrganization';

  const { success: showSuccess, error: showError } = useToast();

  const { organizationId, isAdmin, creatorProfiles, profilesLoading, profilesLoaded, loadCreatorProfiles } =
    useOrganization();

  // Skeletons only until the first load lands; reloads after edits keep the grid on screen
  const initialLoading = computed(() => profilesLoading.value && !creatorProfiles.value.length);

  // Computed stats
  const totalPlatformLinks = computed(() => {
    return creatorProfiles.value.reduce((sum, p) => sum + p.platform_links.length, 0);
  });

  const totalAssignedMembers = computed(() => {
    return creatorProfiles.value.reduce((sum, p) => sum + p.assigned_count, 0);
  });

  // Local state
  const showProfileDialog = ref(false);
  const profileToEdit = ref<ServerOrganizationCreatorProfile | null>(null);
  const showAssignmentDialog = ref(false);
  const profileToAssign = ref<ServerOrganizationCreatorProfile | null>(null);

  // Delete dialog state
  const showDeleteDialog = ref(false);
  const deleteDialogProfile = ref<ServerOrganizationCreatorProfile | null>(null);
  const deleteProcessing = ref(false);

  const profileDialogScope = ref<'streamer' | 'global'>('streamer');

  function openProfileDialog(profile?: ServerOrganizationCreatorProfile, scope?: 'streamer' | 'global') {
    profileToEdit.value = profile || null;
    profileDialogScope.value = profile ? ((profile as any).scope || 'streamer') : (scope || 'streamer');
    showProfileDialog.value = true;
  }

  function closeProfileDialog() {
    showProfileDialog.value = false;
    profileToEdit.value = null;
  }

  function handleProfileSaved() {
    loadCreatorProfiles();
  }

  function openAssignmentDialog(profile: ServerOrganizationCreatorProfile) {
    profileToAssign.value = profile;
    showAssignmentDialog.value = true;
  }

  function closeAssignmentDialog() {
    showAssignmentDialog.value = false;
    profileToAssign.value = null;
  }

  function handleAssignmentSaved() {
    loadCreatorProfiles();
  }

  function confirmDeleteProfile(profile: ServerOrganizationCreatorProfile) {
    deleteDialogProfile.value = profile;
    showDeleteDialog.value = true;
  }

  function closeDeleteDialog() {
    showDeleteDialog.value = false;
    deleteDialogProfile.value = null;
    deleteProcessing.value = false;
  }

  async function executeDeleteProfile() {
    if (!organizationId.value || !isAdmin.value || !deleteDialogProfile.value) return;

    deleteProcessing.value = true;
    const profile = deleteDialogProfile.value;

    try {
      const response = await deleteOrganizationCreatorProfile(organizationId.value, profile.id);
      if (response.success) {
        creatorProfiles.value = creatorProfiles.value.filter((p) => p.id !== profile.id);
        showSuccess('Profile deleted', `"${profile.name}" has been deleted`);
        closeDeleteDialog();
      } else {
        showError('Delete failed', response.error || 'Failed to delete profile');
        deleteProcessing.value = false;
      }
    } catch (err: any) {
      showError('Delete failed', err.message || 'Failed to delete profile');
      deleteProcessing.value = false;
    }
  }

  function formatUpdatedAt(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);

      if (diffSec < 60) return 'just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
      if (diffSec < 2592000) return `${Math.floor(diffSec / 604800)}w ago`;
      return `${Math.floor(diffSec / 2592000)}mo ago`;
    } catch {
      return '';
    }
  }

  // Intro / outro / watermark indicators shown on each card
  function brandingItems(profile: ServerOrganizationCreatorProfile) {
    return [
      { key: 'intro', icon: Play, active: !!profile.intro_id, title: profile.intro_id ? 'Intro configured' : 'No intro' },
      { key: 'outro', icon: SkipForward, active: !!profile.outro_id, title: profile.outro_id ? 'Outro configured' : 'No outro' },
      {
        key: 'watermark',
        icon: ImageIcon,
        active: !!profile.watermark_id,
        title: profile.watermark_id ? 'Watermark configured' : 'No watermark',
      },
    ];
  }

  onMounted(() => {
    if (!profilesLoaded.value) {
      loadCreatorProfiles();
    }
  });
</script>

