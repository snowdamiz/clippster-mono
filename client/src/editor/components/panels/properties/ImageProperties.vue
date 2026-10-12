<script setup lang="ts">
import { ref, watch, computed, toRef, onMounted, onUnmounted } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import type { ImageElement, ColorAdjustments, ColorCurves, ColorWheels } from "../../../types/timeline";
import { DEFAULT_COLOR_ADJUSTMENTS } from "../../../types/timeline";
import type { ChromakeySettings } from "../../../types/chromakey";
import { DEFAULT_CHROMAKEY } from "../../../types/chromakey";
import { Image, Trash2, RotateCcw, FlipHorizontal, FlipVertical, Wand2, SlidersHorizontal, Sparkles, Scissors, Diamond } from "lucide-vue-next";
import KeyframeEditorPanel from "../KeyframeEditorPanel.vue";
import { useKeyframes } from "../../../composables/useKeyframes";
import { useKeyframedInspectorProperty } from "../../../composables/useKeyframedInspectorProperty";
import KeyframeToggle from "./KeyframeToggle.vue";
import AnimationProperties from "./AnimationProperties.vue";
import MasksPanel from "./MasksPanel.vue";
import ElementTimingFields from "./ElementTimingFields.vue";
import { useImageMode } from "../../../composables/useImageMode";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import InspectorSection from "../shared/InspectorSection.vue";
import InspectorField from "../shared/InspectorField.vue";
import InspectorTabRail from "../shared/InspectorTabRail.vue";
import SliderField from "../shared/SliderField.vue";
import NumberBox from "../shared/NumberBox.vue";
import OptionChip from "../shared/OptionChip.vue";
import BlendModeSelect from "./BlendModeSelect.vue";
import EffectStackEditor from "./EffectStackEditor.vue";
import ColorAdjustmentsEditor from "./ColorAdjustmentsEditor.vue";
import ChromaKeyEditor from "./ChromaKeyEditor.vue";
import ColorGradingEditor from "./ColorGradingEditor.vue";

const props = defineProps<{
	element: ImageElement;
	trackId: string;
}>();

const { editor } = useEditor({ subscribe: false });
const { selectedElements } = useElementSelection();
const { isImageMode } = useImageMode();

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
const elementRef = toRef(props, "element");
const { hasKeyframes: hasKf, addKeyframe, clearPropertyKeyframes } = useKeyframes({
	trackRef,
	elementRef,
});

const scaleKf = useKeyframedInspectorProperty({ trackRef, elementRef, property: "scale" });
const posXKf = useKeyframedInspectorProperty({ trackRef, elementRef, property: "positionX" });
const posYKf = useKeyframedInspectorProperty({ trackRef, elementRef, property: "positionY" });
const rotationKf = useKeyframedInspectorProperty({ trackRef, elementRef, property: "rotation" });

const opacityInput = ref(Math.round(props.element.opacity * 100).toString());
const scaleInput = ref(Math.round(props.element.transform.scale * 100).toString());
const posXInput = ref(props.element.transform.position.x.toString());
const posYInput = ref(props.element.transform.position.y.toString());
const rotateInput = ref(props.element.transform.rotate.toString());

watch(() => props.element.opacity, (v) => {
	if (!hasKf("opacity")) opacityInput.value = Math.round(v * 100).toString();
});
watch(scaleKf.displayValue, (v) => {
	scaleInput.value = Math.round(v * 100).toString();
}, { immediate: true });
watch(posXKf.displayValue, (v) => { posXInput.value = v.toString(); }, { immediate: true });
watch(posYKf.displayValue, (v) => { posYInput.value = v.toString(); }, { immediate: true });
watch(rotationKf.displayValue, (v) => { rotateInput.value = v.toString(); }, { immediate: true });

const ca = computed(() => ({ ...DEFAULT_COLOR_ADJUSTMENTS, ...props.element.colorAdjustments }));

type TopTab = "image" | "adjust" | "grading" | "animate" | "masks" | "keyframes";
const activeTab = ref<TopTab>("image");

const allTopTabs: { id: TopTab; label: string; icon: any }[] = [
	{ id: "image", label: "Image", icon: Image },
	{ id: "adjust", label: "Adjust", icon: SlidersHorizontal },
	{ id: "grading", label: "Grade", icon: Wand2 },
	{ id: "animate", label: "Animate", icon: Sparkles },
	{ id: "masks", label: "Masks", icon: Scissors },
	{ id: "keyframes", label: "Keyframes", icon: Diamond },
];

const topTabs = computed(() =>
	isImageMode.value
		? allTopTabs.filter((t) => t.id !== "animate" && t.id !== "keyframes")
		: allTopTabs,
);

watch(topTabs, (tabs) => {
	if (!tabs.some((t) => t.id === activeTab.value)) activeTab.value = "image";
});

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

function resetChromakey() {
	update({ chromakey: { ...DEFAULT_CHROMAKEY } });
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

function handleFadeInSlider(raw: number) {
	const val = raw / 10;
	update({ fadeIn: val > 0.01 ? val : undefined });
}
function handleFadeOutSlider(raw: number) {
	const val = raw / 10;
	update({ fadeOut: val > 0.01 ? val : undefined });
}

function handleOpacitySlider(val: number) {
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

function handleScaleInput(value: string) {
	scaleInput.value = value;
	const parsed = parseInt(value, 10);
	if (!Number.isNaN(parsed)) {
		const scale = clamp(parsed, 10, 500) / 100;
		if (scaleKf.isKeyframed.value) {
			scaleKf.setKeyframedValue(scale);
		} else {
			updateTransform({ scale });
		}
	}
}
function handleScaleBlur() {
	const parsed = parseInt(scaleInput.value, 10);
	const pct = Number.isNaN(parsed)
		? Math.round(scaleKf.displayValue.value * 100)
		: clamp(parsed, 10, 500);
	scaleInput.value = pct.toString();
	const scale = pct / 100;
	if (scaleKf.isKeyframed.value) {
		scaleKf.setKeyframedValue(scale);
	} else {
		updateTransform({ scale });
	}
}

function handlePosX(value: string) {
	posXInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) {
		if (posXKf.isKeyframed.value) {
			posXKf.setKeyframedValue(parsed);
		} else {
			updateTransform({ position: { x: parsed, y: props.element.transform.position.y } });
		}
	}
}
function handlePosY(value: string) {
	posYInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) {
		if (posYKf.isKeyframed.value) {
			posYKf.setKeyframedValue(parsed);
		} else {
			updateTransform({ position: { x: props.element.transform.position.x, y: parsed } });
		}
	}
}

function handleRotateInput(value: string) {
	rotateInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) {
		const rot = clamp(parsed, -360, 360);
		if (rotationKf.isKeyframed.value) {
			rotationKf.setKeyframedValue(rot);
		} else {
			updateTransform({ rotate: rot });
		}
	}
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

function handleDelete() {
	editor.timeline.deleteElements({
		elements: selectedElements.value.length > 0
			? selectedElements.value
			: [{ trackId: props.trackId, elementId: props.element.id }],
	});
}

</script>

<template>
	<div class="flex h-full min-h-0 flex-row" @pointerdown.capture="handleRangePointerDown">
		<div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
			<div :key="activeTab" class="min-h-0 flex-1 animate-enter overflow-x-hidden overflow-y-auto">
				<!-- ══════ Image tab ══════ -->
				<template v-if="activeTab === 'image'">
					<InspectorSection title="Basic">
						<InspectorField inline label="Name">
							<p class="min-w-0 flex-1 truncate text-xs text-fg" :title="element.name">{{ displayFileName || "—" }}</p>
						</InspectorField>

						<ElementTimingFields :element="element" :track-id="trackId" />

						<SliderField
							label="Opacity"
							:model-value="element.opacity * 100"
							:input-value="opacityInput"
							unit="%"
							:keyframed="!isImageMode && hasKf('opacity')"
							@slide="handleOpacitySlider"
							@input="handleOpacityInput"
							@commit="handleOpacityBlur"
						>
							<template v-if="!isImageMode" #actions>
								<KeyframeToggle :active="hasKf('opacity')" label="opacity" @toggle="toggleOpacityKeyframe" />
							</template>
						</SliderField>

						<BlendModeSelect
							:model-value="element.blendMode"
							@update:model-value="(v) => update({ blendMode: v === 'normal' ? undefined : v })"
						/>

						<!-- Fade in / out (video only) -->
						<div v-if="!isImageMode" class="grid grid-cols-2 gap-3">
							<SliderField
								label="Fade in"
								:model-value="(element.fadeIn ?? 0) * 10"
								:min="0"
								:max="30"
								:step="1"
								:readout="`${(element.fadeIn ?? 0).toFixed(1)}s`"
								@slide="handleFadeInSlider"
							/>
							<SliderField
								label="Fade out"
								:model-value="(element.fadeOut ?? 0) * 10"
								:min="0"
								:max="30"
								:step="1"
								:readout="`${(element.fadeOut ?? 0).toFixed(1)}s`"
								@slide="handleFadeOutSlider"
							/>
						</div>
					</InspectorSection>

					<InspectorSection title="Transform">
						<template #actions>
							<Button variant="ghost" size="xs" title="Reset transform" @click="resetTransform">
								<RotateCcw />
								Reset
							</Button>
						</template>
						<div class="grid grid-cols-2 gap-2">
							<NumberBox
								prefix="Scale"
								suffix="%"
								:value="scaleInput"
								:min="10"
								:max="500"
								:step="1"
								:keyframed="!isImageMode && scaleKf.isKeyframed.value"
								@input="handleScaleInput"
								@commit="handleScaleBlur"
							>
								<template v-if="!isImageMode" #leading>
									<KeyframeToggle :active="scaleKf.isKeyframed.value" label="scale" class="-ml-1" @toggle="scaleKf.toggleKeyframe" />
								</template>
							</NumberBox>
							<NumberBox
								prefix="Rotate"
								suffix="°"
								:value="rotateInput"
								:min="-360"
								:max="360"
								:step="1"
								:keyframed="!isImageMode && rotationKf.isKeyframed.value"
								@input="handleRotateInput"
							>
								<template v-if="!isImageMode" #leading>
									<KeyframeToggle :active="rotationKf.isKeyframed.value" label="rotation" class="-ml-1" @toggle="rotationKf.toggleKeyframe" />
								</template>
							</NumberBox>
							<NumberBox
								prefix="X"
								:value="posXInput"
								:step="1"
								:keyframed="!isImageMode && posXKf.isKeyframed.value"
								@input="handlePosX"
							>
								<template v-if="!isImageMode" #leading>
									<KeyframeToggle :active="posXKf.isKeyframed.value" label="position X" class="-ml-1" @toggle="posXKf.toggleKeyframe" />
								</template>
							</NumberBox>
							<NumberBox
								prefix="Y"
								:value="posYInput"
								:step="1"
								:keyframed="!isImageMode && posYKf.isKeyframed.value"
								@input="handlePosY"
							>
								<template v-if="!isImageMode" #leading>
									<KeyframeToggle :active="posYKf.isKeyframed.value" label="position Y" class="-ml-1" @toggle="posYKf.toggleKeyframe" />
								</template>
							</NumberBox>
							<OptionChip
								:active="!!element.flip?.horizontal"
								:icon="FlipHorizontal"
								@click="update({ flip: { horizontal: !(element.flip?.horizontal ?? false), vertical: element.flip?.vertical ?? false } })"
							>
								Flip H
							</OptionChip>
							<OptionChip
								:active="!!element.flip?.vertical"
								:icon="FlipVertical"
								@click="update({ flip: { horizontal: element.flip?.horizontal ?? false, vertical: !(element.flip?.vertical ?? false) } })"
							>
								Flip V
							</OptionChip>
						</div>
					</InspectorSection>

					<!-- Chroma key (green screen) — video only -->
					<InspectorSection
						v-if="!isImageMode"
						title="Chroma key"
						collapsible
						:open="showChromakey"
						@update:open="(v) => (showChromakey = v)"
					>
						<template v-if="chromakey.enabled" #meta>
							<Badge variant="success">On</Badge>
						</template>
						<ChromaKeyEditor :settings="chromakey" @update="updateChromakey" @reset="resetChromakey" />
					</InspectorSection>

					<InspectorSection
						title="Effects"
						collapsible
						:open="showEffects"
						@update:open="(v) => (showEffects = v)"
					>
						<template v-if="effects.length > 0" #meta>
							<Badge variant="neutral" class="tabular">{{ effects.length }}</Badge>
						</template>
						<EffectStackEditor
							:effects="effects"
							:empty-hint="isImageMode ? 'No effects on this layer' : undefined"
							@toggle="toggleEffect"
							@remove="removeEffect"
							@update="updateEffectParam"
						/>
					</InspectorSection>

					<div class="p-3">
						<Button variant="destructive-soft" size="sm" block @click="handleDelete">
							<Trash2 />
							Delete image
						</Button>
					</div>
				</template>

				<!-- ══════ Adjust tab ══════ -->
				<ColorAdjustmentsEditor
					v-else-if="activeTab === 'adjust'"
					:adjustments="ca"
					@update="updateColor"
					@reset="resetColor"
				/>

				<!-- ══════ Color grading tab ══════ -->
				<ColorGradingEditor
					v-else-if="activeTab === 'grading'"
					:curves="element.colorCurves"
					:wheels="element.colorWheels"
					:lut-path="element.lutPath"
					@update:curves="updateColorCurves"
					@update:wheels="updateColorWheels"
					@update:lut-path="updateLutPath"
				/>

				<!-- ══════ Animate tab (video only) ══════ -->
				<InspectorSection v-else-if="!isImageMode && activeTab === 'animate'" title="Animation" flush>
					<AnimationProperties
						:element-id="element.id"
						:track-id="trackId"
						:animation-in="element.animationIn"
						:animation-out="element.animationOut"
						:animation-loop="element.animationLoop"
						:element-duration="element.duration"
					/>
				</InspectorSection>

				<!-- ══════ Masks tab ══════ -->
				<MasksPanel v-else-if="activeTab === 'masks'" :element="element" :track-id="trackId" />

				<!-- ══════ Keyframes tab (video only) ══════ -->
				<KeyframeEditorPanel v-else-if="!isImageMode && activeTab === 'keyframes'" :track-id="trackId" :element="element" />
			</div>
		</div>

		<InspectorTabRail v-model="activeTab" :tabs="topTabs" />
	</div>
</template>
