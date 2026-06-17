export const EXPORT_QUALITY_VALUES = [
	"low",
	"medium",
	"high",
	"very_high",
] as const;

export const EXPORT_FORMAT_VALUES = ["mp4", "webm"] as const;

export type ExportFormat = (typeof EXPORT_FORMAT_VALUES)[number];
export type ExportQuality = (typeof EXPORT_QUALITY_VALUES)[number];

export interface ExportOptions {
	format: ExportFormat;
	quality: ExportQuality;
	fps?: number;
	includeAudio?: boolean;
	canvasSize?: { width: number; height: number };
	timeRange?: { startTime: number; endTime: number };
	/** When set (e.g. segment export), used as the base output file name instead of the project name. */
	outputFileName?: string;
	onProgress?: ({ progress }: { progress: number }) => void;
	onCancel?: () => boolean;
	exportId?: string;
}

export interface ExportResult {
	success: boolean;
	buffer?: ArrayBuffer;
	outputPath?: string;
	error?: string;
	cancelled?: boolean;
}
