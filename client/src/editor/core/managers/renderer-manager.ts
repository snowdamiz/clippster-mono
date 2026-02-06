import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { EditorCore } from "../../core";
import type { RootNode } from "../../renderer/nodes/root-node";
import type { ExportOptions, ExportResult } from "../../types/export";
import type { TimelineTrack, VideoElement, TextElement, AudioElement } from "../../types/timeline";
import type { MediaAsset } from "../../types/assets";

interface TauriVideoSource {
	source_path: string;
	start_time: number;
	end_time: number;
	trim_start: number | null;
	trim_end: number | null;
}

interface TauriAudioTrack {
	file_path: string;
	start_time: number;
	end_time: number;
	volume: number;
	is_muted: boolean;
}

interface TauriTextOverlay {
	text: string;
	start_time: number;
	end_time: number;
	position_x: number;
	position_y: number;
	style_data: string;
}

interface TauriExportConfig {
	video_sources: TauriVideoSource[];
	audio_tracks: TauriAudioTrack[];
	text_overlays: TauriTextOverlay[];
	output_path: string;
	total_duration: number;
	width: number;
	height: number;
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

			const canvasSize = activeProject.settings.canvasSize;

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

			onProgress?.({ progress: 0.1 });

			// Build export config from timeline data
			const config = this.buildExportConfig({
				tracks,
				mediaAssets,
				outputPath,
				duration,
				canvasSize,
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
	}: {
		tracks: TimelineTrack[];
		mediaAssets: MediaAsset[];
		outputPath: string;
		duration: number;
		canvasSize: { width: number; height: number };
	}): TauriExportConfig {
		const videoSources: TauriVideoSource[] = [];
		const audioTracks: TauriAudioTrack[] = [];
		const textOverlays: TauriTextOverlay[] = [];

		for (const track of tracks) {
			if (track.type === "video") {
				for (const el of track.elements) {
					const videoEl = el as VideoElement;
					const asset = mediaAssets.find((a) => a.id === videoEl.mediaId);
					if (!asset?.url) continue;

					// Resolve file path from asset URL (localhost video server URL → file path)
					const sourcePath = this.resolveFilePath(asset.url);
					if (!sourcePath) continue;

					videoSources.push({
						source_path: sourcePath,
						start_time: videoEl.startTime,
						end_time: videoEl.startTime + videoEl.duration,
						trim_start: videoEl.trimStart || null,
						trim_end: videoEl.trimEnd || null,
					});
				}
			} else if (track.type === "audio") {
				for (const el of track.elements) {
					const audioEl = el as AudioElement;
					let filePath: string | null = null;

					if (audioEl.sourceType === "upload") {
						const asset = mediaAssets.find((a) => a.id === audioEl.mediaId);
						if (asset?.url) {
							filePath = this.resolveFilePath(asset.url);
						}
					} else if (audioEl.sourceType === "library") {
						filePath = this.resolveFilePath(audioEl.sourceUrl);
					}

					if (!filePath) continue;

					audioTracks.push({
						file_path: filePath,
						start_time: audioEl.startTime,
						end_time: audioEl.startTime + audioEl.duration,
						volume: audioEl.volume ?? 1,
						is_muted: audioEl.muted ?? false,
					});
				}
			} else if (track.type === "text") {
				for (const el of track.elements) {
					const textEl = el as TextElement;
					textOverlays.push({
						text: textEl.content,
						start_time: textEl.startTime,
						end_time: textEl.startTime + textEl.duration,
						position_x: textEl.transform?.position?.x ?? 0.5,
						position_y: textEl.transform?.position?.y ?? 0.5,
						style_data: JSON.stringify({
							fontSize: textEl.fontSize,
							fontFamily: textEl.fontFamily,
							color: textEl.color,
							fontWeight: textEl.fontWeight,
							fontStyle: textEl.fontStyle,
						}),
					});
				}
			}
		}

		return {
			video_sources: videoSources,
			audio_tracks: audioTracks,
			text_overlays: textOverlays,
			output_path: outputPath,
			total_duration: duration,
			width: canvasSize.width,
			height: canvasSize.height,
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

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => fn());
	}
}
