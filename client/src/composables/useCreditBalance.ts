import { ref, computed } from 'vue';
import { useAuthStore } from '../stores/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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
      const response = await fetch(`${API_BASE}/api/credits/balance`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          hoursRemaining.value =
            data.balance.hours_remaining === 'unlimited'
              ? 'unlimited'
              : data.balance.hours_remaining;
          isAdmin.value = data.balance.hours_remaining === 'unlimited';
          return data;
        } else {
          throw new Error(data.error || 'Failed to fetch balance');
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
