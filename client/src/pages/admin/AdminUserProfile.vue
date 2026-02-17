<template>
  <div class="admin-user-profile">
    <PageLayout
      :title="user ? `User: ${userName}` : 'User Profile'"
      description="Detailed user information and management"
      :show-header="true"
      :show-back-button="true"
      :icon="User"
      :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Users', path: '/admin/users' }, { label: userName || 'Profile' }]"
    >
      <!-- Loading State -->
      <div v-if="loading" class="user-content user-content--loading">
        <div class="loading-spinner">
          <Loader2 class="loading-spinner__icon" />
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="user-content user-content--empty">
        <div class="empty-state">
          <div class="empty-state__icon-wrapper">
            <AlertTriangle class="empty-state__icon" />
          </div>
          <h3 class="empty-state__title">Failed to load user profile</h3>
          <p class="empty-state__description">{{ error }}</p>
          <Button @click="loadUserProfile">Try Again</Button>
        </div>
      </div>

      <!-- Main Content -->
      <div v-else-if="user" class="user-content">
        <!-- User Header -->
        <header class="user-header">
          <div class="user-header__main">
            <div class="user-avatar">
              <img
                v-if="user.avatar_url"
                :src="user.avatar_url"
                class="user-avatar__img"
              />
              <User v-else class="user-avatar__fallback" />
            </div>
            <div class="user-meta">
              <div class="user-meta__top">
                <h1 class="user-name">{{ userName }}</h1>
                <span v-if="user.subscription?.tier" class="tier-badge">
                  <Crown :size="12" class="tier-badge__icon" />
                  {{ user.subscription.tier }}
                </span>
                <span v-if="user.is_admin" class="status-badge status-badge--admin">
                  <Shield :size="12" />
                  Admin
                </span>
                <span v-if="user.is_moderator" class="status-badge status-badge--moderator">
                  <Shield :size="12" />
                  Moderator
                </span>
                <span v-if="user.is_restricted" class="status-badge status-badge--restricted">
                  <Ban :size="12" />
                  Restricted
                </span>
              </div>
              <p class="user-bio">{{ user.email || user.wallet_address }}</p>
            </div>
          </div>
          <div class="user-stats">
            <div class="stat">
              <span class="stat__value">{{ accountAge }}</span>
              <span class="stat__label">Account Age</span>
            </div>
            <div class="stat">
              <span class="stat__value">{{ lastActive }}</span>
              <span class="stat__label">Last Active</span>
            </div>
          </div>
        </header>

        <!-- Two Column Layout -->
        <div class="main-layout">
          <!-- Left Column -->
          <div class="main-column">
            <!-- Actions Section -->
            <section class="section">
              <div class="section__header">
                <div class="section__header-icon">
                  <Settings />
                </div>
                <div class="section__header-text">
                  <h2 class="section__title">Admin Actions</h2>
                  <p class="section__subtitle">Manage user permissions and settings</p>
                </div>
              </div>
              
              <!-- Permissions Group -->
              <div class="action-group">
                <div class="action-group__label">Permissions</div>
                <div class="action-group__buttons">
                  <button @click="showPromoteModeratorDialog = true" v-if="!user.is_moderator" class="action-btn action-btn--outline">
                    <UserPlus :size="18" />
                    <span>Promote to Moderator</span>
                  </button>
                  <button @click="demoteModerator" v-if="user.is_moderator" class="action-btn action-btn--outline">
                    <UserMinus :size="18" />
                    <span>Demote Moderator</span>
                  </button>
                </div>
              </div>

              <!-- Restrictions Group -->
              <div class="action-group">
                <div class="action-group__label">Account Status</div>
                <div class="action-group__buttons">
                  <button @click="showRestrictDialog = true" v-if="!user.is_restricted" class="action-btn action-btn--warning">
                    <Ban :size="18" />
                    <span>Restrict User</span>
                  </button>
                  <button @click="unrestrictUser" v-if="user.is_restricted" class="action-btn action-btn--success">
                    <CheckCircle :size="18" />
                    <span>Unrestrict User</span>
                  </button>
                </div>
              </div>

              <!-- Billing Group -->
              <div class="action-group">
                <div class="action-group__label">Billing & Discounts</div>
                <div class="action-group__buttons">
                  <button @click="showModDiscountDialog = true" v-if="user.is_moderator && !user.discount?.mod_discount_enabled" class="action-btn action-btn--outline">
                    <Percent :size="18" />
                    <span>Enable Mod Discount</span>
                  </button>
                  <button @click="disableModDiscount" v-if="user.is_moderator && user.discount?.mod_discount_enabled" class="action-btn action-btn--outline">
                    <Percent :size="18" />
                    <span>Disable Mod Discount</span>
                  </button>
                  <button @click="showDiscountDialog = true" class="action-btn action-btn--outline">
                    <Percent :size="18" />
                    <span>Apply Custom Discount</span>
                  </button>
                  <button @click="grantFreeMonth" class="action-btn action-btn--outline">
                    <Gift :size="18" />
                    <span>Grant Free Month</span>
                  </button>
                </div>
              </div>

              <!-- Danger Zone -->
              <div class="action-group action-group--danger">
                <div class="action-group__label">Danger Zone</div>
                <div class="action-group__buttons">
                  <button @click="showDeleteDialog = true" class="action-btn action-btn--danger">
                    <Trash2 :size="18" />
                    <span>Delete User</span>
                  </button>
                </div>
              </div>
            </section>

            <!-- Discounts Section -->
            <section v-if="user.discount && (user.discount.admin_discount_percent || user.discount.mod_discount_enabled)" class="section">
              <div class="section__header">
                <div class="section__header-icon section__header-icon--purple">
                  <Percent />
                </div>
                <div class="section__header-text">
                  <h2 class="section__title">Active Discounts</h2>
                  <p class="section__subtitle">Current discount configurations</p>
                </div>
              </div>
              <div class="discount-list">
                <div v-if="user.discount.admin_discount_percent" class="discount-item">
                  <div class="discount-item__header">
                    <div class="discount-item__icon discount-item__icon--admin">
                      <Percent :size="16" />
                    </div>
                    <div class="discount-item__info">
                      <div class="discount-item__title">Admin Discount</div>
                      <div class="discount-item__description">Special admin-granted discount</div>
                    </div>
                  </div>
                  <div class="discount-item__details">
                    <div class="discount-item__amount">{{ user.discount.admin_discount_percent }}% off</div>
                    <div class="discount-item__duration">{{ user.discount.admin_discount_months_remaining }} months remaining</div>
                  </div>
                </div>
                <div v-if="user.discount.mod_discount_enabled" class="discount-item">
                  <div class="discount-item__header">
                    <div class="discount-item__icon discount-item__icon--mod">
                      <Shield :size="16" />
                    </div>
                    <div class="discount-item__info">
                      <div class="discount-item__title">Moderator Discount</div>
                      <div class="discount-item__description">10% discount for moderators</div>
                    </div>
                  </div>
                  <div class="discount-item__details">
                    <div class="discount-item__amount">10% off</div>
                    <span class="discount-item__badge discount-item__badge--active">Active</span>
                  </div>
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
                    <div class="info-list-item__value">{{ user.subscription?.tier || 'Free' }}</div>
                  </div>
                  <div class="info-list-item">
                    <div class="info-list-item__label">Status</div>
                    <span :class="['status-badge', `status-badge--${user.subscription?.status || 'none'}`]">
                      {{ user.subscription?.status || 'none' }}
                    </span>
                  </div>
                  <div class="info-list-item">
                    <div class="info-list-item__label">Billing</div>
                    <div class="info-list-item__value">{{ user.subscription?.billing_interval || 'N/A' }}</div>
                  </div>
                  <div v-if="user.subscription?.renewal_date" class="info-list-item">
                    <div class="info-list-item__label">Renewal</div>
                    <div class="info-list-item__value">{{ formatDate(user.subscription.renewal_date) }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Credits Card -->
            <div class="sidebar-card">
              <div class="sidebar-card__header">
                <Coins class="sidebar-card__icon" />
                <h3 class="sidebar-card__title">Credits</h3>
              </div>
              <div class="sidebar-card__content">
                <div class="info-list">
                  <div class="info-list-item">
                    <div class="info-list-item__label">Remaining</div>
                    <div class="info-list-item__value">{{ user.credits?.hours_remaining?.toFixed(2) || '0.00' }} hours</div>
                  </div>
                  <div class="info-list-item">
                    <div class="info-list-item__label">Used</div>
                    <div class="info-list-item__value">{{ user.credits?.hours_used?.toFixed(2) || '0.00' }} hours</div>
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
                    <div class="info-list-item__label">User ID</div>
                    <div class="info-list-item__value info-list-item__value--mono">{{ user.id }}</div>
                  </div>
                  <div class="info-list-item">
                    <div class="info-list-item__label">Provider</div>
                    <div class="info-list-item__value">{{ user.provider || 'N/A' }}</div>
                  </div>
                  <div v-if="user.created_at" class="info-list-item">
                    <div class="info-list-item__label">Created</div>
                    <div class="info-list-item__value">{{ formatFullDate(user.created_at) }}</div>
                  </div>
                  <div v-if="user.updated_at" class="info-list-item">
                    <div class="info-list-item__label">Last Updated</div>
                    <div class="info-list-item__value">{{ formatFullDate(user.updated_at) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageLayout>

    <!-- Promote Moderator Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showPromoteModeratorDialog" class="admin-dialog__overlay" @click.self="showPromoteModeratorDialog = false">
          <Transition name="dialog" appear>
            <div v-if="showPromoteModeratorDialog" class="admin-dialog" role="dialog" aria-modal="true">
              <div class="admin-dialog__accent"></div>
              <div class="admin-dialog__header">
                <button class="admin-dialog__close" @click="showPromoteModeratorDialog = false"><X :size="18" /></button>
                <div class="admin-dialog__icon"><UserPlus :size="24" /></div>
                <h2 class="admin-dialog__title">Promote to Moderator</h2>
                <p class="admin-dialog__subtitle">Grant moderation privileges to this user</p>
              </div>
              <div class="admin-dialog__content">
                <div class="admin-dialog__alert admin-dialog__alert--info">
                  <Info :size="16" />
                  <p class="text-xs sm:text-sm">This user will have access to moderation tools but not full admin privileges.</p>
                </div>
              </div>
              <div class="admin-dialog__footer">
                <button class="admin-dialog__btn admin-dialog__btn--secondary" @click="showPromoteModeratorDialog = false">Cancel</button>
                <button class="admin-dialog__btn admin-dialog__btn--primary" @click="promoteModerator">Promote</button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Restrict User Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showRestrictDialog" class="admin-dialog__overlay" @click.self="showRestrictDialog = false">
          <Transition name="dialog" appear>
            <div v-if="showRestrictDialog" class="admin-dialog" role="dialog" aria-modal="true">
              <div class="admin-dialog__accent admin-dialog__accent--warning"></div>
              <div class="admin-dialog__header">
                <button class="admin-dialog__close" @click="showRestrictDialog = false"><X :size="18" /></button>
                <div class="admin-dialog__icon admin-dialog__icon--warning"><Ban :size="24" /></div>
                <h2 class="admin-dialog__title">Restrict User</h2>
                <p class="admin-dialog__subtitle">Limit this user's platform access</p>
              </div>
              <div class="admin-dialog__content">
                <div class="admin-dialog__field">
                  <label class="admin-dialog__label">Restriction Reason</label>
                  <input v-model="restrictReason" type="text" placeholder="Enter restriction reason" class="admin-dialog__input" />
                </div>
                <div class="admin-dialog__alert admin-dialog__alert--warning">
                  <AlertTriangle :size="16" />
                  <p class="text-xs sm:text-sm">The user will be able to log in but cannot perform actions on the platform.</p>
                </div>
              </div>
              <div class="admin-dialog__footer">
                <button class="admin-dialog__btn admin-dialog__btn--secondary" @click="showRestrictDialog = false">Cancel</button>
                <button class="admin-dialog__btn admin-dialog__btn--danger" @click="restrictUser">Restrict User</button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Apply Discount Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDiscountDialog" class="admin-dialog__overlay" @click.self="showDiscountDialog = false">
          <Transition name="dialog" appear>
            <div v-if="showDiscountDialog" class="admin-dialog" role="dialog" aria-modal="true">
              <div class="admin-dialog__accent"></div>
              <div class="admin-dialog__header">
                <button class="admin-dialog__close" @click="showDiscountDialog = false"><X :size="18" /></button>
                <div class="admin-dialog__icon admin-dialog__icon--purple"><Percent :size="24" /></div>
                <h2 class="admin-dialog__title">Apply Discount</h2>
                <p class="admin-dialog__subtitle">Apply a custom discount to this user's subscription</p>
              </div>
              <div class="admin-dialog__content">
                <div class="admin-dialog__field">
                  <label class="admin-dialog__label">Discount Percentage</label>
                  <input v-model.number="discountPercent" type="number" min="1" max="100" placeholder="e.g., 50" class="admin-dialog__input" />
                </div>
                <div class="admin-dialog__field">
                  <label class="admin-dialog__label">Duration (months)</label>
                  <input v-model.number="discountMonths" type="number" min="1" placeholder="e.g., 3" class="admin-dialog__input" />
                </div>
              </div>
              <div class="admin-dialog__footer">
                <button class="admin-dialog__btn admin-dialog__btn--secondary" @click="showDiscountDialog = false">Cancel</button>
                <button class="admin-dialog__btn admin-dialog__btn--primary" @click="applyDiscount">Apply Discount</button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete User Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDeleteDialog" class="admin-dialog__overlay" @click.self="showDeleteDialog = false">
          <Transition name="dialog" appear>
            <div v-if="showDeleteDialog" class="admin-dialog" role="dialog" aria-modal="true">
              <div class="admin-dialog__accent admin-dialog__accent--danger"></div>
              <div class="admin-dialog__header">
                <button class="admin-dialog__close" @click="showDeleteDialog = false"><X :size="18" /></button>
                <div class="admin-dialog__icon admin-dialog__icon--danger"><Trash2 :size="24" /></div>
                <h2 class="admin-dialog__title">Delete User</h2>
                <p class="admin-dialog__subtitle">This action cannot be undone</p>
              </div>
              <div class="admin-dialog__content">
                <div class="admin-dialog__alert admin-dialog__alert--error">
                  <AlertTriangle :size="16" />
                  <p class="text-xs sm:text-sm">This will schedule the user for deletion. If they have an active subscription, deletion will occur at the end of their billing cycle.</p>
                </div>
              </div>
              <div class="admin-dialog__footer">
                <button class="admin-dialog__btn admin-dialog__btn--secondary" @click="showDeleteDialog = false">Cancel</button>
                <button class="admin-dialog__btn admin-dialog__btn--danger" @click="deleteUser">Delete User</button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Enable Mod Discount Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModDiscountDialog" class="admin-dialog__overlay" @click.self="showModDiscountDialog = false">
          <Transition name="dialog" appear>
            <div v-if="showModDiscountDialog" class="admin-dialog" role="dialog" aria-modal="true">
              <div class="admin-dialog__accent"></div>
              <div class="admin-dialog__header">
                <button class="admin-dialog__close" @click="showModDiscountDialog = false"><X :size="18" /></button>
                <div class="admin-dialog__icon admin-dialog__icon--purple"><Percent :size="24" /></div>
                <h2 class="admin-dialog__title">Enable Moderator Discount</h2>
                <p class="admin-dialog__subtitle">Grant the 10% moderator discount</p>
              </div>
              <div class="admin-dialog__content">
                <div class="admin-dialog__alert admin-dialog__alert--info">
                  <Info :size="16" />
                  <p class="text-xs sm:text-sm">This will enable a permanent 10% discount on this user's subscription for as long as they remain a moderator.</p>
                </div>
              </div>
              <div class="admin-dialog__footer">
                <button class="admin-dialog__btn admin-dialog__btn--secondary" @click="showModDiscountDialog = false">Cancel</button>
                <button class="admin-dialog__btn admin-dialog__btn--primary" @click="enableModDiscount">Enable Discount</button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
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
  Info,
  X,
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
/* ===== Page Container ===== */
.admin-user-profile {
  width: 100%;
  min-height: 100%;
}

.user-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.user-content--loading,
.user-content--empty {
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

/* ===== User Header ===== */
.user-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
}

@media (max-width: 640px) {
  .user-header {
    flex-direction: column;
  }
}

.user-header__main {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  flex: 1;
}

.user-avatar {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 12px;
  background: var(--sidebar-surface);
  overflow: hidden;
  flex-shrink: 0;
}

.user-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar__fallback {
  width: 100%;
  height: 100%;
  padding: 16px;
  color: var(--sidebar-text-muted);
}

.user-meta {
  flex: 1;
  min-width: 0;
}

.user-meta__top {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
  margin-bottom: 0.375rem;
}

.user-name {
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

.status-badge--admin {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}

.status-badge--moderator {
  background: rgba(168, 85, 247, 0.15);
  color: #a78bfa;
}

.status-badge--restricted {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
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

.user-bio {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  line-height: 1.5;
  max-width: 420px;
}

.user-stats {
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

/* Action Groups */
.action-group {
  margin-bottom: 1.5rem;
}

.action-group:last-child {
  margin-bottom: 0;
}

.action-group__label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
}

.action-group--danger .action-group__label {
  color: #ef4444;
}

.action-group__buttons {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

/* Action Buttons */
.action-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
  border: 1px solid var(--sidebar-border);
  background: var(--sidebar-hover);
  color: var(--sidebar-text);
  width: 100%;
  text-align: left;
}

.action-btn:hover:not(:disabled) {
  background: var(--sidebar-surface);
  border-color: var(--sidebar-accent);
  color: var(--sidebar-accent);
}

.action-btn svg {
  flex-shrink: 0;
  opacity: 0.7;
  transition: opacity 150ms ease;
}

.action-btn:hover:not(:disabled) svg {
  opacity: 1;
}

.action-btn--outline {
  background: transparent;
  border: 1px solid var(--sidebar-border);
}

.action-btn--outline:hover:not(:disabled) {
  background: var(--sidebar-hover);
  border-color: var(--sidebar-accent);
}

.action-btn--success {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.action-btn--success:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.15);
  border-color: #10b981;
}

.action-btn--warning {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
  color: #f59e0b;
}

.action-btn--warning:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.15);
  border-color: #f59e0b;
}

.action-btn--danger {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.action-btn--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.15);
  border-color: #ef4444;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Discount List */
.discount-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.discount-item {
  padding: 1rem;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.discount-item__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.discount-item__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  flex-shrink: 0;
}

.discount-item__icon--admin {
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
}

.discount-item__icon--mod {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}

.discount-item__info {
  flex: 1;
  min-width: 0;
}

.discount-item__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin-bottom: 0.125rem;
}

.discount-item__description {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
}

.discount-item__details {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.75rem;
  border-top: 1px solid var(--sidebar-border);
}

.discount-item__amount {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--sidebar-accent);
}

.discount-item__duration {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.discount-item__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.discount-item__badge--active {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
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

/* ===== Admin Dialog (matches ClipDetectionConfirmDialog) ===== */
.admin-dialog__overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.admin-dialog {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  margin: 1rem;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.admin-dialog__accent {
  height: 3px;
  background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  flex-shrink: 0;
}

.admin-dialog__accent--warning {
  background: linear-gradient(90deg, #f59e0b, rgba(245, 158, 11, 0.5));
}

.admin-dialog__accent--danger {
  background: linear-gradient(90deg, #ef4444, rgba(239, 68, 68, 0.5));
}

.admin-dialog__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1.5rem 1rem;
  text-align: center;
}

.admin-dialog__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.admin-dialog__close:hover {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.admin-dialog__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  margin-bottom: 0.875rem;
}

.admin-dialog__icon--purple {
  background-color: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
}

.admin-dialog__icon--warning {
  background-color: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.admin-dialog__icon--danger {
  background-color: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.admin-dialog__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.admin-dialog__subtitle {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0.25rem 0 0;
}

.admin-dialog__content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1.5rem 1.5rem;
}

.admin-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.admin-dialog__label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.admin-dialog__input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  transition: all 150ms ease;
  box-sizing: border-box;
}

.admin-dialog__input::placeholder {
  color: var(--sidebar-text-muted);
  opacity: 0.6;
}

.admin-dialog__input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

.admin-dialog__alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.admin-dialog__alert--info {
  background-color: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
}

.admin-dialog__alert--warning {
  background-color: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.admin-dialog__alert--error {
  background-color: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.admin-dialog__footer {
  display: flex;
  gap: 0.625rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--sidebar-border);
}

.admin-dialog__btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 150ms ease;
}

.admin-dialog__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.admin-dialog__btn--secondary {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
  border: 1px solid var(--sidebar-border);
}

.admin-dialog__btn--secondary:hover:not(:disabled) {
  background-color: var(--sidebar-active);
  border-color: rgba(255, 255, 255, 0.1);
}

.admin-dialog__btn--primary {
  background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
  color: #000;
}

.admin-dialog__btn--primary:hover:not(:disabled) {
  opacity: 0.9;
}

.admin-dialog__btn--danger {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: #fff;
}

.admin-dialog__btn--danger:hover:not(:disabled) {
  opacity: 0.9;
}

/* ===== Dialog Transitions ===== */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.dialog-enter-active {
  transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-leave-active {
  transition: all 150ms ease-in;
}

.dialog-enter-from {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}

.dialog-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .user-content {
    padding: 1rem;
    gap: 1.25rem;
  }

  .user-header {
    flex-direction: column;
  }

  .user-header__main {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .user-name {
    font-size: 1.125rem;
  }

  .user-meta__top {
    justify-content: center;
  }

  .user-stats {
    width: 100%;
    justify-content: center;
  }

  .stat {
    min-width: 80px;
  }

  .main-layout {
    gap: 1rem;
  }

  .actions-grid {
    grid-template-columns: 1fr;
  }
}
</style>
