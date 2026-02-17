<template>
  <div class="admin-hub">
    <PageLayout
      title="Admin Panel"
      description="System administration and management tools"
      :show-header="true"
      :icon="ShieldCheck"
      :breadcrumbs="[{ label: 'Admin', path: '/admin' }]"
    >
      <template #badge>
        <span v-if="loading" class="admin-hub__role admin-hub__role--loading">
          <Loader2 class="admin-hub__role-spinner" />
        </span>
        <span v-else-if="isModerator && !isAdmin" class="admin-hub__role admin-hub__role--moderator">
          <Shield class="admin-hub__role-icon" />
          Moderator
        </span>
        <span v-else class="admin-hub__role admin-hub__role--admin">
          <Shield class="admin-hub__role-icon" />
          Admin
        </span>
      </template>

      <!-- Error State -->
      <div v-if="error" class="admin-hub__error">
        <div class="admin-hub__error-icon-wrapper">
          <AlertTriangle class="admin-hub__error-icon" />
        </div>
        <h2 class="admin-hub__error-title">Failed to load admin data</h2>
        <p class="admin-hub__error-message">{{ error }}</p>
        <Button @click="loadData">Try Again</Button>
      </div>

      <!-- Loading Skeleton -->
      <div v-else-if="loading" class="admin-hub__content">
        <!-- Skeleton Heading -->
        <div class="admin-hub__heading">
          <div class="admin-hub__skeleton-heading-title"></div>
          <div class="admin-hub__skeleton-heading-subtitle"></div>
        </div>

        <!-- Skeleton Sections -->
        <div v-for="s in 3" :key="s" class="admin-hub__section">
          <div class="admin-hub__skeleton-section-title"></div>
          <div class="admin-hub__grid">
            <div v-for="i in 4" :key="i" class="admin-hub__card admin-hub__card--skeleton">
              <div class="admin-hub__card-content">
                <div class="admin-hub__skeleton-icon"></div>
                <div class="admin-hub__skeleton-content">
                  <div class="admin-hub__skeleton-line admin-hub__skeleton-line--title"></div>
                  <div class="admin-hub__skeleton-line admin-hub__skeleton-line--desc"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div v-else class="admin-hub__content">
        <!-- Page Heading -->
        <div class="admin-hub__heading">
          <h1 class="admin-hub__title">Administration Dashboard</h1>
          <p class="admin-hub__subtitle">Manage users, organizations, and system settings</p>
        </div>

        <!-- Users & Access Section -->
        <section class="admin-hub__section">
          <h2 class="admin-hub__section-title">Users & Access</h2>
          <div class="admin-hub__grid">
            <router-link v-for="tool in usersTools" :key="tool.id" :to="tool.route" class="admin-hub__card">
              <div class="admin-hub__card-content">
                <div class="admin-hub__card-icon">
                  <component :is="tool.icon" class="admin-hub__card-icon-svg" />
                </div>
                <div class="admin-hub__card-info">
                  <h3 class="admin-hub__card-title">{{ tool.title }}</h3>
                  <p class="admin-hub__card-desc">{{ tool.description }}</p>
                </div>
                <div class="admin-hub__card-stat" v-if="tool.stat !== undefined">
                  <span class="admin-hub__card-stat-value">{{ tool.stat }}</span>
                  <span class="admin-hub__card-stat-label">{{ tool.statLabel }}</span>
                </div>
              </div>
            </router-link>
          </div>
        </section>

        <!-- Content & Reports Section -->
        <section class="admin-hub__section">
          <h2 class="admin-hub__section-title">Content & Reports</h2>
          <div class="admin-hub__grid">
            <router-link v-for="tool in contentTools" :key="tool.id" :to="tool.route" class="admin-hub__card">
              <div class="admin-hub__card-content">
                <div class="admin-hub__card-icon">
                  <component :is="tool.icon" class="admin-hub__card-icon-svg" />
                </div>
                <div class="admin-hub__card-info">
                  <h3 class="admin-hub__card-title">{{ tool.title }}</h3>
                  <p class="admin-hub__card-desc">{{ tool.description }}</p>
                </div>
                <div class="admin-hub__card-stat" v-if="tool.stat !== undefined">
                  <span class="admin-hub__card-stat-value">{{ tool.stat }}</span>
                  <span class="admin-hub__card-stat-label">{{ tool.statLabel }}</span>
                </div>
              </div>
            </router-link>
          </div>
        </section>

        <!-- Revenue Section -->
        <section class="admin-hub__section">
          <h2 class="admin-hub__section-title">Revenue</h2>
          <div class="admin-hub__grid">
            <router-link v-for="tool in revenueTools" :key="tool.id" :to="tool.route" class="admin-hub__card">
              <div class="admin-hub__card-content">
                <div class="admin-hub__card-icon">
                  <component :is="tool.icon" class="admin-hub__card-icon-svg" />
                </div>
                <div class="admin-hub__card-info">
                  <h3 class="admin-hub__card-title">{{ tool.title }}</h3>
                  <p class="admin-hub__card-desc">{{ tool.description }}</p>
                </div>
                <div class="admin-hub__card-stat" v-if="tool.stat !== undefined">
                  <span class="admin-hub__card-stat-value">{{ tool.stat }}</span>
                  <span class="admin-hub__card-stat-label">{{ tool.statLabel }}</span>
                </div>
              </div>
            </router-link>
          </div>
        </section>

        <!-- System Section -->
        <section class="admin-hub__section">
          <h2 class="admin-hub__section-title">System</h2>
          <div class="admin-hub__grid">
            <router-link v-for="tool in systemTools" :key="tool.id" :to="tool.route" class="admin-hub__card">
              <div class="admin-hub__card-content">
                <div class="admin-hub__card-icon">
                  <component :is="tool.icon" class="admin-hub__card-icon-svg" />
                </div>
                <div class="admin-hub__card-info">
                  <h3 class="admin-hub__card-title">{{ tool.title }}</h3>
                  <p class="admin-hub__card-desc">{{ tool.description }}</p>
                </div>
                <div class="admin-hub__card-stat" v-if="tool.stat !== undefined">
                  <span class="admin-hub__card-stat-value">{{ tool.stat }}</span>
                  <span class="admin-hub__card-stat-label">{{ tool.statLabel }}</span>
                </div>
              </div>
            </router-link>
          </div>
        </section>
      </div>
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import {
    ShieldCheck,
    Shield,
    Users,
    Building2,
    FileText,
    Activity,
    BarChart3,
    KeyRound,
    UserPlus,
    Settings,
    Loader2,
    AlertTriangle,
    Percent,
    Handshake,
    Headset,
    MessagesSquare,
    ScrollText,
  } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import PageLayout from '@/components/PageLayout.vue';
  import { useAuthStore } from '@/stores/auth';

  const authStore = useAuthStore();
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Role checks
  const isAdmin = computed(() => authStore.user?.is_admin || false);
  const isModerator = computed(() => authStore.user?.is_moderator || false);

  interface Tool {
    id: string;
    title: string;
    description: string;
    icon: typeof Users;
    route: string;
    stat?: number | string;
    statLabel?: string;
  }

  // Admin-only tools
  const usersTools = computed<Tool[]>(() => {
    const tools: Tool[] = [];
    
    // Admin-only: Users and Organizations management
    if (isAdmin.value) {
      tools.push(
        {
          id: 'users',
          title: 'Users',
          description: 'Manage user accounts, credits, and subscriptions',
          icon: Users,
          route: '/admin/users',
        },
        {
          id: 'organizations',
          title: 'Organizations',
          description: 'Manage organizations and their credits',
          icon: Building2,
          route: '/admin/organizations',
        }
      );
    }
    
    // Mod+Admin: Org Applications
    if (isAdmin.value || isModerator.value) {
      tools.push({
        id: 'org-applications',
        title: 'Org Applications',
        description: 'Review organization account applications',
        icon: FileText,
        route: '/admin/org-applications',
      });
    }
    
    return tools;
  });

  // Mod+Admin tools
  const contentTools = computed<Tool[]>(() => {
    const tools: Tool[] = [];
    
    if (isAdmin.value || isModerator.value) {
      tools.push(
        {
          id: 'bug-reports',
          title: 'Bug Reports',
          description: 'Track and manage reported issues',
          icon: FileText,
          route: '/admin/bug-reports',
        },
        {
          id: 'ai-usage',
          title: 'AI Usage',
          description: 'Monitor AI service consumption and performance',
          icon: Activity,
          route: '/admin/ai-usage',
        },
        {
          id: 'analytics',
          title: 'Analytics',
          description: 'Track key user actions and events',
          icon: BarChart3,
          route: '/admin/analytics',
        },
        {
          id: 'customer-service',
          title: 'Customer Service',
          description: 'Manage support conversations and tickets',
          icon: Headset,
          route: '/admin/customer-service',
        },
        {
          id: 'staff-messages',
          title: 'Staff Messages',
          description: 'Internal messaging for admins and moderators',
          icon: MessagesSquare,
          route: '/admin/staff-messages',
        }
      );
    }
    
    return tools;
  });

  // Admin-only revenue tools
  const revenueTools = computed<Tool[]>(() => {
    if (!isAdmin.value) return [];
    
    return [
      {
        id: 'affiliates',
        title: 'Affiliates',
        description: 'Manage affiliate accounts, commissions, and payouts',
        icon: Handshake,
        route: '/admin/affiliates',
      },
    ];
  });

  // Admin-only system tools
  const systemTools = computed<Tool[]>(() => {
    if (!isAdmin.value) return [];
    
    return [
      {
        id: 'beta-codes',
        title: 'Beta Codes',
        description: 'Generate and manage beta access codes',
        icon: KeyRound,
        route: '/admin/beta-codes',
      },
      {
        id: 'discount-codes',
        title: 'Discount Codes',
        description: 'Create and manage promotional discount codes',
        icon: Percent,
        route: '/admin/discount-codes',
      },
      {
        id: 'waitlist',
        title: 'Waitlist',
        description: 'Users who signed up for early access',
        icon: UserPlus,
        route: '/admin/waitlist',
      },
      {
        id: 'settings',
        title: 'Settings',
        description: 'Feature flags and UI configuration',
        icon: Settings,
        route: '/admin/settings',
      },
      {
        id: 'mod-logs',
        title: 'Moderator Logs',
        description: 'View all moderator actions and activity',
        icon: ScrollText,
        route: '/admin/mod-logs',
      },
    ];
  });

  const loadData = async () => {
    error.value = null;
    // Admin hub is static, no data to load
  };

  onMounted(() => {
    loadData();
  });
</script>

<style scoped>
  /* ===== Page Container ===== */
  .admin-hub {
    width: 100%;
    min-height: 100%;
  }

  .admin-hub__content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  /* ===== Page Heading ===== */
  .admin-hub__heading {
    flex: 1;
    min-width: 0;
  }

  .admin-hub__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .admin-hub__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Header Actions ===== */
  .admin-hub__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* ===== Action Buttons ===== */
  .admin-hub__action-btn {
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
    text-decoration: none;
  }

  .admin-hub__action-btn--primary {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
  }

  .admin-hub__action-btn--primary:hover {
    opacity: 0.9;
  }

  .admin-hub__action-btn--secondary {
    background-color: transparent;
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .admin-hub__action-btn--secondary:hover {
    background-color: var(--sidebar-hover);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .admin-hub__action-icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Role Badge ===== */
  .admin-hub__role {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 5px;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .admin-hub__role--loading {
    background-color: var(--sidebar-hover);
  }

  .admin-hub__role-spinner {
    width: 10px;
    height: 10px;
    animation: spin 0.8s linear infinite;
  }

  .admin-hub__role-icon {
    width: 12px;
    height: 12px;
  }

  .admin-hub__role--admin {
    background-color: rgba(168, 85, 247, 0.15);
    color: #c084fc;
  }

  /* ===== Sections ===== */
  .admin-hub__section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .admin-hub__section-title {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    margin: 0;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  /* ===== Card Grid ===== */
  .admin-hub__grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 0.875rem;
  }

  @media (min-width: 640px) {
    .admin-hub__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .admin-hub__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 1400px) {
    .admin-hub__grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (min-width: 1800px) {
    .admin-hub__grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  /* ===== Tool Card ===== */
  .admin-hub__card {
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

  .admin-hub__card::before {
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

  .admin-hub__card:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .admin-hub__card:hover::before {
    opacity: 1;
  }

  .admin-hub__card:active {
    transform: translateY(0);
  }

  .admin-hub__card-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem 1.125rem;
  }

  .admin-hub__card-info {
    flex: 1;
    min-width: 0;
  }

  .admin-hub__card-icon {
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

  .admin-hub__card:hover .admin-hub__card-icon {
    background-color: rgba(255, 255, 255, 0.08);
    transform: scale(1.05);
  }

  .admin-hub__card-icon-svg {
    width: 20px;
    height: 20px;
    color: var(--sidebar-text-muted);
    transition: color 180ms ease;
  }

  .admin-hub__card:hover .admin-hub__card-icon-svg {
    color: var(--sidebar-accent);
  }

  .admin-hub__card-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
    transition: color 180ms ease;
  }

  .admin-hub__card:hover .admin-hub__card-title {
    color: #fff;
  }

  .admin-hub__card-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .admin-hub__card-stat {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex-shrink: 0;
    margin-left: auto;
    padding-left: 0.75rem;
    border-left: 1px solid var(--sidebar-border);
    min-width: 48px;
  }

  .admin-hub__card-stat-value {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
    line-height: 1;
    transition: color 180ms ease;
  }

  .admin-hub__card:hover .admin-hub__card-stat-value {
    color: var(--sidebar-accent);
  }

  .admin-hub__card-stat-label {
    font-size: 0.5625rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.1875rem;
  }

  /* ===== Error State ===== */
  .admin-hub__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 4rem 1.5rem;
  }

  .admin-hub__error-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: rgba(239, 68, 68, 0.1);
    border-radius: 16px;
    margin-bottom: 1.5rem;
  }

  .admin-hub__error-icon {
    width: 36px;
    height: 36px;
    color: #f87171;
  }

  .admin-hub__error-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .admin-hub__error-message {
    color: var(--sidebar-text-muted);
    margin: 0 0 1.5rem;
    font-size: 0.875rem;
    max-width: 320px;
    line-height: 1.5;
  }

  /* ===== Skeleton Loading ===== */
  .admin-hub__skeleton-heading-title {
    width: 220px;
    height: 28px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 6px;
    margin-bottom: 0.5rem;
  }

  .admin-hub__skeleton-heading-subtitle {
    width: 360px;
    max-width: 100%;
    height: 16px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.1s;
    border-radius: 4px;
  }

  .admin-hub__skeleton-section-title {
    width: 60px;
    height: 12px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .admin-hub__card--skeleton {
    pointer-events: none;
  }

  .admin-hub__skeleton-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    flex-shrink: 0;
  }

  .admin-hub__skeleton-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .admin-hub__skeleton-line {
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .admin-hub__skeleton-line--title {
    width: 100px;
    height: 14px;
  }

  .admin-hub__skeleton-line--desc {
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
    .admin-hub__actions {
      flex-direction: column;
      width: 100%;
    }

    .admin-hub__action-btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>
