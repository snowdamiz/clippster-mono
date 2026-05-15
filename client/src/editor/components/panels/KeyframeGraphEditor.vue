<script setup lang="ts">
/**
 * Visual SVG keyframe graph editor.
 * Shows animated property values over the element's normalised time (0–1)
 * as interactive cubic bezier curves with draggable diamond handles.
 *
 * Plugs into the existing useKeyframes composable — no new data layer needed.
 * Graph view is toggled from KeyframeEditorPanel.vue.
 */
import { ref, computed, type Ref } from "vue";
import type { KeyframableProperty, KeyframeInterpolation, Keyframe } from "../../types/keyframes";
import type { TimelineTrack, TimelineElement } from "../../types/timeline";
import { useKeyframes } from "../../composables/useKeyframes";

const props = defineProps<{
	trackRef: Ref<TimelineTrack>;
	elementRef: Ref<TimelineElement>;
	applicableProperties: {
		key: KeyframableProperty;
		label: string;
		defaultValue: number;
		min: number;
		max: number;
		step: number;
	}[];
}>();

const kf = useKeyframes({ trackRef: props.trackRef, elementRef: props.elementRef });

// ── Graph dimensions ──────────────────────────────────────────────────────

const GRAPH_W = 280;
const GRAPH_H = 120;
const PADDING = { top: 8, right: 8, bottom: 20, left: 28 };
const plotW = GRAPH_W - PADDING.left - PADDING.right;
const plotH = GRAPH_H - PADDING.top - PADDING.bottom;

// ── Property colours ──────────────────────────────────────────────────────

const PROP_COLORS: Record<string, string> = {
	opacity:   "#3b82f6", // blue
	scale:     "#22c55e", // green
	positionX: "#f97316", // orange
	positionY: "#ef4444", // red
	rotation:  "#a855f7", // purple
	volume:    "#facc15", // yellow
	speed:     "#06b6d4", // cyan
};

function propColor(key: KeyframableProperty): string {
	return PROP_COLORS[key] ?? "#94a3b8";
}

// ── Visibility toggles ────────────────────────────────────────────────────

const visibleProps = ref<Set<KeyframableProperty>>(
	new Set(props.applicableProperties.map((p) => p.key)),
);

function togglePropVisibility(key: KeyframableProperty) {
	const s = new Set(visibleProps.value);
	s.has(key) ? s.delete(key) : s.add(key);
	visibleProps.value = s;
}

// ── Coordinate helpers ────────────────────────────────────────────────────

function offsetToX(offset: number): number {
	return PADDING.left + offset * plotW;
}

function valueToY(value: number, min: number, max: number): number {
	const range = max - min || 1;
	const norm = Math.max(0, Math.min(1, (value - min) / range));
	return PADDING.top + (1 - norm) * plotH;
}

// ── SVG path generation ───────────────────────────────────────────────────

function buildPath(
	keyframes: Keyframe[],
	min: number,
	max: number,
): string {
	if (keyframes.length === 0) return "";
	if (keyframes.length === 1) {
		const kfItem = keyframes[0];
		const x = offsetToX(kfItem.offset);
		const y = valueToY(kfItem.value, min, max);
		return `M ${PADDING.left} ${y} L ${x} ${y} L ${PADDING.left + plotW} ${y}`;
	}

	const points: string[] = [];
	const sorted = [...keyframes].sort((a, b) => a.offset - b.offset);

	// Leading segment
	const first = sorted[0];
	points.push(`M ${PADDING.left} ${valueToY(first.value, min, max)}`);
	points.push(`L ${offsetToX(first.offset)} ${valueToY(first.value, min, max)}`);

	for (let i = 0; i < sorted.length - 1; i++) {
		const cur = sorted[i];
		const next = sorted[i + 1];
		const x0 = offsetToX(cur.offset);
		const y0 = valueToY(cur.value, min, max);
		const x1 = offsetToX(next.offset);
		const y1 = valueToY(next.value, min, max);

		const interp: KeyframeInterpolation = cur.interpolation ?? "linear";

		if (interp === "hold") {
			points.push(`L ${x1} ${y0}`);
			points.push(`L ${x1} ${y1}`);
		} else if (interp === "linear") {
			points.push(`L ${x1} ${y1}`);
		} else {
			// Ease approximated as a cubic bezier
			const tension = 0.35;
			const cpx = x0 + (x1 - x0) * tension;
			const cpy0 = interp.includes("ease-in") ? y0 + (y1 - y0) * 0.1 : y0;
			const cpx2 = x1 - (x1 - x0) * tension;
			const cpy1 = interp.includes("ease-out") ? y1 - (y1 - y0) * 0.1 : y1;
			points.push(`C ${cpx} ${cpy0}, ${cpx2} ${cpy1}, ${x1} ${y1}`);
		}
	}

	// Trailing segment
	const last = sorted[sorted.length - 1];
	points.push(`L ${PADDING.left + plotW} ${valueToY(last.value, min, max)}`);

	return points.join(" ");
}

// ── Graph data per property ───────────────────────────────────────────────

const graphItems = computed(() =>
	props.applicableProperties
		.filter((p) => visibleProps.value.has(p.key))
		.map((p) => {
			const kfs = elementRef.value.keyframes?.tracks?.[p.key]?.keyframes ?? [];
			const sorted = [...kfs].sort((a, b) => a.offset - b.offset);
			const path = buildPath(sorted, p.min, p.max);
			const handles = sorted.map((kfItem) => ({
				id: kfItem.id,
				x: offsetToX(kfItem.offset),
				y: valueToY(kfItem.value, p.min, p.max),
				offset: kfItem.offset,
				value: kfItem.value,
				prop: p,
				kf: kfItem,
			}));
			return { prop: p, path, handles };
		}),
);

// Unwrap the elementRef so template can access it
const elementRef = props.elementRef;

// ── Grid lines ────────────────────────────────────────────────────────────

const gridLines = computed(() => {
	const lines = [];
	// Vertical time lines at 0%, 25%, 50%, 75%, 100%
	for (let i = 0; i <= 4; i++) {
		const x = offsetToX(i / 4);
		lines.push({ x1: x, y1: PADDING.top, x2: x, y2: PADDING.top + plotH, label: `${i * 25}%`, labelX: x, labelY: GRAPH_H - 4 });
	}
	return lines;
});

// ── Drag handling ─────────────────────────────────────────────────────────

const svgRef = ref<SVGSVGElement | null>(null);
const draggingHandle = ref<{ prop: KeyframableProperty; kfId: string } | null>(null);

function onHandlePointerDown(
	event: PointerEvent,
	propKey: KeyframableProperty,
	kfId: string,
	propMin: number,
	propMax: number,
) {
	event.stopPropagation();
	draggingHandle.value = { prop: propKey, kfId };

	const svgEl = svgRef.value;
	if (!svgEl) return;
	const rect = svgEl.getBoundingClientRect();
	const scaleX = GRAPH_W / rect.width;
	const scaleY = GRAPH_H / rect.height;

	function onMove(e: PointerEvent) {
		if (!draggingHandle.value) return;
		const svgX = (e.clientX - rect.left) * scaleX;
		const svgY = (e.clientY - rect.top) * scaleY;

		const newOffset = Math.max(0, Math.min(1, (svgX - PADDING.left) / plotW));
		const norm = 1 - Math.max(0, Math.min(1, (svgY - PADDING.top) / plotH));
		const newValue = propMin + norm * (propMax - propMin);

		kf.updateKeyframe(draggingHandle.value.prop, draggingHandle.value.kfId, {
			offset: newOffset,
			value: newValue,
		});
	}

	function onUp() {
		draggingHandle.value = null;
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
	}

	window.addEventListener("pointermove", onMove);
	window.addEventListener("pointerup", onUp);
}

function onHandleDblClick(propKey: KeyframableProperty, kfId: string) {
	kf.removeKeyframe(propKey, kfId);
}
</script>

<template>
	<div class="flex flex-col gap-1.5 p-2">
		<!-- Property visibility toggles -->
		<div class="flex flex-wrap gap-1">
			<button
				v-for="p in applicableProperties"
				:key="p.key"
				class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium transition-opacity"
				:class="visibleProps.has(p.key) ? 'opacity-100' : 'opacity-30'"
				:style="{ borderColor: propColor(p.key), border: '1px solid' }"
				@click="togglePropVisibility(p.key)"
			>
				<span class="inline-block size-2 rounded-full" :style="{ background: propColor(p.key) }" />
				{{ p.label }}
			</button>
		</div>

		<!-- SVG Graph -->
		<div class="rounded border border-white/10 bg-black/30">
			<svg
				ref="svgRef"
				:viewBox="`0 0 ${GRAPH_W} ${GRAPH_H}`"
				:width="GRAPH_W"
				:height="GRAPH_H"
				class="block w-full"
				style="max-height: 140px"
			>
				<!-- Grid -->
				<g class="grid-lines">
					<line
						v-for="(gl, i) in gridLines"
						:key="i"
						:x1="gl.x1" :y1="gl.y1" :x2="gl.x2" :y2="gl.y2"
						stroke="rgba(255,255,255,0.06)"
						stroke-width="1"
					/>
					<!-- Horizontal mid line -->
					<line
						:x1="PADDING.left" :y1="PADDING.top + plotH / 2"
						:x2="PADDING.left + plotW" :y2="PADDING.top + plotH / 2"
						stroke="rgba(255,255,255,0.04)"
						stroke-width="1"
					/>
				</g>

				<!-- Time axis labels -->
				<text
					v-for="(gl, i) in gridLines"
					:key="`label-${i}`"
					:x="gl.labelX"
					:y="gl.labelY"
					text-anchor="middle"
					font-size="6"
					fill="rgba(255,255,255,0.25)"
				>{{ gl.label }}</text>

				<!-- Property curves and handles -->
				<g v-for="item in graphItems" :key="item.prop.key">
					<!-- Curve path -->
					<path
						v-if="item.path"
						:d="item.path"
						fill="none"
						:stroke="propColor(item.prop.key)"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						opacity="0.85"
					/>

					<!-- Keyframe handles -->
					<g
						v-for="h in item.handles"
						:key="h.id"
						:style="{ cursor: draggingHandle?.kfId === h.id ? 'grabbing' : 'grab', pointerEvents: 'all' }"
						@pointerdown="onHandlePointerDown($event, item.prop.key, h.id, item.prop.min, item.prop.max)"
						@dblclick="onHandleDblClick(item.prop.key, h.id)"
					>
						<!-- Outer glow -->
						<circle
							:cx="h.x" :cy="h.y" r="5"
							:fill="propColor(item.prop.key)"
							fill-opacity="0.2"
						/>
						<!-- Diamond shape -->
						<polygon
							:points="`${h.x},${h.y - 5} ${h.x + 4},${h.y} ${h.x},${h.y + 5} ${h.x - 4},${h.y}`"
							:fill="propColor(item.prop.key)"
							stroke="white"
							stroke-width="0.75"
							opacity="0.95"
						/>
					</g>
				</g>

				<!-- Empty state -->
				<text
					v-if="graphItems.length === 0 || graphItems.every((g) => g.handles.length === 0)"
					:x="GRAPH_W / 2"
					:y="GRAPH_H / 2 + 2"
					text-anchor="middle"
					font-size="8"
					fill="rgba(255,255,255,0.2)"
				>No keyframes — use + buttons above to add</text>
			</svg>
		</div>

		<p class="text-[8px] text-zinc-600">Drag handles to adjust · Double-click to remove · Volume curve uses linear gain (1 = 0 dB); match the inspector dB field.</p>
	</div>
</template>
