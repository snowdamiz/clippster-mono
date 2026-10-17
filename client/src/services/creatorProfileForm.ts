import type { CreatorClipBuildDefaults, LayoutOverlay } from '@/types';
import type { CreatorWatermarkSettings } from '@/components/WatermarkPositionPicker.vue';
type PlatformId = 'pumpfun' | 'kick' | 'twitch' | 'youtube' | 'rumble';
export interface PlatformLinkInput { platform: PlatformId; platform_id: string; display_name: string; profile_image_url?: string; is_primary: boolean; id?: number | string; isNew?: boolean; monitored_streamer_id?: string | null }
export type CreatorProfileForm = {
    name: string;
    description: string;
    intro_id: number | string | null;
    outro_id: number | string | null;
    watermark_id: number | string | null;
    watermark_settings: CreatorWatermarkSettings | null;
    intro_outro_settings: string | null;
    intro_ratio_settings: string | null;
    outro_ratio_settings: string | null;
    layout_overlays: LayoutOverlay[];
    platformLinks: PlatformLinkInput[];
    auto_dvr_enabled: boolean;
    scope: 'streamer' | 'global' | 'personal_studio';
    clip_build_defaults: CreatorClipBuildDefaults;
  };
