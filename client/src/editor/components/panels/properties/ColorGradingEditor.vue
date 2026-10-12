<script setup lang="ts">
/**
 * "Grade" tab body shared by the video and image inspectors: RGB curves,
 * color wheels and LUT, each in its own section.
 */
import type { ColorCurves, ColorWheels } from "../../../types/timeline";
import InspectorSection from "../shared/InspectorSection.vue";
import ColorCurvesPanel from "./ColorCurvesPanel.vue";
import ColorWheelsPanel from "./ColorWheelsPanel.vue";
import LutPanel from "./LutPanel.vue";

defineProps<{
	curves?: ColorCurves;
	wheels?: ColorWheels;
	lutPath?: string;
}>();

const emit = defineEmits<{
	"update:curves": [curves: ColorCurves];
	"update:wheels": [wheels: ColorWheels];
	"update:lutPath": [lutPath: string | undefined];
}>();
</script>

<template>
	<div>
		<InspectorSection title="RGB curves">
			<ColorCurvesPanel :curves="curves ?? {}" @update="(c) => emit('update:curves', c)" />
		</InspectorSection>
		<InspectorSection title="Color wheels">
			<ColorWheelsPanel :wheels="wheels ?? {}" @update="(w) => emit('update:wheels', w)" />
		</InspectorSection>
		<InspectorSection title="LUT" flush>
			<LutPanel :lut-path="lutPath" @update="(p) => emit('update:lutPath', p)" />
		</InspectorSection>
	</div>
</template>
