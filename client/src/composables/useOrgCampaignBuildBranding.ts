import { invoke } from '@tauri-apps/api/core';
import type { Campaign } from '@/services/campaignApi';
import type { ServerOrganizationCreatorProfile } from '@/services/organizationProfilesApi';
import type { ServerOrganizationAsset } from '@/services/organizationAssetsApi';
import { ensureAssetDownloaded } from '@/services/orgAssetSync';
import { resolveWatermarkById } from '@/services/database/watermarks';
import type { IntroOutro } from '@/services/database';
import type { WatermarkSettings } from '@/types';

export interface BuildIntroOutroItem extends Omit<IntroOutro, 'id'> {
  id: string;
  isOrgAsset?: boolean;
  organization_name?: string | null;
}

export type BuildWatermarkSettings = WatermarkSettings & {
  filePath?: string | null;
  width?: number | null;
  height?: number | null;
};

export interface OrgCampaignBuildBranding {
  intro: BuildIntroOutroItem | null;
  outro: BuildIntroOutroItem | null;
  watermark: BuildWatermarkSettings | null;
}

const ALL_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5'];

function parseWatermarkPosition(
  watermarkSettings: Record<string, unknown> | string | null | undefined,
  ratio = '16:9'
): { x: number; y: number; opacity: number; scale: number } {
  const defaultPos = { x: 12, y: 92, opacity: 80, scale: 20 };
  if (!watermarkSettings) return defaultPos;
  try {
    const wmSettings =
      typeof watermarkSettings === 'string' ? JSON.parse(watermarkSettings) : watermarkSettings;
    const ratioConfig = (wmSettings as Record<string, { position?: typeof defaultPos }>)?.[ratio];
    if (ratioConfig?.position) return ratioConfig.position;
  } catch {
    // ignore parse errors
  }
  return defaultPos;
}

export async function expandWatermarkForBuild(
  watermark: WatermarkSettings,
  aspectRatios: string[] = ALL_ASPECT_RATIOS
): Promise<BuildWatermarkSettings | null> {
  if (!watermark.enabled || !watermark.watermarkId) return null;

  const resolved = await resolveWatermarkById(watermark.watermarkId);
  if (!resolved) return null;

  const wmPerRatio: Record<string, {
    watermarkId: string | null;
    filePath: string | null;
    width: number | null;
    height: number | null;
    position: { x: number; y: number; opacity: number; scale: number } | null;
  }> = {};
  for (const ratio of aspectRatios) {
    const ratioSettings = watermark.perRatioSettings as Record<string, { position?: { x: number; y: number; opacity: number; scale: number } }> | null | undefined;
    const pos =
      ratioSettings?.[ratio]?.position ??
      parseWatermarkPosition(ratioSettings, ratio);
    wmPerRatio[ratio] = {
      watermarkId: watermark.watermarkId,
      filePath: resolved.filePath,
      width: resolved.width,
      height: resolved.height,
      position: pos,
    };
  }

  const defaultPos = parseWatermarkPosition(
    watermark.perRatioSettings as Record<string, { position?: { x: number; y: number; opacity: number; scale: number } }> | null | undefined
  );

  return {
    ...watermark,
    enabled: true,
    filePath: resolved.filePath,
    width: resolved.width ?? 0,
    height: resolved.height ?? 0,
    positionX: watermark.positionX ?? defaultPos.x,
    positionY: watermark.positionY ?? defaultPos.y,
    opacity: watermark.opacity ?? defaultPos.opacity,
    scale: watermark.scale ?? defaultPos.scale,
    perRatioSettings: wmPerRatio as any,
  };
}

export async function resolveOrgBuildBranding(
  orgProfile: ServerOrganizationCreatorProfile
): Promise<OrgCampaignBuildBranding> {
  let intro: BuildIntroOutroItem | null = null;
  let outro: BuildIntroOutroItem | null = null;
  let watermark: BuildWatermarkSettings | null = null;

  if (orgProfile.intro?.url) {
    try {
      const introResult = await ensureAssetDownloaded({
        id: orgProfile.intro.id,
        name: orgProfile.intro.name,
        asset_type: 'intro',
        url: orgProfile.intro.url,
        organization_id: orgProfile.organization_id,
        organization_name: orgProfile.organization_name || undefined,
        duration: orgProfile.intro.duration || undefined,
        thumbnail_url: orgProfile.intro.thumbnail_url || undefined,
        inserted_at: Date.now().toString(),
        updated_at: Date.now().toString(),
      } as unknown as ServerOrganizationAsset);

      if (introResult.success && introResult.filePath) {
        intro = {
          id: `org-intro-${orgProfile.intro.id}`,
          name: orgProfile.intro.name,
          file_path: introResult.filePath,
          type: 'intro',
          duration: orgProfile.intro.duration ? parseFloat(String(orgProfile.intro.duration)) : null,
          thumbnail_path: orgProfile.intro.thumbnail_url || null,
          thumbnail_generation_status: null,
          created_at: Date.now(),
          updated_at: Date.now(),
          isOrgAsset: true,
          organization_name: orgProfile.organization_name ?? null,
        };
      }
    } catch (e) {
      console.warn('[useOrgCampaignBuildBranding] Failed to load org intro:', e);
    }
  }

  if (orgProfile.outro?.url) {
    try {
      const outroResult = await ensureAssetDownloaded({
        id: orgProfile.outro.id,
        name: orgProfile.outro.name,
        asset_type: 'outro',
        url: orgProfile.outro.url,
        organization_id: orgProfile.organization_id,
        organization_name: orgProfile.organization_name || undefined,
        duration: orgProfile.outro.duration || undefined,
        thumbnail_url: orgProfile.outro.thumbnail_url || undefined,
        inserted_at: Date.now().toString(),
        updated_at: Date.now().toString(),
      } as unknown as ServerOrganizationAsset);

      if (outroResult.success && outroResult.filePath) {
        outro = {
          id: `org-outro-${orgProfile.outro.id}`,
          name: orgProfile.outro.name,
          file_path: outroResult.filePath,
          type: 'outro',
          duration: orgProfile.outro.duration ? parseFloat(String(orgProfile.outro.duration)) : null,
          thumbnail_path: orgProfile.outro.thumbnail_url || null,
          thumbnail_generation_status: null,
          created_at: Date.now(),
          updated_at: Date.now(),
          isOrgAsset: true,
          organization_name: orgProfile.organization_name ?? null,
        };
      }
    } catch (e) {
      console.warn('[useOrgCampaignBuildBranding] Failed to load org outro:', e);
    }
  }

  if (orgProfile.watermark?.url) {
    try {
      const filename = `org-watermark-${orgProfile.watermark.id}.png`;
      await invoke<string>('download_org_asset_from_url', {
        url: orgProfile.watermark.url,
        filename,
        assetType: 'watermarks',
        organizationId: String(orgProfile.organization_id),
      });

      const defaultPos = parseWatermarkPosition(orgProfile.watermark_settings);

      watermark = {
        enabled: true,
        watermarkId: `org-asset-${orgProfile.watermark.id}`,
        positionX: defaultPos.x,
        positionY: defaultPos.y,
        opacity: defaultPos.opacity,
        scale: defaultPos.scale,
        perRatioSettings: (orgProfile.watermark_settings as WatermarkSettings['perRatioSettings']) ?? null,
      };
    } catch (e) {
      console.warn('[useOrgCampaignBuildBranding] Failed to load org watermark:', e);
    }
  } else if (orgProfile.watermark_id) {
    const defaultPos = parseWatermarkPosition(orgProfile.watermark_settings);
    watermark = {
      enabled: true,
      watermarkId: `org-asset-${orgProfile.watermark_id}`,
      positionX: defaultPos.x,
      positionY: defaultPos.y,
      opacity: defaultPos.opacity,
      scale: defaultPos.scale,
      perRatioSettings: (orgProfile.watermark_settings as WatermarkSettings['perRatioSettings']) ?? null,
    };
  }

  return { intro, outro, watermark };
}

export async function resolveCampaignBuildBranding(campaign: Campaign): Promise<OrgCampaignBuildBranding> {
  let intro: BuildIntroOutroItem | null = null;
  let outro: BuildIntroOutroItem | null = null;
  let watermark: BuildWatermarkSettings | null = null;

  if (campaign.global_intro) {
    try {
      const introResult = await ensureAssetDownloaded({
        id: campaign.global_intro.id,
        name: campaign.global_intro.name,
        asset_type: 'intro',
        url: campaign.global_intro.url,
        organization_id: campaign.organization_id,
        organization_name: campaign.organization?.name || undefined,
        duration: campaign.global_intro.duration || undefined,
        thumbnail_url: campaign.global_intro.thumbnail_url || undefined,
        inserted_at: Date.now().toString(),
        updated_at: Date.now().toString(),
      } as unknown as ServerOrganizationAsset);

      if (introResult.success && introResult.filePath) {
        intro = {
          id: `campaign-intro-${campaign.global_intro.id}`,
          name: campaign.global_intro.name,
          file_path: introResult.filePath,
          type: 'intro',
          duration: campaign.global_intro.duration
            ? parseFloat(String(campaign.global_intro.duration))
            : null,
          thumbnail_path: campaign.global_intro.thumbnail_url || null,
          thumbnail_generation_status: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        };
      }
    } catch (e) {
      console.warn('[useOrgCampaignBuildBranding] Failed to load campaign global_intro:', e);
    }
  }

  if (campaign.global_outro) {
    try {
      const outroResult = await ensureAssetDownloaded({
        id: campaign.global_outro.id,
        name: campaign.global_outro.name,
        asset_type: 'outro',
        url: campaign.global_outro.url,
        organization_id: campaign.organization_id,
        organization_name: campaign.organization?.name || undefined,
        duration: campaign.global_outro.duration || undefined,
        thumbnail_url: campaign.global_outro.thumbnail_url || undefined,
        inserted_at: Date.now().toString(),
        updated_at: Date.now().toString(),
      } as unknown as ServerOrganizationAsset);

      if (outroResult.success && outroResult.filePath) {
        outro = {
          id: `campaign-outro-${campaign.global_outro.id}`,
          name: campaign.global_outro.name,
          file_path: outroResult.filePath,
          type: 'outro',
          duration: campaign.global_outro.duration
            ? parseFloat(String(campaign.global_outro.duration))
            : null,
          thumbnail_path: campaign.global_outro.thumbnail_url || null,
          thumbnail_generation_status: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        };
      }
    } catch (e) {
      console.warn('[useOrgCampaignBuildBranding] Failed to load campaign global_outro:', e);
    }
  }

  const campaignCreatorProfile =
    campaign.branding_profile || campaign.creator_profiles?.[0] || campaign.creator_profile;

  if (!intro && campaignCreatorProfile?.intro?.url) {
    try {
      const introResult = await ensureAssetDownloaded({
        id: campaignCreatorProfile.intro.id,
        name: campaignCreatorProfile.intro.name,
        asset_type: 'intro',
        url: campaignCreatorProfile.intro.url,
        organization_id: campaign.organization_id,
        organization_name: campaign.organization?.name || undefined,
        duration: campaignCreatorProfile.intro.duration || undefined,
        thumbnail_url: campaignCreatorProfile.intro.thumbnail_url || undefined,
        inserted_at: Date.now().toString(),
        updated_at: Date.now().toString(),
      } as unknown as ServerOrganizationAsset);

      if (introResult.success && introResult.filePath) {
        intro = {
          id: `campaign-intro-${campaignCreatorProfile.intro.id}`,
          name: campaignCreatorProfile.intro.name,
          file_path: introResult.filePath,
          type: 'intro',
          duration: campaignCreatorProfile.intro.duration
            ? parseFloat(String(campaignCreatorProfile.intro.duration))
            : null,
          thumbnail_path: campaignCreatorProfile.intro.thumbnail_url || null,
          thumbnail_generation_status: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        };
      }
    } catch (e) {
      console.warn('[useOrgCampaignBuildBranding] Failed to load campaign branding_profile intro:', e);
    }
  }

  if (!outro && campaignCreatorProfile?.outro?.url) {
    try {
      const outroResult = await ensureAssetDownloaded({
        id: campaignCreatorProfile.outro.id,
        name: campaignCreatorProfile.outro.name,
        asset_type: 'outro',
        url: campaignCreatorProfile.outro.url,
        organization_id: campaign.organization_id,
        organization_name: campaign.organization?.name || undefined,
        duration: campaignCreatorProfile.outro.duration || undefined,
        thumbnail_url: campaignCreatorProfile.outro.thumbnail_url || undefined,
        inserted_at: Date.now().toString(),
        updated_at: Date.now().toString(),
      } as unknown as ServerOrganizationAsset);

      if (outroResult.success && outroResult.filePath) {
        outro = {
          id: `campaign-outro-${campaignCreatorProfile.outro.id}`,
          name: campaignCreatorProfile.outro.name,
          file_path: outroResult.filePath,
          type: 'outro',
          duration: campaignCreatorProfile.outro.duration
            ? parseFloat(String(campaignCreatorProfile.outro.duration))
            : null,
          thumbnail_path: campaignCreatorProfile.outro.thumbnail_url || null,
          thumbnail_generation_status: null,
          created_at: Date.now(),
          updated_at: Date.now(),
        };
      }
    } catch (e) {
      console.warn('[useOrgCampaignBuildBranding] Failed to load campaign branding_profile outro:', e);
    }
  }

  if (campaignCreatorProfile?.watermark?.url) {
    try {
      const filename = `campaign-watermark-${campaignCreatorProfile.watermark.id}.png`;
      await invoke<string>('download_org_asset_from_url', {
        url: campaignCreatorProfile.watermark.url,
        filename,
        assetType: 'watermarks',
        organizationId: String(campaign.organization_id),
      });

      const defaultPos = parseWatermarkPosition(campaignCreatorProfile.watermark_settings);

      watermark = {
        enabled: true,
        watermarkId: `org-asset-${campaignCreatorProfile.watermark.id}`,
        positionX: defaultPos.x,
        positionY: defaultPos.y,
        opacity: defaultPos.opacity,
        scale: defaultPos.scale,
        perRatioSettings:
          (campaignCreatorProfile.watermark_settings as WatermarkSettings['perRatioSettings']) ?? null,
      };
    } catch (e) {
      console.warn('[useOrgCampaignBuildBranding] Failed to load campaign watermark:', e);
    }
  }

  return { intro, outro, watermark };
}

/**
 * Preview branding for UI when user selects org/campaign (campaign takes priority if both selected).
 */
export async function resolveSelectionBrandingPreview(
  selectedOrg: ServerOrganizationCreatorProfile | null,
  selectedCampaign: Campaign | null
): Promise<OrgCampaignBuildBranding> {
  if (selectedCampaign) {
    return resolveCampaignBuildBranding(selectedCampaign);
  }
  if (selectedOrg) {
    return resolveOrgBuildBranding(selectedOrg);
  }
  return { intro: null, outro: null, watermark: null };
}
