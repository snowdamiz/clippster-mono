import type { CreatorProfileWithLinks } from '@/services/database/types';
import type { Campaign } from '@/services/campaignApi';
import type { PlatformId } from '@/config/platforms';

  // Extended type that can represent both local and org profiles
export interface DisplayCreatorProfile extends CreatorProfileWithLinks {
    isOrgProfile?: boolean;
    server_id?: number;
    disabled?: boolean;
    isGlobalBranding?: boolean;
  }

  // Grouped campaign display with all creators
export interface DisplayCampaign {
    id: number;
    title: string;
    organization_id: number;
    organization_name: string;
    cover_image_url?: string;
    isGlobalBranding: boolean;
    branding_profile_id: number | null;
    creators: DisplayCreatorProfile[];
    uniquePlatforms: PlatformId[];
    hasIntro: boolean;
    hasOutro: boolean;
    hasWatermark: boolean;
    created_at: number;
    updated_at: number;
  }

export function convertCampaignsToGroupedDisplay(campaignsList: Campaign[]): DisplayCampaign[] {
    const displayCampaigns: DisplayCampaign[] = [];
    
    for (const campaign of campaignsList) {
      const isGlobalBrandingCampaign = campaign.creator_profile_id === null && campaign.branding_profile_id !== null;
      
      const campaignProfiles = campaign.creator_profiles || [];
      if (campaignProfiles.length === 0 && campaign.creator_profile) {
        campaignProfiles.push(campaign.creator_profile);
      }

      // Convert creator profiles to DisplayCreatorProfile format
      const creators: DisplayCreatorProfile[] = campaignProfiles.map((cp) => ({
        id: `campaign-${campaign.id}-${cp.id}`,
        name: cp.name,
        description: cp.description ?? null,
        profile_image_path: cp.profile_image_url ?? null,
        intro_id: cp.intro?.id ? `org-asset-${cp.intro.id}` : null,
        outro_id: cp.outro?.id ? `org-asset-${cp.outro.id}` : null,
        watermark_id: cp.watermark?.id ? `org-asset-${cp.watermark.id}` : null,
        watermark_settings: cp.watermark_settings ? JSON.stringify(cp.watermark_settings) : null,
        layout_overlays: null,
        intro_outro_settings: null,
        intro_ratio_settings: null,
        outro_ratio_settings: null,
        created_at: new Date(campaign.inserted_at).getTime(),
        updated_at: new Date(campaign.updated_at).getTime(),
        user_id: null,
        platform_links: (cp.platform_links || []).map((link) => ({
          id: `campaign-link-${campaign.id}-${link.id}`,
          creator_profile_id: `campaign-${campaign.id}-${cp.id}`,
          platform: link.platform as PlatformId,
          platform_id: link.platform_id,
          display_name: link.display_name ?? null,
          profile_image_url: link.profile_image_url ?? null,
          is_primary: link.is_primary,
          created_at: Date.now(),
          monitored_streamer_id: null,
        })),
        scope: 'streamer',
        isOrgProfile: true,
        organization_id: campaign.organization_id,
        organization_name: campaign.organization?.name ?? `Campaign ${campaign.id}`,
        campaign_id: campaign.id,
        campaign_title: campaign.title,
        server_id: cp.id,
        context_type: 'campaign',
        disabled: false,
      }));

      // Get unique platforms across all creators
      const platformSet = new Set<PlatformId>();
      creators.forEach(creator => {
        creator.platform_links.forEach(link => platformSet.add(link.platform));
      });

      // Check if campaign has branding
      // For global branding campaigns, assume branding exists if branding_profile_id is set
      // For regular campaigns, check if any creator has branding
      let hasIntro = false;
      let hasOutro = false;
      let hasWatermark = false;

      if (isGlobalBrandingCampaign && campaign.branding_profile_id) {
        // Global branding - assume all branding is configured if branding_profile_id exists
        hasIntro = true;
        hasOutro = true;
        hasWatermark = true;
      } else {
        // Regular campaign - check individual creators
        hasIntro = creators.some(c => c.intro_id !== null);
        hasOutro = creators.some(c => c.outro_id !== null);
        hasWatermark = creators.some(c => c.watermark_id !== null);
      }

      displayCampaigns.push({
        id: campaign.id,
        title: campaign.title,
        organization_id: campaign.organization_id,
        organization_name: campaign.organization?.name ?? `Campaign ${campaign.id}`,
        cover_image_url: campaign.cover_image_url ?? undefined,
        isGlobalBranding: isGlobalBrandingCampaign,
        branding_profile_id: campaign.branding_profile_id,
        creators,
        uniquePlatforms: Array.from(platformSet),
        hasIntro,
        hasOutro,
        hasWatermark,
        created_at: new Date(campaign.inserted_at).getTime(),
        updated_at: new Date(campaign.updated_at).getTime(),
      });
    }

    return displayCampaigns;
  }
