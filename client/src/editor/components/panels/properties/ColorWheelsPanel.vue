<script setup lang="ts">
/**
 * Three-way color correction panel (Lift / Gamma / Gain).
 * Each wheel controls Hue rotation and Saturation boost for that
 * tonal range, plus a Luminance slider below.
 */
import { ref, onMounted, onUnmounted } from "vue";
import type { ColorWheels, ColorWheelValues } from "../../../types/timeline";

const props = defineProps<{
	wheels: ColorWheels;
}>();

const emit = defineEmits<{
	(e: "update", wheels: ColorWheels): void;
}>();

type Range = "shadows" | "midtones" | "highlights";
const RANGE_LABELS: Record<Range, string> = {
	shadows: "Lift",
	midtones: "Gamma",
	highlights: "Gain",
};

const WHEEL_SIZE = 80; // px diameter of the canvas wheel

function getValues(range: Range): ColorWheelValues {
	return props.wheels[range] ?? { hue: 0, saturation: 0, luminance: 0 };
}

function emitRange(range: Range, vals: ColorWheelValues) {
	emit("update", { ...props.wheels, [range]: vals });
}

// --- Wheel interaction ---
const wheelRefs = ref<Record<Range, HTMLCanvasElement | null>>({
	shadows: null,
	midtones: null,
	highlights: null,
});

function drawWheel(canvas: HTMLCanvasElement, vals: ColorWheelValues) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	const s = WHEEL_SIZE;
	const cx = s / 2;
	const cy = s / 2;
	const r = s / 2 - 2;

	ctx.clearRect(0, 0, s, s);

	// Draw hue/saturation wheel as an image gradient
	const imageData = ctx.createImageData(s, s);
	for (let py = 0; py < s; py++) {
		for (let px = 0; px < s; px++) {
			const dx = px - cx;
			const dy = py - cy;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist > r) {
				// transparent outside circle
				continue;
			}
			const sat = dist / r;
			const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
			// Convert HSV to RGB (full brightness)
			const [rr, gg, bb] = hsvToRgb(hue, sat, 1);
			const idx = (py * s + px) * 4;
			imageData.data[idx] = rr;
			imageData.data[idx + 1] = gg;
			imageData.data[idx + 2] = bb;
			imageData.data[idx + 3] = 200;
		}
	}
	ctx.putImageData(imageData, 0, 0);

	// Dark overlay for unselected area
	const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
	grad.addColorStop(0, "rgba(0,0,0,0.5)");
	grad.addColorStop(1, "rgba(0,0,0,0)");
	ctx.fillStyle = grad;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fill();

	// Draw border
	ctx.strokeStyle = "rgba(255,255,255,0.15)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.stroke();

	// Draw indicator dot
	const hRad = (vals.hue * Math.PI) / 180;
	const sat = Math.min(1, Math.abs(vals.saturation));
	const dotX = cx + Math.cos(hRad) * sat * r;
	const dotY = cy + Math.sin(hRad) * sat * r;

	ctx.fillStyle = "#ffffff";
	ctx.strokeStyle = "#000000";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
	const hi = Math.floor(h / 60) % 6;
	const f = h / 60 - Math.floor(h / 60);
	const p = v * (1 - s);
	const q = v * (1 - f * s);
	const t = v * (1 - (1 - f) * s);
	const vals = [
		[v, t, p], [q, v, p], [p, v, t],
		[p, q, v], [t, p, v], [v, p, q],
	][hi];
	return [Math.round(vals[0] * 255), Math.round(vals[1] * 255), Math.round(vals[2] * 255)];
}

function redrawAll() {
	for (const range of ["shadows", "midtones", "highlights"] as Range[]) {
		const canvas = wheelRefs.value[range];
		if (canvas) drawWheel(canvas, getValues(range));
	}
}

// Watch for external prop changes
import { watch } from "vue";
watch(() => props.wheels, redrawAll, { deep: true });
onMounted(redrawAll);

// Drag state
const dragging = ref<Range | null>(null);

function startDrag(e: MouseEvent, range: Range) {
	dragging.value = range;
	handleDrag(e, range);
	e.preventDefault();
}

function handleDrag(e: MouseEvent, range: Range) {
	const canvas = wheelRefs.value[range];
	if (!canvas) return;
	const rect = canvas.getBoundingClientRect();
	const cx = WHEEL_SIZE / 2;
	const cy = WHEEL_SIZE / 2;
	const r = WHEEL_SIZE / 2 - 2;

	const px = (e.clientX - rect.left) * (WHEEL_SIZE / rect.width);
	const py = (e.clientY - rect.top) * (WHEEL_SIZE / rect.height);
	const dx = px - cx;
	const dy = py - cy;
	const dist = Math.min(r, Math.sqrt(dx * dx + dy * dy));
	const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
	const sat = dist / r;

	const current = getValues(range);
	emitRange(range, { ...current, hue, saturation: sat });
}

function onGlobalMouseMove(e: MouseEvent) {
	if (!dragging.value) return;
	handleDrag(e, dragging.value);
}
function onGlobalMouseUp() {
	dragging.value = null;
}

onMounted(() => {
	window.addEventListener("mousemove", onGlobalMouseMove);
	window.addEventListener("mouseup", onGlobalMouseUp);
});
onUnmounted(() => {
	window.removeEventListener("mousemove", onGlobalMouseMove);
	window.removeEventListener("mouseup", onGlobalMouseUp);
});

function updateLuminance(range: Range, value: number) {
	const current = getValues(range);
	emitRange(range, { ...current, luminance: value });
}

function resetRange(range: Range) {
	const newWheels = { ...props.wheels };
	delete newWheels[range];
	emit("update", newWheels);
}

function resetAll() {
	emit("update", {});
}
</script>

<template>
	<div class="space-y-3">
		<div class="grid grid-cols-3 gap-3">
			<div
				v-for="range in (['shadows', 'midtones', 'highlights'] as const)"
				:key="range"
				class="flex flex-col items-center gap-1.5"
			>
				<!-- Label + reset -->
				<div class="flex w-full items-center justify-between">
					<span class="text-[10px] text-zinc-400">{{ RANGE_LABELS[range] }}</span>
					<button
						type="button"
						class="text-[9px] text-zinc-600 transition-colors hover:text-zinc-400"
						@click="resetRange(range)"
					>
						↺
					</button>
				</div>

				<!-- Color wheel canvas -->
				<canvas
					:ref="(el) => { wheelRefs[range] = el as HTMLCanvasElement | null; redrawAll(); }"
					:width="WHEEL_SIZE"
					:height="WHEEL_SIZE"
					class="cursor-crosshair rounded-full"
					style="width: 80px; height: 80px;"
					@mousedown="(e) => startDrag(e, range)"
				/>

				<!-- Luminance slider -->
				<div class="w-full space-y-0.5">
					<div class="flex items-center justify-between">
						<span class="text-[9px] text-zinc-600">Lum</span>
						<span class="text-[9px] text-zinc-500">{{ (getValues(range).luminance * 100).toFixed(0) }}</span>
					</div>
					<input
						type="range"
						:value="getValues(range).luminance"
						min="-1"
						max="1"
						step="0.01"
						class="w-full"
						@input="(e) => updateLuminance(range, Number((e.target as HTMLInputElement).value))"
					/>
				</div>
			</div>
		</div>

		<button
			type="button"
			class="w-full rounded border border-white/10 bg-white/5 py-1 text-[10px] text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
			@click="resetAll"
		>
			Reset all wheels
		</button>
	</div>
</template>
