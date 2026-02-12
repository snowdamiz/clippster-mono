import type { TScene } from "./timeline";

export type AspectRatioId = "16:9" | "9:16" | "1:1" | "4:5";

export interface BrandingWatermarkConfig {
	watermarkId: string | null;
	position: {
		x: number;
		y: number;
		opacity: number;
		scale: number;
		isFullFrameOverlay?: boolean;
	} | null;
}

export interface BrandingIntroOutroConfig {
	assetId: string;
	filePath?: string;
	duration?: number;
}

export interface BrandingOverlayConfig {
	id: string;
	imagePath: string;
	x: number;
	y: number;
	scale: number;
	opacity: number;
	rotation: number;
	isFullFrameOverlay?: boolean;
	label?: string;
}

export interface BrandingConfig {
	creatorProfileId?: string | null;
	watermarks: Record<string, BrandingWatermarkConfig | null>;
	intros: Record<string, BrandingIntroOutroConfig | null>;
	outros: Record<string, BrandingIntroOutroConfig | null>;
	layoutOverlays: Record<string, BrandingOverlayConfig[] | null>;
}

export type TBackground =
	| {
			type: "color";
			color: string;
	  }
	| {
			type: "blur";
			blurIntensity: number;
	  };

export interface TCanvasSize {
	width: number;
	height: number;
}

export interface TProjectMetadata {
	id: string;
	name: string;
	thumbnail?: string;
	duration: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface TProjectSettings {
	fps: number;
	canvasSize: TCanvasSize;
	originalCanvasSize?: TCanvasSize | null;
	background: TBackground;
	brandingConfig?: BrandingConfig;
}

export interface TTimelineViewState {
	zoomLevel: number;
	scrollLeft: number;
	playheadTime: number;
}

export interface TProject {
	metadata: TProjectMetadata;
	scenes: TScene[];
	currentSceneId: string;
	settings: TProjectSettings;
	version: number;
	timelineViewState?: TTimelineViewState;
	coverTimestamp?: number;
}

export type TProjectSortKey = "createdAt" | "updatedAt" | "name" | "duration";
export type TSortOrder = "asc" | "desc";
export type TProjectSortOption = `${TProjectSortKey}-${TSortOrder}`;
