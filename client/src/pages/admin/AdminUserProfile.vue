<template>
  <PageLayout
    :title="user ? userName : 'User profile'"
    description="Detailed user information and management"
    :icon="User"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Users', path: '/admin/users' }, { label: userName || 'Profile' }]"
  >
    <!-- Loading -->
    <div v-if="loading && !user" class="flex flex-col gap-5 px-5 py-4" aria-busy="true">
      <div class="flex items-center gap-3.5 border-b border-line-subtle pb-4">
        <div class="skeleton size-10 rounded-full" />
        <div class="flex flex-col gap-2">
          <div class="skeleton h-4 w-48" />
          <div class="skeleton h-3 w-32" />
        </div>
      </div>
      <div class="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
        <div class="skeleton h-72 rounded-[var(--radius-card)]" />
        <div class="skeleton h-48 rounded-[var(--radius-card)]" />
      </div>
    </div>

    <!-- Error -->
    <EmptyState
      v-else-if="error"
      :icon="AlertTriangle"
      tone="danger"
      title="Failed to load user profile"
      :description="error"
    >
      <Button variant="secondary" @click="loadUserProfile">Try again</Button>
    </EmptyState>

    <!-- Main content -->
    <div v-else-if="user" class="@container flex animate-enter flex-col gap-5 px-5 py-4">
      <AdminDetailHeader
        :title="userName"
        :subtitle="(user.email || user.wallet_address) !== userName ? user.email || user.wallet_address : null"
        :avatar-url="avatarUrl"
        :icon="User"
        :stats="[
          { label: 'Credits left', value: formatCredits(user.credits?.hours_remaining) },
          { label: 'Credits used', value: formatCredits(user.credits?.hours_used) },
        ]"
      >
        <template #badges>
          <Badge v-if="user.subscription?.tier" variant="brand" class="capitalize">
            <Crown />{{ user.subscription.tier }}
          </Badge>
          <Badge v-if="user.is_admin" variant="brand"><Shield />Admin</Badge>
          <Badge v-if="user.is_moderator" variant="neutral"><Shield />Moderator</Badge>
          <Badge v-if="user.is_restricted" variant="danger"><Ban />Restricted</Badge>
        </template>
        <template #meta>
          <span>Member for {{ accountAge }}</span>
          <span>Last active {{ lastActive }}</span>
          <span>{{ formatProvider(user.provider) }} sign-in</span>
        </template>
      </AdminDetailHeader>

      <div class="grid items-start gap-4 @3xl:grid-cols-[minmax(0,1fr)_300px]">
        <!-- Left column -->
        <div class="flex min-w-0 flex-col gap-4">
          <SectionCard title="Access" :icon="Settings" body-class="py-0">
            <SettingRow label="Moderator" description="Access to moderation tools, without full admin rights">
              <Switch
                :model-value="!!user.is_moderator"
                aria-label="Moderator"
                @update:model-value="(on: boolean) => (on ? (showPromoteModeratorDialog = true) : demoteModerator())"
              />
            </SettingRow>
            <SettingRow label="AI editor" description="Can use the AI video editor">
              <Switch
                :model-value="!!user.ai_editor_enabled"
                aria-label="AI editor"
                @update:model-value="(on: boolean) => (on ? enableAiEditor() : disableAiEditor())"
              />
            </SettingRow>
            <SettingRow label="Tokend" description="Can use Tokend integrations">
              <template #label>
                <span class="inline-flex items-center gap-1.5">
                  <img src="/tokend.png" alt="" class="size-3.5 rounded-sm" />
                  Tokend
                </span>
              </template>
              <Switch
                :model-value="!!user.tokend_enabled"
                aria-label="Tokend"
                @update:model-value="(on: boolean) => (on ? enableTokend() : disableTokend())"
              />
            </SettingRow>
            <SettingRow label="Campaigns" description="Can join and run campaigns">
              <Switch
                :model-value="!!user.campaigns_enabled"
                aria-label="Campaigns"
                @update:model-value="(on: boolean) => (on ? enableCampaigns() : disableCampaigns())"
              />
            </SettingRow>
            <SettingRow
              v-if="user.is_moderator"
              label="Moderator discount"
              description="10% off while they remain a moderator"
            >
              <Switch
                :model-value="!!user.discount?.mod_discount_enabled"
                aria-label="Moderator discount"
                @update:model-value="(on: boolean) => (on ? (showModDiscountDialog = true) : disableModDiscount())"
              />
            </SettingRow>
          </SectionCard>

          <SectionCard title="Account" :icon="User" body-class="py-0">
            <SettingRow
              :label="user.is_restricted ? 'Restricted' : 'Restrict user'"
              :description="
                user.is_restricted
                  ? 'The user can log in but cannot take actions'
                  : 'Let them log in but block actions on the platform'
              "
            >
              <Button v-if="!user.is_restricted" variant="secondary" size="sm" @click="showRestrictDialog = true">
                <Ban />Restrict
              </Button>
              <Button v-else variant="secondary" size="sm" @click="unrestrictUser">
                <CheckCircle />Unrestrict
              </Button>
            </SettingRow>
            <SettingRow
              v-if="user.provider === 'email'"
              label="Password"
              description="Set a new password for this email account"
            >
              <Button variant="secondary" size="sm" @click="showResetPasswordDialog = true"><Key />Reset</Button>
            </SettingRow>
            <SettingRow label="Custom discount" description="Discount their subscription for a number of months">
              <Button variant="secondary" size="sm" @click="showDiscountDialog = true"><Percent />Apply</Button>
            </SettingRow>
            <SettingRow label="Free month" description="Add one month to their subscription">
              <Button variant="secondary" size="sm" @click="grantFreeMonth"><Gift />Grant</Button>
            </SettingRow>
            <SettingRow label="Delete user" description="Schedules the account for deletion" tone="danger">
              <Button variant="destructive-soft" size="sm" @click="showDeleteDialog = true"><Trash2 />Delete</Button>
            </SettingRow>
          </SectionCard>

          <!-- Active discounts -->
          <SectionCard
            v-if="user.discount && (user.discount.admin_discount_percent || user.discount.mod_discount_enabled)"
            title="Active discounts"
            :icon="Percent"
            body-class="py-0"
          >
            <SettingRow
              v-if="user.discount.admin_discount_percent"
              label="Admin discount"
              description="Special admin-granted discount"
            >
              <div class="text-right">
                <p class="tabular text-sm font-semibold text-success">{{ user.discount.admin_discount_percent }}% off</p>
                <p class="tabular text-xs text-fg-subtle">
                  {{ user.discount.admin_discount_months_remaining }} months remaining
                </p>
              </div>
            </SettingRow>
            <SettingRow
              v-if="user.discount.mod_discount_enabled"
              label="Moderator discount"
              description="10% discount for moderators"
            >
              <span class="tabular text-sm font-semibold text-success">10% off</span>
              <Badge variant="success">Active</Badge>
            </SettingRow>
          </SectionCard>
        </div>

        <!-- Right column -->
        <aside class="flex min-w-0 flex-col gap-4">
          <SectionCard title="Subscription" :icon="CreditCard" body-class="py-1">
            <InfoRow label="Tier">{{ formatTier(user.subscription?.tier) }}</InfoRow>
            <InfoRow label="Status">
              <Badge :variant="statusVariant(user.subscription?.status)">{{ formatStatus(user.subscription?.status) }}</Badge>
            </InfoRow>
            <InfoRow label="Billing">
              <span class="capitalize">{{ user.subscription?.billing_interval || 'N/A' }}</span>
            </InfoRow>
            <InfoRow v-if="user.subscription?.renewal_date" label="Renewal">
              {{ formatDate(user.subscription.renewal_date) }}
            </InfoRow>
          </SectionCard>

          <SectionCard title="Details" :icon="Info" body-class="py-1">
            <InfoRow label="User ID" mono>{{ user.id }}</InfoRow>
            <InfoRow label="Provider">{{ formatProvider(user.provider) }}</InfoRow>
            <InfoRow v-if="user.created_at" label="Created">{{ formatFullDate(user.created_at) }}</InfoRow>
            <InfoRow v-if="user.updated_at" label="Last updated">{{ formatFullDate(user.updated_at) }}</InfoRow>
          </SectionCard>
        </aside>
      </div>
    </div>

    <!-- Promote Moderator Dialog -->
    <Modal
      v-model:open="showPromoteModeratorDialog"
      title="Promote to moderator"
      description="Grant moderation privileges to this user"
      :icon="UserPlus"
      size="sm"
    >
      <Alert variant="info">
        <Info />
        <AlertDescription>
          This user will have access to moderation tools but not full admin privileges.
        </AlertDescription>
      </Alert>
      <template #footer>
        <Button variant="ghost" @click="showPromoteModeratorDialog = false">Cancel</Button>
        <Button variant="primary" @click="promoteModerator">Promote</Button>
      </template>
    </Modal>

    <!-- Restrict User Dialog -->
    <Modal
      v-model:open="showRestrictDialog"
      title="Restrict user"
      description="Limit this user's platform access"
      :icon="Ban"
      tone="warning"
      size="sm"
      body-class="flex flex-col gap-4"
    >
      <Field label="Restriction reason">
        <Input v-model="restrictReason" placeholder="Enter restriction reason" />
      </Field>
      <Alert variant="warning">
        <AlertTriangle />
        <AlertDescription>The user will be able to log in but cannot perform actions on the platform.</AlertDescription>
      </Alert>
      <template #footer>
        <Button variant="ghost" @click="showRestrictDialog = false">Cancel</Button>
        <Button variant="destructive" @click="restrictUser">Restrict user</Button>
      </template>
    </Modal>

    <!-- Apply Discount Dialog -->
    <Modal
      v-model:open="showDiscountDialog"
      title="Apply discount"
      description="Apply a custom discount to this user's subscription"
      :icon="Percent"
      size="sm"
    >
      <div class="grid grid-cols-2 gap-3">
        <Field label="Discount (%)">
          <Input v-model.number="discountPercent" type="number" min="1" max="100" placeholder="e.g. 50" />
        </Field>
        <Field label="Duration (months)">
          <Input v-model.number="discountMonths" type="number" min="1" placeholder="e.g. 3" />
        </Field>
      </div>
      <template #footer>
        <Button variant="ghost" @click="showDiscountDialog = false">Cancel</Button>
        <Button variant="primary" @click="applyDiscount">Apply discount</Button>
      </template>
    </Modal>

    <!-- Delete User Dialog -->
    <Modal
      v-model:open="showDeleteDialog"
      title="Delete user"
      description="This action cannot be undone"
      :icon="Trash2"
      tone="danger"
      size="sm"
    >
      <p class="text-sm text-fg-muted">
        This will schedule the user for deletion. If they have an active subscription, deletion will occur at the end
        of their billing cycle.
      </p>
      <template #footer>
        <Button variant="ghost" @click="showDeleteDialog = false">Cancel</Button>
        <Button variant="destructive" @click="deleteUser">Delete user</Button>
      </template>
    </Modal>

    <!-- Enable Mod Discount Dialog -->
    <Modal
      v-model:open="showModDiscountDialog"
      title="Enable moderator discount"
      description="Grant the 10% moderator discount"
      :icon="Percent"
      size="sm"
    >
      <p class="text-sm text-fg-muted">
        This enables a permanent 10% discount on this user's subscription for as long as they remain a moderator.
      </p>
      <template #footer>
        <Button variant="ghost" @click="showModDiscountDialog = false">Cancel</Button>
        <Button variant="primary" @click="enableModDiscount">Enable discount</Button>
      </template>
    </Modal>

    <!-- Reset Password Dialog -->
    <Modal
      v-model:open="showResetPasswordDialog"
      title="Reset password"
      description="Set a new password for this email account"
      :icon="Key"
      size="sm"
      :dismissible="!resettingPassword"
      body-class="flex flex-col gap-4"
    >
      <Field label="New password">
        <Input
          v-model="newPassword"
          type="password"
          placeholder="At least 8 characters"
          :disabled="resettingPassword"
        />
      </Field>
      <Field label="Confirm password">
        <Input
          v-model="confirmPassword"
          type="password"
          placeholder="Confirm new password"
          :disabled="resettingPassword"
          @keyup.enter="resetPassword"
        />
      </Field>
      <Alert v-if="resetPasswordError" variant="destructive">
        <AlertTriangle />
        <AlertDescription>{{ resetPasswordError }}</AlertDescription>
      </Alert>
      <p class="text-xs text-fg-subtle">
        The user can log in immediately with the new password. Share it with them securely.
      </p>
      <template #footer>
        <Button variant="ghost" :disabled="resettingPassword" @click="showResetPasswordDialog = false">Cancel</Button>
        <Button
          variant="primary"
          :loading="resettingPassword"
          :disabled="resettingPassword || !newPassword || !confirmPassword"
          @click="resetPassword"
        >
          {{ resettingPassword ? 'Resetting…' : 'Reset password' }}
        </Button>
      </template>
    </Modal>
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { formatDate as fmtDate, formatDateTime } from '@/utils/dateTimeUtils';
import {
  User,
  Shield,
  Ban,
  CheckCircle,
  Crown,
  AlertTriangle,
  Settings,
  UserPlus,
  Percent,
  Gift,
  Trash2,
  Key,
  CreditCard,
  Info,
} from 'lucide-vue-next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import PageLayout from '@/components/PageLayout.vue';
import {
  AdminDetailHeader,
  statusVariant,
} from '@/components/admin/shared';
import { SectionCard } from '@/components/ui/section-card';
import { SettingRow } from '@/components/ui/setting-row';
import { InfoRow } from '@/components/ui/info-list';
import api from '@/services/api';
import { useToast } from '@/composables/useToast';

const route = useRoute();
const router = useRouter();
const { success: toast, error: toastError } = useToast();

const loading = ref(false);
const error = ref<string | null>(null);
const user = ref<any>(null);
const avatarLoadError = ref(false);

// Dialog states
const showPromoteModeratorDialog = ref(false);
const showRestrictDialog = ref(false);
const showDiscountDialog = ref(false);
const showDeleteDialog = ref(false);
const showModDiscountDialog = ref(false);
const showResetPasswordDialog = ref(false);

// Form data
const restrictReason = ref('');
const discountPercent = ref(50);
const discountMonths = ref(1);
const newPassword = ref('');
const confirmPassword = ref('');
const resetPasswordError = ref<string | null>(null);
const resettingPassword = ref(false);

const userId = computed(() => route.params.id as string);

const userName = computed(() => {
  if (!user.value) return '';
  return user.value.name || user.value.email || user.value.wallet_address || 'Unknown User';
});

const avatarUrl = computed(() => {
  if (avatarLoadError.value) return null;
  return user.value?.avatar_url || null;
});

const handleAvatarError = () => {
  avatarLoadError.value = true;
};

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
  return fmtDate(dateString);
};

const formatFullDate = (dateString: string) => {
  return formatDateTime(dateString);
};

const formatTier = (tier: string | undefined) => {
  if (!tier) return 'Free';
  // Capitalize first letter
  return tier.charAt(0).toUpperCase() + tier.slice(1);
};

const formatStatus = (status: string | undefined) => {
  if (!status) return 'None';
  // Replace underscores with spaces and capitalize each word
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatProvider = (provider: string | undefined) => {
  if (!provider) return 'N/A';
  // Capitalize first letter
  return provider.charAt(0).toUpperCase() + provider.slice(1);
};

const formatCredits = (value: number | string | null | undefined) => {
  const credits = Number(value || 0);
  if (!Number.isFinite(credits)) return '0.00';
  return credits.toFixed(2);
};

const loadUserProfile = async () => {
  loading.value = true;
  error.value = null;
  avatarLoadError.value = false;
  
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

const enableAiEditor = async () => {
  try {
    const response = await api.post(`/admin/users/${userId.value}/ai-editor`);
    if (response.data.success) {
      toast('AI editor access enabled');
      await loadUserProfile();
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to enable AI editor');
  }
};

const disableAiEditor = async () => {
  try {
    const response = await api.delete(`/admin/users/${userId.value}/ai-editor`);
    if (response.data.success) {
      toast('AI editor access disabled');
      await loadUserProfile();
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to disable AI editor');
  }
};

const enableTokend = async () => {
  try {
    const response = await api.post(`/admin/users/${userId.value}/tokend`);
    if (response.data.success) {
      toast('Tokend access enabled');
      await loadUserProfile();
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to enable Tokend');
  }
};

const disableTokend = async () => {
  try {
    const response = await api.delete(`/admin/users/${userId.value}/tokend`);
    if (response.data.success) {
      toast('Tokend access disabled');
      await loadUserProfile();
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to disable Tokend');
  }
};

const enableCampaigns = async () => {
  try {
    const response = await api.post(`/admin/users/${userId.value}/campaigns`);
    if (response.data.success) {
      toast('Campaigns access enabled');
      await loadUserProfile();
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to enable campaigns');
  }
};

const disableCampaigns = async () => {
  try {
    const response = await api.delete(`/admin/users/${userId.value}/campaigns`);
    if (response.data.success) {
      toast('Campaigns access disabled');
      await loadUserProfile();
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to disable campaigns');
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

const resetPassword = async () => {
  if (!newPassword.value || !confirmPassword.value) {
    resetPasswordError.value = 'Please enter and confirm the new password';
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    resetPasswordError.value = 'Passwords do not match';
    return;
  }

  if (newPassword.value.length < 8) {
    resetPasswordError.value = 'Password must be at least 8 characters';
    return;
  }

  resettingPassword.value = true;
  resetPasswordError.value = null;

  try {
    const response = await api.post(`/admin/users/${userId.value}/reset-password`, {
      new_password: newPassword.value
    });

    if (response.data.success) {
      toast('Password successfully reset!');
      showResetPasswordDialog.value = false;
      newPassword.value = '';
      confirmPassword.value = '';
    } else {
      resetPasswordError.value = response.data.error || 'Failed to reset password';
    }
  } catch (err: any) {
    resetPasswordError.value = err.response?.data?.error || 'Failed to reset password';
  } finally {
    resettingPassword.value = false;
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
