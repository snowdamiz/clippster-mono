/**
 * Composable for interactive element manipulation on the preview canvas.
 * Computes bounding boxes for visible elements, handles hit-testing,
 * drag-to-move, resize handles, and rotation.
 *
 * Coordinate system:
 * - Canvas coords: position (0,0) = canvas center, scale=1 = 100%
 * - Screen coords: pixel position on the displayed (scaled) canvas element
 */
import { computed, ref, type Ref } from "vue";
import { useEditor } from "../useEditor";
import { useElementSelection } from "../timeline/element/useElementSelection";
import type {
	TimelineTrack,
	TimelineElement,
	TextElement,
	CaptionElement,
	Transform,
} from "../../types/timeline";
import { isMainTrack } from "../../lib/timeline";

// Singleton offscreen canvas for text measurement
let measureCanvas: HTMLCanvasElement | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D {
	if (!measureCanvas) {
		measureCanvas = document.createElement("canvas");
		measureCtx = measureCanvas.getContext("2d")!;
	}
	return measureCtx!;
}

export type HandlePosition =
	| "top-left"
	| "top-right"
	| "bottom-left"
	| "bottom-right"
	| "rotate";

export interface ElementBounds {
	trackId: string;
	elementId: string;
	elementType: TimelineElement["type"];
	/** Center X in canvas coords */
	cx: number;
	/** Center Y in canvas coords */
	cy: number;
	/** Width in canvas coords (before rotation) */
	width: number;
	/** Height in canvas coords (before rotation) */
	height: number;
	/** Rotation in degrees */
	rotation: number;
	/** Scale factor */
	scale: number;
	/** Original transform reference */
	transform: Transform;
}

interface DragState {
	type: "move" | "resize" | "rotate";
	trackId: string;
	elementId: string;
	/** Starting mouse position in canvas coords */
	startCanvasX: number;
	startCanvasY: number;
	/** Original transform at drag start */
	originalTransform: Transform;
	/** For resize: which handle */
	handle?: HandlePosition;
	/** Original element bounds at drag start */
	originalBounds: ElementBounds;
}

export function usePreviewInteraction({
	canvasRef,
	canvasWidth,
	canvasHeight,
}: {
	canvasRef: Ref<HTMLCanvasElement | null>;
	canvasWidth: Ref<number>;
	canvasHeight: Ref<number>;
}) {
	const { editor, version } = useEditor();
	const { selectedElements, selectElement, clearElementSelection, isElementSelected } = useElementSelection();

	const dragState = ref<DragState | null>(null);
	const hoveredElementId = ref<string | null>(null);

	// Center alignment guides — visible when element position snaps to center
	const showCenterGuideX = ref(false); // vertical line (element centered horizontally)
	const showCenterGuideY = ref(false); // horizontal line (element centered vertically)
	const CENTER_SNAP_THRESHOLD = 6; // pixels in canvas coords

	const tracks = computed(() => {
		void version.value;
		return editor.timeline.getTracks();
	});

	const currentTime = computed(() => {
		void version.value;
		return editor.playback.getCurrentTime();
	});

	/**
	 * Get all visual elements visible at the current time, with their bounding boxes.
	 * Returns in top-to-bottom render order (last = topmost visually).
	 */
	const visibleElements = computed((): ElementBounds[] => {
		void version.value;
		const time = currentTime.value;
		const cw = canvasWidth.value;
		const ch = canvasHeight.value;
		const result: ElementBounds[] = [];

		// Match scene builder render order: main track first (bottom), overlays last (top).
		// hitTest iterates in reverse, so overlays (stickers, text) get checked before main video.
		const allTracks = tracks.value;
		const visibleTracks = allTracks.filter((t) => !("hidden" in t && t.hidden));
		const orderedTracks = [
			...visibleTracks.filter((t) => isMainTrack(t)),
			...visibleTracks.filter((t) => !isMainTrack(t)),
		];

		for (const track of orderedTracks) {
			for (const element of track.elements) {
				if ("hidden" in element && element.hidden) continue;
				const start = element.startTime;
				const end = start + element.duration;
				if (time < start || time >= end) continue;

				if (!("transform" in element)) continue;

				const transform = (element as any).transform as Transform;
				if (!transform) continue;

				const bounds = computeElementBounds({
					element,
					track,
					transform,
					canvasWidth: cw,
					canvasHeight: ch,
				});

				if (bounds) result.push(bounds);
			}
		}

		return result;
	});

	/**
	 * The currently selected element's bounds (if visible).
	 */
	const selectedBounds = computed((): ElementBounds | null => {
		if (selectedElements.value.length === 0) return null;
		const sel = selectedElements.value[0];
		return (
			visibleElements.value.find(
				(b) => b.trackId === sel.trackId && b.elementId === sel.elementId,
			) ?? null
		);
	});

	function computeElementBounds({
		element,
		track,
		transform,
		canvasWidth: cw,
		canvasHeight: ch,
	}: {
		element: TimelineElement;
		track: TimelineTrack;
		transform: Transform;
		canvasWidth: number;
		canvasHeight: number;
	}): ElementBounds | null {
		const cx = cw / 2 + transform.position.x;
		const cy = ch / 2 + transform.position.y;

		let width: number;
		let height: number;

		if (element.type === "video" || element.type === "image") {
			// Get source dimensions from media asset — needed for both cropped and uncropped paths
			const mediaAsset = editor.media.getAssets().find((a) => a.id === (element as any).mediaId);
			const srcW = mediaAsset?.width ?? cw;
			const srcH = mediaAsset?.height ?? ch;

			const crop = (element as any).crop;
			const hasCrop = crop && (crop.top > 0 || crop.right > 0 || crop.bottom > 0 || crop.left > 0);
			if (hasCrop) {
				// Cropped: contain-fit the cropped region into the canvas
				const croppedW = srcW * (1 - crop.left - crop.right);
				const croppedH = srcH * (1 - crop.top - crop.bottom);
				const containScale = Math.min(cw / croppedW, ch / croppedH);
				width = croppedW * containScale * transform.scale;
				height = croppedH * containScale * transform.scale;
			} else {
				// No crop: contain-fit the full media into the canvas (matches VideoNode.render exactly)
				const containScale = Math.min(cw / srcW, ch / srcH);
				width = srcW * containScale * transform.scale;
				height = srcH * containScale * transform.scale;
			}
		} else if (element.type === "text") {
			const textEl = element as TextElement;
			const fontSize = textEl.fontSize ?? 48;
			const content = textEl.content ?? "";
			const fontWeight = textEl.fontWeight === "bold" ? "bold" : textEl.fontWeight || "normal";
			const fontStyle = textEl.fontStyle === "italic" ? "italic" : "normal";
			const fontFamily = textEl.fontFamily ?? "sans-serif";
			const letterSpacing = textEl.letterSpacing ?? 0;
			const lineHeight = textEl.lineHeight ?? 1.2;

			const ctx = getMeasureCtx();
			ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;

			// Measure multiline text
			const lines = (content || " ").split("\n");
			let maxLineW = 0;
			for (const line of lines) {
				let lineW = ctx.measureText(line).width;
				if (letterSpacing > 0) lineW += letterSpacing * Math.max(0, line.length - 1);
				if (lineW > maxLineW) maxLineW = lineW;
			}
			const textW = maxLineW;
			const textH = fontSize * lineHeight * lines.length;

			// Padding: bubble padding or default
			const bubbleStyle = textEl.bubbleStyle ?? "none";
			const bubblePad = bubbleStyle !== "none" ? (textEl.bubblePadding ?? 16) : 0;
			const padX = bubblePad > 0 ? bubblePad : 8;
			const padY = bubblePad > 0 ? bubblePad : 4;

			width = Math.max(textW + padX * 2, 40) * transform.scale;
			height = Math.max(textH + padY * 2, 20) * transform.scale;
		} else if (element.type === "caption") {
			const captionEl = element as CaptionElement;
			const fontSize = captionEl.fontSize ?? 48;
			const maxPerLine = captionEl.maxWordsPerLine ?? 4;
			const lineHeight = captionEl.lineHeight ?? 1.3;
			const letterSpacing = captionEl.letterSpacing ?? 0;
			const fontWeight = captionEl.fontWeight === "bold" || Number(captionEl.fontWeight) >= 700 ? "bold" : captionEl.fontWeight || "normal";
			const fontStyle = captionEl.fontStyle === "italic" ? "italic" : "normal";
			const fontFamily = captionEl.fontFamily ?? "Montserrat";

			const ctx = getMeasureCtx();
			ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;

			// Estimate bounding box from the longest line of words
			// Caption lines contain words; we measure the widest visual line
			let maxLineW = 0;
			let totalVisualLines = 0;
			for (const line of captionEl.lines) {
				const words = line.words ?? [];
				// Words are split into visual lines of maxPerLine each
				for (let i = 0; i < words.length; i += maxPerLine) {
					const chunk = words.slice(i, i + maxPerLine);
					let lineW = 0;
					for (let j = 0; j < chunk.length; j++) {
						const text = chunk[j].word;
						lineW += ctx.measureText(text).width + letterSpacing * text.length;
						if (j < chunk.length - 1) lineW += ctx.measureText(" ").width + letterSpacing;
					}
					if (lineW > maxLineW) maxLineW = lineW;
					totalVisualLines++;
				}
			}

			// Fallback: if no lines/words, use a reasonable default
			if (totalVisualLines === 0) {
				totalVisualLines = 1;
				maxLineW = fontSize * 4;
			}

			const textW = maxLineW;
			const textH = fontSize * lineHeight * totalVisualLines;
			const padX = 16;
			const padY = 12;

			width = Math.max(textW + padX * 2, 60) * transform.scale;
			height = Math.max(textH + padY * 2, 30) * transform.scale;
		} else if (element.type === "sticker") {
			const baseSize = 200;
			width = baseSize * transform.scale;
			height = baseSize * transform.scale;
		} else {
			return null;
		}

		return {
			trackId: track.id,
			elementId: element.id,
			elementType: element.type,
			cx,
			cy,
			width,
			height,
			rotation: transform.rotate,
			scale: transform.scale,
			transform,
		};
	}

	/**
	 * Convert screen (pixel) coordinates on the displayed canvas to canvas coordinates.
	 */
	function screenToCanvas(screenX: number, screenY: number): { x: number; y: number } | null {
		const canvas = canvasRef.value;
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		const scaleX = canvasWidth.value / rect.width;
		const scaleY = canvasHeight.value / rect.height;
		return {
			x: (screenX - rect.left) * scaleX,
			y: (screenY - rect.top) * scaleY,
		};
	}

	/**
	 * Convert canvas coordinates to screen (pixel) coordinates.
	 */
	function canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number } | null {
		const canvas = canvasRef.value;
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		const scaleX = rect.width / canvasWidth.value;
		const scaleY = rect.height / canvasHeight.value;
		return {
			x: canvasX * scaleX + rect.left,
			y: canvasY * scaleY + rect.top,
		};
	}

	/**
	 * Hit-test: find the topmost element at a canvas coordinate.
	 * Tests in reverse order (topmost first).
	 */
	function hitTest(canvasX: number, canvasY: number): ElementBounds | null {
		const elements = visibleElements.value;
		for (let i = elements.length - 1; i >= 0; i--) {
			const bounds = elements[i];
			if (isPointInBounds(canvasX, canvasY, bounds)) {
				return bounds;
			}
		}
		return null;
	}

	/**
	 * Check if a point (in canvas coords) is inside an element's rotated bounding box.
	 */
	function isPointInBounds(px: number, py: number, bounds: ElementBounds): boolean {
		const rad = (-bounds.rotation * Math.PI) / 180;
		const cos = Math.cos(rad);
		const sin = Math.sin(rad);
		const dx = px - bounds.cx;
		const dy = py - bounds.cy;
		const localX = dx * cos - dy * sin;
		const localY = dx * sin + dy * cos;
		const halfW = bounds.width / 2;
		const halfH = bounds.height / 2;
		return Math.abs(localX) <= halfW && Math.abs(localY) <= halfH;
	}

	// --- Interaction handlers ---

	function handleCanvasMouseDown(event: MouseEvent) {
		const pos = screenToCanvas(event.clientX, event.clientY);
		if (!pos) return;

		const hit = hitTest(pos.x, pos.y);
		if (hit) {
			// If the clicked element is already part of a multi-selection (e.g. caption track),
			// preserve the selection so the entire group moves together.
			const alreadySelected = isElementSelected({ trackId: hit.trackId, elementId: hit.elementId });
			if (!alreadySelected) {
				selectElement({ trackId: hit.trackId, elementId: hit.elementId });
			}
			startDrag(event, hit, "move");
		} else {
			clearElementSelection();
		}
	}

	function handleHandleMouseDown(event: MouseEvent, handle: HandlePosition, bounds: ElementBounds) {
		event.stopPropagation();
		if (handle === "rotate") {
			startDrag(event, bounds, "rotate");
		} else {
			startDrag(event, bounds, "resize", handle);
		}
	}

	function startDrag(event: MouseEvent, bounds: ElementBounds, type: DragState["type"], handle?: HandlePosition) {
		const pos = screenToCanvas(event.clientX, event.clientY);
		if (!pos) return;

		dragState.value = {
			type,
			trackId: bounds.trackId,
			elementId: bounds.elementId,
			startCanvasX: pos.x,
			startCanvasY: pos.y,
			originalTransform: { ...bounds.transform, position: { ...bounds.transform.position } },
			handle,
			originalBounds: { ...bounds },
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
	}

	function handleMouseMove(event: MouseEvent) {
		const ds = dragState.value;
		if (!ds) return;

		const pos = screenToCanvas(event.clientX, event.clientY);
		if (!pos) return;

		const deltaX = pos.x - ds.startCanvasX;
		const deltaY = pos.y - ds.startCanvasY;

		if (ds.type === "move") {
			let newX = ds.originalTransform.position.x + deltaX;
			let newY = ds.originalTransform.position.y + deltaY;

			// Snap to center when close
			const snappedX = Math.abs(newX) < CENTER_SNAP_THRESHOLD;
			const snappedY = Math.abs(newY) < CENTER_SNAP_THRESHOLD;
			if (snappedX) newX = 0;
			if (snappedY) newY = 0;
			showCenterGuideX.value = snappedX;
			showCenterGuideY.value = snappedY;

			const newTransform: Transform = {
				...ds.originalTransform,
				position: { x: newX, y: newY },
			};
			applyTransform(ds.trackId, ds.elementId, newTransform);
		} else if (ds.type === "resize") {
			handleResize(ds, pos.x, pos.y);
		} else if (ds.type === "rotate") {
			handleRotate(ds, pos.x, pos.y);
		}
	}

	function handleResize(ds: DragState, canvasX: number, canvasY: number) {
		const ob = ds.originalBounds;
		const rad = (-ob.rotation * Math.PI) / 180;
		const cos = Math.cos(rad);
		const sin = Math.sin(rad);

		// Current mouse in local (unrotated) space relative to element center
		const dx = canvasX - ob.cx;
		const dy = canvasY - ob.cy;
		const localX = dx * cos - dy * sin;
		const localY = dx * sin + dy * cos;

		// Start mouse in local space
		const sdx = ds.startCanvasX - ob.cx;
		const sdy = ds.startCanvasY - ob.cy;
		const startLocalX = sdx * cos - sdy * sin;
		const startLocalY = sdx * sin + sdy * cos;

		// Compute scale ratio based on distance from center
		const startDist = Math.sqrt(startLocalX * startLocalX + startLocalY * startLocalY);
		const currentDist = Math.sqrt(localX * localX + localY * localY);

		if (startDist < 1) return;

		const scaleRatio = currentDist / startDist;
		const newScale = Math.max(0.05, ds.originalTransform.scale * scaleRatio);

		const newTransform: Transform = {
			...ds.originalTransform,
			scale: newScale,
		};
		applyTransform(ds.trackId, ds.elementId, newTransform);
	}

	function handleRotate(ds: DragState, canvasX: number, canvasY: number) {
		const ob = ds.originalBounds;
		const startAngle = Math.atan2(ds.startCanvasY - ob.cy, ds.startCanvasX - ob.cx);
		const currentAngle = Math.atan2(canvasY - ob.cy, canvasX - ob.cx);
		const deltaAngle = ((currentAngle - startAngle) * 180) / Math.PI;

		let newRotation = ds.originalTransform.rotate + deltaAngle;
		// Snap to 0/90/180/270 within 5 degrees
		const snapAngles = [0, 90, 180, 270, -90, -180, -270, 360];
		for (const snap of snapAngles) {
			if (Math.abs(newRotation - snap) < 5) {
				newRotation = snap;
				break;
			}
		}

		const newTransform: Transform = {
			...ds.originalTransform,
			rotate: newRotation,
		};
		applyTransform(ds.trackId, ds.elementId, newTransform);
	}

	function handleMouseUp() {
		const ds = dragState.value;
		if (ds) {
			// Collect all selected element IDs on this track (for batch commit, e.g. caption track)
			const selectedOnTrack = new Set(
				selectedElements.value
					.filter((s) => s.trackId === ds.trackId)
					.map((s) => s.elementId),
			);
			selectedOnTrack.add(ds.elementId);

			// Commit the final transform via command for undo/redo
			const track = editor.timeline.getTrackById({ trackId: ds.trackId });
			if (track) {
				// Read final transform from the primary dragged element
				const primaryElement = track.elements.find((e) => e.id === ds.elementId);
				if (primaryElement && "transform" in primaryElement) {
					const liveTransform = (primaryElement as any).transform as Transform;
					const finalTransform: Transform = {
						scale: liveTransform.scale,
						rotate: liveTransform.rotate,
						position: { x: liveTransform.position.x, y: liveTransform.position.y },
					};
					const orig = ds.originalTransform;
					// Only commit if transform actually changed
					if (
						finalTransform.position.x !== orig.position.x ||
						finalTransform.position.y !== orig.position.y ||
						finalTransform.scale !== orig.scale ||
						finalTransform.rotate !== orig.rotate
					) {
						// Batch-revert all selected elements to original in one updateTracks call
						const currentTracks = editor.timeline.getTracks();
						const revertedTracks = currentTracks.map((t) => {
							if (t.id !== ds.trackId) return t;
							return {
								...t,
								elements: t.elements.map((el) =>
									selectedOnTrack.has(el.id) ? { ...el, transform: orig } : el,
								),
							} as typeof t;
						});
						editor.timeline.updateTracks(revertedTracks);

						// Commit final transform for each element via command (supports undo/redo)
						for (const elId of selectedOnTrack) {
							editor.timeline.updateElement({
								trackId: ds.trackId,
								elementId: elId,
								updates: { transform: finalTransform },
							});
						}
					}
				}
			}
		}
		dragState.value = null;
		showCenterGuideX.value = false;
		showCenterGuideY.value = false;
		document.removeEventListener("mousemove", handleMouseMove);
		document.removeEventListener("mouseup", handleMouseUp);
	}

	/**
	 * Apply transform directly (no command, for live preview during drag).
	 */
	function applyTransform(trackId: string, elementId: string, transform: Transform) {
		applyTransformDirect(trackId, elementId, transform);
	}

	function applyTransformDirect(trackId: string, elementId: string, transform: Transform) {
		// Collect all selected element IDs on this track so they all move together
		const selectedOnTrack = new Set(
			selectedElements.value
				.filter((s) => s.trackId === trackId)
				.map((s) => s.elementId),
		);
		// Always include the primary dragged element
		selectedOnTrack.add(elementId);

		const currentTracks = editor.timeline.getTracks();
		const updatedTracks = currentTracks.map((t) => {
			if (t.id !== trackId) return t;
			return {
				...t,
				elements: t.elements.map((el) =>
					selectedOnTrack.has(el.id) ? { ...el, transform } : el,
				),
			} as typeof t;
		});
		editor.timeline.updateTracks(updatedTracks);
	}

	function handleCanvasMouseMove(event: MouseEvent) {
		if (dragState.value) return;
		const pos = screenToCanvas(event.clientX, event.clientY);
		if (!pos) {
			hoveredElementId.value = null;
			return;
		}
		const hit = hitTest(pos.x, pos.y);
		hoveredElementId.value = hit?.elementId ?? null;
	}

	return {
		visibleElements,
		selectedBounds,
		dragState,
		hoveredElementId,
		showCenterGuideX,
		showCenterGuideY,
		screenToCanvas,
		canvasToScreen,
		handleCanvasMouseDown,
		handleHandleMouseDown,
		handleCanvasMouseMove,
	};
}
