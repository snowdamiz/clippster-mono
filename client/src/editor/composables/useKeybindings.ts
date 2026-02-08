/**
 * Vue composable equivalent of OpenCut's use-keybindings.ts
 * Listens for keyboard events and dispatches actions based on keybinding config.
 */
import { onMounted, onUnmounted } from "vue";
import { invokeAction } from "../lib/actions";

/**
 * Simple keybinding listener that maps keyboard shortcuts to editor actions.
 * The full keybinding store will be ported in Phase 4 with the UI components.
 * For now, this provides essential keyboard shortcuts.
 */
export function useKeybindingsListener() {
	function handleKeyDown(ev: KeyboardEvent) {
		const activeElement = document.activeElement;
		const isTextInput =
			activeElement &&
			(activeElement.tagName === "INPUT" ||
				activeElement.tagName === "TEXTAREA" ||
				(activeElement as HTMLElement).isContentEditable);

		if (isTextInput) return;

		// Map common shortcuts
		const key = ev.key.toLowerCase();
		const ctrl = ev.ctrlKey || ev.metaKey;
		const shift = ev.shiftKey;

		let handled = false;

		if (key === " ") {
			invokeAction("toggle-play", undefined, "keypress");
			handled = true;
		} else if (key === "arrowright" && !ctrl && !shift) {
			invokeAction("seek-forward", { seconds: 1 }, "keypress");
			handled = true;
		} else if (key === "arrowleft" && !ctrl && !shift) {
			invokeAction("seek-backward", { seconds: 1 }, "keypress");
			handled = true;
		} else if (key === "arrowright" && shift) {
			invokeAction("jump-forward", { seconds: 5 }, "keypress");
			handled = true;
		} else if (key === "arrowleft" && shift) {
			invokeAction("jump-backward", { seconds: 5 }, "keypress");
			handled = true;
		} else if (key === "." && !ctrl) {
			invokeAction("frame-step-forward", undefined, "keypress");
			handled = true;
		} else if (key === "," && !ctrl) {
			invokeAction("frame-step-backward", undefined, "keypress");
			handled = true;
		} else if (key === "home") {
			invokeAction("goto-start", undefined, "keypress");
			handled = true;
		} else if (key === "end") {
			invokeAction("goto-end", undefined, "keypress");
			handled = true;
		} else if (key === "s" && !ctrl) {
			invokeAction("split", undefined, "keypress");
			handled = true;
		} else if (key === "delete" || key === "backspace") {
			invokeAction("delete-selected", undefined, "keypress");
			handled = true;
		} else if (key === "a" && ctrl) {
			invokeAction("select-all", undefined, "keypress");
			handled = true;
		} else if (key === "d" && ctrl) {
			invokeAction("duplicate-selected", undefined, "keypress");
			handled = true;
		} else if (key === "c" && ctrl) {
			invokeAction("copy-selected", undefined, "keypress");
			handled = true;
		} else if (key === "v" && ctrl) {
			invokeAction("paste-copied", undefined, "keypress");
			handled = true;
		} else if (key === "z" && ctrl && !shift) {
			invokeAction("undo", undefined, "keypress");
			handled = true;
		} else if ((key === "z" && ctrl && shift) || (key === "y" && ctrl)) {
			invokeAction("redo", undefined, "keypress");
			handled = true;
		} else if (key === "m" && !ctrl) {
			invokeAction("toggle-elements-muted-selected", undefined, "keypress");
			handled = true;
		} else if (key === "b" && !ctrl) {
			invokeAction("toggle-bookmark", undefined, "keypress");
			handled = true;
		}

		if (handled) {
			ev.preventDefault();
		}
	}

	onMounted(() => {
		document.addEventListener("keydown", handleKeyDown, { capture: true });
	});

	onUnmounted(() => {
		document.removeEventListener("keydown", handleKeyDown, { capture: true });
	});
}

export function useKeybindingDisabler() {
	// Will be fully implemented with the keybindings store in Phase 4
	return {
		disableKeybindings: () => {},
		enableKeybindings: () => {},
	};
}
