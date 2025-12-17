import { ref, computed, watch } from 'vue';
import { useCreditBalance, OrganizationAllocation } from './useCreditBalance';

export type CreditSource = 'personal' | 'organization';

export interface CreditSourceOption {
  type: CreditSource;
  label: string;
  hoursRemaining: number;
  organizationId?: number;
  organizationName?: string;
}

export function useCreditSource() {
  const { hoursRemaining, organizationAllocations, hasOrgCredits, fetchBalance, loading } =
    useCreditBalance();

  // Selected credit source
  const selectedSource = ref<CreditSource>('personal');
  const selectedOrganizationId = ref<number | null>(null);

  // Available options for the user
  const creditSourceOptions = computed<CreditSourceOption[]>(() => {
    const options: CreditSourceOption[] = [];

    // Personal credits option (always available)
    const personalHours =
      hoursRemaining.value === 'unlimited' ? Infinity : (hoursRemaining.value ?? 0);
    options.push({
      type: 'personal',
      label: 'Personal Credits',
      hoursRemaining: personalHours === Infinity ? -1 : personalHours, // -1 indicates unlimited
    });

    // Organization allocation options
    for (const alloc of organizationAllocations.value) {
      if (alloc.hours_remaining > 0) {
        options.push({
          type: 'organization',
          label: alloc.organization_name,
          hoursRemaining: alloc.hours_remaining,
          organizationId: alloc.organization_id,
          organizationName: alloc.organization_name,
        });
      }
    }

    return options;
  });

  // Should show the selector? Only if user has org credits with balance
  const showCreditSourceSelector = computed(() => {
    return hasOrgCredits.value;
  });

  // Get the currently selected option details
  const selectedOption = computed<CreditSourceOption | null>(() => {
    if (selectedSource.value === 'personal') {
      return creditSourceOptions.value.find((opt) => opt.type === 'personal') || null;
    } else {
      return (
        creditSourceOptions.value.find(
          (opt) =>
            opt.type === 'organization' && opt.organizationId === selectedOrganizationId.value
        ) || null
      );
    }
  });

  // Get remaining hours for selected source
  const selectedSourceHoursRemaining = computed(() => {
    if (!selectedOption.value) return 0;
    if (selectedOption.value.hoursRemaining === -1) return Infinity; // Unlimited
    return selectedOption.value.hoursRemaining;
  });

  // Check if selected source has enough credits for a given amount
  function hasEnoughCredits(hoursNeeded: number): boolean {
    if (selectedSourceHoursRemaining.value === Infinity) return true;
    return selectedSourceHoursRemaining.value >= hoursNeeded;
  }

  // Select personal credits
  function selectPersonal() {
    selectedSource.value = 'personal';
    selectedOrganizationId.value = null;
  }

  // Select an organization's credits
  function selectOrganization(orgId: number) {
    selectedSource.value = 'organization';
    selectedOrganizationId.value = orgId;
  }

  // Get the organization_id to pass to API (null if personal)
  const organizationIdForApi = computed<number | null>(() => {
    if (selectedSource.value === 'organization' && selectedOrganizationId.value) {
      return selectedOrganizationId.value;
    }
    return null;
  });

  // Reset to default (personal)
  function reset() {
    selectedSource.value = 'personal';
    selectedOrganizationId.value = null;
  }

  // Auto-select first available option with credits when balance loads
  watch(
    [hoursRemaining, organizationAllocations],
    () => {
      // Only auto-select if nothing is selected yet
      if (
        selectedSource.value === 'personal' &&
        hoursRemaining.value === 0 &&
        hasOrgCredits.value
      ) {
        // Personal is empty but org has credits - auto-select first org with credits
        const firstOrgWithCredits = organizationAllocations.value.find(
          (alloc) => alloc.hours_remaining > 0
        );
        if (firstOrgWithCredits) {
          selectOrganization(firstOrgWithCredits.organization_id);
        }
      }
    },
    { immediate: true }
  );

  return {
    // State
    selectedSource,
    selectedOrganizationId,
    loading,

    // Computed
    creditSourceOptions,
    showCreditSourceSelector,
    selectedOption,
    selectedSourceHoursRemaining,
    organizationIdForApi,

    // Methods
    fetchBalance,
    hasEnoughCredits,
    selectPersonal,
    selectOrganization,
    reset,
  };
}
