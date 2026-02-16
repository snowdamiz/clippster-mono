<template>
  <div class="org-hub">
    <PageLayout
      :title="organization?.name || 'Organization'"
      description="Manage your team and organization tools"
      :show-header="true"
      :icon="Building2"
    >
      <template #badge>
        <span v-if="loading" class="org-hub__role org-hub__role--loading">
          <Loader2 class="org-hub__role-spinner" />
        </span>
        <span
          v-else-if="role"
          class="org-hub__role"
          :class="{
            'org-hub__role--owner': role === 'owner',
            'org-hub__role--admin': role === 'admin',
          }"
        >
          {{ role }}
        </span>
      </template>

      <template #actions>
        <div class="org-hub__actions">
          <button
            v-if="isAdmin"
            class="org-hub__action-btn org-hub__action-btn--primary"
            @click="showInviteDialog = true"
          >
            <UserPlus class="org-hub__action-icon" />
            Add Member
          </button>
        </div>
      </template>

      <!-- Error State -->
      <div v-if="error" class="org-hub__error">
        <div class="org-hub__error-icon-wrapper">
          <AlertTriangle class="org-hub__error-icon" />
        </div>
        <h2 class="org-hub__error-title">Failed to load organization</h2>
        <p class="org-hub__error-message">{{ error }}</p>
        <Button @click="loadOrganization">Try Again</Button>
      </div>

      <!-- Loading Skeleton -->
      <div v-else-if="loading" class="org-hub__content">
        <!-- Skeleton Heading -->
        <div class="org-hub__heading">
          <div class="org-hub__skeleton-heading-title"></div>
          <div class="org-hub__skeleton-heading-subtitle"></div>
        </div>

        <!-- Skeleton Sections -->
        <div v-for="s in 3" :key="s" class="org-hub__section">
          <div class="org-hub__skeleton-section-title"></div>
          <div class="org-hub__grid">
            <div v-for="i in 4" :key="i" class="org-hub__card org-hub__card--skeleton">
              <div class="org-hub__card-content">
                <div class="org-hub__skeleton-icon"></div>
                <div class="org-hub__skeleton-content">
                  <div class="org-hub__skeleton-line org-hub__skeleton-line--title"></div>
                  <div class="org-hub__skeleton-line org-hub__skeleton-line--desc"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div v-else class="org-hub__content">
        <!-- Page Heading -->
        <div class="org-hub__heading">
          <h1 class="org-hub__title">Manage Your Organization</h1>
          <p class="org-hub__subtitle">
            {{ organization?.description || 'Access team tools, content management, and settings' }}
          </p>
        </div>

        <!-- Team Section -->
        <section class="org-hub__section">
          <h2 class="org-hub__section-title">Team</h2>
          <div class="org-hub__grid">
            <router-link v-for="tool in teamTools" :key="tool.id" :to="tool.route" class="org-hub__card">
              <div class="org-hub__card-content">
                <div class="org-hub__card-icon">
                  <component :is="tool.icon" class="org-hub__card-icon-svg" />
                </div>
                <div class="org-hub__card-info">
                  <h3 class="org-hub__card-title">{{ tool.title }}</h3>
                  <p class="org-hub__card-desc">{{ tool.description }}</p>
                </div>
                <div class="org-hub__card-stat" v-if="tool.stat !== undefined">
                  <span class="org-hub__card-stat-value">{{ tool.stat }}</span>
                  <span class="org-hub__card-stat-label">{{ tool.statLabel }}</span>
                </div>
              </div>
            </router-link>
          </div>
        </section>

        <!-- Content Section -->
        <section class="org-hub__section">
          <h2 class="org-hub__section-title">Content</h2>
          <div class="org-hub__grid">
            <template v-for="tool in contentTools" :key="tool.id">
              <!-- Coming Soon card (non-clickable) -->
              <div v-if="tool.comingSoon" class="org-hub__card org-hub__card--coming-soon">
                <div class="org-hub__card-content">
                  <div class="org-hub__card-icon">
                    <component :is="tool.icon" class="org-hub__card-icon-svg" />
                  </div>
                  <div class="org-hub__card-info">
                    <h3 class="org-hub__card-title">{{ tool.title }}</h3>
                    <p class="org-hub__card-desc">{{ tool.description }}</p>
                  </div>
                  <span class="org-hub__coming-soon-badge">Coming Soon</span>
                </div>
              </div>
              <!-- Normal card -->
              <router-link v-else :to="tool.route" class="org-hub__card">
                <div class="org-hub__card-content">
                  <div class="org-hub__card-icon">
                    <component :is="tool.icon" class="org-hub__card-icon-svg" />
                  </div>
                  <div class="org-hub__card-info">
                    <h3 class="org-hub__card-title">{{ tool.title }}</h3>
                    <p class="org-hub__card-desc">{{ tool.description }}</p>
                  </div>
                  <div class="org-hub__card-stat" v-if="tool.stat !== undefined">
                    <span class="org-hub__card-stat-value">{{ tool.stat }}</span>
                    <span class="org-hub__card-stat-label">{{ tool.statLabel }}</span>
                  </div>
                </div>
              </router-link>
            </template>
          </div>
        </section>

        <!-- Management Section -->
        <section class="org-hub__section">
          <h2 class="org-hub__section-title">Management</h2>
          <div class="org-hub__grid">
            <router-link v-for="tool in managementTools" :key="tool.id" :to="tool.route" class="org-hub__card">
              <div class="org-hub__card-content">
                <div class="org-hub__card-icon">
                  <component :is="tool.icon" class="org-hub__card-icon-svg" />
                </div>
                <div class="org-hub__card-info">
                  <h3 class="org-hub__card-title">{{ tool.title }}</h3>
                  <p class="org-hub__card-desc">{{ tool.description }}</p>
                </div>
                <div class="org-hub__card-stat" v-if="tool.stat !== undefined">
                  <span class="org-hub__card-stat-value">{{ tool.stat }}</span>
                  <span class="org-hub__card-stat-label">{{ tool.statLabel }}</span>
                </div>
              </div>
            </router-link>
          </div>
        </section>
      </div>
    </PageLayout>

    <!-- Invite Member Dialog -->
    <InviteMemberDialog
      v-model="showInviteDialog"
      :organization-id="organizationId ?? ''"
      @member-added="loadOrganization"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import {
    Building2,
    Users,
    UserCircle,
    UserPlus,
    MessageCircle,
    Target,
    Search,
    Share2,
    Link2,
    Send,
    Package,
    CreditCard,
    Settings,
    Loader2,
    AlertTriangle,
    Film,
    Briefcase,
  } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import PageLayout from '@/components/PageLayout.vue';
  import { useOrganization } from '@/composables/useOrganization';
  import InviteMemberDialog from '@/components/InviteMemberDialog.vue';

  const router = useRouter();
  const showInviteDialog = ref(false);

  const {
    loading,
    error,
    organization,
    organizationId,
    members,
    credits,
    role,
    isAdmin,
    loadOrganization,
    formatAllocation,
    creatorProfiles,
    profilesLoaded,
    loadCreatorProfiles,
    orgAssets,
    assetsLoaded,
    loadOrgAssets,
  } = useOrganization();

  // Load profile and asset counts for display
  const profilesCount = computed(() => creatorProfiles.value.length);
  const assetsCount = computed(() => orgAssets.value.length);

  // Tool type with optional stats
  interface Tool {
    id: string;
    title: string;
    description: string;
    icon: typeof Users;
    route: string;
    color: string;
    stat?: number | string;
    statLabel?: string;
    comingSoon?: boolean;
  }

  // Tool definitions with dynamic stats
  const teamTools = computed<Tool[]>(() => [
    {
      id: 'members',
      title: 'Members',
      description: 'Manage team, assign roles, and allocate credits',
      icon: Users,
      route: `/organization/${organizationId.value}/members`,
      color: 'cyan',
      stat: members.value.length,
      statLabel: 'active',
    },
    {
      id: 'creators',
      title: 'Creators',
      description: 'Manage creator profiles and platform links',
      icon: UserCircle,
      route: `/organization/${organizationId.value}/creators`,
      color: 'teal',
      stat: profilesCount.value,
      statLabel: 'profiles',
    },
    {
      id: 'messages',
      title: 'Messages',
      description: 'Team communication and announcements',
      icon: MessageCircle,
      route: '/messages',
      color: 'sky',
    },
    {
      id: 'hiring',
      title: 'Hiring',
      description: 'Create a hiring post to recruit clippers',
      icon: Briefcase,
      route: `/organization/${organizationId.value}/hiring`,
      color: 'orange',
    },
  ]);

  const contentTools = computed<Tool[]>(() => [
    {
      id: 'campaigns',
      title: 'Campaigns',
      description: 'Run and track clipping campaigns',
      icon: Target,
      route: `/organization/${organizationId.value}/campaigns`,
      color: 'violet',
      comingSoon: true,
    },
    {
      id: 'clippers',
      title: 'Find Clippers',
      description: 'Discover and recruit talented clippers',
      icon: Search,
      route: `/organization/${organizationId.value}/clippers`,
      color: 'purple',
    },
    {
      id: 'shared',
      title: 'Shared Clips',
      description: 'Distribute clips to team members',
      icon: Share2,
      route: `/organization/${organizationId.value}/shared`,
      color: 'pink',
    },
    {
      id: 'social',
      title: 'Social Accounts',
      description: 'Manage connected social platforms',
      icon: Link2,
      route: `/organization/${organizationId.value}/social`,
      color: 'indigo',
    },
    {
      id: 'posts',
      title: 'Post Submissions',
      description: 'Review and approve member posts',
      icon: Send,
      route: `/organization/${organizationId.value}/posts`,
      color: 'blue',
    },
  ]);

  const managementTools = computed<Tool[]>(() => [
    {
      id: 'assets',
      title: 'Assets',
      description: 'Intros, outros, watermarks, and media',
      icon: Package,
      route: `/organization/${organizationId.value}/assets`,
      color: 'emerald',
      stat: assetsCount.value,
      statLabel: 'files',
    },
    {
      id: 'billing',
      title: 'Billing',
      description: 'Billing, Credits, and Subscriptions ',
      icon: CreditCard,
      route: `/organization/${organizationId.value}/billing`,
      color: 'amber',
      stat: formatAllocation(credits.value.hoursRemaining),
      statLabel: 'min',
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'Organization profile and preferences',
      icon: Settings,
      route: `/organization/${organizationId.value}/settings`,
      color: 'slate',
    },
  ]);

  onMounted(async () => {
    await loadOrganization();
    // Load counts for display (lazy load)
    if (!profilesLoaded.value) loadCreatorProfiles();
    if (!assetsLoaded.value) loadOrgAssets();
  });
</script>

<style scoped>
  /* ===== Page Container ===== */
  .org-hub {
    width: 100%;
    min-height: 100%;
  }

  .org-hub__content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  /* ===== Page Heading ===== */
  .org-hub__heading {
    flex: 1;
    min-width: 0;
  }

  .org-hub__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .org-hub__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Header Actions ===== */
  .org-hub__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* ===== Action Buttons ===== */
  .org-hub__action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
  }

  .org-hub__action-btn--primary {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
  }

  .org-hub__action-btn--primary:hover {
    opacity: 0.9;
  }

  .org-hub__action-btn--secondary {
    background-color: transparent;
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .org-hub__action-btn--secondary:hover {
    background-color: var(--sidebar-hover);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .org-hub__action-icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Role Badge ===== */
  .org-hub__role {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.1875rem 0.5rem;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .org-hub__role--loading {
    background-color: var(--sidebar-hover);
  }

  .org-hub__role-spinner {
    width: 10px;
    height: 10px;
    animation: spin 0.8s linear infinite;
  }

  .org-hub__role--owner {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .org-hub__role--admin {
    background-color: rgba(6, 182, 212, 0.15);
    color: #22d3ee;
  }

  /* ===== Sections ===== */
  .org-hub__section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .org-hub__section-title {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    margin: 0;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  /* ===== Card Grid ===== */
  .org-hub__grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 0.875rem;
  }

  @media (min-width: 640px) {
    .org-hub__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .org-hub__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 1400px) {
    .org-hub__grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (min-width: 1800px) {
    .org-hub__grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  /* ===== Tool Card ===== */
  .org-hub__card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    text-decoration: none;
    transition:
      transform 180ms ease,
      box-shadow 180ms ease,
      border-color 180ms ease;
  }

  .org-hub__card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--sidebar-accent);
    opacity: 0;
    transition: opacity 180ms ease;
  }

  .org-hub__card:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .org-hub__card:hover::before {
    opacity: 1;
  }

  .org-hub__card:active {
    transform: translateY(0);
  }

  .org-hub__card-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem 1.125rem;
  }

  .org-hub__card-info {
    flex: 1;
    min-width: 0;
  }

  .org-hub__card-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background-color: var(--sidebar-hover);
    transition:
      background-color 180ms ease,
      transform 180ms ease;
  }

  .org-hub__card:hover .org-hub__card-icon {
    background-color: rgba(255, 255, 255, 0.08);
    transform: scale(1.05);
  }

  .org-hub__card-icon-svg {
    width: 20px;
    height: 20px;
    color: var(--sidebar-text-muted);
    transition: color 180ms ease;
  }

  .org-hub__card:hover .org-hub__card-icon-svg {
    color: var(--sidebar-accent);
  }

  .org-hub__card-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
    transition: color 180ms ease;
  }

  .org-hub__card:hover .org-hub__card-title {
    color: #fff;
  }

  .org-hub__card-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .org-hub__card-stat {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex-shrink: 0;
    margin-left: auto;
    padding-left: 0.75rem;
    min-width: 48px;
  }

  .org-hub__card-stat-value {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
    line-height: 1;
    transition: color 180ms ease;
  }

  .org-hub__card:hover .org-hub__card-stat-value {
    color: var(--sidebar-accent);
  }

  .org-hub__card-stat-label {
    font-size: 0.5625rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.1875rem;
  }

  /* ===== Error State ===== */
  .org-hub__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 4rem 1.5rem;
  }

  .org-hub__error-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: rgba(239, 68, 68, 0.1);
    border-radius: 16px;
    margin-bottom: 1.5rem;
  }

  .org-hub__error-icon {
    width: 36px;
    height: 36px;
    color: #f87171;
  }

  .org-hub__error-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .org-hub__error-message {
    color: var(--sidebar-text-muted);
    margin: 0 0 1.5rem;
    font-size: 0.875rem;
    max-width: 320px;
    line-height: 1.5;
  }

  /* ===== Skeleton Loading ===== */
  .org-hub__skeleton-heading-title {
    width: 220px;
    height: 28px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 6px;
    margin-bottom: 0.5rem;
  }

  .org-hub__skeleton-heading-subtitle {
    width: 360px;
    max-width: 100%;
    height: 16px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.1s;
    border-radius: 4px;
  }

  .org-hub__skeleton-section-title {
    width: 60px;
    height: 12px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .org-hub__card--coming-soon {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .org-hub__card--coming-soon:hover {
    transform: none;
    box-shadow: none;
  }

  .org-hub__card--coming-soon:hover::before {
    opacity: 0;
  }

  .org-hub__coming-soon-badge {
    flex-shrink: 0;
    margin-left: auto;
    padding: 0.1875rem 0.5rem;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    white-space: nowrap;
  }

  .org-hub__card--skeleton {
    pointer-events: none;
  }

  .org-hub__skeleton-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    flex-shrink: 0;
  }

  .org-hub__skeleton-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .org-hub__skeleton-line {
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .org-hub__skeleton-line--title {
    width: 100px;
    height: 14px;
  }

  .org-hub__skeleton-line--desc {
    width: 160px;
    height: 12px;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ===== Responsive Adjustments ===== */
  @media (max-width: 640px) {
    .org-hub__actions {
      flex-direction: column;
      width: 100%;
    }

    .org-hub__action-btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>
