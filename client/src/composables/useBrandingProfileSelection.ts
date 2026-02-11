import { ref } from 'vue';
import type { CreatorProfileWithLinks } from '@/services/database/types';
import {
  getCreatorProfileByProjectId,
  getAllGlobalProfiles,
  getCreatorProfile,
  getProjectBrandingProfileId,
  setProjectBrandingProfile,
} from '@/services/database/creator-profiles';

export type ProfileSource = 'streamer' | 'personal-global' | 'org-member' | 'campaign';

export interface ApplicableProfile {
  source: ProfileSource;
  profile: CreatorProfileWithLinks;
  required?: boolean;
  label: string;
}

export interface OrgBrandingContext {
  memberBrandingProfile?: CreatorProfileWithLinks | null;
  campaignBrandingProfile?: CreatorProfileWithLinks | null;
  campaignRequired?: boolean;
}

const showSelector = ref(false);
const applicableProfiles = ref<ApplicableProfile[]>([]);
const pendingResolve = ref<((profile: CreatorProfileWithLinks | null) => void) | null>(null);

function sourceLabel(source: ProfileSource): string {
  switch (source) {
    case 'streamer':
      return 'Streamer Profile';
    case 'personal-global':
      return 'Global Branding';
    case 'org-member':
      return 'Org Member Default';
    case 'campaign':
      return 'Campaign Branding';
  }
}

/**
 * Gather all applicable branding profiles for a project.
 * Does NOT auto-merge — returns all candidates for user selection.
 */
export async function resolveApplicableProfiles(
  projectId: string,
  orgContext?: OrgBrandingContext
): Promise<ApplicableProfile[]> {
  const profiles: ApplicableProfile[] = [];

  // 1. Streamer-specific profile (existing logic)
  try {
    const streamerProfile = await getCreatorProfileByProjectId(projectId);
    if (streamerProfile) {
      profiles.push({
        source: 'streamer',
        profile: streamerProfile,
        label: sourceLabel('streamer'),
      });
    }
  } catch (e) {
    console.warn('[BrandingProfile] Failed to resolve streamer profile:', e);
  }

  // 2. User's global profiles
  try {
    const globalProfiles = await getAllGlobalProfiles();
    for (const gp of globalProfiles) {
      profiles.push({
        source: 'personal-global',
        profile: gp,
        label: sourceLabel('personal-global'),
      });
    }
  } catch (e) {
    console.warn('[BrandingProfile] Failed to resolve global profiles:', e);
  }

  // 3. Org member branding profile (fetched from server if org context)
  if (orgContext?.memberBrandingProfile) {
    profiles.push({
      source: 'org-member',
      profile: orgContext.memberBrandingProfile,
      label: sourceLabel('org-member'),
    });
  }

  // 4. Campaign branding profile
  if (orgContext?.campaignBrandingProfile) {
    profiles.push({
      source: 'campaign',
      profile: orgContext.campaignBrandingProfile,
      required: orgContext.campaignRequired ?? false,
      label: sourceLabel('campaign'),
    });
  }

  return profiles;
}

/**
 * Main entry point: resolve the effective branding profile for a project.
 * - If already selected and valid → returns it immediately.
 * - If 0 candidates → returns null.
 * - If 1 candidate → auto-selects and saves.
 * - If 2+ candidates → opens selector dialog, returns user's choice.
 */
export async function resolveBrandingProfile(
  projectId: string,
  orgContext?: OrgBrandingContext
): Promise<CreatorProfileWithLinks | null> {
  // Check if project already has a selection
  const existingId = await getProjectBrandingProfileId(projectId);
  if (existingId) {
    const existing = await getCreatorProfile(existingId);
    if (existing) {
      console.log('[BrandingProfile] Using previously selected profile:', existing.name);
      return existing;
    }
    // Selected profile was deleted — clear it and re-resolve
    await setProjectBrandingProfile(projectId, null);
  }

  const candidates = await resolveApplicableProfiles(projectId, orgContext);

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    // Auto-select the only option
    const profile = candidates[0].profile;
    await setProjectBrandingProfile(projectId, profile.id);
    console.log('[BrandingProfile] Auto-selected only available profile:', profile.name);
    return profile;
  }

  // Multiple candidates — open selector dialog
  return new Promise<CreatorProfileWithLinks | null>((resolve) => {
    applicableProfiles.value = candidates;
    pendingResolve.value = async (selected) => {
      if (selected) {
        await setProjectBrandingProfile(projectId, selected.id);
        console.log('[BrandingProfile] User selected profile:', selected.name);
      }
      resolve(selected);
    };
    showSelector.value = true;
  });
}

/**
 * Called by BrandingProfileSelector when user confirms or cancels.
 */
export function completeBrandingSelection(profile: CreatorProfileWithLinks | null) {
  const resolve = pendingResolve.value;
  showSelector.value = false;
  applicableProfiles.value = [];
  pendingResolve.value = null;
  if (resolve) {
    resolve(profile);
  }
}

/**
 * Composable for components that need to render the selector dialog.
 */
export function useBrandingProfileSelection() {
  return {
    showSelector,
    applicableProfiles,
    completeBrandingSelection,
  };
}
