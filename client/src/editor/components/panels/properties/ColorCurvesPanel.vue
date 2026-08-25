<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import type { ColorCurves, ColorCurvePoint } from "../../../types/timeline";

const props = defineProps<{
	curves: ColorCurves;
}>();

const emit = defineEmits<{
	(e: "update", curves: ColorCurves): void;
}>();

type Channel = "master" | "red" | "green" | "blue";

const CHANNEL_COLORS: Record<Channel, string> = {
	master: "#ffffff",
	red: "#f87171",
	green: "#4ade80",
	blue: "#60a5fa",
};

const activeChannel = ref<Channel>("master");
const canvasRef = ref<HTMLCanvasElement | null>(null);
const SIZE = 180;

/** Get the control points for a channel, defaulting to identity line */
function getPoints(channel: Channel): ColorCurvePoint[] {
	const pts = props.curves[channel];
	if (pts && pts.length >= 2) return pts;
	return [{ x: 0, y: 0 }, { x: 1, y: 1 }];
}

/** Evaluate the cubic spline at input x (0–1) using the control points */
function evalCurve(points: ColorCurvePoint[], x: number): number {
	if (points.length < 2) return x;
	if (x <= points[0].x) return points[0].y;
	if (x >= points[points.length - 1].x) return points[points.length - 1].y;

	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[i];
		const p1 = points[i + 1];
		if (x >= p0.x && x <= p1.x) {
			const t = p1.x === p0.x ? 0 : (x - p0.x) / (p1.x - p0.x);
			// Catmull-Rom tangents clamped at ends
			const m0y = i === 0 ? (p1.y - p0.y) : (points[i + 1].y - points[i - 1].y) / 2;
			const m1y = i === points.length - 2 ? (p1.y - p0.y) : (points[i + 2 < points.length ? i + 2 : points.length - 1].y - p0.y) / 2;
			const t2 = t * t;
			const t3 = t2 * t;
			const h00 = 2 * t3 - 3 * t2 + 1;
			const h10 = t3 - 2 * t2 + t;
			const h01 = -2 * t3 + 3 * t2;
			const h11 = t3 - t2;
			return Math.min(1, Math.max(0, h00 * p0.y + h10 * m0y + h01 * p1.y + h11 * m1y));
		}
	}
	return x;
}

function draw() {
	const canvas = canvasRef.value;
	if (!canvas) return;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	const s = SIZE;
	ctx.clearRect(0, 0, s, s);

	// Background
	ctx.fillStyle = "#1a1a1e";
	ctx.fillRect(0, 0, s, s);

	// Grid lines (4x4)
	ctx.strokeStyle = "rgba(255,255,255,0.07)";
	ctx.lineWidth = 1;
	for (let i = 1; i < 4; i++) {
		const pos = (i / 4) * s;
		ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, s); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(s, pos); ctx.stroke();
	}

	// Identity diagonal
	ctx.strokeStyle = "rgba(255,255,255,0.15)";
	ctx.lineWidth = 1;
	ctx.setLineDash([4, 4]);
	ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(s, 0); ctx.stroke();
	ctx.setLineDash([]);

	// Draw all channels in muted mode, active channel bright
	const channels: Channel[] = ["master", "red", "green", "blue"];
	for (const ch of channels) {
		if (ch === activeChannel.value) continue;
		const pts = getPoints(ch);
		ctx.strokeStyle = CHANNEL_COLORS[ch].replace(")", ", 0.2)").replace("rgb", "rgba");
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let px = 0; px < s; px++) {
			const x = px / s;
			const y = 1 - evalCurve(pts, x);
			if (px === 0) ctx.moveTo(px, y * s);
			else ctx.lineTo(px, y * s);
		}
		ctx.stroke();
	}

	// Active channel curve
	const activePts = getPoints(activeChannel.value);
	ctx.strokeStyle = CHANNEL_COLORS[activeChannel.value];
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	for (let px = 0; px < s; px++) {
		const x = px / s;
		const y = 1 - evalCurve(activePts, x);
		if (px === 0) ctx.moveTo(px, y * s);
		else ctx.lineTo(px, y * s);
	}
	ctx.stroke();

	// Control points
	for (const pt of activePts) {
		const cx = pt.x * s;
		const cy = (1 - pt.y) * s;
		ctx.fillStyle = "#1a1a1e";
		ctx.strokeStyle = CHANNEL_COLORS[activeChannel.value];
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(cx, cy, 5, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
	}
}

watch(() => [props.curves, activeChannel.value], draw, { deep: true });
onMounted(draw);

// --- Drag interaction ---
const dragIndex = ref<number | null>(null);
const HANDLE_RADIUS = 8;

function ptToCanvas(pt: ColorCurvePoint) {
	return { cx: pt.x * SIZE, cy: (1 - pt.y) * SIZE };
}

function canvasToPt(cx: number, cy: number): ColorCurvePoint {
	return {
		x: Math.min(1, Math.max(0, cx / SIZE)),
		y: Math.min(1, Math.max(0, 1 - cy / SIZE)),
	};
}

function getCanvasPos(e: MouseEvent | TouchEvent) {
	const canvas = canvasRef.value!;
	const rect = canvas.getBoundingClientRect();
	const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
	const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
	return {
		cx: (clientX - rect.left) * (SIZE / rect.width),
		cy: (clientY - rect.top) * (SIZE / rect.height),
	};
}

function onMouseDown(e: MouseEvent) {
	const { cx, cy } = getCanvasPos(e);
	const pts = getPoints(activeChannel.value);

	// Find closest point
	let closestIdx = -1;
	let closestDist = Infinity;
	for (let i = 0; i < pts.length; i++) {
		const { cx: px, cy: py } = ptToCanvas(pts[i]);
		const d = Math.hypot(cx - px, cy - py);
		if (d < closestDist) { closestDist = d; closestIdx = i; }
	}

	if (closestDist <= HANDLE_RADIUS) {
		dragIndex.value = closestIdx;
	} else {
		// Add a new control point
		const newPt = canvasToPt(cx, cy);
		const newPts = [...pts, newPt].sort((a, b) => a.x - b.x);
		const newIdx = newPts.findIndex((p) => p.x === newPt.x && p.y === newPt.y);
		dragIndex.value = newIdx;
		emitUpdate(newPts);
	}
	e.preventDefault();
}

function onMouseMove(e: MouseEvent) {
	if (dragIndex.value === null) return;
	const { cx, cy } = getCanvasPos(e);
	const pts = [...getPoints(activeChannel.value)];
	const idx = dragIndex.value;
	const newPt = canvasToPt(cx, cy);

	// Keep endpoints pinned to x=0 and x=1
	if (idx === 0) newPt.x = 0;
	if (idx === pts.length - 1) newPt.x = 1;

	pts[idx] = newPt;
	emitUpdate(pts);
}

function onMouseUp() {
	dragIndex.value = null;
}

function onDblClick(e: MouseEvent) {
	const { cx, cy } = getCanvasPos(e);
	const pts = getPoints(activeChannel.value);
	// Find and remove closest non-endpoint
	let closestIdx = -1;
	let closestDist = Infinity;
	for (let i = 1; i < pts.length - 1; i++) {
		const { cx: px, cy: py } = ptToCanvas(pts[i]);
		const d = Math.hypot(cx - px, cy - py);
		if (d < closestDist) { closestDist = d; closestIdx = i; }
	}
	if (closestDist <= HANDLE_RADIUS && closestIdx >= 0) {
		const newPts = pts.filter((_, i) => i !== closestIdx);
		emitUpdate(newPts);
	}
}

function emitUpdate(points: ColorCurvePoint[]) {
	const sorted = [...points].sort((a, b) => a.x - b.x);
	emit("update", { ...props.curves, [activeChannel.value]: sorted });
}

function resetChannel() {
	const newCurves = { ...props.curves };
	delete newCurves[activeChannel.value];
	emit("update", newCurves);
}

function resetAll() {
	emit("update", {});
}

onMounted(() => {
	window.addEventListener("mousemove", onMouseMove);
	window.addEventListener("mouseup", onMouseUp);
});
onUnmounted(() => {
	window.removeEventListener("mousemove", onMouseMove);
	window.removeEventListener("mouseup", onMouseUp);
});
</script>

<template>
	<div class="space-y-2">
		<!-- Channel selector -->
		<div class="flex gap-1">
			<button
				v-for="ch in (['master', 'red', 'green', 'blue'] as const)"
				:key="ch"
				type="button"
				:class="[
					'flex-1 rounded px-1.5 py-1 text-[10px] font-medium capitalize transition-colors',
					activeChannel === ch
						? 'bg-white/10 text-white'
						: 'text-zinc-500 hover:text-zinc-300',
				]"
				:style="activeChannel === ch ? { color: CHANNEL_COLORS[ch] } : {}"
				@click="activeChannel = ch"
			>
				{{ ch }}
			</button>
		</div>

		<!-- Curve canvas -->
		<div class="relative">
			<canvas
				ref="canvasRef"
				:width="SIZE"
				:height="SIZE"
				class="w-full rounded cursor-crosshair"
				style="image-rendering: pixelated;"
				@mousedown="onMouseDown"
				@dblclick="onDblClick"
			/>
		</div>

		<!-- Reset buttons -->
		<div class="flex items-center gap-2">
			<button
				type="button"
				class="flex-1 rounded border border-white/10 bg-white/5 py-1 text-[10px] text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
				@click="resetChannel"
			>
				Reset channel
			</button>
			<button
				type="button"
				class="flex-1 rounded border border-white/10 bg-white/5 py-1 text-[10px] text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200"
				@click="resetAll"
			>
				Reset all
			</button>
		</div>

		<p class="text-[9px] text-zinc-600">Click to add points · Double-click a point to remove · Drag to move</p>
	</div>
</template>
