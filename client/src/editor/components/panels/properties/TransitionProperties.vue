<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useEditor } from "../../../composables/useEditor";
import type { Transition, TransitionType } from "../../../types/transitions";
import { TRANSITION_PRESETS } from "../../../constants/transition-constants";
import TransitionPreviewCanvas from "../assets/TransitionPreviewCanvas.vue";
import { Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import SliderField from "../shared/SliderField.vue";
import AssetGrid from "../shared/AssetGrid.vue";
import AssetTile from "../shared/AssetTile.vue";
import { SetTransitionCommand } from "../../../lib/commands/scene";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";

const props = defineProps<{
	transition: Transition;
}>();

const { editor } = useEditor({ subscribe: false });
const { clearElementSelection } = useElementSelection();

const localDuration = ref(props.transition.duration);

watch(
	() => props.transition.duration,
	(v) => {
		localDuration.value = v;
	},
);

const preset = computed(() => TRANSITION_PRESETS.find((p) => p.type === props.transition.type));

function updateTransitionType(type: TransitionType) {
	updateTransition({ type });
}

function updateDuration() {
	const clamped = Math.max(0.1, Math.min(2.0, localDuration.value));
	localDuration.value = clamped;
	updateTransition({ duration: clamped });
}

function removeTransition() {
	const command = new SetTransitionCommand(null, props.transition.targetElementId);
	editor.command.execute({ command });
	clearElementSelection();
}

function updateTransition(updates: Partial<Transition>) {
	const updated = { ...props.transition, ...updates };
	const command = new SetTransitionCommand(updated, props.transition.targetElementId);
	editor.command.execute({ command });
}
</script>

<template>
	<div class="space-y-3">
		<!-- Current transition -->
		<div class="flex items-center gap-2.5 rounded-lg border border-line-subtle bg-surface-raised p-2">
			<div class="h-9 w-12 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
				<TransitionPreviewCanvas :transition-type="transition.type" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="truncate text-xs font-medium text-fg">{{ preset?.label ?? transition.type }}</p>
				<p v-if="preset?.description" class="truncate text-2xs text-fg-subtle" :title="preset.description">
					{{ preset.description }}
				</p>
			</div>
			<Button
				variant="ghost"
				size="icon-xs"
				class="hover:bg-danger-soft hover:text-danger"
				title="Remove transition"
				aria-label="Remove transition"
				@click="removeTransition"
			>
				<Trash2 />
			</Button>
		</div>

		<!-- Duration -->
		<SliderField
			label="Duration"
			:model-value="localDuration"
			:min="0.1"
			:max="2"
			:step="0.05"
			unit="s"
			@update:model-value="(v) => (localDuration = v)"
			@change="updateDuration"
			@commit="updateDuration"
		/>

		<!-- Type picker -->
		<div class="space-y-2 border-t border-line-subtle pt-3">
			<SectionHeader title="Type" variant="eyebrow" class="min-h-5" />
			<AssetGrid :min="72">
				<AssetTile
					v-for="p in TRANSITION_PRESETS"
					:key="p.type"
					:label="p.label"
					:title="p.label"
					:selected="transition.type === p.type"
					aspect="3/2"
					@click="updateTransitionType(p.type)"
				>
					<TransitionPreviewCanvas :transition-type="p.type" />
				</AssetTile>
			</AssetGrid>
		</div>
	</div>
</template>
