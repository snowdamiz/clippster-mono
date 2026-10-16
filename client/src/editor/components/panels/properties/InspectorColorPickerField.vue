<script setup lang="ts">
/**
 * Inline inspector row for the app ColorPicker (popover with presets + RGB):
 * label + ColorSwatchField in `appPicker` mode (swatch + hex value). The swatch shows user
 * content, so the color itself is never tokenized. `empty` replaces the
 * swatch with "None"; trailing actions (Add / Clear) go in the default slot.
 * Used by the text inspector.
 *
 *   <InspectorColorPickerField label="Color" :model-value="element.color" @update:model-value="(v) => update({ color: v })" />
 */
import ColorSwatchField from "../shared/ColorSwatchField.vue";
import InspectorField from "../shared/InspectorField.vue";

defineProps<{
	label: string;
	modelValue: string;
	/** Show "None" instead of the swatch. */
	empty?: boolean;
	hideValue?: boolean;
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
	<InspectorField inline :label="label">
		<span v-if="empty" class="flex h-7 min-w-0 flex-1 items-center text-xs text-fg-subtle">None</span>
		<ColorSwatchField
			v-else
			app-picker
			:model-value="modelValue"
			:aria-label="label"
			:class="hideValue ? 'w-auto' : 'flex-1'"
			@update:model-value="(v) => emit('update:modelValue', v)"
		/>
		<slot />
	</InspectorField>
</template>
