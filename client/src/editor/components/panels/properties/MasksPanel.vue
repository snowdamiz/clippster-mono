<script setup lang="ts">
import { computed } from "vue";
import { nanoid } from "nanoid";
import { useEditor } from "../../../composables/useEditor";
import { useEditorUIState } from "../../../composables/useEditorUIState";
import type { VideoElement, ImageElement, MaskShape } from "../../../types/timeline";
import { Trash2, RectangleHorizontal, Circle, Pentagon, Scissors } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import InspectorSection from "../shared/InspectorSection.vue";
import InspectorField from "../shared/InspectorField.vue";
import SliderField from "../shared/SliderField.vue";

const props = defineProps<{
	element: VideoElement | ImageElement;
	trackId: string;
}>();

const { editor } = useEditor({ subscribe: false });
const { maskEditMode } = useEditorUIState();

const masks = computed<MaskShape[]>(() => props.element.masks ?? []);

function updateMasks(newMasks: MaskShape[]) {
	editor.timeline.updateElement({
		trackId: props.trackId,
		elementId: props.element.id,
		updates: { masks: newMasks },
	});
}

function addMask(type: "rectangle" | "ellipse" | "polygon") {
	const newMask: MaskShape = {
		id: nanoid(8),
		type,
		x: 0.5,
		y: 0.5,
		width: 0.4,
		height: 0.3,
		feather: 0,
		invert: false,
		rotation: 0,
	};
	if (type === "polygon") {
		newMask.points = [
			{ x: 0.35, y: 0.35 },
			{ x: 0.65, y: 0.35 },
			{ x: 0.75, y: 0.6 },
			{ x: 0.5, y: 0.75 },
			{ x: 0.25, y: 0.6 },
		];
	}
	updateMasks([...masks.value, newMask]);
}

function removeMask(id: string) {
	updateMasks(masks.value.filter((m) => m.id !== id));
}

function updateMask(id: string, partial: Partial<MaskShape>) {
	updateMasks(
		masks.value.map((m) => (m.id === id ? { ...m, ...partial } : m)),
	);
}

const MASK_TYPES = [
	{ type: "rectangle", label: "Rectangle", icon: RectangleHorizontal },
	{ type: "ellipse", label: "Ellipse", icon: Circle },
	{ type: "polygon", label: "Polygon", icon: Pentagon },
] as const;

function maskIcon(type: MaskShape["type"]) {
	return MASK_TYPES.find((m) => m.type === type)?.icon ?? Pentagon;
}

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}
</script>

<template>
	<InspectorSection title="Masks" flush class="min-w-0">
		<template v-if="masks.length > 0" #meta>
			<Badge variant="neutral" class="tabular">{{ masks.length }}</Badge>
		</template>

		<InspectorField inline label="Lock masks">
			<div class="flex-1" />
			<Switch
				:model-value="!maskEditMode"
				aria-label="Lock masks on the canvas"
				@update:model-value="(locked: boolean) => (maskEditMode = !locked)"
			/>
		</InspectorField>

		<!-- Add buttons -->
		<div class="space-y-2 border-t border-line-subtle pt-3">
			<SectionHeader title="Add mask" variant="eyebrow" class="min-h-5" />
			<div class="grid min-w-0 grid-cols-3 gap-1.5">
				<Button
					v-for="m in MASK_TYPES"
					:key="m.type"
					variant="secondary"
					size="sm"
					class="h-auto min-w-0 flex-col gap-1 px-1 py-2"
					:title="`Add ${m.label.toLowerCase()} mask`"
					@click="addMask(m.type)"
				>
					<component :is="m.icon" />
					<span class="max-w-full truncate">{{ m.label }}</span>
				</Button>
			</div>
		</div>

		<!-- Empty state -->
		<div v-if="masks.length === 0" class="rounded-lg border border-dashed border-line">
			<EmptyState
				size="sm"
				:icon="Scissors"
				title="No masks"
				description="Add a rectangle, ellipse or polygon mask above."
				class="py-5"
			/>
		</div>

		<!-- Mask list -->
		<div
			v-for="mask in masks"
			:key="mask.id"
			class="min-w-0 overflow-hidden rounded-lg border border-line-subtle bg-surface-raised"
		>
			<div class="flex h-8 items-center gap-1.5 pl-2.5 pr-1">
				<component :is="maskIcon(mask.type)" class="size-3.5 shrink-0 text-fg-subtle" />
				<span class="min-w-0 flex-1 truncate text-xs font-medium capitalize text-fg">{{ mask.type }}</span>
				<Button
					variant="ghost"
					size="icon-xs"
					class="hover:bg-danger-soft hover:text-danger"
					title="Remove mask"
					aria-label="Remove mask"
					@click="removeMask(mask.id)"
				>
					<Trash2 />
				</Button>
			</div>

			<div class="space-y-1.5 border-t border-line-subtle px-2.5 py-2">
				<SliderField
					inline
					label="Center X"
					:model-value="mask.x"
					:min="0"
					:max="1"
					:step="0.01"
					:readout="`${Math.round(mask.x * 100)}%`"
					@update:model-value="(v) => updateMask(mask.id, { x: v })"
				/>
				<SliderField
					inline
					label="Center Y"
					:model-value="mask.y"
					:min="0"
					:max="1"
					:step="0.01"
					:readout="`${Math.round(mask.y * 100)}%`"
					@update:model-value="(v) => updateMask(mask.id, { y: v })"
				/>
				<SliderField
					inline
					label="Width"
					:model-value="mask.width"
					:min="0.01"
					:max="1"
					:step="0.01"
					:readout="`${Math.round(mask.width * 100)}%`"
					@update:model-value="(v) => updateMask(mask.id, { width: clamp(v, 0.01, 1) })"
				/>
				<SliderField
					inline
					label="Height"
					:model-value="mask.height"
					:min="0.01"
					:max="1"
					:step="0.01"
					:readout="`${Math.round(mask.height * 100)}%`"
					@update:model-value="(v) => updateMask(mask.id, { height: clamp(v, 0.01, 1) })"
				/>
				<SliderField
					inline
					label="Feather"
					:model-value="mask.feather"
					:min="0"
					:max="80"
					:step="1"
					:readout="`${mask.feather}px`"
					@update:model-value="(v) => updateMask(mask.id, { feather: v })"
				/>
				<SliderField
					inline
					label="Rotation"
					:model-value="mask.rotation"
					:min="-180"
					:max="180"
					:step="1"
					:readout="`${mask.rotation}°`"
					@update:model-value="(v) => updateMask(mask.id, { rotation: v })"
				/>
				<SliderField
					v-if="mask.type === 'rectangle'"
					inline
					label="Corner radius"
					:model-value="mask.cornerRadius ?? 0"
					:min="0"
					:max="1"
					:step="0.01"
					:readout="`${Math.round((mask.cornerRadius ?? 0) * 100)}%`"
					@update:model-value="(v) => updateMask(mask.id, { cornerRadius: v })"
				/>
				<InspectorField inline label="Invert">
					<div class="flex-1" />
					<Switch
						:model-value="mask.invert"
						aria-label="Invert mask"
						@update:model-value="(val: boolean) => updateMask(mask.id, { invert: val })"
					/>
				</InspectorField>
			</div>
		</div>
	</InspectorSection>
</template>
