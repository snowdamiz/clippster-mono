import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import api from '../services/api';

export function useCreditBalance() {
  const authStore = useAuthStore();
  const loading = ref(false);
  const error = ref<string | null>(null);
  const hoursRemaining = ref<number | 'unlimited' | null>(null);
  const isAdmin = ref(false);

  const isAuthenticated = computed(() => authStore.isAuthenticated);

  async function fetchBalance() {
    if (!authStore.token) {
      // Clear previous data but don't set error for unauthenticated users
      hoursRemaining.value = null;
      isAdmin.value = false;
      error.value = null;
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await api.get('/credits/balance');

      if (response.data.success) {
        hoursRemaining.value =
          response.data.balance.hours_remaining === 'unlimited'
            ? 'unlimited'
            : response.data.balance.hours_remaining;
        isAdmin.value = response.data.balance.hours_remaining === 'unlimited';
        return response.data;
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
    loading,
    error,
    hoursRemaining,
    isAdmin,
    isAuthenticated,
    fetchBalance,
  };
}
