<script setup lang="ts">
/**
 * Chroma key (green screen) controls shared by the video and image
 * inspectors. Emits partial updates; the parent merges them.
 */
import { RotateCcw } from "lucide-vue-next";
import type { ChromakeySettings } from "../../../types/chromakey";
import InspectorField from "../shared/InspectorField.vue";
import SliderField from "../shared/SliderField.vue";
import ColorSwatchField from "../shared/ColorSwatchField.vue";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

defineProps<{ settings: ChromakeySettings }>();

const emit = defineEmits<{
	update: [partial: Partial<ChromakeySettings>];
	reset: [];
}>();

const SLIDERS = [
	{ key: "similarity", label: "Similarity" },
	{ key: "smoothness", label: "Smoothness" },
	{ key: "spillReduction", label: "Spill" },
] as const;
</script>

<template>
	<div class="space-y-3">
		<InspectorField inline label="Enabled">
			<div class="flex-1" />
			<Switch
				:model-value="settings.enabled"
				aria-label="Enable chroma key"
				@update:model-value="(val: boolean) => emit('update', { enabled: val })"
			/>
		</InspectorField>

		<template v-if="settings.enabled">
			<InspectorField label="Key color">
				<template #actions>
					<Button variant="ghost" size="xs" class="-my-1" @click="emit('reset')">
						<RotateCcw />
						Reset
					</Button>
				</template>
				<ColorSwatchField
					:model-value="settings.color"
					aria-label="Key color"
					@update:model-value="(v) => emit('update', { color: v })"
				/>
			</InspectorField>
			<SliderField
				v-for="param in SLIDERS"
				inline
				:key="param.key"
				:label="param.label"
				:model-value="settings[param.key]"
				:min="0"
				:max="100"
				@update:model-value="(v) => emit('update', { [param.key]: v })"
			/>
		</template>
	</div>
</template>
