import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { getUsageCount, recordUsage, getAllUsageCounts } from '@/services/database/free-tier-usage';

/** Daily action limits for free tier users */
export const FREE_TIER_LIMITS = {
  clip_build: 5,
  editor_export: 1,
  vod_download: 2,
} as const;

export type FreeTierAction = keyof typeof FREE_TIER_LIMITS;

/** Tier hierarchy for access checks */
const TIER_HIERARCHY: Record<string, number> = {
  free: 0,
  starter: 1,
  creator: 2,
  pro: 3,
};

/**
 * Composable for free tier limit tracking and subscription tier checks.
 */
export function useFreeTierLimits() {
  const authStore = useAuthStore();
  const usageCounts = ref<Record<string, number>>({});
  const loading = ref(false);

  /** Whether the current user is on the free tier (no active subscription) */
  const isFreeTier = computed(() => {
    const user = authStore.user;
    if (!user) return true;
    if (user.is_admin) return false;
    if (user.created_by_organization_id) return false;

    const status = (user as any).subscription_status;
    return !status || status === 'none' || status === 'expired';
  });

  /** Current user's subscription tier string */
  const currentTier = computed<string>(() => {
    const user = authStore.user;
    if (!user) return 'free';
    if (user.is_admin) return 'pro'; // admins treated as pro
    return (user as any).subscription_tier || 'free';
  });

  /** Check if user meets a minimum tier requirement */
  function meetsMinimumTier(minTier: string): boolean {
    const user = authStore.user;
    if (!user) return false;
    if (user.is_admin) return true;
    if (user.created_by_organization_id) return true;

    const userLevel = TIER_HIERARCHY[currentTier.value] ?? 0;
    const minLevel = TIER_HIERARCHY[minTier] ?? 0;
    return userLevel >= minLevel;
  }

  /** Load all usage counts for today */
  async function loadUsageCounts(): Promise<void> {
    const user = authStore.user;
    if (!user) return;

    loading.value = true;
    try {
      usageCounts.value = await getAllUsageCounts(String(user.id));
    } catch (err) {
      console.error('[useFreeTierLimits] Failed to load usage counts:', err);
    } finally {
      loading.value = false;
    }
  }

  /** Check if a free tier action can be performed (within daily limit) */
  async function canPerformAction(action: FreeTierAction): Promise<boolean> {
    // Non-free-tier users have no daily limits
    if (!isFreeTier.value) return true;

    const user = authStore.user;
    if (!user) return false;

    const limit = FREE_TIER_LIMITS[action];
    const count = await getUsageCount(String(user.id), action);
    return count < limit;
  }

  /** Record usage of a free tier action. Returns the new count. */
  async function recordActionUsage(action: FreeTierAction): Promise<number> {
    const user = authStore.user;
    if (!user) return 0;

    const newCount = await recordUsage(String(user.id), action);
    usageCounts.value[action] = newCount;
    return newCount;
  }

  /** Get remaining uses for an action today */
  function getRemainingUses(action: FreeTierAction): number {
    if (!isFreeTier.value) return Infinity;
    const limit = FREE_TIER_LIMITS[action];
    const used = usageCounts.value[action] || 0;
    return Math.max(0, limit - used);
  }

  return {
    isFreeTier,
    currentTier,
    meetsMinimumTier,
    usageCounts,
    loading,
    loadUsageCounts,
    canPerformAction,
    recordActionUsage,
    getRemainingUses,
    FREE_TIER_LIMITS,
  };
}
