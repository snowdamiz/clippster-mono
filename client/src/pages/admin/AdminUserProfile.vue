<template>
  <div class="admin-user-profile">
    <PageLayout
      :title="user ? `User: ${userName}` : 'User Profile'"
      description="Detailed user information and management"
      :show-header="true"
      :show-back-button="true"
      :icon="User"
    >
      <!-- Loading State -->
      <div v-if="loading" class="admin-user-profile__loading">
        <Loader2 class="admin-user-profile__spinner" />
        <p>Loading user profile...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="admin-user-profile__error">
        <AlertTriangle class="admin-user-profile__error-icon" />
        <h2>Failed to load user profile</h2>
        <p>{{ error }}</p>
        <Button @click="loadUserProfile">Try Again</Button>
      </div>

      <!-- Main Content -->
      <div v-else-if="user" class="admin-user-profile__content">
        <!-- Header Card -->
        <div class="admin-user-profile__header-card">
          <div class="admin-user-profile__header-info">
            <div class="admin-user-profile__avatar">
              <User class="admin-user-profile__avatar-icon" />
            </div>
            <div class="admin-user-profile__header-text">
              <h2 class="admin-user-profile__name">{{ userName }}</h2>
              <p class="admin-user-profile__email">{{ user.email || user.wallet_address }}</p>
              <div class="admin-user-profile__badges">
                <span v-if="user.is_admin" class="admin-user-profile__badge admin-user-profile__badge--admin">
                  <Shield class="admin-user-profile__badge-icon" />
                  Admin
                </span>
                <span v-if="user.is_moderator" class="admin-user-profile__badge admin-user-profile__badge--moderator">
                  <Shield class="admin-user-profile__badge-icon" />
                  Moderator
                </span>
                <span v-if="user.is_restricted" class="admin-user-profile__badge admin-user-profile__badge--restricted">
                  <Ban class="admin-user-profile__badge-icon" />
                  Restricted
                </span>
                <span v-if="user.subscription?.tier" class="admin-user-profile__badge admin-user-profile__badge--tier">
                  <Crown class="admin-user-profile__badge-icon" />
                  {{ user.subscription.tier }}
                </span>
              </div>
            </div>
          </div>
          <div class="admin-user-profile__header-stats">
            <div class="admin-user-profile__stat">
              <span class="admin-user-profile__stat-label">Account Age</span>
              <span class="admin-user-profile__stat-value">{{ accountAge }}</span>
            </div>
            <div class="admin-user-profile__stat">
              <span class="admin-user-profile__stat-label">Last Active</span>
              <span class="admin-user-profile__stat-value">{{ lastActive }}</span>
            </div>
          </div>
        </div>

        <!-- Subscription Card -->
        <div class="admin-user-profile__card">
          <h3 class="admin-user-profile__card-title">
            <CreditCard class="admin-user-profile__card-icon" />
            Subscription
          </h3>
          <div class="admin-user-profile__subscription">
            <div class="admin-user-profile__subscription-info">
              <div class="admin-user-profile__field">
                <span class="admin-user-profile__field-label">Tier</span>
                <span class="admin-user-profile__field-value">{{ user.subscription?.tier || 'Free' }}</span>
              </div>
              <div class="admin-user-profile__field">
                <span class="admin-user-profile__field-label">Status</span>
                <span class="admin-user-profile__field-value">{{ user.subscription?.status || 'none' }}</span>
              </div>
              <div class="admin-user-profile__field">
                <span class="admin-user-profile__field-label">Billing</span>
                <span class="admin-user-profile__field-value">{{ user.subscription?.billing_interval || 'N/A' }}</span>
              </div>
              <div v-if="user.subscription?.renewal_date" class="admin-user-profile__field">
                <span class="admin-user-profile__field-label">Renewal Date</span>
                <span class="admin-user-profile__field-value">{{ formatDate(user.subscription.renewal_date) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Credits Card -->
        <div class="admin-user-profile__card">
          <h3 class="admin-user-profile__card-title">
            <Coins class="admin-user-profile__card-icon" />
            Credits
          </h3>
          <div class="admin-user-profile__credits">
            <div class="admin-user-profile__field">
              <span class="admin-user-profile__field-label">Remaining</span>
              <span class="admin-user-profile__field-value">{{ user.credits?.hours_remaining?.toFixed(2) || '0.00' }} hours</span>
            </div>
            <div class="admin-user-profile__field">
              <span class="admin-user-profile__field-label">Used</span>
              <span class="admin-user-profile__field-value">{{ user.credits?.hours_used?.toFixed(2) || '0.00' }} hours</span>
            </div>
          </div>
        </div>

        <!-- Discount Card -->
        <div v-if="user.discount" class="admin-user-profile__card">
          <h3 class="admin-user-profile__card-title">
            <Percent class="admin-user-profile__card-icon" />
            Discounts
          </h3>
          <div class="admin-user-profile__discounts">
            <div v-if="user.discount.admin_discount_percent" class="admin-user-profile__field">
              <span class="admin-user-profile__field-label">Admin Discount</span>
              <span class="admin-user-profile__field-value">
                {{ user.discount.admin_discount_percent }}% off ({{ user.discount.admin_discount_months_remaining }} months remaining)
              </span>
            </div>
            <div class="admin-user-profile__field">
              <span class="admin-user-profile__field-label">Moderator Discount</span>
              <span class="admin-user-profile__field-value">{{ user.discount.mod_discount_enabled ? 'Enabled (10%)' : 'Disabled' }}</span>
            </div>
          </div>
        </div>

        <!-- Actions Card -->
        <div class="admin-user-profile__card">
          <h3 class="admin-user-profile__card-title">
            <Settings class="admin-user-profile__card-icon" />
            Actions
          </h3>
          <div class="admin-user-profile__actions">
            <Button @click="showPromoteModeratorDialog = true" v-if="!user.is_moderator" variant="outline" size="sm">
              <UserPlus class="admin-user-profile__action-icon" />
              Promote to Moderator
            </Button>
            <Button @click="demoteModerator" v-if="user.is_moderator" variant="outline" size="sm">
              <UserMinus class="admin-user-profile__action-icon" />
              Demote Moderator
            </Button>
            <Button @click="showModDiscountDialog = true" v-if="user.is_moderator && !user.discount?.mod_discount_enabled" variant="outline" size="sm">
              <Percent class="admin-user-profile__action-icon" />
              Enable Mod Discount
            </Button>
            <Button @click="disableModDiscount" v-if="user.is_moderator && user.discount?.mod_discount_enabled" variant="outline" size="sm">
              <Percent class="admin-user-profile__action-icon" />
              Disable Mod Discount
            </Button>
            <Button @click="showRestrictDialog = true" v-if="!user.is_restricted" variant="outline" size="sm">
              <Ban class="admin-user-profile__action-icon" />
              Restrict User
            </Button>
            <Button @click="unrestrictUser" v-if="user.is_restricted" variant="outline" size="sm">
              <CheckCircle class="admin-user-profile__action-icon" />
              Unrestrict User
            </Button>
            <Button @click="showDiscountDialog = true" variant="outline" size="sm">
              <Percent class="admin-user-profile__action-icon" />
              Apply Discount
            </Button>
            <Button @click="grantFreeMonth" variant="outline" size="sm">
              <Gift class="admin-user-profile__action-icon" />
              Grant Free Month
            </Button>
            <Button @click="showDeleteDialog = true" variant="destructive" size="sm">
              <Trash2 class="admin-user-profile__action-icon" />
              Delete User
            </Button>
          </div>
        </div>
      </div>
    </PageLayout>

    <!-- Dialogs -->
    <Dialog v-model:open="showPromoteModeratorDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote to Moderator</DialogTitle>
          <DialogDescription>
            Promote this user to moderator? They will have access to moderation tools but not full admin privileges.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showPromoteModeratorDialog = false">Cancel</Button>
          <Button @click="promoteModerator">Promote</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showRestrictDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restrict User</DialogTitle>
          <DialogDescription>
            Restrict this user's platform access. They will be able to log in but cannot perform actions.
          </DialogDescription>
        </DialogHeader>
        <div class="admin-user-profile__dialog-field">
          <label>Reason</label>
          <input v-model="restrictReason" type="text" placeholder="Enter restriction reason" />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showRestrictDialog = false">Cancel</Button>
          <Button variant="destructive" @click="restrictUser">Restrict</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showDiscountDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply Discount</DialogTitle>
          <DialogDescription>
            Apply a custom discount to this user's subscription.
          </DialogDescription>
        </DialogHeader>
        <div class="admin-user-profile__dialog-fields">
          <div class="admin-user-profile__dialog-field">
            <label>Discount Percentage</label>
            <input v-model.number="discountPercent" type="number" min="1" max="100" placeholder="e.g., 50" />
          </div>
          <div class="admin-user-profile__dialog-field">
            <label>Duration (months)</label>
            <input v-model.number="discountMonths" type="number" min="1" placeholder="e.g., 3" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showDiscountDialog = false">Cancel</Button>
          <Button @click="applyDiscount">Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showDeleteDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
          <DialogDescription>
            This will schedule the user for deletion. If they have an active subscription, deletion will occur at the end of their billing cycle.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showDeleteDialog = false">Cancel</Button>
          <Button variant="destructive" @click="deleteUser">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showModDiscountDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable Moderator Discount</DialogTitle>
          <DialogDescription>
            Enable the 10% moderator discount for this user.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showModDiscountDialog = false">Cancel</Button>
          <Button @click="enableModDiscount">Enable</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  User,
  Shield,
  Ban,
  Crown,
  CreditCard,
  Coins,
  Percent,
  Settings,
  UserPlus,
  UserMinus,
  CheckCircle,
  Gift,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import PageLayout from '@/components/PageLayout.vue';
import api from '@/services/api';
import { useToast } from '@/composables/useToast';

const route = useRoute();
const router = useRouter();
const { success: toast, error: toastError } = useToast();

const loading = ref(false);
const error = ref<string | null>(null);
const user = ref<any>(null);

// Dialog states
const showPromoteModeratorDialog = ref(false);
const showRestrictDialog = ref(false);
const showDiscountDialog = ref(false);
const showDeleteDialog = ref(false);
const showModDiscountDialog = ref(false);

// Form data
const restrictReason = ref('');
const discountPercent = ref(50);
const discountMonths = ref(1);

const userId = computed(() => route.params.id as string);

const userName = computed(() => {
  if (!user.value) return '';
  return user.value.name || user.value.email || user.value.wallet_address || 'Unknown User';
});

const accountAge = computed(() => {
  if (!user.value?.created_at) return 'Unknown';
  const created = new Date(user.value.created_at);
  const now = new Date();
  const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.floor(days / 30)} months`;
  return `${Math.floor(days / 365)} years`;
});

const lastActive = computed(() => {
  if (!user.value?.last_active_at) return 'Never';
  const lastActive = new Date(user.value.last_active_at);
  const now = new Date();
  const hours = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(user.value.last_active_at);
});

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString();
};

const loadUserProfile = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const response = await api.get(`/admin/users/${userId.value}/profile`);
    if (response.data.success) {
      user.value = response.data.user;
    } else {
      error.value = response.data.error || 'Failed to load user profile';
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message || 'Failed to load user profile';
  } finally {
    loading.value = false;
  }
};

const promoteModerator = async () => {
  try {
    const response = await api.post(`/admin/users/${userId.value}/moderator`);
    if (response.data.success) {
      toast('User promoted to moderator');
      showPromoteModeratorDialog.value = false;
      await loadUserProfile();
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to promote user');
  }
};

const demoteModerator = async () => {
  try {
    const response = await api.delete(`/admin/users/${userId.value}/moderator`);
    if (response.data.success) {
      toast('Moderator demoted');
      await loadUserProfile();
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to demote moderator');
  }
};

const enableModDiscount = async () => {
  try {
    const response = await api.post(`/admin/users/${userId.value}/mod-discount`);
    if (response.data.success) {
      toast('Moderator discount enabled');
      showModDiscountDialog.value = false;
      await loadUserProfile();
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to enable discount');
  }
};

const disableModDiscount = async () => {
  try {
    const response = await api.delete(`/admin/users/${userId.value}/mod-discount`);
    if (response.data.success) {
      toast('Moderator discount disabled');
      await loadUserProfile();
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to disable discount');
  }
};

const restrictUser = async () => {
  try {
    const response = await api.post(`/admin/users/${userId.value}/restrict`, {
      reason: restrictReason.value || 'No reason provided'
    });
    if (response.data.success) {
      toast('User restricted');
      showRestrictDialog.value = false;
      restrictReason.value = '';
      await loadUserProfile();
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to restrict user');
  }
};

const unrestrictUser = async () => {
  try {
    const response = await api.delete(`/admin/users/${userId.value}/restrict`);
    if (response.data.success) {
      toast('User unrestricted');
      await loadUserProfile();
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to unrestrict user');
  }
};

const applyDiscount = async () => {
  try {
    const response = await api.post(`/admin/users/${userId.value}/discount`, {
      percent_off: discountPercent.value,
      months: discountMonths.value
    });
    if (response.data.success) {
      toast('Discount applied');
      showDiscountDialog.value = false;
      await loadUserProfile();
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to apply discount');
  }
};

const grantFreeMonth = async () => {
  try {
    const response = await api.post(`/admin/users/${userId.value}/free-month`);
    if (response.data.success) {
      toast('Free month granted');
      await loadUserProfile();
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to grant free month');
  }
};

const deleteUser = async () => {
  try {
    const response = await api.delete(`/admin/users/${userId.value}`);
    if (response.data.success) {
      toast('User scheduled for deletion');
      showDeleteDialog.value = false;
      router.push('/admin/users');
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to delete user');
  }
};

onMounted(() => {
  loadUserProfile();
});
</script>

<style scoped>
.admin-user-profile {
  width: 100%;
  min-height: 100%;
}

.admin-user-profile__loading,
.admin-user-profile__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem;
  text-align: center;
}

.admin-user-profile__spinner {
  width: 2rem;
  height: 2rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.admin-user-profile__error-icon {
  width: 3rem;
  height: 3rem;
  color: var(--destructive);
}

.admin-user-profile__content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.admin-user-profile__header-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
}

.admin-user-profile__header-info {
  display: flex;
  gap: 1rem;
  flex: 1;
}

.admin-user-profile__avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.admin-user-profile__avatar-icon {
  width: 32px;
  height: 32px;
  color: var(--muted-foreground);
}

.admin-user-profile__header-text {
  flex: 1;
}

.admin-user-profile__name {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.25rem;
}

.admin-user-profile__email {
  color: var(--muted-foreground);
  margin: 0 0 0.75rem;
}

.admin-user-profile__badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.admin-user-profile__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.admin-user-profile__badge--admin {
  background: var(--primary);
  color: var(--primary-foreground);
}

.admin-user-profile__badge--moderator {
  background: var(--secondary);
  color: var(--secondary-foreground);
}

.admin-user-profile__badge--restricted {
  background: var(--destructive);
  color: var(--destructive-foreground);
}

.admin-user-profile__badge--tier {
  background: var(--accent);
  color: var(--accent-foreground);
}

.admin-user-profile__badge-icon {
  width: 12px;
  height: 12px;
}

.admin-user-profile__header-stats {
  display: flex;
  gap: 2rem;
}

.admin-user-profile__stat {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.admin-user-profile__stat-label {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.admin-user-profile__stat-value {
  font-size: 1.25rem;
  font-weight: 700;
}

.admin-user-profile__card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.5rem;
}

.admin-user-profile__card-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 1rem;
}

.admin-user-profile__card-icon {
  width: 20px;
  height: 20px;
}

.admin-user-profile__subscription,
.admin-user-profile__credits,
.admin-user-profile__discounts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.admin-user-profile__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.admin-user-profile__field-label {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.admin-user-profile__field-value {
  font-size: 1rem;
  font-weight: 600;
}

.admin-user-profile__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.admin-user-profile__action-icon {
  width: 16px;
  height: 16px;
}

.admin-user-profile__dialog-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 1rem 0;
}

.admin-user-profile__dialog-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.admin-user-profile__dialog-field label {
  font-size: 0.875rem;
  font-weight: 600;
}

.admin-user-profile__dialog-field input {
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--background);
  color: var(--foreground);
}
</style>
