<script setup lang="ts">
import { computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import type { EffectElement } from "../../../types/timeline";
import { getEffectPreset } from "../../../constants/effect-constants";
import { COLOR_OVERLAY_BLEND_OPTIONS } from "../../../constants/color-overlay-constants";
import { Wand2, Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import InspectorSection from "../shared/InspectorSection.vue";
import InspectorField from "../shared/InspectorField.vue";
import InspectorSelect from "../shared/InspectorSelect.vue";
import SliderField from "../shared/SliderField.vue";
import ColorSwatchField from "../shared/ColorSwatchField.vue";

const props = defineProps<{
	element: EffectElement;
	trackId: string;
}>();

const { editor } = useEditor({ subscribe: false });
const { selectedElements } = useElementSelection();

const preset = computed(() => getEffectPreset(props.element.effectType));

const isColorOverlay = computed(() => props.element.effectType === "colorOverlay");
const overlayColor = computed(() => (props.element.params.color as string) ?? "#ff4500");
const overlayBlendMode = computed(() => (props.element.params.blendMode as string) ?? "color-burn");

function update(updates: Record<string, unknown>) {
	editor.timeline.updateElement({
		trackId: props.trackId,
		elementId: props.element.id,
		updates,
	});
}

function toggleEnabled() {
	update({ enabled: !props.element.enabled });
}

function updateParam(key: string, value: number | string) {
	update({ params: { ...props.element.params, [key]: value } });
}

function handleDelete() {
	editor.timeline.deleteElements({
		elements: selectedElements.value.length > 0
			? selectedElements.value
			: [{ trackId: props.trackId, elementId: props.element.id }],
	});
}

const paramEntries = computed(() => {
	const entries: { key: string; value: number | string; label: string; min?: number; max?: number; step?: number }[] = [];
	const p = props.element.params;
	const type = props.element.effectType;

	if (type === "blur") {
		entries.push({ key: "radius", value: (p.radius as number) ?? 8, label: "Radius", min: 1, max: 50, step: 1 });
	} else if (type === "pixelate") {
		entries.push({ key: "blockSize", value: (p.blockSize as number) ?? 12, label: "Block size", min: 2, max: 100, step: 1 });
	} else if (type === "sharpen") {
		entries.push({ key: "amount", value: (p.amount as number) ?? 3, label: "Amount", min: 0.1, max: 10, step: 0.1 });
	} else if (type === "vignette") {
		entries.push({ key: "radius", value: (p.radius as number) ?? 50, label: "Radius", min: 10, max: 100, step: 1 });
		entries.push({ key: "softness", value: (p.softness as number) ?? 50, label: "Softness", min: 0, max: 100, step: 1 });
	} else if (type === "colorShift") {
		entries.push({ key: "redOffsetX", value: (p.redOffsetX as number) ?? 5, label: "Red X", min: -20, max: 20, step: 1 });
		entries.push({ key: "redOffsetY", value: (p.redOffsetY as number) ?? 0, label: "Red Y", min: -20, max: 20, step: 1 });
		entries.push({ key: "blueOffsetX", value: (p.blueOffsetX as number) ?? -5, label: "Blue X", min: -20, max: 20, step: 1 });
		entries.push({ key: "blueOffsetY", value: (p.blueOffsetY as number) ?? 0, label: "Blue Y", min: -20, max: 20, step: 1 });
	} else if (type === "glitch") {
		entries.push({ key: "sliceCount", value: (p.sliceCount as number) ?? 10, label: "Slices", min: 2, max: 50, step: 1 });
		entries.push({ key: "colorBleed", value: (p.colorBleed as number) ?? 40, label: "Color bleed", min: 0, max: 100, step: 1 });
	} else if (type === "wave") {
		entries.push({ key: "amplitude", value: (p.amplitude as number) ?? 10, label: "Amplitude", min: 1, max: 50, step: 1 });
		entries.push({ key: "frequency", value: (p.frequency as number) ?? 3, label: "Frequency", min: 0.5, max: 20, step: 0.5 });
		entries.push({ key: "speed", value: (p.speed as number) ?? 2, label: "Speed", min: 0.1, max: 10, step: 0.1 });
	} else if (type === "zoomPulse") {
		entries.push({ key: "amount", value: (p.amount as number) ?? 15, label: "Amount %", min: 1, max: 50, step: 1 });
		entries.push({ key: "speed", value: (p.speed as number) ?? 2, label: "Speed", min: 0.1, max: 10, step: 0.1 });
	} else if (type === "flash") {
		entries.push({ key: "speed", value: (p.speed as number) ?? 2, label: "Speed", min: 0.1, max: 10, step: 0.1 });
	}

	return entries;
});

function formatParam(param: { value: number | string; step?: number }) {
	if (typeof param.value !== "number") return String(param.value);
	return Number.isInteger(param.step ?? 1) ? String(param.value) : Number(param.value).toFixed(1);
}
</script>

<template>
	<div class="h-full min-h-0 overflow-y-auto overflow-x-hidden">
		<InspectorSection :title="preset?.label ?? element.effectType" :icon="Wand2">
			<template #actions>
				<Switch
					:model-value="element.enabled"
					:aria-label="element.enabled ? 'Disable effect' : 'Enable effect'"
					:title="element.enabled ? 'Disable effect' : 'Enable effect'"
					@update:model-value="toggleEnabled"
				/>
			</template>

			<template v-if="element.enabled">
				<SliderField
					label="Intensity"
					:model-value="element.intensity"
					:min="0"
					:max="100"
					:step="1"
					:readout="`${Math.round(element.intensity)}%`"
					@update:model-value="(v) => update({ intensity: v })"
				/>

				<!-- Solid color / colorOverlay -->
				<template v-if="isColorOverlay">
					<InspectorField label="Color">
						<ColorSwatchField
							:model-value="overlayColor"
							aria-label="Overlay color"
							@update:model-value="(v) => updateParam('color', v)"
						/>
					</InspectorField>
					<InspectorField label="Blend mode">
						<InspectorSelect
							:model-value="overlayBlendMode"
							:options="COLOR_OVERLAY_BLEND_OPTIONS"
							aria-label="Blend mode"
							@update:model-value="(v) => updateParam('blendMode', v)"
						/>
					</InspectorField>
				</template>

				<!-- Effect-specific params -->
				<template v-for="param in paramEntries" :key="param.key">
					<SliderField
						v-if="typeof param.value === 'number'"
						:label="param.label"
						:model-value="param.value"
						:min="param.min ?? 0"
						:max="param.max ?? 100"
						:step="param.step ?? 1"
						:readout="formatParam(param)"
						@update:model-value="(v) => updateParam(param.key, v)"
					/>
				</template>
			</template>

			<p v-else class="rounded-md bg-surface-sunken px-2.5 py-2 text-center text-xs text-fg-subtle">
				Effect disabled
			</p>
		</InspectorSection>

		<div class="p-3">
			<Button variant="destructive-soft" size="sm" block @click="handleDelete">
				<Trash2 />
				Delete effect
			</Button>
		</div>
	</div>
</template>
