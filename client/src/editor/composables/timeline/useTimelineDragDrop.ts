/**
 * Vue composable equivalent of OpenCut's use-timeline-drag-drop.ts
 * Handles drag-and-drop of media, text, stickers, and files onto the timeline.
 */
import { ref, computed, type Ref } from "vue";
import { useEditor } from "../useEditor";
import { processMediaAssets } from "../../lib/media/processing";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import { snapTimeToFrame } from "../../lib/time";
import {
	buildTextElement,
	buildStickerElement,
	buildUploadAudioElement,
	buildVideoElement,
	buildImageElement,
	buildEffectElement,
} from "../../lib/timeline/element-utils";
import { computeDropTarget } from "../../lib/timeline/drop-utils";
import { getDragData, hasDragData } from "../../lib/drag-data";
import type { TrackType, DropTarget, ElementType } from "../../types/timeline";
import type { MediaDragData, StickerDragData, EffectDragData } from "../../types/drag";

interface UseTimelineDragDropProps {
	containerRef: Ref<HTMLDivElement | null>;
	headerRef?: Ref<HTMLElement | null>;
	zoomLevel: Ref<number>;
}

export function useTimelineDragDrop({
	containerRef,
	headerRef,
	zoomLevel,
}: UseTimelineDragDropProps) {
	const { editor, version } = useEditor();
	const isDragOver = ref(false);
	const dropTarget = ref<DropTarget | null>(null);
	const dragElementType = ref<ElementType | null>(null);

	const tracks = computed(() => {
		void version.value;
		return editor.timeline.getTracks();
	});
	const currentTime = computed(() => {
		void version.value;
		return editor.playback.getCurrentTime();
	});
	const mediaAssets = computed(() => {
		void version.value;
		return editor.media.getAssets();
	});
	const activeProject = computed(() => {
		void version.value;
		return editor.project.getActive();
	});

	function getSnappedTime(time: number): number {
		const projectFps = activeProject.value?.settings?.fps ?? 30;
		return snapTimeToFrame({ time, fps: projectFps });
	}

	function getElementType(dataTransfer: DataTransfer): ElementType | null {
		const dragData = getDragData({ dataTransfer });
		if (!dragData) return null;
		if (dragData.type === "text") return "text";
		if (dragData.type === "sticker") return "sticker";
		if (dragData.type === "effect") return "effect";
		if (dragData.type === "media") return dragData.mediaType;
		return null;
	}

	function getElementDuration(elementType: ElementType, mediaId?: string): number {
		if (elementType === "text" || elementType === "sticker") {
			return TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
		}
		if (mediaId) {
			const media = mediaAssets.value.find((m) => m.id === mediaId);
			return media?.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
		}
		return TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
	}

	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		if (!e.dataTransfer) return;
		const hasAsset = hasDragData({ dataTransfer: e.dataTransfer });
		const hasFiles = e.dataTransfer.types.includes("Files");
		if (!hasAsset && !hasFiles) return;
		isDragOver.value = true;
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (!e.dataTransfer) return;

		const rect = containerRef.value?.getBoundingClientRect();
		if (!rect) return;

		const headerHeight = headerRef?.value?.getBoundingClientRect().height ?? 0;
		const hasFiles = e.dataTransfer.types.includes("Files");
		const isExternal = hasFiles && !hasDragData({ dataTransfer: e.dataTransfer });

		const elType = getElementType(e.dataTransfer);

		if (!elType && hasFiles && isExternal) {
			dropTarget.value = null;
			dragElementType.value = null;
			return;
		}

		if (!elType) return;
		dragElementType.value = elType;

		const dragData = getDragData({ dataTransfer: e.dataTransfer });
		const duration = getElementDuration(
			elType,
			dragData?.type === "media" ? dragData.id : undefined,
		);

		const mouseX = e.clientX - rect.left;
		const mouseY = Math.max(0, e.clientY - rect.top - headerHeight);

		const target = computeDropTarget({
			elementType: elType,
			mouseX,
			mouseY,
			tracks: tracks.value,
			playheadTime: currentTime.value,
			isExternalDrop: isExternal,
			elementDuration: duration,
			pixelsPerSecond: TIMELINE_CONSTANTS.PIXELS_PER_SECOND,
			zoomLevel: zoomLevel.value,
		});

		target.xPosition = getSnappedTime(target.xPosition);
		dropTarget.value = target;
		e.dataTransfer.dropEffect = "copy";
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		const rect = containerRef.value?.getBoundingClientRect();
		if (rect) {
			const { clientX, clientY } = e;
			if (
				clientX < rect.left ||
				clientX > rect.right ||
				clientY < rect.top ||
				clientY > rect.bottom
			) {
				isDragOver.value = false;
				dropTarget.value = null;
				dragElementType.value = null;
			}
		}
	}

	function executeTextDrop(target: DropTarget, dragData: { name?: string; content?: string }) {
		let trackId: string;
		if (target.isNewTrack) {
			trackId = editor.timeline.addTrack({ type: "text", index: target.trackIndex });
		} else {
			const track = tracks.value[target.trackIndex];
			if (!track) return;
			trackId = track.id;
		}

		const element = buildTextElement({
			raw: { name: dragData.name ?? "", content: dragData.content ?? "" },
			startTime: target.xPosition,
		});
		editor.timeline.insertElement({ placement: { mode: "explicit", trackId }, element });
	}

	function executeStickerDrop(target: DropTarget, dragData: StickerDragData) {
		let trackId: string;
		if (target.isNewTrack) {
			trackId = editor.timeline.addTrack({ type: "sticker", index: target.trackIndex });
		} else {
			const track = tracks.value[target.trackIndex];
			if (!track) return;
			trackId = track.id;
		}

		const element = buildStickerElement({ iconName: dragData.iconName, startTime: target.xPosition });
		editor.timeline.insertElement({ placement: { mode: "explicit", trackId }, element });
	}

	function executeEffectDrop(target: DropTarget, dragData: EffectDragData) {
		let trackId: string;
		if (target.isNewTrack) {
			trackId = editor.timeline.addTrack({ type: "effect", index: target.trackIndex });
		} else {
			const track = tracks.value[target.trackIndex];
			if (!track) return;
			trackId = track.id;
		}

		const element = buildEffectElement({
			effectType: dragData.effectType as any,
			name: dragData.name,
			intensity: dragData.intensity,
			params: dragData.params,
			startTime: target.xPosition,
		});
		editor.timeline.insertElement({ placement: { mode: "explicit", trackId }, element });
	}

	function executeMediaDrop(target: DropTarget, dragData: MediaDragData) {
		const mediaAsset = mediaAssets.value.find((m) => m.id === dragData.id);
		if (!mediaAsset) return;

		const trackType: TrackType = dragData.mediaType === "audio" ? "audio" : "video";
		let trackId: string;

		if (target.isNewTrack) {
			trackId = editor.timeline.addTrack({ type: trackType, index: target.trackIndex });
		} else {
			const track = tracks.value[target.trackIndex];
			if (!track) return;
			trackId = track.id;
		}

		const duration = mediaAsset.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;

		if (dragData.mediaType === "audio") {
			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId },
				element: buildUploadAudioElement({
					mediaId: mediaAsset.id,
					name: mediaAsset.name,
					duration,
					startTime: target.xPosition,
				}),
			});
		} else if (dragData.mediaType === "video") {
			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId },
				element: buildVideoElement({
					mediaId: mediaAsset.id,
					name: mediaAsset.name,
					duration,
					startTime: target.xPosition,
				}),
			});
		} else {
			editor.timeline.insertElement({
				placement: { mode: "explicit", trackId },
				element: buildImageElement({
					mediaId: mediaAsset.id,
					name: mediaAsset.name,
					duration,
					startTime: target.xPosition,
				}),
			});
		}
	}

	async function executeFileDrop(files: File[], mouseX: number, mouseY: number) {
		if (!activeProject.value) return;

		const processedAssets = await processMediaAssets({ files });

		for (const asset of processedAssets) {
			await editor.media.addMediaAsset({
				projectId: activeProject.value.metadata.id,
				asset,
			});

			const added = editor.media
				.getAssets()
				.find((m) => m.name === asset.name && m.url === asset.url);

			if (added) {
				const duration = added.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
				const currentTracks = editor.timeline.getTracks();
				const dt = computeDropTarget({
					elementType: added.type,
					mouseX,
					mouseY,
					tracks: currentTracks,
					playheadTime: currentTime.value,
					isExternalDrop: true,
					elementDuration: duration,
					pixelsPerSecond: TIMELINE_CONSTANTS.PIXELS_PER_SECOND,
					zoomLevel: zoomLevel.value,
				});

				const trackType: TrackType = added.type === "audio" ? "audio" : "video";
				const trackId = dt.isNewTrack
					? editor.timeline.addTrack({ type: trackType, index: dt.trackIndex })
					: currentTracks[dt.trackIndex]?.id;

				if (!trackId) return;

				if (added.type === "audio") {
					editor.timeline.insertElement({
						placement: { mode: "explicit", trackId },
						element: buildUploadAudioElement({
							mediaId: added.id,
							name: added.name,
							duration,
							startTime: dt.xPosition,
							buffer: new AudioBuffer({ length: 1, sampleRate: 44100 }),
						}),
					});
				} else if (added.type === "video") {
					editor.timeline.insertElement({
						placement: { mode: "explicit", trackId },
						element: buildVideoElement({
							mediaId: added.id,
							name: added.name,
							duration,
							startTime: dt.xPosition,
						}),
					});
				} else {
					editor.timeline.insertElement({
						placement: { mode: "explicit", trackId },
						element: buildImageElement({
							mediaId: added.id,
							name: added.name,
							duration,
							startTime: dt.xPosition,
						}),
					});
				}
			}
		}
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		if (!e.dataTransfer) return;

		const hasAsset = hasDragData({ dataTransfer: e.dataTransfer });
		const hasFiles = (e.dataTransfer.files?.length ?? 0) > 0;

		if (!hasAsset && !hasFiles) return;

		const currentTarget = dropTarget.value;
		isDragOver.value = false;
		dropTarget.value = null;
		dragElementType.value = null;

		try {
			if (hasAsset) {
				if (!currentTarget) return;
				const dragData = getDragData({ dataTransfer: e.dataTransfer });
				if (!dragData) return;

				if (dragData.type === "text") {
					executeTextDrop(currentTarget, dragData);
				} else if (dragData.type === "sticker") {
					executeStickerDrop(currentTarget, dragData);
				} else if (dragData.type === "effect") {
					executeEffectDrop(currentTarget, dragData);
				} else {
					executeMediaDrop(currentTarget, dragData);
				}
			} else if (hasFiles) {
				const rect = containerRef.value?.getBoundingClientRect();
				if (!rect) return;
				const mouseX = e.clientX - rect.left;
				const headerHeight = headerRef?.value?.getBoundingClientRect().height ?? 0;
				const mouseY = Math.max(0, e.clientY - rect.top - headerHeight);
				await executeFileDrop(Array.from(e.dataTransfer.files), mouseX, mouseY);
			}
		} catch (err) {
			console.error("[TimelineDragDrop] Failed to process drop:", err);
		}
	}

	return {
		isDragOver,
		dropTarget,
		dragElementType,
		handleDragEnter,
		handleDragOver,
		handleDragLeave,
		handleDrop,
	};
}
