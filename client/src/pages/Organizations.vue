<template>
  <div class="org">
    <PageLayout
      title="Organizations"
      description="Manage organizations you belong to"
      :show-header="true"
      :icon="Building2"
    >
      <template #actions>
        <button
          v-if="
            !authStore.isAuthenticated || (canCreateOrg && (!userApplication || userApplication.status === 'rejected'))
          "
          @click="handleApplyClick"
          class="org__create-btn"
        >
          <Plus class="org__create-btn-icon" />
          {{ userApplication?.status === 'rejected' ? 'Reapply for Organization' : 'Apply for Organization' }}
        </button>
      </template>

      <div
        class="org__content"
        :class="{
          'org__content--empty':
            !loading &&
            ((authStore.isAuthenticated && organizations.length === 0 && !userApplication) ||
              !authStore.isAuthenticated),
        }"
      >
        <!-- Not Authenticated Empty State -->
        <div v-if="!authStore.isAuthenticated && !loading" class="org__empty">
          <div class="org__empty-icon-wrapper">
            <Building2 class="org__empty-icon" />
          </div>
          <h3 class="org__empty-title">Sign in to manage organizations</h3>
          <p class="org__empty-description">Access your organizations and apply to create new ones</p>
        </div>

        <!-- Authenticated Content -->
        <template v-else>
          <!-- Page Heading -->
          <div v-if="organizations.length > 0 || loading || userApplication" class="org__heading">
            <h1 class="org__title">Your Organizations</h1>
            <p class="org__subtitle">View and manage organizations you belong to</p>
          </div>

          <!-- Loading State -->
          <div v-if="loading" class="org__loading">
            <div class="org__grid">
              <div v-for="i in 3" :key="i" class="org-card org-card--skeleton">
                <div class="org-card__indicator org-card__indicator--skeleton"></div>
                <div class="org-card__inner">
                  <div class="org-card__content">
                    <div class="org-skeleton__logo"></div>
                    <div class="org-skeleton__info">
                      <div class="org-skeleton__line org-skeleton__line--title"></div>
                      <div class="org-skeleton__line org-skeleton__line--subtitle"></div>
                    </div>
                  </div>
                  <div class="org-skeleton__credits">
                    <div class="org-skeleton__line org-skeleton__line--sm"></div>
                    <div class="org-skeleton__line org-skeleton__line--xs"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Organizations Content -->
          <div v-else-if="organizations.length > 0" class="org__main">
            <div class="org__list-header">
              <span class="org__list-label">Organizations</span>
              <span class="org__list-count">{{ organizations.length }} total</span>
            </div>

            <div class="org__grid">
              <transition-group name="org-list" tag="div" class="org__grid-inner">
                <div
                  v-for="org in organizations"
                  :key="org.id"
                  class="org-card"
                  :class="{ 'org-card--owner': org.role === 'owner', 'org-card--admin': org.role === 'admin' }"
                  @click="navigateToOrg(org)"
                >
                  <!-- Left Accent Indicator -->
                  <div
                    class="org-card__indicator"
                    :class="{
                      'org-card__indicator--owner': org.role === 'owner',
                      'org-card__indicator--admin': org.role === 'admin',
                    }"
                  ></div>

                  <div class="org-card__inner">
                    <div class="org-card__content">
                      <!-- Logo -->
                      <div class="org-card__logo">
                        <img
                          v-if="org.logo_url && !failedImages.has(org.id)"
                          :src="org.logo_url"
                          :alt="org.name"
                          class="org-card__logo-img"
                          referrerpolicy="no-referrer"
                          @error="handleImageError($event, org.id)"
                        />
                        <div v-else class="org-card__logo-fallback">
                          <Building2 class="org-card__logo-icon" />
                        </div>
                      </div>

                      <!-- Organization Info -->
                      <div class="org-card__info">
                        <div class="org-card__name-row">
                          <h3 class="org-card__name">{{ org.name }}</h3>
                          <span
                            class="org-card__role"
                            :class="{
                              'org-card__role--owner': org.role === 'owner',
                              'org-card__role--admin': org.role === 'admin',
                            }"
                          >
                            {{ org.role }}
                          </span>
                        </div>
                        <p v-if="org.description" class="org-card__description">
                          {{ org.description }}
                        </p>
                        <p v-else class="org-card__description org-card__description--empty">No description</p>
                      </div>
                    </div>

                    <!-- Credit Balance -->
                    <div class="org-card__credits">
                      <div class="org-card__credits-row">
                        <Clock class="org-card__credits-icon" />
                        <span class="org-card__credits-value">
                          {{ formatCredits(orgCredits[org.id]?.hours_remaining) }}
                        </span>
                        <span class="org-card__credits-unit">min</span>
                      </div>
                      <div class="org-card__credits-used">{{ formatCredits(orgCredits[org.id]?.hours_used) }} used</div>
                    </div>

                    <!-- Hover Arrow -->
                    <div class="org-card__arrow">
                      <ChevronRight class="org-card__arrow-icon" />
                    </div>
                  </div>
                </div>
              </transition-group>
            </div>
          </div>

          <!-- Organization Application Section -->
          <div v-else-if="userApplication" class="org__main">
            <div class="org__list-header">
              <span class="org__list-label">Your Application</span>
              <span class="org__list-count">1 application</span>
            </div>

            <div class="org__grid">
              <div class="org-card org-card--application">
                <!-- Left Accent Indicator -->
                <div
                  class="org-card__indicator"
                  :class="{
                    'org-card__indicator--pending': userApplication.status === 'pending',
                    'org-card__indicator--approved': userApplication.status === 'approved',
                    'org-card__indicator--rejected': userApplication.status === 'rejected',
                  }"
                ></div>

                <div class="org-card__inner">
                  <div class="org-card__content">
                    <!-- Logo -->
                    <div class="org-card__logo">
                      <img
                        v-if="userApplication.logo_url && !applicationLogoFailed"
                        :src="userApplication.logo_url"
                        :alt="userApplication.name"
                        class="org-card__logo-img"
                        referrerpolicy="no-referrer"
                        @error="handleApplicationLogoError"
                      />
                      <div v-else class="org-card__logo-fallback">
                        <FileText class="org-card__logo-icon" />
                      </div>
                    </div>

                    <!-- Application Info -->
                    <div class="org-card__info">
                      <div class="org-card__name-row">
                        <h3 class="org-card__name">{{ userApplication.name }}</h3>
                        <span
                          class="org-card__role"
                          :class="{
                            'org-card__role--pending': userApplication.status === 'pending',
                            'org-card__role--approved': userApplication.status === 'approved',
                            'org-card__role--rejected': userApplication.status === 'rejected',
                          }"
                        >
                          {{ userApplication.status }}
                        </span>
                      </div>
                      <p class="org-card__description">
                        {{ userApplication.description }}
                      </p>
                    </div>
                  </div>

                  <!-- Application Details -->
                  <div class="org-card__details">
                    <div class="org-card__detail-row">
                      <Clock class="org-card__detail-icon" />
                      <span class="org-card__detail-value">{{ formatDate(userApplication.inserted_at) }}</span>
                    </div>
                    <div class="org-card__detail-row">
                      <Building2 class="org-card__detail-icon" />
                      <span class="org-card__detail-value">{{ userApplication.team_size }}</span>
                    </div>
                  </div>

                  <!-- Menu Button -->
                  <div
                    v-if="userApplication.status === 'pending' || userApplication.status === 'rejected'"
                    class="org-card__menu"
                    data-app-menu
                  >
                    <button
                      ref="applicationMenuButtonRef"
                      class="org-card__menu-btn"
                      :class="{ 'org-card__menu-btn--active': showApplicationMenu }"
                      @click.stop="toggleApplicationMenu"
                    >
                      <MoreVertical class="org-card__menu-icon" />
                    </button>

                    <!-- Menu Dropdown -->
                    <Teleport to="body">
                      <div
                        v-if="showApplicationMenu"
                        class="org-card__menu-dropdown"
                        :style="applicationMenuPosition"
                        data-app-menu
                        @click.stop
                      >
                        <button
                          v-if="userApplication.status === 'pending'"
                          class="org-card__menu-item org-card__menu-item--blue"
                          @click.stop="
                            editApplication();
                            closeApplicationMenu();
                          "
                        >
                          <Edit class="org-card__menu-item-icon" />
                          <span>Edit Application</span>
                        </button>
                        <div v-if="userApplication.status === 'pending'" class="org-card__menu-divider"></div>
                        <button
                          class="org-card__menu-item org-card__menu-item--red"
                          :disabled="deletingApplication"
                          @click.stop="
                            confirmDeleteApplication();
                            closeApplicationMenu();
                          "
                        >
                          <Loader2
                            v-if="deletingApplication"
                            class="org-card__menu-item-icon org-card__menu-item-icon--spin"
                          />
                          <Trash2 v-else class="org-card__menu-item-icon" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </Teleport>
                  </div>
                </div>

                <!-- Admin Notes (if present) -->
                <div v-if="userApplication.admin_notes" class="org-card__notes">
                  <AlertCircle class="org-card__notes-icon" />
                  <div class="org-card__notes-content">
                    <span class="org-card__notes-label">Admin Notes:</span>
                    <p class="org-card__notes-text">{{ userApplication.admin_notes }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State (Authenticated) -->
          <div v-else class="org__empty">
            <div class="org__empty-icon-wrapper">
              <Building2 class="org__empty-icon" />
            </div>
            <h3 class="org__empty-title">No Organizations</h3>
            <p class="org__empty-description">You're not a member of any organizations yet</p>
          </div>
        </template>
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
      title="Delete Application"
      message="Are you sure you want to delete your organization application?"
      suffix="This action cannot be undone."
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
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
  import {
    Building2,
    Plus,
    Clock,
    ChevronRight,
    FileText,
    AlertCircle,
    Edit,
    Trash2,
    Loader2,
    MoreVertical,
  } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';
  import PageLayout from '@/components/PageLayout.vue';
  import OrganizationApplicationDialog from '@/components/OrganizationApplicationDialog.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import api from '@/services/api';

  const router = useRouter();
  const authStore = useAuthStore();

  const loading = ref(true);
  const organizations = ref<any[]>([]);
  const failedImages = ref<Set<string>>(new Set());
  const orgCredits = ref<Record<string, { hours_remaining: string; hours_used: string }>>({});
  const showApplicationDialog = ref(false);
  const userApplication = ref<any>(null);
  const deletingApplication = ref(false);
  const showDeleteApplicationDialog = ref(false);
  const editingApplication = ref(false);
  const showApplicationMenu = ref(false);
  const applicationMenuButtonRef = ref<HTMLElement | null>(null);
  const applicationLogoFailed = ref(false);
  const showAuthModal = ref(false);

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

    // Add click outside listener for application menu
    document.addEventListener('click', handleApplicationMenuClickOutside);
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

  function navigateToOrg(org: any) {
    if (org.role === 'owner' || org.role === 'admin') {
      router.push(`/organization/${org.id}`);
    }
  }

  function handleImageError(event: Event, orgId: string) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    failedImages.value.add(orgId);
  }

  function handleApplicationLogoError() {
    applicationLogoFailed.value = true;
  }

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
        showSuccessToast('Application Deleted', 'Your organization application has been deleted');
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

  function toggleApplicationMenu() {
    showApplicationMenu.value = !showApplicationMenu.value;
  }

  function closeApplicationMenu() {
    showApplicationMenu.value = false;
  }

  const applicationMenuPosition = computed(() => {
    const button = applicationMenuButtonRef.value;
    if (!button) return { top: '0px', left: '0px' };

    const rect = button.getBoundingClientRect();
    const menuWidth = 180;
    const menuMaxHeight = 120;
    const padding = 8;

    let left = rect.right - menuWidth;
    if (left < padding) left = padding;

    const viewportWidth = window.innerWidth;
    if (left + menuWidth > viewportWidth - padding) {
      left = viewportWidth - menuWidth - padding;
    }

    let top = rect.bottom + 4;
    const viewportHeight = window.innerHeight;
    if (top + menuMaxHeight > viewportHeight - padding) {
      top = rect.top - menuMaxHeight - 4;
      if (top < padding) top = padding;
    }

    return { top: `${top}px`, left: `${left}px` };
  });

  function handleApplicationMenuClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-app-menu]')) {
      if (showApplicationMenu.value) {
        showApplicationMenu.value = false;
      }
    }
  }

  onUnmounted(() => {
    document.removeEventListener('click', handleApplicationMenuClickOutside);
  });
</script>

<style scoped>
  /* ===== Page Container ===== */
  .org {
    width: 100%;
    min-height: 100%;
  }

  .org__content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
    flex: 1;
  }

  .org__content--empty {
    justify-content: center;
    align-items: center;
  }

  /* ===== Page Heading ===== */
  .org__heading {
    margin-bottom: 0.5rem;
  }

  .org__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.02em;
  }

  .org__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Create Button ===== */
  .org__create-btn {
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

  .org__create-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org__create-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org__create-btn-icon {
    width: 14px;
    height: 14px;
  }

  /* ===== List Header ===== */
  .org__list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0.25rem;
    margin-bottom: 0.5rem;
  }

  .org__list-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
  }

  .org__list-count {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
  }

  /* ===== Grid ===== */
  .org__grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .org__grid-inner {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  /* ===== Organization Card ===== */
  .org-card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition: all 200ms ease;
  }

  .org-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .org-card__indicator {
    width: 4px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
    transition: background-color 200ms ease;
  }

  .org-card__indicator--owner {
    background-color: #f59e0b;
  }

  .org-card__indicator--admin {
    background-color: var(--sidebar-accent);
  }

  .org-card__indicator--skeleton {
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .org-card__inner {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    gap: 1rem;
  }

  .org-card__content {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
    min-width: 0;
  }

  /* Logo */
  .org-card__logo {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    flex-shrink: 0;
    overflow: hidden;
    position: relative;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
  }

  .org-card__logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-card__logo-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, var(--sidebar-hover) 100%);
  }

  .org-card__logo-icon {
    width: 24px;
    height: 24px;
    color: var(--sidebar-text-muted);
    opacity: 0.5;
  }

  /* Info */
  .org-card__info {
    flex: 1;
    min-width: 0;
  }

  .org-card__name-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin-bottom: 0.25rem;
  }

  .org-card__name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }

  .org-card__role {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.25rem 0.5rem;
    border-radius: 5px;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .org-card__role--owner {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .org-card__role--admin {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .org-card__description {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.4;
  }

  .org-card__description--empty {
    font-style: italic;
    opacity: 0.5;
  }

  /* Credits */
  .org-card__credits {
    text-align: right;
    flex-shrink: 0;
  }

  .org-card__credits-row {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
    margin-bottom: 0.125rem;
  }

  .org-card__credits-icon {
    width: 16px;
    height: 16px;
    color: #a78bfa;
  }

  .org-card__credits-value {
    font-size: 1rem;
    font-weight: 700;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
  }

  .org-card__credits-unit {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    font-weight: 500;
  }

  .org-card__credits-used {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
  }

  /* Hover Arrow */
  .org-card__arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transform: translateX(-4px);
    transition: all 200ms ease;
  }

  .org-card:hover .org-card__arrow {
    opacity: 0.5;
    transform: translateX(0);
  }

  .org-card__arrow-icon {
    width: 20px;
    height: 20px;
    color: var(--sidebar-text-muted);
  }

  /* ===== Skeleton Loader ===== */
  .org-card--skeleton {
    pointer-events: none;
  }

  .org-skeleton__logo {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    flex-shrink: 0;
  }

  .org-skeleton__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .org-skeleton__line {
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .org-skeleton__line--title {
    width: 140px;
    height: 18px;
  }

  .org-skeleton__line--subtitle {
    width: 200px;
    height: 14px;
  }

  .org-skeleton__line--sm {
    width: 60px;
    height: 18px;
  }

  .org-skeleton__line--xs {
    width: 45px;
    height: 12px;
  }

  .org-skeleton__credits {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.375rem;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  /* ===== Empty State ===== */
  .org__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .org__empty-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: var(--sidebar-hover);
    border-radius: 16px;
    margin-bottom: 1.5rem;
  }

  .org__empty-icon {
    width: 36px;
    height: 36px;
    color: var(--sidebar-text-muted);
  }

  .org__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .org__empty-description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
  }

  /* ===== Application-specific Card Styles ===== */
  .org-card--application {
    cursor: default;
  }

  .org-card--application:hover {
    transform: none;
  }

  .org-card__indicator--pending {
    background-color: #f59e0b;
  }

  .org-card__indicator--approved {
    background-color: #10b981;
  }

  .org-card__indicator--rejected {
    background-color: #ef4444;
  }

  .org-card__role--pending {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .org-card__role--approved {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .org-card__role--rejected {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .org-card__details {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .org-card__detail-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .org-card__detail-icon {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
  }

  .org-card__detail-value {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  /* Menu Button */
  .org-card__menu {
    position: relative;
    display: flex;
    align-items: center;
    margin-left: 0.5rem;
  }

  .org-card__menu-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-card__menu-btn:hover,
  .org-card__menu-btn--active {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .org-card__menu-icon {
    width: 16px;
    height: 16px;
  }

  .org-card__menu-dropdown {
    position: fixed;
    z-index: 9999;
    width: 180px;
    background-color: rgba(24, 24, 27, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    padding: 0.375rem 0;
    overflow: hidden;
  }

  .org-card__menu-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .org-card__menu-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-card__menu-item--blue:hover:not(:disabled) {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .org-card__menu-item--red:hover:not(:disabled) {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .org-card__menu-item-icon {
    width: 16px;
    height: 16px;
  }

  .org-card__menu-item-icon--spin {
    animation: spin 0.8s linear infinite;
  }

  .org-card__menu-divider {
    margin: 0.375rem 0;
    border-top: 1px solid var(--sidebar-border);
  }

  /* Admin Notes within Card */
  .org-card__notes {
    display: flex;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background-color: rgba(239, 68, 68, 0.08);
    border-top: 1px solid rgba(239, 68, 68, 0.2);
  }

  .org-card__notes-icon {
    width: 16px;
    height: 16px;
    color: #f87171;
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .org-card__notes-content {
    flex: 1;
    min-width: 0;
  }

  .org-card__notes-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #f87171;
    display: block;
    margin-bottom: 0.375rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .org-card__notes-text {
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    margin: 0;
    line-height: 1.5;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ===== List Transitions ===== */
  .org-list-move,
  .org-list-enter-active,
  .org-list-leave-active {
    transition: all 0.4s ease;
  }

  .org-list-enter-from,
  .org-list-leave-to {
    opacity: 0;
    transform: translateY(20px);
  }

  .org-list-leave-active {
    position: absolute;
    width: 100%;
    z-index: 0;
  }
</style>
