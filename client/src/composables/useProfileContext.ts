import { ref } from 'vue';
import type { CreatorProfileWithLinks } from '@/services/database/types';
import {
  recordProfileUsage,
  getLastUsedContext,
  getAllProfileContexts,
  clearProfileContext,
  type ProfileUsageContext,
} from '@/services/database/profile-context';
import { useAuthStore } from '@/stores/auth';

export function useProfileContext() {
  const authStore = useAuthStore();

  async function trackProfileUsage(profile: CreatorProfileWithLinks): Promise<void> {
    if (!authStore.user?.id) {
      console.warn('[ProfileContext] No user ID, skipping context tracking');
      return;
    }

    const userId = String(authStore.user.id);
    const contextType = profile.context_type || 'personal';

    await recordProfileUsage(
      userId,
      profile.id,
      contextType,
      profile.organization_id || null,
      profile.organization_name || null,
      profile.campaign_id || null,
      profile.campaign_title || null
    );

    console.log('[ProfileContext] Tracked usage:', {
      profile: profile.name,
      contextType,
      organization: profile.organization_name,
      campaign: profile.campaign_title,
    });
  }

  async function getProfileContext(profileId: string): Promise<ProfileUsageContext | null> {
    if (!authStore.user?.id) {
      return null;
    }

    const userId = String(authStore.user.id);
    return await getLastUsedContext(userId, profileId);
  }

  async function getAllContexts(): Promise<ProfileUsageContext[]> {
    if (!authStore.user?.id) {
      return [];
    }

    const userId = String(authStore.user.id);
    return await getAllProfileContexts(userId);
  }

  async function clearContext(
    profileId: string,
    contextType?: 'personal' | 'organization' | 'campaign'
  ): Promise<void> {
    if (!authStore.user?.id) {
      return;
    }

    const userId = String(authStore.user.id);
    await clearProfileContext(userId, profileId, contextType);
  }

  return {
    trackProfileUsage,
    getProfileContext,
    getAllContexts,
    clearContext,
  };
}
