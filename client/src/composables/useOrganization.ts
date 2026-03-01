import { ref, computed, watch, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { formatDate as fmtDate, formatDateTime } from '@/utils/dateTimeUtils';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import api from '@/services/api';
import {
  listOrganizationCreatorProfiles,
  type ServerOrganizationCreatorProfile,
} from '@/services/organizationProfilesApi';
import {
  listOrganizationAssets,
  type ServerOrganizationAsset,
} from '@/services/organizationAssetsApi';
import { uploadOrganizationLogo } from '@/services/organizationsApi';

export interface OrganizationMember {
  id: number;
  user_id: number;
  role: 'owner' | 'admin' | 'member';
  is_restricted?: boolean;
  restriction_overrides?: Record<string, boolean>;
  user?: {
    id: number;
    name?: string;
    email: string;
    avatar_url?: string;
    created_by_organization_id?: number;
  };
  allocation?: {
    hours_allocated: string;
    hours_used: string;
    hours_remaining: string;
    allow_pool_fallback?: boolean;
  };
}

export interface OrganizationInvitation {
  id: number;
  email: string;
  role: string;
  expires_at: string;
}

export interface OrganizationCredits {
  hoursRemaining: string;
  hoursUsed: string;
}

export interface OrganizationSubscription {
  status: string;
  tier: string | null;
  tier_name: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_method: string | null;
  days_remaining: number;
  has_subscription: boolean;
  base_seats: number;
  base_credits: number;
  addons: Array<{
    tier: string;
    name: string;
    seats: number;
    credits: number;
  }>;
  total_seats: number | null;
  total_monthly_credits: number;
  current_members: number;
  seats_remaining: number | null;
  pending_subscription_tier?: string | null;
  admin_price_cents?: number | null;
  created_by_admin?: boolean;
  setup_completed?: boolean;
}

export interface OrganizationRestrictionDefaults {
  allow_ai?: boolean;
  allow_asset_uploads?: boolean;
  allow_custom_prompts?: boolean;
  allow_clipper_profile?: boolean;
  allow_personal_social?: boolean;
  allow_clip_deletion?: boolean;
  allow_hiring_browse?: boolean;
  force_org_watermark?: boolean;
  require_clip_approval?: boolean;
  clips_visible_to_admins?: boolean;
}

export interface Organization {
  id: number;
  name: string;
  description?: string;
  logo_url?: string;
  settings?: {
    allow_ai?: boolean;
  };
  restriction_defaults?: OrganizationRestrictionDefaults;
}

// Cache duration: 2 minutes before background refresh
const CACHE_DURATION_MS = 2 * 60 * 1000;

// Shared state cache keyed by organization ID
// This ensures all components using useOrganization get the same reactive state
const stateCache = new Map<
  string,
  {
    loading: Ref<boolean>;
    error: Ref<string>;
    organization: Ref<Organization | null>;
    members: Ref<OrganizationMember[]>;
    invitations: Ref<OrganizationInvitation[]>;
    credits: Ref<OrganizationCredits>;
    myAllocation: Ref<any>;
    role: Ref<string>;
    orgLoaded: Ref<boolean>;
    lastFetchTime: Ref<number | null>;
    subscription: Ref<OrganizationSubscription | null>;
    subscriptionLoading: Ref<boolean>;
    creatorProfiles: Ref<ServerOrganizationCreatorProfile[]>;
    profilesLoading: Ref<boolean>;
    profilesLoaded: Ref<boolean>;
    orgAssets: Ref<ServerOrganizationAsset[]>;
    assetsLoading: Ref<boolean>;
    assetsLoaded: Ref<boolean>;
    transactions: Ref<any[]>;
    transactionsLoading: Ref<boolean>;
    transactionsTotal: Ref<number>;
    transactionsPage: Ref<number>;
    transactionsLoaded: Ref<boolean>;
  }
>();

function getOrCreateState(orgId: string) {
  if (!stateCache.has(orgId)) {
    stateCache.set(orgId, {
      loading: ref(true),
      error: ref(''),
      organization: ref<Organization | null>(null),
      members: ref<OrganizationMember[]>([]),
      invitations: ref<OrganizationInvitation[]>([]),
      credits: ref<OrganizationCredits>({ hoursRemaining: '0', hoursUsed: '0' }),
      myAllocation: ref<any>(null),
      role: ref<string>(''),
      orgLoaded: ref(false),
      lastFetchTime: ref<number | null>(null),
      subscription: ref<OrganizationSubscription | null>(null),
      subscriptionLoading: ref(false),
      creatorProfiles: ref<ServerOrganizationCreatorProfile[]>([]),
      profilesLoading: ref(false),
      profilesLoaded: ref(false),
      orgAssets: ref<ServerOrganizationAsset[]>([]),
      assetsLoading: ref(false),
      assetsLoaded: ref(false),
      transactions: ref<any[]>([]),
      transactionsLoading: ref(false),
      transactionsTotal: ref(0),
      transactionsPage: ref(1),
      transactionsLoaded: ref(false),
    });
  }
  return stateCache.get(orgId)!;
}

/**
 * Composable for managing organization state and API interactions.
 * Uses shared state cache to ensure all components get the same reactive state
 * for the same organization.
 */
export function useOrganization(orgIdOverride?: string) {
  const route = useRoute();
  const router = useRouter();
  const authStore = useAuthStore();
  const { success: showSuccess, error: showError } = useToast();
  const transactionsPerPage = 20;

  // Computed organization ID
  const organizationId = computed(() => {
    if (orgIdOverride) return orgIdOverride;
    return (route.params.id as string) || authStore.user?.owned_organization_id;
  });

  // Get or create shared state for this organization
  const currentOrgId = organizationId.value || '_pending';
  const state = getOrCreateState(currentOrgId);

  const {
    loading,
    error,
    organization,
    members,
    invitations,
    credits,
    myAllocation,
    role,
    orgLoaded,
    lastFetchTime,
    subscription,
    subscriptionLoading,
    creatorProfiles,
    profilesLoading,
    profilesLoaded,
    orgAssets,
    assetsLoading,
    assetsLoaded,
    transactions,
    transactionsLoading,
    transactionsTotal,
    transactionsPage,
    transactionsLoaded,
  } = state;

  const isAdmin = computed(() => role.value === 'owner' || role.value === 'admin');
  const isOwner = computed(() => role.value === 'owner');

  const poolBalance = computed(() => {
    const remaining = parseFloat(credits.value.hoursRemaining);
    return isNaN(remaining) ? 0 : remaining;
  });

  const totalTransactionPages = computed(() =>
    Math.ceil(transactionsTotal.value / transactionsPerPage)
  );

  const hasActiveSubscription = computed(() => {
    return subscription.value?.has_subscription || false;
  });

  const totalSeats = computed(() => {
    return subscription.value?.total_seats || null;
  });

  const currentMembers = computed(() => {
    return subscription.value?.current_members || members.value.length;
  });

  const seatsRemaining = computed(() => {
    return subscription.value?.seats_remaining;
  });

  const canAddMembers = computed(() => {
    // Legacy orgs (no subscription) have unlimited seats
    if (!hasActiveSubscription.value) return true;
    if (seatsRemaining.value === null || seatsRemaining.value === undefined) return true;
    return seatsRemaining.value > 0;
  });

  // Check if a member's user was created by this organization
  function isOrgCreatedUser(member: OrganizationMember): boolean {
    if (!member.user || !organizationId.value) return false;
    return member.user.created_by_organization_id === Number(organizationId.value);
  }

  // Load organization data with stale-while-revalidate caching
  async function loadOrganization(force = false) {
    const orgId = organizationId.value;
    if (!orgId) {
      error.value = 'No organization found';
      loading.value = false;
      return;
    }

    // Check if we have fresh cached data
    const now = Date.now();
    const isFresh = lastFetchTime.value && now - lastFetchTime.value < CACHE_DURATION_MS;

    // If data is loaded and fresh, skip fetch entirely (unless forced)
    if (!force && orgLoaded.value && isFresh) {
      loading.value = false;
      return;
    }

    // If data is loaded but stale, show existing data and refresh in background
    // Only show loading skeleton on first load when no cached data exists
    const isBackgroundRefresh = orgLoaded.value && !force;
    if (!isBackgroundRefresh) {
      loading.value = true;
    }
    error.value = '';

    try {
      // Load organization details
      const orgResult = await authStore.getOrganization(orgId);
      if (orgResult.success) {
        organization.value = orgResult.organization;
        role.value = orgResult.role ?? '';

        // Regular members should not access the dashboard - redirect to organizations list
        if (role.value === 'member') {
          router.replace('/organizations');
          return;
        }
      } else {
        throw new Error(orgResult.error);
      }

      // Load members
      const membersResult = await authStore.getOrganizationMembers(orgId);
      if (membersResult.success) {
        members.value = membersResult.members ?? [];
      }

      // Load invitations (if admin)
      if (isAdmin.value) {
        const invitesResult = await authStore.getOrganizationInvitations(orgId);
        if (invitesResult.success) {
          invitations.value = invitesResult.invitations ?? [];
        }
      }

      // Load credits
      const creditsResult = await authStore.getOrganizationCredits(orgId);
      if (creditsResult.success) {
        credits.value = {
          hoursRemaining: creditsResult.org_credits.hours_remaining,
          hoursUsed: creditsResult.org_credits.hours_used,
        };
        myAllocation.value = creditsResult.my_allocation;
      }

      // Load subscription status
      await loadSubscription();

      // Mark as loaded and update fetch time
      orgLoaded.value = true;
      lastFetchTime.value = Date.now();
    } catch (err: any) {
      error.value = err.message || 'Failed to load organization';
    } finally {
      loading.value = false;
    }
  }

  // Load organization subscription
  async function loadSubscription() {
    const orgId = organizationId.value;
    if (!orgId) return;

    subscriptionLoading.value = true;
    try {
      const response = await api.get(`/organizations/${orgId}/subscription`);
      if (response.data.success) {
        subscription.value = response.data.subscription;
      } else {
        console.error('[useOrganization] Failed to load subscription:', response.data.error);
      }
    } catch (err) {
      console.error('[useOrganization] Failed to load subscription:', err);
    } finally {
      subscriptionLoading.value = false;
    }
  }

  // Load creator profiles
  async function loadCreatorProfiles() {
    if (!organizationId.value) return;

    profilesLoading.value = true;
    try {
      const response = await listOrganizationCreatorProfiles(organizationId.value);
      if (response.success) {
        creatorProfiles.value = response.profiles;
        profilesLoaded.value = true;
      } else {
        console.error('[useOrganization] Failed to load creator profiles:', response.error);
      }
    } catch (err) {
      console.error('[useOrganization] Failed to load creator profiles:', err);
    } finally {
      profilesLoading.value = false;
    }
  }

  // Load organization assets
  async function loadOrgAssets() {
    if (!organizationId.value || assetsLoaded.value) return;

    assetsLoading.value = true;
    try {
      const response = await listOrganizationAssets(organizationId.value);
      if (response.success) {
        orgAssets.value = response.assets;
        assetsLoaded.value = true;
      } else {
        console.error('[useOrganization] Failed to load org assets:', response.error);
      }
    } catch (err) {
      console.error('[useOrganization] Failed to load org assets:', err);
    } finally {
      assetsLoading.value = false;
    }
  }

  // Load transactions
  async function loadTransactions(page = 1) {
    const orgId = organizationId.value;
    if (!orgId || !isAdmin.value) return;

    transactionsLoading.value = true;
    try {
      const offset = (page - 1) * transactionsPerPage;
      const result = await authStore.getOrganizationTransactions(orgId, {
        limit: transactionsPerPage,
        offset,
      });

      if (result.success) {
        transactions.value = result.transactions ?? [];
        transactionsTotal.value = result.total ?? 0;
        transactionsPage.value = page;
        transactionsLoaded.value = true;
      }
    } catch (err: any) {
      console.error('[useOrganization] Failed to load transactions:', err);
    } finally {
      transactionsLoading.value = false;
    }
  }

  // Update organization settings
  async function updateOrganization(data: {
    name: string;
    description: string;
    settings: { allow_ai: boolean };
  }) {
    if (!organizationId.value) return { success: false, error: 'No organization ID' };

    try {
      const result = await authStore.updateOrganization(organizationId.value, data);
      if (result.success) {
        organization.value = result.organization;
        showSuccess('Settings saved', 'Organization settings updated successfully');
      }
      return result;
    } catch (err: any) {
      showError('Save failed', err.message || 'Failed to update organization');
      return { success: false, error: err.message };
    }
  }

  // Cancel invitation
  async function cancelInvitation(invitationId: number) {
    const orgId = organizationId.value;
    if (!orgId) return;
    try {
      await authStore.cancelOrganizationInvitation(orgId, invitationId);
      invitations.value = invitations.value.filter((i) => i.id !== invitationId);
      showSuccess('Invitation cancelled');
    } catch (err) {
      console.error('[useOrganization] Failed to cancel invitation:', err);
      showError('Failed to cancel invitation');
    }
  }

  // Resend invitation
  async function resendInvitation(invitation: OrganizationInvitation) {
    const orgId = organizationId.value;
    if (!orgId) return { success: false };

    try {
      const result = await authStore.resendOrganizationInvitation(orgId, invitation.id);
      if (result.success) {
        showSuccess('Invitation resent', `Invitation email resent to ${invitation.email}`);
        await loadOrganization(); // Reload to get updated expiry date
      } else {
        showError('Failed to resend', result.error || 'Could not resend invitation');
      }
      return result;
    } catch (err: any) {
      showError('Failed to resend', err.message || 'An error occurred');
      return { success: false, error: err.message };
    }
  }

  // Remove member
  async function removeMember(member: OrganizationMember) {
    const orgId = organizationId.value;
    if (!orgId) return { success: false };

    try {
      await authStore.removeOrganizationMember(orgId, member.user_id);
      members.value = members.value.filter((m) => m.id !== member.id);
      showSuccess('Member removed', `${member.user?.email} has been removed from the organization`);
      return { success: true };
    } catch (err: any) {
      showError('Failed to remove member', err.message || 'An error occurred');
      return { success: false, error: err.message };
    }
  }

  // Update member role
  async function updateMemberRole(member: OrganizationMember, newRole: string) {
    const orgId = organizationId.value;
    if (!orgId) return { success: false };

    try {
      await authStore.updateOrganizationMemberRole(orgId, member.user_id, newRole);
      showSuccess('Role updated', `${member.user?.email} is now a ${newRole}`);
      await loadOrganization();
      return { success: true };
    } catch (err: any) {
      showError('Failed to update role', err.message || 'An error occurred');
      return { success: false, error: err.message };
    }
  }

  // Update member account (for org-created users)
  async function updateMemberAccount(
    member: OrganizationMember,
    updates: { name?: string; email?: string; password?: string }
  ) {
    const orgId = organizationId.value;
    if (!orgId) return { success: false };

    try {
      const result = await authStore.updateOrganizationMemberAccount(
        orgId,
        member.user_id,
        updates
      );
      if (result.success) {
        showSuccess('Member updated', 'Member account has been updated successfully');
        await loadOrganization();
      } else {
        showError('Update failed', result.error || 'Failed to update member account');
      }
      return result;
    } catch (err: any) {
      showError('Update failed', err.message || 'An error occurred while updating the member');
      return { success: false, error: err.message };
    }
  }

  // Allocate credits to a member
  async function allocateCredits(userId: number, minutes: number) {
    const orgId = organizationId.value;
    if (!orgId) return { success: false };

    if (!minutes || minutes <= 0) {
      showError('Invalid amount', 'Please enter a positive number of minutes to allocate');
      return { success: false };
    }

    if (minutes > poolBalance.value) {
      showError(
        'Insufficient pool credits',
        `You can only allocate up to ${poolBalance.value} minutes from the pool`
      );
      return { success: false };
    }

    try {
      const result = await authStore.allocateOrganizationCredits(orgId, userId, minutes);
      if (result.success) {
        showSuccess('Credits allocated', `${minutes} minutes allocated successfully`);
        
        // Update local state immediately with response data
        if (result.allocation && result.org_pool_remaining) {
          // Update the member's allocation
          const member = members.value.find(m => m.user_id === userId);
          if (member && member.allocation) {
            member.allocation.hours_allocated = result.allocation.hours_allocated;
            member.allocation.hours_used = result.allocation.hours_used;
            member.allocation.hours_remaining = (
              parseFloat(result.allocation.hours_allocated) - parseFloat(result.allocation.hours_used)
            ).toString();
            member.allocation.allow_pool_fallback = result.allocation.allow_pool_fallback;
          }
          
          // Update org pool balance
          credits.value.hoursRemaining = result.org_pool_remaining;
        }
      } else {
        showError('Allocation failed', result.error || 'Failed to allocate credits');
      }
      return result;
    } catch (err: any) {
      showError('Allocation failed', err.message || 'An error occurred while allocating credits');
      return { success: false, error: err.message };
    }
  }

  // Toggle pool fallback for a member
  async function togglePoolFallback(userId: number, allowFallback: boolean) {
    const orgId = organizationId.value;
    if (!orgId) return { success: false };

    try {
      const response = await api.post(
        `/organizations/${orgId}/credits/toggle-pool-fallback`,
        { user_id: userId, allow_pool_fallback: allowFallback }
      );
      
      if (response.data.success) {
        showSuccess(
          'Setting updated',
          `Pool fallback ${allowFallback ? 'enabled' : 'disabled'} for member`
        );
        
        // Update local state immediately
        const member = members.value.find(m => m.user_id === userId);
        if (member && member.allocation) {
          member.allocation.allow_pool_fallback = allowFallback;
        }
        
        return { success: true };
      } else {
        showError('Update failed', response.data.error || 'Failed to update setting');
        return { success: false, error: response.data.error };
      }
    } catch (err: any) {
      showError('Update failed', err.message || 'An error occurred while updating the setting');
      return { success: false, error: err.message };
    }
  }

  // Delete organization
  async function deleteOrganization() {
    const orgId = organizationId.value;
    if (!orgId) return { success: false };

    try {
      await authStore.deleteOrganization(orgId);
      router.push('/projects');
      return { success: true };
    } catch (err: any) {
      showError('Delete failed', err.message || 'Failed to delete organization');
      return { success: false, error: err.message };
    }
  }

  // Upload organization logo
  async function uploadLogo(file: File) {
    const orgId = organizationId.value;
    if (!orgId) return { success: false, error: 'No organization ID' };

    try {
      const result = await uploadOrganizationLogo(orgId, file);
      if (result.success && result.logo_url) {
        // Update local state with the presigned URL
        if (organization.value) {
          organization.value.logo_url = result.logo_url;
        }
        showSuccess('Logo uploaded', 'Organization logo updated successfully');
      } else {
        showError('Upload failed', result.error || 'Failed to upload logo');
      }
      return result;
    } catch (err: any) {
      showError('Upload failed', err.message || 'Failed to upload logo');
      return { success: false, error: err.message };
    }
  }

  // Fetch pricing for buy credits modal
  async function fetchPricing() {
    try {
      const response = await api.get('/pricing');
      if (response.data.success) {
        return {
          success: true,
          packs: response.data.packs,
          solUsdRate: response.data.sol_usd_rate,
          companyWallet: response.data.company_wallet_address,
        };
      }
      return { success: false };
    } catch (err) {
      console.error('[useOrganization] Failed to fetch pricing:', err);
      return { success: false };
    }
  }

  // Utility functions
  function formatDate(dateStr: string) {
    return fmtDate(dateStr);
  }

  function formatAllocation(value: string | undefined): string {
    if (!value) return '0';
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    return Math.round(num).toString();
  }

  function formatTransactionDate(dateStr: string) {
    return formatDateTime(dateStr);
  }

  function getPaymentMethodLabel(method: string) {
    switch (method) {
      case 'stripe':
        return 'Card';
      case 'solana':
        return 'Crypto';
      default:
        return method;
    }
  }

  function getPackLabel(packType: string) {
    const labels: Record<string, string> = {
      starter: 'Starter Pack',
      creator: 'Creator Pack',
      pro: 'Pro Pack',
      studio: 'Studio Pack',
    };
    return labels[packType] || packType;
  }

  // Watch for route changes - force refresh when switching organizations
  watch(
    () => route.params.id,
    (newId, oldId) => {
      if (organizationId.value && newId !== oldId) {
        loadOrganization(true); // Force refresh for different org
      }
    }
  );

  return {
    // State
    loading,
    error,
    organization,
    members,
    invitations,
    credits,
    myAllocation,
    role,
    organizationId,
    orgLoaded,

    // Subscription
    subscription,
    subscriptionLoading,

    // Creator profiles
    creatorProfiles,
    profilesLoading,
    profilesLoaded,

    // Assets
    orgAssets,
    assetsLoading,
    assetsLoaded,

    // Transactions
    transactions,
    transactionsLoading,
    transactionsTotal,
    transactionsPage,
    transactionsPerPage,
    transactionsLoaded,
    totalTransactionPages,

    // Computed
    isAdmin,
    isOwner,
    poolBalance,
    hasActiveSubscription,
    totalSeats,
    currentMembers,
    seatsRemaining,
    canAddMembers,

    // Functions
    loadOrganization,
    loadSubscription,
    loadCreatorProfiles,
    loadOrgAssets,
    loadTransactions,
    updateOrganization,
    cancelInvitation,
    resendInvitation,
    removeMember,
    updateMemberRole,
    updateMemberAccount,
    allocateCredits,
    togglePoolFallback,
    deleteOrganization,
    uploadLogo,
    fetchPricing,
    isOrgCreatedUser,

    // Utility functions
    formatDate,
    formatAllocation,
    formatTransactionDate,
    getPaymentMethodLabel,
    getPackLabel,
  };
}
