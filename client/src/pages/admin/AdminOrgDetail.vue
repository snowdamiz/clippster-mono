<template>
  <div class="admin-org-detail-page">
    <PageLayout
      :title="org?.name || 'Organization Details'"
      :description="org?.description || ''"
      :show-header="true"
      :icon="Building2"
      :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Organizations', path: '/admin/organizations' }, { label: org?.name || 'Details' }]"
    >
      <template #actions>
        <div v-if="org" class="org-header-actions">
          <button @click="navigateToOrgPage" class="org-action-btn org-action-btn--primary">
            <ExternalLink class="org-action-btn__icon" />
            View Page
          </button>
          <button @click="messageOwner" class="org-action-btn org-action-btn--outline">
            <MessageSquare class="org-action-btn__icon" />
            Message Owner
          </button>
        </div>
      </template>

      <!-- Loading State -->
      <div v-if="loading" class="org-content org-content--loading">
        <div class="loading-spinner">
          <Loader2 class="loading-spinner__icon" />
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="org-content org-content--empty">
        <div class="empty-state">
          <div class="empty-state__icon-wrapper">
            <AlertTriangle class="empty-state__icon" />
          </div>
          <h3 class="empty-state__title">Failed to load organization</h3>
          <p class="empty-state__description">{{ error }}</p>
          <Button @click="loadOrgDetails">Try Again</Button>
        </div>
      </div>

      <!-- Main Content -->
      <div v-else-if="org" class="org-content">
        <!-- Organization Header -->
        <header class="org-header">
          <div class="org-header__main">
            <div class="org-avatar">
              <img
                v-if="org.logo_url"
                :src="org.logo_url"
                class="org-avatar__img"
              />
              <Building2 v-else class="org-avatar__fallback" />
            </div>
            <div class="org-meta">
              <div class="org-meta__top">
                <h1 class="org-name">{{ org.name }}</h1>
                <span v-if="org.subscription?.tier" class="tier-badge">
                  <Crown :size="12" class="tier-badge__icon" />
                  {{ org.subscription.tier }}
                </span>
                <span v-if="org.subscription?.status === 'active'" class="status-badge status-badge--active">
                  <span class="status-badge__dot"></span>
                  Active
                </span>
              </div>
              <p v-if="org.description" class="org-bio">{{ org.description }}</p>
            </div>
          </div>
          <div class="org-stats">
            <div class="stat">
              <span class="stat__value">{{ org.member_count || 0 }}</span>
              <span class="stat__label">Members</span>
            </div>
            <div class="stat">
              <span class="stat__value">{{ formatDate(org.created_at) }}</span>
              <span class="stat__label">Created</span>
            </div>
          </div>
        </header>

        <!-- Two Column Layout -->
        <div class="main-layout">
          <!-- Left Column -->
          <div class="main-column">
            <!-- Owner Section -->
            <section v-if="org.owner" class="section">
              <div class="section__header">
                <div class="section__header-icon">
                  <User />
                </div>
                <div class="section__header-text">
                  <h2 class="section__title">Organization Owner</h2>
                  <p class="section__subtitle">Primary account holder</p>
                </div>
              </div>
              <div class="owner-card">
                <div class="owner-card__info">
                  <div class="owner-card__avatar">
                    <User class="owner-card__avatar-icon" />
                  </div>
                  <div class="owner-card__details">
                    <div class="owner-card__name">{{ org.owner.name || 'Unnamed User' }}</div>
                    <div class="owner-card__email">{{ org.owner.email }}</div>
                  </div>
                </div>
                <Button @click="navigateToUserProfile(org.owner.id)" variant="outline" size="sm">
                  View Profile
                </Button>
              </div>
            </section>

            <!-- Members Section -->
            <section v-if="org.members && org.members.length > 0" class="section">
              <div class="section__header">
                <div class="section__header-icon section__header-icon--purple">
                  <Users />
                </div>
                <div class="section__header-text">
                  <h2 class="section__title">Members</h2>
                  <p class="section__subtitle">{{ org.members.length }} total members</p>
                </div>
              </div>
              <div class="members-list">
                <div v-for="member in org.members" :key="member.id" class="member-card">
                  <div class="member-card__info">
                    <div class="member-card__avatar">
                      <User />
                    </div>
                    <div class="member-card__details">
                      <div class="member-card__name">{{ member.user?.name || 'Unnamed User' }}</div>
                      <div class="member-card__email">{{ member.user?.email }}</div>
                    </div>
                  </div>
                  <span :class="['role-badge', `role-badge--${member.role}`]">
                    <Shield v-if="member.role === 'owner' || member.role === 'admin'" :size="12" />
                    {{ member.role }}
                  </span>
                </div>
              </div>
            </section>
          </div>

          <!-- Right Sidebar -->
          <aside class="sidebar-column">
            <!-- Subscription Card -->
            <div class="sidebar-card">
              <div class="sidebar-card__header">
                <CreditCard class="sidebar-card__icon" />
                <h3 class="sidebar-card__title">Subscription</h3>
              </div>
              <div class="sidebar-card__content">
                <div class="info-list">
                  <div class="info-list-item">
                    <div class="info-list-item__label">Tier</div>
                    <div class="info-list-item__value">{{ org.subscription?.tier || 'Free' }}</div>
                  </div>
                  <div class="info-list-item">
                    <div class="info-list-item__label">Status</div>
                    <span :class="['status-badge', `status-badge--${org.subscription?.status || 'none'}`]">
                      {{ org.subscription?.status || 'none' }}
                    </span>
                  </div>
                  <div class="info-list-item">
                    <div class="info-list-item__label">Billing</div>
                    <div class="info-list-item__value">{{ org.subscription?.billing_interval || 'N/A' }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Details Card -->
            <div class="sidebar-card">
              <div class="sidebar-card__header">
                <Info class="sidebar-card__icon" />
                <h3 class="sidebar-card__title">Details</h3>
              </div>
              <div class="sidebar-card__content">
                <div class="info-list">
                  <div class="info-list-item">
                    <div class="info-list-item__label">Organization ID</div>
                    <div class="info-list-item__value info-list-item__value--mono">{{ org.id }}</div>
                  </div>
                  <div class="info-list-item">
                    <div class="info-list-item__label">Created</div>
                    <div class="info-list-item__value">{{ formatFullDate(org.created_at) }}</div>
                  </div>
                  <div v-if="org.updated_at" class="info-list-item">
                    <div class="info-list-item__label">Last Updated</div>
                    <div class="info-list-item__value">{{ formatFullDate(org.updated_at) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Building2,
  Crown,
  CreditCard,
  ExternalLink,
  MessageSquare,
  Loader2,
  AlertTriangle,
  Users,
  User,
  Shield,
  Info,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import PageLayout from '@/components/PageLayout.vue';
import api from '@/services/api';
import { useToast } from '@/composables/useToast';

const route = useRoute();
const router = useRouter();
const { success: toast, error: toastError } = useToast();

const loading = ref(false);
const error = ref<string | null>(null);
const org = ref<any>(null);

const orgId = route.params.id as string;

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatFullDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const loadOrgDetails = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const response = await api.get(`/admin/organizations/${orgId}/details`);
    if (response.data.success) {
      org.value = response.data.organization;
    } else {
      error.value = response.data.error || 'Failed to load organization';
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message || 'Failed to load organization';
  } finally {
    loading.value = false;
  }
};

const navigateToOrgPage = () => {
  router.push(`/organization/${orgId}`);
};

const messageOwner = () => {
  toast('Messaging feature coming soon');
};

const navigateToUserProfile = (userId: number) => {
  router.push(`/admin/users/${userId}`);
};

onMounted(() => {
  loadOrgDetails();
});
</script>

<style scoped>
/* ===== Page Container ===== */
.admin-org-detail-page {
  width: 100%;
  min-height: 100%;
}

.org-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.org-content--loading,
.org-content--empty {
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

/* ===== Loading State ===== */
.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-spinner__icon {
  width: 40px;
  height: 40px;
  color: var(--sidebar-text-muted);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ===== Empty State ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.empty-state__icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  background-color: var(--sidebar-hover);
  border-radius: 16px;
  margin-bottom: 1.5rem;
}

.empty-state__icon {
  width: 36px;
  height: 36px;
  color: var(--sidebar-text-muted);
}

.empty-state__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 0.5rem;
}

.empty-state__description {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0 0 1.5rem;
  max-width: 320px;
  line-height: 1.5;
}

/* ===== Organization Header ===== */
.org-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
}

@media (max-width: 640px) {
  .org-header {
    flex-direction: column;
  }
}

.org-header__main {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  flex: 1;
}

.org-avatar {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 12px;
  background: var(--sidebar-surface);
  overflow: hidden;
  flex-shrink: 0;
}

.org-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.org-avatar__fallback {
  width: 100%;
  height: 100%;
  padding: 16px;
  color: var(--sidebar-text-muted);
}

.org-meta {
  flex: 1;
  min-width: 0;
}

.org-meta__top {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
  margin-bottom: 0.375rem;
}

.org-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.tier-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: rgba(6, 182, 212, 0.12);
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--sidebar-accent);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.tier-badge__icon {
  flex-shrink: 0;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.status-badge--active {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.status-badge--none {
  background: rgba(107, 114, 128, 0.15);
  color: #9ca3af;
}

.status-badge__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.status-badge--active .status-badge__dot {
  background: #10b981;
  box-shadow: 0 0 4px rgba(16, 185, 129, 0.6);
}

.status-badge--none .status-badge__dot {
  background: #6b7280;
}

.org-bio {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  line-height: 1.5;
  max-width: 420px;
}

.org-stats {
  display: flex;
  gap: 2rem;
}

.stat {
  text-align: center;
}

.stat__value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--sidebar-text);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.stat__label {
  display: block;
  font-size: 0.5625rem;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.25rem;
}

/* Header Action Buttons */
.org-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.org-action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 32px;
  padding: 0 0.875rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
}

.org-action-btn--primary {
  background-color: var(--sidebar-accent);
  color: var(--sidebar-bg);
  border: none;
}

.org-action-btn--primary:hover:not(:disabled) {
  opacity: 0.9;
}

.org-action-btn--outline {
  background: transparent;
  border: 1px solid var(--sidebar-border);
  color: var(--sidebar-text);
}

.org-action-btn--outline:hover:not(:disabled) {
  border-color: var(--sidebar-accent);
  color: var(--sidebar-accent);
}

.org-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.org-action-btn__icon {
  width: 14px;
  height: 14px;
}

/* ===== Main Layout ===== */
.main-layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 1024px) {
  .main-layout {
    grid-template-columns: 1fr;
  }
}

/* ===== Main Column ===== */
.main-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ===== Section ===== */
.section {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
  padding: 1.25rem;
}

.section__header {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  margin-bottom: 1.25rem;
}

.section__header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  flex-shrink: 0;
}

.section__header-icon svg {
  width: 20px;
  height: 20px;
}

.section__header-icon--purple {
  background-color: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
}

.section__header-text {
  flex: 1;
  min-width: 0;
}

.section__title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.01em;
}

.section__subtitle {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0.1875rem 0 0;
}

/* Owner Card */
.owner-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.owner-card__info {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.owner-card__avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--sidebar-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.owner-card__avatar-icon {
  width: 24px;
  height: 24px;
  color: var(--sidebar-text-muted);
}

.owner-card__details {
  flex: 1;
  min-width: 0;
}

.owner-card__name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--sidebar-text);
}

.owner-card__email {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin-top: 0.125rem;
}

/* Members List */
.members-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.member-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.875rem;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
}

.member-card__info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.member-card__avatar {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: var(--sidebar-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.member-card__avatar svg {
  width: 18px;
  height: 18px;
  color: var(--sidebar-text-muted);
}

.member-card__details {
  flex: 1;
  min-width: 0;
}

.member-card__name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.member-card__email {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
  margin-top: 0.125rem;
}

.role-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: capitalize;
  background: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.role-badge--owner {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}

.role-badge--admin {
  background: rgba(168, 85, 247, 0.15);
  color: #a78bfa;
}

/* ===== Sidebar Column ===== */
.sidebar-column {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  position: sticky;
  top: 1.5rem;
}

@media (max-width: 1024px) {
  .sidebar-column {
    position: static;
  }
}

/* Sidebar Card */
.sidebar-card {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
  overflow: hidden;
}

.sidebar-card__header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 1rem 1.125rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.sidebar-card__icon {
  width: 18px;
  height: 18px;
  color: var(--sidebar-accent);
}

.sidebar-card__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
}

.sidebar-card__content {
  padding: 1rem 1.125rem;
}

/* Info List */
.info-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.info-list-item {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.info-list-item__label {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.info-list-item__value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.info-list-item__value--mono {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  color: var(--sidebar-accent);
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .org-content {
    padding: 1rem;
    gap: 1.25rem;
  }

  .org-header {
    flex-direction: column;
  }

  .org-header__main {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .org-name {
    font-size: 1.125rem;
  }

  .org-meta__top {
    justify-content: center;
  }

  .org-stats {
    width: 100%;
    justify-content: center;
  }

  .stat {
    min-width: 80px;
  }

  .main-layout {
    gap: 1rem;
  }
}
</style>
