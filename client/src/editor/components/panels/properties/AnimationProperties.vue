<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import type { ElementAnimation, AnimationType, AnimationEasing, AnimationCategory } from "../../../types/animations";
import { ANIMATION_PRESETS, getPresetsForDirection, ANIMATION_CATEGORIES } from "../../../constants/animation-constants";
import { X, RotateCcw } from "lucide-vue-next";

const props = defineProps<{
	elementId: string;
	trackId: string;
	animationIn?: ElementAnimation;
	animationOut?: ElementAnimation;
	animationLoop?: ElementAnimation;
	elementDuration: number;
}>();

const { editor } = useEditor();

type AnimTab = "in" | "out" | "loop";
const activeTab = ref<AnimTab>("in");

const inPresets = computed(() => getPresetsForDirection("in"));
const outPresets = computed(() => getPresetsForDirection("out"));
const loopPresets = computed(() => getPresetsForDirection("loop"));

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

const easingOptions: { id: AnimationEasing; label: string }[] = [
	{ id: "linear", label: "Linear" },
	{ id: "ease-in", label: "Ease In" },
	{ id: "ease-out", label: "Ease Out" },
	{ id: "ease-in-out", label: "Ease In Out" },
	{ id: "ease-in-cubic", label: "Ease In Cubic" },
	{ id: "ease-out-cubic", label: "Ease Out Cubic" },
	{ id: "ease-in-out-cubic", label: "Ease In Out Cubic" },
	{ id: "ease-out-back", label: "Overshoot" },
	{ id: "ease-out-bounce", label: "Bounce" },
	{ id: "spring", label: "Spring" },
];

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
	<div class="flex flex-col gap-3 p-3">
		<!-- Tab selector: In / Out / Loop -->
		<div class="flex rounded-md border border-white/10 bg-white/[0.02]">
			<button
				v-for="tab in (['in', 'out', 'loop'] as const)"
				:key="tab"
				:class="[
					'flex-1 py-1.5 text-center text-xs font-medium transition-colors',
					activeTab === tab
						? 'bg-primary/15 text-primary'
						: 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5',
				]"
				@click="activeTab = tab; selectedCategory = 'all'"
			>
				{{ tab === 'in' ? 'In' : tab === 'out' ? 'Out' : 'Loop' }}
				<span v-if="(tab === 'in' && animationIn) || (tab === 'out' && animationOut) || (tab === 'loop' && animationLoop)" class="ml-1 inline-block size-1.5 rounded-full bg-primary" />
			</button>
		</div>

		<!-- Active animation controls -->
		<div v-if="currentAnim" class="space-y-2.5 rounded-md border border-white/10 bg-white/[0.02] p-2.5">
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-zinc-300">{{ ANIMATION_PRESETS.find(p => p.type === currentAnim!.type)?.label ?? currentAnim!.type }}</span>
				<button
					class="flex size-5 items-center justify-center rounded text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
					title="Remove animation"
					@click="removeAnimation"
				>
					<X class="size-3" />
				</button>
			</div>

			<!-- Duration -->
			<div class="space-y-1">
				<label class="text-[10px] text-zinc-500">Duration</label>
				<div class="flex items-center gap-2">
					<input
						type="range"
						:value="currentAnim!.duration * 10"
						min="1"
						:max="activeTab === 'loop' ? 100 : Math.min(elementDuration * 10, 50)"
						step="1"
						class="flex-1"
						@input="(e) => updateDuration(Number((e.target as HTMLInputElement).value) / 10)"
					/>
					<div class="flex h-6 w-14 items-center rounded-sm border border-white/10 bg-white/5 px-1.5">
						<span class="w-full text-center text-[10px] text-zinc-300">{{ currentAnim!.duration.toFixed(1) }}s</span>
					</div>
				</div>
			</div>

			<!-- Easing -->
			<div class="space-y-1">
				<label class="text-[10px] text-zinc-500">Easing</label>
				<select
					:value="currentAnim!.easing"
					class="h-6 w-full rounded-sm border border-white/10 bg-white/5 px-1.5 text-[10px] text-zinc-300 outline-none"
					@change="(e) => updateEasing((e.target as HTMLSelectElement).value as AnimationEasing)"
				>
					<option v-for="opt in easingOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
				</select>
			</div>
		</div>

		<!-- Category filter -->
		<div class="flex flex-wrap gap-1">
			<button
				:class="[
					'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
					selectedCategory === 'all'
						? 'bg-white/10 text-zinc-200'
						: 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
				]"
				@click="selectedCategory = 'all'"
			>
				All
			</button>
			<button
				v-for="cat in availableCategories"
				:key="cat.id"
				:class="[
					'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
					selectedCategory === cat.id
						? 'bg-white/10 text-zinc-200'
						: 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
				]"
				@click="selectedCategory = cat.id"
			>
				{{ cat.label }}
			</button>
		</div>

		<!-- Preset grid -->
		<div class="grid grid-cols-3 gap-1.5">
			<!-- None option -->
			<button
				:class="[
					'flex flex-col items-center justify-center rounded-md border px-1 py-2.5 text-center transition-colors',
					!currentAnim
						? 'border-primary/40 bg-primary/10 text-primary'
						: 'border-white/10 bg-white/[0.02] text-zinc-500 hover:border-white/20 hover:bg-white/5 hover:text-zinc-300',
				]"
				@click="removeAnimation"
			>
				<X class="mb-0.5 size-4" />
				<span class="text-[10px] font-medium">None</span>
			</button>

			<button
				v-for="preset in filteredPresets"
				:key="preset.type"
				:class="[
					'flex flex-col items-center justify-center rounded-md border px-1 py-2.5 text-center transition-colors',
					currentAnim?.type === preset.type
						? 'border-primary/40 bg-primary/10 text-primary'
						: 'border-white/10 bg-white/[0.02] text-zinc-500 hover:border-white/20 hover:bg-white/5 hover:text-zinc-300',
				]"
				:title="preset.label"
				@click="selectAnimation(preset.type)"
			>
				<span class="text-[10px] font-medium leading-tight">{{ preset.label }}</span>
			</button>
		</div>
	</div>
</template>
