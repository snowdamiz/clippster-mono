/**
 * Singleton composable for managing branding configuration per aspect ratio.
 * Holds watermark, intro, and outro settings that can be auto-populated
 * from a creator profile or manually configured.
 */

import { ref, computed, type Ref, type ComputedRef } from "vue";
import type { CreatorProfileWithLinks } from "@/services/database/types";
import type {
	AspectRatioId,
	BrandingConfig,
	BrandingWatermarkConfig,
	BrandingIntroOutroConfig,
} from "../types/project";

export const ASPECT_RATIOS: AspectRatioId[] = ["16:9", "9:16", "1:1", "4:5"];

const ASPECT_RATIO_DIMENSIONS: Record<AspectRatioId, { width: number; height: number }> = {
	"16:9": { width: 1920, height: 1080 },
	"9:16": { width: 1080, height: 1920 },
	"1:1": { width: 1080, height: 1080 },
	"4:5": { width: 1080, height: 1350 },
};

function emptyBrandingConfig(): BrandingConfig {
	return {
		creatorProfileId: null,
		watermarks: { "16:9": null, "9:16": null, "1:1": null, "4:5": null },
		intros: { "16:9": null, "9:16": null, "1:1": null, "4:5": null },
		outros: { "16:9": null, "9:16": null, "1:1": null, "4:5": null },
	};
}

function detectAspectRatio(width: number, height: number): AspectRatioId | null {
	for (const [id, dims] of Object.entries(ASPECT_RATIO_DIMENSIONS)) {
		if (dims.width === width && dims.height === height) return id as AspectRatioId;
	}
	return null;
}

// Singleton state
const creatorProfile = ref<CreatorProfileWithLinks | null>(null);
const config = ref<BrandingConfig>(emptyBrandingConfig());

const isReadOnly: ComputedRef<boolean> = computed(() => creatorProfile.value !== null);

function setWatermarkForRatio(ratio: AspectRatioId, watermark: BrandingWatermarkConfig | null): void {
	if (isReadOnly.value) return;
	config.value = {
		...config.value,
		watermarks: { ...config.value.watermarks, [ratio]: watermark },
	};
}

function setIntroForRatio(ratio: AspectRatioId, intro: BrandingIntroOutroConfig | null): void {
	if (isReadOnly.value) return;
	config.value = {
		...config.value,
		intros: { ...config.value.intros, [ratio]: intro },
	};
}

function setOutroForRatio(ratio: AspectRatioId, outro: BrandingIntroOutroConfig | null): void {
	if (isReadOnly.value) return;
	config.value = {
		...config.value,
		outros: { ...config.value.outros, [ratio]: outro },
	};
}

function getActiveWatermark(ratio: AspectRatioId): BrandingWatermarkConfig | null {
	return config.value.watermarks[ratio] ?? null;
}

function getActiveIntro(ratio: AspectRatioId): BrandingIntroOutroConfig | null {
	return config.value.intros[ratio] ?? null;
}

function getActiveOutro(ratio: AspectRatioId): BrandingIntroOutroConfig | null {
	return config.value.outros[ratio] ?? null;
}

function getWatermarkForCanvasSize(width: number, height: number): BrandingWatermarkConfig | null {
	const ratio = detectAspectRatio(width, height);
	if (!ratio) return null;
	return getActiveWatermark(ratio);
}

/**
 * Initialize branding config from a creator profile.
 * Parses the profile's watermark_settings, intro_ratio_settings, and outro_ratio_settings.
 */
function initFromCreatorProfile(profile: CreatorProfileWithLinks): void {
	creatorProfile.value = profile;

	const newConfig = emptyBrandingConfig();
	newConfig.creatorProfileId = profile.id;

	// Parse watermark settings
	if (profile.watermark_settings) {
		try {
			const wmSettings = typeof profile.watermark_settings === "string"
				? JSON.parse(profile.watermark_settings)
				: profile.watermark_settings;

			for (const ratio of ASPECT_RATIOS) {
				const ratioConfig = wmSettings[ratio];
				if (ratioConfig && ratioConfig.position) {
					newConfig.watermarks[ratio] = {
						watermarkId: ratioConfig.watermarkId ?? profile.watermark_id ?? null,
						position: ratioConfig.position,
					};
				} else if (ratioConfig && ratioConfig.x !== undefined) {
					// Old format: position values directly on the config
					newConfig.watermarks[ratio] = {
						watermarkId: profile.watermark_id ?? null,
						position: {
							x: ratioConfig.x,
							y: ratioConfig.y,
							opacity: ratioConfig.opacity,
							scale: ratioConfig.scale,
							isFullFrameOverlay: ratioConfig.isFullFrameOverlay,
						},
					};
				}
			}
		} catch (e) {
			console.warn("[useBrandingConfig] Failed to parse watermark_settings:", e);
		}
	}

	// Parse intro ratio settings
	if (profile.intro_ratio_settings) {
		try {
			const introSettings = typeof profile.intro_ratio_settings === "string"
				? JSON.parse(profile.intro_ratio_settings)
				: profile.intro_ratio_settings;

			for (const ratio of ASPECT_RATIOS) {
				const ratioConfig = introSettings[ratio];
				if (ratioConfig && ratioConfig.assetId) {
					newConfig.intros[ratio] = {
						assetId: ratioConfig.assetId,
						filePath: ratioConfig.filePath,
						duration: ratioConfig.duration,
					};
				}
			}
		} catch (e) {
			console.warn("[useBrandingConfig] Failed to parse intro_ratio_settings:", e);
		}
	}

	// Parse outro ratio settings
	if (profile.outro_ratio_settings) {
		try {
			const outroSettings = typeof profile.outro_ratio_settings === "string"
				? JSON.parse(profile.outro_ratio_settings)
				: profile.outro_ratio_settings;

			for (const ratio of ASPECT_RATIOS) {
				const ratioConfig = outroSettings[ratio];
				if (ratioConfig && ratioConfig.assetId) {
					newConfig.outros[ratio] = {
						assetId: ratioConfig.assetId,
						filePath: ratioConfig.filePath,
						duration: ratioConfig.duration,
					};
				}
			}
		} catch (e) {
			console.warn("[useBrandingConfig] Failed to parse outro_ratio_settings:", e);
		}
	}

	config.value = newConfig;
}

/**
 * Initialize from a saved branding config (no creator profile).
 */
function initFromSavedConfig(saved: BrandingConfig): void {
	creatorProfile.value = null;
	config.value = saved;
}

/**
 * Reset to empty state.
 */
function reset(): void {
	creatorProfile.value = null;
	config.value = emptyBrandingConfig();
}

export function useBrandingConfig(): {
	creatorProfile: Ref<CreatorProfileWithLinks | null>;
	isReadOnly: ComputedRef<boolean>;
	config: Ref<BrandingConfig>;
	setWatermarkForRatio: (ratio: AspectRatioId, watermark: BrandingWatermarkConfig | null) => void;
	setIntroForRatio: (ratio: AspectRatioId, intro: BrandingIntroOutroConfig | null) => void;
	setOutroForRatio: (ratio: AspectRatioId, outro: BrandingIntroOutroConfig | null) => void;
	getActiveWatermark: (ratio: AspectRatioId) => BrandingWatermarkConfig | null;
	getActiveIntro: (ratio: AspectRatioId) => BrandingIntroOutroConfig | null;
	getActiveOutro: (ratio: AspectRatioId) => BrandingIntroOutroConfig | null;
	getWatermarkForCanvasSize: (width: number, height: number) => BrandingWatermarkConfig | null;
	initFromCreatorProfile: (profile: CreatorProfileWithLinks) => void;
	initFromSavedConfig: (saved: BrandingConfig) => void;
	reset: () => void;
	ASPECT_RATIOS: AspectRatioId[];
} {
	return {
		creatorProfile,
		isReadOnly,
		config,
		setWatermarkForRatio,
		setIntroForRatio,
		setOutroForRatio,
		getActiveWatermark,
		getActiveIntro,
		getActiveOutro,
		getWatermarkForCanvasSize,
		initFromCreatorProfile,
		initFromSavedConfig,
		reset,
		ASPECT_RATIOS,
	};
}
