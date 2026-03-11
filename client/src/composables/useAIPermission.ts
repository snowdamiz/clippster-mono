import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { usePermissionsStore } from '@/stores/permissions';

/**
 * Composable to check if the current user is allowed to use AI features.
 * Users created by organizations may have AI disabled by their org admin.
 */
export function useAIPermission() {
  const authStore = useAuthStore();
  const permissionsStore = usePermissionsStore();

  /**
   * Whether AI features are allowed for the current user.
   * Returns true if:
   * - User is not authenticated (will be blocked by auth anyway)
   * - User is an admin
   * - User is not on Basic tier
   * - User is not restricted, OR user is restricted but has allow_ai enabled
   */
  const isAIAllowed = computed(() => {
    const user = authStore.user;

    // If not authenticated or user data not loaded, default to true
    // (auth checks will handle access control)
    if (!user) return true;

    // Admins always have AI access
    if (user.is_admin) return true;

    // Basic tier users do NOT have AI clip detection access
    if ((user as any).subscription_tier === 'basic') return false;

    // Check permissions store for restriction settings
    if (permissionsStore.isRestricted) {
      return permissionsStore.allowAi;
    }

    // Non-restricted users have full AI access
    return true;
  });

  /**
   * Whether the user was created by an organization.
   * These users may have restricted AI access.
   */
  const isOrgCreatedUser = computed(() => {
    return !!authStore.user?.created_by_organization_id;
  });

  /**
   * Message to display when AI is disabled.
   */
  const aiDisabledMessage = computed(() => {
    if (isAIAllowed.value) return '';
    return 'AI clip detection has been disabled by your organization administrator.';
  });

  return {
    isAIAllowed,
    isOrgCreatedUser,
    aiDisabledMessage,
  };
}
