import { useSubscription } from './useSubscription';
import { useCreditBalance } from './useCreditBalance';
import { useAuthStore } from '@/stores/auth';

export type GateActionType =
  | 'download'
  | 'project'
  | 'live'
  | 'editor'
  | 'ai'
  | 'expired'
  | 'general';

export interface GateCheckOptions {
  /** Human-readable description of what the user tried to do */
  context?: string;
  /** Type of action for icon/header customization */
  type?: GateActionType;
  /** If true, only checks AI access (credits), not subscription */
  aiOnly?: boolean;
}

/**
 * Composable for checking subscription access and showing the gate dialog.
 *
 * Usage:
 * ```ts
 * const { requireSubscription } = useSubscriptionGate();
 *
 * async function handleDownload() {
 *   if (!await requireSubscription({ context: 'Download VOD', type: 'download' })) {
 *     return; // Gate was shown, user doesn't have access
 *   }
 *   // User has access, proceed with download
 * }
 * ```
 */
export function useSubscriptionGate() {
  const { subscriptionStatus, hasValidSubscription, needsSubscription, fetchSubscriptionStatus } =
    useSubscription();
  const { totalAvailable, fetchBalance } = useCreditBalance();
  const authStore = useAuthStore();

  /**
   * Shows the subscription gate dialog with optional context
   */
  function showGate(context?: string, type?: GateActionType) {
    const event = new CustomEvent('show-subscription-gate', {
      detail: { context, type },
    });
    window.dispatchEvent(event);
  }

  /**
   * Checks if user has subscription access. If not, shows the gate.
   * Returns true if user has access, false if gate was shown.
   */
  async function requireSubscription(options: GateCheckOptions = {}): Promise<boolean> {
    const { context, type = 'general', aiOnly = false } = options;

    // Always allow if not authenticated (they'll hit auth wall first)
    if (!authStore.isAuthenticated) {
      return false;
    }

    // Fetch latest subscription status
    await fetchSubscriptionStatus();

    // Check if user is admin or org-created (always has access)
    if (authStore.user?.is_admin || authStore.user?.created_by_organization_id) {
      return true;
    }

    // Check if user needs subscription at all
    if (!needsSubscription.value) {
      return true;
    }

    // For AI-only checks, check credits
    if (aiOnly) {
      await fetchBalance();
      const hasCredits =
        totalAvailable.value === 'unlimited' ||
        (typeof totalAvailable.value === 'number' && totalAvailable.value > 0);
      // Allow if user has credits (free tier users get 60 one-time credits)
      if (hasCredits) {
        return true;
      }
      showGate(context || 'Use AI features', type);
      return false;
    }

    // Check subscription access
    if (hasValidSubscription.value) {
      return true;
    }

    // Determine if expired for better messaging
    const gateType = subscriptionStatus.value?.status === 'expired' ? 'expired' : type;
    showGate(context, gateType);
    return false;
  }

  /**
   * Checks if user has AI feature access (requires credits).
   * If not, shows the gate.
   */
  async function requireAiAccess(context?: string): Promise<boolean> {
    return requireSubscription({ context, type: 'ai', aiOnly: true });
  }

  /**
   * Shorthand for common actions
   */
  const gates = {
    download: (context?: string) =>
      requireSubscription({
        context: context || 'Download VOD',
        type: 'download',
      }),

    createProject: (context?: string) =>
      requireSubscription({
        context: context || 'Create a new project',
        type: 'project',
      }),

    liveClip: (context?: string) =>
      requireSubscription({
        context: context || 'Use Live Clip mode',
        type: 'live',
      }),

    editor: (context?: string) =>
      requireSubscription({
        context: context || 'Access the video editor',
        type: 'editor',
      }),

    aiDetection: (context?: string) => requireAiAccess(context || 'Use AI clip detection'),
  };

  return {
    subscriptionStatus,
    hasValidSubscription,
    needsSubscription,
    showGate,
    requireSubscription,
    requireAiAccess,
    gates,
  };
}
