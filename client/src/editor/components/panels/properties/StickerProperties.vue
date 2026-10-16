<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import { useImageMode } from "../../../composables/useImageMode";
import type { StickerElement } from "../../../types/timeline";
import { Sticker, Trash2, RotateCcw, Diamond, Sparkles } from "lucide-vue-next";
import AnimationProperties from "./AnimationProperties.vue";
import ElementTimingFields from "./ElementTimingFields.vue";
import KeyframeEditorPanel from "../KeyframeEditorPanel.vue";
import BlendModeSelect from "./BlendModeSelect.vue";
import { Button } from "@/components/ui/button";
import InspectorSection from "../shared/InspectorSection.vue";
import InspectorField from "../shared/InspectorField.vue";
import InspectorTabRail from "../shared/InspectorTabRail.vue";
import SliderField from "../shared/SliderField.vue";
import NumberBox from "../shared/NumberBox.vue";
import ColorSwatchField from "../shared/ColorSwatchField.vue";

const props = defineProps<{
	element: StickerElement;
	trackId: string;
}>();

type TopTab = "sticker" | "animate" | "keyframes";
const activeTab = ref<TopTab>("sticker");
const allTopTabs: { id: TopTab; label: string; icon: typeof Sticker }[] = [
	{ id: "sticker", label: "Sticker", icon: Sticker },
	{ id: "animate", label: "Animate", icon: Sparkles },
	{ id: "keyframes", label: "Keyframes", icon: Diamond },
];
const { isImageMode } = useImageMode();
// Animation and keyframes are video-only.
const topTabs = computed(() =>
	isImageMode.value ? allTopTabs.filter((t) => t.id !== "animate" && t.id !== "keyframes") : allTopTabs,
);
watch(topTabs, (tabs) => {
	if (!tabs.some((t) => t.id === activeTab.value)) activeTab.value = "sticker";
});

const { editor } = useEditor({ subscribe: false });
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

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function handleOpacitySlider(val: number) {
	opacityInput.value = val.toString();
	update({ opacity: val / 100 });
}

function handleOpacityInput(value: string) {
	opacityInput.value = value;
	const parsed = parseInt(value, 10);
	if (!Number.isNaN(parsed)) {
		update({ opacity: clamp(parsed, 0, 100) / 100 });
	}
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
		updateTransform({ scale: clamp(parsed, 10, 500) / 100 });
	}
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
	if (!Number.isNaN(parsed)) {
		updateTransform({ position: { x: parsed, y: props.element.transform.position.y } });
	}
}

function handlePosY(value: string) {
	posYInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) {
		updateTransform({ position: { x: props.element.transform.position.x, y: parsed } });
	}
}

function handleRotateInput(value: string) {
	rotateInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) {
		updateTransform({ rotate: clamp(parsed, -360, 360) });
	}
}

function resetTransform() {
	update({
		transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
	});
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
	<div class="flex h-full min-h-0 flex-row">
		<div :key="activeTab" class="min-h-0 min-w-0 flex-1 animate-enter overflow-x-hidden overflow-y-auto">
			<template v-if="activeTab === 'sticker'">
				<InspectorSection title="Basic">
					<InspectorField inline label="Name">
						<p class="min-w-0 flex-1 truncate text-xs text-fg" :title="element.name">{{ element.name }}</p>
					</InspectorField>

					<ElementTimingFields :element="element" :track-id="trackId" />

					<SliderField
						label="Opacity"
						:model-value="element.opacity * 100"
						:input-value="opacityInput"
						unit="%"
						@slide="handleOpacitySlider"
						@input="handleOpacityInput"
						@commit="handleOpacityBlur"
					/>

					<BlendModeSelect
						:model-value="element.blendMode"
						@update:model-value="(v) => update({ blendMode: v === 'normal' ? undefined : v })"
					/>

					<InspectorField label="Color">
						<ColorSwatchField
							:model-value="element.color"
							clearable
							placeholder="Default"
							aria-label="Sticker color"
							@update:model-value="(v) => update({ color: v })"
							@clear="update({ color: undefined })"
						/>
					</InspectorField>
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
							@input="handleScaleInput"
							@commit="handleScaleBlur"
						/>
						<NumberBox
							prefix="Rotate"
							suffix="°"
							:value="rotateInput"
							:min="-360"
							:max="360"
							:step="1"
							@input="handleRotateInput"
						/>
						<NumberBox prefix="X" :value="posXInput" :step="1" @input="handlePosX" />
						<NumberBox prefix="Y" :value="posYInput" :step="1" @input="handlePosY" />
					</div>
				</InspectorSection>

				<div class="p-3">
					<Button variant="destructive-soft" size="sm" block @click="handleDelete">
						<Trash2 />
						Delete sticker
					</Button>
				</div>
			</template>

			<!-- Animation (video only) -->
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

			<KeyframeEditorPanel v-else-if="!isImageMode && activeTab === 'keyframes'" :track-id="trackId" :element="element" />
		</div>

		<InspectorTabRail v-model="activeTab" :tabs="topTabs" />
	</div>
</template>
