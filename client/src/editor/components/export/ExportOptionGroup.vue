<script setup lang="ts" generic="T extends string | number">
/**
 * One export setting: label, a segmented choice and a hint line.
 * Shared by the video export dialog (ExportButton) and ImageExportDialog.
 */
import { Field } from "@/components/ui/field";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";

defineProps<{
	label: string;
	hint?: string;
	options: SegmentedOption<T>[];
}>();

const model = defineModel<T>({ required: true });
</script>

<template>
	<Field :label="label" :hint="hint">
		<SegmentedControl v-model="model" :options="options" block />
	</Field>
</template>
