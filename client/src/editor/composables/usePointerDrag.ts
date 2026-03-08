/**
 * Central pointer-event-based drag composable.
 * Replaces HTML5 DnD which is broken in Tauri 2 / WKWebView for intra-webview drags.
 *
 * Uses provide/inject so panels (drag sources) and timeline (drop target) share state
 * without a global store.
 */
import { ref, provide, inject, type Ref, type InjectionKey } from "vue";
import type { TimelineDragData } from "../types/drag";

// ── Types ──

export interface DropZoneCallbacks {
	containerRef: Ref<HTMLElement | null>;
	onDragOver: (cursor: { x: number; y: number }, data: TimelineDragData) => void;
	onDragLeave: () => void;
	onDrop: (cursor: { x: number; y: number }, data: TimelineDragData) => void;
}

export interface PointerDragContext {
	/** True once drag threshold (5px) is exceeded */
	isDragging: Ref<boolean>;
	/** Current drag payload */
	dragData: Ref<TimelineDragData | null>;
	/** Current cursor position (updated every pointermove) */
	cursorPosition: Ref<{ x: number; y: number }>;
	/** True for one frame after drag ends — used to suppress click handlers */
	wasDragCompleted: Ref<boolean>;

	/** Called by drag sources on pointerdown */
	startDrag: (event: PointerEvent, data: TimelineDragData) => void;
	/** Called by the drop target to register itself */
	registerDropZone: (config: DropZoneCallbacks) => void;
	/** Called by the drop target on unmount */
	unregisterDropZone: () => void;
}

const POINTER_DRAG_KEY: InjectionKey<PointerDragContext> = Symbol("pointerDrag");
const DRAG_THRESHOLD = 5; // px — matches useElementInteraction.ts

// ── Provider (called once in EditorLayout) ──

export function providePointerDrag(): PointerDragContext {
	const isDragging = ref(false);
	const dragData = ref<TimelineDragData | null>(null);
	const cursorPosition = ref({ x: 0, y: 0 });
	const wasDragCompleted = ref(false);

	let startPos = { x: 0, y: 0 };
	let dropZone: DropZoneCallbacks | null = null;
	let isOverDropZone = false;
	let listenersAttached = false;
	let savedBodyUserSelect = "";
	let savedBodyCursor = "";

	function isInsideDropZone(x: number, y: number): boolean {
		if (!dropZone?.containerRef.value) {
			return false;
		}
		const rect = dropZone.containerRef.value.getBoundingClientRect();
		return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
	}

	function setDraggingStyles() {
		savedBodyUserSelect = document.body.style.userSelect;
		savedBodyCursor = document.body.style.cursor;
		document.body.style.userSelect = "none";
		document.body.style.cursor = "grabbing";
	}

	function clearDraggingStyles() {
		document.body.style.userSelect = savedBodyUserSelect;
		document.body.style.cursor = savedBodyCursor;
	}

	function onPointerMove(e: PointerEvent) {
		// Prevent default to stop browser text selection / image drag during drag
		e.preventDefault();

		cursorPosition.value = { x: e.clientX, y: e.clientY };

		if (!isDragging.value) {
			const dx = e.clientX - startPos.x;
			const dy = e.clientY - startPos.y;
			if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
				isDragging.value = true;
				setDraggingStyles();
				console.debug("[PointerDrag] Drag started, data:", dragData.value?.type);
			} else {
				return;
			}
		}

		if (!dropZone || !dragData.value) {
			return;
		}

		const over = isInsideDropZone(e.clientX, e.clientY);
		if (over) {
			if (!isOverDropZone) {
				console.debug("[PointerDrag] Entered drop zone");
			}
			isOverDropZone = true;
			dropZone.onDragOver(
				{ x: e.clientX, y: e.clientY },
				dragData.value,
			);
		} else if (isOverDropZone) {
			console.debug("[PointerDrag] Left drop zone");
			isOverDropZone = false;
			dropZone.onDragLeave();
		}
	}

	function onPointerUp(e: PointerEvent) {
		removeListeners();

		if (isDragging.value) {
			clearDraggingStyles();

			if (dropZone && dragData.value && isInsideDropZone(e.clientX, e.clientY)) {
				console.debug("[PointerDrag] Drop on zone, data:", dragData.value.type);
				dropZone.onDrop(
					{ x: e.clientX, y: e.clientY },
					dragData.value,
				);
			} else if (dropZone && isOverDropZone) {
				dropZone.onDragLeave();
			}

			wasDragCompleted.value = true;
			requestAnimationFrame(() => {
				wasDragCompleted.value = false;
			});
		}

		isDragging.value = false;
		dragData.value = null;
		isOverDropZone = false;
	}

	function removeListeners() {
		if (listenersAttached) {
			document.removeEventListener("pointermove", onPointerMove);
			document.removeEventListener("pointerup", onPointerUp);
			listenersAttached = false;
		}
	}

	function startDrag(event: PointerEvent, data: TimelineDragData) {
		// Only handle primary button (left click)
		if (event.button !== 0) return;

		// Clean up any stale listeners from a previous drag that didn't complete
		removeListeners();
		if (isDragging.value) {
			clearDraggingStyles();
			isDragging.value = false;
			dragData.value = null;
			isOverDropZone = false;
		}

		// Release implicit pointer capture — WKWebView may capture the pointer
		// to the source element, preventing document-level listeners from firing.
		if (event.target instanceof Element) {
			try {
				event.target.releasePointerCapture(event.pointerId);
			} catch {
				// Ignore — not all elements support this
			}
		}

		startPos = { x: event.clientX, y: event.clientY };
		dragData.value = data;
		cursorPosition.value = { x: event.clientX, y: event.clientY };

		document.addEventListener("pointermove", onPointerMove);
		document.addEventListener("pointerup", onPointerUp);
		listenersAttached = true;

		console.debug("[PointerDrag] startDrag called, type:", data.type, "dropZone registered:", !!dropZone);
	}

	function registerDropZone(config: DropZoneCallbacks) {
		dropZone = config;
		console.debug("[PointerDrag] Drop zone registered, containerRef:", !!config.containerRef.value);
	}

	function unregisterDropZone() {
		dropZone = null;
	}

	const ctx: PointerDragContext = {
		isDragging,
		dragData,
		cursorPosition,
		wasDragCompleted,
		startDrag,
		registerDropZone,
		unregisterDropZone,
	};

	provide(POINTER_DRAG_KEY, ctx);
	return ctx;
}

// ── Consumer (called in drag sources + drop targets) ──

export function usePointerDrag(): PointerDragContext {
	const ctx = inject(POINTER_DRAG_KEY);
	if (!ctx) {
		throw new Error(
			"usePointerDrag() called without a provider. " +
			"Make sure providePointerDrag() is called in a parent component (e.g. EditorLayout).",
		);
	}
	return ctx;
}
