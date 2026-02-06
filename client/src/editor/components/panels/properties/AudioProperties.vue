<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import type { AudioElement } from "../../../types/timeline";
import { Headphones, Trash2, VolumeX, Volume2, Gauge } from "lucide-vue-next";

const props = defineProps<{
	element: AudioElement;
	trackId: string;
}>();

const { editor } = useEditor();
const { selectedElements } = useElementSelection();

const volumeInput = ref(Math.round(props.element.volume * 100).toString());
const fadeInInput = ref((props.element.fadeIn ?? 0).toFixed(1));
const fadeOutInput = ref((props.element.fadeOut ?? 0).toFixed(1));

watch(() => props.element.volume, (v) => { volumeInput.value = Math.round(v * 100).toString(); });
watch(() => props.element.fadeIn, (v) => { fadeInInput.value = (v ?? 0).toFixed(1); });
watch(() => props.element.fadeOut, (v) => { fadeOutInput.value = (v ?? 0).toFixed(1); });

const speedPresets = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];
const currentSpeed = computed(() => props.element.speed ?? 1);

function changeSpeed(speed: number) {
	editor.timeline.changeElementSpeed({
		trackId: props.trackId,
		elementId: props.element.id,
		speed,
	});
}

function update(updates: Record<string, unknown>) {
	editor.timeline.updateElement({
		trackId: props.trackId,
		elementId: props.element.id,
		updates,
	});
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function handleVolumeSlider(e: Event) {
	const val = Number((e.target as HTMLInputElement).value);
	volumeInput.value = val.toString();
	update({ volume: val / 100 });
}
function handleVolumeInput(value: string) {
	volumeInput.value = value;
	const parsed = parseInt(value, 10);
	if (!Number.isNaN(parsed)) update({ volume: clamp(parsed, 0, 200) / 100 });
}
function handleVolumeBlur() {
	const parsed = parseInt(volumeInput.value, 10);
	const pct = Number.isNaN(parsed) ? Math.round(props.element.volume * 100) : clamp(parsed, 0, 200);
	volumeInput.value = pct.toString();
	update({ volume: pct / 100 });
}

function handleFadeIn(value: string) {
	fadeInInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) update({ fadeIn: clamp(parsed, 0, props.element.duration / 2) });
}
function handleFadeOut(value: string) {
	fadeOutInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) update({ fadeOut: clamp(parsed, 0, props.element.duration / 2) });
}

function handleDelete() {
	editor.timeline.deleteElements({
		elements: selectedElements.value.length > 0
			? selectedElements.value
			: [{ trackId: props.trackId, elementId: props.element.id }],
	});
}

function formatTime(seconds: number): string {
	const min = Math.floor(seconds / 60);
	const sec = (seconds % 60).toFixed(2);
	return `${min}:${sec.padStart(5, "0")}`;
}
</script>

<template>
	<div class="space-y-5 p-4">
		<!-- Header -->
		<div class="flex items-center gap-2">
			<Headphones class="size-4 text-zinc-500" />
			<h3 class="text-sm font-medium">Audio</h3>
		</div>

		<!-- Info -->
		<div class="space-y-3">
			<div class="space-y-1">
				<label class="text-xs text-zinc-500">Name</label>
				<p class="text-sm">{{ element.name }}</p>
			</div>
			<div class="flex gap-4">
				<div class="space-y-1">
					<label class="text-xs text-zinc-500">Start</label>
					<p class="text-sm">{{ formatTime(element.startTime) }}</p>
				</div>
				<div class="space-y-1">
					<label class="text-xs text-zinc-500">Duration</label>
					<p class="text-sm">{{ formatTime(element.duration) }}</p>
				</div>
			</div>
		</div>

		<!-- Volume -->
		<div class="space-y-1.5">
			<label class="text-xs text-zinc-500">Volume</label>
			<div class="flex items-center gap-2">
				<input type="range" :value="element.volume * 100" min="0" max="200" step="1" class="flex-1" @input="handleVolumeSlider" />
				<input type="number" :value="volumeInput" min="0" max="200" class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200" @input="(e) => handleVolumeInput((e.target as HTMLInputElement).value)" @blur="handleVolumeBlur" />
			</div>
		</div>

		<!-- Mute toggle -->
		<button
			:class="[
				'flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
				element.muted
					? 'border border-red-500/30 bg-red-500/15 text-red-400 hover:bg-red-500/25'
					: 'border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10',
			]"
			@click="update({ muted: !element.muted })"
		>
			<component :is="element.muted ? VolumeX : Volume2" class="size-4" />
			{{ element.muted ? 'Unmute' : 'Mute' }}
		</button>

		<!-- Speed -->
		<div class="space-y-1.5">
			<div class="flex items-center gap-1.5">
				<Gauge class="size-3 text-zinc-500" />
				<label class="text-xs text-zinc-500">Speed</label>
			</div>
			<div class="flex flex-wrap gap-1">
				<button
					v-for="s in speedPresets"
					:key="s"
					:class="[
						'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
						currentSpeed === s
							? 'bg-primary/20 text-primary border border-primary/30'
							: 'border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200',
					]"
					@click="changeSpeed(s)"
				>
					{{ s }}x
				</button>
			</div>
		</div>

		<!-- Fade In / Fade Out -->
		<div class="grid grid-cols-2 gap-2">
			<div class="space-y-1">
				<label class="text-xs text-zinc-500">Fade In (s)</label>
				<input type="number" :value="fadeInInput" min="0" :max="element.duration / 2" step="0.1" class="h-7 w-full rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200" @input="(e) => handleFadeIn((e.target as HTMLInputElement).value)" />
			</div>
			<div class="space-y-1">
				<label class="text-xs text-zinc-500">Fade Out (s)</label>
				<input type="number" :value="fadeOutInput" min="0" :max="element.duration / 2" step="0.1" class="h-7 w-full rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200" @input="(e) => handleFadeOut((e.target as HTMLInputElement).value)" />
			</div>
		</div>

		<!-- Delete -->
		<button
			class="flex w-full items-center justify-center gap-2 rounded-md border border-red-500/30 bg-red-500/15 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/25 hover:border-red-500/50"
			@click="handleDelete"
		>
			<Trash2 class="size-4" />
			Delete Audio
		</button>
	</div>
</template>
