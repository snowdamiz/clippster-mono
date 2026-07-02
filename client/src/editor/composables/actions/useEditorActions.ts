/**
 * Vue composable equivalent of OpenCut's use-editor-actions.ts
 * Registers all core editor action handlers (play, seek, split, delete, etc.)
 */
import { useActionHandler } from "./useActionHandler";
import { useEditor } from "../useEditor";
import { useElementSelection } from "../timeline/element/useElementSelection";
import { SetTransitionCommand } from "../../lib/commands/scene";
import { getElementsAtTime } from "../../lib/timeline";
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
		const transitionId = editor.selection.getSelectedTransitionId();
		if (transitionId) {
			let scene;
			try {
				scene = editor.scenes.getActiveScene();
			} catch {
				return;
			}
			const tr = scene?.transitions?.find((t) => t.id === transitionId);
			if (tr) {
				const command = new SetTransitionCommand(null, tr.targetElementId);
				editor.command.execute({ command });
			}
			clearElementSelection();
			return;
		}

		if (selectedElements.value.length === 0) return;

		const elementsToDelete = [...selectedElements.value];
		clearElementSelection();
		editor.timeline.deleteElements({ elements: elementsToDelete });
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
