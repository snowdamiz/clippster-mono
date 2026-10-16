<script setup lang="ts">
/**
 * Layer blend-mode select shared by the video, image, text and sticker
 * inspectors. Emits the raw option value ("normal" included); callers keep
 * their own mapping (e.g. "normal" -> undefined).
 */
import InspectorField from "../shared/InspectorField.vue";
import InspectorSelect from "../shared/InspectorSelect.vue";

defineProps<{ modelValue?: string | null; label?: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const BLEND_MODE_OPTIONS = [
	{ value: "normal", label: "Normal" },
	{ value: "multiply", label: "Multiply" },
	{ value: "screen", label: "Screen" },
	{ value: "overlay", label: "Overlay" },
	{ value: "soft-light", label: "Soft light" },
	{ value: "hard-light", label: "Hard light" },
	{ value: "darken", label: "Darken" },
	{ value: "lighten", label: "Lighten" },
	{ value: "color-dodge", label: "Color dodge" },
	{ value: "color-burn", label: "Color burn" },
	{ value: "difference", label: "Difference" },
	{ value: "exclusion", label: "Exclusion" },
] as const;
</script>

<template>
	<InspectorField :label="label ?? 'Blend mode'">
		<InspectorSelect
			:model-value="modelValue ?? 'normal'"
			:options="BLEND_MODE_OPTIONS"
			aria-label="Blend mode"
			@update:model-value="(v) => emit('update:modelValue', v)"
		/>
	</InspectorField>
</template>
