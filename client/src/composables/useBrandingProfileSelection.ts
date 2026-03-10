import { ref } from 'vue';
import type { CreatorProfileWithLinks, CreatorPlatformLink } from '@/services/database/types';
import {
  getCreatorProfileByProjectId,
  getAllGlobalProfiles,
  getCreatorProfile,
  getProjectBrandingProfileId,
  setProjectBrandingProfile,
  getProjectStreamerInfo,
} from '@/services/database/creator-profiles';
import { getProjectCampaignId } from '@/services/database/clips';
import {
  getMyAssignedCreatorProfiles,
  type ServerOrganizationCreatorProfile,
} from '@/services/organizationProfilesApi';
import {
  getCampaign,
  type CampaignCreatorProfile,
  type CampaignCreatorPlatformLink,
} from '@/services/campaignApi';

export type ProfileSource = 'streamer' | 'personal-global' | 'org-streamer' | 'org-global' | 'org-member' | 'campaign';

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
    case 'org-streamer':
      return 'Org Creator Profile';
    case 'org-global':
      return 'Org Global Branding';
    case 'personal-global':
      return 'Global Branding';
    case 'org-member':
      return 'Org Member Default';
    case 'campaign':
      return 'Campaign Branding';
  }
}

/**
 * Prefix watermarkId values inside per-ratio watermark_settings with 'org-asset-'.
 * Server stores raw numeric IDs; the client expects the org-asset- prefix for server assets.
 */
function prefixWatermarkSettingsIds(settings: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const config = value as Record<string, unknown>;
      if (config.watermarkId != null) {
        const wmId = String(config.watermarkId);
        result[key] = {
          ...config,
          watermarkId: wmId.startsWith('org-asset-') ? wmId : `org-asset-${wmId}`,
        };
      } else {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Prefix assetId values inside layout_overlays with 'org-asset-'.
 * Server stores raw numeric asset IDs; the client expects the org-asset- prefix for server assets.
 */
function prefixOverlayAssetIds(overlays: unknown[]): unknown[] {
  return overlays.map((overlay: any) => {
    if (overlay && typeof overlay === 'object' && overlay.assetId != null) {
      const assetIdStr = String(overlay.assetId);
      return {
        ...overlay,
        assetId: assetIdStr.startsWith('org-asset-') ? assetIdStr : `org-asset-${assetIdStr}`,
      };
    }
    return overlay;
  });
}

/**
 * Convert a server org creator profile to the local CreatorProfileWithLinks format.
 */
function serverProfileToLocal(sp: ServerOrganizationCreatorProfile): CreatorProfileWithLinks {
  console.log('[serverProfileToLocal] Converting profile:', sp.name, 'server watermark_id:', sp.watermark_id);
  return {
    id: String(sp.id),
    name: sp.name,
    description: sp.description || null,
    profile_image_path: sp.profile_image_url || null,
    intro_id: sp.intro_id != null ? `org-asset-${sp.intro_id}` : null,
    outro_id: sp.outro_id != null ? `org-asset-${sp.outro_id}` : null,
    watermark_id: sp.watermark_id != null ? `org-asset-${sp.watermark_id}` : null,
    watermark_settings: sp.watermark_settings ? JSON.stringify(prefixWatermarkSettingsIds(sp.watermark_settings)) : null,
    intro_outro_settings: sp.intro_outro_settings ? JSON.stringify(sp.intro_outro_settings) : null,
    intro_ratio_settings: sp.intro_ratio_settings || null,
    outro_ratio_settings: sp.outro_ratio_settings || null,
    auto_dvr_enabled: 0,
    layout_overlays: sp.layout_overlays ? JSON.stringify(prefixOverlayAssetIds(sp.layout_overlays)) : null,
    scope: sp.scope || 'streamer',
    user_id: null,
    created_at: new Date(sp.inserted_at).getTime(),
    updated_at: new Date(sp.updated_at).getTime(),
    platform_links: (sp.platform_links || []).map((link): CreatorPlatformLink => ({
      id: String(link.id),
      creator_profile_id: String(sp.id),
      platform: link.platform === 'youtube' ? 'YouTube' : link.platform as CreatorPlatformLink['platform'],
      platform_id: link.platform_id,
      display_name: link.display_name || null,
      profile_image_url: link.profile_image_url || null,
      monitored_streamer_id: null,
      is_primary: Boolean(link.is_primary),
      created_at: new Date(link.inserted_at).getTime(),
    })),
    organization_id: sp.organization_id,
    organization_name: sp.organization_name,
    context_type: 'organization',
  };
}

/**
 * Convert a campaign creator profile to the local CreatorProfileWithLinks format.
 */
function campaignProfileToLocal(cp: CampaignCreatorProfile, campaign: any): CreatorProfileWithLinks {
  return {
    id: `campaign-${cp.id}`,
    name: cp.name,
    description: cp.description || null,
    profile_image_path: cp.profile_image_url || null,
    intro_id: cp.intro?.id != null ? `org-asset-${cp.intro.id}` : null,
    outro_id: cp.outro?.id != null ? `org-asset-${cp.outro.id}` : null,
    watermark_id: cp.watermark?.id != null ? `org-asset-${cp.watermark.id}` : null,
    watermark_settings: cp.watermark_settings ? JSON.stringify(cp.watermark_settings) : null,
    intro_outro_settings: null,
    intro_ratio_settings: null,
    outro_ratio_settings: null,
    auto_dvr_enabled: 0,
    layout_overlays: null,
    scope: 'streamer',
    user_id: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    platform_links: (cp.platform_links || []).map((link): CreatorPlatformLink => ({
      id: String(link.id),
      creator_profile_id: `campaign-${cp.id}`,
      platform: link.platform as CreatorPlatformLink['platform'],
      platform_id: link.platform_id,
      display_name: link.display_name || null,
      profile_image_url: link.profile_image_url || null,
      monitored_streamer_id: null,
      is_primary: Boolean(link.is_primary),
      created_at: Date.now(),
    })),
    organization_id: campaign.organization_id,
    organization_name: campaign.organization?.name || null,
    campaign_id: campaign.id,
    campaign_title: campaign.title,
    context_type: 'campaign',
  };
}

/**
 * Platform name mapping from project platform to link platform values.
 */
const PLATFORM_MAP: Record<string, string> = {
  PumpFun: 'pumpfun', Kick: 'kick', Twitch: 'twitch', YouTube: 'YouTube',
};

/**
 * Check if a set of platform links matches the project's streamer.
 */
function linksMatchStreamer(
  links: Array<{ platform: string; platform_id: string }>,
  platform: string | null,
  platformId: string | null
): boolean {
  if (!platform || !platformId || !links.length) return false;
  const linkPlatform = PLATFORM_MAP[platform];
  if (!linkPlatform) return false;
  return links.some(
    (link) => link.platform === linkPlatform && link.platform_id.toLowerCase() === platformId.toLowerCase()
  );
}

/**
 * Gather all applicable branding profiles for a project.
 *
 * Priority rules:
 *   - Campaign + org streamer for same streamer → show selector (user picks campaign vs org)
 *   - Campaign + personal-only streamer (no org) → campaign auto-wins
 *   - Org streamer match (no campaign) → org streamer auto-wins, excludes personal-global
 *   - No streamer match → fall through to org-global, then personal-global
 *
 * When any streamer-specific match exists, org-global profiles are excluded.
 * When an org streamer match exists, personal-global profiles are excluded.
 */
export async function resolveApplicableProfiles(
  projectId: string,
  orgContext?: OrgBrandingContext
): Promise<ApplicableProfile[]> {
  const profiles: ApplicableProfile[] = [];
  let hasOrgStreamerMatch = false;
  let hasCampaignMatch = false;
  let hasLocalStreamerMatch = false;

  // Get the project's streamer info for matching profiles
  let projectPlatform: string | null = null;
  let projectPlatformId: string | null = null;
  try {
    const info = await getProjectStreamerInfo(projectId);
    projectPlatform = info.platform;
    projectPlatformId = info.platformId;
  } catch (e) {
    console.warn('[BrandingProfile] Failed to get project streamer info:', e);
  }

  // 1. Check if project is tied to a campaign and fetch campaign creator profiles
  try {
    const campaignId = await getProjectCampaignId(projectId);
    if (campaignId) {
      const campaignRes = await getCampaign(campaignId);
      if (campaignRes.success && campaignRes.campaign) {
        const campaign = campaignRes.campaign;
        const campaignProfiles = campaign.creator_profiles || [];
        // Also check the single creator_profile if creator_profiles array is empty
        if (campaignProfiles.length === 0 && campaign.creator_profile) {
          campaignProfiles.push(campaign.creator_profile);
        }

        for (const cp of campaignProfiles) {
          // Check if this campaign profile matches the project's streamer
          if (linksMatchStreamer(cp.platform_links || [], projectPlatform, projectPlatformId)) {
            hasCampaignMatch = true;
            const orgName = campaign.organization?.name || 'Unknown Org';
            profiles.push({
              source: 'campaign',
              profile: campaignProfileToLocal(cp, campaign),
              label: `Campaign (${orgName}): ${campaign.title}`,
            });
            console.log('[BrandingProfile] Found campaign streamer match:', cp.name, 'for campaign:', campaign.title);
          }
        }
      }
    }
  } catch (e) {
    console.warn('[BrandingProfile] Failed to fetch campaign profiles:', e);
  }

  // 2. Fetch org-assigned profiles from server and check for streamer matches
  try {
    const response = await getMyAssignedCreatorProfiles();
    if (response.success && response.profiles.length > 0) {
      for (const sp of response.profiles) {
        const scope = sp.scope || 'streamer';
        if (scope === 'streamer' && linksMatchStreamer(sp.platform_links || [], projectPlatform, projectPlatformId)) {
          hasOrgStreamerMatch = true;
          profiles.push({
            source: 'org-streamer',
            profile: serverProfileToLocal(sp),
            label: `${sp.organization_name}: ${sp.name}`,
          });
          console.log('[BrandingProfile] Found org streamer match:', sp.name);
        } else if (scope === 'global') {
          // Collect org global profiles — will be filtered later if streamer match exists
          profiles.push({
            source: 'org-global',
            profile: serverProfileToLocal(sp),
            label: `${sp.organization_name}: ${sp.name}`,
          });
        }
      }
    }
  } catch (e) {
    console.warn('[BrandingProfile] Failed to fetch org-assigned profiles:', e);
  }

  // 3. Local streamer-specific profile
  // Always check for personal streamer profile - user may want to choose between personal and org profiles
  try {
    const streamerProfile = await getCreatorProfileByProjectId(projectId);
    if (streamerProfile) {
      hasLocalStreamerMatch = true;
      profiles.push({
        source: 'streamer',
        profile: streamerProfile,
        label: sourceLabel('streamer'),
      });
    }
  } catch (e) {
    console.warn('[BrandingProfile] Failed to resolve local streamer profile:', e);
  }

  // 4. User's personal global profiles (only if no org streamer match and no campaign match)
  if (!hasOrgStreamerMatch && !hasCampaignMatch) {
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
  }

  const hasAnyStreamerMatch = hasOrgStreamerMatch || hasLocalStreamerMatch || hasCampaignMatch;

  // Apply priority filtering:
  // IMPORTANT: 
  // - org-global profiles come from getMyAssignedCreatorProfiles() which only returns
  //   profiles explicitly assigned to the user by an org admin. These should ALWAYS be available.
  // - org-streamer and campaign profiles should coexist with personal streamer profiles.
  //   Users should be able to choose between using org branding vs their personal profile.
  // - Only filter out personal-global profiles when there's a streamer-specific match.
  if (hasAnyStreamerMatch) {
    // Filter out personal-global profiles (user's own global profiles)
    // but keep all streamer-specific profiles (personal, org, campaign) for user selection
    return profiles.filter((p) => p.source !== 'personal-global');
  }

  return profiles;
}

/**
 * Whether a profile source is local (exists in SQLite creator_profiles table).
 * Server-sourced profiles (org/campaign) can't be persisted to selected_branding_profile_id
 * because it has a FK constraint referencing the local creator_profiles table.
 */
function isLocalSource(source: ProfileSource): boolean {
  return source === 'streamer' || source === 'personal-global';
}

/**
 * Persist the branding selection only if the profile exists locally.
 */
async function trySaveSelection(projectId: string, candidate: ApplicableProfile): Promise<void> {
  if (isLocalSource(candidate.source)) {
    await setProjectBrandingProfile(projectId, candidate.profile.id);
  } else {
    // Clear any stale local selection — server-sourced profiles are resolved dynamically
    await setProjectBrandingProfile(projectId, null);
  }
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
  // Always run priority resolution first to get the current valid candidates
  const candidates = await resolveApplicableProfiles(projectId, orgContext);

  if (candidates.length === 0) {
    // No candidates — clear any stale selection
    await setProjectBrandingProfile(projectId, null);
    return null;
  }

  // Check if project already has a selection AND it's still a valid candidate
  const existingId = await getProjectBrandingProfileId(projectId);
  if (existingId) {
    const stillValid = candidates.find((c) => c.profile.id === existingId);
    if (stillValid) {
      console.log('[BrandingProfile] Previously selected profile still valid:', stillValid.profile.name, `(${stillValid.source})`);
      return stillValid.profile;
    }
    // Previously selected profile is no longer a valid candidate — clear it
    console.log('[BrandingProfile] Previously selected profile', existingId, 'is no longer a valid candidate, re-resolving');
    await setProjectBrandingProfile(projectId, null);
  }

  if (candidates.length === 1) {
    // Auto-select the only option
    const candidate = candidates[0];
    await trySaveSelection(projectId, candidate);
    console.log('[BrandingProfile] Auto-selected only available profile:', candidate.profile.name, `(${candidate.source})`);
    return candidate.profile;
  }

  // Multiple candidates — open selector dialog
  return new Promise<CreatorProfileWithLinks | null>((resolve) => {
    applicableProfiles.value = candidates;
    pendingResolve.value = async (selected) => {
      if (selected) {
        const selectedCandidate = candidates.find((c) => c.profile.id === selected.id);
        if (selectedCandidate) {
          await trySaveSelection(projectId, selectedCandidate);
        }
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
