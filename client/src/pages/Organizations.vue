<template>
  <div class="h-full w-full">
    <PageLayout title="Organizations" description="Manage organizations you belong to" :icon="Building2">
      <template #actions>
        <Button
          v-if="!authStore.isAuthenticated || (canCreateOrg && (!userApplication || userApplication.status === 'rejected'))"
          variant="primary"
          size="sm"
          @click="handleApplyClick"
        >
          <Plus />
          {{ userApplication?.status === 'rejected' ? 'Reapply for organization' : 'Apply for organization' }}
        </Button>
      </template>

      <div class="flex flex-1 flex-col px-5 py-4">
        <!-- Not authenticated -->
        <EmptyState
          v-if="!authStore.isAuthenticated && !loading"
          :icon="Building2"
          title="Sign in to manage organizations"
          description="Access your organizations and apply to create new ones."
        />

        <!-- Loading (first load only) -->
        <div v-else-if="loading && organizations.length === 0" class="skeleton-group flex flex-col gap-2.5" aria-busy="true">
          <div class="skeleton h-4 w-40" />
          <div class="overflow-hidden rounded-xl border border-line-subtle bg-surface">
            <div
              v-for="i in 3"
              :key="i"
              class="flex items-center gap-3 border-b border-line-subtle px-4 py-2.5 last:border-b-0"
            >
              <div class="skeleton size-9 shrink-0 rounded-lg" />
              <div class="flex flex-1 flex-col gap-1.5">
                <div class="skeleton h-3.5 w-40" />
                <div class="skeleton h-3 w-64 max-w-full" />
              </div>
              <div class="skeleton h-3.5 w-16" />
            </div>
          </div>
        </div>

        <!-- Organizations -->
        <section v-else-if="organizations.length > 0" class="flex animate-enter flex-col gap-2.5">
          <SectionHeader title="Your organizations" :count="organizations.length" />
          <ul class="overflow-hidden rounded-xl border border-line-subtle bg-surface">
            <li v-for="org in organizations" :key="org.id" class="border-b border-line-subtle last:border-b-0">
              <component
                :is="canOpen(org) ? 'button' : 'div'"
                :type="canOpen(org) ? 'button' : undefined"
                class="group flex w-full items-center gap-3 px-4 py-2.5 text-left"
                :class="canOpen(org) ? 'transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none' : ''"
                @click="navigateToOrg(org)"
              >
                <Avatar :src="org.logo_url" :name="org.name" :icon="Building2" shape="square" />
                <div class="min-w-0 flex-1">
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="truncate text-sm font-semibold text-fg">{{ org.name }}</span>
                    <OrgRoleBadge :role="org.role" />
                  </div>
                  <p class="truncate text-xs" :class="org.description ? 'text-fg-muted' : 'text-fg-subtle'">
                    {{ org.description || 'No description' }}
                  </p>
                </div>
                <div class="shrink-0 text-right">
                  <p class="tabular text-sm font-semibold text-fg">
                    {{ formatCredits(orgCredits[org.id]?.hours_remaining) }}
                    <span class="text-xs font-normal text-fg-muted">min left</span>
                  </p>
                  <p class="tabular text-2xs text-fg-subtle">{{ formatCredits(orgCredits[org.id]?.hours_used) }} used</p>
                </div>
                <ChevronRight
                  v-if="canOpen(org)"
                  class="size-4 shrink-0 text-fg-disabled transition-colors group-hover:text-fg-muted"
                />
                <span v-else class="w-4 shrink-0" />
              </component>
            </li>
          </ul>
          <p v-if="organizations.some((o) => !canOpen(o))" class="text-xs text-fg-subtle">
            Organizations where you're a member are managed by their admins.
          </p>
        </section>

        <!-- Organization application -->
        <section v-else-if="userApplication" class="flex animate-enter flex-col gap-2.5">
          <SectionHeader title="Your application" />
          <div class="overflow-hidden rounded-xl border border-line-subtle bg-surface">
            <div class="flex items-center gap-3 px-4 py-3">
              <Avatar
                v-if="userApplication.logo_url"
                :src="userApplication.logo_url"
                :name="userApplication.name"
                :icon="Building2"
                shape="square"
              />
              <IconTile v-else :icon="FileText" />
              <div class="min-w-0 flex-1">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="truncate text-sm font-semibold text-fg">{{ userApplication.name }}</span>
                  <Badge :variant="applicationStatusVariant" class="capitalize">{{ userApplication.status }}</Badge>
                </div>
                <p class="truncate text-xs text-fg-muted">{{ userApplication.description }}</p>
                <p class="mt-0.5 flex flex-wrap items-center gap-x-3 text-2xs text-fg-subtle">
                  <span class="inline-flex items-center gap-1">
                    <Clock class="size-3" />
                    Submitted {{ formatDate(userApplication.inserted_at) }}
                  </span>
                  <span v-if="userApplication.team_size" class="inline-flex items-center gap-1">
                    <Users class="size-3" />
                    {{ userApplication.team_size }}
                  </span>
                </p>
              </div>
              <DropdownMenu v-if="userApplication.status === 'pending' || userApplication.status === 'rejected'">
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon-sm" title="Application actions" aria-label="Application actions">
                    <Loader2 v-if="deletingApplication" class="animate-spin" />
                    <MoreHorizontal v-else />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-48">
                  <DropdownMenuItem v-if="userApplication.status === 'pending'" @select="editApplication">
                    <Pencil />
                    Edit application
                  </DropdownMenuItem>
                  <DropdownMenuSeparator v-if="userApplication.status === 'pending'" />
                  <DropdownMenuItem
                    :disabled="deletingApplication"
                    class="text-danger focus:bg-danger-soft [&>svg]:!text-danger"
                    @select="confirmDeleteApplication"
                  >
                    <Trash2 />
                    Delete application
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <!-- Admin notes -->
            <div
              v-if="userApplication.admin_notes"
              class="flex gap-2.5 border-t border-line-subtle px-4 py-3"
            >
              <AlertCircle
                class="mt-0.5 size-4 shrink-0"
                :class="userApplication.status === 'rejected' ? 'text-danger' : 'text-fg-subtle'"
              />
              <div class="min-w-0">
                <p class="eyebrow">Admin notes</p>
                <p class="mt-0.5 text-sm text-fg">{{ userApplication.admin_notes }}</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Empty (authenticated; waits for the application check so it never flashes) -->
        <EmptyState
          v-else-if="applicationChecked"
          :icon="Building2"
          title="No organizations yet"
          description="You're not a member of any organizations yet. Apply to create one for your team."
        />
      </div>
    </PageLayout>

    <!-- Organization Application Dialog -->
    <OrganizationApplicationDialog
      :show="showApplicationDialog"
      :application="editingApplication ? userApplication : null"
      @close="
        showApplicationDialog = false;
        editingApplication = false;
      "
      @submitted="handleApplicationSubmitted"
    />

    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteApplicationDialog"
      title="Delete application"
      message="Are you sure you want to delete your organization application?"
      suffix=""
      confirm-text="Delete"
      variant="destructive"
      @close="handleDeleteApplicationDialogClose"
      @confirm="deleteApplicationConfirmed"
    />

    <!-- Auth Modal -->
    <AuthModal v-model="showAuthModal" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
  import {
    Building2,
    Plus,
    Clock,
    ChevronRight,
    FileText,
    AlertCircle,
    Pencil,
    Trash2,
    Loader2,
    MoreHorizontal,
    Users,
  } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';
  import PageLayout from '@/components/PageLayout.vue';
  import OrganizationApplicationDialog from '@/components/OrganizationApplicationDialog.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { IconTile } from '@/components/ui/icon-tile';
  import { SectionHeader } from '@/components/ui/section-header';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Avatar } from '@/components/ui/avatar';
  import OrgRoleBadge from '@/pages/organization/components/OrgRoleBadge.vue';
  import api from '@/services/api';

  const router = useRouter();
  const authStore = useAuthStore();

  const loading = ref(true);
  const organizations = ref<any[]>([]);
  const orgCredits = ref<Record<string, { hours_remaining: string; hours_used: string }>>({});
  const showApplicationDialog = ref(false);
  const userApplication = ref<any>(null);
  const deletingApplication = ref(false);
  const showDeleteApplicationDialog = ref(false);
  const editingApplication = ref(false);
  const showAuthModal = ref(false);
  const applicationChecked = ref(false);

  const { success: showSuccessToast } = useToast();

  const canCreateOrg = computed(() => {
    // User can create org if:
    // 1. They don't already own one
    // 2. Their account wasn't created by an organization (org-created accounts cannot create their own orgs)
    return !authStore.user?.owned_organization_id && !authStore.user?.created_by_organization_id;
  });

  onMounted(async () => {
    // Skip data loading if not authenticated
    if (!authStore.isAuthenticated) {
      loading.value = false;
      return;
    }

    // If user owns an organization, redirect directly to it
    if (authStore.user?.owned_organization_id) {
      router.replace(`/organization/${authStore.user.owned_organization_id}`);
      return;
    }

    await Promise.all([loadOrganizations(), loadUserApplication()]);

    // If user is only a member of one org AND is an admin/owner, go directly to it
    // Regular members stay on this page - they don't have access to the dashboard
    if (organizations.value.length === 1) {
      const org = organizations.value[0];
      if (org.role === 'owner' || org.role === 'admin') {
        router.replace(`/organization/${org.id}`);
        return;
      }
    }
  });

  async function loadOrganizations() {
    loading.value = true;
    try {
      const result = await authStore.getOrganizations();
      if (result.success) {
        organizations.value = result.organizations || [];

        // Load credits for each organization
        await Promise.all(
          organizations.value.map(async (org) => {
            try {
              const creditsResult = await authStore.getOrganizationCredits(org.id);
              if (creditsResult.success && creditsResult.my_allocation) {
                orgCredits.value[org.id] = {
                  hours_remaining: creditsResult.my_allocation.hours_remaining,
                  hours_used: creditsResult.my_allocation.hours_used,
                };
              }
            } catch (err) {
              console.error(`Failed to load credits for org ${org.id}:`, err);
            }
          })
        );
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      loading.value = false;
    }
  }

  // Only owners and admins can open the organization dashboard
  function canOpen(org: any) {
    return org.role === 'owner' || org.role === 'admin';
  }

  function navigateToOrg(org: any) {
    if (canOpen(org)) {
      router.push(`/organization/${org.id}`);
    }
  }

  const applicationStatusVariant = computed(() => {
    switch (userApplication.value?.status) {
      case 'approved':
        return 'success' as const;
      case 'rejected':
        return 'danger' as const;
      default:
        return 'warning' as const;
    }
  });

  function formatCredits(value: string | undefined): string {
    if (!value) return '0';
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    return Math.round(num).toString();
  }

  function formatDate(dateString: string): string {
    return fmtDate(dateString);
  }

  function handleApplyClick() {
    if (!authStore.isAuthenticated) {
      showAuthModal.value = true;
      return;
    }
    showApplicationDialog.value = true;
  }

  async function loadUserApplication() {
    try {
      const response = await api.get('/organization-applications/my-application');
      const data = response.data;

      if (data.success && data.application) {
        userApplication.value = data.application;
      }
    } catch (error) {
      console.error('Failed to load user application:', error);
    } finally {
      applicationChecked.value = true;
    }
  }

  async function handleApplicationSubmitted() {
    await loadUserApplication();
    editingApplication.value = false;
  }

  function editApplication() {
    editingApplication.value = true;
    showApplicationDialog.value = true;
  }

  function confirmDeleteApplication() {
    showDeleteApplicationDialog.value = true;
  }

  async function deleteApplicationConfirmed() {
    if (!userApplication.value) return;

    deletingApplication.value = true;

    try {
      const response = await api.delete(`/organization-applications/${userApplication.value.id}`);
      const data = response.data;

      if (data.success) {
        showSuccessToast('Application deleted', 'Your organization application has been deleted');
        userApplication.value = null;
      }
    } catch (error: any) {
      console.error('Failed to delete application:', error);
    } finally {
      deletingApplication.value = false;
      showDeleteApplicationDialog.value = false;
    }
  }

  function handleDeleteApplicationDialogClose() {
    showDeleteApplicationDialog.value = false;
  }
</script>

