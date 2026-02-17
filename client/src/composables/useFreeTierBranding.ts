import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import api from '@/services/api';
import { useSubscription } from '@/composables/useSubscription';
import type { WatermarkSettings, IntroOutroRef } from '@/types';

/**
 * Admin-configured branding for free tier users.
 * Fetched from server app_settings and cached locally.
 */
interface FreeTierBranding {
  watermark_settings: WatermarkSettings | null;
  watermark_url: string | null;
  intro: IntroOutroRef | null;
  outro: IntroOutroRef | null;
  intro_ratio_settings: string | null;
  outro_ratio_settings: string | null;
  layout_overlays: any[] | null;
}

const cachedBranding = ref<FreeTierBranding | null>(null);
const loading = ref(false);
const fetched = ref(false);

/**
 * Composable for fetching and applying admin-configured free tier branding.
 * Free tier users get admin watermark/intro/outro injected into all outputs.
 */
export function useFreeTierBranding() {
  const authStore = useAuthStore();

  const isFreeTier = computed(() => {
    const user = authStore.user;
    if (!user) return true;
    if (user.is_admin) return false;
    if (user.created_by_organization_id) return false;
    const status = (user as any).subscription_status;
    return !status || status === 'none' || status === 'expired';
  });

  /** Fetch free tier branding from server (cached after first fetch) */
  async function fetchBranding(): Promise<FreeTierBranding | null> {
    if (fetched.value && cachedBranding.value !== undefined) {
      return cachedBranding.value;
    }

    loading.value = true;
    try {
      const response = await api.get('/app-settings/free-tier-branding');
      if (response.data.success && response.data.branding) {
        cachedBranding.value = response.data.branding;
      } else {
        cachedBranding.value = null;
      }
      fetched.value = true;
      return cachedBranding.value;
    } catch (err) {
      console.warn('[useFreeTierBranding] Failed to fetch branding:', err);
      cachedBranding.value = null;
      fetched.value = true;
      return null;
    } finally {
      loading.value = false;
    }
  }

  /** Clear cached branding (e.g., when user upgrades) */
  function clearCache() {
    cachedBranding.value = null;
    fetched.value = false;
  }

  /** Get branding if user is free tier, null otherwise */
  async function getBrandingIfFreeTier(): Promise<FreeTierBranding | null> {
    const { fetchSubscriptionStatus } = useSubscription();
    await fetchSubscriptionStatus();
    if (!isFreeTier.value) return null;
    return await fetchBranding();
  }

  return {
    isFreeTier,
    branding: cachedBranding,
    loading,
    fetchBranding,
    clearCache,
    getBrandingIfFreeTier,
  };
}
