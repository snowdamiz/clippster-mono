import type { ManualFramingConfig, ManualFramingConfigs } from "@/types";

export function isManualFramingConfigConfigured(
	config: ManualFramingConfig | null | undefined,
): boolean {
	return Boolean(
		config &&
			(config.regions.length > 0 ||
				config.segmentConfigs?.some((segment) => segment.regions.length > 0) ||
				config.brollConfigs?.length ||
				(config.sourceFrameMode && config.sourceFrameMode !== "none")),
	);
}

export function getConfiguredFramingConfigs(
	ratios: string[],
	configs: ManualFramingConfigs,
): Record<string, ManualFramingConfig> {
	return Object.fromEntries(
		ratios.map((ratio) => {
			const config = configs[ratio as keyof ManualFramingConfigs];
			if (!config || !isManualFramingConfigConfigured(config)) {
				throw new Error(`Missing manual framing configuration for ${ratio}`);
			}
			return [ratio, config];
		}),
	);
}

export function pairExportVariants(
	ratios: string[],
	paths: string[],
): Array<{ ratio: string; path: string }> {
	return ratios.flatMap((ratio, index) => {
		const path = paths[index];
		return path ? [{ ratio, path }] : [];
	});
}
