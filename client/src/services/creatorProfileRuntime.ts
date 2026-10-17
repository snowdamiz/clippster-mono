import {
createOrganizationCreatorProfile,
updateOrganizationCreatorProfile,
addPlatformLink as apiAddPlatformLink,
deletePlatformLink as apiDeletePlatformLink,
type ServerOrganizationCreatorProfile,
} from '@/services/organizationProfilesApi';
import {
listOrganizationAssets,
uploadOrganizationAsset,
type ServerOrganizationAsset,
} from '@/services/organizationAssetsApi';
import {
createCreatorProfile,
updateCreatorProfile,
addPlatformLink as dbAddPlatformLink,
deletePlatformLink as dbDeletePlatformLink,
updatePlatformLink as dbUpdatePlatformLink,
getAllIntroOutros,
createMonitoredStreamer,
getMonitoredStreamerByMint,
type CreatorProfileWithLinks,
type IntroOutro,
} from '@/services/database';
import { getAllWatermarkImages, type WatermarkImage } from '@/services/database/watermarks';
export { getWatermarkImage } from '@/services/database/watermarks';
import { extractMintId, searchPumpFunTokens, fetchTokenMetadataFromServer } from '@/services/pumpfun';
import { extractChannelSlug, checkKickLivestream } from '@/services/kick';
import { extractChannelName, checkTwitchLivestream } from '@/services/twitch';
import { extractYouTubeChannel, getYouTubeChannelInfo } from '@/services/youtube';
import { extractRumbleChannel, getRumbleChannelInfo } from '@/services/rumble';
import { readFile } from '@tauri-apps/plugin-fs';
import { useAssetOperations } from '@/composables/useAssetOperations';
import { useWatermarkOperations } from '@/composables/useWatermarkOperations';

import type { CreatorProfileForm } from './creatorProfileForm';
type PlatformLinkInput = CreatorProfileForm['platformLinks'][number];
import type { CreatorPlatformLink } from './database/types';
import { serializeCreatorClipBuildDefaults } from '@/lib/creatorClipBuildDefaults';
export { createOrganizationCreatorProfile, updateOrganizationCreatorProfile, apiAddPlatformLink, apiDeletePlatformLink, listOrganizationAssets, uploadOrganizationAsset, getAllIntroOutros, getAllWatermarkImages, extractMintId, searchPumpFunTokens, fetchTokenMetadataFromServer, extractChannelSlug, checkKickLivestream, extractChannelName, checkTwitchLivestream, extractYouTubeChannel, getYouTubeChannelInfo, extractRumbleChannel, getRumbleChannelInfo, readFile, useAssetOperations, useWatermarkOperations };
export { useAuthStore } from '@/stores/auth';
export { useSubscription } from '@/composables/useSubscription';
export { invoke, convertFileSrc } from '@tauri-apps/api/core';
export { open as openFileDialog } from '@tauri-apps/plugin-dialog';
export { listen } from '@tauri-apps/api/event';
export { createIntroOutro, generateId } from './database';
export { getAllCreatorProfiles } from './database';
export { submitPersonalExternalPost, submitExternalPost } from './schedulingApi';
export { getUserAssignedCreatorProfiles } from './organizationProfilesApi';
export { resolveOverlayImagePath } from './database/watermarks';
function platformInputToDb(platform: string): CreatorPlatformLink['platform'] { return (platform === 'youtube' ? 'YouTube' : platform) as CreatorPlatformLink['platform']; }
export async function saveLocalCreator(form: CreatorProfileForm, creator: CreatorProfileWithLinks | null, hasDefaults: boolean) {
    const validLinks = form.platformLinks.filter((l) => l.platform_id.trim());

    // Find the first existing profile image to reuse for all links
    const firstProfileImage = validLinks.find((l) => l.profile_image_url)?.profile_image_url;

    // Normalize platform IDs and handle profile images
    for (const link of validLinks) {
      if (link.platform === 'pumpfun') {
        const mintId = extractMintId(link.platform_id.trim());
        if (mintId) {
          link.platform_id = mintId;
        }
        if (!link.profile_image_url && firstProfileImage) {
          link.profile_image_url = firstProfileImage;
        }
      } else if (link.platform === 'kick') {
        const slug = extractChannelSlug(link.platform_id.trim());
        if (slug) {
          link.platform_id = slug;
        }
      }
    }

    // Helper to process a single link (create or update)
    const processLink = async (creatorId: string, link: PlatformLinkInput) => {
      let monitoredStreamerId: string | null = null;

      // Resolve monitored streamer for supported platforms
      if (link.platform === 'pumpfun' || link.platform === 'kick' || link.platform === 'twitch' || link.platform === 'youtube' || link.platform === 'rumble') {
        try {
          const existing = await getMonitoredStreamerByMint(link.platform_id.trim());
          if (existing) {
            monitoredStreamerId = existing.id;
          } else {
            monitoredStreamerId = await createMonitoredStreamer(
              link.platform_id.trim(),
              link.display_name.trim() || form.name.trim(),
              link.profile_image_url || undefined,
              5, // segment duration
              form.auto_dvr_enabled,
              platformInputToDb(link.platform)
            );
          }
        } catch (err) {
          console.warn('[ProfileDialog] Failed to resolve monitored_streamer:', err);
        }
      }

      if (link.id && !link.isNew) {
        // Update existing link
        await dbUpdatePlatformLink(String(link.id), {
          platform: platformInputToDb(link.platform),
          platform_id: link.platform_id.trim(),
          display_name: link.display_name.trim() || null,
          profile_image_url: link.profile_image_url || null,
          monitored_streamer_id: monitoredStreamerId,
          is_primary: link.is_primary,
        });
      } else {
        // Create new link
        await dbAddPlatformLink(
          creatorId,
          platformInputToDb(link.platform),
          link.platform_id.trim(),
          link.display_name.trim() || null,
          link.profile_image_url || null,
          monitoredStreamerId,
          link.is_primary
        );
      }
    };

    if (creator) {
      // Update existing creator
      await updateCreatorProfile(creator.id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        intro_id: form.intro_id as string | null,
        outro_id: form.outro_id as string | null,
        watermark_id: form.watermark_id as string | null,
        watermark_settings: form.watermark_settings
          ? JSON.stringify(form.watermark_settings)
          : null,
        intro_outro_settings: form.intro_outro_settings,
        intro_ratio_settings: form.intro_ratio_settings,
        outro_ratio_settings: form.outro_ratio_settings,
        auto_dvr_enabled: form.auto_dvr_enabled ? 1 : 0,
        layout_overlays: form.layout_overlays.length > 0
          ? JSON.stringify(form.layout_overlays)
          : null,
        clip_build_defaults: hasDefaults
          ? serializeCreatorClipBuildDefaults(form.clip_build_defaults)
          : null,
      });

      // Delete removed links
      const formIds = new Set(validLinks.filter((l) => l.id && !l.isNew).map((l) => String(l.id)));
      for (const link of creator.platform_links) {
        if (!formIds.has(link.id)) {
          await dbDeletePlatformLink(link.id);
        }
      }

      // Process all links (add or update)
      for (const link of validLinks) {
        await processLink(creator.id, link);
      }


    } else {
      // Create new creator
      const creatorId = await createCreatorProfile(
        form.name.trim(),
        form.description.trim() || null,
        null, // profile_image_path
        form.intro_id as string | null,
        form.outro_id as string | null,
        form.watermark_id as string | null,
        form.watermark_settings ? JSON.stringify(form.watermark_settings) : null,
        form.intro_outro_settings,
        form.auto_dvr_enabled,
        form.intro_ratio_settings,
        form.outro_ratio_settings,
        form.scope,
        form.layout_overlays.length > 0
          ? JSON.stringify(form.layout_overlays)
          : null,
        hasDefaults
          ? serializeCreatorClipBuildDefaults(form.clip_build_defaults)
          : null
      );

      // Add platform links
      for (const link of validLinks) {
        await processLink(creatorId, link);
      }


    }

    // Notify other components (like LiveClip.vue) about the new/updated monitoring data
    window.dispatchEvent(new CustomEvent('monitored-streamers-updated'));


  }
