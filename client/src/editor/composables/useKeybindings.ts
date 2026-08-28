/**
 * Vue composable equivalent of OpenCut's use-keybindings.ts
 * Listens for keyboard events and dispatches actions based on keybinding config.
 */
import { onMounted, onUnmounted } from "vue";
import { bindAction, invokeAction, unbindAction } from "../lib/actions";
import { useTimelineTools } from "./timeline/useTimelineTools";
import { EditorCore } from "../core";
import { IMAGE_TOOL_RAIL, useImageEditorTools } from "./useImageEditorTools";
import type { PixelToolId } from "../types/image-document";

function isEditableTarget(target: EventTarget | null): boolean {
	if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
	return (
		target.tagName === "INPUT" ||
		target.tagName === "TEXTAREA" ||
		target.tagName === "SELECT" ||
		target.isContentEditable
	);
}

export function handleEditorKeyDown(ev: KeyboardEvent) {
	const activeElement = typeof document === "undefined" ? null : document.activeElement;
	if (isEditableTarget(ev.target) || isEditableTarget(activeElement)) return;

	const key = ev.key.toLowerCase();
	const ctrl = ev.ctrlKey || ev.metaKey;
	const shift = ev.shiftKey;
	const alt = ev.altKey;

	if (EditorCore.getInstance().imageMode && !ctrl && !alt) {
		if (key === "escape") {
			useImageEditorTools().setSelection(null);
			ev.preventDefault();
			return;
		}
		if (key === "x" && !shift) {
			useImageEditorTools().swapFillStroke();
			ev.preventDefault();
			return;
		}
		if (key === "m" && shift) {
			const tools = useImageEditorTools();
			tools.marqueeKind.value = tools.marqueeKind.value === "rect" ? "ellipse" : "rect";
			tools.activateTool("marquee-rect");
			ev.preventDefault();
			return;
		}
		const tool = IMAGE_TOOL_RAIL.find((item) => item.shortcut.toLowerCase() === key);
		if (tool) {
			useImageEditorTools().activateTool(tool.id as PixelToolId);
			ev.preventDefault();
			return;
		}
	}

	let handled = false;

	if (key === " " && !ctrl && !alt) {
		invokeAction("toggle-play", undefined, "keypress");
		handled = true;
	} else if (key === "k" && !ctrl && !shift && !alt) {
		invokeAction("toggle-play", undefined, "keypress");
		handled = true;
	} else if (key === "j" && !ctrl && !shift && !alt) {
		invokeAction("seek-backward", { seconds: 1 }, "keypress");
		handled = true;
	} else if (key === "l" && !ctrl && !shift && !alt) {
		invokeAction("seek-forward", { seconds: 1 }, "keypress");
		handled = true;
	} else if (key === "arrowright" && !ctrl && !shift) {
		invokeAction("frame-step-forward", undefined, "keypress");
		handled = true;
	} else if (key === "arrowleft" && !ctrl && !shift) {
		invokeAction("frame-step-backward", undefined, "keypress");
		handled = true;
	} else if (key === "arrowright" && shift && !ctrl) {
		invokeAction("jump-forward", { seconds: 5 }, "keypress");
		handled = true;
	} else if (key === "arrowleft" && shift && !ctrl) {
		invokeAction("jump-backward", { seconds: 5 }, "keypress");
		handled = true;
	} else if (key === "." && !ctrl) {
		invokeAction("frame-step-forward", undefined, "keypress");
		handled = true;
	} else if (key === "," && !ctrl) {
		invokeAction("frame-step-backward", undefined, "keypress");
		handled = true;
	} else if (key === "home" || key === "enter") {
		invokeAction("goto-start", undefined, "keypress");
		handled = true;
	} else if (key === "end") {
		invokeAction("goto-end", undefined, "keypress");
		handled = true;
	} else if (key === "s" && !ctrl) {
		invokeAction("split", undefined, "keypress");
		handled = true;
	} else if (key === "q" && !ctrl && !shift && !alt) {
		invokeAction("split-left", undefined, "keypress");
		handled = true;
	} else if (key === "w" && !ctrl && !shift && !alt) {
		invokeAction("split-right", undefined, "keypress");
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
	} else if (key === "x" && ctrl && !alt) {
		invokeAction("cut-selected", undefined, "keypress");
		handled = true;
	} else if (key === "c" && ctrl && alt) {
		invokeAction("copy-style", undefined, "keypress");
		handled = true;
	} else if (key === "v" && ctrl && alt) {
		invokeAction("paste-style", undefined, "keypress");
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
	} else if (key === "n" && !ctrl && !shift && !alt) {
		invokeAction("toggle-snapping", undefined, "keypress");
		handled = true;
	} else if (key === "f" && shift && !ctrl && !alt) {
		invokeAction("freeze-frame", undefined, "keypress");
		handled = true;
	} else if (key === "?" || (key === "/" && shift)) {
		window.dispatchEvent(new CustomEvent("toggle-shortcuts-modal"));
		handled = true;
	} else if (key === "b" && ctrl) {
		invokeAction("split", undefined, "keypress");
		handled = true;
	} else if (key === "b" && !ctrl) {
		invokeAction("toggle-bookmark", undefined, "keypress");
		handled = true;
	}

	if (handled) ev.preventDefault();
}

/**
 * Simple keybinding listener that maps keyboard shortcuts to editor actions.
 */
export function useKeybindingsListener() {
	const { toggleAutoSnapping } = useTimelineTools();

	onMounted(() => {
		bindAction("toggle-snapping", toggleAutoSnapping);
		document.addEventListener("keydown", handleEditorKeyDown, { capture: true });
	});

	onUnmounted(() => {
		unbindAction("toggle-snapping", toggleAutoSnapping);
		document.removeEventListener("keydown", handleEditorKeyDown, { capture: true });
	});
}

export function useKeybindingDisabler() {
	// Will be fully implemented with the keybindings store in Phase 4
	return {
		disableKeybindings: () => {},
		enableKeybindings: () => {},
	};
}
