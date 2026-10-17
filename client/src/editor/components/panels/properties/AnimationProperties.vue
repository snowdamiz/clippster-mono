<script setup lang="ts">
import { ref, computed, h } from "vue";
import { useEditor } from "../../../composables/useEditor";
import type { ElementAnimation, AnimationType, AnimationEasing, AnimationCategory } from "../../../types/animations";
import { ANIMATION_PRESETS, getExportableAnimationPresetsForDirection, ANIMATION_CATEGORIES } from "../../../constants/animation-constants";
import { X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import InspectorField from "../shared/InspectorField.vue";
import InspectorSelect from "../shared/InspectorSelect.vue";
import SliderField from "../shared/SliderField.vue";
import OptionChip from "../shared/OptionChip.vue";

const props = defineProps<{
	elementId: string;
	trackId: string;
	animationIn?: ElementAnimation;
	animationOut?: ElementAnimation;
	animationLoop?: ElementAnimation;
	elementDuration: number;
}>();

const { editor } = useEditor({ subscribe: false });

type AnimTab = "in" | "out" | "loop";
const activeTab = ref<AnimTab>("in");

/** Brand dot marking In / Out / Loop slots that have an animation set. */
const SetDot = () =>
	h("svg", { viewBox: "0 0 14 14", class: "text-brand", "aria-hidden": "true" }, [
		h("circle", { cx: 7, cy: 7, r: 3, fill: "currentColor" }),
	]);

const tabOptions = computed<SegmentedOption<AnimTab>[]>(() => [
	{ value: "in", label: "In", icon: props.animationIn ? SetDot : undefined },
	{ value: "out", label: "Out", icon: props.animationOut ? SetDot : undefined },
	{ value: "loop", label: "Loop", icon: props.animationLoop ? SetDot : undefined },
]);

function selectTab(tab: AnimTab) {
	activeTab.value = tab;
	selectedCategory.value = "all";
}

const inPresets = computed(() => getExportableAnimationPresetsForDirection("in"));
const outPresets = computed(() => getExportableAnimationPresetsForDirection("out"));
const loopPresets = computed(() => getExportableAnimationPresetsForDirection("loop"));

const currentPresets = computed(() => {
	switch (activeTab.value) {
		case "in": return inPresets.value;
		case "out": return outPresets.value;
		case "loop": return loopPresets.value;
	}
});

const currentAnim = computed(() => {
	switch (activeTab.value) {
		case "in": return props.animationIn;
		case "out": return props.animationOut;
		case "loop": return props.animationLoop;
	}
});

const selectedCategory = ref<AnimationCategory | "all">("all");

const filteredPresets = computed(() => {
	if (selectedCategory.value === "all") return currentPresets.value;
	return currentPresets.value.filter((p) => p.category === selectedCategory.value);
});

const availableCategories = computed(() => {
	const cats = new Set(currentPresets.value.map((p) => p.category));
	return ANIMATION_CATEGORIES.filter((c) => cats.has(c.id));
});

const easingOptions: { value: AnimationEasing; label: string }[] = [
	{ value: "linear", label: "Linear" },
	{ value: "ease-in", label: "Ease in" },
	{ value: "ease-out", label: "Ease out" },
	{ value: "ease-in-out", label: "Ease in out" },
	{ value: "ease-in-cubic", label: "Ease in cubic" },
	{ value: "ease-out-cubic", label: "Ease out cubic" },
	{ value: "ease-in-out-cubic", label: "Ease in out cubic" },
	{ value: "ease-out-back", label: "Overshoot" },
	{ value: "ease-out-bounce", label: "Bounce" },
	{ value: "spring", label: "Spring" },
];

const currentAnimLabel = computed(() => {
	const anim = currentAnim.value;
	if (!anim) return "";
	return ANIMATION_PRESETS.find((p) => p.type === anim.type)?.label ?? anim.type;
});

function update(updates: Record<string, unknown>) {
	editor.timeline.updateElement({
		trackId: props.trackId,
		elementId: props.elementId,
		updates,
	});
}

function selectAnimation(type: AnimationType) {
	const preset = ANIMATION_PRESETS.find((p) => p.type === type);
	if (!preset) return;

	const anim: ElementAnimation = {
		type,
		duration: preset.defaultDuration,
		easing: preset.defaultEasing,
	};

	const key = activeTab.value === "in" ? "animationIn" : activeTab.value === "out" ? "animationOut" : "animationLoop";
	update({ [key]: anim });
}

function removeAnimation() {
	const key = activeTab.value === "in" ? "animationIn" : activeTab.value === "out" ? "animationOut" : "animationLoop";
	update({ [key]: undefined });
}

function updateDuration(val: number) {
	if (!currentAnim.value) return;
	const key = activeTab.value === "in" ? "animationIn" : activeTab.value === "out" ? "animationOut" : "animationLoop";
	const maxDur = activeTab.value === "loop" ? 10 : Math.min(props.elementDuration, 5);
	const clamped = Math.max(0.1, Math.min(maxDur, val));
	update({ [key]: { ...currentAnim.value, duration: Math.round(clamped * 10) / 10 } });
}

function updateEasing(easing: AnimationEasing) {
	if (!currentAnim.value) return;
	const key = activeTab.value === "in" ? "animationIn" : activeTab.value === "out" ? "animationOut" : "animationLoop";
	update({ [key]: { ...currentAnim.value, easing } });
}
</script>

<template>
	<div class="flex flex-col gap-3">
		<!-- In / Out / Loop -->
		<SegmentedControl :model-value="activeTab" :options="tabOptions" size="sm" block @update:model-value="selectTab" />

		<!-- Active animation -->
		<div v-if="currentAnim" class="overflow-hidden rounded-lg border border-line-subtle bg-surface-raised">
			<div class="flex h-8 items-center gap-1 pl-2.5 pr-1">
				<span class="min-w-0 flex-1 truncate text-xs font-medium text-fg">{{ currentAnimLabel }}</span>
				<Button
					variant="ghost"
					size="icon-xs"
					class="hover:bg-danger-soft hover:text-danger"
					title="Remove animation"
					aria-label="Remove animation"
					@click="removeAnimation"
				>
					<X />
				</Button>
			</div>
			<div class="space-y-1.5 border-t border-line-subtle px-2.5 py-2">
				<SliderField
					inline
					label="Duration"
					:model-value="currentAnim.duration * 10"
					:min="1"
					:max="activeTab === 'loop' ? 100 : Math.min(elementDuration * 10, 50)"
					:step="1"
					:readout="`${currentAnim.duration.toFixed(1)}s`"
					@update:model-value="(v) => updateDuration(v / 10)"
				/>
				<InspectorField inline label="Easing">
					<InspectorSelect
						:model-value="currentAnim.easing"
						:options="easingOptions"
						aria-label="Easing"
						class="flex-1"
						@update:model-value="(v) => updateEasing(v as AnimationEasing)"
					/>
				</InspectorField>
			</div>
		</div>

		<!-- Category filter -->
		<div class="flex flex-wrap gap-1">
			<OptionChip variant="ghost" :active="selectedCategory === 'all'" @click="selectedCategory = 'all'">All</OptionChip>
			<OptionChip
				v-for="cat in availableCategories"
				:key="cat.id"
				variant="ghost"
				:active="selectedCategory === cat.id"
				@click="selectedCategory = cat.id"
			>
				{{ cat.label }}
			</OptionChip>
		</div>

		<!-- Presets -->
		<div class="grid grid-cols-2 gap-0.5">
			<OptionChip variant="ghost" :active="!currentAnim" :icon="X" class="h-7 justify-start px-2" @click="removeAnimation">
				None
			</OptionChip>
			<OptionChip
				v-for="preset in filteredPresets"
				:key="preset.type"
				variant="ghost"
				:active="currentAnim?.type === preset.type"
				class="h-7 justify-start px-2"
				:title="preset.label"
				@click="selectAnimation(preset.type)"
			>
				<span class="truncate">{{ preset.label }}</span>
			</OptionChip>
		</div>
	</div>
</template>
