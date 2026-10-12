<script setup lang="ts">
/**
 * "Adjust" tab body shared by the video and image inspectors: basic color
 * sliders, fade / sharpness and tint. Emits partial updates; the parent
 * merges them into the element's colorAdjustments.
 */
import { RotateCcw } from "lucide-vue-next";
import type { ColorAdjustments } from "../../../types/timeline";
import InspectorSection from "../shared/InspectorSection.vue";
import InspectorField from "../shared/InspectorField.vue";
import SliderField from "../shared/SliderField.vue";
import ColorSwatchField from "../shared/ColorSwatchField.vue";
import { Button } from "@/components/ui/button";

defineProps<{ adjustments: ColorAdjustments }>();

const emit = defineEmits<{
	update: [partial: Partial<ColorAdjustments>];
	reset: [];
}>();

const COLOR_FIELDS = [
	{ key: "brightness", label: "Brightness" },
	{ key: "contrast", label: "Contrast" },
	{ key: "saturation", label: "Saturation" },
	{ key: "temperature", label: "Temperature" },
	{ key: "highlights", label: "Highlights" },
	{ key: "shadows", label: "Shadows" },
	{ key: "exposure", label: "Exposure" },
] as const;

const DETAIL_FIELDS = [
	{ key: "fade", label: "Fade" },
	{ key: "sharpness", label: "Sharpness" },
] as const;
</script>

<template>
	<div>
		<InspectorSection title="Color">
			<template #actions>
				<Button variant="ghost" size="xs" @click="emit('reset')">
					<RotateCcw />
					Reset
				</Button>
			</template>
			<SliderField
				v-for="field in COLOR_FIELDS"
				inline
				:key="field.key"
				:label="field.label"
				:model-value="adjustments[field.key]"
				:min="-100"
				:max="100"
				@update:model-value="(v) => emit('update', { [field.key]: v })"
			/>
		</InspectorSection>

		<InspectorSection title="Detail">
			<SliderField
				v-for="field in DETAIL_FIELDS"
				inline
				:key="field.key"
				:label="field.label"
				:model-value="adjustments[field.key]"
				:min="0"
				:max="100"
				@update:model-value="(v) => emit('update', { [field.key]: v })"
			/>
			<InspectorField inline label="Tint">
				<ColorSwatchField
					:model-value="adjustments.tint"
					clearable
					placeholder="None"
					@update:model-value="(v) => emit('update', { tint: v })"
					class="flex-1"
					@clear="emit('update', { tint: '' })"
				/>
			</InspectorField>
		</InspectorSection>
	</div>
</template>
