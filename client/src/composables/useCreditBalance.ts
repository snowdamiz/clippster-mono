import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import api from '../services/api';

export interface OrganizationAllocation {
  organization_id: number;
  organization_name: string;
  role: string;
  hours_allocated: number;
  hours_used: number;
  hours_remaining: number;
}

export interface CreditBalanceResponse {
  success: boolean;
  balance: {
    hours_remaining: number | 'unlimited';
    hours_used: number;
  };
  organization_allocations: OrganizationAllocation[];
  total_available: number | 'unlimited';
}

export function useCreditBalance() {
  const authStore = useAuthStore();
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Personal credits
  const hoursRemaining = ref<number | 'unlimited' | null>(null);
  const hoursUsed = ref<number>(0);
  const isAdmin = ref(false);

  // Organization allocations
  const organizationAllocations = ref<OrganizationAllocation[]>([]);

  // Total available (personal + all org allocations)
  const totalAvailable = ref<number | 'unlimited' | null>(null);

  const isAuthenticated = computed(() => authStore.isAuthenticated);

  // Computed: does user have any org allocations with credits?
  const hasOrgCredits = computed(() => {
    return organizationAllocations.value.some((alloc) => alloc.hours_remaining > 0);
  });

  // Computed: total org credits remaining
  const totalOrgCredits = computed(() => {
    return organizationAllocations.value.reduce((sum, alloc) => sum + alloc.hours_remaining, 0);
  });

  // Get allocation for a specific organization
  function getOrgAllocation(orgId: number): OrganizationAllocation | undefined {
    return organizationAllocations.value.find((alloc) => alloc.organization_id === orgId);
  }

  async function fetchBalance(): Promise<CreditBalanceResponse | null> {
    if (!authStore.token) {
      // Clear previous data but don't set error for unauthenticated users
      hoursRemaining.value = null;
      hoursUsed.value = 0;
      isAdmin.value = false;
      organizationAllocations.value = [];
      totalAvailable.value = null;
      error.value = null;
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await api.get('/credits/balance');

      if (response.data.success) {
        // Personal balance
        hoursRemaining.value =
          response.data.balance.hours_remaining === 'unlimited'
            ? 'unlimited'
            : response.data.balance.hours_remaining;
        hoursUsed.value = response.data.balance.hours_used || 0;
        isAdmin.value = response.data.balance.hours_remaining === 'unlimited';

        // Organization allocations
        organizationAllocations.value = response.data.organization_allocations || [];

        // Total available
        totalAvailable.value =
          response.data.total_available === 'unlimited'
            ? 'unlimited'
            : response.data.total_available;

        return response.data as CreditBalanceResponse;
      } else {
        throw new Error(response.data.error || 'Failed to fetch balance');
      }
    } catch (err: any) {
      error.value = err.message;
      console.error('Failed to fetch credit balance:', err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  return {
    // State
    loading,
    error,
    hoursRemaining,
    hoursUsed,
    isAdmin,
    organizationAllocations,
    totalAvailable,

    // Computed
    isAuthenticated,
    hasOrgCredits,
    totalOrgCredits,

    // Methods
    fetchBalance,
    getOrgAllocation,
  };
}
