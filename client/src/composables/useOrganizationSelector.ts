import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';

/**
 * Composable for managing organization selector state
 * Used by organization pages to conditionally show the selector dropdown
 */
export function useOrganizationSelector() {
  const authStore = useAuthStore();
  const userOrganizations = ref<any[]>([]);
  const loading = ref(false);

  // Check if user has multiple organizations
  const hasMultipleOrgs = computed(() => userOrganizations.value.length > 1);

  // Load user's organizations
  async function loadUserOrganizations() {
    loading.value = true;
    try {
      const result = await authStore.getOrganizations();
      if (result.success) {
        userOrganizations.value = result.organizations ?? [];
      }
    } catch (error) {
      console.error('Failed to load user organizations:', error);
    } finally {
      loading.value = false;
    }
  }

  // Auto-load on mount if authenticated
  onMounted(() => {
    if (authStore.isAuthenticated) {
      loadUserOrganizations();
    }
  });

  return {
    userOrganizations,
    hasMultipleOrgs,
    loading,
    loadUserOrganizations,
  };
}
