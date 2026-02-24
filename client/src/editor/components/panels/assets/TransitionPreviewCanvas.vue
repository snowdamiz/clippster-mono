<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import {
	THUMB_W,
	THUMB_H,
	drawSampleScene,
	drawSampleSceneB,
	renderTransitionPreview,
} from "../../../composables/usePreviewThumbnails";

const props = defineProps<{
	transitionType: string;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let animId = 0;
let isHovering = false;
let sceneA: HTMLCanvasElement | null = null;
let sceneB: HTMLCanvasElement | null = null;
let scenesReady = false;

async function ensureScenes() {
	if (scenesReady) return;
	
	if (!sceneA) {
		sceneA = document.createElement("canvas");
		sceneA.width = THUMB_W;
		sceneA.height = THUMB_H;
		await drawSampleScene(sceneA.getContext("2d")!, THUMB_W, THUMB_H);
	}
	if (!sceneB) {
		sceneB = document.createElement("canvas");
		sceneB.width = THUMB_W;
		sceneB.height = THUMB_H;
		await drawSampleSceneB(sceneB.getContext("2d")!, THUMB_W, THUMB_H);
	}
	
	scenesReady = true;
}

async function drawFrame(progress: number) {
	const canvas = canvasRef.value;
	if (!canvas) return;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	await ensureScenes();
	ctx.clearRect(0, 0, THUMB_W, THUMB_H);
	await renderTransitionPreview(ctx, props.transitionType, THUMB_W, THUMB_H, progress, sceneA!, sceneB!);
}

async function drawStatic() {
	await drawFrame(0);
}

let startTime = 0;
const LOOP_DURATION = 1200;

function animate(timestamp: number) {
	if (!isHovering) return;
	if (!startTime) startTime = timestamp;
	const elapsed = timestamp - startTime;
	const progress = Math.min((elapsed % LOOP_DURATION) / LOOP_DURATION, 1);
	drawFrame(progress);
	animId = requestAnimationFrame(animate);
}

function onMouseEnter() {
	isHovering = true;
	startTime = 0;
	animId = requestAnimationFrame(animate);
}

function onMouseLeave() {
	isHovering = false;
	if (animId) {
		cancelAnimationFrame(animId);
		animId = 0;
	}
	drawStatic();
}

onMounted(() => {
	drawStatic();
});

onBeforeUnmount(() => {
	if (animId) {
		cancelAnimationFrame(animId);
		animId = 0;
	}
});
</script>

<template>
	<canvas
		ref="canvasRef"
		:width="THUMB_W"
		:height="THUMB_H"
		class="size-full object-cover"
		@mouseenter="onMouseEnter"
		@mouseleave="onMouseLeave"
	/>
</template>
