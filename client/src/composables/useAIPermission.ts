import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

/**
 * Composable to check if the current user is allowed to use AI features.
 * Users created by organizations may have AI disabled by their org admin.
 */
export function useAIPermission() {
  const authStore = useAuthStore();

  /**
   * Whether AI features are allowed for the current user.
   * Returns true if:
   * - User is not authenticated (will be blocked by auth anyway)
   * - User is an admin
   * - User was not created by an organization
   * - User's organization has allow_ai enabled (or not set, defaulting to true)
   */
  const isAIAllowed = computed(() => {
    const user = authStore.user;

    // If not authenticated or user data not loaded, default to true
    // (auth checks will handle access control)
    if (!user) return true;

    // Admins always have AI access
    if (user.is_admin) return true;

    // Check the ai_allowed field from the server
    // Default to true if not set (backwards compatibility)
    return user.ai_allowed !== false;
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
