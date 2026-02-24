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
import { isMainTrack } from "../../lib/timeline/track-utils";
import { getMainTrackMagnet } from "./useTimelineTools";
import type { TrackType, DropTarget, ElementType } from "../../types/timeline";
import type { MediaDragData, StickerDragData, EffectDragData, TransitionDragData } from "../../types/drag";
import { generateUUID } from "../../utils/id";
import { SetTransitionCommand } from "../../lib/commands/scene";

interface UseTimelineDragDropProps {
	containerRef: Ref<HTMLDivElement | null>;
	headerRef?: Ref<HTMLElement | null>;
	scrollRef?: Ref<HTMLDivElement | null>;
	zoomLevel: Ref<number>;
}

export function useTimelineDragDrop({
	containerRef,
	headerRef,
	scrollRef,
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
		return editor.project.getActiveOrNull();
	});

	function getSnappedTime(time: number): number {
		const projectFps = activeProject.value?.settings?.fps ?? 30;
		return snapTimeToFrame({ time, fps: projectFps });
	}

	function getElementType(dataTransfer: DataTransfer): ElementType | "transition" | null {
		const dragData = getDragData({ dataTransfer });
		if (!dragData) return null;
		if (dragData.type === "text") return "text";
		if (dragData.type === "sticker") return "sticker";
		if (dragData.type === "effect") return "effect";
		if (dragData.type === "transition") return "transition";
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

		// Transitions don't use normal drop targets — just track cursor position
		if (elType === "transition") {
			dragElementType.value = null;
			const sl = scrollRef?.value?.scrollLeft ?? 0;
			const mouseX = e.clientX - rect.left + sl;
			const timeAtCursor = Math.max(0, mouseX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value));
			// Find nearest junction on a video track
			const junction = findNearestJunction(timeAtCursor);
			if (junction) {
				dropTarget.value = {
					trackIndex: tracks.value.indexOf(tracks.value.find((t) => t.id === junction.trackId)!),
					isNewTrack: false,
					insertPosition: null,
					xPosition: junction.junctionTime,
					targetElementId: junction.rightElementId,
					targetTrackId: junction.trackId,
				};
			} else {
				dropTarget.value = null;
			}
			e.dataTransfer.dropEffect = "copy";
			return;
		}

		dragElementType.value = elType as ElementType;

		const dragData = getDragData({ dataTransfer: e.dataTransfer });
		const duration = getElementDuration(
			elType,
			dragData?.type === "media" ? dragData.id : undefined,
		);

		const sl = scrollRef?.value?.scrollLeft ?? 0;
		const mouseX = e.clientX - rect.left + sl;
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
		// Effect-on-element: add effect to the target element's effects[] array
		if (target.targetElementId && target.targetTrackId) {
			const track = tracks.value.find((t) => t.id === target.targetTrackId);
			if (!track) return;
			const el = track.elements.find((e) => e.id === target.targetElementId);
			if (!el) return;

			const existingEffects = (el as any).effects ?? [];
			const newEffect = {
				id: `${dragData.effectType}_${Date.now()}`,
				type: dragData.effectType,
				enabled: true,
				intensity: dragData.intensity,
				...dragData.params,
			};

			editor.timeline.updateElement({
				trackId: target.targetTrackId,
				elementId: target.targetElementId,
				updates: { effects: [...existingEffects, newEffect] },
			});
			return;
		}

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

	function executeTransitionDrop(dragData: TransitionDragData, mouseX: number) {
		const timeAtCursor = Math.max(0, mouseX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value));
		const junction = findNearestJunction(timeAtCursor);
		if (!junction) return;

		const transition = {
			id: generateUUID(),
			type: dragData.transitionType as any,
			duration: dragData.duration,
			targetElementId: junction.rightElementId,
			trackId: junction.trackId,
		};

		const command = new SetTransitionCommand(transition, junction.rightElementId);
		editor.command.execute({ command });
	}

	/**
	 * Find the nearest junction between two adjacent video elements.
	 * A junction is where one element ends and the next begins on the same track.
	 */
	function findNearestJunction(timeAtCursor: number): {
		trackId: string;
		leftElementId: string;
		rightElementId: string;
		junctionTime: number;
	} | null {
		const SNAP_THRESHOLD = 1.0; // seconds
		let best: ReturnType<typeof findNearestJunction> = null;
		let bestDist = Infinity;

		for (const track of tracks.value) {
			if (track.type !== "video") continue;
			const sorted = [...track.elements].sort((a, b) => a.startTime - b.startTime);
			for (let i = 0; i < sorted.length - 1; i++) {
				const left = sorted[i];
				const right = sorted[i + 1];
				const junctionTime = left.startTime + left.duration;
				// Only consider junctions where elements are adjacent (gap < 0.1s)
				if (Math.abs(right.startTime - junctionTime) > 0.1) continue;
				const dist = Math.abs(timeAtCursor - junctionTime);
				if (dist < bestDist && dist < SNAP_THRESHOLD) {
					bestDist = dist;
					best = {
						trackId: track.id,
						leftElementId: left.id,
						rightElementId: right.id,
						junctionTime,
					};
				}
			}
		}
		return best;
	}

	function rippleInsertOnMainTrack(trackId: string, insertTime: number, insertDuration: number) {
		if (!getMainTrackMagnet()) return;
		const track = editor.timeline.getTracks().find((t) => t.id === trackId);
		if (!track || !isMainTrack(track)) return;

		const elementIdsToShift = track.elements
			.filter((e) => e.startTime >= insertTime)
			.map((e) => e.id);

		if (elementIdsToShift.length > 0) {
			editor.timeline.moveElementsBatch({
				trackId,
				elementIds: elementIdsToShift,
				timeDelta: insertDuration,
			});
		}
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

		// Auto-ripple: push subsequent elements right on main track before inserting
		rippleInsertOnMainTrack(trackId, target.xPosition, duration);

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
				const dragData = getDragData({ dataTransfer: e.dataTransfer });
				if (!dragData) return;

				if (dragData.type === "transition") {
					const rect = containerRef.value?.getBoundingClientRect();
					const mouseX = rect ? e.clientX - rect.left : 0;
					executeTransitionDrop(dragData, mouseX);
				} else if (dragData.type === "text") {
					if (!currentTarget) return;
					executeTextDrop(currentTarget, dragData);
				} else if (dragData.type === "sticker") {
					if (!currentTarget) return;
					executeStickerDrop(currentTarget, dragData);
				} else if (dragData.type === "effect") {
					if (!currentTarget) return;
					executeEffectDrop(currentTarget, dragData);
				} else {
					if (!currentTarget) return;
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
