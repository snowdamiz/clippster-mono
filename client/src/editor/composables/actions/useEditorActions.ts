/**
 * Vue composable equivalent of OpenCut's use-editor-actions.ts
 * Registers all core editor action handlers (play, seek, split, delete, etc.)
 */
import { useActionHandler } from "./useActionHandler";
import { useEditor } from "../useEditor";
import { useElementSelection } from "../timeline/element/useElementSelection";
import { getElementsAtTime } from "../../lib/timeline";
import { isMainTrack } from "../../lib/timeline/track-utils";
import { getMainTrackMagnet } from "../timeline/useTimelineTools";
import type { ClipboardItem, CreateTimelineElement } from "../../types/timeline";

export function useEditorActions() {
	const { editor } = useEditor();
	const { selectedElements, setElementSelection, clearElementSelection } = useElementSelection();

	useActionHandler("toggle-play", () => {
		editor.playback.toggle();
	});

	useActionHandler("stop-playback", () => {
		if (editor.playback.getIsPlaying()) {
			editor.playback.toggle();
		}
		editor.playback.seek({ time: 0 });
	});

	useActionHandler("seek-forward", (args) => {
		const seconds = args?.seconds ?? 1;
		editor.playback.seek({
			time: Math.min(
				editor.timeline.getTotalDuration(),
				editor.playback.getCurrentTime() + seconds,
			),
		});
	});

	useActionHandler("seek-backward", (args) => {
		const seconds = args?.seconds ?? 1;
		editor.playback.seek({
			time: Math.max(0, editor.playback.getCurrentTime() - seconds),
		});
	});

	useActionHandler("frame-step-forward", () => {
		const activeProject = editor.project.getActive();
		const fps = activeProject?.settings?.fps ?? 30;
		editor.playback.seek({
			time: Math.min(
				editor.timeline.getTotalDuration(),
				editor.playback.getCurrentTime() + 1 / fps,
			),
		});
	});

	useActionHandler("frame-step-backward", () => {
		const activeProject = editor.project.getActive();
		const fps = activeProject?.settings?.fps ?? 30;
		editor.playback.seek({
			time: Math.max(0, editor.playback.getCurrentTime() - 1 / fps),
		});
	});

	useActionHandler("jump-forward", (args) => {
		const seconds = args?.seconds ?? 5;
		editor.playback.seek({
			time: Math.min(
				editor.timeline.getTotalDuration(),
				editor.playback.getCurrentTime() + seconds,
			),
		});
	});

	useActionHandler("jump-backward", (args) => {
		const seconds = args?.seconds ?? 5;
		editor.playback.seek({
			time: Math.max(0, editor.playback.getCurrentTime() - seconds),
		});
	});

	useActionHandler("goto-start", () => {
		editor.playback.seek({ time: 0 });
	});

	useActionHandler("goto-end", () => {
		editor.playback.seek({ time: editor.timeline.getTotalDuration() });
	});

	useActionHandler("split", () => {
		const currentTime = editor.playback.getCurrentTime();
		const elementsToSplit =
			selectedElements.value.length > 0
				? selectedElements.value
				: getElementsAtTime({
						tracks: editor.timeline.getTracks(),
						time: currentTime,
					});

		if (elementsToSplit.length === 0) return;
		editor.timeline.splitElements({ elements: elementsToSplit, splitTime: currentTime });
	});

	useActionHandler("split-left", () => {
		const currentTime = editor.playback.getCurrentTime();
		const elementsToSplit =
			selectedElements.value.length > 0
				? selectedElements.value
				: getElementsAtTime({
						tracks: editor.timeline.getTracks(),
						time: currentTime,
					});

		if (elementsToSplit.length === 0) return;
		editor.timeline.splitElements({
			elements: elementsToSplit,
			splitTime: currentTime,
			retainSide: "right",
		});
	});

	useActionHandler("split-right", () => {
		const currentTime = editor.playback.getCurrentTime();
		const elementsToSplit =
			selectedElements.value.length > 0
				? selectedElements.value
				: getElementsAtTime({
						tracks: editor.timeline.getTracks(),
						time: currentTime,
					});

		if (elementsToSplit.length === 0) return;
		editor.timeline.splitElements({
			elements: elementsToSplit,
			splitTime: currentTime,
			retainSide: "left",
		});
	});

	useActionHandler("delete-selected", () => {
		if (selectedElements.value.length === 0) return;

		const tracks = editor.timeline.getTracks();
		const mainTrack = tracks.find((t) => isMainTrack(t));
		const shouldRipple = getMainTrackMagnet() && mainTrack;

		// Collect info about main track elements being deleted (before deletion)
		let deletedMainElements: Array<{ startTime: number; duration: number }> = [];
		if (shouldRipple && mainTrack) {
			for (const sel of selectedElements.value) {
				if (sel.trackId === mainTrack.id) {
					const el = mainTrack.elements.find((e) => e.id === sel.elementId);
					if (el) {
						deletedMainElements.push({ startTime: el.startTime, duration: el.duration });
					}
				}
			}
		}

		const elementsToDelete = [...selectedElements.value];
		clearElementSelection();

		editor.timeline.deleteElements({ elements: elementsToDelete });

		// Ripple: shift subsequent main track elements left to close gaps
		if (deletedMainElements.length > 0 && mainTrack) {
			// Sort deleted elements by startTime ascending
			deletedMainElements.sort((a, b) => a.startTime - b.startTime);

			// Calculate total gap to shift by (sum of all deleted durations)
			// Use the earliest deleted element's start as the gap boundary
			const gapStart = deletedMainElements[0].startTime;
			const totalGapDuration = deletedMainElements.reduce((sum, d) => sum + d.duration, 0);

			// Get current state of main track after deletion
			const currentTracks = editor.timeline.getTracks();
			const currentMainTrack = currentTracks.find((t) => isMainTrack(t));
			if (currentMainTrack) {
				// Find elements that start at or after the gap
				const elementIdsToShift = currentMainTrack.elements
					.filter((e) => e.startTime >= gapStart)
					.map((e) => e.id);

				if (elementIdsToShift.length > 0) {
					editor.timeline.moveElementsBatch({
						trackId: currentMainTrack.id,
						elementIds: elementIdsToShift,
						timeDelta: -totalGapDuration,
					});
				}
			}
		}
	});

	useActionHandler("select-all", () => {
		const allElements = editor.timeline.getTracks().flatMap((track) =>
			track.elements.map((element) => ({
				trackId: track.id,
				elementId: element.id,
			})),
		);
		setElementSelection({ elements: allElements });
	});

	useActionHandler("duplicate-selected", () => {
		editor.timeline.duplicateElements({ elements: selectedElements.value });
	});

	useActionHandler("toggle-elements-muted-selected", () => {
		editor.timeline.toggleElementsMuted({ elements: selectedElements.value });
	});

	useActionHandler("toggle-elements-visibility-selected", () => {
		editor.timeline.toggleElementsVisibility({ elements: selectedElements.value });
	});

	useActionHandler("bring-to-front", () => {
		if (selectedElements.value.length === 0) return;
		const sel = selectedElements.value[0];
		editor.timeline.reorderElement({
			trackId: sel.trackId,
			elementId: sel.elementId,
			direction: "front",
		});
	});

	useActionHandler("bring-forward", () => {
		if (selectedElements.value.length === 0) return;
		const sel = selectedElements.value[0];
		editor.timeline.reorderElement({
			trackId: sel.trackId,
			elementId: sel.elementId,
			direction: "forward",
		});
	});

	useActionHandler("send-backward", () => {
		if (selectedElements.value.length === 0) return;
		const sel = selectedElements.value[0];
		editor.timeline.reorderElement({
			trackId: sel.trackId,
			elementId: sel.elementId,
			direction: "backward",
		});
	});

	useActionHandler("send-to-back", () => {
		if (selectedElements.value.length === 0) return;
		const sel = selectedElements.value[0];
		editor.timeline.reorderElement({
			trackId: sel.trackId,
			elementId: sel.elementId,
			direction: "back",
		});
	});

	useActionHandler("extract-audio", () => {
		if (selectedElements.value.length === 0) return;

		// Find the first selected video element
		for (const sel of selectedElements.value) {
			const track = editor.timeline.getTrackById({ trackId: sel.trackId });
			if (!track || track.type !== "video") continue;
			const element = track.elements.find((el) => el.id === sel.elementId);
			if (element?.type === "video") {
				editor.timeline.extractAudio({
					trackId: sel.trackId,
					elementId: sel.elementId,
				});
				break;
			}
		}
	});

	useActionHandler("freeze-frame", async () => {
		const currentTime = editor.playback.getCurrentTime();
		const tracks = editor.timeline.getTracks();

		// Find the video element at the playhead (selected or auto-detected)
		let targetTrackId: string | null = null;
		let targetElementId: string | null = null;

		if (selectedElements.value.length > 0) {
			for (const sel of selectedElements.value) {
				const track = tracks.find((t) => t.id === sel.trackId);
				if (!track || track.type !== "video") continue;
				const el = track.elements.find((e) => e.id === sel.elementId);
				if (el && (el.type === "video" || el.type === "image")) {
					const start = el.startTime;
					const end = el.startTime + el.duration;
					if (currentTime > start && currentTime < end) {
						targetTrackId = sel.trackId;
						targetElementId = sel.elementId;
						break;
					}
				}
			}
		}

		if (!targetTrackId || !targetElementId) {
			const elementsAtTime = getElementsAtTime({ tracks, time: currentTime });
			for (const ref of elementsAtTime) {
				const track = tracks.find((t) => t.id === ref.trackId);
				if (!track || track.type !== "video") continue;
				const el = track.elements.find((e) => e.id === ref.elementId);
				if (el && (el.type === "video" || el.type === "image")) {
					targetTrackId = ref.trackId;
					targetElementId = ref.elementId;
					break;
				}
			}
		}

		if (!targetTrackId || !targetElementId) return;

		// Capture the preview canvas as a PNG
		const canvas = editor.getPreviewCanvas();
		if (!canvas) {
			console.warn("[FreezeFrame] No preview canvas available");
			return;
		}

		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob((b) => resolve(b), "image/png"),
		);
		if (!blob) {
			console.warn("[FreezeFrame] Failed to capture canvas");
			return;
		}

		const file = new File([blob], `freeze-frame-${Date.now()}.png`, { type: "image/png" });

		// Add as ephemeral media asset
		const projectId = editor.project.getActive()?.metadata?.id;
		if (!projectId) return;

		await editor.media.addMediaAsset({
			projectId,
			asset: {
				name: file.name,
				type: "image",
				file,
				url: URL.createObjectURL(file),
				width: canvas.width,
				height: canvas.height,
				ephemeral: true,
			},
		});

		// Find the newly added asset (last one)
		const assets = editor.media.getAssets();
		const freezeAsset = assets[assets.length - 1];
		if (!freezeAsset) return;

		editor.timeline.freezeFrame({
			trackId: targetTrackId,
			elementId: targetElementId,
			splitTime: currentTime,
			mediaId: freezeAsset.id,
		});
	});

	useActionHandler("toggle-bookmark", () => {
		editor.scenes.toggleBookmark({ time: editor.playback.getCurrentTime() });
	});

	useActionHandler("copy-selected", () => {
		if (selectedElements.value.length === 0) return;
		const items: ClipboardItem[] = [];
		for (const sel of selectedElements.value) {
			const track = editor.timeline.getTrackById({ trackId: sel.trackId });
			if (!track) continue;
			const element = track.elements.find((el) => el.id === sel.elementId);
			if (!element) continue;
			const { id, ...rest } = element;
			items.push({
				trackId: sel.trackId,
				trackType: track.type,
				element: rest as CreateTimelineElement,
			});
		}
		editor.selection.setClipboard({ items });
	});

	useActionHandler("cut-selected", () => {
		if (selectedElements.value.length === 0) return;
		// Copy first
		const items: ClipboardItem[] = [];
		for (const sel of selectedElements.value) {
			const track = editor.timeline.getTrackById({ trackId: sel.trackId });
			if (!track) continue;
			const element = track.elements.find((el) => el.id === sel.elementId);
			if (!element) continue;
			const { id, ...rest } = element;
			items.push({
				trackId: sel.trackId,
				trackType: track.type,
				element: rest as CreateTimelineElement,
			});
		}
		editor.selection.setClipboard({ items });
		// Then delete
		editor.timeline.deleteElements({ elements: selectedElements.value });
	});

	useActionHandler("paste-copied", () => {
		const clipboardItems = editor.selection.getClipboard();
		if (clipboardItems.length === 0) return;
		const currentTime = editor.playback.getCurrentTime();
		editor.timeline.pasteAtTime({ time: currentTime, clipboardItems });
	});

	// Copy/paste style
	let copiedStyle: Record<string, unknown> | null = null;

	useActionHandler("copy-style", () => {
		if (selectedElements.value.length === 0) return;
		const sel = selectedElements.value[0];
		const track = editor.timeline.getTrackById({ trackId: sel.trackId });
		if (!track) return;
		const el = track.elements.find((e) => e.id === sel.elementId);
		if (!el) return;

		// Extract style-relevant properties
		const style: Record<string, unknown> = {};
		if ("opacity" in el) style.opacity = el.opacity;
		if ("transform" in el) style.transform = { ...(el as any).transform };
		if ("volume" in el) style.volume = (el as any).volume;
		if ("speed" in el) style.speed = (el as any).speed;
		if ("fadeIn" in el) style.fadeIn = el.fadeIn;
		if ("fadeOut" in el) style.fadeOut = el.fadeOut;
		copiedStyle = style;
	});

	useActionHandler("paste-style", () => {
		if (!copiedStyle || selectedElements.value.length === 0) return;
		for (const sel of selectedElements.value) {
			const track = editor.timeline.getTrackById({ trackId: sel.trackId });
			if (!track) continue;
			const el = track.elements.find((e) => e.id === sel.elementId);
			if (!el) continue;

			// Only apply properties that exist on the target element type
			const updates: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(copiedStyle)) {
				if (key in el) {
					updates[key] = value;
				}
			}
			if (Object.keys(updates).length > 0) {
				editor.timeline.updateElement({
					trackId: sel.trackId,
					elementId: sel.elementId,
					updates: updates as any,
				});
			}
		}
	});

	useActionHandler("undo", () => {
		editor.command.undo();
	});

	useActionHandler("redo", () => {
		editor.command.redo();
	});
}
