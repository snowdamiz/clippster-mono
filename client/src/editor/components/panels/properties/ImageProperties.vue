<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import type { ImageElement, ColorAdjustments } from "../../../types/timeline";
import { Image, Trash2, RotateCcw, FlipHorizontal, FlipVertical } from "lucide-vue-next";

const props = defineProps<{
	element: ImageElement;
	trackId: string;
}>();

const { editor } = useEditor();
const { selectedElements } = useElementSelection();

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

const colorDefaults: ColorAdjustments = { brightness: 0, contrast: 0, saturation: 0, temperature: 0 };
const ca = computed(() => props.element.colorAdjustments ?? colorDefaults);

function update(updates: Record<string, unknown>) {
	editor.timeline.updateElement({
		trackId: props.trackId,
		elementId: props.element.id,
		updates,
	});
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

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
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
	update({ colorAdjustments: { brightness: 0, contrast: 0, saturation: 0, temperature: 0 } });
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
				<p class="text-sm">{{ element.name }}</p>
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
			<label class="text-xs text-zinc-500">Opacity</label>
			<div class="flex items-center gap-2">
				<input type="range" :value="element.opacity * 100" min="0" max="100" step="1" class="flex-1" @input="handleOpacitySlider" />
				<input type="number" :value="opacityInput" min="0" max="100" class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200" @input="(e) => handleOpacityInput((e.target as HTMLInputElement).value)" @blur="handleOpacityBlur" />
			</div>
		</div>

		<!-- Transform section -->
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<label class="text-xs font-medium text-zinc-400">Transform</label>
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

		<!-- Color Adjustments -->
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<label class="text-xs font-medium text-zinc-400">Color Adjustments</label>
				<button class="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300" title="Reset color" @click="resetColor">
					<RotateCcw class="size-3" />
					Reset
				</button>
			</div>

			<div v-for="prop in (['brightness', 'contrast', 'saturation', 'temperature'] as const)" :key="prop" class="space-y-1">
				<label class="text-xs capitalize text-zinc-500">{{ prop }}</label>
				<div class="flex items-center gap-2">
					<input type="range" :value="ca[prop]" min="-100" max="100" step="1" class="flex-1" @input="(e) => updateColor({ [prop]: Number((e.target as HTMLInputElement).value) })" />
					<span class="w-8 text-right text-xs text-zinc-400">{{ ca[prop] }}</span>
				</div>
			</div>
		</div>

		<!-- Delete -->
		<button
			class="flex w-full items-center justify-center gap-2 rounded-md border border-red-500/30 bg-red-500/15 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/25 hover:border-red-500/50"
			@click="handleDelete"
		>
			<Trash2 class="size-4" />
			Delete Image
		</button>
	</div>
</template>
