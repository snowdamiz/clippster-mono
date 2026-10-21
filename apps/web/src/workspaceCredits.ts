import { ref, computed } from 'vue'
import { workspaceClient } from './api'
import { useAuthStore } from './workspaceAccount'
export interface OrganizationAllocation { organization_id: number; organization_name: string; role: string; hours_allocated: number; hours_used: number; hours_remaining: number }
interface Balance { success: boolean; balance: { hours_remaining: number | 'unlimited'; hours_used: number }; organization_allocations: OrganizationAllocation[] }
export function useCreditBalance() {
  const loading = ref(false), balance = ref<number | 'unlimited' | null>(null), organizationAllocations = ref<OrganizationAllocation[]>([])
  const isAdmin = computed(() => useAuthStore().user?.is_admin === true)
  const hoursRemaining = computed(() => isAdmin.value ? 'unlimited' as const : balance.value)
  const hasOrgCredits = computed(() => !isAdmin.value && organizationAllocations.value.some(value => value.hours_remaining > 0))
  async function fetchBalance() { loading.value = true; try { const data = await workspaceClient.get<Balance>('/web/account/credits/balance'); if (!data.success) throw new Error('Unable to load credit balance.'); balance.value = data.balance.hours_remaining; organizationAllocations.value = data.organization_allocations || []; return data } finally { loading.value = false } }
  return { loading, hoursRemaining, organizationAllocations, hasOrgCredits, fetchBalance }
}
