import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function useCreditBalance() {
  const loading = ref(false);
  const error = ref(null);
  const hoursRemaining = ref(null);
  const isAdmin = ref(false);

  async function fetchBalance() {
    if (!useAuthStore().token) {
      error.value = 'Authentication required';
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${API_BASE}/api/credits/balance`, {
        headers: {
          Authorization: `Bearer ${useAuthStore().token}`,
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
    } catch (err) {
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
    fetchBalance,
  };
}
