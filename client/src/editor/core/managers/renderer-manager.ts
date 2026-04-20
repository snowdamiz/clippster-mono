import { invoke } from "@tauri-apps/api/core";
import type { EditorCore } from "../../core";
import type { RootNode } from "../../renderer/nodes/root-node";
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
} from "../../types/timeline";
import type { MediaAsset } from "../../types/assets";
import type { VideoEffect } from "../../types/effects";
import type { AspectRatioId } from "../../types/project";
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
}

interface TauriStickerOverlay {
	image_path: string;
	start_time: number;
	end_time: number;
	animation_in: TauriAnimationData | null;
	animation_out: TauriAnimationData | null;
	animation_loop: TauriAnimationData | null;
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
	width: number;
	height: number;
	cover_timestamp: number | null;
	branding_watermark: TauriBrandingWatermark | null;
	branding_overlays: TauriBrandingOverlay[] | null;
	intro_path: string | null;
	intro_duration: number | null;
	outro_path: string | null;
	outro_duration: number | null;
}

interface BrandingExportData {
	watermark: TauriBrandingWatermark | null;
	overlays: TauriBrandingOverlay[] | null;
	introPath: string | null;
	introDuration: number | null;
	outroPath: string | null;
	outroDuration: number | null;
}

export class RendererManager {
	private renderTree: RootNode | null = null;
	private listeners = new Set<() => void>();

	constructor(private editor: EditorCore) {}

	setRenderTree({ renderTree }: { renderTree: RootNode | null }): void {
		this.renderTree = renderTree;
		this.notify();
	}

	getRenderTree(): RootNode | null {
		return this.renderTree;
	}

	async exportProject({
		options,
	}: {
		options: ExportOptions;
	}): Promise<ExportResult> {
		const { onProgress } = options;

		try {
			const tracks = this.editor.timeline.getTracks();
			const mediaAssets = this.editor.media.getAssets();
			const activeProject = this.editor.project.getActive();

			if (!activeProject) {
				return { success: false, error: "No active project" };
			}

			const duration = this.editor.timeline.getTotalDuration();
			if (duration === 0) {
				return { success: false, error: "Project is empty" };
			}

			const canvasSize = options.canvasSize ?? activeProject.settings.canvasSize;
			const extension = options.format === "webm" ? "webm" : "mp4";

			// Always save to Built Clips directory
			const appDataDir = await invoke<string>("get_app_data_dir");
			const timestamp = Date.now();
			const sanitizedName = activeProject.metadata.name.replace(/[^a-zA-Z0-9-_]/g, "_");
			const fileName = `${sanitizedName}_${timestamp}.${extension}`;
			const outputPath = `${appDataDir}/built_clips/${fileName}`;

			// Ensure the built_clips directory exists
			await invoke("create_directory", { path: `${appDataDir}/built_clips` });

			onProgress?.({ progress: 0.05 });

			// Pre-render text elements to transparent PNGs for pixel-perfect export
			const textOverlays = await this.preRenderTextOverlays({ tracks, canvasSize });

			onProgress?.({ progress: 0.1 });

			// Pre-render sticker elements to transparent PNGs for pixel-perfect export
			const stickerOverlays = await this.preRenderStickerOverlays({ tracks, canvasSize });

			onProgress?.({ progress: 0.12 });

			// Pre-render caption elements to transparent PNGs for pixel-perfect export
			const captionOverlays = await this.preRenderCaptionOverlays({ tracks, canvasSize, duration });

			onProgress?.({ progress: 0.15 });

			// Resolve branding config for export
			const brandingExport = await this.resolveBrandingForExport({ canvasSize });

			onProgress?.({ progress: 0.18 });

			// Build export config from timeline data
			const config = this.buildExportConfig({
				tracks,
				mediaAssets,
				outputPath,
				duration,
				canvasSize,
				textOverlays,
				stickerOverlays,
				captionOverlays,
				brandingExport,
			});

			onProgress?.({ progress: 0.2 });

			// Call Tauri FFmpeg export command
			await invoke("export_video_editor_project", { config });

			onProgress?.({ progress: 0.95 });

			// Always create clip in database for Built Clips page
			await this.createClipFromExport({
				outputPath,
				duration,
				projectName: activeProject.metadata.name,
				sourceProjectId: activeProject.settings?.sourceProjectId ?? activeProject.metadata.id,
			});

			onProgress?.({ progress: 1.0 });

			return {
				success: true,
				outputPath,
			};
		} catch (error) {
			console.error("Export failed:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private buildExportConfig({
		tracks,
		mediaAssets,
		outputPath,
		duration,
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
					const start_time = imgEl.startTime;
					const end_time = imgEl.startTime + imgEl.duration;
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
					const start_time = videoEl.startTime;
					const end_time = videoEl.startTime + videoEl.duration;
					const source: TauriVideoSource = {
						source_path: sourcePath,
						start_time,
						end_time,
						trim_start: videoEl.trimStart || null,
						trim_end: videoEl.trimEnd || null,
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
				for (const el of track.elements) {
					const effectEl = el as EffectElement;
					if (!effectEl.enabled) continue;
					effectOverlays.push({
						effect_type: effectEl.effectType,
						enabled: effectEl.enabled,
						intensity: effectEl.intensity,
						params: effectEl.params,
						start_time: effectEl.startTime,
						end_time: effectEl.startTime + effectEl.duration,
					});
				}
			} else if (track.type === "audio") {
				for (const el of track.elements) {
					const audioEl = el as AudioElement;
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
					start_time: audioEl.startTime,
					end_time: audioEl.startTime + audioEl.duration,
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
					const targetIdx = videoSourceElementIndex.get(t.targetElementId);
					if (targetIdx === undefined || targetIdx <= 0) continue;

					const targetTrack = tracks.find((tr) => tr.id === t.trackId);
					const targetElement = targetTrack?.elements.find((el) => el.id === t.targetElementId);
					if (!targetElement) continue;

					transitionData.push({
						transition_type: t.type,
						duration: t.duration,
						target_element_index: targetIdx,
						junction_time: targetElement.startTime,
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
		if (adjustedCoverTimestamp !== null && brandingExport.introDuration) {
			adjustedCoverTimestamp += brandingExport.introDuration;
		}

		return {
			video_sources: videoSources,
			audio_tracks: audioTracks,
			text_overlays: [...textOverlays, ...captionOverlays],
			sticker_overlays: stickerOverlays,
			effect_overlays: effectOverlays,
			transitions: transitionData.length > 0 ? transitionData : null,
			output_path: outputPath,
			total_duration: duration,
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
	}: {
		tracks: TimelineTrack[];
		canvasSize: { width: number; height: number };
	}): Promise<TauriTextOverlay[]> {
		const overlays: TauriTextOverlay[] = [];
		const center = { x: canvasSize.width / 2, y: canvasSize.height / 2 };

		for (const track of tracks) {
			if (track.type !== "text") continue;

			for (const el of track.elements) {
				const textEl = el as TextElement;
				if (!textEl.content?.trim()) continue;

				try {
					const nodeParams: TextNodeParams = {
						...textEl,
						canvasCenter: center,
					};
					const node = new TextNode(nodeParams);

					const result = await node.renderToImage({
						canvasWidth: canvasSize.width,
						canvasHeight: canvasSize.height,
					});
					if (!result) continue;

					// Convert blob to Uint8Array and save via Tauri
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
	}: {
		tracks: TimelineTrack[];
		canvasSize: { width: number; height: number };
	}): Promise<TauriStickerOverlay[]> {
		const overlays: TauriStickerOverlay[] = [];
		let stickerCount = 0;

		for (const track of tracks) {
			if (track.type !== "sticker") continue;

			for (const el of track.elements) {
				const stickerEl = el as StickerElement;
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
						keyframes: stickerEl.keyframes,
					};
					const node = new StickerNode(nodeParams);

					const result = await node.renderToImage({
						canvasWidth: canvasSize.width,
						canvasHeight: canvasSize.height,
					});
					if (!result) {
						console.error(`[Export] StickerNode.renderToImage returned null for ${stickerEl.id} (${stickerEl.iconName})`);
						continue;
					}

					// Convert blob to Uint8Array and save via Tauri
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
	 * Because captions have time-dependent word highlighting (karaoke),
	 * we render one PNG per caption line at the midpoint of that line's
	 * time range so the active word is highlighted correctly.
	 */
	private async preRenderCaptionOverlays({
		tracks,
		canvasSize,
		duration,
	}: {
		tracks: TimelineTrack[];
		canvasSize: { width: number; height: number };
		duration: number;
	}): Promise<TauriTextOverlay[]> {
		const overlays: TauriTextOverlay[] = [];
		const center = { x: canvasSize.width / 2, y: canvasSize.height / 2 };
		let captionCount = 0;

		for (const track of tracks) {
			if (track.type !== "caption") continue;

			for (const el of track.elements) {
				const captionEl = el as CaptionElement;
				if (!captionEl.lines || captionEl.lines.length === 0) continue;
				captionCount++;

				// For each line in the caption element, render a separate PNG
				// at the midpoint of that line's time range
				for (let lineIdx = 0; lineIdx < captionEl.lines.length; lineIdx++) {
					const line = captionEl.lines[lineIdx];
					const lineMidTime = (line.startTime + line.endTime) / 2;

					try {
						const nodeParams: CaptionNodeParams = {
							...captionEl,
							canvasCenter: center,
						};
						const node = new CaptionNode(nodeParams);

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

	/**
	 * Create a clip record in the database after successful export.
	 * This makes the exported video appear in the Built clips section.
	 */
	private async createClipFromExport({
		outputPath,
		duration,
		projectName,
		sourceProjectId,
	}: {
		outputPath: string;
		duration: number;
		projectName: string;
		sourceProjectId: string;
	}): Promise<void> {
		try {
			const { getDatabase, generateId, timestamp, getCurrentUserId } = await import("@/services/database/core");
			const { invoke } = await import("@tauri-apps/api/core");

			// Validate that the project_id exists in the projects table
			// The clips table has a FOREIGN KEY constraint on project_id
			const db = await getDatabase();
			const projectExists = await db.select<{ id: string }[]>(
				'SELECT id FROM projects WHERE id = ?',
				[sourceProjectId]
			);

			// If project doesn't exist (e.g., video editor project), create it
			if (!projectExists || projectExists.length === 0) {
				console.log(
					`[RendererManager] Project '${sourceProjectId}' not found in projects table, creating it for video editor export`
				);
				
				const userId = getCurrentUserId();
				const now = timestamp();
				
				try {
					await db.execute(
						`INSERT INTO projects (id, name, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?)`,
						[sourceProjectId, projectName, now, now, userId]
					);
					console.log(`[RendererManager] Created project entry for video editor project: ${sourceProjectId}`);
				} catch (err) {
					console.error(`[RendererManager] Failed to create project entry:`, err);
					return;
				}
			}

			// Prefer actual muxed duration (matches intro/outro concat and any encoder drift)
			let clipDuration = duration;
			try {
				const meta = await invoke<{ duration: number; width: number; height: number }>(
					"get_video_metadata",
					{ videoPath: outputPath },
				);
				if (meta.duration > 0.05) {
					clipDuration = meta.duration;
				}
			} catch (err) {
				console.warn("[RendererManager] Failed to probe exported file duration:", err);
			}

			// Generate thumbnail — sample early in the file (after intro, duration already includes intro)
			const thumbnailTimestamp = Math.min(1.0, Math.max(0.05, clipDuration / 2));
			let thumbnailPath: string | null = null;

			try {
				thumbnailPath = await invoke<string>("generate_thumbnail_at_timestamp", {
					videoPath: outputPath,
					timestampSeconds: thumbnailTimestamp,
				});
			} catch (err) {
				console.warn("[RendererManager] Failed to generate thumbnail:", err);
				// Non-fatal - clip will be created without thumbnail
			}

			let fileSize: number | null = null;
			try {
				const info = await invoke<{ size: number }>("get_file_info", { path: outputPath });
				fileSize = info.size;
			} catch (err) {
				console.warn("[RendererManager] Failed to get file size:", err);
			}

			// Create clip in database with status='generated' and build_status='completed'
			// This ensures it appears in the Built Clips page
			const clipId = generateId();
			const now = timestamp();
			const userId = getCurrentUserId();

			await db.execute(
				`INSERT INTO clips (
					id, project_id, name, file_path, duration, start_time, end_time,
					status, build_status, built_file_path, built_thumbnail_path,
					built_duration, built_file_size, built_at, created_at, updated_at, user_id, source
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					clipId,
					sourceProjectId,
					projectName,
					outputPath,
					clipDuration,
					0,
					clipDuration,
					'generated', // Mark as generated so it shows in Built Clips
					'completed', // Mark build as completed
					outputPath,
					thumbnailPath,
					clipDuration,
					fileSize,
					now,
					now,
					now,
					userId,
					'video_editor', // Label as video editor export
				]
			);

			console.log("[RendererManager] Created clip in database:", outputPath);
		} catch (err) {
			console.error("[RendererManager] Failed to create clip in database:", err);
			// Non-fatal - export succeeded, just clip creation failed
		}
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => fn());
	}
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
			keyframes: track.keyframes.map((k) => ({
				offset: k.offset,
				value: k.value,
				interpolation: k.interpolation,
			})),
		});
	}
	return result.length > 0 ? result : null;
}
