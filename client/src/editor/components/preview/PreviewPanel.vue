<script setup lang="ts">
import { ref, computed, watch, shallowRef, onUnmounted, onMounted } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { invoke } from "@tauri-apps/api/core";
import { useEditor } from "../../composables/useEditor";
import { useRafLoop } from "../../composables/useRafLoop";
import { useEditorUIState } from "../../composables/useEditorUIState";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import { useBrandingConfig } from "../../composables/useBrandingConfig";
import { CanvasRenderer } from "../../renderer/canvas-renderer";
import { buildScene } from "../../renderer/scene-builder";
import { getLastFrameTime } from "../../lib/time";
import type { TimelineTrack } from "../../types/timeline";
import PreviewOverlay from "./PreviewOverlay.vue";
import SocialOverlay from "./SocialOverlay.vue";
import GuideOverlay from "./GuideOverlay.vue";

const { editor, version } = useEditor({
	subscribe: {
		playback: false,
		selection: false,
	},
});
const { isCropMode, activeSocialOverlay, viewportZoom, previewQuality, fitMode } = useEditorUIState();
const { selectedElements } = useElementSelection();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
let lastFrame = -1;
let lastScene: any = null;
let lastRenderedTime = Number.NEGATIVE_INFINITY;
let rendering = false;
let idleTickCount = 0;

// Register canvas on editor core so freeze-frame can capture it
watch(canvasRef, (canvas) => {
	editor.setPreviewCanvas(canvas);
});
onUnmounted(() => {
	editor.setPreviewCanvas(null);
});

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

const projectWidth = computed(() => activeProject.value?.settings?.canvasSize?.width ?? 1920);
const projectHeight = computed(() => activeProject.value?.settings?.canvasSize?.height ?? 1080);

// Preview quality scaling: render scene at lower internal resolution,
// then upscale to project canvas size for display/interaction consistency.
const previewScale = computed(() => {
	const q = previewQuality.value;
	if (q === "auto") return 1;
	return Math.min(1, q / projectHeight.value);
});

const renderWidth = computed(() => Math.max(1, Math.round(projectWidth.value * previewScale.value)));
const renderHeight = computed(() => Math.max(1, Math.round(projectHeight.value * previewScale.value)));

const fps = computed(() => activeProject.value?.settings?.fps ?? 30);
const background = computed(() => activeProject.value?.settings?.background ?? { type: "color" as const, color: "#000000" });

const renderer = shallowRef<CanvasRenderer | null>(null);

watch([renderWidth, renderHeight, fps], ([w, h, f]) => {
	// Use a DOM canvas-backed renderer for preview. Several transition effects rely on
	// alpha/clip compositing that is unreliable when the destination context is OffscreenCanvas
	// in Chromium/Electron, which makes wipes/crossfades appear as no-ops in preview.
	renderer.value = new CanvasRenderer({ width: w, height: h, fps: f, preferOffscreen: false });
	lastFrame = -1;
	lastScene = null;
	lastRenderedTime = Number.NEGATIVE_INFINITY;
}, { immediate: true });

// Rebuild render tree when tracks/media/settings change
const tracks = computed(() => {
	void version.value;
	return editor.timeline.getTracks();
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

// When in crop mode, strip crop from the selected element so canvas shows full frame
const sceneTracks = computed((): TimelineTrack[] => {
	const raw = tracks.value;
	const selectedElement = selectedElements.value[0];

	return raw.map((t) => {
		const nextElements = t.elements.map((el) => {
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
	});
});

watch(
	[sceneTracks, mediaAssets, background, renderWidth, renderHeight, sceneTransitions],
	() => {
		if (!activeProject.value) return;
		const duration = editor.timeline.getTotalDuration();
		const renderTree = buildScene({
			tracks: sceneTracks.value,
			mediaAssets: mediaAssets.value,
			duration,
			canvasSize: { width: renderWidth.value, height: renderHeight.value },
			background: background.value,
			transitions: sceneTransitions.value,
		});
		editor.renderer.setRenderTree({ renderTree });
	},
	{ immediate: true },
);

let rafTickCount = 0;
useRafLoop(() => {
	rafTickCount++;
	const canvas = canvasRef.value;
	const r = renderer.value;
	const renderTree = editor.renderer.getRenderTree();
	if (!canvas || !r || !renderTree) return;
	if (rendering) return;

	const time = editor.playback.getCurrentTime();
	const lastFrameTime = getLastFrameTime({ duration: renderTree.duration, fps: r.fps });
	const renderTime = Math.min(time, lastFrameTime);
	const frame = Math.floor(renderTime * r.fps);
	const isPlaying = editor.playback.getIsPlaying();
	// Re-render when the frame index changes, the tree changes, or time moves meaningfully while
	// playing (avoids missing short transitions if rAF and playback timers rarely align on the
	// same floor(time*fps) tick). When paused, small scrubs still update via frame index.
	const timeMoved =
		isPlaying && Math.abs(renderTime - lastRenderedTime) >= 1 / Math.max(24, r.fps * 2);

	const needsRender = frame !== lastFrame || renderTree !== lastScene || timeMoved;

	// When paused and nothing changed, throttle to ~15Hz after 250ms idle to save GPU.
	if (!needsRender) {
		idleTickCount++;
		if (!isPlaying && idleTickCount > 15 && rafTickCount % 4 !== 0) return;
		return;
	}

	idleTickCount = 0;
	rendering = true;
	const commitFrame = frame;
	const commitTree = renderTree;
	const commitTime = renderTime;
	r.renderToCanvas({ node: commitTree, time: commitTime, targetCanvas: canvas })
		.then(() => {
			lastFrame = commitFrame;
			lastScene = commitTree;
			lastRenderedTime = commitTime;
			rendering = false;
		})
		.catch(() => {
			rendering = false;
		});
});

const canvasBackground = computed(() => {
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
}

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

onMounted(() => {
	containerRef.value?.addEventListener('wheel', onWheelZoom, { passive: false });
	window.addEventListener("keydown", onKeyZoom);
});

onUnmounted(() => {
	containerRef.value?.removeEventListener('wheel', onWheelZoom);
	window.removeEventListener("keydown", onKeyZoom);
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
	<div ref="containerRef" class="relative flex h-full min-h-0 w-full min-w-0 flex-col bg-[#0e0e10]">
		<!-- Canvas + Interactive Overlay -->
		<div class="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-auto p-4">
			<div
				class="preview-canvas-wrapper relative rounded border border-white/15 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
				:style="{
					aspectRatio: `${projectWidth} / ${projectHeight}`,
					transform: viewportZoom !== 1 ? `scale(${viewportZoom})` : undefined,
					transformOrigin: 'center center',
				}"
			>
				<canvas
					ref="canvasRef"
					:width="projectWidth"
					:height="projectHeight"
					class="block h-full w-full rounded-sm"
					:style="{
						background: canvasBackground,
						imageRendering: previewScale < 1 ? 'pixelated' : 'auto',
					}"
				/>
				<PreviewOverlay
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
		<div class="flex h-8 shrink-0 items-center justify-end gap-1 border-t border-white/10 bg-[#18181b] px-2">
			<!-- Quality selector -->
			<div class="relative">
				<button
					class="preview-quality__input preview-quality__select h-6 px-2 text-[11px]"
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
			<div class="h-4 w-px bg-white/10" />
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
