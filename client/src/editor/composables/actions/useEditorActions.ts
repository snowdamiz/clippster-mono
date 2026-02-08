/**
 * Vue composable equivalent of OpenCut's use-editor-actions.ts
 * Registers all core editor action handlers (play, seek, split, delete, etc.)
 */
import { useActionHandler } from "./useActionHandler";
import { useEditor } from "../useEditor";
import { useElementSelection } from "../timeline/element/useElementSelection";
import { getElementsAtTime } from "../../lib/timeline";

export function useEditorActions() {
	const { editor } = useEditor();
	const { selectedElements, setElementSelection } = useElementSelection();

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
		editor.timeline.deleteElements({ elements: selectedElements.value });
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

	useActionHandler("toggle-bookmark", () => {
		editor.scenes.toggleBookmark({ time: editor.playback.getCurrentTime() });
	});

	useActionHandler("copy-selected", () => {
		if (selectedElements.value.length === 0) return;
		// Copy to clipboard will be handled by the timeline store in Phase 4
		console.log("[EditorActions] Copy selected:", selectedElements.value.length, "elements");
	});

	useActionHandler("paste-copied", () => {
		// Paste from clipboard will be handled by the timeline store in Phase 4
		console.log("[EditorActions] Paste at:", editor.playback.getCurrentTime());
	});

	useActionHandler("undo", () => {
		editor.command.undo();
	});

	useActionHandler("redo", () => {
		editor.command.redo();
	});
}
