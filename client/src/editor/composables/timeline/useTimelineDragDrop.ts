/**
 * Vue composable equivalent of OpenCut's use-timeline-drag-drop.ts
 * Handles drag-and-drop of media, text, stickers, and files onto the timeline.
 *
 * Uses pointer-event-based drag (via usePointerDrag) for intra-webview drags.
 * HTML5 DnD is kept only for OS file drops (from Finder/Explorer).
 */
import { ref, onMounted, onUnmounted, type Ref } from "vue";
import { EditorCore } from "../../core";
import { useTimelineTracks } from "./useTimelineTracks";
import { usePointerDrag } from "../usePointerDrag";
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
import { computeDropTarget, findCompatibleTrack } from "../../lib/timeline/drop-utils";
import { isMainTrack } from "../../lib/timeline/track-utils";
import { getMainTrackMagnet } from "./useTimelineTools";
import type { TrackType, DropTarget, ElementType } from "../../types/timeline";
import type { TimelineDragData, MediaDragData, TextDragData, StickerDragData, EffectDragData, TransitionDragData } from "../../types/drag";
import { generateUUID } from "../../utils/id";
import { SetTransitionCommand } from "../../lib/commands/scene";
import { isAdjacentMediaCuts } from "../../lib/timeline/transition-pairing";

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
	const editor = EditorCore.getInstance();
	const isDragOver = ref(false);
	const dropTarget = ref<DropTarget | null>(null);
	const dragElementType = ref<ElementType | null>(null);
	const transitionDropPreview = ref<{
		trackId: string;
		leftElementId: string;
		rightElementId: string;
		junctionTime: number;
		duration: number;
		label: string;
	} | null>(null);

	// Pointer drag system
	const { registerDropZone, unregisterDropZone } = usePointerDrag();

	// `tracks` is read frequently inside drag callbacks, so we keep it reactive
	// (via the shared timeline subscription). Playback time, media assets and
	// the active project are only consulted on-demand inside event handlers,
	// so they are plain getters — no need to spend a subscription on them.
	const { tracks } = useTimelineTracks();
	const getCurrentTime = () => editor.playback.getCurrentTime();
	const getMediaAssets = () => editor.media.getAssets();
	const getActiveProject = () => editor.project.getActiveOrNull();

	function getSnappedTime(time: number): number {
		const projectFps = getActiveProject()?.settings?.fps ?? 30;
		return snapTimeToFrame({ time, fps: projectFps });
	}

	function getElementTypeFromData(data: TimelineDragData): ElementType | "transition" | null {
		if (data.type === "text") return "text";
		if (data.type === "sticker") return "sticker";
		if (data.type === "effect") return "effect";
		if (data.type === "transition") return "transition";
		if (data.type === "media") return data.mediaType;
		return null;
	}

	function getElementDuration(elementType: ElementType, mediaId?: string): number {
		if (elementType === "text" || elementType === "sticker") {
			return TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
		}
		if (mediaId) {
			const media = getMediaAssets().find((m) => m.id === mediaId);
			return media?.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
		}
		return TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
	}

	// ── Pointer-based drag callbacks (registered as drop zone) ──

	function onDragOver(cursor: { x: number; y: number }, data: TimelineDragData) {
		isDragOver.value = true;

		const rect = containerRef.value?.getBoundingClientRect();
		if (!rect) return;

		const headerHeight = headerRef?.value?.getBoundingClientRect().height ?? 0;
		const elType = getElementTypeFromData(data);
		if (!elType) return;

		// Transitions don't use normal drop targets — just track cursor position
		if (elType === "transition") {
			if (data.type !== "transition") return;
			dragElementType.value = null;
			const sl = scrollRef?.value?.scrollLeft ?? 0;
			const mouseX = cursor.x - rect.left + sl;
			const timeAtCursor = Math.max(0, mouseX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value));
			const junction = findNearestJunction(timeAtCursor);
			if (junction) {
				transitionDropPreview.value = {
					trackId: junction.trackId,
					leftElementId: junction.leftElementId,
					rightElementId: junction.rightElementId,
					junctionTime: junction.junctionTime,
					duration: data.duration,
					label: data.name,
				};
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
				transitionDropPreview.value = null;
			}
			return;
		}

		transitionDropPreview.value = null;
		dragElementType.value = elType as ElementType;

		const duration = getElementDuration(
			elType,
			data.type === "media" ? data.id : undefined,
		);

		const sl = scrollRef?.value?.scrollLeft ?? 0;
		const mouseX = cursor.x - rect.left + sl;
		const mouseY = Math.max(0, cursor.y - rect.top - headerHeight);

		const target = computeDropTarget({
			elementType: elType,
			mouseX,
			mouseY,
			tracks: tracks.value,
			playheadTime: getCurrentTime(),
			isExternalDrop: false,
			elementDuration: duration,
			pixelsPerSecond: TIMELINE_CONSTANTS.PIXELS_PER_SECOND,
			zoomLevel: zoomLevel.value,
		});

		target.xPosition = getSnappedTime(target.xPosition);
		dropTarget.value = target;
	}

	function onDragLeave() {
		isDragOver.value = false;
		dropTarget.value = null;
		dragElementType.value = null;
		transitionDropPreview.value = null;
	}

	function onDrop(cursor: { x: number; y: number }, data: TimelineDragData) {
		const currentTarget = dropTarget.value;
		isDragOver.value = false;
		dropTarget.value = null;
		dragElementType.value = null;
		transitionDropPreview.value = null;

		try {
			if (data.type === "transition") {
				const rect = containerRef.value?.getBoundingClientRect();
				const sl = scrollRef?.value?.scrollLeft ?? 0;
				const mouseX = rect ? cursor.x - rect.left + sl : 0;
				executeTransitionDrop(data, mouseX);
			} else if (data.type === "text") {
				if (!currentTarget) return;
				executeTextDrop(currentTarget, data);
			} else if (data.type === "sticker") {
				if (!currentTarget) return;
				executeStickerDrop(currentTarget, data);
			} else if (data.type === "effect") {
				if (!currentTarget) return;
				executeEffectDrop(currentTarget, data);
			} else {
				if (!currentTarget) return;
				executeMediaDrop(currentTarget, data);
			}
		} catch (err) {
			console.error("[TimelineDragDrop] Failed to process drop:", err);
		}
	}

	// Register as a drop zone for the pointer drag system
	onMounted(() => {
		registerDropZone({
			containerRef,
			onDragOver,
			onDragLeave,
			onDrop,
		});
	});

	onUnmounted(() => {
		unregisterDropZone();
	});

	// ── Execute drop functions (unchanged) ──

	function executeTextDrop(target: DropTarget, dragData: TextDragData) {
		let trackId: string;
		if (target.isNewTrack) {
			const compatIdx = findCompatibleTrack({
				tracks: tracks.value,
				elementType: "text",
				startTime: target.xPosition,
				duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
			});
			if (compatIdx >= 0) {
				trackId = tracks.value[compatIdx].id;
			} else {
				trackId = editor.timeline.addTrack({ type: "text", index: target.trackIndex });
			}
		} else {
			const track = tracks.value[target.trackIndex];
			if (!track) return;
			trackId = track.id;
		}

		const raw = dragData.presetElement
			? { ...dragData.presetElement, name: dragData.name ?? "", content: dragData.content ?? "" }
			: { name: dragData.name ?? "", content: dragData.content ?? "" };

		const element = buildTextElement({
			raw,
			startTime: target.xPosition,
		});
		editor.timeline.insertElement({ placement: { mode: "explicit", trackId }, element });
	}

	function executeStickerDrop(target: DropTarget, dragData: StickerDragData) {
		let trackId: string;
		if (target.isNewTrack) {
			const compatIdx = findCompatibleTrack({
				tracks: tracks.value,
				elementType: "sticker",
				startTime: target.xPosition,
				duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
			});
			if (compatIdx >= 0) {
				trackId = tracks.value[compatIdx].id;
			} else {
				trackId = editor.timeline.addTrack({ type: "sticker", index: target.trackIndex });
			}
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
			const compatIdx = findCompatibleTrack({
				tracks: tracks.value,
				elementType: "effect",
				startTime: target.xPosition,
				duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
			});
			if (compatIdx >= 0) {
				trackId = tracks.value[compatIdx].id;
			} else {
				trackId = editor.timeline.addTrack({ type: "effect", index: target.trackIndex });
			}
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
				const outgoingEnd = left.startTime + left.duration;
				// Transition semantics are anchored to the incoming clip start.
				// Keeping the preview and persisted badge on the same coordinate
				// prevents a small imported gap from making the drop jump sideways.
				const junctionTime = right.startTime;
				if (
					!isAdjacentMediaCuts({
						outgoingEnd,
						incomingStart: right.startTime,
					})
				) {
					continue;
				}
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
		const mediaAsset = getMediaAssets().find((m) => m.id === dragData.id);
		if (!mediaAsset) return;

		const trackType: TrackType = dragData.mediaType === "audio" ? "audio" : "video";
		const trackName = dragData.mediaType === "image" ? "Image track" : undefined;
		const duration = mediaAsset.duration ?? TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION;
		let trackId: string;

		if (target.isNewTrack) {
			const compatIdx = findCompatibleTrack({
				tracks: tracks.value,
				elementType: dragData.mediaType,
				startTime: target.xPosition,
				duration,
			});
			if (compatIdx >= 0) {
				trackId = tracks.value[compatIdx].id;
			} else {
				trackId = editor.timeline.addTrack({ type: trackType, index: target.trackIndex, name: trackName });
			}
		} else {
			const track = tracks.value[target.trackIndex];
			if (!track) return;
			trackId = track.id;
		}

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

	// ── OS file drop (HTML5 DnD — kept for external file drops from Finder) ──

	async function executeFileDrop(files: File[], mouseX: number, mouseY: number) {
		const activeProject = getActiveProject();
		if (!activeProject) return;

		const processedAssets = await processMediaAssets({ files });

		for (const asset of processedAssets) {
			await editor.media.addMediaAsset({
				projectId: activeProject.metadata.id,
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
					playheadTime: getCurrentTime(),
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

	/** Handle native file drops from the OS (Finder / Explorer) */
	async function handleFileDrop(e: DragEvent) {
		e.preventDefault();
		if (!e.dataTransfer) return;

		const hasFiles = (e.dataTransfer.files?.length ?? 0) > 0;
		if (!hasFiles) return;

		const rect = containerRef.value?.getBoundingClientRect();
		if (!rect) return;
		const headerHeight = headerRef?.value?.getBoundingClientRect().height ?? 0;
		const mouseX = e.clientX - rect.left;
		const mouseY = Math.max(0, e.clientY - rect.top - headerHeight);

		try {
			await executeFileDrop(Array.from(e.dataTransfer.files), mouseX, mouseY);
		} catch (err) {
			console.error("[TimelineDragDrop] Failed to process file drop:", err);
		}
	}

	return {
		isDragOver,
		dropTarget,
		dragElementType,
		transitionDropPreview,
		handleFileDrop,
	};
}
