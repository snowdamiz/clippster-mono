<script setup lang="ts">
import { ref, computed, watch, shallowRef, onUnmounted } from "vue";
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
const { isCropMode, activeSocialOverlay } = useEditorUIState();
const { selectedElements } = useElementSelection();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
let lastFrame = -1;
let lastScene: any = null;
let rendering = false;

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

const canvasWidth = computed(() => activeProject.value?.settings?.canvasSize?.width ?? 1920);
const canvasHeight = computed(() => activeProject.value?.settings?.canvasSize?.height ?? 1080);

const fps = computed(() => activeProject.value?.settings?.fps ?? 30);
const background = computed(() => activeProject.value?.settings?.background ?? { type: "color" as const, color: "#000000" });

const renderer = shallowRef<CanvasRenderer | null>(null);

watch([canvasWidth, canvasHeight, fps], ([w, h, f]) => {
	renderer.value = new CanvasRenderer({ width: w, height: h, fps: f });
	lastFrame = -1;
	lastScene = null;
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
	if (!isCropMode.value || selectedElements.value.length === 0) return raw;
	const sel = selectedElements.value[0];
	return raw.map((t) => {
		if (t.id !== sel.trackId) return t;
		return {
			...t,
			elements: t.elements.map((el) =>
				el.id === sel.elementId ? { ...el, crop: undefined } : el,
			),
		} as typeof t;
	});
});

watch(
	[sceneTracks, mediaAssets, background, canvasWidth, canvasHeight, sceneTransitions],
	() => {
		if (!activeProject.value) return;
		const duration = editor.timeline.getTotalDuration();
		const renderTree = buildScene({
			tracks: sceneTracks.value,
			mediaAssets: mediaAssets.value,
			duration,
			canvasSize: { width: canvasWidth.value, height: canvasHeight.value },
			background: background.value,
			transitions: sceneTransitions.value,
		});
		editor.renderer.setRenderTree({ renderTree });
	},
	{ immediate: true },
);

useRafLoop(() => {
	const canvas = canvasRef.value;
	const r = renderer.value;
	const renderTree = editor.renderer.getRenderTree();
	if (!canvas || !r || !renderTree) return;
	if (rendering) return;

	const time = editor.playback.getCurrentTime();
	const lastFrameTime = getLastFrameTime({ duration: renderTree.duration, fps: r.fps });
	const renderTime = Math.min(time, lastFrameTime);
	const frame = Math.floor(renderTime * r.fps);

	if (frame !== lastFrame || renderTree !== lastScene) {
		rendering = true;
		const commitFrame = frame;
		const commitTree = renderTree;
		const commitTime = renderTime;
		r.renderToCanvas({ node: commitTree, time: commitTime, targetCanvas: canvas })
			.then(() => {
				lastFrame = commitFrame;
				lastScene = commitTree;
				rendering = false;
			})
			.catch(() => {
				rendering = false;
			});
	}
});

const canvasBackground = computed(() => {
	const bg = background.value;
	if (!bg) return "transparent";
	return bg.type === "blur" ? "transparent" : bg.color;
});

// Branding watermark overlay
const { getWatermarkForCanvasSize, getOverlaysForCanvasSize } = useBrandingConfig();

const brandingWatermark = computed(() => {
	return getWatermarkForCanvasSize(canvasWidth.value, canvasHeight.value);
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
	return getOverlaysForCanvasSize(canvasWidth.value, canvasHeight.value) ?? [];
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
		<div class="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden p-4">
			<div class="preview-canvas-wrapper relative rounded border border-white/15 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
				:style="{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }"
			>
				<canvas
					ref="canvasRef"
					:width="canvasWidth"
					:height="canvasHeight"
					class="block h-full w-full rounded-sm"
					:style="{ background: canvasBackground }"
				/>
				<PreviewOverlay
					:canvas-ref="canvasRef"
					:canvas-width="canvasWidth"
					:canvas-height="canvasHeight"
				/>
				<GuideOverlay
					:canvas-ref="canvasRef"
					:canvas-width="canvasWidth"
					:canvas-height="canvasHeight"
				/>
				<SocialOverlay
					v-if="activeSocialOverlay"
					:preset="activeSocialOverlay"
					:canvas-width="canvasWidth"
					:canvas-height="canvasHeight"
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
	</div>
</template>

<style scoped>
.preview-canvas-wrapper {
	max-width: 100%;
	max-height: 100%;
}
</style>
