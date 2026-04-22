<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useEditor } from "../../../composables/useEditor";
import type { Transition, TransitionType } from "../../../types/transitions";
import { TRANSITION_PRESETS } from "../../../constants/transition-constants";
import TransitionPreviewCanvas from "../assets/TransitionPreviewCanvas.vue";
import { ArrowRightLeft, Trash2 } from "lucide-vue-next";
import { SetTransitionCommand } from "../../../lib/commands/scene";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";

const props = defineProps<{
	transition: Transition;
}>();

const { editor } = useEditor();
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
	<div class="space-y-3 rounded-lg border border-[#E040FB]/20 bg-[#E040FB]/5 p-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<ArrowRightLeft class="size-3.5 text-[#E040FB]" />
				<span class="text-xs font-medium text-[#E040FB]">Transition</span>
			</div>
			<button
				class="flex size-6 items-center justify-center rounded text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
				title="Remove transition"
				@click="removeTransition"
			>
				<Trash2 class="size-3.5" />
			</button>
		</div>

		<!-- Current transition preview -->
		<div class="flex items-center gap-2.5">
			<div class="size-10 shrink-0 overflow-hidden rounded bg-zinc-900">
				<TransitionPreviewCanvas :transition-type="transition.type" />
			</div>
			<div>
				<p class="text-xs font-medium text-zinc-200">{{ preset?.label ?? transition.type }}</p>
				<p class="text-[10px] text-zinc-500">{{ preset?.description ?? '' }}</p>
			</div>
		</div>

		<!-- Duration -->
		<div class="space-y-1">
			<label class="text-[11px] font-medium text-zinc-400">Duration</label>
			<div class="flex min-w-0 items-center gap-2">
				<input
					v-model.number="localDuration"
					type="range"
					min="0.1"
					max="2.0"
					step="0.05"
					class="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-[#E040FB]"
					@change="updateDuration"
				/>
				<div class="flex shrink-0 items-center rounded border border-white/10 bg-white/5 px-2 py-0.5 tabular-nums">
					<input
						v-model.number="localDuration"
						type="number"
						min="0.1"
						max="2.0"
						step="0.05"
						class="w-[4.25rem] min-w-0 bg-transparent text-right text-[11px] text-zinc-300 focus:outline-none"
						@blur="updateDuration"
						@keydown.enter="updateDuration"
					/>
					<span class="ml-1 shrink-0 text-[10px] text-zinc-600">s</span>
				</div>
			</div>
		</div>

		<!-- Type picker (compact grid) -->
		<div class="space-y-1">
			<label class="text-[11px] font-medium text-zinc-400">Type</label>
			<div class="grid max-h-52 grid-cols-4 gap-1 overflow-y-auto overscroll-y-contain pr-0.5">
				<button
					v-for="p in TRANSITION_PRESETS"
					:key="p.type"
					:title="p.label"
					:class="[
						'overflow-hidden rounded border transition-all',
						transition.type === p.type
							? 'border-[#E040FB]/50 bg-[#E040FB]/10'
							: 'border-white/5 bg-white/[0.02] hover:border-[#E040FB]/20',
					]"
					@click="updateTransitionType(p.type)"
				>
					<div class="aspect-[3/2] w-full overflow-hidden">
						<TransitionPreviewCanvas :transition-type="p.type" />
					</div>
					<p
						class="truncate px-0.5 py-0.5 text-center text-[8px]"
						:class="transition.type === p.type ? 'text-[#E040FB]' : 'text-zinc-500'"
					>
						{{ p.label }}
					</p>
				</button>
			</div>
		</div>
	</div>
</template>
