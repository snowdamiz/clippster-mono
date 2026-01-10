/**
 * Campaign Assets Service
 * 
 * Handles fetching and preparing campaign global assets (intro, outro, watermarks)
 * for use during clip builds.
 */

import { invoke } from '@tauri-apps/api/core';
import { getCampaignById, type Campaign, type CampaignAsset } from './campaignApi';
import { getClipCampaignId } from './database/clips';

export interface CampaignBuildAssets {
  introPath: string | null;
  introDuration: number | null;
  outroPath: string | null;
  outroDuration: number | null;
  watermarkUrl: string | null;
  watermarkSettings: Record<string, any> | null;
}

/**
 * Get campaign assets for a clip build.
 * Downloads remote assets to local temp files if needed.
 */
export async function getCampaignAssetsForBuild(
  clipId: string,
  aspectRatio: string = '9:16'
): Promise<CampaignBuildAssets | null> {
  try {
    // Get campaign ID from clip
    const campaignId = await getClipCampaignId(clipId);
    if (!campaignId) {
      return null;
    }

    // Fetch campaign details with assets
    const response = await getCampaignById(campaignId);
    if (!response.success || !response.campaign) {
      console.warn(`[CampaignAssets] Failed to fetch campaign ${campaignId}`);
      return null;
    }

    const campaign = response.campaign;
    const assets: CampaignBuildAssets = {
      introPath: null,
      introDuration: null,
      outroPath: null,
      outroDuration: null,
      watermarkUrl: null,
      watermarkSettings: null,
    };

    // Process global intro
    if (campaign.global_intro) {
      const introAsset = campaign.global_intro;
      if (introAsset.url) {
        // Download remote asset to local temp file
        const localPath = await downloadAssetToTemp(introAsset.url, `campaign_${campaignId}_intro`);
        if (localPath) {
          assets.introPath = localPath;
          assets.introDuration = introAsset.duration ? Number(introAsset.duration) : null;
        }
      }
    }

    // Process global outro
    if (campaign.global_outro) {
      const outroAsset = campaign.global_outro;
      if (outroAsset.url) {
        const localPath = await downloadAssetToTemp(outroAsset.url, `campaign_${campaignId}_outro`);
        if (localPath) {
          assets.outroPath = localPath;
          assets.outroDuration = outroAsset.duration ? Number(outroAsset.duration) : null;
        }
      }
    }

    // Process global watermarks based on aspect ratio
    if (campaign.global_watermarks) {
      const watermarkKey = getWatermarkKeyForAspectRatio(aspectRatio);
      const watermarkId = campaign.global_watermarks[watermarkKey];
      
      if (watermarkId) {
        // Find the watermark asset in the campaign's organization assets
        // For now, we'll use the watermark URL directly if available
        // The watermark settings would need to be fetched from the organization
        assets.watermarkUrl = null; // Would need to fetch from organization assets
        assets.watermarkSettings = {
          enabled: true,
          // Default watermark settings - these would come from campaign settings
          position: 'bottom-right',
          opacity: 0.8,
          scale: 0.15,
        };
      }
    }

    return assets;
  } catch (error) {
    console.error('[CampaignAssets] Error getting campaign assets for build:', error);
    return null;
  }
}

/**
 * Download a remote asset to a local temp file.
 */
async function downloadAssetToTemp(url: string, prefix: string): Promise<string | null> {
  try {
    // Use Tauri command to download file to temp directory
    const localPath = await invoke<string>('download_remote_asset', {
      url,
      prefix,
    });
    return localPath;
  } catch (error) {
    console.error(`[CampaignAssets] Failed to download asset from ${url}:`, error);
    return null;
  }
}

/**
 * Get the watermark key for a given aspect ratio.
 */
function getWatermarkKeyForAspectRatio(aspectRatio: string): string {
  const ratioMap: Record<string, string> = {
    '9:16': 'portrait',
    '16:9': 'landscape',
    '1:1': 'square',
    '4:5': 'portrait', // Use portrait for 4:5
  };
  return ratioMap[aspectRatio] || 'portrait';
}

/**
 * Check if a clip has campaign assets that should be applied.
 */
export async function clipHasCampaignAssets(clipId: string): Promise<boolean> {
  const campaignId = await getClipCampaignId(clipId);
  return campaignId !== null;
}

/**
 * Get campaign requirements for a clip.
 * Returns which assets are required by the campaign.
 */
export async function getCampaignRequirements(clipId: string): Promise<{
  requireWatermark: boolean;
  requireIntro: boolean;
  requireOutro: boolean;
} | null> {
  try {
    const campaignId = await getClipCampaignId(clipId);
    if (!campaignId) {
      return null;
    }

    const response = await getCampaignById(campaignId);
    if (!response.success || !response.campaign) {
      return null;
    }

    return {
      requireWatermark: response.campaign.require_watermark || false,
      requireIntro: response.campaign.require_intro || false,
      requireOutro: response.campaign.require_outro || false,
    };
  } catch (error) {
    console.error('[CampaignAssets] Error getting campaign requirements:', error);
    return null;
  }
}
