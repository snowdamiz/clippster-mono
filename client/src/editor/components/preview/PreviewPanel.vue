<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, shallowRef } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useRafLoop } from "../../composables/useRafLoop";
import { CanvasRenderer } from "../../renderer/canvas-renderer";
import { buildScene } from "../../renderer/scene-builder";
import { getLastFrameTime } from "../../lib/time";

const { editor, version } = useEditor();

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
		<div class="flex min-h-0 min-w-0 flex-1 items-center justify-center p-4">
			<canvas
				ref="canvasRef"
				:width="canvasWidth"
				:height="canvasHeight"
				class="block max-h-full max-w-full rounded-sm"
				:style="{ background: canvasBackground, aspectRatio: `${canvasWidth} / ${canvasHeight}` }"
			/>
		</div>
	</div>
</template>
