import type { SocialOverlayPreset } from "../types/social-overlays";

export const SOCIAL_OVERLAY_PRESETS: SocialOverlayPreset[] = [
	{
		platform: "tiktok",
		label: "TikTok",
		icon: "📱",
		aspectRatio: "9:16",
		safeZone: { top: 0.12, bottom: 0.18, left: 0.05, right: 0.15 },
		uiZones: [
			{ label: "Username", top: 0.82, left: 0.02, width: 0.55, height: 0.04, color: "rgba(255,255,255,0.3)" },
			{ label: "Caption", top: 0.86, left: 0.02, width: 0.7, height: 0.06, color: "rgba(255,255,255,0.2)" },
			{ label: "Actions", top: 0.45, left: 0.88, width: 0.1, height: 0.4, color: "rgba(255,0,100,0.25)" },
			{ label: "Music", top: 0.93, left: 0.02, width: 0.8, height: 0.03, color: "rgba(255,255,255,0.15)" },
		],
	},
	{
		platform: "instagram-reels",
		label: "Instagram Reels",
		icon: "📸",
		aspectRatio: "9:16",
		safeZone: { top: 0.1, bottom: 0.2, left: 0.05, right: 0.15 },
		uiZones: [
			{ label: "Username", top: 0.83, left: 0.02, width: 0.5, height: 0.03, color: "rgba(255,255,255,0.3)" },
			{ label: "Caption", top: 0.86, left: 0.02, width: 0.75, height: 0.06, color: "rgba(255,255,255,0.2)" },
			{ label: "Actions", top: 0.5, left: 0.9, width: 0.08, height: 0.35, color: "rgba(225,48,108,0.25)" },
			{ label: "Audio", top: 0.93, left: 0.02, width: 0.7, height: 0.03, color: "rgba(255,255,255,0.15)" },
		],
	},
	{
		platform: "youtube-shorts",
		label: "YouTube Shorts",
		icon: "▶️",
		aspectRatio: "9:16",
		safeZone: { top: 0.08, bottom: 0.2, left: 0.05, right: 0.12 },
		uiZones: [
			{ label: "Title", top: 0.85, left: 0.02, width: 0.7, height: 0.04, color: "rgba(255,255,255,0.3)" },
			{ label: "Channel", top: 0.89, left: 0.02, width: 0.5, height: 0.03, color: "rgba(255,255,255,0.2)" },
			{ label: "Actions", top: 0.55, left: 0.9, width: 0.08, height: 0.3, color: "rgba(255,0,0,0.25)" },
			{ label: "Subscribe", top: 0.92, left: 0.02, width: 0.3, height: 0.04, color: "rgba(255,0,0,0.2)" },
		],
	},
];

export function getSocialOverlayPreset(platform: string): SocialOverlayPreset | undefined {
	return SOCIAL_OVERLAY_PRESETS.find((p) => p.platform === platform);
}
