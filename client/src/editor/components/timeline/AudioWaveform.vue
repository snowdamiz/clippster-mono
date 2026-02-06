<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from "vue";

const props = withDefaults(defineProps<{
	audioUrl?: string;
	audioBuffer?: AudioBuffer;
	height?: number;
}>(), {
	height: 32,
});

const waveformRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const isLoading = ref(true);
const error = ref(false);

function extractPeaks(buffer: AudioBuffer, length = 512): number[] {
	const data = buffer.getChannelData(0);
	const step = Math.floor(data.length / length);
	const peaks: number[] = [];

	for (let i = 0; i < length; i++) {
		const start = i * step;
		const end = Math.min(start + step, data.length);
		let max = 0;
		for (let j = start; j < end; j++) {
			const abs = Math.abs(data[j]);
			if (abs > max) max = abs;
		}
		peaks.push(max);
	}
	return peaks;
}

function drawWaveform(peaks: number[]) {
	const canvas = canvasRef.value;
	if (!canvas) return;

	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	const dpr = window.devicePixelRatio || 1;
	const rect = canvas.getBoundingClientRect();
	canvas.width = rect.width * dpr;
	canvas.height = rect.height * dpr;
	ctx.scale(dpr, dpr);

	const w = rect.width;
	const h = rect.height;
	const barWidth = 2;
	const gap = 1;
	const totalBarWidth = barWidth + gap;
	const numBars = Math.floor(w / totalBarWidth);

	ctx.clearRect(0, 0, w, h);
	ctx.fillStyle = "rgba(255, 255, 255, 0.6)";

	const step = peaks.length / numBars;
	for (let i = 0; i < numBars; i++) {
		const peakIndex = Math.floor(i * step);
		const peak = peaks[peakIndex] ?? 0;
		const barHeight = Math.max(1, peak * h * 0.9);
		const x = i * totalBarWidth;
		const y = (h - barHeight) / 2;
		ctx.fillRect(x, y, barWidth, barHeight);
	}
}

async function loadFromUrl(url: string) {
	try {
		isLoading.value = true;
		error.value = false;

		const response = await fetch(url);
		const arrayBuffer = await response.arrayBuffer();
		const audioCtx = new AudioContext();
		const buffer = await audioCtx.decodeAudioData(arrayBuffer);
		audioCtx.close();

		const peaks = extractPeaks(buffer);
		await nextTick();
		drawWaveform(peaks);
		isLoading.value = false;
	} catch (err) {
		console.error("AudioWaveform: Failed to load audio:", err);
		error.value = true;
		isLoading.value = false;
	}
}

function loadFromBuffer(buffer: AudioBuffer) {
	try {
		isLoading.value = true;
		error.value = false;
		const peaks = extractPeaks(buffer);
		drawWaveform(peaks);
		isLoading.value = false;
	} catch (err) {
		console.error("AudioWaveform: Failed to process buffer:", err);
		error.value = true;
		isLoading.value = false;
	}
}

function init() {
	if (props.audioBuffer) {
		loadFromBuffer(props.audioBuffer);
	} else if (props.audioUrl) {
		loadFromUrl(props.audioUrl);
	}
}

watch(() => [props.audioUrl, props.audioBuffer], init);

onMounted(() => {
	init();
});

// Handle resize
let resizeObserver: ResizeObserver | null = null;
onMounted(() => {
	if (waveformRef.value) {
		resizeObserver = new ResizeObserver(() => {
			if (!isLoading.value && !error.value) {
				init();
			}
		});
		resizeObserver.observe(waveformRef.value);
	}
});

onUnmounted(() => {
	resizeObserver?.disconnect();
});
</script>

<template>
	<div v-if="error" class="flex items-center justify-center" :style="{ height: `${height}px` }">
		<span class="text-zinc-400/60 text-xs">Audio unavailable</span>
	</div>
	<div v-else ref="waveformRef" class="relative" :style="{ height: `${height}px` }">
		<div v-if="isLoading" class="absolute inset-0 flex items-center justify-center">
			<span class="text-zinc-400/60 text-xs">Loading...</span>
		</div>
		<canvas
			ref="canvasRef"
			class="size-full"
			:class="isLoading ? 'opacity-0' : 'opacity-100'"
		/>
	</div>
</template>
