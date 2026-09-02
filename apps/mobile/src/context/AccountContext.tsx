import type {
  OrganizationCreditAllocation,
  SubscriptionStatus,
  SubscriptionTierInfo,
} from '@clippster/shared-types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  bypassesPersonalSubscription,
  formatCreditsAvailable,
  hasValidSubscription,
  needsSubscription,
  requiresPlanSelectionGate,
  type GateActionType,
} from '@/lib/subscriptionAccess';
import { creditsApi, subscriptionApi } from '@/services/api';
import { getHasSelectedPlan, setHasSelectedPlan, syncPlanSelectionForStatus } from '@/services/planSelection';
import { useAuth } from './AuthContext';

WebBrowser.maybeCompleteAuthSession();

const STRIPE_RETURN_PREFIX = 'clippster://stripe';

function checkoutOutcomeFromUrl(url: string | undefined): 'paid' | 'cancelled' | 'dismissed' {
  if (!url) return 'dismissed';
  if (url.includes('stripe/success')) return 'paid';
  if (url.includes('stripe/cancel')) return 'cancelled';
  return 'dismissed';
}

interface GateState {
  visible: boolean;
  context?: string;
  type: GateActionType;
}

interface AccountContextValue {
  loading: boolean;
  accountReady: boolean;
  subscription: SubscriptionStatus | null;
  tiers: SubscriptionTierInfo[];
  totalAvailable: number | 'unlimited' | null;
  organizationAllocations: OrganizationCreditAllocation[];
  hasSelectedPlan: boolean;
  hasValidSubscription: boolean;
  needsSubscription: boolean;
  bypassesSubscription: boolean;
  requiresPlanGate: boolean;
  creditsLabel: string;
  tierLabel: string;
  refreshAccount: (options?: { silent?: boolean }) => Promise<{
    subscription: SubscriptionStatus | null;
    totalAvailable: number | 'unlimited' | null;
  }>;
  continueWithFreePlan: () => Promise<void>;
  subscribeToTier: (
    tierId: string,
    options?: { billing_interval?: 'monthly' | 'yearly' },
  ) => Promise<{
    success: boolean;
    error?: string;
    outcome?: 'paid' | 'cancelled' | 'dismissed';
  }>;
  showSubscriptionGate: (context?: string, type?: GateActionType) => void;
  hideSubscriptionGate: () => void;
  gateState: GateState;
  requireSubscription: (options?: {
    context?: string;
    type?: GateActionType;
    aiOnly?: boolean;
  }) => Promise<boolean>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

function displayTierFromStatus(status: SubscriptionStatus | null | undefined): string {
  if (!status) return 'Free';
  if (status.tier_name) return status.tier_name;
  if (status.status === 'active' || status.status === 'cancelled') return 'Subscribed';
  return 'Free';
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, authChecked } = useAuth();
  const [loading, setLoading] = useState(false);
  const [accountReady, setAccountReady] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [tiers, setTiers] = useState<SubscriptionTierInfo[]>([]);
  const [totalAvailable, setTotalAvailable] = useState<number | 'unlimited' | null>(null);
  const [organizationAllocations, setOrganizationAllocations] = useState<OrganizationCreditAllocation[]>(
    [],
  );
  const [hasSelectedPlan, setHasSelectedPlanState] = useState(false);
  const [gateState, setGateState] = useState<GateState>({ visible: false, type: 'general' });

  const bypassesSubscription = bypassesPersonalSubscription(user);
  const validSubscription = hasValidSubscription(subscription ?? user?.subscription);
  const userNeedsSubscription = needsSubscription(subscription ?? user?.subscription);
  const requiresPlanGate = requiresPlanSelectionGate(
    user,
    subscription ?? user?.subscription,
    hasSelectedPlan,
  );

  const tierLabel = useMemo(() => {
    if (user?.is_admin || totalAvailable === 'unlimited') return 'Admin';
    return displayTierFromStatus(subscription ?? user?.subscription);
  }, [user, subscription, totalAvailable]);

  const creditsLabel = formatCreditsAvailable(totalAvailable);

  const refreshAccount = useCallback(async (options?: { silent?: boolean }) => {
    if (!isAuthenticated) {
      setSubscription(null);
      setTotalAvailable(null);
      setOrganizationAllocations([]);
      setAccountReady(true);
      return { subscription: null, totalAvailable: null };
    }

    if (!options?.silent) {
      setLoading(true);
    }

    let nextSubscription: SubscriptionStatus | null = null;
    let nextTotalAvailable: number | 'unlimited' | null = null;

    try {
      const [balanceRes, statusRes, tiersRes, planSelected] = await Promise.all([
        creditsApi.getBalance(),
        subscriptionApi.getStatus(),
        subscriptionApi.getTiers(),
        getHasSelectedPlan(),
      ]);

      setHasSelectedPlanState(planSelected);

      if (balanceRes.success) {
        nextSubscription = balanceRes.subscription ?? null;
        nextTotalAvailable =
          balanceRes.total_available === 'unlimited'
            ? 'unlimited'
            : typeof balanceRes.total_available === 'number'
              ? balanceRes.total_available
              : null;
        setSubscription(nextSubscription);
        setOrganizationAllocations(balanceRes.organization_allocations ?? []);
        setTotalAvailable(nextTotalAvailable);
      }

      if (statusRes.success && statusRes.subscription) {
        nextSubscription = statusRes.subscription;
        setSubscription(nextSubscription);
        const planSelected = await syncPlanSelectionForStatus(statusRes.subscription);
        if (
          statusRes.subscription.status === 'active' ||
          statusRes.subscription.status === 'cancelled'
        ) {
          await setHasSelectedPlan(true);
          setHasSelectedPlanState(true);
        } else {
          setHasSelectedPlanState(planSelected);
        }
      }

      if (tiersRes.success && tiersRes.tiers) {
        setTiers(tiersRes.tiers);
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
      setAccountReady(true);
    }

    return { subscription: nextSubscription, totalAvailable: nextTotalAvailable };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authChecked) return;
    void refreshAccount();
  }, [authChecked, isAuthenticated, refreshAccount]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isAuthenticated) {
        void refreshAccount({ silent: true });
      }
    });
    return () => sub.remove();
  }, [isAuthenticated, refreshAccount]);

  const continueWithFreePlan = useCallback(async () => {
    await setHasSelectedPlan(true);
    setHasSelectedPlanState(true);
  }, []);

  const subscribeToTier = useCallback(async (
    tierId: string,
    options?: { billing_interval?: 'monthly' | 'yearly' },
  ) => {
    setGateState((prev) => ({ ...prev, visible: false }));
    const result = await subscriptionApi.createCheckout(tierId, {
      return_context: 'mobile',
      billing_interval: options?.billing_interval ?? 'monthly',
    });
    if (!result.success || !result.url) {
      return { success: false, error: result.error ?? 'Could not start checkout' };
    }

    const browserResult = await WebBrowser.openAuthSessionAsync(result.url, STRIPE_RETURN_PREFIX);
    const outcome = checkoutOutcomeFromUrl(
      browserResult.type === 'success' ? browserResult.url : undefined,
    );

    if (outcome === 'paid') {
      await setHasSelectedPlan(true);
      setHasSelectedPlanState(true);
    }

    await refreshAccount({ silent: true });
    return { success: true, outcome };
  }, [refreshAccount]);

  const showSubscriptionGate = useCallback((context?: string, type: GateActionType = 'general') => {
    setGateState({ visible: true, context, type });
  }, []);

  const hideSubscriptionGate = useCallback(() => {
    setGateState((prev) => ({ ...prev, visible: false }));
  }, []);

  const requireSubscription = useCallback(
    async (options?: { context?: string; type?: GateActionType; aiOnly?: boolean }) => {
      if (!isAuthenticated) return false;

      // Silent refresh: avoid unmounting tab navigator via account loading spinner.
      const snapshot = await refreshAccount({ silent: true });

      if (bypassesPersonalSubscription(user)) return true;

      const currentSubscription = snapshot.subscription ?? user?.subscription;
      const creditsAvailable = snapshot.totalAvailable ?? totalAvailable;
      if (!needsSubscription(currentSubscription)) return true;

      if (options?.aiOnly) {
        const hasCredits =
          creditsAvailable === 'unlimited' ||
          (typeof creditsAvailable === 'number' && creditsAvailable > 0);
        if (hasCredits) return true;
        showSubscriptionGate(options.context ?? 'Use AI features', 'ai');
        return false;
      }

      if (hasValidSubscription(currentSubscription)) return true;

      const gateType =
        currentSubscription?.status === 'expired' ? 'expired' : options?.type ?? 'general';
      showSubscriptionGate(options?.context, gateType);
      return false;
    },
    [isAuthenticated, refreshAccount, showSubscriptionGate, user, totalAvailable],
  );

  const value = useMemo<AccountContextValue>(
    () => ({
      loading,
      accountReady,
      subscription,
      tiers,
      totalAvailable,
      organizationAllocations,
      hasSelectedPlan,
      hasValidSubscription: validSubscription,
      needsSubscription: userNeedsSubscription,
      bypassesSubscription,
      requiresPlanGate,
      creditsLabel,
      tierLabel,
      refreshAccount,
      continueWithFreePlan,
      subscribeToTier,
      showSubscriptionGate,
      hideSubscriptionGate,
      gateState,
      requireSubscription,
    }),
    [
      loading,
      accountReady,
      subscription,
      tiers,
      totalAvailable,
      organizationAllocations,
      hasSelectedPlan,
      validSubscription,
      userNeedsSubscription,
      bypassesSubscription,
      requiresPlanGate,
      creditsLabel,
      tierLabel,
      refreshAccount,
      continueWithFreePlan,
      subscribeToTier,
      showSubscriptionGate,
      hideSubscriptionGate,
      gateState,
      requireSubscription,
    ],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount must be used within AccountProvider');
  }
  return context;
}
