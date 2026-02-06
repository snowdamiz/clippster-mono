<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, shallowRef } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useRafLoop } from "../../composables/useRafLoop";
import { CanvasRenderer } from "../../renderer/canvas-renderer";
import { buildScene } from "../../renderer/scene-builder";
import { getLastFrameTime } from "../../lib/time";
import { ChevronDown } from "lucide-vue-next";
import PreviewOverlay from "./PreviewOverlay.vue";

const { editor, version } = useEditor();

const aspectPresets = [
	{ width: 1920, height: 1080, label: "16:9" },
	{ width: 1080, height: 1920, label: "9:16" },
	{ width: 1080, height: 1080, label: "1:1" },
	{ width: 1080, height: 1350, label: "4:5" },
];

const showAspectMenu = ref(false);

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

const canvasRef = ref<HTMLCanvasElement | null>(null);
let lastFrame = -1;
let lastScene: any = null;
let rendering = false;

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActive();
});

const canvasWidth = computed(() => activeProject.value?.settings?.canvasSize?.width ?? 1920);
const canvasHeight = computed(() => activeProject.value?.settings?.canvasSize?.height ?? 1080);
const fps = computed(() => activeProject.value?.settings?.fps ?? 30);
const background = computed(() => activeProject.value?.settings?.background);

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

watch(
	[tracks, mediaAssets, background, canvasWidth, canvasHeight],
	() => {
		if (!activeProject.value) return;
		const duration = editor.timeline.getTotalDuration();
		const renderTree = buildScene({
			tracks: tracks.value,
			mediaAssets: mediaAssets.value,
			duration,
			canvasSize: { width: canvasWidth.value, height: canvasHeight.value },
			background: background.value,
		});
		editor.renderer.setRenderTree({ renderTree });
	},
	{ deep: true, immediate: true },
);

// RAF render loop
useRafLoop(() => {
	const canvas = canvasRef.value;
	const r = renderer.value;
	const renderTree = editor.renderer.getRenderTree();
	if (!canvas || !r || !renderTree || rendering) return;

	const time = editor.playback.getCurrentTime();
	const lastFrameTime = getLastFrameTime({ duration: renderTree.duration, fps: r.fps });
	const renderTime = Math.min(time, lastFrameTime);
	const frame = Math.floor(renderTime * r.fps);

	if (frame !== lastFrame || renderTree !== lastScene) {
		rendering = true;
		lastScene = renderTree;
		lastFrame = frame;
		r.renderToCanvas({ node: renderTree, time: renderTime, targetCanvas: canvas })
			.then(() => { rendering = false; })
			.catch(() => { rendering = false; });
	}
});

const canvasBackground = computed(() => {
	const bg = background.value;
	if (!bg) return "transparent";
	return bg.type === "blur" ? "transparent" : bg.color;
});
</script>

<template>
	<div class="relative flex h-full min-h-0 w-full min-w-0 flex-col bg-[#0e0e10]">
		<!-- Aspect ratio selector bar -->
		<div class="relative flex items-center justify-center border-b border-white/10 px-3 py-1.5">
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
			</div>

			<!-- Click-away -->
			<div v-if="showAspectMenu" class="fixed inset-0 z-40" @click="showAspectMenu = false" />
		</div>

		<!-- Canvas + Interactive Overlay -->
		<div class="flex min-h-0 min-w-0 flex-1 items-center justify-center p-4">
			<div class="relative inline-flex max-h-full max-w-full rounded border border-white/15 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]">
				<canvas
					ref="canvasRef"
					:width="canvasWidth"
					:height="canvasHeight"
					class="block max-h-full max-w-full rounded-sm"
					:style="{ background: canvasBackground, aspectRatio: `${canvasWidth} / ${canvasHeight}` }"
				/>
				<PreviewOverlay
					:canvas-ref="canvasRef"
					:canvas-width="canvasWidth"
					:canvas-height="canvasHeight"
				/>
			</div>
		</div>
	</div>
</template>
