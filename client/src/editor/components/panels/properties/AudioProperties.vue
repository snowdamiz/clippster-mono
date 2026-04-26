<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import type { AudioElement } from "../../../types/timeline";
import type { AudioEffect } from "../../../types/audio-effects";
import { AUDIO_EFFECT_PRESETS, AUDIO_EFFECT_CATEGORIES, getAudioEffectPreset } from "../../../constants/audio-effect-constants";
import { generateUUID } from "../../../utils/id";
import { Headphones, Trash2, VolumeX, Volume2, Gauge, Wand2, Eye, EyeOff, X, ChevronDown, Plus } from "lucide-vue-next";

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

const speedTicks = [0.5, 1, 2, 3, 4, 5, 8, 10];
const currentSpeed = computed(() => props.element.speed ?? 1);
const speedInput = ref(currentSpeed.value.toFixed(2));

watch(() => props.element.speed, (v) => { speedInput.value = (v ?? 1).toFixed(2); });

function changeSpeed(speed: number) {
	const clamped = Math.round(Math.max(0.1, Math.min(10, speed)) * 10) / 10;
	speedInput.value = clamped.toFixed(2);
	editor.timeline.changeElementSpeed({
		trackId: props.trackId,
		elementId: props.element.id,
		speed: clamped,
	});
}

function handleSpeedInput(value: string) {
	speedInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed) && parsed >= 0.1 && parsed <= 10) {
		editor.timeline.changeElementSpeed({
			trackId: props.trackId,
			elementId: props.element.id,
			speed: Math.round(parsed * 10) / 10,
		});
	}
}

function handleSpeedBlur() {
	const parsed = parseFloat(speedInput.value);
	const val = Number.isNaN(parsed) ? (props.element.speed ?? 1) : Math.max(0.1, Math.min(10, parsed));
	const clamped = Math.round(val * 10) / 10;
	speedInput.value = clamped.toFixed(2);
	editor.timeline.changeElementSpeed({
		trackId: props.trackId,
		elementId: props.element.id,
		speed: clamped,
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

function updatePan(value: number) {
	update({ pan: Math.round(value * 100) / 100 });
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

// --- Audio Effects ---
const audioEffects = computed(() => props.element.audioEffects ?? []);
const showAudioEffects = ref(audioEffects.value.length > 0);
const showAddEffect = ref(false);

watch(() => props.element.audioEffects, (v) => {
	if (v && v.length > 0) showAudioEffects.value = true;
});

function addAudioEffect(type: string) {
	const preset = getAudioEffectPreset(type);
	if (!preset) return;
	const newEffect: AudioEffect = {
		...preset.defaults,
		id: generateUUID(),
	} as AudioEffect;
	update({ audioEffects: [...audioEffects.value, newEffect] });
	showAddEffect.value = false;
}

function toggleAudioEffect(effectId: string) {
	const updated = audioEffects.value.map((e) =>
		e.id === effectId ? { ...e, enabled: !e.enabled } : e,
	);
	update({ audioEffects: updated });
}

function removeAudioEffect(effectId: string) {
	const updated = audioEffects.value.filter((e) => e.id !== effectId);
	update({ audioEffects: updated });
}

function updateAudioEffectParam(effectId: string, key: string, value: number | string) {
	const updated = audioEffects.value.map((e) =>
		e.id === effectId ? { ...e, [key]: value } : e,
	);
	update({ audioEffects: updated });
}

function getAudioEffectLabel(type: string): string {
	return getAudioEffectPreset(type)?.label ?? type;
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

		<!-- Pan -->
		<div class="space-y-1.5">
			<div class="flex items-center justify-between">
				<label class="text-xs text-zinc-500">Pan</label>
				<div class="flex items-center gap-1.5">
					<span class="text-[10px] text-zinc-600">L</span>
					<span class="min-w-[28px] text-center text-[10px] text-zinc-400">
						{{ (element.pan ?? 0) === 0 ? 'C' : (element.pan ?? 0) > 0 ? `R${Math.round(Math.abs(element.pan ?? 0) * 100)}` : `L${Math.round(Math.abs(element.pan ?? 0) * 100)}` }}
					</span>
					<span class="text-[10px] text-zinc-600">R</span>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<input
					type="range"
					:value="(element.pan ?? 0) * 100"
					min="-100"
					max="100"
					step="1"
					class="flex-1"
					@input="(e) => updatePan(Number((e.target as HTMLInputElement).value) / 100)"
				/>
				<button
					class="rounded border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:text-zinc-200"
					@click="updatePan(0)"
				>
					C
				</button>
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
			<div class="flex items-center gap-2">
				<div class="relative flex-1">
					<input type="range" :value="currentSpeed * 10" min="1" max="100" step="1" class="w-full" @input="(e) => changeSpeed(Number((e.target as HTMLInputElement).value) / 10)" />
					<!-- Tick marks -->
					<div class="pointer-events-none absolute inset-x-0 top-1/2 flex h-0 items-center">
						<div
							v-for="tick in speedTicks"
							:key="tick"
							class="absolute h-[8px] w-px bg-white/25"
							:style="{ left: `${((tick * 10 - 1) / 99) * 100}%` }"
						/>
					</div>
				</div>
				<div class="flex h-7 w-[72px] items-center rounded-sm border border-white/10 bg-white/5">
					<input
						type="text"
						:value="speedInput"
						class="w-full bg-transparent text-center text-xs text-zinc-200 outline-none"
						@input="(e) => handleSpeedInput((e.target as HTMLInputElement).value)"
						@blur="handleSpeedBlur"
						@keydown.enter="($event.target as HTMLInputElement).blur()"
					/>
					<span class="pr-1.5 text-[10px] text-zinc-500">x</span>
				</div>
			</div>
		</div>

		<!-- Fade In / Fade Out -->
		<div class="space-y-1.5">
			<label class="text-xs text-zinc-500">Fade</label>
			<div class="flex items-center gap-3">
				<div class="flex flex-1 flex-col gap-1">
					<span class="text-[9px] text-zinc-600">In</span>
					<input type="range" :value="(element.fadeIn ?? 0) * 10" min="0" max="30" step="1" class="w-full" @input="(e) => handleFadeIn((Number((e.target as HTMLInputElement).value) / 10).toFixed(1))" />
					<span class="text-[9px] text-zinc-500">{{ (element.fadeIn ?? 0).toFixed(1) }}s</span>
				</div>
				<div class="flex flex-1 flex-col gap-1">
					<span class="text-[9px] text-zinc-600">Out</span>
					<input type="range" :value="(element.fadeOut ?? 0) * 10" min="0" max="30" step="1" class="w-full" @input="(e) => handleFadeOut((Number((e.target as HTMLInputElement).value) / 10).toFixed(1))" />
					<span class="text-[9px] text-zinc-500">{{ (element.fadeOut ?? 0).toFixed(1) }}s</span>
				</div>
			</div>
		</div>

		<!-- Audio Effects -->
		<div class="space-y-3">
			<button class="flex w-full items-center justify-between" @click="showAudioEffects = !showAudioEffects">
				<div class="flex items-center gap-1.5">
					<Wand2 class="size-3.5 text-zinc-500" />
					<label class="text-xs font-medium text-zinc-300">Audio Effects</label>
					<span v-if="audioEffects.length > 0" class="rounded-full bg-purple-500/20 px-1.5 text-[10px] font-medium text-purple-400">{{ audioEffects.length }}</span>
				</div>
				<ChevronDown class="size-3.5 text-zinc-500 transition-transform" :class="{ 'rotate-180': !showAudioEffects }" />
			</button>

			<div v-if="showAudioEffects" class="space-y-2">
				<!-- Add effect button -->
				<button
					class="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-white/10 px-3 py-1.5 text-[11px] text-zinc-500 hover:border-purple-500/30 hover:text-purple-400"
					@click="showAddEffect = !showAddEffect"
				>
					<Plus class="size-3" />
					Add Effect
				</button>

				<!-- Effect picker -->
				<div v-if="showAddEffect" class="rounded-md border border-white/10 bg-white/[0.03] p-2 space-y-2">
					<div v-for="cat in AUDIO_EFFECT_CATEGORIES" :key="cat.key" class="space-y-1">
						<p class="text-[9px] font-medium uppercase tracking-wider text-zinc-600">{{ cat.label }}</p>
						<div class="flex flex-wrap gap-1">
							<button
								v-for="preset in AUDIO_EFFECT_PRESETS.filter(p => p.category === cat.key)"
								:key="preset.type"
								class="rounded px-2 py-0.5 text-[10px] border border-white/10 bg-white/5 text-zinc-400 hover:bg-purple-500/10 hover:text-purple-400 hover:border-purple-500/30"
								@click="addAudioEffect(preset.type)"
							>
								{{ preset.label }}
							</button>
						</div>
					</div>
				</div>

				<!-- Applied effects list -->
				<div v-if="audioEffects.length === 0 && !showAddEffect" class="rounded-md border border-dashed border-white/10 px-3 py-4 text-center">
					<p class="text-[11px] text-zinc-600">No audio effects applied</p>
				</div>

				<div v-for="effect in audioEffects" :key="effect.id" class="rounded-md border border-white/5 bg-white/[0.02]">
					<div class="flex items-center justify-between px-2.5 py-1.5">
						<span class="text-xs font-medium" :class="effect.enabled ? 'text-zinc-300' : 'text-zinc-600'">{{ getAudioEffectLabel(effect.type) }}</span>
						<div class="flex items-center gap-1">
							<button class="flex size-5 items-center justify-center rounded text-zinc-500 hover:bg-white/5 hover:text-zinc-300" @click="toggleAudioEffect(effect.id)">
								<component :is="effect.enabled ? Eye : EyeOff" class="size-3" />
							</button>
							<button class="flex size-5 items-center justify-center rounded text-zinc-500 hover:bg-red-500/10 hover:text-red-400" @click="removeAudioEffect(effect.id)">
								<X class="size-3" />
							</button>
						</div>
					</div>

					<div v-if="effect.enabled" class="space-y-1.5 border-t border-white/5 px-2.5 py-2">
						<!-- Mix (all effects) -->
						<div class="flex items-center gap-2">
							<span class="w-14 shrink-0 text-[10px] text-zinc-500">Mix</span>
							<input type="range" :value="effect.mix" min="0" max="100" step="1" class="flex-1"
								@input="(e) => updateAudioEffectParam(effect.id, 'mix', Number((e.target as HTMLInputElement).value))" />
							<input type="number" :value="effect.mix" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
								@input="(e) => updateAudioEffectParam(effect.id, 'mix', Number((e.target as HTMLInputElement).value))" />
						</div>

						<!-- EQ -->
						<template v-if="effect.type === 'eq'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Low</span>
								<input type="range" :value="(effect as any).lowGain" min="-12" max="12" step="0.5" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'lowGain', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).lowGain" min="-12" max="12" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'lowGain', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Mid</span>
								<input type="range" :value="(effect as any).midGain" min="-12" max="12" step="0.5" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'midGain', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).midGain" min="-12" max="12" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'midGain', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">High</span>
								<input type="range" :value="(effect as any).highGain" min="-12" max="12" step="0.5" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'highGain', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).highGain" min="-12" max="12" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'highGain', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Compressor -->
						<template v-if="effect.type === 'compressor'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Thresh</span>
								<input type="range" :value="(effect as any).threshold" min="-60" max="0" step="1" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'threshold', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).threshold" min="-60" max="0" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'threshold', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Ratio</span>
								<input type="range" :value="(effect as any).ratio" min="1" max="20" step="0.5" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'ratio', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).ratio" min="1" max="20" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'ratio', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Reverb -->
						<template v-if="effect.type === 'reverb'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Decay</span>
								<input type="range" :value="(effect as any).decay" min="0.1" max="10" step="0.1" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'decay', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).decay" min="0.1" max="10" step="0.1" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'decay', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Damp</span>
								<input type="range" :value="(effect as any).damping" min="0" max="100" step="1" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'damping', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).damping" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'damping', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Delay -->
						<template v-if="effect.type === 'delay'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Time</span>
								<input type="range" :value="(effect as any).time" min="0" max="2000" step="10" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'time', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).time" min="0" max="2000" step="10" class="h-6 w-14 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'time', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Fdbk</span>
								<input type="range" :value="(effect as any).feedback" min="0" max="90" step="1" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'feedback', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).feedback" min="0" max="90" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'feedback', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Lowpass / Highpass -->
						<template v-if="effect.type === 'lowpass' || effect.type === 'highpass'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Freq</span>
								<input type="range" :value="(effect as any).frequency" min="20" max="20000" step="10" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'frequency', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).frequency" min="20" max="20000" step="10" class="h-6 w-14 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'frequency', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Res</span>
								<input type="range" :value="(effect as any).resonance" min="0" max="20" step="0.5" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'resonance', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).resonance" min="0" max="20" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'resonance', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Bandpass -->
						<template v-if="effect.type === 'bandpass'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Freq</span>
								<input type="range" :value="(effect as any).frequency" min="20" max="20000" step="10" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'frequency', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).frequency" min="20" max="20000" step="10" class="h-6 w-14 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'frequency', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">BW</span>
								<input type="range" :value="(effect as any).bandwidth" min="0.1" max="10" step="0.1" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'bandwidth', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).bandwidth" min="0.1" max="10" step="0.1" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'bandwidth', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Noise Gate -->
						<template v-if="effect.type === 'noisegate'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Thresh</span>
								<input type="range" :value="(effect as any).threshold" min="-80" max="0" step="1" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'threshold', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).threshold" min="-80" max="0" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'threshold', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Pitch Shift -->
						<template v-if="effect.type === 'pitchShift'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Semi</span>
								<input type="range" :value="(effect as any).semitones" min="-12" max="12" step="1" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'semitones', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).semitones" min="-12" max="12" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'semitones', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Chorus -->
						<template v-if="effect.type === 'chorus'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Rate</span>
								<input type="range" :value="(effect as any).rate" min="0.1" max="10" step="0.1" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'rate', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).rate" min="0.1" max="10" step="0.1" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'rate', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Depth</span>
								<input type="range" :value="(effect as any).depth" min="0" max="100" step="1" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'depth', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).depth" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'depth', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Tremolo -->
						<template v-if="effect.type === 'tremolo'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Rate</span>
								<input type="range" :value="(effect as any).rate" min="0.5" max="20" step="0.5" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'rate', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).rate" min="0.5" max="20" step="0.5" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'rate', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Depth</span>
								<input type="range" :value="(effect as any).depth" min="0" max="100" step="1" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'depth', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).depth" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'depth', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>

						<!-- Distortion -->
						<template v-if="effect.type === 'distortion'">
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Drive</span>
								<input type="range" :value="(effect as any).drive" min="0" max="100" step="1" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'drive', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).drive" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'drive', Number((e.target as HTMLInputElement).value))" />
							</div>
							<div class="flex items-center gap-2">
								<span class="w-14 shrink-0 text-[10px] text-zinc-500">Tone</span>
								<input type="range" :value="(effect as any).tone" min="0" max="100" step="1" class="flex-1"
									@input="(e) => updateAudioEffectParam(effect.id, 'tone', Number((e.target as HTMLInputElement).value))" />
								<input type="number" :value="(effect as any).tone" min="0" max="100" class="h-6 w-12 rounded-sm border border-white/10 bg-white/5 text-center text-[10px] text-zinc-300 outline-none"
									@input="(e) => updateAudioEffectParam(effect.id, 'tone', Number((e.target as HTMLInputElement).value))" />
							</div>
						</template>
					</div>
				</div>
			</div>
		</div>

		<!-- Delete -->
		<div class="border-t border-white/10 pt-4 mt-2">
			<button
				class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
				@click="handleDelete"
			>
				<Trash2 class="size-3.5" />
				Delete Audio
			</button>
		</div>
	</div>
</template>
