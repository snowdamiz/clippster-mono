<script setup lang="ts">
/**
 * Value-curve editor for keyframes (Curves mode).
 *
 * Curves are sampled from `evaluateKeyframeTrack` — the same function the
 * renderer uses — so easing shapes match playback. Keyframe diamonds are
 * draggable in time and value; double-click removes.
 */
import { computed, ref, toRef } from "vue";
import type { KeyframableProperty } from "../../types/keyframes";
import { evaluateKeyframeTrack, sortedKeyframes } from "../../types/keyframes";
import type { TimelineTrack, TimelineElement } from "../../types/timeline";
import type { KeyframePropertyDef } from "../../lib/keyframe-editor-properties";
import { getKeyframePropertyStaticDefault } from "../../lib/keyframe-property-defaults";
import { useKeyframes } from "../../composables/useKeyframes";

const props = defineProps<{
	track: TimelineTrack;
	element: TimelineElement;
	properties: KeyframePropertyDef[];
	playhead: number;
}>();

const kf = useKeyframes({
	trackRef: toRef(props, "track"),
	elementRef: toRef(props, "element"),
});

const GRAPH_W = 280;
const GRAPH_H = 140;
const PADDING = { top: 10, right: 10, bottom: 22, left: 30 };
const plotW = GRAPH_W - PADDING.left - PADDING.right;
const plotH = GRAPH_H - PADDING.top - PADDING.bottom;

const visibleProps = ref<Set<KeyframableProperty>>(
	new Set(props.properties.map((p) => p.key)),
);

function togglePropVisibility(key: KeyframableProperty) {
	const next = new Set(visibleProps.value);
	if (next.has(key)) next.delete(key);
	else next.add(key);
	visibleProps.value = next;
}

function storedMin(prop: KeyframePropertyDef): number {
	return prop.min / prop.displayMultiplier;
}

function storedMax(prop: KeyframePropertyDef): number {
	return prop.max / prop.displayMultiplier;
}

function offsetToX(offset: number): number {
	return PADDING.left + offset * plotW;
}

function valueToY(value: number, min: number, max: number): number {
	const range = max - min || 1;
	const norm = Math.max(0, Math.min(1, (value - min) / range));
	return PADDING.top + (1 - norm) * plotH;
}

function valueRange(prop: KeyframePropertyDef, keyframes: { value: number }[]): { min: number; max: number } {
	const track = props.element.keyframes?.tracks?.[prop.key];
	const defaultVal = getKeyframePropertyStaticDefault(props.element, prop.key);
	let min = storedMin(prop);
	let max = storedMax(prop);

	for (const k of keyframes) {
		min = Math.min(min, k.value);
		max = Math.max(max, k.value);
	}

	if (track && track.keyframes.length > 0) {
		for (let i = 0; i <= 48; i++) {
			const t = i / 48;
			const v = evaluateKeyframeTrack(track, t, defaultVal);
			min = Math.min(min, v);
			max = Math.max(max, v);
		}
	}

	const pad = (max - min) * 0.12 || 0.1;
	return { min: min - pad, max: max + pad };
}

function buildSampledPath(prop: KeyframePropertyDef): string {
	const track = props.element.keyframes?.tracks?.[prop.key];
	if (!track || track.keyframes.length === 0) return "";

	const defaultVal = getKeyframePropertyStaticDefault(props.element, prop.key);
	const { min, max } = valueRange(prop, track.keyframes);
	const parts: string[] = [];

	for (let i = 0; i <= 64; i++) {
		const t = i / 64;
		const v = evaluateKeyframeTrack(track, t, defaultVal);
		const x = offsetToX(t);
		const y = valueToY(v, min, max);
		parts.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
	}

	return parts.join(" ");
}

const graphItems = computed(() =>
	props.properties
		.filter((p) => visibleProps.value.has(p.key))
		.map((prop) => {
			const keyframes = sortedKeyframes(props.element.keyframes?.tracks?.[prop.key]?.keyframes ?? []);
			const { min, max } = valueRange(prop, keyframes);
			return {
				prop,
				path: buildSampledPath(prop),
				min,
				max,
				handles: keyframes.map((kfItem) => ({
					id: kfItem.id,
					x: offsetToX(kfItem.offset),
					y: valueToY(kfItem.value, min, max),
					propKey: prop.key,
				})),
			};
		}),
);

const playheadX = computed(() => offsetToX(props.playhead));

const gridLines = computed(() =>
	Array.from({ length: 5 }, (_, i) => {
		const t = i / 4;
		const x = offsetToX(t);
		return { x, label: `${Math.round(t * 100)}%` };
	}),
);

const svgRef = ref<SVGSVGElement | null>(null);
const draggingHandle = ref<{ prop: KeyframableProperty; kfId: string; min: number; max: number } | null>(null);

function onHandlePointerDown(
	event: PointerEvent,
	propKey: KeyframableProperty,
	kfId: string,
	min: number,
	max: number,
) {
	event.stopPropagation();
	draggingHandle.value = { prop: propKey, kfId, min, max };

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
		const { min: vMin, max: vMax } = draggingHandle.value;
		const newValue = vMin + norm * (vMax - vMin);
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
	<div class="min-w-0 space-y-2">
		<div class="flex flex-wrap gap-1">
			<button
				v-for="p in properties"
				:key="p.key"
				type="button"
				class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium transition-opacity"
				:class="visibleProps.has(p.key) ? 'opacity-100' : 'opacity-30'"
				:style="{ border: `1px solid ${p.color}` }"
				@click="togglePropVisibility(p.key)"
			>
				<span class="inline-block size-2 rounded-full" :style="{ background: p.color }" />
				{{ p.label }}
			</button>
		</div>

		<div class="min-w-0 overflow-hidden rounded-sm border border-white/10 bg-black/30">
			<svg
				ref="svgRef"
				:viewBox="`0 0 ${GRAPH_W} ${GRAPH_H}`"
				class="block w-full"
				style="max-height: 160px"
			>
				<g>
					<line
						v-for="(gl, i) in gridLines"
						:key="i"
						:x1="gl.x"
						:y1="PADDING.top"
						:x2="gl.x"
						:y2="PADDING.top + plotH"
						stroke="rgba(255,255,255,0.06)"
						stroke-width="1"
					/>
					<line
						:x1="PADDING.left"
						:y1="PADDING.top + plotH / 2"
						:x2="PADDING.left + plotW"
						:y2="PADDING.top + plotH / 2"
						stroke="rgba(255,255,255,0.04)"
						stroke-width="1"
					/>
				</g>

				<text
					v-for="(gl, i) in gridLines"
					:key="`label-${i}`"
					:x="gl.x"
					:y="GRAPH_H - 6"
					text-anchor="middle"
					font-size="7"
					fill="rgba(255,255,255,0.25)"
				>{{ gl.label }}</text>

				<line
					:x1="playheadX"
					:y1="PADDING.top"
					:x2="playheadX"
					:y2="PADDING.top + plotH"
					stroke="#f59e0b"
					stroke-width="1"
					stroke-dasharray="3 2"
					opacity="0.9"
				/>

				<g v-for="item in graphItems" :key="item.prop.key">
					<path
						v-if="item.path"
						:d="item.path"
						fill="none"
						:stroke="item.prop.color"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						opacity="0.9"
					/>

					<g
						v-for="h in item.handles"
						:key="h.id"
						:style="{ cursor: draggingHandle?.kfId === h.id ? 'grabbing' : 'grab' }"
						@pointerdown="onHandlePointerDown($event, item.prop.key, h.id, item.min, item.max)"
						@dblclick="onHandleDblClick(item.prop.key, h.id)"
					>
						<circle :cx="h.x" :cy="h.y" r="6" :fill="item.prop.color" fill-opacity="0.15" />
						<polygon
							:points="`${h.x},${h.y - 5} ${h.x + 4},${h.y} ${h.x},${h.y + 5} ${h.x - 4},${h.y}`"
							:fill="item.prop.color"
							stroke="white"
							stroke-width="0.75"
						/>
					</g>
				</g>

				<text
					v-if="graphItems.length === 0 || graphItems.every((g) => g.handles.length === 0)"
					:x="GRAPH_W / 2"
					:y="GRAPH_H / 2"
					text-anchor="middle"
					font-size="9"
					fill="rgba(255,255,255,0.25)"
				>No keyframes yet — enable a property and add keyframes</text>
			</svg>
		</div>

		<p class="text-[9px] leading-relaxed text-zinc-600">
			Drag diamonds to adjust time and value. Double-click to remove. Curves use the same easing as playback.
		</p>
	</div>
</template>
