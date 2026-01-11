<template>
  <div class="org">
    <PageLayout
      title="Organizations"
      description="Manage organizations you belong to"
      :show-header="true"
      :icon="Building2"
    >
      <template #actions>
        <Button v-if="canCreateOrg" @click="router.push('/organization/setup')" class="org__create-btn">
          <Plus class="org__create-btn-icon" />
          Create Organization
        </Button>
      </template>

      <div class="org__content">
        <!-- Page Heading -->
        <div v-if="organizations.length > 0 || loading" class="org__heading">
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

        <!-- Empty State -->
        <div v-else class="org__empty">
          <div class="org__empty-icon-wrapper">
            <Building2 class="org__empty-icon" />
          </div>
          <h3 class="org__empty-title">No Organizations</h3>
          <p class="org__empty-description">
            You're not a member of any organizations yet. Create one or ask to be invited to an existing organization.
          </p>
          <Button v-if="canCreateOrg" @click="router.push('/organization/setup')" class="org__empty-btn">
            <Plus class="org__empty-btn-icon" />
            Create Organization
          </Button>
        </div>
      </div>
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { Building2, Plus, Clock, ChevronRight } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import PageLayout from '@/components/PageLayout.vue';
  import { Button } from '@/components/ui/button';

  const router = useRouter();
  const authStore = useAuthStore();

  const loading = ref(true);
  const organizations = ref<any[]>([]);
  const failedImages = ref<Set<string>>(new Set());
  const orgCredits = ref<Record<string, { hours_remaining: string; hours_used: string }>>({});

  const canCreateOrg = computed(() => {
    // User can create org if:
    // 1. They don't already own one
    // 2. Their account wasn't created by an organization (org-created accounts cannot create their own orgs)
    return !authStore.user?.owned_organization_id && !authStore.user?.created_by_organization_id;
  });

  onMounted(async () => {
    // If user owns an organization, redirect directly to it
    if (authStore.user?.owned_organization_id) {
      router.replace(`/organization/${authStore.user.owned_organization_id}`);
      return;
    }

    await loadOrganizations();

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

  function formatCredits(value: string | undefined): string {
    if (!value) return '0';
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    return Math.round(num).toString();
  }
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
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
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
  }

  .org__create-btn-icon {
    width: 16px;
    height: 16px;
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
    padding: 4rem 1rem;
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
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
    letter-spacing: -0.01em;
  }

  .org__empty-description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1.5rem;
    max-width: 360px;
    line-height: 1.6;
  }

  .org__empty-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .org__empty-btn-icon {
    width: 16px;
    height: 16px;
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
