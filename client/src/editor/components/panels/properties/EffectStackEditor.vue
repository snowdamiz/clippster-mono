<script setup lang="ts">
/**
 * Per-clip effect stack (video & image inspectors): one card per applied
 * effect with enable / remove actions and its parameter sliders. Parameter
 * ranges are data-driven from EFFECT_PARAM_FIELDS below; the parent owns the
 * update logic via the emitted events.
 */
import { Eye, EyeOff, Wand2, X } from "lucide-vue-next";
import type { VideoEffect } from "../../../types/effects";
import { getEffectPreset } from "../../../constants/effect-constants";
import { COLOR_OVERLAY_BLEND_OPTIONS } from "../../../constants/color-overlay-constants";
import SliderField from "../shared/SliderField.vue";
import InspectorField from "../shared/InspectorField.vue";
import InspectorSelect from "../shared/InspectorSelect.vue";
import ColorSwatchField from "../shared/ColorSwatchField.vue";
import { EmptyState } from "@/components/ui/empty-state";

defineProps<{
	effects: VideoEffect[];
	/** Secondary line of the empty state. */
	emptyHint?: string;
}>();

const emit = defineEmits<{
	toggle: [effectId: string];
	remove: [effectId: string];
	update: [effectId: string, key: string, value: number | string];
}>();

type NumberParam = { key: string; label: string; min: number; max: number; step?: number };

/** Slider parameters per effect type (beyond the shared Intensity slider). */
const EFFECT_PARAM_FIELDS: Record<string, NumberParam[]> = {
	blur: [{ key: "radius", label: "Radius", min: 1, max: 50 }],
	pixelate: [{ key: "blockSize", label: "Block", min: 2, max: 64 }],
	sharpen: [{ key: "amount", label: "Amount", min: 0, max: 10, step: 0.5 }],
	vignette: [
		{ key: "radius", label: "Radius", min: 0, max: 100 },
		{ key: "softness", label: "Softness", min: 0, max: 100 },
	],
	colorShift: [
		{ key: "redOffsetX", label: "Red X", min: -20, max: 20 },
		{ key: "blueOffsetX", label: "Blue X", min: -20, max: 20 },
	],
	glitch: [
		{ key: "sliceCount", label: "Slices", min: 2, max: 20 },
		{ key: "maxOffset", label: "Offset", min: 0, max: 50 },
		{ key: "colorBleed", label: "Bleed", min: 0, max: 100 },
	],
	wave: [
		{ key: "amplitude", label: "Amplitude", min: 1, max: 50 },
		{ key: "frequency", label: "Frequency", min: 0.5, max: 10, step: 0.5 },
		{ key: "speed", label: "Speed", min: 0, max: 10, step: 0.5 },
	],
	zoomPulse: [
		{ key: "amount", label: "Amount", min: 1, max: 50 },
		{ key: "speed", label: "Speed", min: 0.5, max: 5, step: 0.5 },
	],
	flash: [{ key: "speed", label: "Speed", min: 0.5, max: 5, step: 0.5 }],
	noise: [{ key: "amount", label: "Amount", min: 0, max: 100 }],
	vhs: [
		{ key: "scanlineOpacity", label: "Scanlines", min: 0, max: 100 },
		{ key: "colorBleed", label: "Bleed", min: 0, max: 50 },
		{ key: "noiseAmount", label: "Noise", min: 0, max: 100 },
	],
	motionBlur: [
		{ key: "angle", label: "Angle", min: 0, max: 360 },
		{ key: "distance", label: "Distance", min: 1, max: 30 },
	],
	radialBlur: [{ key: "amount", label: "Amount", min: 1, max: 20 }],
	hueShift: [{ key: "speed", label: "Speed", min: 0.1, max: 5, step: 0.1 }],
	colorHalftone: [{ key: "dotSize", label: "Dot size", min: 2, max: 20 }],
	lensDistortion: [{ key: "amount", label: "Amount", min: -100, max: 100 }],
	posterize: [{ key: "levels", label: "Levels", min: 2, max: 16 }],
};

function paramValue(effect: VideoEffect, key: string): number {
	return (effect as unknown as Record<string, number>)[key];
}

function stringParam(effect: VideoEffect, key: string): string | undefined {
	return (effect as unknown as Record<string, string | undefined>)[key];
}

function getEffectLabel(type: string): string {
	return getEffectPreset(type)?.label ?? type;
}
</script>

<template>
	<div class="space-y-2">
		<div v-if="effects.length === 0" class="rounded-lg border border-dashed border-line">
			<EmptyState
				size="sm"
				:icon="Wand2"
				title="No effects applied"
				:description="emptyHint ?? 'Add effects from the Effects panel'"
				class="py-5"
			/>
		</div>

		<div
			v-for="effect in effects"
			:key="effect.id"
			class="overflow-hidden rounded-lg border border-line-subtle bg-surface-raised"
		>
			<div class="flex h-8 items-center gap-1 pl-2.5 pr-1">
				<span class="min-w-0 flex-1 truncate text-xs font-medium" :class="effect.enabled ? 'text-fg' : 'text-fg-subtle'">
					{{ getEffectLabel(effect.type) }}
				</span>
				<button
					type="button"
					class="grid size-6 place-items-center rounded text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
					:title="effect.enabled ? 'Disable effect' : 'Enable effect'"
					:aria-label="effect.enabled ? 'Disable effect' : 'Enable effect'"
					@click="emit('toggle', effect.id)"
				>
					<component :is="effect.enabled ? Eye : EyeOff" class="size-3.5" />
				</button>
				<button
					type="button"
					class="grid size-6 place-items-center rounded text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger"
					title="Remove effect"
					aria-label="Remove effect"
					@click="emit('remove', effect.id)"
				>
					<X class="size-3.5" />
				</button>
			</div>

			<div v-if="effect.enabled" class="space-y-1.5 border-t border-line-subtle px-2.5 py-2">
				<SliderField
					inline
					label="Intensity"
					:model-value="effect.intensity"
					:min="0"
					:max="100"
					@update:model-value="(v) => emit('update', effect.id, 'intensity', v)"
				/>

				<SliderField
					v-for="param in EFFECT_PARAM_FIELDS[effect.type] ?? []"
					:key="param.key"
					inline
					:label="param.label"
					:model-value="paramValue(effect, param.key)"
					:min="param.min"
					:max="param.max"
					:step="param.step ?? 1"
					@update:model-value="(v) => emit('update', effect.id, param.key, v)"
				/>

				<InspectorField v-if="effect.type === 'flash'" inline label="Color">
					<ColorSwatchField
						:model-value="stringParam(effect, 'color')"
						class="flex-1"
						@update:model-value="(v) => emit('update', effect.id, 'color', v)"
					/>
				</InspectorField>

				<template v-if="effect.type === 'colorOverlay'">
					<InspectorField inline label="Color">
						<ColorSwatchField
							:model-value="stringParam(effect, 'color') ?? '#ff4500'"
							class="flex-1"
							@update:model-value="(v) => emit('update', effect.id, 'color', v)"
						/>
					</InspectorField>
					<InspectorField inline label="Blend">
						<InspectorSelect
							:model-value="stringParam(effect, 'blendMode') ?? 'color-burn'"
							:options="COLOR_OVERLAY_BLEND_OPTIONS"
							class="flex-1"
							aria-label="Blend mode"
							@update:model-value="(v) => emit('update', effect.id, 'blendMode', v)"
						/>
					</InspectorField>
				</template>
			</div>
		</div>
	</div>
</template>
