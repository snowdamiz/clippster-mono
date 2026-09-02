<script setup lang="ts">
import { ref, computed, watch, shallowRef, onUnmounted, onMounted } from "vue";
import { ChevronDown, Link2, Maximize, Minimize, Smartphone } from "lucide-vue-next";
import { invoke } from "@tauri-apps/api/core";
import { useEditor } from "../../composables/useEditor";
import { useRafLoop } from "../../composables/useRafLoop";
import { useEditorUIState } from "../../composables/useEditorUIState";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import { useBrandingConfig } from "../../composables/useBrandingConfig";
import { useImageMode } from "../../composables/useImageMode";
import { useImageEditorTools } from "../../composables/useImageEditorTools";
import { blitScratchToOverlay, useImageRasterPaint } from "../../composables/useImageRasterPaint";
import { useImageCloneStamp } from "../../composables/useImageCloneStamp";
import {
	magicEraseAtCanvasPoint,
	useImageBackgroundEraser,
} from "../../composables/useImageBackgroundEraser";
import { selectionBoundingBox } from "../../lib/image-layer-mapping";
import { applyLinearGradient } from "../../lib/image-pixel-edits";
import { CanvasRenderer } from "../../renderer/canvas-renderer";
import type { RootNode } from "../../renderer/nodes/root-node";
import { getRenderFrame } from "../../renderer/frame-policy";
import { PreviewFrameScheduler } from "../../renderer/preview-frame-scheduler";
import type { TimelineElement, TimelineTrack } from "../../types/timeline";
import type { SocialOverlayPreset } from "../../types/social-overlays";
import {
	exposePreviewPerfGlobal,
	previewPerfMarkCoalesced,
	previewPerfMarkDropped,
} from "../../lib/preview-performance";
import { prepareSceneForRealtimePlayback } from "../../renderer/prepare-realtime-playback";
import { SOCIAL_OVERLAY_PRESETS } from "../../constants/social-overlay-constants";
import PreviewOverlay from "./PreviewOverlay.vue";
import SocialOverlay from "./SocialOverlay.vue";
import GuideOverlay from "./GuideOverlay.vue";
import {
	AdaptivePreviewQualityController,
	configurePreviewDecode,
} from "../../lib/preview-decode-settings";
import { videoCache } from "../../video-cache/service";

const { editor, version } = useEditor({
	subscribe: {
		playback: false,
		selection: false,
		timeline: true,
		media: true,
		scenes: true,
		project: true,
	},
});
const { isCropMode, activeSocialOverlay, viewportZoom, viewportPanX, viewportPanY, previewQuality, fitMode } = useEditorUIState();
const { selectedElements, clearElementSelection } = useElementSelection();
const { isImageMode } = useImageMode();
const {
	activeTool,
	setSelection,
	marqueeDraft,
	fillColor,
	setTool,
	shapeKind,
	insertTextLayer,
	insertShapeLayer,
	applyFillAtCanvasPoint,
	applyMagicWandAtCanvasPoint,
	marqueeKind,
	getLiveSelection,
	strokeColor,
	wandTolerance,
	wandContiguous,
	brushSize,
} = useImageEditorTools();
const {
	cloneSource,
	isStamping,
	setSourceFromEvent,
	startStamp,
	continueStamp,
	endStamp,
} = useImageCloneStamp();
const {
	scratchCanvas,
	paintPreviewActive,
	startStroke,
	continueStroke,
	endStroke,
} = useImageRasterPaint();
const {
	startBgErase,
	continueBgErase,
	endBgErase,
	bgEraseScratch,
	bgErasePreviewActive,
} = useImageBackgroundEraser();
const showSafeZones = ref(true);
const marqueeDrag = ref<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
const lassoPoints = ref<Array<{ x: number; y: number }>>([]);
const gradientDrag = ref<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
const paintOverlayRef = ref<HTMLCanvasElement | null>(null);

const containerRef = ref<HTMLDivElement | null>(null);

const aspectPresets = [
	{ width: 1920, height: 1080, label: "16:9" },
	{ width: 1080, height: 1920, label: "9:16" },
	{ width: 1080, height: 1080, label: "1:1" },
	{ width: 1080, height: 1350, label: "4:5" },
	{ width: 1280, height: 720, label: "YouTube HD" },
	{ width: 3840, height: 2160, label: "YouTube 4K" },
];

const showAspectMenu = ref(false);
const showSocialMenu = ref(false);
const showSpeedMenu = ref(false);
const showCustomSize = ref(false);
const customWidth = ref(1920);
const customHeight = ref(1080);
const linkDimensions = ref(true);
const isFullscreen = ref(false);
const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

const canvasRef = ref<HTMLCanvasElement | null>(null);
let lastFrame = -1;
let lastScene: any = null;
let lastRenderedTime = Number.NEGATIVE_INFINITY;
let sceneRebuildIdleId: number | null = null;
let requestPreviewFrame = () => {};
let freezeCaptureCanvas: HTMLCanvasElement | null = null;
let frameScheduler: PreviewFrameScheduler | null = null;

/**
 * Freeze capture remains project-sized without painting a full-resolution canvas
 * every preview frame. Its pixels are populated from the latest display frame only
 * when the existing freeze action calls toBlob().
 */
function syncFreezeCaptureCanvas() {
	const displayCanvas = canvasRef.value;
	if (!displayCanvas) {
		freezeCaptureCanvas = null;
		editor.setPreviewCanvas(null);
		return;
	}

	const capture = freezeCaptureCanvas ?? document.createElement("canvas");
	freezeCaptureCanvas = capture;
	capture.width = Math.max(1, Math.round(projectWidth.value));
	capture.height = Math.max(1, Math.round(projectHeight.value));
	capture.toBlob = (callback, type, quality) => {
		const context = capture.getContext("2d");
		const currentDisplay = canvasRef.value;
		if (!context || !currentDisplay) {
			callback(null);
			return;
		}
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, capture.width, capture.height);
		context.drawImage(currentDisplay, 0, 0, capture.width, capture.height);
		HTMLCanvasElement.prototype.toBlob.call(capture, callback, type, quality);
	};
	editor.setPreviewCanvas(capture);
}

onUnmounted(() => {
	editor.setPreviewCanvas(null);
	freezeCaptureCanvas = null;
});

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

const canvasSourceFraming = computed(() => activeProject.value?.settings.canvasSourceFraming ?? null);

const projectWidth = computed(() => activeProject.value?.settings?.canvasSize?.width ?? 1920);
const projectHeight = computed(() => activeProject.value?.settings?.canvasSize?.height ?? 1080);
const canvasWidth = projectWidth;
const canvasHeight = projectHeight;

const currentSpeed = computed(() => {
	void version.value;
	return editor.playback.getPlaybackRate();
});

function setSpeed(rate: number) {
	editor.playback.setPlaybackRate({ rate });
	showSpeedMenu.value = false;
}

const currentAspectLabel = computed(() => {
	const w = canvasWidth.value;
	const h = canvasHeight.value;
	const match = aspectPresets.find((p) => p.width === w && p.height === h);
	if (match) return match.label;
	return `${w}×${h}`;
});

function setAspectRatio(preset: { width: number; height: number }) {
	editor.project.updateSettings({ settings: { canvasSize: preset } });
	showAspectMenu.value = false;
	showCustomSize.value = false;
}

function onCustomWidthChange(value: number) {
	if (linkDimensions.value && customWidth.value > 0) {
		const aspect = customHeight.value / customWidth.value;
		customWidth.value = value;
		customHeight.value = Math.max(1, Math.round(value * aspect));
	} else {
		customWidth.value = value;
	}
}

function onCustomHeightChange(value: number) {
	if (linkDimensions.value && customHeight.value > 0) {
		const aspect = customWidth.value / customHeight.value;
		customHeight.value = value;
		customWidth.value = Math.max(1, Math.round(value * aspect));
	} else {
		customHeight.value = value;
	}
}

function applyCustomSize() {
	editor.project.updateSettings({
		settings: { canvasSize: { width: customWidth.value, height: customHeight.value } },
	});
	showAspectMenu.value = false;
	showCustomSize.value = false;
}

function toggleSocialOverlay(preset: SocialOverlayPreset) {
	if (activeSocialOverlay.value?.platform === preset.platform) {
		activeSocialOverlay.value = null;
	} else {
		activeSocialOverlay.value = preset;
	}
	showSocialMenu.value = false;
}

async function toggleFullscreen() {
	const el = containerRef.value;
	if (!el) return;
	try {
		if (!document.fullscreenElement) {
			await el.requestFullscreen();
			isFullscreen.value = true;
		} else {
			await document.exitFullscreen();
			isFullscreen.value = false;
		}
	} catch (err) {
		console.warn("[PreviewPanel] Fullscreen failed:", err);
	}
}

/**
 * Layout: buildScene + CanvasRenderer always use full project canvas size so text/overlays stay aligned.
 * Quality: softer decode — video CanvasSink + image bitmaps use a smaller pixel box (see preview-decode-settings).
 */
const layoutWidth = computed(() => Math.max(1, Math.round(projectWidth.value)));
const layoutHeight = computed(() => Math.max(1, Math.round(projectHeight.value)));
const adaptiveQuality = new AdaptivePreviewQualityController();
const autoPreviewHeight = ref(adaptiveQuality.height);
const effectivePreviewHeight = computed(() =>
	previewQuality.value === "auto" ? autoPreviewHeight.value : previewQuality.value,
);
const previewBackingSize = computed(() => {
	const width = Math.max(1, Math.round(projectWidth.value));
	const height = Math.max(1, Math.round(projectHeight.value));
	const targetHeight = Math.min(height, effectivePreviewHeight.value);
	const scale = Math.min(1, targetHeight / height);
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
});

let pendingDecodeCacheReset = false;

watch(
	[projectWidth, projectHeight, previewQuality, autoPreviewHeight],
	([width, height, quality], previous) => {
		configurePreviewDecode({
			projectWidth: projectWidth.value,
			projectHeight: projectHeight.value,
			previewQuality: previewQuality.value,
			autoQualityHeight: autoPreviewHeight.value,
		});
		// Auto-quality steps during playback must not destroy live decoders:
		// clearAll() cold-restarts every video sink (a visible multi-frame stall
		// while audio keeps running). Existing sinks keep their old decode size
		// until playback stops; new sinks pick up the new size immediately.
		const onlyAutoHeightChanged =
			previous !== undefined &&
			width === previous[0] &&
			height === previous[1] &&
			quality === previous[2];
		if (onlyAutoHeightChanged && editor.playback.getIsPlaying()) {
			pendingDecodeCacheReset = true;
			return;
		}
		pendingDecodeCacheReset = false;
		videoCache.clearAll();
	},
	{ immediate: true },
);

watch([canvasRef, projectWidth, projectHeight], syncFreezeCaptureCanvas, { flush: "post" });
watch(
	canvasRef,
	(canvas) => editor.setLivePreviewCanvas(canvas),
	{ immediate: true, flush: "post" },
);

const is916 = computed(() => {
	return canvasWidth.value === 1080 && canvasHeight.value === 1920;
});

watch(isImageMode, (enabled) => {
	if (!enabled) return;
	const project = editor.project.getActiveOrNull();
	if (!project) return;
	const bg = project.settings.background;
	const color = bg?.type === "color" ? (bg.color || "").toLowerCase() : "";
	// Migrate the old image-mode default (solid black) to Photoshop-style transparency.
	if (
		!bg ||
		color === "#000000" ||
		color === "#000" ||
		color === "black"
	) {
		void editor.project.updateSettings({
			settings: { background: { type: "color", color: "transparent" } },
		});
	}
}, { immediate: true });

watch(is916, (val) => {
	if (!val && !isImageMode.value) {
		activeSocialOverlay.value = null;
		showSocialMenu.value = false;
	}
});
const fps = computed(() => activeProject.value?.settings?.fps ?? 30);
const background = computed(() => activeProject.value?.settings?.background ?? { type: "color" as const, color: "#000000" });
const isTransparentCanvas = computed(() => {
	const bg = background.value;
	if (!bg || bg.type !== "color") return isImageMode.value;
	const c = (bg.color || "").toLowerCase();
	return c === "transparent" || c === "rgba(0,0,0,0)" || c === "#00000000";
});

const renderer = shallowRef<CanvasRenderer | null>(null);

watch([layoutWidth, layoutHeight, fps, previewBackingSize, isTransparentCanvas], ([w, h, f, backing, transparent]) => {
	// Use a DOM canvas-backed renderer for preview. Several transition effects rely on
	// alpha/clip compositing that is unreliable when the destination context is OffscreenCanvas
	// in Chromium/Electron, which makes wipes/crossfades appear as no-ops in preview.
	renderer.value = new CanvasRenderer({
		width: w,
		height: h,
		fps: f,
		framePolicy: "realtime",
		prewarmUpcoming: true,
		preferOffscreen: false,
		previewEffectProcessing: true,
		backingWidth: backing.width,
		backingHeight: backing.height,
		clearStyle: transparent ? "transparent" : "black",
	});
	lastFrame = -1;
	lastScene = null;
	lastRenderedTime = Number.NEGATIVE_INFINITY;
	frameScheduler?.invalidate();
	requestPreviewFrame();
}, { immediate: true });

// Rebuild render tree when tracks/media/settings change
const tracks = computed(() => {
	void version.value;
	return editor.timeline.getTracks();
});

/** Invalidate decode cache when element timing changes so EOF frames don't stick after trims. */
const videoTimingSignature = computed(() => {
	void version.value;
	const parts: string[] = [];
	for (const track of editor.timeline.getTracks()) {
		for (const el of track.elements) {
			if (el.type === "video") {
				parts.push(
					`${el.id}:${el.trimStart}:${el.trimEnd}:${el.duration}:${el.speed ?? 1}`,
				);
			}
		}
	}
	return parts.join("|");
});

let lastVideoTimingSignature = "";
watch(videoTimingSignature, (signature) => {
	if (lastVideoTimingSignature && signature !== lastVideoTimingSignature) {
		videoCache.clearAll();
	}
	lastVideoTimingSignature = signature;
});

const mediaAssets = computed(() => {
	void version.value;
	return editor.media.getAssets();
});

const sceneTransitions = computed(() => {
	void version.value;
	try {
		const scene = editor.scenes.getActiveScene();
		return scene?.transitions ?? [];
	} catch {
		return [];
	}
});

function isVisualPreviewElement(element: TimelineElement): boolean {
	return (
		element.type === "video" ||
		element.type === "image" ||
		element.type === "text" ||
		element.type === "sticker" ||
		element.type === "effect" ||
		element.type === "caption"
	);
}

// When in crop mode, strip crop from the selected element so canvas shows full frame
const sceneTracks = computed((): TimelineTrack[] => {
	const raw = tracks.value;
	const selectedElement = selectedElements.value[0];

	return raw
		.map((t) => {
			const nextElements = t.elements.filter(isVisualPreviewElement).map((el) => {
				let next = el;

				if (
					isCropMode.value &&
					selectedElement &&
					t.id === selectedElement.trackId &&
					el.id === selectedElement.elementId
				) {
					next = { ...next, crop: undefined } as typeof el;
				}

				return next;
			});

			return { ...t, elements: nextElements } as typeof t;
		})
		.filter((t) => t.elements.length > 0 || t.type !== "audio");
});

function schedulePreviewSceneRebuild() {
	if (!activeProject.value) return;
	const duration = editor.timeline.getTotalDuration();
	const inputs = {
		tracks: sceneTracks.value,
		mediaAssets: mediaAssets.value,
		duration,
		canvasSize: { width: layoutWidth.value, height: layoutHeight.value },
		background: background.value,
		transitions: sceneTransitions.value,
		canvasSourceFraming: canvasSourceFraming.value,
	};

	const run = () => {
		sceneRebuildIdleId = null;
		editor.renderer.syncPreviewRenderTreeFromInputs(inputs);
	};

	if (sceneRebuildIdleId !== null && typeof cancelIdleCallback !== "undefined") {
		cancelIdleCallback(sceneRebuildIdleId);
		sceneRebuildIdleId = null;
	}

	// During playback, rebuild immediately so edits while playing stay in sync.
	if (editor.playback.getIsPlaying()) {
		run();
		return;
	}

	if (typeof requestIdleCallback !== "undefined") {
		sceneRebuildIdleId = requestIdleCallback(run, { timeout: 100 });
	} else {
		queueMicrotask(run);
	}
}

watch(
	[sceneTracks, mediaAssets, background, layoutWidth, layoutHeight, sceneTransitions, canvasSourceFraming],
	schedulePreviewSceneRebuild,
	{ immediate: true, flush: "post" },
);

frameScheduler = new PreviewFrameScheduler({
	render: async (request, signal) => {
		const canvas = canvasRef.value;
		const r = renderer.value;
		if (!canvas || !r) return;
		r.framePolicy = request.mode === "playback" ? "realtime" : "exact-preview";
		await editor.renderer.renderPreviewToTarget({
			renderer: r,
			time: request.time,
			targetCanvas: canvas,
			renderTree: request.tree,
			signal,
		});
	},
	onPresented: (request, costMs) => {
		const r = renderer.value;
		if (!r) return;
		lastFrame = request.frameIndex;
		lastScene = request.tree;
		lastRenderedTime = request.time;
		if (previewQuality.value === "auto") {
			const nextHeight = adaptiveQuality.recordFrame(
				costMs,
				1000 / Math.max(1, r.fps),
			);
			if (nextHeight !== null) autoPreviewHeight.value = nextHeight;
		}
	},
	onDropped: previewPerfMarkDropped,
	onCoalesced: previewPerfMarkCoalesced,
	onError: (error) => {
		console.warn("[Preview] Frame render failed:", error);
	},
});

const previewLoop = useRafLoop(() => {
	const r = renderer.value;
	const renderTree = editor.renderer.getRenderTree();
	if (!canvasRef.value || !r || !renderTree) return;

	const time = editor.playback.getCurrentTime();
	const renderFrame = getRenderFrame({
		time,
		fps: r.fps,
		duration: renderTree.duration,
	});
	const isPlaying = editor.playback.getIsPlaying();
	const needsRender =
		renderFrame.frameIndex !== lastFrame ||
		renderTree !== lastScene ||
		renderFrame.time !== lastRenderedTime;

	if (!needsRender) return;
	frameScheduler?.request({
		frameIndex: renderFrame.frameIndex,
		time: renderFrame.time,
		tree: renderTree,
		mode: isPlaying ? "playback" : "exact",
	});
}, {
	autoStart: false,
	fps: () => Math.max(1, fps.value),
	pauseWhenHidden: true,
});
requestPreviewFrame = previewLoop.requestFrame;

const canvasBackground = computed(() => {
	if (isTransparentCanvas.value) return "transparent";
	const bg = background.value;
	if (!bg) return "transparent";
	return bg.type === "blur" ? "transparent" : bg.color;
});

// Branding watermark overlay
const { getWatermarkForCanvasSize, getOverlaysForCanvasSize } = useBrandingConfig();

const brandingWatermark = computed(() => {
	// Branding selection must follow project canvas size, not preview quality scaling.
	// Changing preview quality should never add/remove watermark/overlay content.
	return getWatermarkForCanvasSize(projectWidth.value, projectHeight.value);
});

const brandingWatermarkDataUrl = ref<string | null>(null);
const lastWatermarkId = ref<string | null>(null);

watch(
	() => brandingWatermark.value?.watermarkId,
	async (wmId) => {
		if (!wmId) {
			brandingWatermarkDataUrl.value = null;
			lastWatermarkId.value = null;
			return;
		}
		if (wmId === lastWatermarkId.value) return;
		lastWatermarkId.value = wmId;

		try {
			// Try to resolve watermark file path and load as data URL
			const { resolveWatermarkById } = await import("@/services/database/watermarks");
			const resolved = await resolveWatermarkById(wmId);
			if (resolved?.filePath) {
				const dataUrl = await invoke<string>("read_file_as_data_url", {
					filePath: resolved.filePath,
				});
				brandingWatermarkDataUrl.value = dataUrl;
			} else {
				brandingWatermarkDataUrl.value = null;
			}
		} catch (e) {
			console.warn("[PreviewPanel] Failed to load branding watermark:", e);
			brandingWatermarkDataUrl.value = null;
		}
	},
	{ immediate: true },
);

const brandingWatermarkStyle = computed(() => {
	const wm = brandingWatermark.value;
	if (!wm?.position) return null;

	if (wm.position.isFullFrameOverlay) {
		return {
			left: "0",
			top: "0",
			width: "100%",
			height: "100%",
			opacity: (wm.position.opacity ?? 100) / 100,
		};
	}

	return {
		left: `${wm.position.x}%`,
		top: `${wm.position.y}%`,
		transform: "translate(-50%, -50%)",
		width: `${wm.position.scale}%`,
		height: "auto",
		opacity: (wm.position.opacity ?? 100) / 100,
	};
});

// Branding layout overlays preview
const brandingOverlays = computed(() => {
	// Keep branding overlays stable across preview quality changes.
	return getOverlaysForCanvasSize(projectWidth.value, projectHeight.value) ?? [];
});

const brandingOverlayDataUrls = ref<Record<string, string>>({});
const loadedOverlayIds = ref<Set<string>>(new Set());

watch(
	brandingOverlays,
	async (overlays) => {
		if (!overlays || overlays.length === 0) {
			brandingOverlayDataUrls.value = {};
			loadedOverlayIds.value = new Set();
			return;
		}

		const newUrls: Record<string, string> = {};
		const newIds = new Set<string>();

		for (const overlay of overlays) {
			newIds.add(overlay.id);
			// Reuse cached data URL if already loaded
			if (loadedOverlayIds.value.has(overlay.id) && brandingOverlayDataUrls.value[overlay.id]) {
				newUrls[overlay.id] = brandingOverlayDataUrls.value[overlay.id];
				continue;
			}
			try {
				const dataUrl = await invoke<string>("read_file_as_data_url", {
					filePath: overlay.imagePath,
				});
				newUrls[overlay.id] = dataUrl;
			} catch (e) {
				console.warn(`[PreviewPanel] Failed to load branding overlay ${overlay.id}:`, e);
			}
		}

		brandingOverlayDataUrls.value = newUrls;
		loadedOverlayIds.value = newIds;
	},
	{ immediate: true },
);

// Zoom helpers
const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;

function stepZoom(delta: number) {
	fitMode.value = "manual";
	viewportZoom.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((viewportZoom.value + delta) * 100) / 100));
}

function fitZoom() {
	fitMode.value = "fit";
	viewportZoom.value = 1;
	viewportPanX.value = 0;
	viewportPanY.value = 0;
}

function canvasPositionFromNorm(pt: { x: number; y: number }) {
	return {
		x: (pt.x - 0.5) * projectWidth.value,
		y: (pt.y - 0.5) * projectHeight.value,
	};
}

const overlayInteractive = computed(
	() => !isImageMode.value || activeTool.value === "move" || activeTool.value === "crop",
);

function onPreviewAreaMouseDown(event: MouseEvent) {
	if (event.button !== 0) return;
	const target = event.target as HTMLElement | null;
	if (target?.closest(".preview-canvas-wrapper")) return;
	clearElementSelection();
}

function canvasNormFromEvent(event: MouseEvent): { x: number; y: number } | null {
	const wrapper = (event.currentTarget as HTMLElement | null)?.closest?.(".preview-canvas-wrapper") as
		| HTMLElement
		| null;
	const el = wrapper || (document.querySelector(".preview-canvas-wrapper") as HTMLElement | null);
	if (!el) return null;
	const rect = el.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) return null;
	return {
		x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
		y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
	};
}

function onCanvasPointerDown(event: PointerEvent) {
	if (!isImageMode.value || event.button !== 0) return;

	if (activeTool.value === "text") {
		event.preventDefault();
		event.stopPropagation();
		const pt = canvasNormFromEvent(event);
		insertTextLayer(pt ? canvasPositionFromNorm(pt) : undefined);
		setTool("move");
		return;
	}

	if (activeTool.value === "shape" || activeTool.value === "shape-rect" || activeTool.value === "shape-ellipse") {
		event.preventDefault();
		event.stopPropagation();
		const pt = canvasNormFromEvent(event);
		const kind =
			activeTool.value === "shape-ellipse" || shapeKind.value === "ellipse" ? "ellipse" : "rect";
		void insertShapeLayer(kind, pt ? canvasPositionFromNorm(pt) : undefined);
		setTool("move");
		return;
	}

	if (activeTool.value === "fill") {
		event.preventDefault();
		event.stopPropagation();
		const canvas = canvasRef.value;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		const canvasX = ((event.clientX - rect.left) / rect.width) * projectWidth.value;
		const canvasY = ((event.clientY - rect.top) / rect.height) * projectHeight.value;
		void applyFillAtCanvasPoint(canvasX, canvasY);
		return;
	}

	if (activeTool.value === "magic-wand") {
		event.preventDefault();
		event.stopPropagation();
		const canvas = canvasRef.value;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		const canvasX = ((event.clientX - rect.left) / rect.width) * projectWidth.value;
		const canvasY = ((event.clientY - rect.top) / rect.height) * projectHeight.value;
		void applyMagicWandAtCanvasPoint(canvasX, canvasY);
		return;
	}

	if (activeTool.value === "zoom") {
		event.preventDefault();
		stepZoom(event.altKey ? -ZOOM_STEP : ZOOM_STEP);
		return;
	}

	if (activeTool.value === "eyedropper") {
		event.preventDefault();
		event.stopPropagation();
		try {
			const canvas = canvasRef.value;
			if (!canvas) return;
			const rect = canvas.getBoundingClientRect();
			const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width);
			const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height);
			// Must match the preview canvas's existing context attributes (willReadFrequently:false)
			// or getContext returns null.
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			const pixel = ctx.getImageData(
				Math.min(canvas.width - 1, Math.max(0, x)),
				Math.min(canvas.height - 1, Math.max(0, y)),
				1,
				1,
			).data;
			fillColor.value = `#${[pixel[0], pixel[1], pixel[2]]
				.map((c) => c.toString(16).padStart(2, "0"))
				.join("")}`;
			setTool("brush");
		} catch (e) {
			console.warn("[PreviewPanel] Eyedropper sample failed:", e);
		}
		return;
	}

	if (activeTool.value === "magic-eraser") {
		event.preventDefault();
		event.stopPropagation();
		const canvas = canvasRef.value;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		const canvasX = ((event.clientX - rect.left) / rect.width) * projectWidth.value;
		const canvasY = ((event.clientY - rect.top) / rect.height) * projectHeight.value;
		void magicEraseAtCanvasPoint({
			canvasX,
			canvasY,
			tolerance: wandTolerance.value,
			contiguous: wandContiguous.value,
		});
		return;
	}

	if (activeTool.value === "hand") {
		event.preventDefault();
		event.stopPropagation();
		clearElementSelection();
		fitMode.value = "manual";
		const startX = event.clientX;
		const startY = event.clientY;
		const originX = viewportPanX.value;
		const originY = viewportPanY.value;
		const wrapper = (event.currentTarget as HTMLElement) ?? null;
		if (wrapper) wrapper.style.cursor = "grabbing";
		const onMove = (e: PointerEvent) => {
			viewportPanX.value = originX + (e.clientX - startX);
			viewportPanY.value = originY + (e.clientY - startY);
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			if (wrapper) wrapper.style.cursor = "grab";
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		return;
	}

	if (activeTool.value === "brush" || activeTool.value === "pencil" || activeTool.value === "eraser") {
		event.preventDefault();
		event.stopPropagation();
		const canvas = canvasRef.value;
		if (!canvas) return;
		if (!startStroke(event, canvas)) return;
		const eraseMode = activeTool.value === "eraser";

		const blit = () => {
			if (scratchCanvas.value && paintOverlayRef.value) {
				blitScratchToOverlay(scratchCanvas.value, paintOverlayRef.value, eraseMode ? "erase" : "paint");
			}
		};
		queueMicrotask(blit);

		const onMove = (e: PointerEvent) => {
			continueStroke(e, canvas);
			blit();
		};
		const onUp = async () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			await endStroke(selectedElements.value);
			if (paintOverlayRef.value) {
				const ctx = paintOverlayRef.value.getContext("2d");
				if (ctx) ctx.clearRect(0, 0, paintOverlayRef.value.width, paintOverlayRef.value.height);
			}
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		return;
	}

	if (activeTool.value === "background-eraser") {
		event.preventDefault();
		event.stopPropagation();
		const canvas = canvasRef.value;
		if (!canvas) return;

		const blit = () => {
			const scratch = bgEraseScratch.value;
			if (scratch && paintOverlayRef.value) {
				blitScratchToOverlay(scratch, paintOverlayRef.value, "paint");
			}
		};

		const onMove = (e: PointerEvent) => {
			continueBgErase(e, canvas);
			blit();
		};
		const onUp = async () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			// Keep checkerboard overlay until media commit finishes to avoid a blank flash.
			await endBgErase();
			if (paintOverlayRef.value) {
				const ctx = paintOverlayRef.value.getContext("2d");
				if (ctx) ctx.clearRect(0, 0, paintOverlayRef.value.width, paintOverlayRef.value.height);
			}
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		void startBgErase(event, canvas).then((started) => {
			if (!started) {
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
				return;
			}
			blit();
		});
		return;
	}

	if (activeTool.value === "clone" || activeTool.value === "heal" || activeTool.value === "spot-heal") {
		event.preventDefault();
		event.stopPropagation();
		const canvas = canvasRef.value;
		if (!canvas) return;
		if (activeTool.value === "spot-heal") {
			// Spot Healing samples nearby texture automatically (no Alt-click).
			const rect = canvas.getBoundingClientRect();
			const project = editor.project.getActiveOrNull();
			if (project && rect.width > 0) {
				const offset = Math.max(8, brushSize.value);
				const x =
					((event.clientX - rect.left) / rect.width) * project.settings.canvasSize.width + offset;
				const y = ((event.clientY - rect.top) / rect.height) * project.settings.canvasSize.height;
				cloneSource.value = {
					canvasX: Math.min(project.settings.canvasSize.width, Math.max(0, x)),
					canvasY: Math.min(project.settings.canvasSize.height, Math.max(0, y)),
				};
			}
		} else if (event.altKey || !cloneSource.value) {
			setSourceFromEvent(event, canvas);
			return;
		}
		const onMove = (e: PointerEvent) => {
			if (isStamping.value) continueStamp(e, canvas);
		};
		const onUp = async () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			await endStamp();
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		void startStamp(event, canvas).then((started) => {
			if (!started) {
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
			}
		});
		return;
	}

	if (activeTool.value === "gradient") {
		event.preventDefault();
		event.stopPropagation();
		const pt = canvasNormFromEvent(event);
		if (!pt) return;
		gradientDrag.value = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
		const onMove = (e: PointerEvent) => {
			const next = canvasNormFromEvent(e);
			if (!next || !gradientDrag.value) return;
			gradientDrag.value = { ...gradientDrag.value, x1: next.x, y1: next.y };
		};
		const onUp = (e: PointerEvent) => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			const end = canvasNormFromEvent(e);
			const drag = gradientDrag.value;
			gradientDrag.value = null;
			if (!drag) return;
			const x0 = drag.x0 * projectWidth.value;
			const y0 = drag.y0 * projectHeight.value;
			const x1 = (end?.x ?? drag.x1) * projectWidth.value;
			const y1 = (end?.y ?? drag.y1) * projectHeight.value;
			if (Math.hypot(x1 - x0, y1 - y0) < 4) return;
			void applyLinearGradient({
				x0,
				y0,
				x1,
				y1,
				from: fillColor.value,
				to: strokeColor.value,
				selection: getLiveSelection(),
			});
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		return;
	}

	if (activeTool.value === "lasso" || activeTool.value === "polygonal-lasso") {
		event.preventDefault();
		event.stopPropagation();
		const pt = canvasNormFromEvent(event);
		if (!pt) return;

		if (activeTool.value === "polygonal-lasso") {
			if (lassoPoints.value.length === 0) {
				lassoPoints.value = [pt];
				return;
			}
			const first = lassoPoints.value[0];
			const close =
				lassoPoints.value.length >= 3 && Math.hypot(pt.x - first.x, pt.y - first.y) < 0.02;
			if (close || event.detail === 2) {
				const points = close ? lassoPoints.value : [...lassoPoints.value, pt];
				lassoPoints.value = [];
				const box = selectionBoundingBox(points);
				if (!box) {
					setSelection(null);
					return;
				}
				setSelection({ type: "path", points, ...box });
				return;
			}
			lassoPoints.value = [...lassoPoints.value, pt];
			return;
		}

		lassoPoints.value = [pt];
		const onMove = (e: PointerEvent) => {
			const next = canvasNormFromEvent(e);
			if (!next) return;
			const last = lassoPoints.value[lassoPoints.value.length - 1];
			if (last && Math.hypot(next.x - last.x, next.y - last.y) < 0.004) return;
			lassoPoints.value = [...lassoPoints.value, next];
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			const points = lassoPoints.value;
			lassoPoints.value = [];
			const box = selectionBoundingBox(points);
			if (!box) {
				setSelection(null);
				return;
			}
			setSelection({ type: "path", points, ...box });
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		return;
	}

	if (activeTool.value !== "marquee-rect" && activeTool.value !== "marquee-ellipse") return;
	event.preventDefault();
	event.stopPropagation();
	const pt = canvasNormFromEvent(event);
	if (!pt) return;
	marqueeDrag.value = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };

	const onMove = (e: PointerEvent) => {
		const next = canvasNormFromEvent(e);
		if (!next || !marqueeDrag.value) return;
		const constrained = constrainMarquee(marqueeDrag.value.x0, marqueeDrag.value.y0, next.x, next.y, e.shiftKey);
		marqueeDrag.value = { ...marqueeDrag.value, ...constrained };
	};
	const onUp = (e: PointerEvent) => {
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		const end = canvasNormFromEvent(e);
		const drag = marqueeDrag.value;
		marqueeDrag.value = null;
		if (!drag) return;
		const constrained = constrainMarquee(drag.x0, drag.y0, end?.x ?? drag.x1, end?.y ?? drag.y1, e.shiftKey);
		const x = Math.min(drag.x0, constrained.x1);
		const y = Math.min(drag.y0, constrained.y1);
		const width = Math.abs(constrained.x1 - drag.x0);
		const height = Math.abs(constrained.y1 - drag.y0);
		if (width < 0.005 || height < 0.005) {
			setSelection(null);
			return;
		}
		const ellipse =
			activeTool.value === "marquee-ellipse" || marqueeKind.value === "ellipse";
		setSelection({
			type: ellipse ? "ellipse" : "rect",
			x,
			y,
			width,
			height,
		});
	};
	window.addEventListener("pointermove", onMove);
	window.addEventListener("pointerup", onUp);
}

function constrainMarquee(
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	shift: boolean,
): { x1: number; y1: number } {
	if (!shift) return { x1, y1 };
	const dx = x1 - x0;
	const dy = y1 - y0;
	const side = Math.max(Math.abs(dx), Math.abs(dy));
	return {
		x1: Math.min(1, Math.max(0, x0 + (dx < 0 ? -side : side))),
		y1: Math.min(1, Math.max(0, y0 + (dy < 0 ? -side : side))),
	};
}

const liveMarqueeStyle = computed(() => {
	if (lassoPoints.value.length > 0) return null;
	const drag = marqueeDraft.value;
	const live = marqueeDrag.value;
	if (live) {
		const x = Math.min(live.x0, live.x1);
		const y = Math.min(live.y0, live.y1);
		const w = Math.abs(live.x1 - live.x0);
		const h = Math.abs(live.y1 - live.y0);
		return {
			left: `${x * 100}%`,
			top: `${y * 100}%`,
			width: `${w * 100}%`,
			height: `${h * 100}%`,
			borderRadius:
				activeTool.value === "marquee-ellipse" || marqueeKind.value === "ellipse"
					? "50%"
					: undefined,
		};
	}
	if (drag && (drag.type === "rect" || drag.type === "ellipse")) {
		return {
			left: `${drag.x * 100}%`,
			top: `${drag.y * 100}%`,
			width: `${drag.width * 100}%`,
			height: `${drag.height * 100}%`,
			borderRadius: drag.type === "ellipse" ? "50%" : undefined,
		};
	}
	return null;
});

const liveLassoRings = computed(() => {
	if (lassoPoints.value.length > 0) return [lassoPoints.value];
	const sel = marqueeDraft.value;
	if (sel?.type !== "path") return null;
	if (sel.rings && sel.rings.length > 0) return sel.rings;
	if (sel.points && sel.points.length >= 2) return [sel.points];
	return null;
});

const liveLassoPath = computed(() => {
	const rings = liveLassoRings.value;
	if (!rings) return "";
	return rings
		.map((ring) => {
			if (ring.length === 0) return "";
			const head = `M${ring[0].x * 100} ${ring[0].y * 100}`;
			const tail = ring
				.slice(1)
				.map((p) => `L${p.x * 100} ${p.y * 100}`)
				.join("");
			return `${head}${tail}Z`;
		})
		.join("");
});

const gradientPreview = computed(() => {
	const drag = gradientDrag.value;
	if (!drag) return null;
	return {
		x1: `${drag.x0 * 100}%`,
		y1: `${drag.y0 * 100}%`,
		x2: `${drag.x1 * 100}%`,
		y2: `${drag.y1 * 100}%`,
	};
});

const cloneSourceMarker = computed(() => {
	const src = cloneSource.value;
	if (!src || !isImageMode.value) return null;
	if (activeTool.value !== "clone" && activeTool.value !== "heal" && activeTool.value !== "spot-heal")
		return null;
	return {
		left: `${(src.canvasX / projectWidth.value) * 100}%`,
		top: `${(src.canvasY / projectHeight.value) * 100}%`,
	};
});

const canvasCursor = computed(() => {
	if (!isImageMode.value) return undefined;
	const tool = activeTool.value;
	if (
		tool === "brush" ||
		tool === "pencil" ||
		tool === "eraser" ||
		tool === "background-eraser" ||
		tool === "magic-eraser" ||
		tool === "marquee-rect" ||
		tool === "marquee-ellipse" ||
		tool === "lasso" ||
		tool === "polygonal-lasso" ||
		tool === "gradient" ||
		tool === "clone" ||
		tool === "heal" ||
		tool === "spot-heal" ||
		tool === "fill" ||
		tool === "magic-wand" ||
		tool === "eyedropper"
	) {
		return "crosshair";
	}
	if (tool === "hand") return "grab";
	if (tool === "zoom") return "zoom-in";
	if (tool === "text" || tool === "shape" || tool === "shape-rect" || tool === "shape-ellipse") {
		return "cell";
	}
	return undefined;
});

/** Practical YouTube safe area ≈ 1100×620 centered on 1280×720 (~7% / 7% insets). */
const safeAreaInset = computed(() => ({
	horizontal: "7%",
	vertical: "7%",
}));

function onKeyZoom(e: KeyboardEvent) {
	if (!e.ctrlKey && !e.metaKey) return;
	if (e.key === "0") {
		e.preventDefault();
		fitZoom();
		return;
	}
	if (e.key === "+" || e.key === "=") {
		e.preventDefault();
		stepZoom(ZOOM_STEP);
		return;
	}
	if (e.key === "-") {
		e.preventDefault();
		stepZoom(-ZOOM_STEP);
	}
}

function onWheelZoom(e: WheelEvent) {
	if (!e.ctrlKey && !e.metaKey) return;
	e.preventDefault();
	const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
	stepZoom(delta);
}

const zoomPercent = computed(() => `${Math.round(viewportZoom.value * 100)}%`);

const qualityOptions = [
	{ label: 'Auto', value: 'auto' as const },
	{ label: '1080p', value: 1080 as const },
	{ label: '720p', value: 720 as const },
	{ label: '540p', value: 540 as const },
	{ label: '360p', value: 360 as const },
];

const qualityLabel = computed(() => {
	const q = previewQuality.value;
	return q === 'auto' ? 'Auto' : `${q}p`;
});

const showQualityDropdown = ref(false);

function setQuality(value: "auto" | 360 | 540 | 720 | 1080) {
	previewQuality.value = value;
	showQualityDropdown.value = false;
}

/** Force a preview repaint after timeline scrub/seek so video does not stick on a stale frame. */
function handlePlaybackSeek() {
	videoCache.cancelPreviewRequests();
	frameScheduler?.invalidate();
	lastRenderedTime = Number.NEGATIVE_INFINITY;
	lastFrame = -1;
	requestPreviewFrame();
}

let unsubscribePlayback: (() => void) | null = null;
let unsubscribeRenderer: (() => void) | null = null;
let unsubscribeBeforePlay: (() => void) | null = null;

async function preparePlaybackStart() {
	const canvas = canvasRef.value;
	const r = renderer.value;
	const tree = editor.renderer.getRenderTree();
	if (!canvas || !r || !tree) return;

	frameScheduler?.invalidate();
	const frame = getRenderFrame({
		time: editor.playback.getCurrentTime(),
		fps: r.fps,
		duration: tree.duration,
	});
	// Fill the stable realtime frame cache for every on-screen and soon-to-start
	// video BEFORE the clock starts. Realtime composition never awaits decode,
	// so these frames must already be ready when play begins.
	await prepareSceneForRealtimePlayback({
		root: tree,
		renderer: r,
		time: frame.time,
	});
	if (editor.renderer.getRenderTree() !== tree) return;

	r.framePolicy = "exact-preview";
	await editor.renderer.renderPreviewToTarget({
		renderer: r,
		time: frame.time,
		targetCanvas: canvas,
		renderTree: tree,
	});
	if (editor.renderer.getRenderTree() !== tree) return;
	lastFrame = frame.frameIndex;
	lastScene = tree;
	lastRenderedTime = frame.time;
}

function syncPreviewLoopToPlayback() {
	if (editor.playback.getIsPlaying()) {
		previewLoop.start();
	} else {
		previewLoop.stop();
		if (pendingDecodeCacheReset) {
			pendingDecodeCacheReset = false;
			videoCache.clearAll();
		}
		requestPreviewFrame();
	}
}

onMounted(() => {
	exposePreviewPerfGlobal();
	if (import.meta.env.DEV) {
		void import("../../lib/stress-timeline-dev").then(({ exposeStressTimelineGlobal }) => {
			exposeStressTimelineGlobal(editor);
		});
		void import("../../renderer/preview-worker-client").then(({ pingPreviewWorker }) =>
			pingPreviewWorker().then((t) => {
				if (t != null) console.debug("[Preview] compositor worker ping ok", t);
			}),
		);
	}
	containerRef.value?.addEventListener('wheel', onWheelZoom, { passive: false });
	window.addEventListener("keydown", onKeyZoom);
	window.addEventListener("playback-seek", handlePlaybackSeek);
	unsubscribePlayback = editor.playback.subscribe(syncPreviewLoopToPlayback);
	unsubscribeBeforePlay = editor.playback.onBeforePlay(preparePlaybackStart);
	unsubscribeRenderer = editor.renderer.subscribe(requestPreviewFrame);
	syncPreviewLoopToPlayback();
	requestPreviewFrame();
});

onUnmounted(() => {
	editor.setLivePreviewCanvas(null);
	frameScheduler?.dispose();
	frameScheduler = null;
	if (sceneRebuildIdleId !== null && typeof cancelIdleCallback !== "undefined") {
		cancelIdleCallback(sceneRebuildIdleId);
		sceneRebuildIdleId = null;
	}
	containerRef.value?.removeEventListener('wheel', onWheelZoom);
	window.removeEventListener("keydown", onKeyZoom);
	window.removeEventListener("playback-seek", handlePlaybackSeek);
	unsubscribePlayback?.();
	unsubscribeBeforePlay?.();
	unsubscribeRenderer?.();
	unsubscribePlayback = null;
	unsubscribeBeforePlay = null;
	unsubscribeRenderer = null;
});

defineExpose({ containerRef });

function getBrandingOverlayStyle(overlay: { x: number; y: number; scale: number; opacity: number; rotation: number; isFullFrameOverlay?: boolean }) {
	if (overlay.isFullFrameOverlay) {
		return {
			left: "0",
			top: "0",
			width: "100%",
			height: "100%",
			opacity: (overlay.opacity ?? 100) / 100,
		};
	}

	return {
		left: `${overlay.x}%`,
		top: `${overlay.y}%`,
		transform: `translate(-50%, -50%) rotate(${overlay.rotation ?? 0}deg)`,
		width: `${overlay.scale}%`,
		height: "auto",
		opacity: (overlay.opacity ?? 100) / 100,
	};
}

</script>

<template>
	<div
		ref="containerRef"
		:class="[
			'relative flex h-full min-h-0 w-full min-w-0 flex-col',
			isImageMode ? 'bg-[#2b2b2b]' : 'bg-[#0e0e10]',
		]"
	>
		<div
			:class="[
				'relative flex items-center justify-center px-3 py-1',
				isImageMode ? 'border-b border-black/30 bg-[#1e1e1e]' : 'border-b border-white/10',
			]"
		>
			<div v-if="!isImageMode" class="absolute left-2 top-1/2 -translate-y-1/2">
				<button
					type="button"
					:class="[
						'flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs transition-colors',
						currentSpeed !== 1
							? 'bg-primary/15 text-primary'
							: 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
					]"
					@click="showSpeedMenu = !showSpeedMenu"
				>
					{{ currentSpeed }}x
					<ChevronDown class="size-3" />
				</button>

				<div
					v-if="showSpeedMenu"
					class="absolute left-0 top-full z-50 mt-0.5 rounded-md border border-white/10 bg-[#1e1e22] py-1 shadow-lg"
				>
					<button
						v-for="rate in SPEED_OPTIONS"
						:key="rate"
						type="button"
						:class="[
							'flex w-full items-center px-4 py-1.5 text-xs transition-colors',
							currentSpeed === rate
								? 'text-primary bg-primary/10'
								: 'text-zinc-300 hover:bg-white/5',
						]"
						@click="setSpeed(rate)"
					>
						{{ rate }}x
					</button>
				</div>

				<div v-if="showSpeedMenu" class="fixed inset-0 z-40" @click="showSpeedMenu = false" />
			</div>

			<button
				type="button"
				class="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
				@click="showAspectMenu = !showAspectMenu"
			>
				{{ currentAspectLabel }}
				<ChevronDown class="size-3" />
			</button>

			<!-- Dropdown -->
			<div
				v-if="showAspectMenu"
				class="absolute top-full z-50 mt-0.5 rounded-md border border-white/10 bg-[#1e1e22] py-1 shadow-lg"
			>
				<button
					v-for="preset in aspectPresets"
					:key="preset.label"
					type="button"
					:class="[
						'flex w-full items-center gap-2 px-4 py-1.5 text-xs transition-colors',
						canvasWidth === preset.width && canvasHeight === preset.height
							? 'text-primary bg-primary/10'
							: 'text-zinc-300 hover:bg-white/5',
					]"
					@click="setAspectRatio(preset)"
				>
					{{ preset.label }}
					<span class="text-zinc-500">{{ preset.width }}×{{ preset.height }}</span>
				</button>

				<!-- Custom size toggle -->
				<div class="border-t border-white/10 mt-1 pt-1">
					<button
						type="button"
						class="flex w-full items-center gap-2 px-4 py-1.5 text-xs text-zinc-300 hover:bg-white/5 transition-colors"
						@click="showCustomSize = !showCustomSize; customWidth = canvasWidth; customHeight = canvasHeight"
					>
						Custom Size
					</button>
				</div>

				<!-- Custom size inputs -->
				<div v-if="showCustomSize" class="border-t border-white/10 px-3 py-2.5 space-y-2">
					<div class="flex items-center gap-2">
						<div class="flex-1">
							<label class="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5 block">Width</label>
							<input
								type="number"
								:value="customWidth"
								min="100"
								max="7680"
								class="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500/50"
								@input="onCustomWidthChange(Number(($event.target as HTMLInputElement).value))"
							/>
						</div>
						<button
							type="button"
							class="mt-3.5 rounded p-1 transition-colors"
							:class="linkDimensions ? 'text-blue-400 bg-blue-500/10' : 'text-zinc-600 hover:text-zinc-400'"
							title="Link dimensions"
							@click="linkDimensions = !linkDimensions"
						>
							<Link2 class="size-3" />
						</button>
						<div class="flex-1">
							<label class="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5 block">Height</label>
							<input
								type="number"
								:value="customHeight"
								min="100"
								max="7680"
								class="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-blue-500/50"
								@input="onCustomHeightChange(Number(($event.target as HTMLInputElement).value))"
							/>
						</div>
					</div>
					<button
						type="button"
						class="w-full rounded bg-blue-600/80 py-1 text-[10px] font-medium text-white hover:bg-blue-600 transition-colors"
						@click="applyCustomSize"
					>
						Apply
					</button>
				</div>
			</div>

			<!-- Click-away -->
			<div v-if="showAspectMenu" class="fixed inset-0 z-40" @click="showAspectMenu = false; showCustomSize = false" />

			<!-- Right controls: Fullscreen, Social overlay -->
			<div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
				<!-- Fullscreen toggle -->
				<button
					type="button"
					class="flex items-center rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
					@click="toggleFullscreen"
				>
					<Minimize v-if="isFullscreen" class="size-4" />
					<Maximize v-else class="size-4" />
				</button>

				<button
					v-if="is916 && !isImageMode"
					type="button"
					:class="[
						'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
						activeSocialOverlay
							? 'bg-cyan-500/15 text-cyan-400'
							: 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
					]"
					@click="showSocialMenu = !showSocialMenu"
				>
					<Smartphone class="size-3.5" />
				</button>

				<div
					v-if="showSocialMenu"
					class="absolute right-0 top-full z-50 mt-0.5 w-44 rounded-md border border-white/10 bg-[#1e1e22] py-1 shadow-lg"
				>
					<button
						v-if="activeSocialOverlay"
						type="button"
						class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5"
						@click="activeSocialOverlay = null; showSocialMenu = false"
					>
						Hide Overlay
					</button>
					<button
						v-for="preset in SOCIAL_OVERLAY_PRESETS"
						:key="preset.platform"
						type="button"
						:class="[
							'flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors',
							activeSocialOverlay?.platform === preset.platform
								? 'text-cyan-400 bg-cyan-500/10'
								: 'text-zinc-300 hover:bg-white/5',
						]"
						@click="toggleSocialOverlay(preset)"
					>
						<span>{{ preset.icon }}</span>
						<span>{{ preset.label }}</span>
						<span class="ml-auto text-[10px] text-zinc-500">{{ preset.aspectRatio }}</span>
					</button>
				</div>

				<div v-if="showSocialMenu" class="fixed inset-0 z-40" @click="showSocialMenu = false" />
			</div>
		</div>

		<!-- Canvas + Interactive Overlay -->
		<div
			:class="[
				'flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-auto',
				isImageMode ? 'p-8' : 'p-4',
			]"
			@mousedown="onPreviewAreaMouseDown"
		>
			<div
				:class="[
					'preview-canvas-wrapper relative',
					isTransparentCanvas ? 'preview-canvas-wrapper--checkerboard' : '',
					isImageMode
						? 'shadow-[0_8px_28px_rgba(0,0,0,0.45)]'
						: 'rounded border border-white/15 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]',
				]"
				:style="{
					aspectRatio: `${projectWidth} / ${projectHeight}`,
					transform: `translate(${viewportPanX}px, ${viewportPanY}px)${viewportZoom !== 1 ? ` scale(${viewportZoom})` : ''}`,
					transformOrigin: 'center center',
					cursor: canvasCursor,
				}"
				@pointerdown="onCanvasPointerDown"
			>
				<canvas
					ref="canvasRef"
					:width="previewBackingSize.width"
					:height="previewBackingSize.height"
					class="block h-full w-full rounded-sm"
					:style="{
						background: canvasBackground,
						imageRendering: 'auto',
					}"
				/>
				<PreviewOverlay
					:class="{ 'pointer-events-none': !overlayInteractive }"
					:canvas-ref="canvasRef"
					:canvas-width="projectWidth"
					:canvas-height="projectHeight"
				/>
				<GuideOverlay
					:canvas-ref="canvasRef"
					:canvas-width="projectWidth"
					:canvas-height="projectHeight"
				/>
				<SocialOverlay
					v-if="activeSocialOverlay"
					:preset="activeSocialOverlay"
					:canvas-width="projectWidth"
					:canvas-height="projectHeight"
				/>
				<!-- Title-safe guides in image mode -->
				<div
					v-if="isImageMode && showSafeZones && !activeSocialOverlay"
					class="pointer-events-none absolute inset-0 z-10"
					aria-hidden="true"
				>
					<div
						class="absolute rounded border border-dashed border-cyan-400/35"
						:style="{
							left: safeAreaInset.horizontal,
							right: safeAreaInset.horizontal,
							top: safeAreaInset.vertical,
							bottom: safeAreaInset.vertical,
						}"
						title="Title-safe area"
					/>
				</div>
				<!-- Live brush/eraser stroke preview -->
				<canvas
					v-show="isImageMode && (paintPreviewActive || bgErasePreviewActive)"
					ref="paintOverlayRef"
					:width="projectWidth"
					:height="projectHeight"
					class="pointer-events-none absolute inset-0 z-[15] h-full w-full"
				/>
				<!-- Marquee selection overlay -->
				<div
					v-if="isImageMode && liveMarqueeStyle"
					class="pointer-events-none absolute z-20 border border-white bg-blue-400/15"
					:style="liveMarqueeStyle"
				/>
				<!-- Lasso path overlay -->
				<svg
					v-if="isImageMode && liveLassoPath"
					class="pointer-events-none absolute inset-0 z-20 h-full w-full"
					viewBox="0 0 100 100"
					preserveAspectRatio="none"
				>
					<path
						:d="liveLassoPath"
						fill="rgba(96, 165, 250, 0.15)"
						fill-rule="evenodd"
						stroke="white"
						stroke-width="0.4"
						stroke-dasharray="1.2 0.8"
						vector-effect="non-scaling-stroke"
					/>
				</svg>
				<!-- Gradient drag preview -->
				<svg
					v-if="isImageMode && gradientPreview"
					class="pointer-events-none absolute inset-0 z-20 h-full w-full"
				>
					<line
						:x1="gradientPreview.x1"
						:y1="gradientPreview.y1"
						:x2="gradientPreview.x2"
						:y2="gradientPreview.y2"
						stroke="white"
						stroke-width="2"
					/>
					<circle :cx="gradientPreview.x1" :cy="gradientPreview.y1" r="4" :fill="fillColor" />
					<circle :cx="gradientPreview.x2" :cy="gradientPreview.y2" r="4" :fill="strokeColor" />
				</svg>
				<!-- Clone / heal source marker -->
				<div
					v-if="cloneSourceMarker"
					class="pointer-events-none absolute z-20 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-cyan-400/80"
					:style="cloneSourceMarker"
					title="Clone source"
				/>
				<!-- Branding watermark overlay -->
				<img
					v-if="brandingWatermarkDataUrl && brandingWatermarkStyle"
					:src="brandingWatermarkDataUrl"
					class="pointer-events-none absolute select-none"
					:style="brandingWatermarkStyle"
					draggable="false"
				/>
				<!-- Branding layout overlays -->
				<img
					v-for="overlay in brandingOverlays"
					:key="overlay.id"
					v-show="brandingOverlayDataUrls[overlay.id]"
					:src="brandingOverlayDataUrls[overlay.id]"
					class="pointer-events-none absolute select-none"
					:style="getBrandingOverlayStyle(overlay)"
					draggable="false"
				/>
			</div>
		</div>

		<!-- Preview controls bar: zoom + quality -->
		<div
			:class="[
				'flex h-7 shrink-0 items-center justify-end gap-1 px-2',
				isImageMode ? 'border-t border-black/30 bg-[#1e1e1e]' : 'h-8 border-t border-white/10 bg-[#18181b]',
			]"
		>
			<span v-if="isImageMode" class="mr-auto pl-1 text-[10px] tabular-nums text-zinc-500">
				{{ projectWidth }} × {{ projectHeight }}
			</span>
			<button
				v-if="isImageMode"
				type="button"
				class="h-6 rounded px-2 text-[11px] transition-colors"
				:class="showSafeZones ? 'bg-white/10 text-zinc-200' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'"
				title="Toggle safe zones"
				@click="showSafeZones = !showSafeZones"
			>
				Guides
			</button>
			<div v-if="!isImageMode" class="relative">
				<button
					class="preview-quality__input preview-quality__select h-6 px-2 text-[11px]"
					title="Lowers decoded video and image resolution in the preview (blockier, faster). Timeline layout and overlay positions stay fixed."
					@click.stop="showQualityDropdown = !showQualityDropdown"
				>
					<span class="truncate">Quality: {{ qualityLabel }}</span>
					<ChevronDown class="h-3.5 w-3.5 transition-transform" :class="{ 'rotate-180': showQualityDropdown }" />
				</button>
				<div v-if="showQualityDropdown" class="preview-quality__dropdown">
					<button
						v-for="opt in qualityOptions"
						:key="opt.label"
						class="preview-quality__dropdown-item"
						:class="{ 'preview-quality__dropdown-item--selected': previewQuality === opt.value }"
						@click.stop="setQuality(opt.value)"
					>
						{{ opt.label }}
					</button>
				</div>
			</div>
			<div v-if="!isImageMode" class="h-4 w-px bg-white/10" />
			<!-- Zoom controls -->
			<button class="flex h-6 w-6 items-center justify-center rounded text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200" title="Zoom out (Ctrl+-)" @click="stepZoom(-ZOOM_STEP)">−</button>
			<button class="h-6 min-w-[42px] rounded bg-white/5 px-1 text-[11px] text-zinc-300 hover:bg-white/10" title="Current zoom">{{ zoomPercent }}</button>
			<button class="flex h-6 w-6 items-center justify-center rounded text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200" title="Zoom in (Ctrl++)" @click="stepZoom(ZOOM_STEP)">+</button>
			<button class="h-6 rounded bg-white/5 px-2 text-[11px] text-zinc-300 hover:bg-white/10" title="Fit zoom (Ctrl+0)" @click="fitZoom">Fit</button>
		</div>
	</div>
</template>

<style scoped>
.preview-canvas-wrapper {
	max-width: 100%;
	max-height: calc(100% - 2rem);
	flex-shrink: 0;
}

/* Photoshop-style transparency grid (preview only — never baked into export). */
.preview-canvas-wrapper--checkerboard {
	background-color: #ffffff;
	background-image: repeating-conic-gradient(#c8c8c8 0% 25%, #ffffff 0% 50%);
	background-size: 16px 16px;
	background-position: 0 0;
}

.preview-quality__input {
	width: 100%;
	background-color: rgb(255 255 255 / 0.05);
	border: 1px solid rgb(255 255 255 / 0.1);
	border-radius: 0.375rem;
	color: rgb(212 212 216);
	transition: all 150ms ease;
}

.preview-quality__select {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.375rem;
	cursor: pointer;
}

.preview-quality__input:hover {
	background-color: rgb(255 255 255 / 0.1);
	border-color: rgb(255 255 255 / 0.16);
}

.preview-quality__dropdown {
	position: absolute;
	bottom: calc(100% + 0.35rem);
	right: 0;
	min-width: 110px;
	background-color: rgb(24 24 27);
	border: 1px solid rgb(255 255 255 / 0.1);
	border-radius: 0.45rem;
	overflow: hidden;
	z-index: 100;
	box-shadow: 0 8px 24px rgb(0 0 0 / 0.45);
}

.preview-quality__dropdown-item {
	display: block;
	width: 100%;
	text-align: left;
	padding: 0.42rem 0.6rem;
	font-size: 11px;
	color: rgb(228 228 231);
	border: none;
	background: transparent;
	cursor: pointer;
	transition: background-color 150ms ease;
}

.preview-quality__dropdown-item:hover {
	background-color: rgb(255 255 255 / 0.08);
}

.preview-quality__dropdown-item--selected {
	background-color: rgb(6 182 212 / 0.15);
	color: rgb(103 232 249);
}
</style>
