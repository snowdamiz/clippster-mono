<script setup lang="ts">
import { RotateCcw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
/**
 * Three-way color correction panel (Shadows / Midtones / Highlights).
 * Each wheel adds a directional color cast to that tonal range,
 * plus a Luminance slider below.
 */
import { ref, onMounted, onUnmounted, watch } from "vue";
import type { ColorWheels, ColorWheelValues } from "../../../types/timeline";

const props = defineProps<{
	wheels: ColorWheels;
}>();

const emit = defineEmits<{
	(e: "update", wheels: ColorWheels): void;
}>();

type Range = "shadows" | "midtones" | "highlights";
const RANGE_LABELS: Record<Range, string> = {
	shadows: "Shadows",
	midtones: "Midtones",
	highlights: "Highlights",
};

const WHEEL_SIZE = 96;
const INDICATOR_RADIUS = 7;
const WHEEL_RESPONSE = 0.5;
const FINE_WHEEL_RESPONSE = 0.2;

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

	// Draw a larger, high-contrast handle for precise grading.
	const hRad = (vals.hue * Math.PI) / 180;
	const sat = Math.min(1, Math.abs(vals.saturation) / WHEEL_RESPONSE);
	const dotX = cx + Math.cos(hRad) * sat * r;
	const dotY = cy + Math.sin(hRad) * sat * r;

	ctx.fillStyle = "#ffffff";
	ctx.strokeStyle = "#000000";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(dotX, dotY, INDICATOR_RADIUS, 0, Math.PI * 2);
	ctx.fill();
	ctx.stroke();

	ctx.strokeStyle = "rgba(255,255,255,0.75)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(dotX, dotY, INDICATOR_RADIUS + 2, 0, Math.PI * 2);
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
	const response = e.shiftKey ? FINE_WHEEL_RESPONSE : WHEEL_RESPONSE;
	const sat = (dist / r) * response;

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
		<div class="grid grid-cols-3 gap-2">
			<div
				v-for="range in (['shadows', 'midtones', 'highlights'] as const)"
				:key="range"
				class="flex min-w-0 flex-col items-center gap-2"
			>
				<!-- Label + reset -->
				<div class="flex w-full items-center justify-between gap-1">
					<span class="truncate text-2xs font-medium text-fg-muted">{{ RANGE_LABELS[range] }}</span>
					<button
						type="button"
						class="grid size-4 shrink-0 place-items-center rounded text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
						:title="`Reset ${RANGE_LABELS[range]}`"
						:aria-label="`Reset ${RANGE_LABELS[range]}`"
						@click="resetRange(range)"
					>
						<RotateCcw class="size-2.5" />
					</button>
				</div>

				<!-- Color wheel canvas -->
				<canvas
					:ref="(el) => { wheelRefs[range] = el as HTMLCanvasElement | null; redrawAll(); }"
					:width="WHEEL_SIZE"
					:height="WHEEL_SIZE"
					class="aspect-square w-full max-w-[96px] cursor-grab rounded-full active:cursor-grabbing"
					@mousedown="(e) => startDrag(e, range)"
				/>

				<!-- Luminance slider -->
				<div class="w-full">
					<div class="flex items-center justify-between">
						<span class="text-2xs text-fg-subtle">Lum</span>
						<span class="tabular text-2xs text-fg-muted">{{ (getValues(range).luminance * 100).toFixed(0) }}</span>
					</div>
					<input
						type="range"
						:value="getValues(range).luminance"
						min="-1"
						max="1"
						step="0.01"
						class="w-full"
						:aria-label="`${RANGE_LABELS[range]} luminance`"
						@input="(e) => updateLuminance(range, Number((e.target as HTMLInputElement).value))"
					/>
				</div>
			</div>
		</div>

		<Button variant="secondary" size="xs" block @click="resetAll">Reset all wheels</Button>
		<p class="text-2xs text-fg-subtle">Drag inside a wheel to add color · Hold Shift for finer moves</p>
	</div>
</template>
