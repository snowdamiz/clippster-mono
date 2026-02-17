<template>
  <div class="admin-org-detail">
    <PageLayout
      :title="org ? `Organization: ${org.name}` : 'Organization Details'"
      description="Detailed organization information and management"
      :show-header="true"
      :show-back-button="true"
      :icon="Building2"
      :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Organizations', path: '/admin/organizations' }, { label: org?.name || 'Details' }]"
    >
      <!-- Loading State -->
      <div v-if="loading" class="admin-org-detail__loading">
        <Loader2 class="admin-org-detail__spinner" />
        <p>Loading organization details...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="admin-org-detail__error">
        <AlertTriangle class="admin-org-detail__error-icon" />
        <h2>Failed to load organization</h2>
        <p>{{ error }}</p>
        <Button @click="loadOrgDetails">Try Again</Button>
      </div>

      <!-- Main Content -->
      <div v-else-if="org" class="admin-org-detail__content">
        <!-- Header Card -->
        <div class="admin-org-detail__header-card">
          <div class="admin-org-detail__header-info">
            <div class="admin-org-detail__logo">
              <Building2 class="admin-org-detail__logo-icon" />
            </div>
            <div class="admin-org-detail__header-text">
              <h2 class="admin-org-detail__name">{{ org.name }}</h2>
              <p class="admin-org-detail__description">{{ org.description || 'No description' }}</p>
              <div class="admin-org-detail__badges">
                <span v-if="org.subscription?.tier" class="admin-org-detail__badge">
                  <Crown class="admin-org-detail__badge-icon" />
                  {{ org.subscription.tier }}
                </span>
              </div>
            </div>
          </div>
          <div class="admin-org-detail__header-stats">
            <div class="admin-org-detail__stat">
              <span class="admin-org-detail__stat-label">Members</span>
              <span class="admin-org-detail__stat-value">{{ org.member_count || 0 }}</span>
            </div>
            <div class="admin-org-detail__stat">
              <span class="admin-org-detail__stat-label">Created</span>
              <span class="admin-org-detail__stat-value">{{ formatDate(org.created_at) }}</span>
            </div>
          </div>
        </div>

        <!-- Owner Card -->
        <div v-if="org.owner" class="admin-org-detail__card">
          <h3 class="admin-org-detail__card-title">
            <User class="admin-org-detail__card-icon" />
            Organization Owner
          </h3>
          <div class="admin-org-detail__owner">
            <div class="admin-org-detail__owner-info">
              <div class="admin-org-detail__owner-avatar">
                <User class="admin-org-detail__owner-avatar-icon" />
              </div>
              <div>
                <div class="admin-org-detail__owner-name">{{ org.owner.name || 'Unnamed User' }}</div>
                <div class="admin-org-detail__owner-email">{{ org.owner.email }}</div>
              </div>
            </div>
            <Button @click="navigateToUserProfile(org.owner.id)" variant="outline" size="sm">
              View Profile
            </Button>
          </div>
        </div>

        <!-- Members Card -->
        <div v-if="org.members && org.members.length > 0" class="admin-org-detail__card">
          <h3 class="admin-org-detail__card-title">
            <Users class="admin-org-detail__card-icon" />
            Members ({{ org.members.length }})
          </h3>
          <div class="admin-org-detail__members">
            <div v-for="member in org.members" :key="member.id" class="admin-org-detail__member">
              <div class="admin-org-detail__member-info">
                <div class="admin-org-detail__member-avatar">
                  <User class="admin-org-detail__member-avatar-icon" />
                </div>
                <div>
                  <div class="admin-org-detail__member-name">{{ member.user?.name || 'Unnamed User' }}</div>
                  <div class="admin-org-detail__member-email">{{ member.user?.email }}</div>
                </div>
              </div>
              <div class="admin-org-detail__member-role">
                <span :class="['admin-org-detail__role-badge', `admin-org-detail__role-badge--${member.role}`]">
                  <Shield v-if="member.role === 'owner' || member.role === 'admin'" class="admin-org-detail__role-icon" />
                  {{ member.role }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Subscription Card -->
        <div class="admin-org-detail__card">
          <h3 class="admin-org-detail__card-title">
            <CreditCard class="admin-org-detail__card-icon" />
            Subscription
          </h3>
          <div class="admin-org-detail__subscription">
            <div class="admin-org-detail__field">
              <span class="admin-org-detail__field-label">Tier</span>
              <span class="admin-org-detail__field-value">{{ org.subscription?.tier || 'None' }}</span>
            </div>
            <div class="admin-org-detail__field">
              <span class="admin-org-detail__field-label">Status</span>
              <span class="admin-org-detail__field-value">{{ org.subscription?.status || 'none' }}</span>
            </div>
            <div class="admin-org-detail__field">
              <span class="admin-org-detail__field-label">Billing</span>
              <span class="admin-org-detail__field-value">{{ org.subscription?.billing_interval || 'N/A' }}</span>
            </div>
          </div>
        </div>

        <!-- Actions Card -->
        <div class="admin-org-detail__card">
          <h3 class="admin-org-detail__card-title">
            <Settings class="admin-org-detail__card-icon" />
            Actions
          </h3>
          <div class="admin-org-detail__actions">
            <Button @click="navigateToOrgPage" variant="outline" size="sm">
              <ExternalLink class="admin-org-detail__action-icon" />
              View Organization Page
            </Button>
            <Button @click="messageOwner" variant="outline" size="sm">
              <MessageSquare class="admin-org-detail__action-icon" />
              Message Owner
            </Button>
          </div>
        </div>
      </div>
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Building2,
  Crown,
  CreditCard,
  Settings,
  ExternalLink,
  MessageSquare,
  Loader2,
  AlertTriangle,
  Users,
  User,
  Shield,
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

const orgId = computed(() => route.params.id as string);

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

const loadOrgDetails = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const response = await api.get(`/admin/organizations/${orgId.value}/details`);
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
  router.push(`/organization/${orgId.value}`);
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
.admin-org-detail {
  width: 100%;
  min-height: 100%;
}

.admin-org-detail__loading,
.admin-org-detail__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem;
  text-align: center;
}

.admin-org-detail__spinner {
  width: 2rem;
  height: 2rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.admin-org-detail__error-icon {
  width: 3rem;
  height: 3rem;
  color: var(--destructive);
}

.admin-org-detail__content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.admin-org-detail__header-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
}

.admin-org-detail__header-info {
  display: flex;
  gap: 1rem;
  flex: 1;
}

.admin-org-detail__logo {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  background: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.admin-org-detail__logo-icon {
  width: 32px;
  height: 32px;
  color: var(--muted-foreground);
}

.admin-org-detail__header-text {
  flex: 1;
}

.admin-org-detail__name {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}

.admin-org-detail__description {
  color: var(--muted-foreground);
  margin: 0 0 0.75rem;
}

.admin-org-detail__badges {
  display: flex;
  gap: 0.5rem;
}

.admin-org-detail__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--accent);
  color: var(--accent-foreground);
}

.admin-org-detail__badge-icon {
  width: 12px;
  height: 12px;
}

.admin-org-detail__header-stats {
  display: flex;
  gap: 2rem;
}

.admin-org-detail__stat {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.admin-org-detail__stat-label {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.admin-org-detail__stat-value {
  font-size: 1.25rem;
  font-weight: 700;
}

.admin-org-detail__card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.5rem;
}

.admin-org-detail__card-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 1rem;
}

.admin-org-detail__card-icon {
  width: 20px;
  height: 20px;
}

.admin-org-detail__subscription {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.admin-org-detail__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.admin-org-detail__field-label {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.admin-org-detail__field-value {
  font-size: 1rem;
  font-weight: 600;
}

.admin-org-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.admin-org-detail__action-icon {
  width: 16px;
  height: 16px;
}

.admin-org-detail__owner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.admin-org-detail__owner-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.admin-org-detail__owner-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.admin-org-detail__owner-avatar-icon {
  width: 24px;
  height: 24px;
  color: var(--muted-foreground);
}

.admin-org-detail__owner-name {
  font-weight: 600;
  font-size: 0.9375rem;
}

.admin-org-detail__owner-email {
  font-size: 0.8125rem;
  color: var(--muted-foreground);
}

.admin-org-detail__members {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.admin-org-detail__member {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: var(--muted);
  border-radius: 6px;
}

.admin-org-detail__member-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.admin-org-detail__member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--background);
  display: flex;
  align-items: center;
  justify-content: center;
}

.admin-org-detail__member-avatar-icon {
  width: 20px;
  height: 20px;
  color: var(--muted-foreground);
}

.admin-org-detail__member-name {
  font-weight: 600;
  font-size: 0.875rem;
}

.admin-org-detail__member-email {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.admin-org-detail__member-role {
  display: flex;
  align-items: center;
}

.admin-org-detail__role-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
  background: var(--secondary);
  color: var(--secondary-foreground);
}

.admin-org-detail__role-badge--owner {
  background: hsl(var(--chart-1));
  color: white;
}

.admin-org-detail__role-badge--admin {
  background: hsl(var(--chart-2));
  color: white;
}

.admin-org-detail__role-icon {
  width: 12px;
  height: 12px;
}
</style>
