<script setup lang="ts">
import { ref, computed, watch, shallowRef, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useEditor } from "../../composables/useEditor";
import { useRafLoop } from "../../composables/useRafLoop";
import { useEditorUIState } from "../../composables/useEditorUIState";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import { useBrandingConfig } from "../../composables/useBrandingConfig";
import { useImageMode } from "../../composables/useImageMode";
import { CanvasRenderer } from "../../renderer/canvas-renderer";
import { buildScene } from "../../renderer/scene-builder";
import { getLastFrameTime } from "../../lib/time";
import type { TimelineTrack } from "../../types/timeline";
import type { AspectRatioId } from "../../types/project";
import type { SocialOverlayPreset } from "../../types/social-overlays";
import { ChevronDown, Smartphone, Maximize, Minimize, Link2 } from "lucide-vue-next";
import { SOCIAL_OVERLAY_PRESETS } from "../../constants/social-overlay-constants";
import PreviewOverlay from "./PreviewOverlay.vue";
import SocialOverlay from "./SocialOverlay.vue";

const { editor, version } = useEditor({
	subscribe: {
		playback: false,
		selection: false,
	},
});
const { isCropMode, activeSocialOverlay } = useEditorUIState();
const { selectedElements } = useElementSelection();
const { isImageMode } = useImageMode();

const aspectPresets = [
	{ width: 1920, height: 1080, label: "16:9" },
	{ width: 1080, height: 1920, label: "9:16" },
	{ width: 1080, height: 1080, label: "1:1" },
	{ width: 1080, height: 1350, label: "4:5" },
];

const showAspectMenu = ref(false);
const showSocialMenu = ref(false);
const showSpeedMenu = ref(false);
const isFullscreen = ref(false);
const containerRef = ref<HTMLDivElement | null>(null);

// Custom aspect ratio state
const showCustomSize = ref(false);
const customWidth = ref(1920);
const customHeight = ref(1080);
const linkDimensions = ref(true);

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

const currentSpeed = computed(() => {
	void version.value;
	return editor.playback.getPlaybackRate();
});

function setSpeed(rate: number) {
	editor.playback.setPlaybackRate({ rate });
	showSpeedMenu.value = false;
}

function toggleSocialOverlay(preset: SocialOverlayPreset) {
	if (activeSocialOverlay.value?.platform === preset.platform) {
		activeSocialOverlay.value = null;
	} else {
		activeSocialOverlay.value = preset;
	}
	showSocialMenu.value = false;
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
}

// Custom aspect ratio functions
function onCustomWidthChange(value: number) {
	customWidth.value = value;
	if (linkDimensions.value) {
		// Maintain aspect ratio when linked
		const aspect = customHeight.value / 1920; // Base aspect from original height
		customHeight.value = Math.round(value * aspect);
	}
}

function onCustomHeightChange(value: number) {
	customHeight.value = value;
	if (linkDimensions.value) {
		// Maintain aspect ratio when linked
		const aspect = customWidth.value / 1920; // Base aspect from original width
		customWidth.value = Math.round(value * aspect);
	}
}

function applyCustomSize() {
	editor.project.updateSettings({ 
		settings: { canvasSize: { width: customWidth.value, height: customHeight.value } } 
	});
	showAspectMenu.value = false;
	showCustomSize.value = false;
}

const canvasRef = ref<HTMLCanvasElement | null>(null);
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

const is916 = computed(() => {
	return canvasWidth.value === 1080 && canvasHeight.value === 1920;
});

watch(is916, (val) => {
	if (!val && !isImageMode.value) {
		activeSocialOverlay.value = null;
		showSocialMenu.value = false;
	}
});
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
		lastScene = renderTree;
		lastFrame = frame;
		r.renderToCanvas({ node: renderTree, time: renderTime, targetCanvas: canvas })
			.then(() => {
				rendering = false;
			})
			.catch(() => { rendering = false; });
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
		<!-- Aspect ratio + speed selector bar -->
		<div class="relative flex items-center justify-center border-b border-white/10 px-3 py-1.5">
			<!-- Playback speed selector (left) -->
			<div class="absolute left-2 top-1/2 -translate-y-1/2">
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

				<!-- Social overlay toggle (9:16 only) -->
				<button
					v-if="is916"
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
