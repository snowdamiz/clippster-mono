<script setup lang="ts">
import { ref, watch, computed, toRef, onMounted, onUnmounted } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import type { ImageElement, ColorAdjustments, ColorCurves, ColorWheels } from "../../../types/timeline";
import { DEFAULT_COLOR_ADJUSTMENTS } from "../../../types/timeline";
import type { VideoEffect } from "../../../types/effects";
import { getEffectPreset } from "../../../constants/effect-constants";
import type { ChromakeySettings } from "../../../types/chromakey";
import { DEFAULT_CHROMAKEY } from "../../../types/chromakey";
import { Image, Trash2, RotateCcw, FlipHorizontal, FlipVertical, Wand2, Eye, EyeOff, X, ChevronDown, Pipette, SlidersHorizontal, Sparkles, Scissors } from "lucide-vue-next";
import { useKeyframes } from "../../../composables/useKeyframes";
import KeyframeToggle from "./KeyframeToggle.vue";
import AnimationProperties from "./AnimationProperties.vue";
import MasksPanel from "./MasksPanel.vue";
import ColorCurvesPanel from "./ColorCurvesPanel.vue";
import ColorWheelsPanel from "./ColorWheelsPanel.vue";
import LutPanel from "./LutPanel.vue";

const props = defineProps<{
	element: ImageElement;
	trackId: string;
}>();

const { editor } = useEditor();
const { selectedElements } = useElementSelection();

function isRangeInputTarget(target: EventTarget | null): boolean {
	return target instanceof HTMLInputElement && target.type === "range";
}

function handleRangePointerDown(event: PointerEvent) {
	if (isRangeInputTarget(event.target)) {
		editor.setInteractiveDrag(true);
	}
}

function stopRangeInteraction() {
	editor.setInteractiveDrag(false);
}

onMounted(() => {
	window.addEventListener("pointerup", stopRangeInteraction);
	window.addEventListener("pointercancel", stopRangeInteraction);
});

onUnmounted(() => {
	window.removeEventListener("pointerup", stopRangeInteraction);
	window.removeEventListener("pointercancel", stopRangeInteraction);
	stopRangeInteraction();
});

const trackRef = computed(() => editor.timeline.getTrackById({ trackId: props.trackId })!);
const { hasKeyframes: hasKf, addKeyframe, clearPropertyKeyframes } = useKeyframes({
	trackRef,
	elementRef: toRef(props, 'element'),
});

const opacityInput = ref(Math.round(props.element.opacity * 100).toString());
const scaleInput = ref(Math.round(props.element.transform.scale * 100).toString());
const posXInput = ref(props.element.transform.position.x.toString());
const posYInput = ref(props.element.transform.position.y.toString());
const rotateInput = ref(props.element.transform.rotate.toString());

watch(() => props.element.opacity, (v) => { opacityInput.value = Math.round(v * 100).toString(); });
watch(() => props.element.transform.scale, (v) => { scaleInput.value = Math.round(v * 100).toString(); });
watch(() => props.element.transform.position.x, (v) => { posXInput.value = v.toString(); });
watch(() => props.element.transform.position.y, (v) => { posYInput.value = v.toString(); });
watch(() => props.element.transform.rotate, (v) => { rotateInput.value = v.toString(); });

const ca = computed(() => ({ ...DEFAULT_COLOR_ADJUSTMENTS, ...props.element.colorAdjustments }));

type TopTab = "image" | "adjust" | "grading" | "animate" | "masks";
const activeTab = ref<TopTab>("image");

const topTabs: { id: TopTab; label: string; icon: any }[] = [
	{ id: "image", label: "Image", icon: Image },
	{ id: "adjust", label: "Adjust", icon: SlidersHorizontal },
	{ id: "grading", label: "Grade", icon: Wand2 },
	{ id: "animate", label: "Animate", icon: Sparkles },
	{ id: "masks", label: "Masks", icon: Scissors },
];

/** Show file name only when `name` was stored as a full path (Windows or POSIX). */
const displayFileName = computed(() => {
	const raw = props.element.name?.trim() ?? "";
	if (!raw) return "";
	const normalized = raw.replace(/\\/g, "/");
	const segments = normalized.split("/").filter(Boolean);
	return segments.length ? segments[segments.length - 1]! : raw;
});

function update(updates: Record<string, unknown>) {
	editor.timeline.updateElement({
		trackId: props.trackId,
		elementId: props.element.id,
		updates,
	});
}

// --- Chromakey ---
const chromakey = computed(() => props.element.chromakey ?? DEFAULT_CHROMAKEY);
const showChromakey = ref(chromakey.value.enabled);

function updateChromakey(partial: Partial<ChromakeySettings>) {
	update({ chromakey: { ...chromakey.value, ...partial } });
}

function updateTransform(partial: Record<string, unknown>) {
	update({
		transform: {
			...props.element.transform,
			...partial,
			position: {
				...props.element.transform.position,
				...(partial.position as Record<string, unknown> ?? {}),
			},
		},
	});
}

function updateColor(partial: Partial<ColorAdjustments>) {
	update({ colorAdjustments: { ...ca.value, ...partial } });
}

function updateColorCurves(curves: ColorCurves) {
	update({ colorCurves: Object.keys(curves).length > 0 ? curves : undefined });
}

function updateColorWheels(wheels: ColorWheels) {
	update({ colorWheels: Object.keys(wheels).length > 0 ? wheels : undefined });
}

function updateLutPath(lutPath: string | undefined) {
	update({ lutPath: lutPath || undefined });
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function toggleOpacityKeyframe() {
	if (hasKf('opacity')) {
		clearPropertyKeyframes('opacity');
	} else {
		const currentTime = editor.playback.getCurrentTime();
		const elapsed = currentTime - props.element.startTime;
		const offset = props.element.duration > 0 ? elapsed / props.element.duration : 0;
		addKeyframe('opacity', clamp(offset, 0, 1), props.element.opacity);
	}
}

function handleFadeInSlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value) / 10;
	update({ fadeIn: val > 0.01 ? val : undefined });
}
function handleFadeOutSlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value) / 10;
	update({ fadeOut: val > 0.01 ? val : undefined });
}

function handleOpacitySlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value);
	opacityInput.value = val.toString();
	update({ opacity: val / 100 });
}
function handleOpacityInput(value: string) {
	opacityInput.value = value;
	const parsed = parseInt(value, 10);
	if (!Number.isNaN(parsed)) update({ opacity: clamp(parsed, 0, 100) / 100 });
}
function handleOpacityBlur() {
	const parsed = parseInt(opacityInput.value, 10);
	const pct = Number.isNaN(parsed) ? Math.round(props.element.opacity * 100) : clamp(parsed, 0, 100);
	opacityInput.value = pct.toString();
	update({ opacity: pct / 100 });
}

function handleScaleSlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value);
	scaleInput.value = val.toString();
	updateTransform({ scale: val / 100 });
}
function handleScaleInput(value: string) {
	scaleInput.value = value;
	const parsed = parseInt(value, 10);
	if (!Number.isNaN(parsed)) updateTransform({ scale: clamp(parsed, 10, 500) / 100 });
}
function handleScaleBlur() {
	const parsed = parseInt(scaleInput.value, 10);
	const pct = Number.isNaN(parsed) ? Math.round(props.element.transform.scale * 100) : clamp(parsed, 10, 500);
	scaleInput.value = pct.toString();
	updateTransform({ scale: pct / 100 });
}

function handlePosX(value: string) {
	posXInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) updateTransform({ position: { x: parsed, y: props.element.transform.position.y } });
}
function handlePosY(value: string) {
	posYInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) updateTransform({ position: { x: props.element.transform.position.x, y: parsed } });
}

function handleRotateSlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value);
	rotateInput.value = val.toString();
	updateTransform({ rotate: val });
}
function handleRotateInput(value: string) {
	rotateInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) updateTransform({ rotate: clamp(parsed, -360, 360) });
}

function resetTransform() {
	update({ transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 } });
}
function resetColor() {
	update({ colorAdjustments: { ...DEFAULT_COLOR_ADJUSTMENTS } });
}

// --- Effects ---
const effects = computed(() => props.element.effects ?? []);
const showEffects = ref(effects.value.length > 0);

watch(() => props.element.effects, (v) => {
	if (v && v.length > 0) showEffects.value = true;
});

function toggleEffect(effectId: string) {
	const updated = effects.value.map((e) =>
		e.id === effectId ? { ...e, enabled: !e.enabled } : e,
	);
	update({ effects: updated });
}

function removeEffect(effectId: string) {
	const updated = effects.value.filter((e) => e.id !== effectId);
	update({ effects: updated });
}

function updateEffectParam(effectId: string, key: string, value: number | string) {
	const updated = effects.value.map((e) =>
		e.id === effectId ? { ...e, [key]: value } : e,
	);
	update({ effects: updated });
}

function getEffectLabel(type: string): string {
	return getEffectPreset(type)?.label ?? type;
}

function handleDelete() {
	editor.timeline.deleteElements({
		elements: selectedElements.value.length > 0
			? selectedElements.value
			: [{ trackId: props.trackId, elementId: props.element.id }],
	});
}

function formatTime(seconds: number): string {
	const min = Math.floor(seconds / 60);
	const sec = (seconds % 60).toFixed(2);
	return `${min}:${sec.padStart(5, "0")}`;
}
</script>

<template>
	<div class="flex h-full min-h-0 flex-row" @pointerdown.capture="handleRangePointerDown">
		<div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
			<div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
				<template v-if="activeTab === 'image'">
					<div class="space-y-5 p-4">
						<!-- Header -->
						<div class="flex items-center gap-2">
							<Image class="size-4 text-zinc-500" />
							<h3 class="text-sm font-medium">Image</h3>
						</div>

						<!-- Info -->
						<div class="space-y-3">
							<div class="space-y-1">
								<label class="text-xs text-zinc-500">Name</label>
								<p class="text-sm break-all" :title="element.name">{{ displayFileName || "—" }}</p>
							</div>
			<div class="flex gap-4">
				<div class="space-y-1">
					<label class="text-xs text-zinc-500">Start</label>
					<p class="text-sm">{{ formatTime(element.startTime) }}</p>
				</div>
				<div class="space-y-1">
					<label class="text-xs text-zinc-500">Duration</label>
					<p class="text-sm">{{ formatTime(element.duration) }}</p>
				</div>
			</div>
		</div>

		<!-- Opacity -->
		<div class="space-y-1.5">
			<div class="flex items-center justify-between">
				<label class="text-xs text-zinc-500">Opacity</label>
				<KeyframeToggle :active="hasKf('opacity')" label="opacity" @toggle="toggleOpacityKeyframe" />
			</div>
			<div class="flex items-center gap-2">
				<input type="range" :value="element.opacity * 100" min="0" max="100" step="1" class="flex-1" @input="handleOpacitySlider" />
				<input type="number" :value="opacityInput" min="0" max="100" class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200" @input="(e) => handleOpacityInput((e.target as HTMLInputElement).value)" @blur="handleOpacityBlur" />
			</div>
		</div>

		<!-- Blend Mode -->
		<div class="space-y-1.5">
			<label class="text-xs text-zinc-500">Blend Mode</label>
			<select
				:value="element.blendMode ?? 'normal'"
				class="w-full rounded-sm border border-white/10 bg-[#1a1a1e] px-2 py-1.5 text-xs text-zinc-200 outline-none"
				@change="(e) => update({ blendMode: (e.target as HTMLSelectElement).value === 'normal' ? undefined : (e.target as HTMLSelectElement).value })"
			>
				<option value="normal">Normal</option>
				<option value="multiply">Multiply</option>
				<option value="screen">Screen</option>
				<option value="overlay">Overlay</option>
				<option value="soft-light">Soft Light</option>
				<option value="hard-light">Hard Light</option>
				<option value="darken">Darken</option>
				<option value="lighten">Lighten</option>
				<option value="color-dodge">Color Dodge</option>
				<option value="color-burn">Color Burn</option>
				<option value="difference">Difference</option>
				<option value="exclusion">Exclusion</option>
			</select>
		</div>

		<!-- Fade In / Out -->
		<div class="space-y-1.5">
			<label class="text-xs text-zinc-500">Fade</label>
			<div class="flex items-center gap-3">
				<div class="flex flex-1 flex-col gap-1">
					<span class="text-[9px] text-zinc-600">In</span>
					<input type="range" :value="(element.fadeIn ?? 0) * 10" min="0" max="30" step="1" class="w-full" @input="handleFadeInSlider" />
					<span class="text-[9px] text-zinc-500">{{ ((element.fadeIn ?? 0)).toFixed(1) }}s</span>
				</div>
				<div class="flex flex-1 flex-col gap-1">
					<span class="text-[9px] text-zinc-600">Out</span>
					<input type="range" :value="(element.fadeOut ?? 0) * 10" min="0" max="30" step="1" class="w-full" @input="handleFadeOutSlider" />
					<span class="text-[9px] text-zinc-500">{{ ((element.fadeOut ?? 0)).toFixed(1) }}s</span>
				</div>
			</div>
		</div>

		<!-- Transform section -->
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<label class="text-xs font-medium text-zinc-300">Transform</label>
				<button class="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300" title="Reset transform" @click="resetTransform">
					<RotateCcw class="size-3" />
					Reset
				</button>
			</div>

			<!-- Scale -->
			<div class="space-y-1.5">
				<label class="text-xs text-zinc-500">Scale</label>
				<div class="flex items-center gap-2">
					<input type="range" :value="element.transform.scale * 100" min="10" max="500" step="1" class="flex-1" @input="handleScaleSlider" />
					<input type="number" :value="scaleInput" min="10" max="500" class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200" @input="(e) => handleScaleInput((e.target as HTMLInputElement).value)" @blur="handleScaleBlur" />
				</div>
			</div>

			<!-- Position -->
			<div class="grid grid-cols-2 gap-2">
				<div class="space-y-1">
					<label class="text-xs text-zinc-500">Position X</label>
					<input type="number" :value="posXInput" step="1" class="h-7 w-full rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200" @input="(e) => handlePosX((e.target as HTMLInputElement).value)" />
				</div>
				<div class="space-y-1">
					<label class="text-xs text-zinc-500">Position Y</label>
					<input type="number" :value="posYInput" step="1" class="h-7 w-full rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200" @input="(e) => handlePosY((e.target as HTMLInputElement).value)" />
				</div>
			</div>

			<!-- Rotation -->
			<div class="space-y-1.5">
				<label class="text-xs text-zinc-500">Rotation</label>
				<div class="flex items-center gap-2">
					<input type="range" :value="element.transform.rotate" min="-360" max="360" step="1" class="flex-1" @input="handleRotateSlider" />
					<input type="number" :value="rotateInput" min="-360" max="360" class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200" @input="(e) => handleRotateInput((e.target as HTMLInputElement).value)" />
				</div>
			</div>

			<!-- Flip -->
			<div class="space-y-1.5">
				<label class="text-xs text-zinc-500">Flip</label>
				<div class="flex gap-2">
					<button
						:class="[
							'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors',
							element.flip?.horizontal
								? 'bg-primary/20 text-primary border border-primary/30'
								: 'border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10',
						]"
						@click="update({ flip: { horizontal: !(element.flip?.horizontal ?? false), vertical: element.flip?.vertical ?? false } })"
					>
						<FlipHorizontal class="size-3.5" />
						H
					</button>
					<button
						:class="[
							'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors',
							element.flip?.vertical
								? 'bg-primary/20 text-primary border border-primary/30'
								: 'border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10',
						]"
						@click="update({ flip: { horizontal: element.flip?.horizontal ?? false, vertical: !(element.flip?.vertical ?? false) } })"
					>
						<FlipVertical class="size-3.5" />
						V
					</button>
				</div>
			</div>
		</div>

		<!-- Chromakey (Green Screen) -->
		<div class="space-y-3">
			<button class="flex w-full items-center justify-between" @click="showChromakey = !showChromakey">
				<div class="flex items-center gap-1.5">
					<Pipette class="size-3.5 text-zinc-500" />
					<label class="text-xs font-medium text-zinc-300">Chroma Key</label>
					<span v-if="chromakey.enabled" class="rounded-full bg-green-500/20 px-1.5 text-[10px] font-medium text-green-400">On</span>
				</div>
				<ChevronDown class="size-3.5 text-zinc-500 transition-transform" :class="{ 'rotate-180': !showChromakey }" />
			</button>

			<div v-if="showChromakey" class="space-y-2">
				<div class="flex items-center justify-between">
					<span class="text-xs text-zinc-500">Enabled</span>
					<button
						:class="['relative h-5 w-9 rounded-full transition-colors', chromakey.enabled ? 'bg-green-500' : 'bg-zinc-700']"
						@click="updateChromakey({ enabled: !chromakey.enabled })"
					>
						<span :class="['absolute top-0.5 size-4 rounded-full bg-white transition-transform', chromakey.enabled ? 'left-[18px]' : 'left-0.5']" />
					</button>
				</div>

				<template v-if="chromakey.enabled">
					<div class="flex items-center gap-2">
						<span class="w-14 shrink-0 text-[10px] text-zinc-500">Color</span>
						<div class="relative">
							<input type="color" :value="chromakey.color" class="absolute inset-0 h-6 w-6 cursor-pointer opacity-0"
								@input="(e) => updateChromakey({ color: (e.target as HTMLInputElement).value })" />
							<div class="size-6 rounded border border-white/10" :style="{ backgroundColor: chromakey.color }" />
						</div>
						<span class="text-[10px] text-zinc-400">{{ chromakey.color }}</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="w-14 shrink-0 text-[10px] text-zinc-500">Similar</span>
						<input type="range" :value="chromakey.similarity" min="0" max="100" step="1" class="flex-1"
							@input="(e) => updateChromakey({ similarity: Number((e.target as HTMLInputElement).value) })" />
						<input type="number" :value="chromakey.similarity" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none" @input="(e) => updateChromakey({ similarity: Number((e.target as HTMLInputElement).value) })" />
					</div>
					<div class="flex items-center gap-2">
						<span class="w-14 shrink-0 text-[10px] text-zinc-500">Smooth</span>
						<input type="range" :value="chromakey.smoothness" min="0" max="100" step="1" class="flex-1"
							@input="(e) => updateChromakey({ smoothness: Number((e.target as HTMLInputElement).value) })" />
						<input type="number" :value="chromakey.smoothness" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none" @input="(e) => updateChromakey({ smoothness: Number((e.target as HTMLInputElement).value) })" />
					</div>
					<div class="flex items-center gap-2">
						<span class="w-14 shrink-0 text-[10px] text-zinc-500">Spill</span>
						<input type="range" :value="chromakey.spillReduction" min="0" max="100" step="1" class="flex-1"
							@input="(e) => updateChromakey({ spillReduction: Number((e.target as HTMLInputElement).value) })" />
						<input type="number" :value="chromakey.spillReduction" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none" @input="(e) => updateChromakey({ spillReduction: Number((e.target as HTMLInputElement).value) })" />
					</div>
				</template>
			</div>
		</div>

		<!-- Effects -->
		<div class="space-y-3">
			<button class="flex w-full items-center justify-between" @click="showEffects = !showEffects">
				<div class="flex items-center gap-1.5">
					<Wand2 class="size-3.5 text-zinc-500" />
					<label class="text-xs font-medium text-zinc-300">Effects</label>
					<span v-if="effects.length > 0" class="rounded-full bg-blue-500/20 px-1.5 text-[10px] font-medium text-blue-400">{{ effects.length }}</span>
				</div>
				<ChevronDown class="size-3.5 text-zinc-500 transition-transform" :class="{ 'rotate-180': !showEffects }" />
			</button>

			<div v-if="showEffects" class="space-y-2">
				<div v-if="effects.length === 0" class="rounded-md border border-dashed border-white/10 px-3 py-4 text-center">
					<p class="text-[11px] text-zinc-600">No effects applied</p>
					<p class="mt-0.5 text-[10px] text-zinc-700">Add effects from the Effects panel</p>
				</div>

				<div v-for="effect in effects" :key="effect.id" class="rounded-md border border-white/5 bg-white/[0.02]">
					<div class="flex items-center justify-between px-2.5 py-1.5">
						<span class="text-xs font-medium" :class="effect.enabled ? 'text-zinc-300' : 'text-zinc-600'">{{ getEffectLabel(effect.type) }}</span>
						<div class="flex items-center gap-1">
							<button class="flex size-5 items-center justify-center rounded text-zinc-500 hover:bg-white/5 hover:text-zinc-300" @click="toggleEffect(effect.id)">
								<component :is="effect.enabled ? Eye : EyeOff" class="size-3" />
							</button>
							<button class="flex size-5 items-center justify-center rounded text-zinc-500 hover:bg-red-500/10 hover:text-red-400" @click="removeEffect(effect.id)">
								<X class="size-3" />
							</button>
						</div>
					</div>

					<div v-if="effect.enabled" class="space-y-1.5 border-t border-white/5 px-2.5 py-2">
						<div class="flex items-center gap-2">
							<span class="w-14 shrink-0 text-[10px] text-zinc-500">Intensity</span>
							<input type="range" :value="effect.intensity" min="0" max="100" step="1" class="flex-1"
								@input="(e) => updateEffectParam(effect.id, 'intensity', Number((e.target as HTMLInputElement).value))" />
							<input type="number" :value="effect.intensity" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
								@input="(e) => updateEffectParam(effect.id, 'intensity', Number((e.target as HTMLInputElement).value))" />
						</div>

						<template v-if="effect.type === 'blur'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Radius</span>
								<input type="range" :value="(effect as any).radius" min="1" max="50" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'radius', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).radius" min="1" max="50" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'radius', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<template v-if="effect.type === 'pixelate'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Block</span>
								<input type="range" :value="(effect as any).blockSize" min="2" max="64" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'blockSize', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).blockSize" min="2" max="64" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'blockSize', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<template v-if="effect.type === 'sharpen'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Amount</span>
								<input type="range" :value="(effect as any).amount" min="0" max="10" step="0.5" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).amount" min="0" max="10" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<template v-if="effect.type === 'vignette'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Radius</span>
								<input type="range" :value="(effect as any).radius" min="0" max="100" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'radius', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).radius" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'radius', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Softness</span>
								<input type="range" :value="(effect as any).softness" min="0" max="100" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'softness', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).softness" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'softness', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<template v-if="effect.type === 'colorShift'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-red-400">Red X</span>
								<input type="range" :value="(effect as any).redOffsetX" min="-20" max="20" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'redOffsetX', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).redOffsetX" min="-20" max="20" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'redOffsetX', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-blue-400">Blue X</span>
								<input type="range" :value="(effect as any).blueOffsetX" min="-20" max="20" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'blueOffsetX', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).blueOffsetX" min="-20" max="20" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'blueOffsetX', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<template v-if="effect.type === 'glitch'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Slices</span>
								<input type="range" :value="(effect as any).sliceCount" min="2" max="20" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'sliceCount', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).sliceCount" min="2" max="20" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'sliceCount', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Offset</span>
								<input type="range" :value="(effect as any).maxOffset" min="0" max="50" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'maxOffset', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).maxOffset" min="0" max="50" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'maxOffset', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Bleed</span>
								<input type="range" :value="(effect as any).colorBleed" min="0" max="100" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'colorBleed', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).colorBleed" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'colorBleed', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<template v-if="effect.type === 'wave'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Amp</span>
								<input type="range" :value="(effect as any).amplitude" min="1" max="50" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'amplitude', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).amplitude" min="1" max="50" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'amplitude', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Freq</span>
								<input type="range" :value="(effect as any).frequency" min="0.5" max="10" step="0.5" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'frequency', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).frequency" min="0.5" max="10" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'frequency', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Speed</span>
								<input type="range" :value="(effect as any).speed" min="0" max="10" step="0.5" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).speed" min="0" max="10" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<template v-if="effect.type === 'zoomPulse'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Amount</span>
								<input type="range" :value="(effect as any).amount" min="1" max="50" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).amount" min="1" max="50" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Speed</span>
								<input type="range" :value="(effect as any).speed" min="0.5" max="5" step="0.5" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).speed" min="0.5" max="5" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<template v-if="effect.type === 'flash'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Color</span>
								<div class="relative">
									<input type="color" :value="(effect as any).color" class="absolute inset-0 h-5 w-5 cursor-pointer opacity-0"
										@input="(e) => updateEffectParam(effect.id, 'color', (e.target as HTMLInputElement).value)" />
									<div class="size-5 rounded border border-white/10" :style="{ backgroundColor: (effect as any).color }" />
								</div>
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Speed</span>
								<input type="range" :value="(effect as any).speed" min="0.5" max="5" step="0.5" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).speed" min="0.5" max="5" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Noise: amount -->
						<template v-if="effect.type === 'noise'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Amount</span>
								<input type="range" :value="(effect as any).amount" min="0" max="100" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).amount" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- VHS: scanlineOpacity, colorBleed, noiseAmount -->
						<template v-if="effect.type === 'vhs'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Scanline</span>
								<input type="range" :value="(effect as any).scanlineOpacity" min="0" max="100" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'scanlineOpacity', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).scanlineOpacity" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'scanlineOpacity', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Bleed</span>
								<input type="range" :value="(effect as any).colorBleed" min="0" max="50" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'colorBleed', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).colorBleed" min="0" max="50" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'colorBleed', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Noise</span>
								<input type="range" :value="(effect as any).noiseAmount" min="0" max="100" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'noiseAmount', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).noiseAmount" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'noiseAmount', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Motion Blur: angle, distance -->
						<template v-if="effect.type === 'motionBlur'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Angle</span>
								<input type="range" :value="(effect as any).angle" min="0" max="360" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'angle', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).angle" min="0" max="360" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'angle', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Dist</span>
								<input type="range" :value="(effect as any).distance" min="1" max="30" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'distance', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).distance" min="1" max="30" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'distance', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Radial Blur: amount -->
						<template v-if="effect.type === 'radialBlur'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Amount</span>
								<input type="range" :value="(effect as any).amount" min="1" max="20" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).amount" min="1" max="20" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Hue Shift: speed -->
						<template v-if="effect.type === 'hueShift'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Speed</span>
								<input type="range" :value="(effect as any).speed" min="0.1" max="5" step="0.1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).speed" min="0.1" max="5" step="0.1" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'speed', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Halftone: dotSize -->
						<template v-if="effect.type === 'colorHalftone'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Dot Size</span>
								<input type="range" :value="(effect as any).dotSize" min="2" max="20" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'dotSize', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).dotSize" min="2" max="20" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'dotSize', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Lens Distortion: amount -->
						<template v-if="effect.type === 'lensDistortion'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Amount</span>
								<input type="range" :value="(effect as any).amount" min="-100" max="100" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).amount" min="-100" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'amount', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Posterize: levels -->
						<template v-if="effect.type === 'posterize'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Levels</span>
								<input type="range" :value="(effect as any).levels" min="2" max="16" step="1" class="flex-1"
									@input="(e) => updateEffectParam(effect.id, 'levels', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).levels" min="2" max="16" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateEffectParam(effect.id, 'levels', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>
					</div>
				</div>
			</div>
		</div>

						<!-- Delete -->
						<div class="mt-2 border-t border-white/10 pt-4">
							<button
								class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
								@click="handleDelete"
							>
								<Trash2 class="size-3.5" />
								Delete Image
							</button>
						</div>
					</div>
				</template>

				<!-- Adjust -->
				<div v-else-if="activeTab === 'adjust'" class="p-3">
					<div class="-mx-3 -mt-3 mb-4 flex items-center border-b border-white/10 px-3 py-1.5">
						<span class="text-sm text-zinc-400">Adjust</span>
					</div>
					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<span class="text-xs font-medium text-zinc-300">Color</span>
							<button class="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300" @click="resetColor">
								<RotateCcw class="size-3" />
								<span>Reset</span>
							</button>
						</div>

						<div class="space-y-2">
							<div v-for="prop in (['brightness', 'contrast', 'saturation', 'temperature', 'highlights', 'shadows', 'exposure'] as const)" :key="prop" class="space-y-1.5">
								<label class="text-[11px] capitalize text-zinc-500">{{ prop }}</label>
								<div class="flex items-center gap-2">
									<input type="range" :value="ca[prop]" min="-100" max="100" step="1" class="flex-1" @input="(e) => updateColor({ [prop]: Number((e.target as HTMLInputElement).value) })" />
									<div class="flex h-7 w-12 items-center rounded-sm border border-white/10 bg-white/5 px-1">
										<input type="number" :value="ca[prop]" min="-100" max="100" class="w-full bg-transparent text-center text-xs text-zinc-200 outline-none" @input="(e) => updateColor({ [prop]: Number((e.target as HTMLInputElement).value) })" />
									</div>
								</div>
							</div>
						</div>

						<div class="space-y-2 border-t border-white/[0.05] pt-4">
							<div class="space-y-1.5">
								<label class="text-[11px] text-zinc-500">Fade</label>
								<div class="flex items-center gap-2">
									<input type="range" :value="ca.fade" min="0" max="100" step="1" class="flex-1" @input="(e) => updateColor({ fade: Number((e.target as HTMLInputElement).value) })" />
									<div class="flex h-7 w-12 items-center rounded-sm border border-white/10 bg-white/5 px-1">
										<input type="number" :value="ca.fade" min="0" max="100" class="w-full bg-transparent text-center text-xs text-zinc-200 outline-none" @input="(e) => updateColor({ fade: Number((e.target as HTMLInputElement).value) })" />
									</div>
								</div>
							</div>

							<div class="space-y-1.5">
								<label class="text-[11px] text-zinc-500">Sharpness</label>
								<div class="flex items-center gap-2">
									<input type="range" :value="ca.sharpness" min="0" max="100" step="1" class="flex-1" @input="(e) => updateColor({ sharpness: Number((e.target as HTMLInputElement).value) })" />
									<div class="flex h-7 w-12 items-center rounded-sm border border-white/10 bg-white/5 px-1">
										<input type="number" :value="ca.sharpness" min="0" max="100" class="w-full bg-transparent text-center text-xs text-zinc-200 outline-none" @input="(e) => updateColor({ sharpness: Number((e.target as HTMLInputElement).value) })" />
									</div>
								</div>
							</div>
						</div>

						<div class="space-y-1.5 border-t border-white/[0.05] pt-4">
							<label class="text-[11px] text-zinc-500">Tint</label>
							<div class="flex items-center gap-2">
								<div class="relative">
									<input type="color" :value="ca.tint || '#000000'" class="absolute inset-0 h-7 w-7 cursor-pointer opacity-0"
										@input="(e) => updateColor({ tint: (e.target as HTMLInputElement).value })" />
									<div class="flex h-7 w-7 items-center justify-center rounded-sm border border-white/10" :style="{ backgroundColor: ca.tint || 'transparent' }" />
								</div>
								<span class="text-[11px] text-zinc-400">{{ ca.tint || 'None' }}</span>
								<button v-if="ca.tint" class="ml-auto flex h-7 items-center rounded-sm border border-white/10 bg-white/5 px-2 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-200" @click="updateColor({ tint: '' })">Clear</button>
							</div>
						</div>
					</div>
				</div>

				<!-- Grade -->
				<div v-else-if="activeTab === 'grading'" class="space-y-5 p-3">
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<span class="text-xs font-medium text-zinc-300">RGB Curves</span>
						</div>
						<ColorCurvesPanel
							:curves="element.colorCurves ?? {}"
							@update="updateColorCurves"
						/>
					</div>

					<div class="space-y-2 border-t border-white/[0.05] pt-4">
						<span class="text-xs font-medium text-zinc-300">Color Wheels</span>
						<ColorWheelsPanel
							:wheels="element.colorWheels ?? {}"
							@update="updateColorWheels"
						/>
					</div>

					<div class="border-t border-white/[0.05] pt-4">
						<LutPanel
							:lut-path="element.lutPath"
							@update="updateLutPath"
						/>
					</div>
				</div>

				<!-- Animate -->
				<div v-else-if="activeTab === 'animate'" class="flex flex-col">
					<div class="flex shrink-0 items-center border-b border-white/10 px-3 py-1.5">
						<span class="text-sm text-zinc-400">Animate</span>
					</div>
					<div class="p-3">
						<AnimationProperties
							:element-id="element.id"
							:track-id="trackId"
							:animation-in="element.animationIn"
							:animation-out="element.animationOut"
							:animation-loop="element.animationLoop"
							:element-duration="element.duration"
						/>
					</div>
				</div>

				<!-- Masks -->
				<div v-else-if="activeTab === 'masks'">
					<div class="flex shrink-0 items-center border-b border-white/10 px-3 py-1.5">
						<span class="text-sm text-zinc-400">Masks</span>
					</div>
					<MasksPanel :element="element" :track-id="trackId" />
				</div>
			</div>
		</div>

		<!-- Right tab strip -->
		<div class="scrollbar-hidden flex w-10 shrink-0 flex-col items-center gap-2 overflow-y-auto border-l border-white/10 bg-[#0e0e10] py-3">
			<button
				v-for="tab in topTabs"
				:key="tab.id"
				type="button"
				:title="tab.label"
				:class="[
					'flex flex-col items-center justify-center rounded-md p-1.5 transition-colors',
					activeTab === tab.id
						? 'text-blue-400'
						: 'text-zinc-500 hover:text-zinc-300',
				]"
				@click="activeTab = tab.id"
			>
				<component :is="tab.icon" class="size-[15px]" />
			</button>
		</div>
	</div>
</template>
