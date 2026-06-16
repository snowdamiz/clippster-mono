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
import { getProject } from '@/services/database/projects';
import { useAuthStore } from '@/stores/auth';
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
export function linksMatchStreamer(
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

/** Team seat account created by an org admin (not invited onto existing personal account). */
export function isOrgSuppliedAccount(): boolean {
  const authStore = useAuthStore();
  return authStore.user?.created_by_organization_id != null;
}

export function isSlugMatchedSource(source: ProfileSource): boolean {
  return source === 'streamer' || source === 'org-streamer' || source === 'campaign';
}

function isPersonalLocalProfile(profile: CreatorProfileWithLinks): boolean {
  return profile.context_type !== 'organization' && profile.context_type !== 'campaign';
}

/**
 * Personal / invited-member auto branding: local creator profile only when slug matches.
 */
export async function resolvePersonalStreamerMatchedProfile(
  projectId: string
): Promise<CreatorProfileWithLinks | null> {
  try {
    const project = await getProject(projectId);
    if (project?.creator_profile_id) {
      const direct = await getCreatorProfile(project.creator_profile_id);
      if (direct && isPersonalLocalProfile(direct)) {
        return direct;
      }
    }
  } catch (e) {
    console.warn('[BrandingProfile] Failed to resolve direct creator_profile_id:', e);
  }

  try {
    const streamerProfile = await getCreatorProfileByProjectId(projectId);
    if (streamerProfile && isPersonalLocalProfile(streamerProfile)) {
      return streamerProfile;
    }
  } catch (e) {
    console.warn('[BrandingProfile] Failed to resolve personal streamer profile:', e);
  }

  return null;
}

/**
 * Org build branding: creator profile when slug matches, else org global branding.
 */
export async function resolveOrgBuildBranding(
  organizationId: number,
  projectId: string,
  streamerOverride?: { platform: string; platformId: string }
): Promise<CreatorProfileWithLinks | null> {
  let projectPlatform: string | null = null;
  let projectPlatformId: string | null = null;

  if (streamerOverride) {
    projectPlatform = streamerOverride.platform;
    projectPlatformId = streamerOverride.platformId;
  } else {
    try {
      const info = await getProjectStreamerInfo(projectId);
      projectPlatform = info.platform;
      projectPlatformId = info.platformId;
    } catch (e) {
      console.warn('[BrandingProfile] resolveOrgBuildBranding: failed to get streamer info:', e);
    }
  }

  try {
    const response = await getMyAssignedCreatorProfiles();
    if (!response.success || response.profiles.length === 0) {
      return null;
    }

    const orgProfiles = response.profiles.filter(
      (sp) => Number(sp.organization_id) === Number(organizationId)
    );
    if (orgProfiles.length === 0) {
      return null;
    }

    for (const sp of orgProfiles) {
      const scope = sp.scope || 'streamer';
      if (
        scope === 'streamer' &&
        linksMatchStreamer(sp.platform_links || [], projectPlatform, projectPlatformId)
      ) {
        console.log('[BrandingProfile] resolveOrgBuildBranding: creator match', sp.name);
        return serverProfileToLocal(sp);
      }
    }

    const globalProfile = orgProfiles.find((sp) => (sp.scope || 'streamer') === 'global');
    if (globalProfile) {
      console.log('[BrandingProfile] resolveOrgBuildBranding: global fallback', globalProfile.name);
      return serverProfileToLocal(globalProfile);
    }
  } catch (e) {
    console.warn('[BrandingProfile] resolveOrgBuildBranding failed:', e);
  }

  return null;
}

export interface EligibleOrgForBuild {
  organizationId: number;
  organizationName: string;
  resolvedProfile: CreatorProfileWithLinks;
  serverProfile: ServerOrganizationCreatorProfile;
}

/** Orgs the user can build for on this project (slug-matched creator or global branding). */
export async function getEligibleOrgsForBuild(projectId: string): Promise<EligibleOrgForBuild[]> {
  const eligible: EligibleOrgForBuild[] = [];

  try {
    const response = await getMyAssignedCreatorProfiles();
    if (!response.success || response.profiles.length === 0) {
      return eligible;
    }

    const orgIds = [
      ...new Set(response.profiles.map((sp) => Number(sp.organization_id)).filter(Boolean)),
    ];

    for (const orgId of orgIds) {
      const resolved = await resolveOrgBuildBranding(orgId, projectId);
      if (resolved) {
        const serverProfile = response.profiles.find((sp) => String(sp.id) === resolved.id);
        if (serverProfile) {
          eligible.push({
            organizationId: orgId,
            organizationName: resolved.organization_name || resolved.name,
            resolvedProfile: resolved,
            serverProfile,
          });
        }
      }
    }
  } catch (e) {
    console.warn('[BrandingProfile] getEligibleOrgsForBuild failed:', e);
  }

  return eligible;
}

/** Build creatorWatermarkSettings payload from a resolved profile. */
export function profileToDownloadWatermarkSettings(
  profile: CreatorProfileWithLinks
): { watermarkId: string; watermarkSettings: string } | undefined {
  if (!profile.watermark_id || !profile.watermark_settings) {
    return undefined;
  }
  return {
    watermarkId: profile.watermark_id,
    watermarkSettings: profile.watermark_settings,
  };
}

/**
 * Read-only auto branding for preview/workspace/download.
 * Org-supplied accounts: org creator then global. Personal: local slug match only.
 */
export async function resolveAutoBrandingProfile(
  projectId: string
): Promise<CreatorProfileWithLinks | null> {
  if (isOrgSuppliedAccount()) {
    const authStore = useAuthStore();
    const orgId = authStore.user?.created_by_organization_id;
    if (orgId != null) {
      return resolveOrgBuildBranding(Number(orgId), projectId);
    }
    return null;
  }
  return resolvePersonalStreamerMatchedProfile(projectId);
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
 * When any streamer/campaign match exists, personal-global fallbacks are excluded.
 * org-global remains in this list for org-target clip builds; workspace auto-select filters
 * it in filterCandidatesForWorkspaceAutoSelect() so the local streamer profile wins in the editor.
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

  // Exclude personal-global fallbacks when a streamer/campaign match exists (see docblock).
  // NOTE: Do NOT exclude org-global here — Clip builds that target an org need org-global in the
  // list so ClipsTab can resolve watermark/outro when streamer-specific org branding is absent.
  // Workspace auto-select avoids org-global via filterCandidatesForWorkspaceAutoSelect().
  if (hasAnyStreamerMatch) {
    return profiles.filter((p) => p.source !== 'personal-global');
  }

  return profiles;
}

/**
 * Whether a profile source is local (exists in SQLite creator_profiles table).
 * Server-sourced profiles (org/campaign) can't be persisted to selected_branding_profile_id
 * because it has a FK constraint referencing the local creator_profiles table.
 */

/**
 * Main entry point: resolve the effective branding profile for a project (may persist local selection).
 * Auto-apply uses slug-matched personal profile or org-supplied account rules only.
 */
export async function resolveBrandingProfile(
  projectId: string,
  _orgContext?: OrgBrandingContext
): Promise<CreatorProfileWithLinks | null> {
  const profile = await resolveAutoBrandingProfile(projectId);

  if (!profile) {
    await setProjectBrandingProfile(projectId, null);
    return null;
  }

  const existingId = await getProjectBrandingProfileId(projectId);
  if (existingId && existingId === profile.id) {
    return profile;
  }

  if (isPersonalLocalProfile(profile)) {
    await setProjectBrandingProfile(projectId, profile.id);
  } else {
    await setProjectBrandingProfile(projectId, null);
  }

  console.log('[BrandingProfile] Auto-selected profile:', profile.name);
  return profile;
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
