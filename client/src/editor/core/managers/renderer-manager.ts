import { invoke } from "@tauri-apps/api/core";
import type { EditorCore } from "../../core";
import type { RootNode } from "../../renderer/nodes/root-node";
import type { CanvasRenderer } from "../../renderer/canvas-renderer";
import {
	getPreviewSceneTreeCached,
	invalidatePreviewSceneCache as resetPreviewSceneCache,
	type PreviewSceneCache,
	type PreviewSceneInputs,
} from "../../renderer/preview-scene-sync";
import {
	previewPerfBeginFrame,
	previewPerfEndFrame,
	previewPerfMarkRenderToCanvas,
} from "../../lib/preview-performance";
import { setGpuPreviewEffectsEnabled as setGlobalGpuPreviewEffects } from "../../renderer/effects/preview-gpu-config";
import { invalidateAllLayerPrecomps } from "../../renderer/layer-precomp-cache";
import type { ExportOptions, ExportResult } from "../../types/export";
import type {
	TimelineTrack,
	VideoTrack,
	VideoElement,
	ImageElement,
	TextElement,
	AudioElement,
	StickerElement,
	EffectElement,
	CaptionElement,
	CaptionHighlightStyle,
	MaskShape,
} from "../../types/timeline";
import type { MediaAsset } from "../../types/assets";
import type { VideoEffect } from "../../types/effects";
import type { ElementAnimation } from "../../types/animations";
import type { ElementKeyframes } from "../../types/keyframes";
import type { AspectRatioId, TBackground } from "../../types/project";
import { TextNode } from "../../renderer/nodes/text-node";
import type { TextNodeParams } from "../../renderer/nodes/text-node";
import { StickerNode } from "../../renderer/nodes/sticker-node";
import type { StickerNodeParams } from "../../renderer/nodes/sticker-node";
import { CaptionNode } from "../../renderer/nodes/caption-node";
import type { CaptionNodeParams } from "../../renderer/nodes/caption-node";
import { useBrandingConfig } from "../../composables/useBrandingConfig";
import { resolveWatermarkById, resolveOverlayImagePath } from "@/services/database/watermarks";
import { resolveIntroOutroById } from "@/services/database/intro-outros";
import { base64ToUtf8 } from "@/utils/encoding";
import { resolveTransitionMediaPair } from "../../lib/timeline/transition-pairing";
import { isMainTrack } from "../../lib/timeline/track-utils";
import { getSceneTracksForExport, writeSceneFrameSequenceToDisk } from "../../renderer/scene-frame-export";
import { canUseFastVideoExport } from "../../renderer/export-routing";

/** True if any two [start,end) segments overlap (for FFmpeg layer compositing). */
function videoSegmentsOverlap(segments: { start: number; end: number }[]): boolean {
	for (let i = 0; i < segments.length; i++) {
		for (let j = i + 1; j < segments.length; j++) {
			if (segments[i].start < segments[j].end && segments[j].start < segments[i].end) {
				return true;
			}
		}
	}
	return false;
}

export function requiresSceneFrameExport({
	tracks,
	sceneTransitions,
	canvasSourceFraming,
	background,
}: {
	tracks: TimelineTrack[];
	sceneTransitions: import("../../types/transitions").Transition[];
	canvasSourceFraming: unknown;
	background: TBackground;
}): boolean {
	return !canUseFastVideoExport({
		tracks,
		sceneTransitions,
		canvasSourceFraming,
		background,
	});
}

interface TauriAnimationData {
	anim_type: string;
	duration: number;
	easing: string;
}

interface TauriVideoSource {
	source_path: string;
	start_time: number;
	end_time: number;
	trim_start: number | null;
	trim_end: number | null;
	opacity: number;
	scale: number;
	position_x: number;
	position_y: number;
	rotation: number;
	is_muted: boolean;
	volume: number;
	speed: number;
	fade_in: number;
	fade_out: number;
	flip_horizontal: boolean;
	flip_vertical: boolean;
	crop_top: number;
	crop_right: number;
	crop_bottom: number;
	crop_left: number;
	brightness: number;
	contrast: number;
	saturation: number;
	temperature: number;
	highlights: number;
	shadows: number;
	exposure: number;
	fade: number;
	tint: string;
	sharpness: number;
	effects: TauriVideoEffect[];
	is_image: boolean;
	is_reversed: boolean;
	animation_in: TauriAnimationData | null;
	animation_out: TauriAnimationData | null;
	animation_loop: TauriAnimationData | null;
	keyframes: TauriKeyframeTrack[] | null;
	// Phase 3: Color grading
	color_curves_master: [number, number][] | null;
	color_curves_red: [number, number][] | null;
	color_curves_green: [number, number][] | null;
	color_curves_blue: [number, number][] | null;
	color_wheels_shadows_hue: number | null;
	color_wheels_shadows_saturation: number | null;
	color_wheels_shadows_luminance: number | null;
	color_wheels_midtones_hue: number | null;
	color_wheels_midtones_saturation: number | null;
	color_wheels_midtones_luminance: number | null;
	color_wheels_highlights_hue: number | null;
	color_wheels_highlights_saturation: number | null;
	color_wheels_highlights_luminance: number | null;
	lut_path: string | null;
	// Phase 5: Audio pan
	pan: number | null;
	// Phase 8: Blend mode
	blend_mode: string | null;
	/** Main video track = bottom layer when compositing overlapping clips */
	track_is_main: boolean;
	order_index: number;
	chromakey: TauriChromakeySettings | null;
	masks?: TauriSerializedMask[] | null;
}

interface TauriSerializedMask {
	id?: string;
	mask_type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	feather: number;
	invert: boolean;
	rotation: number;
	corner_radius?: number;
	points?: { x: number; y: number }[] | null;
}

interface TauriChromakeySettings {
	enabled: boolean;
	color: string;
	similarity: number;
	smoothness: number;
	spill_reduction: number;
}

interface TauriKeyframe {
	offset: number;
	value: number;
	interpolation: string;
}

interface TauriKeyframeTrack {
	property: string;
	keyframes: TauriKeyframe[];
}

interface TauriVideoEffect {
	effect_type: string;
	enabled: boolean;
	intensity: number;
	params: Record<string, number | string>;
}

interface TauriAudioEffect {
	effect_type: string;
	params: Record<string, number | string>;
}

interface TauriAudioTrack {
	file_path: string;
	start_time: number;
	end_time: number;
	trim_start: number;
	volume: number;
	is_muted: boolean;
	speed: number;
	fade_in: number;
	fade_out: number;
	audio_effects: TauriAudioEffect[] | null;
	pan: number | null;
}

interface TauriTextOverlay {
	image_path: string;
	start_time: number;
	end_time: number;
	animation_in: TauriAnimationData | null;
	animation_out: TauriAnimationData | null;
	animation_loop: TauriAnimationData | null;
	is_frame_sequence?: boolean;
	sequence_frame_count?: number;
}

interface TauriStickerOverlay {
	image_path: string;
	start_time: number;
	end_time: number;
	animation_in: TauriAnimationData | null;
	animation_out: TauriAnimationData | null;
	animation_loop: TauriAnimationData | null;
	is_frame_sequence?: boolean;
	sequence_frame_count?: number;
}

interface TauriEffectOverlay {
	effect_type: string;
	enabled: boolean;
	intensity: number;
	params: Record<string, number | string>;
	start_time: number;
	end_time: number;
}

interface TauriBrandingWatermark {
	image_path: string;
	x: number;
	y: number;
	scale: number;
	opacity: number;
	is_full_frame: boolean;
}

interface TauriBrandingOverlay {
	image_path: string;
	x: number;
	y: number;
	scale: number;
	opacity: number;
	rotation: number;
	is_full_frame: boolean;
}

interface TauriTransitionData {
	transition_type: string;
	duration: number;
	target_element_index: number;
	junction_time: number;
}

interface TauriExportConfig {
	video_sources: TauriVideoSource[];
	audio_tracks: TauriAudioTrack[];
	text_overlays: TauriTextOverlay[];
	sticker_overlays: TauriStickerOverlay[];
	effect_overlays: TauriEffectOverlay[];
	transitions: TauriTransitionData[] | null;
	output_path: string;
	total_duration: number;
	fps: number;
	width: number;
	height: number;
	cover_timestamp: number | null;
	branding_watermark: TauriBrandingWatermark | null;
	branding_overlays: TauriBrandingOverlay[] | null;
	intro_path: string | null;
	intro_duration: number | null;
	outro_path: string | null;
	outro_duration: number | null;
	export_id?: string | null;
	scene_frame_pattern?: string | null;
	scene_frame_count?: number | null;
	export_format?: string;
	export_quality?: string;
	include_audio?: boolean;
}

interface BrandingExportData {
	watermark: TauriBrandingWatermark | null;
	overlays: TauriBrandingOverlay[] | null;
	introPath: string | null;
	introDuration: number | null;
	outroPath: string | null;
	outroDuration: number | null;
}

type ExportTimeRange = NonNullable<ExportOptions["timeRange"]>;

function normalizeExportTimeRange(
	timeRange: ExportOptions["timeRange"],
	fullDuration: number,
): ExportTimeRange | null {
	if (!timeRange) return null;
	const startTime = Math.max(0, Math.min(timeRange.startTime, fullDuration));
	const endTime = Math.max(0, Math.min(timeRange.endTime, fullDuration));
	if (endTime <= startTime) return null;
	return { startTime, endTime };
}

function getClippedTimelineSpan(
	startTime: number,
	endTime: number,
	timeRange: ExportTimeRange | null,
	speed = 1,
): { startTime: number; endTime: number; sourceOffset: number; sourceEndOffset: number } | null {
	if (!timeRange) {
		return { startTime, endTime, sourceOffset: 0, sourceEndOffset: 0 };
	}

	const clippedStart = Math.max(startTime, timeRange.startTime);
	const clippedEnd = Math.min(endTime, timeRange.endTime);
	if (clippedEnd <= clippedStart) return null;

	return {
		startTime: clippedStart - timeRange.startTime,
		endTime: clippedEnd - timeRange.startTime,
		sourceOffset: (clippedStart - startTime) * speed,
		sourceEndOffset: (endTime - clippedEnd) * speed,
	};
}

function clipOverlaySpan<T extends { start_time: number; end_time: number }>(
	overlay: T,
	timeRange: ExportTimeRange | null,
): T | null {
	const clip = getClippedTimelineSpan(overlay.start_time, overlay.end_time, timeRange);
	if (!clip) return null;
	return {
		...overlay,
		start_time: clip.startTime,
		end_time: clip.endTime,
	};
}

export class RendererManager {
	private renderTree: RootNode | null = null;
	private listeners = new Set<() => void>();
	private previewSceneCache: PreviewSceneCache = { fingerprint: null, tree: null };

	constructor(private editor: EditorCore) {}

	setRenderTree({ renderTree }: { renderTree: RootNode | null }): void {
		this.renderTree = renderTree;
		this.notify();
	}

	getRenderTree(): RootNode | null {
		return this.renderTree;
	}

	/**
	 * Builds (or reuses cached) scene tree from panel inputs; updates render tree.
	 * Skips expensive buildScene when fingerprint matches.
	 */
	syncPreviewRenderTreeFromInputs(inputs: PreviewSceneInputs): { buildMs: number; cacheHit: boolean } {
		const { tree, buildMs, cacheHit } = getPreviewSceneTreeCached(this.previewSceneCache, inputs);
		if (cacheHit && this.renderTree === tree) {
			return { buildMs, cacheHit: true };
		}
		this.setRenderTree({ renderTree: tree });
		return { buildMs, cacheHit };
	}

	invalidatePreviewSceneCache(): void {
		resetPreviewSceneCache(this.previewSceneCache);
		invalidateAllLayerPrecomps();
	}

	/** Instrumented preview paint (Canvas 2D → display canvas). */
	async renderPreviewToTarget({
		renderer,
		time,
		targetCanvas,
		renderTree,
		signal,
	}: {
		renderer: CanvasRenderer;
		time: number;
		targetCanvas: HTMLCanvasElement;
		renderTree?: RootNode;
		signal?: AbortSignal;
	}): Promise<void> {
		const tree = renderTree ?? this.getRenderTree();
		if (!tree) return;
		previewPerfBeginFrame();
		const t0 = performance.now();
		try {
			await renderer.renderToCanvas({ node: tree, time, targetCanvas, signal });
			const ms = performance.now() - t0;
			previewPerfMarkRenderToCanvas(ms);
		} finally {
			previewPerfEndFrame();
		}
	}

	setGpuPreviewEffectsEnabled(on: boolean): void {
		setGlobalGpuPreviewEffects(on);
	}

	async exportProject({
		options,
	}: {
		options: ExportOptions;
	}): Promise<ExportResult> {
		const { onProgress, onCancel } = options;
		const checkCancelled = () => {
			if (onCancel?.()) {
				return { success: false, cancelled: true } satisfies ExportResult;
			}
			return null;
		};

		try {
			const tracks = this.editor.timeline.getTracks();
			const mediaAssets = this.editor.media.getAssets();
			const activeProject = this.editor.project.getActive();

			if (!activeProject) {
				return { success: false, error: "No active project" };
			}

			const fullDuration = this.editor.timeline.getTotalDuration();
			if (fullDuration === 0) {
				return { success: false, error: "Project is empty" };
			}

			const timeRange = normalizeExportTimeRange(options.timeRange, fullDuration);
			const duration = timeRange ? timeRange.endTime - timeRange.startTime : fullDuration;
			if (duration <= 0) {
				return { success: false, error: "Selected segment is empty" };
			}

			const canvasSize = options.canvasSize ?? activeProject.settings.canvasSize;
			const extension = options.format === "webm" ? "webm" : "mp4";

			// Always save to Built Clips directory
			const appDataDir = await invoke<string>("get_app_data_dir");
			const timestamp = Date.now();
			const nameSource = options.outputFileName?.trim() || activeProject.metadata.name;
			const sanitizedName = nameSource.replace(/[^a-zA-Z0-9-_]/g, "_");
			const rangeSuffix = timeRange && !options.outputFileName?.trim() ? "_segment" : "";
			const fileName = `${sanitizedName}${rangeSuffix}_${timestamp}.${extension}`;
			const outputPath = `${appDataDir}/built_clips/${fileName}`;

			// Ensure the built_clips directory exists
			await invoke("create_directory", { path: `${appDataDir}/built_clips` });

			onProgress?.({ progress: 0.05 });
			const cancelledAfterSetup = checkCancelled();
			if (cancelledAfterSetup) return cancelledAfterSetup;

			const exportFps = Math.max(
				1,
				Math.round(options.fps ?? activeProject.settings?.fps ?? 30),
			);

			const sessionId =
				options.exportId != null && String(options.exportId).length > 0
					? String(options.exportId)
							.replace(/[^a-zA-Z0-9-_]/g, "_")
							.slice(0, 80)
					: `scene_${timestamp}`;
			const effectiveExportId = options.exportId ?? sessionId;

			let sceneTransitions: import("../../types/transitions").Transition[] = [];
			try {
				const scene = this.editor.scenes.getActiveScene();
				sceneTransitions = scene?.transitions ?? [];
			} catch {
				sceneTransitions = [];
			}

			const background = activeProject.settings?.background ?? {
				type: "color" as const,
				color: "#000000",
			};

			const sceneTracks = getSceneTracksForExport(tracks);
			const timeOffset = timeRange?.startTime ?? 0;
			const frameCount = Math.max(1, Math.ceil(duration * exportFps));

			let scenePattern: string | null = null;
			let sceneFrameCount: number | null = null;
			const useSceneFrames = requiresSceneFrameExport({
				tracks,
				sceneTransitions,
				canvasSourceFraming: activeProject.settings.canvasSourceFraming ?? null,
				background,
			});

			if (useSceneFrames) {
				const sceneExport = await writeSceneFrameSequenceToDisk({
					sessionId,
					sceneInputs: {
						tracks: sceneTracks,
						mediaAssets,
						duration: fullDuration,
						canvasSize,
						background,
						transitions: sceneTransitions,
						canvasSourceFraming: activeProject.settings.canvasSourceFraming ?? null,
					},
					exportDuration: duration,
					timeOffset,
					fps: exportFps,
					frameCount,
					onProgress: (p) => {
						onProgress?.({ progress: 0.05 + p.progress * 0.14 });
					},
					isCancelled: () => !!onCancel?.(),
				});
				scenePattern = sceneExport.pattern;
				sceneFrameCount = sceneExport.frameCount;
				console.info(
					"[RendererManager] Scene frame pre-render enabled for WYSIWYG export parity",
				);
			} else {
				console.info(
					"[RendererManager] Using fast FFmpeg export path; scene frame pre-render not required",
				);
			}

			onProgress?.({ progress: 0.19 });
			const cancelledAfterFrames = checkCancelled();
			if (cancelledAfterFrames) return cancelledAfterFrames;

			const textOverlays = useSceneFrames
				? []
				: await this.preRenderTextOverlays({
						tracks,
						canvasSize,
						fps: exportFps,
					});
			const stickerOverlays = useSceneFrames
				? []
				: await this.preRenderStickerOverlays({
						tracks,
						canvasSize,
						fps: exportFps,
					});
			const captionOverlays = useSceneFrames
				? []
				: await this.preRenderCaptionOverlays({
						tracks,
						canvasSize,
						duration: fullDuration,
						fps: exportFps,
					});

			// Resolve branding config for export
			const brandingExport = await this.resolveBrandingForExport({ canvasSize });

			onProgress?.({ progress: 0.2 });
			const cancelledAfterBranding = checkCancelled();
			if (cancelledAfterBranding) return cancelledAfterBranding;

			// Build export config from timeline data. Complex visual projects use the
			// scene image sequence; simpler ones let FFmpeg composite pre-rendered overlays.
			const config = this.buildExportConfig({
				tracks,
				mediaAssets,
				outputPath,
				duration,
				timeRange,
				fps: exportFps,
				canvasSize,
				textOverlays,
				stickerOverlays,
				captionOverlays,
				brandingExport,
			});
			config.export_id = effectiveExportId;
			if (scenePattern) {
				config.scene_frame_pattern = scenePattern;
				config.scene_frame_count = sceneFrameCount ?? undefined;
			}
			config.export_format = options.format;
			config.export_quality = options.quality;
			config.include_audio = options.includeAudio !== false;
			if (useSceneFrames) {
				config.effect_overlays = [];
			}

			onProgress?.({ progress: 0.2 });
			const cancelledBeforeEncode = checkCancelled();
			if (cancelledBeforeEncode) return cancelledBeforeEncode;

			// Call Tauri FFmpeg export command
			const { listen } = await import("@tauri-apps/api/event");
			const unlistenProgress = await listen<{
				export_id: string;
				progress: number;
			}>("video-editor-export-progress", (event) => {
				if (event.payload.export_id !== effectiveExportId) return;
				const encodeProgress = Math.max(0, Math.min(1, event.payload.progress));
				onProgress?.({ progress: 0.2 + encodeProgress * 0.75 });
			});

			try {
				await invoke("export_video_editor_project", { config });
			} finally {
				unlistenProgress();
			}

			onProgress?.({ progress: 0.95 });

			onProgress?.({ progress: 1.0 });

			return {
				success: true,
				outputPath,
			};
		} catch (error) {
			console.error("Export failed:", error);
			const message = error instanceof Error ? error.message : String(error);
			if (message.includes("Export cancelled")) {
				return {
					success: false,
					cancelled: true,
				};
			}

			return {
				success: false,
				error: message,
			};
		}
	}

	private buildExportConfig({
		tracks,
		mediaAssets,
		outputPath,
		duration,
		timeRange,
		fps,
		canvasSize,
		textOverlays,
		stickerOverlays,
		captionOverlays,
		brandingExport,
	}: {
		tracks: TimelineTrack[];
		mediaAssets: MediaAsset[];
		outputPath: string;
		duration: number;
		timeRange: ExportTimeRange | null;
		fps: number;
		canvasSize: { width: number; height: number };
		textOverlays: TauriTextOverlay[];
		stickerOverlays: TauriStickerOverlay[];
		captionOverlays: TauriTextOverlay[];
		brandingExport: BrandingExportData;
	}): TauriExportConfig {
		const videoSourceElementIndex = new Map<string, number>();
		const collectedVideos: {
			source: TauriVideoSource;
			elementId: string;
			start_time: number;
			end_time: number;
			isMain: boolean;
			orderIndex: number;
		}[] = [];

		const audioTracks: TauriAudioTrack[] = [];

		const effectOverlays: TauriEffectOverlay[] = [];

		const videoTracksAll = tracks.filter((t): t is VideoTrack => t.type === "video");
		const orderedVideoTracks = [
			...videoTracksAll.filter((t) => t.isMain),
			...videoTracksAll.filter((t) => !t.isMain),
		];

		for (const track of orderedVideoTracks) {
			const sortedElements = [...track.elements].sort((a, b) => {
				const ao = a.orderIndex ?? 0;
				const bo = b.orderIndex ?? 0;
				if (ao !== bo) return ao - bo;
				if (a.startTime !== b.startTime) return a.startTime - b.startTime;
				return a.id.localeCompare(b.id);
			});

			for (const el of sortedElements) {
				const isImage = el.type === "image";
				const mediaId = isImage ? (el as ImageElement).mediaId : (el as VideoElement).mediaId;
				const asset = mediaAssets.find((a) => a.id === mediaId);
				if (!asset) continue;

				const sourcePath = asset.filePath || (asset.url ? this.resolveFilePath(asset.url) : null);
				if (!sourcePath) continue;

				const orderIndex = el.orderIndex ?? 0;
				const trackIsMain = track.isMain;

				if (isImage) {
					const imgEl = el as ImageElement;
					const clip = getClippedTimelineSpan(imgEl.startTime, imgEl.startTime + imgEl.duration, timeRange);
					if (!clip) continue;

					const start_time = clip.startTime;
					const end_time = clip.endTime;
					const source: TauriVideoSource = {
						source_path: sourcePath,
						start_time,
						end_time,
						trim_start: null,
						trim_end: null,
						opacity: imgEl.opacity ?? 1,
						scale: imgEl.transform?.scale ?? 1,
						position_x: imgEl.transform?.position?.x ?? 0,
						position_y: imgEl.transform?.position?.y ?? 0,
						rotation: imgEl.transform?.rotate ?? 0,
						is_muted: true,
						volume: 0,
						speed: 1,
						fade_in: imgEl.fadeIn ?? 0,
						fade_out: imgEl.fadeOut ?? 0,
						flip_horizontal: imgEl.flip?.horizontal ?? false,
						flip_vertical: imgEl.flip?.vertical ?? false,
						crop_top: imgEl.crop?.top ?? 0,
						crop_right: imgEl.crop?.right ?? 0,
						crop_bottom: imgEl.crop?.bottom ?? 0,
						crop_left: imgEl.crop?.left ?? 0,
						brightness: imgEl.colorAdjustments?.brightness ?? 0,
						contrast: imgEl.colorAdjustments?.contrast ?? 0,
						saturation: imgEl.colorAdjustments?.saturation ?? 0,
						temperature: imgEl.colorAdjustments?.temperature ?? 0,
						highlights: imgEl.colorAdjustments?.highlights ?? 0,
						shadows: imgEl.colorAdjustments?.shadows ?? 0,
						exposure: imgEl.colorAdjustments?.exposure ?? 0,
						fade: imgEl.colorAdjustments?.fade ?? 0,
						tint: imgEl.colorAdjustments?.tint ?? "",
						sharpness: imgEl.colorAdjustments?.sharpness ?? 0,
						effects: serializeEffects(imgEl.effects),
						is_image: true,
						is_reversed: false,
						animation_in: serializeAnimation(imgEl.animationIn),
						animation_out: serializeAnimation(imgEl.animationOut),
						animation_loop: serializeAnimation(imgEl.animationLoop),
						keyframes: serializeKeyframes(imgEl.keyframes),
						color_curves_master: serializeCurvePoints(imgEl.colorCurves?.master),
						color_curves_red: serializeCurvePoints(imgEl.colorCurves?.red),
						color_curves_green: serializeCurvePoints(imgEl.colorCurves?.green),
						color_curves_blue: serializeCurvePoints(imgEl.colorCurves?.blue),
						color_wheels_shadows_hue: imgEl.colorWheels?.shadows?.hue ?? null,
						color_wheels_shadows_saturation: imgEl.colorWheels?.shadows?.saturation ?? null,
						color_wheels_shadows_luminance: imgEl.colorWheels?.shadows?.luminance ?? null,
						color_wheels_midtones_hue: imgEl.colorWheels?.midtones?.hue ?? null,
						color_wheels_midtones_saturation: imgEl.colorWheels?.midtones?.saturation ?? null,
						color_wheels_midtones_luminance: imgEl.colorWheels?.midtones?.luminance ?? null,
						color_wheels_highlights_hue: imgEl.colorWheels?.highlights?.hue ?? null,
						color_wheels_highlights_saturation: imgEl.colorWheels?.highlights?.saturation ?? null,
						color_wheels_highlights_luminance: imgEl.colorWheels?.highlights?.luminance ?? null,
						lut_path: imgEl.lutPath ?? null,
						pan: null,
						blend_mode: imgEl.blendMode ?? null,
						track_is_main: trackIsMain,
						order_index: orderIndex,
						chromakey: serializeChromakey(imgEl.chromakey),
						masks: serializeMasks(imgEl.masks),
					};
					collectedVideos.push({
						source,
						elementId: imgEl.id,
						start_time,
						end_time,
						isMain: trackIsMain,
						orderIndex,
					});
				} else {
					const videoEl = el as VideoElement;
					const clip = getClippedTimelineSpan(
						videoEl.startTime,
						videoEl.startTime + videoEl.duration,
						timeRange,
						videoEl.speed ?? 1,
					);
					if (!clip) continue;

					const start_time = clip.startTime;
					const end_time = clip.endTime;
					const source: TauriVideoSource = {
						source_path: sourcePath,
						start_time,
						end_time,
						trim_start: (videoEl.trimStart ?? 0) + clip.sourceOffset,
						trim_end: videoEl.trimEnd ? videoEl.trimEnd - clip.sourceEndOffset : null,
						opacity: videoEl.opacity ?? 1,
						scale: videoEl.transform?.scale ?? 1,
						position_x: videoEl.transform?.position?.x ?? 0,
						position_y: videoEl.transform?.position?.y ?? 0,
						rotation: videoEl.transform?.rotate ?? 0,
						is_muted: videoEl.muted ?? false,
						volume: videoEl.volume ?? 1,
						speed: videoEl.speed ?? 1,
						fade_in: videoEl.fadeIn ?? 0,
						fade_out: videoEl.fadeOut ?? 0,
						flip_horizontal: videoEl.flip?.horizontal ?? false,
						flip_vertical: videoEl.flip?.vertical ?? false,
						crop_top: videoEl.crop?.top ?? 0,
						crop_right: videoEl.crop?.right ?? 0,
						crop_bottom: videoEl.crop?.bottom ?? 0,
						crop_left: videoEl.crop?.left ?? 0,
						brightness: videoEl.colorAdjustments?.brightness ?? 0,
						contrast: videoEl.colorAdjustments?.contrast ?? 0,
						saturation: videoEl.colorAdjustments?.saturation ?? 0,
						temperature: videoEl.colorAdjustments?.temperature ?? 0,
						highlights: videoEl.colorAdjustments?.highlights ?? 0,
						shadows: videoEl.colorAdjustments?.shadows ?? 0,
						exposure: videoEl.colorAdjustments?.exposure ?? 0,
						fade: videoEl.colorAdjustments?.fade ?? 0,
						tint: videoEl.colorAdjustments?.tint ?? "",
						sharpness: videoEl.colorAdjustments?.sharpness ?? 0,
						effects: serializeEffects(videoEl.effects),
						is_image: false,
						is_reversed: videoEl.reversed ?? false,
						animation_in: serializeAnimation(videoEl.animationIn),
						animation_out: serializeAnimation(videoEl.animationOut),
						animation_loop: serializeAnimation(videoEl.animationLoop),
						keyframes: serializeKeyframes(videoEl.keyframes),
						color_curves_master: serializeCurvePoints(videoEl.colorCurves?.master),
						color_curves_red: serializeCurvePoints(videoEl.colorCurves?.red),
						color_curves_green: serializeCurvePoints(videoEl.colorCurves?.green),
						color_curves_blue: serializeCurvePoints(videoEl.colorCurves?.blue),
						color_wheels_shadows_hue: videoEl.colorWheels?.shadows?.hue ?? null,
						color_wheels_shadows_saturation: videoEl.colorWheels?.shadows?.saturation ?? null,
						color_wheels_shadows_luminance: videoEl.colorWheels?.shadows?.luminance ?? null,
						color_wheels_midtones_hue: videoEl.colorWheels?.midtones?.hue ?? null,
						color_wheels_midtones_saturation: videoEl.colorWheels?.midtones?.saturation ?? null,
						color_wheels_midtones_luminance: videoEl.colorWheels?.midtones?.luminance ?? null,
						color_wheels_highlights_hue: videoEl.colorWheels?.highlights?.hue ?? null,
						color_wheels_highlights_saturation: videoEl.colorWheels?.highlights?.saturation ?? null,
						color_wheels_highlights_luminance: videoEl.colorWheels?.highlights?.luminance ?? null,
						lut_path: videoEl.lutPath ?? null,
						pan: videoEl.pan ?? null,
						blend_mode: videoEl.blendMode ?? null,
						track_is_main: trackIsMain,
						order_index: orderIndex,
						chromakey: serializeChromakey(videoEl.chromakey),
						masks: serializeMasks(videoEl.masks),
					};
					collectedVideos.push({
						source,
						elementId: videoEl.id,
						start_time,
						end_time,
						isMain: trackIsMain,
						orderIndex,
					});
				}
			}
		}

		const overlap =
			collectedVideos.length > 1 &&
			videoSegmentsOverlap(collectedVideos.map((c) => ({ start: c.start_time, end: c.end_time })));
		if (overlap) {
			collectedVideos.sort((a, b) => {
				if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
				if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
				if (a.start_time !== b.start_time) return a.start_time - b.start_time;
				return a.elementId.localeCompare(b.elementId);
			});
		} else {
			collectedVideos.sort((a, b) => {
				if (a.start_time !== b.start_time) return a.start_time - b.start_time;
				return a.elementId.localeCompare(b.elementId);
			});
		}

		const videoSources: TauriVideoSource[] = collectedVideos.map((c) => c.source);
		collectedVideos.forEach((c, i) => {
			videoSourceElementIndex.set(c.elementId, i);
		});

		for (const track of tracks) {
			if (track.type === "video") {
				continue;
			} else if (track.type === "sticker") {
				// Stickers are pre-rendered to PNGs by preRenderStickerOverlays — skip here
			} else if (track.type === "effect") {
				if (track.hidden) continue;
				for (const el of track.elements) {
					const effectEl = el as EffectElement;
					if (!effectEl.enabled) continue;
					const clip = getClippedTimelineSpan(effectEl.startTime, effectEl.startTime + effectEl.duration, timeRange);
					if (!clip) continue;
					effectOverlays.push({
						effect_type: effectEl.effectType,
						enabled: effectEl.enabled,
						intensity: effectEl.intensity,
						params: effectEl.params,
						start_time: clip.startTime,
						end_time: clip.endTime,
					});
				}
			} else if (track.type === "audio") {
				for (const el of track.elements) {
					const audioEl = el as AudioElement;
					const clip = getClippedTimelineSpan(
						audioEl.startTime,
						audioEl.startTime + audioEl.duration,
						timeRange,
						audioEl.speed ?? 1,
					);
					if (!clip) continue;

					let filePath: string | null = null;

					if (audioEl.sourceType === "upload") {
						const asset = mediaAssets.find((a) => a.id === audioEl.mediaId);
						if (asset) {
							filePath = asset.filePath || (asset.url ? this.resolveFilePath(asset.url) : null);
						}
					} else if (audioEl.sourceType === "library") {
						filePath = this.resolveFilePath(audioEl.sourceUrl);
					}

					if (!filePath) continue;

					const serializedAudioEffects: TauriAudioEffect[] | null =
						audioEl.audioEffects && audioEl.audioEffects.length > 0
							? audioEl.audioEffects
									.filter((fx) => fx.enabled)
									.map((fx) => {
										const { id, type, enabled, ...rest } = fx as any;
										return { effect_type: type, params: rest };
									})
							: null;

				audioTracks.push({
					file_path: filePath,
					start_time: clip.startTime,
					end_time: clip.endTime,
					trim_start: (audioEl.trimStart ?? 0) + clip.sourceOffset,
					volume: audioEl.volume ?? 1,
					is_muted: audioEl.muted ?? false,
					speed: audioEl.speed ?? 1,
					fade_in: audioEl.fadeIn ?? 0,
					fade_out: audioEl.fadeOut ?? 0,
					audio_effects: serializedAudioEffects,
					pan: audioEl.pan ?? null,
				});
				}
				// Text tracks are handled by preRenderTextOverlays — skip here
			}
		}

		const coverTimestamp = this.editor.project.getCoverTimestamp();

		// Build transition data from scene transitions
		const transitionData: TauriTransitionData[] = [];
		try {
			const scene = this.editor.scenes.getActiveScene();
			if (scene?.transitions) {
				for (const t of scene.transitions) {
					// Resolve track by element id — transition.trackId can drift after timeline edits.
					const targetTrack = tracks.find((tr) =>
						tr.elements.some((el) => el.id === t.targetElementId),
					);
					if (!targetTrack || targetTrack.type !== "video") continue;

					const pair = resolveTransitionMediaPair({ transition: t, track: targetTrack });
					if (!pair) continue;

					const incomingId = pair.incoming.id;
					const targetIdx = videoSourceElementIndex.get(incomingId);
					if (targetIdx === undefined || targetIdx <= 0) continue;
					const junctionTime = timeRange
						? pair.incoming.startTime - timeRange.startTime
						: pair.incoming.startTime;
					if (junctionTime < 0 || junctionTime > duration) continue;

					transitionData.push({
						transition_type: t.type,
						duration: t.duration,
						target_element_index: targetIdx,
						junction_time: junctionTime,
					});
				}
			}
		} catch {
			// No scene transitions
		}

		// Adjust cover timestamp to account for intro duration
		// If an intro is present, the cover timestamp needs to be offset by the intro duration
		// so that FFmpeg extracts the frame from the main clip content, not the intro
		let adjustedCoverTimestamp: number | null = coverTimestamp ?? null;
		if (adjustedCoverTimestamp !== null && timeRange) {
			adjustedCoverTimestamp =
				adjustedCoverTimestamp >= timeRange.startTime && adjustedCoverTimestamp <= timeRange.endTime
					? adjustedCoverTimestamp - timeRange.startTime
					: Math.min(1.0, Math.max(0.05, duration / 2));
		}
		if (adjustedCoverTimestamp !== null && brandingExport.introDuration) {
			adjustedCoverTimestamp += brandingExport.introDuration;
		}

		return {
			video_sources: videoSources,
			audio_tracks: audioTracks,
			text_overlays: [...textOverlays, ...captionOverlays]
				.map((overlay) => clipOverlaySpan(overlay, timeRange))
				.filter((overlay): overlay is TauriTextOverlay => overlay !== null),
			sticker_overlays: stickerOverlays
				.map((overlay) => clipOverlaySpan(overlay, timeRange))
				.filter((overlay): overlay is TauriStickerOverlay => overlay !== null),
			effect_overlays: effectOverlays,
			transitions: transitionData.length > 0 ? transitionData : null,
			output_path: outputPath,
			total_duration: duration,
			fps,
			width: canvasSize.width,
			height: canvasSize.height,
			cover_timestamp: adjustedCoverTimestamp,
			branding_watermark: brandingExport.watermark,
			branding_overlays: brandingExport.overlays,
			intro_path: brandingExport.introPath,
			intro_duration: brandingExport.introDuration,
			outro_path: brandingExport.outroPath,
			outro_duration: brandingExport.outroDuration,
		};
	}

	/**
	 * Resolve a video server URL back to a local file path.
	 * URLs are in the format: http://localhost:PORT/video/BASE64_ENCODED_PATH
	 * Also handles direct file paths (e.g., from library audio downloads)
	 */
	private resolveFilePath(url: string): string | null {
		try {
			// If it's already a local file path (starts with drive letter or slash), return as-is
			if (/^[A-Za-z]:[\\\/]/.test(url) || url.startsWith('/')) {
				return url;
			}
			
			// Otherwise, try to decode from video server URL
			const match = url.match(/\/video\/(.+)$/);
			if (match) {
				return base64ToUtf8(match[1]);
			}
			return null;
		} catch {
			return null;
		}
	}

	/**
	 * Pre-render each text element to a transparent PNG using the same canvas
	 * renderer as the preview. Saves each PNG to a temp file via Tauri and
	 * returns overlay descriptors for FFmpeg's overlay filter.
	 */
	private async preRenderTextOverlays({
		tracks,
		canvasSize,
		fps,
	}: {
		tracks: TimelineTrack[];
		canvasSize: { width: number; height: number };
		fps: number;
	}): Promise<TauriTextOverlay[]> {
		const overlays: TauriTextOverlay[] = [];
		const center = { x: canvasSize.width / 2, y: canvasSize.height / 2 };

		for (const track of tracks) {
			if (track.type !== "text") continue;
			if (track.hidden) continue;

			for (const el of track.elements) {
				const textEl = el as TextElement;
				if (textEl.hidden) continue;
				if (!textEl.content?.trim()) continue;

				try {
					const nodeParams: TextNodeParams = {
						...textEl,
						canvasCenter: center,
					};
					const node = new TextNode(nodeParams);

					const motion = overlayNeedsAnimatedRaster({
						animationIn: textEl.animationIn,
						animationOut: textEl.animationOut,
						animationLoop: textEl.animationLoop,
						keyframes: textEl.keyframes,
					});

					if (motion) {
						const overlayDuration = textEl.duration;
						const frameCount = Math.max(2, Math.ceil(overlayDuration * fps));
						const frames: number[][] = [];
						for (let fi = 0; fi < frameCount; fi++) {
							const sampleTime = getFrameCenterSampleTime(
								textEl.startTime,
								overlayDuration,
								frameCount,
								fi,
							);
							const result = await node.renderToImage({
								canvasWidth: canvasSize.width,
								canvasHeight: canvasSize.height,
								sampleTime,
							});
							if (!result) continue;
							const arrayBuffer = await result.blob.arrayBuffer();
							frames.push(Array.from(new Uint8Array(arrayBuffer)));
						}
						if (frames.length === 0) continue;
						const [pattern, count] = await invoke<[string, number]>("save_overlay_frame_sequence", {
							elementId: textEl.id,
							frames,
						});
						overlays.push({
							image_path: pattern,
							start_time: textEl.startTime,
							end_time: textEl.startTime + textEl.duration,
							animation_in: serializeAnimation(textEl.animationIn),
							animation_out: serializeAnimation(textEl.animationOut),
							animation_loop: serializeAnimation(textEl.animationLoop),
							is_frame_sequence: true,
							sequence_frame_count: count,
						});
					} else {
						const sampleTime = textEl.startTime + textEl.duration / 2;
						const result = await node.renderToImage({
							canvasWidth: canvasSize.width,
							canvasHeight: canvasSize.height,
							sampleTime,
						});
						if (!result) continue;

						const arrayBuffer = await result.blob.arrayBuffer();
						const bytes = Array.from(new Uint8Array(arrayBuffer));

						const imagePath = await invoke<string>("save_text_overlay_png", {
							pngBytes: bytes,
							elementId: textEl.id,
						});

						overlays.push({
							image_path: imagePath,
							start_time: textEl.startTime,
							end_time: textEl.startTime + textEl.duration,
							animation_in: serializeAnimation(textEl.animationIn),
							animation_out: serializeAnimation(textEl.animationOut),
							animation_loop: serializeAnimation(textEl.animationLoop),
						});
					}
				} catch (err) {
					console.error(`[Export] Failed to pre-render text element ${textEl.id}:`, err);
				}
			}
		}

		return overlays;
	}

	/**
	 * Pre-render each sticker element to a transparent PNG using the same canvas
	 * renderer as the preview. Saves each PNG to a temp file via Tauri and
	 * returns overlay descriptors for FFmpeg's overlay filter.
	 */
	private async preRenderStickerOverlays({
		tracks,
		canvasSize,
		fps,
	}: {
		tracks: TimelineTrack[];
		canvasSize: { width: number; height: number };
		fps: number;
	}): Promise<TauriStickerOverlay[]> {
		const overlays: TauriStickerOverlay[] = [];
		let stickerCount = 0;

		for (const track of tracks) {
			if (track.type !== "sticker") continue;
			if (track.hidden) continue;

			for (const el of track.elements) {
				const stickerEl = el as StickerElement;
				if (stickerEl.hidden) continue;
				stickerCount++;

				try {
					console.log(`[Export] Pre-rendering sticker ${stickerEl.id}: icon=${stickerEl.iconName}, time=${stickerEl.startTime}-${stickerEl.startTime + stickerEl.duration}`);

					const nodeParams: StickerNodeParams = {
						iconName: stickerEl.iconName,
						duration: stickerEl.duration,
						timeOffset: stickerEl.startTime,
						trimStart: stickerEl.trimStart,
						trimEnd: stickerEl.trimEnd,
						transform: stickerEl.transform,
						opacity: stickerEl.opacity,
						color: stickerEl.color,
						fadeIn: stickerEl.fadeIn,
						fadeOut: stickerEl.fadeOut,
						keyframes: stickerEl.keyframes,
					};
					const node = new StickerNode(nodeParams);

					const motion = overlayNeedsAnimatedRaster({
						animationIn: stickerEl.animationIn,
						animationOut: stickerEl.animationOut,
						animationLoop: stickerEl.animationLoop,
						keyframes: stickerEl.keyframes,
					});

					if (motion) {
						const overlayDuration = stickerEl.duration;
						const frameCount = Math.max(2, Math.ceil(overlayDuration * fps));
						const frames: number[][] = [];
						for (let fi = 0; fi < frameCount; fi++) {
							const sampleTime = getFrameCenterSampleTime(
								stickerEl.startTime,
								overlayDuration,
								frameCount,
								fi,
							);
							const result = await node.renderToImage({
								canvasWidth: canvasSize.width,
								canvasHeight: canvasSize.height,
								sampleTime,
							});
							if (!result) continue;
							const arrayBuffer = await result.blob.arrayBuffer();
							frames.push(Array.from(new Uint8Array(arrayBuffer)));
						}
						if (frames.length === 0) {
							console.error(`[Export] Sticker ${stickerEl.id}: no frames for animated raster`);
							continue;
						}
						const [pattern, count] = await invoke<[string, number]>("save_overlay_frame_sequence", {
							elementId: `sticker_${stickerEl.id}`,
							frames,
						});
						overlays.push({
							image_path: pattern,
							start_time: stickerEl.startTime,
							end_time: stickerEl.startTime + stickerEl.duration,
							animation_in: serializeAnimation(stickerEl.animationIn),
							animation_out: serializeAnimation(stickerEl.animationOut),
							animation_loop: serializeAnimation(stickerEl.animationLoop),
							is_frame_sequence: true,
							sequence_frame_count: count,
						});
					} else {
						const sampleTime = stickerEl.startTime + stickerEl.duration / 2;
						const result = await node.renderToImage({
							canvasWidth: canvasSize.width,
							canvasHeight: canvasSize.height,
							sampleTime,
						});
						if (!result) {
							console.error(`[Export] StickerNode.renderToImage returned null for ${stickerEl.id} (${stickerEl.iconName})`);
							continue;
						}

						const arrayBuffer = await result.blob.arrayBuffer();
						const bytes = Array.from(new Uint8Array(arrayBuffer));
						console.log(`[Export] Sticker ${stickerEl.id} rendered to PNG: ${bytes.length} bytes`);

						const imagePath = await invoke<string>("save_text_overlay_png", {
							pngBytes: bytes,
							elementId: `sticker_${stickerEl.id}`,
						});
						console.log(`[Export] Sticker ${stickerEl.id} saved to: ${imagePath}`);

						overlays.push({
							image_path: imagePath,
							start_time: stickerEl.startTime,
							end_time: stickerEl.startTime + stickerEl.duration,
							animation_in: serializeAnimation(stickerEl.animationIn),
							animation_out: serializeAnimation(stickerEl.animationOut),
							animation_loop: serializeAnimation(stickerEl.animationLoop),
						});
					}
				} catch (err) {
					console.error(`[Export] Failed to pre-render sticker element ${stickerEl.id} (${stickerEl.iconName}):`, err);
				}
			}
		}

		console.log(`[Export] Pre-rendered ${overlays.length}/${stickerCount} sticker overlays`);
		return overlays;
	}

	/**
	 * Pre-render caption elements to transparent PNGs for export.
	 * Static captions can be one PNG per line, but word-highlight styles are
	 * time-dependent and need a frame sequence to match preview playback.
	 */
	private async preRenderCaptionOverlays({
		tracks,
		canvasSize,
		duration,
		fps,
	}: {
		tracks: TimelineTrack[];
		canvasSize: { width: number; height: number };
		duration: number;
		fps: number;
	}): Promise<TauriTextOverlay[]> {
		const overlays: TauriTextOverlay[] = [];
		const center = { x: canvasSize.width / 2, y: canvasSize.height / 2 };
		let captionCount = 0;

		for (const track of tracks) {
			if (track.type !== "caption") continue;
			if (track.hidden) continue;

			for (const el of track.elements) {
				const captionEl = el as CaptionElement;
				if (captionEl.hidden) continue;
				if (!captionEl.lines || captionEl.lines.length === 0) continue;
				captionCount++;

				const motion = overlayNeedsAnimatedRaster({
					animationIn: captionEl.animationIn,
					animationOut: captionEl.animationOut,
					animationLoop: captionEl.animationLoop,
					keyframes: captionEl.keyframes,
				}) || captionHighlightNeedsAnimatedRaster(captionEl.highlightStyle);

				for (let lineIdx = 0; lineIdx < captionEl.lines.length; lineIdx++) {
					const line = captionEl.lines[lineIdx];
					const lineDur = Math.max(1e-6, line.endTime - line.startTime);

					try {
						const nodeParams: CaptionNodeParams = {
							...captionEl,
							canvasCenter: center,
						};
						const node = new CaptionNode(nodeParams);

						if (motion) {
							const frameCount = Math.max(2, Math.ceil(lineDur * fps));
							const frames: number[][] = [];
							for (let fi = 0; fi < frameCount; fi++) {
								const sampleTime = getFrameCenterSampleTime(
									line.startTime,
									lineDur,
									frameCount,
									fi,
								);
								const result = await node.renderToImage({
									canvasWidth: canvasSize.width,
									canvasHeight: canvasSize.height,
									time: sampleTime,
								});
								if (!result) continue;
								const arrayBuffer = await result.blob.arrayBuffer();
								frames.push(Array.from(new Uint8Array(arrayBuffer)));
							}
							if (frames.length === 0) continue;
							const [pattern, count] = await invoke<[string, number]>("save_overlay_frame_sequence", {
								elementId: `caption_${captionEl.id}_line${lineIdx}`,
								frames,
							});
							overlays.push({
								image_path: pattern,
								start_time: line.startTime,
								end_time: line.endTime,
								animation_in: serializeAnimation(captionEl.animationIn),
								animation_out: serializeAnimation(captionEl.animationOut),
								animation_loop: serializeAnimation(captionEl.animationLoop),
								is_frame_sequence: true,
								sequence_frame_count: count,
							});
						} else {
							const lineMidTime = (line.startTime + line.endTime) / 2;
							const result = await node.renderToImage({
								canvasWidth: canvasSize.width,
								canvasHeight: canvasSize.height,
								time: lineMidTime,
							});
							if (!result) continue;

							const arrayBuffer = await result.blob.arrayBuffer();
							const bytes = Array.from(new Uint8Array(arrayBuffer));

							const imagePath = await invoke<string>("save_text_overlay_png", {
								pngBytes: bytes,
								elementId: `caption_${captionEl.id}_line${lineIdx}`,
							});

							overlays.push({
								image_path: imagePath,
								start_time: line.startTime,
								end_time: line.endTime,
								animation_in: serializeAnimation(captionEl.animationIn),
								animation_out: serializeAnimation(captionEl.animationOut),
								animation_loop: serializeAnimation(captionEl.animationLoop),
							});
						}
					} catch (err) {
						console.error(`[Export] Failed to pre-render caption element ${captionEl.id} line ${lineIdx}:`, err);
					}
				}
			}
		}

		console.log(`[Export] Pre-rendered ${overlays.length} caption line overlays from ${captionCount} caption elements`);
		return overlays;
	}

	/**
	 * Resolve branding config (watermark, intro, outro) for the current aspect ratio.
	 */
	private async resolveBrandingForExport({
		canvasSize,
	}: {
		canvasSize: { width: number; height: number };
	}): Promise<BrandingExportData> {
		const result: BrandingExportData = {
			watermark: null,
			overlays: null,
			introPath: null,
			introDuration: null,
			outroPath: null,
			outroDuration: null,
		};

		try {
			// Detect aspect ratio from canvas size
			const ratioMap: Record<string, AspectRatioId> = {
				"1920x1080": "16:9",
				"1080x1920": "9:16",
				"1080x1080": "1:1",
				"1080x1350": "4:5",
			};
			const ratioKey = `${canvasSize.width}x${canvasSize.height}`;
			const aspectRatio = ratioMap[ratioKey];

			// Check for free tier branding first - it overrides creator profile settings
			const { useFreeTierBranding } = await import("@/composables/useFreeTierBranding");
			const { getBrandingIfFreeTier } = useFreeTierBranding();
			const adminBranding = await getBrandingIfFreeTier();

			if (adminBranding) {
				console.log("[Export] Free tier user detected, applying admin branding");

				// Apply admin watermark — use presigned URL from server to download locally
				if (adminBranding.watermark_id) {
					// Parse per-ratio settings to get position for this aspect ratio
					let pos = { x: 12, y: 92, scale: 20, opacity: 80, isFullFrameOverlay: false };
					if (adminBranding.watermark_settings) {
						try {
							const perRatio = typeof adminBranding.watermark_settings === "string"
								? JSON.parse(adminBranding.watermark_settings)
								: adminBranding.watermark_settings;
							const ratioConfig = aspectRatio ? perRatio[aspectRatio] : perRatio["16:9"];
							if (ratioConfig?.position) {
								pos = { ...pos, ...ratioConfig.position };
							}
						} catch (e) {
							console.warn("[Export] Failed to parse admin watermark_settings:", e);
						}
					}

					let filePath: string | null = null;
					if (adminBranding.watermark_url) {
						// Download via presigned URL (bypasses org-asset system)
						try {
							const { invoke } = await import("@tauri-apps/api/core");
							const filename = `free-tier-watermark-${adminBranding.watermark_id.replace(/[^a-zA-Z0-9-]/g, "_")}.png`;
							filePath = await invoke<string>("download_org_asset_from_url", {
								url: adminBranding.watermark_url,
								filename,
								assetType: "watermarks",
								organizationId: "free-tier",
							});
							console.log("[Export] Free tier watermark downloaded to:", filePath);
						} catch (dlErr) {
							console.error("[Export] Failed to download free tier watermark:", dlErr);
						}
					}
					if (!filePath) {
						// Fallback: try local database (works for org members)
						const resolved = await resolveWatermarkById(adminBranding.watermark_id);
						filePath = resolved?.filePath ?? null;
					}

					if (filePath) {
						result.watermark = {
							image_path: filePath,
							x: pos.x,
							y: pos.y,
							scale: pos.scale ?? 20,
							opacity: pos.opacity ?? 80,
							is_full_frame: pos.isFullFrameOverlay ?? false,
						};
						console.log("[Export] Applied admin watermark");
					}
				}

				// Apply admin intro/outro — use presigned URLs from intro_settings/outro_settings
				if (aspectRatio) {
					let introApplied = false;
					let outroApplied = false;

					if (adminBranding.intro_settings) {
						const introConfig = adminBranding.intro_settings[aspectRatio];
						if (introConfig?.assetId) {
							if ((introConfig as any).url) {
								try {
									const { invoke } = await import("@tauri-apps/api/core");
									const filename = `free-tier-intro-${introConfig.assetId.replace(/[^a-zA-Z0-9-]/g, "_")}.mp4`;
									result.introPath = await invoke<string>("download_org_asset_from_url", {
										url: (introConfig as any).url,
										filename,
										assetType: "intros",
										organizationId: "free-tier",
									});
									introApplied = true;
									console.log(`[Export] Applied admin intro for ${aspectRatio}`);
								} catch (dlErr) {
									console.error(`[Export] Failed to download admin intro for ${aspectRatio}:`, dlErr);
								}
							} else {
								const introResolved = await resolveIntroOutroById(introConfig.assetId);
								if (introResolved) {
									result.introPath = introResolved.filePath;
									result.introDuration = introResolved.duration ?? null;
									introApplied = true;
									console.log(`[Export] Applied admin intro for ${aspectRatio}`);
								}
							}
						}
					}

					if (adminBranding.outro_settings) {
						const outroConfig = adminBranding.outro_settings[aspectRatio];
						if (outroConfig?.assetId) {
							if ((outroConfig as any).url) {
								try {
									const { invoke } = await import("@tauri-apps/api/core");
									const filename = `free-tier-outro-${outroConfig.assetId.replace(/[^a-zA-Z0-9-]/g, "_")}.mp4`;
									result.outroPath = await invoke<string>("download_org_asset_from_url", {
										url: (outroConfig as any).url,
										filename,
										assetType: "outros",
										organizationId: "free-tier",
									});
									outroApplied = true;
									console.log(`[Export] Applied admin outro for ${aspectRatio}`);
								} catch (dlErr) {
									console.error(`[Export] Failed to download admin outro for ${aspectRatio}:`, dlErr);
								}
							} else {
								const outroResolved = await resolveIntroOutroById(outroConfig.assetId);
								if (outroResolved) {
									result.outroPath = outroResolved.filePath;
									result.outroDuration = outroResolved.duration ?? null;
									outroApplied = true;
									console.log(`[Export] Applied admin outro for ${aspectRatio}`);
								}
							}
						}
					}

					// Fall back to default intro/outro if no per-ratio settings
					if (!introApplied && adminBranding.intro) {
						result.introPath = adminBranding.intro.file_path ?? null;
						result.introDuration = adminBranding.intro.duration ?? null;
						console.log("[Export] Applied admin default intro");
					}

					if (!outroApplied && adminBranding.outro) {
						result.outroPath = adminBranding.outro.file_path ?? null;
						result.outroDuration = adminBranding.outro.duration ?? null;
						console.log("[Export] Applied admin default outro");
					}
				}

				console.log("[Export] Free tier branding applied successfully");
				return result;
			}

			// Not free tier - use creator profile branding
			const { getWatermarkForCanvasSize, getOverlaysForCanvasSize, getActiveIntro, getActiveOutro } = useBrandingConfig();

			// Resolve watermark
			const wmConfig = getWatermarkForCanvasSize(canvasSize.width, canvasSize.height);
			if (wmConfig?.watermarkId && wmConfig.position) {
				const resolved = await resolveWatermarkById(wmConfig.watermarkId);
				if (resolved?.filePath) {
					result.watermark = {
						image_path: resolved.filePath,
						x: wmConfig.position.x,
						y: wmConfig.position.y,
						scale: wmConfig.position.scale,
						opacity: wmConfig.position.opacity,
						is_full_frame: wmConfig.position.isFullFrameOverlay ?? false,
					};
				}
			}

			// Resolve layout overlays — org overlays use assetId (org-asset-{serverId}) resolved via org asset system
			const overlayConfigs = getOverlaysForCanvasSize(canvasSize.width, canvasSize.height);
			if (overlayConfigs && overlayConfigs.length > 0) {
				const resolvedOverlays: TauriBrandingOverlay[] = [];
				for (const oc of overlayConfigs) {
					const resolvedPath = await resolveOverlayImagePath(
						oc.imagePath,
						oc.assetId,
					);
					if (resolvedPath) {
						resolvedOverlays.push({
							image_path: resolvedPath,
							x: oc.x,
							y: oc.y,
							scale: oc.scale,
							opacity: oc.opacity,
							rotation: oc.rotation,
							is_full_frame: oc.isFullFrameOverlay ?? false,
						});
					} else {
						console.warn("[Export] Skipping overlay with unresolvable image:", oc.id);
					}
				}
				if (resolvedOverlays.length > 0) {
					result.overlays = resolvedOverlays;
				}
			}

			if (!aspectRatio) {
				console.log("[Export] Non-standard aspect ratio, skipping intro/outro");
				return result;
			}

			// Resolve intro
			const introConfig = getActiveIntro(aspectRatio);
			if (introConfig?.assetId) {
				if (introConfig.filePath) {
					result.introPath = introConfig.filePath;
					result.introDuration = introConfig.duration ?? null;
				} else {
					const introResolved = await resolveIntroOutroById(introConfig.assetId);
					if (introResolved) {
						result.introPath = introResolved.filePath;
						result.introDuration = introResolved.duration ?? null;
					}
				}
			}

			// Resolve outro
			const outroConfig = getActiveOutro(aspectRatio);
			if (outroConfig?.assetId) {
				if (outroConfig.filePath) {
					result.outroPath = outroConfig.filePath;
					result.outroDuration = outroConfig.duration ?? null;
				} else {
					const outroResolved = await resolveIntroOutroById(outroConfig.assetId);
					if (outroResolved) {
						result.outroPath = outroResolved.filePath;
						result.outroDuration = outroResolved.duration ?? null;
					}
				}
			}
		} catch (error) {
			console.warn("[Export] Failed to resolve branding config:", error);
		}

		return result;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => fn());
	}
}

function overlayNeedsAnimatedRaster(opts: {
	animationIn?: ElementAnimation | null;
	animationOut?: ElementAnimation | null;
	animationLoop?: ElementAnimation | null;
	keyframes?: ElementKeyframes | null;
}): boolean {
	if (opts.keyframes?.tracks) {
		for (const track of Object.values(opts.keyframes.tracks)) {
			if (track && track.keyframes.length > 1) return true;
		}
	}
	const isFadeOnlyAnim = (a?: ElementAnimation | null) =>
		!!(a && a.duration > 0.01 && (a.type === "fadeIn" || a.type === "fadeOut"));
	const needsRasterAnim = (a?: ElementAnimation | null) =>
		!!(a && a.duration > 0.01 && !isFadeOnlyAnim(a));
	if (needsRasterAnim(opts.animationIn) || needsRasterAnim(opts.animationOut)) return true;
	if (opts.animationLoop && opts.animationLoop.duration > 0.01) return true;
	return false;
}

function captionHighlightNeedsAnimatedRaster(style?: CaptionHighlightStyle | null): boolean {
	return !!style && style !== "none";
}

function getFrameCenterSampleTime(
	startTime: number,
	duration: number,
	frameCount: number,
	frameIndex: number,
): number {
	if (duration <= 0) return startTime;
	const centerOffset = ((frameIndex + 0.5) / Math.max(1, frameCount)) * duration;
	return Math.min(startTime + duration - 1e-6, startTime + centerOffset);
}

function serializeMasks(masks?: MaskShape[]): TauriSerializedMask[] | undefined {
	if (!masks?.length) return undefined;
	return masks.map((m) => ({
		id: m.id,
		mask_type: m.type,
		x: m.x,
		y: m.y,
		width: m.width,
		height: m.height,
		feather: m.feather,
		invert: m.invert,
		rotation: m.rotation,
		corner_radius: m.cornerRadius ?? 0,
		points: m.points?.length ? m.points.map((p) => ({ x: p.x, y: p.y })) : undefined,
	}));
}

function serializeAnimation(anim?: import("../../types/animations").ElementAnimation): TauriAnimationData | null {
	if (!anim) return null;
	return {
		anim_type: anim.type,
		duration: anim.duration,
		easing: anim.easing,
	};
}

function serializeEffects(effects?: VideoEffect[]): TauriVideoEffect[] {
	if (!effects || effects.length === 0) return [];
	return effects
		.filter((e) => e.enabled)
		.map((e) => {
			const params: Record<string, number | string> = {};
			for (const [key, value] of Object.entries(e)) {
				if (key === "id" || key === "type" || key === "enabled" || key === "intensity") continue;
				if (typeof value === "number" || typeof value === "string") {
					params[key] = value;
				}
			}
			return {
				effect_type: e.type,
				enabled: e.enabled,
				intensity: e.intensity,
				params,
			};
		});
}

function serializeCurvePoints(
	pts?: import("../../types/timeline").ColorCurvePoint[],
): [number, number][] | null {
	if (!pts || pts.length < 2) return null;
	return pts.map((p) => [p.x, p.y] as [number, number]);
}

function serializeKeyframes(kf?: import("../../types/keyframes").ElementKeyframes): TauriKeyframeTrack[] | null {
	if (!kf || !kf.tracks) return null;
	const result: TauriKeyframeTrack[] = [];
	for (const [property, track] of Object.entries(kf.tracks)) {
		if (!track || track.keyframes.length === 0) continue;
		result.push({
			property,
			keyframes: [...track.keyframes].sort((a, b) => a.offset - b.offset).map((k) => ({
				offset: k.offset,
				value: k.value,
				interpolation: k.interpolation,
			})),
		});
	}
	return result.length > 0 ? result : null;
}

function serializeChromakey(
	ck?: import("../../types/chromakey").ChromakeySettings,
): TauriChromakeySettings | null {
	if (!ck?.enabled) return null;
	return {
		enabled: true,
		color: ck.color,
		similarity: ck.similarity ?? 0,
		smoothness: ck.smoothness ?? 0,
		spill_reduction: ck.spillReduction ?? 0,
	};
}
