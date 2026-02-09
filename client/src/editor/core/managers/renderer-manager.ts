import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { EditorCore } from "../../core";
import type { RootNode } from "../../renderer/nodes/root-node";
import type { ExportOptions, ExportResult } from "../../types/export";
import type { TimelineTrack, VideoElement, ImageElement, TextElement, AudioElement, StickerElement, EffectElement, CaptionElement } from "../../types/timeline";
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
import { resolveWatermarkById } from "@/services/database/watermarks";
import { getIntroOutroById } from "@/services/database/intro-outros";

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
	animation_in: TauriAnimationData | null;
	animation_out: TauriAnimationData | null;
	animation_loop: TauriAnimationData | null;
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

interface TauriTransitionData {
	transition_type: string;
	duration: number;
	target_element_index: number;
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
	intro_path: string | null;
	intro_duration: number | null;
	outro_path: string | null;
	outro_duration: number | null;
}

interface BrandingExportData {
	watermark: TauriBrandingWatermark | null;
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

			// Prompt user for save location
			const extension = options.format === "webm" ? "webm" : "mp4";
			const outputPath = await save({
				defaultPath: `${activeProject.metadata.name}.${extension}`,
				filters: [
					{
						name: extension.toUpperCase(),
						extensions: [extension],
					},
				],
			});

			if (!outputPath) {
				return { success: false, cancelled: true };
			}

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
		const videoSources: TauriVideoSource[] = [];
		const audioTracks: TauriAudioTrack[] = [];

		const effectOverlays: TauriEffectOverlay[] = [];

		for (const track of tracks) {
			if (track.type === "video") {
				for (const el of track.elements) {
					const videoEl = el as VideoElement;
					const asset = mediaAssets.find((a) => a.id === videoEl.mediaId);
					if (!asset) continue;

					// Use filePath from SQLite storage, fall back to URL-based extraction
					const sourcePath = asset.filePath || (asset.url ? this.resolveFilePath(asset.url) : null);
					if (!sourcePath) continue;

					videoSources.push({
						source_path: sourcePath,
						start_time: videoEl.startTime,
						end_time: videoEl.startTime + videoEl.duration,
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
						animation_in: serializeAnimation(videoEl.animationIn),
						animation_out: serializeAnimation(videoEl.animationOut),
						animation_loop: serializeAnimation(videoEl.animationLoop),
					});
				}
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
					// Find the index of the target element in videoSources
					const targetIdx = videoSources.findIndex(
						(vs) => {
							// Match by finding the video element with this ID on the track
							const track = tracks.find((tr) => tr.id === t.trackId);
							if (!track) return false;
							const el = track.elements.find((e) => e.id === t.targetElementId);
							if (!el) return false;
							return Math.abs(vs.start_time - el.startTime) < 0.001;
						},
					);
					if (targetIdx > 0) {
						transitionData.push({
							transition_type: t.type,
							duration: t.duration,
							target_element_index: targetIdx,
						});
					}
				}
			}
		} catch {
			// No scene transitions
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
			cover_timestamp: coverTimestamp ?? null,
			branding_watermark: brandingExport.watermark,
			intro_path: brandingExport.introPath,
			intro_duration: brandingExport.introDuration,
			outro_path: brandingExport.outroPath,
			outro_duration: brandingExport.outroDuration,
		};
	}

	/**
	 * Resolve a video server URL back to a local file path.
	 * URLs are in the format: http://localhost:PORT/video/BASE64_ENCODED_PATH
	 */
	private resolveFilePath(url: string): string | null {
		try {
			const match = url.match(/\/video\/(.+)$/);
			if (match) {
				return atob(match[1]);
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
			introPath: null,
			introDuration: null,
			outroPath: null,
			outroDuration: null,
		};

		try {
			const { getWatermarkForCanvasSize, getActiveIntro, getActiveOutro } = useBrandingConfig();

			// Detect aspect ratio from canvas size
			const ratioMap: Record<string, AspectRatioId> = {
				"1920x1080": "16:9",
				"1080x1920": "9:16",
				"1080x1080": "1:1",
				"1080x1350": "4:5",
			};
			const ratioKey = `${canvasSize.width}x${canvasSize.height}`;
			const aspectRatio = ratioMap[ratioKey];

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
					const introAsset = await getIntroOutroById(introConfig.assetId);
					if (introAsset) {
						result.introPath = introAsset.file_path;
						result.introDuration = introAsset.duration ?? null;
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
					const outroAsset = await getIntroOutroById(outroConfig.assetId);
					if (outroAsset) {
						result.outroPath = outroAsset.file_path;
						result.outroDuration = outroAsset.duration ?? null;
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
