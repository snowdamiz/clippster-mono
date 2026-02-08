export type SocialPlatform =
	| "tiktok"
	| "instagram-reels"
	| "instagram-story"
	| "youtube-shorts"
	| "instagram-feed"
	| "youtube-landscape"
	| "twitter";

export interface SafeZone {
	/** Fraction from top (0-1) */
	top: number;
	/** Fraction from bottom (0-1) */
	bottom: number;
	/** Fraction from left (0-1) */
	left: number;
	/** Fraction from right (0-1) */
	right: number;
}

export interface SocialOverlayPreset {
	platform: SocialPlatform;
	label: string;
	icon: string;
	aspectRatio: string;
	/** Safe zone where UI elements typically appear */
	uiZones: {
		label: string;
		top: number;
		left: number;
		width: number;
		height: number;
		color: string;
	}[];
	/** Content safe area (where important content should be) */
	safeZone: SafeZone;
}
